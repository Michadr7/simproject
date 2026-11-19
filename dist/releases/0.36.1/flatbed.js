// The Tylan Flatbed (0.35; the project owner's model, converted by scripts/build-flatbed.mjs into flatbed-assets.js). props.js asks this file for the prop 'flatbed':
// propInfo-style data (FLATBED_INFO) and a builder that makes the vehicle as a group of parts, so the game can spin and steer the wheels, open the tailgate and repaint the cab.
//   mesh.userData.wheels = [{pivot, spin, radius, front}] (the format driving.js already uses), mesh.userData.paint = the paint material, mesh.userData.tailgate = the hinge group.
// Draw calls: body, paint, glass, lights, four wheels, tailgate = 9 per flatbed (the spec's budget is three flatbeds near the player).
import * as THREE from './vendor/three.module.js';
import {FLATBED} from './flatbed-assets.js';

const HALF_W=1.45,HALF_L=4.415; // the spec's collision box: 2.9 x 8.83 m (the exhaust stack's 5 cm past the body line is ignored)
export const FLATBED_INFO=Object.freeze({source:FLATBED.source,width:HALF_W*2,depth:HALF_L*2,height:3.2,triangles:FLATBED.triangles,footprint:Object.freeze({x0:-HALF_W,x1:HALF_W,z0:-HALF_L,z1:HALF_L}),
 colliders:Object.freeze([Object.freeze({x:0,z:0,hx:HALF_W,hz:HALF_L})]),floor:null,anchors:FLATBED.anchors,custom:true});
export const TAILGATE_OPEN=-Math.PI/2;
const fromBase64=(text,Type)=>{const bytes=typeof Buffer!=='undefined'?Uint8Array.from(Buffer.from(text,'base64')):Uint8Array.from(atob(text),c=>c.charCodeAt(0));return new Type(bytes.buffer)};
const linear=c=>{const s=c/255;return s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4)};
const geometries=new Map();
function geometry(part,{colours=true}={}){
 if(geometries.has(part))return geometries.get(part);const p=FLATBED.parts[part],g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.BufferAttribute(fromBase64(p.positions,Float32Array),3));g.setAttribute('normal',new THREE.BufferAttribute(fromBase64(p.normals,Float32Array),3));
 if(colours){const rgb=fromBase64(p.colors,Uint8Array),c=new Float32Array(rgb.length);for(let i=0;i<rgb.length;i++)c[i]=linear(rgb[i]);g.setAttribute('color',new THREE.BufferAttribute(c,3))}
 let index=fromBase64(p.indices,Uint16Array);
 // The tailgate model has two small hook lugs on its top corners. Lying flat they stick out past the board's end and look like parts floating in the air (0.35 play-test), so they are left out of the drawing (the model file is unchanged).
 if(part==='tailgate'){const pos=g.getAttribute('position'),inLug=v=>{const x=Math.abs(pos.getX(v)),y=pos.getY(v),z=pos.getZ(v);return x>=1.1&&x<=1.2&&y>=.72&&y<=.84&&z>=-.07&&z<=.001};const keep=[];for(let i=0;i<index.length;i+=3)if(!(inLug(index[i])&&inLug(index[i+1])&&inLug(index[i+2])))keep.push(index[i],index[i+1],index[i+2]);index=Uint16Array.from(keep)}
 g.setIndex(new THREE.BufferAttribute(index,1));g.computeBoundingSphere();geometries.set(part,g);return g;
}
// fade: the world's sightline fade (vehicles pass one that does nothing).
export function buildFlatbed(fade={apply:m=>m}){
 const root=new THREE.Group();root.name='prop-flatbed';
 const solid=()=>fade.apply(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7,metalness:.15}));
 const add=(part,material,parent=root)=>{const m=new THREE.Mesh(geometry(part,{colours:part!=='paint'}),material);m.name='flatbed-'+part;m.castShadow=part!=='glass';m.receiveShadow=true;parent.add(m);return m};
 const body=solid();add('body',body);
 const paint=fade.apply(new THREE.MeshStandardMaterial({color:FLATBED.parts.paint.paintColour,roughness:.45,metalness:.25}));add('paint',paint);
 add('glass',fade.apply(new THREE.MeshStandardMaterial({color:'#9fb7c2',roughness:.08,metalness:.2,transparent:true,opacity:.42,depthWrite:false})));
 add('lights',new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false}));
 const wheels=[];for(const [part,front] of [['wheel-fl',true],['wheel-fr',true],['wheel-rl',false],['wheel-rr',false]]){const pivot=new THREE.Group();pivot.name='wheel-pivot';pivot.position.set(...FLATBED.pivots[part]);root.add(pivot);const spin=add(part,body,pivot);spin.name='wheel';wheels.push({pivot,spin,radius:.55,front})}
 const tailgate=new THREE.Group();tailgate.name='tailgate';tailgate.position.set(...FLATBED.pivots.tailgate);root.add(tailgate);add('tailgate',body,tailgate);
 root.userData.wheels=wheels;root.userData.paint=paint;root.userData.tailgate=tailgate;root.userData.anchors=FLATBED.anchors;
 return root;
}
