// Mikkadr Hub P5, R7b step 1: "what is the hub doing right now", as one small answer for the corner bot on every page.
// Pure: the chat view, the chat's feed, the run list and the active run's feed in; {mood, line, source, runId, model, tokens, cap, items} out. No file, no process, no model call.
// Moods: working (the master or a run is busy), question (something waits for you: an answer, a second yes), stopped (a run ended short and can be resumed or closed), idle.
// Everything here is names and counts: the line and the items come from feed events (the runner strips them to names and counts) and from status names, never from the model's own words.
import {feedRow,modelName,fmt,STATUS_LABEL} from './web/run-actions.js';

export const MOODS=['idle','working','question','stopped'];
export const MAX_ITEMS=6;
const STOPPED=['capped','paused','interrupted','guard-stopped','failed','stopped'];
const STOP_LINE={capped:'A run hit its cap.',paused:'A run is paused: the 5-hour limit was reached.',interrupted:'A run was interrupted.','guard-stopped':'A run was stopped by the weekly guard.',failed:'A run ended without a result.',stopped:'A run was stopped.'};

// The last thing the feed shows being done, as a short phrase ("reading game.js"), or the fallback.
const VERB={Read:'reading',Edit:'editing',Write:'writing',Grep:'searching',Glob:'looking for files',Shell:'running'};
export function doing(events,fallback='thinking'){
 for(let i=events.length-1;i>=0;i--){const e=events[i];
  if(e.kind==='tool'){const v=VERB[e.tool];if(!v)return 'using '+String(e.tool||'a tool').slice(0,30);return e.target&&e.tool!=='Grep'&&e.tool!=='Glob'?`${v} ${e.target}`:v}
  if(e.kind==='started'||e.kind==='turn')break}
 return fallback}
const items=events=>events.filter(e=>e.kind!=='tokens').slice(-MAX_ITEMS).map(e=>{const r=feedRow(e);return {t:r.t,k:r.k,text:r.text,n:r.n,cls:r.cls}});
const lastTokens=events=>{for(let i=events.length-1;i>=0;i--)if(events[i].kind==='tokens'&&Number.isFinite(events[i].total))return events[i].total;return 0};

// chat: chat.view() or null. chatFeed: chat.feed(0) or null. runs: runs.list().runs or []. runFeed: the events of the run that holds the slot (or of the newest stopped one), or [].
export function buildActivity({chat=null,chatFeed=null,runs=[],runFeed=[]}={}){
 const base={mood:'idle',line:'Nothing is running.',source:null,runId:null,model:null,tokens:0,cap:null,items:[]};
 const ce=chatFeed&&Array.isArray(chatFeed.events)?chatFeed.events:[];
 if(chat&&chat.working)return {...base,mood:'working',source:'chat',model:chat.model,tokens:lastTokens(ce),cap:chat.cap??null,line:`The master (${modelName(chat.model)}) is ${doing(ce)}.`,items:items(ce)};
 const run=runs.find(r=>r.status==='running');
 if(run)return {...base,mood:'working',source:'run',runId:run.id,model:run.model,tokens:run.tokens||0,cap:run.capTokens??null,line:`${modelName(run.model)} run is ${doing(runFeed,'working')}: ${fmt(run.tokens||0)} of ${fmt(run.capTokens)} tokens.`,items:items(runFeed)};
 const ask=runs.find(r=>r.status==='waiting-answer')||runs.find(r=>r.status==='confirming');
 if(ask)return {...base,mood:'question',source:'run',runId:ask.id,model:ask.model,tokens:ask.tokens||0,cap:ask.capTokens??null,line:ask.status==='confirming'?`${modelName(ask.model)} needs your second yes.`:'A run has a question for you.',items:items(runFeed)};
 if(chat&&chat.pending)return {...base,mood:'question',source:'chat',model:chat.pending.model,line:`Switching the master to ${modelName(chat.pending.model)} needs your second yes.`};
 const short=runs.find(r=>STOPPED.includes(r.status));
 if(short)return {...base,mood:'stopped',source:'run',runId:short.id,model:short.model,tokens:short.tokens||0,cap:short.capTokens??null,line:STOP_LINE[short.status]||STATUS_LABEL[short.status]||'A run stopped.',items:items(runFeed)};
 const done=runs.find(r=>r.status==='done');
 if(done)return {...base,source:'run',runId:done.id,model:done.model,tokens:done.tokens||0,line:'A run finished. Its result is waiting for you.',items:items(runFeed)};
 if(ce.length){const end=ce.findLast(e=>e.kind==='end'),ok=end&&(end.end==='result'||end.end==='question');
  return {...base,mood:ok?'idle':'stopped',source:'chat',model:chat?chat.model:null,tokens:end&&Number.isFinite(end.tokens)?end.tokens:0,line:ok?'Nothing is running. The master answered your last message.':'Your last message to the master got no answer.',items:items(ce)}}
 return base}

// For the server: picks the run whose feed matters (the same order as above) so only one feed file is read.
export function feedRunOf(runs=[]){
 const r=runs.find(x=>x.status==='running')||runs.find(x=>x.status==='waiting-answer')||runs.find(x=>x.status==='confirming')||runs.find(x=>STOPPED.includes(x.status))||runs.find(x=>x.status==='done');
 return r?r.id:null}
