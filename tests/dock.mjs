import assert from 'node:assert/strict';
import {IN,OUT,YARD,toOutside,toInside,crossesOut,crossesIn,freshDoor,stepDoor,passable,nearDoor,inYard,inDoorway,inDoorwayOut,HOLD} from '../dist/dock.js';
import {DOCK_DOOR,HALL} from '../dist/warehouse-layout.js';
import {MAP} from '../dist/map-definition.js';

// The dock's roller door (D2): pure rules for the door, the crossing and the yard.
assert.equal(IN.x,DOCK_DOOR.x,'the inside door is the layout\'s dock door');assert.equal(IN.wall,HALL.halfD);
const W=MAP.offices.find(o=>o.kind==='warehouse');assert(Math.abs(OUT.x-161.8)<1e-9,'the model\'s one loading door (map-definition.js yards)');assert(OUT.x<W.door.x,'west of the person door');
assert(YARD.z1<OUT.wall&&inYard(OUT.x,OUT.land)&&inYard(W.door.out.x,W.door.out.z),'the person door\'s landing and the crossing landing are in the yard');

// forks first through the door and out: facing +z inside (yaw 0) becomes facing north outside (yaw pi), same speed and fork height
const s={x:IN.x+.2,z:IN.line+.05,yaw:0,speed:1.5,lift:.6,steer:.1,roll:3};
assert.equal(crossesOut(s,true),true);assert.equal(crossesOut(s,false),false,'not while the door is down');
assert.equal(crossesOut({...s,z:IN.line-.1},true),false,'not before the line');assert.equal(crossesOut({...s,x:IN.x+IN.halfWidth+.1},true),false,'not beside the door');
assert.equal(crossesOut({...s,speed:-1},true),false,'not backwards with forks first');assert.equal(crossesOut({...s,yaw:Math.PI/2},true),false,'not sideways');
assert.equal(crossesOut({...s,yaw:Math.PI,speed:-1},true),true,'backing out (facing the hall, moving toward the wall) crosses too');
const o=toOutside(s);assert.deepEqual([+o.x.toFixed(2),+o.z.toFixed(2),+Math.abs(o.yaw).toFixed(3),o.speed,o.lift,o.roll],[+(OUT.x-.2).toFixed(2),+(OUT.land-.05).toFixed(2),+Math.PI.toFixed(3),1.5,.6,3],'a half turn about the door, everything else carried');
assert.equal(crossesIn(o,true),false,'it lands clear of the way back (0.8 m)');
// the way back in: facing the wall, moving toward it, in line with the door
const back={...o,x:OUT.x+.3,z:OUT.line+.01,yaw:0,speed:1};assert.equal(crossesIn(back,true),true);assert.equal(crossesIn({...back,x:OUT.x+OUT.halfWidth+.1},true),false);assert.equal(crossesIn(back,false),false);
const i=toInside(back);assert.equal(crossesOut(i,true),false,'and lands clear of the line out');assert(Math.abs(Math.abs(i.yaw)-Math.PI)<1e-9,'forks first: now facing into the hall');assert(Math.abs(i.x-(IN.x-.3))<1e-9);
// a round trip is the identity
{const t=toInside(toOutside(s));assert(Math.abs(t.x-s.x)<1e-9&&Math.abs(t.z-s.z)<1e-9&&Math.abs(Math.sin(t.yaw)-Math.sin(s.yaw))<1e-9)}

// the door rolls up when the forklift is near and comes down HOLD seconds after it has gone
{let d=freshDoor();assert.equal(passable(d),false);
 for(let k=0;k<30;k++)d=stepDoor(d,{near:true,dt:.05});assert.equal(d.t,1);assert.equal(passable(d),true);
 for(let k=0;k<Math.round((HOLD-.5)/.05);k++)d=stepDoor(d,{near:false,dt:.05});assert.equal(passable(d),true,'still up 3.5 s after');
 for(let k=0;k<40;k++)d=stepDoor(d,{near:false,dt:.05});assert.equal(d.t,0,'down again');assert.equal(stepDoor(d,{near:false,dt:.05}),d,'nothing changes: the same object');
 // a forklift that comes back before it shut keeps it up
 d=stepDoor(freshDoor(),{near:true,dt:.5});assert(d.t>.4&&d.t<.7,'half way after half a second: '+d.t);
}
assert.equal(nearDoor('inside',{x:IN.x,z:IN.wall-2}),true);assert.equal(nearDoor('inside',{x:IN.x-8,z:IN.wall-2}),false,'across the hall: shut');assert.equal(nearDoor('outside',{x:OUT.x,z:OUT.wall-2.5}),true);assert.equal(nearDoor('outside',{x:OUT.x-9,z:OUT.wall-2}),false);
assert.equal(inYard(YARD.x0-.1,25),false,'The forklift stays in the yard');assert.equal(inYard(160,YARD.z0-.1),false);
assert.equal(inDoorwayOut(OUT.x,OUT.wall+1),true);assert.equal(inDoorwayOut(OUT.x+OUT.gap,OUT.wall+1),false,'the jamb is solid');assert.equal(inDoorwayOut(OUT.x,OUT.wall-3),false,'only through the wall');
assert.equal(inDoorway(IN.x,IN.wall+1),true);assert.equal(inDoorway(IN.x+IN.gap,IN.wall+1),false,'the jamb is solid');assert.equal(inDoorway(IN.x,IN.wall-1),false,'inside the hall it is not a doorway cell');

console.log('PASS dock.mjs: the roller door rolls up when the forklift is within 3.2 m and comes down 4 s after it has gone, the forklift crosses through it with the fork height, speed and load kept (a half turn about the door, forks first stay first, a landing 0.8 m clear of the way back), only in line with the door and moving toward it, and outside it stays on the apron.');
