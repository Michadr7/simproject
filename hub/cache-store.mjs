// Mikkadr Hub v2.5b: the cache observations. One line per reply measured against the one before it, in .hub/cache.jsonl: {at, gapMs, hit, modelSwitch, model, context}. Numbers only; no text is ever written here.
// replyCache() is what a chat turn or a run turn calls when it ends: it appends the observation (if there is a previous reply) and returns the record to keep on the chat or the run.
import fs from 'node:fs';
import path from 'node:path';
import {observe,lifetime} from './web/cache.js';

export const MAX_OBSERVATIONS=300;
const fileOf=root=>path.join(root,'.hub','cache.jsonl');
export function loadObservations(root){
 let raw;try{raw=fs.readFileSync(fileOf(root),'utf8')}catch{return []}
 const out=[];for(const l of raw.split('\n').slice(-MAX_OBSERVATIONS-1)){if(!l.trim())continue;try{const o=JSON.parse(l);if(o&&Number.isFinite(o.gapMs)&&typeof o.hit==='boolean')out.push(o)}catch{}}
 return out.slice(-MAX_OBSERVATIONS)}
export function appendObservation(root,o){
 const row={at:o.at,gapMs:o.gapMs,hit:!!o.hit,modelSwitch:!!o.modelSwitch,model:o.model?String(o.model).slice(0,40):null,context:o.context|0};
 fs.mkdirSync(path.dirname(fileOf(root)),{recursive:true});fs.appendFileSync(fileOf(root),JSON.stringify(row)+'\n')}
// The lifetime learned so far. Re-read only when the file changed (a poll must stay cheap).
const memo=new Map();
export function lifeOf(root){
 let key='none';try{const s=fs.statSync(fileOf(root));key=s.mtimeMs+':'+s.size}catch{}
 const m=memo.get(root);if(m&&m.key===key)return m.life;
 const life=lifetime(loadObservations(root));memo.set(root,{key,life});return life}
// prev: the cache record kept from the last reply (or null). out: the finished turn from runTurn ({first, last, window}). startedAt: when this turn began. Returns the record to keep.
export function replyCache(root,prev,model,out,startedAt,now){
 if(!out||!out.last)return prev||null;
 try{if(prev&&out.first){const o=observe(prev,{at:startedAt,model,input:out.first.input,cacheRead:out.first.cacheRead,cacheWrite:out.first.cacheWrite});if(o)appendObservation(root,{at:now,...o})}}catch{}
 const {input,output,cacheRead,cacheWrite}=out.last,ttlMs=Number.isFinite(out.last.ttlMs)?out.last.ttlMs:(prev&&Number.isFinite(prev.ttlMs)?prev.ttlMs:null);
 return {at:now,model:model?String(model).slice(0,40):null,input,output,cacheRead,cacheWrite,ttlMs,window:Number.isFinite(out.window)&&out.window>0?out.window:(prev&&prev.window)||null}}