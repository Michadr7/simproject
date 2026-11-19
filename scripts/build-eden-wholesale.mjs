// Builds EDEN WHOLESALE (owner decision 2026-11-19: the flour and coffee-bean supplier for Ironwood Bakery, a Bruce Hughes / Eden company) as a code-built, vertex-coloured GLB in dist/assets/buildings.
//   node scripts/build-eden-wholesale.mjs      (no dependencies; deterministic: the same bytes on every run)
// v2 (visual pass): a 12 x 9 m warehouse-store in light warm-grey ribbed cladding with seam battens, slate corner trims, a plinth, an Eden green stripe and a slate parapet band under a light coping;
// a brick-and-render shop front whose green board carries the words EDEN WHOLESALE as 3D block letters (a block font built here, no textures) under three gooseneck lamps; a staff door, three windows
// and a wall lamp on the WEST wall (Barber's Walk side); clerestories, a cat ladder, a louvre, downpipes and a lit fire exit on the back; a covered dock with canopy lights, a pallet rack, crates, a bin.
// ONE mesh, ONE primitive, ONE material (white x COLOR_0, roughness .95, double sided: the same numbers as dist/assets/goods), no textures. The lamp lenses are the LAST triangles (mesh extras.glow, the
// props-assets.js glow shape) so the game can give them an emissive group. Empty nodes: anchor_* (doors, counter, dock, pickup, truck, stock, lamps; dist/eden-wholesale.js holds the same numbers)
// and sign_eden_wholesale (the board's face). Origin: the middle of the footprint on the ground, y up, front +z, 1 unit = 1 m.
import {writeFileSync,mkdirSync} from 'node:fs';
import {ANCHORS,SIGN,BRAND,DOOR,SIDE_DOOR,LAMPS} from '../dist/eden-wholesale.js';

const OUT='dist/assets/buildings',NAME='eden-wholesale';
const lin=c=>{const s=c/255;return s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4)};
const hex=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const tone=(rgb,k)=>rgb.map(c=>Math.max(0,Math.min(255,c*k)));
const hash=(...a)=>{let h=2166136261;for(const x of a)h=Math.imul(h^((x*1000|0)>>>0),16777619);h=Math.imul(h^(h>>>15),2246822519);return ((h^(h>>>13))>>>0)/4294967296};
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{const l=Math.hypot(...a);return l>1e-12?a.map(v=>v/l):[0,0,0]};

// ---- colours (sRGB hex)
const C={clad:hex(BRAND.cladding),trim:hex(BRAND.trim),green:hex(BRAND.green),board:hex(BRAND.board),letters:hex(BRAND.letters),render:hex(BRAND.render),brick:hex(BRAND.brick),lens:hex(BRAND.lens),
 bricks:['#9b5b44','#8c4f3b','#a8664c','#7f4736','#94533f'].map(hex),roof:hex('#85888a'),concrete:hex('#a9a69e'),coping:hex('#dcdad3'),shutter:hex('#c6c9cb'),leaf:hex('#7cc276'),
 frame:hex('#39424a'),glass:hex('#3b5566'),glassHi:hex('#6c8a99'),yellow:hex('#d9b12c'),metal:hex('#9a9fa3'),wood:hex('#b58e5c'),runner:hex('#957148'),crate:hex('#a7804f'),
 flour:hex('#e3d7b8'),coffee:hex('#7d5c38'),stripe:hex('#3f6b3a'),plinth:hex('#8f8b84'),door:hex('#2f6e4a'),exit:hex('#2f9e5a'),rackBlue:hex('#2f5f9e'),rackOrange:hex('#d9772c'),bin:hex('#3c4a44')};

// ---- mesh: flat-shaded quads, each with one colour; winding fixed against the wanted normal so every face points out. glowing(true) sends the next faces to the lens list (drawn last).
const m={P:[],N:[],C:[],I:[],G:[]};let into='I';const glowing=on=>{into=on?'G':'I'};
function quad(a,b,c,d,n,rgb){const col=rgb.map(lin);if(dot(cross(sub(b,a),sub(c,a)),n)<0){[b,d]=[d,b]}const base=m.P.length/3;
 for(const p of [a,b,c,d]){m.P.push(...p);m.N.push(...n);m.C.push(...col)}m[into].push(base,base+1,base+2,base,base+2,base+3)}
// a grid on a plane: corner o, edge vectors U and V (full length), nu x nv cells, colour(i,j) -> rgb or null (skipped); normal n
function grid(o,U,V,nu,nv,n,colour){for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const rgb=colour(i,j);if(!rgb)continue;
 const p=(a,b)=>add(o,add(mul(U,a/nu),mul(V,b/nv)));quad(p(i,j),p(i+1,j),p(i+1,j+1),p(i,j+1),n,rgb)}}
// an axis-aligned box x0..x1, y0..y1, z0..z1; col = rgb or per-face {px,nx,py,ny,pz,nz,side}; skip = faces to leave out. The bottom (ny) is drawn only when listed in `under`.
function box(x0,x1,y0,y1,z0,z1,col,skip='',under=false){const f=k=>Array.isArray(col)?col:(col[k]||col.side);
 if(!skip.includes('px'))quad([x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0],[1,0,0],f('px'));
 if(!skip.includes('nx'))quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0],f('nx'));
 if(!skip.includes('pz'))quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1],f('pz'));
 if(!skip.includes('nz'))quad([x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[0,0,-1],f('nz'));
 if(!skip.includes('py'))quad([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1],[0,1,0],f('py'));
 if(under)quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[0,-1,0],f('ny'))}
// a vertical cylinder with a flat top
function cyl(cx,cz,r,y0,y1,seg,side,top){for(let i=0;i<seg;i++){const a0=i/seg*Math.PI*2,a1=(i+1)/seg*Math.PI*2,am=(a0+a1)/2,p=(a,y)=>[cx+r*Math.cos(a),y,cz+r*Math.sin(a)];
  quad(p(a0,y0),p(a1,y0),p(a1,y1),p(a0,y1),[Math.cos(am),0,Math.sin(am)],tone(side,.94+hash(i,31)*.1));
  const col=top.map(lin),b=m.P.length/3;for(const q of [[cx,y1,cz],p(a0,y1),p(a1,y1)]){m.P.push(...q);m.N.push(0,1,0);m.C.push(...col)}
  if(dot(cross(sub(p(a0,y1),[cx,y1,cz]),sub(p(a1,y1),[cx,y1,cz])),[0,1,0])>0)m.I.push(b,b+1,b+2);else m.I.push(b,b+2,b+1)}}
// a wall panel ep metres proud of a wall face: face 'pz'|'nz'|'px'|'nx' at the plane coordinate w; a..b along the wall (x for z faces, z for x faces), y0..y1
const FN={pz:[0,0,1],nz:[0,0,-1],px:[1,0,0],nx:[-1,0,0]};
function panel(face,w,a,b,y0,y1,nu,nv,colour,ep=.012){const n=FN[face],s=face[0]==='p'?1:-1,ww=w+s*ep;
 const o=face[1]==='z'?[a,y0,ww]:[ww,y0,a],U=face[1]==='z'?[b-a,0,0]:[0,0,b-a];grid(o,U,[0,y1-y0,0],nu,nv,n,colour)}
// a box standing proud of a wall face by d: a..b along the wall, y0..y1 (the face against the wall is left out)
function proud(face,w,a,b,y0,y1,d,col,under=false){const s=face[0]==='p'?1:-1,w1=w+s*d,lo=Math.min(w,w1),hi=Math.max(w,w1);
 if(face[1]==='z')box(a,b,y0,y1,lo,hi,col,s>0?'nz':'pz',under);else box(lo,hi,y0,y1,a,b,col,s>0?'nx':'px',under)}
// a flat-faced prism on a wall: a convex 2D polygon [[u,v]...] (u along the wall, v up) extruded d proud of the wall; front face + sides, no back
function prism(face,w,poly,d,rgb){const n=FN[face],s=face[0]==='p'?1:-1,P=(u,v,e)=>face[1]==='z'?[u,v,w+s*e]:[w+s*e,v,u];
 const f=poly.map(([u,v])=>P(u,v,d)),b=m.P.length/3,col=rgb.map(lin);
 for(let k=1;k+1<f.length;k++){const tri=[f[0],f[k],f[k+1]],ok=dot(cross(sub(tri[1],tri[0]),sub(tri[2],tri[0])),n)>0,base=m.P.length/3;for(const q of tri){m.P.push(...q);m.N.push(...n);m.C.push(...col)}m[into].push(base,ok?base+1:base+2,ok?base+2:base+1)}
 const cu=poly.reduce((a,p)=>a+p[0],0)/poly.length,cv=poly.reduce((a,p)=>a+p[1],0)/poly.length;
 for(let k=0;k<poly.length;k++){const [u0,v0]=poly[k],[u1,v1]=poly[(k+1)%poly.length];let du=v1-v0,dv=-(u1-u0);if(du*((u0+u1)/2-cu)+dv*((v0+v1)/2-cv)<0){du=-du;dv=-dv}const l=Math.hypot(du,dv);
  const nn=face[1]==='z'?[du/l,dv/l,0]:[0,dv/l,du/l];quad(P(u0,v0,0),P(u1,v1,0),P(u1,v1,d),P(u0,v0,d),nn,tone(rgb,.82+.12*Math.max(0,dv/l)))}}
const rect=(u0,v0,u1,v1)=>[[u0,v0],[u1,v0],[u1,v1],[u0,v1]];
const ribs=seed=>(i,j)=>tone(C.clad,(i%2?.9:1)*(.97+hash(seed,i,j)*.05)); // ribbed cladding: light and shadow strips 0.4 m wide
const nCols=len=>Math.max(1,Math.round(len/.4));
// staggered brick courses: rows of bricks bw long, every other row shifted half a brick; one quad per brick
function brickWall(face,w,a,b,y0,y1,rows,bw,seed,ep=.012){const n=FN[face],s=face[0]==='p'?1:-1,ww=w+s*ep,rh=(y1-y0)/rows;
 for(let j=0;j<rows;j++){let x=a-(j%2)*bw/2,k=0;while(x<b-1e-6){const u0=Math.max(a,x),u1=Math.min(b,x+bw);if(u1-u0>.02){const rgb=tone(C.bricks[Math.floor(hash(seed,k,j)*C.bricks.length)],.92+hash(seed,k,j,3)*.12),v0=y0+j*rh+.012,v1=y0+(j+1)*rh;
   const P=(u,v)=>face[1]==='z'?[u,v,ww]:[ww,v,u];quad(P(u0+.01,v0),P(u1-.01,v0),P(u1-.01,v1),P(u0+.01,v1),n,rgb)}x+=bw;k++}}
 panel(face,w,a,b,y0,y1,1,1,()=>tone(C.render,.72),ep*.5)} // the mortar behind the bricks
// a window on a wall: slate frame, two panes (a lighter reflection at the top), a light sill
function windowOn(face,w,a,b,y0,y1,seed){panel(face,w,a,b,y0,y1,1,1,()=>C.frame,.03);panel(face,w,a+.07,b-.07,y0+.07,y1-.07,2,2,(i,j)=>tone(j?C.glassHi:C.glass,.92+hash(seed,i,j)*.14),.04);
 proud(face,w,a-.06,b+.06,y0-.07,y0,.09,C.coping)}
// a batten (panel seam) proud of the wall: 7 cm wide, at a along the wall
const batten=(face,w,a,y0,y1)=>proud(face,w,a-.035,a+.035,y0,y1,.04,tone(C.clad,.8));
const lampHead=(x,y,z)=>LAMPS.find(l=>Math.abs(l.x-x)<1e-6&&Math.abs(l.y-y)<1e-6&&Math.abs(l.z-z)<1e-6);

// ================= THE HALL: x -6..6, z -4.5..1.2, roof at 5.6 =================
const HX0=-6,HX1=6,HZ0=-4.5,HZ1=1.2,HY=5.6,AX1=1.4,AZ1=3.8,AY=4.2,DY=.15,PB=.9; // PB: the plinth top
box(HX0,HX1,0,HY,HZ0,HZ1,{side:C.clad,py:C.roof});
// plinth (a concrete base course, 5 cm proud) with a light drip ledge on top: back, west and east sides of the hall
proud('nz',HZ0,HX0-.05,HX1+.05,0,PB,.05,C.plinth);proud('nx',HX0,HZ0,HZ1,0,PB,.05,C.plinth);proud('px',HX1,HZ0,HZ1,0,PB,.05,C.plinth);
proud('nz',HZ0,HX0-.08,HX1+.08,PB,PB+.05,.08,C.coping);proud('nx',HX0,HZ0-.08,HZ1,PB,PB+.05,.08,C.coping);proud('px',HX1,HZ0-.08,HZ1,PB,PB+.05,.08,C.coping);
panel('pz',HZ1,AX1,HX1,DY,PB,1,1,()=>C.plinth);
// ribbed cladding above the plinth on every face of the hall
panel('nz',HZ0,HX0,HX1,PB,HY,nCols(12),1,ribs(1));panel('nx',HX0,HZ0,HZ1,PB,HY,nCols(5.7),1,ribs(3));panel('px',HX1,HZ0,HZ1,PB,HY,nCols(5.7),1,ribs(5));
panel('pz',HZ1,HX0,AX1,AY,HY,nCols(7.4),1,ribs(7));panel('pz',HZ1,AX1,HX1,PB,HY,nCols(4.6),1,ribs(9));
// slate corner trims, plinth to roof
for(const [x,z,y0] of [[HX0,HZ0,0],[HX1,HZ0,0],[HX0,HZ1,AY],[HX1,HZ1,DY]])box(x-.08,x+.08,y0,HY,z-.08,z+.08,C.trim);
// the Eden stripe round the hall: a broad green band and a thin leaf-green line under it, proud of the ribs
const SY0=4.78,SY1=4.98,TY0=4.6,TY1=4.66;
for(const [face,w,a,b] of [['nz',HZ0,HX0+.08,HX1-.08],['nx',HX0,HZ0+.08,HZ1-.08],['px',HX1,HZ0+.08,HZ1-.08],['pz',HZ1,HX0+.08,HX1-.08]]){proud(face,w,a,b,SY0,SY1,.035,C.green,true);proud(face,w,a,b,TY0,TY1,.025,C.leaf,true)}
// parapet: a slate band (the roof edge seen from the street) and a light coping that overhangs it
const PT=.2,PY=6.0;
box(HX0,HX1,HY,PY,HZ0,HZ0+PT,{side:C.trim,pz:C.clad});box(HX0,HX1,HY,PY,HZ1-PT,HZ1,{side:C.trim,nz:C.clad});box(HX0,HX0+PT,HY,PY,HZ0+PT,HZ1-PT,{side:C.trim,px:C.clad},'pznz');box(HX1-PT,HX1,HY,PY,HZ0+PT,HZ1-PT,{side:C.trim,nx:C.clad},'pznz');
box(HX0-.1,HX1+.1,PY,PY+.08,HZ0-.1,HZ0+PT+.03,C.coping,'',true);box(HX0-.1,HX1+.1,PY,PY+.08,HZ1-PT-.03,HZ1+.1,C.coping,'',true);
box(HX0-.1,HX0+PT+.03,PY,PY+.08,HZ0+PT+.03,HZ1-PT-.03,C.coping,'pznz',true);box(HX1-PT-.03,HX1+.1,PY,PY+.08,HZ0+PT+.03,HZ1-PT-.03,C.coping,'pznz',true);
// roof: two box vents with caps, a round extractor, an air-conditioning unit with a fan on top, two rooflights, the hatch at the top of the ladder
for(const [x,z,s] of [[-1.6,-3.2,1],[2.4,-3.2,2]]){box(x-.35,x+.35,HY,HY+.42,z-.35,z+.35,C.metal);box(x-.45,x+.45,HY+.42,HY+.5,z-.45,z+.45,tone(C.metal,.85+s*.04))}
cyl(-.2,-1.6,.28,HY,HY+.55,10,C.metal,tone(C.metal,.7));
box(1.6,3.2,HY,HY+.7,-.8,.3,{side:tone(C.coping,.95),py:tone(C.coping,1.02)});panel('pz',.3,1.75,3.05,HY+.1,HY+.6,6,1,(i)=>tone(C.frame,i%2?1.4:1),.006);
grid([2.05,HY+.706,-.6],[.7,0,0],[0,0,.7],1,1,[0,1,0],()=>C.frame);
for(const x of [-4.6,-2.6]){box(x-.6,x+.6,HY,HY+.12,-1.9,-.5,C.trim);box(x-.52,x+.52,HY+.12,HY+.26,-1.82,-.58,{side:tone(C.glassHi,.9),py:C.glassHi})}
box(-4.65,-4.05,HY,HY+.18,-4.15,-3.55,{side:C.trim,py:tone(C.metal,.85)});

// ---- WEST wall (x -6, faces Barber's Walk on site 1): the staff door with a drip hood and a wall lamp, three windows, seams, the Eden mark
const sdz0=SIDE_DOOR.z-SIDE_DOOR.width/2,sdz1=SIDE_DOOR.z+SIDE_DOOR.width/2;
panel('nx',HX0,sdz0-.08,sdz1+.08,0,SIDE_DOOR.height+.08,1,1,()=>C.frame,.03);panel('nx',HX0,sdz0,sdz1,0,SIDE_DOOR.height,1,1,()=>C.door,.045);
panel('nx',HX0,sdz0+.1,sdz1-.1,.05,.3,1,1,()=>C.metal,.05);panel('nx',HX0,sdz1-.2,sdz1-.1,1.0,1.1,1,1,()=>C.metal,.07); // kick plate, handle
proud('nx',HX0,sdz0-.15,sdz1+.15,SIDE_DOOR.height+.12,SIDE_DOOR.height+.2,.14,C.trim,true); // a drip hood over the door
box(-6,-6+.04,0,.12,sdz0-.1,sdz1+.1,C.concrete); // the step line at the door
windowOn('nx',HX0,-2.3,-1.0,1.3,2.45,1);windowOn('nx',HX0,-.4,.9,1.3,2.45,2);
batten('nx',HX0,-2.65,PB+.05,HY);batten('nx',HX0,-.7,PB+.05,HY);
proud('nx',HX0,HZ0+.08,HZ1-.08,3.05,3.1,.03,tone(C.clad,.8)); // a horizontal panel joint
// the Eden mark high on the wall: a cream tile with a green leaf (a diamond and a stem)
const markW=(face,w,cu,cv,s)=>{prism(face,w,rect(cu-.32*s,cv-.32*s,cu+.32*s,cv+.32*s),.03,C.letters);prism(face,w,[[cu,cv+.24*s],[cu+.15*s,cv+.02*s],[cu,cv-.18*s],[cu-.15*s,cv+.02*s]],.05,C.green);prism(face,w,rect(cu-.025*s,cv-.26*s,cu+.025*s,cv-.12*s),.05,C.green)};
markW('nx',HX0,-1.65,3.85,1.1);

// ---- BACK wall (z -4.5): three high clerestory windows, a louvre, a fire exit with its sign and a wall lamp, a cat ladder to the roof, downpipes with rain heads, seams
for(const x of [-2.4,0,2.4])windowOn('nz',HZ0,x-.55,x+.55,3.95,4.45,10+x);
for(const x of [-3.6,-1.2,1.2])batten('nz',HZ0,x,PB+.05,HY);batten('nz',HZ0,3.6,3.15,HY);
proud('nz',HZ0,HX0+.08,HX1-.08,3.05,3.1,.03,tone(C.clad,.8));
panel('nz',HZ0,-.9,-.1,1.55,2.25,1,1,()=>C.frame,.03);panel('nz',HZ0,-.84,-.16,1.61,2.19,1,6,(i,j)=>tone(C.metal,j%2?.62:1),.05); // the louvre
panel('nz',HZ0,2.8,4.0,0,2.25,1,1,()=>C.frame,.03);panel('nz',HZ0,2.88,3.92,0,2.17,1,1,()=>tone(C.door,.85),.045);panel('nz',HZ0,2.98,3.82,1.0,1.06,1,1,()=>C.metal,.07);
proud('nz',HZ0,3.08,3.72,2.36,2.6,.04,C.exit);
// cat ladder: two rails 12 cm off the wall, rungs every 0.3 m, brackets; it reaches over the coping
const LX0=-4.6,LX1=-4.1,LZ=HZ0-.12;
for(const x of [LX0,LX1])box(x-.025,x+.025,.25,6.25,LZ-.025,LZ+.025,C.metal,'',true);
for(let y=.5;y<6.2;y+=.3)box(LX0,LX1,y,y+.035,LZ-.02,LZ+.02,C.metal,'nxpxnz');
for(const y of [.6,3.0,5.4])box(LX0-.03,LX1+.03,y,y+.05,LZ+.025,HZ0,tone(C.metal,.8),'pz');
// downpipes inside the back corners, with rain heads under the parapet and shoes at the foot
for(const x of [HX0+.32,HX1-.32]){box(x-.06,x+.06,.05,5.25,HZ0-.14,HZ0-.02,C.trim);box(x-.14,x+.14,5.25,5.55,HZ0-.14,HZ0,C.trim,'pz');box(x-.09,x+.09,0,.12,HZ0-.13,HZ0-.02,C.trim)}

// ---- EAST wall (x 6): the high window strip, seams around it
panel('px',HX1,-3.6,.4,3.55,4.25,1,1,()=>C.frame,.03);panel('px',HX1,-3.5,.3,3.62,4.18,4,1,(i)=>tone(i%2?C.glass:C.glassHi,.9+hash(i,6)*.15),.04);
for(const z of [-2.6,-.7]){batten('px',HX1,z,PB+.05,3.5);batten('px',HX1,z,4.3,HY)}
proud('px',HX1,HZ0+.08,HZ1-.08,3.05,3.1,.03,tone(C.clad,.8));

// ================= THE SHOP FRONT: x -6..1.4, z 1.2..3.8, 4.2 high; brick base, render above, door, two windows, the green sign board with the words =================
box(HX0,AX1,0,AY,HZ1,AZ1,{side:C.render,py:C.roof},'nz');
box(HX0-.04,AX1+.04,AY,AY+.1,AZ1-.22,AZ1+.06,C.coping,'',true);box(HX0-.04,HX0+.2,AY,AY+.1,HZ1,AZ1-.22,C.coping,'pznz',true);box(AX1-.2,AX1+.04,AY,AY+.1,HZ1,AZ1-.22,C.coping,'pznz',true);
const BR=.95;
brickWall('pz',AZ1,HX0,AX1,0,BR,5,.5,11);brickWall('nx',HX0,HZ1,AZ1,0,BR,5,.5,12);brickWall('px',AX1,HZ1,AZ1,DY,BR,4,.5,13);
box(HX0-.03,AX1+.03,BR,BR+.06,AZ1-.02,AZ1+.05,C.coping,'',true);box(HX0-.05,HX0+.02,BR,BR+.06,HZ1,AZ1-.02,C.coping,'pznz',true);box(AX1-.02,AX1+.05,BR,BR+.06,HZ1,AZ1-.02,C.coping,'pznz',true); // a stone course on the bricks
windowOn('nx',HX0,1.85,3.3,1.3,2.5,3); // the third west window, in the shop front
for(const [x0,x1] of [[-5.5,-3.6],[-1.0,.9]]){panel('pz',AZ1,x0,x1,BR+.06,2.6,1,1,()=>C.frame,.035);
 panel('pz',AZ1,x0+.07,x1-.07,BR+.13,2.53,2,3,(i,j)=>tone(j===2?C.glassHi:C.glass,.92+hash(x0,i,j)*.14),.05)}
// the double shop door, centred on DOOR.x, under a small slate awning with a green edge
const dx0=DOOR.x-DOOR.width/2,dx1=DOOR.x+DOOR.width/2;
panel('pz',AZ1,dx0-.1,dx1+.1,0,DOOR.height+.1,1,1,()=>C.frame,.035);
panel('pz',AZ1,dx0+.05,DOOR.x-.03,.08,DOOR.height-.05,1,3,(i,j)=>tone(j===2?C.glassHi:C.glass,.95+j*.03),.05);panel('pz',AZ1,DOOR.x+.03,dx1-.05,.08,DOOR.height-.05,1,3,(i,j)=>tone(j===2?C.glassHi:C.glass,.97+j*.03),.05);
panel('pz',AZ1,dx0+.15,dx1-.15,1.0,1.06,1,1,()=>C.metal,.065);
box(DOOR.x-1.2,DOOR.x+1.2,2.55,2.67,AZ1,AZ1+.65,{side:C.trim,pz:C.green,py:tone(C.trim,1.15)},'',true);
// the sign: a slate frame, the green board, the Eden mark at its left end, the words in a block font
const BX0=SIGN.x-SIGN.width/2,BX1=SIGN.x+SIGN.width/2,BY0=SIGN.y-SIGN.height/2,BY1=SIGN.y+SIGN.height/2;
box(BX0-.12,BX1+.12,BY0-.1,BY1+.1,AZ1,AZ1+.1,C.trim,'nz',true);box(BX0,BX1,BY0,BY1,AZ1+.1,SIGN.z,C.board,'nz');
markW('pz',SIGN.z,BX0+.42,SIGN.y,1);
// block font on a 4 x 6 grid, stroke 1: rectangles [u0,v0,u1,v1] or polygons {p:[[u,v]...]} (convex)
const FONT={E:[[0,0,1,6],[1,5,4,6],[1,2.5,3.3,3.5],[1,0,4,1]],D:[[0,0,1,6],[1,5,3,6],[1,0,3,1],[3,1,4,5]],N:[[0,0,1,6],[3,0,4,6],{p:[[1,6],[1,4.3],[3,0],[3,1.7]]}],
 W:[[0,0,1,6],[3,0,4,6],[1.5,1,2.5,3.6],[1,0,3,1]],H:[[0,0,1,6],[3,0,4,6],[1,2.5,3,3.5]],O:[[0,1,1,5],[3,1,4,5],[.5,0,3.5,1],[.5,5,3.5,6]],L:[[0,0,1,6],[1,0,4,1]],
 S:[[.6,5,4,6],[0,3.2,1,5.4],[.6,2.5,3.4,3.5],[3,.6,4,2.8],[0,0,3.4,1]],A:[[0,0,1,5.4],[3,0,4,5.4],[.6,5,3.4,6],[1,2.2,3,3.2]]};
const GAP=1,SPACE=2.4,TX0=BX0+.82,TX1=BX1-.14,units=[...SIGN.text].reduce((s,ch,i)=>s+(ch===' '?SPACE:4+(i>0&&SIGN.text[i-1]!==' '?GAP:0)),0);
const U=Math.min((TX1-TX0)/units,SIGN.height*.56/6),LH=6*U,startX=(TX0+TX1)/2-units*U/2,startY=SIGN.y-LH/2;
{let x=startX;[...SIGN.text].forEach((ch,i)=>{if(ch===' '){x+=SPACE*U;return}if(i>0&&SIGN.text[i-1]!==' ')x+=GAP*U;
 for(const s of FONT[ch]){const poly=Array.isArray(s)?rect(...s):s.p;prism('pz',SIGN.z,poly.map(([u,v])=>[x+u*U,startY+v*U]),.045,C.letters)}x+=4*U})}
// three gooseneck lamps over the board: a stem on the coping, an arm reaching out, a green shade; the lens (the shade's underside) glows
for(const l of LAMPS.filter(l=>l.kind==='gooseneck')){const x=l.x;box(x-.025,x+.025,AY+.1,AY+.36,AZ1-.14,AZ1-.09,C.trim);box(x-.025,x+.025,AY+.31,AY+.36,AZ1-.14,l.z,C.trim,'',true);
 box(x-.13,x+.13,l.y+.02,l.y+.16,l.z-.11,l.z+.11,C.green,'',false);glowing(true);quad([x-.11,l.y+.02,l.z-.09],[x+.11,l.y+.02,l.z-.09],[x+.11,l.y+.02,l.z+.09],[x-.11,l.y+.02,l.z+.09],[0,-1,0],C.lens);glowing(false)}

// ================= THE LOADING DOCK: x 1.4..6, z 1.2..4.5, a flush 0.15 m apron under a canopy, the roller shutter =================
box(AX1,HX1,0,DY,HZ1,4.5,{side:tone(C.concrete,.9),py:C.concrete});
grid([AX1+.1,DY+.004,4.3],[HX1-AX1-.2,0,0],[0,0,.14],8,1,[0,1,0],(i)=>i%2?C.frame:C.yellow); // a yellow and black safety edge
box(AX1,HX1+.02,3.95,4.12,HZ1,4.5,{side:C.trim,py:C.roof,ny:tone(C.coping,.9)},'',true);box(AX1,HX1+.02,3.86,4.2,4.36,4.488,C.green,'nz',true); // the canopy (light soffit) and its green fascia
proud('pz',4.488,AX1,HX1+.02,3.9,3.94,.012,C.leaf); // a leaf-green line along the bottom of the fascia (its face ends on the front line z 4.5)
for(const x of [1.5,5.78]){box(x,x+.14,DY,.95,4.2,4.34,C.yellow);box(x,x+.14,.95,3.95,4.2,4.34,C.trim)}
// the roller shutter: guides, a housing at the top, slats
box(2.45,2.6,DY,3.6,HZ1,HZ1+.08,C.metal);box(5.6,5.75,DY,3.6,HZ1,HZ1+.08,C.metal);box(2.4,5.8,3.55,3.88,HZ1,HZ1+.3,{side:tone(C.metal,.9),py:tone(C.metal,.8)},'',true);
panel('pz',HZ1,2.6,5.6,DY,3.55,1,18,(i,j)=>j===0?tone(C.shutter,.6):tone(C.shutter,j%2?.9:1),.03);
// canopy lights: flat bulkheads under the canopy, lens on the underside
for(const l of LAMPS.filter(l=>l.kind==='canopy')){box(l.x-.2,l.x+.2,l.y+.02,3.95,l.z-.1,l.z+.1,C.trim,'',false);glowing(true);quad([l.x-.18,l.y+.02,l.z-.08],[l.x+.18,l.y+.02,l.z-.08],[l.x+.18,l.y+.02,l.z+.08],[l.x-.18,l.y+.02,l.z+.08],[0,-1,0],C.lens);glowing(false)}
// wall lamps (bulkheads) over the staff door and the fire exit: a slate body, the lens on its face
for(const l of LAMPS.filter(l=>l.kind==='bulkhead')){const [face,w]=l.aim[0]<0?['nx',HX0]:['nz',HZ0],a=l.aim[0]<0?l.z:l.x;proud(face,w,a-.13,a+.13,l.y-.1,l.y+.1,.13,C.trim,true);
 glowing(true);panel(face,w,a-.1,a+.1,l.y-.07,l.y+.07,1,1,()=>C.lens,.135);glowing(false)}

// ---- dressing on the dock: a pallet rack against the shop-front wall with sacks, crates, empty pallets; a wheelie bin beside the dock
function pallet(cx,y,cz,seed){ // a half pallet 0.76 (x) by 0.92 (z) by 0.12: three runners, a deck with board gaps on top
 for(let k=0;k<3;k++)box(cx-.38+k*.33,cx-.28+k*.33,y,y+.1,cz-.46,cz+.46,tone(C.runner,.92+hash(seed,k)*.12),'py');
 box(cx-.38,cx+.38,y+.1,y+.12,cz-.46,cz+.46,{side:C.wood,py:tone(C.runner,.7)},'',true);grid([cx-.38,y+.121,cz-.46],[.76,0,0],[0,0,.92],1,5,[0,1,0],(i,j)=>tone(C.wood,.94+hash(seed,j,1)*.12))}
function sack(cx,y,cz,good,seed){ // a sack lying, long side along x (0.66 x 0.19 x 0.44): body and a softer top; coffee gets its green stripe
 const c=good==='flour'?C.flour:C.coffee,k=.93+hash(seed,1)*.1,j=(hash(seed,2)-.5)*.04;
 box(cx-.31+j,cx+.31+j,y,y+.13,cz-.22,cz+.22,tone(c,k));box(cx-.27+j,cx+.27+j,y+.13,y+.19,cz-.18,cz+.18,tone(c,k*1.04));
 if(good!=='flour')box(cx-.12+j,cx-.04+j,y+.002,y+.192,cz-.222,cz+.222,C.stripe,'nxpx')}
const RX0=1.48,RX1=2.38,RZ0=1.32,RZ1=3.44,BEAM=1.4,TOPB=2.38;
for(const x of [RX0,RX1-.07])for(const z of [RZ0,RZ1-.07])box(x,x+.07,DY,2.5,z,z+.07,C.rackBlue);
for(const y of [BEAM,TOPB])for(const x of [RX0,RX1-.06])box(x,x+.06,y,y+.1,RZ0+.07,RZ1-.07,C.rackOrange,'',true);
for(const [cz,good] of [[1.88,'flour'],[2.9,'coffee-beans']]){pallet(1.93,DY,cz,cz*10);for(let l=0;l<2;l++)for(let r=0;r<2;r++)sack(1.93,DY+.12+l*.19,cz+(r-.5)*.45,good,cz*100+l*2+r)}
pallet(1.93,BEAM+.1,1.88,77);for(let r=0;r<2;r++)sack(1.93,BEAM+.22,1.88+(r-.5)*.45,'flour',700+r);
pallet(1.93,BEAM+.1,2.9,78);for(let r=0;r<2;r++)sack(1.93,BEAM+.22,2.9+(r-.5)*.45,'coffee-beans',800+r);
for(let l=0;l<3;l++)pallet(5.45,DY+l*.12,3.1,50+l);
const crate=(x0,x1,y0,y1,z0,z1,seed)=>{const c=tone(C.crate,.92+hash(seed)*.12);box(x0,x1,y0,y1,z0,z1,{side:c,py:tone(c,1.06)});proud('pz',z1,x0+.02,x1-.02,y0+(y1-y0)*.42,y0+(y1-y0)*.58,.012,tone(c,.75))};
crate(4.7,5.18,DY,DY+.42,3.6,4.16,1);crate(5.22,5.7,DY,DY+.42,3.6,4.16,2);crate(4.9,5.42,DY+.42,DY+.82,3.62,4.12,3);
box(.8,1.38,0,1.0,3.84,4.4,{side:C.bin,py:tone(C.bin,1.1)});box(.77,1.41,1.0,1.08,3.8,4.44,C.green,'',true);proud('pz',4.4,.86,1.32,.7,.76,.01,C.leaf); // the wheelie bin

// ================= GLB =================
const MATERIAL={name:'eden-wholesale-vertex-colour',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.95},doubleSided:true};
function bounds(P){const lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(let k=0;k<P.length;k++){lo[k%3]=Math.min(lo[k%3],P[k]);hi[k%3]=Math.max(hi[k%3],P[k])}return {lo,hi}}
function glb(){
 const all=[...m.I,...m.G],glow={from:m.I.length,count:m.G.length,color:C.lens,strength:2};
 const r=(a,d)=>Float32Array.from(a,v=>Math.round(v*d)/d),P=r(m.P,1e5),N=r(m.N,1e4),n=P.length/3,Cb=new Uint8Array(n*4),I=n<65536?Uint16Array.from(all):Uint32Array.from(all);
 for(let k=0;k<n;k++){for(let c=0;c<3;c++)Cb[k*4+c]=Math.round(Math.max(0,Math.min(1,m.C[k*3+c]))*255);Cb[k*4+3]=255}
 const {lo,hi}=bounds(P),arrays=[P,N,Cb,I];
 const pad=b=>Buffer.concat([b,Buffer.alloc((4-b.length%4)%4)]),parts=arrays.map(a=>pad(Buffer.from(a.buffer,a.byteOffset,a.byteLength)));
 let off=0;const views=parts.map((b,i)=>{const v={buffer:0,byteOffset:off,byteLength:arrays[i].byteLength,target:i<3?34962:34963};off+=b.length;return v});
 const empties=[...Object.entries(ANCHORS).map(([name,t])=>({name,translation:t})),{name:SIGN.node,translation:[SIGN.x,SIGN.y,SIGN.z],extras:{text:SIGN.text,width:SIGN.width,height:SIGN.height,normal:[0,0,1],baked:true,letterHeight:+LH.toFixed(3)}}];
 const nodes=[{name:NAME,mesh:0},...empties];
 const json={asset:{version:'2.0',generator:'scripts/build-eden-wholesale.mjs'},scene:0,scenes:[{nodes:nodes.map((_,i)=>i)}],nodes,meshes:[{name:NAME,primitives:[{attributes:{POSITION:0,NORMAL:1,COLOR_0:2},indices:3,material:0,mode:4}],extras:{glow}}],materials:[MATERIAL],
  accessors:[{bufferView:0,componentType:5126,count:n,type:'VEC3',min:lo,max:hi},{bufferView:1,componentType:5126,count:n,type:'VEC3'},{bufferView:2,componentType:5121,normalized:true,count:n,type:'VEC4'},{bufferView:3,componentType:I.BYTES_PER_ELEMENT===2?5123:5125,count:I.length,type:'SCALAR'}],
  bufferViews:views,buffers:[{byteLength:off}]};
 let js=Buffer.from(JSON.stringify(json));js=Buffer.concat([js,Buffer.alloc((4-js.length%4)%4,0x20)]);const bin=Buffer.concat(parts);
 const hd=Buffer.alloc(12);hd.writeUInt32LE(0x46546C67,0);hd.writeUInt32LE(2,4);hd.writeUInt32LE(12+8+js.length+8+bin.length,8);
 const c1=Buffer.alloc(8);c1.writeUInt32LE(js.length,0);c1.writeUInt32LE(0x4E4F534A,4);const c2=Buffer.alloc(8);c2.writeUInt32LE(bin.length,0);c2.writeUInt32LE(0x004E4942,4);
 return {bytes:Buffer.concat([hd,c1,js,c2,bin]),triangles:I.length/3,vertices:n,lo,hi,glow};
}
mkdirSync(OUT,{recursive:true});
const g=glb();writeFileSync(`${OUT}/${NAME}.glb`,g.bytes);
console.log(`${OUT}/${NAME}.glb: ${g.triangles} triangles (${g.glow.count/3} lens), ${g.vertices} vertices, x ${g.lo[0].toFixed(2)}..${g.hi[0].toFixed(2)} y ${g.lo[1].toFixed(2)}..${g.hi[1].toFixed(2)} z ${g.lo[2].toFixed(2)}..${g.hi[2].toFixed(2)} m, ${g.bytes.length} bytes; sign letters ${LH.toFixed(3)} m high, ${(units*U).toFixed(2)} m wide`);
