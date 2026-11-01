import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {MAP} from '../dist/map-definition.js';
import {isWalkable,createWorld} from '../dist/world.js';
import {findNearestClearSpot,isClearSpot,STEP,MAX_SEARCH,OPEN_AREA} from '../dist/safe-spot.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})}; // ground textures draw on a canvas; tests have none

// Same shape as game.js's blocked(): solid boxes padded by the character's 0.33 m radius.
const boxes=(list,extra=()=>false)=>(x,z)=>extra(x,z)||list.some(b=>Math.abs(x-b.x)<b.hx+.33&&Math.abs(z-b.z)<b.hz+.33);

// --- A toy world -------------------------------------------------------------------------------------------------------
{ // Already fine: it stays exactly where it is
 const open=boxes([]);assert.deepEqual(findNearestClearSpot(open,3.3,-4.1),{x:3.3,z:-4.1,distance:0});
}
{ // Inside a box (the 0.31 parked car on the spawn): the nearest spot is just outside it, clear, and not far
 const car=boxes([{x:0,z:0,hx:1,hz:2.2}]),spot=findNearestClearSpot(car,0,0);
 assert(spot,'a spot is found');assert(isClearSpot(car,spot.x,spot.z),'the spot is clear');
 assert(spot.distance<=3.4,`it is just outside the car (${spot.distance.toFixed(2)} m)`);
 // Nothing nearer was passed over: every half-metre point closer than the answer is blocked or has a blocked neighbour
 for(let i=-10;i<=10;i++)for(let j=-10;j<=10;j++){const x=i*STEP,z=j*STEP;if(Math.hypot(x,z)<spot.distance-1e-9)assert(!isClearSpot(car,x,z),`(${x},${z}) is not clear`)}
}
{ // Squeezed against a wall: you get standing room, not a point touching the wall
 const wall=boxes([{x:0,z:5,hx:20,hz:.5}]),spot=findNearestClearSpot(wall,0,4.5);assert(spot&&isClearSpot(wall,spot.x,spot.z));
 for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])assert(!wall(spot.x+dx*.75,spot.z+dz*.75),'0.75 m of room on every side');
}
{ // A closed courtyard is open ground inside but a trap: the answer is outside its walls
 const wallsOf=(cx,cz,half)=>[{x:cx,z:cz-half,hx:half,hz:.4},{x:cx,z:cz+half,hx:half,hz:.4},{x:cx-half,z:cz,hx:.4,hz:half},{x:cx+half,z:cz,hx:.4,hz:half}];
 const room=boxes(wallsOf(0,0,4)),spot=findNearestClearSpot(room,3,0); // inside, against the wall: spots inside are nearer, but they are a trap
 assert(room(3.6,0)===true&&isClearSpot(room,2,0),'the room has standing room inside');
 assert(spot,'a spot is found');assert(Math.hypot(spot.x,spot.z)>4.4+.33,`it is outside the walls, not inside (${spot.x},${spot.z})`);
 // ...unless the check is switched off, as indoors, where the room is the whole world
 const inRoom=findNearestClearSpot(room,3,0,{openArea:0});assert(Math.hypot(inRoom.x,inRoom.z)<4,`indoors, the nearest spot is inside (${inRoom.x},${inRoom.z})`);
 // A big enough enclosure counts as open country (the area rule is 300 m2)
 assert.equal(OPEN_AREA,300);const big=boxes(wallsOf(0,0,30));assert.deepEqual(findNearestClearSpot(big,0,0),{x:0,z:0,distance:0});
}
{ // Nothing within reach: null, and the caller keeps a fallback
 const solid=()=>true;assert.equal(findNearestClearSpot(solid,0,0),null);
 const far=boxes([{x:0,z:0,hx:60,hz:60}]);assert.equal(findNearestClearSpot(far,0,0),null,'the search stops at its radius');
 assert.equal(findNearestClearSpot(boxes([]),NaN,0),null);assert.equal(findNearestClearSpot(boxes([]),0,Infinity),null);
}
{ // Cost: one blocked() call per candidate, so a hopeless search is thousands of calls, not millions
 let calls=0;const counted=()=>{calls++;return true};findNearestClearSpot(counted,0,0);
 assert(calls<=13000,`${calls} blocked() calls for a search with no answer`);
 let near=0;findNearestClearSpot((x,z)=>{near++;return boxes([{x:0,z:0,hx:1,hz:2.2}])(x,z)},0,0);assert(near<7000,`${near} calls to leave a car's box (most of them the open-ground flood)`);
 const t0=performance.now();for(let i=0;i<20;i++)findNearestClearSpot(boxes([{x:0,z:0,hx:1,hz:2.2}]),0,0);assert((performance.now()-t0)/20<25,'a rescue takes a few milliseconds, not a frame budget of its own');
}

// --- The real map ------------------------------------------------------------------------------------------------------
const scene=new THREE.Scene(),world=createWorld(scene,{cullRadius:Infinity});
const real=(extra=[])=>(x,z)=>!isWalkable(x,z)||world.blocked(x,z)||extra.some(b=>Math.abs(x-b.x)<b.hx+.33&&Math.abs(z-b.z)<b.hz+.33);
{ // The spawn is fine on the real map...
 assert.deepEqual(findNearestClearSpot(real(),MAP.spawn.x,MAP.spawn.z),{x:MAP.spawn.x,z:MAP.spawn.z,distance:0},'a free spawn is used as it is');
 // ...and with the 0.31 car back on it (a 4.4 x 1.9 m car at (-6, 13.9)), the character is put next to it and can walk away
 const car=real([{x:-6,z:13.9,hx:2.2,hz:.95}]);assert(car(MAP.spawn.x,MAP.spawn.z),'the spawn is stuck in the car');
 const spot=findNearestClearSpot(car,MAP.spawn.x,MAP.spawn.z);assert(spot,'a spot is found');assert(isClearSpot(car,spot.x,spot.z));assert(spot.distance<4,`only ${spot.distance.toFixed(2)} m from the spawn`);
 // walk 8 m in some direction from there, in 0.1 m steps, the way the game's movement does
 const reach=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>{let x=spot.x,z=spot.z;for(let d=0;d<8;d+=.1){if(car(x+dx*.1,z))break;x+=dx*.1;if(Math.hypot(x-spot.x,z-spot.z)>=3)return true}return false});
 assert(reach,'you can walk away from it');
}
{ // Spots everywhere across the map: wherever you are told you are, the answer is walkable, clear and within reach
 let checked=0;
 for(let x=-190;x<=280;x+=23)for(let z=-370;z<=95;z+=23){
  const spot=findNearestClearSpot(real(),x,z);
  if(!spot)continue;checked++;
  assert(!real()(spot.x,spot.z)&&isClearSpot(real(),spot.x,spot.z),`(${x},${z}) -> clear spot`);
  assert(spot.distance<=MAX_SEARCH+.01);
 }
 assert(checked>150,`${checked} map points answered`);
 // Cost on the real map: the same search the R key and the stuck rescue run
 const car=real([{x:-6,z:13.9,hx:2.2,hz:.95}]);let t0=performance.now();for(let i=0;i<10;i++)findNearestClearSpot(car,MAP.spawn.x,MAP.spawn.z);
 var rescueMs=(performance.now()-t0)/10;assert(rescueMs<50,`a rescue on the real map takes ${rescueMs.toFixed(1)} ms`);
}
console.log(`Safe spot: the nearest clear spot (already-fine points kept, car and wall cases, closed courtyards refused, big enclosures allowed, search limits, one call per candidate), the 0.31 parked-car spawn on the real map (${rescueMs.toFixed(1)} ms) and clear answers across the map passed.`);
