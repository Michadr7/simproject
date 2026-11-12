// Hub v2 V4: records store (register + log)

// Applies asset records to assets-register.json and keeps the log in .hub/records.jsonl (one JSON line per record, and one per undo). This is the only code that writes the register.
// The register is written to a temporary file and renamed, with no BOM and in the layout it already has (formatRegister); if the file on disk is not in that layout the hub refuses to rewrite it.
// The form, the routes and the master's RECORD: lines all come through add / stage / applyMaster. Undo is refused (409) when the row changed after the record or the record was already undone.
// No model call, no process. `load` (the dist modules, async) and `originals` (names under assets-src, never read) are injected so tests need neither.
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {writeAtomic} from './plans-store.mjs';
import {unregisteredOriginals,isCredited,HAND_STAGES} from './assets.js';
import {makeChange,applyRecord,undoRecord,checkChange,formatRegister,recordLabel,handRows,closestRows,sameRow,RECORD_ID} from './records.js';

const err=(error,code=409,extra={})=>({error,code,...extra});
export const SUMMARY_MS=60000,MAX_LOG_BYTES=1048576,SHOW_RECORDS=10,SCAN_RECORDS=50,MAX_ROWS_SHOWN=300,MAX_NEW_FILES=30,MAX_SHIPPED=400;
const LAYOUT_WHY='assets-register.json is not laid out the way the hub writes it (one line per asset), and the hub will not rewrite the whole file. Put the layout back, or ask in VS Code.';

export function createRecords({root,now=Date.now,load=null,originals=null}){
 const regFile=path.join(root,'assets-register.json'),logFile=path.join(root,'.hub','records.jsonl');
 const token=randomBytes(16).toString('hex');
 const checkToken=t=>{if(typeof t!=='string'||t.length!==token.length)return false;try{return timingSafeEqual(Buffer.from(t),Buffer.from(token))}catch{return false}};
 const loadFn=load||(async()=>(await import('./assets-load.mjs')).loadAssets(root));
 const originalsFn=originals||(async()=>(await import('./assets-load.mjs')).listOriginals(root));
 let heavy=null,loading=null; // {at, shipped, originals}: the slow part (dist modules, folder names), kept for a few seconds

 function readRegister(){
  let text;try{text=fs.readFileSync(regFile,'utf8').replace(/^﻿/,'')}catch{return err('The asset register could not be read.',500)}
  let register;try{register=JSON.parse(text)}catch{return err('The asset register is not valid JSON.',500)}
  if(!register||typeof register!=='object'||Array.isArray(register)||!Array.isArray(register.assets))return err('The asset register has no assets list.',500);
  return {register,text}}
 // Review fix: 4 random bytes, and an id the log already holds is never reused (a clash would make Undo hit the wrong record)
 const idMaker=()=>{const used=new Set(readLog().records.map(c=>c.id));let id;do{id=`rec-${Math.floor(now()/1000).toString(36)}-${randomBytes(4).toString('hex')}`}while(used.has(id));return id};

 // the log: records and undo marks, oldest first; the last MAX_LOG_BYTES only, and a line that is not a valid record is skipped
 function readLog(){
  let text='';try{const st=fs.statSync(logFile);const fd=fs.openSync(logFile,'r');try{const len=Math.min(st.size,MAX_LOG_BYTES),buf=Buffer.alloc(len);fs.readSync(fd,buf,0,len,st.size-len);text=buf.toString('utf8');if(st.size>len)text=text.slice(text.indexOf('\n')+1)}finally{fs.closeSync(fd)}}catch{return {records:[],undone:new Set()}}
  const records=[],undone=new Set();
  for(const line of text.split('\n')){
   if(!line.trim())continue;let j;try{j=JSON.parse(line)}catch{continue}
   if(j&&typeof j==='object'&&typeof j.undo==='string'&&RECORD_ID.test(j.undo))undone.add(j.undo);
   else if(checkChange(j))records.push(j)}
  return {records,undone}}
 const appendLog=obj=>{fs.mkdirSync(path.dirname(logFile),{recursive:true});fs.appendFileSync(logFile,JSON.stringify(obj)+'\n')};

 // one change, start to finish (all synchronous, so two calls never interleave)
 function change(op,input,by){
  const r=readRegister();if(r.error)return r;
  if(formatRegister(r.register)!==r.text)return err(LAYOUT_WHY,409);
  const made=makeChange({op,input,register:r.register,by,at:now(),id:idMaker(),reserved:heavy?heavy.shipped.map(s=>s.id):[],originals:heavy?heavy.originals:null});if(made.error)return made;
  const applied=applyRecord(r.register,made.change);if(applied.error)return applied;
  try{writeAtomic(regFile,formatRegister(applied.register))}catch{return err('The register could not be saved.',500)}
  try{appendLog(made.change)}catch{return err('The change was made but could not be logged, so it cannot be undone here.',500)}
  return {change:{id:made.change.id,op,by,label:recordLabel(made.change)},row:made.change.after}}
 const add=(input,by='you')=>change('asset-add',input,by);
 const stage=(input,by='you')=>change('asset-stage',input,by);
 // Hub v2 V4b: attach a file from assets-src/ to a row. The file must be in the folder's own list, which the page's press re-reads first (names only; a file is never opened).
 // The master's RECORD: line (applyMaster) uses the list kept for the last minute, so it can only name a file the page already showed.
 async function attach(input,by='you'){
  try{const files=await originalsFn();heavy=heavy?{...heavy,originals:files}:{at:0,shipped:[],originals:files,loadError:null}}catch{}
  return change('asset-file',input,by)}

 function undo(id,by='you'){
  if(typeof id!=='string'||!RECORD_ID.test(id))return err('id must be a record id',400);
  const {records,undone}=readLog(),rec=records.find(c=>c.id===id);
  if(!rec)return err('No such record (or it is too old to find).',404);
  if(undone.has(id))return err('That record was already undone.',409);
  // Review fix: undo newest first. A later change to the same row that is still standing must be undone before this one.
  if(records.slice(records.indexOf(rec)+1).some(c=>c.after.id===rec.after.id&&!undone.has(c.id)))return err('A later change to that row is still in place. Undo that one first.',409);
  const r=readRegister();if(r.error)return r;
  if(formatRegister(r.register)!==r.text)return err(LAYOUT_WHY,409);
  const u=undoRecord(r.register,rec);if(u.error)return u;
  try{writeAtomic(regFile,formatRegister(u.register))}catch{return err('The register could not be saved.',500)}
  try{appendLog({undo:id,at:now(),by})}catch{return err('Undone, but the log could not be written.',500)}
  return {undone:{id,label:recordLabel(rec)}}}

 // the master's RECORD: lines, already parsed: [{op,input}]. Each is applied on its own; the result list has one entry per line.
 function applyMaster(list){
  return (Array.isArray(list)?list:[]).map(x=>{const out=change(x.op,x.input,'master');return out.error?{ok:false,error:out.error}:{ok:true,id:out.change.id,op:x.op,label:out.change.label,name:out.row.name,stage:out.row.stage}})}

 async function heavyPart(){
  if(heavy&&now()-heavy.at<SUMMARY_MS)return heavy;
  if(loading)return loading;
  loading=(async()=>{
   let shipped=[],loadError=null,files=[];
   try{const built=await loadFn();shipped=built.assets.filter(a=>a.origin==='module').map(a=>({id:a.id,name:a.name,stage:a.stage,credited:isCredited(a)}))}catch(e){loadError=String(e&&e.message||e).slice(0,160)}
   try{files=await originalsFn()}catch{}
   heavy={at:now(),shipped,originals:files,loadError};return heavy})();
  try{return await loading}finally{loading=null}}

 const counts=(register,shipped)=>{
  const c={wanted:0,received:0,staged:0,converted:0,'in-game':0,credited:0,retired:0};
  for(const r of handRows(register))c[r.stage]++;
  for(const s of shipped){if(s.stage==='converted'||s.stage==='in-game')c[s.stage]++;if(s.credited)c.credited++}
  return c};
 const newFilesOf=(register,files)=>{
  const un=unregisteredOriginals(files,register),pool=handRows(register).filter(r=>HAND_STAGES.includes(r.stage));
  return {total:un.length,items:un.slice(0,MAX_NEW_FILES).map(p=>({path:p,name:p.slice(p.lastIndexOf('/')+1),candidates:closestRows(p,pool,3).map(r=>({id:r.id,name:r.name,stage:r.stage}))}))}};

 // GET /api/assets/summary: counts per stage, rows, the new files in assets-src/ no row accounts for, and the last 10 records (with whether each can still be undone)
 async function summary(){
  const h=await heavyPart(); // the register and the log are read after the wait, so Undo buttons are never older than the rows
  const r=readRegister();if(r.error)return r;
  const {records,undone}=readLog(),live=new Set(); // live: rows with a newer change still standing (newest first), whose older records cannot be undone yet
  const byRow=new Map(),shown=[];
  for(const rec of records.slice(-SCAN_RECORDS).reverse()){
   const cur=r.register.assets.find(x=>x&&x.id===rec.after.id);
   const canUndo=!undone.has(rec.id)&&!live.has(rec.after.id)&&!!cur&&sameRow(cur,rec.after);
   if(!undone.has(rec.id))live.add(rec.after.id);
   if(canUndo&&!byRow.has(rec.after.id))byRow.set(rec.after.id,rec.id);
   if(shown.length<SHOW_RECORDS)shown.push({id:rec.id,at:rec.at,by:rec.by,op:rec.op,label:recordLabel(rec),undone:undone.has(rec.id),canUndo})}
  const rows=handRows(r.register).slice(0,MAX_ROWS_SHOWN).map(x=>({id:x.id,name:x.name,kind:x.kind,stage:x.stage,source:typeof x.source==='string'?x.source.slice(0,300):'',licence:x.licence||'',note:typeof x.notes==='string'?x.notes.slice(0,200):'',files:Array.isArray(x.files)?x.files.filter(f=>typeof f==='string').slice(0,5).map(f=>f.slice(0,300)):[],undo:byRow.get(x.id)||null}));
  return {stages:counts(r.register,h.shipped),rows,shipped:h.shipped.slice(0,MAX_SHIPPED),shippedTotal:h.shipped.length,newFiles:newFilesOf(r.register,h.originals),records:shown,loadError:h.loadError}}

 // a quick look for the master's status block: never waits. The slow part is the last one read (or started now); the hand-set counts are always fresh.
 function brief(){
  const r=readRegister();if(r.error)return null;
  heavyPart().catch(()=>{});
  const shipped=heavy?heavy.shipped:[],nf=newFilesOf(r.register,heavy?heavy.originals:[]);
  return {counts:counts(r.register,shipped),known:!!heavy&&heavy.at>0,newFiles:nf.total,newNames:nf.items.slice(0,5).map(i=>i.path.slice(0,80)),rows:handRows(r.register).map(x=>({id:x.id,name:x.name,stage:x.stage}))}}

 return {token,checkToken,add,stage,attach,undo,applyMaster,summary,brief}}
