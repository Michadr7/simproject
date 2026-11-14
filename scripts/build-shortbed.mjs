// Converts the user's Kasumuchi S70 shortbed truck (assets-src/Vehicles/Kasumuchi S70/Kasumuchi S70 - V7 Game.glb, spec in "Kasumuchi S70 - V6 Spec Sheet.md" and "Kasumuchi S70 - V7 Spec Notes.md") into dist/shortbed-assets.js (0.35.8).
//   node scripts/build-shortbed.mjs
// Same method as build-flatbed.mjs: the model is already in game units (metres, +Y up, +Z forward, +X the driver's side). Parts, each one geometry with vertex colours from its materials' colours (no textures):
//   body (every static mesh, the closed tailgate included), paint (every Truck_Paint primitive that does not move: recoloured by the paint system), glass (transparent), lights (emissive: head, tail, indicators),
//   four wheels (in their pivot's frame: Steer_FL and Steer_FR for the front pair, the wheel node for the rear; the spin axis is x),
//   two doors (frame DoorPivot_L / DoorPivot_R: a body part with their trim, metal, indicator and glass colours, and a paint part), the steering wheel (frame CabSteeringWheel; it turns about z).
// The anchors (anchor_*) and the pivots are kept as data. Nothing here is in the repo's assets-src (not committed): the output file is what ships.
import {readFileSync,writeFileSync} from 'node:fs';
const FILE='assets-src/Vehicles/Kasumuchi S70/Kasumuchi S70 - V7 Game.glb',INTERIOR='assets-src/Vehicles/Kasumuchi S70/Kasumuchi S70 - V7 Interior.glb'; // the interior (dashboard, seats) is a second GLB built in Blender (scripts are outside the repo): one extra part, 'interior'
let json,bin,world; const open=file=>{const raw=readFileSync(file),jl=raw.readUInt32LE(12);json=JSON.parse(raw.toString('utf8',20,20+jl));bin=raw.subarray(20+jl+8,20+jl+8+raw.readUInt32LE(20+jl))};open(FILE);
const comp={5121:[Uint8Array,1],5123:[Uint16Array,2],5125:[Uint32Array,4],5126:[Float32Array,4]},ncomp={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
const get=i=>{const a=json.accessors[i],v=json.bufferViews[a.bufferView],[T,sz]=comp[a.componentType],n=ncomp[a.type],stride=v.byteStride||sz*n,out=new Float64Array(a.count*n),dv=new DataView(bin.buffer,bin.byteOffset+(v.byteOffset||0)+(a.byteOffset||0));
 for(let k=0;k<a.count;k++)for(let c=0;c<n;c++){const at=k*stride+c*sz;out[k*n+c]=T===Float32Array?dv.getFloat32(at,true):T===Uint16Array?dv.getUint16(at,true):T===Uint32Array?dv.getUint32(at,true):dv.getUint8(at)}return out};
const mul=(a,b)=>{const o=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)o[j*4+i]+=a[k*4+i]*b[j*4+k];return o};
const trs=n=>{if(n.matrix)return n.matrix;const [x,y,z,w]=n.rotation||[0,0,0,1],[sx,sy,sz]=n.scale||[1,1,1],[tx,ty,tz]=n.translation||[0,0,0];
 return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,tx,ty,tz,1]};
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],srgb=c=>c<=.0031308?c*12.92:1.055*Math.pow(c,1/2.4)-.055,norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l)};
// which part a primitive goes to (by node, then by material), and the node whose frame a part is stored in
const NODE_PART={Body_Paint:'paint',Body_Glass:'glass',Body_Headlights:'lights',Body_Taillights:'lights',Body_Indicators:'lights',Wheel_FL:'wheel-fl',Wheel_FR:'wheel-fr',Wheel_RL:'wheel-rl',Wheel_RR:'wheel-rr',CabSteeringWheel_Visual:'steer-wheel'};
for(const s of ['L','R'])for(const n of ['Door','DoorGlass','DoorIndicator','DoorMetal','DoorTrim'])NODE_PART[`${n}_${s}`]=n==='Door'?`door-${s.toLowerCase()}-paint`:n==='DoorGlass'?`door-${s.toLowerCase()}-glass`:`door-${s.toLowerCase()}`;
const FRAME={'wheel-fl':'Steer_FL','wheel-fr':'Steer_FR','wheel-rl':'Wheel_RL','wheel-rr':'Wheel_RR','door-l':'DoorPivot_L','door-l-paint':'DoorPivot_L','door-l-glass':'DoorPivot_L','door-r-glass':'DoorPivot_R','door-r':'DoorPivot_R','door-r-paint':'DoorPivot_R','steer-wheel':'CabSteeringWheel'};
const PIVOT={'wheel-fl':'Steer_FL','wheel-fr':'Steer_FR','wheel-rl':'Wheel_RL','wheel-rr':'Wheel_RR','door-l':'DoorPivot_L','door-r':'DoorPivot_R','steer-wheel':'CabSteeringWheel'};
const walkAll=()=>{world=new Map();const walk=(i,parent)=>{const n=json.nodes[i],m=mul(parent,trs(n));world.set(n.name,m);for(const c of n.children||[])walk(c,m)};for(const r of json.scenes[json.scene||0].nodes)walk(r,I)};walkAll();
const inverse=m=>{ // rigid transforms only (rotation + translation): the inverse is the transpose and the turned translation
 const r=[m[0],m[1],m[2],m[4],m[5],m[6],m[8],m[9],m[10]],t=[m[12],m[13],m[14]];
 return [r[0],r[3],r[6],0,r[1],r[4],r[7],0,r[2],r[5],r[8],0,-(r[0]*t[0]+r[1]*t[1]+r[2]*t[2]),-(r[3]*t[0]+r[4]*t[1]+r[5]*t[2]),-(r[6]*t[0]+r[7]*t[1]+r[8]*t[2]),1]};
const parts={},materials=new Set(),partOf=(node,mat)=>force||NODE_PART[node.name]||(mat.name==='Truck_Paint'?'paint':'body');let force=null,flipped=0;
function ingest(){for(const n of json.nodes){if(n.mesh===undefined)continue;
 for(const prim of json.meshes[n.mesh].primitives){const mat=json.materials[prim.material],c=mat.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1];materials.add(mat.name);
  const part=partOf(n,mat),frame=FRAME[part],m=frame?mul(inverse(world.get(frame)),world.get(n.name)):world.get(n.name),P=parts[part]||(parts[part]={pos:[],nor:[],col:[],idx:[]});
  const pos=get(prim.attributes.POSITION),nor=get(prim.attributes.NORMAL),idx=prim.indices!==undefined?Array.from(get(prim.indices)):Array.from({length:pos.length/3},(_,k)=>k),base=P.pos.length/3;
  for(let k=0;k<pos.length/3;k++){const x=pos[k*3],y=pos[k*3+1],z=pos[k*3+2];P.pos.push(m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]);
   const q=norm([m[0]*nor[k*3]+m[4]*nor[k*3+1]+m[8]*nor[k*3+2],m[1]*nor[k*3]+m[5]*nor[k*3+1]+m[9]*nor[k*3+2],m[2]*nor[k*3]+m[6]*nor[k*3+1]+m[10]*nor[k*3+2]]);P.nor.push(...q);
   P.col.push(...[0,1,2].map(i=>Math.round(Math.max(0,Math.min(1,srgb(c[i])))*255)))}
  // The KASUMUCHI lettering (node Body_Rims, on the dark band above the grille) is modelled facing backwards (+z is forward; its normals and winding point -z): Blender shows it because the file's materials are double-sided, the game draws front faces only and hid it. Turn those triangles round.
  if(n.name==='Body_Rims')for(let t=0;t<idx.length;t+=3){const [a,b,c]=[idx[t],idx[t+1],idx[t+2]].map(i=>base+i),cz=(P.pos[a*3+2]+P.pos[b*3+2]+P.pos[c*3+2])/3,cy=(P.pos[a*3+1]+P.pos[b*3+1]+P.pos[c*3+1])/3;
   if(cz>2.6&&cy>1.2&&cy<1.6&&P.nor[a*3+2]<-.5){[idx[t+1],idx[t+2]]=[idx[t+2],idx[t+1]];for(const v of [a,b,c])for(let k=0;k<3;k++)P.nor[v*3+k]=-P.nor[v*3+k];flipped++}}
  for(const i of idx)P.idx.push(base+i);
  if(mat.name==='Truck_Paint'&&!force)P.paintColour='#'+[0,1,2].map(i=>Math.round(srgb(c[i])*255).toString(16).padStart(2,'0')).join('');
 }}}
ingest();const gameWorld=world;open(INTERIOR);walkAll();force='interior';ingest();open(FILE);world=gameWorld; // the interior: every mesh of the second file, in the model's own axes, as one part
const b64=(T,a)=>Buffer.from(new T(a).buffer).toString('base64');
const out={source:'Vehicles/Kasumuchi S70/Kasumuchi S70 - V7 Game.glb + Kasumuchi S70 - V7 Interior.glb',parts:{},pivots:{},anchors:{}};let tris=0;
for(const [id,P] of Object.entries(parts)){out.parts[id]={positions:b64(Float32Array,P.pos),normals:b64(Float32Array,P.nor),colors:b64(Uint8Array,P.col),indices:b64(Uint16Array,P.idx),triangles:P.idx.length/3,...(P.paintColour&&id.endsWith('paint')?{paintColour:P.paintColour}:{})};tris+=P.idx.length/3}
for(const [part,node] of Object.entries(PIVOT)){const m=world.get(node);out.pivots[part]=[m[12],m[13],m[14]].map(v=>+v.toFixed(4))}
for(const n of json.nodes)if(n.name.startsWith('anchor_')){const m=world.get(n.name);out.anchors[n.name.slice(7)]=[m[12],m[13],m[14]].map(v=>+v.toFixed(4))}
const clips={};for(const a of json.animations||[])clips[a.name]=+json.accessors[a.samplers[0].input].max[0].toFixed(3);out.clips=clips;
// the spec's numbers, kept as data (the file itself carries no wheel or suspension clips)
out.spec={wheelRadius:.401,wheelbase:3,track:1.66,steerDegrees:35,compression:.1,doorDegrees:70,doorSeconds:.875};
let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(const [id,P] of Object.entries(parts)){const at=FRAME[id]?world.get(FRAME[id]):I;for(let i=0;i<P.pos.length;i+=3){const x=P.pos[i],y=P.pos[i+1],z=P.pos[i+2],w=[at[0]*x+at[4]*y+at[8]*z+at[12],at[1]*x+at[5]*y+at[9]*z+at[13],at[2]*x+at[6]*y+at[10]*z+at[14]];for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],w[k]);hi[k]=Math.max(hi[k],w[k])}}}
out.triangles=tris;out.bounds={min:lo.map(v=>+v.toFixed(3)),max:hi.map(v=>+v.toFixed(3))}; // the real extent, parts back in their rest places (the file's raw accessor box would put the doors 0.58 m below the ground)
writeFileSync('dist/shortbed-assets.js',`// GENERATED by scripts/build-shortbed.mjs from ${out.source} (the project owner's own model; ASSETS.md). Parts in metres, front +z; wheels, doors and the steering wheel in their pivot's frame.\nexport const SHORTBED=${JSON.stringify(out)};\n`);
console.log(`lettering triangles turned round: ${flipped}`);console.log(`shortbed: ${tris} triangles in ${Object.keys(parts).length} parts (${Object.entries(parts).map(([k,p])=>k+' '+p.idx.length/3).join(', ')}), bounds ${JSON.stringify(out.bounds)}, materials ${[...materials].join(', ')}, pivots ${JSON.stringify(out.pivots)}, clips ${JSON.stringify(clips)}`);
