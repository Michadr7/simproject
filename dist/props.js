// Props (buildings, vehicles, yard objects) converted by scripts/build-props.mjs into props-assets.js: one mesh with either a colour texture or baked
// vertex colours, and collision boxes, all in metres with the ground at y = 0 and the prop centred on x = z = 0.
import * as THREE from './vendor/three.module.js';
import {PROPS} from './props-assets.js';
import {decode} from './nature.js';
import {PLACEHOLDERS} from './placeholders.js';
import {addWheels} from './vehicle-parts.js';

// A prop is a converted model (PROPS) or a placeholder (placeholders.js); both have width, depth, height, footprint, colliders and floor.
export const propInfo=id=>{const p=PROPS[id]||PLACEHOLDERS[id];if(!p)throw new Error('Unknown prop '+id);return p};
const geometries=new Map(),LINEAR=Float32Array.from({length:256},(_,i)=>{const c=i/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)});
export function propGeometry(id){
 if(geometries.has(id))return geometries.get(id);
 const p=propInfo(id),geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(decode(p.pos,Float32Array),3));
 if(p.norQ){const q=decode(p.nor,Int8Array),n=new Float32Array(q.length);for(let i=0;i<q.length;i++)n[i]=q[i]/127;geometry.setAttribute('normal',new THREE.BufferAttribute(n,3))} // normals are stored as signed bytes
 else geometry.setAttribute('normal',new THREE.BufferAttribute(decode(p.nor,Float32Array),3));
 if(p.col){const bytes=decode(p.col,Uint8Array),c=new Float32Array(bytes.length);for(let i=0;i<bytes.length;i++)c[i]=LINEAR[bytes[i]];geometry.setAttribute('color',new THREE.BufferAttribute(c,3))} // baked material colours (sRGB bytes -> linear)
 else geometry.setAttribute('uv',new THREE.BufferAttribute(decode(p.uv,Float32Array),2));
 geometry.setIndex(new THREE.BufferAttribute(decode(p.idx,Uint16Array),1));
 geometry.computeBoundingSphere();geometries.set(id,geometry);return geometry;
}
// fade: the sightline fade (world.js), so a building between the camera and the player dissolves like the trees do.
export function createProp(id,fade){
 if(PLACEHOLDERS[id])return PLACEHOLDERS[id].build(fade);
 let material;
 if(propInfo(id).col)material=fade.apply(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85,side:THREE.DoubleSide}));
 else{const map=new THREE.Texture();map.colorSpace=THREE.SRGBColorSpace;map.flipY=false;map.anisotropy=4;
  if(typeof Image!=='undefined'){const image=new Image();image.onload=()=>{map.image=image;map.needsUpdate=true};image.src=propInfo(id).texture} // browsers only
  material=fade.apply(new THREE.MeshStandardMaterial({map,roughness:.9,side:THREE.DoubleSide}))}
 const mesh=new THREE.Mesh(propGeometry(id),material);mesh.name='prop-'+id;mesh.castShadow=mesh.receiveShadow=true;addWheels(id,mesh,fade);return mesh;
}
