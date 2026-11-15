import assert from 'node:assert/strict';
import {CLASSES,freshVehicle,stepVehicle,normalizeVehicles,vehiclesToSave,PLAYER_RADIUS} from '../dist/vehicle.js';
import {SURFACE} from '../dist/terrain.js';
import {VEHICLE_PRICE} from '../dist/orders.js';
import {crashPoints,applyPoints,bandOf,BANDS,withDamage,freshCrashState,registerCrash,pullSide,canStart,stallOver,extraCranks,repairCents,repairHours,POINT_CAP,PERSON_POINTS,STALL_POINTS} from '../dist/damage.js';

// VD1 (notes/vehicle-damage-design.md): the pure damage rules. No game wiring yet; stepVehicle only reports `impact` and `hitKind`.
const S70=CLASSES.shortbed,R=PLAYER_RADIUS,surface=()=>SURFACE.ROAD;
const wall=(x0)=>({blocked:(x,z)=>x>x0-R,surface});
const drive=(cls,start,env,speed,seconds,input={throttle:1})=>{let s={...freshVehicle(start),speed},max=0,kind=null;for(let t=0;t<seconds;t+=1/60){const r=stepVehicle(s,input,1/60,cls,env);s=r.state;if(r.impact>max){max=r.impact;kind=r.hitKind}}return {s,max,kind}};

// 1. Impact and kind. Head on at 20 m/s = 20; a shallow slide along a wall is a small fraction; a free move is 0; world / vehicle / person.
{const r=drive(S70,{x:0,z:0,yaw:Math.PI/2},wall(14),20,1.5,{});assert(Math.abs(r.max-20)<1.5,`head-on at 20 m/s: impact ${r.max.toFixed(2)}`);assert.equal(r.kind,'world')}
{const first=deg=>{let s={...freshVehicle({x:0,z:0,yaw:Math.PI/2-deg*Math.PI/180}),speed:10};for(let i=0;i<300;i++){const r=stepVehicle(s,{},1/60,S70,wall(12));s=r.state;if(r.hit)return r.impact}return 0},f10=first(10),f45=first(45),f60=first(60),f75=first(75);
 assert(f10>1&&f10<2.5,`10 degree shallow scrape at 10 m/s: first impact ${f10.toFixed(2)} (about 1.7)`);assert(f60>3&&f60<5.5&&f45>f60&&f60>f75,`glancing blows: 45 deg ${f45.toFixed(1)}, 60 deg ${f60.toFixed(1)} (about 4), 75 deg ${f75.toFixed(1)}: the shallower the angle the smaller (the hull's corner swings in on the steeper ones)`)}
{const r=drive(S70,{x:0,z:0,yaw:0},{blocked:()=>false,surface},10,1);assert.equal(r.max,0,'a free move has no impact');assert.equal(stepVehicle(freshVehicle({x:0,z:0,yaw:0}),{throttle:1},1/60,S70,{blocked:()=>false,surface}).hitKind,null)}
{const car={state:{x:20,z:0,yaw:Math.PI/2,speed:0,steer:0},cls:CLASSES.worktruck},r=drive(S70,{x:0,z:0,yaw:Math.PI/2},{blocked:()=>false,surface,others:[car]},15,2,{});assert.equal(r.kind,'vehicle');assert(r.max>10)}
{const r=drive(S70,{x:0,z:0,yaw:Math.PI/2},{blocked:()=>false,surface,people:[{x:20,z:0,r:.4}]},25,2,{});assert.equal(r.kind,'person','a fast hit on a person is classified as a person');assert(r.max>10);assert.equal(crashPoints(r.max,S70.tough,r.kind),PERSON_POINTS,'and costs the fixed 20, not wall points')}

// 2. Points (VD7a: tough x 1 x (v^2 - 16), was 1.2): 4 m/s = 0, 10 m/s = 84 (tough 1), 30 m/s = 600 cap, tough scales, whole numbers; design table values.
assert.equal(crashPoints(4,1),0);assert.equal(crashPoints(3.9,1),0);assert.equal(crashPoints(10,1),84);assert.equal(crashPoints(6,1),20);assert.equal(crashPoints(15,1),209);assert.equal(crashPoints(20,1),384);
assert.equal(crashPoints(30,1),POINT_CAP);assert.equal(POINT_CAP,600);assert.equal(crashPoints(26,1),600);assert.equal(crashPoints(10,.6),Math.round(.6*84));
assert(Number.isInteger(crashPoints(11.37,.85)));assert.equal(crashPoints(100,1.3),600,'the cap holds for the toughest');assert.equal(crashPoints(4.01,1,'person'),20);assert.equal(crashPoints(3,1,'person'),0,'a slow brush on a person costs nothing');
assert.deepEqual(Object.fromEntries(Object.entries(CLASSES).map(([k,c])=>[k,c.tough])),{worktruck:1.3,flatbed:1.7,shortbed:.58,offroad:.68},'tough per class (VD7a: damage per unit of energy; see damage.js)');
for(const c of Object.values(CLASSES))assert(c.hood&&c.hood.y>0&&c.hood.z>0&&c.hood.z<c.hz,`${c.id} has a hood point inside the nose`);
assert.equal(applyPoints(1000,461),539);assert.equal(applyPoints(100,600),0,'never below 0');assert.equal(applyPoints(1000,600),400,'one crash never wrecks a Fine vehicle');

// 3. Debounce: two slices of one crash count once (the largest); two crashes 0.6 s apart count twice.
{let st=freshCrashState();const a=registerCrash(st,10,100);assert.equal(a.points,100);const b=registerCrash(a.state,10.016,300);assert.equal(b.points,200,'a bigger second slice adds only the part above the first');const c=registerCrash(b.state,10.3,250);assert.equal(c.points,0,'a smaller one in the window adds nothing');
 const d=registerCrash(c.state,10.6,150);assert.equal(d.points,150,'0.6 s after the window opened it is a new crash');assert.equal(100+200+0+150,450);
 assert.equal(registerCrash(freshCrashState(),0,0).points,0)}

// 4. Bands at every edge, and what withDamage does.
for(const [c,id] of [[0,'wrecked'],[1,'limping'],[249,'limping'],[250,'damaged'],[649,'damaged'],[650,'worn'],[799,'worn'],[800,'fine'],[1000,'fine']])assert.equal(bandOf(c).id,id,`cond ${c} is ${id}`);
assert.deepEqual(BANDS.map(b=>b.label),['Fine','Scuffed','Damaged','Limping','Wrecked']);assert.equal(bandOf(undefined).id,'fine');assert.equal(bandOf(NaN).id,'fine');
assert.equal(withDamage(S70,1000),S70,'Fine is the class itself');
{const near=(a,b)=>Math.abs(a-b)<1e-9,w=withDamage(S70,700),d=withDamage(S70,300),l=withDamage(S70,50),x=withDamage(S70,0);
 assert(near(w.top,S70.top*.95)&&near(w.burnMul,1.05)&&w.accel===S70.accel);assert(near(d.top,S70.top*.85)&&near(d.accel,S70.accel*.85)&&near(d.burnMul,1.15)&&d.cranks===2);
 assert(near(l.top,14.5)&&near(l.accel,S70.accel*.6)&&near(l.burnMul,1.3)&&l.cranks===4,'Limping S70 tops at 14.5 m/s (32 mph)');assert.equal(x.top,0);assert.equal(x.accel,0);
 assert(w.brake<S70.brake&&d.brake<w.brake&&l.brake<d.brake,'braking gets weaker with the band');assert(w.pull>0&&d.pull>w.pull&&l.pull>d.pull&&x.pull>l.pull,'the pull to one side grows with the band');assert.equal(withDamage(S70,1000).pull,undefined);
 assert(w.rough<d.rough&&d.rough<l.rough);assert(w.smoke<=d.smoke&&d.smoke<=l.smoke);assert.equal(S70.top,29,'the class is not changed')}
assert.equal(pullSide('v1'),pullSide('v1'));assert(new Set(['v1','v2','v3','v4','v5','v6','v7','v8'].map(pullSide)).size===2,'both sides occur, fixed per uid');

// 5. Stall at 250+ (once per crash), restart after 1 s, Wrecked never starts.
{let r=registerCrash(freshCrashState(),0,STALL_POINTS-1);assert.equal(r.stall,false,'249 does not stall');r=registerCrash(freshCrashState(),0,STALL_POINTS);assert.equal(r.stall,true,'250 stalls');const again=registerCrash(r.state,.1,400);assert.equal(again.stall,false,'one stall per crash')}
{const r1=registerCrash(freshCrashState(),0,100),r2=registerCrash(r1.state,.1,300);assert.equal(r2.stall,true,'a split crash that reaches 250 stalls')}
assert.equal(stallOver(5,5.9),false);assert.equal(stallOver(5,6),true);assert.equal(stallOver(null,0),true);assert.equal(canStart(0),false);assert.equal(canStart(1),true);assert.equal(extraCranks(1000),0);assert.equal(extraCranks(300),2);assert.equal(extraCranks(100),4);

// 6. Repair: 25% of the price x the share lost, minimum $25, whole cents, and the hours (for a later job too).
assert.equal(repairCents(VEHICLE_PRICE.shortbed,1000),0);assert.equal(repairCents(VEHICLE_PRICE.shortbed,0),12500,'S70 full repair $125');assert.equal(repairCents(VEHICLE_PRICE.offroad,0),275000,'pickup $2,750');
assert.equal(repairCents(VEHICLE_PRICE.shortbed,999),2500,'a scratch is the $25 minimum');assert.equal(repairCents(VEHICLE_PRICE.shortbed,539),Math.ceil(50000*.25*461/1000));assert.equal(repairCents(VEHICLE_PRICE.worktruck,600),Math.ceil(450000*.25*.4));assert(Number.isInteger(repairCents(VEHICLE_PRICE.flatbed,333)));
assert.equal(repairHours(1000),0);assert.equal(repairHours(0),6);assert.equal(repairHours(999),.5);assert(repairHours(500)>repairHours(800)&&repairHours(800)>=.5);assert.equal(repairHours(500)*4,Math.round(repairHours(500)*4),'quarter hours');

// 7. Save: cond 0..999 is kept, junk and 1000 dropped (= Fine), an old save loads Fine, a round trip holds.
{const specs=[{model:'shortbed',fuel:{tankMgal:20000}}],playable={x0:-500,x1:500,z0:-500,z1:500},base={model:'shortbed',colour:'red',x:1,z:2,yaw:0};
 const load=cond=>normalizeVehicles([{uid:'v1',...base,...(cond===undefined?{}:{cond})}],specs,playable)[0];
 assert.equal('cond' in load(),false,'an old save with no cond loads Fine (no field)');assert.equal(bandOf(load().cond).id,'fine');
 assert.equal(load(461).cond,461);assert.equal(load(0).cond,0,'Wrecked survives');assert.equal(load(999).cond,999);
 for(const bad of [1000,1500,-3,12.5,'x',null,NaN])assert.equal('cond' in load(bad),false,`cond ${String(bad)} is dropped`);
 const ownSpec=[{id:'v1',model:'shortbed',colour:'red',fuel:{tankMgal:20000}}];
 assert.equal(vehiclesToSave(ownSpec,{v1:{x:1,z:2,yaw:0,fuelMgal:100,cond:539}})[0].cond,539);assert.equal('cond' in vehiclesToSave(ownSpec,{v1:{x:1,z:2,yaw:0,fuelMgal:100,cond:1000}})[0],false,'1000 is omitted');assert.equal('cond' in vehiclesToSave(ownSpec,{v1:{x:1,z:2,yaw:0,fuelMgal:100}})[0],false);
 const saved=vehiclesToSave(ownSpec,{v1:{x:1,z:2,yaw:0,fuelMgal:100,cond:0}});assert.equal(saved[0].cond,0);assert.deepEqual(normalizeVehicles(saved,specs,playable),saved,'round trip')}

console.log('PASS damage.mjs: impact (head-on 20, a 10 degree slide about 1.7, free 0, world/vehicle/person kinds), points (4 m/s 0, 10 m/s 84, cap 600, person 20, tough per class), the 0.5 s debounce, the five bands and withDamage (speed, accel, braking, pull, burn, cranks), stall at 250 and the 1 s restart, repair bill (25% x share lost, $25 minimum) and hours, and cond in saves (old saves Fine) passed.');
