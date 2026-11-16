import assert from 'node:assert/strict';
import {CLASSES,freshVehicle,stepVehicle} from '../dist/vehicle.js';
import {SURFACE} from '../dist/terrain.js';
import {speedFactor} from '../dist/surface-table.js';
import {PROPS} from '../dist/props-assets.js';
import {createProp} from '../dist/props.js';
import {PAINT,coloursOf,paintUniforms} from '../dist/paint.js';
import {VEHICLE_PRICE} from '../dist/orders.js';
import {MAP,DRIVABLE_MODELS} from '../dist/map-definition.js';
import {TRACK_WIDTH} from '../dist/tracks-rules.js';
import {ENGINES} from '../dist/vehicle-sounds.js';
import {VEHICLE_LAMPS} from '../dist/night-lights-rules.js';

// A4 (notes/atv-handling-design.md, stage A4): the ATV import. Class numbers, the model record (hull, wheels, moved anchors), paint, price, slot, tracks, sound, lamps.
const A=CLASSES.atv,R=PROPS.atv;

// 1. Class
assert.equal(A.group,'atv');assert.equal(A.seats,1,'one rider, no passenger door');assert.equal(A.tier,'low');
assert.deepEqual([A.top,A.reverse,A.accel,A.brake,A.drag,A.rMin,A.aLat,A.mpg],[15.6,4,4,9,1.2,4,9,20],'design numbers');
assert.equal(A.gallonsPerMile,.4);assert(Math.abs(A.top*2.23694-34.9)<.1,'35 mph');
assert.deepEqual(A.camera,{back:4.2,up:1.9});assert.equal(A.seat.x,0,'seat on the centre line');
assert.deepEqual([A.hx,A.hz],[.61,1.035],'hull = the model footprint (1.22 m wide)');
const open={blocked:()=>false,surface:()=>SURFACE.DIRT};let s=freshVehicle({x:0,z:0,yaw:0}),t=0;while(s.speed<A.top*.995&&t<30){s=stepVehicle(s,{throttle:1},1/60,A,open).state;t+=1/60}
assert(Math.abs(t-3.9/speedFactor(SURFACE.DIRT,'atv')*1)<1.2,'0 to top in about 3.9 s on dirt ('+t.toFixed(2)+')');

// 2. Model record: hull, wheels, anchors (the V8 file's contract plus the owner's moves)
assert.equal(R.triangles,39295);assert.equal(R.source,'Vehicles/ATV/ATV Utility - V8 Game.glb');
assert(Math.abs(R.width-1.22)<.011&&Math.abs(R.depth-2.07)<.011&&Math.abs(R.height-1.08)<.011);
assert.equal(R.colliders.length,1);assert(Math.abs(R.colliders[0].hx-A.hx)<.01&&Math.abs(R.colliders[0].hz-A.hz)<.01,'collision box = 1.22 m wide');
assert.equal(R.wheels.length,4,'body + 4 wheels = 5 draw calls (the file has 21)');
for(const w of R.wheels){assert(Math.abs(w.radius-.3)<.01);assert(Math.abs(Math.abs(w.at[0])-.465)<.001&&Math.abs(Math.abs(w.at[2])-.62)<.001&&w.at[1]===.3)}
assert.equal(R.wheels.filter(w=>w.front).length,2);assert(!R.col||R.col.length>0,'vertex colours');
const an=R.anchors,names=['anchor_cargo_front','anchor_cargo_rear','anchor_driver_seat','anchor_engine_sound','anchor_exhaust','anchor_foot_L','anchor_foot_R','anchor_fuel_port','anchor_hands_L','anchor_hands_R','anchor_headlight_L','anchor_headlight_R','anchor_load_left','anchor_load_rear','anchor_load_right','anchor_taillight_L','anchor_taillight_R'];
assert.deepEqual(Object.keys(an).sort(),names);
assert.deepEqual(an.anchor_taillight_L,[.34,.648,-.975]);assert.deepEqual(an.anchor_taillight_R,[-.34,.648,-.975]);
assert.deepEqual(an.anchor_exhaust,[-.28,.49,-1.035]);assert.deepEqual(R.nodes.exhaust,[-.28,.49,-1.035]);
assert.deepEqual([A.exhaust.x,A.exhaust.y,A.exhaust.z],an.anchor_exhaust,'class exhaust = the moved anchor');
assert.deepEqual(an.anchor_driver_seat,[0,.86,-.3]);assert.equal(A.seat.z,an.anchor_driver_seat[2]);
assert.deepEqual(an.anchor_fuel_port,[.07,.835,.16]);
for(const n of ['handlebar','seat','seat_2','steer_FL','steer_FR','wheel_FL','wheel_FR','wheel_RL','wheel_RR','exhaust'])assert(R.nodes[n],n);
{const m=createProp('atv',{apply:x=>x});assert.equal(m.userData.wheels.length,4);assert(m.userData.anchors.anchor_exhaust&&m.userData.nodes.handlebar,'createProp: wheels, anchors, nodes')}

// 3. Startup size rule (LZ1: over 1.5 MB added to the startup module means lazy). A4 added 1,164,178 bytes.
import {statSync} from 'node:fs';
const size=statSync(new URL('../dist/props-assets.js',import.meta.url)).size;assert(size<7.2e6,'props-assets.js stays under 7.2 MB (it was 5.81 MB before A4)');

// 4. Paint, price (added last), slot, tracks, sound, lamps
assert.equal(coloursOf('atv').length,6);assert.equal(paintUniforms('atv','olive').hue,-1);assert(Math.abs(PAINT.atv.src-79)<1);
const keys=Object.keys(VEHICLE_PRICE);assert.equal(keys[0],'worktruck');assert.equal(keys[keys.length-1],'atv','added last');assert.equal(VEHICLE_PRICE.atv,380000);
assert(DRIVABLE_MODELS.includes('atv'));const v=MAP.vehicles.find(x=>x.model==='atv');assert(v&&v.sale==='both'&&v.fuel.type==='gas'&&v.fuel.tankMgal===4000);
assert.equal(TRACK_WIDTH.atv,.25);assert(ENGINES.atv&&ENGINES.atv.rate[1]>ENGINES.shortbed.rate[1]*.9,'a fallback engine loop');
assert(VEHICLE_LAMPS.atv.rear.y===.648&&Math.abs(VEHICLE_LAMPS.atv.front.x)<R.width/2);
console.log('ATV import: PASS (class numbers, 39,295-tri model with 4 wheels = 5 draw calls, hull 1.22 x 2.07, 17 anchors with the 3 moves, paint, price, slot, tracks, sound, lamps)');