// Converts models (GLB, glTF or FBX) into one embedded module, dist/props-assets.js: buildings, vehicles and yard props. For each prop it can turn the
// model, scale it (to a width, a length or a metres-per-model-unit), cut off the ground plate it was modelled on, simplify the mesh, bake plain material
// colours into vertex colours (or shrink the one colour texture), and derive collision boxes from the footprint of whatever stands above a given height.
//   TOOL_DIR=/path/with/node_modules node scripts/build-props.mjs <assets-src folder> [id,id,...]
// TOOL_DIR needs `meshoptimizer`, `sharp` and `three` (npm i --no-save meshoptimizer sharp three@0.160.0; three is only for reading FBX).
// The assets-src folder holds the original models (see ASSETS.md for sources and licences); every `file` below is relative to it.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
const toolDir=resolve(process.env.TOOL_DIR||'.'),toolRequire=createRequire(join(toolDir,'noop.js'));
const {MeshoptSimplifier}=toolRequire('meshoptimizer'),sharp=toolRequire('sharp');
await MeshoptSimplifier.ready;
const root=resolve(process.argv[2]||'assets-src');

// ── What to build ────────────────────────────────────────────────────────────────────────────────────────────────────
// file; size: `width` (x extent, m), `length` (z extent, m), `longest` (the longer horizontal extent, m) or `scale` (m per model unit); `turn`: degrees about y (a multiple of 90) so the
// front faces +z; `cut` ('auto' removes a ground plate); `triangles` (null keeps all); `texture` [px, quality or 'png'] (only for models with one colour texture; models with plain
// colours are baked to vertex colours); `collide`: a grid cell in metres, a height band (only upright faces inside it count), `walls` (ignore roofs and floors; vehicles and logs fill their rows);
// `door`: where the front door is, along the front wall (x, metres from the centre) and its size.
const S=Number(process.env.SCALE_HOUSE||8); // metres per Kenney model unit (houses and shops): a front door comes out about 2 m high, checked against the avatar
const DOOR=x=>({x,width:1.4,height:2.05});
const WALLS={cell:.5,band:[.5,2.1],walls:true,despeckle:false},SOLID={cell:.5,band:[.3,1.9],walls:false,despeckle:false};
const house=(file,doorX)=>({file:`kenney-suburban/GLB format/building-type-${file}.glb`,scale:S,door:DOOR(doorX),cut:null,triangles:null,texture:[128,'png'],collide:WALLS});
const shop=file=>({file:`kenney-commercial/GLB format/building-${file}.glb`,scale:S,cut:null,triangles:null,texture:[128,'png'],collide:WALLS});
const farm=(file,scale,triangles=null)=>({file:`quaternius-farm/${file}.glb`,scale,cut:null,triangles,collide:WALLS});
const car=(file,longest,triangles=1200)=>({file:`quaternius-cars/${file}.glb`,longest,cut:null,triangles,wheels:.25,collide:SOLID}); // wheels: kept, at a quarter of their triangles
const PROPS={
 sawmill:{file:'tripo/sawmill.glb',width:12,cut:null,triangles:null,texture:[1024,80],collide:{cell:.5,band:[.5,2.1],walls:true,despeckle:false}},
 // Kenney suburban houses (CC0): the three first homes, then the Cedar Heights ring and the farmhouse.
 'house-a':house('a',0),'house-e':house('e',0),'house-h':house('h',0),'house-c':house('c',0),'house-j':house('j',0),'house-l':house('l',1.2),'house-o':house('o',3.1),'house-r':house('r',2),'house-t':house('t',0),
 // Kenney commercial buildings (CC0): Alder Center. The Store is a Poly Pizza model.
 'shop-e':shop('e'),'shop-i':shop('i'),'shop-l':shop('l'),'shop-a':shop('a'),'shop-c':shop('c'),'shop-d':shop('d'),'shop-f':shop('f'),'shop-g':shop('g'),'shop-h':shop('h'),
 store:{file:'polypizza/Store.glb',width:13,cut:null,triangles:null,texture:[256,80],collide:WALLS,
  // the Store's palette is a harsh navy, black and grey: slate for the black trim, a soft teal for the navy columns, warmer greys
  recolour:[[[32,32,32],[92,99,106],70],[[32,0,96],[44,122,124],70],[[176,176,176],[222,214,198],45],[[144,144,144],[188,180,164],45]]},
 // Quaternius farm buildings (CC0), enlarged 1.55 times to feel like working farm buildings.
 barn:farm('Barn',1.55),'small-barn':farm('Small Barn',1.55),'open-barn':farm('Open Barn',1.55),'silo-house':farm('Silo House',1.55),coop:farm('ChickenCoop',1.5),windmill:farm('Tower Windmill',1.25,3000),
 // Timber yard.
 hut:{file:'polypizza/Hut_by_Quaternius.glb',width:6.5,cut:null,triangles:null,collide:{cell:.5,band:[.5,2.1],walls:true,despeckle:false}},
 log:{file:'polypizza/Wood_Log.glb',longest:2.8,cut:null,triangles:null,collide:{cell:.5,band:[.1,.8],walls:false,despeckle:false}},
 // Vehicles: simplified to about 1,200 triangles for cars, 2,800 and 3,500 for the trucks. Parked as props for now; drivable later (DESIGN.md).
 car:car('Car',4.4),suv:car('SUV',4.7),'sports-car':car('Sports Car',4.3),'police-car':car('Police Car',4.4),taxi:car('Taxi',4.4),'car-2':car('Car-unqqkULtRU',4.4),'sports-car-2':car('Sports Car-1mkmFkAz5v',4.3),
 pickup:{file:'vehicles/Pickup.fbx',longest:5.3,cut:null,triangles:2800,wheels:.35,paint:{body:'#9c2f2a',tyre:'#151515',rim:'#b9bdc2',light:'#f3e8b8'},collide:SOLID}, // the file has no colours: a farm-red pickup with black tyres and silver rims
 flatbed:{file:'vehicles/Flatbed.fbx',longest:8.6,cut:null,triangles:3500,wheels:.35,collide:SOLID},
 // Interior furniture (Kenney Furniture Kit, CC0): 2 m per model unit, plain colours baked to vertex colours, solid boxes on a 25 cm grid (a rug has none).
 ...Object.fromEntries(Object.entries({'f-bed-double':'Bed Double','f-bed-single':'Bed Single','f-sofa':'Lounge Sofa','f-coffee-table':'Table Coffee','f-table':'Table','f-chair':'Chair','f-tv':'Television','f-tv-cabinet':'Cabinet Television','f-bookcase':'Bookcase Open','f-wardrobe':'Bookcase Closed Doors',
  'f-desk':'Desk','f-desk-chair':'Chair Desk','f-cabinet':'Kitchen Cabinet','f-sink':'Kitchen Sink','f-stove':'Kitchen Stove','f-fridge':'Kitchen Fridge Large','f-toilet':'Toilet','f-bath':'Bathtub','f-bath-sink':'Bathroom Sink','f-lamp':'Lamp Round Floor','f-rug':'Rug Rectangle','f-plant':'Potted Plant','f-stairs':'Stairs','f-side-table':'Side Table'})
  .map(([id,file])=>[id,{file:`kenney-furniture/${file}.glb`,scale:2,cut:null,triangles:null,collide:id==='f-rug'?{cell:.25,band:[9,10],walls:false,despeckle:false}:{cell:.25,band:[.1,1.4],walls:false,despeckle:false}}])),
 farmyard:{skip:true,file:'LowPOlyFarm_buildings.glb',width:40,cut:'auto',triangles:13000,texture:[1024,78],collide:{cell:1,band:[2,99],walls:false,despeckle:true}} // not used: it looked too rough in the game
};
const only=process.argv[3]?new Set(process.argv[3].split(',')):null; // optional: build just these ids (the others are kept from the existing file)

// ── Reading models into one flat mesh: positions, normals, uvs or colours, triangles, and the colour texture if there is one ───────
const mulM=(a,b)=>{const o=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)o[j*4+i]+=a[k*4+i]*b[j*4+k];return o};
const trsM=n=>{if(n.matrix)return n.matrix;const [x,y,z,w]=n.rotation||[0,0,0,1],[sx,sy,sz]=n.scale||[1,1,1],[tx,ty,tz]=n.translation||[0,0,0];
 return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,tx,ty,tz,1]};
const sRGB8=c=>Math.max(0,Math.min(255,Math.round((c<=.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-.055)*255)));
function readGltf(path){
 const raw=readFileSync(path);let json,bin;
 if(path.endsWith('.gltf')){json=JSON.parse(raw.toString('utf8'));const b=json.buffers[0];bin=b.uri.startsWith('data:')?Buffer.from(b.uri.split(',')[1],'base64'):readFileSync(join(dirname(path),decodeURIComponent(b.uri)))}
 else{let off=12;while(off<raw.length){const len=raw.readUInt32LE(off),type=raw.readUInt32LE(off+4),body=raw.subarray(off+8,off+8+len);if(type===0x4E4F534A)json=JSON.parse(body.toString('utf8'));else if(type===0x004E4942)bin=body;off+=8+len}}
 const acc=i=>{const a=json.accessors[i],v=json.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],T={5126:Float32Array,5123:Uint16Array,5125:Uint32Array,5121:Uint8Array}[a.componentType];
  const off=(v.byteOffset||0)+(a.byteOffset||0),size=T.BYTES_PER_ELEMENT,stride=v.byteStride||n*size,out=new T(a.count*n),dv=new DataView(bin.buffer,bin.byteOffset);
  for(let k=0;k<a.count;k++)for(let c=0;c<n;c++){const at=off+k*stride+c*size;out[k*n+c]=T===Float32Array?dv.getFloat32(at,true):T===Uint16Array?dv.getUint16(at,true):T===Uint8Array?dv.getUint8(at):dv.getUint32(at,true)}return out};
 const parts=[],walk=(i,pm)=>{const n=json.nodes[i],m=mulM(pm,trsM(n));
  if(n.mesh!==undefined)for(const p of json.meshes[n.mesh].primitives){
   if(p.mode!==undefined&&p.mode!==4)continue;const P=acc(p.attributes.POSITION),N=p.attributes.NORMAL!==undefined?acc(p.attributes.NORMAL):null,U=p.attributes.TEXCOORD_0!==undefined?acc(p.attributes.TEXCOORD_0):null,
    idx=p.indices!==undefined?Uint32Array.from(acc(p.indices)):Uint32Array.from({length:P.length/3},(_,k)=>k),mat=json.materials?.[p.material]?.pbrMetallicRoughness||{};
   const tp=P.slice(),tn=N?N.slice():null;for(let k=0;k<P.length;k+=3){const x=P[k],y=P[k+1],z=P[k+2];tp[k]=m[0]*x+m[4]*y+m[8]*z+m[12];tp[k+1]=m[1]*x+m[5]*y+m[9]*z+m[13];tp[k+2]=m[2]*x+m[6]*y+m[10]*z+m[14];
    if(tn){const a=N[k],b=N[k+1],c=N[k+2];tn[k]=m[0]*a+m[4]*b+m[8]*c;tn[k+1]=m[1]*a+m[5]*b+m[9]*c;tn[k+2]=m[2]*a+m[6]*b+m[10]*c}}
   const ti=mat.baseColorTexture?json.textures[mat.baseColorTexture.index].source:null;
   parts.push({pos:tp,nor:tn,uv:U,idx,color:(mat.baseColorFactor||[1,1,1,1]).slice(0,3),image:ti,node:n.name||''})}
  for(const c of n.children||[])walk(c,m)};
 for(const r of json.scenes[json.scene||0].nodes)walk(r,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
 const imageOf=i=>{const im=json.images[i];if(im.uri)return readFileSync(join(dirname(path),decodeURIComponent(im.uri)));const v=json.bufferViews[im.bufferView];return Buffer.from(bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength))};
 return {parts,imageOf};
}
let fbxLoader=null;
async function readFbx(path){
 if(!fbxLoader){globalThis.document=globalThis.document||{createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(v){}})}; // FBXLoader wants a DOM for its textures; we read none
  const {FBXLoader}=await import(pathToFileURL(join(toolDir,'node_modules/three/examples/jsm/loaders/FBXLoader.js')).href);fbxLoader=new FBXLoader()}
 const buf=readFileSync(path),obj=fbxLoader.parse(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength),dirname(path)+'/');obj.updateMatrixWorld(true);
 const parts=[];obj.traverse(o=>{if(!o.isMesh)return;const g=o.geometry,me=o.matrixWorld.elements,pos=g.attributes.position,nor=g.attributes.normal,index=g.index?Array.from(g.index.array):Array.from({length:pos.count},(_,k)=>k);
  const mats=Array.isArray(o.material)?o.material:[o.material],groups=g.groups.length?g.groups:[{start:0,count:index.length,materialIndex:0}];
  const P=new Float32Array(pos.count*3),Nn=nor?new Float32Array(pos.count*3):null;
  for(let k=0;k<pos.count;k++){const x=pos.getX(k),y=pos.getY(k),z=pos.getZ(k);P[k*3]=me[0]*x+me[4]*y+me[8]*z+me[12];P[k*3+1]=me[1]*x+me[5]*y+me[9]*z+me[13];P[k*3+2]=me[2]*x+me[6]*y+me[10]*z+me[14];
   if(nor){const a=nor.getX(k),b=nor.getY(k),c=nor.getZ(k);Nn[k*3]=me[0]*a+me[4]*b+me[8]*c;Nn[k*3+1]=me[1]*a+me[5]*b+me[9]*c;Nn[k*3+2]=me[2]*a+me[6]*b+me[10]*c}}
  for(const grp of groups){const m=mats[grp.materialIndex]||mats[0],col=m.color?[m.color.r,m.color.g,m.color.b]:[.8,.8,.8];
   parts.push({pos:P,nor:Nn,uv:null,idx:Uint32Array.from(index.slice(grp.start,grp.start+grp.count)),color:col,image:null,node:o.name||'',material:m.name||''})}});
 return {parts,imageOf:()=>null};
}

// `paint` (a model whose materials carry no colour, like the pickup): finds the wheels as islands of connected triangles by their shape (a tyre is a thick disc standing on the ground,
// a rim a thin disc inside it), paints tyres, rims, lights and the rest of the body, and marks the wheels so they are simplified on their own.
const lin=hex=>[1,3,5].map(i=>{const c=parseInt(hex.slice(i,i+2),16)/255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)});
function paintParts(parts,paint){
 let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(const p of parts)for(let i=0;i<p.pos.length;i+=3)for(let d=0;d<3;d++){lo[d]=Math.min(lo[d],p.pos[i+d]);hi[d]=Math.max(hi[d],p.pos[i+d])}
 const H=hi[1]-lo[1],out=[];
 for(const part of parts){
  if(/light/i.test(part.material||'')){out.push({...part,color:lin(paint.light),node:''});continue}
  const key=v=>`${Math.round(part.pos[v*3]*100)},${Math.round(part.pos[v*3+1]*100)},${Math.round(part.pos[v*3+2]*100)}`,ids=new Map(),parent=[];
  const id=v=>{const k=key(v);if(!ids.has(k)){ids.set(k,parent.length);parent.push(parent.length)}return ids.get(k)},find=a=>{while(parent[a]!==a){parent[a]=parent[parent[a]];a=parent[a]}return a};
  const tri=[];for(let t=0;t<part.idx.length;t+=3){const a=id(part.idx[t]),b=id(part.idx[t+1]),c=id(part.idx[t+2]);parent[find(a)]=find(b);parent[find(b)]=find(c);tri.push(a)}
  const islands=new Map();for(let t=0;t<tri.length;t++){const r=find(tri[t]);if(!islands.has(r))islands.set(r,{tris:[],lo:[1e9,1e9,1e9],hi:[-1e9,-1e9,-1e9]});const e=islands.get(r);e.tris.push(t);for(let k=0;k<3;k++)for(let d=0;d<3;d++){const v=part.pos[part.idx[t*3+k]*3+d];e.lo[d]=Math.min(e.lo[d],v);e.hi[d]=Math.max(e.hi[d],v)}}
  const groups={tyre:[],rim:[],body:[]};
  for(const e of islands.values()){const dx=e.hi[0]-e.lo[0],dy=e.hi[1]-e.lo[1],dz=e.hi[2]-e.lo[2],round=Math.abs(dy-dz)<=.12*Math.max(dy,dz),low=e.lo[1]-lo[1];
   const kind=e.tris.length>=100&&round&&dx<.75*dy&&low<.08*H?'tyre':e.tris.length>=60&&round&&dx<.3*dy&&low>.02*H&&low<.35*H?'rim':'body';groups[kind].push(...e.tris)}
  for(const [kind,tris] of Object.entries(groups)){if(!tris.length)continue;const idx=new Uint32Array(tris.length*3);tris.forEach((t,i)=>{idx.set(part.idx.subarray(t*3,t*3+3),i*3)});out.push({...part,idx,color:lin(paint[kind]),node:kind==='body'?'':'wheel'})}
 }
 return out;
}
const b64=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64');
const existing=existsSync('dist/props-assets.js')&&only?(await import(pathToFileURL(resolve('dist/props-assets.js')).href+'?x='+Date.now())).PROPS:{};
const out={props:{...existing}},report=[];
for(const [id,spec] of Object.entries(PROPS)){
 if(spec.skip||(only&&!only.has(id)))continue;
 const path=join(root,spec.file),model=path.toLowerCase().endsWith('.fbx')?await readFbx(path):readGltf(path);
 if(spec.paint)model.parts=paintParts(model.parts,spec.paint);
 // 1. merge every mesh into one: world-space positions, normals, and either uvs (one colour texture) or colours (plain materials)
 const textured=model.parts.some(p=>p.image!==null);
 if(textured&&new Set(model.parts.map(p=>p.image)).size>1)throw new Error(id+' has several textures');
 if(textured&&model.parts.some(p=>p.image===null))throw new Error(id+' mixes textured and plain materials');
 let pos=[],nor=[],uv=[],col=[],idx=[],base=0;const group=[]; // group: 1 for a vertex of a wheel (a part whose name says wheel, tyre or tire), 0 otherwise
 for(const p of model.parts){
  const count=p.pos.length/3,isWheel=spec.wheels&&/wheel|tyre|tire/i.test(p.node||'')?1:0;for(let k=0;k<count;k++)group.push(isWheel);for(let k=0;k<p.pos.length;k++)pos.push(p.pos[k]);
  if(p.nor)for(let k=0;k<p.nor.length;k++)nor.push(p.nor[k]);else for(let k=0;k<p.pos.length;k++)nor.push(0);
  if(textured)for(let k=0;k<count*2;k++)uv.push(p.uv[k]);else{const c=p.color.map(sRGB8);for(let k=0;k<count;k++)col.push(c[0],c[1],c[2])}
  for(const i of p.idx)idx.push(i+base);base+=count}
 pos=Float32Array.from(pos);nor=Float32Array.from(nor);idx=Uint32Array.from(idx);
 if(textured)uv=Float32Array.from(uv);else col=Uint8Array.from(col);
 // faces whose normals are missing: flat normals
 if(nor.every(v=>v===0)){const n2=new Float32Array(pos.length);for(let t=0;t<idx.length;t+=3){const [a,b,c]=[idx[t]*3,idx[t+1]*3,idx[t+2]*3],ux=pos[b]-pos[a],uy=pos[b+1]-pos[a+1],uz=pos[b+2]-pos[a+2],vx=pos[c]-pos[a],vy=pos[c+1]-pos[a+1],vz=pos[c+2]-pos[a+2];let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;for(const v of [a,b,c]){n2[v]=nx;n2[v+1]=ny;n2[v+2]=nz}}nor=n2}
 // 2. turn about y (multiples of 90 degrees)
 if(spec.turn){const r=spec.turn*Math.PI/180,c=Math.round(Math.cos(r)),s=Math.round(Math.sin(r));for(let k=0;k<pos.length;k+=3){const x=pos[k],z=pos[k+2];pos[k]=x*c+z*s;pos[k+2]=-x*s+z*c;const a=nor[k],b=nor[k+2];nor[k]=a*c+b*s;nor[k+2]=-a*s+b*c}}
 // 3. weld duplicate vertices (FBX files come unindexed), so the simplifier can merge faces across them
 {const key=new Map(),remap=new Uint32Array(pos.length/3),keep=[];
  for(let v=0;v<pos.length/3;v++){const k=[Math.round(pos[v*3]*1e4),Math.round(pos[v*3+1]*1e4),Math.round(pos[v*3+2]*1e4),Math.round(nor[v*3]*50),Math.round(nor[v*3+1]*50),Math.round(nor[v*3+2]*50),textured?Math.round(uv[v*2]*1e3)+','+Math.round(uv[v*2+1]*1e3):col[v*3]+','+col[v*3+1]+','+col[v*3+2],group[v]].join('|');
   if(!key.has(k)){key.set(k,keep.length);keep.push(v)}remap[v]=key.get(k)}
  const np=new Float32Array(keep.length*3),nn=new Float32Array(keep.length*3),nu=textured?new Float32Array(keep.length*2):null,nc=textured?null:new Uint8Array(keep.length*3);
  const kept=keep.map(v=>group[v]);group.length=0;group.push(...kept);
  keep.forEach((v,k)=>{np.set(pos.subarray(v*3,v*3+3),k*3);nn.set(nor.subarray(v*3,v*3+3),k*3);if(textured)nu.set(uv.subarray(v*2,v*2+2),k*2);else nc.set(col.slice(v*3,v*3+3),k*3)});
  const ni=new Uint32Array(idx.length);let w=0;for(let t=0;t<idx.length;t+=3){const a=remap[idx[t]],b=remap[idx[t+1]],c=remap[idx[t+2]];if(a===b||b===c||a===c)continue;ni[w++]=a;ni[w++]=b;ni[w++]=c}
  pos=np;nor=nn;uv=nu;col=nc;idx=ni.slice(0,w)}
 const before=idx.length/3;
 // 4. cut the ground: the most common height among upward-facing vertices is the ground; drop every triangle on or below it
 if(spec.cut==='auto'){let lo=1e9,hi=-1e9;for(let i=1;i<pos.length;i+=3){lo=Math.min(lo,pos[i]);hi=Math.max(hi,pos[i])}
  const bins=new Map(),step=(hi-lo)/400;for(let i=0;i<pos.length/3;i++)if(nor[i*3+1]>.9){const k=Math.round((pos[i*3+1]-lo)/step);bins.set(k,(bins.get(k)||0)+1)}
  const ground=lo+[...bins.entries()].sort((a,b)=>b[1]-a[1])[0][0]*step,limit=ground+(hi-lo)*.03,keep=[];
  for(let t=0;t<idx.length;t+=3)if(Math.max(pos[idx[t]*3+1],pos[idx[t+1]*3+1],pos[idx[t+2]*3+1])>limit)keep.push(idx[t],idx[t+1],idx[t+2]);
  idx=Uint32Array.from(keep);spec._ground=ground}
 // 5. simplify, keeping uvs or colours and normals as steady as the mesh allows. A model with wheels (`wheels: share`) simplifies its wheels on their own, to that share of their triangles and never to nothing:
 // they are small, dark and made of many triangles, so a single pass would remove them first.
 if(spec.triangles&&idx.length/3>spec.triangles){
  const width=textured?5:6,attrs=new Float32Array(pos.length/3*width);
  for(let i=0;i<pos.length/3;i++){if(textured)attrs.set(uv.subarray(i*2,i*2+2),i*width);else attrs.set([col[i*3]/255,col[i*3+1]/255,col[i*3+2]/255],i*width);attrs.set(nor.subarray(i*3,i*3+3),i*width+(textured?2:3))}
  const weights=textured?[2,2,.6,.6,.6]:[1.5,1.5,1.5,.6,.6,.6];
  const wheelWeights=textured?weights:[1.5,1.5,1.5,.02,.02,.02]; // wheels are round and small: their shading matters far less than their shape and colour
  const simplify=(indices,targetTris,prune=true,w=weights,errors=[.01,.02,.04,.08,.15])=>{const target=Math.max(3,Math.round(targetTris)*3);let result=indices;
   for(const error of errors){const [next]=MeshoptSimplifier.simplifyWithAttributes(indices,pos,3,attrs,width,w,null,target,error,prune?['Prune']:[]);result=next;if(next.length<=target*1.1)break}return result};
  if(spec.wheels&&group.some(g=>g)){const body=[],wheel=[];for(let t=0;t<idx.length;t+=3)(group[idx[t]]?wheel:body).push(idx[t],idx[t+1],idx[t+2]);
   const wheelTarget=Math.round(wheel.length/3*spec.wheels);if(process.env.DEBUG_WHEELS)console.log(id,'body',body.length/3,'wheel',wheel.length/3,'targets',spec.triangles-wheelTarget,wheelTarget);idx=Uint32Array.from([...simplify(Uint32Array.from(body),spec.triangles-wheelTarget),...simplify(Uint32Array.from(wheel),wheelTarget,false,wheelWeights,[.02,.05,.1,.2,.4])])}
  else idx=simplify(idx,spec.triangles)}
 // 6. compact, centre, put the ground at y = 0 and scale
 const used=new Map(),P=[],N=[],U=[],C=[],I=new Uint32Array(idx.length);let count=0;
 for(let i=0;i<idx.length;i++){const o=idx[i];if(!used.has(o)){used.set(o,count++);P.push(pos[o*3],pos[o*3+1],pos[o*3+2]);N.push(nor[o*3],nor[o*3+1],nor[o*3+2]);if(textured)U.push(uv[o*2],uv[o*2+1]);else C.push(col[o*3],col[o*3+1],col[o*3+2])}I[i]=used.get(o)}
 const lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(let i=0;i<P.length;i+=3)for(let c=0;c<3;c++){lo[c]=Math.min(lo[c],P[i+c]);hi[c]=Math.max(hi[c],P[i+c])}
 let k;if(spec.scale)k=spec.scale;else if(spec.width)k=spec.width/(hi[0]-lo[0]);else if(spec.length)k=spec.length/(hi[2]-lo[2]);else k=spec.longest/Math.max(hi[0]-lo[0],hi[2]-lo[2]);
 const cx=(lo[0]+hi[0])/2,cz=(lo[2]+hi[2])/2,baseY=spec._ground??lo[1];
 for(let i=0;i<P.length;i+=3){P[i]=(P[i]-cx)*k;P[i+1]=(P[i+1]-baseY)*k;P[i+2]=(P[i+2]-cz)*k}
 const W=(hi[0]-lo[0])*k,D=(hi[2]-lo[2])*k;let sy=0;for(let i=1;i<P.length;i+=3)sy=Math.max(sy,P[i]);
 // 7. collision boxes: rasterise the triangles tall enough to be walls onto a grid, then cover the occupied cells with as few rectangles as possible
 const {cell,band,walls,despeckle}=spec.collide,gridN=Math.ceil(D/cell)+2,gridM=Math.ceil(W/cell)+2,grid=new Uint8Array(gridN*gridM);
 const gx=x=>Math.floor((x+W/2)/cell),gz=z=>Math.floor((z+D/2)/cell);
 const faceUp=(a,b,c)=>{const ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],vx=P[c]-P[a],vy=P[c+1]-P[a+1],vz=P[c+2]-P[a+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;return {up:ny/l,area:l/2}};
 const floorBins=new Map(),floorTris=[];
 for(let t=0;t<I.length;t+=3){const a=I[t]*3,b=I[t+1]*3,c=I[t+2]*3,top=Math.max(P[a+1],P[b+1],P[c+1]),bottom=Math.min(P[a+1],P[b+1],P[c+1]),face=faceUp(a,b,c);
  if(Math.abs(face.up)>.9&&top<1.5&&bottom>-.2){const key=Math.round(top/.03);floorBins.set(key,(floorBins.get(key)||0)+face.area);floorTris.push([a,b,c,key])}
  if(top<band[0]||bottom>band[1])continue;if(walls&&Math.abs(face.up)>.6)continue;
  const x0=Math.min(P[a],P[b],P[c]),x1=Math.max(P[a],P[b],P[c]),z0=Math.min(P[a+2],P[b+2],P[c+2]),z1=Math.max(P[a+2],P[b+2],P[c+2]);
  for(let ix=gx(x0);ix<=gx(x1);ix++)for(let iz=gz(z0);iz<=gz(z1);iz++)if(ix>=0&&iz>=0&&ix<gridM&&iz<gridN)grid[iz*gridM+ix]=1}
 const solid=(ix,iz)=>ix>=0&&iz>=0&&ix<gridM&&iz<gridN&&grid[iz*gridM+ix];
 const clean=grid.slice();if(despeckle)for(let iz=0;iz<gridN;iz++)for(let ix=0;ix<gridM;ix++)if(solid(ix,iz)){let n=0;for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])if(solid(ix+dx,iz+dz))n++;if(n<1)clean[iz*gridM+ix]=0}
 if(!walls){ // vehicles and logs: a solid block, not just the skin (fill the gaps between the first and last occupied cell of each row)
  for(let iz=0;iz<gridN;iz++){let first=-1,last=-1;for(let ix=0;ix<gridM;ix++)if(clean[iz*gridM+ix]){if(first<0)first=ix;last=ix}if(first>=0)for(let ix=first;ix<=last;ix++)clean[iz*gridM+ix]=1}}
 const taken=new Uint8Array(grid.length),boxes=[];
 for(let iz=0;iz<gridN;iz++)for(let ix=0;ix<gridM;ix++){if(!clean[iz*gridM+ix]||taken[iz*gridM+ix])continue;
  let w=1;while(ix+w<gridM&&clean[iz*gridM+ix+w]&&!taken[iz*gridM+ix+w])w++;
  let h=1;grow:while(iz+h<gridN){for(let d=0;d<w;d++)if(!clean[(iz+h)*gridM+ix+d]||taken[(iz+h)*gridM+ix+d])break grow;h++}
  for(let dz=0;dz<h;dz++)for(let dx=0;dx<w;dx++)taken[(iz+dz)*gridM+ix+dx]=1;
  boxes.push({x:+(((ix+w/2)*cell)-W/2).toFixed(2),z:+(((iz+h/2)*cell)-D/2).toFixed(2),hx:+(w*cell/2).toFixed(2),hz:+(h*cell/2).toFixed(2)})}
 // the floor: the most common top height among large level faces, and the rectangle those faces cover (null if there is no real deck)
 let floor=null;{const best=[...floorBins.entries()].sort((p,q)=>q[1]-p[1])[0];
  if(best&&best[1]>W*W*.04){const y=best[0]*.03;let fx0=1e9,fx1=-1e9,fz0=1e9,fz1=-1e9;for(const [a,b,c,key] of floorTris)if(Math.abs(key-best[0])<=1)for(const v of [a,b,c]){fx0=Math.min(fx0,P[v]);fx1=Math.max(fx1,P[v]);fz0=Math.min(fz0,P[v+2]);fz1=Math.max(fz1,P[v+2])}
   if(y>.05&&y<1.5&&id==='sawmill')floor={y:+y.toFixed(2),x0:+fx0.toFixed(2),x1:+fx1.toFixed(2),z0:+fz0.toFixed(2),z1:+fz1.toFixed(2)}}} // only the sawmill has a deck you walk on
 // 8. the colour texture, shrunk (textured models only)
 let texture=null;
 if(textured){const [size,quality]=spec.texture,png=quality==='png';let raw=model.imageOf(model.parts[0].image),source=sharp(raw);
  // `recolour`: [[from rgb, to rgb, tolerance], ...] repaints palette colours before the texture is shrunk (the Store's navy and black are too harsh): a texel within the tolerance of `from` is moved to `to`, fading out with distance.
  if(spec.recolour){const {data,info}=await sharp(raw).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   for(let i=0;i<data.length;i+=4){let best=null,bw=0;for(const [from,to,tol] of spec.recolour){const d=Math.hypot(data[i]-from[0],data[i+1]-from[1],data[i+2]-from[2]),w=Math.max(0,1-d/tol);if(w>bw){bw=w;best=to}}
    if(best)for(let c=0;c<3;c++)data[i+c]=Math.round(data[i+c]*(1-bw)+best[c]*bw)}
   source=sharp(data,{raw:{width:info.width,height:info.height,channels:4}})}
  const buf=png?await source.resize(size,size,{fit:'fill',kernel:'nearest'}).png({palette:true}).toBuffer():await source.resize(size,size,{fit:'fill'}).jpeg({quality,mozjpeg:true}).toBuffer();
  texture='data:image/'+(png?'png':'jpeg')+';base64,'+buf.toString('base64')}
 if(count>65535)throw new Error(id+' has too many vertices for 16-bit indices');
 const norQ=Int8Array.from(N.map(v=>Math.max(-127,Math.min(127,Math.round(v*127))))),posA=Float32Array.from(P),idxA=Uint16Array.from(I);
 let wx0=1e9,wx1=-1e9,wz0=1e9,wz1=-1e9;for(let i=0;i<P.length;i+=3){wx0=Math.min(wx0,P[i]);wx1=Math.max(wx1,P[i]);wz0=Math.min(wz0,P[i+2]);wz1=Math.max(wz1,P[i+2])}
 const record={source:spec.file,width:+(wx1-wx0).toFixed(2),depth:+(wz1-wz0).toFixed(2),height:+sy.toFixed(2),triangles:I.length/3,footprint:{x0:+wx0.toFixed(2),x1:+wx1.toFixed(2),z0:+wz0.toFixed(2),z1:+wz1.toFixed(2)},colliders:boxes,floor,
  door:spec.door?{x:spec.door.x,z:+wz1.toFixed(2),width:spec.door.width,height:spec.door.height}:null,pos:b64(posA),nor:b64(norQ),norQ:true,idx:b64(idxA),vertices:count};
 if(textured){record.texture=texture;record.uv=b64(Float32Array.from(U))}else record.col=b64(Uint8Array.from(C));
 out.props[id]=record;
 report.push(`${id.padEnd(11)} ${before} -> ${I.length/3} tris, ${(wx1-wx0).toFixed(1)} x ${(wz1-wz0).toFixed(1)} m, ${sy.toFixed(1)} m tall, ${boxes.length} boxes${floor?', floor '+floor.y+' m':''}, ${textured?'texture':'colours'}, ${count} vertices`);
}
const ordered=Object.fromEntries(Object.keys(PROPS).filter(id=>out.props[id]).map(id=>[id,out.props[id]]));
const text=`// GENERATED by scripts/build-props.mjs from the models in assets-src (see ASSETS.md for sources and licences).\nexport const PROPS=${JSON.stringify(ordered)};\n`;
writeFileSync('dist/props-assets.js',text);console.log(report.join('\n'));console.log('wrote dist/props-assets.js',(text.length/1024).toFixed(0),'KB,',Object.keys(ordered).length,'props');
