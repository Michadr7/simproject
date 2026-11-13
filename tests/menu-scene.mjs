// The live main-menu scene: the animation rules (pure functions of time), the vehicle swap point, when it draws, and the fallback to the picture.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MENU_FPS,MENU_FPS_LOW,MENU_VEHICLE,leanSpot,breath,weightShift,headTurn,HEAD_CYCLE,planRustle,gust,windSway,cameraDrift,lightAt,hazeAt,menuPose,menuMode,frameDue,createMenuLive} from '../dist/menu-scene-rules.js';
import {propInfo} from '../dist/props.js';

// --- Animation rules: bounded, continuous, the same answer for the same time --------------------------------------------
const near=(a,b,eps,msg)=>assert(Math.abs(a-b)<=eps,`${msg}: ${a} vs ${b}`);
const flat=o=>typeof o==='number'?[o]:Object.values(o).flatMap(flat);
const rules={breath,weightShift,headTurn,planRustle,gust,windSway:t=>windSway(t,2.2),cameraDrift,lightAt,haze:t=>hazeAt(t,7),menuPose};
for(const [name,rule] of Object.entries(rules)){
 for(let t=0;t<600;t+=.37){
  const a=flat(rule(t)),b=flat(rule(t)),c=flat(rule(t+1/MENU_FPS));
  assert.deepEqual(a,b,`${name} is a pure function of time`);
  for(const v of a)assert(Number.isFinite(v),`${name}(${t}) is finite`);
  if(name!=='haze')a.forEach((v,i)=>near(v,c[i],.06,`${name} does not jump between two frames at t=${t}`)); // haze wraps round its box on purpose
 }
}
for(let t=0;t<300;t+=.11){
 const b=breath(t);assert(b>=0&&b<=1,'breath stays in 0..1');
 assert(Math.abs(weightShift(t))<=1,'weight shift stays in -1..1');
 const g=gust(t);assert(g>=0&&g<=1,'gusts stay in 0..1');
 assert(Math.abs(windSway(t,t))<=.035,'a tree never sways more than 2 degrees');
 const r=planRustle(t);assert(Math.abs(r.tilt)<=.08&&Math.abs(r.roll)<=.06,'the plans flutter, they do not flap');
 const c=cameraDrift(t);assert(Math.hypot(c.x,c.y,c.z)<.6,'the camera drifts less than 0.6 m from home');
 const l=lightAt(t);assert(l.warmth>=0&&l.warmth<=1&&l.sun>=1.8&&l.sun<=2.7,'the light stays soft');for(const v of l.sky)assert(v>=0&&v<=1,'sky colour in range');
 const d=hazeAt(t,Math.round(t)%36);assert(Math.abs(d.x)<=4&&Math.abs(d.z)<=4&&d.y>=.3&&d.y<=2.71,'dust stays in its box');
}
near(breath(0),0,1e-9,'a breath starts empty');near(breath(2.1),1,1e-9,'and is full half a cycle later');
// The head: on the plans most of the cycle, on the horizon for a few seconds, and back.
assert.equal(headTurn(2).look,0,'reading the plans');assert.equal(headTurn(12).look,1,'looking at the horizon');assert.equal(headTurn(15.5).look,0,'back on the plans');
assert.deepEqual(headTurn(3),headTurn(3+HEAD_CYCLE*4),'the head turn repeats');assert(headTurn(12).yaw>.5&&headTurn(12).pitch<headTurn(2).pitch,'the head turns and lifts to look up');
{let reading=0;for(let t=0;t<HEAD_CYCLE;t+=.1)if(headTurn(t).look<.05)reading++;assert(reading/160>.55,'more than half the time is spent reading')}
assert.notEqual(windSway(5,0),windSway(5,2),'trees do not sway in step');
assert.notDeepEqual(hazeAt(3,1),hazeAt(3,2),'dust motes are spread out');assert.notDeepEqual(hazeAt(3,1),hazeAt(9,1),'and they move');

// --- The swap point -----------------------------------------------------------------------------------------------------
assert.equal(typeof MENU_VEHICLE.prop,'string');const info=propInfo(MENU_VEHICLE.prop);assert(info.width>1&&info.height>1,'the stand-in vehicle is a real prop the game already has');
{const s=leanSpot(MENU_VEHICLE,info.width);near(Math.abs(s.x),info.width/2+MENU_VEHICLE.lean.gap,1e-9,'the character stands just outside the hull');near(s.z,MENU_VEHICLE.lean.along,1e-9,'along its side');near(s.yaw,Math.PI/2,1e-9,'with the back to it')}
{const atv={prop:'atv',yaw:Math.PI/2,lean:{side:-1,along:.2,gap:.2,angle:.1}},s=leanSpot(atv,1.6); // a different vehicle is only data: narrower, turned, leaned on from the other side
 near(s.x,.2,1e-9,'a turned vehicle turns the spot (x)');near(s.z,1,1e-9,'a turned vehicle turns the spot (z)');near(s.yaw,0,1e-9,'and the character')}
{const src=await readFile('dist/menu-scene.js','utf8');assert(!/['"]offroad['"]/.test(src),'the scene never names the vehicle: it comes from MENU_VEHICLE');assert(/vehicle=MENU_VEHICLE/.test(src)&&/createProp\(vehicle\.prop/.test(src),'and builds whatever the swap point says')}

// --- When it draws --------------------------------------------------------------------------------------------------------
const on={menuVisible:true,pageHidden:false,reducedMotion:false,ready:true,failed:false};
assert.equal(menuMode(on),'live');assert.equal(menuMode({...on,menuVisible:false}),'paused','menu covered or closed');assert.equal(menuMode({...on,pageHidden:true}),'paused','tab in the background');
assert.equal(menuMode({...on,reducedMotion:true}),'static','reduced motion keeps the picture');assert.equal(menuMode({...on,ready:false}),'static','assets not loaded');assert.equal(menuMode({...on,failed:true}),'static','no WebGL / build failed');
assert(MENU_FPS<=30&&MENU_FPS_LOW<MENU_FPS,'the cap is low');assert(!frameDue(1010,1000,MENU_FPS),'10 ms later is too soon');assert(frameDue(1042,1000,MENU_FPS),'42 ms later a frame is due');

function rig(over={}){
 const log=[],state={visible:true,hidden:false,reduced:false,ready:true,fps:MENU_FPS,throwOn:null};
 const scene={update(t,dt){if(state.throwOn==='update')throw new Error('lost context');log.push(['update',+t.toFixed(3),+dt.toFixed(3)])},render(){log.push(['render'])},setAppearance(a){log.push(['appearance',a.name])},dispose(){log.push(['dispose'])}};
 const live=createMenuLive({build(){log.push(['build']);if(state.throwOn==='build')throw new Error('no WebGL');return scene},ready:()=>state.ready,menuVisible:()=>state.visible,pageHidden:()=>state.hidden,reducedMotion:()=>state.reduced,setLive:v=>log.push(['live',v]),fps:()=>state.fps,...over});
 return {live,log,state,count:k=>log.filter(e=>e[0]===k).length};
}
// A 165 Hz screen for 2 seconds draws about 24 frames a second, not 165.
{const r=rig();for(let now=0;now<2000;now+=1000/165)r.live.tick(now);
 assert.equal(r.count('build'),1,'built once, on the first frame');assert(r.count('render')>=40&&r.count('render')<=50,`about 48 frames in 2 s at the cap, got ${r.count('render')}`);
 assert.deepEqual(r.log.filter(e=>e[0]==='live'),[['live',true]],'the picture is swapped for the canvas once');assert(r.live.live&&r.live.built);
 const before=r.count('render');r.state.fps=MENU_FPS_LOW;for(let now=2000;now<3000;now+=1000/165)r.live.tick(now);assert(r.count('render')-before<=16,'low quality draws fewer');
 // hidden menu and background tab: nothing is drawn, the scene is kept
 const n=r.count('render');r.state.visible=false;for(let now=3000;now<4000;now+=16)assert.equal(r.live.tick(now),'paused');r.state.visible=true;r.state.hidden=true;assert.equal(r.live.tick(4100),'paused');assert.equal(r.count('render'),n,'paused: no frames');
 r.state.hidden=false;assert.equal(r.live.tick(4200),'live');const u=r.log.filter(e=>e[0]==='update').at(-1);assert(u[2]<=.1,'after a pause the step is clamped to 0.1 s');
 // Edit character: the scene's character changes without a rebuild
 r.live.setAppearance({name:'Robin'});assert.deepEqual(r.log.at(-1),['appearance','Robin']);assert.equal(r.count('build'),1);
 // the game starts: disposed once, back to the picture, and it stays off
 r.live.dispose();r.live.dispose();assert.equal(r.count('dispose'),1);assert.deepEqual(r.log.at(-1),['live',false]);assert.equal(r.live.tick(9000),'off');assert.equal(r.count('build'),1,'never rebuilt');assert(!r.live.built&&r.live.disposed)}
// Fallbacks: each leaves the picture in place and never throws.
{const r=rig();r.state.ready=false;assert.equal(r.live.tick(0),'static');assert.equal(r.count('build'),0,'assets not loaded: nothing is built');r.state.ready=true;assert.equal(r.live.tick(50),'live','and it starts once they are')}
{const r=rig();r.state.reduced=true;for(let now=0;now<500;now+=16)assert.equal(r.live.tick(now),'static');assert.equal(r.count('build'),0,'reduced motion: nothing is built');assert(!r.live.live)}
{const r=rig();r.state.throwOn='build';assert.equal(r.live.tick(0),'static');assert.equal(r.live.tick(100),'static');assert.equal(r.count('build'),1,'a failed build is not retried');assert(r.live.failed&&!r.live.live);assert(!r.log.some(e=>e[0]==='live'&&e[1]===true),'the canvas was never shown')}
{const r=rig();r.live.tick(0);r.state.throwOn='update';assert.equal(r.live.tick(100),'static');assert.equal(r.count('dispose'),1,'a scene that breaks is freed');assert.deepEqual(r.log.at(-1),['dispose']);assert(r.log.some(e=>e[0]==='live'&&e[1]===false),'and the picture comes back')}
{const r=rig({setLive(){throw new Error('no classList')}});assert.equal(r.live.tick(0),'live','a broken page hook does not stop the scene')}

// --- The page: the picture is still there as the fallback, and the live class only removes it ------------------------------
{const html=await readFile('dist/index.html','utf8'),css=await readFile('dist/style.css','utf8');
 assert(/id="welcome"[^>]*menu-background\.jpg/.test(html),'the menu keeps its picture');assert(/\.main-menu\.live\{[^}]*linear-gradient/.test(css),'live: the dark side behind the buttons stays');
 for(const id of ['start','menuMultiplayer','menuAccount','menuSettings','menuCredits','customizeSaved'])assert(html.includes(`id="${id}"`),`${id} is still on the menu`)}

// --- The real scene in the packaged game (renderer stub): it draws behind the menu, then goes when Play is pressed --------
{const {bootGame}=await import('./support/boot-game.mjs');const g=await bootGame({play:false});
 const world=g.scene();g.pump(1);const menu=g.menuScene(),welcome=g.ids.get('welcome');assert.equal(g.scene(),world,'the world is not redrawn behind the menu');
 if(!menu){console.log('menu-scene: the packaged game kept the picture in Node (character assets not ready or the build failed); the live path was not exercised here');assert(!welcome.classList.contains('live'))}
 else{
  assert(welcome.classList.contains('live'),'the menu shows the canvas');
  const names=[];menu.traverse(o=>names.push(o.name));assert(names.includes('prop-'+MENU_VEHICLE.prop),'the vehicle from the swap point is in the scene');assert(names.includes('props-log'),'and the logs');
  g.ids.get('start').click();globalThis.__menuScene=null;g.pump(.2);assert.equal(g.menuScene(),null,'Play: the menu scene is not drawn again');assert(!welcome.classList.contains('live'),'and the menu scene is gone');assert.equal(menu.children.length,0,'disposed');
 }
 await g.done()}
console.log('menu-scene ok');
