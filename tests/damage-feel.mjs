// VD7a: stronger crash feedback. The numbers are pure (damage.js); the hit-stop is a skipped slice of the VEHICLE step (never a paused loop); the debris is one pooled Points object; the panel pulses by class on
// a crash only; the lamp names the band by shape and blinking; the flash is one CSS element. Real GPU cost cannot be measured here: the particle and DOM counts are asserted instead.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from '../dist/vendor/three.module.js';
import {createDriving} from '../dist/driving.js';
import {substeps} from '../dist/timestep.js';
import {SURFACE} from '../dist/terrain.js';
import {defaultColour} from '../dist/paint.js';
import {hitStopOf,stopSlice,flashOf,lampOf,debrisOf,shakeAmplitude,POINT_CAP,HITSTOP_MIN,HITSTOP_MAX,HITSTOP_MIN_POINTS,DEBRIS_MAX_PER_HIT,SHAKE_MIN,SHAKE_MAX,SHAKE_SECONDS,BANDS} from '../dist/damage.js';
import {createDebris,stepDebris,DEBRIS_MAX} from '../dist/debris.js';
import {createSmoke,SMOKE_MAX} from '../dist/smoke.js';
import {createVehicleHud,vehicleHudModel,damageRow} from '../dist/vehicle-hud.js';

// 1. Hit-stop numbers: nothing for small crashes, 50 to 90 ms for hard ones.
assert.equal(hitStopOf(0),0);assert.equal(hitStopOf(HITSTOP_MIN_POINTS-1),0,'a small crash does not freeze');assert(hitStopOf(HITSTOP_MIN_POINTS)>=HITSTOP_MIN,'the smallest freeze is at least 50 ms');
assert(hitStopOf(60)>=.05&&hitStopOf(600)<=.09&&hitStopOf(300)>hitStopOf(60)&&hitStopOf(9999)===HITSTOP_MAX,'about 60 ms, 50 to 90 ms across the range');assert.equal(hitStopOf(NaN),0);

// 2. The freeze is frame-rate independent: it eats the owed seconds from the start of whichever slices come, whatever their size, and the vehicle steps the rest.
for(const hz of [20,30,60,144,240]){const step=1/hz;let left=.06,vehicleTime=0,total=0;for(let i=0;i<hz;i++){const s=stopSlice(left,step);left=s.left;vehicleTime+=s.dt;total+=step;assert(s.dt>=0&&s.dt<=step+1e-12)}
 assert(Math.abs((total-vehicleTime)-.06)<1e-9,hz+' Hz: exactly 60 ms of vehicle time skipped, got '+(total-vehicleTime));assert.equal(left,0)}
assert.deepEqual(stopSlice(0,1/60),{left:0,dt:1/60},'no freeze owed: the slice is untouched');assert.equal(stopSlice(NaN,1/60).dt,1/60);

// 3. The real vehicle: coasting at speed with a hit-stop at t = 0.5 s covers the same distance at 30, 60 and 144 slices a second, and about speed x 60 ms less than with no stop. The clock keeps running (only the vehicle step is skipped).
const col=defaultColour('shortbed'),world=()=>({scene:new THREE.Scene(),surface:()=>SURFACE.ROAD,footing:()=>0,baseBlocked:()=>false});
function coast(fps,stop){const d=createDriving({...world(),saved:[{uid:'v1',model:'shortbed',colour:col,x:0,z:0,yaw:0}]}),f=d.byId.get('v1');d.setFuel('v1',1e9);d.enter('v1');f.state.speed=20;let owed=0,t=0,sim=0;const dtReal=1/fps;
 while(t<2-1e-9){if(stop&&t>=.5-1e-9&&!owed&&!coast.done){owed=stop;coast.done=true}t+=dtReal;const {count,step}=substeps(dtReal);for(let i=0;i<count;i++){const s=stopSlice(owed,step);owed=s.left;if(s.dt>0)d.step(s.dt,{throttle:0},[]);sim+=step}}
 coast.done=false;return {z:f.state.z,sim};}
{const base=coast(60,0),runs=[30,60,144].map(h=>coast(h,.06));for(const r of runs){assert(Math.abs(r.sim-2)<.02,'the world clock advanced the full 2 s: '+r.sim);assert(Math.abs(r.z-runs[1].z)<.35,'same distance at every frame rate: '+runs.map(x=>x.z.toFixed(2)))}
 const lost=base.z-runs[1].z;assert(lost>.9&&lost<1.4,'about 20 m/s x 60 ms = 1.2 m less (vehicle time skipped): '+lost.toFixed(2))}

// 4. Flash, lamp, debris numbers.
assert.equal(flashOf(0),0);assert(flashOf(1)>=.2&&flashOf(350)===1&&flashOf(9999)===1&&flashOf(100)>flashOf(30)&&flashOf(100)<flashOf(300),'the flash grows with the hit and tops out at 1');
assert.deepEqual([1000,800,799,650,649,250,249,1,0].map(lampOf),['off','off','off','off','on','on','blink','blink','blink'],'lamp: off at Fine and Worn, steady at Damaged, blinking at Limping and Wrecked');
assert.deepEqual(debrisOf(0),{chips:0,sparks:0,glass:0});assert.deepEqual(debrisOf(10),{chips:Math.round(5+22*10/600),sparks:0,glass:0},'a scrape: chips only');assert(debrisOf(50).sparks>0&&debrisOf(50).glass===0,'sparks from 30 points');assert(debrisOf(100).glass>0,'glass from 90 points');
for(const p of [1,30,90,200,400,600,5000]){const d=debrisOf(p),n=d.chips+d.sparks+d.glass;assert(n<=DEBRIS_MAX_PER_HIT+2&&n<=DEBRIS_MAX&&Number.isInteger(n),'bounded per hit at '+p+': '+n)}
assert(debrisOf(500).chips+debrisOf(500).sparks+debrisOf(500).glass>debrisOf(40).chips+debrisOf(40).sparks+debrisOf(40).glass,'more pieces for a harder hit');
// shake: raised, still comfortable (under 0.2 m), 0.4 s
assert.equal(SHAKE_SECONDS,.4);assert.equal(shakeAmplitude(1),+(SHAKE_MIN+(SHAKE_MAX-SHAKE_MIN)/POINT_CAP).toFixed(3));assert.equal(shakeAmplitude(POINT_CAP),SHAKE_MAX);assert(SHAKE_MAX<=.2&&SHAKE_MIN>=.02);

// 5. The debris pool: 150 points, ONE Points object, a colour per point, bounded however many crashes, hidden when empty, gone after its life, never below the ground.
{assert.equal(DEBRIS_MAX,150);const scene=new THREE.Scene(),db=createDebris(scene,{random:(()=>{let s=7;return()=>(s=(s*16807)%2147483647)/2147483647})()});
 assert.equal(scene.children.filter(c=>c.isPoints).length,1,'one draw call');assert.equal(db.points.visible,false,'nothing drawn while empty');assert.equal(db.points.geometry.getAttribute('color').count,150);assert.equal(db.particles.max,150);
 const n=db.burst({x:5,y:1,z:5},{dx:0,dz:1},400,0);assert(n>20&&n<=DEBRIS_MAX_PER_HIT+2,'a hard crash throws '+n);assert.equal(db.update(0),n,'all alive at once');assert.equal(db.points.visible,true);
 for(let i=0;i<30;i++)db.update(1/60);for(const i of [...Array(150).keys()])if(db.particles.life[i]>0)assert(db.particles.pos[i*3+1]>=0,'above the ground');
 for(let i=0;i<40;i++){db.burst({x:5,y:1,z:5},{dx:1,dz:0},600,0);db.update(1/60)}assert(db.particles.alive<=150&&db.update(0)<=150,'bounded at 150 under a crash a frame');
 for(let i=0;i<200;i++)db.update(1/60);assert.equal(db.update(0),0,'everything is gone after its life (sparks .45 s, chips about 1 s, glass about 1.3 s)');assert.equal(db.points.visible,false);
 // frame-rate independence: the same life in seconds at 30 and 144
 for(const hz of [30,144]){const d2=createDebris(new THREE.Scene(),{random:()=>.5});d2.burst({x:0,y:1,z:0},{dx:0,dz:1},100,0);let t=0;while(d2.update(1/hz)>0&&t<10)t+=1/hz;assert(t>1&&t<2.2,hz+' Hz: life '+t.toFixed(2)+' s')}}

// 6. The smoke: still ONE Points object of 150, now with a size and a fade per puff (damage tiers bigger and longer), and it drifts.
{const scene=new THREE.Scene(),s=createSmoke(scene,{random:()=>.5}),tip={x:0,y:1,z:0,dx:0,dz:0};assert.equal(SMOKE_MAX,150);assert.equal(scene.children.filter(c=>c.isPoints).length,1);
 const size=s.points.geometry.getAttribute('aSize'),fade=s.points.geometry.getAttribute('aFade');assert.equal(size.count,150);assert.equal(fade.count,150);
 s.burst(tip,1,0);s.burst(tip,1,2);s.update(.3);assert(size.array[1]>size.array[0]*1.4,'a damage puff is bigger than an exhaust puff: '+size.array[1]+' vs '+size.array[0]);assert(fade.array[0]>0&&fade.array[0]<=1);
 const x0=s.particles.pos[3*1];for(let i=0;i<60;i++)s.update(1/60);assert(s.particles.pos[3]>x0+.05,'the plume drifts sideways as well as up');
 const life=(tier)=>{const q=createSmoke(new THREE.Scene(),{random:()=>.5});q.burst(tip,1,tier);return q.particles.life[0]};assert(life(1)>life(0)*1.5,'a damage puff lives longer')}

// 7. The panel: the lamp follows the band (written only when it changes); pulse() adds a class once per crash and takes it off when the animation ends; the text is never rewritten by a pulse.
{const mk=tag=>{const el={tag,hidden:true,textContent:'',children:[],writes:{},cls:new Set(),listeners:{},offsetWidth:0,append(...c){this.children.push(...c)},replaceChildren(){this.children=[]},addEventListener(n,f){this.listeners[n]=f}};el.classList={add:c=>el.cls.add(c),remove:c=>el.cls.delete(c)};el.dataset=new Proxy({},{set(o,k,v){el.writes[k]=(el.writes[k]||0)+1;o[k]=v;return true}});return el};
 const els=Object.fromEntries(['vehiclePanel','vpName','vpSpeed','vpFuel','vpKeys','vpNote','vpDamage','vpDmgText','vpLamp'].map(i=>[i,mk(i)]));globalThis.document={createElement:mk};
 const hud=createVehicleHud(id=>els[id]||null),base={driving:{},seat:'driver',name:'Kasumuchi S70',speed:0},show=cond=>hud(vehicleHudModel({...base,damage:{model:'shortbed',cond,engine:'run'}}));
 assert.equal(damageRow({model:'shortbed',cond:300}).lamp,'on');assert.equal(damageRow({model:'shortbed',cond:100}).lamp,'blink');assert.equal(damageRow({model:'shortbed',cond:900}).lamp,'off');
 show(1000);assert.equal(els.vpLamp.dataset.lamp,'off');const lw=()=>els.vpLamp.writes.lamp;assert.equal(lw(),1);show(990);show(980);assert.equal(lw(),1,'the lamp is not touched while it stays off');
 show(500);assert.equal(els.vpLamp.dataset.lamp,'on');show(400);assert.equal(lw(),2);show(100);assert.equal(els.vpLamp.dataset.lamp,'blink');show(0);assert.equal(lw(),3,'Limping and Wrecked share the blink');
 const textBefore=els.vpDmgText.textContent;hud.pulse();assert(els.vpDamage.cls.has('hit'),'a crash pulses the row');assert.equal(els.vpDmgText.textContent,textBefore,'the pulse writes no text');els.vpDamage.listeners.animationend();assert(!els.vpDamage.cls.has('hit'),'the class comes off when the animation ends');
 hud.pulse();hud.pulse();assert(els.vpDamage.cls.has('hit'));els.vpDamage.listeners.animationend();hud(vehicleHudModel({}));hud.pulse();assert(!els.vpDamage.cls.has('hit'),'no pulse while the row is hidden (on foot)');
 const key=JSON.stringify(vehicleHudModel({...base,damage:{model:'shortbed',cond:0,engine:'run'}}));assert(key.includes('"lamp":"blink"'),'the lamp is part of the model, so nothing is written per frame')}

// 8. The page and the hooks: one flash element, the lamp icon, the animations, reduced motion respected, the hit-stop only on the vehicle step.
{const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../dist/style.css',import.meta.url),'utf8'),game=fs.readFileSync(new URL('../dist/game.js',import.meta.url),'utf8');
 assert.equal(html.split('id="hitFlash"').length,2,'one flash element');assert(html.includes('id="vpLamp"')&&/id="vpLamp"[^>]*>\s*<svg/.test(html),'the lamp is an icon, not just a colour');
 for(const k of ['@keyframes hit-flash','@keyframes lamp-blink','@keyframes vp-hit','#hitFlash.on','.vp-damage.hit','.vp-lamp[data-lamp=on]','.vp-lamp[data-lamp=blink]'])assert(css.includes(k),'css has '+k);
 assert(/prefers-reduced-motion:reduce\)\{\.vp-lamp\[data-lamp=blink\]\{animation:none;outline/.test(css),'reduced motion: the lamp stops blinking and gets an outline');assert(/pointer-events:none/.test(css.slice(css.indexOf('#hitFlash{'),css.indexOf('#hitFlash{')+200)),'the flash never takes clicks');
 assert(game.includes('stopSlice(hitStop,step)')&&game.includes('if(hs.dt>0)driving.step(hs.dt'),'the freeze skips only the vehicle step');assert(!/hitStop[^;]*(setTimeout|requestAnimationFrame)/.test(game),'no timers or loop pauses');
 assert(game.includes("matchMedia('(prefers-reduced-motion: reduce)')")&&game.includes('if(!q)hitStop='),'reduced motion: no freeze, no shake (calm())');assert(game.includes('debris.update(view,!inside)')&&game.includes('debris.burst(e.at,e.dir,e.points)'))}
console.log('PASS damage-feel.mjs: hit-stop of 50 to 90 ms from 60 points, exactly the same skipped vehicle time at 20 to 240 slices a second and the same distance covered over a stop at 30, 60 and 144 Hz (the clock never pauses), red flash strength, a lamp that is off, steady or blinking by band (icon + blink, class and dataset written on change only), a panel pulse that is a class on a crash and nothing else, a stronger shake (0.03 to 0.18 m for 0.4 s), one 150-point debris pool (chips, sparks, glass) that is bounded and clears, bigger drifting smoke in one pool, and every page and game hook.');
