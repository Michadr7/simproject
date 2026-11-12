// P5 R3: the run controller

// Mikkadr Hub P5, R3: the run controller. It owns what happens to a run: start (all gates), the Opus second yes, one process per turn, questions and answers, stop, resume, "continue with more", close, and the clean-up after a hub restart.
// It is the only place that starts a run; hub/server.js calls it and contains no process code. Every method returns {run, ...} or {error, code}.
// Runs never use git: the hub commits and pushes only on the owner's press, each with its own button (hub/commit-ctl.mjs), never from a run. It makes a model call only when a caller starts or resumes a run, and only through runTurn.
import path from 'node:path';
import {execFile} from 'node:child_process';
import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {readPlan,listPlans,savePlan} from './plans-store.mjs';
import {latestRevision,hashText,answerPlan} from './plans.js';
import {startCheck,parseRunBlock,quickFix,capTokens as capFor,PLACEHOLDER_RATE} from './runplan.js';
import {canStart,evaluate,loadReadings,appendReading,learnRate} from './watcher.js';
import {buildArgs,firstPrompt,runTurn,killTree,isAlive} from './runner.js';
import {newRunId,saveRun,readRun,listRuns,appendFeed,readFeed,acquireLock,releaseLock} from './run-store.mjs';

export const CONFIRM_MS=120000; // the Opus second yes must come within 2 minutes
export const EXTRA_MIN=100000,EXTRA_MAX=3000000,MAX_ANSWER=8000;
export const RESUMABLE=['interrupted','paused','stopped','guard-stopped','failed'];
export const CLOSABLE=['waiting-answer','capped','paused','interrupted','stopped','guard-stopped','failed','done','confirming'];
// Changed files a person should look at before committing, because they change what runs on this PC or what the hub trusts.
export const flaggedPaths=paths=>paths.filter(p=>/^(hub|tests|scripts|\.claude|\.hub|plans|\.github)\//i.test(p)||/^package(-lock)?\.json$/i.test(p));
const ACTIVE_STATES=['running','waiting-answer','confirming'];
const err=(error,code=409,extra={})=>({error,code,...extra});

// The name of the image behind a pid, so the restart clean-up never kills a stranger that reused the number.
export const processName=pid=>new Promise(res=>{
 if(process.platform!=='win32')return res(null);
 execFile('tasklist',['/FI',`PID eq ${pid}`,'/FO','CSV','/NH'],{windowsHide:true},(e,out)=>{const m=/^"([^"]+)"/.exec(String(out||'').trim());res(e||!m?null:m[1].toLowerCase())})});

export const QUICK_NOTE='Quick fix: approved and started with one press.';
// onEnd(run view): called after every turn's end is saved (Hub v2 V2: the hub rebuilds the index after a run finishes). It can never change the run.
export function createRuns({root,claude=null,now=Date.now,extraEnv={},runTurnFn=runTurn,kill=killTree,nameOf=processName,confirmMs=CONFIRM_MS,saveEveryMs=1000,busy=()=>false,onEnd=()=>{}}){
 const token=randomBytes(24).toString('hex'),usageFile=path.join(root,'.hub','usage.jsonl'),plansDir=path.join(root,'plans');
 let active=null; // {runId, handle}: a turn process is running
 const checkToken=t=>{if(typeof t!=='string'||t.length!==token.length)return false;try{return timingSafeEqual(Buffer.from(t),Buffer.from(token))}catch{return false}};

 const gauges=()=>{const readings=loadReadings(usageFile);return {state:evaluate(readings,{now:now()}),rate:learnRate(readings)?.rate??null}};
 const save=run=>{run.updatedAt=now();saveRun(root,run)};
 // A confirmation that was not given in time is dropped: a start goes to closed, an extension goes back to capped.
 function expire(run){if(run.status==='confirming'&&now()>run.confirmUntil){run.status=run.pending?.kind==='more'?'capped':'closed';run.reason='The second yes did not come within 2 minutes.';run.pending=null;run.confirmUntil=null;save(run)}return run}
 const load=id=>{const r=readRun(root,id);return r?expire(r):null};
 const all=()=>listRuns(root).map(expire);
 // holding: a run that keeps the one slot (a turn is running, it waits for your answer, or it waits for the second yes).
 const holding=exceptId=>all().find(r=>r.id!==exceptId&&(r.status==='running'||r.status==='waiting-answer'||r.status==='confirming'))||null;
 const view=r=>r&&{id:r.id,planId:r.planId,planTitle:r.planTitle,revision:r.revision,model:r.model,size:r.size,capTokens:r.capTokens,tokens:r.tokens,capPct:Math.round(r.tokens/r.capTokens*1000)/10,status:r.status,reason:r.reason,turn:r.turn,needs:r.needs,files:r.files,flagged:r.flagged,question:r.question,resultText:r.resultText,pending:r.pending,confirmUntil:r.confirmUntil,createdAt:r.createdAt,updatedAt:r.updatedAt};

 // An approval stamped while any run's process was working cannot be trusted: a run has write tools in this folder.
 const approvalVoided=at=>all().some(r=>r.turns.some(t=>at>=t.startedAt&&(t.endedAt==null||at<=t.endedAt)));

 // ready: approved plans a person could start now, for the Runs page and Waiting for you. Only plans with a valid Run block (Fable asked for in a plan is not shown), and only a revision no run has used yet
 // (a run that was cancelled before it started does not count). `canStart` and `reasons` come from the same startCheck that Start itself uses, with the second yes taken as given.
 function ready(rs){
  const out=[],{state,rate}=gauges(),taken=!!holding(null)||busy();
  for(const s of listPlans(plansDir)){
   if(s.status!=='approved')continue;
   const plan=readPlan(plansDir,s.id);if(!plan)continue;
   const last=latestRevision(plan),parsed=parseRunBlock(last.text);
   if(!parsed.ok||!parsed.run.model)continue;
   if(rs.some(r=>r.planId===plan.id&&r.revision===last.n&&(r.turn>0||ACTIVE_STATES.includes(r.status))))continue;
   const ans=[...plan.answers].reverse().find(a=>a.revision===last.n),chk=startCheck({plan,picked:parsed.run.model,secondYes:true,state,rate,activeRun:taken}),reasons=[...chk.reasons];
   if(ans&&approvalVoided(ans.at))reasons.push('That approval was stamped while a run was working, so it is void. Approve the plan again.');
   if(!claude?.path)reasons.push('claude.exe was not found.');
   out.push({planId:plan.id,title:plan.title,revision:last.n,model:parsed.run.model,size:parsed.run.size,capTokens:chk.capTokens,needs:chk.needs,why:parsed.run.why,secondYes:chk.needsSecondYes,canStart:!reasons.length,reasons,at:ans?ans.at:last.at})}
  return out.sort((a,b)=>a.at-b.at)}

 // gate: may another turn of this run go ahead? (not the first start: that is startCheck.)
 function gate(run,estimateTokens){
  const {state,rate}=gauges(),est=Math.round(estimateTokens/1e6*(rate??PLACEHOLDER_RATE)*10)/10,g=canStart(state,{estimatePct:est,model:run.model}),reasons=[...g.reasons];
  if(!state.weekly.known&&g.ok)reasons.push('There is no current weekly reading. Take one first (npm run watcher -- --probe).');
  return {ok:!reasons.length,reasons}}

 // launch: start one process for this run. prompt goes in on stdin.
 function launch(run,{resume,prompt}){
  if(!claude?.path){run.status='failed';run.reason='claude.exe was not found.';save(run);return err('claude.exe was not found. Is the Claude Code extension installed in VS Code?',503)}
  const lock=acquireLock(root,run.id);if(!lock.ok){run.status=run.turn?run.status:'closed';run.reason=`Another job holds the lock (${lock.holder}).`;save(run);return err(`Another job holds the lock (${lock.holder}). Wait for it to finish.`,409)}
  const remaining=Math.max(1,run.capTokens-run.tokens),base=run.tokens,{state,rate}=gauges();
  run.turn+=1;run.status='running';run.reason='';run.question=null;run.pending=null;run.confirmUntil=null;run.exeName=path.basename(claude.path).toLowerCase();run.hubPid=process.pid;
  const turn={n:run.turn,startedAt:now(),endedAt:null,end:null,tokens:0};run.turns.push(turn);
  let lastSave=0;
  let handle;
  try{
   appendFeed(root,run.id,{at:now(),kind:'turn',n:run.turn,resumed:!!resume});
  handle=runTurnFn({claude,args:buildArgs({model:run.model,sessionId:run.sessionId,resume,capTokens:remaining,needs:run.needs}),prompt,cwd:root,cap:remaining,state,rate,extraEnv:{...extraEnv},now,
    onEvent:ev=>{appendFeed(root,run.id,ev);if(ev.kind==='tokens'){run.tokens=base+ev.total;turn.tokens=ev.total;if(now()-lastSave>=saveEveryMs){lastSave=now();save(run)}}}})
  }catch(e){run.status='failed';run.reason='The run could not start.';turn.endedAt=now();turn.end='crashed';releaseLock(root,run.id);save(run);return err('The run could not start: '+String(e.message).slice(0,120),500)}
  active={runId:run.id,handle};run.pid=handle.pid;save(run);
  handle.done.then(out=>finish(run,turn,base,out)).catch(()=>finish(run,turn,base,{end:'crashed',tokens:0,files:[],paths:[],readings:[]}));
  return {run:view(run)}}

 function finish(run,turn,base,out){
  active=null;run.pid=null;run.tokens=base+(out.tokens||0);turn.tokens=out.tokens||0;turn.endedAt=now();turn.end=out.end;
  for(const f of out.files||[])if(!run.files.includes(f)&&run.files.length<300)run.files.push(f);
  for(const p of out.paths||[])if(!run.paths.includes(p)&&run.paths.length<300)run.paths.push(p);
  run.flagged=flaggedPaths(run.paths);
  const rd=(out.readings||[]).at(-1);if(rd){try{appendReading(usageFile,{at:now(),source:'run',...rd})}catch{}}
  switch(out.end){
   case 'result':if(out.result?.isError){run.status='failed';run.reason='The run reported an error.'}else{run.status='done';run.resultText=out.result?.text||''}break;
   case 'question':run.status='waiting-answer';run.question={id:run.turn,text:out.question||'',at:now()};break;
   case 'capped':run.status='capped';run.reason=`The run reached its cap (${run.capTokens.toLocaleString('en-US')} tokens).`;break;
   case 'gauge-stop':run.status='guard-stopped';run.reason='The weekly guard stopped the run (97%).';break;
   case 'pause':run.status='paused';run.reason='The 5-hour limit is reached. Resume after it resets.';break;
   case 'stopped':run.status='stopped';run.reason='Stopped by you.';break;
   case 'interrupted':run.status='interrupted';run.reason='The hub closed while the run was working.';break;
   case 'violation':run.status='failed';run.violation=true;run.reason='The run offered a tool outside its list and was stopped.';break;
   default:run.status='failed';run.reason=out.stderr?`The run ended without a result (${String(out.stderr).slice(0,100)}).`:'The run ended without a result.'}
  releaseLock(root,run.id);save(run);
  try{onEnd(view(run))}catch{}}

 const api={
  token,checkToken,
  locked:()=>active!==null,           // a process is working: plan approvals and starts are refused
  holding:()=>!!holding(null),
  enabled:()=>!!claude?.path,
  list(){const rs=all();return {enabled:!!claude?.path,locked:active!==null,holding:holding(null)?.id||null,runs:rs.map(view),ready:ready(rs)}},
  ready:()=>ready(all()),
  get:id=>view(load(id)),
  feed(id,after){return load(id)?readFeed(root,id,after):null},

  start({planId,revision,model}){
   if(!claude?.path)return err('claude.exe was not found. Is the Claude Code extension installed in VS Code?',503);
   const plan=readPlan(plansDir,planId);if(!plan)return err('No such plan.',404);
   const last=latestRevision(plan);
   if(revision!==last.n)return err(`The newest revision is ${last.n}; start from that one.`);
   if(hashText(last.text)!==last.hash)return err('The plan text does not match its stored hash. Send the plan again.');
   const ans=[...plan.answers].reverse().find(a=>a.revision===last.n);
   if(ans&&approvalVoided(ans.at))return err('That approval was stamped while a run was working, so it is void. Approve the plan again.');
   const {state,rate}=gauges(),chk=startCheck({plan,picked:model,secondYes:false,state,rate,activeRun:!!holding(null)||busy()});
   if(chk.code==='refused')return err(chk.reasons.join(' '),409,{reasons:chk.reasons});
   const parsed=parseRunBlock(last.text),t=now();
   const run={id:newRunId(t),planId:plan.id,planTitle:plan.title,revision:last.n,planHash:last.hash,model:chk.model,size:parsed.run.size,capTokens:chk.capTokens,needs:chk.needs,sessionId:randomUUID(),
    status:'confirming',reason:'',turn:0,turns:[],tokens:0,files:[],paths:[],flagged:[],question:null,resultText:'',pending:null,confirmUntil:null,pid:null,exeName:null,hubPid:process.pid,createdAt:t,updatedAt:t};
   if(chk.code==='second-yes'){run.pending={kind:'start'};run.confirmUntil=t+confirmMs;save(run);return {run:view(run),needsConfirm:true}}
   return launch(run,{resume:false,prompt:firstPrompt({id:plan.id,title:plan.title,revision:last.n,text:last.text})})},

  // Hub v2 V2, Quick fix: one press approves this exact revision and starts it. Only a Haiku S plan the master filed, still waiting (never a revision you denied).
  // Every check of the two separate presses is made BEFORE the approval is saved (the plan as it would be once approved goes through startCheck: gauges, weekly guard, nothing else working),
  // so a refused press leaves the plan exactly as it was. Then the ordinary start runs, with its own checks and the lock.
  quick({planId,revision}){
   if(!claude?.path)return err('claude.exe was not found. Is the Claude Code extension installed in VS Code?',503);
   const plan=readPlan(plansDir,planId);if(!plan)return err('No such plan.',404);
   const last=latestRevision(plan);
   if(revision!==last.n)return err(`The newest revision is ${last.n}; read that one first.`);
   if(plan.from!=='master')return err('One-press start is only for a plan the master filed in the chat. Approve it, then press Start.');
   if(plan.status==='denied'||plan.answers.some(a=>a.revision===last.n&&a.verdict==='denied'))return err('You denied this revision. One-press start is not offered for it.');
   if(plan.status!=='waiting')return err('This plan is already approved. Press Start.');
   if(!quickFix(plan))return err('One-press start is only for a Haiku plan of size S. Approve it, then press Start.');
   if(hashText(last.text)!==last.hash)return err('The plan text does not match its stored hash. Send the plan again.');
   if(active)return err('Plans are locked while a run works. Stop the run or wait for it.',423);
   const a=answerPlan(plan,{verdict:'approved',note:QUICK_NOTE,revision,now:now()});if(a.error)return err(a.error,a.code);
   const {state,rate}=gauges(),chk=startCheck({plan:a.plan,picked:'haiku',secondYes:false,state,rate,activeRun:!!holding(null)||busy()});
   if(chk.code!=='ok')return err(chk.reasons.join(' '),409,{reasons:chk.reasons});
   const lock=acquireLock(root,'quick');if(!lock.ok)return err(`Another job holds the lock (${lock.holder}). Wait for it to finish.`);releaseLock(root,'quick'); // the lock must be free before the approval is saved
   savePlan(plansDir,a.plan);
   return api.start({planId,revision,model:'haiku'})},

  confirm(id){
   const run=load(id);if(!run)return err('No such run.',404);
   if(run.status!=='confirming')return err(run.reason||'That run is not waiting for a second yes.');
   if(holding(run.id))return err('Another run holds the slot.');
   if(run.pending?.kind==='more'){
    const g=gate(run,run.pending.extra);if(!g.ok)return err(g.reasons.join(' '),409,{reasons:g.reasons});
    run.capTokens=run.tokens+run.pending.extra;return launch(run,{resume:true,prompt:'You reached your token cap and were given more. Continue and finish the plan.'})}
   const plan=readPlan(plansDir,run.planId);if(!plan)return err('No such plan.',404);
   const {state,rate}=gauges(),chk=startCheck({plan,picked:run.model,secondYes:true,state,rate,activeRun:false});
   if(chk.code!=='ok')return err(chk.reasons.join(' '),409,{reasons:chk.reasons});
   const last=latestRevision(plan);
   return launch(run,{resume:false,prompt:firstPrompt({id:plan.id,title:plan.title,revision:last.n,text:last.text})})},

  async stop(id){
   const run=load(id);if(!run)return err('No such run.',404);
   if(active&&active.runId===id){await active.handle.stop('stopped');await active.handle.done;return {run:view(readRun(root,id))}}
   if(run.status==='confirming'){const more=run.pending?.kind==='more';run.status=more?'capped':'closed';run.reason=more?'':'Cancelled before it started.';run.pending=null;run.confirmUntil=null;save(run);return {run:view(run)}}
   return err('That run is not running.')},

  answer(id,{question,text}){
   const run=load(id);if(!run)return err('No such run.',404);
   if(run.status!=='waiting-answer'||!run.question)return err('That run is not waiting for an answer.');
   if(run.question.id!==question)return err(`A newer question (${run.question.id}) is waiting; read it first.`);
   if(active)return err('A run is working.');
   if(run.capTokens-run.tokens<=0)return err('The run has no cap left. Close it or start a new plan.');
   const g=gate(run,run.capTokens-run.tokens);if(!g.ok)return err(g.reasons.join(' '),409,{reasons:g.reasons});
   return launch(run,{resume:true,prompt:text})},

  resume(id){
   const run=load(id);if(!run)return err('No such run.',404);
   if(!RESUMABLE.includes(run.status))return err('That run cannot be resumed from here.');
   if(run.violation)return err('That run ended on a tool violation and is not resumed.');
   if(holding(run.id)||active)return err('Another run holds the slot.');
   if(run.capTokens-run.tokens<=0)return err('The run has no cap left. Use Continue with more.');
   const g=gate(run,run.capTokens-run.tokens);if(!g.ok)return err(g.reasons.join(' '),409,{reasons:g.reasons});
   return launch(run,{resume:true,prompt:'Continue from where you stopped and finish the plan.'})},

  continueMore(id,{extra}){
   const run=load(id);if(!run)return err('No such run.',404);
   if(run.status!=='capped')return err('Only a run that hit its cap can be given more.');
   if(holding(run.id)||active)return err('Another run holds the slot.');
   const g=gate(run,extra);if(!g.ok)return err(g.reasons.join(' '),409,{reasons:g.reasons});
   if(run.model==='opus'||canStart(gauges().state,{estimatePct:0,model:run.model}).secondYes){ // opus always; fable from 60% weekly
    run.status='confirming';run.pending={kind:'more',extra};run.confirmUntil=now()+confirmMs;save(run);return {run:view(run),needsConfirm:true}}
   run.capTokens=run.tokens+extra; // the extra is on top of what the run really used (it may have ended a little over its cap)
   return launch(run,{resume:true,prompt:'You reached your token cap and were given more. Continue and finish the plan.'})},

  close(id){
   const run=load(id);if(!run)return err('No such run.',404);
   if(!CLOSABLE.includes(run.status))return err(run.status==='running'?'Stop the run first.':'That run is already closed.');
   run.status='closed';run.pending=null;run.confirmUntil=null;run.reason=run.reason||'Closed by you.';save(run);return {run:view(run)}},

  // At hub start: any run still marked running lost its hub. Kill its process tree if the pid is still the same program, then mark it interrupted. A run waiting for the second yes is closed.
  async reapOrphans(){
   let reaped=0;
   for(const r of listRuns(root)){
    if(r.status==='running'){
     if(Number.isInteger(r.pid)&&isAlive(r.pid)&&r.exeName&&(await nameOf(r.pid))===r.exeName)await kill(r.pid);
     const t=r.turns.at(-1);if(t&&t.endedAt==null){t.endedAt=now();t.end='interrupted'}
     r.status='interrupted';r.reason='The hub stopped while the run was working.';r.pid=null;save(r);reaped++;releaseLock(root,r.id)}
    else if(r.status==='confirming'){r.status=r.pending?.kind==='more'?'capped':'closed';r.pending=null;r.confirmUntil=null;save(r)}}
   return reaped},

  // At hub exit (Ctrl+C): stop the working process tree so it does not outlive the hub.
  async shutdown(){if(active){await active.handle.stop('interrupted');await active.handle.done}}};
 return api}
