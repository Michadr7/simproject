// Converts the Quaternius Stylized Nature MegaKit (CC0) glTF models into one embedded module, dist/nature-assets.js, with no server or
// extra files needed at run time. Usage:
//   TOOL_DIR=/path/with/node_modules node scripts/build-assets.mjs "<pack folder holding the .gltf, .bin and .png files>"
// TOOL_DIR needs `meshoptimizer` and `sharp` (npm i --no-save meshoptimizer sharp).
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const toolRequire=createRequire(join(resolve(process.env.TOOL_DIR||'.'),'noop.js'));
const {MeshoptSimplifier}=toolRequire('meshoptimizer'),sharp=toolRequire('sharp');
await MeshoptSimplifier.ready;
const pack=resolve(process.argv[2]||'.');

// id: [source file, height in metres after scaling (ground is y=0; roots sit below it), triangle budget, share of the budget given to leaf cards]
const MODELS={
 'pine.1':['Pine_1',7.0,1400,.4],'pine.2':['Pine_3',7.6,1400,.35],'pine.3':['Pine_5',6.6,1300,.7],
 'broadleaf.1':['CommonTree_1',6.4,1500,.5],'broadleaf.2':['CommonTree_3',7.4,1400,.55]
};
const TEXTURES={bark:['Bark_NormalTree.png',256,false],pineLeaves:['Leaf_Pine_C.png',256,true],broadleafLeaves:['Leaves_NormalTree_C.png',256,true]};
const hash=n=>{let x=Math.imul(n+1,0x9E3779B1);x^=x>>>15;x=Math.imul(x,0x85EBCA77);x^=x>>>13;return (x>>>0)/4294967296};
function accessor(g,bin,i){const a=g.accessors[i],v=g.bufferViews[a.bufferView],off=(v.byteOffset||0)+(a.byteOffset||0),n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
 const T={5126:[Float32Array,4],5123:[Uint16Array,2],5125:[Uint32Array,4]}[a.componentType],stride=v.byteStride||n*T[1];const out=new T[0](a.count*n);const dv=new DataView(bin.buffer,bin.byteOffset);
 for(let k=0;k<a.count;k++)for(let c=0;c<n;c++)out[k*n+c]=a.componentType===5126?dv.getFloat32(off+k*stride+c*4,true):a.componentType===5123?dv.getUint16(off+k*stride+c*2,true):dv.getUint32(off+k*stride+c*4,true);
 return out}
const components=(idx)=>{const parent=new Map(),find=x=>{while(parent.get(x)!==x&&parent.has(x)){parent.set(x,parent.get(parent.get(x)));x=parent.get(x)}return x};
 for(let i=0;i<idx.length;i+=3){for(let k=0;k<3;k++)if(!parent.has(idx[i+k]))parent.set(idx[i+k],idx[i+k]);const a=find(idx[i]);for(let k=1;k<3;k++){const b=find(idx[i+k]);if(a!==b)parent.set(b,a)}}
 const groups=new Map();for(let i=0;i<idx.length;i+=3){const r=find(idx[i]);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(i)}return [...groups.values()]};
const compact=(pos,nor,uv,idx)=>{const map=new Map(),P=[],N=[],U=[],I=new Uint16Array(idx.length);let n=0;
 for(let i=0;i<idx.length;i++){const o=idx[i];if(!map.has(o)){map.set(o,n++);P.push(pos[o*3],pos[o*3+1],pos[o*3+2]);N.push(nor[o*3],nor[o*3+1],nor[o*3+2]);U.push(uv[o*2],uv[o*2+1])}I[i]=map.get(o)}
 return {pos:new Float32Array(P),nor:new Float32Array(N),uv:new Float32Array(U),idx:I}};
const b64=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64');

const out={textures:{},models:{}};
for(const [name,[file,size,compress]] of Object.entries(TEXTURES)){
 const img=sharp(join(pack,file)).resize(size,size,{fit:'fill'});out.textures[name]='data:image/png;base64,'+(await (compress?img.png({palette:true,quality:80}):img.png({palette:true,quality:70})).toBuffer()).toString('base64')}
const report=[];
for(const [id,[file,height,budget,leafShare]] of Object.entries(MODELS)){
 const g=JSON.parse(readFileSync(join(pack,file+'.gltf'),'utf8')),bin=readFileSync(join(pack,g.buffers[0].uri));
 const node=g.nodes.find(n=>n.mesh!==undefined)||{};if(node.scale||node.rotation||node.translation)throw new Error(file+' has a node transform; handle it before converting');
 const raw=g.meshes[0].primitives.map(p=>({material:g.materials[p.material].name,pos:accessor(g,bin,p.attributes.POSITION),nor:accessor(g,bin,p.attributes.NORMAL),uv:accessor(g,bin,p.attributes.TEXCOORD_0),idx:accessor(g,bin,p.indices)}));
 const barkRaw=raw.find(p=>p.material.startsWith('Bark')),leafRaw=raw.find(p=>!p.material.startsWith('Bark'));
 let top=-1e9;for(const p of raw)for(let i=1;i<p.pos.length;i+=3)top=Math.max(top,p.pos[i]);const k=height/top;
 // Leaves: keep a share of the cards (as many as the budget allows) and enlarge those that stay, so the canopy keeps its volume.
 const cards=components(leafRaw.idx),leafBudget=Math.round(budget*leafShare),leafTris=leafRaw.idx.length/3,keep=Math.min(1,leafBudget/leafTris);
 const kept=cards.filter((c,i)=>hash(i*7+id.length*131)<keep);
 const leafIdx=[];const lp=Float32Array.from(leafRaw.pos);
 const scale=Math.sqrt(1/Math.max(.25,keep));
 for(const c of kept){const verts=new Set();for(const i of c)for(let t=0;t<3;t++){leafIdx.push(leafRaw.idx[i+t]);verts.add(leafRaw.idx[i+t])}
  let cx=0,cy=0,cz=0;for(const v of verts){cx+=lp[v*3];cy+=lp[v*3+1];cz+=lp[v*3+2]}cx/=verts.size;cy/=verts.size;cz/=verts.size;
  for(const v of verts){lp[v*3]=cx+(lp[v*3]-cx)*scale;lp[v*3+1]=cy+(lp[v*3+1]-cy)*scale;lp[v*3+2]=cz+(lp[v*3+2]-cz)*scale}}
 // Bark: simplify the trunk and branches to what is left of the budget (never below 220 triangles).
 const barkTarget=Math.max(220,budget-leafIdx.length/3)*3,barkIn=Uint32Array.from(barkRaw.idx);
 let barkIdx=barkIn;for(const error of [.05,.12,.25,.5,1]){[barkIdx]=MeshoptSimplifier.simplify(barkIn,barkRaw.pos,3,barkTarget,error,['Prune']);if(barkIdx.length<=barkTarget*1.2)break} // widen the allowed error until the budget is met; Prune drops tiny loose pieces
 const parts=[['bark',compact(barkRaw.pos,barkRaw.nor,barkRaw.uv,barkIdx)],['leaves',compact(lp,leafRaw.nor,leafRaw.uv,Uint32Array.from(leafIdx))]];
 for(const [,m] of parts)for(let i=0;i<m.pos.length;i++)m.pos[i]*=k;
 // Enlarged leaf cards can poke above the original top: rescale so the finished tree is exactly `height` tall.
 {let finished=0;for(const [,m] of parts)for(let i=1;i<m.pos.length;i+=3)finished=Math.max(finished,m.pos[i]);for(const [,m] of parts)for(let i=0;i<m.pos.length;i++)m.pos[i]*=height/finished}
 // Trunk radius near the ground (for collisions), measured from the simplified bark.
 let sx=0,sz=0,n=0;const bark=parts[0][1];for(let i=0;i<bark.pos.length;i+=3)if(bark.pos[i+1]>.3&&bark.pos[i+1]<.9){sx+=bark.pos[i];sz+=bark.pos[i+2];n++}
 sx/=n;sz/=n;let radius=0;for(let i=0;i<bark.pos.length;i+=3)if(bark.pos[i+1]>.3&&bark.pos[i+1]<.9)radius=Math.max(radius,Math.hypot(bark.pos[i]-sx,bark.pos[i+2]-sz));
 let width=0;for(const [,m] of parts)for(let i=0;i<m.pos.length;i+=3)width=Math.max(width,Math.hypot(m.pos[i],m.pos[i+2]));
 out.models[id]={source:file,height,trunkRadius:+radius.toFixed(3),canopyRadius:+width.toFixed(2),triangles:parts.reduce((a,[,m])=>a+m.idx.length/3,0),
  parts:parts.map(([material,m])=>({material,count:m.idx.length,vertices:m.pos.length/3,pos:b64(m.pos),nor:b64(m.nor),uv:b64(m.uv),idx:b64(m.idx)}))};
 report.push(`${id.padEnd(12)} ${file.padEnd(13)} tris ${String(raw.reduce((a,p)=>a+p.idx.length/3,0)).padStart(5)} -> ${String(out.models[id].triangles).padStart(5)}  height ${height} m  trunk r ${radius.toFixed(2)} m  canopy r ${width.toFixed(1)} m`);
}
const text=`// GENERATED by scripts/build-assets.mjs from the Quaternius Stylized Nature MegaKit (CC0, https://quaternius.com/packs/stylizednaturemegakit.html).
// Models are normalised to metres with the ground at y=0 (roots sit just below it); leaves are alpha-cutout cards, bark is simplified.
export const NATURE=${JSON.stringify(out)};\n`;
writeFileSync('dist/nature-assets.js',text);
console.log(report.join('\n'));console.log('wrote dist/nature-assets.js',(text.length/1024).toFixed(0),'KB');
