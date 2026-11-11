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
 if(op==='chat-send')return {url:'/api/chat/send',body:{text:a.text}};
 if(op==='chat-model')return {url:'/api/chat/model',body:{model:a.model,confirm:a.confirm===true}};
 if(op==='chat-new'||op==='chat-stop')return {url:'/api/chat/'+op.slice(5),body:{}};
 if(!a.id)return null;
 const base=`/api/runs/${a.id}/`;
 if(op==='continue')return {url:base+'continue',body:{extra:a.extra}};
 if(op==='answer')return {url:base+'answer',body:{question:a.question,text:a.text}};
 if(['stop','confirm','resume','close'].includes(op))return {url:base+op,body:{}};
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
