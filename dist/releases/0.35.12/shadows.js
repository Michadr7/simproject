// Shadows on three.js (notes/visual-overhaul-design.md, Stage 4). The numbers and rules come from shadow-rules.js (pure, tested); this file only applies them.
// High: the sun-and-moon light's one shadow map gets a 90 m box that moves in whole texels, and fades out (and stops being drawn) while the sun or moon is low.
// Low: no shadow map; ONE instanced mesh of soft dark patches under people and vehicles (+1 draw call, at most 96 triangles, no texture, no light, no render target).
// Nothing here adds or removes a light or flips a shader switch, so nothing recompiles while the game runs.
import * as THREE from './vendor/three.module.js';
import {MAP} from './map-definition.js';import {propInfo} from './props.js';
import {SHADOW_BOX,SHADOW_FAR,SHADOW_MAP,FADE_GLSL,BLOB,snapShadow,shadowPlan,blobOpacity,blobsShown,blobList} from './shadow-rules.js';

// Puts the fade into three.js's shadow lookup (the same kind of edit as sky.js's grade). Call before the first frame; calling again changes nothing.
// False if this three.js has no getShadow to edit: then shadows simply never fade.
export function installShadowFade(){
 const chunk=THREE.ShaderChunk.shadowmap_pars_fragment;
 if(chunk.includes(FADE_GLSL))return true;
 const from=chunk.indexOf('float getShadow('),at=from<0?-1:chunk.indexOf('return shadow;',from);
 if(at<0)return false;
 THREE.ShaderChunk.shadowmap_pars_fragment=chunk.slice(0,at)+FADE_GLSL+chunk.slice(at+'return shadow;'.length);return true;
}

const BLOB_VERTEX=`attribute float aBox;varying vec2 vAt;varying float vBox;varying float vDepth;
void main(){vAt=position.xz*2.0;vBox=aBox;vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.0);vDepth=-mv.z;gl_Position=projectionMatrix*mv;}`;
// A round patch for a person, a rounded box for a vehicle; soft to the edge; fades to nothing in the fog (a dark patch must not show through the haze).
const BLOB_FRAGMENT=`uniform float uOpacity;uniform float fogNear;uniform float fogFar;varying vec2 vAt;varying float vBox;varying float vDepth;
void main(){vec2 p=abs(vAt);vec2 q=p*p;q*=q;float d=mix(length(p),sqrt(sqrt(q.x+q.y)),vBox);
 float a=(1.0-smoothstep(mix(0.3,0.75,vBox),1.0,d))*uOpacity*(1.0-smoothstep(fogNear,fogFar,vDepth));
 gl_FragColor=vec4(0.0,0.0,0.0,a);}`;

// The scenery cars (map-definition.js landmarks 'park-…' and 'car-…'): they never move, so their patches are worked out once.
export const parkedCars=()=>MAP.landmarks.filter(l=>/^(park|car)-/.test(l.id)).map(l=>{const f=propInfo(l.prop).footprint;return {x:l.x,z:l.z,yaw:l.yaw||0,hx:f?(f.x1-f.x0)/2:0,hz:f?(f.z1-f.z0)/2:0}});

// scene: the world scene. renderer: only read (shadowMap.enabled). sun: the one directional light. footing(x, z): the ground height.
// people(): the Object3Ds that stand on the ground now (feet at their position). vehicles(): [{mesh, hx, hz}] the vehicles that can move. parked: [{x, z, yaw, hx, hz}] the ones that cannot.
export function createShadows({scene,renderer,sun,footing=()=>0,people=()=>[],vehicles=()=>[],parked=parkedCars()}){
 const faded=installShadowFade(),half=SHADOW_BOX/2;
 Object.assign(sun.shadow.camera,{left:-half,right:half,top:half,bottom:-half,far:SHADOW_FAR});sun.shadow.camera.updateProjectionMatrix();sun.shadow.mapSize.set(SHADOW_MAP,SHADOW_MAP);

 // ── The patches (Low) ──
 const geometry=new THREE.InstancedBufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array([-.5,0,-.5,.5,0,-.5,.5,0,.5,-.5,0,.5]),3));geometry.setIndex([0,2,1,0,3,2]);
 const box=new Float32Array(BLOB.capacity),aBox=new THREE.InstancedBufferAttribute(box,1);aBox.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('aBox',aBox);
 const material=new THREE.ShaderMaterial({name:'blob-shadows',vertexShader:BLOB_VERTEX,fragmentShader:BLOB_FRAGMENT,transparent:true,depthWrite:false,fog:true,toneMapped:false,
  polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2,uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),uOpacity:{value:0}}});
 const blobs=new THREE.InstancedMesh(geometry,material,BLOB.capacity);
 blobs.name='blob-shadows';blobs.count=0;blobs.visible=false;blobs.frustumCulled=false;blobs.renderOrder=4;blobs.castShadow=blobs.receiveShadow=false;blobs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 scene.add(blobs);
 const still=parked.map(c=>({x:c.x,y:footing(c.x,c.z),z:c.z,hx:c.hx,hz:c.hz,yaw:c.yaw}));
 const m4=new THREE.Matrix4(),pos=new THREE.Vector3(),quat=new THREE.Quaternion(),scale=new THREE.Vector3(),ax=new THREE.Vector3(),ay=new THREE.Vector3(),az=new THREE.Vector3(),UP=new THREE.Vector3(0,1,0);
 const d=[0,0,0],t=[0,0,0];let plan={strength:1,draw:true},opacity=0,shown=0,cell=[0,0];

 function writeBlobs(centre){
  const walkers=[],movers=[];
  for(const o of people())if(o?.visible!==false&&o?.position)walkers.push({x:o.position.x,y:o.position.y,z:o.position.z});
  for(const v of vehicles())if(v?.mesh?.visible)movers.push({x:v.mesh.position.x,y:v.mesh.position.y,z:v.mesh.position.z,hx:v.hx,hz:v.hz,mesh:v.mesh});
  const list=blobList({people:walkers,vehicles:movers.concat(still),centre});
  list.forEach((b,i)=>{
   if(b.source.mesh){b.source.mesh.getWorldQuaternion(quat);ay.set(0,1,0).applyQuaternion(quat)}                      // a vehicle that can move: its own pose, tilt included
   else if(b.box){quat.setFromAxisAngle(UP,b.yaw);ay.set(0,1,0)}                                                     // a scenery car: flat, turned
   else{const r=BLOB.person,flat=Math.abs(footing(b.x,b.z)-b.y)>.3,gx=flat?0:(footing(b.x+r,b.z)-footing(b.x-r,b.z))/(2*r),gz=flat?0:(footing(b.x,b.z+r)-footing(b.x,b.z-r))/(2*r); // a person: laid on the slope (flat on a deck or a bridge)
    ax.set(1,Math.max(-.6,Math.min(.6,gx)),0).normalize();az.set(0,Math.max(-.6,Math.min(.6,gz)),1).normalize();ay.crossVectors(az,ax).normalize();az.crossVectors(ax,ay);quat.setFromRotationMatrix(m4.makeBasis(ax,ay,az))}
   pos.set(b.x,b.y,b.z).addScaledVector(ay,BLOB.lift);blobs.setMatrixAt(i,m4.compose(pos,quat,scale.set(b.sx,1,b.sz)));box[i]=b.box;
  });
  blobs.count=list.length;blobs.instanceMatrix.needsUpdate=true;aBox.needsUpdate=true;return list.length;
 }
 // Call once a frame AFTER sky.update (it has just put the light where the clock says). sky: sky.state(). outdoors: not in any room. indoors: in a room of the world scene.
 // low: Low quality. centre: {x, z} where the player is (for choosing the nearest patches).
 function update({sky,outdoors=true,indoors=false,low=false,centre=null}={}){
  if(!sky)return state();
  // the box moves in whole texels
  d[0]=sun.position.x-sun.target.position.x;d[1]=sun.position.y-sun.target.position.y;d[2]=sun.position.z-sun.target.position.z;
  const l=Math.hypot(d[0],d[1],d[2])||1;d[0]/=l;d[1]/=l;d[2]/=l;sun.target.position.toArray(t);
  const snap=snapShadow(t,d);cell=snap.cell;
  sun.position.x+=snap.offset[0];sun.position.y+=snap.offset[1];sun.position.z+=snap.offset[2];sun.target.position.x+=snap.offset[0];sun.target.position.y+=snap.offset[1];sun.target.position.z+=snap.offset[2];sun.target.updateMatrixWorld();
  // the fade, and no shadow pass at all while it is fully faded
  plan=shadowPlan({sky,enabled:!!renderer.shadowMap?.enabled,indoors});
  sun.shadow.radius=faded?plan.strength:1;update.run=!faded||plan.strength>0;update.n=(update.n|0)+1;sun.shadow.autoUpdate=update.run&&(update.n&1)===1; // option 2: the map is redrawn every second frame
  // the patches
  opacity=blobOpacity(sky);const show=blobsShown({low,outdoors,opacity});
  shown=show?writeBlobs(centre||sun.target.position):0;blobs.visible=show&&shown>0;material.uniforms.uOpacity.value=opacity;
  return state();
 }
 const state=()=>({strength:plan.strength,pass:plan.draw&&update.run!==false,cell,blobs:blobs.visible?shown:0,opacity,drawCalls:blobs.visible?1:0,faded});
 return {blobs,update,state,faded};
}
