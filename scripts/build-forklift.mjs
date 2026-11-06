// Converts the public-domain "48-forklift" OBJ (assets-src/Veichles/Forklifts/48-forklift/Forklift.obj) into dist/forklift-assets.js (0.35 step 5, DESIGN 4.16 D).
//   node scripts/build-forklift.mjs
// The OBJ has 41 named objects and no materials, so the colours below are chosen here, per object. Its units are about 4.4 mm (the roof is 509 units high), its front is -x and the
// ground is y = -2. The result is in metres, front +z, ground at y = 0, centred on the body. Three parts:
//   body (static), mast (its bottom at y = 0 in its own frame: the game stretches it in y as the forks rise) and carriage (forks, back plate and fork bars: the part that lifts, stored
//   at its rest height). `tineTop` is the top of the fork tines at rest, `mastBase` / `mastTop` the mast's bottom and top at rest.
import {readFileSync,writeFileSync} from 'node:fs';
const FILE='assets-src/Veichles/Forklifts/48-forklift/Forklift.obj',S=0.0044,XC=10,GROUND=-2.01;
const CARRIAGE=new Set(['Sweep','Cube.8','Cube.9','Cube.10','Cube.11','Cube.12_0','Cube.12_1','Cube.12_2','Cube.12_3','Cube.12_4','Cube.13_1']);
const MAST=new Set(['Cube.12_5','Cube.12','Cube.13_2']);
// the wheels: each object holds a left and right pair (tyre and rim); they are split by side into four parts (+x is the left side, front +z), each stored centred on its own axle so the game can spin and steer it
const WHEEL={Tube:'front',Cylinder_1:'front',Tube_1:'rear',Cylinder_2:'rear'};
const COLOUR={'Cube.13_1':'#3a3a3a',Sweep:'#4a4a4a','Cube.8':'#555555','Cube.9':'#555555','Cube.10':'#555555','Cube.11':'#555555','Cube.12_5':'#4d4d4d','Cube.12':'#4d4d4d','Cube.13_2':'#4d4d4d',
 Tube:'#1b1b1b',Tube_1:'#1b1b1b',Cylinder_1:'#9a9a9a',Cylinder_2:'#9a9a9a',front_shaft:'#777777',back_shaft:'#777777',Roof:'#2a2a2a',Panel:'#303030',Tube_2:'#151515',Cylinder_3:'#333333',
 Sphere:'#e87a00',Cube:'#333333','Cube.1':'#333333','Cube.2':'#333333',Cylinder:'#333333','Cylinder.1':'#333333','Cylinder.2':'#222222','Cylinder.3':'#222222','Cylinder.4':'#222222','Cylinder.5':'#222222','Cylinder.6':'#222222','Cylinder.1_1':'#222222'};
const BODY_YELLOW='#e0a800',hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const V=[],groups=new Map();let cur=null;
for(const line of readFileSync(FILE,'utf8').split(/\r?\n/)){
 if(line.startsWith('v '))V.push(line.trim().split(/\s+/).slice(1,4).map(Number));
 else if(line.startsWith('o ')||line.startsWith('g ')){cur=line.slice(2).trim();if(!groups.has(cur))groups.set(cur,[])}
 else if(line.startsWith('f ')&&cur){const ids=line.trim().split(/\s+/).slice(1).map(t=>parseInt(t.split('/')[0],10)-1);for(let k=1;k+1<ids.length;k++)groups.get(cur).push([ids[0],ids[k],ids[k+1]])}
}
// old (x, y, z) -> metres, front +z: x' = z, y' = y - ground, z' = -(x - XC); a proper rotation, so the winding is kept
const map=([x,y,z])=>[z*S,(y-GROUND)*S,-(x-XC)*S];
const W=V.map(map);
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(...a)||1;
const blank=()=>({pos:[],nor:[],col:[],idx:[]}),parts={body:blank(),mast:blank(),carriage:blank(),wheelFL:blank(),wheelFR:blank(),wheelRL:blank(),wheelRR:blank()};
let tineTop=0,mastLo=1e9,mastHi=-1e9;
for(const [name,tris] of groups){
 const wheel=WHEEL[name],partOf=t=>wheel?'wheel'+(wheel==='front'?'F':'R')+((W[t[0]][0]+W[t[1]][0]+W[t[2]][0])>0?'L':'R'):CARRIAGE.has(name)?'carriage':MAST.has(name)?'mast':'body',rgb=hex(COLOUR[name]||BODY_YELLOW);
 // face normals, then a smooth normal at each vertex from the faces around it within 40 degrees of this one; vertices are shared by (position, that normal)
 const fn=tris.map(([a,b,c])=>{const n=cross(sub(W[b],W[a]),sub(W[c],W[a]));const l=len(n);return n.map(v=>v/l)}),around=new Map();
 tris.forEach((t,i)=>t.forEach(v=>{if(!around.has(v))around.set(v,[]);around.get(v).push(i)}));
 const key=new Map();let P=null;
 const vert=(v,i)=>{const sum=[0,0,0];for(const j of around.get(v)){const d=fn[i][0]*fn[j][0]+fn[i][1]*fn[j][1]+fn[i][2]*fn[j][2];if(d>.766)for(let k=0;k<3;k++)sum[k]+=fn[j][k]}const l=len(sum),n=sum.map(x=>+(x/l).toFixed(2)),k=v+'/'+n.join(',');
  const kk=k+'@'+P.tag;if(!key.has(kk)){key.set(kk,P.pos.length/3);P.pos.push(...W[v]);P.nor.push(...n);P.col.push(...rgb)}return key.get(kk)};
 tris.forEach((t,i)=>{P=parts[partOf(t)];P.tag=partOf(t);const ids=t.map(v=>vert(v,i));P.idx.push(...ids)});
 if(name==='Cube.13_1'){for(const [x,y] of tris.flat().map(v=>V[v]))if(x<-200)tineTop=Math.max(tineTop,(y-GROUND)*S)}
 if(MAST.has(name))for(const v of tris.flat()){mastLo=Math.min(mastLo,W[v][1]);mastHi=Math.max(mastHi,W[v][1])}
}
// the mast in its own frame (bottom at 0)
{const m=parts.mast;for(let i=1;i<m.pos.length;i+=3)m.pos[i]-=mastLo}
// each wheel centred on its axle (the middle of its bounding box); `wheels` records where that is and the tyre's radius
const wheels={};for(const id of ['wheelFL','wheelFR','wheelRL','wheelRR']){const P=parts[id],lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(let i=0;i<P.pos.length;i+=3)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],P.pos[i+k]);hi[k]=Math.max(hi[k],P.pos[i+k])}
 const at=lo.map((v,k)=>(v+hi[k])/2);for(let i=0;i<P.pos.length;i+=3)for(let k=0;k<3;k++)P.pos[i+k]-=at[k];wheels[id]={at:at.map(v=>+v.toFixed(3)),radius:+((hi[1]-lo[1])/2).toFixed(3)}}
const b64=(T,a)=>Buffer.from(new T(a).buffer).toString('base64');
const out={source:'Veichles/Forklifts/48-forklift/Forklift.obj',parts:{},wheels,tineTop:+tineTop.toFixed(3),mastBase:+mastLo.toFixed(3),mastTop:+mastHi.toFixed(3)};let tris=0,lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];
for(const [id,P] of Object.entries(parts)){out.parts[id]={positions:b64(Float32Array,P.pos),normals:b64(Float32Array,P.nor),colors:b64(Uint8Array,P.col),indices:b64(Uint16Array,P.idx),triangles:P.idx.length/3,vertices:P.pos.length/3};tris+=P.idx.length/3;
 for(let i=0;i<P.pos.length;i+=3)for(let k=0;k<3;k++){const v=P.pos[i+k]+(id==='mast'&&k===1?mastLo:0)+(wheels[id]?wheels[id].at[k]:0);lo[k]=Math.min(lo[k],v);hi[k]=Math.max(hi[k],v)}}
out.triangles=tris;out.bounds={min:lo.map(v=>+v.toFixed(3)),max:hi.map(v=>+v.toFixed(3))};
writeFileSync('dist/forklift-assets.js',`// GENERATED by scripts/build-forklift.mjs from ${out.source} (public domain; ASSETS.md). Metres, front +z, ground y = 0. The mast is stored with its bottom at y = 0 (mastBase is where it stands).\nexport const FORKLIFT=${JSON.stringify(out)};\n`);
console.log(`forklift: ${tris} triangles, ${Object.entries(parts).map(([k,p])=>k+' '+p.idx.length/3+' tris / '+p.pos.length/3+' verts').join(', ')}, tineTop ${out.tineTop}, mast ${out.mastBase}..${out.mastTop}, bounds ${JSON.stringify(out.bounds)}`);
