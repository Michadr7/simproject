// B-PURE: Ironwood Bakery flour and coffee-beans restock needs in dist/bakery-needs.js, pure.
import assert from 'node:assert/strict';
import {BAKERY as BG_BAKERY,DEMAND as BG_DEMAND,GOODS as BG_GOODS,SACKS_PER_PALLET} from '../dist/bakery-goods.js';
import {freshProgress,normalizeProgress} from '../dist/jobs.js';
import {runWorldDay} from '../dist/world-tick.js';
import {needBoard,acceptGig,pickNeedHaul,deliverHaul,abandonGig} from '../dist/gigs.js';
import {normalizeNeeds,DUE_DAYS} from '../dist/needs.js';
import {
 BAKERY,SUPPLIER,SUPPLIER_LABEL,BAKERY_DEMAND,CADENCE_MOD,MAX_OPEN_BAKERY_NEEDS,MAX_NEW_PER_DAY,CARRY_MODES,
 bakeryDayHash,isBakeryNeed,isOldBakeryPlankNeed,qtyFor,needsVehicle,needsForStock,fillNeed,expireOldPlankNeeds,
 pickupText,loadedText,trackerText,needTitle,needDescription
} from '../dist/bakery-needs.js';

// 1 constants imported from bakery-goods.js (never copied) + Eden Wholesale supplier
assert.equal(BAKERY,BG_BAKERY);
assert.equal(SUPPLIER,'property:eden-wholesale');
assert.equal(SUPPLIER_LABEL,'Eden Wholesale');
assert.equal(BAKERY_DEMAND.flour,BG_DEMAND.flour[BG_BAKERY]);
assert.equal(BAKERY_DEMAND['coffee-beans'],BG_DEMAND['coffee-beans'][BG_BAKERY]);
assert.equal(BAKERY_DEMAND.flour.target,6);assert.equal(BAKERY_DEMAND.flour.max,18);
assert.equal(BAKERY_DEMAND['coffee-beans'].target,4);assert.equal(BAKERY_DEMAND['coffee-beans'].max,12);
assert.equal(CARRY_MODES.sack,'hand');assert.equal(CARRY_MODES.pallet,'vehicle');
assert.equal(needsVehicle(SACKS_PER_PALLET-1),false);assert.equal(needsVehicle(SACKS_PER_PALLET),true);

// 2 qtyFor thresholds, refill target, supplier cap, string & object forms
assert.equal(qtyFor('flour',0),5);assert.equal(qtyFor('flour',1),4);assert.equal(qtyFor('flour',2),0);assert.equal(qtyFor('flour',6),0);
assert.equal(qtyFor('coffee-beans',0),3);assert.equal(qtyFor('coffee-beans',1),2);assert.equal(qtyFor('coffee-beans',2),0);
assert.equal(qtyFor(BAKERY_DEMAND.flour,0,3),3);assert.equal(qtyFor('flour',0,0),0);

// 3 cadence: fires only when dayHash % 8 === 0; shape round-trips through needs.js normalizeNeeds
for(let h=1;h<CADENCE_MOD;h++)assert.equal(needsForStock({flour:0,'coffee-beans':0},h,[]),null);
{const n=needsForStock({flour:0,'coffee-beans':4},0,[],{day:5});
 assert(n,'fires when dayHash % 8 === 0');
 assert.equal(n.id,'restock|property:alder-bakery|flour|5');
 assert.equal(n.kind,'restock');assert.equal(n.place,BAKERY);assert.equal(n.good,'flour');
 assert.equal(n.origin,SUPPLIER);assert.equal(n.qty,5);assert.equal(n.filled,0);
 assert.equal(n.openedDay,5);assert.equal(n.status,'open');assert.equal(n.unitCents,BG_GOODS.flour.baseCents);
 assert(n.dueDay>=5+DUE_DAYS.restock&&n.dueDay<=5+DUE_DAYS.restock+1);
 assert.deepEqual(normalizeNeeds([n]),[n]);}

// 4 {seed, day} hash cadence mode: deterministic, fires on matching days, skips non-matching days
{let fired=0,skipped=0;
 for(let d=0;d<64;d++){const n=needsForStock({flour:0,'coffee-beans':4},{seed:7301,day:d},[]);if(n){fired++;assert.equal(n.openedDay,d)}else skipped++}
 assert(fired>0&&skipped>0,'hash cadence fires on some days and skips others');
 const a=needsForStock({flour:0,'coffee-beans':0},{seed:7301,day:12},[]),b=needsForStock({flour:0,'coffee-beans':0},{seed:7301,day:12},[]);
 assert.deepEqual(a,b);}

// 5 caps: max 1 new need per day, fewer than 2 open, hysteresis, skips already-open good
{const bothLow={flour:0,'coffee-beans':0};
 const first=needsForStock(bothLow,8,[],{day:10});
 assert(first&&first.good==='coffee-beans','tie on fill 0 picks deterministically');
 // same day: blocked by MAX_NEW_PER_DAY (1)
 assert.equal(MAX_NEW_PER_DAY,1);
 assert.equal(needsForStock(bothLow,16,[first],{day:10}),null);
 // next day: first is still open (1 open < 2), so the other good can open
 const second=needsForStock(bothLow,16,[first],{day:11});
 assert(second&&second.good==='flour'&&second.openedDay===11);
 // now 2 open === MAX_OPEN_BAKERY_NEEDS: blocked even if another bakery good existed
 assert.equal(MAX_OPEN_BAKERY_NEEDS,2);
 assert.equal(needsForStock(bothLow,24,[first,second],{day:12}),null);
 // hysteresis: closed on day 11 cannot reopen on day 11, can reopen on day 12
 const closed={...second,status:'filled',closedDay:11};
 assert.equal(needsForStock({flour:0,'coffee-beans':4},0,[closed],{day:11}),null);
 const reopened=needsForStock({flour:0,'coffee-beans':4},0,[closed],{day:12});
 assert(reopened&&reopened.good==='flour'&&reopened.openedDay===12);}

// 6 fillNeed: partial, exact, over-delivery, already closed, immutable
{const orig=needsForStock({flour:0,'coffee-beans':4},0,[],{day:5});
 const snap=JSON.stringify(orig);
 const r1=fillNeed(orig,2,{day:5});
 assert.equal(JSON.stringify(orig),snap,'fillNeed does not mutate input');
 assert.equal(r1.accepted,2);assert.equal(r1.over,0);assert.equal(r1.remaining,3);assert.equal(r1.filled,false);
 assert.equal(r1.need.filled,2);assert.equal(r1.need.status,'open');assert.equal(r1.cents,2*BG_GOODS.flour.baseCents);
 const r2=fillNeed(r1.need,5,{day:6});
 assert.equal(r2.accepted,3);assert.equal(r2.over,2);assert.equal(r2.remaining,0);assert.equal(r2.filled,true);
 assert.equal(r2.need.filled,5);assert.equal(r2.need.status,'filled');assert.equal(r2.need.closedDay,6);assert.deepEqual(r2.need.claims,{});
 const r3=fillNeed(r2.need,2,{day:6});
 assert.equal(r3.accepted,0);assert.equal(r3.over,2);assert.equal(r3.filled,true);assert.equal(r3.cents,0);}

// 7 expireOldPlankNeeds: old-save shapes, idempotent, preserves houses/supplier/closed/bakery-goods
{const oldSave=[
  {id:'restock|property:alder-bakery|planks|1',kind:'restock',place:BAKERY,good:'planks',qty:8,filled:0,status:'open'},
  {id:'legacy-no-status',place:BAKERY,good:'planks'}, // old/minimal shape with missing status and kind
  {id:'restock|property:alder-bakery|planks|0',kind:'restock',place:BAKERY,good:'planks',qty:8,filled:8,status:'filled',closedDay:0},
  {id:'restock|property:alder-bakery|planks|2',kind:'restock',place:BAKERY,good:'planks',qty:8,filled:0,status:'expired',closedDay:2},
  {id:'restock|property:house-r1|planks|3',kind:'restock',place:'property:house-r1',good:'planks',qty:4,filled:0,status:'open'},
  {id:'restock|property:eastbank-supply|planks|3',kind:'restock',place:'property:eastbank-supply',good:'planks',qty:16,filled:0,status:'open'},
  {id:'restock|property:alder-bakery|flour|4',kind:'restock',place:BAKERY,good:'flour',qty:5,filled:0,status:'open'}
 ];
 const snap=JSON.stringify(oldSave);
 const cleaned=expireOldPlankNeeds(oldSave);
 assert.equal(JSON.stringify(oldSave),snap,'expireOldPlankNeeds does not mutate input');
 assert.equal(cleaned.length,5);
 assert(!cleaned.some(n=>isOldBakeryPlankNeed(n)));
 assert(cleaned.some(n=>n.id==='restock|property:alder-bakery|planks|0'));
 assert(cleaned.some(n=>n.id==='restock|property:alder-bakery|planks|2'));
 assert(cleaned.some(n=>n.place==='property:house-r1'&&n.good==='planks'));
 assert(cleaned.some(n=>n.place==='property:eastbank-supply'&&n.good==='planks'));
 assert(cleaned.some(n=>isBakeryNeed(n)&&n.good==='flour'));
 // idempotent
 assert.deepEqual(expireOldPlankNeeds(cleaned),cleaned);
 // keepIds preserves an active gig's needId
 const kept=expireOldPlankNeeds(oldSave,['restock|property:alder-bakery|planks|1']);
 assert(kept.some(n=>n.id==='restock|property:alder-bakery|planks|1'));
 assert(!kept.some(n=>n.id==='legacy-no-status'));}

// 8 gig tracker & board text helpers
assert.equal(pickupText('flour'),'Load the flour sacks at Eden Wholesale (E)');
assert.equal(pickupText('coffee-beans'),'Load the coffee bean sacks at Eden Wholesale (E)');
assert.equal(pickupText('planks'),'');
assert.equal(loadedText('flour'),'Flour sacks loaded: deliver them to Ironwood Bakery.');
assert.equal(loadedText('coffee-beans'),'Coffee bean sacks loaded: deliver them to Ironwood Bakery.');
assert.equal(trackerText({needGood:'flour',haul:0}),'Load the flour sacks at Eden Wholesale (E), then deliver them.');
assert.equal(trackerText({needGood:'flour',haul:5}),'Flour sacks loaded: deliver them to Ironwood Bakery.');
assert.equal(trackerText({needGood:'coffee-beans',haul:0}),'Load the coffee bean sacks at Eden Wholesale (E), then deliver them.');
assert.equal(trackerText({needGood:'coffee-beans',haul:3}),'Coffee bean sacks loaded: deliver them to Ironwood Bakery.');
assert.equal(trackerText('flour',{loaded:false}),'Load the flour sacks at Eden Wholesale (E), then deliver them.');
assert.equal(trackerText('flour',{loaded:true}),'Flour sacks loaded: deliver them to Ironwood Bakery.');
assert.equal(trackerText({needGood:'planks',haul:0}),'');
assert.equal(needTitle('flour'),'Flour for the bakery');
assert.equal(needTitle('coffee-beans'),'Coffee beans for the bakery');
assert.equal(needDescription('flour',5),'Ironwood Bakery is running low. Bring 5 sacks of flour from Eden Wholesale.');
assert.equal(needDescription('flour',1),'Ironwood Bakery is running low. Bring 1 sack of flour from Eden Wholesale.');

// 9 garbage safety: never throws
for(const bad of [null,undefined,0,NaN,-1,1.5,'x',[],{},true]){
 assert.equal(needsForStock(bad,bad,bad,bad),null);
 assert.equal(qtyFor(bad,bad,bad),0);
 assert.equal(fillNeed(bad,bad,bad).accepted,0);
 assert(Array.isArray(expireOldPlankNeeds(bad,bad)));
 assert.equal(typeof pickupText(bad,bad),'string');
 assert.equal(typeof loadedText(bad,bad),'string');
 assert.equal(typeof trackerText(bad,bad),'string');
 assert.equal(typeof needTitle(bad),'string');
 assert.equal(typeof needDescription(bad,bad,bad,bad),'string');
 assert.equal(typeof bakeryDayHash(bad,bad,bad),'number');
}
assert.deepEqual(expireOldPlankNeeds([null,undefined,5,'x',[]]),[]);
assert.equal(needsForStock({flour:'many','coffee-beans':-3},0,[null,5,'x']),null);

// The real board and save paths use the new goods, keep an active legacy plank job, and pay only for delivered cargo.
{
 const fresh=freshProgress(),truck={uid:'v1',model:'offroad',x:39.7,z:-56.2,yaw:0};
 const stock={flour:0,'coffee-beans':4},flour=needsForStock(stock,0,[],{day:0});
 const beans=needsForStock({flour:6,'coffee-beans':0},0,[],{day:0});
 const legacy={...flour,id:'restock|property:alder-bakery|planks|0',good:'planks',origin:'property:sawmill'};
 const oldActive={...fresh.gigs,active:{id:1,type:'need-restock',needId:legacy.id,needGood:'planks',needQty:8,origin:{id:'sawmill',x:104,z:-274.5},places:[{id:'alder-bakery',x:17.75,z:-76.35}]}};
 assert.equal(normalizeProgress({...fresh,needs:[legacy]}).needs.length,0);
 assert.equal(normalizeProgress({...fresh,needs:[legacy],gigs:oldActive}).needs[0]?.id,legacy.id);
 const day=bakeryDayHash(fresh.world.seed,0,'flour')%CADENCE_MOD===0?0:Array.from({length:100},(_,i)=>i+1).find(i=>bakeryDayHash(fresh.world.seed,i,'flour')%CADENCE_MOD===0);
 assert(runWorldDay({...fresh,world:{...fresh.world,day:day-1}},day).needs.some(isBakeryNeed));
 for(const [need,units,mode] of [[beans,1,'walk'],[flour,SACKS_PER_PALLET,'vehicle']]){
  const seeded={...fresh,needs:[need]},now=540;
  const offer=needBoard(seeded,now)[0];assert.equal(offer.mode,mode);assert.equal(!!offer.blocked,mode==='vehicle');assert.deepEqual([offer.origin.x,offer.origin.z],[39.4,-61.1]);
  const p={...seeded,vehicles:mode==='vehicle'?[truck]:[]};
  const accepted=acceptGig(p,0,now).state;assert(accepted);
  assert(deliverHaul(accepted,now).error);
  if(mode==='vehicle')assert(pickNeedHaul(accepted,now).error);
  const picked=pickNeedHaul(accepted,now,{uid:'v1'});assert.equal(picked.units,units);
  const reloaded=normalizeProgress(picked.state);assert.equal(reloaded.gigs.active.haul,units);
  if(mode==='vehicle')assert.equal(reloaded.vehicles[0].cargo[0].k,'bakery-pallet');else assert.equal(reloaded.carry.kind,'sack');
  const cancelled=abandonGig(reloaded).state;assert.equal(cancelled.cash,reloaded.cash);assert.equal(cancelled.gigs.active,null);assert(!cancelled.carry);assert(!cancelled.vehicles[0]?.cargo?.length);assert.equal(Object.keys(cancelled.needs[0].claims).length,0);
  const completed=deliverHaul(reloaded,now+15);assert.equal(completed.units,units);assert(completed.paid>0);assert.equal(completed.state.cash,reloaded.cash+completed.paid);assert.equal(completed.state.bakeryStock[need.good],units);assert(!completed.state.carry);assert(!completed.state.vehicles[0]?.cargo?.length);assert(deliverHaul(completed.state,now+15).error);
 }
}
console.log('PASS bakery-needs: demand, cadence, caps, fill, old-plank expiry, tracker text, garbage');
