// Careers (0.35, DESIGN 4.15): being hired by an employer, ranks, reputation, promotions, quitting, tools handed over, and who owns a company.
// Pure: every action is (progress, ...) -> {state, ...} or {error}. Employers are data (MAP.employers); the save holds only what changed:
//   progress.careers[employerId] = {hired, rank (1-based, 0 when not hired), rep 0-100, shifts, lastShiftDay, granted:[item ids, ever], owed:[item ids]}
//   progress.companies[employerId] = {name?, owner?:{kind,id}, coOwners:[player ids]}  (overrides of the map's defaults)
import {MAP} from './map-definition.js';
import {levelOf} from './skills.js';
import {addItem,countItem,sellLogs,requirementError} from './inventory.js';
import {itemById} from './items.js';
import {normalizeTickets} from './tickets.js';

export const REP_MAX=100,START_REP=10,LOCAL_PLAYER='me';
export const employerById=(id,map=MAP)=>(map.employers||[]).find(e=>e.id===id)||null;
const clampRep=n=>Math.max(0,Math.min(REP_MAX,Math.round(n)));
const freshCareer=()=>({hired:false,rank:0,rep:0,shifts:0,lastShiftDay:0,granted:[],owed:[]});
const ids=(list,valid)=>Array.isArray(list)?[...new Set(list.filter(x=>typeof x==='string'&&valid(x)))]:[];

export function normalizeCareers(value,map=MAP){
 const out={};if(!value||typeof value!=='object')return out;
 for(const e of map.employers||[]){const c=value[e.id];if(!c||typeof c!=='object')continue;const n=(x,max)=>Number.isSafeInteger(x)&&x>=0&&x<=max?x:0;
  const hired=c.hired===true,rank=hired?Math.max(1,Math.min(e.ranks.length,n(c.rank,99))):0;
  out[e.id]={hired,rank,rep:hired?clampRep(n(c.rep,REP_MAX)):0,shifts:hired?n(c.shifts,1e6):0,lastShiftDay:n(c.lastShiftDay,1e7),granted:ids(c.granted,id=>!!itemById(id)),owed:ids(c.owed,id=>!!itemById(id))}}
 return out;
}
export function normalizeCompanies(value,map=MAP){
 const out={};if(!value||typeof value!=='object')return out;
 for(const e of map.employers||[]){const c=value[e.id];if(!c||typeof c!=='object')continue;const entry={};
  const name=typeof c.name==='string'?c.name.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,40):'';if(name)entry.name=name;
  if(c.owner&&['npc','player'].includes(c.owner.kind)&&typeof c.owner.id==='string'&&c.owner.id)entry.owner={kind:c.owner.kind,id:c.owner.id.slice(0,64)};
  const co=ids(c.coOwners,id=>id.length<=64);if(co.length)entry.coOwners=co;
  {const n=x=>Number.isSafeInteger(x)&&x>0&&x<=1e7?x:0,logs=n(c.stock?.logs),planks=n(c.stock?.planks);if(logs||planks)entry.stock={logs,planks}} // company stock (forest.js): logs in the landing pile, planks at the lumberyard
  {const t=normalizeTickets(c.tickets);if(t)entry.tickets=t} // order tickets (tickets.js)
  if(c.racks&&typeof c.racks==='object'){const racks={};for(const [slot,n] of Object.entries(c.racks))if(/^[A-E][1-8]-[1-3]$/.test(slot)&&Number.isSafeInteger(n)&&n>0)racks[slot]=Math.min(40,n);if(Object.keys(racks).length)entry.racks=racks} // warehouse racks (forest.js RACK_IDS, RACK_CAP 40)
  {const f=c.forkload;if(Number.isSafeInteger(f)&&f>0)entry.forkload=Math.min(40,f)} // planks on the forklift's forks (forest.js forkTake)
  if(Object.keys(entry).length)out[e.id]=entry}
 return out;
}

export const careerOf=(progress,id)=>progress.careers?.[id]||freshCareer();
export const isHired=(progress,id)=>careerOf(progress,id).hired;
export const rankOf=(progress,id,map=MAP)=>{const c=careerOf(progress,id);return c.hired?employerById(id,map)?.ranks[c.rank-1]||null:null};
export const skillLevel=(progress,skill)=>levelOf(progress.skills?.[skill]?.xp||0).level;
// The task kinds open to a rank: its own and every rank's below it.
export const taskKinds=(employer,rank)=>employer.ranks.slice(0,rank).flatMap(r=>r.tasks);

// Names and ownership: the save's overrides win over the map's defaults.
export const employerName=(progress,id,map=MAP)=>progress.companies?.[id]?.name||employerById(id,map)?.name||'';
export const ownerOf=(progress,id,map=MAP)=>{const e=employerById(id,map),o=progress.companies?.[id]?.owner;return o?{...o,name:o.kind==='npc'&&o.id===e?.owner.id?e.owner.name:o.id}:e?{kind:e.owner.kind,id:e.owner.id,name:e.owner.name}:null};
export const coOwnersOf=(progress,id)=>progress.companies?.[id]?.coOwners||[];
// Owner-level decisions (rename, later prices and hiring): the owner if a player, and every co-owner. An NPC-owned company takes no decisions from players.
export function canManage(progress,id,player=LOCAL_PLAYER,map=MAP){const o=ownerOf(progress,id,map);return !!o&&((o.kind==='player'&&o.id===player)||coOwnersOf(progress,id).includes(player))}
const setCompany=(progress,id,patch)=>({...progress,companies:{...(progress.companies||{}),[id]:{...(progress.companies?.[id]||{}),...patch}}});
export function renameCompany(progress,id,name,player=LOCAL_PLAYER,map=MAP){
 if(!employerById(id,map))return {error:'No such company.'};
 if(!canManage(progress,id,player,map))return {error:'Only the owner or a co-owner can rename the company.'};
 const clean=typeof name==='string'?name.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,40):'';if(!clean)return {error:'Enter a name.'};
 return {state:setCompany(progress,id,{name:clean})};
}
// Co-owners: only the owner (a player) adds or removes them; a co-owner can do everything else an owner can.
export function setCoOwner(progress,id,other,on,player=LOCAL_PLAYER,map=MAP){
 const o=ownerOf(progress,id,map);if(!o)return {error:'No such company.'};
 if(!(o.kind==='player'&&o.id===player))return {error:'Only the owner can choose co-owners.'};
 if(typeof other!=='string'||!other||other===o.id)return {error:'Choose another player.'};
 const list=coOwnersOf(progress,id).filter(x=>x!==other);return {state:setCompany(progress,id,{coOwners:on?[...list,other]:list})};
}

// Tools handed over at a rank: once per player per employer, ever (`granted` survives quitting, so climbing again gives nothing twice).
// Already carrying one: counted as handed over. No room: owed, collected at the office later.
function grantTools(state,id,rank,map){
 const e=employerById(id,map),handed=[],owed=[];let s=state,c={...careerOf(s,id)};
 for(const tool of e.ranks[rank-1].grants){if(c.granted.includes(tool))continue;c.granted=[...c.granted,tool];
  if(countItem(s,tool)>0)continue;const r=addItem(s,tool);if(r.error){c.owed=[...c.owed,tool];owed.push(tool)}else{s=r.state;handed.push(tool)}}
 return {state:{...s,careers:{...(s.careers||{}),[id]:c}},handed,owed};
}
export function collectOwed(progress,id,map=MAP){
 const c=careerOf(progress,id);if(!c.owed.length)return {error:'Nothing is waiting for you.'};
 let s=progress;const handed=[],still=[];for(const tool of c.owed){const r=addItem(s,tool);if(r.error)still.push(tool);else{s=r.state;handed.push(tool)}}
 if(!handed.length)return {error:'Your inventory is full.'};
 return {state:{...s,careers:{...s.careers,[id]:{...c,owed:still}}},handed};
}

// Hiring is the interview in the office. A first hire buys back wood logs from before 0.35 (the Corner Market no longer takes them).
export function hire(progress,id,map=MAP){
 const e=employerById(id,map);if(!e)return {error:'No such employer.'};
 const c=careerOf(progress,id);if(c.hired)return {error:`You already work for ${employerName(progress,id,map)}.`};
 let s=progress,boughtBack=null;
 if(!progress.careers?.[id]&&e.skill==='lumberjack'&&countItem(s,'wood-log')>0){const r=sellLogs(s);s={...r.state,routine:{...r.state.routine,earned:(r.state.routine?.earned||0)+r.earned}};boughtBack={count:r.count,earned:r.earned}}
 s={...s,careers:{...(s.careers||{}),[id]:{...c,hired:true,rank:1,rep:START_REP,shifts:0}}};
 const g=grantTools(s,id,1,map);return {state:g.state,rank:e.ranks[0],handed:g.handed,owed:g.owed,boughtBack};
}
// Quitting resets rank, reputation and shifts; the skill's XP and the tools already handed over stay. Not while on that employer's shift.
export function quit(progress,id,map=MAP){
 if(!employerById(id,map))return {error:'No such employer.'};
 const c=careerOf(progress,id);if(!c.hired)return {error:'You do not work there.'};
 if(progress.shift?.employer===id)return {error:'Clock out first.'};
 return {state:{...progress,careers:{...progress.careers,[id]:{...c,hired:false,rank:0,rep:0,shifts:0}}}};
}
// What the next rank needs and how far along you are. ready: every need is met (the promotion itself happens in the office).
export function nextRank(progress,id,map=MAP){
 const e=employerById(id,map),c=careerOf(progress,id);if(!e||!c.hired)return null;
 const next=e.ranks[c.rank];if(!next)return {top:true,rank:e.ranks[c.rank-1]};
 const have={level:skillLevel(progress,e.skill),shifts:c.shifts,rep:c.rep},met={level:have.level>=next.needs.level,shifts:have.shifts>=next.needs.shifts,rep:have.rep>=next.needs.rep};
 return {top:false,rank:next,needs:next.needs,have,met,ready:met.level&&met.shifts&&met.rep};
}
export function promote(progress,id,map=MAP,{force=false}={}){ // force: the dev panel skips the needs
 const n=nextRank(progress,id,map);if(!n)return {error:'You do not work there.'};if(n.top)return {error:'You are at the top rank.'};
 if(!n.ready&&!force)return {error:`Not yet: ${n.rank.name} needs level ${n.needs.level}, ${n.needs.shifts} shifts and ${n.needs.rep} reputation.`};
 const c=careerOf(progress,id),rank=c.rank+1;
 const g=grantTools({...progress,careers:{...progress.careers,[id]:{...c,rank}}},id,rank,map);
 return {state:g.state,rank:n.rank,handed:g.handed,owed:g.owed};
}
// The company store (DESIGN 4.15): things only the company sells (the chainsaws), to a rank and above and, if the item says so, a skill level. Pays cash like any purchase.
export const storeItems=(id,map=MAP)=>(employerById(id,map)?.store||[]).map(s=>({...s,item:itemById(s.item)})).filter(s=>s.item);
export function storeLine(progress,id,itemId,map=MAP){
 const e=employerById(id,map),line=(e?.store||[]).find(s=>s.item===itemId),item=itemById(itemId),c=careerOf(progress,id);
 if(!e||!line||!item)return {error:'The company does not sell that.'};
 if(!c.hired)return {error:`Only ${employerName(progress,id,map)} staff can buy from the company store.`};
 if(c.rank<line.rank)return {error:`${item.name}: sold from the ${e.ranks[line.rank-1].name} rank up.`};
 return {item,line};
}
export function buyFromCompany(progress,id,itemId,map=MAP){
 const l=storeLine(progress,id,itemId,map);if(l.error)return l;
 const locked=requirementError(progress,l.item);if(locked)return {error:locked};
 const r=addItem(progress,itemId,{purchase:true});return r.error?{error:r.error}:{state:r.state,item:l.item,message:`You bought the ${l.item.name}.`};
}
export function changeRep(progress,id,delta){const c=careerOf(progress,id);if(!c.hired)return progress;return {...progress,careers:{...progress.careers,[id]:{...c,rep:clampRep(c.rep+delta)}}}}
