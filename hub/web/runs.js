// Mikkadr Hub P5, R4: the Runs page (Menu row 05). #runs shows the run that holds the slot (or says none does), the plans ready to run, and the recent runs; #runs/<id> shows one run.
// A run card has: the live feed (names and counts only), the side box (model, plan, folder, files), the cap bar, and the buttons for its status (Stop, the Opus second yes, Resume, Continue with more, Close).
// A run's question and result are the model's own words: they are set with textContent in a pre-wrap box, so they are text and never markup (the server caps them at 8 KB).
// Polls GET /api/runs every 2 s while a run works (10 s otherwise) and the feed after the last line it has. The page is rebuilt only when something that changes its shape changes, so a half-written answer stays.
import {actionsFor,feedRow,capClass,secondsLeft,fmt,modelName,STATUS_LABEL} from './run-actions.js';
import {runCall,errorText} from './runs-api.js';
import {agoText} from './plans.js';

const h=(tag,props,...kids)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(props||{})){if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(v!==false&&v!=null)e.setAttribute(k,v===true?'':v)}for(const c of kids.flat())if(c!=null)e.append(c);return e};
async function getJson(url){try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)return null;return await r.json()}catch{return null}}

export function mountRuns(view,{id,onChange}={}){
 let alive=true,timer=null,sig=null,target=null,draft='',after=0,ui=null,busy=false;
 const stop=()=>{alive=false;clearTimeout(timer)};

 // ── one button: send the write, then redraw from the server's answer
 async function press(op,args,note){
  if(busy)return;busy=true;note.hidden=true;setDisabled(true);
  const res=await runCall(op,args);busy=false;if(!alive)return;
  if(res.ok){
   if(op==='answer')draft='';
   if(op==='start'&&res.data&&res.data.run)location.hash='#runs/'+res.data.run.id;
   if(onChange)onChange();return load()}
  setDisabled(false);note.textContent=errorText(res);note.hidden=false}
 const setDisabled=v=>{for(const b of view.querySelectorAll('.rcard button, .ready button'))b.disabled=v};
 const btn=(a,run,note,extra)=>h('button',{class:'btn'+(a.primary?' pri':'')+(a.danger?' danger':''),type:'button',onclick:()=>press(a.op,{id:run.id,extra:extra&&extra(),question:run.question&&run.question.id,text:draft.trim()},note)},a.label);

 // ── the run card
 function card(run,list){
  const pct=run.capPct,note=h('p',{class:'msg err',role:'alert',hidden:true});
  ui={run,empty:h('div',{class:'n'},'Nothing yet.'),feed:h('div',{class:'feed',role:'log','aria-label':'Live feed'}),capFill:h('i'),capText:h('div',{class:'small dim'}),files:h('span'),tokens:h('span'),count:h('span'),countdown:h('p',{class:'small dim'})};
  ui.feed.append(ui.empty);
  const left=h('div',{class:'feedwrap'},h('div',{class:'label'},'Live feed · names and counts only'),ui.feed);
  const kv=h('div',{class:'kv'},h('span',{},'Model'),h('span',{},modelName(run.model)),h('span',{},'Plan'),h('a',{href:'#plans/'+run.planId},`${run.planTitle} · revision ${run.revision}`),
   h('span',{},'Folder'),h('span',{},'your project folder'),h('span',{},'Turn'),h('span',{},String(run.turn)),h('span',{},'Files changed'),ui.files);
  const actions=actionsFor(run).filter(a=>a.op!=='answer');
  const buttons=h('div',{class:'btns'},actions.map(a=>{
   if(a.extras){const sel=h('select',{class:'sel','aria-label':'Extra tokens'},a.extras.map((n,i)=>h('option',{value:String(n),selected:i===1},`+${fmt(n)} tokens`)));return h('span',{class:'cont'},sel,btn(a,run,note,()=>Number(sel.value)))}
   return btn(a,run,note)}));
  const side=h('div',{class:'side'},h('div',{class:'box'},kv),
   h('div',{class:'box'},h('div',{class:'label'},'Run cap'),h('div',{class:'capbar'},ui.capFill),ui.capText),
   ui.countdown,buttons,note);
  const parts=[h('div',{class:'rhead'},h('h2',{class:'plan-name'},run.planTitle),h('span',{class:'pill rs-'+run.status},STATUS_LABEL[run.status]||run.status)),
   h('div',{class:'rgrid'},left,side)];
  if(run.reason&&run.status!=='running')parts.push(h('p',{class:'msg'},run.reason));
  if(run.status==='waiting-answer'&&run.question)parts.push(answerForm(run,note));
  if(run.status==='done'){
   parts.push(h('div',{class:'box result'},h('div',{class:'label'},'Result'),h('pre',{class:'mtext'},run.resultText||'(no text)')));
   if(run.flagged.length)parts.push(h('div',{class:'box flag'},h('div',{class:'label'},'Look at these before you commit'),h('p',{class:'small dim'},'They change what runs on this PC or what the hub trusts.'),h('ul',{class:'files'},run.flagged.map(f=>h('li',{},h('code',{},f))))))}
  ui.touched=new Set(run.files);ui.chips=h('div',{class:'chips'});ui.chipsBox=h('div',{class:'box',hidden:true},h('div',{class:'label'},'Files touched'),ui.chips);parts.push(ui.chipsBox);
  return h('section',{class:'rcard',id:'rcard'},parts)}

 function answerForm(run,note){
  const ta=h('textarea',{rows:'4','aria-label':'Your answer',placeholder:'Your answer. It goes back into the same session.'});
  ta.value=draft;ta.addEventListener('input',()=>{draft=ta.value});
  return h('div',{class:'box answerbox'},h('div',{class:'label'},'Question from the run'),h('pre',{class:'mtext'},(run.question.text||'').replace(/^QUESTION:\s*/i,'')||'(no text)'),ta,
   h('div',{class:'btns'},h('button',{class:'btn pri',type:'button',onclick:()=>{if(!draft.trim()){note.textContent='Write an answer first.';note.hidden=false;ta.focus();return}press('answer',{id:run.id,question:run.question.id,text:draft.trim()},note)}},'Send answer')))}

 // dynamic parts: no rebuild
 // files touched: what the run reported when it ended, plus the Edit and Write lines seen in the feed while it works
 function showFiles(){
  if(!ui)return;
  ui.files.textContent=String(ui.touched.size);ui.chipsBox.hidden=!ui.touched.size;
  ui.chips.textContent='';for(const f of ui.touched)ui.chips.append(h('code',{},f))}
 function paint(run){
  if(!ui)return;
  for(const f of run.files)ui.touched.add(f);showFiles();
  ui.capFill.style.width=Math.min(100,run.capPct)+'%';ui.capFill.parentElement.dataset.state=capClass(run.capPct);
  ui.capText.textContent=`${fmt(run.tokens)} of ${fmt(run.capTokens)} tokens · ${run.capPct}%${run.status==='running'?' · stops itself at 100%':''}`;
  const s=secondsLeft(run);ui.countdown.textContent=run.status==='confirming'?`Press the yes button within ${s} s, or this is dropped.`:'';ui.countdown.hidden=run.status!=='confirming'}
 async function pullFeed(run){
  if(!ui||ui.run.id!==run.id)return;
  const f=await getJson(`/api/runs/${run.id}/feed?after=${after}`);if(!alive||!f||!ui||ui.run.id!==run.id)return;
  const stick=ui.feed.scrollTop+ui.feed.clientHeight>=ui.feed.scrollHeight-30;
  if(f.events.length)ui.empty.remove();
  for(const ev of f.events){const r=feedRow(ev);ui.feed.append(h('div',{class:'fr '+r.cls},h('span',{class:'t'},r.t),h('span',{class:'k'},r.k),h('span',{},r.text),h('span',{class:'n'},r.n)))}
  for(const ev of f.events)if(ev.kind==='tool'&&(ev.tool==='Edit'||ev.tool==='Write')&&ev.target&&ui.touched.size<300)ui.touched.add(ev.target);
  showFiles();after=f.last;
  if(stick)ui.feed.scrollTop=ui.feed.scrollHeight}

 // ── lists under the card (the list page only)
 const row=r=>h('a',{class:'plan-row',href:'#runs/'+r.id},h('span',{class:'plan-main'},h('span',{class:'plan-title'},r.planTitle),h('span',{class:'plan-meta'},`${modelName(r.model)} · ${fmt(r.tokens)} of ${fmt(r.capTokens)} tokens · ${r.files.length} file${r.files.length===1?'':'s'} · ${agoText(r.updatedAt)}`)),h('span',{class:'pill rs-'+r.status},STATUS_LABEL[r.status]||r.status));
 function readyRow(p){
  const note=h('p',{class:'msg err',role:'alert',hidden:true}),m=modelName(p.model);
  return h('div',{class:'plan-row ready'},h('span',{class:'plan-main'},h('span',{class:'plan-title'},p.title),
   h('span',{class:'plan-meta'},`Revision ${p.revision} · ${m} · size ${p.size} · up to ${fmt(p.capTokens)} tokens${p.why?' · '+p.why:''}${p.secondYes?' · asks for a second yes':''}`),
   p.canStart?null:h('span',{class:'plan-meta warn'},'Cannot start now: '+p.reasons.join(' ')),note),
   h('span',{class:'acts'},p.canStart?h('button',{class:'btn pri',type:'button',onclick:()=>press('start',{plan:p.planId,revision:p.revision,model:p.model},note)},p.secondYes?`Start on ${m}`:'Start'):null,h('a',{class:'btn',href:'#plans/'+p.planId},'Open plan')))}

 // ── draw
 function draw(list){
  view.textContent='';ui=null;after=0;
  if(!list){view.append(h('p',{class:'soon'},'Could not read the runs. Is the hub still running?'));return}
  if(!list.enabled){view.append(h('div',{class:'box'},h('div',{class:'label'},'Runs are off'),h('p',{},'Runs are switched on when the hub starts. Stop the hub and start it again with:'),h('code',{class:'cmd'},'npm run hub -- --runs'),h('p',{class:'small dim'},'A run is a model call and starts only from an approved plan, by your click. Nothing starts by itself.')));return}
  if(id)view.append(h('a',{class:'back',href:'#runs'},'← All runs'));
  if(target)view.append(card(target,list));
  else if(id)view.append(h('p',{class:'soon'},'That run was not found.'));
  else view.append(h('p',{class:'soon'},list.locked?'A run is working.':'No run is active.'));
  if(!id){
   view.append(h('h2',{class:'sect'},'Ready to run',h('span',{class:'n'},list.ready.length||'')));
   view.append(list.ready.length?h('div',{class:'plan-list ready'},list.ready.map(readyRow)):h('p',{class:'soon small'},'No approved plan with a Run block is waiting to start. Approve one on Plans first.'));
   const rest=list.runs.filter(r=>!target||r.id!==target.id);
   view.append(h('h2',{class:'sect'},'Recent runs',h('span',{class:'n'},rest.length||'')));
   view.append(rest.length?h('div',{class:'plan-list'},rest.slice(0,30).map(row)):h('p',{class:'soon small'},'No runs yet.'))}}

 async function load(){
  clearTimeout(timer);
  const list=await getJson('/api/runs');if(!alive)return;
  target=list?(id?list.runs.find(r=>r.id===id):list.runs.find(r=>r.id===list.holding))||null:null;
  const shape=!list?'x':!list.enabled?'off':[id||'',target?[target.id,target.status,target.question&&target.question.id,target.pending&&target.pending.kind,target.reason,target.flagged.length,target.resultText.length].join(':'):'-',list.ready.map(p=>p.planId+p.revision+p.canStart).join(','),id?'':list.runs.map(r=>r.id+r.status).join(',')].join('|');
  if(shape!==sig){sig=shape;draw(list)}
  if(target){paint(target);await pullFeed(target)}
  if(!alive)return;
  const fast=target&&(target.status==='running'||target.status==='confirming');
  timer=setTimeout(()=>{if(document.hidden)timer=setTimeout(load,5000);else load()},fast?2000:10000)}
 load();
 return stop}
