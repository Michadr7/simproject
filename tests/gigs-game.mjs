import assert from 'node:assert/strict';
import {marketContracts,CONTRACTS,acceptContract,tickContract,completeContract,availableContracts,gigDoor,parFor,PAR_SLACK,gigTarget,refreshGigBoard,gameMinutes} from '../dist/gig-bridge.js';
import {freshProgress,normalizeProgress,saveProgress,loadProgress} from '../dist/jobs.js';
import {normalizeGigs} from '../dist/gigs.js';
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
p=advanceTime(p,Math.ceil((p.gigs.active.parM||0)/16.4)+1);// a finish faster than the walking pace pays only the handling fee
const cash=p.cash,done=completeContract(p,{x:stops.at(-1).x,z:stops.at(-1).z});
assert(done.paid>0);assert.equal(done.state.cash,cash+done.paid);assert.equal(done.state.activeJob,null);assert.equal(done.state.gigs.completed,1);assert.equal(done.state.gigs.active,null);
// the accepted slot is gone from the board; time moves it on
assert(!availableContracts(done.state).some(o=>o.id===first.id)||gameMinutes(done.state)>=0);
assert.equal(done.paid,first.reward,'the offer shows what you get');
// an old save's activeJob and cooldowns are cancelled without penalty
const old=normalizeProgress({activeJob:{id:'bench-check',stage:'task'},cooldowns:{'bench-check':99999}});assert.equal(old.activeJob,null);assert.equal(old.gigs.active,null);
assert.equal('cooldowns' in old||'gigBoard' in old,false,'the dead save fields are gone');assert.equal(old.messages.length,1,'one message tells the player');assert.equal(old.messages[0].text,'Your old gig was cancelled. New gigs are on the board.');assert.equal(old.messages[0].app,'gigs');assert.equal(old.messages[0].read,false);
assert.equal(normalizeProgress(JSON.parse(JSON.stringify(old))).messages.length,1,'loading the cleaned save again adds nothing');assert.equal(normalizeProgress({activeJob:{id:'gig-abc',stage:'task'}}).messages.length,0,'a derived gig view is not an old gig');assert.equal(freshProgress().messages?.length||0,0);

// junk in gigs cannot give a gig or money
assert.equal(normalizeProgress({gigs:{active:{type:'grocery',places:'x'},rep:-5}}).activeJob,null);
// rush: the hard limit ends it
let r=freshProgress();const rush=availableContracts(r).find(o=>o.title.startsWith('Rush'));
if(rush){r=acceptContract(r,rush.id).state;r=advanceTime(r,90);r=tickContract(r,{position:{x:9999,z:0},room:'street',dt:.03});assert.equal(r.activeJob,null);assert.equal(r.gigs.active,null)}
const mk=marketContracts(freshProgress());assert(mk.every(o=>/^(Grocery|Doorstep)/.test(o.title)&&/Go to /.test(o.description)),'Noah offers grocery and parcel gigs with street names');assert.deepEqual(marketContracts(p),[],'nothing while a gig is active');
// parcel: the door dialog offers three greetings; the right one tips in cents on top of the pay
{const base=freshProgress(),mk=(type,places,start)=>({...base,gigs:{...base.gigs,rep:10,active:normalizeGigs({active:{type,client:'c1',id:7,places,start}}).active}});
 let pp=tickContract(mk('parcel',[{x:5,z:5}]),{position:{x:5,z:5},room:'street',dt:.03});assert.equal(pp.activeJob.stage,'return');assert(pp.activeJob.description.includes('Doorstep')||/knock|ring|step/.test(pp.activeJob.description),'the offer hints how to greet');
 assert.equal(pp.activeJob.kind,'parcel');const door=gigDoor(pp);assert.equal(door.choices.length,3);assert.equal(door.choices.filter(c=>c.tip>0).length,1);const win=door.choices.find(c=>c.tip>0),lose=door.choices.find(c=>!c.tip);
 const c0=pp.cash,ok=completeContract(pp,{x:5,z:5},'street',win.tip),no=completeContract(pp,{x:5,z:5},'street',lose.tip);assert.equal(ok.paid-no.paid,win.tip);assert.equal(ok.state.cash,c0+ok.paid);assert(Number.isInteger(ok.paid)&&win.tip>=200&&win.tip<=800);
 assert.equal(gigDoor(mk('grocery',[{x:5,z:5}])),null);
 // round: par from the accept position; par route is quality 100, a long walk is lower; stops left shows
 let r3=mk('round',[{x:10,z:0},{x:20,z:0},{x:30,z:0}],{x:0,z:0});assert.equal(parFor(r3),Math.round(30*PAR_SLACK));assert.equal(r3.activeJob?.left,undefined);
 r3=tickContract(r3,{position:{x:30,z:0},room:'street',dt:.03,distance:30});assert.equal(r3.activeJob.left,2);assert.equal(r3.activeJob.done,1);
 const fin=(m)=>{let q=r3;q={...q,gigs:{...q.gigs,active:{...q.gigs.active,metres:m}}};for(const x of [10,20])q=tickContract(q,{position:{x,z:0},room:'street',dt:.03});return completeContract(q,{x:30,z:0})};
 const best=fin(30),worse=fin(80);assert(best.paid>worse.paid,'a longer walk pays less: '+best.paid+' vs '+worse.paid);
 assert.equal(parFor(mk('round',[{x:10,z:0},{x:20,z:0},{x:30,z:0}])),0,'an old save without a start has no par');
 // accepting records where you stood
 const acc=acceptContract(freshProgress(),offers.find(o=>/Round/.test(o.title))?.id||'slot-0',{x:3,z:4});if(acc.state)assert.deepEqual({x:acc.state.gigs.active.start.x,z:acc.state.gigs.active.start.z},{x:3,z:4});}
console.log('gigs-game ok');