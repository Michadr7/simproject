import * as THREE from './vendor/three.module.js';
import {createProp} from './props.js';
import {AXES as AXE_MESHES} from './axe-assets.js';
import {SAWS as SAW_MESHES} from './saw-assets.js';
import {isAxe,isSaw} from './tools.js';

// The three axes (build-axes.mjs): a small vertex-coloured mesh each, handle along +z (butt at z -0.07), head at the far end, edge toward -y. Geometry is built once per page and shared; every held copy has its own material.
const axeGeometry=new Map();
const fromBase64=(text,Type)=>{const raw=atob(text),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new Type(bytes.buffer)};
const linear=c=>{const s=c/255;return s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4)};
function axeMesh(id){
 let g=axeGeometry.get(id);
 if(!g){const m=AXE_MESHES[id]||SAW_MESHES[id];g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(fromBase64(m.positions,Float32Array),3));g.setAttribute('normal',new THREE.BufferAttribute(fromBase64(m.normals,Float32Array),3));
  const rgb=fromBase64(m.colors,Uint8Array),col=new Float32Array(rgb.length);for(let i=0;i<rgb.length;i++)col[i]=linear(rgb[i]);g.setAttribute('color',new THREE.BufferAttribute(col,3));g.setIndex(new THREE.BufferAttribute(fromBase64(m.indices,Uint16Array),1));g.computeBoundingSphere();axeGeometry.set(id,g)}
 const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.75,metalness:.1}));mesh.name='axe-'+id;return mesh; // (saws too: the 'axe-' name marks a shared geometry)
}

// Replaceable low-poly props. All materials/geometries belong to this instance.
export function createHeldItem(item){
 const root=new THREE.Group();root.name='held-item';root.userData.itemId=item.id;
 function mesh(geometry,color,x=0,y=0,z=0){
  const m=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.7}));m.position.set(x,y,z);root.add(m);return m;
 }
 if(isAxe(item.id)||isSaw(item.id)){
  // Handle runs forward out of the fist; the head sits at the far end, the edge down.
  root.add(axeMesh(item.id));
 }else if(item.id==='gas-can'){
  // the real can (props.js): held by its handle, so it hangs below the fist; the model's origin is the middle of its base, 0.5 m tall
  const can=createProp('prop.fuel-can',{apply:m=>m});can.position.set(0,-.46,.02);can.castShadow=false;root.add(can);
 }else if(item.id==='wood-log'){
  const log=mesh(new THREE.CylinderGeometry(.08,.08,.36,8),'#7c5b3a');log.rotation.z=Math.PI/2;
 }else if(item.type==='drink'){
  const color=item.id==='water'?'#89bcd0':item.id==='coffee'?'#dfd2ac':item.id==='energy-drink'?'#8db452':'#d88750';
  mesh(new THREE.CylinderGeometry(.045,.045,.16,8),color);
  mesh(new THREE.CylinderGeometry(.047,.047,.012,8),'#dadfd5',0,.086);
 }else if(item.id==='apple'){
  mesh(new THREE.IcosahedronGeometry(.075,1),'#c44435');
  mesh(new THREE.CylinderGeometry(.007,.008,.035,5),'#605137',0,.08);
 }else if(['soup','yogurt','rice-bowl','salad'].includes(item.id)){
  mesh(new THREE.CylinderGeometry(.075,.045,.07,8),'#dcd6b8');
  mesh(new THREE.CylinderGeometry(.068,.068,.008,8),item.id==='salad'?'#7c9b50':'#c9a164',0,.037);
 }else if(item.id==='banana'){
  const m=mesh(new THREE.CylinderGeometry(.022,.025,.18,6),'#e5ce65');m.rotation.z=.5;
 }else{
  mesh(new THREE.BoxGeometry(.13,.055,.1),item.id==='granola-bar'?'#946f44':'#cbaa71');
  mesh(new THREE.BoxGeometry(.132,.015,.102),item.id==='pizza'?'#c3603b':'#6d8b48',0,0);
 }
 return root;
}
export function disposeHeldItem(root){
 root.removeFromParent();root.traverse(obj=>{if(!obj.name.startsWith('axe-'))obj.geometry?.dispose();if(obj.material)obj.material.dispose()}); // an axe's geometry is shared by every copy: only its material is this copy's
}
