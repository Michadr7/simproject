// BZ3 Freight Exchange & BZ7 harbor gigs.
import {addXp} from './skills.js';
import {advanceTime} from './routine.js';

export const BRUCE_FEE_RATE=0.12;
export const FREIGHT_REACH=14;

export const FREIGHT_HUBS=Object.freeze({
 'eden-industries':Object.freeze({name:'Eden Industries Yard',x:860,z:-72,bruce:true}),
 'kaspian-harbor':Object.freeze({name:'Kaspian Cargo Terminal',x:215,z:345,bruce:true}),
 'eastbank-exchange':Object.freeze({name:'Eastbank Freight Exchange',x:120,z:52,bruce:false}),
 'ridgeline-timber':Object.freeze({name:'Ridgeline Timber Yard',x:85,z:50,bruce:false}),
 'husky-ranch':Object.freeze({name:'Husky Ranch',x:-90,z:-225,bruce:false}),
 'ironwood-shops':Object.freeze({name:'Ironwood Commercial Strip',x:36,z:-60,bruce:false})
});

const EDEN_ROUTES=Object.freeze([
 {cargo:'Imported Steel Coils',fromHub:'kaspian-harbor',toHub:'eden-industries',basePay:3200,xp:40},
 {cargo:'Machined Steel Parts',fromHub:'eden-industries',toHub:'eastbank-exchange',basePay:3000,xp:38},
 {cargo:'ATV Chassis Frames',fromHub:'eden-industries',toHub:'ironwood-shops',basePay:3400,xp:44},
 {cargo:'Industrial Timber Crates',fromHub:'ridgeline-timber',toHub:'eden-industries',basePay:3100,xp:40}
]);

const KASPIAN_ROUTES=Object.freeze([
 {cargo:'Marine Hardware Pallets',fromHub:'eastbank-exchange',toHub:'kaspian-harbor',basePay:2200,xp:24},
 {cargo:'Fresh Seafood Totes',fromHub:'kaspian-harbor',toHub:'ironwood-shops',basePay:2500,xp:28},
 {cargo:'Grain Export Sacks',fromHub:'husky-ranch',toHub:'kaspian-harbor',basePay:2800,xp:34},
 {cargo:'Export Tool Crates',fromHub:'eden-industries',toHub:'kaspian-harbor',basePay:3300,xp:42}
]);

const LOCAL_A_ROUTES=Object.freeze([
 {cargo:'Kiln-Dried Lumber',fromHub:'ridgeline-timber',toHub:'ironwood-shops',basePay:1600,xp:16},
 {cargo:'Barn Framing Planks',fromHub:'ridgeline-timber',toHub:'husky-ranch',basePay:2100,xp:24},
 {cargo:'Hardware Bulk Order',fromHub:'eastbank-exchange',toHub:'ironwood-shops',basePay:1700,xp:18}
]);

const LOCAL_B_ROUTES=Object.freeze([
 {cargo:'Fresh Ranch Produce',fromHub:'husky-ranch',toHub:'ironwood-shops',basePay:1800,xp:20},
 {cargo:'Bulk Grain & Wool',fromHub:'husky-ranch',toHub:'eastbank-exchange',basePay:2200,xp:26},
 {cargo:'Farm Supply Crates',fromHub:'ironwood-shops',toHub:'husky-ranch',basePay:1900,xp:20}
]);

export const HARBOR_GIGS=Object.freeze([
 Object.freeze({id:'ferry-deckhand',name:'Ferry Deckhand',hours:null,steps:4,payPerStep:650,bonusCents:1400,xpSkill:'driving',xpPerStep:6}),
 Object.freeze({id:'fish-porter',name:'Fish Market Porter',hours:Object.freeze([300,720]),steps:4,payPerStep:700,bonusCents:1600,xpSkill:'fishing',xpPerStep:7}),
 Object.freeze({id:'boat-recovery',name:'Boat Rental Recovery',hours:null,steps:3,payPerStep:900,bonusCents:1500,xpSkill:'driving',xpPerStep:8}),
 Object.freeze({id:'bay-tour',name:'Bay Tour Guide',hours:null,steps:4,payPerStep:600,bonusCents:1200,xpSkill:'hospitality',xpPerStep:6}),
 Object.freeze({id:'container-spotter',name:'Container Spotter',hours:null,steps:4,payPerStep:750,bonusCents:1500,xpSkill:'driving',xpPerStep:7})
]);

const STEP_MINUTES=15,STEP_ENERGY=5;
const okInt=(x,min,max,fb)=>Number.isSafeInteger(x)&&x>=min&&x<=max?x:fb;
const dayOf=p=>okInt(p?.housing?.day,1,1e7,1);
const validPos=pos=>Boolean(pos&&Number.isFinite(pos.x)&&Number.isFinite(pos.z));
const hasBruceHub=(fromHub,toHub)=>Boolean(FREIGHT_HUBS[fromHub]?.bruce||FREIGHT_HUBS[toHub]?.bruce);
const bruceFeeFor=(fromHub,toHub,payCents)=>hasBruceHub(fromHub,toHub)?Math.round(payCents*BRUCE_FEE_RATE):0;
const gigById=id=>HARBOR_GIGS.find(g=>g.id===id)||null;

function buildOffer(day,slot,tpl){
 const from=FREIGHT_HUBS[tpl.fromHub],to=FREIGHT_HUBS[tpl.toHub];
 const distanceM=Math.round(Math.hypot(to.x-from.x,to.z-from.z));
 const payCents=Math.round((tpl.basePay+distanceM*6)/25)*25;
 const bruceFeeCents=bruceFeeFor(tpl.fromHub,tpl.toHub,payCents);
 const netPayCents=payCents-bruceFeeCents;
 return Object.freeze({id:`freight-${day}-${slot}`,cargo:tpl.cargo,fromHub:tpl.fromHub,toHub:tpl.toHub,distanceM,payCents,bruceFeeCents,netPayCents,xp:tpl.xp});
}

export function freightOffers(day=1){
 const d=Number.isSafeInteger(day)&&day>=1?day:(Number.isFinite(day)&&day>=1?Math.floor(day):1);
 const i=d-1;
 const pick=(pool,off)=>pool[(i+off)%pool.length];
 const picked=[
  pick(EDEN_ROUTES,0),
  pick(KASPIAN_ROUTES,Math.floor(i/EDEN_ROUTES.length)),
  pick(LOCAL_A_ROUTES,0),
  pick(LOCAL_B_ROUTES,Math.floor(i/LOCAL_A_ROUTES.length))
 ];
 return Object.freeze(picked.map((tpl,slot)=>buildOffer(d,slot,tpl)));
}

function normalizeActive(a){
 if(!a||typeof a!=='object'||Array.isArray(a))return null;
 if(typeof a.id!=='string'||!a.id||a.id.length>64)return null;
 if(typeof a.cargo!=='string'||!a.cargo||a.cargo.length>80)return null;
 if(typeof a.fromHub!=='string'||!Object.hasOwn(FREIGHT_HUBS,a.fromHub))return null;
 if(typeof a.toHub!=='string'||!Object.hasOwn(FREIGHT_HUBS,a.toHub)||a.toHub===a.fromHub)return null;
 if(!Number.isSafeInteger(a.distanceM)||a.distanceM<=0||a.distanceM>1e6)return null;
 if(!Number.isSafeInteger(a.payCents)||a.payCents<=0||a.payCents>1e8)return null;
 const expectedFee=bruceFeeFor(a.fromHub,a.toHub,a.payCents);
 if(a.bruceFeeCents!==expectedFee||a.netPayCents!==a.payCents-expectedFee)return null;
 if(!Number.isSafeInteger(a.xp)||a.xp<0||a.xp>10000)return null;
 return {id:a.id,cargo:a.cargo,fromHub:a.fromHub,toHub:a.toHub,distanceM:a.distanceM,payCents:a.payCents,bruceFeeCents:a.bruceFeeCents,netPayCents:a.netPayCents,xp:a.xp,loaded:a.loaded===true};
}

function normalizeHarborGig(hg){
 if(!hg||typeof hg!=='object'||Array.isArray(hg))return null;
 const gig=gigById(hg.id);
 if(!gig||!Number.isSafeInteger(hg.step)||hg.step<0||hg.step>=gig.steps)return null;
 return {id:gig.id,step:hg.step,day:okInt(hg.day,1,1e7,1),earnedCents:okInt(hg.earnedCents,0,1e8,0)};
}

export function normalizeFreight(val){
 if(!val||typeof val!=='object'||Array.isArray(val))return null;
 const active=normalizeActive(val.active);
 const harborGig=normalizeHarborGig(val.harborGig);
 const completedIds=[];
 if(Array.isArray(val.completedIds)){
  for(const id of val.completedIds){
   if(typeof id==='string'&&id.length>0&&id.length<=64&&!completedIds.includes(id)){
    completedIds.push(id);
    if(completedIds.length>=16)break;
   }
  }
 }
 const day=okInt(val.day,0,1e7,0);
 const doneCount=okInt(val.doneCount,0,1e7,0);
 if(!active&&!harborGig&&!completedIds.length&&!doneCount)return null;
 return {active,completedIds,day,doneCount,harborGig};
}

export function acceptFreight(progress,offerId){
 const cur=normalizeFreight(progress?.freight);
 if(cur?.active)return {error:'Finish or cancel your active freight contract first.'};
 const day=dayOf(progress);
 const offer=freightOffers(day).find(o=>o.id===offerId);
 if(!offer)return {error:'That freight contract is not on today\'s board.'};
 const completedIds=cur&&cur.day===day?cur.completedIds:[];
 if(completedIds.includes(offer.id))return {error:'You already completed this freight contract today.'};
 const active={...offer,loaded:false};
 const freight={active,completedIds,day,doneCount:cur?.doneCount||0,harborGig:cur?.harborGig||null};
 return {state:{...progress,freight},contract:active,message:`Accepted ${offer.cargo}: load at ${FREIGHT_HUBS[offer.fromHub].name}.`};
}

export function loadFreight(progress,pos){
 const cur=normalizeFreight(progress?.freight);
 if(!cur?.active)return {error:'No active freight contract.'};
 if(cur.active.loaded)return {error:'Cargo is already loaded.'};
 if(!validPos(pos))return {error:'Move to the pickup hub to load cargo.'};
 const hub=FREIGHT_HUBS[cur.active.fromHub];
 if(Math.hypot(pos.x-hub.x,pos.z-hub.z)>FREIGHT_REACH)return {error:`Move within ${FREIGHT_REACH} m of ${hub.name} to load cargo.`};
 const active={...cur.active,loaded:true};
 return {state:{...progress,freight:{...cur,active}},contract:active,message:`Loaded ${active.cargo} at ${hub.name}. Deliver to ${FREIGHT_HUBS[active.toHub].name}.`};
}

export function deliverFreight(progress,pos){
 const cur=normalizeFreight(progress?.freight);
 if(!cur?.active)return {error:'No active freight contract.'};
 if(!cur.active.loaded)return {error:`Load ${cur.active.cargo} at ${FREIGHT_HUBS[cur.active.fromHub].name} first.`};
 if(!validPos(pos))return {error:'Move to the delivery hub to unload cargo.'};
 const hub=FREIGHT_HUBS[cur.active.toHub];
 if(Math.hypot(pos.x-hub.x,pos.z-hub.z)>FREIGHT_REACH)return {error:`Move within ${FREIGHT_REACH} m of ${hub.name} to deliver cargo.`};
 const day=dayOf(progress);
 const prevIds=cur.day===day?cur.completedIds:[];
 const completedIds=prevIds.includes(cur.active.id)?prevIds:[...prevIds,cur.active.id];
 const paid=cur.active.netPayCents,bruceFeeCents=cur.active.bruceFeeCents,xpGain=cur.active.xp;
 const freight={active:null,completedIds,day,doneCount:cur.doneCount+1,harborGig:cur.harborGig};
 let next={
  ...progress,
  cash:(progress?.cash||0)+paid,
  skills:progress?.skills||{},
  routine:{minutes:540,shiftStep:0,shiftDay:0,...(progress?.routine||{}),earned:(progress?.routine?.earned||0)+paid},
  standing:{...(progress?.standing||{}),town:(progress?.standing?.town||0)+1},
  freight
 };
 const xpRes=addXp(next,'driving',xpGain);
 next=xpRes.state;
 return {
  state:next,
  paid,
  bruceFeeCents,
  xp:xpGain,
  leveledUp:xpRes.leveledUp,
  level:xpRes.level,
  message:`Delivered ${cur.active.cargo} to ${hub.name} (+$${(paid/100).toFixed(2)}, +${xpGain} driving XP, +1 town standing).`
 };
}

export function cancelFreight(progress){
 const cur=normalizeFreight(progress?.freight);
 if(!cur?.active)return {error:'No active freight contract.'};
 const freight=normalizeFreight({...cur,active:null});
 return {state:{...progress,freight},message:`Cancelled freight contract (${cur.active.cargo}).`};
}

export function startHarborGig(progress,gigId){
 const gig=gigById(gigId);
 if(!gig)return {error:'Unknown harbor gig.'};
 const cur=normalizeFreight(progress?.freight);
 if(cur?.harborGig)return {error:'Finish or cancel your current harbor gig first.'};
 if(gig.hours){
  const mins=Number.isFinite(progress?.routine?.minutes)?progress.routine.minutes:0;
  if(mins<gig.hours[0]||mins>=gig.hours[1])return {error:`${gig.name} runs during dawn auction hours (5:00 AM–12:00 PM).`};
 }
 const day=dayOf(progress);
 const harborGig={id:gig.id,step:0,day,earnedCents:0};
 const base=cur||{active:null,completedIds:[],day,doneCount:0,harborGig:null};
 return {state:{...progress,freight:{...base,harborGig}},gig,harborGig,message:`Started ${gig.name} (${gig.steps} steps).`};
}

export function stepHarborGig(progress){
 const cur=normalizeFreight(progress?.freight);
 if(!cur?.harborGig)return {error:'No active harbor gig.'};
 const gig=gigById(cur.harborGig.id);
 if(!gig)return {error:'Unknown harbor gig.'};
 const nextStep=cur.harborGig.step+1,done=nextStep>=gig.steps;
 const paid=gig.payPerStep+(done?gig.bonusCents:0);
 const earnedCents=(cur.harborGig.earnedCents||0)+paid;
 const prevEnergy=Number.isFinite(progress?.life?.energy)?progress.life.energy:100;
 const life={...(progress?.life||{}),energy:Math.max(0,prevEnergy-STEP_ENERGY)};
 const freight=done?normalizeFreight({...cur,harborGig:null}):{...cur,harborGig:{...cur.harborGig,step:nextStep,earnedCents}};
 let next={
  ...progress,
  cash:(progress?.cash||0)+paid,
  life,
  skills:progress?.skills||{},
  routine:{minutes:540,shiftStep:0,shiftDay:0,...(progress?.routine||{}),earned:(progress?.routine?.earned||0)+paid},
  freight
 };
 const xpRes=addXp(next,gig.xpSkill,gig.xpPerStep);
 next=advanceTime(xpRes.state,STEP_MINUTES);
 if(done)next={...next,standing:{...(next.standing||{}),town:(next.standing?.town||0)+1}};
 return {
  state:next,
  paid,
  completed:done,
  step:nextStep,
  steps:gig.steps,
  earnedCents,
  xp:gig.xpPerStep,
  xpSkill:gig.xpSkill,
  leveledUp:xpRes.leveledUp,
  message:done?`${gig.name} complete! Earned $${(earnedCents/100).toFixed(2)} (+1 town standing).`:`${gig.name}: step ${nextStep}/${gig.steps} (+$${(paid/100).toFixed(2)}).`
 };
}

export function cancelHarborGig(progress){
 const cur=normalizeFreight(progress?.freight);
 if(!cur?.harborGig)return {error:'No active harbor gig.'};
 const freight=normalizeFreight({...cur,harborGig:null});
 return {state:{...progress,freight},message:'Harbor gig cancelled.'};
}
