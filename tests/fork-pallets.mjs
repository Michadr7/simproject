import assert from 'node:assert/strict';
import * as F from '../dist/forklift.js';
import {POCKET,CARRY_Z,CARRY_DROP,levelBase,heightOf,boxesOf,probe,engagedBox,liftsNow,forksClear,laneOk,restingOn,liftRange,settles,forkHint,carriedBox,axisError,unitAt} from '../dist/fork-pallets.js';
import {PALLET} from '../dist/pallets.js';
import {bayX,FACE_ROWS,WAREHOUSE_STAGING,RACK_SLOTS} from '../dist/warehouse-layout.js';

// The physical forks (DESIGN 4.16 I step 2, made more forgiving after the first play-test): pockets, alignment, shelf lanes, what a carried pallet rests on, and the assists. Poses are worked out from the layout, not by feel.
const open=()=>false;
const ctxFor=(pallets=[],carried=0,extra={})=>({boxes:boxesOf(pallets),carried,blockedOther:open,solidAt:open,occupied:slot=>pallets.some(p=>p.at.rack===slot),stagingTaken:()=>false,...extra});
const floorPallet=(x,z,yaw=0,count=12,id=1)=>({id,product:'planks',count,at:{floor:{x,z,yaw}}});
// a forklift facing the pallet at (0,0) from the -z side with the tine tips `depth` m past its near mouth (the mouth is .62 m from the middle)
const facing=(depth,lift,over={})=>({x:0,z:-PALLET.d/2+depth-F.TIP,yaw:0,speed:0,lift,steer:0,roll:0,...over});
const pallet=boxesOf([floorPallet(0,0)])[0];

// geometry in the plan
assert.equal(levelBase(1),0);assert.equal(levelBase(2),1.5);assert.equal(levelBase(3),2.85);assert(Math.abs(heightOf(40)-(PALLET.h+10*.092))<1e-9,'forty planks lie ten high on the pallet');
assert(Math.abs(CARRY_Z-1.42)<1e-9&&CARRY_Z-PALLET.d/2>=.79,'a carried pallet starts at the carriage');assert(F.LIFT_MIN<=.1,'the tines rest low enough for a floor pallet\'s pocket');
assert.equal(Math.round(axisError(Math.PI,0)*1e6),0,'a pallet is entered from either end');assert(Math.abs(axisError(1.6,0))<=Math.PI/2);

// the pocket: tine tops 2 to 18 cm above the base, within 18 cm of the middle, within 11 degrees
{const at=(depth,lift,over)=>probe(facing(depth,lift,over),pallet);
 assert.equal(at(-.5,.1).state,'clear','not touching yet');
 let r=at(.6,.1);assert.equal(r.state,'pocket');assert(Math.abs(r.depth-.6)<1e-6,'depth '+r.depth);assert.equal(r.aligned,true);
 assert.equal(at(.6,.03).state,'pocket');assert.equal(at(.6,.18).state,'pocket','the band includes the lift height');assert.match(at(.6,.19).reason,/too high/,'but not 19 cm');
 r=at(.6,.3);assert.equal(r.state,'blocked');assert.match(r.reason,/too high/);r=at(.6,.01);assert.equal(r.state,'blocked');assert.match(r.reason,/too low/);
 assert.match(at(.6,.1,{x:.2}).reason,/Line up/,'20 cm off to the side');assert.equal(at(.6,.1,{x:.15}).state,'pocket','15 cm is fine');assert.match(at(.6,.1,{yaw:.3,x:0}).reason,/Line up/,'17 degrees off');assert.equal(at(.6,.1,{yaw:.04}).state,'pocket','a couple of degrees is fine');assert.equal(at(.6,.1,{yaw:.1}).state,'pocket','so is 6 degrees (the tips swing 15 cm)');assert.match(at(.6,.1,{yaw:.15}).reason,/Line up/,'but 9 degrees swings the tips 23 cm sideways');
 assert.equal(at(.6,.7).state,'clear','tines above a 12-plank pallet pass over it: '+at(.6,.7).state);assert.equal(probe(facing(.6,.4),pallet).state,'blocked','but not through the planks (a 12-plank pallet is 42 cm high)');
 assert.match(at(.9,.1).reason,/all the way in/,'the carriage stops at the pallet');
 // from the other end (turned half round)
 const back={x:0,z:PALLET.d/2-.6+F.TIP,yaw:Math.PI,speed:0,lift:.1};assert.equal(probe(back,pallet).state,'pocket');
 // a turned floor pallet is entered along its own axis
 const turned=boxesOf([floorPallet(3,2,Math.PI/2)])[0];const s90={x:3-(PALLET.d/2-.6+F.TIP),z:2,yaw:Math.PI/2,speed:0,lift:.1};assert.equal(probe(s90,turned).state,'pocket');assert.notEqual(probe({...s90,yaw:0},turned).state,'pocket','head-on to the short side is not a pocket');}
// engaging and lifting
{const s=facing(.6,.1),boxes=[pallet];assert.equal(engagedBox(s,boxes),pallet);assert.equal(engagedBox(facing(.3,.1),boxes),null,'not in far enough yet (45 cm)');assert.equal(liftsNow(s,boxes),null,'not raised yet');
 assert.equal(liftsNow({...s,lift:POCKET.liftAt},boxes),pallet,'raised to 14 cm: it lifts');assert.equal(liftsNow(facing(.3,.15),boxes),null)}
// the tines are blocked by a pallet at the wrong height (the forklift stops) but go in at the right one
{const c=ctxFor([floorPallet(0,0)]);assert.equal(forksClear(facing(.6,.1),c),true);assert.equal(forksClear(facing(.6,.3),c),false,'too high');assert.equal(forksClear(facing(.2,.3),c),false,'even with only the tip in');assert.equal(forksClear(facing(-.3,.3),c),true,'short of it');
 assert.match(forkHint(facing(.6,.3),c),/too high/);assert.match(forkHint(facing(.6,.1),c),/Raise the forks/);assert.match(forkHint(facing(.3,.1),c),/further/);assert.equal(forkHint(facing(-2,.1),c),'')}
// shelving: the tines may enter a cell square to the shelf, off the uprights and at a level's height
{const row=FACE_ROWS.B.z,x=bayX(4),mouth=row-PALLET.d/2,s=(depth,lift,o={})=>({x,z:mouth+depth-F.TIP,yaw:0,speed:0,lift,steer:0,roll:0,...o}),c=ctxFor([]);
 assert(unitAt(x,row),'the cell is inside the unit');assert.equal(forksClear(s(.6,.1),c),true,'level one');assert.equal(forksClear(s(.6,1.55),c),true,'level two (1.5 m deck)');assert.equal(forksClear(s(.6,2.9),c),true,'level three');
 assert.equal(forksClear(s(.6,1.4),c),false,'between levels: the beam');assert.equal(forksClear(s(.6,.1,{yaw:.3}),c),false,'not square to the shelf');assert.equal(forksClear(s(.6,.1,{x:x+.9}),c),false,'on an upright');
 assert.equal(forksClear(s(-.2,1.4),c),true,'but outside the unit any height goes');assert.equal(laneOk(s(.6,.1),{x,z:row}),true);
 // a pallet in the cell: tines at the pocket height go in, others stop
 const full=ctxFor([{id:5,product:'planks',count:40,at:{rack:'B4-2'}}]);assert.equal(forksClear(s(.6,1.5+.1),full),true,'in the pocket of B4-2');assert.equal(forksClear(s(.6,1.5+.4),full),false);assert.equal(forksClear(s(.6,1.5+.1,{x:x+.25}),full),false,'off the middle');
 assert.equal(engagedBox(s(.6,1.6),full.boxes).slot,'B4-2');assert.equal(liftsNow(s(.6,1.5+POCKET.liftAt),full.boxes).slot,'B4-2')}
// a carried pallet: where it rests, and what it cannot go through
{const row=FACE_ROWS.B.z,x=bayX(4),carry=(cz,lift,o={})=>({x,z:cz-CARRY_Z,yaw:0,speed:0,lift,steer:0,roll:0,...o}),c40=ctxFor([],40);
 // over the middle of cell B4-1, base on the deck: it rests in the cell
 let s=carry(row,.09);let r=restingOn(s,c40);assert.deepEqual([r.kind,r.slot,r.surface],['rack','B4-1',0]);assert.deepEqual(liftRange(s,c40),[.09,F.LIFT_MAX]);assert.equal(settles(s,c40).slot,'B4-1','it is set down when its base meets the deck');
 assert.equal(settles(carry(row,.2),c40),null,'still above the deck');assert.match(forkHint(carry(row,.2),c40),/Lower the pallet into rack B4-1/);
 r=restingOn(carry(row,1.5+.09),c40);assert.deepEqual([r.kind,r.slot,r.surface],['rack','B4-2',1.5],'at level two height it rests on the level two deck');
 s=carry(row,1.5+.4);r=restingOn(s,c40);assert.equal(r.slot,'B4-2');assert.equal(r.surface,1.5);assert.equal(settles(carry(row,1.5+.09),c40)?.slot,'B4-2');
 // level one is full: a pallet at level two height above it goes in level two
 const lowFull=ctxFor([{id:1,product:'planks',count:40,at:{rack:'B4-1'}}],40);assert.equal(restingOn(carry(row,1.5+.4),lowFull).slot,'B4-2');
 // not square, or off the middle: it cannot be set in the cell
 r=restingOn(carry(row,.09,{yaw:.3}),c40);assert.equal(r.kind,'blocked');assert.match(r.reason,/Line up/);r=restingOn(carry(row,.09,{x:x+.4}),c40);assert.notEqual(r.slot,'B4-1');
 assert.equal(settles(carry(row,.09,{yaw:.3}),c40),null,'a blocked place never settles');
 // the occupied cell is solid to a carried pallet
 const taken=ctxFor([{id:1,product:'planks',count:40,at:{rack:'B4-1'}}],40);assert.equal(forksClear(carry(row,.09),taken),false,'a cell holds one pallet');assert.equal(forksClear(carry(row,.09),c40),true);
 // the floor: anywhere free, in the middle of the aisle
 s={x:0,z:2,yaw:.7,speed:0,lift:.5,steer:0,roll:0};const fc=ctxFor([],12);r=restingOn(s,fc);assert.equal(r.kind,'floor');assert.equal(r.surface,0);assert.deepEqual(liftRange(s,fc),[.09,F.LIFT_MAX]);
 assert.match(forkHint(s,fc),/Lower the forks \(F\) to set the pallet down here/,'over open floor the panel says lowering sets it down');assert.equal(settles({...s,lift:.09},fc).kind,'floor','lowered to the floor: set down there');assert.equal(settles({...s,lift:.09},fc).yaw,.7,'in the direction the forklift is facing');
 assert.equal(restingOn(s,ctxFor([],12,{solidAt:(x,z)=>z>2.5})).kind,'blocked','not into a wall');
 // staging squares: an order that is waiting takes the planks; an empty square does not take a pallet
 const sq=WAREHOUSE_STAGING[1],sqc=(o={})=>({x:sq.x,z:sq.z-CARRY_Z,yaw:Math.PI,...o});const place=(lift)=>({...sqc(),z:sq.z+CARRY_Z,yaw:Math.PI,speed:0,lift,steer:0,roll:0});
 r=restingOn(place(.3),ctxFor([],12,{stagingTaken:i=>i===1}));assert.deepEqual([r.kind,r.index,r.surface],['staging',1,0]);assert.equal(settles(place(CARRY_DROP),ctxFor([],12,{stagingTaken:i=>i===1})).index,1);
 r=restingOn(place(.3),ctxFor([],12));assert.equal(r.kind,'blocked');assert.match(r.reason,/No order/);
 // a carried pallet cannot go through another pallet on the floor
 const other=ctxFor([floorPallet(0,6,0,40,9)],40);assert.equal(forksClear({x:0,z:6-CARRY_Z,yaw:0,speed:0,lift:.3},other),false);assert.equal(forksClear({x:0,z:6-CARRY_Z,yaw:0,speed:0,lift:.3+heightOf(40)+.2},other),true,'but over the top of it')}

// the drive step with the forks: the forklift stops at a pallet it is not lined up with, and cannot push the forks up through it
{const c=ctxFor([floorPallet(0,0)]),ctx={forksClear:s=>forksClear(s,c),liftRange:s=>liftRange(s,c)};
 let s=facing(-1.2,.3);for(let i=0;i<120;i++)s=F.step(s,{throttle:1},1/30,open,ctx);assert(F.clear(s,open,ctx),'never inside the pallet');assert(s.z<-F.TIP+.2-0+F.TIP-PALLET.d/2,'stopped short of the pallet: z '+s.z);assert(s.speed<.5);
 // at the right height it drives in as far as the carriage and no further
 s=facing(-1.2,.1);for(let i=0;i<150;i++)s=F.step(s,{throttle:1},1/30,open,ctx);const d=probe(s,pallet);assert.equal(d.state,'pocket');assert(d.depth>.6&&d.depth<=.8,'tines in to the carriage: '+d.depth.toFixed(2));
 // raising in the pocket lifts through the band only as far as the lift height; further up is blocked until the pallet is carried
 let r=s;for(let i=0;i<30;i++)r=F.step(r,{raise:1},1/30,open,ctx);assert(r.lift<=POCKET.hi+1e-9,'the tines stop at the top of the pocket: '+r.lift);
 // backing out is always allowed
 let b=facing(.6,.1);for(let i=0;i<60;i++)b=F.step(b,{throttle:-1},1/30,open,ctx);assert(probe(b,pallet).state==='clear'||b.z<facing(.6,.1).z,'it backs out');
 // the slow lift moves slower
 const up=F.step(F.fresh({x:0,z:-9,yaw:0}),{raise:1},1,open);assert(Math.abs(up.lift-(F.LIFT_MIN+F.LIFT_SPEED))<1e-9&&F.LIFT_SPEED===.5,'the forks rise at a steady 0.5 m/s')}
console.log("PASS fork-pallets.mjs: pocket (tine tops 2 to 18 cm above the base, within 18 cm and 11 degrees, from either end), engage at 35 cm and lift at 14 cm, tines blocked by a pallet at the wrong height or crooked, shelf lanes (square, off the uprights, at a level height), a carried pallet resting in a free cell, on an order square or on the floor, not going through other pallets, the drive step stopping short and backing out.");
