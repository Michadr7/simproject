import assert from 'node:assert/strict';
import {CLASSES,freshVehicle,stepVehicle} from '../dist/vehicle.js';
import {SURFACE} from '../dist/terrain.js';
import {slopeOf,applySlope,slopeSteer,STEEP_DEG,ROLLBACK_SPEED} from '../dist/slope-rules.js';

// A2 (notes/atv-handling-design.md section 2): slope, side slope, roll back, steering refusal. Pure rules with synthetic grades; drift and slip (part 2) are not built.
const ATV=CLASSES.atv,PICK=CLASSES.offroad,TRUCK=CLASSES.worktruck;
const near=(a,b,e,m)=>assert.ok(Math.abs(a-b)<=e,`${m}: ${a} vs ${b}`);
const env=(grade=0,side=0,surface=SURFACE.DIRT)=>({blocked:()=>false,surface:()=>surface,grade,side});
const run=(cls,input,e,sec,start=0)=>{let s={...freshVehicle({x:0,z:0,yaw:0}),speed:start};for(let i=0;i<sec*60;i++)s=stepVehicle(s,input,1/60,cls,e).state;return s};

// 1. Design numbers (section 2): uphill top x(1-.6 (g/25)^2); downhill x(1+.25 g/25); steep above 25.
near(slopeOf({grade:10}).top,.904,.001,'10 deg up');near(slopeOf({grade:15}).top,.784,.001,'15 deg up');near(slopeOf({grade:20}).top,.616,.001,'20 deg up');near(slopeOf({grade:25}).top,.4,.001,'25 deg up');
near(slopeOf({grade:-25}).top,1.25,.001,'25 deg down');near(slopeOf({grade:-10}).brake,.88,.001,'downhill brake');
near(slopeOf({grade:25}).gravity,-9.81*Math.sin(25*Math.PI/180)*.3,1e-9,'gravity at 25');
assert.equal(slopeOf({grade:25}).steep,false);assert.equal(slopeOf({grade:25.1}).steep,true);
const flat=slopeOf({});assert.deepEqual([flat.top,flat.brake,flat.gravity,flat.steep,flat.slide,flat.refuse],[1,1,0,false,0,0],'no env numbers = flat');

// 2. Flat ground is unchanged for the ATV (same result with and without grade fields) and for classes without slope:true even on a hill.
const bare={blocked:()=>false,surface:()=>SURFACE.DIRT};
near(run(ATV,{throttle:1},env(0,0),6).speed,run(ATV,{throttle:1},bare,6).speed,1e-9,'flat = no fields');
near(run(PICK,{throttle:1},env(25,30),6).speed,run(PICK,{throttle:1},bare,6).speed,1e-9,'pickup ignores slope');
near(run(TRUCK,{throttle:1},env(-20,0),6).speed,run(TRUCK,{throttle:1},bare,6).speed,1e-9,'truck ignores slope');
assert.equal(ATV.slope,true);assert.equal(PICK.slope,undefined);

// 3. The ATV on a hill: slower up, faster down, in that order.
const flatTop=run(ATV,{throttle:1},env(0),12).speed,up=run(ATV,{throttle:1},env(20),12).speed,down=run(ATV,{throttle:1},env(-20),12).speed;
assert.ok(up<flatTop*.7&&down>flatTop*.99,`up ${up} flat ${flatTop} down ${down}`);
near(up,ATV.top*1*slopeOf({grade:20}).top,.2,'top uphill at 20 deg');

// 4. Coasting: a gentle hill holds a stopped ATV (drag wins), a steep one rolls it back; downhill coasting gains speed.
near(run(ATV,{},env(8),3).speed,0,1e-9,'parked on 8 deg');
near(run(ATV,{},env(24),3).speed,0,1e-9,'still held on 24 deg (drag 1.2+.24 beats 1.2)');assert.ok(run(ATV,{},env(26),3).speed<0,'rolls back past 25 deg');
assert.ok(run(ATV,{},env(-20),2,3).speed>run(ATV,{},env(0),2,3).speed,'downhill coasting gains');

// 5. Beyond 25 degrees: the throttle is ignored, the speed goes to -1.5 m/s at 2 m/s2, never lower.
let s=run(ATV,{throttle:1},env(30),.5,6);assert.ok(s.speed<=6-2*.5+.01&&s.speed>0,'eases down at least 2 m/s2 (the over-top decel of the tiny steep top may bleed faster): '+s.speed);
s=run(ATV,{throttle:1},env(30),12,0);near(s.speed,-ROLLBACK_SPEED,1e-9,'rolls back at -1.5');
assert.ok(s.z<0,'and actually moves backwards');
assert.equal(applySlope(-3,-3,slopeOf({grade:30}),1/60),-3,'already faster backwards: not dragged to -1.5');
assert.ok(STEEP_DEG===25);

// 6. Side slope: under 18 deg no slide; beyond it a downhill slide of .15 m/s per degree over 18, capped 1.5.
assert.equal(slopeOf({side:18}).slide,0);near(slopeOf({side:22}).slide,.6,1e-9,'22 deg');near(slopeOf({side:-22}).slide,-.6,1e-9,'mirror');near(slopeOf({side:60}).slide,1.5,1e-9,'cap');
const lean=run(ATV,{},env(0,24),2);assert.ok(lean.x>.5,`slides to the left (+x): ${lean.x}`);
const leanR=run(ATV,{},env(0,-24),2);assert.ok(leanR.x<-.5,'and to the right when it falls right');near(lean.x,-leanR.x,1e-9,'symmetric');
assert.equal(run(ATV,{},env(0,15),2).x,0,'no slide under 18 deg');

// 7. Over 25 deg of side slope, steering toward uphill is refused; away from it and the other side are not.
assert.equal(slopeSteer(1,slopeOf({side:20})),1,'under 25: free');
assert.equal(slopeSteer(-1,slopeOf({side:30})),0,'falls left: right (steer<0) refused');assert.equal(slopeSteer(1,slopeOf({side:30})),1,'falls left: left allowed');
assert.equal(slopeSteer(1,slopeOf({side:-30})),0,'falls right: left refused');assert.equal(slopeSteer(-1,slopeOf({side:-30})),-1);
const st=run(ATV,{throttle:1,steer:-1},env(0,30),2,5).steer;assert.ok(st>=0,`steer refused toward uphill: ${st}`);

// 8. Bad numbers (NaN, undefined) read as flat.
assert.deepEqual(slopeOf({grade:NaN,side:undefined}),flat);

console.log('PASS slope-a2: grade, roll back, side slide and steer refusal for slope:true classes; others unchanged');
