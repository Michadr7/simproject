// Mikkadr Hub v2, V2: the Tools page (foot row "Tools"). The project's own scripts, run by the hub without a model: tests, release, check, index, asset pictures; the game dev server and the relay; and a restart of the hub itself.
// One row per job: its last result in plain words, one button (Run, Start or Stop), the failing test names, and the last lines of output folded away.
// A button sends only the job's key (or the id of the running job) through runCall, with the hub token; the hub decides everything else from its own table. Text only (textContent).
// Polls GET /api/jobs every 2 s while something runs and every 8 s otherwise.
import {runCall,errorText} from './runs-api.js';

const hm=ms=>{const d=new Date(ms),p=x=>String(x).padStart(2,'0');return `${p(d.getHours())}:${p(d.getMinutes())}`};
const agoText=(ms,now)=>{const m=Math.max(0,Math.round((now-ms)/60000));return m<1?'just now':m<60?m+' min ago':m<48*60?Math.round(m/60)+' h ago':Math.round(m/1440)+' days ago'};
const lasted=(a,b)=>{const s=Math.max(0,Math.round((b-a)/1000));return s<90?s+' s':Math.round(s/60)+' min'};
// One job's state in one line: "148 of 148 passed · 18:42 (2 h ago)". {text, cls}: cls is '', 'ok', 'bad' or 'run'.
export function resultLine(job,now=Date.now()){
 if(job.running)return {text:job.kind==='service'?`Running since ${hm(job.running.startedAt)}`:`Running now, started ${hm(job.running.startedAt)}`,cls:'run'};
 const l=job.last;
 if(!l)return {text:job.kind==='service'?'Not running':'Not run from the hub yet',cls:''};
 const what=l.summary&&l.summary.text||(l.status==='done'?'Done':'Ended'),when=l.endedAt?`${hm(l.endedAt)} (${agoText(l.endedAt,now)})`:'';
 if(job.kind==='service')return {text:`Not running. Last time: ${what.charAt(0).toLowerCase()+what.slice(1)}${when?' · '+when:''}`,cls:l.summary&&l.summary.ok===false?'bad':''};
 return {text:[what,when,l.endedAt&&l.startedAt?'took '+lasted(l.startedAt,l.endedAt):null,l.auto?'started by the hub after a run':null].filter(Boolean).join(' · '),cls:l.summary&&l.summary.ok?'ok':'bad'}}
// The sentence at the top of the page.
export function nextLine(d){
 if(!d||!d.enabled)return 'Tools are switched off. Stop the hub and start it again with: npm run hub -- --runs';
 if(d.running)return `${d.running.label} is running. Wait for it, or press Stop. Nothing else can start until it ends.`;
 if(d.busy)return 'A run or the master is working, so no job can start. Wait for it, or stop it in Work or Chat.';
 const bad=(d.jobs||[]).find(j=>(j.key==='test'||j.key==='check')&&j.last&&j.last.summary&&j.last.summary.ok===false&&Number.isFinite(j.last.summary.total));
 if(bad)return 'The last test run had failures (named below). Tell the master in Chat, or press Run again after a fix. These buttons are scripts and use no tokens.';
 return 'Nothing is running. Press Run on a row. These are scripts on this PC and use no tokens.'}
export const buttonOf=job=>job.running?{op:'stop',label:'Stop',danger:true}:{op:'start',label:job.kind==='service'?'Start':'Run',primary:job.kind!=='service'};
// Only a localhost link from the hub's own table is ever shown as a link.
export const gameLink=job=>job&&job.running&&typeof job.url==='string'&&/^http:\/\/localhost:\d{2,5}$/.test(job.url)?job.url:null;

const h=(tag,props,...kids)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(props||{})){if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(v!==false&&v!=null)e.setAttribute(k,v===true?'':v)}for(const c of kids.flat())if(c!=null)e.append(c);return e};
async function getJson(url){try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)return null;return await r.json()}catch{return null}}

export function mountTools(view,{onChange}={}){
 let alive=true,timer=null,sig=null,busy=false,restarting=null;
 const open=new Set(); // the output folds you opened stay open across redraws
 const stop=()=>{alive=false;clearTimeout(timer)};
 const top=h('p',{class:'next'}),note=h('p',{class:'msg err',role:'alert',hidden:true}),body=h('div',{});
 view.append(top,note,body);
 const say=text=>{note.textContent=text;note.hidden=!text};

 async function act(op,args){
  if(busy)return;busy=true;say('');
  const res=await runCall(op,args);busy=false;if(!alive)return;
  if(!res.ok)say(errorText(res));
  await load(true);if(onChange)onChange()}

 // Restart: the hub answers, stops what it started and exits; its supervisor starts it again. Wait until a hub with a new start time answers.
 async function restart(){
  if(busy||restarting)return;
  if(!confirm('Restart the hub? The game dev server and the relay stop if they run.'))return;
  busy=true;say('');const before=await getJson('/api/hub-id');
  const res=await runCall('hub-restart',{});busy=false;if(!alive)return;
  if(!res.ok){say(errorText(res));return}
  restarting={since:Date.now(),text:'The hub is restarting…'};draw(null,true);
  for(let i=0;i<80&&alive;i++){await new Promise(r=>setTimeout(r,500));const now=await getJson('/api/hub-id');if(now&&before&&now.startedAt!==before.startedAt){restarting=null;say('');await load(true);if(onChange)onChange();return}}
  if(!alive)return;restarting=null;sig=null;say('The hub did not come back. Start it again in the terminal: npm run hub -- --runs');load(true)}

 const row=j=>{
  const r=resultLine(j),b=buttonOf(j),l=j.last,fails=!j.running&&l&&l.summary&&l.summary.failing||[],link=gameLink(j),key='out-'+j.key;
  const btn=h('button',{class:'btn'+(b.primary?' pri':'')+(b.danger?' danger':''),type:'button',onclick:()=>b.op==='stop'?act('job-stop',{id:j.running.id}):act('job-start',{job:j.key})},b.label);
  const fold=!j.running&&l&&l.tail&&l.tail.length?h('details',{class:'fold tool-fold',open:open.has(key)},h('summary',{},`Last output (${l.tail.length} line${l.tail.length===1?'':'s'})`),h('pre',{class:'tool-out'},l.tail.join('\n'))):null;
  if(fold)fold.addEventListener('toggle',()=>{if(fold.open)open.add(key);else open.delete(key)});
  return h('div',{class:'box tool'+(j.running?' on':'')},
   h('div',{class:'tool-head'},h('span',{class:'plan-main'},h('span',{class:'plan-title'},j.label),h('span',{class:'plan-meta tool-res '+r.cls},r.text),j.about?h('span',{class:'plan-meta'},j.about):null),h('span',{class:'acts'},link?h('a',{class:'btn',href:link,target:'_blank',rel:'noopener'},'Open the game'):null,btn)),
   fails.length?h('div',{class:'tool-fails'},h('span',{class:'label'},`Failing (${fails.length})`),h('ul',{class:'files'},fails.map(f=>h('li',{},f)))):null,fold)};

 function draw(d,force){
  if(restarting){top.textContent='';top.append(h('b',{},'NEXT STEP'),'Wait a few seconds. The page carries on by itself when the hub is back.');body.textContent='';body.append(h('p',{class:'msg'},restarting.text));return}
  const s=JSON.stringify(d);if(!force&&s===sig)return;sig=s;
  top.textContent='';top.append(h('b',{},'NEXT STEP'),nextLine(d));body.textContent='';
  if(!d){body.append(h('p',{class:'soon'},'Could not read the tools. Is the hub still running?'));return}
  if(!d.enabled){body.append(h('div',{class:'box'},h('div',{class:'label'},'Tools are off'),h('p',{},'Tools are switched on together with runs when the hub starts. Stop the hub and start it again with:'),h('code',{class:'cmd'},'npm run hub -- --runs')));return}
  const jobs=d.jobs.filter(j=>j.kind==='job'),services=d.jobs.filter(j=>j.kind==='service');
  body.append(h('h2',{class:'sect'},'Checks and builds'),h('div',{class:'tool-list'},jobs.map(row)));
  body.append(h('h2',{class:'sect'},'Servers'),h('div',{class:'tool-list'},services.map(row)));
  body.append(h('h2',{class:'sect'},'The hub'),h('div',{class:'box tool'},h('div',{class:'tool-head'},
   h('span',{class:'plan-main'},h('span',{class:'plan-title'},'Restart the hub'),h('span',{class:'plan-meta'},d.canRestart?'Needed after the hub\'s own files changed. Refused while a run, the master or a job works. The servers above stop.':'This hub was not started with npm run hub, so it cannot start itself again. Stop it in the terminal and run: npm run hub -- --runs')),
   h('span',{class:'acts'},h('button',{class:'btn',type:'button',disabled:!d.canRestart||d.busy,onclick:restart},'Restart')))))}

 async function load(force){
  clearTimeout(timer);
  const [d,id]=await Promise.all([getJson('/api/jobs'),getJson('/api/hub-id')]);if(!alive)return;
  if(d)d.canRestart=!!(id&&id.canRestart);
  if(!restarting)draw(d,force);
  timer=setTimeout(()=>{if(document.hidden)timer=setTimeout(load,4000);else load()},d&&(d.running||d.busy)?2000:8000)}
 load();
 return stop}
