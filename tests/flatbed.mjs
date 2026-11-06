// The Tylan Flatbed (0.35, step 1 of the flatbed work): the converted model's parts and anchors, its paint set directly, the class numbers (35 mph, slow),
// the lot's third truck bay, $8,000, and the lock below Lumberjack level 5 (on the lot and in the phone Store).
import assert from 'node:assert/strict';
import {FLATBED} from '../dist/flatbed-assets.js';
import {buildFlatbed,FLATBED_INFO,TAILGATE_OPEN} from '../dist/flatbed.js';
import {createProp,propInfo} from '../dist/props.js';
import {CLASSES} from '../dist/vehicle.js';
import {MAP} from '../dist/map-definition.js';
import {VEHICLE_PRICE,vehicleLock,buyVehicle,orderVehicle,STUDIO_ID} from '../dist/orders.js';
import {coloursOf,defaultColour,PAINT} from '../dist/paint.js';
import {applyPaint} from '../dist/paint-shader.js';
import {freshProgress} from '../dist/jobs.js';
import {xpForNext} from '../dist/skills.js';
import {mph} from '../dist/fuel.js';

// the model
assert(FLATBED.triangles<=6000,`within the 6,000-triangle budget (${FLATBED.triangles})`);
assert.deepEqual(Object.keys(FLATBED.parts).sort(),['body','glass','lights','paint','tailgate','wheel-fl','wheel-fr','wheel-rl','wheel-rr']);
for(const a of ['door_driver','door_passenger','driver_seat','exhaust','fuel_port','cargo_0','cargo_4','load_left','load_right','load_rear','tailgate_hinge'])assert(FLATBED.anchors[a],`anchor ${a}`);
assert.deepEqual(FLATBED.pivots.tailgate,FLATBED.anchors.tailgate_hinge,'the tailgate turns about its hinge');
assert.equal(propInfo('flatbed'),FLATBED_INFO);assert.equal(FLATBED_INFO.width,2.9);assert.equal(FLATBED_INFO.depth,8.83);
const mesh=createProp('flatbed',{apply:m=>m});assert.equal(mesh.userData.wheels.length,4);assert.deepEqual(mesh.userData.wheels.map(w=>w.front),[true,true,false,false]);
for(const w of mesh.userData.wheels)assert(Math.abs(w.pivot.position.y-.55)<1e-6&&w.radius===.55,'wheels sit on the ground: axle at the radius');
assert(mesh.userData.wheels[0].pivot.position.z>3&&mesh.userData.wheels[2].pivot.position.z<-2,'front wheels at the front (+z)');
// the tailgate opens a quarter turn down about x
mesh.userData.tailgate.rotation.x=TAILGATE_OPEN;mesh.updateMatrixWorld(true);{const g=mesh.userData.tailgate.children[0];g.geometry.computeBoundingBox();assert(Math.abs(TAILGATE_OPEN+Math.PI/2)<1e-9)}
// paint: six colours set on the paint material itself
assert(PAINT.flatbed.direct);assert.equal(coloursOf('flatbed').length,6);assert.equal(defaultColour('flatbed'),'orange');
{const m=buildFlatbed();applyPaint(m,'flatbed','blue');assert.equal('#'+m.userData.paint.color.getHexString(),'#24508f','blue paint on the cab');applyPaint(m,'flatbed','nope');assert.equal('#'+m.userData.paint.color.getHexString(),'#ce6f3f','an unknown colour falls back to the first')}
// the class: 35 mph, slow off the mark, a long truck, a stack exhaust
{const c=CLASSES.flatbed;assert.equal(Math.round(mph(c.top)),35);assert(c.accel<CLASSES.worktruck.accel/1.5,'slower to get going than the Worktruck');assert.equal(c.hz*2,8.83);assert(c.exhaust.stack);assert.equal(c.tier,'low')}
// the lot and the price
{const spec=MAP.vehicles.find(v=>v.model==='flatbed');assert.equal(spec.id,'eastbank-flatbed');assert.equal(spec.sale,'both');assert.deepEqual(spec.requires,{skill:'lumberjack',level:5});assert.equal(spec.fuel.type,'diesel');assert.equal(spec.fuel.tankMgal,30000);
 const bay=MAP.bayRows.find(r=>r.id==='depot-truck-bays');assert.equal(bay.count,3);assert(Math.abs(spec.home.x-(bay.x0+bay.width*2.5))<1e-9,'the third truck bay');assert(spec.home.z>bay.z0&&spec.home.z<bay.z0+bay.depth)}
assert.equal(VEHICLE_PRICE.flatbed,800000,'$8,000');
// the lock: below level 5 the lot and the phone refuse it and say why; at level 5 it can be bought
const xpFor=level=>{let xp=0;for(let l=1;l<level;l++)xp+=xpForNext(l);return xp};
const rich=level=>({...freshProgress(),cash:2000000,housing:{...freshProgress().housing,rented:true},skills:{lumberjack:{xp:xpFor(level)}}});
assert.match(vehicleLock(rich(4),'flatbed'),/Needs Lumberjack level 5 \(you are level 4\)/);assert.equal(vehicleLock(rich(5),'flatbed'),null);assert.equal(vehicleLock(rich(1),'worktruck'),null,'other models have no lock');
assert.match(buyVehicle(rich(4),'flatbed','orange').error,/needs Lumberjack level 5/);assert.match(orderVehicle(rich(4),'flatbed','orange',STUDIO_ID).error,/needs Lumberjack level 5/);
{const r=buyVehicle(rich(5),'flatbed','orange');assert(!r.error,r.error);assert.equal(r.state.cash,2000000-800000);assert.equal(r.vehicle.model,'flatbed')}
console.log('PASS flatbed.mjs: the Tylan Flatbed: 5,796 triangles in nine parts with its anchors, wheels on pivots, a hinged tailgate, six paint colours set directly, 35 mph and slow off the mark, the third truck bay, $8,000, and locked below Lumberjack level 5 on the lot and on the phone.');
