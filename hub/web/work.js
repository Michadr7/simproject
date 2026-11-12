// Mikkadr Hub v2, V1: the Work page. It replaces the separate Waiting, Plans and Runs pages: the shell hands it the tree from GET /api/work (hub/work.js) and it draws
//   #work                    what needs you first, then every project with its steps, then the finished projects folded away
//   #work/<plan id>          one step: its status with the meaning, the "Next step" line, the buttons, the run's feed and result, the plan reader   (old #plans/<id> lands here)
//   #runs/<run id>           the step that run belongs to
// The buttons are the ones that already existed: the run card and the Start row come from runs.js, the reader with Approve and Deny from plans.js, the other items from home.js. Same routes, same gates.
// Text only (textContent). The page's own writes are Add and Hide for a plan file that was never sent (the two routes the Plans page used).
import {mountRuns} from './runs.js';
import {mountPlans,agoText} from './plans.js';
import {mountHome} from './home.js';

const h=(tag,props,...kids)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(props||{})){if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(v!==false&&v!=null)e.setAttribute(k,v===true?'':v)}for(const c of kids.flat())if(c!=null)e.append(c);return e};
export const GLYPH={you:'●',ok:'✓',todo:'○',run:'▶'};
export const stepHref=s=>s.planId&&s.key===s.planId?'#work/'+s.planId:s.runId?'#runs/'+s.runId:'#work';
export const stepName=s=>s.code?`${s.code} ${s.name}`:s.name;
const find=(tree,plan,run)=>{for(const project of tree.projects)for(const step of project.steps)if((run&&step.runId===run)||(!run&&plan&&step.planId===plan))return {project,step};return null};
const glyph=g=>h('span',{class:'s '+g,'aria-hidden':'true'},GLYPH[g]||GLYPH.todo);
const next=text=>h('p',{class:'next'},h('b',{},'NEXT STEP'),text);

export function mountWork(view,{plan=null,run=null,onChange}={}){
 let alive=true,tree,mounts=[],mountSig=null,headSig=null,els=null,home=null;
 const unmountAll=()=>{for(const m of mounts)m();mounts=[];home=null};
 const stop=()=>{alive=false;unmountAll()};
 const changed=()=>{if(onChange)onChange()};

 // the steps of one project: glyph, name (a link), status
 const stepsCard=(project,current)=>h('div',{class:'box'},h('ol',{class:'steps'},project.steps.map(s=>h('li',{class:s.needsYou?'you':''},glyph(s.glyph),
  h('a',{href:stepHref(s),'aria-current':current&&s.key===current.key?'true':null},stepName(s)),h('span',{class:'small'},s.needsYou?'Needs you':s.label)))));

 async function foundAct(url,hash,button,note){
  button.disabled=true;let ok=false,why='That did not work.';
  try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hash}),cache:'no-store'});ok=r.ok;if(!ok){const d=await r.json().catch(()=>null);if(d&&d.error)why=d.error}}catch{}
  if(!alive)return;if(ok)return changed();button.disabled=false;note.textContent=why;note.hidden=false}
 const foundRow=i=>{const note=h('span',{class:'plan-meta warn',role:'alert',hidden:true});return h('div',{class:'plan-row found'},
  h('span',{class:'plan-main'},h('span',{class:'plan-title'},i.title),h('span',{class:'plan-meta'},`${i.detail}${i.at?' · changed '+agoText(i.at):''}`),note),
  h('span',{class:'acts'},h('button',{class:'btn pri',type:'button',onclick:e=>foundAct('/api/plans/found/add',i.hash,e.currentTarget,note)},'Add'),h('button',{class:'btn',type:'button',onclick:e=>foundAct('/api/plans/found/hide',i.hash,e.currentTarget,note)},'Hide')))};

 // ── #work: what needs you, then the projects
 function drawOverview(){
  const sig=JSON.stringify(['o',tree.enabled,tree.next,tree.projects.map(p=>[p.name,p.summary,p.steps.map(s=>[s.key,s.label]),p.items.map(i=>[i.id,i.title,i.detail])])]);
  if(sig===mountSig)return;mountSig=sig;unmountAll();view.textContent='';
  view.append(next(tree.next));
  if(!tree.enabled)view.append(h('p',{class:'msg'},'Runs are switched off, so nothing can be started. Stop the hub and start it again with: ',h('code',{class:'cmd'},'npm run hub -- --runs')));
  const you=[];for(const p of tree.projects)for(const s of p.steps)if(s.needsYou)you.push([p,s]);
  const items=tree.projects.flatMap(p=>p.items);
  if(you.length||items.length){
   view.append(h('h2',{class:'sect'},'Needs you',h('span',{class:'n'},String(tree.needsYou))));
   if(you.length)view.append(h('div',{class:'plan-list'},you.map(([p,s])=>h('a',{class:'plan-row you',href:stepHref(s)},h('span',{class:'plan-main'},h('span',{class:'plan-title'},`${p.name} · ${stepName(s)}`),h('span',{class:'plan-meta warn'},s.label),h('span',{class:'plan-meta'},s.next))))));
   const found=items.filter(i=>i.kind==='found'),rest=items.filter(i=>i.kind!=='found');
   if(found.length)view.append(h('div',{class:'plan-list'},found.map(foundRow)));
   if(rest.length){const box=h('div',{});view.append(box);home=mountHome(box,{onChange:changed});home.update({items:rest})}}
  const open=tree.projects.filter(p=>!p.allDone&&p.steps.length),done=tree.projects.filter(p=>p.allDone);
  for(const p of open)view.append(h('h2',{class:'sect'},p.name,h('span',{class:p.needsYou?'n':'dim'},p.summary)),stepsCard(p,null));
  if(done.length)view.append(h('details',{class:'fold'},h('summary',{},`Finished (${done.length})`),done.map(p=>[h('h2',{class:'sect'},p.name,h('span',{class:'dim'},`${p.total} step${p.total===1?'':'s'}`)),stepsCard(p,null)])));
  if(!tree.projects.length)view.append(h('p',{class:'soon'},'Nothing here yet. Tell the master in Chat what you want; it writes a plan, and the plan appears here for your approval.'))}

 // ── one step
 function drawStep(project,step){
  const sig=JSON.stringify(['s',step.key,step.runId,step.status,step.runStatus,step.revision,tree.enabled]);
  if(sig!==mountSig){
   mountSig=sig;headSig=null;unmountAll();view.textContent='';
   els={head:h('div',{}),runBox:h('div',{class:'work-run'}),sibs:h('div',{})};
   view.append(h('a',{class:'back',href:'#work'},'← All work'),els.head,els.runBox);
   if(step.runId)mounts.push(mountRuns(els.runBox,{id:step.runId,embedded:true,onChange:changed}));
   else if(step.status==='approved'&&tree.enabled)mounts.push(mountRuns(els.runBox,{readyFor:{plan:step.planId,revision:step.revision},embedded:true,onChange:changed}));
   view.append(els.sibs);
   if(step.planId&&step.key===step.planId){
    const body=h('div',{}),fold=h('details',{class:'fold planfold',open:step.status==='waiting'||step.status==='blocked'||(step.status==='approved'&&!step.runId)},h('summary',{},step.status==='waiting'?'The plan (read it, then answer below it)':'The plan'),body);
    view.append(fold);mounts.push(mountPlans(body,{id:step.planId,embedded:true,onChange:changed}))}}
  // the head and the list of sister steps follow every poll; the mounted parts stay, so a half-written note or answer is never wiped
  const hs=JSON.stringify([step.label,step.meaning,step.next,step.reason,project.name,project.steps.map(s=>[s.key,s.label])]);
  if(hs===headSig)return;headSig=hs;
  els.head.textContent='';els.head.append(h('h2',{class:'plan-name'},`${project.name} · ${stepName(step)}`),
   h('div',{class:'wstatus'},h('span',{class:'pill ws-'+step.glyph},step.label),h('span',{class:'small dim'},step.status==='blocked'&&step.reason?step.reason:step.meaning)),next(step.next));
  els.sibs.textContent='';if(project.steps.length>1)els.sibs.append(h('h2',{class:'sect'},`${project.name}: all steps`,h('span',{class:'dim'},project.summary)),stepsCard(project,step))}

 function draw(){
  if(!alive)return;
  if(tree===undefined){view.textContent='';view.append(h('p',{class:'soon'},'Loading…'));return}
  if(tree===null){if(mountSig===null){view.textContent='';view.append(h('p',{class:'soon'},'Could not read the work list. Is the hub still running?'))}return}
  if(!plan&&!run)return drawOverview();
  const hit=find(tree,plan,run);
  if(hit)return drawStep(hit.project,hit.step);
  const sig='x'+(run||plan);if(sig===mountSig)return;mountSig=sig;unmountAll();view.textContent='';
  if(!run)view.append(h('a',{class:'back',href:'#work'},'← All work'));
  // a run of an earlier revision is not a step any more, but it can still be read
  if(run){const box=h('div',{class:'work-run'});view.append(h('p',{class:'soon small'},'This run belongs to an earlier revision of its plan.'),box);mounts.push(mountRuns(box,{id:run,onChange:changed}))}
  else view.append(h('p',{class:'soon'},'That step was not found.'))}
 draw();
 return {update(t){tree=t;draw()},stop}}
