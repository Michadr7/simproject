// P5 R7b: what the hub is doing

// Mikkadr Hub P5, R7b step 1: "what is the hub doing right now", as one small answer for the corner bot on every page.
// Pure: the chat view, the chat's feed, the run list and the active run's feed in; {mood, line, source, runId, model, tokens, cap, items} out. No file, no process, no model call.
// Moods: working (the master or a run is busy), question (something waits for you: an answer, a second yes), stopped (a run ended short and can be resumed or closed), idle.
// Everything here is names and counts: the line and the items come from feed events (the runner strips them to names and counts) and from status names, never from the model's own words.
import {feedRow,modelName,fmt,STATUS_LABEL} from './web/run-actions.js';
import {stateOf,MIN} from './web/cache.js';

export const MOODS=['idle','working','question','stopped'];
export const MAX_ITEMS=6;
const STOPPED=['capped','paused','interrupted','guard-stopped','failed','stopped'];
const STOP_LINE={capped:'A run stopped: it used its whole allowance.',paused:'A run is paused: the 5-hour limit was reached.',interrupted:'A run stopped: the hub closed.','guard-stopped':'A run stopped to protect your weekly limit.',failed:'A run ended without a result.',stopped:'A run was stopped by you.'};

// The last thing the feed shows being done, as a short phrase ("reading game.js"), or the fallback.
const VERB={Read:'reading',Edit:'editing',Write:'writing',Grep:'searching',Glob:'looking for files',Shell:'running'};
export function doing(events,fallback='thinking'){
 for(let i=events.length-1;i>=0;i--){const e=events[i];
  if(e.kind==='tool'){const v=VERB[e.tool];if(!v)return 'using '+String(e.tool||'a tool').slice(0,30);return e.target&&e.tool!=='Grep'&&e.tool!=='Glob'?`${v} ${e.target}`:v}
  if(e.kind==='started'||e.kind==='turn')break}
 return fallback}
const items=(events,cap)=>events.filter(e=>e.kind!=='tokens').slice(-MAX_ITEMS).map(e=>{const r=feedRow(e,{cap});return {t:r.t,k:r.k,text:r.text,n:r.n,cls:r.cls}});
const lastTokens=events=>{for(let i=events.length-1;i>=0;i--)if(events[i].kind==='tokens'&&Number.isFinite(events[i].total))return events[i].total;return 0};

// chat: chat.view() or null. chatFeed: chat.feed(0) or null. runs: runs.list().runs or []. runFeed: the events of the run that holds the slot (or of the newest stopped one), or [].
function core({chat=null,chatFeed=null,runs=[],runFeed=[],job=null}={}){
 const base={mood:'idle',line:'Nothing is running.',source:null,runId:null,model:null,tokens:0,cap:null,items:[]};
 const ce=chatFeed&&Array.isArray(chatFeed.events)?chatFeed.events:[];
 if(chat&&chat.working)return {...base,mood:'working',source:'chat',model:chat.model,tokens:lastTokens(ce),cap:chat.cap??null,line:`The master (${modelName(chat.model)}) is ${doing(ce)}.`,items:items(ce)};
 const run=runs.find(r=>r.status==='running');
 if(run)return {...base,mood:'working',source:'run',runId:run.id,model:run.model,tokens:run.tokens||0,cap:run.capTokens??null,line:`A ${modelName(run.model)} run is ${doing(runFeed,'working')}. Tokens used so far: ${fmt(run.tokens||0)} of ${fmt(run.capTokens)}.`,items:items(runFeed)};
 // a tool job (the tests, a release, the check before going online) is work the hub is doing, so the bot must not say nothing is running
 if(job)return {...base,mood:'working',source:'job',model:null,line:`${String(job.label||'A job').slice(0,60)} is running.`,items:[]};
 const ask=runs.find(r=>r.status==='waiting-answer')||runs.find(r=>r.status==='confirming');
 if(ask)return {...base,mood:'question',source:'run',runId:ask.id,model:ask.model,tokens:ask.tokens||0,cap:ask.capTokens??null,line:ask.status==='confirming'?`Press again to confirm ${modelName(ask.model)} (expensive model).`:'A run has a question for you.',items:items(runFeed)};
 if(chat&&chat.pending)return {...base,mood:'question',source:'chat',model:chat.pending.model,line:`Press again to confirm the switch to ${modelName(chat.pending.model)} (expensive model).`};
 const short=runs.find(r=>STOPPED.includes(r.status));
 if(short)return {...base,mood:'stopped',source:'run',runId:short.id,model:short.model,tokens:short.tokens||0,cap:short.capTokens??null,line:STOP_LINE[short.status]||STATUS_LABEL[short.status]||'A run stopped.',items:items(runFeed)};
 const done=runs.find(r=>r.status==='done');
 if(done)return {...base,source:'run',runId:done.id,model:done.model,tokens:done.tokens||0,line:'A run finished. Its result is waiting for you.',items:items(runFeed)};
 if(ce.length){const end=ce.findLast(e=>e.kind==='end'),ok=end&&(end.end==='result'||end.end==='question');
  // idle either way: an unanswered message waits on nothing (the chat page says why), so it must not hold the bot and the background red
  return {...base,source:'chat',model:chat?chat.model:null,tokens:end&&Number.isFinite(end.tokens)?end.tokens:0,line:ok?'Nothing is running. The master answered your last message.':'Your last message to the master got no answer.',items:items(ce)}}
 return base}

// ── Hub 2.6: the panda's scene and facts. Worked out from the same feed events: names and counts only, never the model's words.
// scene: idle | think | read | write | test | pass | fail | wait | stopped | done.   facts: what the panda shows (the bamboo, the cup, the signs); every field is null when the hub does not know it.
export const SCENES=['idle','think','read','write','test','pass','fail','wait','stopped','done'];
export const STOP_SIGN={capped:'Cap reached',paused:'5-hour limit',interrupted:'Interrupted','guard-stopped':'Weekly limit',failed:'No result',stopped:'Stopped by you'};
const quiet=e=>e.kind!=='tokens'&&e.kind!=='gauges';
// The scene of a working hub, from its events: a finished test call shows pass or fail until the next event; otherwise the last tool decides.
export function sceneOfEvents(events){
 const ev=(Array.isArray(events)?events:[]).filter(quiet);
 const last=ev[ev.length-1];if(last&&last.kind==='shell')return last.ok?'pass':'fail';
 for(let i=ev.length-1;i>=0;i--){const e=ev[i];
  if(e.kind==='tool'){if(e.tool==='Read'||e.tool==='Grep'||e.tool==='Glob')return 'read';if(e.tool==='Edit'||e.tool==='Write')return 'write';
   if(e.tool==='Shell')return e.target&&e.target!=='command'?'test':'write';return 'think'}
  if(e.kind==='started'||e.kind==='turn')break}
 return 'think'}
const lastTarget=(events,tools)=>{for(let i=(events||[]).length-1;i>=0;i--){const e=events[i];if(e.kind==='tool'&&tools.includes(e.tool)&&e.target&&e.target!=='1 pattern')return String(e.target).slice(0,60)}return null};
// The higher of the two gauges the hub shows at the top (or null).
export const gaugeOf=g=>{const v=[g&&g.weekly&&g.weekly.known?g.weekly.pct:null,g&&g.fiveHour&&g.fiveHour.known?g.fiveHour.pct:null].filter(Number.isFinite);return v.length?Math.max(...v):null};
// life: the learned cache lifetime (lifetime() in cache.js). The cup says "cold" only when it is sure.
export function buildActivity(input={}){
 const {runs=[],chat=null,runFeed=[],chatFeed=null,gauge=null,life=null,now=Date.now(),job=null}=input,a=core(input);
 const ev=a.source==='chat'?(chatFeed&&chatFeed.events)||[]:runFeed;
 let scene='idle';
 if(a.mood==='working')scene=a.source==='job'?(job&&(job.key==='test'||job.key==='check')?'test':'write'):sceneOfEvents(ev);
 else if(a.mood==='question')scene='wait';else if(a.mood==='stopped')scene='stopped';else if(/finished/.test(a.line)&&a.source==='run')scene='done';
 const stoppedRun=a.mood==='stopped'?runs.find(r=>r.id===a.runId):null,onShow=a.source==='run'?runs.find(r=>r.id===a.runId):null;
 const asks=runs.filter(r=>r.status==='waiting-answer'||r.status==='confirming').length+(chat&&chat.pending?1:0);
 // the last reply of what is on show: that run, or the chat, or the newest of the two
 const times=[onShow&&onShow.cache&&onShow.cache.at,a.source!=='run'&&chat&&chat.cache&&chat.cache.at].filter(Number.isFinite),at=times.length?Math.max(...times):null;
 const cs=at==null?null:stateOf({lastReplyAt:at,now,lifetime:life}),shell=[...ev].reverse().find(e=>e.kind==='shell');
 const facts={used:a.tokens||0,cap:a.cap??null,file:lastTarget(ev,['Read','Edit','Write']),cmd:a.source==='job'&&job?String(job.label||'').slice(0,40):lastTarget(ev,['Shell']),
  result:scene==='pass'?'passed':scene==='fail'?'failed':null,resultOf:shell?String(shell.target).slice(0,30):null,
  reason:stoppedRun&&Object.hasOwn(STOP_SIGN,stoppedRun.status)?stoppedRun.status:null,sign:stoppedRun&&Object.hasOwn(STOP_SIGN,stoppedRun.status)?STOP_SIGN[stoppedRun.status]:null,
  asks,cacheMin:cs&&cs.ageMs!=null?Math.floor(cs.ageMs/MIN):null,cache:cs?cs.state:null,gauge:Number.isFinite(gauge)?gauge:null};
 return {...a,scene,facts}}

// For the server: picks the run whose feed matters (the same order as above) so only one feed file is read.
export function feedRunOf(runs=[]){
 const r=runs.find(x=>x.status==='running')||runs.find(x=>x.status==='waiting-answer')||runs.find(x=>x.status==='confirming')||runs.find(x=>STOPPED.includes(x.status))||runs.find(x=>x.status==='done');
 return r?r.id:null}
