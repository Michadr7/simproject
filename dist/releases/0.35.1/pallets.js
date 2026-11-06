// Warehouse pallets (DESIGN 4.16 I). The racks no longer hold plank counts: they hold pallet objects, and every pallet knows what it carries.
// Pure, like tickets.js: every function takes the company's own state (progress.companies[id]) and returns a new company; nothing reads the clock or the player.
//   pallet = {id, product, count, at}   product: 'planks'; count 1..PALLET_CAP; at: {rack:'B4-2'} (a rack cell, one pallet per cell), {fork:true} (on the forklift's forks, one at a time)
//   or {floor:{x, z, yaw}} (set down on the warehouse floor: room metres, the pallet's axis turned by yaw, like the forklift's)
//   company.pallets = [pallet] (at most MAX_PALLETS); the old fields company.racks {slot: n} and company.forkload n are migrated into it on load and dropped.
// Outdoor staging joins `at` in step 3 (4.16 I); order staging squares are still derived from the tickets (planks set on one are used up by the order).
import {RACK_SLOTS,RACK_ID_PATTERN,DOCK_DOOR,HALL} from './warehouse-layout.js';

export const PALLET_CAP=40,MAX_PALLETS=200,MAX_FLOOR=40;
// a pallet's size: across the tine pockets, along the forks, and its own height (the planks lie on top of it)
export const PALLET=Object.freeze({w:1.04,d:1.24,h:.14});
export const FLOOR_LIMIT=Object.freeze({x:17,z:11}); // floor pallets stay inside the hall

export const PRODUCTS=Object.freeze({planks:Object.freeze({name:'planks',one:'plank'})});
const SLOT_IDS=new Set(RACK_SLOTS.map(s=>s.id));

// what a company holds: its pallets, from the new field or, for a save or a test written before pallets, from the old counts (never mutated; ids are stable: 1.. in rack order)
export function palletsOf(company){
 if(Array.isArray(company?.pallets))return company.pallets;
 const list=[];let id=1;
 if(company?.racks&&typeof company.racks==='object')for(const slot of RACK_SLOTS.map(s=>s.id)){const n=company.racks[slot];if(Number.isSafeInteger(n)&&n>0)list.push({id:id++,product:'planks',count:Math.min(PALLET_CAP,n),at:{rack:slot}})}
 if(Number.isSafeInteger(company?.forkload)&&company.forkload>0)list.push({id:id++,product:'planks',count:Math.min(PALLET_CAP,company.forkload),at:{fork:true}});
 return list;
}
// the company with this list of pallets; the old fields are dropped so they cannot come back, and an empty list is not stored
export function withPallets(company,list){
 const {racks,forkload,pallets,...rest}=company||{};
 return list.length?{...rest,pallets:list}:rest;
}
const nextId=list=>1+list.reduce((m,p)=>Math.max(m,p.id),0);
const palletAt=(list,slot)=>list.find(p=>p.at.rack===slot);
const onForks=list=>list.find(p=>p.at.fork);
export const palletById=(company,id)=>palletsOf(company).find(p=>p.id===id)||null;
export const floorPallets=company=>palletsOf(company).filter(p=>p.at.floor);
const sum=list=>list.reduce((s,p)=>s+p.count,0);

export const rackPallet=(company,slot)=>palletAt(palletsOf(company),slot)||null;
export const forkPallet=company=>onForks(palletsOf(company))||null;
// {slot: planks} for the racks, planks on the forks, and the planks on every pallet (the warehouse's whole stock)
export const racksMap=company=>Object.fromEntries(palletsOf(company).filter(p=>p.at.rack).map(p=>[p.at.rack,p.count]));
export const forkCount=company=>forkPallet(company)?.count||0;
export const totalPlanks=company=>sum(palletsOf(company).filter(p=>p.product==='planks'));
export const freeCells=company=>{const used=new Set(palletsOf(company).filter(p=>p.at.rack).map(p=>p.at.rack));return RACK_SLOTS.filter(s=>!used.has(s.id))};

// Planks into a rack cell by hand or off the forks: joins the pallet already there (up to PALLET_CAP) or starts one. Returns {company, put}; put is 0 when the cell is full or the warehouse has no room for another pallet.
export function addToRack(company,slot,n,product='planks'){
 if(!SLOT_IDS.has(slot))return {company,put:0};
 const list=palletsOf(company),cur=palletAt(list,slot);
 if(cur){const put=Math.min(n,PALLET_CAP-cur.count);return put>0?{company:withPallets(company,list.map(p=>p===cur?{...p,count:cur.count+put}:p)),put}:{company,put:0}}
 if(list.length>=MAX_PALLETS||n<=0)return {company,put:0};
 const put=Math.min(n,PALLET_CAP);
 return {company:withPallets(company,[...list,{id:nextId(list),product,count:put,at:{rack:slot}}]),put};
}
// Planks out of a rack cell (a stack into your hands): the pallet shrinks and disappears when it is empty (the crew collects the empty pallets).
export function takeFromRackCell(company,slot,n){
 const list=palletsOf(company),cur=palletAt(list,slot);if(!cur)return {company,taken:0};
 const taken=Math.min(n,cur.count);
 return {company:withPallets(company,cur.count-taken>0?list.map(p=>p===cur?{...p,count:cur.count-taken}:p):list.filter(p=>p!==cur)),taken};
}
// planks leave the forks (onto an order's staging square): the pallet shrinks and goes when empty
export function useForkPlanks(company,n){
 const list=palletsOf(company),load=onForks(list);if(!load)return company;
 return withPallets(company,load.count-n>0?list.map(p=>p===load?{...p,count:load.count-n}:p):list.filter(p=>p!==load));
}

// The physical forks (DESIGN 4.16 I): a pallet is lifted from where it stands (a rack cell or the floor) onto the forks, and set down in an empty cell or on the floor. One pallet on the forks at a time.
export function liftPallet(company,id){
 const list=palletsOf(company),cur=list.find(p=>p.id===id);if(!cur||onForks(list)||cur.at.fork)return {company,lifted:0};
 return {company:withPallets(company,list.map(p=>p===cur?{...p,at:{fork:true}}:p)),lifted:cur.count};
}
// `at`: {rack:'B4-2'} (the cell must be empty) or {floor:{x,z,yaw}} (inside the hall, and at most MAX_FLOOR on the floor). Returns {company, placed} or {company, placed:false, error}.
export function setPallet(company,at){
 const list=palletsOf(company),load=onForks(list);if(!load)return {company,placed:false,error:'Nothing on the forks.'};
 if(at?.rack){
  if(!SLOT_IDS.has(at.rack))return {company,placed:false,error:'There is no such rack.'};
  if(palletAt(list,at.rack))return {company,placed:false,error:`Rack ${at.rack} already holds a pallet.`};
  return {company:withPallets(company,list.map(p=>p===load?{...p,at:{rack:at.rack}}:p)),placed:true};
 }
 const f=at?.floor;if(!f||![f.x,f.z,f.yaw].every(Number.isFinite)||Math.abs(f.x)>FLOOR_LIMIT.x||Math.abs(f.z)>FLOOR_LIMIT.z)return {company,placed:false,error:'No room to set it down there.'};
 if(list.filter(p=>p.at.floor).length>=MAX_FLOOR)return {company,placed:false,error:'The floor is full of pallets.'};
 return {company:withPallets(company,list.map(p=>p===load?{...p,at:{floor:{x:+f.x.toFixed(2),z:+f.z.toFixed(2),yaw:+f.yaw.toFixed(3)}}}:p)),placed:true};
}
// Where the crew puts a pallet away: the free cell nearest the roller door on the lowest level first (so it can be picked by hand), then the next level up (DESIGN 4.16 I).
const DOOR={x:DOCK_DOOR.x,z:HALL.halfD};
export const putAwayOrder=()=>[...RACK_SLOTS].sort((a,b)=>a.level-b.level||Math.hypot(a.x-DOOR.x,a.z-DOOR.z)-Math.hypot(b.x-DOOR.x,b.z-DOOR.z)||a.id.localeCompare(b.id));
const ORDER=putAwayOrder();
// The crew puts `planks` away on new pallets of PALLET_CAP (the last one smaller), each in the next sensible free cell. Returns {company, placed (planks), pallets (count), cells: [slot]};
// when the racks are full it places what fits and the rest is `left`.
export function crewPutAway(company,planks,product='planks'){
 let list=[...palletsOf(company)],left=Math.max(0,Math.floor(planks)),placed=0;const cells=[];
 const used=new Set(list.filter(p=>p.at.rack).map(p=>p.at.rack));
 for(const s of ORDER){
  if(left<=0||list.length>=MAX_PALLETS)break;if(used.has(s.id))continue;
  const n=Math.min(PALLET_CAP,left);list.push({id:nextId(list),product,count:n,at:{rack:s.id}});used.add(s.id);cells.push(s.id);left-=n;placed+=n;
 }
 return {company:placed?withPallets(company,list):company,placed,pallets:cells.length,cells,left};
}

// Saved on the company: unknown places and products are dropped, counts clamped, one pallet per cell, one on the forks, at most MAX_PALLETS. Old racks and forkload are migrated.
export function normalizePallets(value,legacy){
 const source=Array.isArray(value)?value:palletsOf(legacy);
 const list=[],cells=new Set(),ids=new Set();let fork=false,floors=0;
 for(const p of source){
  if(!p||typeof p!=='object'||list.length>=MAX_PALLETS)continue;
  const product=Object.hasOwn(PRODUCTS,p.product)?p.product:null,count=Number.isSafeInteger(p.count)?Math.min(PALLET_CAP,p.count):0;if(!product||count<=0)continue;
  let at=null;
  if(p.at?.rack&&typeof p.at.rack==='string'&&RACK_ID_PATTERN.test(p.at.rack)&&SLOT_IDS.has(p.at.rack)&&!cells.has(p.at.rack)){at={rack:p.at.rack};cells.add(p.at.rack)}
  else if(p.at?.fork===true&&!fork){at={fork:true};fork=true}
  else if(p.at?.floor&&typeof p.at.floor==='object'&&[p.at.floor.x,p.at.floor.z,p.at.floor.yaw].every(Number.isFinite)&&floors<MAX_FLOOR){const f=p.at.floor;at={floor:{x:Math.max(-FLOOR_LIMIT.x,Math.min(FLOOR_LIMIT.x,+f.x.toFixed(2))),z:Math.max(-FLOOR_LIMIT.z,Math.min(FLOOR_LIMIT.z,+f.z.toFixed(2))),yaw:+f.yaw.toFixed(3)}};floors++}
  if(!at)continue;
  let id=Number.isSafeInteger(p.id)&&p.id>0&&!ids.has(p.id)?p.id:0;if(!id){id=1;while(ids.has(id))id++}
  ids.add(id);list.push({id,product,count,at});
 }
 return list;
}
