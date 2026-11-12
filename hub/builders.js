// P3c: viewer builders

// Mikkadr Hub, P3c: how to turn an asset's drawing spec (previewSpec in hub/assets.js) into a three.js object, shared by the picture studio (hub/studio.html) and the 3D viewer
// (hub/viewer.html). Served by hub/server.js as /builders.js; it imports the game's own builders from /dist, so what you see is what the game builds.
import * as THREE from '/dist/vendor/three.module.js';
import {GLTFLoader} from '/dist/vendor/GLTFLoader.js';
import {createProp} from '/dist/props.js';
import {createHeldItem} from '/dist/item-models.js';
import {buildForklift} from '/dist/forklift-view.js';
import {modelInfo,modelGeometry,createNatureMaterials} from '/dist/nature.js';
import {MODEL_SCALE} from '/dist/character.js';

export {THREE};
const fade={apply:m=>m};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const bytesOf=b64=>{const t=atob(b64),u=new Uint8Array(t.length);for(let i=0;i<t.length;i++)u[i]=t.charCodeAt(i);return u.buffer};

// Waits until every colour texture on the object has an image (props.js and nature.js set them from an Image), at most 4 s.
export async function texturesReady(root){
 for(let i=0;i<130;i++){let wait=false;root.traverse(o=>{for(const m of [].concat(o.material||[])){const map=m&&m.map;if(map&&!(map.image&&(map.image.complete!==false)&&(map.image.width||map.image.videoWidth)))wait=true}});if(!wait)return;await sleep(30)}
}

// Triangles and size in metres (a bounding box of the whole object), the way the studio and the viewer report them.
export function measure(root){
 let tris=0;root.traverse(o=>{if(o.isMesh&&o.geometry){const g=o.geometry;tris+=Math.round((g.index?g.index.count:g.attributes.position.count)/3)}});
 root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3());
 return {triangles:tris,size:{w:+size.x.toFixed(2),d:+size.z.toFixed(2),h:+size.y.toFixed(2)},box};
}

// Wireframe on or off for every material under the object (restores a material that is shared with later builds).
export function setWireframe(root,on){root.traverse(o=>{for(const m of [].concat(o.material||[]))if(m&&'wireframe' in m)m.wireframe=!!on})}

// Returns a THREE.Object3D, or null when the spec has no model to build (a placeholder, or a ready-made picture). Skinned models are left in their bind pose.
export async function buildObject(spec){
 switch(spec.mode){
  case 'prop':{const mesh=createProp(spec.id,fade);if(mesh.userData&&mesh.userData.ready)await mesh.userData.ready;await texturesReady(mesh);return mesh}
  case 'forklift':return buildForklift().group;
  case 'held':return createHeldItem({id:spec.id});
  case 'nature':{
   const info=modelInfo(spec.id),mats=createNatureMaterials(fade),root=new THREE.Group(),leaf=spec.id.startsWith('pine')?mats.pineLeaves:mats.broadleafLeaves;
   for(const p of info.parts)root.add(new THREE.Mesh(modelGeometry(spec.id,p.material),p.material==='bark'?mats.bark:leaf));
   await texturesReady(root);return root}
  case 'module-glb':{
   const mod=await import(spec.module),b64=spec.export==='default'?mod.default:mod[spec.export];
   const gltf=await new GLTFLoader().parseAsync(bytesOf(b64),''),root=new THREE.Group();root.add(gltf.scene);if(spec.scale==='character')root.scale.setScalar(MODEL_SCALE);return root}
  case 'url':{const gltf=await new GLTFLoader().loadAsync(spec.url),root=new THREE.Group();root.add(gltf.scene);await texturesReady(root);return root}
  default:return null;
 }
}

// A ready-made picture (vehicle and sign pictures): the data URL, or null.
export async function readyPicture(spec){
 if(spec.mode!=='dataurl')return null;
 const v=(await import(spec.module))[spec.export];return spec.key?v[spec.key]:v[spec.index||0];
}
