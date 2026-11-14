import './legacy-keys.js';
// The in-game scene editor (E3): fly over the map, pick a prop, drag it on the ground, turn it, remove it, copy it, undo.
// Loaded with a dynamic import() only when the Dev Mode panel's "Open Editor" button is pressed (dev.js), so the deployed game never fetches it.
// Every change goes through the E1 transactions (scene-edit.js) and then the E2 redraw: overlay.rebuild(edits) for props the editor placed, and a matrix update of the yard
// instances for named map props. The pointer and camera maths are small pure functions at the top of this file (tested without a GPU).
// Closing puts the overlay and the named props back to the shipped SCENE_EDITS, so the game is exactly as it was; the working edit stays in localStorage for next time.
import * as THREE from './vendor/three.module.js';
import {MAP} from './map-definition.js';
import {heightAt} from './height.js';
import {propInfo} from './props.js';
import {SCENE_EDITS} from './scene-edits.js';
import {normaliseEdits,snap,snapYaw,move,turn,remove,copy,validateEdits,summary,createHistory,sceneKeys,applyToNamed} from './scene-edit.js';

export const STORAGE_KEY='edenridge.sceneEdit.v1';
export const LIMITS={perModel:200,total:400}; // most props of one model, and most props in all, the editor will keep
export const TURN_STEP=15; // degrees for R
export const CAM_LIMITS={dist:[3,250],pitch:[.1,1.5],ty:[0,120]};

// ── Pure maths ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const clamp=(v,[a,b])=>Math.min(b,Math.max(a,v)),r2=v=>Math.round(v*100)/100+0,r4=v=>Math.round(v*1e4)/1e4+0;
export const clampGround=(x,z,g=MAP.ground)=>({x:Math.min(g.x1,Math.max(g.x0,x)),z:Math.min(g.z1,Math.max(g.z0,z))});
// The free camera looks at (x, ty, z) from `dist` metres away; yaw 0 puts it south of the target looking north.
export const defaultCamera=(x=0,z=0)=>({...clampGround(x,z),ty:0,yaw:0,pitch:.9,dist:40});
// Pan over the ground (forward and right are -1..1), and raise or lower the look-at height; the target stays inside MAP.ground.
export function stepCamera(cam,{forward=0,right=0,rise=0},dt,ground=MAP.ground){
 const len=Math.hypot(forward,right)||1,speed=Math.min(120,Math.max(6,cam.dist*.9));
 const dx=(-Math.sin(cam.yaw)*forward+Math.cos(cam.yaw)*right)/len*speed*dt,dz=(-Math.cos(cam.yaw)*forward-Math.sin(cam.yaw)*right)/len*speed*dt;
 return {...cam,...clampGround(cam.x+dx,cam.z+dz,ground),ty:clamp(cam.ty+rise*Math.max(4,cam.dist*.5)*dt,CAM_LIMITS.ty)};
}
export const orbitCamera=(cam,dx,dy)=>({...cam,yaw:cam.yaw-dx*.005,pitch:clamp(cam.pitch+dy*.005,CAM_LIMITS.pitch)});
export const zoomCamera=(cam,deltaY)=>({...cam,dist:clamp(cam.dist*Math.exp(deltaY*.0015),CAM_LIMITS.dist)});
export function cameraPose(cam){const cp=Math.cos(cam.pitch);return {position:[cam.x+Math.sin(cam.yaw)*cp*cam.dist,cam.ty+Math.sin(cam.pitch)*cam.dist,cam.z+Math.cos(cam.yaw)*cp*cam.dist],target:[cam.x,cam.ty,cam.z]}}
// The ray through a point of the screen (nx, ny in -1..1, y up) for a camera at `pose` with vertical field of view fovDeg.
export function screenRay(pose,fovDeg,aspect,nx,ny){
 const [px,py,pz]=pose.position,[tx,ty,tz]=pose.target,fl=Math.hypot(tx-px,ty-py,tz-pz),fx=(tx-px)/fl,fy=(ty-py)/fl,fz=(tz-pz)/fl;
 let rx=-fz,rz=fx;const rl=Math.hypot(rx,rz)||1;rx/=rl;rz/=rl;
 const ux=-rz*fy,uy=rz*fx-rx*fz,uz=rx*fy,t=Math.tan(fovDeg*Math.PI/360);
 const dx=fx+rx*nx*t*aspect+ux*ny*t,dy=fy+uy*ny*t,dz=fz+rz*nx*t*aspect+uz*ny*t,dl=Math.hypot(dx,dy,dz);
 return {origin:[px,py,pz],dir:[dx/dl,dy/dl,dz/dl]};
}
// Where the ray meets the plane y = `y`, or null when it points up or the hit is absurdly far.
export function rayGround(ray,y=0){
 if(ray.dir[1]>=-1e-6)return null;const s=(y-ray.origin[1])/ray.dir[1];if(!(s>0&&s<3000))return null;
 return {x:ray.origin[0]+ray.dir[0]*s,z:ray.origin[2]+ray.dir[2]*s};
}
// The point in a spot's own frame (the frame propInfo's footprint and colliders are in); the same turn the overlay uses.
export function toLocal(spot,p){const c=Math.cos(spot.yaw||0),s=Math.sin(spot.yaw||0),dx=p.x-spot.x,dz=p.z-spot.z;return {x:dx*c-dz*s,z:dx*s+dz*c}}
export function footprintHit(prop,spot,p,margin=.25){const f=propInfo(prop).footprint;if(!f)return false;const l=toLocal(spot,p);return l.x>=f.x0-margin&&l.x<=f.x1+margin&&l.z>=f.z0-margin&&l.z<=f.z1+margin}
// The prop under a ground point: of the spots whose footprint holds it, the one with the smallest footprint (a crate on a big pad wins), then the nearest centre.
export function pickAt(p,cands,margin=.25){
 let best=null,bestArea=Infinity,bestD=Infinity;
 for(const c of cands){
  if(!footprintHit(c.prop,c,p,margin))continue;
  const f=propInfo(c.prop).footprint,area=(f.x1-f.x0)*(f.z1-f.z0),d=Math.hypot(c.x-p.x,c.z-p.z);
  if(area<bestArea-1e-9||(Math.abs(area-bestArea)<=1e-9&&d<bestD)){best=c;bestArea=area;bestD=d}
 }
 return best;
}
// Everything that can be picked under the edits: placed props, and the named map props that are not removed, at their moved spots.
export function candidatesOf(edits,keys=sceneKeys()){
 const out=[];
 for(const a of edits.added)out.push({kind:'added',id:a.id,prop:a.prop,x:a.x,z:a.z,yaw:a.yaw,y:0});
 for(const k of keys){const s=applyToNamed(k.key,k,edits);if(s)out.push({kind:'map',key:k.key,prop:k.prop,x:s.x,z:s.z,yaw:s.yaw,y:k.y||0})}
 return out;
}
// Where a dragged prop goes: its start plus how far the pointer has moved on the ground, snapped to 0.5 m unless Alt is held (then to 1 cm).
export function dragPosition(start,grab,now,{snapOn=true}={}){const x=start.x+now.x-grab.x,z=start.z+now.z-grab.z;return snapOn?{x:snap(x),z:snap(z)}:{x:r2(x),z:r2(z)}}
// A quarter-turn-friendly turn: dir +1 or -1 steps of TURN_STEP degrees, kept in (-pi, pi].
export function turnedYaw(yaw,dir){const y=snapYaw((yaw||0)+dir*TURN_STEP*Math.PI/180);return r4(Math.atan2(Math.sin(y),Math.cos(y)))}
export const barText=s=>`${s.added} added, ${s.moved} moved, ${s.removed} removed`;
// The outline box of a prop at a spot: where its pivot is, the turn, and the box's size and centre in the prop's own frame.
export function outlineBox(prop,spot,y=0){const i=propInfo(prop),f=i.footprint||{x0:-.5,x1:.5,z0:-.5,z1:.5},h=i.height||1;return {x:spot.x,y,z:spot.z,yaw:spot.yaw||0,size:[f.x1-f.x0,h,f.z1-f.z0],centre:[(f.x0+f.x1)/2,h/2,(f.z0+f.z1)/2]}}
let KEYS=null;const keySet=()=>KEYS||(KEYS=new Set(sceneKeys().map(k=>k.key))),knownProp=id=>{try{return !!propInfo(id)}catch{return false}};
// Plain-language problems with an edit set (E1 validateEdits with this game's models, keys, playable area and limits); empty means fine.
export const checkEdits=edits=>validateEdits(edits,{knownProps:knownProp,knownKeys:keySet(),bounds:MAP.ground,caps:LIMITS});

// ── Named map props: move or hide the yard instances ────────────────────────────────────────────────────────────────────────────────────────
// eastbank.js builds each yard's instances once, from `baseline` (the shipped SCENE_EDITS). Here every instance gets a slot by key, and apply(edits) writes only the matrices that differ.
// Collision boxes of named props are not touched: they follow the edits when the game is next built with them (E5).
export function createNamedView({chunks,map=MAP,height=heightAt,baseline=SCENE_EDITS}){
 const slots=new Map(),m4=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),one=new THREE.Vector3(1,1,1),zero=new THREE.Vector3(0,0,0),at=new THREE.Vector3(),dirty=new Set();
 const sig=s=>s?`${s.x},${s.z},${s.yaw}`:'gone';
 const put=(slot,spot)=>{
  if(spot)m4.compose(at.set(spot.x,height(spot.x,spot.z)+(slot.orig.y||0),spot.z),q.setFromAxisAngle(up,spot.yaw||0),one);else m4.compose(at.set(0,-50,0),q.identity(),zero);
  for(const t of slot.targets){t.mesh.setMatrixAt(t.index,m4);dirty.add(t.mesh)}
 };
 for(const yard of map.yards||[]){
  const chunk=chunks.find(c=>c.id===yard.id);if(!chunk)continue;
  const seen={};
  for(const k of sceneKeys({yards:[yard]})){
   if(baseline.removed?.includes(k.key))continue; // already left out of the instances
   const n=seen[k.prop]=(seen[k.prop]??-1)+1;
   const meshes=chunk.meshes.filter(m=>m.name==='props-'+k.prop||(k.prop==='prop.forecourt-canopy'&&(m.name==='canopy-roof'||m.name==='canopy-columns')));
   slots.set(k.key,{orig:k,targets:meshes.map(mesh=>({mesh,index:n})),sig:sig(applyToNamed(k.key,k,baseline))});
  }
 }
 return {
  slots,
  apply(edits){
   for(const [key,slot] of slots){const spot=applyToNamed(key,slot.orig,edits),s=sig(spot);if(s!==slot.sig){slot.sig=s;put(slot,spot)}}
   for(const mesh of dirty)mesh.instanceMatrix.needsUpdate=true;dirty.clear();
  },
  // [{key, shown:{x,z,yaw}|null}] for tests: what the instance matrices currently say.
  shownAt(key){const slot=slots.get(key),t=slot?.targets[0];if(!t)return undefined;t.mesh.getMatrixAt(t.index,m4);const p=new THREE.Vector3(),qq=new THREE.Quaternion(),s=new THREE.Vector3();m4.decompose(p,qq,s);return s.x===0?null:{x:p.x,y:p.y,z:p.z,yaw:2*Math.atan2(qq.y,qq.w)}},
 };
}

// ── The panels ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const STYLE=`body.scene-editing :is(#statusDock,#vehiclePanel,#vitals,#clockChip,#jobToast,#objective,#workProgress,#prompt,#hotbar,#minimap,#mobile,#fps,#mouseMode,#updateBanner){display:none!important}
#sceneEditorBar[hidden],#sceneEditorFoot[hidden]{display:none}
#sceneEditorBar{position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:95;display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:8px 12px;border-radius:10px;border:1px solid #d4e7b366;background:#0b191bf5;color:#eef6e6;font:13px/1.4 system-ui,sans-serif}
#sceneEditorBar button{padding:6px 10px;border-radius:6px;border:1px solid #ffffff3a;background:#1d3d3a;color:#eef6e6;font:inherit;cursor:pointer}
#sceneEditorBar button:hover:not(:disabled){background:#2a5551;border-color:#d4e7b3}#sceneEditorBar button:disabled{opacity:.45;cursor:default}
#sceneEditorSummary{font-variant-numeric:tabular-nums;font-weight:600}#sceneEditorSelection{color:#cae0ad}
#sceneEditorFoot{position:fixed;bottom:10px;left:50%;transform:translateX(-50%);z-index:95;max-width:min(900px,calc(100vw - 24px));text-align:center;padding:6px 12px;border-radius:10px;background:#0b191bd9;color:#c4d6cb;font:12px/1.5 system-ui,sans-serif}
#sceneEditorMessage{min-height:1.5em;color:#cfe8a8}#sceneEditorMessage[data-kind=error]{color:#ffb4a8}
`;
const HELP='WASD or arrows pan · wheel zoom · right-drag orbit · Q lower, E raise · click picks · drag moves (Alt: no snap) · R turn, Shift+R the other way · Delete removes · Ctrl+D copies · Ctrl+Z undo, Ctrl+Y redo · Esc deselects, then closes';
function make(tag,props={},...children){const node=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='dataset')Object.assign(node.dataset,v);else node[k]=v}node.append(...children);return node}
let ui=null;
function buildUi(){
 if(ui)return ui;
 const style=make('style',{id:'sceneEditorStyle',textContent:STYLE}),summaryEl=make('span',{id:'sceneEditorSummary'}),selection=make('span',{id:'sceneEditorSelection'}),
  discard=make('button',{id:'sceneEditorDiscard',textContent:'Discard',title:'Back to the shipped scene (Ctrl+Z brings it back)'}),
  send=make('button',{id:'sceneEditorSend',textContent:'Send to hub',disabled:true,title:'Coming in E5'}),apply=make('button',{id:'sceneEditorApply',textContent:'Apply to game',disabled:true,title:'Coming in E5'}),
  close=make('button',{id:'sceneEditorClose',textContent:'Close',title:'Close the editor (Esc)'}),
  message=make('div',{id:'sceneEditorMessage',role:'status'}),
  bar=make('div',{id:'sceneEditorBar',hidden:true},summaryEl,selection,discard,send,apply,close),
  foot=make('div',{id:'sceneEditorFoot',hidden:true},message,make('div',{id:'sceneEditorHelp'},HELP));
 document.body.append(style,bar,foot);
 return ui={bar,foot,summaryEl,selection,discard,close,message,send,apply};
}

// ── The editor ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
let current=null;
export const getSceneEditor=()=>current;
const safeStorage=()=>{try{return localStorage}catch{return null}};
// host (from game.js through dev.js): {camera, scene, canvas, world, blocked(), enter(hook), leave(), player()}.
export function openSceneEditor(host,{storage=safeStorage()}={}){
 if(current)return {ok:false,message:'The editor is already open.'};
 const why=host.blocked?.();if(why)return {ok:false,message:why};
 const overlay=host.world.group.children.find(c=>c.name==='scene-overlay')?.userData.sceneOverlay;
 if(!overlay)return {ok:false,message:'The scene overlay is not in this game.'};
 const named=createNamedView({chunks:host.world.eastbank.chunks}),keys=sceneKeys(),panels=buildUi(),shipped=normaliseEdits(SCENE_EDITS),json=JSON.stringify;
 const load=()=>{try{const raw=storage?.getItem(STORAGE_KEY);if(raw){const e=normaliseEdits(JSON.parse(raw));if(!checkEdits(e).length)return e}}catch{}return shipped};
 let edits=load(),sel=null,drag=null,orbit=null,lastMessage='',cam=defaultCamera(host.player().x,host.player().z);
 const history=createHistory(edits),down=new Set(),listeners=[];
 const save=()=>{try{storage?.setItem(STORAGE_KEY,json(edits))}catch{}};
 const say=(text,kind='')=>{lastMessage=text;panels.message.textContent=text;panels.message.dataset.kind=kind};
 const syncOverlay=next=>{if(json(overlay.edits().added)!==json(next.added))overlay.rebuild(next)};
 const view=next=>{syncOverlay(next);named.apply(next)};
 const candidates=()=>candidatesOf(edits,keys),selected=()=>sel&&candidates().find(c=>sel.id?c.id===sel.id:c.key===sel.key)||null;
 const target=c=>c.kind==='added'?{id:c.id}:{key:c.key};
 const ref=c=>c?(c.kind==='added'?{id:c.id}:{key:c.key}):null;

 // helpers drawn while the editor is open: a ground grid and the selection box (2 draw calls)
 const g=MAP.ground,grid=new THREE.GridHelper(Math.max(g.x1-g.x0,g.z1-g.z0),Math.round(Math.max(g.x1-g.x0,g.z1-g.z0)/10),0x9bc27a,0x4f6f52);
 grid.position.set((g.x0+g.x1)/2,.06,(g.z0+g.z1)/2);grid.material.transparent=true;grid.material.opacity=.35;grid.name='scene-editor-grid';
 const pivot=new THREE.Group(),box=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1)),new THREE.LineBasicMaterial({color:0xffe14a,depthTest:false}));
 box.renderOrder=999;box.frustumCulled=false;pivot.add(box);pivot.visible=false;pivot.name='scene-editor-selection';
 const fog=host.scene.fog,fogFar=fog?.far;if(fog)fog.far=4000; // the free camera sees the whole map
 host.scene.add(grid,pivot);

 function refresh(){
  const s=summary(edits,shipped),c=selected();
  panels.summaryEl.textContent=barText(s);
  if(c){const o=outlineBox(c.prop,c,heightAt(c.x,c.z)+(c.y||0));pivot.position.set(o.x,o.y,o.z);pivot.rotation.y=o.yaw;box.position.set(...o.centre);box.scale.set(...o.size);pivot.visible=true;
   panels.selection.textContent=`${c.kind==='added'?c.id:c.key} · ${c.prop.replace(/^prop\./,'')} · x ${c.x} z ${c.z} · turn ${Math.round(c.yaw*180/Math.PI)}°`}
  else{pivot.visible=false;panels.selection.textContent='Nothing picked'}
 }
 function applyCamera(){const p=cameraPose(cam);host.camera.position.set(...p.position);host.camera.lookAt(...p.target);host.camera.updateMatrixWorld?.(true)}
 // Records a change that passed the E1 rules and validateEdits; a refused one leaves everything as it was and says why.
 function commit(r,done){
  if(!r.ok){say(r.error,'error');return false}
  const problems=checkEdits(r.edits);if(problems.length){say(problems[0]+(problems.length>1?` (and ${problems.length-1} more)`:''),'error');return false}
  edits=r.edits;history.push(edits);view(edits);save();say(done);return true;
 }
 function jump(state,text){edits=state;view(edits);save();if(sel&&!selected())sel=null;say(text);refresh()}
 const pick=c=>{const s=c||selected();if(!s)say('Pick a prop first.','error');return s};
 const api={
  edits:()=>edits,summary:()=>summary(edits,shipped),selected,message:()=>lastMessage,camera:()=>cam,history,named,overlay,candidates,panels,get open(){return current===api},
  lookAt(x,z){cam={...cam,...clampGround(x,z),ty:0};applyCamera();return cam}, // aim the camera at a ground point (the test uses it to put a prop under the pointer)
  select(r){sel=r?{...r}:null;if(sel&&!selected()){sel=null;return null}refresh();return selected()},
  moveTo(x,z,{alt=false}={}){const c=pick();if(!c)return false;const p=alt?{x:r2(x),z:r2(z)}:{x:snap(x),z:snap(z)};const ok=commit(move(edits,{...target(c),x:p.x,z:p.z,yaw:c.yaw}),'Moved.');refresh();return ok},
  turnBy(dir){const c=pick();if(!c)return false;const ok=commit(turn(edits,{...target(c),x:c.x,z:c.z,yaw:turnedYaw(c.yaw,dir)}),'Turned.');refresh();return ok},
  removeSelected(){const c=pick();if(!c)return false;const ok=commit(remove(edits,target(c)),'Removed.');if(ok)sel=null;refresh();return ok},
  duplicate(){const c=pick();if(!c)return false;const r=copy(edits,{...target(c),prop:c.prop,x:snap(c.x+1),z:snap(c.z+1),yaw:c.yaw}),ok=commit(r,'Copied: the copy is picked.');if(ok)sel={id:r.id};refresh();return ok},
  undo(){const s=history.undo();if(!s){say('Nothing to undo.');return false}jump(s,'Undone.');return true},
  redo(){const s=history.redo();if(!s){say('Nothing to redo.');return false}jump(s,'Redone.');return true},
  discard(){if(json(edits)===json(shipped)){say('Nothing to discard.');return false}edits=shipped;history.push(edits);view(edits);save();if(sel&&!selected())sel=null;say('Discarded: back to the shipped scene.');refresh();return true},
  // pointer paths (also reached by the canvas listeners): a press picks and starts a drag, a move drags, a release records the move
  pointerDown(p){const c=pickAt(p,candidates());sel=ref(c);drag=c?{cand:c,start:{x:c.x,z:c.z,yaw:c.yaw},grab:p,base:edits,last:{x:c.x,z:c.z},moved:false}:null;refresh();return c},
  pointerMove(p,{alt=false}={}){
   if(!drag)return false;const pos=dragPosition(drag.start,drag.grab,p,{snapOn:!alt});if(pos.x===drag.last.x&&pos.z===drag.last.z)return false;
   const r=move(drag.base,{...target(drag.cand),x:pos.x,z:pos.z,yaw:drag.start.yaw});if(!r.ok){say(r.error,'error');return false}
   const problems=checkEdits(r.edits);if(problems.length){say(problems[0],'error');return false}
   edits=r.edits;drag.last=pos;drag.moved=true;view(edits);say('');refresh();return true;
  },
  pointerUp(){const d=drag;drag=null;if(d?.moved){if(json(edits)!==json(d.base)){history.push(edits);save();say('Moved.')}}refresh()},
  frame(dt){
   const has=(...c)=>c.some(k=>down.has(k)),f=(has('KeyW','ArrowUp')?1:0)-(has('KeyS','ArrowDown')?1:0),r=(has('KeyD','ArrowRight')?1:0)-(has('KeyA','ArrowLeft')?1:0),rise=(has('KeyE')?1:0)-(has('KeyQ')?1:0);
   if(f||r||rise){cam=stepCamera(cam,{forward:f,right:r,rise},dt);applyCamera()}
  },
  close(){
   if(current!==api)return null;
   drag=null;for(const [t,type,fn] of listeners)t.removeEventListener(type,fn);listeners.length=0;down.clear();
   host.scene.remove(grid,pivot);grid.geometry.dispose();grid.material.dispose();box.geometry.dispose();box.material.dispose();if(fog)fog.far=fogFar;
   syncOverlay(shipped);named.apply(shipped); // the game is exactly as it was; the working edit stays in localStorage
   panels.bar.hidden=panels.foot.hidden=true;document.body.classList.remove('scene-editing');
   current=null;return host.leave(); // the player is put back with placeSafely
  },
 };
 const listen=(t,type,fn)=>{t.addEventListener(type,fn);listeners.push([t,type,fn])};
 const PAN=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
 const typing=e=>!!e.target?.matches?.('input,textarea,select');
 listen(window,'keydown',e=>{
  if(typing(e))return;const code=e.code,ctrl=e.ctrlKey||e.metaKey;
  if(ctrl){
   if(code==='KeyZ'){e.preventDefault();if(!e.repeat)e.shiftKey?api.redo():api.undo()}else if(code==='KeyY'){e.preventDefault();if(!e.repeat)api.redo()}else if(code==='KeyD'){e.preventDefault();if(!e.repeat)api.duplicate()}
   return;
  }
  if(PAN.has(code)){e.preventDefault();down.add(code);return}
  if(e.repeat)return;
  if(code==='KeyR'){e.preventDefault();api.turnBy(e.shiftKey?-1:1)}
  else if(code==='Delete'||code==='Backspace'){e.preventDefault();api.removeSelected()}
  else if(code==='Escape'){e.preventDefault();if(sel){sel=null;refresh()}else api.close()}
 });
 listen(window,'keyup',e=>{down.delete(e.code)});
 listen(window,'blur',()=>down.clear());
 const point=e=>{const r=host.canvas.getBoundingClientRect();return rayGround(screenRay(cameraPose(cam),host.camera.fov,r.width/r.height,(e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height*2-1)))};
 listen(host.canvas,'pointerdown',e=>{
  try{host.canvas.setPointerCapture?.(e.pointerId)}catch{}
  if(e.button===2){orbit={x:e.clientX,y:e.clientY};return}
  if(e.button!==0)return;
  const p=point(e);if(!p){sel=null;refresh();return}api.pointerDown(p);
 });
 listen(host.canvas,'pointermove',e=>{
  if(orbit){cam=orbitCamera(cam,e.clientX-orbit.x,e.clientY-orbit.y);orbit={x:e.clientX,y:e.clientY};applyCamera();return}
  if(drag){const p=point(e);if(p)api.pointerMove(p,{alt:!!e.altKey})}
 });
 const up=e=>{if(e.button===2){orbit=null;return}api.pointerUp()};
 listen(host.canvas,'pointerup',up);listen(host.canvas,'pointercancel',()=>{orbit=null;api.pointerUp()});
 listen(host.canvas,'wheel',e=>{e.preventDefault();cam=zoomCamera(cam,e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1));applyCamera()});
 listen(host.canvas,'contextmenu',e=>e.preventDefault());
 panels.discard.onclick=()=>api.discard();panels.close.onclick=()=>api.close();

 current=api;
 document.body.classList.add('scene-editing');panels.bar.hidden=panels.foot.hidden=false;
 view(edits);applyCamera();refresh();say(json(edits)===json(shipped)?'Pick a prop to begin.':'Your earlier edit is loaded.');
 host.enter({frame:dt=>api.frame(dt)}); // from here the game is paused and input is the editor's
 return {ok:true,editor:api};
}
