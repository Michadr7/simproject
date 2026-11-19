// Order tickets (0.35, DESIGN 4.16 B): a company's customer orders for planks. Pure, and written so a server can run the same code later (4.16 G):
// every rule takes the company's own state (progress.companies[id]) and an action that carries everything it needs ({now, playerId, rank, ...});
// nothing here reads the clock, the player or the save. A rule returns {company, effects, message} or {error}: `effects` is what the acting
// players get ({playerId, piece, rep}), applied to their own progress by the caller (recordPiece, changeRep). Offline the player is 'me'.
//   company.tickets = {nextId, day, released:[release indices done today], list:[ticket]}
//   ticket = {id, customer, kind:'pickup'|'delivery', planks, issuedAt, dueAt, status, staged, takenBy?, dest?, vehicle?}
//   status: 'open' (on the board) -> 'taken' -> 'staged' (all planks on its pallet) -> ('loaded' onto a vehicle, deliveries) -> 'done'; or 'failed' / 'expired'
// Times are absolute game minutes ((day - 1) * 1440 + minutes of the day).
import {MAP} from './map-definition.js';
import {formatClock} from './routine.js';
import {weekday} from './housing.js';
import {palletsOf,orderPallet,squarePallet,stageByHand,setOnSquare,dropOrderPallet,withPallets,STAGING_SQUARES} from './pallets.js';

export const CLOSE=1080,MAX_TAKEN=3,MAX_LIST=12,FAIL_REP=-3,DONE_REP=1,TAKE_RANK={pickup:4,delivery:5};
// When tickets come in during a day (minutes of the day), and what kind. Placeholders: three pickups and one delivery a day (the user, 2026-11-06).
export const RELEASES=Object.freeze([{at:420,kind:'pickup'},{at:540,kind:'delivery'},{at:600,kind:'pickup'},{at:780,kind:'pickup'}]);
export const SIZES=Object.freeze([12,24,40]);
export const CUSTOMERS=Object.freeze(['Greenway Builders','Cedar Heights Homes','Alder Hardware','Eastbank Joinery','Oak Street Carpentry','Pine & Sons Decking']);
// Where deliveries go: the houses on the map (their drop spots; a build site comes later).
export const DESTINATIONS=Object.freeze((MAP.properties||[]).filter(p=>p.type==='house').map(p=>p.id));
const dayOf=now=>Math.floor(now/1440)+1,minuteOf=now=>now%1440;
const empty=()=>({nextId:1,day:0,released:[],list:[]});
export const ticketsOf=company=>company?.tickets||empty();
const withTickets=(company,tickets)=>({...(company||{}),tickets});
const PIECE={pickup:'orders',delivery:'deliveries'};

// The ticket a release makes on a day: picked by the day and the release number, never random, so a save always gets the same orders.
export function makeTicket(day,index,id){
 const r=RELEASES[index],issuedAt=(day-1)*1440+r.at,planks=SIZES[(day+index*2)%SIZES.length],customer=CUSTOMERS[(day*3+index)%CUSTOMERS.length];
 if(r.kind==='pickup')return {id,customer,kind:'pickup',planks,issuedAt,dueAt:Math.min((day-1)*1440+CLOSE,issuedAt+(planks>=40?300:240)),status:'open',staged:0};
 const dest=DESTINATIONS.length?DESTINATIONS[(day+index)%DESTINATIONS.length]:null;
 return {id,customer,kind:'delivery',planks,issuedAt,dueAt:(day-1)*1440+1440*(1+(day+index)%2)+CLOSE,status:'open',staged:0,...(dest?{dest}:{})};
}

// The clock moved: release today's tickets whose time has come, expire tickets nobody took once the day closes, fail taken ones past their deadline,
// and forget finished ones from earlier days. release:false (nobody is on shift) only expires and fails; clockedOut lists players who are off shift: their taken pickups fail at once (a pickup is
// due the same shift). Returns {company, released, failed, expired, effects}. A jump of several days (sleep) releases only today's.
export function tickTickets(company,{now,release=true,clockedOut=[]}){
 let t=ticketsOf(company);const today=dayOf(now),released=[],failed=[],expired=[],effects=[];
 if(t.day!==today)t={...t,day:today,released:[]};
 let list=t.list.map(k=>{
  if(k.status==='open'&&(now>=Math.floor(k.issuedAt/1440)*1440+CLOSE||now>=k.dueAt)){expired.push(k);return {...k,status:'expired'}}
  if((k.status==='taken'||k.status==='staged'||k.status==='loaded')&&(now>=k.dueAt||(k.kind==='pickup'&&clockedOut.includes(k.takenBy)))){failed.push(k);if(k.takenBy)effects.push({playerId:k.takenBy,rep:FAIL_REP});return {...k,status:'failed'}}
  return k});
 let nextId=t.nextId,done=[...t.released];
 if(release)RELEASES.forEach((r,i)=>{if(done.includes(i)||minuteOf(now)<r.at||minuteOf(now)>=CLOSE)return;done.push(i);const k=makeTicket(today,i,nextId);if(now>=k.dueAt)return;nextId++;list.push(k);released.push(k)}); // one already past due (a save loaded late in the day) is skipped
 list=list.filter(k=>!(['done','failed','expired'].includes(k.status)&&dayOf(k.issuedAt)<today)); // finished tickets from earlier days are gone
 if(list.length>MAX_LIST){const keep=list.filter(k=>!['done','failed','expired'].includes(k.status));list=[...list.filter(k=>['done','failed','expired'].includes(k.status)).slice(-(MAX_LIST-keep.length)),...keep].slice(-MAX_LIST)}
 const changed=released.length||failed.length||expired.length||t!==ticketsOf(company)||done.length!==t.released.length||list.length!==t.list.length;
 return {company:changed?withTickets(company,{...t,nextId,released:done,list}):company,released,failed,expired,effects};
}

const find=(company,id)=>ticketsOf(company).list.find(k=>k.id===id);
const replace=(company,ticket)=>{const t=ticketsOf(company);return withTickets(company,{...t,list:t.list.map(k=>k.id===ticket.id?ticket:k)})};
export const takenBy=(company,playerId)=>ticketsOf(company).list.filter(k=>k.takenBy===playerId&&['taken','staged','loaded'].includes(k.status));
export const openTickets=company=>ticketsOf(company).list.filter(k=>k.status==='open');
// when a ticket is due, in the game's own clock: 'by 2:00 PM' today, 'by Tue 6:00 PM' on another day (`today` is the absolute minute now)
export const dueText=(k,today)=>{const same=Math.floor(k.dueAt/1440)===Math.floor(today/1440);return 'by '+(same?'':weekday(Math.floor(k.dueAt/1440)+1).slice(0,3)+' ')+formatClock(k.dueAt%1440)};
export const ticketText=k=>`#${k.id} · ${k.customer} · ${k.planks} planks · ${k.kind==='pickup'?'pickup':'delivery'}`;

// Take a ticket at the order table: it must be open and not past due, your rank high enough for its kind, and you may hold at most three.
export function takeTicket(company,{id,playerId,rank,now}){
 const k=find(company,id);if(!k)return {error:'No such ticket.'};
 if(k.status!=='open')return {error:k.takenBy===playerId?'You already have that ticket.':'That ticket is no longer on the board.'};
 if(now>=k.dueAt)return {error:'That order is past its time.'};
 if((rank||0)<TAKE_RANK[k.kind])return {error:k.kind==='delivery'?'Deliveries are for Sawyers (rank 5) and up.':'Picking orders is for Yard hands (rank 4) and up.'};
 if(takenBy(company,playerId).length>=MAX_TAKEN)return {error:`You hold ${MAX_TAKEN} tickets already. Finish one first.`};
 const square=freeSquare(company);
 return {company:replace(company,{...k,status:'taken',takenBy:playerId,...(square>=0?{square}:{})}),effects:[],message:`Ticket ${ticketText(k)} is yours.`};
}
// The order's square (S1..S3 = 0..2) is kept on the ticket when it is taken, so it does not move when an older order finishes. A ticket without one (a save or a test from before) gets the first free square, oldest first.
const live=k=>k.status==='taken'||k.status==='staged';
function freeSquare(company){const used=new Set(ticketsOf(company).list.filter(k=>live(k)&&Number.isInteger(k.square)).map(k=>k.square));for(let i=0;i<STAGING_SQUARES;i++)if(!used.has(i))return i;return -1}
// Planks put on an order's pallet by hand (stageByHand: the pallet appears with the first stack). Anyone may help stage a taken ticket (co-op later); returns how many it took.
export function stagePlanks(company,{id,count,now}){
 const k=find(company,id);if(!k)return {error:'No such ticket.'};
 if(k.status!=='taken')return {error:k.status==='staged'?'That order is fully staged.':'Take the ticket first.'};
 if(now>=k.dueAt)return {error:'That order is past its time.'};
 const square=squareOf(company,k);if(square<0)return {error:'There is no free square for that order.'};
 const r=stageByHand(company,{order:k.id,square,n:count,need:k.planks-k.staged});if(r.error)return {error:r.error};
 return finishStage(r.company,k,square,r.put);
}
// A pallet from the forks set on the order's square (D1): the order takes what it still needs, the surplus is `surplus` for the caller to send back to the racks (restock).
export function stagePallet(company,{id,now}){
 const k=find(company,id);if(!k)return {error:'No such ticket.'};
 const own=orderPallet(company,id);
 if(k.status!=='taken'&&!(own&&own.at.fork))return {error:k.status==='staged'?'That order is fully staged.':'Take the ticket first.'};
 if(now>=k.dueAt)return {error:'That order is past its time.'};
 const square=squareOf(company,k);if(square<0)return {error:'There is no free square for that order.'};
 const r=setOnSquare(company,{order:k.id,square,need:k.planks-k.staged});if(r.error)return {error:r.error};
 const res=finishStage(r.company,k,square,r.used);res.surplus=r.surplus;return res;
}
// the ticket's staged count and status follow its pallet
function finishStage(co,k,square,used){
 const p=orderPallet(co,k.id),staged=Math.min(k.planks,p?p.count:0),full=staged>=k.planks;
 return {company:replace(co,{...k,staged,square,status:full?'staged':'taken'}),used,effects:[],message:full?`Order #${k.id} is staged: ${k.planks} planks.`:`Order #${k.id}: ${staged} / ${k.planks} planks staged.`};
}
const squareOf=(company,k)=>stagingOf(company).findIndex(s=>s&&s.id===k.id);
// A loaded order consumes its pallet: it must be on its square (an order with no pallet, from a save or a test before pallets, loads as before).
function consume(company,k,zone=false){
 const p=orderPallet(company,k.id);if(!p)return {company};
 if(zone&&p.at.fork)return {company:dropOrderPallet(company,k.id).company}; // set down on the loading zone (D3): the pallet on the forks is the one that loads
 if(!Number.isInteger(p.at.staging))return {error:`Order #${k.id}'s pallet is not on its square.`};
 return {company:dropOrderPallet(company,k.id).company};
}
// A staged pickup order loaded onto the customer's truck: done. The order pay and the reputation go to whoever loads it.
export function shipTicket(company,{id,playerId,now,zone}){
 const k=find(company,id);if(!k||k.kind!=='pickup')return {error:'No such pickup order.'};
 if(k.status!=='staged')return {error:'Stage every plank of the order first.'};
 if(now>=k.dueAt)return {error:'That order is past its time.'};
 const c=consume(company,k,zone);if(c.error)return {error:c.error};
 return {company:replace(c.company,{...k,status:'done',doneAt:now}),effects:[{playerId,piece:PIECE.pickup,rep:DONE_REP}],message:`Order #${k.id} shipped to ${k.customer}.`};
}
// A staged delivery order loaded onto a vehicle at the loading door, then unloaded at its destination: done.
export function loadTicket(company,{id,vehicle,now,zone}){
 const k=find(company,id);if(!k||k.kind!=='delivery')return {error:'No such delivery.'};
 if(k.status!=='staged')return {error:'Stage every plank of the order first.'};
 if(now>=k.dueAt)return {error:'That order is past its time.'};
 const c=consume(company,k,zone);if(c.error)return {error:c.error};
 return {company:replace(c.company,{...k,status:'loaded',vehicle:String(vehicle).slice(0,24)}),effects:[],message:`Order #${k.id} is on the truck: take it to ${k.dest||'the customer'}.`};
}
// A failed or expired order's pallet goes (wherever it is, the forks included); returns {company, planks} for the caller to send back to the racks.
export function releaseOrderPallet(company,id){const r=dropOrderPallet(company,id);return {company:r.company,planks:r.count}}
export function deliverTicket(company,{id,playerId,dest,now}){
 const k=find(company,id);if(!k||k.kind!=='delivery')return {error:'No such delivery.'};
 if(k.status!=='loaded')return {error:'Load the order onto your truck first.'};
 if(k.dest&&dest!==k.dest)return {error:'This is not the delivery address.'};
 if(now>=k.dueAt)return {error:'That order is past its time.'};
 return {company:replace(company,{...k,status:'done',doneAt:now}),effects:[{playerId,piece:PIECE.delivery,rep:DONE_REP}],message:`Order #${k.id} delivered to ${k.customer}.`};
}

// Saved on the company (progress.companies[id].tickets): bad entries are dropped, numbers clamped, at most MAX_LIST tickets.
export function normalizeTickets(value){
 if(!value||typeof value!=='object')return null;
 const n=(x,max=1e9)=>Number.isSafeInteger(x)&&x>=0&&x<=max?x:0,SQUARES=[0,1,2],STATUS=['open','taken','staged','loaded','done','failed','expired'];
 const list=(Array.isArray(value.list)?value.list:[]).filter(k=>k&&typeof k==='object'&&Number.isSafeInteger(k.id)&&k.id>0&&['pickup','delivery'].includes(k.kind)&&STATUS.includes(k.status)&&typeof k.customer==='string')
  .slice(-MAX_LIST).map(k=>{const planks=Math.max(1,Math.min(400,n(k.planks,400)));return {id:k.id,customer:k.customer.slice(0,40),kind:k.kind,planks,issuedAt:n(k.issuedAt),dueAt:n(k.dueAt),status:k.status,staged:Math.min(planks,n(k.staged,400)),...(SQUARES.includes(k.square)?{square:k.square}:{}),
   ...(typeof k.takenBy==='string'&&k.takenBy?{takenBy:k.takenBy.slice(0,64)}:{}),...(typeof k.dest==='string'&&DESTINATIONS.includes(k.dest)?{dest:k.dest}:{}),...(typeof k.vehicle==='string'&&k.vehicle?{vehicle:k.vehicle.slice(0,24)}:{}),...(Number.isSafeInteger(k.doneAt)?{doneAt:k.doneAt}:{})}});
 const released=(Array.isArray(value.released)?value.released:[]).filter(i=>Number.isInteger(i)&&i>=0&&i<RELEASES.length);
 const nextId=Math.max(n(value.nextId)||1,1+Math.max(0,...list.map(k=>k.id)));
 if(!list.length&&!n(value.day))return null;
 return {nextId,day:n(value.day,1e7),released:[...new Set(released)],list};
}

// The three staging squares (S1..S3): the taken orders (pickups and deliveries) being filled or ready. An order keeps the square stamped on its ticket when it was taken (`square`); a ticket without
// one (a save or a test from before) takes the first free square, oldest first. Derived, never saved as a list: [ticket|null, ticket|null, ticket|null].
export const stagingOf=company=>{
 const mine=ticketsOf(company).list.filter(live).sort((a,b)=>a.id-b.id),out=[null,null,null];
 for(const k of mine)if(Number.isInteger(k.square)&&k.square>=0&&k.square<STAGING_SQUARES&&!out[k.square])out[k.square]=k;
 for(const k of mine)if(!out.includes(k)){const i=out.indexOf(null);if(i>=0)out[i]=k}
 return out;
};
// A save (or a test) from before order pallets: a taken or staged order with planks counted on it but no pallet gets one on its square.
export function migrateOrderPallets(company){
 const list=palletsOf(company);let next=1+list.reduce((m,p)=>Math.max(m,p.id),0),out=list,made=false;
 stagingOf(company).forEach((k,i)=>{
  if(!k||!(k.staged>0)||out.some(p=>p.order===k.id||p.at.staging===i)||out.length>=200)return;
  out=[...out,{id:next++,product:'planks',count:Math.min(40,k.staged),at:{staging:i},order:k.id}];made=true;
 });
 return made?withPallets(company,out):company;
}