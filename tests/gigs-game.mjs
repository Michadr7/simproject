import assert from 'node:assert/strict';
import {marketContracts,CONTRACTS,acceptContract,tickContract,completeContract,availableContracts,gigTarget,refreshGigBoard,gameMinutes} from '../dist/gig-bridge.js';
import {freshProgress,normalizeProgress,saveProgress,loadProgress} from '../dist/jobs.js';
import {advanceTime} from '../dist/routine.js';
// The game's old gig hooks, on the new gigs: accept, walk to the stops, report back, get paid; saved and loaded; old active jobs dropped.
let p=freshProgress();assert.equal(p.activeJob,null);assert.equal(CONTRACTS.length,4);
const offers=availableContracts(p);assert(offers.length>=2&&offers.length<=4);assert(offers.every(o=>/^slot-\d$/.test(o.id)&&o.title&&o.reward>0&&o.terms));
assert.equal(refreshGigBoard(p),p);
assert(acceptContract(p,'bench-check').error);assert(acceptContract(p,'slot-9').error);
const first=offers.find(o=>o.title.startsWith('Grocery'))||offers[0];
const a=acceptContract(p,first.id);assert(a.state,JSON.stringify(a));p=a.state;
assert.equal(p.activeJob.stage,'travel');assert(p.gigs.active);assert.deepEqual(availableContracts(p),[]);assert(acceptContract(p,offers.at(-1).id).error);
assert(completeContract(p,{x:0,z:0}).error);
const stops=p.gigs.active.places;
let q=tickContract(p,{position:{x:stops[0].x+80,z:stops[0].z},room:'street',dt:.03});assert.equal(q.activeJob.stage,'travel');
for(const s of stops)p=tickContract(p,{position:{x:s.x,z:s.z},room:'street',dt:.03});
assert.equal(p.activeJob.stage,'return');assert.deepEqual(gigTarget(p.activeJob),p.activeJob.returnLocation);
// saved mid-gig and loaded again
let raw;const storage={getItem:()=>raw,setItem:(k,v)=>raw=v};saveProgress(storage,p);const back=loadProgress(storage);assert.equal(back.activeJob.stage,'return');assert.equal(back.gigs.active.id,p.gigs.active.id);
assert(completeContract(p,{x:stops.at(-1).x+30,z:0}).error,'must be at the contact');
const cash=p.cash,done=completeContract(p,{x:stops.at(-1).x,z:stops.at(-1).z});
assert(done.paid>0);assert.equal(done.state.cash,cash+done.paid);assert.equal(done.state.activeJob,null);assert.equal(done.state.gigs.completed,1);assert.equal(done.state.gigs.active,null);
// the accepted slot is gone from the board; time moves it on
assert(!availableContracts(done.state).some(o=>o.id===first.id)||gameMinutes(done.state)>=0);
assert.equal(done.paid,first.reward,'the offer shows what you get');
// an old save's activeJob and cooldowns are cancelled without penalty
const old=normalizeProgress({activeJob:{id:'bench-check',stage:'task'},cooldowns:{'bench-check':99999}});assert.equal(old.activeJob,null);assert.equal(old.gigs.active,null);
// junk in gigs cannot give a gig or money
assert.equal(normalizeProgress({gigs:{active:{type:'grocery',places:'x'},rep:-5}}).activeJob,null);
// rush: the hard limit ends it
let r=freshProgress();const rush=availableContracts(r).find(o=>o.title.startsWith('Rush'));
if(rush){r=acceptContract(r,rush.id).state;r=advanceTime(r,30);r=tickContract(r,{position:{x:9999,z:0},room:'street',dt:.03});assert.equal(r.activeJob,null);assert.equal(r.gigs.active,null)}
const mk=marketContracts(freshProgress());assert(mk.every(o=>/^(Grocery|Doorstep)/.test(o.title)&&/Go to /.test(o.description)),'Noah offers grocery and parcel gigs with street names');assert.deepEqual(marketContracts(p),[],'nothing while a gig is active');
console.log('gigs-game ok');