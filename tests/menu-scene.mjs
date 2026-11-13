// The live main-menu scene: the animation rules (pure functions of time), the vehicle swap point, when it draws, and the fallback to the picture.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MENU_FPS,MENU_FPS_LOW,MENU_VEHICLE,leanSpot,breath,weightShift,headTurn,HEAD_CYCLE,planRustle,gust,windSway,cameraDrift,lightAt,hazeAt,menuPose,menuMode,frameDue,createMenuLive} from '../dist/menu-scene-rules.js';
import {propInfo} from '../dist/props.js';
import * as rulesMore from '../dist/menu-scene-rules.js';

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

// --- The plans sheet: cut blocks and a landing, in the map's colours ---------------------------------------------------------
{const {MENU_PLANS:P,PLANS_INK:K,plansOps,blockCentre}=rulesMore,{MINIMAP_COLOUR}=await import('../dist/terrain.js'),map=new Set(Object.values(MINIMAP_COLOUR));
 for(const k of ['forest','cut','road','track','water','landing'])assert(map.has(K[k]),`the plans use the map's colour for ${k}`);
 const ops=plansOps();assert.deepEqual(ops,plansOps(),'the drawing is the same every time');assert.deepEqual(ops[0],{op:'fill',colour:K.paper,points:[[0,0],[P.width,0],[P.width,P.height],[0,P.height]]},'paper first');
 near(P.width/P.height,.46/.32,1e-9,'the drawing has the shape of the 46 x 32 cm sheet');
 for(const o of ops){assert(['fill','line','circle','text'].includes(o.op)&&/^#[0-9a-f]{6}$/.test(o.colour),'every step is one the canvas knows');
  for(const [x,y] of o.points||[[o.x,o.y]])assert(x>=0&&x<=P.width&&y>=0&&y<=P.height,`${o.op} stays on the sheet (${x}, ${y})`);
  if(o.op==='line')assert(o.width>0&&o.points.length>=2);if(o.op==='text')assert(o.text&&o.size>=10,'text is big enough to draw')}
 assert(P.blocks.length>=3,'several cut blocks');assert.equal(P.blocks.filter(b=>b.state==='today').length,1,'one block is today\'s');assert(P.blocks.some(b=>b.state==='cut')&&P.blocks.some(b=>b.state==='planned'));
 const inside=(pts,[x,y])=>{let hit=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const [xi,yi]=pts[i],[xj,yj]=pts[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)hit=!hit}return hit};
 for(const b of P.blocks){const c=blockCentre(b.points);
  assert(ops.some(o=>o.op==='text'&&o.text===b.id),`block ${b.id} is labelled`);assert(ops.some(o=>o.op==='line'&&o.points.length===b.points.length+1&&o.points[0]===b.points[0]),`block ${b.id} is outlined`);
  assert(ops.some(o=>o.op==='line'&&o.colour===K.track&&o.points[0][0]===P.landing.x&&o.points[1][0]===c[0]),`a track runs from the landing to ${b.id}`);
  assert(!inside(b.points,[P.landing.x,P.landing.y])&&Math.hypot(c[0]-P.landing.x,c[1]-P.landing.y)>P.landing.r+20,`${b.id} is clear of the landing`);
  for(const p of [...P.creek,...P.road])assert(!inside(b.points,p),`${b.id} is clear of the creek and the haul road`);
  for(const o of P.blocks)if(o!==b)assert(!inside(o.points,c),'blocks do not overlap')}
 assert.equal(ops.filter(o=>o.op==='fill'&&o.colour===K.cut).length,1,'the felled block is filled');assert(ops.filter(o=>o.op==='circle'&&o.r===2).every(o=>inside(P.blocks[0].points,[o.x,o.y])),'stumps stand inside it');
 assert(ops.some(o=>o.dash)&&ops.some(o=>o.colour===K.today),'planned blocks are dashed, today\'s is red');
 const end=P.road.at(-1);assert(Math.hypot(end[0]-P.landing.x,end[1]-P.landing.y)<=P.landing.r,'the haul road ends at the landing');assert(P.road[0][1]>=P.height-P.margin,'and starts at the edge of the sheet');
 assert(ops.some(o=>o.op==='circle'&&o.colour===K.landing&&o.r===P.landing.r)&&ops.some(o=>o.text==='LANDING')&&ops.some(o=>o.text==='N')&&ops.some(o=>o.text===P.title),'landing, north arrow and title are drawn')}

// --- Ground cover: where it stands, its shape, and the wind --------------------------------------------------------------------
{const {MENU_COVER:C,groundCover,coverShape,COVER_WIND:W,coverBend}=rulesMore,cam={x:6,z:5,r:2.5},spots=groundCover(C,[cam]);
 assert.deepEqual(spots,groundCover(C,[cam]),'placement is the same every time');
 const grass=spots.filter(s=>s.kind==='grass'),ferns=spots.filter(s=>s.kind==='fern');assert.equal(grass.length,C.grass);assert.equal(ferns.length,C.ferns);assert.equal(grass.length+ferns.length,spots.length);
 assert(C.grass+C.ferns<=2000,'the cover stays inside its instance budget');
 for(const s of spots){const r=Math.hypot(s.x,s.z);assert(r>=C.inner-1e-9&&r<=C.outer+1e-9,'cover stands in the ring around the clearing, never under the vehicle or the character');
  assert(Math.hypot(s.x-cam.x,s.z-cam.z)>=cam.r,'nothing grows in the camera');assert(s.scale>=.6&&s.scale<=1.3&&s.yaw>=0&&s.yaw<Math.PI*2);if(s.kind==='fern')assert(r>C.dirt,'ferns stand off the dirt')}
 for(const [sx,sz] of [[1,1],[1,-1],[-1,1],[-1,-1]])assert(grass.filter(s=>s.x*sx>0&&s.z*sz>0).length>C.grass/6,'grass on every side');
 assert(grass.filter(s=>Math.hypot(s.x,s.z)<12).length>C.grass*.4,'thickest near the clearing');assert(new Set(grass.map(s=>s.x.toFixed(3)+','+s.z.toFixed(3))).size>C.grass*.99,'tufts are not stacked');
 const low=groundCover(C,[cam],.4);assert.equal(low.length,Math.round(C.grass*.4)+Math.round(C.ferns*.4),'low quality draws 40%');assert.equal(groundCover(C,[],0).length,0);
 for(const kind of ['grass','fern']){const {position,bend}=coverShape(kind),n=bend.length;
  assert.equal(position.length,n*3);assert(n%3===0&&n/3>=14&&n/3<=40,`${kind}: a few triangles (${n/3})`);
  let top=0;for(let i=0;i<n;i++){const [x,y,z]=position.slice(i*3,i*3+3),b=bend[i];assert([x,y,z,b].every(Number.isFinite)&&b>=0&&b<=1);assert(y>=-1e-9&&y<=.45&&Math.hypot(x,z)<=.7,`${kind} is a small plant`);if(b===0)near(y,0,1e-9,'the root is on the ground');top=Math.max(top,y)}
  assert(top>.25,`${kind} stands up`);assert(bend.includes(0)&&bend.includes(1),'root to tip')}
 near(Math.hypot(W.x,W.z),1,.01,'the wind direction is a unit vector');
 let lo=1,hi=-1;for(let t=0;t<120;t+=.07){for(const [x,z] of [[0,0],[7,-3],[-15,12]]){const d=coverBend(t,x,z,1);lo=Math.min(lo,d);hi=Math.max(hi,d);assert(Math.abs(d)<=.1,'a tip never moves more than 10 cm');assert(coverBend(t,x,z,0)===0,'the root never moves');
  near(coverBend(t,x,z,.5),d/4,1e-12,'the bend grows with the square of the height');near(coverBend(t+1/MENU_FPS,x,z,1),d,.01,'no jump between two frames')}}
 assert(hi>.06&&lo<0&&hi>-lo,'the grass leans downwind and springs back');assert.notEqual(coverBend(3,0,0,1),coverBend(3,4,0,1),'the wind runs across the clearing as a wave');
 const src=await readFile('dist/menu-scene.js','utf8');assert(/coverShape\(/.test(src)&&/groundCover\(/.test(src)&&/plansOps\(/.test(src)&&/COVER_WIND/.test(src)&&/uTime\*\$\{f\(W\.speed\)\}-cP\.x\*\$\{f\(W\.kx\)\}-cP\.z\*\$\{f\(W\.kz\)\}/.test(src),'the scene builds from the rules and the shader uses the same wind numbers');
 assert.equal((src.match(/new THREE\.InstancedMesh\(/g)||[]).length,2,'ground cover adds one instanced mesh per kind, no more (trees: one line, cover: one line)')}

// --- Edit character goes back to the menu; a first character starts the game ------------------------------------------------------
{const {creatorReturn}=rulesMore;assert.equal(creatorReturn({active:false,fromMenu:true}),'menu');assert.equal(creatorReturn({active:false,fromMenu:false}),'game','Play with no character: saving starts the game');assert.equal(creatorReturn({active:true,fromMenu:false}),'game','in the game it stays in the game');assert.equal(creatorReturn({active:true,fromMenu:true}),'game')}

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
 // Edit character on the menu: saving comes back to the menu with the new look saved, and the game has not started.
 {const creator=g.ids.get('creator');g.ids.get('customizeSaved').click();assert(!creator.hidden&&welcome.hidden,'Edit character opens the creator over the menu');
  g.ids.get('characterName').value='Robin';g.ids.get('creatorForm').onsubmit({preventDefault(){}});assert(creator.hidden,'saving closes the creator');assert(!welcome.hidden,'and returns to the main menu, not the game');
  assert.equal(JSON.parse(g.store.get('citylife.character.v1')).appearance.name,'Robin','the new character is saved');
  const drawn=g.scene();globalThis.__renderScene=null;g.pump(.3);assert.equal(g.scene(),null,'the game has not started: the world is not drawn');globalThis.__renderScene=drawn;
  if(menu){globalThis.__menuScene=null;g.pump(.3);assert.equal(g.menuScene(),menu,'the same menu scene draws again, with the new look')}
  g.ids.get('customizeSaved').click();g.ids.get('cancelCreator').click();assert(!welcome.hidden&&creator.hidden,'Back still returns to the menu')}
 if(!menu){console.log('menu-scene: the packaged game kept the picture in Node (character assets not ready or the build failed); the live path was not exercised here');assert(!welcome.classList.contains('live'))}
 else{
  assert(welcome.classList.contains('live'),'the menu shows the canvas');
  const names=[];menu.traverse(o=>names.push(o.name));assert(names.includes('prop-'+MENU_VEHICLE.prop),'the vehicle from the swap point is in the scene');assert(names.includes('props-log'),'and the logs');
  const found={};menu.traverse(o=>{found[o.name]=o});const tufts=found['menu-cover-grass'],fern=found['menu-cover-fern'],sheet=found['menu-plans'];
  assert(tufts?.isInstancedMesh&&fern?.isInstancedMesh&&tufts.material===fern.material,'grass and ferns: two instanced meshes on one material');assert.equal(tufts.count,rulesMore.MENU_COVER.grass);assert.equal(fern.count,rulesMore.MENU_COVER.ferns);
  assert(tufts.geometry.getAttribute('aBend')&&tufts.geometry.getAttribute('color')&&typeof tufts.material.onBeforeCompile==='function','the wind attribute and shader hook are there');
  assert(sheet?.material.map?.isCanvasTexture,'the plans carry the drawn sheet');
  g.ids.get('start').click();globalThis.__menuScene=null;g.pump(.2);assert.equal(g.menuScene(),null,'Play: the menu scene is not drawn again');assert(!welcome.classList.contains('live'),'and the menu scene is gone');assert.equal(menu.children.length,0,'disposed');
 }
 await g.done()}
// --- The menu follows the newest vehicle you own: menuVehicleFor ---------------------------------------------------------
{const {menuVehicleFor,MENU_VEHICLES}=rulesMore;
 assert.equal(menuVehicleFor([]),MENU_VEHICLE,'no vehicle: the default scene');assert.equal(menuVehicleFor(undefined),MENU_VEHICLE);assert.equal(menuVehicleFor('x'),MENU_VEHICLE);
 const own=[{uid:'v2',model:'worktruck',colour:'red'},{uid:'v10',model:'flatbed',colour:'blue'},{uid:'v3',model:'offroad'}];
 const v=menuVehicleFor(own);assert.equal(v.prop,'flatbed','the highest uid number wins (v10 is newer than v3)');assert.equal(v.colour,'blue','with its paint');
 assert.equal(menuVehicleFor([{uid:'v4',model:'spaceship'},{uid:'bad',model:'flatbed'},null,{model:'flatbed'}]),MENU_VEHICLE,'unknown models and bad uids are skipped');
 assert.equal(menuVehicleFor([{uid:'v4',model:'flatbed'},{uid:'v5',model:'zeppelin'}]).prop,'flatbed','a bad newer one does not hide a good older one');
 assert.equal(menuVehicleFor([{uid:'v1',model:'offroad'}]).colour,undefined);assert.equal(Object.hasOwn(menuVehicleFor([{uid:'v1',model:'toString'}]),'lean'),true,'a prototype name is not a model');
 for(const [id,veh] of Object.entries(MENU_VEHICLES)){assert.equal(veh.prop,id,'every stance names its own prop');const w=propInfo(veh.prop).width;assert.ok(w>1,id+' has a real width');const s=leanSpot(veh,w);assert.ok(Number.isFinite(s.x)&&Number.isFinite(s.z),id+' has a spot')}
}console.log('menu-scene ok');
