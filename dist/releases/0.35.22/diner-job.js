// Diner shift state, table/ticket loop, and tips (notes/diner-design.md).
import {recipeById,menuForRank,scoreOrder} from './diner-recipes.js';

export const DINER_ID='diner',DINER_BONUS_PER_RANK=1000,DINER_FAIL_REP=-2;
export const DINER_HOURS=Object.freeze({from:480,to:1080,lastIn:1020});
export const DINER_PIECE_PAY=Object.freeze({ordersTaken:50,platesServed:100,tablesBused:50,drinksBrewed:120,foodPrepped:160});
export const DINER_RANKS=Object.freeze([
 Object.freeze({id:'waiter',name:'Waiter',needs:Object.freeze({level:1,shifts:0,rep:0}),wage:800,grants:Object.freeze([]),tasks:Object.freeze(['take_order','serve_plate','bus_table'])}),
 Object.freeze({id:'barista-cook',name:'Barista & Cook',needs:Object.freeze({level:2,shifts:2,rep:15}),wage:1100,grants:Object.freeze([]),tasks:Object.freeze(['brew_drink','prep_food'])}),
 Object.freeze({id:'head-cook',name:'Head Cook',needs:Object.freeze({level:4,shifts:5,rep:35}),wage:1400,grants:Object.freeze([]),tasks:Object.freeze(['combo_order','bake_pizza'])}),
 Object.freeze({id:'shift-manager',name:'Shift Manager',needs:Object.freeze({level:7,shifts:10,rep:55}),wage:1700,grants:Object.freeze([]),tasks:Object.freeze(['rush_hour'])})
]);
// Four dining tables matching dist/shops.js:22 (x +/-3.8, z -0.7 / 2.0, chairs at z +/-0.85).
export const TABLES=Object.freeze([
 Object.freeze({id:0,name:'Table 1',x:-3.8,z:-0.7,chairs:Object.freeze([Object.freeze({x:-3.8,z:-1.55,yaw:0}),Object.freeze({x:-3.8,z:0.15,yaw:Math.PI})])}),
 Object.freeze({id:1,name:'Table 2',x:-3.8,z:2.0,chairs:Object.freeze([Object.freeze({x:-3.8,z:1.15,yaw:0}),Object.freeze({x:-3.8,z:2.85,yaw:Math.PI})])}),
 Object.freeze({id:2,name:'Table 3',x:3.8,z:-0.7,chairs:Object.freeze([Object.freeze({x:3.8,z:-1.55,yaw:0}),Object.freeze({x:3.8,z:0.15,yaw:Math.PI})])}),
 Object.freeze({id:3,name:'Table 4',x:3.8,z:2.0,chairs:Object.freeze([Object.freeze({x:3.8,z:1.15,yaw:0}),Object.freeze({x:3.8,z:2.85,yaw:Math.PI})])})
]);
export const MAX_TICKETS=3,MAX_CARRY=2,PATIENCE_MIN=100,EAT_MIN=25,NPC_PREP_MIN=6,ARRIVAL_MIN=15;

const DEFAULT_CUSTOMERS=Object.freeze(['Maya','Theo','Lucia','Marcus','Nora','Daniel','Clara','Owen','Elise','Jonas']);
const TABLE_STATUSES=new Set(['free','seated','ordered','eating','dirty']);
const TICKET_STAGES=new Set(['queued','ready','carried','open']);
const EPS=1e-9;

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const isInt=(x,min=0,max=1e9)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const fin=(x,def=0)=>Number.isFinite(x)?x:def;
const emptyTable=id=>({id,status:'free',customer:null,ticketId:null,seatExpiresAt:null,eatEndsAt:null,dirtySince:null});

export function hashOf(...parts){
 let h=2166136261;
 for(const ch of parts.join('|')){h^=ch.codePointAt(0);h=Math.imul(h,16777619)}
 h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;
 return h>>>0;
}

export function arrivalFor(day,slot,{seed=7301,rank=1,names=DEFAULT_CUSTOMERS}={}){
 const d=isInt(day,1)?day:1,sl=isInt(slot,0)?slot:0,sd=Number.isSafeInteger(seed)?seed:7301;
 const list=Array.isArray(names)&&names.length?names:DEFAULT_CUSTOMERS;
 const menu=menuForRank(rank),h=hashOf(sd,'diner',d,sl);
 const arrive=sl===0||(h%100)<85;
 const customerName=String(list[hashOf(sd,'who',d,sl)%list.length]);
 const recipeId=menu[hashOf(sd,'order',d,sl)%menu.length].id;
 const tableHint=hashOf(sd,'table',d,sl)%TABLES.length;
 return {arrive,day:d,slot:sl,customerName,recipeId,tableHint};
}

export function freshDinerShift({day=1,rank=1,seed=7301,startMin=DINER_HOURS.from}={}){
 return {
  day:isInt(day,1)?day:1,rank:clamp(isInt(rank,1,4)?rank:1,1,4),
  seed:Number.isSafeInteger(seed)?seed:7301,startMin:clamp(isInt(startMin,0,1439)?startMin:DINER_HOURS.from,0,1439),
  elapsedMin:0,nextSlot:0,nextTicketId:1,
  tables:TABLES.map(t=>emptyTable(t.id)),tickets:[],carried:[],
  tipsCents:0,repDelta:0,ordersTaken:0,servedOrders:0,failedOrders:0,busedTables:0
 };
}

export function normalizeDinerShift(value){
 const v=value&&typeof value==='object'&&!Array.isArray(value)?value:null;
 if(!v)return freshDinerShift();
 const base=freshDinerShift({day:v.day,rank:v.rank,seed:v.seed,startMin:v.startMin});
 base.elapsedMin=Math.max(0,fin(v.elapsedMin,0));
 base.nextSlot=isInt(v.nextSlot,0)?v.nextSlot:0;
 base.nextTicketId=isInt(v.nextTicketId,1)?v.nextTicketId:1;
 base.tipsCents=isInt(v.tipsCents,0,1e8)?v.tipsCents:0;
 base.repDelta=isInt(v.repDelta,-1000,1000)?v.repDelta:0;
 base.ordersTaken=isInt(v.ordersTaken,0,1e6)?v.ordersTaken:0;
 base.servedOrders=isInt(v.servedOrders,0,1e6)?v.servedOrders:0;
 base.failedOrders=isInt(v.failedOrders,0,1e6)?v.failedOrders:0;
 base.busedTables=isInt(v.busedTables,0,1e6)?v.busedTables:0;
 const rawTables=Array.isArray(v.tables)?v.tables:[];
 base.tables=TABLES.map(spec=>{
  const rt=rawTables[spec.id];
  if(!rt||typeof rt!=='object'||!TABLE_STATUSES.has(rt.status))return emptyTable(spec.id);
  const cust=rt.customer&&typeof rt.customer==='object'&&typeof rt.customer.name==='string'&&recipeById(rt.customer.recipeId)
   ?{name:rt.customer.name.slice(0,40),recipeId:rt.customer.recipeId}:null;
  if((rt.status==='seated'||rt.status==='ordered')&&!cust)return emptyTable(spec.id);
  return {
   id:spec.id,status:rt.status,customer:rt.status==='free'||rt.status==='dirty'?null:cust,
   ticketId:rt.status==='ordered'&&isInt(rt.ticketId,1)?rt.ticketId:null,
   seatExpiresAt:rt.status==='seated'&&Number.isFinite(rt.seatExpiresAt)?Math.max(0,rt.seatExpiresAt):null,
   eatEndsAt:rt.status==='eating'&&Number.isFinite(rt.eatEndsAt)?Math.max(0,rt.eatEndsAt):null,
   dirtySince:rt.status==='dirty'&&Number.isFinite(rt.dirtySince)?Math.max(0,rt.dirtySince):null
  };
 });
 const rawTickets=Array.isArray(v.tickets)?v.tickets:[];
 const seen=new Set();
 for(const t of rawTickets){
  if(!t||typeof t!=='object'||!isInt(t.id,1)||seen.has(t.id))continue;
  if(!isInt(t.tableId,0,TABLES.length-1)||!recipeById(t.recipeId))continue;
  if(base.tickets.length>=MAX_TICKETS)break;
  seen.add(t.id);
  const orderedAt=Math.max(0,fin(t.orderedAt,0));
  base.tickets.push({
   id:t.id,tableId:t.tableId,customerName:typeof t.customerName==='string'?t.customerName.slice(0,40):'Guest',
   recipeId:t.recipeId,orderedAt,expiresAt:Math.max(orderedAt,fin(t.expiresAt,orderedAt+PATIENCE_MIN)),
   stage:TICKET_STAGES.has(t.stage)?t.stage:'open',
   npcReadyAt:Number.isFinite(t.npcReadyAt)?Math.max(0,t.npcReadyAt):null,
   tipLost:t.tipLost===true,penalized:t.penalized===true
  });
  if(base.nextTicketId<=t.id)base.nextTicketId=t.id+1;
 }
 base.carried=(Array.isArray(v.carried)?v.carried:[]).filter(id=>isInt(id,1)&&seen.has(id)).slice(0,MAX_CARRY);
 return base;
}

const cloneState=s=>({...s,tables:s.tables.map(t=>({...t,customer:t.customer?{...t.customer}:null})),tickets:s.tickets.map(t=>({...t})),carried:[...s.carried]});

function maxSeatsAt(s,atMin,opts){
 if(isInt(opts?.maxTables,1,TABLES.length))return opts.maxTables;
 const minOfDay=(s.startMin+atMin)%1440,rush=minOfDay>=690&&minOfDay<840?1:0;
 return clamp((s.rank>=3?4:s.rank===2?3:2)+rush,1,TABLES.length);
}

export function step(state,dtGameMin,opts={}){
 const s=cloneState(normalizeDinerShift(state)),events=[];
 if(!Number.isFinite(dtGameMin)||dtGameMin<=0)return {state:s,events};
 const target=s.elapsedMin+dtGameMin;
 for(let guard=0;guard<512;guard++){
  let best=null;
  const consider=(t,kind,ref)=>{if(t<=target+EPS&&(!best||t<best.t-EPS||(Math.abs(t-best.t)<=EPS&&kind.pri<best.pri)))best={t,kind:kind.name,pri:kind.pri,ref}};
  for(const tb of s.tables){
   if(tb.status==='eating'&&tb.eatEndsAt!==null)consider(tb.eatEndsAt,{name:'eat',pri:1},tb.id);
   if(tb.status==='seated'&&tb.seatExpiresAt!==null)consider(tb.seatExpiresAt,{name:'seat-exp',pri:4},tb.id);
  }
  for(const tk of s.tickets){
   if(tk.stage==='queued'&&tk.npcReadyAt!==null)consider(tk.npcReadyAt,{name:'npc',pri:2},tk.id);
   consider(tk.expiresAt,{name:'exp',pri:3},tk.id);
  }
  const slotT=s.nextSlot*ARRIVAL_MIN;
  if(slotT<=target+EPS)consider(slotT,{name:'arr',pri:5},s.nextSlot);
  if(!best)break;
  const evT=best.t;
  if(best.kind==='eat'){
   const tb=s.tables[best.ref];
   tb.status='dirty';tb.customer=null;tb.eatEndsAt=null;tb.dirtySince=evT;
   events.push({type:'table-dirty',tableId:tb.id,at:evT});
  }else if(best.kind==='npc'){
   const tk=s.tickets.find(x=>x.id===best.ref);
   if(tk){tk.stage='ready';tk.npcReadyAt=null;events.push({type:'order-ready',ticketId:tk.id,tableId:tk.tableId,at:evT})}
  }else if(best.kind==='exp'){
   const idx=s.tickets.findIndex(x=>x.id===best.ref);
   if(idx>=0){
    const tk=s.tickets[idx];s.tickets.splice(idx,1);
    s.carried=s.carried.filter(id=>id!==tk.id);
    s.tables[tk.tableId]=emptyTable(tk.tableId);
    s.failedOrders+=1;
    if(!tk.penalized)s.repDelta+=DINER_FAIL_REP;
    events.push({type:'order-expired',ticketId:tk.id,tableId:tk.tableId,repDelta:tk.penalized?0:DINER_FAIL_REP,at:evT});
   }
  }else if(best.kind==='seat-exp'){
   const tb=s.tables[best.ref];
   if(tb.status==='seated'){
    s.tables[tb.id]=emptyTable(tb.id);
    s.failedOrders+=1;s.repDelta+=DINER_FAIL_REP;
    events.push({type:'seat-expired',tableId:tb.id,repDelta:DINER_FAIL_REP,at:evT});
   }
  }else if(best.kind==='arr'){
   const arr=arrivalFor(s.day,best.ref,{seed:s.seed,rank:s.rank,names:opts.names});
   s.nextSlot=best.ref+1;
   const free=s.tables.filter(tb=>tb.status==='free');
   const occupied=s.tables.filter(tb=>tb.status==='seated'||tb.status==='ordered'||tb.status==='eating').length;
   if(arr.arrive&&free.length&&occupied<maxSeatsAt(s,evT,opts)&&(s.tickets.length+s.tables.filter(x=>x.status==='seated').length)<MAX_TICKETS){
    const chosen=free.find(tb=>tb.id>=arr.tableHint)||free[0];
    chosen.status='seated';chosen.customer={name:arr.customerName,recipeId:arr.recipeId};
    chosen.seatExpiresAt=evT+PATIENCE_MIN;
    events.push({type:'customer-arrived',tableId:chosen.id,customerName:arr.customerName,recipeId:arr.recipeId,slot:best.ref,at:evT});
   }
  }
 }
 s.elapsedMin=target;
 return {state:s,events};
}

export function takeOrder(state,tableId){
 const s=cloneState(normalizeDinerShift(state)),tb=s.tables[tableId];
 if(!tb||tb.status!=='seated'||!tb.customer)return {error:'No waiting customer at that table.',state};
 if(s.tickets.length>=MAX_TICKETS)return {error:'Ticket rail is full.',state};
 const ticket={
  id:s.nextTicketId++,tableId:tb.id,customerName:tb.customer.name,recipeId:tb.customer.recipeId,
  orderedAt:s.elapsedMin,expiresAt:s.elapsedMin+PATIENCE_MIN,
  stage:s.rank>=2?'open':'queued',npcReadyAt:s.rank>=2?null:s.elapsedMin+NPC_PREP_MIN,
  tipLost:false,penalized:false
 };
 tb.status='ordered';tb.ticketId=ticket.id;tb.seatExpiresAt=null;
 s.tickets.push(ticket);s.ordersTaken+=1;
 return {ok:true,ticket,piece:'ordersTaken',state:s};
}

export function pickupOrder(state,ticketId){
 const s=cloneState(normalizeDinerShift(state)),tk=s.tickets.find(x=>x.id===ticketId);
 if(!tk)return {error:'Unknown ticket.',state};
 if(tk.stage!=='ready')return {error:'Order is not ready on the pass counter.',state};
 if(s.carried.includes(ticketId))return {error:'Already carrying this order.',state};
 if(s.carried.length>=MAX_CARRY)return {error:'Hands are full.',state};
 tk.stage='carried';s.carried.push(ticketId);
 return {ok:true,state:s};
}

export function failOrder(state,ticketId,reason='failed'){
 const s=cloneState(normalizeDinerShift(state)),idx=s.tickets.findIndex(x=>x.id===ticketId);
 if(idx<0)return {error:'Unknown ticket.',state};
 const tk=s.tickets[idx];s.tickets.splice(idx,1);
 s.carried=s.carried.filter(id=>id!==ticketId);
 s.tables[tk.tableId]=emptyTable(tk.tableId);
 s.failedOrders+=1;
 const repDelta=tk.penalized?0:DINER_FAIL_REP;
 s.repDelta+=repDelta;
 return {ok:false,failed:true,reason,tipCents:0,repDelta,wageDelta:0,state:s};
}

export function serveOrder(state,ticketId,dish=null){
 const s=cloneState(normalizeDinerShift(state)),idx=s.tickets.findIndex(x=>x.id===ticketId);
 if(idx<0)return {error:'Unknown ticket.',state};
 const tk=s.tickets[idx],recipe=recipeById(tk.recipeId);
 if(!recipe)return failOrder(s,ticketId,'invalid-recipe');
 const waitMin=Math.max(0,s.elapsedMin-tk.orderedAt);
 if(waitMin>PATIENCE_MIN+EPS)return failOrder(s,ticketId,'expired');
 let res;
 if(dish&&typeof dish==='object'){
  res=scoreOrder(recipe,dish.madeParts,dish.cookSecs,waitMin);
  if(!res.ok){
   tk.tipLost=true;tk.penalized=true;s.failedOrders+=1;s.repDelta+=DINER_FAIL_REP;
   return {ok:false,failed:true,remake:true,tipCents:0,repDelta:DINER_FAIL_REP,wageDelta:0,score:res,state:s};
  }
 }else{
  if(tk.stage==='queued')return {error:'Order is still being prepared.',state};
  if(tk.stage==='open')return {error:'Cook or brew this order before serving.',state};
  res=scoreOrder(recipe,recipe.parts.map(x=>x.id),recipe.cookSec,waitMin);
 }
 const tipCents=tk.tipLost?0:res.tipCents;
 s.tickets.splice(idx,1);s.carried=s.carried.filter(id=>id!==ticketId);
 s.tipsCents+=tipCents;s.servedOrders+=1;
 const tb=s.tables[tk.tableId];
 tb.status='eating';tb.ticketId=null;tb.eatEndsAt=s.elapsedMin+EAT_MIN;
 return {ok:true,failed:false,tipCents,repDelta:0,wageDelta:0,score:res,piece:'platesServed',state:s};
}

export function busTable(state,tableId){
 const s=cloneState(normalizeDinerShift(state)),tb=s.tables[tableId];
 if(!tb||tb.status!=='dirty')return {error:'Table does not need busing.',state};
 s.tables[tableId]=emptyTable(tableId);s.busedTables+=1;
 return {ok:true,piece:'tablesBused',state:s};
}

export const shiftBonus=(rank,allTasksDone=true)=>allTasksDone?DINER_BONUS_PER_RANK*clamp(isInt(rank,1,4)?rank:1,1,4):0;

export function shiftSummary(state,{rank=state?.rank||1,paidMinutes=0,allTasksDone=true,pieces={}}={}){
 const s=normalizeDinerShift(state),r=clamp(isInt(rank,1,4)?rank:1,1,4);
 const wagePerHour=DINER_RANKS[r-1].wage;
 const wageCents=Math.round(Math.max(0,fin(paidMinutes,0))*wagePerHour/60);
 const piecePayCents=Object.entries(pieces||{}).reduce((sum,[k,n])=>sum+(DINER_PIECE_PAY[k]||0)*(isInt(n,0)?n:0),0);
 const bonusCents=shiftBonus(r,allTasksDone),tipsCents=s.tipsCents;
 return {wageCents,piecePayCents,tipsCents,bonusCents,totalCents:wageCents+piecePayCents+tipsCents+bonusCents,repDelta:s.repDelta};
}
