// GD5 cover packing (notes/ground-detail-design.md 2b): turns a coverFor() placement list into the typed arrays one InstancedMesh per kind needs (matrix, tint, rank+phase), decodes the baked MegaKit models of cover-assets.js and builds the code-made reed and crop shapes (the kit has none); pure, no DOM, no three.js.
import {FOOTING} from './terrain.js';
export const COVER_SINK=.02; // metres: roots start this far under the ground mesh (no gaps on slopes)
export const COVER_BOUND_PAD=1.6; // metres added to a mesh's bounding sphere (instance size and wind sway)
const f32=s=>{const b=typeof Buffer==='function'?Buffer.from(s,'base64'):Uint8Array.from(atob(s),c=>c.charCodeAt(0));const u=new Uint8Array(b.length);u.set(b);return new Float32Array(u.buffer)};
const u16=s=>{const b=typeof Buffer==='function'?Buffer.from(s,'base64'):Uint8Array.from(atob(s),c=>c.charCodeAt(0));const u=new Uint8Array(b.length);u.set(b);return new Uint16Array(u.buffer)};
// One baked kit model (a COVER_MODELS entry) -> {pos,nrm,uv,idx,col,height}; col is white (the texture gives the colour).
export function decodeModel(m){const pos=f32(m.pos),col=new Float32Array(pos.length).fill(1);return {pos,nrm:f32(m.nrm),uv:f32(m.uv),idx:u16(m.idx),col,height:m.height}}
const lin=h=>{const c=[(h>>16&255)/255,(h>>8&255)/255,(h&255)/255];return c.map(v=>Math.pow(v,2.2))};
// A bundle of tapered blades (each a two-segment strip): n blades round the root, leaning out `lean` metres at the tip, tall `h`, `w` wide at the root, vertex-coloured root->tip; (u,v) = the atlas white tile.
function blades({n,h,w,lean,root,tip,head=null,headLen=0,white}){const pos=[],nrm=[],uv=[],col=[],idx=[],r=lin(root),t=lin(tip);let v0=0;
 for(let b=0;b<n;b++){const a=b/n*Math.PI*2+b*.7,ca=Math.cos(a),sa=Math.sin(a),lx=ca*lean*(.6+.4*((b*37)%5)/4),lz=sa*lean*(.6+.4*((b*53)%5)/4),hh=h*(.82+.18*((b*29)%7)/6),px=-sa,pz=ca; // px,pz: the blade's width direction
  const rows=[[0,w/2,r],[.55,w/2*.7,[(r[0]+t[0])/2,(r[1]+t[1])/2,(r[2]+t[2])/2]],[1,0,t]];
  for(const [k,half,c] of rows){const y=hh*k,off=k*k;for(const s of [-1,1]){pos.push(ca*.02*b+lx*off+px*half*s,y,sa*.02*b+lz*off+pz*half*s);nrm.push(ca,.4,sa);uv.push(white.u,white.v);col.push(c[0],c[1],c[2])}}
  // rows 0,1 have two vertices each, row 2 (the tip) is a pair too (width 0 = a point): 6 vertices, 4 triangles
  const o=v0;idx.push(o,o+1,o+2,o+1,o+3,o+2,o+2,o+3,o+4,o+3,o+5,o+4);v0+=6;
  if(head){const y0=hh*(1-headLen),y1=hh,hw=w*1.6,cx=lx*.9,cz=lz*.9,hc=lin(head),o2=v0;
   for(const [y,half] of [[y0,hw*.3],[y0+(y1-y0)*.4,hw],[y1,0]])for(const s of [-1,1]){pos.push(ca*.02*b+cx+px*half*s,y,sa*.02*b+cz+pz*half*s);nrm.push(ca,.3,sa);uv.push(white.u,white.v);col.push(hc[0],hc[1],hc[2])}
   idx.push(o2,o2+1,o2+2,o2+1,o2+3,o2+2,o2+2,o2+3,o2+4,o2+3,o2+5,o2+4);v0+=6}}
 return {pos:new Float32Array(pos),nrm:new Float32Array(nrm),uv:new Float32Array(uv),idx:new Uint16Array(idx),col:new Float32Array(col),height:h}}
// The two kinds the kit lacks: a reed clump (about 1 m tall, 7 blades, 28 triangles) and a wheat stalk bunch (0.8 m, 5 stalks with golden heads, 40 triangles).
export const reedModel=white=>blades({n:7,h:1,w:.05,lean:.22,root:0x4a6f35,tip:0xa8a56a,white});
export const cropModel=white=>blades({n:5,h:.8,w:.025,lean:.09,root:0xb59a45,tip:0xd8b84e,head:0xe0b94b,headLen:.22,white});
// Which asset model a kind uses: the kit's, else the code-made one (COVER_RULES models [null]).
export function kindModel(kind,assets){if(kind==='reed')return reedModel(assets.white);if(kind==='crop')return cropModel(assets.white);const m=assets.models[kind];return m?decodeModel(m):null}
// Group a coverFor list by kind (it is already grouped in COVER_ORDER) -> [{kind,from,to}].
export function kindRuns(list){const runs=[];for(let i=0;i<list.length;){let j=i+1;while(j<list.length&&list[j].kind===list[i].kind)j++;runs.push({kind:list[i].kind,from:i,to:j});i=j}return runs}
// Fill the instance arrays of one run: matrix (16 floats, column-major, uniform scale and a yaw about y), tint (3), inst = [rank, phase] (2). Writes into `out` {matrix,color,inst} (typed arrays of at least the run's size) and returns {minX,maxX,minY,maxY,minZ,maxZ}. No allocation per instance.
export function packRun(list,from,to,heightAt,surfaceAt,out){const M=out.matrix,C=out.color,I=out.inst;let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity,z0=Infinity,z1=-Infinity;
 for(let k=from,n=0;k<to;k++,n++){const e=list[k],c=Math.cos(e.yaw)*e.scale,s=Math.sin(e.yaw)*e.scale,sy=e.scale,surf=surfaceAt?surfaceAt(e.x,e.z):1,foot=FOOTING[surf]??FOOTING[1],y=heightAt(e.x,e.z)+foot-COVER_SINK,o=n*16;
  M[o]=c;M[o+1]=0;M[o+2]=-s;M[o+3]=0;M[o+4]=0;M[o+5]=sy;M[o+6]=0;M[o+7]=0;M[o+8]=s;M[o+9]=0;M[o+10]=c;M[o+11]=0;M[o+12]=e.x;M[o+13]=y;M[o+14]=e.z;M[o+15]=1;
  C[n*3]=e.tint[0];C[n*3+1]=e.tint[1];C[n*3+2]=e.tint[2];I[n*2]=e.rank;I[n*2+1]=e.phase;
  if(e.x<x0)x0=e.x;if(e.x>x1)x1=e.x;if(y<y0)y0=y;if(y>y1)y1=y;if(e.z<z0)z0=e.z;if(e.z>z1)z1=e.z}
 return {minX:x0,maxX:x1,minY:y0,maxY:y1,minZ:z0,maxZ:z1}}
// Per-kind shader numbers: [near, far, sway multiplier, 1 / model height] (the vertex shader fades by distance and bends by height).
export const kindUniform=(kind,reach,mul,height)=>[reach.near,reach.far,mul,height>0?1/height:0];
