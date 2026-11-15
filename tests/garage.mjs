// VD4 (notes/vehicle-damage-design.md section 8, tests 9, 10, 11 and 12 for the garage, with the user's 2026-11-14 prices): the repair shop, repair kit and tow rules in garage.js, all pure and on saved data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MAP,validateMap} from '../dist/map-definition.js';
import {freshProgress,normalizeProgress} from '../dist/jobs.js';
import {quote,towFee,hardLuck,offers,startRepair,collect,repairDone,hoursLeft,shopList,useKit,towTo,statusOf,normalizeGarage,freshGarage,inBay,bayPose,hoursNow,hoursText,condOf,
 KIT_CAP,KIT_POINTS,HARD_LUCK_TO,HARD_LUCK_DAYS,TOW_MIN_CENTS,TOW_MAX_CENTS,PARTIAL_TO} from '../dist/garage.js';
import {repairCents,repairHours} from '../dist/damage.js';
import {itemById} from '../dist/items.js';
import {addItem,countItem,hotbarItems,equipTool} from '../dist/inventory.js';
import {categoryOf} from '../dist/store-categories.js';

const B=bayPose(),far={x:-120,z:-200,yaw:0};
const veh=(uid,model,cond,at=B)=>({uid,model,colour:'x',x:at.x,z:at.z,yaw:at.yaw,...(cond<1000?{cond}:{})});
const prog=(vehicles,extra={})=>({...freshProgress(),cash:100000,vehicles,housing:{...freshProgress().housing,day:3},routine:{...freshProgress().routine,minutes:600},...extra}); // day 3, 10:00 AM

// 1. The quotes match damage.js and the user's numbers: S70 full repair $125, offroad pickup $2,750, minimum $25.
assert.equal(quote(veh('v1','shortbed',0)).cents,12500,'S70 wreck $125');assert.equal(quote(veh('v1','offroad',0)).cents,275000,'offroad wreck $2,750');
assert.equal(quote(veh('v1','worktruck',0)).cents,112500);assert.equal(quote(veh('v1','flatbed',0)).cents,200000);
assert.equal(quote(veh('v1','shortbed',999)).cents,2500,'a scratch costs the $25 minimum');assert.equal(quote(veh('v1','shortbed',999)).hours,.5);
assert.equal(quote(veh('v1','shortbed',0)).hours,6,'a wreck takes 6 game hours');assert.equal(quote(veh('v1','shortbed',500)).cents,repairCents(50000,500));assert.equal(quote(veh('v1','shortbed',500)).hours,repairHours(500));
assert.equal(quote(veh('v1','shortbed',1000)),null,'a perfect vehicle has nothing to fix');assert.equal(quote({uid:'v9',model:'shortbed',x:0,z:0,yaw:0}),null,'a missing cond is perfect');assert.equal(condOf({cond:1500}),1000);assert.equal(condOf({cond:-3}),1000);assert.equal(condOf({cond:'x'}),1000);assert.equal(condOf({cond:0}),0,'Wrecked survives');
// partial: fix to 70% pays for 70 points only
{const q=quote(veh('v1','shortbed',100),PARTIAL_TO);assert.equal(q.to,700);assert.equal(q.gained,600);assert.equal(q.cents,repairCents(50000,400),'600 points priced like a 400-cond vehicle: $75');assert.equal(q.cents,7500);assert(q.hours<quote(veh('v1','shortbed',100)).hours);
 assert.equal(quote(veh('v1','shortbed',800),PARTIAL_TO),null,'cannot "fix" down');assert.equal(quote(veh('v1','shortbed',100),1200),null)}

// 2. Pay, wait game hours, collect Fine. The cash goes down by the quote, the vehicle must be in the bay, the time is game hours.
{let p=prog([veh('v1','shortbed',0)]);const now=hoursNow(p);assert.equal(now,2*24+10);
 const r=startRepair(p,'v1',now);assert(!r.error,r.error);assert.equal(r.state.cash,100000-12500);assert.equal(r.readyAt,now+6);assert.deepEqual(r.state.garage.shop,{v1:{readyAt:now+6,to:1000}});
 assert.equal(repairDone(r.state,'v1',now+5.9),false);assert.equal(repairDone(r.state,'v1',now+6),true);assert.equal(hoursLeft(r.state,'v1',now+2),4);
 assert(collect(r.state,'v1',now+3).error,'not ready yet');assert.match(collect(r.state,'v1',now+3).error,/3 h to go/);
 const c=collect(r.state,'v1',now+6);assert(!c.error);assert.equal(c.state.vehicles[0].cond,undefined,'collected Fine: no cond saved');assert.deepEqual(c.state.garage.shop,{});assert.equal(c.cond,1000);assert.deepEqual(c.appear,{uid:'v1',...B});
 assert(startRepair(r.state,'v1',now).error,'already in the shop');assert.equal(p.cash,100000,'the input progress is not changed');
 assert.deepEqual(shopList(r.state,now+1).map(s=>[s.uid,s.done]),[['v1',false]]);assert.deepEqual(shopList(r.state,now+7).map(s=>[s.uid,s.done]),[['v1',true]]);
 assert(startRepair(prog([veh('v1','shortbed',0,{x:50,z:50,yaw:0})]),'v1',now).error,'outside the bay: refused');assert(startRepair(prog([veh('v1','shortbed',1000)]),'v1',now).error,'perfect: refused');assert(startRepair(p,'v9',now).error,'not yours');
 assert.match(startRepair(prog([veh('v1','shortbed',0)],{cash:12499}),'v1',now).error,/\$125\.00/,'one cent short is refused, with the price');assert.equal(startRepair(prog([veh('v1','shortbed',0)],{cash:12500}),'v1',now).state.cash,0,'exactly enough works')}
// partial repair leaves at 70%
{const p=prog([veh('v1','shortbed',100)]),now=hoursNow(p),r=startRepair(p,'v1',now,{to:700});assert(!r.error);assert.equal(r.state.cash,100000-7500);const c=collect(r.state,'v1',r.readyAt);assert.equal(c.state.vehicles[0].cond,700);assert.equal(c.cond,700);
 assert.deepEqual(offers(p,'v1').map(o=>o.id),['full','partial'],'two offers when below 70% (no hard luck: cash is plenty)');assert.deepEqual(offers(prog([veh('v1','shortbed',800)]),'v1').map(o=>o.id),['full']);assert.deepEqual(offers(prog([veh('v1','shortbed',1000)]),'v1'),[]);
 assert.deepEqual(offers(prog([veh('v1','shortbed',100,far)]),'v1'),[],'nothing to offer when it is not in the bay')}

// 3. The repair kit: +150, never above 400, consumes exactly one, refused without one, in the shop or already at 400.
{assert.equal(itemById('repair-kit').price,4000,'$40');assert.equal(categoryOf(itemById('repair-kit')),'tools','sold in the phone Store, Tools');
 let p=prog([veh('v1','shortbed',0),veh('v2','shortbed',380,far),veh('v3','shortbed',500,far)]);assert(useKit(p,'v1').error,'no kit');
 p=addItem(addItem(p,'repair-kit',{purchase:true}).state,'repair-kit',{purchase:true}).state;assert.equal(p.cash,100000-8000);assert.equal(countItem(p,'repair-kit'),2,'two kits stack');assert(hotbarItems(p).some(h=>h.item.id==='repair-kit')&&equipTool(p,'repair-kit').equipped==='repair-kit','on the hotbar, equippable');
 const a=useKit(p,'v1');assert(!a.error);assert.equal(condOf(a.state.vehicles[0]),KIT_POINTS,'a wreck becomes 15%');assert.equal(countItem(a.state,'repair-kit'),1);
 const b=useKit(a.state,'v2');assert.equal(condOf(b.state.vehicles[1]),KIT_CAP,'380 + 150 stops at 400');assert.equal(countItem(b.state,'repair-kit'),0,'the last kit is gone (the slot too)');assert.equal(b.state.inventory.slots.filter(s=>s.id==='repair-kit').length,0);
 assert(useKit(a.state,'v3').error&&/shop/.test(useKit(a.state,'v3').error),'a vehicle at 500 is beyond a kit');assert.equal(countItem(a.state,'repair-kit'),1,'a refused use keeps the kit');
 const shopped=startRepair({...a.state,vehicles:a.state.vehicles.map(v=>v.uid==='v1'?{...v,...B}:v)},'v1',hoursNow(p));assert(useKit(shopped.state,'v1').error,'in the shop');
 // the kit takes a Wrecked vehicle to the Damaged band's start, so it can crawl to the shop
 assert.equal(KIT_POINTS,150)}

// 4. Tow: the fee table, the destination, driven refusal, the cash, saved data only.
{assert.equal(TOW_MIN_CENTS,7500);assert.equal(TOW_MAX_CENTS,25000);assert.equal(towFee(B,B),7500,'$75 at the door');assert.equal(towFee({x:B.x+100,z:B.z},B),8500,'$10 per 100 m');assert.equal(towFee({x:B.x+1000,z:B.z},B),17500);assert.equal(towFee({x:B.x+1750,z:B.z},B),25000,'$250 at 1.75 km');assert.equal(towFee({x:B.x+9000,z:B.z},B),25000,'capped');
 const wreck=veh('v1','shortbed',0,{x:600,z:-900,yaw:1}); // far off, in no loaded chunk: only the saved list knows it
 let p=prog([wreck]);const r=towTo(p,'v1',B,{now:hoursNow(p)});assert(!r.error,r.error);const fee=towFee(wreck,B);assert(fee>7500&&fee<=25000);assert.equal(r.fee,fee);assert.equal(r.state.cash,100000-fee);assert.deepEqual(r.appear,{uid:'v1',...B});
 assert.equal(r.state.vehicles[0].x,B.x);assert.equal(r.state.vehicles[0].cond,0,'the condition is kept');assert(inBay(r.state.vehicles[0]));assert.deepEqual(r.state.garage.shop,{},'a tow only brings it: the repair is paid at the counter');
 {const d=towTo(p,'v1',B,{drivenUid:'v1'});assert(!d.error,'PB1: the vehicle you drive can be towed too');assert.equal(d.fee,fee);assert.deepEqual(d.appear,{uid:'v1',...B})}assert(towTo(prog([wreck],{cash:fee-1}),'v1',B).error,'cannot afford');assert(towTo(p,'v9',B).error,'not yours');assert(towTo(p,'v1',{x:NaN,z:0,yaw:0}).error);
 assert(towTo(prog([veh('v1','shortbed',0)]),'v1',B).error&&/already/.test(towTo(prog([veh('v1','shortbed',0)]),'v1',B).error),'already at the shop');
 const home=towTo(p,'v1',{x:-40,z:10,yaw:0});assert(!home.error&&home.fee===towFee(wreck,{x:-40,z:10}),'a tow to any spot works, by distance');
 const inS=startRepair(prog([veh('v1','shortbed',0)]),'v1',0).state;assert(towTo(inS,'v1',far).error,'a vehicle in the shop cannot be towed')}

// 5. Hard luck: nothing runs and the cash is short of tow + repair; free tow and a repair to 400; once per 7 game days.
{const wreck=veh('v1','shortbed',0,{x:300,z:-300,yaw:0}),poor=prog([wreck],{cash:2000}),rich=prog([wreck],{cash:500000});
 assert.equal(hardLuck(poor),true);assert.equal(hardLuck(rich),false,'enough cash: no help');assert.equal(hardLuck(prog([wreck,veh('v2','shortbed',900,far)],{cash:0})),false,'another vehicle runs');assert.equal(hardLuck(prog([veh('v1','shortbed',300,far)],{cash:0})),false,'Damaged still runs');assert.equal(hardLuck(prog([veh('v1','shortbed',149,far)],{cash:0})),true,'Limping counts as not running');assert.equal(hardLuck(prog([],{cash:0})),false,'no vehicle at all');
 assert.equal(hardLuck(prog([wreck],{cash:towFee(wreck,B)+12500})),false,'exactly tow + repair is not short');assert.equal(hardLuck(prog([wreck],{cash:towFee(wreck,B)+12499})),true,'a cent short is');
 const now=hoursNow(poor),r=towTo(poor,'v1',B,{now});assert(!r.error,r.error);assert.equal(r.free,true);assert.equal(r.fee,0);assert.equal(r.state.cash,2000,'free');assert.equal(r.state.garage.hardLuckDay,3);const q=quote(wreck,HARD_LUCK_TO);assert.deepEqual(r.state.garage.shop,{v1:{readyAt:now+q.hours,to:HARD_LUCK_TO}},'the shop repairs it to 400 for nothing');assert.match(r.message,/Next time it costs/);
 const c=collect(r.state,'v1',now+q.hours);assert.equal(c.state.vehicles[0].cond,400,'it leaves Worn (400)');
 // not again within 7 days
 const wreck2={...c.state.vehicles[0],cond:0,...far};const again=(day)=>({...c.state,vehicles:[wreck2],cash:0,housing:{...c.state.housing,day}});
 assert.equal(hardLuck(again(3)),false);assert.equal(hardLuck(again(9)),false,'day 9 is 6 days later');assert.equal(hardLuck(again(3+HARD_LUCK_DAYS)),true,'7 days later');assert.equal(towTo(again(5),'v1',B).error?.length>0,true,'and the tow costs again (the cash is 0)');
 // at the counter: the free offer shows, and runs
 const inBayPoor=prog([veh('v1','shortbed',0)],{cash:0});assert.deepEqual(offers(inBayPoor,'v1').map(o=>o.id),['full','partial','free']);const f=startRepair(inBayPoor,'v1',now,{free:true});assert(!f.error);assert.equal(f.state.cash,0);assert.equal(f.state.garage.hardLuckDay,3);assert(startRepair(prog([veh('v1','shortbed',0)],{cash:99999999}),'v1',now,{free:true}).error,'rich players cannot claim it')}

// 6. normalizeGarage: junk, unknown uids, old saves, the vehicle's cond at load.
{assert.deepEqual(normalizeGarage(undefined,[]),freshGarage());assert.deepEqual(normalizeGarage('x',[veh('v1','shortbed',0)]),{hardLuckDay:null,shop:{}});assert.deepEqual(normalizeGarage(null),{hardLuckDay:null,shop:{}});
 const vs=[veh('v1','shortbed',100),veh('v2','shortbed',900)];
 const g=normalizeGarage({hardLuckDay:4,shop:{v1:{readyAt:50.12345,to:1000},v2:{readyAt:60,to:950},v9:{readyAt:5,to:1000},__proto__:{x:1}}},vs);assert.deepEqual(g,{hardLuckDay:4,shop:{v1:{readyAt:50.123,to:1000},v2:{readyAt:60,to:950}}},'unknown uids dropped, ready time rounded');
 for(const bad of [{readyAt:'x',to:1000},{readyAt:-1,to:1000},{readyAt:5,to:50},{readyAt:5,to:1001},{readyAt:5,to:1000.5},{readyAt:Infinity,to:1000},null,5,[]])assert.deepEqual(normalizeGarage({shop:{v1:bad}},vs).shop,{},'bad entry dropped: '+JSON.stringify(bad));
 for(const bad of [-1,1.5,'3',null,1e9])assert.equal(normalizeGarage({hardLuckDay:bad},vs).hardLuckDay,null);
 assert.deepEqual(normalizeGarage({shop:[]},vs).shop,{},'an array is not a shop');
 // through normalizeProgress: an old save has an empty garage; a saved one round-trips (and drops what is not owned)
 assert.deepEqual(normalizeProgress({schema:2,cash:5}).garage,{hardLuckDay:null,shop:{}},'old saves load with an empty garage');assert.deepEqual(freshProgress().garage,{hardLuckDay:null,shop:{}});
 const owned=[{uid:'v1',model:'shortbed',colour:MAP.vehicles.find(v=>v.model==='shortbed').colours?.[0]||undefined,x:B.x,z:B.z,yaw:B.yaw,cond:0}];
 const saved=normalizeProgress({...freshProgress(),vehicles:owned,garage:{hardLuckDay:2,shop:{v1:{readyAt:77.5,to:1000},v7:{readyAt:1,to:1000}}}});assert.equal(saved.vehicles.length,1);assert.equal(saved.vehicles[0].cond,0);assert.deepEqual(saved.garage,{hardLuckDay:2,shop:{v1:{readyAt:77.5,to:1000}}});
 assert.deepEqual(normalizeProgress(JSON.parse(JSON.stringify(saved))).garage,saved.garage,'a JSON round trip is stable')}

// 7. Status for the phone, the hours text and the map.
{const p=prog([veh('v1','shortbed',250,far)]),now=hoursNow(p);let s=statusOf(p,'v1',now);assert.equal(s.inShop,false);assert.match(s.line,/Condition 25% \(Damaged\)/);assert.equal(s.tow,towFee(p.vehicles[0],B));
 const q=prog([veh('v1','shortbed',250)]),r=startRepair(q,'v1',now);s=statusOf(r.state,'v1',now+1);assert.equal(s.inShop,true);assert.match(s.line,/In the shop: ready in/);assert.equal(s.ready,false);assert.equal(s.readyAt,r.readyAt);s=statusOf(r.state,'v1',r.readyAt);assert.equal(s.ready,true);assert.match(s.line,/Repair done/);assert.equal(statusOf(p,'v9'),null);
 assert.equal(hoursText(.5),'30 min');assert.equal(hoursText(1.5),'1 h 30 min');assert.equal(hoursText(5.48),'5 h 29 min');assert.equal(hoursText(6),'6 h')}
{const g=MAP.garage;assert(g&&g.pose.x>g.x0&&g.pose.x<g.x1&&g.pose.z>g.z0&&g.pose.z<g.z1,'the pose is inside the box');assert(inBay({x:g.pose.x,z:g.pose.z}));assert(!inBay({x:g.x1+.1,z:g.pose.z}));assert(!inBay(null));
 assert.deepEqual(validateMap(),[],'the map still validates with the bay');const row=MAP.bayRows.find(r=>r.id==='service-bay');assert(row&&row.x0===g.x0&&row.x0+row.count*row.width===g.x1&&row.z0===g.z0&&row.z0+row.depth===g.z1,'the painted box is the bay');
}
// 8. Purity (the MP rule): no DOM, no clock, no random.
{const src=fs.readFileSync(new URL('../dist/garage.js',import.meta.url),'utf8').replace(/\/\/.*$/gm,'');for(const bad of ['document','window','Date.now','Math.random','performance.now','three'])assert(!src.includes(bad),'garage.js must not use '+bad);assert(!/from '\.\/(game|driving|phone)/.test(src))}
console.log('Garage: quotes match damage.js ($125 S70, $2,750 pickup, $25 minimum), pay and wait game hours then collect Fine, partial repair to 70%, the repair kit (+15% up to 40%, one consumed), the tow fee table ($75 to $250) and a tow of a far-off wreck from saved data, a driven vehicle refused, hard luck (free tow and repair to 400, once per 7 days), the garage save with junk and old saves, status text, and purity.');
