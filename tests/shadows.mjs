// Shadows (dist/shadow-rules.js, dist/shadows.js; notes/visual-overhaul-design.md Stage 4). The rules are pure; the drawing is checked on three.js without a renderer.
// High: a 90 m box that moves in whole texels and fades (and skips its pass) at low sun. Low: one instanced mesh of patches, never over its capacity.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SHADOW_BOX,SHADOW_MAP,SHADOW_FAR,SHADOW_TEXEL,FADE_FROM,FADE_FULL,DAY_LIGHT,BLOB,FADE_GLSL,shadowBasis,snapShadow,bodyElevation,shadowFade,shadowPlan,blobOpacity,blobsShown,blobList} from '../dist/shadow-rules.js';
import {skyAt,lightDirection,MOODS,MIN_LIGHT_ELEVATION} from '../dist/daynight.js';

const near=(a,b,eps,msg)=>assert(Math.abs(a-b)<=eps,`${msg}: ${a} vs ${b}`);
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],clock=(h,m=0)=>h*60+m;

// --- The box ----------------------------------------------------------------------------------------------------------------
assert.equal(SHADOW_BOX,90,'the box is 90 m (it was 130 m)');assert.equal(SHADOW_MAP,2048,'one 2048 map, as before: no more memory');assert.equal(SHADOW_FAR,130);
near(SHADOW_TEXEL,90/2048,1e-12,'a texel');assert(SHADOW_TEXEL<.045,'under 4.5 cm of ground per texel (6.3 cm before)');assert.equal(DAY_LIGHT,MOODS.day.lightStrength);

// --- The axes: unit length, square to each other and to the light, for every minute of the day ------------------------------
for(let m=0;m<1440;m++){const d=lightDirection(m),{right,up}=shadowBasis(d);
 near(Math.hypot(...right),1,1e-9,'right is a unit vector');near(Math.hypot(...up),1,1e-9,'up is a unit vector');near(dot(right,up),0,1e-9,'right and up are square');near(dot(right,d),0,1e-9,'right is square to the light');near(dot(up,d),0,1e-9,'up is square to the light');assert(up[1]>0,'up points up')}
assert.deepEqual(shadowBasis([0,1,0]).right,[1,0,0],'a light straight overhead still has axes');

// --- Snapping: whole texels -------------------------------------------------------------------------------------------------
for(const m of [clock(7),clock(9,30),clock(12),clock(15,45),clock(17),clock(23),clock(2)]){
 const d=lightDirection(m),{right,up}=shadowBasis(d);
 for(const target of [[-5,0,15],[123.4567,0,-88.123],[-260.01,0,239.99],[0,0,0]]){
  const s=snapShadow(target,d),moved=target.map((v,i)=>v+s.offset[i]);
  assert(Number.isInteger(s.cell[0])&&Number.isInteger(s.cell[1]),'the cell is a whole number of texels');
  near(dot(moved,right),s.cell[0]*SHADOW_TEXEL,1e-9,'the box sits on a whole texel across');near(dot(moved,up),s.cell[1]*SHADOW_TEXEL,1e-9,'and on a whole texel up');
  near(dot(s.offset,d),0,1e-9,'the move is square to the light (the depth does not change)');
  assert(Math.abs(dot(s.offset,right))<=SHADOW_TEXEL/2+1e-9&&Math.abs(dot(s.offset,up))<=SHADOW_TEXEL/2+1e-9,'the move is at most half a texel each way');
  const again=snapShadow(moved,d);assert.deepEqual(again.cell,s.cell);assert(Math.hypot(...again.offset)<1e-9,'snapping twice changes nothing');
  // walking: a step of less than what is left of the texel keeps the box where it is; a step of k texels moves it k texels
  const small=moved.map((v,i)=>v+right[i]*SHADOW_TEXEL*.4+up[i]*SHADOW_TEXEL*-.4),s2=snapShadow(small,d);assert.deepEqual(s2.cell,s.cell,'a step under half a texel does not move the box');
  for(const k of [1,7,-250]){const far=moved.map((v,i)=>v+right[i]*SHADOW_TEXEL*k+up[i]*SHADOW_TEXEL*-k),s3=snapShadow(far,d);assert.deepEqual(s3.cell,[s.cell[0]+k,s.cell[1]-k],`a step of ${k} texels moves the box ${k} texels`)}
 }
}
{const d=lightDirection(720),a=snapShadow([10,0,10],d,.5);assert(Math.abs(dot([10,0,10],shadowBasis(d).right)+dot(a.offset,shadowBasis(d).right)-a.cell[0]*.5)<1e-9,'the texel size can be given')}

// --- The fade by the real height of the sun or moon -------------------------------------------------------------------------
assert.equal(FADE_FROM,6);assert.equal(FADE_FULL,12);assert(FADE_FROM<MIN_LIGHT_ELEVATION&&MIN_LIGHT_ELEVATION<FADE_FULL,'the light direction stops at 8 degrees, inside the fade');
for(const e of [0,2,5.99,6])assert.equal(shadowFade(e),0,`no shadow at ${e} degrees`);for(const e of [12,12.01,30,55,90])assert.equal(shadowFade(e),1,`full shadow at ${e} degrees`);
{let last=0;for(let e=0;e<=20;e+=.05){const f=shadowFade(e);assert(f>=last&&f>=0&&f<=1,'the fade only rises');last=f}}
near(shadowFade(9),.5,1e-9,'half way at 9 degrees');
let off=0,previous=shadowPlan({sky:skyAt(1439)}).strength;
for(let m=0;m<1440;m++){const sky=skyAt(m),p=shadowPlan({sky}),e=bodyElevation(sky);
 assert(e>=0&&e<=56,'the body is never higher than 55 degrees: '+e);assert(p.strength>=0&&p.strength<=1);assert.equal(p.draw,p.strength>0,'the pass runs exactly while there is a shadow to see');
 assert(Math.abs(p.strength-previous)<.08,'no jump from one minute to the next at '+m);previous=p.strength;if(!p.draw)off++;
 if(p.strength>0)assert(sky.lightDir[1]>=Math.sin(MIN_LIGHT_ELEVATION*Math.PI/180)-1e-9)}
for(const m of [clock(6),clock(18),clock(5,45),clock(18,20)])assert.equal(shadowPlan({sky:skyAt(m)}).strength,0,'no shadow at the horizon: '+m);
for(const m of [clock(12),clock(0),clock(9),clock(15),clock(21),clock(3)])assert.equal(shadowPlan({sky:skyAt(m)}).strength,1,'full shadow by day and under the moon: '+m);
assert(off>=90&&off<=140,'the shadow pass is skipped for about two game hours a day: '+off);
assert.deepEqual(shadowPlan({sky:skyAt(720),enabled:false}),{strength:1,draw:false},'Low quality and the dev switch: no pass');
assert.deepEqual(shadowPlan({sky:skyAt(360),indoors:true}),{strength:1,draw:true},'a room in the world scene keeps its noon light and its shadows');
assert(FADE_GLSL.includes('shadowRadius')&&FADE_GLSL.startsWith('return mix( 1.0, shadow,'));

// --- Patches (Low): how dark, when, which ------------------------------------------------------------------------------------
near(blobOpacity(skyAt(720)),BLOB.opacity,1e-9,'noon');near(blobOpacity(skyAt(360)),0,1e-6,'nothing at sunrise');near(blobOpacity(skyAt(1080)),0,1e-6,'nothing at sunset');
{const night=blobOpacity(skyAt(0));assert(night>.08&&night<.25,'faint under the moon: '+night);let prev=blobOpacity(skyAt(1439));
 for(let m=0;m<1440;m++){const o=blobOpacity(skyAt(m));assert(o>=0&&o<=BLOB.opacity+1e-9);assert(Math.abs(o-prev)<.09,'no jump at '+m);prev=o}}
assert.equal(blobsShown({low:true,outdoors:true,opacity:.3}),true);assert.equal(blobsShown({low:false,outdoors:true,opacity:.3}),false,'never on High');
assert.equal(blobsShown({low:true,outdoors:false,opacity:.3}),false,'never in a room');assert.equal(blobsShown({low:true,outdoors:true,opacity:.01}),false,'not when too faint to see');
{const people=[{x:0,y:1,z:0},{x:10,y:0,z:0},{x:500,y:0,z:0}],vehicles=[{x:5,y:.2,z:5,hx:1.09,hz:3,yaw:1},{x:0,y:0,z:79},{x:0,y:0,z:81},{x:NaN,z:0}],list=blobList({people,vehicles,centre:{x:0,z:0}});
 assert.equal(list.length,4,'only what is within range');assert.deepEqual(list.map(b=>b.box),[0,0,1,1]);
 assert.deepEqual([list[0].sx,list[0].sz,list[0].y],[BLOB.person*2,BLOB.person*2,1],'a person: a round patch at the feet');
 near(list[2].sx,1.09*2*BLOB.vehiclePad,1e-9,'a vehicle: a little wider than its hull');near(list[2].sz,3*2*BLOB.vehiclePad,1e-9,'and longer');assert.equal(list[2].yaw,1);
 assert.deepEqual([list[3].sx,list[3].sz],[BLOB.fallback.hx*2*BLOB.vehiclePad,BLOB.fallback.hz*2*BLOB.vehiclePad],'a vehicle without a size gets a car\'s');
 const crowd=Array.from({length:200},(_,i)=>({x:i*.3,y:0,z:0})),kept=blobList({people:crowd,vehicles,centre:{x:0,z:0}});
 assert.equal(kept.length,BLOB.capacity,'never more than fit');assert(kept.every(b=>Math.hypot(b.x,b.z)<=Math.hypot(kept.at(-1).x,kept.at(-1).z)+1e-9),'the nearest are kept');assert(kept.some(b=>b.box)&&kept[0].x===0);
 assert.equal(blobList().length,0);assert(BLOB.capacity<=64&&BLOB.range<=155,'small, and nothing beyond the fog')}

// --- On three.js, without a renderer -----------------------------------------------------------------------------------------
{const THREE=await import('../dist/vendor/three.module.js'),{createShadows,installShadowFade,parkedCars}=await import('../dist/shadows.js'),{MAP}=await import('../dist/map-definition.js');
 const before=THREE.ShaderChunk.shadowmap_pars_fragment;assert(!before.includes(FADE_GLSL));
 const scene=new THREE.Scene();scene.fog=new THREE.Fog('#000',65,155);const sun=new THREE.DirectionalLight('#fff',3.1);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-65,right:65,top:65,bottom:-65,far:130});scene.add(sun,new THREE.HemisphereLight());
 const renderer={shadowMap:{enabled:true}},ground=(x,z)=>.01*x+.2,walkers=[],cars=[];
 const count=()=>{let lights=0,objects=0;scene.traverse(o=>{objects++;if(o.isLight)lights++});return {lights,objects}},was=count();
 const shadows=createShadows({scene,renderer,sun,footing:ground,people:()=>walkers,vehicles:()=>cars});
 assert.deepEqual(count(),{lights:was.lights,objects:was.objects+1},'one object added, no light');assert.equal(shadows.faded,true);
 // the box
 const cam=sun.shadow.camera;assert.deepEqual([cam.left,cam.right,cam.top,cam.bottom,cam.far],[-45,45,45,-45,130],'a 90 m box');assert.equal(sun.shadow.mapSize.x*sun.shadow.mapSize.y,2048*2048,'the same map: 2048 x 2048');
 near(cam.projectionMatrix.elements[0],2/90,1e-9,'the projection was rebuilt for the new box');
 // the fade is in the shader text once, only in getShadow, and installing it again changes nothing
 const chunk=THREE.ShaderChunk.shadowmap_pars_fragment;assert.equal(chunk.split(FADE_GLSL).length,2,'the fade is in the shadow lookup once');assert.equal(chunk.length,before.length-'return shadow;'.length+FADE_GLSL.length);
 assert(chunk.indexOf(FADE_GLSL)>chunk.indexOf('float getShadow(')&&chunk.indexOf(FADE_GLSL)<chunk.indexOf('vec2 cubeToUV'),'inside getShadow, before the point-light code');
 assert.equal(installShadowFade(),true);assert.equal(THREE.ShaderChunk.shadowmap_pars_fragment,chunk);
 assert.equal(new THREE.DirectionalLight().shadow.radius,1,'every other light keeps full shadows (radius 1)');
 // a frame: what sky.js does, then shadows.update
 const place=(minutes,x,z)=>{const s=skyAt(minutes);sun.position.set(x+s.lightDir[0]*60,s.lightDir[1]*60,z+s.lightDir[2]*60);sun.target.position.set(x,0,z);return s};
 const blobs=shadows.blobs;assert.equal(blobs.name,'blob-shadows');assert(blobs.isInstancedMesh&&!blobs.visible&&!blobs.castShadow&&!blobs.receiveShadow&&!blobs.material.depthWrite&&blobs.material.transparent);
 assert.equal(blobs.geometry.index.count/3*BLOB.capacity,96,'at most 96 triangles');assert.equal(blobs.instanceMatrix.count,BLOB.capacity);
 // High at noon: snapped, full strength, pass on, no patches
 {const s=place(720,-5.013,15.027),d=s.lightDir,{right,up}=shadowBasis(d),st=shadows.update({sky:s,low:false,centre:{x:-5,z:15}});
  const t=sun.target.position.toArray(),p=sun.position.toArray();near(dot(t,right)/SHADOW_TEXEL,Math.round(dot(t,right)/SHADOW_TEXEL),1e-6,'the target sits on a texel across');near(dot(t,up)/SHADOW_TEXEL,Math.round(dot(t,up)/SHADOW_TEXEL),1e-6,'and up');
  p.forEach((v,i)=>near(v-t[i],d[i]*60,1e-9,'the light still stands 60 m off in the same direction'));assert(Math.hypot(t[0]+5.013,t[1],t[2]-15.027)<SHADOW_TEXEL,'and has moved less than a texel');
  assert.deepEqual([st.strength,st.pass,st.blobs,st.drawCalls],[1,true,0,0]);assert.equal(sun.shadow.radius,1);assert.equal(sun.shadow.autoUpdate,true);assert.equal(blobs.visible,false,'High has no patches');
  const again=shadows.update({sky:place(720,-5.013+SHADOW_TEXEL*.3,15.027),low:false});assert.deepEqual(again.cell,st.cell,'a small step does not move the box');near(sun.target.position.x,t[0],1e-9,'not at all')}
 // High at 06:10 and 17:50: faded out and the pass is skipped; back on later
 for(const m of [clock(6,10),clock(17,50)]){const st=shadows.update({sky:place(m,0,0),low:false});assert.deepEqual([st.strength,st.pass],[0,false]);assert.equal(sun.shadow.radius,0);assert.equal(sun.shadow.autoUpdate,false,'no shadow pass at '+m)}
 {const st=shadows.update({sky:place(clock(6,45),0,0),low:false});assert(st.strength>0&&st.strength<1&&st.pass&&sun.shadow.autoUpdate,'fading in at 06:45: '+st.strength);near(sun.shadow.radius,st.strength,1e-12,'the strength rides on shadow.radius')}
 {const st=shadows.update({sky:place(0,0,0),low:false});assert.deepEqual([st.strength,st.pass],[1,true],'moon shadows are on')}
 // a room in the world scene: full shadows whatever the clock says
 {const st=shadows.update({sky:place(clock(6,10),0,0),low:false,indoors:true,outdoors:false});assert.deepEqual([st.strength,st.pass],[1,true])}
 // the dev switch or Low: the renderer's switch is off, so no pass is reported
 renderer.shadowMap.enabled=false;assert.equal(shadows.update({sky:place(720,0,0),low:false}).pass,false);assert.equal(blobs.visible,false,'the dev switch alone shows no patches');
 // Low: patches under people, moving vehicles and the scenery cars near the player
 const parked=parkedCars();assert.equal(parked.length,MAP.landmarks.filter(l=>l.decor&&/^(park|car)-/.test(l.id)).length);assert(parked.length>=19&&parked.every(c=>c.hx>.5&&c.hx<1.6&&c.hz>1.2&&c.hz<3.5),'every scenery car has a size: '+parked.length);
 const person=(x,z)=>{const o=new THREE.Object3D();o.position.set(x,ground(x,z),z);return o},truck=new THREE.Group();truck.position.set(-2,ground(-2,20),20);truck.rotation.y=.7;
 walkers.push(null,person(-5,15),person(-8,12));const hidden=person(-6,14);hidden.visible=false;walkers.push(hidden);cars.push({mesh:truck,hx:1.09,hz:3},{mesh:Object.assign(new THREE.Group(),{visible:false}),hx:1,hz:2});
 const nearParked=parked.filter(c=>Math.hypot(c.x+5,c.z-15)<=BLOB.range).length;assert(nearParked>=3,'Oak Street has scenery cars');
 {const st=shadows.update({sky:place(720,-5,15),low:true,centre:{x:-5,z:15}});assert.equal(st.blobs,2+1+nearParked,'two people, one truck and the scenery cars; hidden things get none');assert.equal(blobs.count,st.blobs);assert.equal(blobs.visible,true);assert.equal(st.drawCalls,1,'one draw call');
  near(blobs.material.uniforms.uOpacity.value,BLOB.opacity,1e-9,'noon');
  const m=new THREE.Matrix4(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();blobs.getMatrixAt(0,m);m.decompose(p,q,s);
  near(p.x,-5,.01,'under the first person');near(p.y,ground(-5,15)+BLOB.lift,.001,'just above the ground');near(s.x,BLOB.person*2,1e-6,'its size');assert.equal(blobs.geometry.attributes.aBox.array[0],0);
  const upv=new THREE.Vector3(0,1,0).applyQuaternion(q);near(upv.x,-.01,.001,'laid on the slope');
  blobs.getMatrixAt(2,m);m.decompose(p,q,s);near(p.x,-2,.01,'under the truck');near(s.z,3*2*BLOB.vehiclePad,1e-6,'as long as the truck');assert.equal(blobs.geometry.attributes.aBox.array[2],1);
  near(new THREE.Euler().setFromQuaternion(q,'YXZ').y,.7,1e-6,'turned with the truck')}
 for(let i=0;i<120;i++)walkers.push(person(-5+i*.2,15));
 {const st=shadows.update({sky:place(720,-5,15),low:true,centre:{x:-5,z:15}});assert.equal(st.blobs,BLOB.capacity,'a crowd never overflows the mesh');assert.equal(blobs.count,BLOB.capacity)}
 assert.equal(shadows.update({sky:place(360,-5,15),low:true,centre:{x:-5,z:15}}).blobs,0,'no patches at sunrise');assert.equal(blobs.visible,false);
 assert.equal(shadows.update({sky:place(720,-5,15),low:true,outdoors:false,centre:{x:-5,z:15}}).drawCalls,0,'none in a room');
 assert.equal(shadows.update({sky:place(720,-5,15),low:false,centre:{x:-5,z:15}}).drawCalls,0,'none on High');
 assert.deepEqual(count(),{lights:was.lights,objects:was.objects+1},'nothing was added or removed while it ran');
}

// --- The wiring in game.js (read as text: the packaged game is checked by the release's own tests) ----------------------------
{const game=await readFile(new URL('../dist/game.js',import.meta.url),'utf8');
 assert(game.includes("import {createShadows} from './shadows.js'")&&game.includes('const shadows=createShadows({scene,renderer,sun,'),'game.js creates the shadows');
 assert(game.indexOf('shadows.update(')>game.indexOf('sky.update(GameState.progress.routine.minutes'),'and updates them after the sky has placed the light');
 assert(/function applyQuality\(value\)\{const high=value==='high';[^\n]*renderer\.shadowMap\.enabled=high;/.test(game),'Low still switches the shadow map off');
 assert(game.includes('setShadows(on){renderer.shadowMap.enabled=!!on;'),'the dev panel\'s Shadows switch still works on the renderer');
 assert(game.includes('sun.shadow.mapSize.set(2048,2048)'),'one 2048 map')}

console.log(`Shadows: a ${SHADOW_BOX} m box (${(SHADOW_TEXEL*100).toFixed(1)} cm a texel) that moves in whole texels; fade 0 under ${FADE_FROM} degrees and 1 over ${FADE_FULL}, the pass skipped for ${off} of 1,440 minutes; moon shadows on; Low: one mesh of at most ${BLOB.capacity} patches (96 triangles, 1 draw call), none on High, indoors or at the horizon.`);
