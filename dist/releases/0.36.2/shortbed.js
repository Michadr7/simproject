// The Kasumuchi S70 shortbed truck (0.35.8; the project owner's model, converted by scripts/build-shortbed.mjs into shortbed-assets.js). props.js asks this file for the prop 'shortbed':
// propInfo-style data (SHORTBED_INFO) and a builder that makes the vehicle as a group of parts, so the game can roll and steer the wheels, move the suspension, turn the steering wheel, swing the doors and repaint it.
//   mesh.userData.wheels = [{pivot, spin, radius, front, max, rest, x, z}] (the format driving.js already uses; max = the steering lock, rest = the pivot's rest height, x z = where it is, for the suspension),
//   mesh.userData.paint = the one paint material (body, doors), mesh.userData.steeringWheel = the wheel's group, mesh.userData.doors = {driver, passenger}: {pivot, sign} (the left door is the driver's: +x).
// Draw calls: body, paint, glass, lights, interior, four wheels, two doors (body, paint and window each) and the steering wheel = 16 per truck (the tailgate is part of the body: it stays closed; its hinge anchor is kept in the data).
import * as THREE from './vendor/three.module.js';
import {SHORTBED} from './shortbed-assets.js';

const HALF_W=1.105,HALF_L=2.757; // the closed mesh: 2.21 x 5.513 m with the mirrors, 2.41 m to the roof (V7: the cab was raised 0.21 m so the 1.95 m player sits under it)
export const SHORTBED_INFO=Object.freeze({source:SHORTBED.source,width:HALF_W*2,depth:HALF_L*2,height:2.41,triangles:SHORTBED.triangles,footprint:Object.freeze({x0:-HALF_W,x1:HALF_W,z0:-HALF_L,z1:HALF_L}),
 colliders:Object.freeze([Object.freeze({x:0,z:0,hx:HALF_W,hz:HALF_L})]),floor:null,anchors:SHORTBED.anchors,custom:true});
export const SHORTBED_STEER=35*Math.PI/180; // the spec: front wheels steer up to 35 degrees
export const SHORTBED_COMPRESSION=.1; // the spec: up to 0.100 m of suspension travel (compression: the wheel moves up the body)
// Seated driver (0.35.8): hips: how far in front of the seat anchor the hips sit (the 1.95 m player's arms are 0.43 m from shoulder to wrist, so he sits well forward on the cushion and leans in 0.25 rad); angle, radius: where each hand grips the wheel's rim (45 degrees either side of the top, the rim's centre line is 0.17 m and the fist wraps it from outside, 0.21 m); back: the wrist sits this far behind the rim's plane so the fist closes round it.
export const SHORTBED_GRIP=Object.freeze({hips:.35,angle:45*Math.PI/180,radius:.21,back:.10,lean:.25});
export const SHORTBED_DOOR_OPEN=70*Math.PI/180,SHORTBED_DOOR_SECONDS=.875; // the left door turns -70 degrees about y, the right +70; each clip is 0.875 s
const fromBase64=(text,Type)=>{const bytes=typeof Buffer!=='undefined'?Uint8Array.from(Buffer.from(text,'base64')):Uint8Array.from(atob(text),c=>c.charCodeAt(0));return new Type(bytes.buffer)};
const linear=c=>{const s=c/255;return s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4)};
const geometries=new Map();
function geometry(part,{colours=true}={}){
 if(geometries.has(part))return geometries.get(part);const p=SHORTBED.parts[part],g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.BufferAttribute(fromBase64(p.positions,Float32Array),3));g.setAttribute('normal',new THREE.BufferAttribute(fromBase64(p.normals,Float32Array),3));
 if(colours){const rgb=fromBase64(p.colors,Uint8Array),c=new Float32Array(rgb.length);for(let i=0;i<rgb.length;i++)c[i]=linear(rgb[i]);g.setAttribute('color',new THREE.BufferAttribute(c,3))}
 g.setIndex(new THREE.BufferAttribute(fromBase64(p.indices,Uint16Array),1));g.computeBoundingSphere();geometries.set(part,g);return g;
}
// fade: the world's sightline fade (vehicles pass one that does nothing).
export function buildShortbed(fade={apply:m=>m}){
 const root=new THREE.Group();root.name='prop-shortbed';
 const solid=()=>fade.apply(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7,metalness:.15}));
 const add=(part,material,parent=root)=>{const m=new THREE.Mesh(geometry(part,{colours:!part.endsWith('paint')}),material);m.name='shortbed-'+part;m.castShadow=part!=='glass'&&!part.endsWith('glass')&&part!=='interior';m.receiveShadow=true;parent.add(m);return m};
 const body=solid();add('body',body);
 const paint=fade.apply(new THREE.MeshStandardMaterial({color:SHORTBED.parts.paint.paintColour,roughness:.45,metalness:.25}));add('paint',paint); // the doors' paint shares this material, so one colour change repaints all
 const glass=fade.apply(new THREE.MeshStandardMaterial({color:'#9fb7c2',roughness:.08,metalness:.2,transparent:true,opacity:.42,depthWrite:false}));add('glass',glass); // one glass material for the body glass and both door windows (the driver and the cab are seen through them)
 add('lights',new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false}));
 const pivotAt=(part,name)=>{const pivot=new THREE.Group();pivot.name=name;pivot.position.set(...SHORTBED.pivots[part]);root.add(pivot);return pivot};
 const wheels=[];for(const [part,front] of [['wheel-fl',true],['wheel-fr',true],['wheel-rl',false],['wheel-rr',false]]){const pivot=pivotAt(part,'wheel-pivot'),spin=add(part,body,pivot);spin.name='wheel';wheels.push({pivot,spin,radius:SHORTBED.spec.wheelRadius,front,max:front?SHORTBED_STEER:0,rest:pivot.position.y,x:pivot.position.x,z:pivot.position.z})}
 const doors={};for(const [side,s,sign] of [['driver','l',-1],['passenger','r',1]]){const pivot=pivotAt('door-'+s,'door-'+s);add('door-'+s,body,pivot);add('door-'+s+'-paint',paint,pivot);add('door-'+s+'-glass',glass,pivot);doors[side]={pivot,sign}}
 for(const m of [body,paint]){m.side=THREE.DoubleSide;m.shadowSide=THREE.BackSide} // 0.35.10: the model's cab (rear wall, pillars) is one-sided, so from inside you saw out through it: draw both sides (same two materials; the shadow still renders back faces only, as for a front-side material)
 add('interior',body); // dashboard, binnacle, console, two seats and pedals (the Interior GLB), one merged part
 const steeringWheel=pivotAt('steer-wheel','steering-wheel');add('steer-wheel',body,steeringWheel);
 root.userData.wheels=wheels;root.userData.paint=paint;root.userData.steeringWheel=steeringWheel;root.userData.doors=doors;root.userData.anchors=SHORTBED.anchors;root.userData.grip=SHORTBED_GRIP;root.userData.seats={driver:SHORTBED.anchors.driver_seat,passenger:[-SHORTBED.anchors.driver_seat[0],SHORTBED.anchors.driver_seat[1],SHORTBED.anchors.driver_seat[2]]}; // where a hip sits (model axes); the passenger's is the driver's mirrored
 return root;
}
