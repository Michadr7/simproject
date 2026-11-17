// W-B: needs (notes/world-system-design.md): one need opens, hysteresis, pro-rata partial fills, conservation, over-fill, claim lapse, expiry consequences, cap, determinism, slot shape, pay, no clock/chance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeWorld,totalOf,priceOf}from '../dist/world-state.js';
import {PLACES}from '../dist/world-goods.js';
import {needsFrom,claim,fill,expire,needPay,needToSlot,needSlots,valueCents,normalizeNeeds,MAX_OPEN_NEEDS,CLAIM_LAPSE_MIN,LATE_FILL_PCT,KINDS}from '../dist/needs.js';
import {GIG_TYPES}from '../dist/gigs.js';

const M='shop:market',F='property:farm-house',DAY=5,NOW=DAY*1440+600;
const base=()=>{const w=normalizeWorld(null,1234,DAY);w.stock[M].eggs=4;w.stock[F].eggs=40;return w}; // market 4 of target 20 = 20%, under 30%
const eggs=l=>l.filter(n=>n.kind==='restock'&&n.good==='eggs');

// opens ONE need, deterministically, without touching its input
const w0=base(),snap=JSON.stringify(w0);
let list=needsFrom(w0,DAY,{});
assert.equal(eggs(list).length,1,'one egg need');
const need=eggs(list)[0];
assert.equal(need.place,M);assert.equal(need.origin,F);assert.equal(need.qty,10,'refill to 70% (14) from 4');assert.equal(need.status,'open');
assert.ok(need.dueDay>DAY&&need.unitCents>0);assert.equal(need.id,`restock|${M}|eggs|${DAY}`);
assert.equal(JSON.stringify(w0),snap,'input world untouched');
assert.equal(eggs(needsFrom(w0,DAY,{needs:list})).length,1,'does not open a second one while open');
assert.deepEqual(needsFrom(base(),DAY,{}),needsFrom(base(),DAY,{}),'deterministic');
assert.equal(MAX_OPEN_NEEDS>=1,true);

// claims: several players, partial, first act wins
let c1=claim(list,need.id,'p1',4,NOW);assert.equal(c1.claimed,4);
let c2=claim(c1.needs,need.id,'p2',10,NOW+5);assert.equal(c2.claimed,6,'second player gets what is left');
let c3=claim(c2.needs,need.id,'p3',3,NOW+6);assert.equal(c3.claimed,0,'nothing left to claim');
// a claim lapses after 60 minutes without progress
let c4=claim(c2.needs,need.id,'p3',5,NOW+CLAIM_LAPSE_MIN+1);assert.equal(c4.claimed,4,'p1 lapsed (4 free); p2 claimed at +5 also lapsed by +61 -> 10 minus nothing');
assert.equal(Object.keys(c4.needs.find(n=>n.id===need.id).claims).length>=1,true);

// partial fills from two players: pro rata, sum to the whole, goods conserved
const eggsBefore=totalOf(w0,'eggs');
let f1=fill(c2.needs,w0,need.id,'p1',4,NOW+10);
assert.equal(f1.units,4);assert.equal(f1.world.stock[M].eggs,8);assert.equal(f1.world.stock[F].eggs,36);
let f2=fill(f1.needs,f1.world,need.id,'p2',6,NOW+20);
assert.equal(f2.units,6);assert.equal(f2.needs.find(n=>n.id===need.id).status,'filled');assert.equal(f2.world.stock[M].eggs,14);
const total=valueCents(need,10,DAY);assert.ok(total>0);
assert.equal(f1.cents+f2.cents,total,'pro-rata parts sum to the whole');
assert.ok(f1.cents<f2.cents&&Math.abs(f1.cents/total-.4)<.02,'4 of 10 pays about 40%');
assert.equal(totalOf(f2.world,'eggs'),eggsBefore,'eggs conserved (moved, not created)');

// cannot fill more than the farm has
let wl=base();wl.stock[F].eggs=3;const lo=eggs(needsFrom(wl,DAY,{}))[0];assert.equal(lo.qty,3,'asks for no more than the farm has');
let wd=base();wd.stock[F].eggs=3; // drained after the need opened
const fl=fill(list,wd,need.id,'p1',10,NOW);assert.equal(fl.units,3);assert.equal(fl.world.stock[F].eggs,0);assert.equal(fl.over,7);assert.equal(fl.needs[0].status,'open');
// over-filling pays nothing; a closed need pays nothing
const ov=fill(list,w0,need.id,'p1',25,NOW);assert.equal(ov.units,10);assert.equal(ov.over,15);assert.equal(ov.cents,valueCents(need,10,DAY));assert.equal(ov.world.stock[M].eggs,14);
const again=fill(ov.needs,ov.world,need.id,'p1',5,NOW+1);assert.equal(again.units,0);assert.equal(again.cents,0);assert.equal(again.over,5);assert.equal(again.world.stock[M].eggs,14);
// someone else's claim protects their share
const guarded=fill(c1.needs,w0,need.id,'p2',10,NOW+1);assert.equal(guarded.units,6,'p1 holds 4 of the 10');

// hysteresis: same kind+place+good cannot reopen on the day it closed; it can the next day
const drained=ov.world;drained.stock[M].eggs=2;
const closed=ov.needs.find(n=>n.id===need.id);assert.equal(closed.closedDay,DAY);
assert.equal(eggs(needsFrom(drained,DAY,{needs:ov.needs})).filter(n=>n.status==='open').length,0,'same day: no reopen');
assert.equal(eggs(needsFrom(drained,DAY+1,{needs:ov.needs})).filter(n=>n.status==='open').length,1,'a day later: reopens');
// a restock whose shelf recovered on its own closes
const healed=base();healed.stock[M].eggs=18;assert.equal(needsFrom(healed,DAY+1,{needs:list}).find(n=>n.id===need.id).status,'filled');

// expiry: late smaller fill by the world actor + mood hit + prosperity + price
const wx=base(),priceBefore=priceOf(wx,M,'eggs');
const ex=expire(list,wx,need.dueDay+1);
const en=ex.needs.find(n=>n.id===need.id);assert.equal(en.status,'expired');
assert.equal(ex.consequences.npcFill[0].units,Math.floor(10*LATE_FILL_PCT/100));assert.equal(ex.consequences.npcFill[0].actor,'hal');
assert.equal(ex.world.stock[M].eggs,8,'4 + late 4');assert.equal(ex.world.stock[F].eggs,36);
assert.deepEqual(ex.consequences.mood,[{npc:'noah',delta:-8}]);
assert.deepEqual(ex.consequences.prosperity,[{region:'town',delta:-1}]);assert.equal(ex.world.town.town.prosperity,wx.town.town.prosperity-1);
assert.ok(ex.consequences.price[0].after<=priceBefore+1&&ex.consequences.price[0].before===priceBefore);
assert.equal(wx.town.town.prosperity,60,'input world untouched');
assert.equal(expire(list,wx,need.dueDay).needs[0].status,'open','not past due yet');
// prosperity never below the floor
const poor=base();poor.town.town.prosperity=30;assert.equal(expire(list,poor,need.dueDay+1).world.town.town.prosperity,30);

// the cap: nothing floods the board
const wc=normalizeWorld(null,1234,DAY);for(const id of Object.keys(PLACES))if(PLACES[id].kind!=='producer')for(const g of Object.keys(PLACES[id].goods))wc.stock[id][g]=0;
const many=needsFrom(wc,DAY,{needSeeds:[{kind:'tend',place:F,qty:1},{kind:'serve',place:'shop:cafe',qty:1}],sickNpcs:[{id:'walt',home:'house:oak-4'}],events:[{kind:'tree-down',at:'zone:forest'}]});
assert.equal(many.filter(n=>n.status==='open').length,MAX_OPEN_NEEDS);
assert.equal(new Set(many.map(n=>n.kind+n.place+n.good)).size,many.length,'one per kind+place+good');
assert.ok(many.every(n=>KINDS.includes(n.kind)));
assert.deepEqual(many,needsFrom(wc,DAY,{needSeeds:[{kind:'tend',place:F,qty:1},{kind:'serve',place:'shop:cafe',qty:1}],sickNpcs:[{id:'walt',home:'house:oak-4'}],events:d=>[{kind:'tree-down',at:'zone:forest'}]}),'same order every time');
// FIX-R2 boardOnly: a harvest (no distance) and a sick errand (home has no point) never open; an egg restock still does
{const wb=base();wb.stock[F].eggs=120;const b=needsFrom(wb,DAY,{boardOnly:true,sickNpcs:[{id:'walt',home:'house:oak-4'}]});assert.ok(!b.some(n=>n.kind==='harvest'||n.kind==='errand'),'invisible needs are not opened');
 const low=base();assert.equal(eggs(needsFrom(low,DAY,{boardOnly:true})).length,1,'a boardable restock opens')}
// audit A F5: the pallet-linked warehouse planks never become a board restock (the pallets are the truth; a gig delivery would vanish at the daily tick)
{const ww=base();ww.stock['office:ridgeline-warehouse'].planks=0;ww.stock['property:sawmill'].planks=60; // P-B wiring: a fresh sawmill yard is empty, so give the source planks
assert.ok(needsFrom(ww,DAY,{}).some(n=>n.place==='office:ridgeline-warehouse'&&n.good==='planks'),'without boardOnly the warehouse restock still opens');assert.ok(!needsFrom(ww,DAY,{boardOnly:true}).some(n=>n.place==='office:ridgeline-warehouse'&&n.good==='planks'),'boardOnly: no pallet-linked restock')}
// audit A F3: the cafe's egg slot is not titled 'for the market'
{const wc=base();wc.stock['shop:cafe'].eggs=0;const cn=needsFrom(wc,DAY,{}).find(n=>n.place==='shop:cafe'&&n.good==='eggs');if(cn){const sl=needToSlot(cn,{});assert.ok(!/market/i.test(sl.title),'cafe title: '+sl.title)}}
// kinds from ctx: errand + clear + harvest
const wh=base();wh.stock[F].eggs=120;
const kinds=needsFrom(wh,DAY,{sickNpcs:[{id:'walt',home:'house:oak-4',good:'bread',qty:2}],events:[{kind:'tree-down',at:'zone:forest'},{kind:'nonsense',at:'x'}]});
assert.ok(kinds.some(n=>n.kind==='harvest'&&n.good==='eggs'),'full producer opens a harvest');
const err=kinds.find(n=>n.kind==='errand');assert.equal(err.person,'walt');assert.equal(err.good,'bread');assert.equal(err.origin,M);
assert.ok(kinds.some(n=>n.kind==='clear'));assert.ok(!kinds.some(n=>n.place==='x'));
const hv=kinds.find(n=>n.kind==='harvest'),hf=fill(kinds,wh,hv.id,'p1',hv.qty,NOW);assert.equal(hf.world.stock[F].eggs,120-hv.qty);assert.equal(hf.needs.find(n=>n.id===hv.id).status,'filled');

// needToSlot has the fields gigs.js boardFor makes
const slot=needToSlot(need,{names:{noah:'Noah Reyes'}});
for(const k of ['slot','window','expiresAt','type','client','clientName','places','large','origin','points','parM','mode','pair','starter'])assert.ok(k in slot,'slot.'+k);
for(const p of [slot.origin,...slot.points,...slot.places])for(const k of ['id','x','z','room','name'])assert.ok(k in p,'point.'+k);
assert.equal(slot.title,'Eggs for the market');assert.equal(slot.type,'need-restock');assert.equal(slot.client,'noah');assert.equal(slot.clientName,'Noah Reyes');
assert.equal(slot.mode,'walk');assert.ok(slot.parM>=300&&slot.meetsPar,'farm to market is a real par');assert.equal(slot.origin.id,'farm');assert.equal(slot.points[0].id,'market');
assert.equal(needToSlot({...need,qty:14}).mode,'vehicle','12+ units is a truck job');assert.equal(slot.starter,false);assert.equal(needSlots(list).length,1);assert.equal(needToSlot({...need,origin:'nowhere'}),null);
for(const k of KINDS)assert.ok(GIG_TYPES.some(t=>t.id==='need-'+k),'W-D2 added the need-'+k+' gig type');

// pay: floor + value, fatigue and too-fast stay the safety net
const p1=needPay(need,10,100,'walk',slot.parM,{day:DAY});
assert.ok(p1.floor>0&&p1.value===valueCents(need,10,DAY)&&p1.total===p1.floor+p1.value);
assert.equal(needPay(need,10,50,'walk',slot.parM,{day:DAY}).value,Math.floor(p1.value/2));
assert.ok(needPay(need,10,100,'walk',slot.parM,{day:DAY,doneToday:6}).total<p1.total,'fatigue lowers it');
const fast=needPay(need,10,100,'walk',slot.parM,{day:DAY,elapsedMin:1});assert.ok(fast.tooFast&&fast.value===0);
assert.ok(needPay(need,10,100,'walk',slot.parM,{day:DAY+need.dueDay-DAY}).value>p1.value,'urgency rises toward the due day');

// persistence + purity
assert.deepEqual(normalizeNeeds(JSON.parse(JSON.stringify(list))),list);assert.deepEqual(normalizeNeeds('junk'),[]);
const src=fs.readFileSync(new URL('../dist/needs.js',import.meta.url),'utf8');
assert.ok(!/Math\.random|Date\.now|performance\.now|\bdocument\.|\bwindow\.|globalThis|from 'three'/.test(src),'no clock, chance, DOM or three.js');
console.log('PASS needs: one need opens, hysteresis, claims + lapse, pro-rata fills, conservation, over-fill pays nothing, expiry (late fill, mood, prosperity, price), cap, determinism, slot shape, pay, no clock/chance');
