// Builds the bakery restock goods (owner decision 2026-11-19: Ironwood Bakery restocks FLOUR and COFFEE BEANS, not planks) as small code-built, vertex-coloured GLBs in dist/assets/goods.
//   node scripts/build-bakery-goods.mjs      (no dependencies; deterministic: the same bytes on every run)
// Per good: <good>-sack.glb (one sack standing, the tied neck up), <good>-sack-carry.glb (one sack lying across the arms: long side along x, so carry-pose.js boxPose(size) takes its bounding size as is)
// and <good>-pallet.glb (a half pallet with four sacks lying two by two). No textures: ONE mesh, ONE primitive and ONE material per file (white base colour x COLOR_0, roughness .95, double sided, the same
// numbers in every file), so the game can draw each kind as one InstancedMesh and share one vertex-colour material between all of them. Origin: the middle of the base, y up, front +z, 1 unit = 1 m.
import {writeFileSync,mkdirSync} from 'node:fs';

const OUT='dist/assets/goods';
const TAU=Math.PI*2;
const lin=c=>{const s=c/255;return s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4)};
const hex=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const tone=(rgb,k)=>rgb.map(c=>Math.max(0,Math.min(255,c*k)));
const hash=(...a)=>{let h=2166136261;for(const x of a)h=Math.imul(h^((x*1000|0)>>>0),16777619);h=Math.imul(h^(h>>>15),2246822519);return ((h^(h>>>13))>>>0)/4294967296}; // 0..1, integers or small decimals in
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{const l=Math.hypot(...a);return l>1e-12?a.map(v=>v/l):[0,0,0]};

// ---- the goods: colours are sRGB hex; sizes in metres (a standing sack: w across the front, d front to back, h to the top of the body; the neck and tuft sit on top)
const GOODS={
 flour:{w:.40,d:.24,h:.60,cloth:'#e3d7b8',twine:'#8a6a3e',weave:.035,lump:.022,
  label:{cols:8,rows:8,half:.62,y0:.30,y1:.68,colours:{w:'#f3efe4',r:'#a8443a',b:'#3d5a8a'},
   art:['wwwwwwww','wrrrrrrw','wrrrrrrw','wwwwwwww','wbbbbbbw','wwwwwwww','wbbbwbbw','wwwwwwww']}}, // a printed paper-white patch: a red stamp block, then two blue lines of 'text'
 'coffee-beans':{w:.42,d:.26,h:.56,cloth:'#7d5c38',twine:'#4f3a22',weave:.06,lump:.03,stripes:[[.13,.19,'#3f6b3a'],[.74,.80,'#3f6b3a']],
  label:{cols:8,rows:5,half:.6,y0:.34,y1:.62,colours:{k:'#2c1f14'},
   art:['kkkkkkkk','........','kk.kkk.k','........','kkkkkkkk']}} // stencilled ink straight on the jute ('.' = no ink); two green stripes round the sack
};
const DETAIL={hi:{U:16,V:12,tieU:10,label:true},lo:{U:12,V:8,tieU:8,label:true}}; // lo: the sacks on the pallet

// ---- mesh helpers: per-quad vertices (crisp colour per quad), smooth normals from the shared grid
const newMesh=()=>({P:[],N:[],C:[],I:[]});
function pushTri(m,p,n,c){const b=m.P.length/3;for(let k=0;k<3;k++){m.P.push(...p[k]);m.N.push(...n[k]);m.C.push(...c)}m.I.push(b,b+1,b+2)}
const area=(a,b,c)=>Math.hypot(...cross(sub(b,a),sub(c,a)));
// grid: rows of points (rows[r][i]); closed = the columns wrap round. colour(i,r) -> sRGB [r,g,b] or null (quad skipped). Rows going up with columns going counter-clockwise seen from above face outwards.
function addGrid(m,rows,colour,closed=true){
 const R=rows.length,U=rows[0].length,cols=closed?U:U-1,gn=rows.map(row=>row.map(()=>[0,0,0])),at=(r,i)=>rows[r][i%U];
 for(let r=0;r<R-1;r++)for(let i=0;i<cols;i++){const a=at(r,i),b=at(r+1,i),c=at(r,i+1),d=at(r+1,i+1),f1=cross(sub(b,a),sub(c,a)),f2=cross(sub(b,c),sub(d,c));
  for(const [rr,ii,f] of [[r,i,f1],[r+1,i,f1],[r,i+1,f1],[r,i+1,f2],[r+1,i,f2],[r+1,i+1,f2]]){const g=gn[rr][ii%U];g[0]+=f[0];g[1]+=f[1];g[2]+=f[2]}}
 for(let r=0;r<R;r++){const row=rows[r];if(row.every(p=>Math.hypot(...sub(p,row[0]))<1e-7)){const s=[0,0,0];for(const g of gn[r])for(let k=0;k<3;k++)s[k]+=g[k];gn[r]=gn[r].map(()=>s)}} // a pole: every copy gets the average
 const nn=gn.map(row=>row.map(norm));
 for(let r=0;r<R-1;r++)for(let i=0;i<cols;i++){const col=colour(i,r);if(!col)continue;const c=col.map(lin),j=(i+1)%U;
  const A=[rows[r][i],nn[r][i]],B=[rows[r+1][i],nn[r+1][i]],Cc=[rows[r][j],nn[r][j]],D=[rows[r+1][j],nn[r+1][j]];
  if(area(A[0],B[0],Cc[0])>1e-10)pushTri(m,[A[0],B[0],Cc[0]],[A[1],B[1],Cc[1]],c);
  if(area(Cc[0],B[0],D[0])>1e-10)pushTri(m,[Cc[0],B[0],D[0]],[Cc[1],B[1],D[1]],c)}
}
// an axis-aligned box (then turned by yaw about y): flat normals, 12 triangles
function addBox(m,[cx,cy,cz],[sx,sy,sz],rgb,yaw=0){
 const c=rgb.map(lin),cy_=Math.cos(yaw),sy_=Math.sin(yaw),rot=([x,y,z])=>[x*cy_+z*sy_,y,-x*sy_+z*cy_];
 const faces=[[[1,0,0],[0,0,-1],[0,1,0]],[[-1,0,0],[0,0,1],[0,1,0]],[[0,1,0],[1,0,0],[0,0,-1]],[[0,-1,0],[1,0,0],[0,0,1]],[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[-1,0,0],[0,1,0]]];
 const h=[sx/2,sy/2,sz/2];
 for(const [n,t1,t2] of faces){const corner=(a,b)=>{const p=[0,1,2].map(k=>n[k]*h[k]+t1[k]*a*h[k]+t2[k]*b*h[k]),q=rot(p);return [q[0]+cx,q[1]+cy,q[2]+cz]};
  const v=[corner(-1,-1),corner(1,-1),corner(1,1),corner(-1,1)],nr=rot(n);pushTri(m,[v[0],v[1],v[2]],[nr,nr,nr],c);pushTri(m,[v[0],v[2],v[3]],[nr,nr,nr],c)}
}
// copy src into dst: scale (normals by the inverse), then turn about x, then about y, then move
function place(dst,src,{scale=[1,1,1],rotX=0,rotY=0,t=[0,0,0]}={}){
 const cx=Math.cos(rotX),sx=Math.sin(rotX),cy=Math.cos(rotY),sy=Math.sin(rotY);
 const turn=([x,y,z])=>{const y1=y*cx-z*sx,z1=y*sx+z*cx;return [x*cy+z1*sy,y1,-x*sy+z1*cy]};
 const b=dst.P.length/3;
 for(let k=0;k<src.P.length;k+=3){const p=turn([src.P[k]*scale[0],src.P[k+1]*scale[1],src.P[k+2]*scale[2]]);dst.P.push(p[0]+t[0],p[1]+t[1],p[2]+t[2]);
  dst.N.push(...norm(turn(norm([src.N[k]/scale[0],src.N[k+1]/scale[1],src.N[k+2]/scale[2]]))))}
 dst.C.push(...src.C);for(const i of src.I)dst.I.push(i+b);
 const flip=scale[0]*scale[1]*scale[2]<0;if(flip)for(let i=dst.I.length-src.I.length;i<dst.I.length;i+=3){const x=dst.I[i+1];dst.I[i+1]=dst.I[i+2];dst.I[i+2]=x}
 return dst;
}
const bounds=m=>{const lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(let k=0;k<m.P.length;k++){lo[k%3]=Math.min(lo[k%3],m.P[k]);hi[k%3]=Math.max(hi[k%3],m.P[k])}return {lo,hi}};
// move so the base is at y 0 and the footprint is centred on x and z
function recentre(m){const {lo,hi}=bounds(m),dx=(lo[0]+hi[0])/2,dz=(lo[2]+hi[2])/2;for(let k=0;k<m.P.length;k+=3){m.P[k]-=dx;m.P[k+1]-=lo[1];m.P[k+2]-=dz}return m}

// ---- one sack, standing: a bottom, a pillow-like body that gathers into a neck, a twine tie with two loose ends, a frayed tuft, and a label patch on the front (+z)
const PROFILE={y:[0,.03,.12,.34,.58,.76,.88,.955],x:[.88,.95,1,1.03,1,.9,.62,.26],z:[.82,.92,1,1.04,1.02,.95,.78,.42]}; // fractions of h, of w/2 and of d/2
function hermite(ks,vs,y){ // Catmull-Rom tangents on uneven knots
 let k=0;while(k<ks.length-2&&y>ks[k+1])k++;const y0=ks[k],y1=ks[k+1],t=Math.max(0,Math.min(1,(y-y0)/(y1-y0))),h=y1-y0;
 const m=j=>j<=0?(vs[1]-vs[0])/(ks[1]-ks[0]):j>=ks.length-1?(vs[j]-vs[j-1])/(ks[j]-ks[j-1]):(vs[j+1]-vs[j-1])/(ks[j+1]-ks[j-1]);
 const t2=t*t,t3=t2*t;return (2*t3-3*t2+1)*vs[k]+(t3-2*t2+t)*h*m(k)+(-2*t3+3*t2)*vs[k+1]+(t3-t2)*h*m(k+1);
}
function sack(key,detail,seed){
 const G=GOODS[key],D=DETAIL[detail],m=newMesh(),hw=G.w/2,hd=G.d/2,H=G.h,neckY=PROFILE.y[PROFILE.y.length-1];
 const ph=[hash(seed,1)*TAU,hash(seed,2)*TAU,hash(seed,3)*TAU];
 // the body surface: angle th (0 = +x, pi/2 = front +z), height fraction y
 const body=(th,y)=>{const sxv=hermite(PROFILE.y,PROFILE.x,y),szv=hermite(PROFILE.y,PROFILE.z,y),n=2+.8*Math.max(0,Math.min(1,(sxv-.3)/.6)),c=Math.cos(th),s=Math.sin(th);
  const bell=Math.sin(Math.PI*Math.min(1,y/neckY)),k=1+G.lump*bell*(.6*Math.sin(3*th+7*y+ph[0])+.4*Math.sin(5*th+13*y+ph[1]));
  return [hw*sxv*k*Math.sign(c)*Math.pow(Math.abs(c),2/n)+.012*Math.sin(ph[2])*y*y,Math.max(0,y)*H,hd*szv*k*Math.sign(s)*Math.pow(Math.abs(s),2/n)]};
 const U=D.U,ths=Array.from({length:U},(_,i)=>i/U*TAU);
 // rows: the bottom (pole out to the rim), then the side up to the neck (stripe edges added as rows so the stripes are crisp)
 let ys=Array.from({length:D.V+1},(_,r)=>r/D.V*neckY);for(const [a,b] of G.stripes||[])ys.push(a,b);ys=[...new Set(ys.map(v=>+v.toFixed(4)))].sort((a,b)=>a-b).filter((v,i,a)=>i===0||v-a[i-1]>.008);
 const rn=body(0,neckY)[0]; // the neck radius (x half width where the body ends)
 const rows=[ths.map(()=>[0,0,0]),ths.map(th=>{const p=body(th,0);return [p[0]*.55,0,p[2]*.55]}),...ys.map(y=>ths.map(th=>body(th,y)))];
 const ring=(r,y)=>ths.map(th=>[r*Math.cos(th),y,r*Math.sin(th)]);
 const pinch=rn*.82,top=H*1.0,tuftH=.07;
 rows.push(ring(pinch,H*.975),ring(pinch,top),ring(rn*1.45,top+tuftH*.45),ths.map((th,i)=>{const r=rn*(i%2?2.25:1.85),y=top+tuftH*(i%2?.85:1.0);return [r*Math.cos(th),y,r*Math.sin(th)]})); // the gathered neck, then the frayed tuft
 const cloth=hex(G.cloth),S=ys.length; // quads: r 0..1 the bottom, 2..S the side (between ys[r-2] and ys[r-1]), S+1..S+2 the neck, S+3.. the tuft
 addGrid(m,rows,(i,r)=>{
  const k=1+(hash(seed,i,r)-.5)*.08-(r%2)*G.weave;let rgb=cloth;
  if(r>=2&&r<=S&&G.stripes){const yc=(ys[r-2]+ys[r-1])/2;for(const [a,b,col] of G.stripes)if(yc>a&&yc<b)rgb=hex(col)}
  if(r>=S+3)return tone(cloth,(.9+hash(seed,i,r,7)*.12)); // the tuft: frayed, a little uneven
  return tone(rgb,k)});
 // a lid inside the tuft so the open top does not show a hole from above
 addGrid(m,[ring(rn*1.4,top+tuftH*.45),ring(0,top+tuftH*.5)],(i)=>tone(cloth,.86+hash(seed,i,9)*.06));
 // the twine tie and its two loose ends
 const tw=hex(G.twine),tU=D.tieU,tths=Array.from({length:tU},(_,i)=>i/tU*TAU),tring=(r,y)=>tths.map(th=>[r*Math.cos(th),y,r*Math.sin(th)]),y0=H*.968,y1=H*.992;
 addGrid(m,[tring(pinch,y0),tring(pinch+.013,y0),tring(pinch+.013,y1),tring(pinch,y1)],(i,r)=>tone(tw,.92+hash(seed,i,r,5)*.16));
 addBox(m,[-.014,y0-.035,pinch+.016],[.009,.07,.009],tone(tw,.95),.2);addBox(m,[.016,y0-.028,pinch+.016],[.009,.056,.009],tone(tw,1.05),-.25);
 // the label: a patch that follows the front of the body 3 mm off it, its own finer grid so the print is crisp
 if(D.label&&G.label){const L=G.label,grid=[];
  for(let r=0;r<=L.rows;r++){const y=L.y0+(L.y1-L.y0)*r/L.rows,row=[];
   for(let i=0;i<=L.cols;i++){const th=Math.PI/2+L.half*(i/L.cols-.5),e=1e-3,p=body(th,y),a=body(th-e,y),b=body(th,y+e),n=norm(cross(sub(a,p),sub(b,p)));row.push([p[0]+n[0]*.003,p[1]+n[1]*.003,p[2]+n[2]*.003])}
   grid.push(row)}
  const colours=Object.fromEntries(Object.entries(L.colours).map(([k,v])=>[k,hex(v)]));
  // i runs from the +x side to the -x side across the front (th rises, so the patch faces out), so i = 0 is the right-hand column seen from the front; art rows are top first
  addGrid(m,grid,(i,r)=>{const ch=L.art[L.rows-1-r][L.cols-1-i];return ch==='.'?null:tone(colours[ch],.97+hash(seed,i,r,11)*.05)},false)}
 return m;
}
// the same sack lying on its back (front up), a little flattened by its own weight; the neck toward -z, centred, base at y 0
const lying=(key,detail,seed)=>recentre(place(newMesh(),sack(key,detail,seed),{scale:[1.08,1,.8],rotX:-Math.PI/2}));
// a half pallet, 0.92 x 0.76 x 0.12 m: five top boards, nine blocks, three bottom boards
function pallet(seed){
 const m=newMesh(),wood=hex('#b08a5a'),block=hex('#957148'),W=.92,Dp=.76;
 for(let j=0;j<3;j++)addBox(m,[0,.01,(j-1)*(Dp/2-.05)],[W,.02,.1],tone(wood,.9+hash(seed,j,1)*.1));
 for(let i=0;i<3;i++)for(let j=0;j<3;j++)addBox(m,[(i-1)*(W/2-.05),.06,(j-1)*(Dp/2-.05)],[.1,.08,.1],tone(block,.92+hash(seed,i,j,2)*.12));
 for(let j=0;j<5;j++)addBox(m,[0,.11,(j-2)*(Dp-.11)/4],[W,.02,.11],tone(wood,.94+hash(seed,j,3)*.12));
 return m;
}
// four sacks two by two on the pallet, the necks alternating, the top layer turned the other way and nudged so it does not look copied
function palletOf(key){
 const m=pallet(key.length*13),one=s=>lying(key,'lo',s),b0=bounds(one(1)),thick=b0.hi[1],half=b0.hi[0];
 const spots=[[-1,0,0],[1,0,Math.PI],[-1,1,Math.PI],[1,1,0]];
 spots.forEach(([side,layer,yaw],n)=>{const s=one(n+2),jx=(hash(n,4)-.5)*.02,jz=(hash(n,5)-.5)*.03,jy=(hash(n,6)-.5)*.06;
  place(m,s,{rotY:yaw+jy,t:[side*(half+.005)+jx,.12+layer*thick*.88,jz]})});
 return recentre(m);
}

// ---- GLB writer: POSITION, NORMAL, COLOR_0 (linear, unsigned bytes normalised, VEC4 with alpha 255 so every element stays 4-byte aligned), indices; ONE material
const MATERIAL={name:'bakery-goods-vertex-colour',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.95},doubleSided:true};
function glb(m,name){
 const r=(a,d)=>Float32Array.from(a,v=>Math.round(v*d)/d),P=r(m.P,1e5),N=r(m.N,1e4),n=P.length/3,C=new Uint8Array(n*4),I=n<65536?Uint16Array.from(m.I):Uint32Array.from(m.I);
 for(let k=0;k<n;k++){for(let c=0;c<3;c++)C[k*4+c]=Math.round(Math.max(0,Math.min(1,m.C[k*3+c]))*255);C[k*4+3]=255}
 const {lo,hi}=bounds({P});
 const pad=b=>Buffer.concat([b,Buffer.alloc((4-b.length%4)%4)]),parts=[P,N,C,I].map(a=>pad(Buffer.from(a.buffer,a.byteOffset,a.byteLength)));
 let off=0;const views=parts.map((b,i)=>{const v={buffer:0,byteOffset:off,byteLength:[P,N,C,I][i].byteLength,target:i<3?34962:34963};off+=b.length;return v});
 const json={asset:{version:'2.0',generator:'scripts/build-bakery-goods.mjs'},scene:0,scenes:[{nodes:[0]}],nodes:[{name,mesh:0}],meshes:[{name,primitives:[{attributes:{POSITION:0,NORMAL:1,COLOR_0:2},indices:3,material:0,mode:4}]}],materials:[MATERIAL],
  accessors:[{bufferView:0,componentType:5126,count:n,type:'VEC3',min:lo,max:hi},{bufferView:1,componentType:5126,count:n,type:'VEC3'},{bufferView:2,componentType:5121,normalized:true,count:n,type:'VEC4'},{bufferView:3,componentType:I.BYTES_PER_ELEMENT===2?5123:5125,count:I.length,type:'SCALAR'}],
  bufferViews:views,buffers:[{byteLength:off}]};
 let js=Buffer.from(JSON.stringify(json));js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,0x20)]);const bin=Buffer.concat(parts);
 const hd=Buffer.alloc(12);hd.writeUInt32LE(0x46546C67,0);hd.writeUInt32LE(2,4);hd.writeUInt32LE(12+8+js.length+8+bin.length,8);
 const c1=Buffer.alloc(8);c1.writeUInt32LE(js.length,0);c1.writeUInt32LE(0x4E4F534A,4);const c2=Buffer.alloc(8);c2.writeUInt32LE(bin.length,0);c2.writeUInt32LE(0x004E4942,4);
 return {bytes:Buffer.concat([hd,c1,js,c2,bin]),triangles:I.length/3,vertices:n,size:[0,1,2].map(k=>+(hi[k]-lo[k]).toFixed(3))};
}

mkdirSync(OUT,{recursive:true});
const report=[];
for(const key of Object.keys(GOODS)){
 const models={sack:recentre(sack(key,'hi',1)),'sack-carry':recentre(place(newMesh(),lying(key,'hi',1),{rotY:Math.PI/2})),pallet:palletOf(key)};
 for(const [variant,m] of Object.entries(models)){const name=`${key}-${variant}`,g=glb(m,name);writeFileSync(`${OUT}/${name}.glb`,g.bytes);
  report.push(`${OUT}/${name}.glb: ${g.triangles} triangles, ${g.vertices} vertices, size x ${g.size[0]} y ${g.size[1]} z ${g.size[2]} m, ${g.bytes.length} bytes`)}
}
console.log(report.join('\n'));
