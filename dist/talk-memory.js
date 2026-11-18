// talk-memory.js: what each person remembers of your talks (npcs[id].mem, progress.talk) and the old-save migration; notes/conversation-design.md 2f (C3).
// Pure: no DOM, no three.js, no globals, no clock, no chance. Every function returns NEW frozen data and never throws on junk.
// mem = {last:[lineKey] (newest last, 6 at most), seen:{nodeId:count} (32 keys at most), beats:[beat] (16 at most), lastMin:int (absolute game minute of the last talk, -1 = never)}.
// progress.talk = {v:1, people:{personId:{metDay, lastDay, last, seen, beats, lastMin}}} for people outside the roster (48 at most; the oldest lastDay goes first). Optional: absent while empty.
import {ROSTER_ORDER,byId,HUNTING_TOPICS} from './npc-roster.js';
export const MEM_LAST=6,MEM_SEEN=32,MEM_BEATS=16,TALK_PEOPLE=48,TALK_V=1;
const KEY=/^[A-Za-z0-9][A-Za-z0-9_.:#\/-]{0,63}$/,BAD=new Set(['__proto__','constructor','prototype']);
export const validKey=k=>typeof k==='string'&&KEY.test(k)&&!BAD.has(k);
const int=(v,lo,hi,d)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.floor(v))):d;
const freeze=(last,seen,beats,lastMin)=>Object.freeze({last:Object.freeze(last),seen:Object.freeze(seen),beats:Object.freeze(beats),lastMin});
export const EMPTY_MEM=freeze([],{},[],-1);
export const isEmptyMem=m=>!m||(!m.last?.length&&!m.beats?.length&&!Object.keys(m.seen||{}).length&&!(m.lastMin>=0));
// keep the n keys with the highest counts, in their original order (ties: the earlier key stays)
function capSeen(entries,n){
 if(entries.length<=n)return Object.fromEntries(entries);
 const keep=new Set(entries.map((e,i)=>[e,i]).sort((a,b)=>b[0][1]-a[0][1]||a[1]-b[1]).slice(0,n).map(x=>x[1]));
 return Object.fromEntries(entries.filter((_,i)=>keep.has(i)));
}
export function normalizeTalkMem(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return EMPTY_MEM;
 const last=[];if(Array.isArray(raw.last))for(const k of raw.last){if(!validKey(k))continue;const i=last.indexOf(k);if(i>=0)last.splice(i,1);last.push(k)}
 const seen=[];if(raw.seen&&typeof raw.seen==='object'&&!Array.isArray(raw.seen))for(const k of Object.keys(raw.seen)){if(!validKey(k))continue;const c=int(raw.seen[k],0,1e6,0);if(c>0)seen.push([k,c])}
 const beats=[];if(Array.isArray(raw.beats))for(const b of raw.beats){if(beats.length>=MEM_BEATS)break;if(validKey(b)&&!beats.includes(b))beats.push(b)}
 return freeze(last.slice(-MEM_LAST),capSeen(seen,MEM_SEEN),beats,int(raw.lastMin,-1,1e12,-1));
}
const M=m=>m&&Object.isFrozen(m)&&Array.isArray(m.last)?m:normalizeTalkMem(m);
// A line was said (its lineKey): it moves to the newest end; only the last MEM_LAST are kept.
export function recordLine(mem,key){const m=M(mem);if(!validKey(key))return m;const last=m.last.filter(k=>k!==key);last.push(key);return freeze(last.slice(-MEM_LAST),{...m.seen},[...m.beats],m.lastMin)}
// A node was visited: its count goes up. A new node in a full map pushes out the least-seen one (ties: the oldest key).
export function recordNode(mem,nodeId){
 const m=M(mem);if(!validKey(nodeId))return m;
 const seen=Object.entries(m.seen),i=seen.findIndex(e=>e[0]===nodeId);
 if(i>=0)seen[i]=[nodeId,Math.min(1e6,seen[i][1]+1)];
 else{if(seen.length>=MEM_SEEN){let lo=0;for(let j=1;j<seen.length;j++)if(seen[j][1]<seen[lo][1])lo=j;seen.splice(lo,1)}seen.push([nodeId,1])}
 return freeze([...m.last],Object.fromEntries(seen),[...m.beats],m.lastMin);
}
// A story beat was set. Beats are permanent: a full list (MEM_BEATS) keeps its beats and ignores the new one (writers keep a person under 16 beats; the validator can check).
export function recordBeat(mem,beat){const m=M(mem);if(!validKey(beat)||m.beats.includes(beat)||m.beats.length>=MEM_BEATS)return m;return freeze([...m.last],{...m.seen},[...m.beats,beat],m.lastMin)}
export function stampMem(mem,absMinute){const m=M(mem);const t=int(absMinute,-1,1e12,-1);return t===m.lastMin?m:freeze([...m.last],{...m.seen},[...m.beats],t)}
export const hasBeat=(mem,beat)=>!!mem&&Array.isArray(mem.beats)&&mem.beats.includes(beat);
export const seenCount=(mem,nodeId)=>validKey(nodeId)&&mem?.seen&&Object.prototype.hasOwnProperty.call(mem.seen,nodeId)?int(mem.seen[nodeId],0,1e6,0):0;
// An npc record with this mem (or without the field when the mem is empty, so saves stay small). -> new npc
export function withMem(npc,mem){const m=M(mem),{mem:_drop,...rest}=npc||{};return isEmptyMem(m)?rest:{...rest,mem:m}}

// ---- progress.talk: people outside the roster
const person=(metDay,lastDay,mem)=>Object.freeze({metDay,lastDay,last:mem.last,seen:mem.seen,beats:mem.beats,lastMin:mem.lastMin});
const EMPTY_TALK=Object.freeze({v:TALK_V,people:Object.freeze({})});
function capPeople(entries,keepId){
 if(entries.length<=TALK_PEOPLE)return entries;
 const order=entries.map((e,i)=>[e,i]).sort((a,b)=>(b[0][0]===keepId)-(a[0][0]===keepId)||b[0][1].lastDay-a[0][1].lastDay||a[1]-b[1]).slice(0,TALK_PEOPLE).map(x=>x[1]);
 const keep=new Set(order);return entries.filter((_,i)=>keep.has(i));
}
export function normalizeTalkPeople(raw){
 const src=raw&&typeof raw==='object'&&raw.people&&typeof raw.people==='object'&&!Array.isArray(raw.people)?raw.people:{},out=[];
 for(const id of Object.keys(src)){if(!validKey(id))continue;const e=src[id];if(!e||typeof e!=='object'||Array.isArray(e))continue;
  const metDay=int(e.metDay,-1,1e9,-1),lastDay=int(e.lastDay,-1,1e9,metDay),mem=normalizeTalkMem(e);
  if(metDay<0&&lastDay<0&&isEmptyMem(mem))continue;out.push([id,person(metDay,lastDay,mem)])}
 return Object.freeze({v:TALK_V,people:Object.freeze(Object.fromEntries(capPeople(out,null)))});
}
export const isEmptyTalk=t=>!t||!t.people||!Object.keys(t.people).length;
// The mem of a person outside the roster (EMPTY_MEM when unknown).
export function personMem(talk,personId){const p=validKey(personId)&&talk?.people&&Object.prototype.hasOwnProperty.call(talk.people,personId)?talk.people[personId]:null;return p?normalizeTalkMem(p):EMPTY_MEM}
// Write a person's talk: metDay set once, lastDay = day, mem replaced. A 49th person pushes out the one with the oldest lastDay (never this one). -> new talk
export function notePerson(talk,personId,day,mem){
 const t=normalizeTalkPeople(talk);if(!validKey(personId))return t;const d=int(day,0,1e9,0),old=t.people[personId];
 const entries=Object.entries(t.people).filter(e=>e[0]!==personId);entries.push([personId,person(old&&old.metDay>=0?old.metDay:d,d,M(mem))]);
 return Object.freeze({v:TALK_V,people:Object.freeze(Object.fromEntries(capPeople(entries,personId)))});
}

// ---- migration: an npc with no mem yet gets one from what the old save already knows (runs while mem is missing; an empty result stays missing).
// progress fields read: npcs, starter {step, skipped, noteGiven}, careers.ridgeline.hired, talk (a roster person's old progress.talk entry is merged in).
export function migrateTalkMem(npc,progress,who){
 const r=byId(who);if(!r||r.dormant)return EMPTY_MEM;
 if(npc?.mem&&!isEmptyMem(normalizeTalkMem(npc.mem)))return normalizeTalkMem(npc.mem);
 let m=personMem(progress?.talk,r.personId);
 if(npc&&npc.metDay>=0&&!seenCount(m,who+'.first'))m=recordNode(m,who+'.first');
 if(who==='lincoln'&&npc?.talks)for(const t of HUNTING_TOPICS){const c=int(npc.talks[t],0,1e6,0);for(let i=seenCount(m,'lincoln.hunt.'+t);i<c&&i<1e3;i++)m=recordNode(m,'lincoln.hunt.'+t)}
 const st=progress?.starter,step=st&&!st.skipped?int(st.step,0,10,0):0;
 if(who==='sophie'&&step>=2&&st?.skipped!==true)m=recordBeat(m,'sophie.groceries-delivered');
 if(who==='hal'&&step>=3&&st?.skipped!==true)m=recordBeat(m,'hal.met');
 if(who==='walt'&&st?.noteGiven===true)m=recordBeat(m,'walt.note');
 if(who==='walt'&&progress?.careers?.ridgeline?.hired===true)m=recordBeat(m,'walt.hired');
 return m;
}
// The whole save: every roster person without a mem is migrated, and Elena is met if you already work for her (careers.diner.hired; before D-A2 it was cafe.employed). day = the npc day (housing.day - 1). -> new npcs
export function migrateNpcsTalk(npcs,progress,day){
 const out={...npcs},d=int(day,0,1e9,0);
 if(progress?.careers?.diner?.hired===true&&out.elena&&!(out.elena.metDay>=0))out.elena={...out.elena,metDay:d};
 for(const id of ROSTER_ORDER){const n=out[id];if(!n||n.mem)continue;const m=migrateTalkMem(n,progress,id);if(!isEmptyMem(m))out[id]={...n,mem:m}}
 return out;
}
