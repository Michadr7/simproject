import assert from 'node:assert/strict';
import {dropParcel,pickParcel,parcelHeld,parcelDropped,normalizeDrop,PARCEL_FIRST,PARCEL_HANDS} from '../dist/gig-parcel.js';
import {acceptContract,tickContract,completeContract,dropGigParcel,pickGigParcel,availableContracts} from '../dist/gig-bridge.js';
import {normalizeGigs,tickGig,completeGig,failGig} from '../dist/gigs.js';
import {freshProgress,normalizeProgress,saveProgress,loadProgress} from '../dist/jobs.js';
import {shoulderLog,takePlanks,pickUpPlanks} from '../dist/carry.js';
// G2b: the gig parcel on the ground. Pure drop/pick, delivery needs the box in hand, saved with the gig, cleared when the gig ends, one thing in the hands.
const fresh=freshProgress();assert.equal(parcelHeld(fresh),false);assert(dropParcel(fresh,{x:1,z:1}).error,'no gig, nothing to put down');assert(pickParcel(fresh).error);
const offers=availableContracts(fresh),start=offers.find(o=>/Doorstep/.test(o.title))||offers[0];
let p=acceptContract(fresh,start.id,{x:0,z:0}).state;assert(parcelHeld(p));assert.equal(p.gigs.active.drop,null);
// drop sets the position, the gig stays active, the view says dropped
const d=dropGigParcel(p,{x:12.5,z:-3});assert.equal(d.error,undefined);p=d.state;assert(parcelDropped(p)&&!parcelHeld(p));assert.deepEqual(p.gigs.active.drop,{x:12.5,z:-3});assert.equal(p.activeJob.dropped,true);assert(/E beside it/.test(d.message));
assert(dropGigParcel(p,{x:1,z:1}).error,'already on the ground');assert(dropParcel(parcelHeld(fresh)?fresh:acceptContract(fresh,start.id).state,{x:NaN,z:2}).error,'junk spot refused');
// delivery refused while the box is on the ground: walking to every stop ticks nothing, completing is refused
const stops=p.gigs.active.places;let q=p;for(const s of stops)q=tickContract(q,{position:{x:s.x,z:s.z},room:'street',dt:.03});assert.deepEqual(q.gigs.active.visited,stops.map(()=>false),'a box on the ground delivers nothing');assert.equal(q.activeJob.stage,'travel');
let done=p;done={...done,gigs:{...done.gigs,active:{...done.gigs.active,visited:stops.map(()=>true),stage:stops.length}}};assert.equal(completeGig(done,100).error,PARCEL_FIRST);
// pick up clears the drop; then the stops tick and the gig completes
const back=pickGigParcel(p);assert.equal(back.error,undefined);p=back.state;assert(parcelHeld(p));assert.equal(p.gigs.active.drop,null);assert.equal(p.activeJob.dropped,false);assert(pickGigParcel(p).error,'nothing on the ground to pick up');
for(const s of stops)p=tickContract(p,{position:{x:s.x,z:s.z},room:'street',dt:.03});assert.equal(p.activeJob.stage,'return');
const last=stops.at(-1),paid=completeContract(p,{x:last.x,z:last.z});assert(paid.paid>0);assert.equal(paid.state.gigs.active,null,'a finished gig takes the box with it');assert(!parcelHeld(paid.state)&&!parcelDropped(paid.state));
// dropped at the end (stage return) the report back is refused until picked up
let r=p;r=dropGigParcel(r,{x:last.x+.5,z:last.z}).state;assert.equal(completeContract(r,{x:last.x,z:last.z}).error!==undefined,true);assert(completeContract(pickGigParcel(r).state,{x:last.x,z:last.z}).paid>0);
// save round trip mid-gig with the box on the ground
let raw;const storage={getItem:()=>raw,setItem:(k,v)=>raw=v};const dr=dropGigParcel(pickGigParcel(r).state,{x:7.25,z:-1.5}).state;saveProgress(storage,dr);const loaded=loadProgress(storage);assert.deepEqual(loaded.gigs.active.drop,{x:7.25,z:-1.5});assert.equal(loaded.activeJob.dropped,true);
// an old save without a drop works and holds the box; junk positions are dropped
const old=JSON.parse(JSON.stringify(dr.gigs));delete old.active.drop;assert.equal(normalizeGigs(old).active.drop,null);
for(const bad of [{x:'a',z:1},{x:Infinity,z:0},{x:1},'x',[],null,{x:NaN,z:NaN}])assert.equal(normalizeGigs({...old,active:{...old.active,drop:bad}}).active.drop,null,'junk drop '+JSON.stringify(bad));
assert.deepEqual(normalizeDrop({x:99999,z:-99999}),{x:2000,z:-2000});assert.equal(normalizeProgress(JSON.parse(JSON.stringify(dr))).gigs.active.drop.x,7.25);
// the gig ends, fails or is abandoned: the drop goes with the active gig
assert.equal(failGig(dr).gigs.active,null);assert.equal(normalizeGigs({...dr.gigs,active:null}).active,null);
// one thing in the hands: planks or a log cannot be picked up while the box is held, the box cannot be picked up with planks in hands
const held=acceptContract(fresh,start.id).state;assert.equal(takePlanks({...held,belt:2}).error,PARCEL_HANDS);assert.equal(pickUpPlanks({...held,plankDrops:[{id:1,x:0,z:0,count:4,q:0}]},1).error,PARCEL_HANDS);assert.equal(shoulderLog({...held,logs:[{id:1,x:0,z:0}]},1).error,PARCEL_HANDS);
assert(takePlanks({...dr,belt:2}).state,'with the box on the ground the hands are free');
const full={...dr,carry:{kind:'planks',count:4}};assert(/hands are full/i.test(pickGigParcel(full).error),'cannot pick up the box with planks in hands');
// G3b: the box is a real carton model (small for an ordinary gig, medium for a large one; clean or dirty by a fixed hash of client and id, never random)
{const {parcelModelId,PARCEL_MODELS,PARCEL_DEFAULT}=await import('../dist/gig-parcel.js'),{PROPS}=await import('../dist/props-assets.js');
 assert.equal(PARCEL_DEFAULT,'prop.carton-small');assert.equal(parcelModelId(null),PARCEL_DEFAULT);assert.equal(parcelModelId(p.gigs.active),parcelModelId({...p.gigs.active}),'same gig, same box');
 const all=[...PARCEL_MODELS.small,...PARCEL_MODELS.large];for(const id of all)assert(PROPS[id]&&PROPS[id].texture,id+' is a shipped textured prop');
 let dirty=0,N=700;for(let i=1;i<=N;i++){const id=parcelModelId({id:i,client:'c'+(i%13)});assert(PARCEL_MODELS.small.includes(id),'ordinary gig: small carton');if(id.endsWith('dirty'))dirty++;assert(PARCEL_MODELS.large.includes(parcelModelId({id:i,client:'c'+(i%13),large:true})),'large gig: medium carton')}
 assert(dirty>N*.15&&dirty<N*.45,'about two in seven are dirty: '+dirty);
 assert(!all.some(id=>/box-small|box-medium/.test(id)),'the old flat-colour boxes are not the parcel any more');
 const sz=id=>[PROPS[id].width,PROPS[id].depth,PROPS[id].height];assert(sz('prop.carton-small')[0]<=.31&&sz('prop.carton-medium')[0]<=.41,'carriable in the arms')}
console.log('gig-parcel ok');