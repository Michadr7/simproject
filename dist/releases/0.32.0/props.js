// Props (buildings, vehicles, yard objects) converted by scripts/build-props.mjs into props-assets.js: one mesh with either a colour texture or baked
// vertex colours, and collision boxes, all in metres with the ground at y = 0 and the prop centred on x = z = 0.
import * as THREE from './vendor/three.module.js';
import {PROPS} from './props-assets.js';
import {decode} from './nature.js';
import {PLACEHOLDERS} from './placeholders.js';
import {isRigged,riggedInfo,createRigged} from './rigged-props.js';

// A prop is a converted model (PROPS) or a placeholder (placeholders.js); both have width, depth, height, footprint, colliders and floor.
export const propInfo=id=>{const p=PROPS[id]||PLACEHOLDERS[id]||(isRigged(id)?riggedInfo(id):null);if(!p)throw new Error('Unknown prop '+id);return p}; // rigged props (rigged-props.js) answer from data too
const geometries=new Map(),LINEAR=Float32Array.from({length:256},(_,i)=>{const c=i/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)});
function buildGeometry(p){
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(decode(p.pos,Float32Array),3));
 if(p.norQ){const q=decode(p.nor,Int8Array),n=new Float32Array(q.length);for(let i=0;i<q.length;i++)n[i]=q[i]/127;geometry.setAttribute('normal',new THREE.BufferAttribute(n,3))} // normals are stored as signed bytes
 else geometry.setAttribute('normal',new THREE.BufferAttribute(decode(p.nor,Float32Array),3));
 if(p.col){const bytes=decode(p.col,Uint8Array),c=new Float32Array(bytes.length);for(let i=0;i<bytes.length;i++)c[i]=LINEAR[bytes[i]];geometry.setAttribute('color',new THREE.BufferAttribute(c,3))} // baked material colours (sRGB bytes -> linear)
 else geometry.setAttribute('uv',new THREE.BufferAttribute(decode(p.uv,Float32Array),2));
 geometry.setIndex(new THREE.BufferAttribute(decode(p.idx,Uint16Array),1));
 if(p.glow){geometry.addGroup(0,p.glow.from,0);geometry.addGroup(p.glow.from,p.glow.count,1)} // lit panels (the forecourt canopy's lights) are the last triangles: a second material group
 geometry.computeBoundingSphere();return geometry;
}
export function propGeometry(id){
 if(geometries.has(id))return geometries.get(id);
 const geometry=buildGeometry(propInfo(id));geometries.set(id,geometry);return geometry;
}
// A vehicle's wheels (the converter's splitWheels): each its own geometry centred on its axle (record.wheels[i], {at, radius, front, ...}), so the game can spin and steer it.
export function wheelGeometry(id,i){
 const key=id+'#'+i;if(geometries.has(key))return geometries.get(key);
 const g=buildGeometry({...propInfo(id).wheels[i]});geometries.set(key,g);return g;
}// Repeated props (pallets, boxes, crates, bollards...): ONE InstancedMesh per model however many are placed, so a yard of 200 pallets is one draw call.
// spots: [{x, z, y?, yaw?}] (y defaults to 0: callers add heightAt/floor heights themselves). The mesh does not cast shadows by default (small props; pass shadows:true for tall ones);
// its colliders are not added here: they come from propInfo(id).colliders, placed by whoever owns the spots.
export function createPropInstances(id,spots,fade,{shadows=false}={}){
 const material=propMaterial(id,fade); // flat-colour props (pallets, boxes) and textured ones (the kit's containers) alike
 const mesh=new THREE.InstancedMesh(propGeometry(id),material,Math.max(1,spots.length)),m=new THREE.Matrix4(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),one=new THREE.Vector3(1,1,1),at=new THREE.Vector3();
 spots.forEach((s,i)=>{q.setFromAxisAngle(up,s.yaw||0);m.compose(at.set(s.x,s.y||0,s.z),q,one);mesh.setMatrixAt(i,m)});
 mesh.count=spots.length;mesh.instanceMatrix.needsUpdate=true;mesh.name='props-'+id;mesh.castShadow=shadows;mesh.receiveShadow=true;mesh.frustumCulled=false; // instances are scattered: the shared geometry's bounding sphere is the first one's
 return mesh;
}
// fade: the sightline fade (world.js), so a building between the camera and the player dissolves like the trees do.
function propMaterial(id,fade){
 const glow=propInfo(id).glow;
 if(glow){const [r,g,b]=glow.color.map(v=>v/255),light=new THREE.MeshStandardMaterial({color:new THREE.Color().setRGB(r,g,b,THREE.SRGBColorSpace),emissive:new THREE.Color().setRGB(r,g,b,THREE.SRGBColorSpace),emissiveIntensity:glow.strength,roughness:.5,side:THREE.DoubleSide});
  return [fade.apply(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85,side:THREE.DoubleSide})),light]} // [the body, the glowing panels]
 if(propInfo(id).col)return fade.apply(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85,side:THREE.DoubleSide}));
 const map=new THREE.Texture();map.colorSpace=THREE.SRGBColorSpace;map.flipY=false;map.anisotropy=4;
 if(typeof Image!=='undefined'){const image=new Image();image.onload=()=>{map.image=image;map.needsUpdate=true};image.src=propInfo(id).texture} // browsers only
 return fade.apply(new THREE.MeshStandardMaterial({map,roughness:.9,side:THREE.DoubleSide}));
}
export function createProp(id,fade){
 if(PLACEHOLDERS[id])return PLACEHOLDERS[id].build(fade);
 if(isRigged(id))return createRigged(id,fade); // a group, filled when the model has decoded (userData.ready)
 const material=propMaterial(id,fade);
 const mesh=new THREE.Mesh(propGeometry(id),material);mesh.name='prop-'+id;mesh.castShadow=mesh.receiveShadow=true;
 // wheels as children, each in a pivot at its axle (the pivot steers about y, the mesh inside spins about x): mesh.userData.wheels = [{pivot, spin, radius, front}]
 const wheels=propInfo(id).wheels;if(wheels){mesh.userData.wheels=wheels.map((w,i)=>{const pivot=new THREE.Group(),spin=new THREE.Mesh(wheelGeometry(id,i),material);pivot.position.set(...w.at);spin.castShadow=spin.receiveShadow=true;spin.name='wheel';pivot.add(spin);pivot.name='wheel-pivot';mesh.add(pivot);return {pivot,spin,radius:w.radius,front:w.front}})}
 return mesh;
}
