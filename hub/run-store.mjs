// P5 R3: run storage

// Mikkadr Hub P5, R3: where runs are kept. .hub/runs/<id>/run.json (the record, written to a temp file then renamed) and feed.jsonl (one event per line), plus .hub/run.lock.
// Files only: no process, no model call. .hub is never committed.
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {writeAtomic} from './plans-store.mjs';

export const RUN_ID=/^run-[0-9]{8}-[0-9]{6}-[0-9a-f]{4}$/;
export const newRunId=(ms=Date.now())=>{const d=new Date(ms),p=n=>String(n).padStart(2,'0');return `run-${d.getUTCFullYear()}${p(d.getUTCMonth()+1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}-${randomBytes(2).toString('hex')}`};
const runsDir=root=>path.join(root,'.hub','runs'),dirOf=(root,id)=>path.join(runsDir(root),id);
const parse=text=>{try{return JSON.parse(String(text).replace(/^﻿/,''))}catch{return null}};

export function saveRun(root,run){
 if(!RUN_ID.test(run.id))throw new Error('bad run id');
 fs.mkdirSync(dirOf(root,run.id),{recursive:true});writeAtomic(path.join(dirOf(root,run.id),'run.json'),JSON.stringify(run,null,1)+'\n')}
export function readRun(root,id){
 if(!RUN_ID.test(String(id)))return null;
 try{const r=parse(fs.readFileSync(path.join(dirOf(root,id),'run.json'),'utf8'));return r&&r.id===id&&Array.isArray(r.turns)?r:null}catch{return null}}
export function listRuns(root){
 let names=[];try{names=fs.readdirSync(runsDir(root))}catch{return []}
 return names.filter(n=>RUN_ID.test(n)).map(n=>readRun(root,n)).filter(Boolean).sort((a,b)=>b.createdAt-a.createdAt)}

// The feed: names and counts only (the runner makes sure). n is the 1-based line number, so a reader asks for "after n".
export function appendFeed(root,id,ev){
 if(!RUN_ID.test(id))throw new Error('bad run id');
 fs.mkdirSync(dirOf(root,id),{recursive:true});fs.appendFileSync(path.join(dirOf(root,id),'feed.jsonl'),JSON.stringify(ev)+'\n')}
export function readFeed(root,id,after=0,limit=500){
 if(!RUN_ID.test(String(id)))return {events:[],last:0};
 let text='';try{text=fs.readFileSync(path.join(dirOf(root,id),'feed.jsonl'),'utf8')}catch{return {events:[],last:0}}
 const lines=text.split('\n').filter(Boolean),from=Math.max(0,Number.isInteger(after)?after:0),events=[];
 let i=from;for(;i<lines.length&&events.length<limit;i++){const e=parse(lines[i]);if(e)events.push({n:i+1,...e})}
 return {events,last:i}}

// The lock: one run (or one picture-drawing job of npm run assets) at a time. A lock whose process is gone is taken over.
export const lockFile=root=>path.join(root,'.hub','run.lock');
const alive=pid=>{try{process.kill(pid,0);return true}catch(e){return e.code==='EPERM'}};
export function readLock(root){try{return parse(fs.readFileSync(lockFile(root),'utf8'))}catch{return null}}
export function acquireLock(root,owner,{pid=process.pid,isAlive=alive}={}){
 const held=readLock(root);
 if(held&&held.owner!==owner&&Number.isInteger(held.pid)&&(held.pid===pid||isAlive(held.pid)))return {ok:false,holder:held.owner};
 fs.mkdirSync(path.dirname(lockFile(root)),{recursive:true});writeAtomic(lockFile(root),JSON.stringify({owner,pid,at:Date.now()}));return {ok:true}}
export function releaseLock(root,owner){const held=readLock(root);if(held&&held.owner===owner){try{fs.unlinkSync(lockFile(root))}catch{}}}
