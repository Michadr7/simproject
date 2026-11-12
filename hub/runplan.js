// P5 R1: the Run block, start rules

// Mikkadr Hub P5, R1: the Run block of a plan and the rules for starting a run. Pure: no file, no process, no model call.
// A plan may end with a "## Run" section. The hub reads ONLY four keys from it (model, why, size, needs), each against a fixed list; everything else in the plan is text for you to read and never becomes a flag.
//   ## Run
//   model: sonnet     # haiku | sonnet | opus (fable is never taken from a plan: you pick it on the Start card)
//   why: builds against tests
//   size: M           # S | M | L
//   needs: npm test, release
import {statusOf,latestRevision} from './plans.js';
import {canStart} from './watcher.js';

export const RUN_MODELS=['haiku','sonnet','opus'];
export const SIZES=['S','M','L'];
// Per-run token caps agreed 2026-11-11. A size missing from a model's list is not allowed for that model.
export const CAPS={haiku:{S:150000},sonnet:{S:600000,M:1500000,L:3000000},opus:{S:400000,M:1000000}};
// The only shell commands a run may be given. `needs` picks from these keys; the strings are what R2 will pass to the CLI.
export const NEEDS={test:'npm test',release:'npm run release -- --force',check:'node --check',index:'npm run index'};
const NEEDS_ALIASES={'npm test':'test','test':'test','release':'release','npm run release':'release','check':'check','node --check':'check','index':'index','npm run index':'index'};
export const MAX_WHY=200;
// Percent of the weekly limit per million tokens, used until learnRate has a real figure. A guess, pessimistic on purpose; replace it when `learnRate` returns a rate.
export const PLACEHOLDER_RATE=3;

const stripComment=s=>s.replace(/\s+#.*$/,'').trim();
const cleanWhy=s=>s.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,MAX_WHY);

// Find the "## Run" section: from the heading to the next heading of the same or higher level. Returns the lines, or null.
function runSection(text){
 const lines=String(text).replace(/\r\n/g,'\n').split('\n');let start=-1,level=0;
 for(let i=0;i<lines.length;i++){const m=/^(#{1,6})\s+run\s*$/i.exec(lines[i].trim());if(m){start=i;level=m[1].length;break}}
 if(start<0)return null;
 const out=[];for(let i=start+1;i<lines.length;i++){const h=/^(#{1,6})\s/.exec(lines[i]);if(h&&h[1].length<=level)break;out.push(lines[i])}
 return out}

// parseRunBlock: plan text in, {ok, run:{model,size,why,needs}, fableAsked, errors} out. Unknown keys are ignored; a bad value in a known key is an error.
export function parseRunBlock(text){
 const section=runSection(text),errors=[];
 if(!section)return {ok:false,run:null,fableAsked:false,errors:['The plan has no "## Run" section.']};
 const seen={};
 for(const raw of section){const line=raw.replace(/^[\s>*-]+/,'').replace(/^```.*$/,'');const m=/^(model|why|size|needs)\s*:\s*(.*)$/i.exec(line.trim());if(!m)continue;const k=m[1].toLowerCase();if(!(k in seen))seen[k]=m[2]}
 let model=null,fableAsked=false;
 if(!('model' in seen))errors.push('Run block: model is missing.');
 else{const v=stripComment(seen.model).toLowerCase();
  if(v==='fable')fableAsked=true; // never accepted from a plan
  else if(RUN_MODELS.includes(v))model=v;
  else errors.push(`Run block: model "${v.slice(0,20)}" is not one of ${RUN_MODELS.join(', ')}.`)}
 let size=null;
 if(!('size' in seen))errors.push('Run block: size is missing.');
 else{const v=stripComment(seen.size).toUpperCase();if(SIZES.includes(v))size=v;else errors.push(`Run block: size "${v.slice(0,10)}" is not one of ${SIZES.join(', ')}.`)}
 if(model&&size&&!CAPS[model][size])errors.push(`Run block: size ${size} is not allowed for ${model} (allowed: ${Object.keys(CAPS[model]).join(', ')}).`);
 const needs=[];
 if('needs' in seen){for(const part of stripComment(seen.needs).split(',')){const p=part.trim().toLowerCase();if(!p)continue;const key=NEEDS_ALIASES[p];if(!key){errors.push(`Run block: needs "${p.slice(0,30)}" is not one of ${Object.keys(NEEDS).join(', ')}.`);continue}if(!needs.includes(key))needs.push(key)}}
 const why='why' in seen?cleanWhy(stripComment(seen.why)):'';
 return {ok:!errors.length&&!fableAsked,run:{model,size,why,needs},fableAsked,errors}}

// capTokens: the run's token cap, or null when the model and size do not go together.
export const capTokens=(model,size)=>CAPS[model]?.[size]??null;

// startCheck: every gate the hub applies before a run begins, in one place. Inputs:
//   plan: the stored plan; picked: the model on the Start card (may be 'fable', only ever the user's own pick); secondYes: true once the second button was pressed;
//   state: the gauges (watcher `evaluate`); rate: percent per million tokens from `learnRate`, or null; activeRun: true while a run or turn is going.
// Returns {ok, code, reasons, model, capTokens, estimatePct, needs, needsSecondYes, needsProbe}. code: 'ok' | 'refused' | 'second-yes'.
export function startCheck({plan,picked,secondYes=false,state,rate=null,activeRun=false}){
 const reasons=[],fail=(r)=>reasons.push(r);
 const s=statusOf(plan),last=latestRevision(plan),answer=[...plan.answers].reverse().find(a=>a.revision===last.n)||null;
 if(!s.buildable)fail(s.status==='approved'?'The newest revision has no approval.':`The plan is ${s.status}, not approved.`);
 else if(answer&&answer.at<last.at)fail('The approval is older than the revision it names.');
 if(activeRun)fail('A run or a chat turn is already active.');
 const parsed=parseRunBlock(last.text);
 if(!parsed.run)fail(parsed.errors[0]);
 else for(const e of parsed.errors)fail(e);
 let model=null;
 if(picked==='fable')model='fable'; // Fable only on the user's own pick, whatever the plan says
 else if(parsed.fableAsked)fail('The plan asks for Fable. Fable runs only when you pick it on the Start card.');
 else if(!RUN_MODELS.includes(picked))fail('The Start card named a model the hub does not know.');
 else if(parsed.run&&parsed.run.model&&picked!==parsed.run.model)fail(`The Start card says ${picked} but the approved plan says ${parsed.run.model}.`);
 else model=picked;
 const size=parsed.run?.size||null;
 // Fable has no cap table: it borrows the Opus caps.
 const cap=model&&size?capTokens(model==='fable'?'opus':model,size):null;
 if(model&&size&&cap==null&&!parsed.errors.length)fail(`Size ${size} is not allowed for ${model}.`);
 let estimatePct=null,gauge={ok:true,secondYes:false,needsProbe:false,reasons:[]};
 if(cap!=null&&state){estimatePct=Math.round(cap/1e6*(rate??PLACEHOLDER_RATE)*10)/10;
  gauge=canStart(state,{estimatePct,model});if(!gauge.ok)for(const r of gauge.reasons)fail(r);
  if(!state.weekly.known&&gauge.ok)fail('There is no current weekly reading. Take one first (npm run watcher -- --probe).')}
 else if(cap!=null)fail('There is no gauge reading to check the cap against.');
 const needsSecondYes=model==='opus'||(model==='fable'&&gauge.secondYes);
 if(!reasons.length&&needsSecondYes&&!secondYes)return {ok:false,code:'second-yes',reasons:[`${model==='opus'?'Opus':'Fable'} needs a second yes.`],model,capTokens:cap,estimatePct,needs:parsed.run?.needs||[],needsSecondYes:true,needsProbe:gauge.needsProbe};
 return {ok:!reasons.length,code:reasons.length?'refused':'ok',reasons,model,capTokens:cap,estimatePct,needs:parsed.run?.needs||[],needsSecondYes,needsProbe:gauge.needsProbe}}

// Hub v2 V2, Quick fix: may this plan get the one "Approve and start" button? Only a plan the master filed, still waiting for its answer (so never a revision you denied),
// whose newest revision has a clean Run block saying haiku and S. Returns {model, size, capTokens, revision} or null. The press itself still goes through startCheck.
export function quickFix(plan){
 if(!plan||plan.from!=='master'||plan.status!=='waiting')return null;
 const last=latestRevision(plan);if(plan.answers.some(a=>a.revision===last.n))return null;
 const p=parseRunBlock(last.text);
 if(!p.ok||p.run.model!=='haiku'||p.run.size!=='S')return null;
 return {model:'haiku',size:'S',capTokens:capTokens('haiku','S'),revision:last.n}}

// What `npm run plan -- --status` prints about the Run block (one line, or why there is none).
export function describeRun(text){
 const p=parseRunBlock(text);
 if(!p.run)return p.errors[0];
 const bits=[`model ${p.fableAsked?'fable (ask refused: pick it yourself)':p.run.model||'?'}`,`size ${p.run.size||'?'}`];
 const cap=p.run.model&&p.run.size?capTokens(p.run.model,p.run.size):null;
 if(cap)bits.push(`cap ${cap.toLocaleString('en-US')} tokens`);
 bits.push(`needs ${p.run.needs.length?p.run.needs.map(k=>NEEDS[k]).join(', '):'nothing'}`);
 if(p.run.why)bits.push(`why: ${p.run.why}`);
 return 'Run block: '+bits.join(' · ')+(p.errors.length?`\nProblems: ${p.errors.join(' ')}`:'')}
