// Mikkadr Hub 2.11: the Work page as ONE PATH. Left: a slim queue (Running, Up next, a folded Everything else). Right: the current step as the hero, with one big button, a "Then:" line and the model and size.
//   #work                    the first step in Up next is open
//   #work/<plan id>          that step open (old #plans/<id> lands here)
//   #runs/<run id>           the step that run belongs to
// The buttons are the ones that already existed: the Start card (with its model and size picker) and the run card come from runs.js, the reader with Approve and Deny from plans.js, the file checks and notes from home.js. Same routes, same gates.
// For a plan waiting for approval the model and size are shown read-only: the Approve route takes only the verdict, so the picker stays on Start.
// After Approve, Deny or Start the page opens the next step in the queue by itself. Rules for the queue and the lines of text are in lanes.js.
// Text only (textContent). The page's own write is Add and Hide for a plan file that was never sent (the two routes the Plans page used).
import {mountRuns} from './runs.js';
import {mountPlans,agoText} from './plans.js';
import {mountHome} from './home.js';
import {queueOf,areaChips,areaLabel,sideItems,buttonText,ageShort,ledeOf,thenOf} from './lanes.js';
import {modelName,fmt} from './run-actions.js';

const h=(tag,props,...kids)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(props||{})){if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(v!==false&&v!=null)e.setAttribute(k,v===true?'':v)}for(const c of kids.flat())if(c!=null)e.append(c);return e};
export const stepHref=s=>s.planId&&s.key===s.planId?'#work/'+s.planId:s.runId?'#runs/'+s.runId:'#work';
export const stepName=s=>s.code?`${s.code} ${s.name}`:s.name;
const find=(tree,plan,run)=>{for(const project of tree.projects)for(const step of project.steps)if((run&&step.runId===run)||(!run&&plan&&step.planId===plan))return {project,step};return null};
const store={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};

export function mountWork(view,{plan=null,run=null,onChange}={}){
 let alive=true,tree,quietMounts=[],detailMounts=[],queueSig=null,quietSig=null,detailSig=null,headSig=null,els=null,area=store.get('hub.workarea')||'all',restOpen=false,filesOpen=false,notesOpen=false;
 const unmountQuiet=()=>{for(const m of quietMounts)m();quietMounts=[]};
 const unmountDetail=()=>{for(const m of detailMounts)m();detailMounts=[]};
 const stop=()=>{alive=false;unmountQuiet();unmountDetail()};
 const changed=()=>{if(onChange)onChange()};
 let page=null,queuePane=null,detailPane=null,quiet=null,order=[];

 // After the big button: open the next step in the queue (Up next, then the ones that cannot start, then Running), never the one just answered.
 const advance=key=>{ // key is the step's href, as in `order`
  const i=order.indexOf(key),after=order.slice(i+1).find(k=>k!==key)||order.slice(0,Math.max(i,0)).find(k=>k!==key);
  if(after)location.hash=after;
  changed()};

 async function foundAct(url,hash,button,note){
  button.disabled=true;let ok=false,why='That did not work.';
  try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hash}),cache:'no-store'});ok=r.ok;if(!ok){const d=await r.json().catch(()=>null);if(d&&d.error)why=d.error}}catch{}
  if(!alive)return;if(ok)return changed();button.disabled=false;note.textContent=why;note.hidden=false}
 const foundRow=i=>{const note=h('span',{class:'plan-meta warn',role:'alert',hidden:true});return h('div',{class:'plan-row found'},
  h('span',{class:'plan-main'},h('span',{class:'plan-title'},i.title),h('span',{class:'plan-meta'},`${i.detail}${i.at?' · changed '+agoText(i.at):''}`),note),
  h('span',{class:'acts'},h('button',{class:'btn pri',type:'button',onclick:e=>foundAct('/api/plans/found/add',i.hash,e.currentTarget,note)},'Add'),h('button',{class:'btn',type:'button',onclick:e=>foundAct('/api/plans/found/hide',i.hash,e.currentTarget,note)},'Hide')))};

 // a queue line: dot, title, and a word on the right (the action, or the age of a running step)
 const item=(c,current,right,cls)=>{const s=c.step,on=current&&current.key===s.key;
  return h('a',{class:'qi'+(on?' on':'')+(cls?' '+cls:''),href:stepHref(s),'aria-current':on?'true':null,title:s.label},
   cls==='blocked'?null:h('i',{class:c.lane==='work'?'run':''}),h('span',{class:'n'},stepName(s)),h('small',{},right))};
 const reasonOf=s=>s.status==='blocked'?s.reason:s.runsOff?'runs are off':(s.reasons&&s.reasons[0])||'cannot start yet';

 function drawQueue(q,current){
  const now=Date.now();
  const sig=JSON.stringify(['q',area,restOpen,current&&current.key,tree.enabled,q.running.map(c=>[c.step.key,c.step.label,ageShort(c.step.at,now)]),q.next.map(c=>[c.step.key,c.step.label]),q.blocked.map(c=>[c.step.key,c.step.reason,c.step.canStart]),q.rest.map(c=>[c.step.key,c.step.label])]);
  if(sig===queueSig)return;queueSig=sig;
  const keep=queuePane.scrollTop;queuePane.textContent='';
  if(!tree.enabled)queuePane.append(h('p',{class:'msg'},'Runs are switched off, so nothing can be started. Stop the hub and start it again with: ',h('code',{class:'cmd'},'npm run hub -- --runs')));
  const sect=(name,n)=>h('h2',{class:'qh'},name,n?h('span',{class:'dim'},String(n)):null);
  if(q.running.length)queuePane.append(sect('Running'),h('div',{class:'qlist'},q.running.map(c=>item(c,current,ageShort(c.step.at,now)))));
  if(q.next.length||q.blocked.length)queuePane.append(sect('Up next'),h('div',{class:'qlist'},q.next.map(c=>item(c,current,buttonText(c.step))),q.blocked.map(c=>item(c,current,reasonOf(c.step),'blocked'))));
  if(q.rest.length){const d=h('details',{class:'qrest',open:restOpen||(current&&q.rest.some(c=>c.step.key===current.key))||null},h('summary',{},`Everything else · ${q.rest.length}`),h('div',{class:'qlist'},q.rest.map(c=>item(c,current,ageShort(c.step.at,now)))));d.addEventListener('toggle',()=>{restOpen=d.open});queuePane.append(d)}
  if(!q.running.length&&!q.next.length&&!q.blocked.length&&!q.rest.length)queuePane.append(h('p',{class:'soon'},tree.projects.length?'No steps in this area.':'Nothing here yet. Tell the master in Chat what you want; it writes a plan, and the plan appears here for your approval.'));
  queuePane.scrollTop=keep}

 // the quiet bottom line: Area, Assets (file problems) and Hub notes. None of it counts as needing you.
 function drawQuiet(){
  const side=sideItems(tree),chips=areaChips(tree);
  if(area!=='all'&&!chips.some(c=>c[0]===area))area='all';
  const sig=JSON.stringify(['z',area,chips.map(c=>c[0]),filesOpen,notesOpen,side.files.map(i=>[i.id,i.title]),side.found.map(i=>i.id),side.notes.map(i=>[i.id,i.title])]);
  if(sig===quietSig)return;quietSig=sig;
  unmountQuiet();quiet.textContent='';
  if(chips.length>1){const sel=h('select',{class:'sel','aria-label':'Area'},[['all','All'],...chips.map(([k])=>[k,areaLabel(k)])].map(([k,t])=>h('option',{value:k,selected:k===area||null},t)));
   sel.addEventListener('change',()=>{area=sel.value;store.set('hub.workarea',area);queueSig=null;quietSig=null;draw()});
   quiet.append(h('label',{class:'qarea'},'Area ',sel))}
  if(side.files.length){const box=h('div',{});const fc=h('details',{class:'fold filecard',open:filesOpen||null},h('summary',{},`Assets: ${side.files.length} ${side.files.length===1?'file has a problem':'files have problems'}`),h('div',{class:'filebar'},h('a',{class:'btn pri',href:'#assets'},'Open Assets')),box);
   fc.addEventListener('toggle',()=>{filesOpen=fc.open});quiet.append(fc);const home=mountHome(box,{onChange:changed});home.update({items:side.files});quietMounts.push(()=>{})}
  if(side.notes.length||side.found.length){const nb=h('div',{});const n=side.notes.length+side.found.length;
   const nt=h('details',{class:'fold hubnotes',open:notesOpen||null},h('summary',{},`Hub notes: ${n}`),nb);nt.addEventListener('toggle',()=>{notesOpen=nt.open});
   if(side.found.length)nb.append(h('div',{class:'plan-list'},side.found.map(foundRow)));
   if(side.notes.length){const b2=h('div',{});nb.append(b2);const hm=mountHome(b2,{onChange:changed});hm.update({items:side.notes})}
   quiet.append(nt)}}

 // the hero: head parts follow every poll; the mounted real buttons stay, so a half-written note or answer is never wiped
 function drawStep(project,step){
  const startable=step.status==='approved'&&tree.enabled&&step.canStart!==false;
  const sig=JSON.stringify(['s',step.key,step.runId,step.status,step.runStatus,step.revision,tree.enabled,startable]);
  if(sig!==detailSig){
   detailSig=sig;headSig=null;unmountDetail();detailPane.textContent='';
   els={crumb:h('div',{class:'crumb'}),title:h('h2',{class:'plan-name'}),lede:h('p',{class:'lede'}),then:h('p',{class:'wf-then'}),pick:h('p',{class:'wf-pick'}),why:h('p',{class:'msg wf-why'}),mount:h('div',{class:'wf-mount'})};
   detailPane.append(els.crumb,els.title,els.lede,els.mount,els.then,els.pick,els.why);
   const own=step.planId&&step.key===step.planId,key=stepHref(step);
   if(step.runId)detailMounts.push(mountRuns(els.mount,{id:step.runId,embedded:true,onChange:changed}));
   else if(startable)detailMounts.push(mountRuns(els.mount,{readyFor:{plan:step.planId,revision:step.revision},embedded:true,onChange:()=>advance(key)}));
   if(own){
    const body=h('div',{class:'wf-mount'}),open=step.status==='waiting'||step.status==='approved';
    if(open){detailPane.append(body);detailMounts.push(mountPlans(body,{id:step.planId,embedded:true,onChange:step.status==='waiting'?()=>advance(key):changed}))}
    else{const fold=h('details',{class:'fold planfold'},h('summary',{},'The plan'),body);detailPane.append(fold);detailMounts.push(mountPlans(body,{id:step.planId,embedded:true,onChange:changed}))}}}
  const idx=project.steps.findIndex(s=>s.key===step.key),left=project.steps.filter(s=>s.status!=='done'&&!s.denied).length;
  const hs=JSON.stringify([step.label,step.meaning,step.next,step.reason,step.model,step.size,step.capTokens,step.canStart,step.reasons,project.name,idx,left,project.steps.length]);
  if(hs===headSig)return;headSig=hs;
  els.crumb.textContent=project.steps.length>1?`${project.name} · step ${idx+1} of ${project.steps.length}${left&&left!==project.steps.length?` · ${left} left`:''}`:project.name;
  els.title.textContent=stepName(step);els.lede.textContent=ledeOf(step);
  const t=thenOf(step);els.then.textContent='';els.then.hidden=!t.text;els.then.append(h('b',{},t.label+' '),t.text);
  // model and size, read-only here: Approve sends only the verdict, so the picker is on the Start card
  const showPick=step.status==='waiting'&&step.model&&step.capTokens;
  els.pick.hidden=!showPick;els.pick.textContent=showPick?`Model ${modelName(step.model)}${step.size?' · size '+step.size:''} · up to ${fmt(step.capTokens)} tokens. These come from the plan. You can change both when you press Start.`:'';
  // a plan that cannot start: the reason, and no button
  const why=step.status==='approved'&&!startable?step.next:step.status==='blocked'?step.reason||step.next:'';
  els.why.hidden=!why;els.why.textContent=why}

 function drawEmpty(note){
  if(detailSig==='e'+note)return;detailSig='e'+note;unmountDetail();headSig=null;detailPane.textContent='';
  detailPane.append(h('p',{class:'soon'},note))}

 function draw(){
  if(!alive)return;
  if(tree===undefined){view.textContent='';view.append(h('p',{class:'soon'},'Loading…'));page=null;return}
  if(tree===null){if(!page){view.textContent='';view.append(h('p',{class:'soon'},'Could not read the work list. Is the hub still running?'))}return}
  if(!page||!page.isConnected){
   view.textContent='';queueSig=null;quietSig=null;detailSig=null;
   queuePane=h('div',{class:'pane list wf-queue'});detailPane=h('div',{class:'pane detail wf-hero'});quiet=h('div',{class:'wf-quiet'});
   page=h('div',{class:'page two wf'},h('div',{class:'cols'},queuePane,detailPane),quiet);view.append(page)}
  const chips=areaChips(tree);if(area!=='all'&&!chips.some(c=>c[0]===area))area='all';
  const q=queueOf(tree,area);
  order=[...q.next,...q.blocked,...q.running].map(c=>stepHref(c.step));
  const hit=find(tree,plan,run),first=q.next[0]||q.blocked[0]||q.running[0],sel=hit||(!plan&&!run&&first?{project:first.project,step:first.step}:null);
  drawQueue(q,sel&&sel.step);drawQuiet();
  if(sel)return drawStep(sel.project,sel.step);
  if(run&&!hit){
   // a run of an earlier revision is not a step any more, but it can still be read
   const sig='r'+run;if(detailSig!==sig){detailSig=sig;unmountDetail();headSig=null;detailPane.textContent='';const box=h('div',{class:'wf-mount'});detailPane.append(h('p',{class:'soon small'},'This run belongs to an earlier revision of its plan.'),box);detailMounts.push(mountRuns(box,{id:run,onChange:changed}))}
   return}
  if(plan)return drawEmpty('That step was not found.');
  drawEmpty('Nothing needs you, and nothing is working. Pick a step on the left to read it.')}
 draw();
 return {update(t){tree=t;draw()},stop}}
