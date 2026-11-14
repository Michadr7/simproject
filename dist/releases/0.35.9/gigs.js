// Gigs (notes/gigs-starter-design.md section 3): pure rules, no DOM. Money is integer cents. Times are game minutes.
// The board is DERIVED from counters (day, slot, completed count), never Math.random, so a save always shows the same board and tests can pin it.
// ctx = {clients:[{id,name}], places:[{id,x,z,room}]}; the default is built lazily from the town (population.js + orders.js dropSpot).
import {townPopulation} from './population.js';
import {dropSpot} from './orders.js';
import {propertyById} from './properties.js';
const T=(id,title,base,o={})=>Object.freeze({id,title,base,stops:1,rep:0,bed:false,limit:0,hard:false,...o});
export const GIG_TYPES=Object.freeze([
 T('grocery','Grocery run',1200,{limit:60,twist:'Deliver within 60 game minutes'}),
 T('parcel','Doorstep parcel',1000,{twist:'The client answers the door: the right answer tips',tip:[200,800]}),
 T('round','Round of three',2700,{stops:3,rep:10,twist:'Three drops in any order; par distance sets quality'}),
 T('rush','Rush envelope',2000,{limit:20,hard:true,twist:'Hard 20 minute limit; failing pays 0'}),
 T('fuel','Fuel rescue',1800,{rep:10,live:false,tip:[300,1000],twist:'Buy the fuel up front; the driver repays it plus a tip'}),
 T('fragile','Fragile haul',3500,{bed:true,live:false,twist:'Every hard knock breaks a piece'}),
 T('bulk','Bulk haul',4500,{bed:true,live:false,twist:'One long trip or two'}),
 T('chain','Chain errand',6000,{stops:3,rep:25,vehicle:true,live:false,limit:150,twist:'The supplier gave the wrong part'})
]);
export const typeById=id=>GIG_TYPES.find(t=>t.id===id)||null;
export const BOARD_SLOTS=4,SLOT_LIFE=90,SLOT_STAGGER=22,RECENT_MAX=30,CLIENT_REST_DAYS=2,LARGE_REP=40;
export const gameMinutes=p=>((p.housing?.day||1)-1)*1440+(p.routine?.minutes||0);
const int=(v,lo,hi,d=0)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.floor(v))):d;
const hash=(...a)=>{let h=2166136261;for(const ch of a.join('|')){h^=ch.codePointAt(0);h=Math.imul(h,16777619)}h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;return (h>>>0)};
const pt=v=>v&&Number.isFinite(v.x)&&Number.isFinite(v.z)?{id:typeof v.id==='string'?v.id.slice(0,60):'',x:Math.max(-2000,Math.min(2000,v.x)),z:Math.max(-2000,Math.min(2000,v.z)),room:typeof v.room==='string'?v.room.slice(0,24):'street',name:typeof v.name==='string'?v.name.slice(0,60):''}:null;
let defaultCtx=null;
const EXTRA_PLACES=[{id:'oak-18',name:'18 Oak Street',x:3.8,z:-7},{id:'alder-coffee',name:'Alder Coffee',x:36,z:-6.3},{id:'oak-laundry',name:'Oak Street Laundry',x:-10.2,z:-7}];
export function townContext(){
 if(defaultCtx)return defaultCtx;
 const pop=townPopulation(),clients=[],places=[],seen=new Set();
 for(const m of pop.people)if(m.resident&&m.home?.startsWith('property:')&&m.home!=='property:farm-house')clients.push({id:m.id,name:m.name,home:m.home.slice(9)});
 for(const c of clients){if(seen.has(c.home))continue;seen.add(c.home);const d=dropSpot(c.home);if(d)places.push({id:c.home,name:propertyById(c.home)?.name||'a house',x:d.x,z:d.z,room:'street'})}
 for(const e of EXTRA_PLACES)places.push({...e,room:'street'}); // the street's own addresses near the market: short walks
 return defaultCtx={clients,places};
}
export const freshGigs=()=>({rep:0,recent:[],active:null,nextId:1,taken:{},clientsSeen:{},completed:0});
export function normalizeActive(v){
 const t=typeById(v?.type);if(!t||!Array.isArray(v.places))return null;
 const places=v.places.slice(0,3).map(pt);if(!places.length||places.some(x=>!x))return null;
 return {id:int(v.id,1,1e9,1),type:t.id,client:typeof v.client==='string'?v.client.slice(0,60):'',places,visited:places.map((_,i)=>v.visited?.[i]===true),stage:int(v.stage,0,places.length,0),startedAt:int(v.startedAt,0,1e9),dueAt:int(v.dueAt,0,1e9),quality:int(v.quality,0,100,100),knocks:int(v.knocks,0,100),metres:int(v.metres,0,1e6),tip:int(v.tip,0,100000),large:v.large===true,trips:int(v.trips,1,2,1)};
}
export function normalizeGigs(v){
 const g=freshGigs();if(!v||typeof v!=='object')return g;
 g.rep=int(v.rep,0,100);g.nextId=int(v.nextId,1,1e9,1);g.completed=int(v.completed,0,1e9);
 g.recent=(Array.isArray(v.recent)?v.recent:[]).filter(r=>typeById(r?.type)&&Number.isFinite(r.at)&&r.at>=0).map(r=>({type:r.type,at:int(r.at,0,1e9)})).slice(-RECENT_MAX);
 for(let i=0;i<BOARD_SLOTS;i++)if(Number.isFinite(v.taken?.[i]))g.taken[i]=int(v.taken[i],0,1e9);
 for(const [k,d] of Object.entries(v.clientsSeen&&typeof v.clientsSeen==='object'?v.clientsSeen:{}).slice(0,60))if(Number.isFinite(d)&&k.length<=60)g.clientsSeen[k]=int(d,0,1e6);
 g.active=normalizeActive(v.active);return g;
}
export const repeatsToday=(recent,type,now)=>(recent||[]).filter(r=>r.type===type&&r.at>now-1440&&r.at<=now).length;
// The old repeat steps: finished 0 or 1 before = 100%, 2 = 85%, 3 = 70%, 4 or more = 55%.
const REPEAT_PCT=[100,100,85,70,55];
// pay = floor(base * qualityMul * repeatMul * repMul) + tip, all in integers (no float rounding).
export function payFor(typeId,quality,repeats,rep,tip=0,large=false){
 const t=typeById(typeId);if(!t)return 0;
 const q=int(quality,0,100,100),r=REPEAT_PCT[Math.min(4,int(repeats,0,99))],g=int(rep,0,100);
 const base=large?Math.floor(t.base*140/100):t.base;
 const pay=Math.floor(base*(6000+40*q)*r*(200+Math.min(g,60))/200000000);
 const range=t.tip;return pay+(range?Math.max(range[0],Math.min(range[1],int(tip,0,1e6))):0)*(tip>0?1:0);
}
export function qualityFor(typeId,f={}){
 if(typeId==='grocery'||typeId==='chain')return f.late?(typeId==='chain'?70:60):100;
 if(typeId==='rush')return f.late?0:100;
 if(typeId==='fragile')return Math.max(40,100-15*int(f.knocks,0,100));
 if(typeId==='round')return Math.max(0,100-10*Math.floor(Math.max(0,int(f.overPct,0,1000))/10));
 return 100;
}
export function parRoute(points,start){
 const perms=a=>a.length<2?[a]:a.flatMap((x,i)=>perms([...a.slice(0,i),...a.slice(i+1)]).map(r=>[x,...r]));
 let best=null;
 for(const order of perms(points.map((_,i)=>i))){let at=start,len=0;for(const i of order){len+=Math.hypot(points[i].x-at.x,points[i].z-at.z);at=points[i]}if(!best||len<best.length)best={order,length:len}}
 return best||{order:[],length:0};
}
// live:false types (the vehicle gigs and the fuel rescue) are defined but not offered until their code exists.
const unlocked=(g,type,p)=>type.live!==false&&type.rep<=g.rep&&(!type.bed&&!type.vehicle||hasBed(p));
const BED_MODELS=['worktruck','flatbed','shortbed','offroad'];
export const hasBed=p=>(p.vehicles||[]).some(v=>BED_MODELS.includes(v.model)&&!v.loan);
export const isLarge=(g,type)=>g.rep>=LARGE_REP&&type.stops>1;
// The board: BOARD_SLOTS slots, each with its own expiry staggered by SLOT_STAGGER; never two of one type; a type you just finished is skipped.
export function boardFor(p,now=gameMinutes(p),ctx=townContext()){
 const g=p.gigs||freshGigs(),types=GIG_TYPES.filter(t=>unlocked(g,t,p)),last=g.recent.at(-1)?.type,day=Math.floor(now/1440);
 const slots=[],usedT=new Set(),usedC=new Set();
 for(let i=0;i<BOARD_SLOTS;i++){
  const w=Math.floor((now+i*SLOT_STAGGER)/SLOT_LIFE),expiresAt=(w+1)*SLOT_LIFE-i*SLOT_STAGGER;
  if(g.taken[i]===w)continue;
  let pool=types.filter(t=>!usedT.has(t.id)&&t.id!==last);if(!pool.length)continue;
  const type=pool[hash('t',w,i,g.completed)%pool.length];
  const rested=ctx.clients.filter(c=>!usedC.has(c.id)&&!(c.id in g.clientsSeen&&day-g.clientsSeen[c.id]<CLIENT_REST_DAYS));
  const cl=rested.length?rested[hash('c',w,i,g.completed)%rested.length]:ctx.clients[0];
  const places=[],home=ctx.places.find(x=>x.id===cl?.home);for(let k=0;k<type.stops;k++)places.push(k===0&&home?home:ctx.places[hash('p',w,i,k,g.completed)%ctx.places.length]);
  usedT.add(type.id);if(cl)usedC.add(cl.id);
  slots.push({slot:i,window:w,expiresAt,type:type.id,client:cl?.id||'',clientName:cl?.name||'',places:places.map(x=>({...x})),large:isLarge(g,type)});
 }
 return slots;
}
// Noah's counter shows only the grocery and parcel gigs of the board.
export const marketBoard=(p,now,ctx)=>boardFor(p,now,ctx).filter(s=>s.type==='grocery'||s.type==='parcel');
export function acceptGig(p,slot,now=gameMinutes(p),ctx){
 const g=p.gigs||freshGigs();
 if(g.active)return {error:'Finish your active gig before accepting another.'};
 const s=boardFor(p,now,ctx).find(x=>x.slot===slot);if(!s)return {error:'This gig is unavailable.'};
 const t=typeById(s.type),places=s.places.map(pt),active=normalizeActive({id:g.nextId,type:s.type,client:s.client,places,startedAt:now,dueAt:t.limit?now+t.limit:0,large:s.large});
 return {state:{...p,gigs:{...g,active,nextId:g.nextId+1,taken:{...g.taken,[slot]:s.window}}}};
}
const near=(pos,pl)=>Math.hypot(pos.x-pl.x,pos.z-pl.z)<=1.35;
// Per frame: knocks and metres add up, and the player reaching a place ticks it off (round of three: any order, the rest in order). Only the pure state moves; completeGig pays.
export function tickGig(p,{position,room='street',dt=0,moving=false,knock=0,metres=0,now=gameMinutes(p)}={}){
 const g=p.gigs;if(!g?.active)return p;
 const a={...g.active,visited:[...g.active.visited]};a.knocks=Math.min(100,a.knocks+int(knock,0,10));a.metres=Math.min(1e6,a.metres+Math.max(0,Number.isFinite(metres)?metres:0));
 if(position)for(let i=0;i<a.places.length;i++){
  if(a.visited[i]||a.places[i].room!==room||!near(position,a.places[i]))continue;
  if(a.type!=='round'&&a.visited.slice(0,i).includes(false))continue;
  a.visited[i]=true;
 }
 a.stage=a.visited.filter(Boolean).length;
 if(typeById(a.type).hard&&a.dueAt&&now>a.dueAt)return failGig({...p,gigs:{...g,active:a}},now,'late');
 return {...p,gigs:{...g,active:a}};
}
export const gigDone=p=>!!p.gigs?.active&&p.gigs.active.stage>=p.gigs.active.places.length;
export function failGig(p,now=gameMinutes(p),why='failed'){
 const g=p.gigs;if(!g?.active)return p;
 return {...p,gigs:{...g,active:null,rep:Math.max(0,g.rep-2)}};
}
// opts.tip: the dialog's tip in cents (clamped to the type's range); par: par route length for the round.
export function completeGig(p,now=gameMinutes(p),opts={}){
 const g=p.gigs,a=g?.active;if(!a)return {error:'You have no active gig.'};
 if(!gigDone(p))return {error:'Finish the marked stops first.'};
 const t=typeById(a.type),late=!!(t.limit&&a.dueAt&&now>a.dueAt);
 if(t.hard&&late)return {state:failGig(p,now,'late'),paid:0,failed:true};
 let overPct=0;if(a.type==='round'&&opts.par>0){const walked=Math.max(0,a.metres);overPct=Math.max(0,Math.round((walked/opts.par-1)*100))}
 const quality=qualityFor(a.type,{late,knocks:a.knocks,overPct}),pay=payFor(a.type,quality,repeatsToday(g.recent,a.type,now),g.rep,opts.tip||0,a.large);
 const rep=g.rep+(quality>=80?2:quality>=50?1:0),day=Math.floor(now/1440);
 const recent=[...g.recent,{type:a.type,at:now}].filter(r=>r.at>now-1440).slice(-RECENT_MAX);
 return {paid:pay,quality,state:{...p,cash:p.cash+pay,routine:{...p.routine,earned:(p.routine?.earned||0)+pay},gigs:{...g,active:null,rep:Math.min(100,rep),recent,completed:g.completed+1,clientsSeen:{...g.clientsSeen,[a.client]:day}}}};
}