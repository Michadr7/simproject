// Mikkadr Hub v2, V2: restarting the hub, and taking over from an older hub on the same port.

// No model call.
// `npm run hub` is a small supervisor: it starts the real hub as a child process and starts it again whenever the child exits with RESTART_CODE (the Restart button does that).
// On start the hub writes .hub/hub.json {pid, port, startedAt}. When the port is taken, the newcomer asks GET /api/hub-id on it; only when the answer names the pid in that file
// is it "an older hub", and only then may --replace stop it. A process that did not answer as this hub is never stopped.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {writeAtomic} from './plans-store.mjs';
import {killTree} from './runner.js';

export const RESTART_CODE=75,HUB_NAME='mikkadr-hub',FAST_MS=3000,MAX_FAST=5;

// supervise: run the hub until it ends for good. startChild(n) starts it (n = how many restarts so far) and returns the child process. Resolves with the last exit code.
// A hub that asks for a restart five times in a row within seconds is broken: stop instead of spinning.
export async function supervise({startChild,log=()=>{},now=Date.now,fastMs=FAST_MS,maxFast=MAX_FAST}){
 let n=0,fast=0;
 for(;;){
  const t=now(),code=await new Promise(res=>{let c;try{c=startChild(n)}catch{return res(1)}c.once('error',()=>res(1));c.once('exit',x=>res(x??1))});
  if(code!==RESTART_CODE)return code;
  fast=now()-t<fastMs?fast+1:0;
  if(fast>=maxFast){log(`The hub asked to restart ${maxFast} times in a row within seconds. Stopping.`);return 1}
  n++;log('Restarting the hub…')}}

export const hubFile=root=>path.join(root,'.hub','hub.json');
export function writeHubFile(root,{pid,port,startedAt}){fs.mkdirSync(path.dirname(hubFile(root)),{recursive:true});writeAtomic(hubFile(root),JSON.stringify({pid,port,startedAt})+'\n')}
export function readHubFile(root){try{const j=JSON.parse(fs.readFileSync(hubFile(root),'utf8').replace(/^﻿/,''));return j&&Number.isInteger(j.pid)&&Number.isInteger(j.port)?j:null}catch{return null}}

// One small GET to this PC only; resolves to the JSON, or null.
export const getLocalJson=(port,pathname,timeoutMs=2000)=>new Promise(res=>{
 const req=http.get({host:'127.0.0.1',port,path:pathname,timeout:timeoutMs},r=>{let s='';r.on('data',c=>{if(s.length<4096)s+=c});r.on('end',()=>{try{res(r.statusCode===200?JSON.parse(s):null)}catch{res(null)}})});
 req.on('timeout',()=>{req.destroy();res(null)});req.on('error',()=>res(null))});

// Is the thing on that port our own older hub? {hub:true, pid} only when .hub/hub.json names that port and the answer names the same pid.
export async function findOldHub({root,port,getJson=getLocalJson}){
 const f=readHubFile(root);if(!f||f.port!==port||f.pid===process.pid)return {hub:false};
 let a=null;try{a=await getJson(port,'/api/hub-id')}catch{}
 return a&&a.hub===HUB_NAME&&a.pid===f.pid?{hub:true,pid:f.pid}:{hub:false}}
// Stop the older hub (its whole process tree). Refuses, and stops nothing, unless findOldHub says it is one.
export async function replaceOldHub({root,port,getJson=getLocalJson,kill=killTree}){
 const old=await findOldHub({root,port,getJson});if(!old.hub)return {replaced:false,pid:null};
 const k=await kill(old.pid);return {replaced:!!(k&&k.gone),pid:old.pid}}
