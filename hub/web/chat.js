// Mikkadr Hub P5, R5: the Chat page (Menu row 01). You talk to the master agent; each message is one read-only model turn. A reply with a PLAN: section is filed on Plans by the hub (a chip links to it).
// The master's words are text only (textContent in a pre-wrap box, never markup). Polls GET /api/chat every 2 s while the master works and every 15 s otherwise. The writes carry the hub token (runs-api.js).
import {runCall,errorText} from './runs-api.js';
import {modelName,fmt} from './run-actions.js';
import {agoText} from './plans.js';

export const MODEL_CHOICES=['haiku','sonnet','opus','fable'];
export const needsSecondYes=m=>m==='opus'||m==='fable';
export const MESSAGE_LABEL={user:'You',master:'Master',note:'Hub'};
// The line under a master message: its token count, and the plan it filed (if any).
export const metaOf=m=>[m.tokens!=null&&m.role!=='user'?`${fmt(m.tokens)} tokens`:null,m.model?modelName(m.model):null].filter(Boolean).join(' · ');
export const secondsLeft=(pending,now=Date.now())=>pending?Math.max(0,Math.ceil((pending.until-now)/1000)):0;

const h=(tag,props,...kids)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(props||{})){if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(v!==false&&v!=null)e.setAttribute(k,v===true?'':v)}for(const c of kids.flat())if(c!=null)e.append(c);return e};
async function getJson(url){try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)return null;return await r.json()}catch{return null}}

export function mountChat(view,{onChange}={}){
 let alive=true,timer=null,sig=null,draft='',busy=false,data=null;
 const stop=()=>{alive=false;clearTimeout(timer)};
 const top=h('div',{class:'chat-top'}),list=h('div',{class:'chat-list',role:'log','aria-label':'Chat with the master'}),note=h('p',{class:'msg err',role:'alert',hidden:true});
 const ta=h('textarea',{rows:'3','aria-label':'Message to the master',placeholder:'Describe the task. The master reads the project and writes a plan for you to approve.'});
 ta.addEventListener('input',()=>{draft=ta.value});
 ta.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();send()}});
 const sendBtn=h('button',{class:'btn pri',type:'button',onclick:()=>send()},'Send');
 const stopBtn=h('button',{class:'btn danger',type:'button',onclick:()=>act('chat-stop',{})},'Stop');
 const composer=h('div',{class:'chat-composer'},ta,h('div',{class:'btns'},sendBtn,stopBtn,h('span',{class:'small dim'},'Ctrl+Enter sends. Every message is a model call and counts on the gauges.')));
 view.append(top,note,list,composer);

 async function act(op,args){
  if(busy)return;busy=true;note.hidden=true;
  const res=await runCall(op,args);busy=false;if(!alive)return;
  if(res.ok){if(op==='chat-send'){draft='';ta.value=''}await load(true);if(onChange)onChange();return}
  note.textContent=errorText(res);note.hidden=false}
 const send=()=>{if(!draft.trim()){note.textContent='Write a message first.';note.hidden=false;ta.focus();return}return act('chat-send',{text:draft.trim()})};

 function drawTop(d){
  top.textContent='';
  const sel=h('select',{class:'sel','aria-label':'Master model',disabled:d.working},MODEL_CHOICES.map(m=>h('option',{value:m,selected:m===d.model},modelName(m))));
  sel.addEventListener('change',()=>act('chat-model',{model:sel.value}));
  top.append(h('span',{class:'label'},'Master'),sel);
  if(d.pending)top.append(h('span',{class:'cont'},h('button',{class:'btn pri',type:'button',onclick:()=>act('chat-model',{model:d.pending.model,confirm:true})},`Yes, switch to ${modelName(d.pending.model)}`),h('span',{class:'small dim'},`within ${secondsLeft(d.pending)} s`)));
  top.append(h('span',{class:'small dim chat-tokens'},`${fmt(d.tokens)} tokens in this chat`),h('button',{class:'btn',type:'button',disabled:d.working,onclick:()=>{if(confirm('Start a new chat? The old one is forgotten.'))act('chat-new',{})}},'New chat'))}
 function drawList(d){
  const stick=list.scrollTop+list.clientHeight>=list.scrollHeight-40;
  list.textContent='';
  if(!d.messages.length)list.append(h('p',{class:'soon'},'Nothing yet. Describe a task and the master will talk it through, then file a plan on the Plans page.'));
  for(const m of d.messages){
   const meta=metaOf(m);
   list.append(h('div',{class:'cmsg c-'+m.role+(m.error?' bad':'')},h('div',{class:'chead'},h('b',{},MESSAGE_LABEL[m.role]||m.role),h('span',{class:'small dim'},[agoText(m.at),meta].filter(Boolean).join(' · '))),
    h('pre',{class:'mtext'},m.text),
    m.plan?h('a',{class:'chip-plan',href:'#plans/'+m.plan.id},`${m.plan.action==='noop'?'Already filed':'Filed as plan'}: ${m.plan.title} · revision ${m.plan.revision} · read and approve`):null,
    m.planError?h('p',{class:'small warn'},'The plan could not be filed: '+m.planError):null))}
  if(d.working)list.append(h('div',{class:'cmsg c-working'},h('span',{class:'small dim'},'The master is reading and thinking…')));
  if(stick)list.scrollTop=list.scrollHeight}

 async function load(force){
  clearTimeout(timer);
  const d=await getJson('/api/chat');if(!alive)return;
  data=d;
  if(!d){top.textContent='';list.textContent='';list.append(h('p',{class:'soon'},'Could not read the chat. Is the hub still running?'));composer.hidden=true}
  else if(!d.enabled){top.textContent='';list.textContent='';composer.hidden=true;list.append(h('div',{class:'box'},h('div',{class:'label'},'The chat is off'),h('p',{},'The chat and runs are switched on when the hub starts. Stop the hub and start it again with:'),h('code',{class:'cmd'},'npm run hub -- --runs'),h('p',{class:'small dim'},'Every message is a model call and is sent only by your click.')))}
  else{
   composer.hidden=false;
   const s=[d.model,d.working,d.tokens,d.pending&&d.pending.model,d.messages.length&&d.messages[d.messages.length-1].id].join('|');
   if(force||s!==sig){sig=s;drawTop(d);drawList(d)}
   sendBtn.disabled=d.working;stopBtn.hidden=!d.working;ta.disabled=false}
  if(!alive)return;
  timer=setTimeout(()=>{if(document.hidden)timer=setTimeout(load,5000);else load()},d&&d.working?2000:15000)}
 load();
 return stop}
