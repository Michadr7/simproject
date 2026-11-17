// ATV-STOW: load drag (load-drag.js), the ATV's small rack bed (cargo.js) and a parcel stowed on the ATV (gig-parcel.js). All pure.
import assert from 'node:assert/strict';
import {loadFactor,isHeavy,cargoMassKg,parcelMassKg,MASS_KG,DRAG_PER_KG,MIN_FACTOR,HEAVY_BELOW} from '../dist/load-drag.js';
import {BEDS,capacity,spaceOf,addCrates,addPlanks,loadCarry,normalizeCargo,slotPositions,fits,hasBed,takesCrateGigs,acceptsCrates,loadPoints} from '../dist/cargo.js';
import {parcelHeld,canStow,stowed,mountError,dropParcel,pickParcel,PARCEL_HANDS,RACK_BUSY} from '../dist/gig-parcel.js';
import {usesLoadDrag,loadOf} from '../dist/cargo.js';
import {CLASSES,withLoad} from '../dist/vehicle.js';
import {readFileSync} from 'node:fs';
import {hasCrateBed} from '../dist/gigs.js';

// the factor: 4 % per 10 kg, never below 0.6, always 0..1
assert.equal(loadFactor(0),1);assert.equal(loadFactor(-5),1);assert.equal(loadFactor(NaN),1);
assert(Math.abs(loadFactor(10)-.96)<1e-9);assert(Math.abs(loadFactor(40)-.84)<1e-9);
assert.equal(loadFactor(100),MIN_FACTOR);assert.equal(loadFactor(5000),.6);assert.equal(MIN_FACTOR,.6);
let last=2;for(let kg=0;kg<=200;kg+=3){const f=loadFactor(kg);assert(f<=last&&f>=.6&&f<=1,'monotonic, 0.6..1');last=f}
assert(DRAG_PER_KG*10>=.03&&DRAG_PER_KG*10<=.04,'3 to 4 % per 10 kg');
// masses
assert.deepEqual({...MASS_KG},{log:40,plank:6,crate:12,parcelSmall:3,parcelMedium:6});
assert.equal(cargoMassKg(null),0);assert.equal(cargoMassKg([{k:'log'},{k:'planks',n:4},{k:'crate'}]),40+24+12);
assert.equal(parcelMassKg(null),0);assert.equal(parcelMassKg({large:false}),3);assert.equal(parcelMassKg({large:true}),6);
assert(isHeavy(40)&&!isHeavy(24)&&!isHeavy(3)&&HEAVY_BELOW===.85,'a log is heavy, a plank stack or a parcel is not');

// the ATV rack: exactly ONE log, ONE plank stack, ONE crate
assert(hasBed('atv')&&BEDS.atv.space===5&&spaceOf('atv')===5);
assert.equal(capacity('atv','log'),1);assert.equal(capacity('atv','crate'),1);assert.equal(capacity('atv','planks'),5);
const one=(m,carry,cargo)=>loadCarry(carry,cargo,m);
assert(!one('atv',{kind:'log'},null).error,'one log fits');
const log1=one('atv',{kind:'log'},null).cargo;
assert(one('atv',{kind:'log'},log1).error,'a second log does not fit');
assert(one('atv',{kind:'planks',count:1},log1).error,'no plank next to the log');
assert(!one('atv',{kind:'planks',count:4},null).error,'one stack of 4 planks fits');
const stack=one('atv',{kind:'planks',count:4},null).cargo;
assert(one('atv',{kind:'planks',count:1},stack).error,'a 5th plank would fit by space (5)? no: a second piece of planks takes 1 more');
assert(!addCrates(null,'atv',1).error,'one crate fits');assert(addCrates(null,'atv',2).error,'two crates do not');
assert(addCrates(addCrates(null,'atv',1).cargo,'atv',1).error,'a second crate does not');
assert(addCrates(log1,'atv',1).error,'crates and timber do not mix');
assert(!addPlanks(null,'atv',4).error&&addPlanks(null,'atv',8).error,'an order of 8 planks does not fit the rack');
assert.equal(normalizeCargo([{k:'crate'},{k:'crate'}],'atv').length,1,'a bad save with two crates keeps one');
assert.equal(normalizeCargo([{k:'log'},{k:'log'}],'atv').length,1);
for(const c of [log1,stack,addCrates(null,'atv',1).cargo]){assert(fits('atv',c));const s=slotPositions('atv',c)[0],b=BEDS.atv;assert(s.x>=b.x0-.1&&s.x<=b.x1+.1&&s.z>=b.z0&&s.z<=b.z1,'the piece sits over the rack');assert(s.y>=b.y)}
assert(Math.abs(slotPositions('atv',log1)[0].yaw-Math.PI/2)<1e-9,'a log lies across the ATV');
assert.equal(slotPositions('shortbed',[{k:'log'}])[0].yaw,0,'other beds are unchanged');
assert(BEDS.atv.z0>-1.04&&BEDS.atv.z1<-.3,'behind the seat (z -0.3), inside the model (z -1.043)');
assert(acceptsCrates('atv')&&!takesCrateGigs('atv')&&takesCrateGigs('shortbed'),'the one-crate rack is not a crate-gig truck');
assert(!hasCrateBed({vehicles:[{model:'atv'}]})&&hasCrateBed({vehicles:[{model:'atv'},{model:'shortbed'}]}));
assert(loadPoints('atv').length===3);
// the bigger beds are untouched
assert.equal(capacity('flatbed','log'),24);assert.equal(capacity('shortbed','crate'),22);

// a stowed parcel: the saved state is the same as a held one, so it survives enter, exit, save and delivery
const base={carry:null,gigs:{active:{id:7,client:'Ann',large:false,drop:null}}};
assert(parcelHeld(base)&&canStow('atv')&&canStow('shortbed')&&canStow('worktruck')&&canStow('flatbed')&&!canStow('sedan')&&stowed(base,'atv')&&stowed(base,'shortbed')&&!stowed(base,'sedan'));
assert.equal(mountError(base,'atv'),null,'the ATV takes the parcel');
assert.equal(mountError(base,'shortbed'),null,'a truck bed takes the parcel (the Kasumuchi S70 refused it before)');assert.equal(mountError(base,'shortbed',[{k:'crate'}]),RACK_BUSY,'a loaded bed refuses the parcel');assert.equal(mountError(base,'sedan'),PARCEL_HANDS,'a car without a bed still refuses it');
assert.match(mountError({...base,carry:{kind:'log'}},'atv'),/hands are full/);
assert.equal(mountError(base,'atv',[{k:'log'}]),RACK_BUSY,'a loaded rack refuses the stowed parcel');assert.equal(mountError(base,'atv',[]),null);assert.equal(mountError({carry:null,gigs:{active:null}},'atv',[{k:'log'}]),null,'no parcel: cargo does not block mounting');
assert.equal(mountError({carry:null,gigs:{active:null}},'shortbed'),null);
assert.equal(mountError({carry:null,gigs:{active:{id:1,needId:5,drop:null}}},'shortbed'),null,'a need gig has no box');
assert.equal(mountError({carry:null,gigs:{active:{id:1,drop:{x:1,z:2}}}},'shortbed'),null,'a parcel on the ground does not block');
const after=JSON.parse(JSON.stringify(base)); // enter + save + load + exit changes nothing
assert.deepEqual(after,base);assert(parcelHeld(after),'still held after a save round trip, one parcel only');
assert.equal(stowed(dropParcel(base,{x:1,z:1}).state,'atv'),false,'a parcel put down is not on the rack');
assert(parcelHeld(pickParcel(dropParcel(base,{x:1,z:1}).state).state));
// FIX-R1: the kg drag is for the ATV rack only; a flatbed with logs keeps its old withLoad slowdown
assert(usesLoadDrag('atv')&&!usesLoadDrag('flatbed')&&!usesLoadDrag('shortbed')&&!usesLoadDrag('worktruck')&&!usesLoadDrag('offroad')&&!usesLoadDrag('nope'));
{const fb=CLASSES.flatbed,three=[{k:'log'},{k:'log'},{k:'log'}],w=withLoad(fb,loadOf('flatbed',three));
 assert(w.top>=.9*fb.top,'3 logs on the flatbed slow it by the old rule only: '+(w.top/fb.top));assert(Math.abs(loadFactor(cargoMassKg(three))-.6)<1e-9,'the kg rule would floor it at 0.6 (why it is skipped)');
 const full=withLoad(fb,1);assert(Math.abs(full.top/fb.top-.8)<1e-9,'a full flatbed keeps the old 0.8');
 assert(Math.abs(loadFactor(cargoMassKg([{k:'log'}]))-.84)<1e-9,'ATV with one log: 0.84')}
{const src=readFileSync(new URL('../dist/driving.js',import.meta.url),'utf8');assert(/const massDrag=\(f,c\)=>\{if\(!usesLoadDrag\(f\.spec\.model\)\)return c;/.test(src),'driving.js gates massDrag on usesLoadDrag');
 const g=readFileSync(new URL('../dist/game.js',import.meta.url),'utf8');assert(g.includes('usesLoadDrag(driving.active.spec.model)&&isHeavy('),'the heavy toast is gated the same way')}
console.log('PASS load-drag: factor, masses, ATV rack (1 log, 1 plank stack, 1 crate), stowed parcel, drag only on the ATV');
