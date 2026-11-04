import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {PRICE_CENTS_PER_GAL,FLOW_MGAL_PER_S,STEP_MGAL,HOSE_MAX_M,REACH_M,GALLON,costPerStep,burnMgal,sell,normalizeFuelMgal,fuelText,fuelTitle,fuelName,priceLabel,mph,gallons} from '../dist/fuel.js';
import {hoseGeometry,hoseCurve,writeHose,readoutLines,HOSE_SEGMENTS,HOSE_SIDES} from '../dist/fuel-station.js';
import {MAP,validateMap,FUEL_STATIONS,CANOPY_COLUMNS} from '../dist/map-definition.js';
import {vehiclesToSave,normalizeVehicles,CLASSES} from '../dist/vehicle.js';

// ── The sale: pure, imperial, integer cents and milli-gallons, whole steps ───────────────────────────
assert.deepEqual(PRICE_CENTS_PER_GAL,{gas:400,diesel:420},'placeholder prices: $4.00 a gallon for gas, $4.20 for diesel');
assert.equal(costPerStep('gas'),20,'0.05 gal of gas costs 20 cents');assert.equal(costPerStep('diesel'),21,'0.05 gal of diesel costs 21 cents');
assert.equal(priceLabel('diesel'),'$4.20/gal');assert.equal(fuelName('gas'),'gas');assert.equal(fuelTitle('gas'),'Gas');assert.equal(fuelTitle('diesel'),'Diesel');
for(const f of Object.keys(PRICE_CENTS_PER_GAL))assert(Number.isInteger(costPerStep(f)),f+': every step is a whole number of cents');
assert.equal(GALLON,1000);assert.equal(FLOW_MGAL_PER_S,500,'half a gallon a second');assert.equal(STEP_MGAL,50);
const tank=(mgal,capacityMgal=21000,fuel='diesel')=>({fuel,mgal,capacityMgal});
{const r=sell({cash:10000,target:tank(0)},{pump:{fuel:'diesel'},mgal:1000});assert.equal(r.soldMgal,1000);assert.equal(r.cents,420,'1 gallon of diesel = $4.20');assert.equal(r.cash,9580);assert.equal(r.target.mgal,1000);
 assert(Number.isSafeInteger(r.cash)&&Number.isSafeInteger(r.cents),'whole cents')}
{const r=sell({cash:10000,target:tank(0)},{pump:{fuel:'gas'},mgal:50});assert.equal(r.error,'This one takes diesel, not gas.');assert.equal(r.code,'wrong-fuel','the wrong pump does not connect: an error, no money taken')}
{const r=sell({cash:10000,target:tank(20980,21000)},{pump:{fuel:'diesel'},mgal:1000});assert.equal(r.code,'full','a tank with 20 milli-gallons to go takes no whole step')}
{const r=sell({cash:10000,target:tank(20950,21000)},{pump:{fuel:'diesel'},mgal:1000});assert.equal(r.soldMgal,50,'a request is clipped to what fits (one step)');assert.equal(r.target.mgal,21000,'and the tank is exactly full');assert.equal(r.cents,21)}
{const r=sell({cash:21,target:tank(0)},{pump:{fuel:'diesel'},mgal:1000});assert.equal(r.soldMgal,50,'exactly one step of cash buys one step');assert.equal(r.cash,0);
 const broke=sell({cash:20,target:tank(0)},{pump:{fuel:'diesel'},mgal:50});assert.equal(broke.code,'broke','one cent short: nothing sold')}
{const r=sell({cash:10000,target:tank(0)},{pump:{fuel:'diesel'},mgal:2500});assert.equal(r.soldMgal,2500,'50 whole steps (2.5 gal) are sold')}
for(const bad of [{mgal:0},{mgal:-50},{mgal:75},{mgal:1.5},{mgal:NaN}])assert.equal(sell({cash:1000,target:tank(0)},{pump:{fuel:'diesel'},...bad}).code,'invalid',`mgal ${bad.mgal} is not a sale`);
assert.equal(sell({cash:1000,target:tank(0)},{pump:{fuel:'kerosene'},mgal:50}).code,'invalid','an unknown fuel is refused');
assert.equal(sell({cash:1000,target:tank(0)},{pump:{fuel:'petrol'},mgal:50}).code,'invalid','"petrol" is gone: it is gas');
assert.equal(sell({cash:1.5,target:tank(0)},{pump:{fuel:'diesel'},mgal:50}).code,'invalid','cash must be whole cents');
assert.equal(sell({cash:1000,target:null},{pump:{fuel:'diesel'},mgal:50}).code,'invalid');
{ // money is exact: paying in many small hold steps adds up to one big sale
 let s={cash:100000,target:tank(0)},total=0;for(let i=0;i<30;i++){const r=sell(s,{pump:{fuel:'diesel'},mgal:50});total+=r.cents;s={cash:r.cash,target:r.target}}
 const big=sell({cash:100000,target:tank(0)},{pump:{fuel:'diesel'},mgal:1500});assert.equal(total,big.cents,'thirty 0.05 gal steps cost the same as one 1.5 gal sale');assert.equal(s.target.mgal,big.target.mgal)}
assert(HOSE_MAX_M===3.5&&REACH_M===1.5);
assert.equal(Math.round(burnMgal(1609.344,1.0)),1000,'1 gallon a mile burns 1000 milli-gallons over a mile');assert.equal(burnMgal(-5,1.0),0,'no burn going backwards');
// speed in miles an hour, gallons for people
assert.equal(mph(10),22,'10 m/s is 22 mph');assert.equal(mph(-5),11,'reversing shows a positive speed');assert.equal(gallons(12345),'12.3');
// saved fuel: a missing or bad value is a full tank
assert.equal(normalizeFuelMgal(undefined,21000),21000);assert.equal(normalizeFuelMgal(12000,21000),12000);assert.equal(normalizeFuelMgal(90000,21000),21000,'too big: full');assert.equal(normalizeFuelMgal(-1,21000),21000);assert.equal(normalizeFuelMgal(1.5,21000),21000);
assert.equal(fuelText(12300,21000),'12.3 of 21 gal');assert.equal(fuelText(0,21000),'Empty');

// ── The map: one drive-through station, its island and canopy on the forecourt, the vehicles' tanks and fuel types ─────────────
assert.deepEqual(validateMap(MAP),[],'the map is still valid with the station and the tanks');
assert.equal(FUEL_STATIONS.length,1);assert.deepEqual(FUEL_STATIONS[0].pumps.map(p=>p.fuel),['gas','diesel'],'a gas pump and a diesel pump');assert.equal(FUEL_STATIONS[0].face,'ny','the nozzles hang on the south face');
assert.equal(CANOPY_COLUMNS.length,4,'four steel columns');
for(const v of MAP.vehicles)assert(v.fuel&&['gas','diesel'].includes(v.fuel.type)&&v.fuel.tankMgal>0&&Number.isFinite(v.fuel.port.x)&&Number.isFinite(v.fuel.port.z),v.id+' has a tank, a fuel type and a filler');
assert.equal(MAP.vehicles.find(v=>v.id==='eastbank-worktruck').fuel.tankMgal,21000,'the Worktruck holds 21 gallons');assert.equal(MAP.vehicles.find(v=>v.id==='eastbank-offroad').fuel.tankMgal,18000);
assert(MAP.paving.some(p=>p.id==='gas-in'),'the forecourt has a west entry: you can drive through');
for(const v of MAP.vehicles)assert(v.fuel.port.x>0,v.id+': the filler is on the driver side, which faces the island as you drive east along the south lane');

// ── The hose: 66 vertices, 120 triangles, sagging, never under the ground ─────────────────────────
{const g=hoseGeometry();assert.equal(g.attributes.position.count,(HOSE_SEGMENTS+1)*HOSE_SIDES,'66 vertices');assert.equal(g.index.count/3,120,'120 triangles (10 segments x 6 sides x 2)');
 const a=new THREE.Vector3(0,.48,0),b=new THREE.Vector3(0,1.13,1.0);const pts=hoseCurve(a,b);assert.equal(pts.length,HOSE_SEGMENTS+1);
 assert(pts[0].equals(a)&&pts[pts.length-1].equals(b),'the hose starts at the outlet and ends at the holster');
 const mid=pts[5];assert(mid.y<(a.y+b.y)/2,'the middle sags below the straight line between the ends');
 const low=hoseCurve(new THREE.Vector3(0,.2,0),new THREE.Vector3(0,.2,2),()=>.5);assert(low.every(p=>p.y>=.5+.03-1e-9),'never below the ground under it (+3 cm)');
 writeHose(g,pts);const p=g.attributes.position.array;assert(Number.isFinite(p[0])&&Number.isFinite(p[p.length-1]),'the tube is written');
 const far=Math.hypot(p[0]-pts[0].x,p[1]-pts[0].y,p[2]-pts[0].z);assert(Math.abs(far-.02)<1e-3,'the ring is one hose radius (2 cm) round the centre line')}

// ── What the pump screen shows ─────────────────────────────────────────────────────────────────────
{const pump={fuel:'diesel'};const idle=readoutLines(pump);assert.deepEqual(idle,{title:'DIESEL',lines:['$4.20/gal','READY'],active:false},'idle: the fuel and its price');
 const use=readoutLines(pump,{mgal:2350,cents:987});assert.equal(use.title,'DIESEL');assert.deepEqual(use.lines,['2.4 gal','$9.87','$4.20/gal'],'filling: gallons so far, the cost so far, the price');assert.equal(use.active,true);
 assert.equal(readoutLines({fuel:'gas'}).title,'GAS')}

// ── The saved list keeps fuel (a part-empty tank at home is saved; a full one at home is not) ─────────────────
{const specs=MAP.vehicles,home=Object.fromEntries(specs.map(v=>[v.id,{...v.home,fuelMgal:v.fuel.tankMgal}]));
 assert.deepEqual(vehiclesToSave(specs,home),[],'full and at home: nothing saved');
 const low={...home,'eastbank-worktruck':{...home['eastbank-worktruck'],fuelMgal:3000}};
 assert.deepEqual(vehiclesToSave(specs,low),[{uid:'eastbank-worktruck',model:'worktruck',x:84.25,z:-13,yaw:3.142,fuelMgal:3000}],'a part-empty tank at home is saved');
 const back=normalizeVehicles(vehiclesToSave(specs,low),specs,MAP.playable);assert.equal(back[0].fuelMgal,3000,'and loads back');
 const noFuel=normalizeVehicles([{uid:'eastbank-offroad',model:'offroad',x:100,z:10,yaw:1}],specs,MAP.playable);assert.equal(noFuel[0].fuelMgal,18000,'a save from before fuel: a full tank');
 const old=normalizeVehicles([{uid:'eastbank-offroad',model:'offroad',x:100,z:10,yaw:1,fuelMl:5000}],specs,MAP.playable);assert.equal(old[0].fuelMgal,18000,'the old millilitre field is ignored: a full tank');
 const bad=normalizeVehicles([{uid:'eastbank-worktruck',model:'worktruck',x:100,z:10,yaw:1,fuelMgal:999999}],specs,MAP.playable);assert.equal(bad[0].fuelMgal,21000,'more than the tank: full')}
assert(CLASSES.worktruck.gallonsPerMile>0&&CLASSES.offroad.gallonsPerMile>0,'both trucks burn fuel');

// The canopy's four columns block, and the space under the roof between them and the island is walkable (the converted canopy has no box of its own).
// The canopy is turned 90 degrees (its 12 m side runs along the lanes), so its columns are at x +-3.2 and z +-5 from its centre.
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};
const THREE_SCENE=(await import('../dist/vendor/three.module.js')).Scene;
const {createWorld}=await import('../dist/world.js');const world=createWorld(new THREE_SCENE(),{cullRadius:Infinity});
const canopy=MAP.yards.find(y=>y.id==='gas-station').items.find(i=>i.prop==='prop.forecourt-canopy');assert(Math.abs(Math.sin(canopy.yaw))===1,'the canopy is turned a quarter turn');
const col=(dx,dz)=>[canopy.x+dx*Math.round(Math.cos(canopy.yaw))+dz*Math.round(Math.sin(canopy.yaw)),canopy.z-dx*Math.round(Math.sin(canopy.yaw))+dz*Math.round(Math.cos(canopy.yaw))];
for(const [dx,dz] of CANOPY_COLUMNS){const [x,z]=col(dx,dz);assert(world.blocked(x,z),`a canopy column blocks at ${x}, ${z}`)}
assert(!world.blocked(canopy.x,canopy.z-3.3),'under the canopy, north of the island: walkable');assert(!world.blocked(canopy.x,canopy.z+3),'under the canopy, in the south lane: walkable');
assert(world.blocked(156.5,-8.25),'the pump island is solid');
// the drive-through: a worktruck (4 m wide with its margin) and the off-road pickup pass along the south lane from the west entry to the east exit, past the columns, without touching anything
{const {freshVehicle,stepVehicle}=await import('../dist/vehicle.js');const {isWalkable}=await import('../dist/world.js');const {terrain}=await import('../dist/terrain.js');
 const T=terrain(),env={blocked:(x,z)=>!isWalkable(x,z)||world.blocked(x,z),surface:(x,z)=>T.surfaceAt(x,z)};
 for(const model of ['worktruck','offroad']){let s=freshVehicle({x:140,z:-5,yaw:Math.PI/2}),hits=0;for(let i=0;i<60*14&&s.x<172;i++){const r=stepVehicle(s,{throttle:1,steer:Math.max(-1,Math.min(1,(-5-s.z)*.8+(Math.PI/2-s.yaw)*1.5))},1/60,CLASSES[model],env);s=r.state;if(r.hit)hits++}
  assert(s.x>=170,`${model} drives through the station from the west entry to the east exit (reached x ${s.x.toFixed(1)}, ${hits} blocked steps)`);assert.equal(hits,0,model+' touches nothing on the way')}}

console.log('Fuel (imperial): whole-cent sales in gallons (gas and diesel, wrong fuel, full, broke, invalid, clipping), small steps cost the same as one big sale, mph, the burn rate, the hose (66 vertices, 120 triangles), the pump screen text, the drive-through station (canopy columns solid, the lane under the roof open, both trucks drive through), and saved fuel in milli-gallons.');
