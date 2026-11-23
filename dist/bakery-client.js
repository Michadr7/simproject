// W-J client projection for the host's bakery board (notes/world-system-design.md).
import {activeView,availableContracts,marketContracts} from './gig-bridge.js';
import {abandonGig,deliverHaul,gameMinutes,pickNeedHaul} from './gigs.js';
import {isBakeryNeed} from './bakery-needs.js';

export function sharedBakeryOffers(progress,board,now,market=false){
 const offers=market?marketContracts:availableContracts;
 const personal=offers({...progress,needs:(progress.needs||[]).filter(n=>!isBakeryNeed(n))});
 if(!board||personal.some(o=>!o.needId)||progress.gigs?.active)return personal;
 const minute=Math.max(board.now,now);
 const unavailable=new Map(board.claims);
 const needs=board.needs.filter(n=>(unavailable.get(n.id)??-1)<=minute);
 const shared=marketContracts({...progress,needs,housing:{...progress.housing,day:Math.floor(minute/1440)+1},
  routine:{...progress.routine,minutes:minute%1440}}).map(o=>({...o,shared:true}));
 return [...shared,...personal].slice(0,4).map((o,i)=>({...o,localId:o.id,id:'slot-'+i}));
}

export function applyBakeryReceipt(progress,request,receipt){
 const {action,need,load}=request;
 const at=receipt.at??gameMinutes(progress);
 const projected={...progress,needs:need?[need]:[]};
 let next;
 if(action==='accept'){
  if(progress.gigs.active)return {error:'Finish your active gig first.'};
  next={...progress,gigs:{...progress.gigs,active:receipt.active,nextId:receipt.active.id+1}};
 }else if(action==='load'){
  const result=pickNeedHaul(projected,at,load);
  if(result.error)return result;
  next={...result.state,equipped:null,gigs:{...result.state.gigs,active:receipt.active}};
 }else if(action==='deliver'){
  const result=deliverHaul(projected,at);
  if(result.error)return result;
  next={...result.state,cash:progress.cash+receipt.paid,
   routine:{...progress.routine,earned:(progress.routine.earned||0)+receipt.paid}};
 }else{
  const result=abandonGig(projected);
  if(result.error)return result;
  next=result.state;
 }
 next={...next,needs:progress.needs,bakeryStock:progress.bakeryStock};
 return {state:{...next,activeJob:activeView(next)}};
}
