import assert from 'node:assert/strict';
import {CLASSES,freshVehicle,stepVehicle} from '../dist/vehicle.js';
import {SURFACE} from '../dist/terrain.js';
import {GROUPS,speedFactor,gripOf,rollDragOf,stepBog,freshBog,bogRate,BOG_RESIST,STUCK_AT} from '../dist/surface-table.js';
import {PROPS} from '../dist/props-assets.js';
import {propInfo,createProp} from '../dist/props.js';
import {PAINT,coloursOf,validColour,paintUniforms} from '../dist/paint.js';
import {VEHICLE_PRICE} from '../dist/orders.js';
import {MAP} from '../dist/map-definition.js';
import {TRACK_WIDTH} from '../dist/tracks-rules.js';
import {ENGINES,ALL_FILES} from '../dist/vehicle-sounds.js';
import {CREDITS,creditFor} from '../dist/credits.js';

// FV1 (notes/farm-vehicles-design.md sections 0, 1 and 4): the two farm tractors and the tank trailer imported. Numbers, the 'tractor' surface group, bog times, the model records (wheels, anchors, centring), paint, price, slot, tracks, sound fallback, credits.
const S=SURFACE,J=CLASSES.tractor_juff,K=CLASSES.tractor_kidbi;

// 1. Classes (design table).
assert.equal(J.name,'Hustler Compact');assert.equal(K.name,'Husky R75 Tractor');
for(const c of [J,K]){assert.equal(c.group,'tractor');assert.equal(c.seats,1,'one seat, no passenger door');assert.equal(c.reverse,3);assert.equal(c.brake,6);assert.equal(c.drag,1.4);assert.equal(c.aLat,6);assert(c.exhaust.stack,'a vertical stack');assert(c.hitchRear.z<-c.hz+.2,'the hitch pin is at the back')}
assert.deepEqual([J.top,J.accel,J.rMin,J.mpg,J.tough,J.hx,J.hz,J.axleZ],[6.3,1.8,4.2,6,.35,.93,1.575,-.935]);
assert.deepEqual([K.top,K.accel,K.rMin,K.mpg,K.tough,K.hx,K.hz,K.axleZ],[7.2,1.6,4.8,5,.3,.99,1.54,-.68]);
assert.equal(J.gallonsPerMile,1.3333);assert.equal(K.gallonsPerMile,1.6);
assert.equal(J.seat.x,0,'the seat is on the centre line');assert(J.door.x>J.hx&&K.door.x>K.hx,'the mount point is outside the hull, on the left');
assert(!('tow_tank' in CLASSES),'the trailer has no drive class until FV3/FV4');

// 2. Feel: 0 to top on a road (design: JUFF 3.5 s, KidBi 4.5 s), tops at 14 and 16 mph.
const open={blocked:()=>false,surface:()=>S.ROAD};
const reach=(c,frac)=>{let s=freshVehicle({x:0,z:0,yaw:0}),t=0;while(s.speed<c.top*frac&&t<30){s=stepVehicle(s,{throttle:1},1/60,c,open).state;t+=1/60}return t};
for(const [c,secs] of [[J,3.5],[K,4.5]]){const t=reach(c,.995);assert(Math.abs(t-secs)<.8,`${c.id} reaches its top speed in about ${secs} s (${t.toFixed(2)})`)}
assert(Math.abs(J.top*2.23694-14.1)<.1&&Math.abs(K.top*2.23694-16.1)<.1,'14.1 and 16.1 mph');

// 3. The surface group: every row has a 'tractor' column, in the design's numbers.
assert(GROUPS.includes('tractor')&&GROUPS.length===6);
const want={STREET:1,ROAD:1,BRIDGE:1,DRIVEWAY:1,PAVEMENT:.9,DIRT:1,PATH:1,GRAVEL:1,GRASS:1,GREEN:.95,WHEAT:.9,PLOWED:.85,MUD:.7,WATER:0,BANK:0};
for(const [k,v] of Object.entries(want))assert.equal(speedFactor(S[k],'tractor'),v,`tractor on ${k}`);
assert.equal(gripOf(S.ROAD,'tractor'),1);assert.equal(+gripOf(S.MUD,'tractor').toFixed(3),.6,'lugs: mud .35 + .25');assert.equal(+gripOf(S.PLOWED,'tractor').toFixed(3),.75);
assert.equal(rollDragOf(S.MUD,'tractor'),2.5*.5,'roll drag group factor .5');
assert.equal(BOG_RESIST.tractor,.12);
// the model: mud top speed of the Hustler is 4.4 m/s (design: 6.3 x .7)
assert(Math.abs(J.top*speedFactor(S.MUD,'tractor')-4.41)<.01);

// 4. Bog times (design section 1): flooring it on the spot. Hustler in mud 33 s, in plowed ground 83 s; a loaded one is faster to bog; bogMul scales (the combine's 1.5 gives 22 s).
const timeToStuck=(surface,{load=0,bogMul=1}={})=>{let b=freshBog(),t=0;const dt=.05;while(!b.stuck&&t<400){b=stepBog(b,{throttle:1,speed:0,surface,group:'tractor',load,dt,bogMul});t+=dt}return t};
assert(Math.abs(timeToStuck(S.MUD)-33.3)<.3,'mud 33 s: '+timeToStuck(S.MUD));
assert(Math.abs(timeToStuck(S.PLOWED)-83.3)<.5,'plowed 83 s: '+timeToStuck(S.PLOWED));
assert(Math.abs(timeToStuck(S.MUD,{bogMul:1.5})-22.2)<.3,'bogMul 1.5: 22 s');
assert(timeToStuck(S.MUD,{load:1})<timeToStuck(S.MUD),'a full tank bogs sooner (x1.5 at load 1)');assert.equal(+(bogRate(S.MUD,'tractor',1)/bogRate(S.MUD,'tractor')).toFixed(3),1.5);
assert.equal(bogRate(S.ROAD,'tractor'),0,'a road never bogs');assert.equal(bogRate(S.MUD,'road'),.25,'the road truck is unchanged (4 s)');assert(STUCK_AT===1);
// ... and a tractor that keeps moving (2 m/s or more) never bogs
{let b=freshBog();for(let i=0;i<4000;i++)b=stepBog(b,{throttle:1,speed:2.5,surface:S.MUD,group:'tractor',dt:.05});assert(!b.stuck&&b.bog===0,'moving through mud: no bog')}

// 5. The model records: wheels, anchors, centring, colours, triangles.
const REC={tractor_juff:{tris:5826,rear:.644,front:.389},tractor_kidbi:{tris:14797,rear:.614,front:.406},tow_tank:{tris:6124,rear:.406,front:.406}};
for(const [id,r] of Object.entries(REC)){const p=PROPS[id];assert(p,id+' is in props-assets.js (startup module)');assert.equal(p.triangles,r.tris,id+' triangles');
 assert.equal(p.wheels.length,4,id+' has four wheels');const rear=p.wheels.filter(w=>!w.front),front=p.wheels.filter(w=>w.front);assert.equal(rear.length,2);assert.equal(front.length,2);
 assert(rear.every(w=>Math.abs(w.radius-r.rear)<.01)&&front.every(w=>Math.abs(w.radius-r.front)<.01),id+' wheel radii');
 for(const w of p.wheels){assert(Math.abs(w.at[1]-w.radius)<.01,id+' every tyre touches the ground');assert(w.triangles>=300)}
 assert(Math.abs(p.wheels[0].at[0]+p.wheels[1].at[0])<.02,id+' left and right wheels mirror');
 assert.equal(p.parts,undefined,id+': the part runs are dropped after the wheels are taken out');
 const wc=Buffer.from(p.wheels[0].col,'base64');assert(wc.some(v=>v<100)&&!wc.every(v=>v===255),id+' tyres are dark (COLOR_0 kept), not white');
 assert.equal(p.footprint.x0,-p.footprint.x1,id+' centred in x');assert(Math.abs(p.footprint.z0+p.footprint.z1)<.02,id+' centred in z: the origin is the hull centre')}
// axleZ is the rear hub's z from the centre
assert(Math.abs(PROPS.tractor_juff.nodes.wheel_RL[2]-J.axleZ)<.01&&Math.abs(PROPS.tractor_kidbi.nodes.wheel_RL[2]-K.axleZ)<.01,'axleZ matches the rear hubs');
assert(Math.abs(PROPS.tow_tank.nodes.wheel_RL[2]+.9219)<.001&&Math.abs((PROPS.tow_tank.nodes.wheel_RL[2]+PROPS.tow_tank.nodes.wheel_FL[2])/2+.473)<.01,'the trailer axle centre is -0.47');
// anchors (contract): the hitch pins and the hands; the class numbers are the record's
for(const id of ['tractor_juff','tractor_kidbi'])for(const a of ['anchor_driver_seat','anchor_hands_L','anchor_hands_R','anchor_foot_L','anchor_exhaust','anchor_hitch_rear','anchor_pto','anchor_engine_sound'])assert(PROPS[id].anchors[a],id+' has '+a);
assert(Math.abs(PROPS.tractor_juff.anchors.anchor_hitch_rear[2]-J.hitchRear.z)<.01&&Math.abs(PROPS.tractor_juff.anchors.anchor_hitch_rear[1]-J.hitchRear.y)<.01);
assert(Math.abs(PROPS.tractor_kidbi.anchors.anchor_hitch_rear[2]-K.hitchRear.z)<.01&&Math.abs(PROPS.tractor_kidbi.anchors.anchor_hitch_rear[1]-K.hitchRear.y)<.01);
assert(Math.abs(PROPS.tractor_juff.anchors.anchor_driver_seat[2]-J.seat.z)<.01&&Math.abs(PROPS.tractor_kidbi.anchors.anchor_driver_seat[2]-K.seat.z)<.01,'the seat z');
assert(PROPS.tow_tank.anchors.anchor_hitch_front&&PROPS.tow_tank.anchors.anchor_cargo&&PROPS.tow_tank.anchors.anchor_drain&&PROPS.tow_tank.nodes.tank_fill,'the trailer: tongue eye, cargo centre, drain, filler');
// the pin heights differ as the design says (JUFF 22 cm above the tank eye, KidBi 9 cm below)
assert(Math.abs((PROPS.tractor_juff.anchors.anchor_hitch_rear[1]-PROPS.tow_tank.anchors.anchor_hitch_front[1])-.223)<.01);assert(Math.abs((PROPS.tractor_kidbi.anchors.anchor_hitch_rear[1]-PROPS.tow_tank.anchors.anchor_hitch_front[1])+.091)<.01);
// createProp: the meshes, four wheel pivots, anchors as userData
{const m=createProp('tractor_juff',{apply:x=>x});assert.equal(m.userData.wheels.length,4);assert(m.userData.anchors.anchor_hitch_rear&&m.userData.nodes.steering_wheel);assert.equal(propInfo('tow_tank').wheels.length,4)}
// the startup size rule: the three models add less than 1.5 MB to props-assets.js
{const bytes=Object.keys(REC).reduce((n,id)=>n+JSON.stringify(PROPS[id]).length,0);assert(bytes<1.5e6,'the tractor records are '+bytes+' bytes')}

// 6. Paint, price, slots, tracks, sound, credits.
for(const id of ['tractor_juff','tractor_kidbi']){assert(PAINT[id]&&coloursOf(id).length===6);assert.equal(paintUniforms(id,coloursOf(id)[0].id).hue,-1);assert(validColour(id,'red')||validColour(id,'blue'))}
assert(!PAINT.tow_tank,'no paint for the trailer yet');
const keys=Object.keys(VEHICLE_PRICE);assert.equal(keys[0],'worktruck','the first price key is unchanged');assert.deepEqual(keys.slice(-3,-1),['tractor_juff','tractor_kidbi'],'added after the ones before (A4 added the ATV after them)');
assert.equal(VEHICLE_PRICE.tractor_juff,520000);assert.equal(VEHICLE_PRICE.tractor_kidbi,980000);assert(!('tow_tank' in VEHICLE_PRICE));
for(const [id,model,gal] of [['eastbank-tractor-juff','tractor_juff',12000],['eastbank-tractor-kidbi','tractor_kidbi',25000]]){const v=MAP.vehicles.find(x=>x.id===id);assert(v,id);assert.equal(v.model,model);assert.equal(v.fuel.type,'diesel');assert.equal(v.fuel.tankMgal,gal);assert.equal(v.sale,'both');assert.equal(v.name,CLASSES[model].name)}
assert(TRACK_WIDTH.tractor_juff>0&&TRACK_WIDTH.tractor_kidbi>TRACK_WIDTH.tractor_juff);
assert.equal(ENGINES.tractor_juff.file,'eng-tractor');assert.equal(ENGINES.tractor_kidbi.file,'eng-tractor');assert(ENGINES.tractor_juff.rate[1]<ENGINES.worktruck.rate[1],'slowed fallback');assert.equal(ALL_FILES.filter(f=>f==='eng-worktruck').length,1,'the shared clip is loaded once');
for(const id of ['tractor_juff','tractor_kidbi','tow_tank']){const c=creditFor(PROPS[id].source);assert(c&&c.licence==='CC-BY-4.0'&&/modified/.test(c.what),id+' has a CC-BY credit that says modified')}
assert(CREDITS.find(c=>c.who==='JUFF').what.includes('d5e9b5a1bc1046ce821ac13c942c14c1')&&CREDITS.find(c=>c.who==='KidBi-Gaming').what.includes('23ceeff8f01a4370ab215b9d4725d454'));
console.log('Farm tractors: PASS (Hustler Compact and Husky R75 classes, tractor surface group, bog 33 s / 83 s / 22 s, 3 models with wheels and anchors, paint, price, slots, tracks, sound fallback, credits)');
