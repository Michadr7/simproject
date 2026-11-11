// Mikkadr Hub P5, R5: the master agent, a chat inside the hub. Each message you send is one headless Claude Code turn on a saved session (--session-id first, then --resume), READ-ONLY (Read, Grep, Glob; no edit, no shell).
// When the master's reply contains a "PLAN:" section, the hub files it as a plan revision from "master" on the Plans page. The master cannot start a run: only your Approve and Start can.
// Every message is a model call on the gauges: it is refused at the weekly guard, capped per message, and its token count is kept. Opus and Fable need a second yes to switch to.
// The chat is saved in .hub/chat.json and survives a hub restart. It shares the one-job lock (.hub/run.lock) with runs and `npm run assets`, so a chat turn and a run never overlap.
// This file never runs git, never commits and never pushes. It makes a model call only when a caller sends a message, and only through runTurn.
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import {sendPlan} from './plans-store.mjs';
import {titleOf,slugify,MAX_TEXT as MAX_PLAN} from './plans.js';
import {canStart,evaluate,loadReadings,appendReading,learnRate} from './watcher.js';
import {PLACEHOLDER_RATE} from './runplan.js';
import {buildArgs,runTurn,killTree,isAlive} from './runner.js';
import {acquireLock,releaseLock} from './run-store.mjs';
import {writeAtomic} from './plans-store.mjs';
import {processName} from './runs.js';
import {withStatus} from './status.js';

export const CHAT_MODELS=['haiku','sonnet','opus','fable'];
export const CHAT_CAP=200000; // tokens per message (a first message pays for the brief and the index it reads)
export const MAX_MESSAGE=8000,MAX_KEPT=200,MAX_REPLY=60000,CONFIRM_MS=120000,MAX_FEED=500;
export const MASTER_RULES=`You are the master planning agent of the Mikkadr Hub, talking with the project owner about the City Life repo. You are READ-ONLY: you have Read, Grep and Glob and nothing else; you cannot edit, run commands, or start a run, and you must not claim you did. Every message begins with a HUB STATUS block (project state, tokens, the active and recent runs, ready and waiting plans) followed by USER MESSAGE: that block is ground truth and is rebuilt each time, so use it first and do not re-read the brief unless the question needs detail. Be precise and brief: say where we are, what the next step is, and what you need from the owner; if you do not know, say so. Read PROJECT-BRIEF.md only when needed, Grep PROJECT-INDEX.md for what you need, and never read context.md whole. Talk the task through briefly. When you and the owner agree on a plan, end your reply with a line containing only PLAN: and then the plan in Markdown, starting with a "# Title" heading, and finishing with this block (the hub reads only these four keys):\n## Run\nmodel: haiku | sonnet | opus   (Haiku for tiny edits and number tweaks, Sonnet for building against tests, Opus for design, save formats, multiplayer and security)\nwhy: one line\nsize: S | M | L   (Haiku S only; Opus S or M; lean to M or L when unsure)\nneeds: npm test, release, check\nThe owner must approve the plan on the Plans page and press Start; you cannot. Do not use PLAN: for anything that is not a finished plan.`;

// extractPlan: the plan filed out of a reply, or null. The section starts at a line that is only "PLAN:" (any case, optional bold) and runs to the end of the reply.
export function extractPlan(reply){
 const lines=String(reply||'').replace(/\r\n/g,'\n').split('\n');
 const at=lines.findIndex(l=>/^\s*\**PLAN:\**\s*$/i.test(l));
 if(at<0)return null;
 const text=lines.slice(at+1).join('\n').trim();
 if(!text)return null;
 const title=titleOf(text,'Plan from the master');
 return {title,text:text.slice(0,MAX_PLAN),slug:slugify(title)}}

const err=(error,code=409,extra={})=>({error,code,...extra});
const blank=(now)=>({id:randomUUID().slice(0,8),sessionId:randomUUID(),started:false,model:'sonnet',working:false,pid:null,exeName:null,pending:null,tokens:0,messages:[],createdAt:now,updatedAt:now});

export function createChat({root,claude=null,now=Date.now,extraEnv={},runTurnFn=runTurn,kill=killTree,nameOf=processName,contextFn=()=>''}){
 const file=path.join(root,'.hub','chat.json'),usageFile=path.join(root,'.hub','usage.jsonl'),plansDir=path.join(root,'plans');
 let active=null; // {handle}
 // R7b: the live feed of the current (or last) turn, names and counts only (the runner makes sure). Kept in memory: a new message starts it over, a hub restart forgets it.
 let feed={turn:0,events:[]};
 const feedAdd=ev=>{if(feed.events.length<MAX_FEED)feed.events.push({n:feed.events.length+1,...ev})};
 const safeContext=()=>{try{return String(contextFn()||'')}catch{return ''}}; // a failing status never blocks a message
 let st=null;
 const load=()=>{if(st)return st;try{const j=JSON.parse(fs.readFileSync(file,'utf8').replace(/^﻿/,''));if(j&&Array.isArray(j.messages)&&typeof j.sessionId==='string')return st={...blank(now()),...j}}catch{}return st=blank(now())};
 const save=()=>{st.updatedAt=now();st.messages=st.messages.slice(-MAX_KEPT);fs.mkdirSync(path.dirname(file),{recursive:true});writeAtomic(file,JSON.stringify(st,null,1)+'\n')};
 const gauges=()=>{const readings=loadReadings(usageFile);return {state:evaluate(readings,{now:now()}),rate:learnRate(readings)?.rate??null}};
 const expire=()=>{if(st.pending&&now()>st.pending.until){st.pending=null;save()}};
 let nextId=()=>load().messages.reduce((m,x)=>Math.max(m,x.id),0)+1;
 const add=(role,text,extra={})=>{const m={id:nextId(),role,text:String(text).slice(0,MAX_REPLY),at:now(),...extra};st.messages.push(m);return m};

 const view=()=>{load();expire();return {enabled:!!claude?.path,id:st.id,model:st.model,working:st.working,tokens:st.tokens,pending:st.pending?{model:st.pending.model,until:st.pending.until}:null,cap:CHAT_CAP,messages:st.messages.map(m=>({...m}))}};

 function fileReply(text,msg){
  const p=extractPlan(text);if(!p)return;
  const r=sendPlan(plansDir,{source:`master/${st.id}/${p.slug}`,title:p.title,from:'master',text:p.text,now:now()});
  if(r.error){msg.planError=String(r.error).slice(0,200);return}
  msg.plan={id:r.plan.id,title:r.plan.title,revision:r.plan.revisions.length,action:r.action}}

 function finish(turn,out){
  active=null;st.working=false;st.pid=null;st.exeName=null;releaseLock(root,'chat');
  const tokens=out.tokens||0;feedAdd({at:now(),kind:'end',end:String(out.end||'crashed').slice(0,20),tokens});st.tokens+=tokens;if(out.session||out.end==='result'||out.end==='question')st.started=true;
  const rd=(out.readings||[]).at(-1);if(rd){try{appendReading(usageFile,{at:now(),source:'chat',...rd})}catch{}}
  const reply=out.result?.text||out.question||'';
  switch(out.end){
   case 'result':case 'question':{const m=add('master',reply||'(no text)',{tokens,model:turn.model});if(out.result?.isError)m.error=true;else fileReply(reply,m);break}
   case 'capped':add('note',`Stopped: this message reached its cap of ${CHAT_CAP.toLocaleString('en-US')} tokens. Ask for something smaller.`,{tokens});break;
   case 'gauge-stop':add('note','Stopped by the weekly guard (97%).',{tokens});break;
   case 'pause':add('note','The 5-hour limit is reached. Try again after it resets.',{tokens});break;
   case 'stopped':add('note','Stopped by you.',{tokens});break;
   case 'interrupted':add('note','The hub closed while the master was working.',{tokens});break;
   case 'violation':add('note','The master offered a tool outside its read-only list and was stopped.',{tokens});break;
   default:add('note',out.stderr?`The master ended without an answer (${String(out.stderr).slice(0,100)}).`:'The master ended without an answer.',{tokens})}
  save()}

 return {
  view,
  working:()=>{load();return st.working},
  enabled:()=>!!claude?.path,
  // The feed of the current or last turn after line `after`: {turn (the id of your message), working, events, last}. A reader that sees a new `turn` starts over from 0.
  feed(after=0){load();const from=Number.isInteger(after)&&after>0?after:0;return {turn:feed.turn,working:st.working,events:feed.events.slice(from).map(e=>({...e})),last:feed.events.length}},

  send({text,busy=false}){
   load();expire();
   if(!claude?.path)return err('claude.exe was not found. Is the Claude Code extension installed in VS Code?',503);
   if(typeof text!=='string'||!text.trim())return err('Write a message first.',400);
   if(text.length>MAX_MESSAGE)return err(`A message is at most ${MAX_MESSAGE} characters.`,400);
   if(st.working)return err('The master is still working on your last message.');
   if(busy)return err('A run is active. Wait for it, or stop it.');
   const {state,rate}=gauges(),est=Math.round(CHAT_CAP/1e6*(rate??PLACEHOLDER_RATE)*10)/10,g=canStart(state,{estimatePct:est,model:st.model}),reasons=[...g.reasons];
   if(!state.weekly.known&&g.ok)reasons.push('There is no current weekly reading. Take one first (npm run watcher -- --probe).');
   if(reasons.length)return err(reasons.join(' '),409,{reasons});
   const lock=acquireLock(root,'chat');if(!lock.ok)return err(`Another job holds the lock (${lock.holder}). Wait for it to finish.`);
   const um=add('user',text.trim());st.working=true;st.pending=null;st.exeName=path.basename(claude.path).toLowerCase();
   const turn={model:st.model},resume=st.started;
   feed={turn:um.id,events:[]};feedAdd({at:now(),kind:'turn',n:st.messages.filter(m=>m.role==='user').length,resumed:resume});
   let handle;
   try{handle=runTurnFn({claude,args:buildArgs({model:st.model,sessionId:st.sessionId,resume,capTokens:CHAT_CAP,readOnly:true,rules:MASTER_RULES}),prompt:withStatus(safeContext(),text.trim()),cwd:root,cap:CHAT_CAP,state,rate,extraEnv:{...extraEnv},now,maxText:MAX_REPLY,onEvent:feedAdd})}
   catch(e){st.working=false;st.exeName=null;releaseLock(root,'chat');add('note','The master could not start: '+String(e.message).slice(0,120));save();return err('The master could not start.',500)}
   active={handle};st.pid=handle.pid;save();
   handle.done.then(out=>finish(turn,out)).catch(()=>finish(turn,{end:'crashed',tokens:0}));
   return {chat:view()}},

  async stop(){if(!active)return err('The master is not working.');await active.handle.stop('stopped');await active.handle.done;return {chat:view()}},

  newChat(){
   load();if(st.working)return err('Stop the master first.');
   const keep=st.model;st=blank(now());st.model=keep;feed={turn:0,events:[]};save();return {chat:view()}},

  // Haiku and Sonnet switch at once. Opus and Fable need a second yes within 2 minutes: the first call returns needsConfirm, the second (confirm:true, same model) switches.
  setModel({model,confirm=false}){
   load();expire();
   if(!CHAT_MODELS.includes(model))return err('That model is not one the master can use.',400);
   if(st.working)return err('Wait for the master to finish first.');
   if(model===st.model){st.pending=null;save();return {chat:view()}}
   if(model==='opus'||model==='fable'){
    if(!(confirm&&st.pending&&st.pending.model===model)){st.pending={model,until:now()+CONFIRM_MS};save();return {chat:view(),needsConfirm:true}}}
   st.model=model;st.pending=null;save();return {chat:view()}},

  // At hub start: a turn that was working when the hub died is over; kill its process tree if the pid is still the same program, and say so in the chat.
  async reapOrphan(){
   load();if(!st.working)return false;
   if(Number.isInteger(st.pid)&&isAlive(st.pid)&&st.exeName&&(await nameOf(st.pid))===st.exeName)await kill(st.pid);
   st.working=false;st.pid=null;st.exeName=null;releaseLock(root,'chat');add('note','The hub stopped while the master was working; that message got no answer.');save();return true},

  async shutdown(){if(active){await active.handle.stop('interrupted');await active.handle.done}}}}
