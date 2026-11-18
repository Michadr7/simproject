// "Clear the way makes no sense" fix (notes/eval/outbox/clear-way.md): the world's clear and repair needs have no real obstacle or broken object behind them, so they never reach the board (OFF_KINDS in dist/needs.js); an old save's open need or active gig of those kinds still loads, completes or is abandoned safely.
import assert from 'node:assert/strict';
import {freshProgress,normalizeProgress,saveProgress,loadProgress} from '../dist/jobs.js';
import {normalizeWorld} from '../dist/world-state.js';
import {MAP} from '../dist/map-definition.js';
import {needsFrom,retireOffKinds,OFF_KINDS,isBoardable,KINDS,TEMPLATES}from '../dist/needs.js';
import {runWorldDay} from '../dist/world-tick.js';
import {boardFor,gameMinutes,completeGig,abandonGig,tickGig,normalizeGigs,acceptGig,typeById,settleNeed}from '../dist/gigs.js';
import {availableContracts,acceptContract}from '../dist/gig-bridge.js';

const M='shop:market',F='property:farm-house',DAY=7;
const at=(P,day,minutes)=>({...P,housing:{...P.housing,day:day+1},routine:{...P.routine,minutes}});
const need=(kind,id,o={})=>({id,kind,place:M,good:'',person:'',qty:1,filled:0,openedDay:DAY-1,dueDay:DAY+2,closedDay:-1,unitCents:800,claims:{},status:'open',origin:'',...o});
const CLEAR=need('clear','clear|shop:market||6'),REPAIR=need('repair','repair|shop:market||6'),TEND=need('tend','tend|shop:market||6');
const quiet=normalizeWorld(null,MAP.seed,DAY);

// the rule itself: exactly clear and repair are off; every other kind is boardable and the kind table is untouched
assert.deepEqual([...OFF_KINDS],['clear','repair']);
for(const k of KINDS)assert.equal(isBoardable(k),!OFF_KINDS.includes(k),k);
assert.ok(KINDS.includes('clear')&&KINDS.includes('repair')&&TEMPLATES.clear&&TEMPLATES.repair&&typeById('need-clear')&&typeById('need-repair'),'the kinds stay in the tables for old saves and stage P-F');

// needsFrom with boardOnly (what the world tick uses): events and seeds of those kinds open nothing; other kinds still open
{const ctx={needSeeds:[{kind:'clear',place:M,qty:1},{kind:'repair',place:F,qty:1},{kind:'tend',place:F,qty:1}],events:[{kind:'tree-down',at:M},{kind:'broken-fence',at:F},{kind:'road-blocked',at:M}]};
 const board=needsFrom(quiet,DAY,{...ctx,boardOnly:true});assert.ok(!board.some(n=>OFF_KINDS.includes(n.kind)),'boardOnly: no clear or repair need opens');assert.ok(board.some(n=>n.kind==='tend'),'a tend chore still opens (unchanged)');
 const open=needsFrom(quiet,DAY,ctx);assert.ok(open.some(n=>n.kind==='clear')&&open.some(n=>n.kind==='repair'),'the pure function without boardOnly is unchanged (P-F will use it)')}
// a sick neighbour's errand and a boardable restock are unchanged by the rule
{const w=normalizeWorld(null,MAP.seed,DAY);w.stock[M].eggs=2;w.stock[F].eggs=40;const b=needsFrom(w,DAY,{boardOnly:true});assert.ok(b.some(n=>n.kind==='restock'&&n.good==='eggs'),'the egg restock still opens')}

// retireOffKinds: open clear/repair go (no penalty), the active gig's need stays, closed ones and other kinds stay, input untouched
{const list=[CLEAR,REPAIR,TEND,need('clear','clear|a||1',{status:'filled',closedDay:DAY}),need('clear','clear|b||1',{status:'expired',closedDay:DAY})],snap=JSON.stringify(list);
 const out=retireOffKinds(list);assert.deepEqual(out.map(n=>n.id).sort(),['clear|a||1','clear|b||1','tend|shop:market||6']);assert.equal(JSON.stringify(list),snap,'input untouched');
 assert.deepEqual(retireOffKinds(list,[CLEAR.id]).map(n=>n.id).sort(),['clear|a||1','clear|b||1','clear|shop:market||6','tend|shop:market||6'],'the active gig keeps its need');
 assert.deepEqual(retireOffKinds(undefined),[]);assert.deepEqual(retireOffKinds('junk',null),[])}

// the board and the phone: an open clear/repair need (an old save) is never offered; a tend need still is
const P0=at(freshProgress(),DAY,600),NOW=gameMinutes(P0);
{const onlyOff={...P0,needs:[CLEAR,REPAIR]};assert.deepEqual(boardFor(onlyOff,NOW),[],'no board gig from clear or repair');assert.deepEqual(availableContracts(onlyOff),[],'nothing on the phone or counter');assert.ok(acceptContract(onlyOff,'slot-0').error);assert.ok(acceptGig(onlyOff,0,NOW).error);
 const mixed={...P0,needs:[CLEAR,TEND,REPAIR]},b=boardFor(mixed,NOW);assert.equal(b.length,1);assert.equal(b[0].kind,'tend');assert.equal(availableContracts(mixed).length,1)}

// the daily tick: an old open clear need goes quietly (even past due), with no mood or prosperity penalty; other needs are left alone
{const old=need('clear','clear|shop:market||1',{openedDay:DAY-5,dueDay:DAY-3}),P1={...at(freshProgress(),DAY+1,400),world:normalizeWorld(null,MAP.seed,DAY),needs:[old,TEND]};
 const t=runWorldDay(P1);assert.ok(!t.needs.some(n=>n.kind==='clear'&&n.status!=='filled'),'no clear need left (not even expired): '+JSON.stringify(t.needs.map(n=>[n.id,n.status])));
 assert.ok(t.needs.some(n=>n.id===TEND.id&&n.status==='open'),'the tend need is untouched');
 const ref=runWorldDay({...P1,needs:[TEND]});assert.equal(t.npcs.noah.mood,ref.npcs.noah.mood,'the dropped need cost the keeper no mood');assert.deepEqual(t.world.town,ref.world.town,'nor prosperity')}

// an old save mid-gig: the active clear gig (stops walked, 'Return for payment') loads, survives the daily tick, and pays out normally
const ACT={type:'need-clear',client:'noah',id:9,places:[{x:5,z:5}],startedAt:NOW-30,acceptedAt:NOW-30,visited:[true],stage:1,needId:CLEAR.id,needGood:'',needQty:1,needTitle:'Clear the way',needText:'Something is blocking Corner Market. Clear it.',origin:{x:0,z:0,id:'a'},parM:300,mode:'walk'};
const oldSave=()=>{const b=at(freshProgress(),DAY,600);return {...b,needs:[{...CLEAR,claims:{player:{qty:1,at:NOW-30}}}],gigs:{...b.gigs,active:normalizeGigs({active:ACT}).active,nextId:10}}};
{let S=oldSave();assert.equal(S.gigs.active.needId,CLEAR.id);
 let raw;const st={getItem:()=>raw,setItem:(k,v)=>raw=v};saveProgress(st,S);const back=loadProgress(st);assert.equal(back.gigs.active.type,'need-clear');assert.equal(back.gigs.active.needId,CLEAR.id);assert.ok(back.needs.some(n=>n.id===CLEAR.id&&n.status==='open'),'the need loads open');
 const ticked=runWorldDay(at(back,DAY+1,400));assert.ok(ticked.needs.some(n=>n.id===CLEAR.id&&n.status==='open'),'the daily tick keeps the need under the active gig');assert.equal(settleNeed(ticked).state,ticked,'the gig is not ended by the tick');
 const same=tickGig(back,{position:{x:5,z:5},room:'street',now:NOW});assert.equal(same.gigs.active.stage,1);
 const cash0=back.cash,done=completeGig(back,NOW);assert.ok(!done.error,JSON.stringify(done));assert.ok(done.paid>0,'paid in full');assert.equal(done.state.cash,cash0+done.paid,'money arrives');assert.equal(done.state.gigs.active,null);assert.equal(done.state.needs.find(n=>n.id===CLEAR.id).status,'filled');
 // the card text the owner saw is still what the save carries (nothing crashes on it)
 assert.equal(normalizeProgress(JSON.parse(JSON.stringify(back))).gigs.active.needTitle,'Clear the way');
 // finished: the next tick has nothing left of it, and no new clear need appears
 const after=runWorldDay(at(done.state,DAY+1,400));assert.ok(!after.needs.some(n=>n.kind==='clear'&&n.status==='open'));
 // or the player gives it up: no money, no rep loss, no stuck gig; the need goes at the next tick
 const ab=abandonGig(back);assert.ok(!ab.error);assert.equal(ab.state.gigs.active,null);assert.equal(ab.state.cash,back.cash);assert.equal(ab.state.gigs.rep,back.gigs.rep);assert.deepEqual(ab.state.needs.find(n=>n.id===CLEAR.id).claims,{});
 const gone=runWorldDay(at(ab.state,DAY+1,400));assert.ok(!gone.needs.some(n=>n.id===CLEAR.id&&n.status==='open'),'an abandoned old clear need is retired at the next tick');
 // an old active gig whose need is already gone: completing it closes it safely with nothing paid
 const orphan={...back,needs:[]},o=completeGig(orphan,NOW);assert.equal(o.paid,0);assert.equal(o.state.gigs.active,null);assert.equal(o.state.cash,back.cash,'no money from nothing');assert.equal(settleNeed(orphan).state.gigs.active,null,'settleNeed ends it too')}

console.log('PASS clear-way: clear/repair needs never reach the board, old saves complete or abandon safely, other kinds unchanged');
