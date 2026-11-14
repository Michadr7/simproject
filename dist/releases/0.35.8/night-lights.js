// Night lights on three.js (notes/visual-overhaul-design.md, section 14). The rules are night-lights-rules.js (pure, tested); this file only draws what they say.
// Nothing here is a real light except the player's own headlight on High (one SpotLight, in the scene only while it is dark). Everything else glows:
//   street lamps   the heads' material brightens (0 draw calls), a soft sprite at each head and a round patch on the ground under it
//   windows        each Kenney building's own material gets an emissive map made from its texture (the glass swatch), one number per building (0 draw calls);
//                  the old city's window boxes swap between a dark and a lit material (0 draw calls)
//   vehicles       two white sprites in front, two red behind, and a fan of light on the ground ahead
// All sprites (lamps and vehicles) are ONE instanced mesh and all ground patches (lamp pools and beams) are ONE mesh: +2 draw calls while it is dark, 0 by day.
// Glow does not light what stands in it: a person or a wall in a lamp's pool stays dark. That is the price of "no real lights".
import * as THREE from './vendor/three.module.js';
import {MAP} from './map-definition.js';
import {propInfo} from './props.js';
import {CLASSES} from './vehicle.js';
import {LAMP,WINDOW,BEAM,BEAM_VERTICES,BEAM_INDICES,SPOT,LAMP_SPRITE,SHOW_FROM,MOVING_HOLD,MOVING_SPEED,lightLevel,isDark,glowScale,lampHeadGlow,poolShape,beamShape,lampPoints,windowsLit,windowBucket,buildingKind,GLASS_PROPS,glassMaskBytes,headlightsOn,vehicleGlow,spotlightPlan} from './night-lights-rules.js';

const sizeOf=model=>{const c=CLASSES[model];return c?{hx:c.hx,hz:c.hz}:{}};
export const MAX_VEHICLES=8; // vehicles with their lamps on at once (the player's, the two delivery trucks, later NPC cars): 4 sprites and one beam each

const SPRITE_VERTEX=`attribute vec3 aCentre;attribute vec3 aTint;attribute float aSize;attribute float aLamp;uniform float uLevel;varying vec2 vAt;varying vec3 vTint;varying float vDepth;
void main(){vAt=position.xy*2.0;vec4 mv=viewMatrix*vec4(aCentre,1.0);vDepth=-mv.z;mv.xy+=position.xy*aSize;vTint=aTint*mix(1.0,uLevel,aLamp);gl_Position=projectionMatrix*mv;}`; // always faces the camera; aLamp 1: a street lamp (follows the night), 0: a vehicle lamp (its strength is in aTint)
const SPRITE_FRAGMENT=`uniform float uFogNear,uFogFar;varying vec2 vAt;varying vec3 vTint;varying float vDepth;
void main(){float a=1.0-smoothstep(0.0,1.0,length(vAt));a=a*a+0.6*pow(a,8.0);float fog=1.0-smoothstep(uFogNear,uFogFar*1.25,vDepth);gl_FragColor=vec4(vTint*a*fog,1.0);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
const GROUND_VERTEX=`attribute vec3 aTint;attribute float aLamp;uniform float uLevel;varying vec3 vTint;varying float vDepth;
void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vDepth=-mv.z;vTint=aTint*mix(1.0,uLevel,aLamp);gl_Position=projectionMatrix*mv;}`;
const GROUND_FRAGMENT=`uniform float uFogNear,uFogFar;varying vec3 vTint;varying float vDepth;
void main(){float fog=1.0-smoothstep(uFogNear,uFogFar,vDepth);gl_FragColor=vec4(vTint*fog,1.0);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
const additive=(name,vertexShader,fragmentShader)=>new THREE.ShaderMaterial({name,vertexShader,fragmentShader,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,fog:false,uniforms:{uLevel:{value:0},uFogNear:{value:30},uFogFar:{value:120}}});

// The glass mask of a building texture, in a browser: the texture is decoded once more into a canvas and every texel the rules call glass becomes white. One mask per
// distinct texture (the Kenney kits share three palette textures of 128 px: 64 kB each). Nothing happens in Node (no Image): the buildings then simply stay dark.
function browserMask(src,done){
 if(typeof Image==='undefined'||typeof document==='undefined')return;
 const image=new Image();
 image.onload=()=>{try{const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  const mask=glassMaskBytes(ctx.getImageData(0,0,c.width,c.height).data);if(mask.count)done(maskTexture(mask.bytes,c.width,c.height))}catch{}};
 image.src=src;
}
export function maskTexture(bytes,width,height){const t=new THREE.DataTexture(bytes,width,height,THREE.RGBAFormat);t.flipY=false;t.magFilter=t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;t.needsUpdate=true;t.name='glass-mask';return t}

// scene: the world scene (the lamp heads 'street-lamp-heads' and the landmark meshes 'prop-<model>' are found in it by name: world.js is not changed).
// footing(x, z): the ground height. cityWindows: [{mesh, id}] the old city's window boxes (game.js). cityLampHeads: the six hand-built Oak Street lamp heads (game.js).
// makeMask(src, done): for tests; the default decodes the texture in the browser.
export function createNightLights({scene,footing=()=>0,cityWindows=[],cityLampHeads=[],makeMask=browserMask}){
 const warm=new THREE.Color(LAMP.colour),m4=new THREE.Matrix4(),v=new THREE.Vector3(),v2=new THREE.Vector3();
 // ── Street lamps: where the heads are (read back from the instanced mesh world.js built) ──
 const heads=scene.getObjectByName('street-lamp-heads')||null,lamps=[];
 if(heads?.isInstancedMesh)for(let i=0;i<heads.count;i++){heads.getMatrixAt(i,m4);v.setFromMatrixPosition(m4);lamps.push({x:v.x,y:v.y,z:v.z})}
 let cityHeadMaterial=null;
 if(cityLampHeads.length){cityHeadMaterial=cityLampHeads[0].material.clone();cityHeadMaterial.name='city-lamp-heads';cityHeadMaterial.emissive=warm.clone();cityHeadMaterial.emissiveIntensity=0;for(const mesh of cityLampHeads){mesh.material=cityHeadMaterial;lamps.push({x:mesh.position.x,y:mesh.position.y,z:mesh.position.z})}}

 // ── Sprites: one instanced quad per lamp, then four per lit vehicle ──
 const spriteCapacity=lamps.length+MAX_VEHICLES*4,centre=new Float32Array(spriteCapacity*3),tint=new Float32Array(spriteCapacity*3),size=new Float32Array(spriteCapacity),isLamp=new Float32Array(spriteCapacity);
 lamps.forEach((l,i)=>{centre.set([l.x,l.y-LAMP.haloDrop,l.z],i*3);tint.set([warm.r*LAMP.haloStrength,warm.g*LAMP.haloStrength,warm.b*LAMP.haloStrength],i*3);size[i]=LAMP.haloSize;isLamp[i]=1});
 const spriteGeometry=new THREE.InstancedBufferGeometry();
 spriteGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0]),3));spriteGeometry.setIndex([0,1,2,0,2,3]);
 const aCentre=new THREE.InstancedBufferAttribute(centre,3),aTint=new THREE.InstancedBufferAttribute(tint,3),aSize=new THREE.InstancedBufferAttribute(size,1);
 for(const a of [aCentre,aTint,aSize])a.setUsage(THREE.DynamicDrawUsage);
 spriteGeometry.setAttribute('aCentre',aCentre);spriteGeometry.setAttribute('aTint',aTint);spriteGeometry.setAttribute('aSize',aSize);spriteGeometry.setAttribute('aLamp',new THREE.InstancedBufferAttribute(isLamp,1));spriteGeometry.instanceCount=lamps.length;
 const sprites=new THREE.Mesh(spriteGeometry,additive('night-sprites',SPRITE_VERTEX,SPRITE_FRAGMENT));
 sprites.name='night-sprites';sprites.frustumCulled=false;sprites.renderOrder=6;sprites.visible=false;sprites.castShadow=sprites.receiveShadow=false;

 // ── Ground patches: a round pool under every lamp (built once, laid on the ground's height), then one beam per lit vehicle (rewritten each frame) ──
 const pool=poolShape(),beam=beamShape(0),poolV=pool.vertices.length,poolI=pool.indices.length,groundVertices=lamps.length*poolV+MAX_VEHICLES*BEAM_VERTICES;
 const gPos=new Float32Array(groundVertices*3),gTint=new Float32Array(groundVertices*3),gLamp=new Float32Array(groundVertices),gIndex=new Uint16Array(lamps.length*poolI+MAX_VEHICLES*BEAM_INDICES);
 lamps.forEach((l,i)=>{const base=i*poolV;pool.vertices.forEach(([dx,dz,s],k)=>{const x=l.x+dx,z=l.z+dz,o=(base+k)*3,g=s*LAMP.poolStrength;gPos.set([x,footing(x,z)+LAMP.poolLift,z],o);gTint.set([warm.r*g,warm.g*g,warm.b*g],o);gLamp[base+k]=1});pool.indices.forEach((n,k)=>{gIndex[i*poolI+k]=base+n})});
 const beamBase=lamps.length*poolV,beamIndexBase=lamps.length*poolI;
 for(let b=0;b<MAX_VEHICLES;b++)beam.indices.forEach((n,k)=>{gIndex[beamIndexBase+b*BEAM_INDICES+k]=beamBase+b*BEAM_VERTICES+n});
 const groundGeometry=new THREE.BufferGeometry(),gPosA=new THREE.BufferAttribute(gPos,3),gTintA=new THREE.BufferAttribute(gTint,3);gPosA.setUsage(THREE.DynamicDrawUsage);gTintA.setUsage(THREE.DynamicDrawUsage);
 groundGeometry.setAttribute('position',gPosA);groundGeometry.setAttribute('aTint',gTintA);groundGeometry.setAttribute('aLamp',new THREE.BufferAttribute(gLamp,1));groundGeometry.setIndex(new THREE.BufferAttribute(gIndex,1));groundGeometry.setDrawRange(0,beamIndexBase);
 const ground=new THREE.Mesh(groundGeometry,additive('night-ground',GROUND_VERTEX,GROUND_FRAGMENT));
 ground.material.polygonOffset=true;ground.material.polygonOffsetFactor=-1;ground.material.polygonOffsetUnits=-2;
 ground.name='night-ground';ground.frustumCulled=false;ground.renderOrder=5;ground.visible=false;ground.castShadow=ground.receiveShadow=false;
 scene.add(ground,sprites);

 // ── Windows ──
 // Kenney buildings: found by their model's mesh name at the landmark's spot. Each has its own material (props.js makes one per building), so one number lights one building.
 const propMeshes=[];scene.traverse(o=>{if(o.isMesh&&o.name.startsWith('prop-'))propMeshes.push(o)});
 const buildings=[],masks=new Map();let stale=true; // stale: the windows must be worked out again (a mask arrived)
 for(const l of MAP.landmarks){
  if(!GLASS_PROPS(l.prop))continue;
  const mesh=propMeshes.find(o=>o.name==='prop-'+l.prop&&Math.abs(o.position.x-l.x)<.01&&Math.abs(o.position.z-l.z)<.01),material=mesh&&!Array.isArray(mesh.material)?mesh.material:null;
  if(!material?.emissive)continue;
  const b={id:l.id,landmark:l,property:MAP.properties.find(p=>p.landmark===l.id)||null,material,ready:false,lit:false,kind:null};buildings.push(b);
  const src=propInfo(l.prop).texture;if(!src)continue;
  if(!masks.has(src)){const entry={texture:null,users:[]};masks.set(src,entry);makeMask(src,texture=>{entry.texture=texture;for(const u of entry.users)attach(u,texture)})}
  const entry=masks.get(src);if(entry.texture)attach(b,entry.texture);else entry.users.push(b);
 }
 function attach(b,texture){b.material.emissiveMap=texture;b.material.emissive.set(WINDOW.colour);b.material.emissiveIntensity=0;b.material.needsUpdate=true;b.ready=true;stale=true} // the one recompile per building material, at load
 // The old city: every window box is a flat of its own. Two shared materials, dark (as built) and lit; a window swaps between them.
 const cityDark=cityWindows[0]?.mesh.material||null,cityLit=cityDark?cityDark.clone():null;
 if(cityLit){cityLit.name='city-window-lit';cityLit.emissive=new THREE.Color(WINDOW.colour);cityLit.emissiveIntensity=0}
 const flats=cityWindows.map((w,i)=>({mesh:w.mesh,id:(w.id||'city')+'#'+i,lit:false}));

 let bucket=-1,dark=false,heldKey='',level=0,scale=1,litCount=0,ownOn=false,spot=null,spotIn=false,vehicleSprites=0,beams=0;
 const tracked=new Map(); // key -> {x, z, hold}: the vehicles that count as in use while they move
 function refreshWindows(minutes,held){
  litCount=0;
  for(const b of buildings){b.kind=buildingKind(b.landmark,b.property,held.includes(b.id));b.lit=b.ready&&windowsLit(b.id,minutes,{kind:b.kind,dark});if(b.lit)litCount++}
  for(const f of flats){const lit=windowsLit(f.id,minutes,{kind:'home',dark});if(lit!==f.lit){f.lit=lit;f.mesh.material=lit?cityLit:cityDark}if(lit)litCount++}
 }
 // Lamp sprites and the beam of one vehicle, written into slot n. mesh: the vehicle's root (its matrix gives the pose, tilt included).
 function writeVehicle(n,source,strength,beamShare){
  const mesh=source.mesh,info=sizeOf(source.model),points=lampPoints(source.model,info),s0=lamps.length+n*4;mesh.updateMatrixWorld();
  [...points.front,...points.rear].forEach((p,k)=>{const front=k<2,i=s0+k,c=front?LAMP_SPRITE.front:LAMP_SPRITE.rear,g=(front?LAMP_SPRITE.frontStrength:LAMP_SPRITE.rearStrength)*strength;
   v.set(p[0],p[1],p[2]).applyMatrix4(mesh.matrixWorld);centre.set([v.x,v.y,v.z],i*3);tint.set([c[0]*g,c[1]*g,c[2]*g],i*3);size[i]=front?LAMP_SPRITE.frontSize:LAMP_SPRITE.rearSize});
  const hz=info.hz||2.2,yaw=mesh.rotation.y,sin=Math.sin(yaw),cos=Math.cos(yaw),g0=beamBase+n*BEAM_VERTICES;
  beam.vertices.forEach(([lx,lz,s],k)=>{const z0=lz+hz,x=mesh.position.x+lx*cos+z0*sin,z=mesh.position.z-lx*sin+z0*cos,o=(g0+k)*3,g=s*BEAM.strength*strength*beamShare;gPos.set([x,footing(x,z)+LAMP.poolLift+.01,z],o);gTint.set([BEAM.colour[0]*g,BEAM.colour[1]*g,BEAM.colour[2]*g],o)});
 }
 function setSpot(plan,source){
  if(plan.present&&!spot){spot=new THREE.SpotLight(SPOT.colour,0,SPOT.distance,SPOT.angle,SPOT.penumbra,SPOT.decay);spot.name='player-headlight';spot.castShadow=false}
  if(plan.present&&!spotIn){scene.add(spot,spot.target);spotIn=true}                     // one recompile: the light count changed (the hitch the user accepted)
  if(!plan.present&&spotIn){scene.remove(spot,spot.target);spotIn=false}                  // and one more when day comes or the quality drops to Low
  if(!spotIn)return;
  spot.intensity=source?plan.intensity*scale:0;
  if(source){const hz=sizeOf(source.model).hz||2.2;source.mesh.updateMatrixWorld();spot.position.set(0,SPOT.height,hz).applyMatrix4(source.mesh.matrixWorld);spot.target.position.set(0,SPOT.height-SPOT.aimDrop,hz+SPOT.aimAhead).applyMatrix4(source.mesh.matrixWorld);spot.target.updateMatrixWorld()}
 }

 // dt: seconds. sky: sky.state() (what skyAt returned for the picture). high: High quality. held: the ids of the homes the player rents or owns.
 // vehicles: [{key, mesh, model, use:'driver'|'moving'|'parked', mode, own}] the vehicles that may have lamps on: 'driver' is in use now (the player drives it),
 // 'moving' is in use while it moves (the delivery trucks). own: the player's (it gets the SpotLight on High).
 function update(dt,{sky,high=false,held=[],vehicles=[]}={}){
  if(!sky)return state();
  level=lightLevel(sky);const nowDark=isDark(sky),b=windowBucket(sky.minutes),key=held.join(',');
  if(stale||b!==bucket||nowDark!==dark||key!==heldKey){stale=false;bucket=b;dark=nowDark;heldKey=key;refreshWindows(b,held)}
  const shown=level>SHOW_FROM,fog=scene.fog;
  // lamps and windows: numbers only
  if(heads?.material)heads.material.emissiveIntensity=lampHeadGlow(level)*(1+(scale-1)*level);
  if(cityHeadMaterial)cityHeadMaterial.emissiveIntensity=LAMP.headNight*level*scale;
  const glow=WINDOW.strength*level*scale;for(const bd of buildings)if(bd.ready)bd.material.emissiveIntensity=bd.lit?glow:0;if(cityLit)cityLit.emissiveIntensity=glow;
  // vehicles
  let n=0,own=null;ownOn=false;
  for(const source of vehicles){
   if(!source?.mesh)continue;let inUse=source.use==='driver';
   if(source.use==='moving'){const t=tracked.get(source.key)||{x:source.mesh.position.x,z:source.mesh.position.z,hold:0},d=Math.hypot(source.mesh.position.x-t.x,source.mesh.position.z-t.z);t.x=source.mesh.position.x;t.z=source.mesh.position.z;
    t.hold=source.mesh.visible&&dt>0&&d/dt>MOVING_SPEED?MOVING_HOLD:Math.max(0,t.hold-dt);tracked.set(source.key,t);inUse=source.mesh.visible&&t.hold>0}
   const on=headlightsOn({inUse,dark,mode:source.mode||'auto'});if(source.own)ownOn=on;
   if(!on||n>=MAX_VEHICLES)continue;
   const plan=source.own?spotlightPlan({high,on:true,level,present:spotIn}):null;if(source.own)own={source,plan};
   writeVehicle(n++,source,vehicleGlow(level)*scale,plan?.present?BEAM.spotShare:1);
  }
  setSpot(own?own.plan:spotlightPlan({high,on:false,level,present:spotIn}),own?.source||null);
  vehicleSprites=n*4;beams=n;
  spriteGeometry.instanceCount=lamps.length+vehicleSprites;groundGeometry.setDrawRange(0,beamIndexBase+n*BEAM_INDICES);
  if(n){aCentre.needsUpdate=aTint.needsUpdate=aSize.needsUpdate=true;gPosA.needsUpdate=gTintA.needsUpdate=true}
  sprites.visible=ground.visible=shown||n>0;
  for(const m of [sprites.material,ground.material]){m.uniforms.uLevel.value=shown?level*scale:0;if(fog){m.uniforms.uFogNear.value=fog.near;m.uniforms.uFogFar.value=fog.far}}
  return state();
 }
 // What is on now (the dev panel's line and the tests). drawCalls: what the night lights add to the frame.
 function state(){return {level,dark,scale,lamps:lamps.length,buildings:buildings.length,ready:buildings.filter(b=>b.ready).length,flats:flats.length,windowsLit:litCount,vehicleSprites,beams,spot:spotIn,spotIntensity:spotIn?spot.intensity:0,ownOn,drawCalls:(sprites.visible?1:0)+(ground.visible?1:0)}}
 // The dev panel's "Lights" slider: every glow times this (0.25 to 3); null puts 1 back.
 function tune(values={}){if('scale' in values)scale=values.scale===null?1:glowScale(values.scale);return {scale}}
 return {sprites,ground,buildings,flats,lamps,update,state,tune,tuning:()=>({scale}),get ownOn(){return ownOn}};
}
