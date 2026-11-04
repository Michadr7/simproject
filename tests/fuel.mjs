import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {PRICE_CENTS_PER_L,FLOW_ML_PER_S,STEP_ML,HOSE_MAX_M,REACH_M,costPerStep,burnMl,sell,normalizeFuelMl,fuelText,priceLabel} from '../dist/fuel.js';
import {hoseGeometry,hoseCurve,writeHose,HOSE_SEGMENTS,HOSE_SIDES} from '../dist/fuel-station.js';
import {MAP,validateMap,FUEL_STATIONS,CANOPY_COLUMNS} from '../dist/map-definition.js';
import {vehiclesToSave,normalizeVehicles,CLASSES} from '../dist/vehicle.js';

// ── The sale: pure, integer cents, whole steps ───────────────────────────────────────────────────
assert.deepEqual(PRICE_CENTS_PER_L,{petrol:200,diesel:210},'placeholder prices: $2.00 petrol, $2.10 diesel');
assert.equal(costPerStep('petrol'),20,'100 ml of petrol costs 20 cents');assert.equal(costPerStep('diesel'),21,'100 ml of diesel costs 21 cents');
assert.equal(priceLabel('diesel'),'$2.10/L');
const tank=(ml,capacityMl=70000,fuel='diesel')=>({fuel,ml,capacityMl});
{const r=sell({cash:10000,target:tank(0)},{pump:{fuel:'diesel'},ml:1000});assert.equal(r.soldMl,1000);assert.equal(r.cents,210,'10 L of diesel = $2.10 x 10');assert.equal(r.cash,9790);assert.equal(r.target.ml,1000);
 assert(Number.isSafeInteger(r.cash)&&Number.isSafeInteger(r.cents),'whole cents')}
{const r=sell({cash:10000,target:tank(0)},{pump:{fuel:'petrol'},ml:100});assert.equal(r.error,'This one takes diesel, not petrol.');assert.equal(r.code,'wrong-fuel','the wrong pump does not connect: an error, no money taken')}
{const r=sell({cash:10000,target:tank(69950,70000)},{pump:{fuel:'diesel'},ml:1000});assert.equal(r.code,'full','a tank with 50 ml to go takes no whole step')}
{const r=sell({cash:10000,target:tank(69900,70000)},{pump:{fuel:'diesel'},ml:1000});assert.equal(r.soldMl,100,'a request is clipped to what fits (one step)');assert.equal(r.target.ml,70000,'and the tank is exactly full');assert.equal(r.cents,21)}
{const r=sell({cash:21,target:tank(0)},{pump:{fuel:'diesel'},ml:1000});assert.equal(r.soldMl,100,'exactly one step of cash buys one step');assert.equal(r.cash,0);
 const broke=sell({cash:20,target:tank(0)},{pump:{fuel:'diesel'},ml:100});assert.equal(broke.code,'broke','one cent short: nothing sold')}
{const r=sell({cash:10000,target:tank(0)},{pump:{fuel:'diesel'},ml:2500});assert.equal(r.soldMl,2500,'25 whole steps (2.5 L) are sold')}
for(const bad of [{ml:0},{ml:-100},{ml:150},{ml:1.5},{ml:NaN}])assert.equal(sell({cash:1000,target:tank(0)},{pump:{fuel:'diesel'},...bad}).code,'invalid',`ml ${bad.ml} is not a sale`);
assert.equal(sell({cash:1000,target:tank(0)},{pump:{fuel:'kerosene'},ml:100}).code,'invalid','an unknown fuel is refused');
assert.equal(sell({cash:1.5,target:tank(0)},{pump:{fuel:'diesel'},ml:100}).code,'invalid','cash must be whole cents');
assert.equal(sell({cash:1000,target:null},{pump:{fuel:'diesel'},ml:100}).code,'invalid');
{ // money is exact: paying in many small hold-E steps adds up to one big sale
 let s={cash:100000,target:tank(0)},total=0;for(let i=0;i<30;i++){const r=sell(s,{pump:{fuel:'diesel'},ml:100});total+=r.cents;s={cash:r.cash,target:r.target}}
 const big=sell({cash:100000,target:tank(0)},{pump:{fuel:'diesel'},ml:3000});assert.equal(total,big.cents,'thirty 100 ml steps cost the same as one 3 L sale');assert.equal(s.target.ml,big.target.ml)}
// rates and burn
assert.equal(FLOW_ML_PER_S,2000);assert.equal(STEP_ML,100);assert(HOSE_MAX_M===3.5&&REACH_M===1.5);
assert.equal(burnMl(100,1.0),1000,'1 L per 100 m burns 1000 ml');assert.equal(burnMl(-5,1.0),0,'no burn going backwards');
// saved fuel: a missing or bad value is a full tank
assert.equal(normalizeFuelMl(undefined,70000),70000);assert.equal(normalizeFuelMl(12000,70000),12000);assert.equal(normalizeFuelMl(90000,70000),70000,'too big: full');assert.equal(normalizeFuelMl(-1,70000),70000);assert.equal(normalizeFuelMl(1.5,70000),70000);
assert.equal(fuelText(62300,70000),'62.3 L of 70 L');assert.equal(fuelText(0,70000),'Empty');

// ── The map: one station with two pumps, its island and canopy on the forecourt, the vehicles' tanks ─────────────
assert.deepEqual(validateMap(MAP),[],'the map is still valid with the station and the tanks');
assert.equal(FUEL_STATIONS.length,1);assert.deepEqual(FUEL_STATIONS[0].pumps.map(p=>p.fuel),['petrol','diesel']);
assert.equal(CANOPY_COLUMNS.length,4,'four steel columns');
for(const v of MAP.vehicles)assert(v.fuel&&v.fuel.tankMl>0&&Number.isFinite(v.fuel.port.x)&&Number.isFinite(v.fuel.port.z),v.id+' has a tank and a filler');
assert.equal(MAP.vehicles.find(v=>v.id==='eastbank-worktruck').fuel.tankMl,80000);

// ── The hose: 66 vertices, 120 triangles, sagging, never under the ground ─────────────────────────
{const g=hoseGeometry();assert.equal(g.attributes.position.count,(HOSE_SEGMENTS+1)*HOSE_SIDES,'66 vertices');assert.equal(g.index.count/3,120,'120 triangles (10 segments x 6 sides x 2)');
 const a=new THREE.Vector3(0,.48,0),b=new THREE.Vector3(0,1.13,1.0);const pts=hoseCurve(a,b);assert.equal(pts.length,HOSE_SEGMENTS+1);
 assert(pts[0].equals(a)&&pts[pts.length-1].equals(b),'the hose starts at the outlet and ends at the holster');
 const mid=pts[5];assert(mid.y<(a.y+b.y)/2,'the middle sags below the straight line between the ends');
 const low=hoseCurve(new THREE.Vector3(0,.2,0),new THREE.Vector3(0,.2,2),()=>.5);assert(low.every(p=>p.y>=.5+.03-1e-9),'never below the ground under it (+3 cm)');
 writeHose(g,pts);const p=g.attributes.position.array;assert(Number.isFinite(p[0])&&Number.isFinite(p[p.length-1]),'the tube is written');
 const far=Math.hypot(p[0]-pts[0].x,p[1]-pts[0].y,p[2]-pts[0].z);assert(Math.abs(far-.02)<1e-3,'the ring is one hose radius (2 cm) round the centre line')}

// ── The saved list keeps fuel (and only fuel changes what is saved for a vehicle at home) ─────────────────
{const specs=MAP.vehicles,home=Object.fromEntries(specs.map(v=>[v.id,{...v.home,fuelMl:v.fuel.tankMl}]));
 assert.deepEqual(vehiclesToSave(specs,home),[],'full and at home: nothing saved');
 const low={...home,'eastbank-worktruck':{...home['eastbank-worktruck'],fuelMl:12000}};
 assert.deepEqual(vehiclesToSave(specs,low),[{uid:'eastbank-worktruck',model:'worktruck',x:84.25,z:-13,yaw:3.142,fuelMl:12000}],'a part-empty tank at home is saved');
 const back=normalizeVehicles(vehiclesToSave(specs,low),specs,MAP.playable);assert.equal(back[0].fuelMl,12000,'and loads back');
 const noFuel=normalizeVehicles([{uid:'eastbank-offroad',model:'offroad',x:100,z:10,yaw:1}],specs,MAP.playable);assert.equal(noFuel[0].fuelMl,70000,'a save from before fuel: a full tank');
 const bad=normalizeVehicles([{uid:'eastbank-worktruck',model:'worktruck',x:100,z:10,yaw:1,fuelMl:999999}],specs,MAP.playable);assert.equal(bad[0].fuelMl,80000,'more than the tank: full')}
assert(CLASSES.worktruck.litresPer100m>0&&CLASSES.offroad.litresPer100m>0,'both trucks burn fuel');

// The canopy's four columns block, and the space under the roof between them and the island is walkable (the converted canopy has no box of its own)
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};
const THREE_SCENE=(await import('../dist/vendor/three.module.js')).Scene;
const {createWorld}=await import('../dist/world.js');const world=createWorld(new THREE_SCENE(),{cullRadius:Infinity});
for(const [dx,dz] of CANOPY_COLUMNS)assert(world.blocked(155.5+dx,-8.25+dz),`a canopy column blocks at ${155.5+dx}, ${-8.25+dz}`);
assert(!world.blocked(155.5,-11.5),'under the canopy, between the columns and clear of the island: walkable');
assert(world.blocked(156.5,-8.25),'the pump island is solid');
console.log('Fuel: whole-cent sales (wrong fuel, full, broke, invalid, clipping to the tank and to cash), thirty small steps cost the same as one big sale, the burn rate, the hose (66 vertices, 120 triangles, sags, never under the ground), the Eastbank station passes validation, and saved fuel keeps a part-empty tank.');
