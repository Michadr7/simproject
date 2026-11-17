// Audit fixes (notes/eval/reviews/gemini-audit-0.35.17.md #2, #3, #8 and the minor C-B items), the pure parts: the need-crate bed rule, the parcel left on a far bed, the cargo picture of parcels and boxes, the arms pose, orphan parcels.
import assert from 'node:assert/strict';
import {addCrates,removeCrates,CRATE_MIX} from '../dist/cargo.js';
import {needCratesFit,NEED_BED_BUSY,purgeOrphanParcels} from '../dist/cargo-items.js';
import {parcelAway,PARCEL_ON_BED,PARCEL_BED_REACH} from '../dist/gig-parcel.js';
import {normalizeGigs,tickGig,completeGig} from '../dist/gigs.js';
import {freshProgress} from '../dist/jobs.js';
import {createCargoView} from '../dist/cargo-view.js';
import {poseFor} from '../dist/carry-pose.js';

// #2: a crate next to a box or a parcel: addCrates refuses the rebuilt bed (the bug lost the farm's eggs), so the need run refuses such a bed before any stock moves
const P7={k:'parcel',g:7,m:'prop.carton-small'};
assert.equal(addCrates(removeCrates([{k:'crate'},{k:'box'}]).cargo,'shortbed',2).error,CRATE_MIX,'the old failure: a box beside the crates');
assert.equal(addCrates(removeCrates([{k:'crate'},P7]).cargo,'shortbed',2).error,CRATE_MIX,'and a parcel');
for(const bed of [[{k:'crate'},{k:'box'}],[{k:'crate'},P7],[{k:'log'}],[{k:'planks',n:2}],[{k:'box'}],[null]])assert.equal(needCratesFit(bed),false,'refused: '+JSON.stringify(bed));
for(const bed of [null,undefined,[],[{k:'crate'}],[{k:'crate'},{k:'crate'}]])assert.equal(needCratesFit(bed),true,'free for crates: '+JSON.stringify(bed));
assert.equal(NEED_BED_BUSY,'Clear the bed first.');

// #3: the parcel on a bed counts only with you
const base=freshProgress(),gig=(extra={})=>({...base,gigs:{...base.gigs,rep:10,active:normalizeGigs({active:{type:'parcel',client:'c1',id:7,places:[{x:5,z:5}],...extra}}).active}});
const onBed={...gig(),carry:null},truck=(x,z,cargo=[P7])=>({cargo,state:{x,z}}),far=truck(80,5),near=truck(5+PARCEL_BED_REACH-1,5),at={x:5,z:5};
assert.equal(PARCEL_ON_BED,'Take the parcel off the truck first.');
assert.equal(parcelAway(onBed,[far],at),true,'on a bed 75 m away');assert.equal(parcelAway(onBed,[near],at),false,'the truck is within reach');assert.equal(parcelAway(onBed,[far],at,far),false,'you sit in it');
assert.equal(parcelAway({...onBed,carry:{kind:'parcel',gig:7,model:'prop.carton-small'}},[far],at),false,'in the hands');
assert.equal(parcelAway(onBed,[truck(80,5,[{k:'parcel',g:8}])],at),false,'another gig piece is not this parcel');assert.equal(parcelAway(onBed,[],at),false,'on no bed (old flag)');
assert.equal(parcelAway(gig({drop:{x:1,z:1}}),[far],at),false,'on the ground: the drop rules apply');assert.equal(parcelAway(freshProgress(),[far],at),false,'no gig');assert.equal(parcelAway(onBed,[far],null),false);assert.equal(parcelAway(onBed,null,at),false);
assert.equal(parcelAway(onBed,[{cargo:[P7],state:{x:NaN,z:0}}],at),true,'a bad pose is not within reach');
// tickGig: no stop ticks off while it is away; completeGig refuses to pay
const t0=tickGig(onBed,{position:at,parcelAway:true});assert.equal(t0.gigs.active.visited[0],false,'away: the door does not tick');
const t1=tickGig(onBed,{position:at});assert.equal(t1.gigs.active.visited[0],true,'with you: it ticks');
assert.equal(completeGig(t1,undefined,{parcelAway:true}).error,PARCEL_ON_BED,'away: no pay');assert(!completeGig(t1,undefined,{}).error,'with you: paid');
{const need={...base,gigs:{...base.gigs,active:normalizeGigs({active:{type:'need-clear',client:'noah',id:9,places:[{x:5,z:5}],needId:'clear|shop:market||6',parM:300}}).active}};assert.equal(tickGig(need,{position:at,parcelAway:true}).gigs.active.visited[0],true,'a need gig has no parcel: the flag is ignored')}

// #8: the bed picture counts only planks as plank stacks; a box is the medium carton (one InstancedMesh); a parcel is game.js's own mesh
{const v=createCargoView('flatbed');v.set([P7,{k:'box'}]);assert.equal(v.count('planks'),0,'no plank stack');assert.equal(v.boards(),0);const bm=v.group.children.find(m=>m.name==='cargo-box');assert(bm&&bm.isInstancedMesh,'the box mesh');assert.equal(bm.count,1);
 v.set([{k:'planks',n:3},P7,{k:'box'},{k:'box'},{k:'log'}]);assert.equal(v.count('planks'),1);assert.equal(v.boards(),3);assert.equal(bm.count,2);assert.equal(v.count('log'),1);assert.equal(v.group.children.filter(m=>m.name==='cargo-box').length,1,'still one box mesh');
 v.set(null);assert.equal(bm.count,0,'empty bed: nothing drawn');
 const c=createCargoView('shortbed');c.set([{k:'crate'},P7,{k:'box'}]);assert.equal(c.count('crate'),1);assert.equal(c.count('planks'),0);assert.equal(c.group.children.find(m=>m.name==='cargo-box').count,1);
 assert.equal(createCargoView('flatbed').group.children.some(m=>m.name==='cargo-box'),false,'no box mesh before the first box')}

// minor: the arms pose for a crate, a box or the parcel piece in the hands
assert.equal(poseFor({carry:{kind:'crate'}}),'box');assert.equal(poseFor({carry:{kind:'box'}}),'box');assert.equal(poseFor({carry:{kind:'crate'}},{freeArms:false}),null,'indoors: off, like the log');assert.equal(poseFor({carry:{kind:'box'}},{seated:true}),null);assert.equal(poseFor({carry:{kind:'crate'},equipped:'axe'}),null);
assert.equal(poseFor({carry:{kind:'parcel',gig:7}},{parcelInHands:true}),'box');assert.equal(poseFor({carry:{kind:'parcel',gig:7}},{parcelInHands:false}),null,'the parcel is on a bed or the ground');

// minor: a parcel piece of a gig still waiting at its pickup point is an orphan (the gig is not picked up yet)
{const wait=gig({origin:{x:1,z:1,room:'street'},pickedAt:null});assert.equal(wait.gigs.active.pickedAt??null,null);
 assert.equal(purgeOrphanParcels({...wait,carry:{kind:'parcel',gig:7,model:'prop.carton-small'}}).carry,null,'waiting: no piece in the hands');
 const took=gig({origin:{x:1,z:1,room:'street'},pickedAt:5});assert.equal(purgeOrphanParcels({...took,carry:{kind:'parcel',gig:7,model:'prop.carton-small'}}).carry.kind,'parcel','picked up: kept')}

console.log('PASS parcel-fixes.mjs: a crate bed with anything else on it refuses the need crates (Clear the bed first.), a parcel on a far bed ticks no stop and pays nothing (in hand, ridden or within '+PARCEL_BED_REACH+' m it does), parcels and boxes are no plank stacks and a box is drawn as the carton, the arms hold a crate, box or parcel piece, and a parcel of a gig not yet picked up is an orphan.');
