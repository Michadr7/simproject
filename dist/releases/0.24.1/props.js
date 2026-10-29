// Single-mesh props (the sawmill, the farmyard) converted by scripts/build-props.mjs into props-assets.js: a mesh, one colour texture and
// collision boxes, all in metres with the ground at y = 0 and the prop centred on x = z = 0.
import * as THREE from './vendor/three.module.js';
import {PROPS} from './props-assets.js';
import {decode} from './nature.js';
import {PLACEHOLDERS} from './placeholders.js';

// A prop is a converted model (PROPS) or a placeholder (placeholders.js); both have width, depth, height, footprint, colliders and floor.
export const propInfo=id=>{const p=PROPS[id]||PLACEHOLDERS[id];if(!p)throw new Error('Unknown prop '+id);return p};
const geometries=new Map();
export function propGeometry(id){
 if(geometries.has(id))return geometries.get(id);
 const p=propInfo(id),geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(decode(p.pos,Float32Array),3));
 geometry.setAttribute('normal',new THREE.BufferAttribute(decode(p.nor,Float32Array),3));
 geometry.setAttribute('uv',new THREE.BufferAttribute(decode(p.uv,Float32Array),2));
 geometry.setIndex(new THREE.BufferAttribute(decode(p.idx,Uint16Array),1));
 geometry.computeBoundingSphere();geometries.set(id,geometry);return geometry;
}
// fade: the sightline fade (world.js), so a building between the camera and the player dissolves like the trees do.
export function createProp(id,fade){
 if(PLACEHOLDERS[id])return PLACEHOLDERS[id].build(fade);
 const map=new THREE.Texture();map.colorSpace=THREE.SRGBColorSpace;map.flipY=false;map.anisotropy=4;
 if(typeof Image!=='undefined'){const image=new Image();image.onload=()=>{map.image=image;map.needsUpdate=true};image.src=propInfo(id).texture} // browsers only
 const material=fade.apply(new THREE.MeshStandardMaterial({map,roughness:.9,side:THREE.DoubleSide}));
 const mesh=new THREE.Mesh(propGeometry(id),material);mesh.name='prop-'+id;mesh.castShadow=mesh.receiveShadow=true;return mesh;
}
