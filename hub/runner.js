// P5 R2: the run engine

// Mikkadr Hub P5, R2: the run engine. One call of runTurn = one headless Claude Code process = one turn (a first prompt, or an answer sent with --resume).
// Pure parts: buildArgs (every flag in one place), createReducer (stream lines in; names and counts out), createCapTracker. The only process code is runTurn and killTree.
// It makes no model call by itself: the caller passes the claude path (tests pass the fake CLI). Nothing here reads a route, a plan file or a page.
// Real-CLI facts checked with `claude --help` on 2026-11-11 (no model call): --session-id, --resume, --tools=, --allowedTools, --disallowedTools, --permission-mode dontAsk, --strict-mcp-config, --setting-sources, --append-system-prompt, --max-budget-usd exist; --max-turns does NOT exist in this version, so the CLI backstop is the budget only.
// Not yet checked against a real run (R6): the stream event shapes below, the Bash permission pattern syntax, prompt-on-stdin, and the USD backstop numbers.
import os from 'node:os';
import {spawn,execFile} from 'node:child_process';
import {parseRunOutput,evaluate,shouldStop,DEFAULTS} from './watcher.js';
import {cleanEnv} from './probe.js';
import {NEEDS,PLACEHOLDER_RATE} from './runplan.js';
import {usageOf} from './web/cache.js';

export const MODEL_IDS={haiku:'claude-haiku-5-5',sonnet:'claude-sonnet-5-5',opus:'claude-opus-5-5',fable:'claude-fable-5-2'};
export const READ_TOOLS=['Read','Grep','Glob'],RUN_TOOLS=[...READ_TOOLS,'Edit','Write'];
// No web, no subagents, no skills, no questions to a person, no notebooks. --tools already limits what exists; this list is a second lock.
export const DENIED_TOOLS=['WebFetch','WebSearch','Task','Agent','Skill','AskUserQuestion','NotebookEdit'];
// A run edits your real folder, so it may not touch the hub's own state (.hub holds run.json and the readings) or the plans (approvals live there). Path-rule syntax is checked in R6.
export const DENIED_PATHS=['Edit(.hub/**)','Write(.hub/**)','Edit(plans/**)','Write(plans/**)'];
export const SESSION_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Backstop only (the hub's own count is the real cap): USD per million capped tokens, a deliberately generous guess because cache reads cost money but are not in the cap. Calibrate in R6 from a real run.
export const USD_PER_MTOK={haiku:3,sonnet:12,opus:40,fable:40};
export const budgetUsd=(model,cap)=>Math.max(0.05,Math.round(cap/1e6*USD_PER_MTOK[model]*1.2*100)/100);
export const HOUSE_RULES='You are a build run started by the Mikkadr Hub from an approved plan. Do only what the plan says. Run npm test after each change. Never commit, push or use git. If you need an answer from the user, write one line starting with QUESTION: followed by the question, then end your turn. Stop when the plan is done and say what you changed.';
// The shell tool is named Bash on some installs and PowerShell on this Windows one (a run on 2026-11-11 had 5 tools and no shell when only Bash was asked for). Both are offered with the same exact-command patterns; the CLI ignores a name it does not have.
export const SHELL_TOOLS=['Bash','PowerShell'];
export const shellPatterns=needs=>needs.flatMap(k=>{if(!NEEDS[k])throw new Error(`unknown need ${k}`);return SHELL_TOOLS.map(t=>k==='check'?`${t}(node --check:*)`:`${t}(${NEEDS[k]})`)});
export const bashPatterns=shellPatterns;

// buildArgs: the whole command line for one turn. The prompt is NOT here: it goes in on stdin (a plan can be longer than a command line may be).
// readOnly is the master chat's mode (R5): Read, Grep, Glob and nothing else.
export function buildArgs({model,sessionId,resume=false,capTokens,needs=[],readOnly=false,rules=HOUSE_RULES}){
 if(!MODEL_IDS[model])throw new Error(`unknown model ${model}`);
 if(!SESSION_ID.test(String(sessionId)))throw new Error('the session id must be a UUID');
 if(!Number.isInteger(capTokens)||capTokens<1)throw new Error('the cap must be a whole number of tokens');
 const shell=readOnly?[]:shellPatterns(needs),tools=readOnly?READ_TOOLS:[...RUN_TOOLS,...(shell.length?SHELL_TOOLS:[])],allowed=[...tools.filter(t=>!SHELL_TOOLS.includes(t)),...shell];
 const shellRule=shell.length?` Your shell tool (${SHELL_TOOLS.join(' or ')}, whichever you have) accepts ONLY these exact commands: ${needs.map(k=>k==='check'?'node --check <file>':NEEDS[k]).join(' | ')}. Any other command, including npm run plan, is refused on purpose: the hub already checked the plan's approval. A refused command does not mean the allowed ones fail: try them.`:'';
 return ['-p','--output-format','stream-json','--verbose','--model',MODEL_IDS[model],
  ...(resume?['--resume',sessionId]:['--session-id',sessionId]),
  `--tools=${tools.join(',')}`,`--allowedTools=${allowed.join(',')}`,`--disallowedTools=${[...DENIED_TOOLS,...DENIED_PATHS].join(',')}`,
  '--permission-mode','dontAsk','--strict-mcp-config','--setting-sources','project',
  '--max-budget-usd',String(budgetUsd(model,capTokens)),'--append-system-prompt',rules+shellRule]}
export const toolsOf=args=>{const a=args.find(x=>x.startsWith('--tools='));return a?a.slice(8).split(',').filter(Boolean):[]};

export const firstPrompt=({id,title,revision,text})=>`Build from approved plan ${id} ("${String(title).slice(0,120)}"), revision ${revision}. The plan follows.\n\n${String(text).replace(/\r\n/g,'\n')}`;

// ── Reading the stream. Feed events carry names and counts only. The user's rule is "never raw model fields"; the exceptions he allowed are a run's question and result text (capped, for reading).
const MAX_TEXT=8192;
const safeName=s=>String(s??'').split(/[\\/]/).pop().replace(/[^\w.\- ]/g,'').slice(0,60);
// relPath: a changed file as a repo-relative path (for the "look before you commit" flags), each segment cleaned. A path outside the folder keeps its last segments.
export function relPath(p,cwd){
 let s=String(p??'').replace(/\\/g,'/');
 if(cwd){const c=String(cwd).replace(/\\/g,'/').replace(/\/+$/,'');if(s.toLowerCase().startsWith(c.toLowerCase()+'/'))s=s.slice(c.length+1)}
 return s.split('/').filter(x=>x&&x!=='.'&&x!=='..').map(x=>x.replace(/[^\w.\- ]/g,'').slice(0,60)).filter(Boolean).slice(-8).join('/')}
// The context window of the model, when the run's summary carries one (modelUsage.<model>.contextWindow); otherwise null. Never guessed.
export const windowOf=e=>{const m=e&&e.modelUsage&&typeof e.modelUsage==='object'?Object.values(e.modelUsage):[];const w=m.map(x=>x&&x.contextWindow).find(Number.isFinite);return w>0?w:null};
const billable=u=>(u.input_tokens||0)+(u.output_tokens||0)+(u.cache_creation_input_tokens||0); // as the watcher counts: cache reads are not in it
export function createCapTracker({cap,warnAt=0.8}){
 let total=0,warned=false;const seen=new Set();
 return {get total(){return total},get pct(){return Math.round(total/cap*1000)/10},
  // add: one assistant message's usage. A message split into blocks repeats its id and usage; count it once.
  add(id,usage){if(id!=null){if(seen.has(id))return {counted:false,total,capped:total>=cap,warn:false};seen.add(id)}
   total+=billable(usage||{});const warn=!warned&&total>=cap*warnAt&&total<cap;if(total>=cap*warnAt)warned=true;
   return {counted:true,total,capped:total>=cap,warn}}}}

export function createReducer({tools=[],cwd=null,maxText=MAX_TEXT}={}){
 const allowed=new Set(tools);let session=null,question=null,result=null,violation=null,window=null;const files=new Set(),paths=new Set(),readings=[];
 function toolEvent(b){
  const n=String(b.name||'?').slice(0,30),i=b.input||{};
  if(n==='Read')return {kind:'tool',tool:n,target:safeName(i.file_path)};
  if(n==='Edit'||n==='Write'){const f=safeName(i.file_path);if(f)files.add(f);const rp=relPath(i.file_path,cwd);if(rp&&paths.size<300)paths.add(rp);return {kind:'tool',tool:n,target:f}}
  if(n==='Grep'||n==='Glob')return {kind:'tool',tool:n,target:'1 pattern'};
  if(n==='Bash'||n==='PowerShell'){const c=String(i.command||'').trim(),hit=Object.values(NEEDS).find(s=>c===s||c.startsWith(s+' '));return {kind:'tool',tool:'Shell',target:hit||'command'}}
  return {kind:'tool',tool:n,target:''}}
 return {
  // take: one stdout line. Returns the feed events it produced, and the usage to count (if any).
  take(line){
   const out=[];let e;try{e=JSON.parse(line)}catch{return {events:out,usage:null}}
   if(e.type==='system'&&e.subtype==='init'){session=e.session_id||session;
    if(Array.isArray(e.tools)&&allowed.size){const extra=e.tools.filter(t=>!allowed.has(t));if(extra.length&&!violation){violation=`the run offers ${extra.length} tool${extra.length>1?'s':''} outside the list`;out.push({kind:'violation',count:extra.length})}}
    out.push({kind:'started',model:String(e.model||'').slice(0,40),tools:Array.isArray(e.tools)?e.tools.length:null})}
   else if(e.type==='rate_limit_event'){const r=parseRunOutput(line).readings;if(r.length){readings.push(r[r.length-1]);out.push({kind:'gauges',weekly:r[r.length-1].weekly?.pct??null,fiveHour:r[r.length-1].fiveHour?.pct??null})}}
   else if(e.type==='assistant'&&e.message){const blocks=Array.isArray(e.message.content)?e.message.content:[];
    for(const b of blocks){if(b.type==='tool_use')out.push(toolEvent(b));
     else if(b.type==='text'&&typeof b.text==='string'){const m=/^QUESTION:[ \t]*([\s\S]*)$/m.exec(b.text);if(m){question=m[0].slice(0,maxText);out.push({kind:'question'})}}}
    return {events:out,usage:e.message.usage?{id:e.message.id??null,usage:e.message.usage}:null}}
   else if(e.type==='result'){const p=parseRunOutput(line).result;window=windowOf(e);result={isError:!!e.is_error,costUsd:e.total_cost_usd??null,text:typeof e.result==='string'?e.result.slice(0,maxText):''};out.push({kind:'result',isError:result.isError,turns:p?.turns??null})}
   return {events:out,usage:null}},
  get session(){return session},get question(){return question},get result(){return result},get window(){return window},get violation(){return violation},
  get files(){return [...files]},get paths(){return [...paths]},get readings(){return readings}}}

// ── Killing a whole process tree. child.kill() on Windows leaves npm and node children running, so use taskkill /T /F; async, because a sync call would freeze the hub's event loop.
export const isAlive=pid=>{try{process.kill(pid,0);return true}catch(e){return e.code==='EPERM'}};
export function killTree(pid,{platform=process.platform,run=execFile,wait=sleep}={}){
 return new Promise(resolve=>{
  const check=async()=>{for(let i=0;i<20;i++){if(!isAlive(pid))return resolve({gone:true});await wait(100)}resolve({gone:!isAlive(pid)})};
  if(platform==='win32')run('taskkill',['/PID',String(pid),'/T','/F'],{windowsHide:true},()=>check());
  else{try{process.kill(pid,'SIGKILL')}catch{}check()}})}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// ── One turn.
// claude: {path, prefix?} (tests pass node and the fake script as the prefix). prompt goes in on stdin. state: the gauges from `evaluate`. rate: percent of weekly per million tokens, or null for the placeholder.
// Returns {pid, stop(), done}; done resolves with {end, exitCode, tokens, capPct, question, result, session, files, readings, violation}.
// end: result | question | capped | gauge-stop | pause | stopped | violation | crashed.
export function runTurn({claude,args,prompt,cwd,cap,state,rate=null,extraEnv={},maxText=MAX_TEXT,spawnFn=spawn,kill=killTree,onEvent=()=>{},now=Date.now,lowPriority=true,closeGraceMs=3000}){
 if(!claude?.path)throw new Error('runTurn needs the claude path from its caller.');
 const child=spawnFn(claude.path,[...(claude.prefix||[]),...args],{cwd,env:{...cleanEnv(),...extraEnv},stdio:['pipe','pipe','pipe'],windowsHide:true});
 if(lowPriority&&child.pid){try{os.setPriority(child.pid,os.constants.priority.PRIORITY_BELOW_NORMAL)}catch{}}
 const reducer=createReducer({tools:toolsOf(args),cwd,maxText}),tracker=createCapTracker({cap});
 let firstU=null,lastU=null,gaugeState=state,baseTokens=0,killReason=null,killing=null,buf='',err='';
 const stop=(reason='stopped')=>{if(!killing){killReason=reason;killing=kill(child.pid)}return killing};
 const emit=ev=>{onEvent({at:now(),...ev})};
 const handle=line=>{
  const {events,usage}=reducer.take(line);for(const ev of events)emit(ev);
  const rd=reducer.readings;if(events.some(x=>x.kind==='gauges')&&rd.length){gaugeState=evaluate([{at:now(),...rd[rd.length-1]}],{now:now(),config:state?.config||DEFAULTS});baseTokens=tracker.total}
  if(usage){const r=tracker.add(usage.id,usage.usage);if(r.counted){const uu={...usageOf(usage.usage),at:now()};firstU=firstU||uu;lastU=uu;emit({kind:'tokens',total:r.total,capPct:tracker.pct,last:usageOf(usage.usage)});
   if(r.warn)emit({kind:'cap-warning',capPct:tracker.pct});
   if(r.capped){emit({kind:'cap-stop',capPct:tracker.pct});stop('capped')}
   else if(gaugeState){const g=shouldStop(gaugeState,{tokensSince:r.total-baseTokens,rate:rate??PLACEHOLDER_RATE});if(g.stop){emit({kind:'gauge-stop',stopKind:g.kind});stop(g.kind==='pause'?'pause':'gauge-stop')}}}}
  if(reducer.violation)stop('violation')};
 child.stdout.on('data',d=>{buf+=d;let i;while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i).replace(/\r$/,'');buf=buf.slice(i+1);if(line.trim())handle(line)}});
 child.stderr.on('data',d=>{err=(err+d).slice(-500)});
 child.stdin.on('error',()=>{});try{child.stdin.end(String(prompt??''))}catch{}
 const done=new Promise(resolve=>{
  let finished=false;
  const finish=code=>{if(finished)return;finished=true;clearTimeout(grace);if(buf.trim()){try{handle(buf.replace(/\r$/,''))}catch{}}
   let end=killReason;
   if(!end)end=code!==0?'crashed':reducer.question?'question':reducer.result?'result':'crashed';
   resolve({end,exitCode:code,tokens:tracker.total,capPct:tracker.pct,question:reducer.question,result:reducer.result,window:reducer.window,first:firstU,last:lastU,session:reducer.session,files:reducer.files,paths:reducer.paths,readings:reducer.readings,violation:reducer.violation,stderr:err.replace(/\s+/g,' ').trim()})};
  let grace=null;
  child.on('error',e=>{err=String(e.message).slice(0,200);finish(-1)});
  child.on('close',code=>finish(code??-1));
  // if the tree is killed but a pipe stays open, do not wait forever
  child.on('exit',code=>{grace=setTimeout(()=>{try{child.stdout.destroy();child.stderr.destroy()}catch{}finish(code??-1)},closeGraceMs)});
 });
 return {pid:child.pid,stop,done}}
