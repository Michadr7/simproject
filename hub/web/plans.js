// Mikkadr Hub P4, S4: the Plans page. A list (waiting, answered, files found that were never sent) and a reader with revision tabs, the answer history, and the approve and deny form.
// Everything the page shows is text set with textContent, except the plan body: the server renders that from Markdown after escaping it, and it is parsed with DOMParser (which never runs scripts).
import {runCall,errorText} from './runs-api.js';
import {QUICK_LABEL} from './run-actions.js';
export const agoText=(ms,now=Date.now())=>{if(!ms)return '';const m=Math.max(0,Math.round((now-ms)/60000));return m<1?'just now':m<60?m+' min ago':m<48*60?Math.round(m/60)+' h ago':Math.round(m/1440)+' days ago'};
export const STATUS_LABEL={waiting:'Waiting for your approval',approved:'Approved',denied:'Denied'};
export const sizeText=b=>b<1024?b+' B':Math.round(b/1024)+' KB';
export const groupPlans=plans=>({waiting:plans.filter(p=>p.status==='waiting').sort((a,b)=>a.sentAt-b.sentAt),answered:plans.filter(p=>p.status!=='waiting').sort((a,b)=>b.sentAt-a.sentAt)}); // oldest waiting first, newest answered first

const h=(tag,props,...kids)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(props||{})){if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(v!==false&&v!=null)e.setAttribute(k,v===true?'':v)}for(const c of kids.flat())if(c!=null)e.append(c);return e};
async function api(url,body){
 const r=await fetch(url,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'}:{cache:'no-store'});
 let data=null;try{data=await r.json()}catch{}
 return {ok:r.ok,status:r.status,data}}

// Hub v2 V1: the Work page mounts the reader inside a step with embedded:true (no back link, no title: the step has them).
export function mountPlans(view,{id,onChange,embedded=false}={}){
 let alive=true,timer=null,notice=null;
 const stop=()=>{alive=false;clearInterval(timer)};
 const note=text=>{notice=text};

 async function drawList(){
  const [pl,fd]=await Promise.all([api('/api/plans'),api('/api/plans/found')]);
  if(!alive)return;view.textContent='';
  if(!pl.ok){view.append(h('p',{class:'soon'},'Could not read the plans.'));return}
  const g=groupPlans(pl.data.plans),row=p=>h('a',{class:'plan-row',href:'#plans/'+p.id},
   h('span',{class:'plan-main'},h('span',{class:'plan-title'},p.title),h('span',{class:'plan-meta'},`${p.from} · revision ${p.revision} · sent ${agoText(p.sentAt)}`)),
   h('span',{class:'pill st-'+p.status},STATUS_LABEL[p.status]));
  view.append(h('h2',{class:'sect'},'Waiting for an answer',h('span',{class:'n'},g.waiting.length||'')));
  view.append(g.waiting.length?h('div',{class:'plan-list'},g.waiting.map(row)):h('p',{class:'soon'},'Nothing is waiting. Send a plan with npm run plan -- <file.md>.'));
  if(g.answered.length){view.append(h('h2',{class:'sect'},'Answered'));view.append(h('div',{class:'plan-list'},g.answered.map(row)))}
  const files=fd.ok?fd.data.files:[];
  if(files.length){
   view.append(h('h2',{class:'sect'},'Found, never sent',h('span',{class:'n'},files.length)));
   view.append(h('p',{class:'soon small'},'Plan files in this repo that were never sent. Add puts one on your list; Hide keeps it away until the file changes.'));
   view.append(h('div',{class:'plan-list'},files.map(f=>h('div',{class:'plan-row found'},
    h('span',{class:'plan-main'},h('span',{class:'plan-title'},f.title),h('span',{class:'plan-meta'},`${f.path} · ${sizeText(f.bytes)} · changed ${agoText(f.modifiedAt)}`)),
    h('span',{class:'acts'},
     h('button',{class:'btn pri',type:'button',onclick:()=>act('/api/plans/found/add',{hash:f.hash})},'Add'),
     h('button',{class:'btn',type:'button',onclick:()=>act('/api/plans/found/hide',{hash:f.hash})},'Hide'))))))}
  if(notice){view.prepend(h('p',{class:'msg err',role:'alert'},notice));notice=null}}
 async function act(url,body){const r=await api(url,body);if(!r.ok)note(r.data&&r.data.error||'That did not work.');if(onChange)onChange();if(alive)drawList()}

 async function drawPlan(rev){
  const r=await api('/api/plans/'+id+(rev?'?rev='+rev:''));if(!alive)return;
  view.textContent='';
  const back=embedded?null:h('a',{class:'back',href:'#work'},'← All work');
  if(!r.ok){if(back)view.append(back);view.append(h('p',{class:'soon'},'That plan was not found.'));return}
  const p=r.data,latest=p.revision,isLatest=p.shown===latest;
  if(back)view.append(back,h('div',{class:'plan-head'},h('h2',{class:'plan-name'},p.title),h('span',{class:'pill st-'+p.status},STATUS_LABEL[p.status])));
  view.append(
   h('p',{class:'plan-meta'},`${p.from} · ${p.source||'no file'} · revision ${latest} sent ${agoText(p.sentAt)}`));
  if(p.revisions.length>1)view.append(h('div',{class:'revs',role:'tablist','aria-label':'Revisions'},p.revisions.map(x=>h('button',{type:'button',class:'rev'+(x.n===p.shown?' on':''),role:'tab','aria-selected':String(x.n===p.shown),onclick:()=>drawPlan(x.n)},`Revision ${x.n}`,x.n===latest?' (newest)':''))));
  const body=h('article',{class:'reader'});
  const doc=new DOMParser().parseFromString(p.html,'text/html');body.append(...doc.body.childNodes);view.append(body);
  if(p.answers.length)view.append(h('div',{class:'answers'},h('h3',{},'Answers'),p.answers.map(a=>h('p',{class:'ans '+a.verdict},h('b',{},`${a.verdict==='approved'?'Approved':'Denied'} revision ${a.revision}`),` · ${agoText(a.at)}`,a.note?h('span',{class:'ans-note'},a.note):null))));
  if(!isLatest){view.append(h('p',{class:'msg'},`You are reading revision ${p.shown}. Only the newest revision (${latest}) can be answered.`,' ',h('button',{class:'btn',type:'button',onclick:()=>drawPlan()},'Show the newest')));return}
  if(p.status!=='waiting'){view.append(h('p',{class:'msg '+p.status},p.status==='approved'?`Approved. Press Start. (Revision ${latest}; a new revision would put it back on your list.)`:`You denied revision ${latest}. A new revision would put it back on your list.`));return}
  const ta=h('textarea',{id:'note',rows:'3',placeholder:'Note (needed to deny, optional to approve)','aria-label':'Note'});
  const msg=h('p',{class:'msg err',role:'alert',hidden:true});
  const send=async verdict=>{
   const note=ta.value.trim();
   if(verdict==='denied'&&!note){msg.textContent='Denying needs a reason: write it in the note.';msg.hidden=false;ta.focus();return}
   for(const b of view.querySelectorAll('.answer button'))b.disabled=true;
   const a=await api(`/api/plans/${p.id}/answer`,{verdict,note,revision:latest});if(!alive)return;
   if(a.ok){if(onChange)onChange();drawPlan();return}
   for(const b of view.querySelectorAll('.answer button'))b.disabled=false;
   msg.textContent=a.status===409?'A newer revision arrived, or this plan was already answered. It is reloading.':(a.data&&a.data.error)||'That did not work.';msg.hidden=false;
   if(a.status===409)setTimeout(()=>{if(alive)drawPlan()},1200)};
  // Hub v2 V2, Quick fix: a Haiku S plan the master filed gets one more button that approves this revision and starts it (the hub decides whether it is offered, and checks everything again on the press)
  const quick=async()=>{
   for(const b of view.querySelectorAll('.answer button'))b.disabled=true;
   const a=await runCall('quick',{plan:p.id,revision:latest});if(!alive)return;
   if(a.ok&&a.data&&a.data.run){if(onChange)onChange();location.hash='#runs/'+a.data.run.id;return}
   for(const b of view.querySelectorAll('.answer button'))b.disabled=false;
   msg.textContent=errorText(a);msg.hidden=false};
  view.append(h('div',{class:'answer'},ta,msg,h('div',{class:'acts'},
   h('button',{class:'btn pri',type:'button',onclick:()=>send('approved')},'Approve revision '+latest),
   p.quick&&p.quick.revision===latest?h('button',{class:'btn',type:'button',title:'One press approves this revision and starts it on Haiku.',onclick:quick},QUICK_LABEL):null,
   h('button',{class:'btn danger',type:'button',onclick:()=>send('denied')},'Deny'))));
  // a newer revision may arrive while this is open: tell the reader instead of replacing what they are reading
  clearInterval(timer);timer=setInterval(async()=>{if(document.hidden||!alive)return;const l=await api('/api/plans');if(!alive||!l.ok)return;const me=l.data.plans.find(x=>x.id===p.id);
   if(me&&me.revision>latest&&!view.querySelector('.fresh'))view.prepend(h('p',{class:'msg fresh'},`Revision ${me.revision} just arrived. `,h('button',{class:'btn',type:'button',onclick:()=>drawPlan()},'Read it')))},20000)}

 if(id)drawPlan();else{drawList();timer=setInterval(()=>{if(!document.hidden&&alive&&!view.querySelector('.msg'))drawList()},20000)}
 return stop}
