// Converts a rigged, animated GLB (the Blender-built sawmill) for the game without losing anything that makes it work: node names, skins, animations, anchors and emissive materials stay as they are.
// The only change is to the static meshes: every mesh that nothing moves, binds to a skin or names as an anchor is baked into root space and merged with the others of its material, so 60-odd
// separate draws become about a dozen. Animated objects, skinned meshes, bones and anchors are kept as nodes with their own transforms, and the animations are copied sample for sample (not trimmed, not shifted).
// Returns the new GLB, the data the game wants without opening it (anchors, per-node bounds, clip lengths) and a report.
import {readFileSync} from 'node:fs';

const I4=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const mulM=(a,b)=>{const o=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)o[j*4+i]+=a[k*4+i]*b[j*4+k];return o};
const trsM=n=>{if(n.matrix)return n.matrix;const [x,y,z,w]=n.rotation||[0,0,0,1],[sx,sy,sz]=n.scale||[1,1,1],[tx,ty,tz]=n.translation||[0,0,0];
 return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,tx,ty,tz,1]};
const det3=m=>m[0]*(m[5]*m[10]-m[6]*m[9])-m[4]*(m[1]*m[10]-m[2]*m[9])+m[8]*(m[1]*m[6]-m[2]*m[5]);
const round=(v,d=3)=>+v.toFixed(d);
const COMP={5126:Float32Array,5123:Uint16Array,5125:Uint32Array,5121:Uint8Array,5120:Int8Array,5122:Int16Array},WIDTH={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const GETTER={5126:'getFloat32',5123:'getUint16',5125:'getUint32',5121:'getUint8',5120:'getInt8',5122:'getInt16'};

export function parseGlb(raw){
 let off=12,json,bin;
 while(off<raw.length){const len=raw.readUInt32LE(off),type=raw.readUInt32LE(off+4),body=raw.subarray(off+8,off+8+len);if(type===0x4E4F534A)json=JSON.parse(body.toString('utf8'));else if(type===0x004E4942)bin=body;off+=8+len}
 if(!json||!bin)throw new Error('not a GLB with a JSON and a BIN chunk');return {json,bin};
}

export function convertRigged(path){
 const raw=readFileSync(path),{json,bin}=parseGlb(raw),dv=new DataView(bin.buffer,bin.byteOffset,bin.byteLength);
 const read=i=>{const a=json.accessors[i];if(a.sparse)throw new Error('sparse accessors are not supported');const v=json.bufferViews[a.bufferView],n=WIDTH[a.type],T=COMP[a.componentType],size=T.BYTES_PER_ELEMENT,stride=v.byteStride||n*size,off=(v.byteOffset||0)+(a.byteOffset||0),out=new T(a.count*n);
  for(let k=0;k<a.count;k++)for(let c=0;c<n;c++)out[k*n+c]=dv[GETTER[a.componentType]](off+k*stride+c*size,true);return {data:out,n,count:a.count,type:a.type}};
 const nodes=json.nodes,N=nodes.length,parent=new Array(N).fill(-1);nodes.forEach((n,i)=>{for(const c of n.children||[])parent[c]=i});
 const roots=json.scenes[json.scene||0].nodes;if(roots.length!==1)throw new Error('expected one root node, found '+roots.length);
 const rootIndex=roots[0],root=nodes[rootIndex];if(root.matrix||root.translation||root.rotation||root.scale||root.mesh!==undefined)throw new Error(`root ${root.name} must be a plain empty at the origin`);
 // transform of every node relative to the root (the root itself is the identity)
 const world=new Array(N);const walk=(i,pm)=>{world[i]=mulM(pm,trsM(nodes[i]));for(const c of nodes[i].children||[])walk(c,world[i])};for(const c of root.children||[])walk(c,I4);world[rootIndex]=I4;
 // 1. which nodes must survive as nodes
 const keep=new Set([rootIndex]),why=new Map();
 const mark=(i,reason)=>{if(!why.has(i))why.set(i,reason);for(let p=i;p>=0&&!keep.has(p);p=parent[p])keep.add(p);keep.add(i)};
 for(const a of json.animations||[])for(const c of a.channels){if(c.target.path==='weights')throw new Error('morph target animation is not supported');mark(c.target.node,'animated')}
 for(const s of json.skins||[])for(const j of s.joints)mark(j,'bone');
 nodes.forEach((n,i)=>{if(n.skin!==undefined)mark(i,'skinned');if(/^anchor_/.test(n.name||''))mark(i,'anchor')});
 // 2. static meshes: every mesh node that is not kept. Bake into root space, group by material.
 const statics=nodes.map((n,i)=>i).filter(i=>nodes[i].mesh!==undefined&&!keep.has(i));
 for(const i of statics)if((nodes[i].children||[]).some(c=>keep.has(c)))throw new Error(`static mesh ${nodes[i].name} has animated or anchor children`);
 const groups=new Map(); // material index -> {pos:[], nor:[], idx:[], count}
 let trianglesBefore=0,trianglesStatic=0,primitivesBefore=0;
 const bounds={};
 const boxOf=(i,prim)=>{const a=json.accessors[prim.attributes.POSITION],m=world[i],lo=a.min,hi=a.max,b=[1e9,1e9,1e9,-1e9,-1e9,-1e9];
  for(let c=0;c<8;c++){const x=c&1?hi[0]:lo[0],y=c&2?hi[1]:lo[1],z=c&4?hi[2]:lo[2];for(let d=0;d<3;d++){const v=m[d]*x+m[4+d]*y+m[8+d]*z+m[12+d];b[d]=Math.min(b[d],v);b[d+3]=Math.max(b[d+3],v)}}return b};
 const addBox=(name,b)=>{const o=bounds[name];bounds[name]=o?o.map((v,k)=>k<3?Math.min(v,round(b[k])):Math.max(v,round(b[k]))):b.map(v=>round(v))};
 for(const i of nodes.keys()){const n=nodes[i];if(n.mesh===undefined)continue;for(const p of json.meshes[n.mesh].primitives){primitivesBefore++;trianglesBefore+=(p.indices!==undefined?json.accessors[p.indices].count:json.accessors[p.attributes.POSITION].count)/3}}
 for(const i of statics){
  const n=nodes[i],m=world[i],flip=det3(m)<0;
  for(const p of json.meshes[n.mesh].primitives){
   if(p.mode!==undefined&&p.mode!==4)throw new Error(`${n.name}: only triangle lists are supported`);
   const P=read(p.attributes.POSITION).data,Nr=p.attributes.NORMAL!==undefined?read(p.attributes.NORMAL).data:null,idx=p.indices!==undefined?read(p.indices).data:Uint32Array.from({length:P.length/3},(_,k)=>k);
   let g=groups.get(p.material);if(!g){g={pos:[],nor:[],idx:[],count:0};groups.set(p.material,g)}
   for(let k=0;k<P.length;k+=3){const x=P[k],y=P[k+1],z=P[k+2];g.pos.push(m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]);
    if(Nr){const a=Nr[k],b=Nr[k+1],c=Nr[k+2];let nx=m[0]*a+m[4]*b+m[8]*c,ny=m[1]*a+m[5]*b+m[9]*c,nz=m[2]*a+m[6]*b+m[10]*c;const l=Math.hypot(nx,ny,nz)||1;g.nor.push(nx/l,ny/l,nz/l)}else g.nor.push(0,1,0)}
   for(let t=0;t<idx.length;t+=3){if(flip)g.idx.push(idx[t]+g.count,idx[t+2]+g.count,idx[t+1]+g.count);else g.idx.push(idx[t]+g.count,idx[t+1]+g.count,idx[t+2]+g.count)}
   g.count+=P.length/3;trianglesStatic+=idx.length/3;addBox(n.name,boxOf(i,p));
  }
 }
 // 3. the new file
 const chunks=[],views=[],accessors=[];let byteLength=0;
 const addData=(typed,target)=>{const bytes=Buffer.from(typed.buffer,typed.byteOffset,typed.byteLength),pad=(4-bytes.length%4)%4;views.push({buffer:0,byteOffset:byteLength,byteLength:bytes.length,...(target?{target}:{})});chunks.push(bytes,Buffer.alloc(pad));byteLength+=bytes.length+pad;return views.length-1};
 const addAccessor=(typed,componentType,type,{target,minmax=false,normalized=false}={})=>{const n=WIDTH[type],count=typed.length/n,a={bufferView:addData(typed,target),componentType,count,type};if(normalized)a.normalized=true;
  if(minmax){a.min=new Array(n).fill(1e30);a.max=new Array(n).fill(-1e30);for(let k=0;k<count;k++)for(let c=0;c<n;c++){a.min[c]=Math.min(a.min[c],typed[k*n+c]);a.max[c]=Math.max(a.max[c],typed[k*n+c])}}
  accessors.push(a);return accessors.length-1};
 const remap=new Map(),order=[];const collect=i=>{if(!keep.has(i))return;remap.set(i,order.length);order.push(i);for(const c of nodes[i].children||[])collect(c)};collect(rootIndex);
 const meshes=[],meshMap=new Map();
 const copyMesh=oldIdx=>{if(meshMap.has(oldIdx))return meshMap.get(oldIdx);const om=json.meshes[oldIdx],prims=[];
  for(const p of om.primitives){if(p.mode!==undefined&&p.mode!==4)throw new Error(om.name+': only triangle lists are supported');
   const attributes={},pos=read(p.attributes.POSITION);attributes.POSITION=addAccessor(Float32Array.from(pos.data),5126,'VEC3',{target:34962,minmax:true});
   if(p.attributes.NORMAL!==undefined)attributes.NORMAL=addAccessor(Float32Array.from(read(p.attributes.NORMAL).data),5126,'VEC3',{target:34962});
   if(p.attributes.JOINTS_0!==undefined)attributes.JOINTS_0=addAccessor(Uint16Array.from(read(p.attributes.JOINTS_0).data),5123,'VEC4',{target:34962});
   if(p.attributes.WEIGHTS_0!==undefined)attributes.WEIGHTS_0=addAccessor(Float32Array.from(read(p.attributes.WEIGHTS_0).data),5126,'VEC4',{target:34962});
   for(const k of Object.keys(p.attributes))if(!(k in attributes))throw new Error(`${om.name}: attribute ${k} is not supported (texture coordinates, colours, tangents are dropped by this converter)`);
   const out={attributes,mode:4};if(p.indices!==undefined)out.indices=addAccessor(Uint32Array.from(read(p.indices).data),5125,'SCALAR',{target:34963});if(p.material!==undefined)out.material=p.material;prims.push(out)}
  meshes.push({name:om.name,primitives:prims});meshMap.set(oldIdx,meshes.length-1);return meshes.length-1};
 const newNodes=order.map(i=>{const n=nodes[i],o={name:n.name};for(const k of ['translation','rotation','scale','matrix'])if(n[k])o[k]=n[k];
  const kids=(n.children||[]).filter(c=>keep.has(c)).map(c=>remap.get(c));if(kids.length)o.children=kids;
  if(n.mesh!==undefined)o.mesh=copyMesh(n.mesh);if(n.skin!==undefined)o.skin=n.skin;return o});
 const rootKids=newNodes[0].children||(newNodes[0].children=[]);
 const mergedNames=[];
 for(const [material,g] of groups){const name='Static_'+(json.materials?.[material]?.name||'default'),count=g.count,big=count>65535;
  const attributes={POSITION:addAccessor(Float32Array.from(g.pos),5126,'VEC3',{target:34962,minmax:true}),NORMAL:addAccessor(Float32Array.from(g.nor),5126,'VEC3',{target:34962})};
  const prim={attributes,mode:4,indices:addAccessor(big?Uint32Array.from(g.idx):Uint16Array.from(g.idx),big?5125:5123,'SCALAR',{target:34963})};if(material!==undefined)prim.material=material;
  meshes.push({name,primitives:[prim]});newNodes.push({name,mesh:meshes.length-1});rootKids.push(newNodes.length-1);mergedNames.push(`${name} (${g.idx.length/3} tris)`)}
 const skins=(json.skins||[]).map(s=>{const o={name:s.name,joints:s.joints.map(j=>remap.get(j))};if(s.skeleton!==undefined)o.skeleton=remap.get(s.skeleton);if(s.inverseBindMatrices!==undefined)o.inverseBindMatrices=addAccessor(Float32Array.from(read(s.inverseBindMatrices).data),5126,'MAT4');return o});
 const animations=(json.animations||[]).map(a=>{const samplers=a.samplers.map(s=>{const inp=read(s.input),out=read(s.output);return {input:addAccessor(Float32Array.from(inp.data),5126,'SCALAR',{minmax:true}),output:addAccessor(Float32Array.from(out.data),5126,out.type),interpolation:s.interpolation||'LINEAR'}});
  return {name:a.name,samplers,channels:a.channels.map(c=>({sampler:c.sampler,target:{node:remap.get(c.target.node),path:c.target.path}}))}});
 const outJson={asset:{version:'2.0',generator:'scripts/rigged-glb.mjs (from '+(json.asset?.generator||'unknown')+')'},extensionsUsed:json.extensionsUsed||[],scene:0,scenes:[{nodes:[0]}],nodes:newNodes,meshes,materials:json.materials||[],skins,animations,accessors,bufferViews:views,buffers:[{byteLength}]};
 if(!outJson.extensionsUsed.length)delete outJson.extensionsUsed;
 const jsonBuf=Buffer.from(JSON.stringify(outJson),'utf8'),jsonPad=(4-jsonBuf.length%4)%4,binBuf=Buffer.concat(chunks),total=12+8+jsonBuf.length+jsonPad+8+binBuf.length;
 const head=Buffer.alloc(12+8);head.writeUInt32LE(0x46546C67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(total,8);head.writeUInt32LE(jsonBuf.length+jsonPad,12);head.writeUInt32LE(0x4E4F534A,16);
 const binHead=Buffer.alloc(8);binHead.writeUInt32LE(binBuf.length,0);binHead.writeUInt32LE(0x004E4942,4);
 const glb=Buffer.concat([head,jsonBuf,Buffer.alloc(jsonPad,0x20),binHead,binBuf]);
 // 4. data for the game
 const anchors={};nodes.forEach((n,i)=>{if(/^anchor_/.test(n.name||''))anchors[n.name]=[round(world[i][12],4),round(world[i][13],4),round(world[i][14],4)]});
 for(const i of order)if(nodes[i].mesh!==undefined&&nodes[i].skin===undefined)for(const p of json.meshes[nodes[i].mesh].primitives)addBox(nodes[i].name,boxOf(i,p)); // animated, unskinned objects at rest
 const clips={};for(const a of json.animations||[]){let end=0,start=1e9,keys=0;for(const s of a.samplers){const t=read(s.input).data;start=Math.min(start,t[0]);end=Math.max(end,t[t.length-1]);keys=Math.max(keys,t.length)}clips[a.name]={start:round(start,4),end:round(end,4),keys}}
 // triangles actually drawn: nodes that use a mesh (the four planks share one mesh)
 const drawn=newNodes.reduce((sum,n)=>n.mesh===undefined?sum:sum+meshes[n.mesh].primitives.reduce((s,p)=>s+accessors[p.indices].count/3,0),0);
 const drawCalls=newNodes.reduce((sum,n)=>n.mesh===undefined?sum:sum+meshes[n.mesh].primitives.length,0);
 const dropped=nodes.map((n,i)=>i).filter(i=>!keep.has(i)&&nodes[i].mesh===undefined).map(i=>nodes[i].name);
 const report={nodesBefore:N,nodesAfter:newNodes.length,meshesBefore:json.meshes.length,primitivesBefore,drawCallsAfter:drawCalls,trianglesBefore,trianglesDrawn:drawn,staticNodesMerged:statics.length,merged:mergedNames,keptNodes:order.length,dropped,
  skins:skins.length,animations:animations.length,materials:(json.materials||[]).length,bytesBefore:raw.length,bytesAfter:glb.length};
 return {glb,anchors,bounds,clips,report};
}
