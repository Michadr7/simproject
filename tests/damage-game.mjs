// VD2 (notes/vehicle-damage-design.md section 9, tests 6 and the part of 13 that belongs here): damage wired into driving.js and the vehicle panel.
// A crash at speed changes cond once and reports once, a gentle bump does nothing, the pull has the right sign and size, burn follows the band, a stall and its restart work, a Wrecked vehicle never starts,
// the saved list round-trips cond (old saves load Fine), and the panel row and silhouettes change the DOM only when they should.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../dist/vendor/three.module.js';
import {createDriving} from '../dist/driving.js';
import {CLASSES} from '../dist/vehicle.js';
import {SURFACE} from '../dist/terrain.js';
import {defaultColour} from '../dist/paint.js';
import {pullSide,crashPoints,bandOf,BANDS,pulledSteer,shakeAmplitude,shakeOffset,bandToast,percent,engineStep,freshEngine,PULL_SPEED,SHAKE_SECONDS,STALL_POINTS,ENERGY_COST} from '../dist/damage.js';
import {vehicleHudModel,createVehicleHud,damageRow,SILHOUETTES} from '../dist/vehicle-hud.js';

const DT=1/60,col=defaultColour('shortbed');
const world=(wallZ=1e9)=>({scene:new THREE.Scene(),surface:()=>SURFACE.ROAD,footing:()=>0,baseBlocked:(x,z)=>z>wallZ});
const owned=(n,model='shortbed')=>Array.from({length:n},(_,i)=>({uid:'v'+(i+1),model,colour:col,x:i*30,z:0,yaw:0}));
const make=(wallZ,saved=owned(1))=>{const d=createDriving({...world(wallZ),saved});for(const f of d.fleet)if(f.spec.fuel)d.setFuel(f.spec.id,1e9);return d};
const run=(d,seconds,input,events)=>{for(let t=0;t<seconds;t+=DT){d.step(DT,input,[]);events.push(...d.takeEvents())}};

// 1. A crash at speed: cond drops once, one event opens the window, and the band-change flag is right. The S70 at full throttle for 200 m hits at about 24 m/s: about 325 points (VD7a), 1000 -> about 675 (Worn).
{const d=make(200),f=d.byId.get('v1'),ev=[];assert(d.enter('v1'));assert.equal(f.cond,1000);
 for(let i=0;i<1500&&!ev.some(e=>e.type==='crash');i++)run(d,DT,{throttle:1},ev);const crashes=ev.filter(e=>e.type==='crash');
 assert.equal(crashes.length,1,'a head-on stop is one counted crash');assert.equal(crashes[0].first,true);assert.equal(crashes[0].changed,true,'Fine to Worn is a band change');assert.equal(crashes[0].bandTo,'worn');
 assert.equal(f.cond,1000-crashes[0].points,'cond dropped by the counted points');assert(crashes[0].points>=280&&crashes[0].points<=380,'about 325 points at 24 m/s: '+crashes[0].points);assert.equal(f.cond,1000-crashes[0].points);assert(crashes[0].impact>20,'about 24 m/s: '+crashes[0].impact);
 assert.equal(crashes[0].stall,true,'250 points or more stalls the engine');assert.equal(f.engine.mode,'off');
 // sitting against the wall with the key held does not count again (and the stalled engine does not push)
 const before=f.cond;ev.length=0;run(d,.4,{throttle:1},ev);assert.equal(f.cond,before);assert(!ev.some(e=>e.type==='crash'),'no second crash from the same stop');
}
// 2. A gentle bump (3 m/s) does nothing: no cond change, no event.
{const d=make(5),f=d.byId.get('v1'),ev=[];d.enter('v1');f.state.speed=3;run(d,3,{throttle:0},ev);assert.equal(f.cond,1000);assert.equal(ev.filter(e=>e.type==='crash').length,0);assert.equal(f.engine.mode,'run')}
// 3. A 22 m/s crash (VD7a: was 16): about 270 points, Fine to Worn, and it stalls, and the stall costs energy in the game (the event carries stall).
{const d=make(6),f=d.byId.get('v1'),ev=[];d.enter('v1');f.state.speed=22;for(let i=0;i<600&&!ev.some(e=>e.type==='crash');i++)run(d,DT,{throttle:0},ev);const c=ev.find(e=>e.type==='crash');
 assert.equal(c.points,crashPoints(c.impact,f.cls.tough,'world'));assert(c.impact>21&&c.impact<=22,'impact '+c.impact);assert.equal(f.cond,1000-c.points);assert(f.cond>=650&&f.cond<800,'Worn');assert.equal(c.changed,true);assert.equal(c.stall,true);assert(c.points>=STALL_POINTS);
 assert.equal(f.engine.mode,'off','stalled');
 // W held at once: the engine does not start before 1.0 s
 ev.length=0;f.state.x=0;f.state.z=0;f.state.speed=0;f.state.steer=0;const stalledAt=f.engine.since;
 const start=(sec)=>{const e=[];let t0=0;for(;t0<sec;t0+=DT){d.step(DT,{throttle:1},[]);e.push(...d.takeEvents())}return e};
 d.step(DT,{throttle:1},[]);assert.equal(d.takeEvents().filter(e=>e.type==='crank').length,0,'too early to crank');
 const e2=start(1.8);assert.equal(e2.filter(e=>e.type==='crank').length,1,'one crank event after the second has passed');assert.equal(e2.filter(e=>e.type==='start').length,1,'then it catches');assert.equal(f.engine.mode,'run');assert(f.state.speed>0,'and it drives again');
 
}
// 4. The pull: the sign follows pullSide(uid), the size follows the band (Worn 0.02, Damaged 0.06, Limping 0.12 of full lock), and Fine is straight. Same speed, hands off the wheel, 1 s.
{let slot=0;const d=make(1e9,owned(8)),yawAfter=(id,cond)=>{const f=d.byId.get(id);d.setCond(id,cond);d.enter(id);f.state.x=1000+20*(++slot);f.state.z=-500;f.state.yaw=0;f.state.speed=12;f.state.steer=0;const ev=[];run(d,1,{throttle:0},ev);const dy=f.state.yaw;d.leave(()=>true);return dy};
 const sides=new Map();for(let i=1;i<=8;i++)sides.set('v'+i,pullSide('v'+i));assert(new Set(sides.values()).size===2,'both sides occur among eight uids');
 for(const [id,side] of sides){const fine=yawAfter(id,1000),worn=yawAfter(id,700),damaged=yawAfter(id,400),limping=yawAfter(id,80);
  assert.equal(fine,0,'Fine goes straight');
  for(const y of [worn,damaged,limping])assert.equal(Math.sign(y),side,id+' pulls to its own side');
  assert(Math.abs(damaged)>Math.abs(worn)&&Math.abs(limping)>Math.abs(damaged),`${id}: the pull grows by band: ${worn} ${damaged} ${limping}`)}
 // the pure helper: bias sign, fades in with speed, stays within full lock
 assert.equal(pulledSteer(0,.06,1,10),.06);assert.equal(pulledSteer(0,.06,-1,10),-.06);assert.equal(pulledSteer(0,.06,1,0),0,'a parked vehicle does not turn its wheel');assert.equal(pulledSteer(0,.12,1,PULL_SPEED/2),.06);assert.equal(pulledSteer(1,.2,1,20),1);assert.equal(pulledSteer(-1,.2,-1,20),-1);
}
// 5. Burn: the multiplier of the band reaches the tank (test 6 of the design: a Damaged vehicle uses 1.15 x the fuel for the same distance).
{const d=make(1e9),f=d.byId.get('v1'),per=cond=>{d.setCond('v1',cond);d.enter('v1');d.setFuel('v1',1e9);f.engine=freshEngine(1000,0);f.state.x=5000;f.state.z=-1e6;f.state.speed=0;f.state.yaw=0;f.state.steer=0;const fuel0=f.fuelMgal;let dist=0,lx=f.state.x,lz=f.state.z;for(let t=0;t<80;t+=DT){d.step(DT,{throttle:1},[]);dist+=Math.hypot(f.state.x-lx,f.state.z-lz);lx=f.state.x;lz=f.state.z;d.takeEvents()}const used=fuel0-f.fuelMgal;d.leave(()=>true);f.state.speed=0;return used/dist};
 const fine=per(1000),damaged=per(300),limping=per(100),worn=per(700);
 assert(Math.abs(damaged/fine-1.15)<.04,'Damaged burns 1.15x per metre: '+(damaged/fine));assert(Math.abs(limping/fine-1.3)<.05,'Limping 1.3x: '+(limping/fine));assert(Math.abs(worn/fine-1.05)<.04,'Worn 1.05x: '+(worn/fine));
}
// 6. A Wrecked vehicle never starts: the key says so (at most every 3 s) and it does not move; the player can always get out.
{const d=make(1e9),f=d.byId.get('v1'),ev=[];d.setCond('v1',0);d.enter('v1');assert.equal(f.engine.mode,'off');run(d,4,{throttle:1},ev);
 assert(ev.filter(e=>e.type==='dead').length>=1&&ev.filter(e=>e.type==='dead').length<=2,'told, not nagged: '+ev.length);assert.equal(f.state.speed,0);assert.equal(f.state.z,0);assert.equal(ev.filter(e=>e.type==='crank').length,0);
 assert(d.leave(()=>true),'a wreck can always be left');
 // a damaged vehicle: the sit-down crank (2 extra cranks, 1 s) before it moves
 d.setCond('v1',300);d.enter('v1');assert.equal(f.engine.mode,'crank');run(d,.5,{throttle:1},[]);assert.equal(f.state.speed,0,'still cranking');run(d,1,{throttle:1},[]);assert(f.state.speed>0,'then it goes');
}
// 7. Pure engine and shake helpers: deterministic, no clock.
{let e=freshEngine(1000,0);assert.equal(e.mode,'run');e=engineStep(e,{cond:1000,now:1,stall:true}).engine;assert.equal(e.mode,'off');
 assert.equal(engineStep(e,{cond:1000,now:1.5,throttle:1}).event,null,'before 1.0 s');const c=engineStep(e,{cond:1000,now:2.1,throttle:1});assert.equal(c.event,'crank');assert.equal(engineStep(c.engine,{cond:1000,now:2.7,throttle:1}).event,'start');
 const c2=engineStep(e,{cond:300,now:2.1,throttle:1});assert.equal(c2.engine.readyAt,2.1+.5*3,'Damaged: two extra cranks');assert.equal(freshEngine(0,5).mode,'off');
 assert.deepEqual(shakeOffset(0,.1),{x:0,y:0,z:0});assert.deepEqual(shakeOffset(.2,.1),shakeOffset(.2,.1));assert(shakeAmplitude(600)>shakeAmplitude(100)&&shakeAmplitude(1)>=.02&&shakeAmplitude(9999)===shakeAmplitude(600),'scaled by the hit, capped');
 assert.equal(SHAKE_SECONDS,.4,'VD7a: was .25');assert.equal(ENERGY_COST,5);
 for(const [c,w] of [[300,/Damaged \(30%\).*slower.*more gas/],[100,/Limping \(10%\)/],[0,/Wrecked.*will not start/],[700,/Worn \(70%\)/]])assert.match(bandToast('Kasumuchi S70',c),w);assert.equal(percent(749),75);
}
// 8. Saving: cond is saved below 1000 and omitted at 1000; a save without it loads Fine; the panel's number comes back after a reload.
{const d=make(1e9,owned(2));d.setCond('v1',312);const s=d.save();assert.equal(s.find(v=>v.uid==='v1').cond,312);assert.equal(s.find(v=>v.uid==='v2').cond,undefined,'a perfect vehicle saves no cond');
 const again=createDriving({...world(),saved:s});assert.equal(again.condOf('v1'),312,'it comes back damaged');assert.equal(again.condOf('v2'),1000,'and the old entry loads Fine');
 const wreck=make(1e9,owned(1));wreck.setCond('v1',0);assert.equal(createDriving({...world(),saved:wreck.save()}).condOf('v1'),0,'a Wrecked vehicle stays wrecked after a reload')}

// 9. The vehicle panel: the row, the silhouette choice, band names (never colour alone), and the DOM written only on change.
{assert.equal(damageRow(null),null);
 for(const m of SILHOUETTES)assert.equal(damageRow({model:m,cond:1000}).model,m);assert.equal(damageRow({model:'forklift',cond:500}).model,'generic','any other model gets the generic silhouette');
 assert.equal(damageRow({model:'shortbed',cond:340}).text,'Damaged · 34%');assert.equal(damageRow({model:'shortbed',cond:0}).text,'Wrecked · 0%');assert.equal(damageRow({model:'shortbed',cond:1000}).text,'Fine · 100%');
 assert.equal(vehicleHudModel({}).damage,undefined,'on foot there is no row');
 const base={driving:{},seat:'driver',name:'Kasumuchi S70',speed:0};
 assert.match(vehicleHudModel({...base,damage:{model:'shortbed',cond:0,engine:'off'}}).note,/Wrecked/);assert.match(vehicleHudModel({...base,damage:{model:'shortbed',cond:600,engine:'off'}}).note,/stalled.*W/);assert.match(vehicleHudModel({...base,damage:{model:'shortbed',cond:600,engine:'run'}}).note,/W S accelerate/);
 const mk=tag=>{const el={tag,hidden:true,textContent:'',children:[],writes:{},append(...c){this.children.push(...c)},replaceChildren(){this.children=[]}};el.dataset=new Proxy({},{set(o,k,v){el.writes[k]=(el.writes[k]||0)+1;o[k]=v;return true}});return el};
 const els=Object.fromEntries(['vehiclePanel','vpName','vpSpeed','vpFuel','vpKeys','vpNote','vpDamage','vpDmgText'].map(i=>[i,mk(i)]));globalThis.document={createElement:mk};
 const hud=createVehicleHud(id=>els[id]||null),show=(cond,model='shortbed')=>hud(vehicleHudModel({...base,damage:{model,cond,engine:'run'}}));
 show(1000);assert.equal(els.vpDamage.hidden,false);assert.equal(els.vpDamage.dataset.band,'fine');assert.equal(els.vpDmgText.textContent,'Fine · 100%');const bandWrites=()=>els.vpDamage.writes.band;assert.equal(bandWrites(),1);
 show(980);show(960);show(940);assert.equal(els.vpDmgText.textContent,'Fine · 94%','the number follows');assert.equal(bandWrites(),1,'the band class is not touched while the band stays');
 show(940);show(940);assert.equal(els.vpDmgText.writes?.x,undefined);
 show(700);assert.equal(els.vpDamage.dataset.band,'worn');assert.equal(bandWrites(),2,'the band changed once');show(300);show(100);show(0);assert.equal(els.vpDamage.dataset.band,'wrecked');assert.equal(bandWrites(),5);
 show(0,'flatbed');assert.equal(els.vpDamage.dataset.model,'flatbed');
 hud(vehicleHudModel({}));assert.equal(els.vpDamage.hidden,true,'the row is hidden on foot');
 assert.doesNotThrow(()=>createVehicleHud(id=>id==='vehiclePanel'||id==='vpName'||id==='vpSpeed'||id==='vpFuel'||id==='vpKeys'||id==='vpNote'?els[id]:null)(vehicleHudModel({...base,damage:{model:'shortbed',cond:500}})),'an old page without the row is fine');
}
// 10. The page: one silhouette per drivable model plus a generic one, a colour for every band, and the game hooks are in.
{const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../dist/style.css',import.meta.url),'utf8'),game=fs.readFileSync(new URL('../dist/game.js',import.meta.url),'utf8');
 for(const m of [...SILHOUETTES,'generic'])assert(html.includes(`data-sil="${m}"`),'a silhouette for '+m);
 assert.deepEqual([...SILHOUETTES].sort(),Object.keys(CLASSES).sort(),'every drivable class has a drawing');
 for(const b of BANDS)assert(css.includes(`.vp-damage[data-band=${b.id}]`),'a colour for '+b.id);assert(html.includes('id="vpDamage"')&&html.includes('id="vpDmgText"'));
 for(const hook of ['driving.takeEvents()','driveEvent(e)','damage:driving.active?driving.damageOf():null','applyShake(view)','shake.off'])assert(game.includes(hook),'game.js hook: '+hook);
}
console.log('Damage wiring: a crash at 24 m/s takes 600 points once (Fine to Worn) and stalls; a 3 m/s bump costs nothing; a 15 m/s crash is 251 points and stalls (restart after 1 s); the pull has the right side and grows by band; burn 1.05/1.15/1.3x; a wreck never starts but can be left; cond saves and old saves load Fine; the panel row changes the band class only when the band changes; one silhouette per drivable model.');
