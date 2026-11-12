// Hub v2 V3: commit and push controller.

// Joins hub/git.mjs (the only code that starts git), hub/commit.js (the pure proposal) and the hub's own views of runs and jobs.
// Everything happens on the owner's press: a commit makes exactly one commit of exactly the ticked files from the current proposal, a push is a separate call, nothing here runs by itself.
// Every method returns data, or {error, code} (code is the HTTP status the server uses; a stale commit also carries the fresh proposal). No model call.
import fs from 'node:fs';
import path from 'node:path';
import {buildProposal,parseStatus,checkSelection,messageProblem,proposalPaths} from './commit.js';
import {writeAtomic} from './plans-store.mjs';
import {safeBranch} from './git.mjs';

const err=(error,code=409,extra={})=>({error,code,...extra});
const SHORT=/^[0-9a-f]{4,40}$/;
export const SUMMARY_MS=5000;

// git: the object from createGit. busy: () => true while a run, a chat turn or a job works. runs, jobs: the controllers (or null). now: the clock.
export function createCommits({root,git,busy=()=>false,runs=null,jobs=null,now=Date.now}){
 const lastFile=path.join(root,'.hub','last-commit.json');
 let working=false,cache=null;
 const readLast=()=>{try{const j=JSON.parse(fs.readFileSync(lastFile,'utf8').replace(/^﻿/,''));return j&&typeof j.id==='string'&&SHORT.test(j.id)?j:null}catch{return null}};
 const writeLast=rec=>{try{fs.mkdirSync(path.dirname(lastFile),{recursive:true});writeAtomic(lastFile,JSON.stringify(rec)+'\n')}catch{}};
 const dropLast=()=>{try{fs.unlinkSync(lastFile)}catch{}};
 const busyText='A run, the master or a job is working. Wait for it, or stop it.';
 const touch=()=>{cache=null};

 // the last finished test run from the hub, either kind (a plain test run or a check)
 const lastTest=()=>{
  if(!jobs)return null;
  let best=null;for(const k of ['test','check']){const l=jobs.last(k);if(l&&l.summary&&Number.isFinite(l.summary.total)&&l.endedAt&&(!best||l.endedAt>best.endedAt))best={ok:!!l.summary.ok,endedAt:l.endedAt,text:l.summary.text}}
  return best};

 function proposal(){
  if(!git.available)return {enabled:true,error:'GitHub Desktop\'s git was not found on this PC, so the hub cannot commit. Commit in GitHub Desktop.'};
  const s=git.status();if(s.error)return {enabled:true,error:s.error};
  const status=parseStatus(s.stdout).map(e=>{let size,mtime;if(e.kind!=='deleted'){try{const st=fs.statSync(path.join(root,e.path));if(st.isFile()){size=st.size;mtime=st.mtimeMs}}catch{}}return {...e,size,mtime}});
  const head=git.head(),rl=runs?runs.list().runs:[],lt=lastTest(),p=buildProposal({status,runs:rl,lastTest:lt,head});
  return {enabled:true,...p,lastTest:lt,busy:!!busy(),last:lastState(head)}}
 // the commit this hub made last, and whether it can still be undone (it is still HEAD and no remote branch has it)
 function lastState(head=git.head()){
  const rec=readLast();if(!rec)return null;
  if(!head||head.id!==rec.id)return {id:rec.id,canUndo:false,why:'It is no longer the newest commit.'};
  if(git.onRemote())return {id:rec.id,canUndo:false,why:'It is already on GitHub, so it cannot be undone from here.'};
  return {id:rec.id,canUndo:true,why:''}}

 // the tree label and the master's status line: counts only, kept for a few seconds
 function summary(){
  if(!git.available)return {enabled:false,files:0,unpushed:0};
  if(cache&&now()-cache.at<SUMMARY_MS)return cache.value;
  let value={enabled:true,files:0,leftOut:0,groups:{},lastId:null,unpushed:0,branch:null};
  try{
   const p=proposal();
   if(!p.error){const b=git.branch(),a=b&&b!=='HEAD'?git.ahead(b):null;
    value={enabled:true,files:p.counts.files,leftOut:p.counts.leftOut,groups:p.counts.groups,lastId:p.head?p.head.id:null,unpushed:a&&a.commits?a.commits.length:0,branch:b}}
  }catch{}
  cache={at:now(),value};return value}

 async function commit({files,message,hash}){
  if(working)return err('A commit or push is already in progress.');
  if(busy())return err(busyText,423);
  const bad=messageProblem(message);if(bad)return err(bad,400);
  working=true;
  try{
   const fresh=proposal();if(fresh.error)return err(fresh.error,409);
   if(hash!==fresh.hash)return err('The files or the last commit changed since you opened this page. Review the list below, then press Commit again.',409,{proposal:fresh});
   const sel=checkSelection(fresh,files);if(sel.error)return err(sel.error,400);
   if(sel.toAdd.length){const a=await git.add(sel.toAdd);if(!a.ok)return err('Could not stage the files: '+a.text,500)}
   const c=await git.commit(message,sel.gitPaths);if(!c.ok)return err('The commit was not made: '+c.text+(sel.toAdd.length?' (the files stay staged; nothing is lost)':''),500);
   const head=git.head();touch();
   if(head)writeLast({id:head.id,branch:git.branch(),at:now(),files:sel.paths.length});
   return {commit:{id:head?head.id:null,files:sel.paths.length}}
  }finally{working=false}}

 async function undo(){
  if(working)return err('A commit or push is already in progress.');
  if(busy())return err(busyText,423);
  const rec=readLast();if(!rec)return err('Nothing to undo: the hub has not made a commit that can be undone.');
  working=true;
  try{
   const head=git.head();
   if(!head||head.id!==rec.id)return err('That commit is no longer the newest one, so it cannot be undone from here.');
   if(git.onRemote())return err('That commit is already on GitHub, so it cannot be undone from here.');
   const r=await git.undo();if(!r.ok)return err('The undo did not work: '+r.text,500);
   dropLast();touch();return {undone:{id:rec.id}}
  }finally{working=false}}

 // what a push would send: the commits origin/<branch> does not have, as far as this PC knows (the hub never fetches)
 function pushStatus(){
  if(!git.available)return {enabled:true,canPush:false,count:0,commits:[],why:'GitHub Desktop\'s git was not found on this PC.'};
  const b=git.branch();
  if(!b||b==='HEAD'||!safeBranch(b))return {enabled:true,branch:b,canPush:false,count:0,commits:[],why:'No branch is checked out here. Use GitHub Desktop.'};
  const a=git.ahead(b),head=git.head();
  if(a.error)return {enabled:true,branch:b,head:head&&head.id,canPush:false,count:0,commits:[],why:`This PC does not know a branch called origin/${b} yet. Publish the branch from GitHub Desktop first.`};
  const n=a.commits.length;
  return {enabled:true,branch:b,head:head&&head.id,count:n,commits:a.commits.slice(0,20),more:Math.max(0,n-20),canPush:n>0&&!busy(),busy:!!busy(),why:n?(busy()?busyText:''):'Everything on this PC is already on GitHub (as far as this PC knows).'}}

 async function push({head}){
  if(working)return err('A commit or push is already in progress.');
  if(busy())return err(busyText,423);
  if(typeof head!=='string'||!SHORT.test(head))return err('head must be a commit id',400);
  working=true;
  try{
   const st=pushStatus();
   if(!st.head||st.head!==head)return err('The newest commit changed since you opened this page. Look at the list again, then press Push.',409,{push:st});
   if(!st.canPush)return err(st.why||'There is nothing to push.',409,{push:st});
   const r=await git.push(st.branch);touch();
   if(!r.ok)return err(r.text,r.kind==='behind'?409:502,{kind:r.kind});
   dropLast(); // after a push the commits are on GitHub: undo is gone
   return {pushed:{count:st.count,branch:st.branch}}
  }finally{working=false}}

 return {proposal,summary,commit,undo,pushStatus,push,lastState,touch,paths:proposalPaths}}
