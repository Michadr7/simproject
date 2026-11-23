// Blackstone Pass B1/B2 & ATV A2p2/A3/A6 checks: lake/falls/ford, relief heights, ATV loop grades, hand-brake drift, and splash.
import assert from 'node:assert/strict';
import {MAP,waterAt} from '../dist/map-definition.js';
import {heightAt} from '../dist/height.js';
import {SURFACE} from '../dist/terrain.js';
import {CLASSES,freshVehicle,stepVehicle} from '../dist/vehicle.js';
import {driftStep} from '../dist/slope-rules.js';
import {sprayOf} from '../dist/debris.js';

// B1/B2 map data & relief
assert.ok(waterAt(660,-550)?.kind==='lake','Blackstone Lake water at centre');
assert.ok(waterAt(720,-764)?.kind==='fall','Blackstone Falls plunge pool');
assert.equal(waterAt(712,-715)?.kind,'ford','Blackstone ford crosses the stream');
assert.ok(heightAt(950,-1120)>55,'Blackstone Peak elevation');
assert.ok(heightAt(700,-1060)>25,'High Pass Saddle elevation');
assert.ok(MAP.blackstone?.camps?.length===3&&MAP.blackstone.dock,'camps C1..C3 and dock registered');

// A3: ATV trail loop grades stay under 25 deg
const loop=MAP.relief.tracks.find(t=>t.id==='blackstone-atv-loop');
assert.ok(loop,'blackstone-atv-loop registered');
for(let i=1;i<loop.points.length;i++){
 const [ax,az]=loop.points[i-1],[bx,bz]=loop.points[i],d=Math.hypot(bx-ax,bz-az);
 const deg=Math.abs(Math.atan2(heightAt(bx,bz)-heightAt(ax,az),d)*180/Math.PI);
 assert.ok(deg<25,`ATV trail segment ${i} grade ${deg.toFixed(1)} deg < 25 deg`);
}

// A2 part 2: hand-brake drift builds slip, tightens turn rate, and steep > 25 deg sets steep flag
const slip=driftStep({slip:0,drift:true,speed:10,steer:1,grip:1,dt:.3});
assert.ok(slip>0.5,'driftStep builds slip');
const flatEnv={blocked:()=>false,surface:()=>SURFACE.DIRT,grade:0,side:0};
let a={...freshVehicle({x:0,z:0,yaw:0}),speed:10,steer:1},b={...freshVehicle({x:0,z:0,yaw:0}),speed:10,steer:1};
for(let i=0;i<20;i++){a=stepVehicle(a,{throttle:1,steer:1,drift:false},1/60,CLASSES.atv,flatEnv).state;b=stepVehicle(b,{throttle:1,steer:1,drift:true},1/60,CLASSES.atv,flatEnv).state}
assert.ok(b.yaw>a.yaw&&b.slip>0.2,'handbrake drift swings ATV yaw faster and builds slip');
const steepStep=stepVehicle({...freshVehicle({x:0,z:0,yaw:0}),speed:4},{throttle:1},1/60,CLASSES.atv,{...flatEnv,grade:30});
assert.equal(steepStep.steep,true,'over 25 deg sets steep flag');

// A6: shallow ford splash in debris rules
assert.ok(sprayOf({surface:SURFACE.WATER,speed:6,top:15}).mud>0,'ford crossing sprays water droplets');
console.log('PASS blackstone-atv: B1/B2 lake/falls/ford/peaks/ATV loop + A2p2 drift & slip + A6 splash');
