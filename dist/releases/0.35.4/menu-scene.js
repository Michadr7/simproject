// The live main-menu scene (notes/menu-scene-design.md): a forest clearing, a vehicle, and the player's character leaning on it reading the day's
// logging plans. Built only from what the game already has: props.js (the vehicle, logs), nature.js (pines), character.js (the character, its lean and reach).
// Every motion comes from menu-scene-rules.js (pure functions of time). game.js owns the renderer and calls update() then render() at a low frame rate.
// Budget: 1 skinned character, about 16 draw calls, 16 tree instances, no shadow pass, 36 dust points, 1,570 ground-cover instances (2 draw calls, wind in the shader).
import * as THREE from './vendor/three.module.js';
import {createProp,createPropInstances,propInfo} from './props.js';import {applyPaint} from './paint-shader.js';
import {PINES,modelGeometry,createNatureMaterials} from './nature.js';
import {MENU_VEHICLE,leanSpot,menuPose,windSway,hazeAt,MENU_PLANS,plansOps,MENU_COVER,groundCover,coverShape,COVER_WIND} from './menu-scene-rules.js';

const SOLID={apply:m=>m},DUST=36;
// Trees stand in a ring behind and beside the clearing, never between the camera and the character. [x, z, model index, scale, phase]
export const MENU_TREES=Array.from({length:16},(_,i)=>{const a=2.1+i*.29+(i%3)*.05,r=9+(i*7%5)*1.9;return [Math.cos(a)*r-1,Math.sin(a)*r*.9-2,i%PINES.length,.85+(i*5%4)*.1,i*1.37]});
const LOGS=[{x:-1.2,z:4.6,yaw:1.45},{x:-1.25,z:5.45,yaw:1.5},{x:-1.15,z:5.02,y:.72,yaw:1.47},{x:3.4,z:-3.2,yaw:.3}];

// The plans sheet as a texture: plansOps() replayed on a canvas, 2 px per millimetre. null where there is no canvas (the sheet then keeps its plain panel).
function plansTexture(){
 if(typeof document==='undefined')return null;
 const k=2,canvas=document.createElement('canvas');canvas.width=MENU_PLANS.width*k;canvas.height=MENU_PLANS.height*k;const ctx=canvas.getContext?.('2d');if(!ctx)return null;
 ctx.scale(k,k);ctx.lineJoin='round';ctx.lineCap='round';
 for(const o of plansOps()){ctx.fillStyle=o.colour;ctx.strokeStyle=o.colour;
  if(o.op==='circle'){ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.fill()}
  else if(o.op==='text'){ctx.font=`bold ${o.size}px sans-serif`;ctx.textAlign=o.align||'center';ctx.fillText(o.text,o.x,o.y)}
  else{ctx.beginPath();o.points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(o.op==='fill')ctx.fill();else{ctx.lineWidth=o.width;ctx.setLineDash(o.dash||[]);ctx.stroke()}}}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;texture.center.set(.5,.5);texture.rotation=Math.PI; // turned so it reads the right way up for the character
 return texture;
}
// A tuft or fern (coverShape) as a geometry: every triangle twice (both windings) with the normal straight up, so it is lit like the ground from either side.
function coverGeometry(kind,root,tip){
 const {position,bend}=coverShape(kind),P=[],B=[],C=[],N=[],a=new THREE.Color(root),b=new THREE.Color(tip),c=new THREE.Color();
 for(const order of [[0,1,2],[0,2,1]])for(let t=0;t<bend.length;t+=3)for(const k of order){const i=t+k;P.push(position[i*3],position[i*3+1],position[i*3+2]);B.push(bend[i]);c.copy(a).lerp(b,bend[i]);C.push(c.r,c.g,c.b);N.push(0,1,0)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setAttribute('aBend',new THREE.Float32BufferAttribute(B,1));
 return g;
}
// The wind for the cover, in the vertex shader (the same formula as coverBend in menu-scene-rules.js): one uniform pair a frame, no matrices on the CPU.
function windMaterial(wind){
 const W=COVER_WIND,f=n=>n.toFixed(4),material=new THREE.MeshLambertMaterial({vertexColors:true});
 material.onBeforeCompile=shader=>{shader.uniforms.uTime=wind.uTime;shader.uniforms.uGust=wind.uGust;
  shader.vertexShader='uniform float uTime;\nuniform float uGust;\nattribute float aBend;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
#ifdef USE_INSTANCING
 {mat3 cM=mat3(instanceMatrix);vec3 cP=instanceMatrix[3].xyz;
 float cB=aBend*aBend*(${f(W.lean)}*uGust+(${f(W.sway)}+${f(W.gust)}*uGust)*sin(uTime*${f(W.speed)}-cP.x*${f(W.kx)}-cP.z*${f(W.kz)}));
 transformed+=(vec3(${f(W.x)},0.0,${f(W.z)})*cB*cM)/dot(cM[0],cM[0]);}
#endif`)};
 material.customProgramCacheKey=()=>'menu-cover';
 return material;
}

// createCharacter: character.js's (passed in so the loader is the game's one). appearance: the saved character or the default. cover: 0..1 of the ground cover (low quality draws less).
export function createMenuScene({createCharacter,appearance,vehicle=MENU_VEHICLE,cover=1}){
 const scene=new THREE.Scene(),owned=[]; // owned: geometries and materials made here (shared, cached geometry from props.js / nature.js is not ours to free)
 const own=x=>{owned.push(x);return x};
 scene.name='menu-scene';scene.background=new THREE.Color('#a9c4cf');scene.fog=new THREE.Fog('#a9c4cf',14,46);
 const hemi=new THREE.HemisphereLight('#eaf3f5','#44553a',1.5),sun=new THREE.DirectionalLight('#ffe2b8',2.4);scene.add(hemi,sun,sun.target);

 const ground=new THREE.Mesh(own(new THREE.PlaneGeometry(120,120)),own(new THREE.MeshStandardMaterial({color:'#4c6a3b',roughness:1})));ground.rotation.x=-Math.PI/2;scene.add(ground);
 const dirt=new THREE.Mesh(own(new THREE.CircleGeometry(7.5,28)),own(new THREE.MeshStandardMaterial({color:'#6d5c43',roughness:1})));dirt.rotation.x=-Math.PI/2;dirt.position.y=.01;scene.add(dirt);

 // The vehicle: whatever MENU_VEHICLE names (the swap point). Its material and texture are made per prop, so they are ours.
 const car=createProp(vehicle.prop,SOLID);car.rotation.y=vehicle.yaw;car.traverse(m=>{m.castShadow=false});scene.add(car);if(vehicle.colour){try{applyPaint(car,vehicle.prop,vehicle.colour)}catch{}}
 const logs=createPropInstances('log',LOGS,SOLID);scene.add(logs);
 const ownMaterials=root=>root.traverse(m=>{for(const mat of [].concat(m.material||[]))if(!owned.includes(mat)){owned.push(mat);if(mat.map)owned.push(mat.map)}});
 ownMaterials(car);ownMaterials(logs);

 // Pines: one InstancedMesh per model and material (6 draw calls for 16 trees). The wind moves the instance matrices.
 const nature=createNatureMaterials(SOLID);for(const m of [nature.bark,nature.pineLeaves,nature.broadleafLeaves])owned.push(m,m.map);
 const groves=PINES.map((id,k)=>{
  const spots=MENU_TREES.filter(t=>t[2]===k),meshes=['bark','leaves'].map(part=>{const mesh=new THREE.InstancedMesh(modelGeometry(id,part),part==='bark'?nature.bark:nature.pineLeaves,Math.max(1,spots.length));mesh.count=spots.length;mesh.frustumCulled=false;scene.add(mesh);return mesh});
  return {spots,meshes};
 });
 const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),at=new THREE.Vector3(),sc=new THREE.Vector3();
 function sway(t){for(const {spots,meshes} of groves){spots.forEach(([x,z,,scale,phase],i)=>{const s=windSway(t,phase);q.setFromEuler(e.set(s,phase,s*.6));m4.compose(at.set(x,0,z),q,sc.setScalar(scale));for(const mesh of meshes)mesh.setMatrixAt(i,m4)});for(const mesh of meshes)mesh.instanceMatrix.needsUpdate=true}}

 // The character: back to the hull, both hands on the plans. character.js does the lean (setLean) and the arms (reach); nothing is copied from it.
 const avatar=createCharacter(appearance),spot=leanSpot(vehicle,propInfo(vehicle.prop).width);
 avatar.group.position.set(spot.x,0,spot.z);avatar.group.rotation.y=spot.yaw;avatar.setMotion?.(0);scene.add(avatar.group);
 let sheet=null;try{sheet=plansTexture()}catch{}if(sheet)own(sheet);
 const plans=new THREE.Mesh(own(new THREE.PlaneGeometry(.46,.32)),own(new THREE.MeshStandardMaterial({color:sheet?'#ffffff':'#efe7cf',map:sheet,roughness:.95,side:THREE.DoubleSide})));plans.name='menu-plans';
 if(!sheet){const lines=new THREE.Mesh(own(new THREE.PlaneGeometry(.38,.2)),own(new THREE.MeshStandardMaterial({color:'#3f6f96',roughness:1,side:THREE.DoubleSide})));lines.position.set(0,.02,.002);plans.add(lines)}
 avatar.group.add(plans);
 const handR=new THREE.Vector3(),handL=new THREE.Vector3();let head=null,headHome=null;
 function pose(p,dt){
  const lift=p.breath*.012;
  avatar.setLean(-vehicle.lean.angle-p.shift*.015);avatar.group.rotation.z=p.shift*.012;
  avatar.reach('R',handR.set(-.22,1.29+lift,.34),1);avatar.reach('L',handL.set(.22,1.29+lift,.34),1);avatar.setHandCurl('R',.6);avatar.setHandCurl('L',.6);
  plans.position.set(0,1.31+lift,.37);plans.rotation.set(-.8+p.plans.tilt,0,p.plans.roll);
  // The head turn is laid over the animation: put the animated value back before the mixer runs, add the turn after it.
  const bone=avatar.bone('Head');if(bone!==head){head=bone;headHome=null}
  if(head&&headHome)head.quaternion.copy(headHome);
  avatar.update(dt);
  if(head){headHome=(headHome||new THREE.Quaternion()).copy(head.quaternion);head.rotateX(p.head.pitch);head.rotateY(p.head.yaw)}
 }

 // Dust in the light: a handful of points, placed by hazeAt.
 const dustGeometry=own(new THREE.BufferGeometry()),dustAt=new Float32Array(DUST*3);dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustAt,3));
 const dust=new THREE.Points(dustGeometry,own(new THREE.PointsMaterial({color:'#fff1cf',size:.05,transparent:true,opacity:.4,depthWrite:false})));dust.frustumCulled=false;dust.position.set(spot.x,0,spot.z);scene.add(dust);

 // The camera: three-quarter view of the character and the hull, the subject kept right of the menu column.
 const camera=new THREE.PerspectiveCamera(36,1,.1,90),home=new THREE.Vector3(spot.x+4.6,1.55,spot.z+4.4),look=new THREE.Vector3(spot.x-.2,1.2,spot.z-.3);
 function frame(width,height){camera.aspect=width/height;if(width>700)camera.setViewOffset(width,height,-width*.17,0,width,height);else camera.clearViewOffset();camera.updateProjectionMatrix()}

 // Ground cover: grass tufts and ferns, 2 draw calls (one InstancedMesh each, one shared material). Placed once; the wind is in the shader.
 const wind={uTime:{value:0},uGust:{value:0}},coverMaterial=own(windMaterial(wind)),coverSpots=groundCover(MENU_COVER,[{x:home.x,z:home.z,r:2.5}],cover);
 const covers=[['grass','#45603a','#86a552'],['fern','#35542d','#638f42']].map(([kind,root,tip])=>{
  const list=coverSpots.filter(s=>s.kind===kind),mesh=new THREE.InstancedMesh(own(coverGeometry(kind,root,tip)),coverMaterial,Math.max(1,list.length));mesh.count=list.length;mesh.name='menu-cover-'+kind;mesh.frustumCulled=false;
  list.forEach((s,i)=>{q.setFromEuler(e.set(0,s.yaw,0));mesh.setMatrixAt(i,m4.compose(at.set(s.x,0,s.z),q,sc.setScalar(s.scale)))});mesh.instanceMatrix.needsUpdate=true;scene.add(mesh);return mesh});

 function update(t,dt=0){
  const p=menuPose(t);wind.uTime.value=t;wind.uGust.value=p.gust;
  pose(p,dt);sway(t);
  for(let i=0;i<DUST;i++){const d=hazeAt(t,i);dustAt[i*3]=d.x;dustAt[i*3+1]=d.y;dustAt[i*3+2]=d.z}dustGeometry.attributes.position.needsUpdate=true;
  camera.position.set(home.x+p.camera.x,home.y+p.camera.y,home.z+p.camera.z);camera.lookAt(look);
  const [r,g,b]=p.light.sky;scene.background.setRGB(r,g,b);scene.fog.color.copy(scene.background);
  sun.intensity=p.light.sun;sun.color.setRGB(1,.9-.12*p.light.warmth,.74-.2*p.light.warmth);sun.position.set(look.x+9*Math.cos(p.light.angle),7-2.5*p.light.warmth,look.z+9*Math.sin(p.light.angle));sun.target.position.copy(look);
 }
 return {scene,camera,avatar,plans,vehicle:car,covers,update,frame,
  setAppearance(a){avatar.apply(a)},
  dispose(){
   avatar.clearReach?.();scene.remove(avatar.group);
   for(const mesh of avatar.meshes||[])for(const m of [].concat(mesh.material||[]))if(m.userData?.cloned)m.dispose();
   for(const {meshes} of groves)for(const mesh of meshes)mesh.dispose();for(const mesh of covers)mesh.dispose();logs.dispose?.();
   for(const x of owned)x?.dispose?.();owned.length=0;scene.clear();
  }};
}
