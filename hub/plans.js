// P4 S1: plans as pure data

// Mikkadr Hub P4, S1: plans as pure data. A plan is {id, title, from, source, status waiting|approved|denied, revisions [{n, at, hash, text}], answers [{revision, at, verdict, note}]}.
// Everything here is a pure function (plan in, new plan or error out); hub/plans-store.mjs does the files.
import {createHash} from 'node:crypto';

export const ID_PATTERN=/^[a-z0-9][a-z0-9-]{0,79}$/;
export const MAX_TEXT=200000,MAX_NOTE=2000,MAX_TITLE=120;
export const hashText=t=>createHash('sha256').update(String(t).replace(/\r\n/g,'\n')).digest('hex').slice(0,16);
export const slugify=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50)||'plan';
export const dateOf=ms=>new Date(ms).toISOString().slice(0,10);
export const planId=(ms,title)=>`${dateOf(ms)}-${slugify(title)}`;
export const titleOf=(text,fallback)=>{const m=/^#{1,3}\s+(.+?)\s*#*\s*$/m.exec(text);return (m?m[1]:fallback||'Plan').trim().slice(0,MAX_TITLE)};
export const latestRevision=plan=>plan.revisions[plan.revisions.length-1];

// The same source file from the same sender is one plan: find it among the stored plans.
export const findBySource=(plans,source,from)=>plans.find(p=>p.source===source&&p.from===from)||null;

// Send text as a plan. existing = the stored plan with this source and sender, or null. Returns {plan, action:'created'|'revision'|'noop'} or {error}.
// A new revision puts the plan back to waiting, even after an answer; identical text while waiting changes nothing.
export function submitPlan(existing,{source,title,from,text,now,id}){
 const body=String(text??'').replace(/\r\n/g,'\n');
 if(!body.trim())return {error:'The plan is empty.'};
 if(body.length>MAX_TEXT)return {error:`The plan is over ${MAX_TEXT} characters.`};
 const hash=hashText(body);
 if(!existing){
  const t=String(title||titleOf(body,source)).slice(0,MAX_TITLE),pid=id||planId(now,t);
  if(!ID_PATTERN.test(pid))return {error:'The plan id is not valid.'};
  return {action:'created',plan:{id:pid,title:t,from:String(from||'claude').slice(0,40),source:String(source||''),status:'waiting',revisions:[{n:1,at:now,hash,text:body}],answers:[]}}}
 const last=latestRevision(existing);
 if(last.hash===hash&&existing.status==='waiting')return {action:'noop',plan:existing};
 if(last.hash===hash)return {error:'This text is the revision already answered; edit the plan before sending it again.'};
 return {action:'revision',plan:{...existing,title:title?String(title).slice(0,MAX_TITLE):existing.title,status:'waiting',revisions:[...existing.revisions,{n:last.n+1,at:now,hash,text:body}]}}}

// Answer a plan. The answer names the revision that was read; if a newer one exists the answer is refused with code 409. Deny needs a reason.
export function answerPlan(plan,{verdict,note,revision,now}){
 if(verdict!=='approved'&&verdict!=='denied')return {error:'The verdict must be approved or denied.',code:400};
 const text=String(note??'').trim();
 if(verdict==='denied'&&!text)return {error:'Deny needs a reason.',code:400};
 if(text.length>MAX_NOTE)return {error:`The note is over ${MAX_NOTE} characters.`,code:400};
 const last=latestRevision(plan);
 if(!Number.isInteger(revision)||revision<1||revision>last.n)return {error:'The revision is not one of this plan\'s.',code:400};
 if(revision!==last.n)return {error:`A newer revision (${last.n}) exists; read it first.`,code:409};
 // a plan that is approved but not built yet may still be closed without building it: that is a denial, and it needs a reason
 if(plan.status!=='waiting'&&!(plan.status==='approved'&&verdict==='denied'))return {error:`This plan is already ${plan.status}.`,code:409};
 return {plan:{...plan,status:verdict,answers:[...plan.answers,{revision,at:now,verdict,note:text}]}}}

// What `--status` reports: the verdict for the newest revision, with the note and revision number.
export function statusOf(plan){
 const last=latestRevision(plan),a=[...plan.answers].reverse().find(x=>x.revision===last.n)||null;
 return {id:plan.id,title:plan.title,status:plan.status,revision:last.n,verdict:a?a.verdict:null,note:a?a.note:'',buildable:plan.status==='approved'&&!!a}}

// Plan files in the repo that were never sent: files = [{path, hash, ...}] from the scan; sources = the `source` of every stored plan; ignored = hashes the user hid.
// A file already sent (any sender) is not "found"; a hidden file shows again as soon as its text, and so its hash, changes.
export const HASH_PATTERN=/^[a-f0-9]{16}$/;
export const isPlanFileName=name=>/\.md$/.test(name)&&(name.includes('plan')||name.startsWith('PLAN'));
export const unsentOf=(files,sources,ignored)=>{const sent=new Set(sources),hidden=new Set(ignored);return files.filter(f=>!sent.has(f.path)&&!hidden.has(f.hash))};

// Normalise a stored plan so a hand-edited file cannot crash the readers; null if it is unusable.
export function normalizePlan(raw){
 if(!raw||typeof raw!=='object'||!ID_PATTERN.test(String(raw.id||''))||!Array.isArray(raw.revisions)||!raw.revisions.length)return null;
 const revisions=raw.revisions.filter(r=>r&&Number.isInteger(r.n)&&typeof r.text==='string').map(r=>({n:r.n,at:Number(r.at)||0,hash:String(r.hash||hashText(r.text)),text:r.text}));
 if(!revisions.length)return null;
 const answers=(Array.isArray(raw.answers)?raw.answers:[]).filter(a=>a&&(a.verdict==='approved'||a.verdict==='denied')).map(a=>({revision:Number(a.revision)||0,at:Number(a.at)||0,verdict:a.verdict,note:String(a.note||'')}));
 const status=['waiting','approved','denied'].includes(raw.status)?raw.status:'waiting';
 return {id:raw.id,title:String(raw.title||raw.id).slice(0,MAX_TITLE),from:String(raw.from||'claude'),source:String(raw.source||''),status,revisions,answers}}
