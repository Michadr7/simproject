// Converts the two chainsaws in assets-src/Tools into dist/saw-assets.js (0.35): one vertex-coloured mesh each, like the axes (no textures at run time).
//   node scripts/build-saws.mjs        (needs `sharp`, already in node_modules, to read the colour textures)
// Held-item frame (as build-axes.mjs): the saw's own forward (the bar's tip) along +z, up along +y, the rear handle's grip at the origin; the numbers below say which way each model's
// own axes point, read from the files (see the report: the long extent must come out along z). The first saw's chain (8,000 triangles of links with a morph animation) is not used:
// a plain dark band is drawn along the bar instead.
import {readFileSync,writeFileSync} from 'node:fs';import {createRequire} from 'node:module';import {dirname,join} from 'node:path';
const require=createRequire(import.meta.url),sharp=require('sharp');
const MODELS={
 'chainsaw':{file:'assets-src/Tools/Chainsaw/Animated Chainsaw  Low-Poly Version_2.8x.glb',length:.62,forward:[0,0,-1],up:[0,1,0],skip:['Cube.002_0'],chain:true},
 'logging-chainsaw':{file:'assets-src/Tools/Logging_Chainsaw.gltf',length:.78,forward:[0,0,1],up:[0,1,0],skipMaterials:['Chainsaw01_Alpha']}
};
const mul=(a,b)=>{const o=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)o[j*4+i]+=a[k*4+i]*b[j*4+k];return o};
const trs=n=>{if(n.matrix)return n.matrix;const [x,y,z,w]=n.rotation||[0,0,0,1],[sx,sy,sz]=n.scale||[1,1,1],[tx,ty,tz]=n.translation||[0,0,0];
 return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,tx,ty,tz,1]};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l)},sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const srgb=c=>c<=.0031308?c*12.92:1.055*Math.pow(c,1/2.4)-.055;
async function read(path,spec){
 const raw=readFileSync(path),isGlb=raw.toString('ascii',0,4)==='glTF';let json,bin;
 if(isGlb){const jl=raw.readUInt32LE(12);json=JSON.parse(raw.toString('utf8',20,20+jl));bin=raw.subarray(20+jl+8,20+jl+8+raw.readUInt32LE(20+jl))}
 else{json=JSON.parse(raw.toString('utf8'));const u=json.buffers[0].uri;bin=u.startsWith('data:')?Buffer.from(u.split(',')[1],'base64'):readFileSync(join(dirname(path),decodeURIComponent(u)))}
 const comp={5120:[Int8Array,1],5121:[Uint8Array,1],5122:[Int16Array,2],5123:[Uint16Array,2],5125:[Uint32Array,4],5126:[Float32Array,4]},ncomp={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
 const get=i=>{const a=json.accessors[i],v=json.bufferViews[a.bufferView],[T,sz]=comp[a.componentType],n=ncomp[a.type],stride=v.byteStride||sz*n,out=new Float64Array(a.count*n),dv=new DataView(bin.buffer,bin.byteOffset+(v.byteOffset||0)+(a.byteOffset||0));
  for(let k=0;k<a.count;k++)for(let c=0;c<n;c++){const at=k*stride+c*sz;out[k*n+c]=T===Float32Array?dv.getFloat32(at,true):T===Uint16Array?dv.getUint16(at,true):T===Uint32Array?dv.getUint32(at,true):T===Uint8Array?dv.getUint8(at):T===Int16Array?dv.getInt16(at,true):dv.getInt8(at)}return out};
 const images=[];for(const im of json.images||[]){let buf;if(im.bufferView!==undefined){const v=json.bufferViews[im.bufferView];buf=Buffer.from(bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength))}else buf=im.uri.startsWith('data:')?Buffer.from(im.uri.split(',')[1],'base64'):readFileSync(join(dirname(path),decodeURIComponent(im.uri)));
  const s=sharp(buf).ensureAlpha();const meta=await s.metadata(),w=Math.min(meta.width,1024),h=Math.min(meta.height,1024);images.push(await sharp(buf).resize(w,h,{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true}))}
 const verts=[],tris=[];
 const walk=(i,parent)=>{const n=json.nodes[i],m=mul(parent,trs(n));if(n.mesh!==undefined&&!(spec.skip||[]).includes(json.meshes[n.mesh].name))for(const prim of json.meshes[n.mesh].primitives){
   const mat=json.materials?.[prim.material]||{};if((spec.skipMaterials||[]).includes(mat.name))continue;
   const pos=get(prim.attributes.POSITION),nor=prim.attributes.NORMAL!==undefined?get(prim.attributes.NORMAL):null,uv=prim.attributes.TEXCOORD_0!==undefined?get(prim.attributes.TEXCOORD_0):null,idx=prim.indices!==undefined?Array.from(get(prim.indices)):Array.from({length:pos.length/3},(_,k)=>k);
   const pbr=mat.pbrMetallicRoughness||{},base=pbr.baseColorFactor||[1,1,1,1],tex=pbr.baseColorTexture!==undefined?images[json.textures[pbr.baseColorTexture.index].source]:null,start=verts.length;
   for(let k=0;k<pos.length/3;k++){const x=pos[k*3],y=pos[k*3+1],z=pos[k*3+2],p=[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];
    const nn=nor?norm([m[0]*nor[k*3]+m[4]*nor[k*3+1]+m[8]*nor[k*3+2],m[1]*nor[k*3]+m[5]*nor[k*3+1]+m[9]*nor[k*3+2],m[2]*nor[k*3]+m[6]*nor[k*3+1]+m[10]*nor[k*3+2]]):[0,1,0];
    let rgb=[base[0],base[1],base[2]];if(tex&&uv){const u=((uv[k*2]%1)+1)%1,v=((uv[k*2+1]%1)+1)%1,px=Math.min(tex.info.width-1,Math.floor(u*tex.info.width)),py=Math.min(tex.info.height-1,Math.floor(v*tex.info.height)),o=(py*tex.info.width+px)*tex.info.channels;
     const lin=c=>{const s=c/255;return s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4)};rgb=[lin(tex.data[o])*base[0],lin(tex.data[o+1])*base[1],lin(tex.data[o+2])*base[2]]}
    verts.push({p,n:nn,rgb})}
   for(const i2 of idx)tris.push(start+i2)}
  for(const c of n.children||[])walk(c,m)};
 const scene=json.scenes[json.scene||0];for(const r of scene.nodes)walk(r,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);return {verts,tris};
}
const b64=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64');
const extent=(vs,axis)=>{let lo=1e9,hi=-1e9;for(const v of vs){const s=dot(v.p,axis);lo=Math.min(lo,s);hi=Math.max(hi,s)}return [lo,hi]};
const out={},report=[];
for(const [id,spec] of Object.entries(MODELS)){
 const {verts,tris}=await read(spec.file,spec),n=verts.length;
 const ext=[0,1,2].map(a=>{const e=extent(verts,[a===0?1:0,a===1?1:0,a===2?1:0]);return +(e[1]-e[0]).toFixed(3)});
 report.push(`${id}: ${n} vertices, ${tris.length/3} triangles, world extents x ${ext[0]} y ${ext[1]} z ${ext[2]}`);
 if(!spec.forward){console.log(report.join('\n'));continue}
 let ez=norm(spec.forward),ey=norm(spec.up);const ex=cross(ey,ez);
 const [lo,hi]=extent(verts,ez),span=hi-lo,scale=spec.length/span;
 // the rear handle's grip: a third of the length from the back, at the middle of the body's height
 const rear=verts.filter(v=>dot(v.p,ez)<lo+span*.3),cy=rear.reduce((s,v)=>s+dot(v.p,ey),0)/rear.length,cx=rear.reduce((s,v)=>s+dot(v.p,ex),0)/rear.length;
 const place=p=>[(dot(p,ex)-cx)*scale,(dot(p,ey)-cy)*scale,(dot(p,ez)-lo-span*.28)*scale];
 const P=new Float32Array(n*3),N=new Float32Array(n*3),C=new Uint8Array(n*3);
 verts.forEach((v,i)=>{P.set(place(v.p),i*3);N.set(norm([dot(v.n,ex),dot(v.n,ey),dot(v.n,ez)]),i*3);for(let k=0;k<3;k++)C[i*3+k]=Math.round(Math.max(0,Math.min(1,srgb(v.rgb[k])))*255)});
 const hand=dot(cross(ex,ey),ez),idx=new Uint16Array(tris);if(hand<0)for(let i=0;i<idx.length;i+=3){const t=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=t}
 const b=[0,1,2].flatMap(a=>{const v=Array.from({length:n},(_,i)=>P[i*3+a]);return [+Math.min(...v).toFixed(3),+Math.max(...v).toFixed(3)]});
 out[id]={source:spec.file.split('/').pop(),length:spec.length,triangles:idx.length/3,bounds:b,positions:b64(P),normals:b64(N),colors:b64(C),indices:b64(idx)};
 report.push(`  -> ${idx.length/3} triangles, bounds x ${b[0]}..${b[1]}, y ${b[2]}..${b[3]}, z ${b[4]}..${b[5]}`);
}
if(Object.keys(out).length){writeFileSync('dist/saw-assets.js',`// GENERATED by scripts/build-saws.mjs from assets-src/Tools (see ASSETS.md). Per chainsaw: the bar's tip along +z, up along +y, the rear grip near the origin; base64 Float32 positions and normals, Uint8 sRGB vertex colours, Uint16 indices.\nexport const SAWS=${JSON.stringify(out)};\n`)}
console.log(report.join('\n'));
