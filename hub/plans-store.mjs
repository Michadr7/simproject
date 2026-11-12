// P4 S1: the plans folder

// Mikkadr Hub P4, S1: the plans folder. plans/<id>.json, written to a temp file and then renamed so a crash never leaves half a plan.
import fs from 'node:fs';
import path from 'node:path';
import {ID_PATTERN,MAX_TEXT,HASH_PATTERN,hashText,isPlanFileName,unsentOf,normalizePlan,findBySource,submitPlan,planId} from './plans.js';

const NOT_PLANS=new Set(['ignored.json']);
export function writeAtomic(file,text){const tmp=`${file}.${process.pid}.tmp`;try{fs.writeFileSync(tmp,text);fs.renameSync(tmp,file)}catch(e){try{fs.unlinkSync(tmp)}catch{}throw e}} // a failed write leaves no .tmp file behind
export function listPlans(dir){
 if(!fs.existsSync(dir))return [];
 const out=[];
 for(const f of fs.readdirSync(dir)){
  if(!f.endsWith('.json')||NOT_PLANS.has(f))continue;
  try{const p=normalizePlan(JSON.parse(fs.readFileSync(path.join(dir,f),'utf8').replace(/^﻿/,'')));if(p&&`${p.id}.json`===f)out.push(p)}catch{}}
 return out.sort((a,b)=>a.id<b.id?-1:1)}
export function readPlan(dir,id){
 if(!ID_PATTERN.test(String(id)))return null;
 const f=path.join(dir,`${id}.json`);
 if(!fs.existsSync(f))return null;
 try{return normalizePlan(JSON.parse(fs.readFileSync(f,'utf8').replace(/^﻿/,'')))}catch{return null}}
export function savePlan(dir,plan){
 if(!ID_PATTERN.test(plan.id))throw new Error('The plan id is not valid.');
 fs.mkdirSync(dir,{recursive:true});writeAtomic(path.join(dir,`${plan.id}.json`),JSON.stringify(plan,null,1)+'\n')}
// Send text to the store: finds the plan with this source and sender, makes it or its next revision, saves it. Returns {plan, action} or {error}.
export function sendPlan(dir,{source,title,from,text,now=Date.now()}){
 const plans=listPlans(dir),sender=String(from||'claude').slice(0,40),existing=findBySource(plans,source,sender);
 let id;
 if(!existing){const base=planId(now,title||source);id=base;for(let n=2;plans.some(p=>p.id===id);n++)id=`${base}-${n}`}
 const r=submitPlan(existing,{source,title,from:sender,text,now,id});
 if(r.error)return r;
 if(r.action!=='noop')savePlan(dir,r.plan);
 return r}
// Plan files in the repo (`*plan*.md`, `PLAN*.md`): [{path, text, hash, modifiedAt}], paths relative to root with forward slashes. Skips folders starting with a dot, node_modules, plans, assets-src and dist/releases.
const SKIP_NAMES=new Set(['node_modules','plans']),SKIP_PATHS=new Set(['assets-src','dist/releases']);
export function scanPlanFiles(root,{maxFiles=300,maxDepth=8}={}){
 const out=[];
 const walk=(abs,rel,depth)=>{
  if(out.length>=maxFiles||depth>maxDepth)return;
  let entries;try{entries=fs.readdirSync(abs,{withFileTypes:true})}catch{return}
  for(const e of entries){
   const r=rel?`${rel}/${e.name}`:e.name;
   if(e.isDirectory()){if(e.name.startsWith('.')||SKIP_NAMES.has(e.name)||SKIP_PATHS.has(r))continue;walk(path.join(abs,e.name),r,depth+1)}
   else if(out.length>=maxFiles)return;
   else if(e.isFile()&&isPlanFileName(e.name)){
    try{const st=fs.statSync(path.join(abs,e.name));if(st.size>MAX_TEXT)continue;const text=fs.readFileSync(path.join(abs,e.name),'utf8').replace(/^﻿/,'');if(!text.trim())continue;out.push({path:r,text,hash:hashText(text),modifiedAt:Math.round(st.mtimeMs)})}catch{}}}};
 walk(root,'',0);
 return out.sort((a,b)=>a.path<b.path?-1:1)}
// Hidden plan files, kept as a list of text hashes in plans/ignored.json.
export function readIgnored(dir){try{const a=JSON.parse(fs.readFileSync(path.join(dir,'ignored.json'),'utf8').replace(/^﻿/,''));return Array.isArray(a)?a.filter(h=>HASH_PATTERN.test(String(h))):[]}catch{return []}}
export function addIgnored(dir,hash){if(!HASH_PATTERN.test(hash))throw new Error('Not a plan hash.');const list=readIgnored(dir);if(list.includes(hash))return list;list.push(hash);fs.mkdirSync(dir,{recursive:true});writeAtomic(path.join(dir,'ignored.json'),JSON.stringify(list.slice(-500),null,1)+'\n');return list}
// The unsent plan files right now (the server's own scan, never a path from the page).
export const foundPlans=(root,dir)=>unsentOf(scanPlanFiles(root),listPlans(dir).map(p=>p.source),readIgnored(dir));

// Find a plan by id, or by the source file it came from.
export const findPlan=(dir,key)=>{const plans=listPlans(dir);return plans.find(p=>p.id===key)||plans.find(p=>p.source===key)||null};
