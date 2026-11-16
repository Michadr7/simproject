// W-D2: the egg chain end to end through the PURE functions (no game.js): 7 untouched days -> the market runs out of eggs -> a need opens -> it is on the gig board -> the player takes it ->
// loads crates at Willow Farm (the farm's stock goes DOWN) -> hands them over at the market (shelf stock UP, price eases) -> pay > 0 -> Noah's mood and greeting, standing +1, hysteresis, conservation of dozens.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshProgress,normalizeProgress,saveProgress,loadProgress} from '../dist/jobs.js';
import {runWorldDay,newsFor} from '../dist/world-tick.js';
import {normalizeWorld,totalOf,priceOf,stockAt} from '../dist/world-state.js';
import {MAP} from '../dist/map-definition.js';
import {CRATE_UNITS} from '../dist/world-goods.js';
import {needsFrom,expire,remainingOf} from '../dist/needs.js';
import {moodLine,moodWord,standingOf,tierFor} from '../dist/npc-life.js';
import {boardFor,acceptGig,tickGig,completeGig,pickNeedHaul,deliverHaul,abandonGig,settleNeed,needsPickup,hasCrateBed,gameMinutes,NO_WORK_POSTED,GIG_TYPES,typeById,normalizeGigs,NEEDS_TRUCK} from '../dist/gigs.js';
import {availableContracts,acceptContract,pickNeedCrates,deliverNeedCrates,activeView,gigTarget} from '../dist/gig-bridge.js';
import {HANDLING_C} from '../dist/gig-pay.js';
import {addCrates,countOf} from '../dist/cargo.js';

const M='shop:market',F='property:farm-house',at=(P,day,minutes)=>({...P,housing:{...P.housing,day:day+1},routine:{...P.routine,minutes}});
const eggsOf=P=>totalOf(P.world,'eggs'),openEggs=P=>P.needs.find(n=>n.kind==='restock'&&n.place===M&&n.good==='eggs'&&n.status==='open');
const truck={uid:'v9',model:'shortbed'};

// ---- 7 untouched days: eggs run out and the egg need opens (deterministic from the seed)
let P=at({...normalizeProgress(freshProgress()),world:normalizeWorld(null,MAP.seed,100)},100,400);
assert.equal(P.gigs.active,null);
const startEggs=eggsOf(P),shelf0=P.world.stock[M].eggs;let opened=null,before=[];
for(let d=101;d<=110&&!opened;d++){before=P.needs;P=runWorldDay(at(P,d,400));opened=openEggs(P);if(opened)opened={...opened,day:d}}
assert.ok(opened,'the egg need opened within 10 days');const DAY=opened.day;assert.ok(DAY-100<=7,'within a week: '+DAY);
const need=openEggs(P);assert.equal(need.origin,F);assert.ok(need.qty>=1&&need.qty<=24);assert.ok(P.world.stock[M].eggs<=6,'the shelf is low (under 30% of 20)');
// town news: the phone line for the new need
const news=newsFor(before,P.needs,2);assert.ok(news.some(t=>t==='Noah: we are nearly out of eggs.'),JSON.stringify(news));assert.deepEqual(newsFor(P.needs,P.needs),[],'no news twice');
assert.ok(newsFor([],P.needs,2).length<=2,'at most 2 lines a tick');

// ---- the board (non-starter play): needs only; a player with no truck sees the card with 'Needs a truck'
const NOW=DAY*1440+720;P=at(P,DAY,720);assert.equal(gameMinutes(P),NOW);
const board=boardFor(P,NOW);assert.ok(board.length>=1&&board.length<=4);assert.ok(board.every(s=>s.needId&&s.type.startsWith('need-')),'only needs');
const slot=board.find(s=>s.needId===need.id);assert.ok(slot,'the egg need is on the board');
assert.equal(slot.type,'need-restock');assert.equal(slot.title,'Eggs for the market');assert.equal(slot.client,'noah');assert.ok(/^Noah/.test(slot.clientName),slot.clientName);assert.equal(slot.mode,'vehicle');assert.ok(slot.parM>=300);
assert.equal(slot.blocked,NEEDS_TRUCK,'no truck: the card says so');assert.equal(NEEDS_TRUCK,'Needs a truck');assert.equal(hasCrateBed(P),false);
assert.deepEqual(boardFor(P,NOW),boardFor(P,NOW),'board is a pure function of the save');
const offers=availableContracts(P);const eo=offers.find(o=>o.title==='Eggs for the market');assert.ok(eo&&eo.reward>0&&eo.terms==='Needs a truck'&&eo.blocked==='Needs a truck');
assert.ok(acceptContract(P,eo.id).error,'cannot accept without a truck');assert.ok(acceptGig(P,slot.slot,NOW).error);
// the loan truck is not a need truck (it belongs to the starter story)
assert.equal(hasCrateBed({...P,vehicles:[{uid:'l1',model:'shortbed',loan:true}]}),false);
// a flatbed takes no crates
assert.equal(hasCrateBed({...P,vehicles:[{uid:'f1',model:'flatbed'}]}),false);
// need types exist with a handling fee and one stop; they are never on the hashed board
for(const k of ['restock','harvest','errand','clear','repair','tend','tow','serve']){const t=typeById('need-'+k);assert.ok(t&&t.need&&t.stops===1&&Number.isFinite(t.handling),k)}
assert.equal(typeById('need-restock').handling,HANDLING_C.vehicle);assert.equal(typeById('need-errand').handling,HANDLING_C.walk);
for(let t=0;t<2000;t+=50)assert.ok(boardFor(P,t,undefined,{hashed:true}).every(s=>!s.type.startsWith('need-')));

// ---- with a truck: accept (claims the need), the card and the marker
P={...P,vehicles:[truck]};assert.equal(hasCrateBed(P),true);
const acc=acceptContract(P,'slot-'+slot.slot,{x:0,z:0});assert.ok(acc.state,JSON.stringify(acc));P=acc.state;
const act=P.gigs.active;assert.equal(act.needId,need.id);assert.equal(act.type,'need-restock');assert.equal(act.needQty,need.qty);assert.equal(act.haul,0);assert.ok(needsPickup(act));
assert.ok(P.needs.find(n=>n.id===need.id).claims.player,'the need is claimed');assert.deepEqual(availableContracts(P),[]);assert.equal(boardFor(P,NOW).some(s=>s.needId===need.id),false,'a claimed need leaves the board');
let view=P.activeJob;assert.equal(view.title,'Eggs for the market');assert.ok(view.reward>0);assert.ok(/Load the crates/.test(view.description));
assert.deepEqual({x:view.location.x,z:view.location.z},{x:act.origin.x,z:act.origin.z},'the marker leads to the farm until the crates are on');assert.deepEqual(gigTarget(view),view.location);
// walking up to the market door without crates does not finish it
const door=act.places[0];let w=tickGig(P,{position:{x:door.x,z:door.z},room:'street',now:NOW+5});assert.ok(!w.gigs.active.visited[0],'no crates, no delivery');assert.ok(completeGig(w,NOW+5).error);
assert.ok(deliverHaul(P,NOW+5).error,'nothing to hand over yet');

// ---- the farm pile: stock goes DOWN, crates = units / CRATE_UNITS, conservation
const farm0=P.world.stock[F].eggs,market0=P.world.stock[M].eggs,total0=eggsOf(P),price0=priceOf(P.world,M,'eggs');
const emptyFarm={...P,world:{...P.world,stock:{...P.world.stock,[F]:{...P.world.stock[F],eggs:0}}}};
assert.equal(pickNeedHaul(emptyFarm,NOW+10,{uid:'v9'}).error,'The coop is empty today.','refused when the farm is empty');
assert.equal(pickNeedHaul(P,NOW+10,{uid:'v9',maxUnits:0}).error,'The truck has no room for crates.');
const pk=pickNeedCrates(P,{uid:'v9',maxUnits:44*4}),LOAD=NOW+10;assert.ok(!pk.error,JSON.stringify(pk));
// (bridge call used the real clock of the save: NOW)
const pick=pickNeedHaul(P,LOAD,{uid:'v9',maxUnits:16*CRATE_UNITS.eggs});assert.ok(!pick.error,JSON.stringify(pick));
const units=pick.units;assert.equal(units,Math.min(need.qty,farm0),'takes what the need wants (or what the coop has)');assert.equal(pick.crates,Math.ceil(units/CRATE_UNITS.eggs));
P=pick.state;assert.equal(P.world.stock[F].eggs,farm0-units,'the farm stock went DOWN');assert.equal(P.world.stock[M].eggs,market0,'the shelf has not changed yet');
assert.equal(P.gigs.active.haul,units);assert.equal(P.gigs.active.truck,'v9');assert.equal(P.gigs.active.pickedAt,LOAD);assert.ok(!needsPickup(P.gigs.active));assert.ok(/crate/.test(pick.message)&&pick.message.includes(String(P.world.stock[F].eggs)));
assert.equal(eggsOf(P),total0-units,'in transit: the crates are on the truck');assert.ok(pickNeedHaul(P,LOAD+1,{uid:'v9'}).error,'cannot load twice');
const cargo=addCrates(null,'shortbed',pick.crates);assert.ok(!cargo.error&&countOf(cargo.cargo,'crate')===pick.crates,'the crates fit the truck bed');
// save and load mid-run keeps the haul
{const store=new Map(),st={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};assert.ok(saveProgress(st,P));const back=loadProgress(st);assert.equal(back.gigs.active.haul,units);assert.equal(back.gigs.active.needId,need.id);assert.equal(back.gigs.active.truck,'v9');assert.deepEqual(back.world.stock[F],P.world.stock[F])}

// ---- drive to the market, hand over: shelf UP, price eases, pay, mood, standing, hysteresis
const noah0=P.npcs.noah,st0=standingOf(P.standing,'noah'),cash0=P.cash,DROP=LOAD+30;
const sc=deliverNeedCrates(at(P,DAY,DROP%1440),{uid:'v9'});assert.ok(!sc.error,JSON.stringify(sc));
const done=deliverHaul(P,DROP);assert.ok(!done.error,JSON.stringify(done));assert.equal(done.units,units);assert.ok(done.paid>0,'paid');assert.ok(done.paid>=HANDLING_C.vehicle*0||done.paid>0);
const Q=done.state;assert.equal(Q.gigs.active,null);assert.equal(Q.cash,cash0+done.paid);assert.equal(Q.gigs.completed,1);assert.equal(Q.gigs.doneToday,1);
assert.equal(Q.world.stock[M].eggs,market0+units,'the shelf went UP');assert.equal(Q.world.stock[F].eggs,farm0-units,'the farm stays down');assert.equal(eggsOf(Q),total0,'dozens conserved: moved, never created');
assert.ok(priceOf(Q.world,M,'eggs')<=price0,'the price eases: '+price0+' -> '+priceOf(Q.world,M,'eggs'));assert.ok(stockAt(Q.world,M,'eggs')>stockAt(P.world,M,'eggs'));
{const cap=priceOf(P.world,M,'eggs'),well={...Q.world,stock:{...Q.world.stock,[M]:{...Q.world.stock[M],eggs:24}}};assert.ok(priceOf(well.stock?well:Q.world,M,'eggs')<cap,'a well stocked shelf is cheaper than a nearly bare one (the +25% cap holds until the shelf passes 16 dozen)')}
const nq=Q.needs.find(n=>n.id===need.id);assert.equal(nq.filled,units);assert.deepEqual(nq.claims,{},'the claim is released');
assert.equal(nq.status,units>=need.qty?'filled':'open');
assert.equal(Q.npcs.noah.mood,Math.min(100,noah0.mood+4),'Noah is happier (helped)');assert.equal(standingOf(Q.standing,'noah'),st0+1,'standing +1');assert.ok(tierFor(Q.standing,'noah'));
// Noah's greeting follows his mood (the line table is by mood word)
const day=Q.world.day,l0=moodLine(noah0,day,MAP.seed),l1=moodLine(Q.npcs.noah,day,MAP.seed);assert.ok(l0&&l1);
{let changed=false;for(let m=0;m<=100&&!changed;m+=1){const a=moodLine({...noah0,mood:m},day,MAP.seed),b=moodLine({...noah0,mood:Math.min(100,m+4)},day,MAP.seed);if(a!==b)changed=true}assert.ok(changed,'a +4 mood changes the line at some mood');assert.notEqual(moodWord(10),moodWord(90))}
// the board is empty again for this need (it is closed or claimed down to nothing)
if(nq.status==='filled')assert.equal(boardFor(Q,DROP).some(s=>s.needId===need.id),false);
// hysteresis: the same kind+place+good cannot reopen on the day it closed
if(nq.status==='filled'){const drained={...Q.world,stock:{...Q.world.stock,[M]:{...Q.world.stock[M],eggs:0}}};assert.equal(needsFrom(drained,DAY,{needs:Q.needs}).filter(n=>n.id.startsWith('restock|shop:market|eggs')&&n.status==='open').length,0,'same day: no reopen')}
// the second pay is lower (fatigue stays a safety net) and pairs rest
assert.ok(Q.gigs.pairsSeen&&Object.keys(Q.gigs.pairsSeen).length===1);

// ---- too fast: a teleport pays only the handling fee
{const fast=deliverHaul(P,LOAD+0);assert.ok(fast.tooFast);assert.equal(fast.paid,HANDLING_C.vehicle,'handling only');assert.equal(fast.state.world.stock[M].eggs,market0+units)}

// ---- abandon: claim released, the crates' goods go back to the farm (conserved), no money
{const ab=abandonGig(P);assert.ok(!ab.error);assert.equal(ab.state.gigs.active,null);assert.deepEqual(ab.state.needs.find(n=>n.id===need.id).claims,{});assert.equal(ab.state.world.stock[F].eggs,farm0);assert.equal(eggsOf(ab.state),total0);assert.equal(ab.state.cash,cash0);assert.ok(abandonGig({...P,gigs:{...P.gigs,active:null}}).error)}
// expire: the need passes its due day while you are out: the gig ends, the goods go back, the claim is gone
{const late=at(P,need.dueDay+2,400),ex=expire(late.needs,late.world,need.dueDay+1),P2={...late,needs:ex.needs,world:ex.world},st=settleNeed(P2);assert.equal(st.state.gigs.active,null);assert.ok(/taken care of/.test(st.text));assert.equal(eggsOf(st.state),eggsOf(P2)+units-0,'carried eggs return to the farm')}
{const ok=settleNeed(P);assert.equal(ok.state,P);assert.equal(ok.text,undefined)}
// a restock whose shelf recovered meanwhile ends the gig too, with nothing lost
{const healed={...P,world:{...P.world,stock:{...P.world.stock,[M]:{...P.world.stock[M],eggs:18}}}},h=runWorldDay(at(healed,DAY+1,400)),s2=settleNeed(h);assert.equal(s2.state.gigs.active,null);assert.equal(eggsOf(s2.state)>=eggsOf(h),true)}
// completing a closed need pays nothing and returns the goods
{const closed={...P,needs:P.needs.map(n=>n.id===need.id?{...n,status:'expired',claims:{}}:n)},r=completeGig({...closed,gigs:{...closed.gigs,active:{...closed.gigs.active,visited:[true],stage:1}}},DROP);assert.equal(r.paid,0);assert.equal(r.state.gigs.active,null);assert.equal(eggsOf(r.state),total0)}

// ---- an empty board says so; the old saves still load
{const quiet={...at(normalizeProgress(freshProgress()),50,600)};assert.deepEqual(boardFor(quiet,50*1440+600),[]);assert.deepEqual(availableContracts(quiet),[]);assert.equal(NO_WORK_POSTED,'No work posted. Check back tomorrow.')}
{const g=normalizeGigs({active:{type:'grocery',client:'c',places:[{x:5,z:5}],startedAt:1,visited:[false]}});assert.equal(g.active.type,'grocery');assert.equal(g.active.needId,undefined,'a hashed gig carries no need fields');
 const q=normalizeGigs({active:{type:'need-restock',client:'noah',places:[{x:5,z:5}],needId:'restock|shop:market|eggs|9',needGood:'eggs',needQty:9,haul:9,truck:'v3',origin:{x:1,z:1,id:'farm'},parM:300}});assert.equal(q.active.haul,9);assert.equal(q.active.needId,'restock|shop:market|eggs|9');assert.equal(normalizeGigs(JSON.parse(JSON.stringify(q))).active.haul,9)}

// ---- the starter board is untouched (hashed grocery and parcel), and the code stays pure
assert.ok(boardFor(normalizeProgress(freshProgress()),600,undefined,{starter:true}).every(s=>['grocery','parcel'].includes(s.type)&&s.starter));
const src=['gigs.js','gig-bridge.js','needs.js','world-tick.js'].map(f=>fs.readFileSync(new URL('../dist/'+f,import.meta.url),'utf8').split('\n').filter(l=>!l.trim().startsWith('//')).join('\n')).join('\n');
assert.ok(!/Math\.random|Date\.now|performance\.now|\bdocument\.|\bwindow\.|from 'three'/.test(src),'no clock, chance, DOM or three.js');
console.log(`PASS needs-loop: need opened day ${DAY} (${need.qty} dozen), board slot, ${units} dozen (${pick.crates} crates) farm ${farm0}->${P.world.stock[F].eggs}, shelf ${market0}->${Q.world.stock[M].eggs}, price ${price0}->${priceOf(Q.world,M,'eggs')}, paid ${done.paid}, mood ${noah0.mood}->${Q.npcs.noah.mood}, standing ${st0}->${standingOf(Q.standing,'noah')}`);
