// The in-game scene editor (E3): the pure pointer and camera maths, then the real packaged game with the editor opened from Dev Mode.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
import {bootGame} from './support/boot-game.mjs';
import * as E from '../dist/scene-editor.js';
import {emptyEdits,sceneKeys,snap,normaliseEdits} from '../dist/scene-edit.js';
import {SCENE_EDITS} from '../dist/scene-edits.js';
import {MAP} from '../dist/map-definition.js';
import {propInfo} from '../dist/props.js';
const near=(a,b,eps=1e-6)=>Math.abs(a-b)<=eps;

// ── Pure maths ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
{ // the ground limit, the pan, the height and the zoom
 assert.deepEqual(E.clampGround(-9999,9999),{x:MAP.ground.x0,z:MAP.ground.z1});assert.deepEqual(E.clampGround(10,-20),{x:10,z:-20});
 const cam=E.defaultCamera(0,0),speed=Math.min(120,Math.max(6,cam.dist*.9));
 let c=E.stepCamera(cam,{forward:1},1);assert(near(c.z,-speed)&&near(c.x,0),'W pans north (-z) at a speed that follows the height');
 c=E.stepCamera(cam,{right:1},1);assert(near(c.x,speed)&&near(c.z,0),'D pans east');
 c=E.stepCamera(cam,{forward:1,right:1},1);assert(near(Math.hypot(c.x,c.z),speed),'a diagonal is no faster');
 c=E.stepCamera({...cam,yaw:Math.PI/2},{forward:1},1);assert(near(c.x,-speed,1e-6)&&near(c.z,0,1e-6),'forward follows the camera turn');
 c=E.stepCamera({...cam,x:MAP.ground.x1-1},{right:1},60);assert.equal(c.x,MAP.ground.x1,'the target stops at the edge of MAP.ground');
 c=E.stepCamera({...cam,z:MAP.ground.z0+1},{forward:1},60);assert.equal(c.z,MAP.ground.z0);
 assert(E.stepCamera(cam,{rise:1},1).ty>0,'E raises');assert.equal(E.stepCamera(cam,{rise:-1},1).ty,0,'Q cannot go below the ground');assert.equal(E.stepCamera({...cam,ty:119},{rise:1},50).ty,E.CAM_LIMITS.ty[1]);
 assert.equal(E.zoomCamera(cam,1e6).dist,E.CAM_LIMITS.dist[1]);assert.equal(E.zoomCamera(cam,-1e6).dist,E.CAM_LIMITS.dist[0]);assert(E.zoomCamera(cam,100).dist>cam.dist,'wheel down zooms out');
 assert.equal(E.orbitCamera(cam,0,1e6).pitch,E.CAM_LIMITS.pitch[1]);assert.equal(E.orbitCamera(cam,0,-1e6).pitch,E.CAM_LIMITS.pitch[0]);assert(near(E.orbitCamera(cam,100,0).yaw,cam.yaw-.5));
}
{ // rays: the middle of the screen hits the look-at point; the top of the screen is farther north; a ray that points up hits nothing
 const cam={...E.defaultCamera(30,-20)},pose=E.cameraPose(cam),mid=E.rayGround(E.screenRay(pose,52,1.5,0,0));
 assert(near(mid.x,30,1e-6)&&near(mid.z,-20,1e-6),`screen centre = look-at point (${mid.x}, ${mid.z})`);
 const top=E.rayGround(E.screenRay(pose,52,1.5,0,.5)),right=E.rayGround(E.screenRay(pose,52,1.5,.5,0)),left=E.rayGround(E.screenRay(pose,52,1.5,-.5,0));
 assert(top.z<-20,'the top of the screen is farther north');assert(right.x>30&&left.x<30,'right of the screen is east');
 const turned=E.cameraPose({...cam,yaw:Math.PI/2}),r2=E.rayGround(E.screenRay(turned,52,1.5,.5,0));assert(r2.z!==undefined&&Number.isFinite(r2.x),'a turned camera still hits the ground');
 assert.equal(E.rayGround({origin:[0,5,0],dir:[0,1,0]}),null);assert.equal(E.rayGround({origin:[0,5,0],dir:[1,0,0]}),null);
}
{ // footprints turn with the prop; the smallest footprint under the pointer wins
 assert.equal(E.footprintHit('prop.pump-island',{x:0,z:0,yaw:0},{x:1.5,z:0}),true);assert.equal(E.footprintHit('prop.pump-island',{x:0,z:0,yaw:0},{x:0,z:1.5}),false);
 assert.equal(E.footprintHit('prop.pump-island',{x:0,z:0,yaw:Math.PI/2},{x:0,z:1.5}),true,'turned a quarter, the long side points along z');assert.equal(E.footprintHit('prop.pump-island',{x:0,z:0,yaw:Math.PI/2},{x:1.5,z:0}),false);
 assert.equal(E.footprintHit('prop.pump-island',{x:10,z:5,yaw:0},{x:11.5,z:5.8},0),false,'outside by 0.2 m with no margin');assert.equal(E.footprintHit('prop.pump-island',{x:10,z:5,yaw:0},{x:11.5,z:5.8}),true,'inside with the 0.25 m margin');
 const props=[...new Set(sceneKeys().map(k=>k.prop))].filter(p=>{const f=propInfo(p).footprint;return f&&f.x0<0&&f.x1>0&&f.z0<0&&f.z1>0}),area=p=>{const f=propInfo(p).footprint;return (f.x1-f.x0)*(f.z1-f.z0)},sorted=props.sort((a,b)=>area(a)-area(b));
 assert(area(sorted[0])<area(sorted.at(-1)),'two models of different size exist');
 const cands=[{kind:'map',key:'big',prop:sorted.at(-1),x:0,z:0,yaw:0},{kind:'map',key:'small',prop:sorted[0],x:0,z:0,yaw:0}];
 assert.equal(E.pickAt({x:0,z:0},cands).key,'small','the small one on top of the big one is picked');assert.equal(E.pickAt({x:0,z:0},[...cands].reverse()).key,'small','whatever the order');assert.equal(E.pickAt({x:500,z:500},cands),null);
}
{ // dragging, turning, the bar text, the outline, and the rules
 assert.deepEqual(E.dragPosition({x:10.3,z:5.1},{x:0,z:0},{x:1,z:1}),{x:11.5,z:6},'snapped to 0.5 m');assert.deepEqual(E.dragPosition({x:10.3,z:5.1},{x:0,z:0},{x:1,z:1},{snapOn:false}),{x:11.3,z:6.1},'Alt: no snap (1 cm)');
 assert.equal(E.turnedYaw(0,1),.2618);assert.equal(E.turnedYaw(0,-1),-.2618);let y=0;for(let i=0;i<24;i++)y=E.turnedYaw(y,1);assert.equal(y,0,'24 turns of 15 degrees is a full circle');assert(near(E.turnedYaw(Math.PI,1),-2.8798,1e-4),'kept in (-pi, pi]');
 assert.equal(E.barText({added:2,moved:1,removed:0}),'2 added, 1 moved, 0 removed');
 const o=E.outlineBox('prop.pump-island',{x:3,z:4,yaw:1},.5),i=propInfo('prop.pump-island');assert.deepEqual([o.x,o.y,o.z,o.yaw],[3,.5,4,1]);assert(near(o.size[0],3.4)&&near(o.size[2],1.2)&&near(o.size[1],i.height));
 const key=sceneKeys()[0],bad=E.checkEdits({...emptyEdits(),added:[{id:'e-0001',prop:key.prop,x:9999,z:0,yaw:0}]});assert(bad.some(s=>/outside the playable area/.test(s)),bad.join(' '));
 assert.deepEqual(E.checkEdits(emptyEdits()),[]);assert(E.checkEdits({...emptyEdits(),added:[{id:'e-0001',prop:'prop.nonsense',x:0,z:0,yaw:0}]}).some(s=>/unknown prop/.test(s)));
 assert(E.checkEdits({...emptyEdits(),removed:['nowhere.nothing-1']}).length>0,'an unknown key is refused');
}

// ── The packaged game ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
assert.doesNotMatch(await readFile('dist/game.js','utf8'),/import[^;\n(]*scene-editor/,'game.js never imports the editor');assert.doesNotMatch(await readFile('dist/dev.js','utf8'),/^import[^(\n]*scene-editor/m,'dev.js loads it only with a dynamic import()');assert.match(await readFile('dist/dev.js','utf8'),/import\('\.\/scene-editor\.js'\)/);
{
 const g=await bootGame({play:false}),{GameState:S}=g,me=S.me.position,canvas=g.ids.get('world'),body=document.body;
 g.find('menuDev').click();assert(g.find('devOpenEditor'),'the Dev panel has Open Editor');assert.equal(g.find('devOpenEditor').textContent,'Open Editor');assert(g.find('devInteriorToggle'),'the Interior editor is still there');
 const SE=await import(pathToFileURL(join(g.dir,'scene-editor.js')).href);assert.equal(SE.getSceneEditor(),null,'not open yet');
 g.pump(.5);const spot={x:me.x,z:me.z,y:me.y},minutes0=S.progress.routine.minutes,fogFar=g.scene().fog.far;
 const fire=(type,code,extra={})=>{const e=new Event(type,{cancelable:true});e.code=code;Object.assign(e,extra);g.win.dispatchEvent(e);return e};
 const pointer=(type,x,y,extra={})=>{const e=new Event(type,{cancelable:true});Object.assign(e,{clientX:x,clientY:y,button:0,pointerId:1,altKey:false},extra);canvas.dispatchEvent(e);return e};
 const waitFor=async test=>{for(let i=0;i<100&&!test();i++)await new Promise(r=>setTimeout(r,20));assert(test(),'timed out')};
 const open=async()=>{g.find('devOpenEditor').click();await waitFor(()=>SE.getSceneEditor());return SE.getSceneEditor()};

 // ── Open: paused, HUD hidden, input ignored
 const ed=await open();
 assert(g.find('devPanel').hidden,'the Dev panel steps aside');assert(body.classList.contains('scene-editing'),'the HUD is hidden (body.scene-editing)');assert(!g.find('sceneEditorBar').hidden,'the top bar shows');
 assert.equal(g.find('sceneEditorSummary').textContent,'0 added, 0 moved, 0 removed');assert(g.find('sceneEditorSend').disabled&&g.find('sceneEditorApply').disabled,'Send to hub and Apply to game wait for E5');
 assert.equal(SE.openSceneEditor({blocked:()=>null}).ok,false,'a second editor is refused');
 g.pump(2);assert.equal(S.progress.routine.minutes,minutes0,'the game clock is paused');
 assert(g.scene().getObjectByName('scene-editor-grid')&&g.scene().getObjectByName('scene-editor-selection'),'the grid and the outline are drawn (2 draw calls)');assert(g.scene().fog.far>fogFar,'the fog is pushed back so the whole map shows');
 // camera: WASD pans, Q and E, wheel, right-drag
 {const c0=ed.camera();fire('keydown','KeyW');g.pump(.5);fire('keyup','KeyW');const c1=ed.camera();assert(c1.z<c0.z-10,`W flew north (${c0.z} -> ${c1.z})`);assert.deepEqual([me.x,me.z],[spot.x,spot.z],'the player did not walk');
  fire('keydown','KeyE');g.pump(.5);fire('keyup','KeyE');assert(ed.camera().ty>c1.ty,'E raises');fire('keydown','KeyQ');g.pump(.8);fire('keyup','KeyQ');assert.equal(ed.camera().ty,0,'Q lowers (not below the ground)');
  const w=new Event('wheel',{cancelable:true});w.deltaY=300;canvas.dispatchEvent(w);assert(ed.camera().dist>c0.dist,'the wheel zooms');assert.equal(w.defaultPrevented,true);
  pointer('pointerdown',500,400,{button:2});pointer('pointermove',600,400);pointer('pointerup',600,400,{button:2});assert(near(ed.camera().yaw,c0.yaw-.5),'right-drag orbits');
  fire('keydown','ArrowLeft');g.pump(.2);fire('keyup','ArrowLeft');assert(ed.camera().x<c1.x,'arrow keys pan too')}

 // ── Pick, move, turn, remove, copy, undo, redo
 const cands=E.candidatesOf(emptyEdits()),ok=cands.filter(c=>c.kind==='map'&&c.y===0&&E.pickAt({x:c.x,z:c.z},cands)?.key===c.key),K=ok[0],K2=ok.find(c=>Math.hypot(c.x-K.x,c.z-K.z)>8);
 assert(K&&K2,'two pickable named props');const ky=Math.round(K.yaw*1e4)/1e4; // E1 keeps a turn to 0.0001
 assert.equal(ed.select({key:K.key}).key,K.key,'select by key');assert.match(g.find('sceneEditorSelection').textContent,new RegExp(K.key.replace(/[.]/g,'\\.')));assert.equal(ed.select({key:'nowhere.nothing-1'}),null,'an unknown key picks nothing');ed.select({key:K.key});
 const snapped={x:snap(K.x+3.3),z:snap(K.z+.2)};
 assert.equal(ed.moveTo(K.x+3.3,K.z+.2),true);assert.deepEqual(ed.edits().moved[K.key],{...snapped,yaw:ky},'moved with the 0.5 m snap, keeping its turn');
 assert.deepEqual(ed.summary(),{added:0,moved:1,removed:0});assert.equal(g.find('sceneEditorSummary').textContent,'0 added, 1 moved, 0 removed');
 {const s=ed.named.shownAt(K.key);assert(near(s.x,snapped.x,1e-4)&&near(s.z,snapped.z,1e-4),'the yard instance is drawn at the new spot (live redraw)')}
 assert.deepEqual(JSON.parse(g.store.get(SE.STORAGE_KEY)),ed.edits(),'the working edit is kept in localStorage');
 fire('keydown','KeyZ',{ctrlKey:true});assert.deepEqual(ed.edits().moved,{},'Ctrl+Z undoes the move');{const s=ed.named.shownAt(K.key);assert(near(s.x,K.x,1e-4)&&near(s.z,K.z,1e-4),'and the instance is back')}
 fire('keydown','KeyY',{ctrlKey:true});assert.deepEqual(ed.edits().moved[K.key],{...snapped,yaw:ky},'Ctrl+Y redoes it');
 // a real drag with the pointer: press on the prop (it is under the middle of the screen), move, release; one undo step
 {ed.lookAt(snapped.x,snapped.z);const pose=E.cameraPose(ed.camera()),ground=(x,y)=>E.rayGround(E.screenRay(pose,52,1400/900,x/1400*2-1,-(y/900*2-1)));
  const size=ed.history.size(),grab=ground(700,450),now=ground(800,450),want=E.dragPosition(snapped,grab,now);
  pointer('pointerdown',700,450);assert.equal(ed.selected().key,K.key,'a click on the prop picks it');pointer('pointermove',800,450);pointer('pointermove',800,450);pointer('pointerup',800,450);
  assert.deepEqual(ed.edits().moved[K.key],{...want,yaw:ky},'dragged on the ground, snapped');assert.equal(ed.history.size(),size+1,'one undo step for the whole drag');
  const here=ed.selected(),pose2=E.cameraPose(ed.lookAt(here.x,here.z)),g2=(x,y)=>E.rayGround(E.screenRay(E.cameraPose(ed.camera()),52,1400/900,x/1400*2-1,-(y/900*2-1))),a=g2(700,450),b=g2(713,450);
  pointer('pointerdown',700,450,{altKey:true});pointer('pointermove',713,450,{altKey:true});pointer('pointerup',713,450);
  assert.deepEqual(ed.edits().moved[K.key],{...E.dragPosition(here,a,b,{snapOn:false}),yaw:ky},'Alt: no snap');
  pointer('pointerdown',50,50);assert.equal(ed.selected(),null,'a click on empty ground picks nothing');
  ed.select({key:K.key})}
 // turn
 {const yaw0=ed.selected().yaw;fire('keydown','KeyR');assert.equal(ed.edits().moved[K.key].yaw,E.turnedYaw(yaw0,1),'R turns by 15 degrees');fire('keydown','KeyR',{shiftKey:true});assert.equal(ed.edits().moved[K.key].yaw,E.turnedYaw(E.turnedYaw(yaw0,1),-1),'Shift+R turns back');
  const s=ed.named.shownAt(K.key);assert(near(Math.abs(s.yaw-ed.selected().yaw)%(2*Math.PI),0,1e-3)||near(Math.abs(s.yaw-ed.selected().yaw),2*Math.PI,1e-3),'the instance turned too')}
 // remove, then undo and redo
 fire('keydown','Delete');assert(ed.edits().removed.includes(K.key),'Delete removes');assert.equal(ed.named.shownAt(K.key),null,'the instance is hidden');assert.equal(ed.selected(),null);assert.deepEqual(ed.summary(),{added:0,moved:0,removed:1});
 fire('keydown','KeyZ',{ctrlKey:true});assert(!ed.edits().removed.includes(K.key)&&ed.edits().moved[K.key],'undo brings it back where it was');assert(ed.named.shownAt(K.key),'and shows it');fire('keydown','KeyZ',{ctrlKey:true,shiftKey:true});assert(ed.edits().removed.includes(K.key),'Ctrl+Shift+Z redoes');
 // copy of another prop, and moving and removing the copy
 ed.select({key:K2.key});fire('keydown','KeyD',{ctrlKey:true});assert.equal(ed.edits().added.length,1,'Ctrl+D adds a copy');const copyId=ed.edits().added[0].id;assert.equal(ed.selected().id,copyId,'the copy is picked');assert.equal(ed.edits().added[0].prop,K2.prop);
 assert.equal(ed.overlay.meshes().length,1,'the overlay draws it (one draw call)');assert.deepEqual(ed.summary(),{added:1,moved:0,removed:1});assert(g.scene().getObjectByName('scene-overlay-'+K2.prop),'it is in the scene');
 assert.equal(ed.moveTo(K2.x+5,K2.z+5),true);assert.deepEqual([ed.edits().added[0].x,ed.edits().added[0].z],[snap(K2.x+5),snap(K2.z+5)]);
 // a refused action leaves everything as it was and says why
 {const before=JSON.stringify(ed.edits()),size=ed.history.size();assert.equal(ed.moveTo(99999,0),false);assert.equal(JSON.stringify(ed.edits()),before,'nothing changed');assert.equal(ed.history.size(),size,'and nothing was recorded');
  assert.match(g.find('sceneEditorMessage').textContent,/outside the playable area/);assert.equal(g.find('sceneEditorMessage').dataset.kind,'error');
  ed.select({key:K2.key});assert.equal(ed.moveTo(99999,0),false,'a named prop is refused too');assert.equal(JSON.stringify(ed.edits()),before);
  assert.equal(ed.select({id:copyId}).id,copyId);fire('keydown','Delete');assert.equal(ed.edits().added.length,0,'Delete removes the copy');assert.equal(ed.overlay.meshes().length,0)}
 // nothing picked: the actions say so
 {ed.select(null);const before=JSON.stringify(ed.edits());fire('keydown','KeyR');fire('keydown','Delete');assert.equal(JSON.stringify(ed.edits()),before);assert.match(g.find('sceneEditorMessage').textContent,/Pick a prop first/)}

 // ── Discard goes back to the shipped scene; Ctrl+Z brings the work back
 {const work=JSON.stringify(ed.edits());g.find('sceneEditorDiscard').click();assert.deepEqual(ed.edits(),normaliseEdits(SCENE_EDITS),'Discard = the shipped SCENE_EDITS');assert.deepEqual(ed.summary(),{added:0,moved:0,removed:0});
  {const s=ed.named.shownAt(K.key);assert(near(s.x,K.x,1e-4)&&near(s.z,K.z,1e-4),'the removed and moved props are back')}
  fire('keydown','KeyZ',{ctrlKey:true});assert.equal(JSON.stringify(ed.edits()),work,'undo brings the work back');
  assert.equal(JSON.parse(g.store.get(SE.STORAGE_KEY)).removed.length,1)}

 // ── Esc deselects, then closes; the edit survives for next time; closing leaves the game as it was
 ed.select({key:K2.key});fire('keydown','Escape');assert.equal(ed.selected(),null,'Esc deselects first');assert.equal(SE.getSceneEditor(),ed,'and keeps the editor open');
 const saved=JSON.stringify(ed.edits());fire('keydown','Escape');assert.equal(SE.getSceneEditor(),null,'the second Esc closes');
 assert(!body.classList.contains('scene-editing'),'the HUD is back');assert(g.find('sceneEditorBar').hidden);assert(!g.scene().getObjectByName('scene-editor-grid'),'the helpers are gone');assert.equal(g.scene().fog.far,fogFar,'the fog is as it was');
 assert(near(me.x,spot.x,.01)&&near(me.z,spot.z,.01)&&near(me.y,spot.y,.05),`the player is back where they were (${me.x}, ${me.z})`);
 {const s=ed.named.shownAt(K.key);assert(near(s.x,K.x,1e-4)&&near(s.z,K.z,1e-4),'the named props are as shipped');assert.equal(ed.overlay.meshes().length,0,'no placed props are drawn')}
 g.pump(1);assert(S.progress.routine.minutes>minutes0,'the clock runs again');assert(near(me.x,spot.x,.01)&&near(me.z,spot.z,.01),'nothing moved the player: the keys were cleared');
 // reopen: the earlier edit is loaded (a reload would do the same)
 {const ed2=await open();assert.notEqual(ed2,ed);assert.equal(JSON.stringify(ed2.edits()),saved,'the working edit came back');assert.equal(g.find('sceneEditorSummary').textContent,E.barText(ed2.summary()));assert(ed2.named.shownAt(K.key)===null,'and it is drawn');
  assert.equal(ed2.close()!==null,true,'close() returns the placeSafely result');assert.equal(SE.getSceneEditor(),null);assert(near(me.x,spot.x,.01)&&near(me.z,spot.z,.01))}
 // a stored edit that breaks the rules is ignored
 {g.store.set(SE.STORAGE_KEY,JSON.stringify({version:1,added:[{id:'e-0001',prop:K.prop,x:9999,z:0,yaw:0}],moved:{},removed:[]}));const ed3=await open();assert.deepEqual(ed3.edits(),normaliseEdits(SCENE_EDITS),'a bad stored edit is not loaded');ed3.close()}
 {g.store.set(SE.STORAGE_KEY,'not json');const ed4=await open();assert.deepEqual(ed4.edits(),normaliseEdits(SCENE_EDITS),'unreadable storage is ignored');ed4.close()}
 // the editor will not open where it cannot: indoors
 {assert.equal(typeof SE.openSceneEditor,'function')}
 await g.done();
}
console.log('scene-editor tests passed');
