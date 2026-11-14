// The customer's truck you see (0.35): a white Tylan Flatbed driven by nobody you can see, that comes in along the map exit (MAP.exits), turns into the timber yard, parks in
// the bay and shows its order loading on the bed; sent off, it backs out onto Freight South and drives east off the map, then is removed. The rules are customers.js; this file only
// moves and draws. It is solid to a walker while it stands still (not while it drives: it does not run people over, it passes through them).
import * as THREE from './vendor/three.module.js';
import {createProp} from './props.js';
import {applyPaint} from './paint-shader.js';
import {createCargoView} from './cargo-view.js';
import {CLASSES,insideHull,toWorld} from './vehicle.js';
import {loadPoints,LOAD_REACH} from './cargo.js';
import {BAY} from './customers.js';

const SPEED=8,REVERSE=3,cls=CLASSES.flatbed;
// a path: [[x, z], ...] and whether it is driven backwards
const lengthOf=pts=>{let s=0;for(let i=1;i<pts.length;i++)s+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);return s};
function at(pts,d){for(let i=1;i<pts.length;i++){const [ax,az]=pts[i-1],[bx,bz]=pts[i],l=Math.hypot(bx-ax,bz-az);if(d<=l||i===pts.length-1){const u=l?Math.min(1,d/l):1;return {x:ax+(bx-ax)*u,z:az+(bz-az)*u,heading:Math.atan2(bx-ax,bz-az)}}d-=l}return {x:pts[0][0],z:pts[0][1],heading:0}}
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

// route: {bay, inPath, backOut (optional), outPath}: the timber yard's by default; the warehouse dock has its own (customers.js DOCK_ROUTE). name: the mesh's name.
export function createCustomerTruck({scene,exit,groundAt=()=>0,route=null,name='customer-truck'}){
 const mesh=createProp('flatbed',{apply:m=>m});mesh.name=name;mesh.visible=false;applyPaint(mesh,'flatbed','white');scene.add(mesh);
 const view=createCargoView('flatbed');mesh.add(view.group);
 const R=route||{bay:BAY,inPath:[...exit.in,[92,65],[87.5,62],[BAY.x,BAY.z+3],[BAY.x,BAY.z]],backOut:[[BAY.x,BAY.z],[BAY.x,66.5]],outPath:[[BAY.x,66.5],[93,71],...exit.out]},bay=R.bay;

 let phase='away',legs=[],leg=0,d=0,state={x:bay.x,z:bay.z,yaw:bay.yaw},spin=0,onDone=null;
 const place=()=>{mesh.position.set(state.x,groundAt(state.x,state.z),state.z);mesh.rotation.set(0,state.yaw,0);for(const w of mesh.userData.wheels)w.spin.rotation.x=spin/w.radius};
 const drive=(list,done)=>{legs=list;leg=0;d=0;onDone=done;mesh.visible=true;const p=at(list[0].pts,0);state={x:p.x,z:p.z,yaw:list[0].back?wrap(p.heading+Math.PI):p.heading}};
 return {mesh,view,
  get phase(){return phase},
  // dt: seconds; truck: progress.shift.truck (or null); due: its time has come (customers.js truckDue); hooks: arrived() when it has parked, gone() when it has left the map
  update(dt,truck,{due=false,arrived,gone}={}){
   if(truck?.stage==='waiting'&&phase!=='parked'&&phase!=='in'){phase='parked';state={x:bay.x,z:bay.z,yaw:bay.yaw};mesh.visible=true}
   if(phase==='away'&&truck?.stage==='coming'&&due)drive([{pts:R.inPath,back:false}],()=>{phase='parked';arrived?.()}),phase='in';
   if(phase==='parked'&&(!truck||truck.stage==='gone'))drive(R.backOut?[{pts:R.backOut,back:true},{pts:R.outPath,back:false}]:[{pts:R.outPath,back:false}],()=>{phase='away';mesh.visible=false;gone?.()}),phase='out';
   if((phase==='in'||phase==='out')&&legs.length){const L=legs[leg],len=lengthOf(L.pts),v=L.back?REVERSE:SPEED;d+=v*dt;spin+=(L.back?-1:1)*v*dt;
    const p=at(L.pts,Math.min(d,len)),want=L.back?wrap(p.heading+Math.PI):p.heading;state.x=p.x;state.z=p.z;state.yaw+=wrap(want-state.yaw)*Math.min(1,dt*3);
    if(d>=len){leg++;d=0;if(leg>=legs.length){legs=[];onDone?.()}}}
   view.set(truck&&truck.loaded?Array.from({length:Math.ceil(truck.loaded/4)},(_,i)=>({k:'planks',n:Math.min(4,truck.loaded-i*4)})):null);
   if(mesh.visible)place()},
  parked:()=>phase==='parked',
  // a walker cannot walk through it while it stands in the bay
  blocksWalker(x,z,r=.33){return phase==='parked'&&insideHull({...state,speed:0,steer:0},cls,x,z,r)},
  // where you stand to load it (behind the bed), and its cab (the driver's door)
  rearPoint(){const p=loadPoints('flatbed').find(q=>q.side==='rear');return toWorld({...state},p.x,p.z)},
  cabPoint(){return toWorld({...state},cls.door.x,cls.door.z)},
  reach:LOAD_REACH
 };
}
