// "For rent or sale" signs on the lawns of the houses you can rent or buy (the properties with a `listing` and no resident), so you can tell which house is which before you open the phone.
// A sign has the address, the weekly rent with its deposit, and the price. It disappears while you rent or own the house and comes back if you leave it or lose it.
import * as THREE from './vendor/three.module.js';

const dollars=cents=>'$'+(cents/100).toLocaleString('en-US',{minimumFractionDigits:cents%100?2:0,maximumFractionDigits:2});
export const signLines=property=>{const l=property.listing;return {head:'FOR RENT OR SALE',address:property.name.toUpperCase(),rent:`Rent ${dollars(l.rentCents)} a week  ·  deposit ${dollars(l.depositCents)}`,buy:`Buy ${dollars(l.priceCents)}`,foot:'Homes app on your phone'}};

function boardTexture(lines,makeCanvas){
 const canvas=makeCanvas();canvas.width=640;canvas.height=400;const g=canvas.getContext('2d');
 g.fillStyle='#f1ebd9';g.fillRect(0,0,640,400);g.fillStyle='#b8452f';g.fillRect(0,0,640,92);
 g.textAlign='center';g.textBaseline='middle';
 g.fillStyle='#fff6e4';g.font='bold 54px sans-serif';g.fillText(lines.head,320,48);
 g.fillStyle='#243e3b';g.font='bold 66px sans-serif';g.fillText(lines.address,320,160);
 g.font='bold 36px sans-serif';g.fillText(lines.rent,320,244);g.fillText(lines.buy,320,300);
 g.fillStyle='#6a746f';g.font='28px sans-serif';g.fillText(lines.foot,320,360);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

// Where a sign may stand: on plain grass (not the driveway or the front path) with grass around it, clear of anything solid, a few metres in front of the door and to one side.
export function findSignSpot(door,{surfaceAt,GRASS,blocked}){
 const rx=door.faceZ,rz=-door.faceX; // to the right of the door as you face out
 for(const forward of [3.4,4,4.6,2.8])for(const side of [-3.2,3.2,-4.2,4.2,-2.4,2.4,-5.2,5.2]){
  const x=door.x+door.faceX*forward+rx*side,z=door.z+door.faceZ*forward+rz*side;
  if(blocked(x,z))continue;
  // grass under the post and under the whole 2.2 m board (to either side of it), and a little in front and behind
  if([[0,0,0],[0,.7,0],[0,-.7,0],[1.25,0,0],[-1.25,0,0]].every(([across,ahead])=>surfaceAt(x+rx*across+door.faceX*ahead,z+rz*across+door.faceZ*ahead)===GRASS))return {x,z};
 }
 return null;
}

export function createHouseSigns({scene,properties,doorOf,surfaceAt,GRASS,blocked,makeCanvas=()=>document.createElement('canvas'),solids=null}){
 const signs=[];
 for(const property of properties){
  if(!property.listing||property.owner)continue; // a house with a resident is not for sale
  const door=doorOf(property);if(!door)continue;
  const spot=findSignSpot(door,{surfaceAt,GRASS,blocked});if(!spot)continue;
  const group=new THREE.Group();group.name='house-sign-'+property.id;group.position.set(spot.x,0,spot.z);
  const wood=new THREE.MeshStandardMaterial({color:'#6b4a2f',roughness:.9}),face=new THREE.MeshStandardMaterial({map:boardTexture(signLines(property),makeCanvas),roughness:.8});
  const post=new THREE.Mesh(new THREE.BoxGeometry(.12,2.3,.12),wood);post.position.y=1.15;post.castShadow=true;
  const board=new THREE.Mesh(new THREE.BoxGeometry(2.2,1.375,.07),[wood,wood,wood,wood,face,wood]);board.position.y=1.85;board.castShadow=true;
  group.add(post,board);group.rotation.y=Math.atan2(door.faceX,door.faceZ); // the lettering faces the street
  scene.add(group);
  const solid=solids?{x:spot.x,z:spot.z,hx:.15,hz:.15}:null;if(solid)solids.push(solid);
  signs.push({id:property.id,group,x:spot.x,z:spot.z,solid});
 }
 // held: the ids of the homes you rent or own. A sign is shown only for a house you do not hold; a hidden sign is not solid either.
 function sync(held=[]){for(const s of signs){const show=!held.includes(s.id);s.group.visible=show;if(s.solid){s.solid.hx=s.solid.hz=show?.15:-1}}}
 sync([]);
 return {signs,sync};
}
