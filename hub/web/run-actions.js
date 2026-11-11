// Mikkadr Hub P5, R4: the pure rules the Runs page and the Waiting list share (no DOM, no fetch, so the server and the tests can import it too).
// What a run's status is called, which buttons it gets, which request a button sends, one feed line as names and counts, and the cap bar colour.
export const MODEL_NAME={haiku:'Haiku 5.5',sonnet:'Sonnet 5.5',opus:'Opus 5.5',fable:'Fable 5.2'};
export const STATUS_LABEL={running:'Running',confirming:'Needs a second yes','waiting-answer':'Waiting for your answer',capped:'Hit its cap',paused:'Paused',interrupted:'Interrupted','guard-stopped':'Stopped by the weekly guard',stopped:'Stopped',failed:'Ended without a result',done:'Finished',closed:'Closed'};
export const ACTIVE=['running','waiting-answer','confirming']; // the states that hold the one run slot
export const EXTRAS=[150000,300000,600000,1000000]; // "Continue with more" offers these; the server accepts 100,000 to 3,000,000
export const fmt=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('en-US'):'?';
export const modelName=m=>MODEL_NAME[m]||String(m||'?');

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
 if(op==='approve')return a.plan?{url:`/api/plans/${a.plan}/answer`,body:{verdict:'approved',note:'Approved from the chat.',revision:a.revision}}:null; // the Plans page's own route: 423 while a run works, 409 on a stale revision
 if(op==='chat-send')return {url:'/api/chat/send',body:{text:a.text}};
 if(op==='chat-model')return {url:'/api/chat/model',body:{model:a.model,confirm:a.confirm===true}};
 if(op==='chat-new'||op==='chat-stop')return {url:'/api/chat/'+op.slice(5),body:{}};
 if(!a.id)return null;
 const base=`/api/runs/${a.id}/`;
 if(op==='continue')return {url:base+'continue',body:{extra:a.extra}};
 if(op==='answer')return {url:base+'answer',body:{question:a.question,text:a.text}};
 if(['stop','confirm','resume','close'].includes(op))return {url:base+op,body:{}};
 return null}

// ── R7c: actions the master proposes in a chat reply. The master only writes the line; the hub draws a button, and a click goes through the same routes and gates as the buttons on Plans and Runs.
// A line alone in the reply: "ACTION: approve <plan id> <revision>", "ACTION: start <plan id> <revision>", "ACTION: resume <run id>", "ACTION: close <run id>". Anything else is ignored.
export const CHAT_OPS=['approve','start','resume','close'],MAX_CHAT_ACTIONS=4;
const ACTION_LINE=/^\s*\**ACTION:\**\s*(approve|start|resume|close)\s+(\S+)(?:\s+(\d{1,6}))?\s*\**\s*$/i,PLAN_ID=/^[a-z0-9][a-z0-9-]{0,79}$/,RUN_ID_RE=/^run-[0-9]{8}-[0-9]{6}-[0-9a-f]{4}$/;
export function parseActionLine(line){
 const m=ACTION_LINE.exec(String(line||''));if(!m)return null;
 const op=m[1].toLowerCase(),id=m[2].replace(/[`*]/g,''),n=m[3]?Number(m[3]):null;
 if(op==='approve'||op==='start')return PLAN_ID.test(id)&&!RUN_ID_RE.test(id)&&Number.isInteger(n)&&n>=1?{op,plan:id,revision:n}:null;
 return RUN_ID_RE.test(id)&&n===null?{op,run:id}:null}
// The reply as shown: the ACTION lines are drawn as buttons, so they are left out of the text.
export const withoutActions=text=>String(text||'').split('\n').filter(l=>!ACTION_LINE.test(l)).join('\n').replace(/\n{3,}/g,'\n\n').trim();
// What one proposed action is right now: {label, enabled, why, primary}. plans: /api/plans summaries; runs and ready: /api/runs. A stale proposal (answered plan, closed run) is shown switched off, with the reason.
export function chatActionState(a,{plans=[],runs=[],ready=[]}={}){
 const off=(label,why)=>({label,enabled:false,why,primary:false});
 if(!a||!CHAT_OPS.includes(a.op))return off('Unknown action','The hub does not know this action.');
 if(a.op==='approve'){
  const p=plans.find(x=>x.id===a.plan);if(!p)return off('Approve','That plan is not on the Plans page.');
  const label=`Approve: ${p.title} (revision ${a.revision})`;
  if(p.revision!==a.revision)return off(label,`A newer revision (${p.revision}) exists. Read it on the Plans page.`);
  if(p.status!=='waiting')return off(label,`Already ${p.status}.`);
  return {label,enabled:true,why:'',primary:true}}
 if(a.op==='start'){
  const r=ready.find(x=>x.planId===a.plan&&x.revision===a.revision);
  if(!r){const run=runs.find(x=>x.planId===a.plan&&x.revision===a.revision),p=plans.find(x=>x.id===a.plan);
   return off(`Start: ${p?p.title:'plan'}`,run?`Already started (${STATUS_LABEL[run.status]||run.status}).`:!p?'That plan is not on the Plans page.':p.status!=='approved'||p.revision!==a.revision?'Approve this revision first.':'The plan has no usable "## Run" block.')}
  const label=`Start on ${modelName(r.model)}: ${r.title}`;
  if(!r.canStart)return off(label,r.reasons.join(' '));
  return {label,enabled:true,why:`${r.size} · up to ${fmt(r.capTokens)} tokens${r.secondYes?' · needs your second yes on the Runs page':''}`,primary:true}}
 const run=runs.find(x=>x.id===a.run),word=a.op==='resume'?'Resume':'Close';
 if(!run)return off(word,'That run is not on the Runs page.');
 const label=`${word}: ${run.planTitle}`;
 if(!actionsFor(run).some(x=>x.op===a.op))return off(label,`Not possible now: ${STATUS_LABEL[run.status]||run.status}.`);
 return {label,enabled:true,why:STATUS_LABEL[run.status]||'',primary:a.op==='resume'}}
// The call a click on a proposed action sends: {op, args} for runCall, or null. Start uses the model in the plan's own Run block (from the ready list), never one the master names.
export function chatActionCall(a,{ready=[]}={}){
 if(!a)return null;
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
const END_LABEL={result:'answered',question:'answered',capped:'stopped at its cap','gauge-stop':'stopped by the weekly guard',pause:'5-hour limit reached',stopped:'stopped by you',interrupted:'the hub closed',violation:'stopped: a tool outside the list'}; // how a chat turn ended (R7b)
export function feedRow(ev){
 const t=clock(ev.at),pct=v=>Number.isFinite(v)?Math.round(v)+'%':'?';
 switch(ev.kind){
  case 'started':return {t,k:'started',text:String(ev.model||'model'),n:Number.isFinite(ev.tools)?`${ev.tools} tools`:'',cls:''};
  case 'turn':return {t,k:ev.resumed?'answer':'start',text:ev.resumed?'resumed':'first turn',n:`turn ${ev.n}`,cls:''};
  case 'tool':return {t,k:'tool',text:ev.target?`${ev.tool} · ${ev.target}`:String(ev.tool||'tool'),n:'',cls:''};
  case 'tokens':return {t,k:'tokens',text:'turn total',n:fmt(ev.total),cls:''};
  case 'gauges':return {t,k:'gauges',text:`fresh reading ${pct(ev.weekly)} weekly / ${pct(ev.fiveHour)} 5-hour`,n:'',cls:''};
  case 'question':return {t,k:'question',text:'sent to Waiting for you',n:'',cls:'q'};
  case 'result':return {t,k:'result',text:ev.isError?'ended with an error':'finished',n:Number.isFinite(ev.turns)?`${ev.turns} turns`:'',cls:ev.isError?'bad':''};
  case 'cap-warning':return {t,k:'cap',text:'80% of the cap used',n:pct(ev.capPct),cls:'q'};
  case 'cap-stop':return {t,k:'cap',text:'cap reached, stopping',n:pct(ev.capPct),cls:'bad'};
  case 'gauge-stop':return {t,k:'guard',text:ev.stopKind==='pause'?'5-hour limit reached':'weekly guard reached',n:'',cls:'bad'};
  case 'end':return {t,k:'end',text:END_LABEL[ev.end]||'ended without an answer',n:Number.isFinite(ev.tokens)?fmt(ev.tokens):'',cls:ev.end==='result'||ev.end==='question'?'':'bad'};
  case 'violation':return {t,k:'violation',text:'a tool outside the list was offered',n:Number.isFinite(ev.count)?String(ev.count):'',cls:'bad'};
  default:return {t,k:String(ev.kind||'event').slice(0,16),text:'',n:'',cls:''}}}
