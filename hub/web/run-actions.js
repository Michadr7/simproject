// Mikkadr Hub P5, R4 (plain words: Hub v2 V1): the pure rules the Work page, the chat and the Waiting list share (no DOM, no fetch, so the server and the tests can import it too).
// What a run's status is called, which buttons it gets, which request a button sends, one feed line as names and counts, and the cap bar colour.
export const MODEL_NAME={haiku:'Haiku 5.5',sonnet:'Sonnet 5.5',opus:'Opus 5.5',fable:'Fable 5.2'};
export const STATUS_LABEL={running:'Working',confirming:'Press again to confirm (expensive model)','waiting-answer':'Has a question for you',capped:'Stopped: it used its whole allowance',paused:'Paused: the 5-hour limit was reached',interrupted:'Stopped: the hub closed','guard-stopped':'Stopped to protect your weekly limit',stopped:'Stopped by you',failed:'Ended without a result',done:'Finished (read the result)',closed:'Done'};
export const ACTIVE=['running','waiting-answer','confirming']; // the states that hold the one run slot
export const EXTRAS=[150000,300000,600000,1000000]; // "Continue with more" offers these; the server accepts 100,000 to 3,000,000
export const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('en-US'):'?';
export const modelName=m=>MODEL_NAME[m]||String(m||'?');
// The models the Start card offers for a plan: the plan's own model, or Fable (only ever the owner's own pick; the server refuses any other change).
export const startModels=planModel=>planModel==='fable'?['fable']:[planModel,'fable'];
// A typed draft that survives leaving the page: kept in this browser only, removed when sent. Storage may be missing or blocked, so every call is guarded.
export const draftStore=key=>({get(){try{return localStorage.getItem(key)||''}catch{return ''}},set(v){try{if(v)localStorage.setItem(key,v);else localStorage.removeItem(key)}catch{}}});

// The buttons a run gets by status. An action is {op, label, primary?, danger?, extras?}. 'answer' is the question form: only the Runs page draws it (the Waiting list links to the page).
export function actionsFor(run){
 const m=modelName(run.model);
 switch(run.status){
  case 'confirming':return [{op:'confirm',label:`Yes, ${run.pending&&run.pending.kind==='more'?'continue':'run'} on ${m}`,primary:true},{op:'stop',label:'Cancel'}];
  case 'running':return [{op:'stop',label:'Stop',danger:true}];
  case 'waiting-answer':return [{op:'answer',label:'Send answer',primary:true},{op:'close',label:'Close'}];
  case 'capped':return [{op:'continue',label:'Continue with more',primary:true,extras:EXTRAS},{op:'close',label:'Close'}];
  case 'paused':case 'interrupted':case 'guard-stopped':case 'failed':case 'stopped':return [{op:'resume',label:'Resume',primary:true},{op:'close',label:'Close'}];
  case 'done':return [{op:'close',label:'Close',primary:true}];
  default:return []}}

// The request one button sends: {url, body}, or null for an op the hub does not know. `a` carries what the op needs (id; plan, revision, model; extra; question, text).
export function callFor(op,a={}){
 if(op==='start')return {url:'/api/runs/start',body:{plan:a.plan,revision:a.revision,model:a.model}};
 if(op==='approve')return a.plan?{url:`/api/plans/${a.plan}/answer`,body:{verdict:'approved',note:'Approved from the chat.',revision:a.revision}}:null; // the plan answer route: 423 while a run works, 409 on a stale revision
 if(op==='chat-send')return {url:'/api/chat/send',body:{text:a.text}};
 if(op==='chat-model')return {url:'/api/chat/model',body:{model:a.model,confirm:a.confirm===true}};
 if(op==='chat-new'||op==='chat-stop')return {url:'/api/chat/'+op.slice(5),body:{}};
 // Hub v2 V2: the tools (a job is named by its key, a running one by the id the hub gave it), the restart, and the one-press start of a Haiku S plan
 if(op==='job-start')return a.job?{url:'/api/jobs/start',body:{job:a.job,...(typeof a.confirm==='string'?{confirm:a.confirm}:{}),...(typeof a.level==='string'?{level:a.level}:{})}}:null;
 if(op==='job-stop')return a.id?{url:'/api/jobs/stop',body:{id:a.id}}:null;
 if(op==='hub-restart')return {url:'/api/hub/restart',body:{}};
 if(op==='probe')return {url:'/api/probe',body:{}};
 if(op==='quick')return a.plan?{url:`/api/plans/${a.plan}/quick`,body:{revision:a.revision}}:null;
 // Hub v2 V3: the Commit page's own buttons (commit, undo, push are three separate presses)
 if(op==='commit-do')return Array.isArray(a.files)&&typeof a.message==='string'&&a.hash?{url:'/api/commit',body:{files:a.files,message:a.message,hash:a.hash}}:null;
 if(op==='commit-undo')return {url:'/api/commit/undo',body:{}};
 if(op==='push-do')return a.head?{url:'/api/push',body:{head:a.head}}:null;
 if(!a.id)return null;
 const base=`/api/runs/${a.id}/`;
 if(op==='continue')return {url:base+'continue',body:{extra:a.extra}};
 if(op==='answer')return {url:base+'answer',body:{question:a.question,text:a.text}};
 if(['stop','confirm','resume','close'].includes(op))return {url:base+op,body:{}};
 return null}

// ── R7c: actions the master proposes in a chat reply. The master only writes the line; the hub draws a button, and a click goes through the same routes and gates as the buttons in Work.
// A line alone in the reply: "ACTION: approve <plan id> <revision>", "ACTION: start <plan id> <revision>", "ACTION: resume <run id>", "ACTION: close <run id>". Anything else is ignored.
// Hub v2 V2: seven more, without arguments: "ACTION: test", "release", "check", "index", "dev-start", "dev-stop", "restart". Each is a script from the hub's own job table (no tokens); the click goes through the job routes.
export const TOOL_OPS=['test','release','check','index','dev-start','dev-stop','restart'];
// Hub v2 V3: two more, without arguments: "ACTION: commit" and "ACTION: push". They only OPEN the Commit page (where the owner presses Commit and, separately, Push); a click here never commits or pushes.
export const NAV_OPS=['commit','push'];
export const CHAT_OPS=['approve','start','resume','close',...TOOL_OPS,...NAV_OPS],MAX_CHAT_ACTIONS=4;
// 'quick' (approve and start a Haiku S plan with one press) is added by the hub to a plan the master just filed; the master cannot write it.
export const HUB_OPS=['quick'],QUICK_CAP=150000,QUICK_LABEL=`Approve and start (Haiku, up to ${QUICK_CAP.toLocaleString('en-US')} tokens)`;
const TOOL_JOB={test:'test',release:'release',check:'check',index:'index','dev-start':'dev','dev-stop':'dev'};
const TOOL_LABEL={test:'Run the tests',release:'Make a release',check:'Check (release, then tests)',index:'Rebuild the index','dev-start':'Start the game dev server','dev-stop':'Stop the game dev server',restart:'Restart the hub'};
const ACTION_LINE=/^\s*\**ACTION:\**\s*(approve|start|resume|close)\s+(\S+)(?:\s+(\d{1,6}))?\s*\**\s*$/i,PLAN_ID=/^[a-z0-9][a-z0-9-]{0,79}$/,RUN_ID_RE=/^run-[0-9]{8}-[0-9]{6}-[0-9a-f]{4}$/;
const TOOL_LINE=/^\s*\**ACTION:\**\s*`?(test|release|check|index|dev-start|dev-stop|restart|commit|push)`?\s*\**\s*$/i;
const isActionLine=l=>ACTION_LINE.test(l)||TOOL_LINE.test(l);
export function parseActionLine(line){
 const t=TOOL_LINE.exec(String(line||''));if(t)return {op:t[1].toLowerCase()};
 const m=ACTION_LINE.exec(String(line||''));if(!m)return null;
 const op=m[1].toLowerCase(),id=m[2].replace(/[`*]/g,''),n=m[3]?Number(m[3]):null;
 if(op==='approve'||op==='start')return PLAN_ID.test(id)&&!RUN_ID_RE.test(id)&&Number.isInteger(n)&&n>=1?{op,plan:id,revision:n}:null;
 return RUN_ID_RE.test(id)&&n===null?{op,run:id}:null}
// The reply as shown: the ACTION lines are drawn as buttons, so they are left out of the text.
// Hub v2 V4: the RECORD: lines above any PLAN: or COMMIT: line are shown as "Recorded" / "not understood" boxes, not as text.
export const withoutRecords=text=>{const lines=String(text||'').split('\n'),end=lines.findIndex(l=>/^\s*\**(PLAN|COMMIT):\**\s*$/i.test(l)),cut=end<0?lines.length:end;let fence=false;return lines.filter((l,i)=>{if(i>=cut)return true;if(/^\s*(```|~~~)/.test(l)){fence=!fence;return true}return fence||!/^[ \t]*RECORD:/.test(l)}).join('\n').replace(/\n{3,}/g,'\n\n').trim()};
export const withoutActions=text=>String(text||'').split('\n').filter(l=>!isActionLine(l)).join('\n').replace(/\n{3,}/g,'\n\n').trim();
// What one proposed action is right now: {label, enabled, why, primary}. plans: /api/plans summaries; runs and ready: /api/runs; jobs: /api/jobs. A stale proposal (answered plan, closed run) is shown switched off, with the reason.
export function chatActionState(a,{plans=[],runs=[],ready=[],jobs=null,git=null}={}){
 const off=(label,why)=>({label,enabled:false,why,primary:false});
 if(!a||!(CHAT_OPS.includes(a.op)||HUB_OPS.includes(a.op)))return off('Unknown action','The hub does not know this action.');
 if(a.op==='commit'||a.op==='push'){
  // git: {files, unpushed, enabled} from GET /api/commit/summary. Both buttons only open the Commit page.
  const files=git&&git.files||0,n=git&&git.unpushed||0,label=a.op==='commit'?`Review commit (${files} file${files===1?'':'s'})`:`Review push (${n} commit${n===1?'':'s'})`;
  if(!git||!git.enabled)return off(label,'Commit is off. Start the hub with: npm run hub -- --runs');
  if(a.op==='commit'&&!files)return off(label,'Nothing has changed since the last commit.');
  if(a.op==='push'&&!n)return off(label,'Nothing is waiting to be pushed.');
  return {label,enabled:true,why:a.op==='commit'?'Opens the Commit page. Nothing is committed until you press Commit there.':'Opens the Commit page. Nothing is sent to GitHub until you press Push there.',primary:false}}
 if(TOOL_OPS.includes(a.op)){
  const label=TOOL_LABEL[a.op],FREE='A script on this PC. It uses no tokens.';
  if(!jobs||!jobs.enabled)return off(label,'Tools are off. Start the hub with: npm run hub -- --runs');
  if(a.op==='restart')return jobs.busy?off(label,'Something is working. Wait for it, or stop it first.'):{label,enabled:true,why:'Stops the dev server and the relay if they run, then starts the hub again.',primary:false};
  const j=(jobs.jobs||[]).find(x=>x.key===TOOL_JOB[a.op]);if(!j)return off(label,'The hub does not know this job.');
  if(a.op==='dev-start')return j.running?off(label,'It is already running.'):{label,enabled:true,why:FREE,primary:true};
  if(a.op==='dev-stop')return j.running?{label,enabled:true,why:'',primary:false}:off(label,'It is not running.');
  if(j.running)return off(label,'It is running now. See Tools.');
  return jobs.busy?off(label,'Something is working. Wait for it, or stop it first.'):{label,enabled:true,why:FREE,primary:true}}
 if(a.op==='quick'){
  const p=plans.find(x=>x.id===a.plan);if(!p)return off(QUICK_LABEL,'That plan is not in Work.');
  if(p.revision!==a.revision)return off(QUICK_LABEL,`A newer revision (${p.revision}) exists. Read it in Work.`);
  if(p.status!=='waiting')return off(QUICK_LABEL,`Already ${p.status}.`);
  return {label:QUICK_LABEL,enabled:true,why:'One press approves this revision and starts it.',primary:false}}
 if(a.op==='approve'){
  const p=plans.find(x=>x.id===a.plan);if(!p)return off('Approve','That plan is not in Work.');
  const label=`Approve: ${p.title} (revision ${a.revision})`;
  if(p.revision!==a.revision)return off(label,`A newer revision (${p.revision}) exists. Read it in Work.`);
  if(p.status!=='waiting')return off(label,`Already ${p.status}.`);
  return {label,enabled:true,why:'',primary:true}}
 if(a.op==='start'){
  const r=ready.find(x=>x.planId===a.plan&&x.revision===a.revision);
  if(!r){const run=runs.find(x=>x.planId===a.plan&&x.revision===a.revision),p=plans.find(x=>x.id===a.plan);
   return off(`Start: ${p?p.title:'plan'}`,run?`Already started (${STATUS_LABEL[run.status]||run.status}).`:!p?'That plan is not in Work.':p.status!=='approved'||p.revision!==a.revision?'Approve this revision first.':'The plan has no usable "## Run" block.')}
  const label=`Start on ${modelName(r.model)}: ${r.title}`;
  if(!r.canStart)return off(label,r.reasons.join(' '));
  return {label,enabled:true,why:`${r.size} · up to ${fmt(r.capTokens)} tokens${r.secondYes?' · asks for a second press in Work':''}`,primary:true}}
 const run=runs.find(x=>x.id===a.run),word=a.op==='resume'?'Resume':'Close';
 if(!run)return off(word,'That run is not in Work.');
 const label=`${word}: ${run.planTitle}`;
 if(!actionsFor(run).some(x=>x.op===a.op))return off(label,`Not possible now: ${STATUS_LABEL[run.status]||run.status}.`);
 return {label,enabled:true,why:STATUS_LABEL[run.status]||'',primary:a.op==='resume'}}
// The call a click on a proposed action sends: {op, args} for runCall, or null. Start uses the model in the plan's own Run block (from the ready list), never one the master names.
export function chatActionCall(a,{ready=[],jobs=null}={}){
 if(!a)return null;
 if(a.op==='commit'||a.op==='push')return {nav:'#commit'}; // opens the page; the page's own button does the work
 if(a.op==='restart')return {op:'hub-restart',args:{}};
 if(a.op==='dev-stop'){const j=jobs&&(jobs.jobs||[]).find(x=>x.key==='dev');return j&&j.running?{op:'job-stop',args:{id:j.running.id}}:null}
 if(TOOL_OPS.includes(a.op))return {op:'job-start',args:{job:TOOL_JOB[a.op]}};
 if(a.op==='quick')return {op:'quick',args:{plan:a.plan,revision:a.revision}};
 if(a.op==='approve')return {op:'approve',args:{plan:a.plan,revision:a.revision}};
 if(a.op==='start'){const r=ready.find(x=>x.planId===a.plan&&x.revision===a.revision);return r?{op:'start',args:{plan:a.plan,revision:a.revision,model:r.model}}:null}
 if(a.op==='resume'||a.op==='close')return {op:a.op,args:{id:a.run}};
 return null}

// The cap bar: ok under 80 percent, warn from 80 (the run card turns orange), full from 100.
export const capClass=pct=>!Number.isFinite(pct)?'ok':pct>=100?'full':pct>=80?'warn':'ok';
// Seconds left to give the second yes (0 when over or not waiting).
export const secondsLeft=(run,now=Date.now())=>run&&run.status==='confirming'&&run.confirmUntil?Math.max(0,Math.ceil((run.confirmUntil-now)/1000)):0;

// One feed event as a row of names and counts: {t, k, text, n, cls}. Never the model's own words; unknown kinds are shown by their kind name only.
const clock=at=>{if(!at)return '';const d=new Date(at),p=x=>String(x).padStart(2,'0');return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`};
const END_LABEL={result:'Answered',question:'Answered',capped:'Stopped: it used its whole allowance','gauge-stop':'Stopped to protect your weekly limit',pause:'Stopped: the 5-hour limit was reached',stopped:'Stopped by you',interrupted:'Stopped: the hub closed',violation:'Stopped: it tried a tool it may not use'}; // how a chat turn ended (R7b)
// Plain words (Hub v2 V1). `text` is one readable sentence; `k` stays as a short kind word for colour and tests, the pages no longer print it. ctx.cap = the token allowance, when the page knows it.
const FAMILY=m=>{const f=/haiku|sonnet|opus|fable/i.exec(String(m||''));return f?f[0][0].toUpperCase()+f[0].slice(1).toLowerCase():'the model'};
const TOOL_VERB={Read:'Reading',Edit:'Editing',Write:'Writing',Grep:'Searching the files',Glob:'Looking for files',Shell:'Running'};
export function toolText(ev){
 const v=TOOL_VERB[ev.tool];if(!v)return 'Using '+String(ev.tool||'a tool').slice(0,30);
 if(ev.tool==='Grep'||ev.tool==='Glob')return v;
 if(ev.tool==='Shell')return ev.target&&ev.target!=='command'?`${v} ${ev.target}`:'Running a command';
 return ev.target?`${v} ${ev.target}`:`${v} a file`}
export function feedRow(ev,ctx={}){
 const t=clock(ev.at),pct=v=>Number.isFinite(v)?Math.round(v)+'%':'?';
 switch(ev.kind){
  case 'started':return {t,k:'started',text:`Started on ${FAMILY(ev.model)}${Number.isFinite(ev.tools)?` with ${ev.tools} tool${ev.tools===1?'':'s'}`:''}`,n:'',cls:''};
  case 'turn':return {t,k:ev.resumed?'answer':'start',text:ev.resumed?'Carried on after your answer':'Began working',n:'',cls:''};
  case 'tool':return {t,k:'tool',text:toolText(ev),n:'',cls:''};
  case 'tokens':return {t,k:'tokens',text:`Tokens used so far: ${fmt(ev.total)}${Number.isFinite(ctx.cap)&&ctx.cap>0?` of ${fmt(ctx.cap)}`:''}`,n:'',cls:''};
  case 'gauges':return {t,k:'usage',text:`Usage check: ${pct(ev.weekly)} of this week, ${pct(ev.fiveHour)} of these 5 hours`,n:'',cls:''};
  case 'question':return {t,k:'question',text:'Stopped to ask you a question',n:'',cls:'q'};
  case 'shell':return {t,k:'shell',text:`${String(ev.target||'command').slice(0,30)} ${ev.ok?'passed':'failed'}`,n:'',cls:ev.ok?'':'bad'};
  case 'result':return {t,k:'result',text:ev.isError?'Ended with an error':`Finished${Number.isFinite(ev.turns)?` after ${ev.turns} turn${ev.turns===1?'':'s'}`:''}`,n:'',cls:ev.isError?'bad':''};
  case 'cap-warning':return {t,k:'cap',text:"Used 80% of this run's token allowance",n:'',cls:'q'};
  case 'cap-stop':return {t,k:'cap',text:'Stopped: it used its whole allowance',n:'',cls:'bad'};
  case 'gauge-stop':return {t,k:'guard',text:ev.stopKind==='pause'?'Stopped: the 5-hour limit was reached':'Stopped to protect your weekly limit',n:'',cls:'bad'};
  case 'end':return {t,k:'end',text:END_LABEL[ev.end]||'Ended without an answer',n:Number.isFinite(ev.tokens)?`${fmt(ev.tokens)} tokens`:'',cls:ev.end==='result'||ev.end==='question'?'':'bad'};
  case 'violation':return {t,k:'violation',text:'Tried a tool it may not use',n:Number.isFinite(ev.count)?String(ev.count):'',cls:'bad'};
  default:return {t,k:String(ev.kind||'event').slice(0,16),text:'',n:'',cls:''}}}
