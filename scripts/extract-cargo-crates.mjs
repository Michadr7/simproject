// Extracts named nodes from the huge Cargo.glb (reads only the needed byte ranges) into small GLBs: scale baked into positions, ONE image per file resized to 256 px JPEG.
import fs from 'fs';import {createRequire} from 'module';
const [,,glb,outDir,toolDir,...pairs]=process.argv;const require=createRequire(toolDir+'/x.js');const sharp=require('sharp');
const fd=fs.openSync(glb,'r');const h=Buffer.alloc(20);fs.readSync(fd,h,0,20,0);const jl=h.readUInt32LE(12);const jb=Buffer.alloc(jl);fs.readSync(fd,jb,0,jl,20);const j=JSON.parse(jb.toString());
const binStart=20+jl+8; // chunk header of BIN
const rd=(bv,extra=0,len)=>{const v=j.bufferViews[bv];const b=Buffer.alloc(len??v.byteLength);fs.readSync(fd,b,0,b.length,binStart+(v.byteOffset||0)+extra);return b};
const acc=i=>{const a=j.accessors[i],v=j.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3}[a.type],T={5126:Float32Array,5123:Uint16Array,5125:Uint32Array}[a.componentType],sz=T.BYTES_PER_ELEMENT,stride=v.byteStride||n*sz;
 const buf=rd(a.bufferView),dv=new DataView(buf.buffer,buf.byteOffset),out=new T(a.count*n);for(let k=0;k<a.count;k++)for(let c=0;c<n;c++){const at=(a.byteOffset||0)+k*stride+c*sz;out[k*n+c]=T===Float32Array?dv.getFloat32(at,true):T===Uint16Array?dv.getUint16(at,true):dv.getUint32(at,true)}return out};
for(const pr of pairs){const [name,id]=pr.split('=');const ni=j.nodes.findIndex(n=>n.name===name);const n=j.nodes[ni],p=j.meshes[n.mesh].primitives[0],mat=j.materials[p.material];
 const s=n.scale||[1,1,1];const P=acc(p.attributes.POSITION).map((v,k)=>v*s[k%3]),N=acc(p.attributes.NORMAL),U=acc(p.attributes.TEXCOORD_0),I=Uint32Array.from(acc(p.indices));
 const tex=mat.pbrMetallicRoughness.baseColorTexture.index,img=j.images[j.textures[tex].source];const raw=rd(img.bufferView);
 const meta=await sharp(raw,{limitInputPixels:false}).metadata();
 const jpg=await sharp(raw,{limitInputPixels:false}).resize(256,256,{fit:'fill'}).removeAlpha().jpeg({quality:85}).toBuffer();
 const pad=b=>Buffer.concat([b,Buffer.alloc((4-b.length%4)%4)]);
 const parts=[Buffer.from(P.buffer),Buffer.from(N.buffer),Buffer.from(U.buffer),Buffer.from(I.buffer),jpg].map(pad);let off=0;const views=parts.map((b,i)=>{const v={buffer:0,byteOffset:off,byteLength:b.length};off+=b.length;return v});
 const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(let k=0;k<P.length;k++){mn[k%3]=Math.min(mn[k%3],P[k]);mx[k%3]=Math.max(mx[k%3],P[k])}
 const g={asset:{version:'2.0',generator:'extract-cargo-crates'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:id,mesh:0}],meshes:[{name:id,primitives:[{attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2},indices:3,material:0}]}],
  materials:[{name:id,pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:1}}],textures:[{source:0}],images:[{bufferView:4,mimeType:'image/jpeg'}],
  accessors:[{bufferView:0,componentType:5126,count:P.length/3,type:'VEC3',min:mn,max:mx},{bufferView:1,componentType:5126,count:N.length/3,type:'VEC3'},{bufferView:2,componentType:5126,count:U.length/2,type:'VEC2'},{bufferView:3,componentType:5125,count:I.length,type:'SCALAR'}],
  bufferViews:views,buffers:[{byteLength:off}]};
 let js=Buffer.from(JSON.stringify(g));js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,0x20)]);const bin=Buffer.concat(parts);
 const hd=Buffer.alloc(12);hd.writeUInt32LE(0x46546C67,0);hd.writeUInt32LE(2,4);hd.writeUInt32LE(12+8+js.length+8+bin.length,8);const c1=Buffer.alloc(8);c1.writeUInt32LE(js.length,0);c1.writeUInt32LE(0x4E4F534A,4);const c2=Buffer.alloc(8);c2.writeUInt32LE(bin.length,0);c2.writeUInt32LE(0x004E4942,4);
 fs.writeFileSync(`${outDir}/${id}.glb`,Buffer.concat([hd,c1,js,c2,bin]));
 console.log(id,'from',name,`tris ${I.length/3}`,'size m',mx.map((v,k)=>+(v-mn[k]).toFixed(3)).join(' x '),'min',mn.map(v=>+v.toFixed(3)),'source image',meta.width+'x'+meta.height,'->',jpg.length,'B jpeg; glb',hd.readUInt32LE(8),'B');}