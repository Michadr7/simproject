// Converts single-mesh GLB props (a sawmill, a whole farmyard) into one embedded module, dist/props-assets.js. For each prop it can cut off the
// ground or base plate it was modelled on, scale it to a width in metres with the ground at y = 0, simplify the mesh, shrink the colour texture,
// and derive collision boxes from the footprint of whatever stands above a given height. Usage:
//   TOOL_DIR=/path/with/node_modules node scripts/build-props.mjs "<folder holding the .glb files>"
// TOOL_DIR needs `meshoptimizer` and `sharp` (npm i --no-save meshoptimizer sharp).
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const toolRequire=createRequire(join(resolve(process.env.TOOL_DIR||'.'),'noop.js'));
const {MeshoptSimplifier}=toolRequire('meshoptimizer'),sharp=toolRequire('sharp');
await MeshoptSimplifier.ready;
const folder=resolve(process.argv[2]||'.'),kenney=resolve(process.argv[3]||folder); // the second folder holds the Kenney City Kit (Suburban) .glb files; its colour texture is in Textures/colormap.png

// file, finished width (x extent) in metres, cut ('auto' removes the base plate and ground), target triangles (null keeps all),
// texture size in px and JPEG quality, collisions: a grid cell in metres, a height band (only upright faces inside it count, so a roof above the band
// does not make the whole building solid), and whether to drop one-cell specks. `skip` leaves a prop out of the output.
const SCALE_HOUSE=Number(process.env.SCALE_HOUSE||8); // metres per Kenney model unit: set from the door height (a front door should be about 2.1 m)
const PROPS={
 sawmill:{file:'sawmill.glb',width:12,cut:null,triangles:null,texture:[1024,80],collide:{cell:.5,band:[.5,2.1],walls:true,despeckle:false}},
 // Kenney houses (CC0): a metres-per-model-unit `scale` instead of a width, `dir:'kenney'`, and a palette texture kept sharp (nearest-neighbour PNG).
 'house-a':{dir:'kenney',file:'building-type-a.glb',scale:SCALE_HOUSE,cut:null,triangles:null,texture:[128,'png'],collide:{cell:.5,band:[.5,2.1],walls:true,despeckle:false}},
 'house-e':{dir:'kenney',file:'building-type-e.glb',scale:SCALE_HOUSE,cut:null,triangles:null,texture:[128,'png'],collide:{cell:.5,band:[.5,2.1],walls:true,despeckle:false}},
 'house-h':{dir:'kenney',file:'building-type-h.glb',scale:SCALE_HOUSE,cut:null,triangles:null,texture:[128,'png'],collide:{cell:.5,band:[.5,2.1],walls:true,despeckle:false}},
 farmyard:{skip:true,file:'LowPOlyFarm_buildings.glb',width:40,cut:'auto',triangles:13000,texture:[1024,78],collide:{cell:1,band:[2,99],walls:false,despeckle:true}} // not used: it looked too rough in the game
};
function parse(path){const d=readFileSync(path),jsonLength=d.readUInt32LE(12);let off=12,json,bin;
 while(off<d.length){const len=d.readUInt32LE(off),type=d.readUInt32LE(off+4),body=d.subarray(off+8,off+8+len);if(type===0x4E4F534A)json=JSON.parse(body.toString('utf8'));else bin=body;off+=8+len}return {json,bin}}
function accessor({json,bin},i){const a=json.accessors[i],v=json.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],T={5126:Float32Array,5123:Uint16Array,5125:Uint32Array}[a.componentType];
 const off=(v.byteOffset||0)+(a.byteOffset||0),size=T.BYTES_PER_ELEMENT,stride=v.byteStride||n*size,out=new T(a.count*n),dv=new DataView(bin.buffer,bin.byteOffset);
 for(let k=0;k<a.count;k++)for(let c=0;c<n;c++){const at=off+k*stride+c*size;out[k*n+c]=T===Float32Array?dv.getFloat32(at,true):T===Uint16Array?dv.getUint16(at,true):dv.getUint32(at,true)}return out}
const b64=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64');

const out={props:{}},report=[];
for(const [id,spec] of Object.entries(PROPS)){
 if(spec.skip)continue;
 const glb=parse(join(spec.dir==='kenney'?kenney:folder,spec.file)),json=glb.json,prim=json.meshes[0].primitives[0];
 if(json.nodes.some(n=>n.scale||n.rotation||n.translation))throw new Error(spec.file+' has a node transform; bake it first');
 let pos=accessor(glb,prim.attributes.POSITION),nor=accessor(glb,prim.attributes.NORMAL),uv=accessor(glb,prim.attributes.TEXCOORD_0),idx=Uint32Array.from(accessor(glb,prim.indices));
 const before=idx.length/3;
 // 1. cut the ground: the most common height among upward-facing vertices is the ground; drop every triangle that lies on or below it.
 if(spec.cut==='auto'){let lo=1e9,hi=-1e9;for(let i=1;i<pos.length;i+=3){lo=Math.min(lo,pos[i]);hi=Math.max(hi,pos[i])}
  const bins=new Map(),step=(hi-lo)/400;for(let i=0;i<pos.length/3;i++)if(nor[i*3+1]>.9){const k=Math.round((pos[i*3+1]-lo)/step);bins.set(k,(bins.get(k)||0)+1)}
  const ground=lo+[...bins.entries()].sort((a,b)=>b[1]-a[1])[0][0]*step,limit=ground+(hi-lo)*.03,keep=[];
  for(let t=0;t<idx.length;t+=3)if(Math.max(pos[idx[t]*3+1],pos[idx[t+1]*3+1],pos[idx[t+2]*3+1])>limit)keep.push(idx[t],idx[t+1],idx[t+2]);
  idx=Uint32Array.from(keep);spec._ground=ground}
 // 2. simplify, keeping texture coordinates and normals as steady as the mesh allows
 if(spec.triangles&&idx.length/3>spec.triangles){
  const attrs=new Float32Array(pos.length/3*5);for(let i=0;i<pos.length/3;i++){attrs.set(uv.subarray(i*2,i*2+2),i*5);attrs.set(nor.subarray(i*3,i*3+3),i*5+2)}
  const target=spec.triangles*3;let result=null;
  for(const error of [.01,.02,.04,.08]){const [next]=MeshoptSimplifier.simplifyWithAttributes(idx,pos,3,attrs,5,[2,2,.6,.6,.6],null,target,error,['Prune']);result=next;if(next.length<=target*1.1)break}
  idx=result}
 // 3. compact, centre, put the ground at y = 0 and scale to the wanted width
 const used=new Map(),P=[],N=[],U=[],I=new Uint32Array(idx.length);let count=0;
 for(let i=0;i<idx.length;i++){const o=idx[i];if(!used.has(o)){used.set(o,count++);P.push(pos[o*3],pos[o*3+1],pos[o*3+2]);N.push(nor[o*3],nor[o*3+1],nor[o*3+2]);U.push(uv[o*2],uv[o*2+1])}I[i]=used.get(o)}
 const lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(let i=0;i<P.length;i+=3)for(let c=0;c<3;c++){lo[c]=Math.min(lo[c],P[i+c]);hi[c]=Math.max(hi[c],P[i+c])}
 if(spec.scale)spec.width=(hi[0]-lo[0])*spec.scale;
 const k=spec.width/(hi[0]-lo[0]),cx=(lo[0]+hi[0])/2,cz=(lo[2]+hi[2])/2,base=spec._ground??lo[1];
 for(let i=0;i<P.length;i+=3){P[i]=(P[i]-cx)*k;P[i+1]=(P[i+1]-base)*k;P[i+2]=(P[i+2]-cz)*k}
 let sy=0,minY=1e9;for(let i=1;i<P.length;i+=3){sy=Math.max(sy,P[i]);minY=Math.min(minY,P[i])}
 // 4. collision boxes: rasterise the triangles tall enough to be walls onto a grid, then cover the occupied cells with as few rectangles as possible
 const {cell,band,walls,despeckle}=spec.collide,gridN=Math.ceil((hi[2]-lo[2])*k/cell)+2,gridM=Math.ceil(spec.width/cell)+2,grid=new Uint8Array(gridN*gridM);
 const gx=x=>Math.floor((x+spec.width/2)/cell),gz=z=>Math.floor((z+(hi[2]-lo[2])*k/2)/cell);
 const faceUp=(a,b,c)=>{const ux=P[b]-P[a],uy=P[b+1]-P[a+1],uz=P[b+2]-P[a+2],vx=P[c]-P[a],vy=P[c+1]-P[a+1],vz=P[c+2]-P[a+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;return {up:ny/l,area:l/2}};
 const floorBins=new Map(),floorTris=[];
 for(let t=0;t<I.length;t+=3){const a=I[t]*3,b=I[t+1]*3,c=I[t+2]*3,top=Math.max(P[a+1],P[b+1],P[c+1]),bottom=Math.min(P[a+1],P[b+1],P[c+1]),face=faceUp(a,b,c);
  // a floor (a deck or platform you can stand on): large, level, facing up, low
  if(Math.abs(face.up)>.9&&top<1.5&&bottom>-.2){const key=Math.round(top/.03);floorBins.set(key,(floorBins.get(key)||0)+face.area);floorTris.push([a,b,c,key])}
  if(top<band[0]||bottom>band[1])continue;if(walls&&Math.abs(face.up)>.6)continue;
  const x0=Math.min(P[a],P[b],P[c]),x1=Math.max(P[a],P[b],P[c]),z0=Math.min(P[a+2],P[b+2],P[c+2]),z1=Math.max(P[a+2],P[b+2],P[c+2]);
  for(let ix=gx(x0);ix<=gx(x1);ix++)for(let iz=gz(z0);iz<=gz(z1);iz++)grid[iz*gridM+ix]=1}
 const solid=(ix,iz)=>ix>=0&&iz>=0&&ix<gridM&&iz<gridN&&grid[iz*gridM+ix];
 const clean=grid.slice();if(despeckle)for(let iz=0;iz<gridN;iz++)for(let ix=0;ix<gridM;ix++)if(solid(ix,iz)){let n=0;for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])if(solid(ix+dx,iz+dz))n++;if(n<1)clean[iz*gridM+ix]=0}
 const taken=new Uint8Array(grid.length),boxes=[];
 for(let iz=0;iz<gridN;iz++)for(let ix=0;ix<gridM;ix++){if(!clean[iz*gridM+ix]||taken[iz*gridM+ix])continue;
  let w=1;while(ix+w<gridM&&clean[iz*gridM+ix+w]&&!taken[iz*gridM+ix+w])w++;
  let h=1;grow:while(iz+h<gridN){for(let d=0;d<w;d++)if(!clean[(iz+h)*gridM+ix+d]||taken[(iz+h)*gridM+ix+d])break grow;h++}
  for(let dz=0;dz<h;dz++)for(let dx=0;dx<w;dx++)taken[(iz+dz)*gridM+ix+dx]=1;
  boxes.push({x:+(((ix+w/2)*cell)-spec.width/2).toFixed(2),z:+(((iz+h/2)*cell)-(hi[2]-lo[2])*k/2).toFixed(2),hx:+(w*cell/2).toFixed(2),hz:+(h*cell/2).toFixed(2)})}
 // the floor: the most common top height among large level faces, and the rectangle those faces cover (null if there is no real deck)
 let floor=null;{const best=[...floorBins.entries()].sort((p,q)=>q[1]-p[1])[0];
  if(best&&best[1]>spec.width*spec.width*.04){const y=best[0]*.03;let fx0=1e9,fx1=-1e9,fz0=1e9,fz1=-1e9;for(const [a,b,c,key] of floorTris)if(Math.abs(key-best[0])<=1)for(const v of [a,b,c]){fx0=Math.min(fx0,P[v]);fx1=Math.max(fx1,P[v]);fz0=Math.min(fz0,P[v+2]);fz1=Math.max(fz1,P[v+2])}
   if(y>.05&&y<1.5)floor={y:+y.toFixed(2),x0:+fx0.toFixed(2),x1:+fx1.toFixed(2),z0:+fz0.toFixed(2),z1:+fz1.toFixed(2)}}}
 // 5. the colour texture, shrunk
 const tex=json.textures[json.materials[0].pbrMetallicRoughness.baseColorTexture.index],image=json.images[tex.source],[size,quality]=spec.texture;
 let raw;if(image.uri)raw=readFileSync(join(spec.dir==='kenney'?kenney:folder,image.uri));else{const view=json.bufferViews[image.bufferView];raw=Buffer.from(glb.bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength))}
 const png=quality==='png',jpeg=png?await sharp(raw).resize(size,size,{fit:'fill',kernel:'nearest'}).png({palette:true}).toBuffer():await sharp(raw).resize(size,size,{fit:'fill'}).jpeg({quality,mozjpeg:true}).toBuffer();
 const posA=Float32Array.from(P),norA=Float32Array.from(N),uvA=Float32Array.from(U),idxA=Uint16Array.from(I);if(count>65535)throw new Error(id+' has too many vertices for 16-bit indices');
 let wx0=1e9,wx1=-1e9,wz0=1e9,wz1=-1e9;for(let i=0;i<P.length;i+=3){wx0=Math.min(wx0,P[i]);wx1=Math.max(wx1,P[i]);wz0=Math.min(wz0,P[i+2]);wz1=Math.max(wz1,P[i+2])}
 out.props[id]={source:spec.file,width:+(wx1-wx0).toFixed(2),depth:+(wz1-wz0).toFixed(2),height:+sy.toFixed(2),triangles:I.length/3,footprint:{x0:+wx0.toFixed(2),x1:+wx1.toFixed(2),z0:+wz0.toFixed(2),z1:+wz1.toFixed(2)},colliders:boxes,floor,
  texture:'data:image/'+(png?'png':'jpeg')+';base64,'+jpeg.toString('base64'),pos:b64(posA),nor:b64(norA),uv:b64(uvA),idx:b64(idxA),vertices:count};
 report.push(`${id.padEnd(9)} ${before} -> ${I.length/3} triangles, ${(wx1-wx0).toFixed(1)} x ${(wz1-wz0).toFixed(1)} m, ${sy.toFixed(1)} m tall, ${boxes.length} collision boxes, floor ${floor?floor.y+' m high':'none'}, texture ${(jpeg.length/1024).toFixed(0)} KB, ${count} vertices`);
}
const text=`// GENERATED by scripts/build-props.mjs from single-mesh GLB models (see ASSETS.md for sources and licences).\nexport const PROPS=${JSON.stringify(out.props)};\n`;
writeFileSync('dist/props-assets.js',text);console.log(report.join('\n'));console.log('wrote dist/props-assets.js',(text.length/1024).toFixed(0),'KB');
