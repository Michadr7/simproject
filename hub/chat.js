// P5 R5: the master chat

// Mikkadr Hub P5, R5: the master agent, a chat inside the hub. Each message you send is one headless Claude Code turn on a saved session (--session-id first, then --resume), READ-ONLY (Read, Grep, Glob; no edit, no shell).
// When the master's reply contains a "PLAN:" section, the hub files it as a plan revision from "master" on the Plans page. The master cannot start a run: only your Approve and Start can.
// Every message is a model call on the gauges: it is refused at the weekly guard, capped per message, and its token count is kept. Opus and Fable need a second yes to switch to.
// The chat is saved in .hub/chat.json and survives a hub restart. It shares the one-job lock (.hub/run.lock) with runs and `npm run assets`, so a chat turn and a run never overlap.
// Hub v2 V4: "RECORD:" lines in a reply change the asset register at once (hub/records-store.mjs), strictly parsed here, with an Undo on the page. They cost no press; anything else the master proposes still does.
// The master cannot commit or push: the hub commits and pushes only on the owner's press, each with its own button (hub/commit-ctl.mjs). This file starts no git process. It makes a model call only when a caller sends a message, and only through runTurn.
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import {sendPlan} from './plans-store.mjs';
import {titleOf,slugify,MAX_TEXT as MAX_PLAN} from './plans.js';
import {canStart,evaluate,loadReadings,appendReading,learnRate} from './watcher.js';
import {PLACEHOLDER_RATE,quickFix} from './runplan.js';
import {buildArgs,runTurn,killTree,isAlive} from './runner.js';
import {acquireLock,releaseLock} from './run-store.mjs';
import {writeAtomic} from './plans-store.mjs';
import {processName} from './runs.js';
import {withStatus} from './status.js';
import {parseActionLine,MAX_CHAT_ACTIONS} from './web/run-actions.js';
import {validateAdd,validateStage,validateFile,CONTROL,ADD_KEYS,MAX_PER_REPLY,MAX_LINE} from './records.js';

export const CHAT_MODELS=['haiku','sonnet','opus','fable'];
export const CHAT_CAP=200000; // tokens per message (a first message pays for the brief and the index it reads)
export const MAX_MESSAGE=8000,MAX_KEPT=200,MAX_REPLY=60000,CONFIRM_MS=120000,MAX_FEED=500;
export const MASTER_RULES=`You are the master planning agent of the Mikkadr Hub, talking with the project owner about the City Life repo. You are READ-ONLY: you have Read, Grep and Glob and nothing else; you cannot edit, run commands, or start a run, and you must not claim you did. Every message begins with a HUB STATUS block (project state, tokens, the active and recent runs, ready and waiting plans) followed by USER MESSAGE: that block is ground truth and is rebuilt each time, so use it first and do not re-read the brief unless the question needs detail. Be precise and brief: say where we are, what the next step is, and what you need from the owner; if you do not know, say so. Read PROJECT-BRIEF.md only when needed, Grep PROJECT-INDEX.md for what you need, and never read context.md whole. Talk the task through briefly. When you and the owner agree on a plan, end your reply with a line containing only PLAN: and then the plan in Markdown, starting with a "# Title" heading, and finishing with this block (the hub reads only these four keys):\n## Run\nmodel: haiku | sonnet | opus   (Haiku for tiny edits and number tweaks, Sonnet for building against tests, Opus for design, save formats, multiplayer and security)\nwhy: one line\nsize: S | M | L   (Haiku S only; Opus S or M; lean to M or L when unsure)\nneeds: npm test, release, check\nThe owner must approve the plan and press Start; you cannot. FABLE: never write fable in a Run block (the hub refuses it). The owner can still run any approved plan on Fable 5.2: on the Runs page, under "Ready to run", the plan's Start card has a model picker offering the plan's model or Fable 5.2; they pick Fable there and press Start (a Start button in this chat always uses the plan's model). If the owner asks for Fable, tell them exactly that; do not say it is impossible. Do not use PLAN: for anything that is not a finished plan. PROPOSING A CLICK: when the next step is something the owner can do with one click, add a line of its own (above any PLAN: section), copied exactly from the "Possible actions" line of the status block: ACTION: approve <plan id> <revision> | ACTION: start <plan id> <revision> | ACTION: resume <run id> | ACTION: close <run id>. At most 4, only ids from the status block, and say in one sentence why. The hub shows each as a button; nothing happens until the owner clicks, so never say it is done. A plan you file with PLAN: gets its Approve button from the hub: do not add one (a plan with model haiku and size S also gets an "Approve and start" button from the hub). TOOLS: the hub can run the project's own scripts without a model and without tokens. When the owner should run one, add its line, copied from the "Tool actions" line of the status block; these take no id: ACTION: test (run the tests) | ACTION: release (pack dist/ into the release the game loads) | ACTION: check (release, then tests) | ACTION: index (rebuild the brief and the index) | ACTION: dev-start | ACTION: dev-stop (the game dev server on localhost:8000) | ACTION: restart (restart the hub itself, needed after the hub's own files changed). The status block gives the last test result; use it instead of guessing. COMMITTING: the hub can commit and push, but only on the owner's press, each with its own button on the Commit page; you cannot do either and must never say you did. The status block has a "Changes since the last commit" line (counts only). When the owner wants to commit, add a line of its own, ACTION: commit (it only opens the Commit page; the owner presses Commit there), and, if they ask, ACTION: push (opens the same page, where Push is a separate button). You may also suggest a commit message: end your reply with a line containing only COMMIT: and then the message (a short first line, then optional detail, at most 2,000 characters). The hub puts it in the message box on the Commit page, where the owner can edit it. Use COMMIT: or PLAN:, never both in one reply. RECORDS: when the owner says they are adding assets or moving them between stages, you may update the asset register with lines of their own, above any PLAN: section, at most 6 per reply, each exactly in one of these two forms: RECORD: asset add name="Name" kind=model stage=wanted source="https://link" licence="CC0" note="text"  (name and kind are required; kind is model, sound, texture or picture; stage is wanted, received or staged; source is an http or https link or left out; put values in double quotes, with no quote marks or line breaks inside) | RECORD: asset stage <id> <stage>  (id copied from the "Asset rows" line of the status block; stage is wanted, received, staged or retired) | RECORD: asset file <id> "Folder/name.glb"  (attaches a file the status block lists under "New files in assets-src/", copied exactly and in double quotes, to the row it belongs to; a wanted row becomes received). The hub applies these at once, without a press, shows each as Recorded with an Undo button, and shows anything not exactly in this form as not understood. You cannot set converted or in game: the game's own modules decide those. RECORD is for the asset register only: anything that costs tokens, writes game files or starts a run stays an ACTION the owner presses. Never propose committing files under assets-src/, .claude/, .hub/, or .dev.vars, .env files or keys: the hub leaves them out anyway.`;

// extractPlan: the plan filed out of a reply, or null. The section starts at a line that is only "PLAN:" (any case, optional bold) and runs to the end of the reply.
export function extractPlan(reply){
 const lines=String(reply||'').replace(/\r\n/g,'\n').split('\n');
 const at=lines.findIndex(l=>/^\s*\**PLAN:\**\s*$/i.test(l));
 if(at<0)return null;
 const text=lines.slice(at+1).join('\n').trim();
 if(!text)return null;
 const title=titleOf(text,'Plan from the master');
 return {title,text:text.slice(0,MAX_PLAN),slug:slugify(title)}}

// extractCommit (Hub v2 V3): the commit message the master suggests, or null. It starts at a line that is only "COMMIT:" and runs to the end of the reply (or to a PLAN: line). At most 2,000 characters;
// the page shows it as plain text in an editable box, so nothing in it is ever run or read as markup.
export const MAX_COMMIT_MESSAGE=2000;
export function extractCommit(reply){
 const lines=String(reply||'').replace(/\r\n/g,'\n').split('\n'),at=lines.findIndex(l=>/^\s*\**COMMIT:\**\s*$/i.test(l));
 if(at<0)return null;
 const rest=lines.slice(at+1),stop=rest.findIndex(l=>/^\s*\**PLAN:\**\s*$/i.test(l)),text=(stop<0?rest:rest.slice(0,stop)).join('\n').replace(/\0/g,'').trim();
 return text?text.slice(0,MAX_COMMIT_MESSAGE):null}

// extractActions (R7c): the actions the master proposes, from "ACTION: ..." lines above any PLAN: section. At most MAX_CHAT_ACTIONS, no repeats. They are only proposals: the page draws buttons and your click does the rest.
export function extractActions(reply){
 const lines=String(reply||'').replace(/\r\n/g,'\n').split('\n'),end=lines.findIndex(l=>/^\s*\**PLAN:\**\s*$/i.test(l)),out=[],seen=new Set();
 for(const l of end<0?lines:lines.slice(0,end)){const a=parseActionLine(l);if(!a)continue;const k=JSON.stringify(a);if(seen.has(k))continue;seen.add(k);out.push(a);if(out.length>=MAX_CHAT_ACTIONS)break}
 return out}

// extractRecords (Hub v2 V4): the asset-register changes the master writes as "RECORD:" lines, parsed strictly. Only lines ABOVE any PLAN: or COMMIT: line count, at most MAX_PER_REPLY of them; a line that is
// not exactly one of the two forms below (or breaks a limit of the routes, which share their validators in hub/records.js) is ignored and listed as not understood. Nothing is applied here: the caller does that.
//   RECORD: asset add name="Name" kind=model [stage=wanted] [source="https://..."] [licence="..."] [note="..."]      RECORD: asset stage <id> <stage>      RECORD: asset file <id> "Folder/name.glb"
const RECORD_LINE=/^[ \t]*RECORD:[ \t]+(\S.*?)[ \t]*$/,PAIR=/([a-z]+)=(?:"([^"]*)"|([^\s"=]+))(?:[ ]+|$)/y;
const shownLine=l=>[...String(l)].filter(ch=>!CONTROL.test(ch)).join('').trim().slice(0,120);
export function parseRecordLine(line){
 const s=String(line);
 if(s.length>MAX_LINE)return {error:'the line is too long'};
 const m=RECORD_LINE.exec(s);if(!m)return {error:'nothing after RECORD:'};
 const body=m[1];if(CONTROL.test(body))return {error:'control characters in the line'};
 const head=/^asset +(add|stage|file)(?: +|$)/.exec(body);if(!head)return {error:'only "asset add", "asset stage" and "asset file" are understood'};
 const rest=body.slice(head[0].length);
 if(head[1]==='file'){ // asset file <id> "<path under assets-src>": the path must be quoted, with no quote mark inside
  const f=/^(\S+) +"([^"]*)"$/.exec(rest);if(!f)return {error:'asset file needs an id and a quoted path: asset file <id> "Folder/name.glb"'};
  const v=validateFile({id:f[1],file:f[2]});return v.error?{error:v.error}:{op:'asset-file',input:v.value,text:`Attach ${v.value.file} to ${v.value.id}`}}
 if(head[1]==='stage'){
  const t=rest.split(/ +/);if(t.length!==2||t[1]==='')return {error:'asset stage needs an id and a stage'};
  const v=validateStage({id:t[0],stage:t[1]});return v.error?{error:v.error}:{op:'asset-stage',input:v.value,text:`Move ${v.value.id} to ${v.value.stage}`}}
 const fields=Object.create(null);let i=0;
 while(i<rest.length){
  PAIR.lastIndex=i;const p=PAIR.exec(rest);if(!p)return {error:'could not read the fields; use key="value"'};
  if(!ADD_KEYS.includes(p[1])||p[1] in fields)return {error:`field ${p[1]} is not allowed or is repeated`};
  fields[p[1]]=p[2]!==undefined?p[2]:p[3];i=PAIR.lastIndex}
 if(fields.name===undefined||fields.kind===undefined)return {error:'asset add needs name and kind'};
 const v=validateAdd(fields);return v.error?{error:v.error}:{op:'asset-add',input:v.value,text:`Add ${v.value.name}`}}
export function extractRecords(reply){
 const lines=String(reply||'').replace(/\r\n/g,'\n').split('\n'),end=lines.findIndex(l=>/^\s*\**(PLAN|COMMIT):\**\s*$/i.test(l)),ops=[],notUnderstood=[];let seen=0;
 let fence=false; // review fix: a RECORD: line inside a ``` or ~~~ block is an example the master is showing, not a record
 for(const l of end<0?lines:lines.slice(0,end)){
  if(/^\s*(```|~~~)/.test(l)){fence=!fence;continue}
  if(fence||!/^[ \t]*RECORD:/.test(l))continue;
  if(++seen>MAX_PER_REPLY){notUnderstood.push(`${shownLine(l)} (more than ${MAX_PER_REPLY} in one reply)`);continue}
  const p=parseRecordLine(l);
  if(p.error)notUnderstood.push(`${shownLine(l)} (${p.error})`.slice(0,300));else ops.push(p)}
 return {ops,notUnderstood:notUnderstood.slice(0,MAX_PER_REPLY+2)}}

const err=(error,code=409,extra={})=>({error,code,...extra});
const blank=(now)=>({id:randomUUID().slice(0,8),sessionId:randomUUID(),started:false,model:'sonnet',working:false,pid:null,exeName:null,pending:null,tokens:0,messages:[],createdAt:now,updatedAt:now});

// records: the asset record store (hub/records-store.mjs) or null. RECORD: lines are applied at once through it, by 'master', and each applied change id is kept on the message so the page can offer Undo.
export function createChat({root,claude=null,now=Date.now,extraEnv={},runTurnFn=runTurn,kill=killTree,nameOf=processName,contextFn=()=>'',records=null}){
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

 // Hub v2 V4: apply the RECORD: lines. applied: [{id,text}] (shown as "Recorded: ..." with Undo); refused: ["Add X: why"]; notUnderstood: lines the parser did not accept. A throw never loses the reply.
 function fileRecords(text,msg){
  let rr;try{rr=extractRecords(text);if(!rr.ops.length&&!rr.notUnderstood.length)return;
   const out=records.applyMaster(rr.ops.map(o=>({op:o.op,input:o.input}))),applied=[],refused=[];
   out.forEach((x,k)=>{if(x.ok)applied.push({id:x.id,text:x.op==='asset-file'?`Recorded: ${x.label}`:`Recorded: ${x.name} → ${x.stage}`});else refused.push(`${rr.ops[k].text}: ${x.error}`.slice(0,300))});
   if(applied.length)msg.records=applied;if(refused.length)msg.recordErrors=refused;if(rr.notUnderstood.length)msg.notUnderstood=rr.notUnderstood}
  catch{msg.recordErrors=['The records could not be applied.']}}
 function fileReply(text,msg){
  const acts=extractActions(text);if(acts.length)msg.actions=acts;
  const cm=extractCommit(text);
  if(cm){msg.commitMessage=cm;if(!(msg.actions||[]).some(a=>a.op==='commit'))msg.actions=[...(msg.actions||[]),{op:'commit'}].slice(0,MAX_CHAT_ACTIONS)} // the hub adds the button that opens the page; it never commits
  if(records)fileRecords(text,msg);
  const p=extractPlan(text);if(!p)return;
  const r=sendPlan(plansDir,{source:`master/${st.id}/${p.slug}`,title:p.title,from:'master',text:p.text,now:now()});
  if(r.error){msg.planError=String(r.error).slice(0,200);return}
  msg.plan={id:r.plan.id,title:r.plan.title,revision:r.plan.revisions.length,action:r.action};
  // a plan the master just filed gets its Approve button from the hub (the master cannot know the id yet)
  const own={op:'approve',plan:r.plan.id,revision:r.plan.revisions.length};
  if(!(msg.actions||[]).some(a=>a.op==='approve'&&a.plan===own.plan))msg.actions=[own,...(msg.actions||[])].slice(0,MAX_CHAT_ACTIONS);
  // Hub v2 V2, Quick fix: a Haiku S plan also gets the one "Approve and start" button, right after its Approve (the hub adds it; the master cannot)
  if(quickFix(r.plan)){const at=msg.actions.findIndex(a=>a.op==='approve'&&a.plan===own.plan);msg.actions=[...msg.actions.slice(0,at+1),{op:'quick',plan:own.plan,revision:own.revision},...msg.actions.slice(at+1)].slice(0,MAX_CHAT_ACTIONS)}}

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
