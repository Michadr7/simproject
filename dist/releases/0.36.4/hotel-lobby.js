// Ironwood Hotel ground-floor lobby & guest suite (notes/ironwood-city-design.md 3.2, I7-I10).
import * as T from './vendor/three.module.js';
import {createDoubleDoor} from './doors.js';
import {propInfo,createProp} from './props.js';
import {createCharacter} from './character.js';
import {outfit} from './appearance.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';

export const HOTEL_ORIGIN=Object.freeze({x:420,y:0.165,z:1350});
export const HOTEL_ENTRY=Object.freeze({x:0,z:4.8});
export const HOTEL_EXIT=Object.freeze({x:0,z:5.8});
export const HOTEL_DESK=Object.freeze({x:-3.2,z:-2.2});
export const HOTEL_SUITE_DOOR=Object.freeze({x:-6.2,z:-4.8});
export const HOTEL_SUITE_BED=Object.freeze({x:-15.2,z:-1.5});
export const HOTEL_ROOM_PRICE=2500; // $25.00 per night stay

export function createHotelLobby(){
 const scene=new T.Scene();scene.name='hotel-lobby';scene.background=new T.Color('#b8b5a4');
 scene.add(new T.HemisphereLight('#fff1da','#898878',1.9));
 const sun=new T.DirectionalLight('#fff2da',1.8);sun.position.set(2,6,3);scene.add(sun);
 scene.position.set(HOTEL_ORIGIN.x,HOTEL_ORIGIN.y,HOTEL_ORIGIN.z);
 const occluders=[],blocks=[];
 const box=(w,h,d,x,y,z,c,solid=false,occlude=false)=>{
  const m=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshStandardMaterial({color:c,roughness:.85}));
  m.position.set(x,y,z);m.receiveShadow=true;scene.add(m);
  if(occlude&&y>0)occluders.push(m);
  if(solid)blocks.push({x,z,hx:w/2,hz:d/2});
  return m;
 };

 // Main Hotel Lobby (16 x 12 m: x -8..8, z -6..6)
 box(16,.2,12,0,-.1,0,'#c4b7a3');
 box(16,3.6,.18,0,1.8,-6,'#e8e0d0',true,true);
 box(.18,3.6,12,8,1.8,0,'#dfd6c5',true,true);
 box(.18,3.6,6,-8,1.8,3,'#dfd6c5',true,true);
 box(.18,3.6,4,-8,1.8,-4,'#dfd6c5',true,true); // doorway gap z -2..0 into guest suite
 for(const x of [-4.6,4.6])box(6.8,3.6,.18,x,1.8,6,'#dfd6c5',true,true);
 box(2.4,.9,.18,0,3.15,6,'#dfd6c5',false,true);
 const exitDoor=createDoubleDoor({width:2.3,height:2.6,frame:'#213a3c',panel:'#5a7c82'});
 exitDoor.group.position.set(0,0,6);scene.add(exitDoor.group);

 // Adjoining Guest Suite (x -18..-8, z -6..4)
 box(10,.2,10,-13,-.1,-1,'#b8aa95');
 box(10,3.6,.18,-13,1.8,-6,'#e6dfd1',true,true);
 box(10,3.6,.18,-13,1.8,4,'#e6dfd1',true,true);
 box(.18,3.6,10,-18,1.8,-1,'#dfd6c5',true,true);

 // Elevator doors on west-north wall
 box(2.2,2.7,.16,-6.2,1.35,-5.85,'#4c565e',true);
 box(1.6,2.3,.08,-6.2,1.15,-5.75,'#9da7ae');

 const put=(id,x,z,yaw=0,solid=true)=>{
  try{
   const m=createProp(id,{apply:mat=>mat});m.position.set(x,0,z);m.rotation.y=yaw;scene.add(m);
   if(solid){const info=propInfo(id),s=Math.round(Math.sin(yaw)),c=Math.round(Math.cos(yaw));
    for(const b of info.colliders||[])blocks.push({x:x+b.x*c+b.z*s,z:z-b.x*s+b.z*c,hx:s?b.hz:b.hx,hz:s?b.hx:b.hz});}
  }catch{}
 };
 // Lobby lounge + Guest Suite furniture
 put('f-rug',3.5,1.2,0,false);put('f-sofa',5.0,1.2,-Math.PI/2);put('f-coffee-table',3.2,1.2,0);
 put('f-plant',-6.8,4.8,0);put('f-plant',6.8,-4.8,0);put('f-lamp',6.4,3.4,0);
 put('f-bed-double',-15.2,-1.5,Math.PI/2);put('f-wardrobe',-14.5,-5.1,0);put('f-tv-cabinet',-11.2,-5.1,0);
 put('f-tv',-11.2,-5.1,0,false);put('f-bath-sink',-16.8,2.8,Math.PI);put('f-toilet',-14.6,2.8,Math.PI);

 // Real Blender Hotel Props (dist/assets/hotel/*.glb)
 const deskFallback=box(2.6,1.1,.7,-3.2,.55,-3.6,'#6e4d37',true);
 if(globalThis.document?.baseURI){
  const loader=new GLTFLoader();
  for(const [file,x,y,z,yaw,hide] of [
   ['prop-reception-counter',-3.2,0,-3.6,0,deskFallback],
   ['prop-desk-bell',-2.4,1.12,-3.45,0,null],
   ['prop-key-rack',-3.2,1.75,-5.86,0,null],
   ['prop-suitcase',-1.4,0,-3.6,.35,null],
   ['prop-suitcase',-11.5,0,2.2,-.4,null]
  ])loader.loadAsync(new URL(`./assets/hotel/${file}.glb`,document.baseURI).href).then(g=>{g.scene.position.set(x,y,z);g.scene.rotation.y=yaw;scene.add(g.scene);if(hide)hide.visible=false}).catch(()=>{});
 }

 const clerk=createCharacter(outfit('female','Formal',{hair:'#4a3222'}));
 clerk.group.position.set(-3.2,.02,-4.65);scene.add(clerk.group);

 const blocked=(x,z)=>{
  const inMain=x>=-7.55&&x<=7.55&&z>=-5.55&&z<=5.65;
  const inSuite=x>=-17.55&&x<=-7.45&&z>=-5.55&&z<=3.55;
  const inDoor=x>=-8.3&&x<=-7.4&&z>=-2.2&&z<=0.2;
  if(!inMain&&!inSuite&&!inDoor)return true;
  return blocks.some(b=>Math.abs(x-b.x)<b.hx+.3&&Math.abs(z-b.z)<b.hz+.3);
 };
 return {scene,occluders,exitDoor,frontDoor:exitDoor,clerk,blocked};
}
