// GD5: bakes the ground cover models into ONE small module, dist/cover-assets.js (loaded lazily by world.js, so startup does not grow).
//   node scripts/build-cover-assets.mjs        (run from the repo root; uses node_modules/sharp, the MegaKit glTF in assets-src/Landscape)
// Source: Quaternius Stylized Nature MegaKit [Standard] (CC0 1.0, assets-src/Landscape/Stylized Nature MegaKit[Standard]). ONE model per kind (COVER_TIER.high.variants = 1, the first name in COVER_RULES[kind].models).
// Each model is scaled once to its real-world size (so the instance scale ranges of ground-cover-rules.js are plain multipliers), its textures are cropped to the part its UVs use and packed into one 512 x 384 atlas
// (one texture, one program; the white tile at the end serves the code-made reeds and crop, which use vertex colours), and positions, normals, UVs and indices are written as base64 typed arrays.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
const sharp=createRequire(join(resolve('.'),'x.js'))('sharp');
const KIT=resolve('assets-src/Landscape/Stylized Nature MegaKit[Standard]');
export const TILE=128,PAD=2,ATLAS_COLS=4,ATLAS_ROWS=3;
// kind: [model file, how to size it (h = height in metres, w = widest horizontal extent in metres; hue = degrees the texture is turned: the bush's own leaf texture is autumn red)]
export const COVER_BUILD={grass:['Grass_Common_Short',{h:.6}],tallgrass:['Grass_Common_Tall',{h:1}],clover:['Clover_1',{h:.25}],fern:['Fern_1',{w:1.3}],flower:['Flower_3_Group',{h:.55}],bush:['Bush_Common',{w:1.6,hue:125}],pebble:['Pebble_Round_1',{w:.16}],rock:['Rock_Medium_1',{w:.9}],mushroom:['Mushroom_Common',{w:.18}]};
const b64=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64');
const view=(g,bin,ai,Type)=>{const a=g.accessors[ai],bv=g.bufferViews[a.bufferView],n=a.count*({SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type]);const off=bin.byteOffset+(bv.byteOffset||0)+(a.byteOffset||0);return new Type(bin.buffer.slice(off,off+n*Type.BYTES_PER_ELEMENT))};
const tiles=[]; // {key, source, crop:{u0,v0,u1,v1}}
const tileOf=(source,hue,u0,v0,u1,v1)=>{const key=source+'|'+hue+'|'+[u0,v0,u1,v1].map(v=>v.toFixed(3)).join(',');let i=tiles.findIndex(t=>t.key===key);if(i<0){i=tiles.length;tiles.push({key,source,hue,u0,v0,u1,v1})}return i};
const models={};
for(const [kind,[file,size]] of Object.entries(COVER_BUILD)){
 const g=JSON.parse(readFileSync(join(KIT,'glTF',file+'.gltf'),'utf8')),bin=readFileSync(join(KIT,'glTF',g.buffers[0].uri));
 const parts=g.meshes[0].primitives.map(p=>{const pos=view(g,bin,p.attributes.POSITION,Float32Array),nrm=view(g,bin,p.attributes.NORMAL,Float32Array),uv=view(g,bin,p.attributes.TEXCOORD_0,Float32Array),idx=view(g,bin,p.indices,Uint16Array);
  let u0=9,v0=9,u1=-9,v1=-9;for(let i=0;i<uv.length;i+=2){u0=Math.min(u0,uv[i]);u1=Math.max(u1,uv[i]);v0=Math.min(v0,uv[i+1]);v1=Math.max(v1,uv[i+1])}
  const image=g.images[g.textures[g.materials[p.material].pbrMetallicRoughness.baseColorTexture.index].source].uri.replace(/\.png$/,'');
  const du=Math.max(u1-u0,.004),dv=Math.max(v1-v0,.004); // a gradient strip (grass) is only a few texels wide
  const pu=Math.min(.01,du*.05),pv=Math.min(.01,dv*.05);
  return {pos,nrm,uv,idx,image,crop:[Math.max(0,u0-pu),Math.max(0,v0-pv),Math.min(1,u1+pu),Math.min(1,v1+pv)],uvRange:[u0,v0,u1,v1]}});
 let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9,minZ=1e9,maxZ=-1e9;for(const p of parts)for(let i=0;i<p.pos.length;i+=3){minX=Math.min(minX,p.pos[i]);maxX=Math.max(maxX,p.pos[i]);minY=Math.min(minY,p.pos[i+1]);maxY=Math.max(maxY,p.pos[i+1]);minZ=Math.min(minZ,p.pos[i+2]);maxZ=Math.max(maxZ,p.pos[i+2])}
 const scale=size.h?size.h/maxY:size.w/Math.max(maxX-minX,maxZ-minZ);
 const n=parts.reduce((a,p)=>a+p.pos.length/3,0),ni=parts.reduce((a,p)=>a+p.idx.length,0),pos=new Float32Array(n*3),nrm=new Float32Array(n*3),uv=new Float32Array(n*2),idx=new Uint16Array(ni);let vo=0,io=0;
 for(const p of parts){const t=tileOf(p.image,size.hue||0,...p.crop);
  for(let i=0;i<p.pos.length;i++){pos[vo*3+i]=p.pos[i]*scale;nrm[vo*3+i]=p.nrm[i]}
  for(let i=0;i<p.uv.length;i+=2){const [c0,d0,c1,d1]=p.crop;p.uv[i]=(p.uv[i]-c0)/(c1-c0);p.uv[i+1]=(p.uv[i+1]-d0)/(d1-d0)} // now 0..1 inside the crop; placed into the atlas once the tiles are packed
  p.tile=t;p.vo=vo;for(let i=0;i<p.idx.length;i++)idx[io+i]=p.idx[i]+vo;io+=p.idx.length;vo+=p.pos.length/3}
 models[kind]={file,scale,parts,pos,nrm,uv,idx,size:[(maxX-minX)*scale,maxY*scale,(maxZ-minZ)*scale],nativeHeight:maxY,nativeWidth:Math.max(maxX-minX,maxZ-minZ)};
}
// atlas: the tiles, then one white tile
const W=TILE*ATLAS_COLS,Hh=TILE*ATLAS_ROWS,whiteIndex=tiles.length;if(whiteIndex+1>ATLAS_COLS*ATLAS_ROWS)throw new Error('atlas too small for '+(whiteIndex+1)+' tiles');
const composites=[];
for(let i=0;i<tiles.length;i++){const t=tiles[i],img=sharp(join(KIT,'Textures',t.source+'.png')),meta=await img.metadata();
 const left=Math.floor(t.u0*meta.width),top=Math.floor(t.v0*meta.height),width=Math.max(1,Math.ceil((t.u1-t.u0)*meta.width)),height=Math.max(1,Math.ceil((t.v1-t.v0)*meta.height));
 const buf=await img.extract({left:Math.min(left,meta.width-1),top:Math.min(top,meta.height-1),width:Math.min(width,meta.width-left),height:Math.min(height,meta.height-top)}).resize(TILE-2*PAD,TILE-2*PAD,{fit:'fill'}).ensureAlpha().modulate({hue:t.hue}).extend({top:PAD,bottom:PAD,left:PAD,right:PAD,extendWith:'copy'}).png().toBuffer();
 composites.push({input:buf,left:(i%ATLAS_COLS)*TILE,top:Math.floor(i/ATLAS_COLS)*TILE})}
composites.push({input:await sharp({create:{width:TILE,height:TILE,channels:4,background:{r:255,g:255,b:255,alpha:1}}}).png().toBuffer(),left:(whiteIndex%ATLAS_COLS)*TILE,top:Math.floor(whiteIndex/ATLAS_COLS)*TILE});
const atlas=await sharp({create:{width:W,height:Hh,channels:4,background:{r:255,g:255,b:255,alpha:0}}}).composite(composites).png({palette:true,quality:80,effort:10,colours:128}).toBuffer();
// resolve the UVs into the atlas (image space, v down: the texture is used with flipY false, as glTF does)
const out={};
for(const [kind,m] of Object.entries(models)){
 for(const p of m.parts){const t=p.tile,ox=(t%ATLAS_COLS)*TILE+PAD,oy=Math.floor(t/ATLAS_COLS)*TILE+PAD,s=TILE-2*PAD;for(let i=0;i<p.uv.length;i+=2){m.uv[(p.vo)*2+i]=(ox+Math.min(1,Math.max(0,p.uv[i]))*s)/W;m.uv[(p.vo)*2+i+1]=(oy+Math.min(1,Math.max(0,p.uv[i+1]))*s)/Hh}}
 const r=v=>Math.round(v*1e4)/1e4;for(let i=0;i<m.pos.length;i++)m.pos[i]=r(m.pos[i]);for(let i=0;i<m.nrm.length;i++)m.nrm[i]=Math.round(m.nrm[i]*100)/100;
 out[kind]={source:m.file,tris:m.idx.length/3,verts:m.pos.length/3,height:+m.size[1].toFixed(3),width:+Math.max(m.size[0],m.size[2]).toFixed(3),pos:b64(m.pos),nrm:b64(m.nrm),uv:b64(m.uv),idx:b64(m.idx)}}
const white={u:((whiteIndex%ATLAS_COLS)*TILE+TILE/2)/W,v:(Math.floor(whiteIndex/ATLAS_COLS)*TILE+TILE/2)/Hh};
const js='// GD5 ground cover models (generated by scripts/build-cover-assets.mjs, do not edit): one atlas texture and one baked model per kind from the Quaternius Stylized Nature MegaKit [Standard] (CC0 1.0); positions, normals, UVs and indices are base64 typed arrays (Float32, Float32, Float32, Uint16).\n'
 +'export const COVER_ATLAS={width:'+W+',height:'+Hh+',white:'+JSON.stringify({u:+white.u.toFixed(5),v:+white.v.toFixed(5)})+',png:"data:image/png;base64,'+atlas.toString('base64')+'"};\n'
 +'export const COVER_MODELS='+JSON.stringify(out)+';\n';
writeFileSync('dist/cover-assets.js',js);
console.log('cover-assets.js',(js.length/1024).toFixed(0)+' KB; atlas png',(atlas.length/1024).toFixed(0)+' KB;',tiles.length,'tiles');
for(const [k,m] of Object.entries(out))console.log(k.padEnd(10),m.source.padEnd(20),m.tris+' tris',m.verts+' verts','h '+m.height+' m','w '+m.width+' m');
