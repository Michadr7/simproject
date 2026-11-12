// Mikkadr Hub v2, V2: the job runner.

// Starts the scripts of hub/jobs.js as `node <script> <fixed args>` (no shell, no npm, no model call) and keeps what they said.
// One one-shot job at a time, under the shared .hub/run.lock, refused while a run, a chat turn or another job works. Its record goes to .hub/jobs/<id>.json (temp file, then rename):
// start, end, exit code, a summary in plain words, and the last 200 lines of output. Services (the dev server, the relay) do not take the lock; they are tracked by pid, can be stopped,
// and are stopped with their whole process tree when the hub exits. Every method returns {job} or {error, code}. A caller names a job by its key only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {JOBS,JOB_ID,stepsOf,summarise,tableProblems} from './jobs.js';
import {acquireLock,releaseLock} from './run-store.mjs';
import {writeAtomic} from './plans-store.mjs';
import {killTree,isAlive} from './runner.js';
import {cleanEnv} from './probe.js';

export const TAIL_LINES=200,MAX_LINE=300,KEEP_RECORDS=60,MAX_OUTPUT=4*1024*1024,LOCK_OWNER='job';
export const newJobId=(ms=Date.now())=>{const d=new Date(ms),p=n=>String(n).padStart(2,'0');return `job-${d.getUTCFullYear()}${p(d.getUTCMonth()+1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}-${randomBytes(2).toString('hex')}`};
export const tailOf=text=>String(text||'').replace(/\r\n/g,'\n').split('\n').filter(l=>l.trim()).slice(-TAIL_LINES).map(l=>l.length>MAX_LINE?l.slice(0,MAX_LINE-1)+'…':l);
const err=(error,code=409)=>({error,code});
const parse=text=>{try{return JSON.parse(String(text).replace(/^﻿/,''))}catch{return null}};

// busy: () => true while a run or a chat turn works (the caller knows). node: the program that runs the scripts. nameOf: pid => image name, for the clean-up after a hub that died.
export function createJobs({root,table=JOBS,now=Date.now,busy=()=>false,spawnFn=spawn,kill=killTree,node=process.execPath,extraEnv={},lowPriority=true,nameOf=async()=>null}){
 const bad=tableProblems(table);if(bad.length)throw new Error('The job table is not safe: '+bad.join('; '));
 const dir=path.join(root,'.hub','jobs');
 let current=null;               // the one-shot job that is running: {rec, child, stopping, done}
 const services=new Map();       // key -> {rec, child, out, done}
 const file=id=>path.join(dir,id+'.json');
 const save=rec=>{fs.mkdirSync(dir,{recursive:true});writeAtomic(file(rec.id),JSON.stringify(rec,null,1)+'\n')};
 const records=()=>{let names=[];try{names=fs.readdirSync(dir)}catch{return []}
  return names.filter(n=>n.endsWith('.json')&&JOB_ID.test(n.slice(0,-5))).map(n=>parse((()=>{try{return fs.readFileSync(path.join(dir,n),'utf8')}catch{return ''}})())).filter(r=>r&&JOB_ID.test(String(r.id))&&typeof r.key==='string').sort((a,b)=>b.startedAt-a.startedAt)};
 const prune=()=>{for(const r of records().slice(KEEP_RECORDS)){try{fs.unlinkSync(file(r.id))}catch{}}};
 const view=r=>r&&{id:r.id,key:r.key,label:r.label,kind:r.kind,auto:!!r.auto,status:r.status,startedAt:r.startedAt,endedAt:r.endedAt,exitCode:r.exitCode,summary:r.summary,tail:r.tail||[]};
 // The script as a path inside the folder; anything that would leave it is refused (the table check already forbids it; this is the second lock).
 const scriptPath=s=>{const p=path.resolve(root,s),rel=path.relative(root,p);if(rel.startsWith('..')||path.isAbsolute(rel))throw new Error('the script is outside the folder');return p};
 const start1=step=>{const child=spawnFn(node,[scriptPath(step.script),...step.args],{cwd:root,env:{...cleanEnv(),...extraEnv},stdio:['ignore','pipe','pipe'],windowsHide:true});
  if(lowPriority&&child.pid){try{os.setPriority(child.pid,os.constants.priority.PRIORITY_BELOW_NORMAL)}catch{}}return child};

 function startJob(job,{auto=false}={}){
  if(current)return err(`Another job is running (${current.rec.label}). Wait for it to finish.`);
  if(busy())return err('A run or a chat turn is working. Wait for it, or stop it.');
  const lock=acquireLock(root,LOCK_OWNER);if(!lock.ok)return err(`Another job holds the lock (${lock.holder}). Wait for it to finish.`);
  if(job.ownLock)releaseLock(root,LOCK_OWNER); // the script takes the lock itself; the check above only made sure it is free
  const steps=stepsOf(table,job.key),rec={id:newJobId(now()),key:job.key,label:job.label,kind:'job',auto:!!auto,status:'running',startedAt:now(),endedAt:null,exitCode:null,summary:null,tail:[],pid:null,hubPid:process.pid};
  let out='',i=0,finish;const done=new Promise(r=>{finish=r});
  const me=current={rec,child:null,stopping:false,done};
  const add=d=>{if(out.length<MAX_OUTPUT)out+=d};
  const end=(code,step)=>{
   rec.endedAt=now();rec.exitCode=code;rec.pid=null;rec.status=me.stopping?'stopped':code===0?'done':'failed';
   rec.summary=summarise(job.key,out,code,{step:step.key,stopped:me.stopping});rec.tail=tailOf(out);
   if(!job.ownLock)releaseLock(root,LOCK_OWNER);
   current=null;try{save(rec);prune()}catch{}finish(view(rec))};
  const next=()=>{
   const step=steps[i];let child,over=false;
   const close=code=>{if(over)return;over=true;if(code===0&&!me.stopping&&++i<steps.length)return next();end(code,step)};
   try{child=start1(step)}catch(e){add('Could not start: '+String(e.message).slice(0,200)+'\n');return close(-1)}
   me.child=child;rec.pid=child.pid??null;
   child.stdout.on('data',add);child.stderr.on('data',add);
   child.on('error',e=>{add('Could not start: '+String(e.message).slice(0,200)+'\n');close(-1)});
   child.on('close',code=>close(code??-1))};
  next();
  try{if(current===me)save(rec)}catch{} // saved once the first process is up, so the record carries its pid (the clean-up after a hub that died needs it)
  return {job:view(rec)}}

 function startService(job){
  if(services.has(job.key))return err(`${job.label} is already running.`);
  const rec={id:newJobId(now()),key:job.key,label:job.label,kind:'service',auto:false,status:'running',startedAt:now(),endedAt:null,exitCode:null,summary:null,tail:[],pid:null,hubPid:process.pid};
  let child;try{child=start1({script:job.script,args:job.args})}catch(e){return err('Could not start: '+String(e.message).slice(0,200),500)}
  let finish;const done=new Promise(r=>{finish=r});
  const me={rec,child,out:'',stopping:false,done};services.set(job.key,me);rec.pid=child.pid??null;
  const add=d=>{me.out=(me.out+d).slice(-64*1024)};
  let over=false;const close=code=>{if(over)return;over=true;services.delete(job.key);
   rec.endedAt=now();rec.exitCode=code;rec.pid=null;rec.status=me.stopping?'stopped':'failed';rec.tail=tailOf(me.out);
   rec.summary=me.stopping?{ok:true,text:'Stopped'}:{ok:false,text:`It ended by itself (exit code ${code})`};
   try{save(rec);prune()}catch{}finish(view(rec))};
  child.stdout.on('data',add);child.stderr.on('data',add);
  child.on('error',e=>{add('Could not start: '+String(e.message).slice(0,200)+'\n');close(-1)});
  child.on('close',code=>close(code??-1));
  try{save(rec)}catch{}
  return {job:view(rec)}}

 const stopOne=async me=>{me.stopping=true;if(me.child&&me.child.pid)await kill(me.child.pid);return me.done};

 return {
  has:key=>typeof key==='string'&&Object.hasOwn(table,key),
  active:()=>current!==null,                       // a one-shot job is working: runs, chat turns and a restart wait for it
  // The table with what runs now and each job's last finished result. `running` is the one-shot job at work (or null).
  list(){const recs=records();
   return {enabled:true,busy:current!==null||!!busy(),running:current?view(current.rec):null,
    jobs:Object.values(table).map(j=>{const live=j.kind==='service'?services.get(j.key):current&&current.rec.key===j.key?current:null,last=recs.find(r=>r.key===j.key&&r.status!=='running');
     return {key:j.key,label:j.label,kind:j.kind,about:j.about||'',url:j.url||null,running:live?{id:live.rec.id,startedAt:live.rec.startedAt}:null,last:view(last)||null}})}},
  last:key=>view(records().find(r=>r.key===key&&r.status!=='running'))||null,
  start(key,opts={}){
   if(typeof key!=='string'||!Object.hasOwn(table,key))return err('The hub does not know that job.',400);
   const job=table[key];return job.kind==='service'?startService(job):startJob(job,opts)},
  // Stop a running job or service by the id the hub gave it. Resolves when its process tree is gone.
  async stop(id){
   if(typeof id!=='string'||!JOB_ID.test(id))return err('That is not a job id.',400);
   const me=current&&current.rec.id===id?current:[...services.values()].find(s=>s.rec.id===id);
   if(!me)return err('That job is not running.',404);
   return {job:await stopOne(me)}},
  // The promise of the job at work (tests wait on it); null when nothing runs.
  wait:()=>current?current.done:null,
  // At hub start: a record still marked running lost its hub. A service that is still alive under the same program name is stopped; the record is marked interrupted.
  async reapOrphans(){
   let n=0;
   for(const r of records()){if(r.status!=='running'||(current&&current.rec.id===r.id)||[...services.values()].some(s=>s.rec.id===r.id))continue;
    if(Number.isInteger(r.pid)&&isAlive(r.pid)&&(await nameOf(r.pid))===path.basename(node).toLowerCase())await kill(r.pid);
    r.status='interrupted';r.endedAt=now();r.pid=null;r.summary={ok:false,text:'The hub stopped while this was running'};try{save(r)}catch{}n++;
    if(r.kind==='job')releaseLock(root,LOCK_OWNER)}
   return n},
  // At hub exit and before a restart: nothing the hub started outlives it.
  async shutdown(){const all=[...(current?[current]:[]),...services.values()];await Promise.all(all.map(stopOne))}}}
