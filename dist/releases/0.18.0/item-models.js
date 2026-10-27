import * as THREE from './vendor/three.module.js';

// Replaceable low-poly props. All materials/geometries belong to this instance.
export function createHeldItem(item){
 const root=new THREE.Group();root.name='held-item';root.userData.itemId=item.id;
 function mesh(geometry,color,x=0,y=0,z=0){
  const m=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.7}));m.position.set(x,y,z);root.add(m);return m;
 }
 if(item.id==='axe'){
  // Handle runs forward out of the fist; the head sits at the far end.
  const handle=mesh(new THREE.CylinderGeometry(.022,.026,.7,6),'#8a6a45',0,0,.28);handle.rotation.x=Math.PI/2;
  mesh(new THREE.BoxGeometry(.035,.16,.13),'#9aa3a6',0,-.06,.58);
  mesh(new THREE.BoxGeometry(.04,.05,.05),'#4b4f50',0,.03,.58);
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
 root.removeFromParent();root.traverse(obj=>{obj.geometry?.dispose();if(obj.material)obj.material.dispose()});
}
