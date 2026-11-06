// Converts the user's Tylan Flatbed (assets-src/Veichles/Logging Truck/flatbed.glb, FLATBED_SPEC_UPDATE_2.md) into dist/flatbed-assets.js (0.35).
//   node scripts/build-flatbed.mjs
// The model is already in game units (metres, front +z, ground at y = 0, centred). Parts, each one geometry with vertex colours from its materials' colours (no textures):
//   body (every static mesh but the ones below), paint (Body_Paint: recoloured by the paint system), glass (transparent), lights (emissive: head, tail, indicators),
//   four wheels (in their own node frame: the spin axis is x), the tailgate (in the Tailgate node's frame: the hinge; it opens -90 degrees about x) with its decals.
// The anchors (anchor_* empties) are kept as data: doors, seat, exhaust, fuel port, lights, the five cargo slots, the loading spots, the hinge.
import {readFileSync,writeFileSync} from 'node:fs';
const FILE='assets-src/Veichles/Logging Truck/flatbed.glb';
const raw=readFileSync(FILE),jl=raw.readUInt32LE(12),json=JSON.parse(raw.toString('utf8',20,20+jl)),bin=raw.subarray(20+jl+8,20+jl+8+raw.readUInt32LE(20+jl));
const comp={5121:[Uint8Array,1],5123:[Uint16Array,2],5125:[Uint32Array,4],5126:[Float32Array,4]},ncomp={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
const get=i=>{const a=json.accessors[i],v=json.bufferViews[a.bufferView],[T,sz]=comp[a.componentType],n=ncomp[a.type],stride=v.byteStride||sz*n,out=new Float64Array(a.count*n),dv=new DataView(bin.buffer,bin.byteOffset+(v.byteOffset||0)+(a.byteOffset||0));
 for(let k=0;k<a.count;k++)for(let c=0;c<n;c++){const at=k*stride+c*sz;out[k*n+c]=T===Float32Array?dv.getFloat32(at,true):T===Uint16Array?dv.getUint16(at,true):T===Uint32Array?dv.getUint32(at,true):dv.getUint8(at)}return out};
const mul=(a,b)=>{const o=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)o[j*4+i]+=a[k*4+i]*b[j*4+k];return o};
const trs=n=>{if(n.matrix)return n.matrix;const [x,y,z,w]=n.rotation||[0,0,0,1],[sx,sy,sz]=n.scale||[1,1,1],[tx,ty,tz]=n.translation||[0,0,0];
 return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,tx,ty,tz,1]};
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],srgb=c=>c<=.0031308?c*12.92:1.055*Math.pow(c,1/2.4)-.055,norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l)};
// which part each mesh node goes to; the frame a part is stored in (a node whose world matrix is taken out, so wheels and the tailgate move about their own pivot)
const PART={Body_Paint:'paint',Body_Glass:'glass',Body_Headlights:'lights',Body_Taillights:'lights',Body_Indicators:'lights',Wheel_FL:'wheel-fl',Wheel_FR:'wheel-fr',Wheel_RL:'wheel-rl',Wheel_RR:'wheel-rr',Tailgate:'tailgate',Decals_Tailgate:'tailgate'};
const FRAME={'wheel-fl':'Wheel_FL','wheel-fr':'Wheel_FR','wheel-rl':'Wheel_RL','wheel-rr':'Wheel_RR',tailgate:'Tailgate'};
const world=new Map();const walk=(i,parent)=>{const n=json.nodes[i],m=mul(parent,trs(n));world.set(n.name,m);for(const c of n.children||[])walk(c,m)};for(const r of json.scenes[json.scene||0].nodes)walk(r,I);
const inverse=m=>{ // rigid transforms only (rotation + translation): the inverse is the transpose and the turned translation
 const r=[m[0],m[1],m[2],m[4],m[5],m[6],m[8],m[9],m[10]],t=[m[12],m[13],m[14]];
 return [r[0],r[3],r[6],0,r[1],r[4],r[7],0,r[2],r[5],r[8],0,-(r[0]*t[0]+r[1]*t[1]+r[2]*t[2]),-(r[3]*t[0]+r[4]*t[1]+r[5]*t[2]),-(r[6]*t[0]+r[7]*t[1]+r[8]*t[2]),1]};
const parts={},materials=new Set();
for(const n of json.nodes){if(n.mesh===undefined)continue;const part=PART[n.name]||'body',frame=FRAME[part],m=frame?mul(inverse(world.get(frame)),world.get(n.name)):world.get(n.name);
 const P=parts[part]||(parts[part]={pos:[],nor:[],col:[],idx:[]});
 for(const prim of json.meshes[n.mesh].primitives){const mat=json.materials[prim.material],c=mat.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1];materials.add(mat.name);
  const pos=get(prim.attributes.POSITION),nor=get(prim.attributes.NORMAL),idx=prim.indices!==undefined?Array.from(get(prim.indices)):Array.from({length:pos.length/3},(_,k)=>k),base=P.pos.length/3;
  for(let k=0;k<pos.length/3;k++){const x=pos[k*3],y=pos[k*3+1],z=pos[k*3+2];P.pos.push(m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]);
   const q=norm([m[0]*nor[k*3]+m[4]*nor[k*3+1]+m[8]*nor[k*3+2],m[1]*nor[k*3]+m[5]*nor[k*3+1]+m[9]*nor[k*3+2],m[2]*nor[k*3]+m[6]*nor[k*3+1]+m[10]*nor[k*3+2]]);P.nor.push(...q);
   P.col.push(...[0,1,2].map(i=>Math.round(Math.max(0,Math.min(1,srgb(c[i])))*255)))}
  for(const i of idx)P.idx.push(base+i);
  if(mat.emissiveFactor&&mat.emissiveFactor.some(v=>v>0))P.emissive=Math.max(P.emissive||0,(mat.extensions?.KHR_materials_emissive_strength?.emissiveStrength)||1);
  if(part==='paint')P.paintColour='#'+[0,1,2].map(i=>Math.round(srgb(c[i])*255).toString(16).padStart(2,'0')).join('');
 }}
const b64=(T,a)=>Buffer.from(new T(a).buffer).toString('base64');
const out={source:'Veichles/Logging Truck/flatbed.glb',parts:{},pivots:{},anchors:{}};let tris=0;
for(const [id,P] of Object.entries(parts)){out.parts[id]={positions:b64(Float32Array,P.pos),normals:b64(Float32Array,P.nor),colors:b64(Uint8Array,P.col),indices:b64(Uint16Array,P.idx),triangles:P.idx.length/3,...(P.emissive?{emissive:P.emissive}:{}),...(P.paintColour?{paintColour:P.paintColour}:{})};tris+=P.idx.length/3}
for(const [part,node] of Object.entries(FRAME)){const m=world.get(node);out.pivots[part]=[m[12],m[13],m[14]].map(v=>+v.toFixed(4))}
for(const n of json.nodes)if(n.name.startsWith('anchor_')){const m=world.get(n.name);out.anchors[n.name.slice(7)]=[m[12],m[13],m[14]].map(v=>+v.toFixed(4))}
const clips={};for(const a of json.animations||[])clips[a.name]=+json.accessors[a.samplers[0].input].max[0].toFixed(3);out.clips=clips;
let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(const P of Object.values(parts))for(let i=0;i<P.pos.length;i+=3)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],P.pos[i+k]);hi[k]=Math.max(hi[k],P.pos[i+k])}
out.triangles=tris;out.bounds={min:lo.map(v=>+v.toFixed(3)),max:hi.map(v=>+v.toFixed(3))};
writeFileSync('dist/flatbed-assets.js',`// GENERATED by scripts/build-flatbed.mjs from ${out.source} (the project owner's own model; ASSETS.md). Parts in metres, front +z; wheels and the tailgate in their pivot's frame.\nexport const FLATBED=${JSON.stringify(out)};\n`);
console.log(`flatbed: ${tris} triangles in ${Object.keys(parts).length} parts (${Object.entries(parts).map(([k,p])=>k+' '+p.idx.length/3).join(', ')}), bounds ${JSON.stringify(out.bounds)}, materials ${[...materials].join(', ')}, pivots ${JSON.stringify(out.pivots)}, clips ${JSON.stringify(clips)}`);
