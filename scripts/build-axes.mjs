// Converts the three axe models in assets-src/Tools into dist/axe-assets.js (0.35, DESIGN 4.15 F): one small vertex-coloured mesh each (no textures at run time).
//   node scripts/build-axes.mjs            (needs `sharp`, already in node_modules, only to read the Logging Axe's colour texture)
// Each model is turned so its handle runs along +z with the head at the far end and the cutting edge toward -y (the held item's frame, like the primitive axe it replaces: the butt of
// the handle is at z = -0.07 so the fist closes about 7 cm from the end), then scaled to its length. The orientation is read from the vertices (the handle is the long axis, the head is
// the heavier end, the edge is the side the blade sticks out furthest), so a model needs no hand-set rotation. The report lists what it found; look at the result in the game.
import {readFileSync,writeFileSync} from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');
const MODELS={
 'axe':{file:'assets-src/Tools/Simple_axe by Poly by Google.glb',length:.72},
 'logging-axe':{file:'assets-src/Tools/Logging_Axe by CreativeTrio.glb',length:.82},
 'steel-axe':{file:'assets-src/Tools/Steel_Axe by Quaternius.glb',length:.9}
};
const BUTT=-.07;
const mul=(a,b)=>{const o=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)o[j*4+i]+=a[k*4+i]*b[j*4+k];return o};
const trs=n=>{if(n.matrix)return n.matrix;const [x,y,z,w]=n.rotation||[0,0,0,1],[sx,sy,sz]=n.scale||[1,1,1],[tx,ty,tz]=n.translation||[0,0,0];
 return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,tx,ty,tz,1]};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l)},sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const srgb=c=>c<=.0031308?c*12.92:1.055*Math.pow(c,1/2.4)-.055;

async function read(path){
 const b=readFileSync(path),jl=b.readUInt32LE(12),json=JSON.parse(b.toString('utf8',20,20+jl)),bin=b.subarray(20+jl+8,20+jl+8+b.readUInt32LE(20+jl));
 const comp={5120:[Int8Array,1],5121:[Uint8Array,1],5122:[Int16Array,2],5123:[Uint16Array,2],5125:[Uint32Array,4],5126:[Float32Array,4]},ncomp={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
 const get=i=>{const a=json.accessors[i],v=json.bufferViews[a.bufferView],[T,sz]=comp[a.componentType],n=ncomp[a.type],stride=v.byteStride||sz*n,out=new Float64Array(a.count*n),dv=new DataView(bin.buffer,bin.byteOffset+(v.byteOffset||0)+(a.byteOffset||0));
  for(let k=0;k<a.count;k++)for(let c=0;c<n;c++){const at=k*stride+c*sz;out[k*n+c]=T===Float32Array?dv.getFloat32(at,true):T===Uint16Array?dv.getUint16(at,true):T===Uint32Array?dv.getUint32(at,true):T===Uint8Array?dv.getUint8(at):T===Int16Array?dv.getInt16(at,true):dv.getInt8(at)}return out};
 const images=[];for(const im of json.images||[]){const v=json.bufferViews[im.bufferView],raw=await sharp(Buffer.from(bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength))).ensureAlpha().raw().toBuffer({resolveWithObject:true});images.push(raw)}
 const verts=[];const walk=(i,parent)=>{const n=json.nodes[i],m=mul(parent,trs(n));if(n.mesh!==undefined)for(const prim of json.meshes[n.mesh].primitives){
   const pos=get(prim.attributes.POSITION),nor=prim.attributes.NORMAL!==undefined?get(prim.attributes.NORMAL):null,uv=prim.attributes.TEXCOORD_0!==undefined?get(prim.attributes.TEXCOORD_0):null,idx=prim.indices!==undefined?Array.from(get(prim.indices)):Array.from({length:pos.length/3},(_,k)=>k);
   const mat=json.materials[prim.material]||{},pbr=mat.pbrMetallicRoughness||{},base=pbr.baseColorFactor||[1,1,1,1],tex=pbr.baseColorTexture!==undefined?images[json.textures[pbr.baseColorTexture.index].source]:null;
   const start=verts.length;
   for(let k=0;k<pos.length/3;k++){const x=pos[k*3],y=pos[k*3+1],z=pos[k*3+2],p=[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];
    const nn=nor?norm([m[0]*nor[k*3]+m[4]*nor[k*3+1]+m[8]*nor[k*3+2],m[1]*nor[k*3]+m[5]*nor[k*3+1]+m[9]*nor[k*3+2],m[2]*nor[k*3]+m[6]*nor[k*3+1]+m[10]*nor[k*3+2]]):[0,1,0];
    let rgb=[base[0],base[1],base[2]];if(tex&&uv){const u=((uv[k*2]%1)+1)%1,v=((uv[k*2+1]%1)+1)%1,px=Math.min(tex.info.width-1,Math.floor(u*tex.info.width)),py=Math.min(tex.info.height-1,Math.floor(v*tex.info.height)),o=(py*tex.info.width+px)*tex.info.channels;
     const lin=c=>{const s=c/255;return s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4)};rgb=[lin(tex.data[o])*base[0],lin(tex.data[o+1])*base[1],lin(tex.data[o+2])*base[2]]}
    verts.push({p,n:nn,rgb})}
   verts.tris=(verts.tris||[]);for(const i2 of idx)verts.tris.push(start+i2)}
  for(const c of n.children||[])walk(c,m)};
 const scene=json.scenes[json.scene||0];for(const r of scene.nodes)walk(r,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);return verts;
}
function power(vs,c){ // the long axis: power iteration on the covariance
 let d=norm([1,.7,.3]);for(let it=0;it<60;it++){const o=[0,0,0];for(const v of vs){const q=sub(v.p,c),s=dot(q,d);o[0]+=q[0]*s;o[1]+=q[1]*s;o[2]+=q[2]*s}d=norm(o)}return d}
const b64=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64');
const out={},report=[];
for(const [id,spec] of Object.entries(MODELS)){
 const verts=await read(spec.file),tris=verts.tris,n=verts.length;
 const c=[0,0,0];for(const v of verts)for(let i=0;i<3;i++)c[i]+=v.p[i]/n;
 let d=power(verts,c);let proj=verts.map(v=>dot(sub(v.p,c),d)),lo=Math.min(...proj),hi=Math.max(...proj),span=hi-lo;
 const perp=(v,s)=>{const q=sub(v.p,c);return [q[0]-d[0]*s,q[1]-d[1]*s,q[2]-d[2]*s]};
 const spread=(a,b)=>{let sum=0,k=0;verts.forEach((v,i)=>{if(proj[i]>=a&&proj[i]<=b){sum+=Math.hypot(...perp(v,proj[i]));k++}});return k?sum/k:0};
 // the head is the end whose outer fifth stands furthest from the axis; turn d so it points at the head
 const sHi=spread(hi-span*.2,hi),sLo=spread(lo,lo+span*.2);if(sLo>sHi){d=d.map(x=>-x);proj=proj.map(x=>-x);const t=lo;lo=-hi;hi=-t}
 // the handle's own line: the mean of the vertices through the middle of the length
 const hc=[0,0,0];let hk=0;verts.forEach((v,i)=>{if(proj[i]>lo+span*.3&&proj[i]<lo+span*.55){for(let k=0;k<3;k++)hc[k]+=v.p[k];hk++}});for(let k=0;k<3;k++)hc[k]/=hk||1;
 // the head's offsets from that line (across the handle): the blade's width direction is the biggest spread, the edge side is the side it reaches furthest
 const off=[];verts.forEach((v,i)=>{if(proj[i]>hi-span*.3){const q=sub(v.p,hc),s=dot(q,d);off.push([q[0]-d[0]*s,q[1]-d[1]*s,q[2]-d[2]*s])}});
 let u=norm(cross(d,[0,1,0]).some(x=>Math.abs(x)>.1)?cross(d,[0,1,0]):cross(d,[1,0,0]));for(let it=0;it<60;it++){const o=[0,0,0];for(const q of off){const s=dot(q,u);o[0]+=q[0]*s;o[1]+=q[1]*s;o[2]+=q[2]*s}const un=norm(o);u=un}
 const along=off.map(q=>dot(q,u)),maxU=Math.max(...along),minU=Math.min(...along);const edge=Math.abs(maxU)>=Math.abs(minU)?u:u.map(x=>-x);
 // the frame: z along the handle toward the head, y away from the edge (so the edge points down), x completes it
 const ez=d,ey=norm(sub(edge.map(x=>-x),ez.map(x=>x*dot(edge.map(y=>-y),ez)))),ex=cross(ey,ez);
 const scale=spec.length/span,place=p=>{const q=sub(p,hc);return [dot(q,ex)*scale,dot(q,ey)*scale,BUTT+(dot(sub(p,c),d)-lo)*scale]};
 const P=new Float32Array(n*3),N=new Float32Array(n*3),C=new Uint8Array(n*3);
 verts.forEach((v,i)=>{const p=place(v.p);P.set(p,i*3);const q=[dot(v.n,ex),dot(v.n,ey),dot(v.n,ez)];N.set(norm(q),i*3);for(let k=0;k<3;k++)C[i*3+k]=Math.round(Math.max(0,Math.min(1,srgb(v.rgb[k])))*255)});
 // a left-handed turn would flip the faces: ex x ey must equal ez
 const hand=dot(cross(ex,ey),ez);const idx=new Uint16Array(tris);if(hand<0)for(let i=0;i<idx.length;i+=3){const t=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=t}
 const lowest=[Math.min(...P.filter((_,i)=>i%3===0)),Math.max(...P.filter((_,i)=>i%3===0)),Math.min(...P.filter((_,i)=>i%3===1)),Math.max(...P.filter((_,i)=>i%3===1)),Math.min(...P.filter((_,i)=>i%3===2)),Math.max(...P.filter((_,i)=>i%3===2))].map(x=>+x.toFixed(3));
 out[id]={source:spec.file.split('/').pop(),length:spec.length,triangles:idx.length/3,bounds:lowest,positions:b64(P),normals:b64(N),colors:b64(C),indices:b64(idx)};
 report.push(`${id}: ${idx.length/3} triangles, handle ${span.toFixed(3)} model units -> ${spec.length} m, head spread ${Math.max(sHi,sLo).toFixed(3)} vs ${Math.min(sHi,sLo).toFixed(3)}, bounds x ${lowest[0]}..${lowest[1]}, y ${lowest[2]}..${lowest[3]}, z ${lowest[4]}..${lowest[5]}, hand ${hand>0?'right':'left (faces flipped)'}`);
}
writeFileSync('dist/axe-assets.js',`// GENERATED by scripts/build-axes.mjs from assets-src/Tools (see ASSETS.md). Per axe: the handle along +z (butt at z = -0.07), the head at the far end, the cutting edge toward -y; base64 Float32 positions and normals, Uint8 sRGB vertex colours, Uint16 indices.\nexport const AXES=${JSON.stringify(out)};\n`);
console.log(report.join('\n'));
