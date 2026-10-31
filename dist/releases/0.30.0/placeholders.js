// Stand-in buildings made of plain coloured boxes (like the city's), used until a real model is found. A placeholder has the same shape as a converted prop
// (width, depth, height, footprint, colliders, floor) plus build(fade), so swapping in a real model later means changing one prop id in map-definition.js.
import * as THREE from './vendor/three.module.js';

const materials=new Map();
const paint=(fade,color)=>{const key=color;if(!materials.has(key))materials.set(key,fade.apply(new THREE.MeshStandardMaterial({color,roughness:.92})));return materials.get(key)};
function block(group,fade,w,h,d,x,y,z,color,name){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),paint(fade,color));mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;if(name)mesh.name=name;group.add(mesh);return mesh}
// A building with a gabled roof whose ridge runs along z: walls w x d, wall height `wall`, roof rising `rise` above it. The front (the door side) faces +z.
function gabled(group,fade,{x,z,w,d,wall,rise,wallColor,roofColor,doorW=2.2,doorH=3,windows=2,name}){
 block(group,fade,w,wall,d,x,wall/2,z,wallColor,name);
 const overhang=.5,shape=new THREE.Shape();shape.moveTo(-w/2-overhang,0);shape.lineTo(w/2+overhang,0);shape.lineTo(0,rise);shape.closePath();
 const roof=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:d+overhang*2,bevelEnabled:false}),paint(fade,roofColor));roof.geometry.translate(0,wall,-(d+overhang*2)/2);roof.position.set(x,0,z);roof.castShadow=roof.receiveShadow=true;group.add(roof);
 block(group,fade,doorW,doorH,.12,x,doorH/2,z+d/2+.04,'#3a2a22');
 for(let i=0;i<windows;i++){const wx=x+(i-(windows-1)/2)*(w/(windows+1))*1.5+(windows>1?0:w*.28);if(Math.abs(wx-x)>doorW/2+.5)block(group,fade,1.1,1.2,.1,wx,wall*.62,z+d/2+.04,'#cfe0e6')}
}
function silo(group,fade,{x,z,r,h}){
 const body=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,14),paint(fade,'#b8c4cb'));body.position.set(x,h/2,z);body.castShadow=body.receiveShadow=true;group.add(body);
 const cap=new THREE.Mesh(new THREE.ConeGeometry(r*1.06,r*.9,14),paint(fade,'#8d9aa2'));cap.position.set(x,h+r*.45,z);cap.castShadow=true;group.add(cap);
}

export const PLACEHOLDERS={
 // The farmstead at the head of the farm road in Willow Fields: a barn, a farmhouse, a silo and a shed around a yard, facing south (+z).
 farmstead:{
  placeholder:true,width:38,depth:42,height:14.5,footprint:{x0:-19,x1:19,z0:-21,z1:21},floor:null,
  colliders:[{x:-7,z:-8,hx:8,hz:10},{x:10,z:5,hx:5,hz:4.5},{x:9,z:-13,hx:3,hz:3},{x:-12,z:13,hx:3.5,hz:3}],
  build(fade){
   const group=new THREE.Group();group.name='prop-farmstead';
   gabled(group,fade,{x:-7,z:-8,w:16,d:20,wall:7,rise:5,wallColor:'#a02f2a',roofColor:'#d9d4c7',doorW:5,doorH:5.5,windows:2,name:'barn'});
   gabled(group,fade,{x:10,z:5,w:10,d:9,wall:5.5,rise:3.5,wallColor:'#d8cfb8',roofColor:'#7a3b2e',doorW:1.6,doorH:2.4,windows:2,name:'farmhouse'});
   gabled(group,fade,{x:-12,z:13,w:7,d:6,wall:3.5,rise:2,wallColor:'#c9772e',roofColor:'#d9d4c7',doorW:1.8,doorH:2.4,windows:1,name:'shed'});
   silo(group,fade,{x:9,z:-13,r:3,h:12});
   return group;
  }
 }
};
