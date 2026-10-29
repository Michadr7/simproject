// Quaternius Stylized Nature MegaKit models (CC0), converted by scripts/build-assets.mjs into nature-assets.js.
// This module turns them into geometry and materials. Each model has a bark part and a leaves part (alpha-cutout cards), so a tree is
// two InstancedMeshes (two draw calls) however many of it are placed.
import * as THREE from './vendor/three.module.js';
import {NATURE} from './nature-assets.js';

export const PINES=['pine.1','pine.2','pine.3'],BROADLEAVES=['broadleaf.1','broadleaf.2'];
export const modelInfo=id=>{const m=NATURE.models[id];if(!m)throw new Error('Unknown nature model '+id);return m};

function decode(base64,Type){const text=atob(base64),bytes=new Uint8Array(text.length);for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i);return new Type(bytes.buffer)}
const cache=new Map();
// material: 'bark' | 'leaves'. Geometry is shared by every instance (and cached).
export function modelGeometry(id,material){
 const key=id+':'+material;if(cache.has(key))return cache.get(key);
 const part=modelInfo(id).parts.find(p=>p.material===material);if(!part)throw new Error(`${id} has no ${material}`);
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(decode(part.pos,Float32Array),3));
 geometry.setAttribute('normal',new THREE.BufferAttribute(decode(part.nor,Float32Array),3));
 geometry.setAttribute('uv',new THREE.BufferAttribute(decode(part.uv,Float32Array),2));
 geometry.setIndex(new THREE.BufferAttribute(decode(part.idx,Uint16Array),1));
 geometry.computeBoundingSphere();cache.set(key,geometry);return geometry;
}

function texture(name){
 const tex=new THREE.Texture();tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=4;
 if(typeof Image!=='undefined'){const image=new Image();image.onload=()=>{tex.image=image;tex.needsUpdate=true};image.src=NATURE.textures[name]} // browsers only; tests run without images
 return tex;
}
// fade: the sightline fade (world.js) so trees between the camera and the player dissolve as before.
export function createNatureMaterials(fade){
 const bark=texture('bark');
 const leaf=map=>fade.apply(new THREE.MeshStandardMaterial({map,roughness:.9,side:THREE.DoubleSide,alphaTest:.2}));
 return {
  bark:fade.apply(new THREE.MeshStandardMaterial({map:bark,roughness:1,side:THREE.DoubleSide})),
  pineLeaves:leaf(texture('pineLeaves')),broadleafLeaves:leaf(texture('broadleafLeaves')),
  logBark:bark // for stumps and logs (the Standard pack has no log or stump model)
 };
}
// Triangles drawn if every tree in `counts` ({modelId: instances}) is on screen.
export const triangleBudget=counts=>Object.entries(counts).reduce((sum,[id,n])=>sum+modelInfo(id).triangles*n,0);
