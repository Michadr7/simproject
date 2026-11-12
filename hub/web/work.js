// Mikkadr Hub v2.4.2: the Work page. One page, two panes: the list of every step on the left, the open step on the right.
//   #work                    the list, with the first step that needs you open
//   #work/<plan id>          that step open (old #plans/<id> lands here)
//   #runs/<run id>           the step that run belongs to
// The list is grouped by what each step needs from you: Needs you, Working, Waiting, Done (folded). "Group by Project" gives the old tree on the page. A status line at the top says in numbers what is going on.
// The buttons are the ones that already existed: the run card and the Start row come from runs.js, the reader with Approve and Deny from plans.js, the other items from home.js. Same routes, same gates.
// Text only (textContent). The page's own writes are Add and Hide for a plan file that was never sent (the two routes the Plans page used).
import {mountRuns} from './runs.js';
import {mountPlans,agoText} from './plans.js';
import {mountHome} from './home.js';

const h=(tag,props,...kids)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(props||{})){if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(v!==false&&v!=null)e.setAttribute(k,v===true?'':v)}for(const c of kids.flat())if(c!=null)e.append(c);return e};
export const GLYPH={you:'●',ok:'✓',todo:'○',run:'▶'};
export const stepHref=s=>s.planId&&s.key===s.planId?'#work/'+s.planId:s.runId?'#runs/'+s.runId:'#work';
export const stepName=s=>s.code?`${s.code} ${s.name}`:s.name;
// Which group a step belongs to: what it needs from you decides.
export const groupOf=s=>s.needsYou?'you':s.status==='working'?'run':s.status==='done'?'done':'wait';
export const GROUPS=[['you','Needs you'],['run','Working'],['wait','Waiting'],['done','Done']];
// "2 need you · 1 working · 3 waiting · 4 done", or '' when there are no steps.
export function statusLine(tree){
 const n={you:0,run:0,wait:0,done:0};for(const p of tree.projects)for(const s of p.steps)n[groupOf(s)]++;
 n.you+=tree.projects.reduce((c,p)=>c+p.items.length,0);
 const parts=[];if(n.you)parts.push(`${n.you} ${n.you===1?'needs':'need'} you`);if(n.run)parts.push(`${n.run} working`);if(n.wait)parts.push(`${n.wait} waiting`);if(n.done)parts.push(`${n.done} done`);
 return parts.join(' · ')}
const find=(tree,plan,run)=>{for(const project of tree.projects)for(const step of project.steps)if((run&&step.runId===run)||(!run&&plan&&step.planId===plan))return {project,step};return null};
const firstOpen=tree=>{for(const g of ['you','run'])for(const project of tree.projects)for(const step of project.steps)if(groupOf(step)===g)return {project,step};return null};
const glyph=g=>h('span',{class:'s '+g,'aria-hidden':'true'},GLYPH[g]||GLYPH.todo);
const next=text=>h('p',{class:'next'},h('b',{},'NEXT STEP'),h('span',{},text));
const store={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};

export function mountWork(view,{plan=null,run=null,onChange}={}){
 let alive=true,tree,listMounts=[],detailMounts=[],listSig=null,detailSig=null,headSig=null,els=null,home=null,group=store.get('hub.workgroup')==='project'?'project':'need';
 const unmountList=()=>{for(const m of listMounts)m();listMounts=[];home=null};
 const unmountDetail=()=>{for(const m of detailMounts)m();detailMounts=[]};
 const stop=()=>{alive=false;unmountList();unmountDetail()};
 const changed=()=>{if(onChange)onChange()};
 let page=null,listPane=null,detailPane=null;

 async function foundAct(url,hash,button,note){
  button.disabled=true;let ok=false,why='That did not work.';
  try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hash}),cache:'no-store'});ok=r.ok;if(!ok){const d=await r.json().catch(()=>null);if(d&&d.error)why=d.error}}catch{}
  if(!alive)return;if(ok)return changed();button.disabled=false;note.textContent=why;note.hidden=false}
 const foundRow=i=>{const note=h('span',{class:'plan-meta warn',role:'alert',hidden:true});return h('div',{class:'plan-row found'},
  h('span',{class:'plan-main'},h('span',{class:'plan-title'},i.title),h('span',{class:'plan-meta'},`${i.detail}${i.at?' · changed '+agoText(i.at):''}`),note),
  h('span',{class:'acts'},h('button',{class:'btn pri',type:'button',onclick:e=>foundAct('/api/plans/found/add',i.hash,e.currentTarget,note)},'Add'),h('button',{class:'btn',type:'button',onclick:e=>foundAct('/api/plans/found/hide',i.hash,e.currentTarget,note)},'Hide')))};

 // one row of the list: glyph, name, the status in plain words; the open step is marked
 const row=(project,s,current,withProject)=>{
  const g=groupOf(s),open=current&&current.key===s.key;
  return h('a',{class:'row '+(g==='you'?'you':g==='run'?'run':'lite'),href:stepHref(s),'aria-current':open?'true':null},glyph(s.glyph),
   h('span',{},h('span',{class:'t'},withProject?h('em',{},project.name+' · '):null,stepName(s)),h('br'),h('span',{class:'d'},s.needsYou?s.label:s.status==='blocked'&&s.reason?s.reason:s.label)),
   h('span',{class:'go','aria-hidden':'true'},'›'))};

 function drawList(current){
  const sig=JSON.stringify(['l',group,current&&current.key,tree.enabled,tree.next,tree.projects.map(p=>[p.name,p.steps.map(s=>[s.key,s.label,s.status]),p.items.map(i=>[i.id,i.title,i.detail])])]);
  if(sig===listSig)return;listSig=sig;
  const keep=listPane.scrollTop;unmountList();listPane.textContent='';
  const line=statusLine(tree);
  const seg=h('span',{class:'seg'},[['need','What it needs'],['project','Project']].map(([v,t])=>h('button',{type:'button','aria-pressed':String(group===v),onclick:()=>{group=v;store.set('hub.workgroup',v);listSig=null;drawList(current)}},t)));
  listPane.append(h('div',{class:'listtop'},h('span',{},'Group by'),seg,h('span',{class:'count-line'},line)));
  if(!tree.enabled)listPane.append(h('p',{class:'msg'},'Runs are switched off, so nothing can be started. Stop the hub and start it again with: ',h('code',{class:'cmd'},'npm run hub -- --runs')));
  const all=tree.projects.flatMap(p=>p.steps.map(s=>[p,s])),items=tree.projects.flatMap(p=>p.items);
  const found=items.filter(i=>i.kind==='found'),rest=items.filter(i=>i.kind!=='found');
  if(group==='need'){
   for(const [k,name] of GROUPS){
    const list=all.filter(([,s])=>groupOf(s)===k),extra=k==='you'?items.length:0;
    if(!list.length&&!extra)continue;
    const rows=h('div',{class:'rows'},list.map(([p,s])=>row(p,s,current,true)));
    if(k==='done'){listPane.append(h('details',{class:'fold'},h('summary',{},`Done · ${list.length}`),rows));continue}
    listPane.append(h('h2',{class:'sect'},name,h('span',{class:k==='you'?'n':'dim'},String(list.length+extra))));
    if(k==='you'){
     if(found.length)listPane.append(h('div',{class:'plan-list'},found.map(foundRow)));
     if(rest.length){const box=h('div',{});listPane.append(box);home=mountHome(box,{onChange:changed});home.update({items:rest});listMounts.push(()=>{home=null})}}
    listPane.append(rows)}}
  else{
   for(const p of tree.projects){
    if(!p.steps.length&&!p.items.length)continue;
    listPane.append(h('h2',{class:'sect'},p.name,h('span',{class:p.needsYou?'n':'dim'},p.summary)),h('div',{class:'rows'},p.steps.map(s=>row(p,s,current,false))));
    const pi=p.items.filter(i=>i.kind==='found');if(pi.length)listPane.append(h('div',{class:'plan-list'},pi.map(foundRow)));
    const pr=p.items.filter(i=>i.kind!=='found');if(pr.length){const box=h('div',{});listPane.append(box);const hm=mountHome(box,{onChange:changed});hm.update({items:pr})}}}
  if(!tree.projects.length)listPane.append(h('p',{class:'soon'},'Nothing here yet. Tell the master in Chat what you want; it writes a plan, and the plan appears here for your approval.'));
  listPane.scrollTop=keep}

 // the open step
 function drawStep(project,step){
  const sig=JSON.stringify(['s',step.key,step.runId,step.status,step.runStatus,step.revision,tree.enabled]);
  if(sig!==detailSig){
   detailSig=sig;headSig=null;unmountDetail();detailPane.textContent='';
   els={head:h('div',{}),runBox:h('div',{class:'work-run'})};
   detailPane.append(h('a',{class:'back',href:'#work'},'← All work'),els.head,els.runBox);
   if(step.runId)detailMounts.push(mountRuns(els.runBox,{id:step.runId,embedded:true,onChange:changed}));
   else if(step.status==='approved'&&tree.enabled)detailMounts.push(mountRuns(els.runBox,{readyFor:{plan:step.planId,revision:step.revision},embedded:true,onChange:changed}));
   if(step.planId&&step.key===step.planId){
    const body=h('div',{}),fold=h('details',{class:'fold planfold',open:true},h('summary',{},step.status==='waiting'?'The plan (read it, then answer below it)':'The plan'),body);
    detailPane.append(fold);detailMounts.push(mountPlans(body,{id:step.planId,embedded:true,onChange:changed}))}}
  // the head follows every poll; the mounted parts stay, so a half-written note or answer is never wiped
  const hs=JSON.stringify([step.label,step.meaning,step.next,step.reason,project.name,project.steps.map(s=>[s.key,s.label])]);
  if(hs===headSig)return;headSig=hs;
  const pos=project.steps.length>1?h('div',{class:'track'},project.steps.map(s=>h('a',{class:'trk','aria-current':s.key===step.key?'true':null,href:stepHref(s),title:s.label},glyph(s.glyph),stepName(s)))):null;
  els.head.textContent='';els.head.append(h('div',{class:'crumb'},project.name),h('h2',{class:'plan-name'},stepName(step)),
   h('div',{class:'wstatus'},h('span',{class:'pill ws-'+step.glyph},step.label),h('span',{class:'small dim'},step.status==='blocked'&&step.reason?step.reason:step.meaning)),
   h('div',{class:'act '+(step.needsYou?'you':'')},next(step.next)),pos)}

 function drawEmpty(note){
  if(detailSig==='e'+note)return;detailSig='e'+note;unmountDetail();headSig=null;detailPane.textContent='';
  detailPane.append(h('p',{class:'soon'},note))}

 function draw(){
  if(!alive)return;
  if(tree===undefined){view.textContent='';view.append(h('p',{class:'soon'},'Loading…'));page=null;return}
  if(tree===null){if(!page){view.textContent='';view.append(h('p',{class:'soon'},'Could not read the work list. Is the hub still running?'))}return}
  if(!page||!page.isConnected){
   view.textContent='';listSig=null;detailSig=null;
   listPane=h('div',{class:'pane list'});detailPane=h('div',{class:'pane detail'});
   page=h('div',{class:'page two work'},h('div',{class:'cols'},listPane,detailPane));view.append(page)}
  const hit=find(tree,plan,run),sel=hit||(!plan&&!run?firstOpen(tree):null);
  page.classList.toggle('has-sel',!!(plan||run));
  // the headline: the one thing to do now
  let top=page.querySelector(':scope>.next');
  if(!top){top=next('');page.prepend(top)}
  top.lastChild.textContent=statusLine(tree)?`${statusLine(tree)}. ${tree.next}`:tree.next;
  drawList(sel&&sel.step);
  if(sel)return drawStep(sel.project,sel.step);
  if(run&&!hit){
   // a run of an earlier revision is not a step any more, but it can still be read
   const sig='r'+run;if(detailSig!==sig){detailSig=sig;unmountDetail();headSig=null;detailPane.textContent='';const box=h('div',{class:'work-run'});detailPane.append(h('a',{class:'back',href:'#work'},'← All work'),h('p',{class:'soon small'},'This run belongs to an earlier revision of its plan.'),box);detailMounts.push(mountRuns(box,{id:run,onChange:changed}))}
   return}
  if(plan)return drawEmpty('That step was not found.');
  drawEmpty('Nothing needs you, and nothing is working. Pick a step on the left to read it.')}
 draw();
 return {update(t){tree=t;draw()},stop}}
