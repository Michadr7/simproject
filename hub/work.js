// Mikkadr Hub v2, V1: the Work tree.

// One pure function turns the plans, the runs and the other things that wait for you into projects with steps (no file, no clock, no model call).
// A plan titled "Project CODE: title" (CODE = a letter and digits: "Scene editor E4: Library", "Hub v2 V1: the tree") gives the project and the step; a line "Project: <name>" in the plan text wins; the rest goes under "Other".
// Every step has ONE status from STATUS, each with a one-line meaning, and one plain "Next step" sentence saying what to press and what it costs. Names and counts only: never the model's own words.
//   plans:   [{id,title,status,revision,sentAt, project?, run?:{model,size}, runProblem?, note?}]   (the server adds the last four from the plan text)
//   runs:    the run views of hub/runs.js      ready: its ready() list      waiting: the items of hub/waiting.js      found: [{hash,path,title,bytes,modifiedAt}]
//   enabled: false when the hub was started without --runs
import {CAPS} from './runplan.js';
import {modelName,fmt} from './web/run-actions.js';

export const OTHER='Other';
export const STATUS={
 waiting:{label:'Waiting for your approval',meaning:'Nobody may build this until you approve it.',glyph:'you'},
 approved:{label:'Approved (press Start)',meaning:'You approved the plan. Nothing runs until you press Start.',glyph:'you'},
 working:{label:'Working',meaning:'A run is building this now. You can watch it or stop it.',glyph:'run'},
 question:{label:'Has a question for you',meaning:'The run stopped and waits for you. Waiting uses no tokens.',glyph:'you'},
 finished:{label:'Finished (read the result)',meaning:'The run ended with a result. Read it, then close the step.',glyph:'you'},
 done:{label:'Done',meaning:'Closed. Nothing is left to do here.',glyph:'ok'},
 stopped:{label:'Stopped',meaning:'It ended before it was finished.',glyph:'you'},
 blocked:{label:'Cannot start yet',meaning:'The plan has no Run block, so the hub cannot start it.',glyph:'todo'}};
const YOU=['waiting','approved','question','finished','stopped'];
const RUN_STATUS={running:'working','waiting-answer':'question',confirming:'question',done:'finished',closed:'done',capped:'stopped',paused:'stopped',interrupted:'stopped','guard-stopped':'stopped',failed:'stopped',stopped:'stopped'};
const STOP_REASON={capped:'it used its whole allowance',paused:'the 5-hour limit was reached',interrupted:'the hub closed',failed:'it ended without a result',stopped:'you stopped it'};
STOP_REASON['guard-stopped']='to protect your weekly limit';

const CODE=/^(.+?)\s+([A-Za-z]\d{1,3}[a-z]?)\s*:\s*(\S.*)$/;
const cut=(s,n)=>{s=String(s??'');return s.length>n?s.slice(0,n-1)+'…':s};
const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
// "Scene editor E4: Library" -> {project:'Scene editor', code:'E4', name:'Library'}; anything else -> {project:null, code:'', name:title}
export function splitTitle(title){const t=String(title??'').trim(),m=CODE.exec(t);return m?{project:m[1].trim().slice(0,60),code:m[2],name:m[3].trim()}:{project:null,code:'',name:t||'Plan'}}
// The optional line "Project: <name>" in a plan's text (a line of its own), or null.
export function projectLine(text){const m=/^[ \t]*Project:[ \t]*(\S[^\r\n]*?)[ \t]*$/mi.exec(String(text??''));return m?m[1].slice(0,60):null}
// The token allowance of a model and size (Fable borrows the Opus table), or null.
export const allowanceOf=(model,size)=>CAPS[model==='fable'?'opus':model]?.[size]??null;
const codeKey=c=>{const m=/^([A-Za-z])(\d+)([a-z]?)$/.exec(c||'');return m?[m[1].toUpperCase(),Number(m[2]),m[3]]:null};
const byCode=(a,b)=>{const x=codeKey(a.code),y=codeKey(b.code);if(x&&y)return x[0].localeCompare(y[0])||x[1]-y[1]||x[2].localeCompare(y[2])||a.at-b.at;if(x||y)return x?-1:1;return a.at-b.at};

// One plain sentence: what to press and what it costs. node is a step, an item, a project or the whole tree.
export function nextStep(node){
 if(!node)return 'Nothing needs you.';
 if(Array.isArray(node.projects)){const p=node.projects.find(x=>x.needsYou>0);return p?`${p.name}: ${nextStep(p)}`:node.projects.some(x=>x.steps.some(s=>s.status==='working'))?'Nothing to press. A run is working.':'Nothing needs you.'}
 if(Array.isArray(node.steps)){
  const s=node.steps.find(x=>x.needsYou),i=node.items.find(x=>x.needsYou);
  if(s)return `${s.code||cut(s.name,40)}: ${nextStep(s)}`;if(i)return nextStep(i);
  return node.steps.some(x=>x.status==='working')?'Nothing to press. A run is working.':node.allDone?'Nothing to do. Every step is done.':'Nothing needs you here.'}
 if(node.kind==='found')return 'Press Add to put this file on your list as a plan, or Hide. Neither costs tokens.';
 if(node.kind==='asset')return 'Open it in 3D, or hide it until it changes. Neither costs tokens.';
 if(node.kind==='filecheck')return 'Open Assets to read what the hub measured in the file. Nothing is wrong with the game; the file needs fixing or replacing first. Reading costs no tokens.';
 if(node.kind==='tokens')return 'Open Tokens to see the reading. A fresh reading is one small Haiku call that you type yourself.';
 if(node.kind)return 'Look at it when you have time. It costs no tokens.';
 const m=modelName(node.model),cap=node.capTokens,used=node.tokens||0,left=Number.isFinite(cap)?Math.max(0,cap-used):null;
 switch(node.status){
  case 'waiting':return node.model&&cap?`Read the plan and press Approve. After that, Start runs it on ${m} (allowed up to ${fmt(cap)} tokens).`:'Read the plan and press Approve. It has no Run block, so the hub cannot start it afterwards.';
  case 'approved':
   if(node.runsOff)return 'Runs are switched off. Stop the hub and start it again with: npm run hub -- --runs';
   if(node.canStart===false)return `Cannot start right now. ${cut((node.reasons||[]).join(' '),220)}`;
   return `Press Start to run it on ${m}. It may use up to ${fmt(cap)} tokens.${node.secondYes?' The hub asks for a second press because this model is expensive.':''}`;
  case 'working':return `Nothing to press. It is working on ${m}: ${fmt(used)} of ${fmt(cap)} tokens used so far. Stop ends it early.`;
  case 'question':
   if(node.runStatus==='confirming')return `Press the Yes button within 2 minutes to ${node.pendingKind==='more'?'continue':'run'} on ${m} (allowed up to ${fmt(cap)} tokens). The hub asks twice because this model is expensive.`;
   return `Read the question and send your answer. Waiting costs nothing; the run then carries on with the ${fmt(left)} tokens it has left.`;
  case 'finished':return `Read the result${node.flagged?`, look at the ${plural(node.flagged,'flagged file')} first`:''}, then press Close. It used ${fmt(used)} tokens; closing costs nothing.`;
  case 'done':return 'Nothing to do. This step is done.';
  case 'stopped':
   if(node.denied)return 'Nothing to press. A new revision of the plan puts it back on your list.';
   if(node.runStatus==='capped')return `Press Continue with more to give it extra tokens (it used ${fmt(used)} of ${fmt(cap)}), or Close to end it.`;
   return `Press Resume to carry on in the same session (${fmt(left)} tokens of its allowance are left), or Close to end it.`;
  case 'blocked':return 'Nothing can be pressed. Ask the master in Chat for a revision with a Run block, or build it in VS Code.';
  default:return 'Nothing needs you here.'}}

// How many things wait for you in a tree (or a project).
export const needsYou=tree=>!tree?0:Array.isArray(tree.projects)?tree.projects.reduce((n,p)=>n+needsYou(p),0):(tree.steps||[]).filter(s=>s.needsYou).length+(tree.items||[]).filter(i=>i.needsYou).length;

function stepOf(p,run,rd,enabled){
 const t=splitTitle(p.title),base={key:p.id,planId:p.id,runId:run?run.id:null,code:t.code,name:t.name,title:p.title,revision:p.revision,at:p.sentAt||0,reason:'',
  model:run?run.model:rd?rd.model:p.run?p.run.model:null,capTokens:run?run.capTokens:rd?rd.capTokens:p.run?allowanceOf(p.run.model,p.run.size):null,tokens:run?run.tokens||0:0};
 let status;
 if(p.status==='waiting')status='waiting';
 else if(p.status==='denied'){status='stopped';base.denied=true;base.reason='you closed this plan'+(p.note?`: ${cut(p.note,120)}`:'')}
 else if(run){status=RUN_STATUS[run.status]||'stopped';base.runStatus=run.status;base.at=run.updatedAt||base.at;
  if(status==='stopped')base.reason=STOP_REASON[run.status]||'it ended early';
  if(run.status==='confirming'){base.reason='press again to confirm (expensive model)';base.pendingKind=run.pending&&run.pending.kind==='more'?'more':'start'}
  if(run.status==='done')base.flagged=Array.isArray(run.flagged)?run.flagged.length:0}
 else if(p.runProblem||!p.run){status='blocked';base.reason=cut(p.runProblem||'The plan has no "## Run" section.',160)}
 else{status='approved';if(rd){base.canStart=!!rd.canStart;base.reasons=rd.reasons||[];base.secondYes=!!rd.secondYes}else if(!enabled)base.runsOff=true;else{base.canStart=false;base.reasons=['The hub has not listed it as ready yet.']}}
 const s=STATUS[status],step={...base,status,label:base.denied?(p.note?`Closed by you: ${cut(p.note,100)}`:'Closed by you'):status==='stopped'?`Stopped: ${base.reason}`:s.label,meaning:base.denied?'You closed this plan. A new revision of it would put it back on your list.':s.meaning,glyph:base.denied?'ok':s.glyph,needsYou:YOU.includes(status)&&!base.denied};
 step.next=nextStep(step);return step}

const KIND={asset:'asset',filecheck:'filecheck','tokens-critical':'tokens','tokens-high':'tokens'};
export function buildWork({plans=[],runs=[],ready=[],waiting=[],found=[],enabled=true}={}){
 const map=new Map(),proj=name=>{if(!map.has(name))map.set(name,{name,steps:[],items:[]});return map.get(name)};
 const ids=new Set(plans.map(p=>p.id));
 for(const p of plans){
  // the run that counts: the newest one of the plan's newest revision (a run cancelled before it began does not count, as in the ready list)
  const run=runs.filter(r=>r.planId===p.id&&r.revision===p.revision&&!(r.status==='closed'&&!(r.turn>0))).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))[0]||null;
  const rd=ready.find(r=>r.planId===p.id&&r.revision===p.revision)||null;
  proj(p.project||splitTitle(p.title).project||OTHER).steps.push(stepOf(p,run,rd,enabled))}
 // a run whose plan is gone still needs its buttons
 for(const r of runs)if(!ids.has(r.planId)&&r.status!=='closed'){const p={id:r.planId,title:r.planTitle,status:'approved',revision:r.revision,sentAt:r.createdAt||0};ids.add(r.planId);
  const s=stepOf(p,r,null,enabled);s.key=r.id;proj(splitTitle(p.title).project||OTHER).steps.push(s)}
 for(const f of found){const t=splitTitle(f.title),i={id:'found:'+f.hash,kind:'found',hash:f.hash,title:`Plan file never sent: ${cut(f.title,80)}`,detail:f.path,at:f.modifiedAt||0,severity:'info',actions:[],needsYou:true};
  i.next=nextStep(i);proj(t.project&&map.has(t.project)?t.project:OTHER).items.push(i)}
 // the other things that wait for you: asset attention and token warnings (plans, runs and found files are already above)
 for(const w of waiting){if(w.group==='plan'||w.group==='run'||w.id==='found')continue;
  const i={id:w.id,kind:KIND[w.group]||(String(w.id).startsWith('tokens:')?'tokens':'note'),title:w.title,detail:w.detail,at:w.at||0,severity:w.severity||'info',actions:w.actions||[],needsYou:true};i.next=nextStep(i);proj(OTHER).items.push(i)}
 const projects=[...map.values()].map(p=>{
  p.steps.sort(byCode);p.items.sort((a,b)=>a.at-b.at);
  const you=needsYou(p),done=p.steps.filter(s=>s.status==='done').length,total=p.steps.length,working=p.steps.some(s=>s.status==='working'),allDone=total>0&&done===total&&!p.items.length;
  const out={name:p.name,steps:p.steps,items:p.items,needsYou:you,done,total,allDone,glyph:you?'you':working?'run':allDone?'ok':'todo',at:Math.max(0,...p.steps.map(s=>s.at),...p.items.map(i=>i.at)),
   summary:you?`${you} need${you===1?'s':''} you`:working?'working':allDone?'done':total?`${done} of ${total} done`:plural(p.items.length,'item')};
  out.next=nextStep(out);return out});
 const rank=p=>p.needsYou?0:p.glyph==='run'?1:p.allDone?3:2;
 projects.sort((a,b)=>rank(a)-rank(b)||(a.name===OTHER)-(b.name===OTHER)||b.at-a.at||a.name.localeCompare(b.name));
 const tree={enabled:!!enabled,projects};tree.needsYou=needsYou(tree);tree.next=nextStep(tree);return tree}
// Find a step by plan id or run id: {project, step} or null.
export function findStep(tree,{plan=null,run=null}={}){
 for(const project of tree&&tree.projects||[])for(const step of project.steps)if((run&&step.runId===run)||(plan&&step.planId===plan))return {project,step};
 return null}
