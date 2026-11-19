// The tags above warehouse pallets (DESIGN 4.16 I: "every pallet shows what it holds"): a small plate with the product's icon and the count, e.g. a stack of boards and "40".
// ONE InstancedMesh and one 512 x 160 atlas (40 plates for 1..40 planks, 8 across), so any number of pallets costs one draw call. Only the nearest MAX tags within RANGE metres of the
// player are drawn, turned to face the camera. `update(list, camera, near)` is called every frame the warehouse is shown; `list` is [{x, y, z, count, product}] in room metres.
import * as T from './vendor/three.module.js';
import {PALLET_CAP} from './pallets.js';

export const TAG_MAX=24,TAG_RANGE=10,TAG_SIZE={w:.8,h:.4};
const COLS=8,PLAIN_ROWS=5,ROWS=12,CELL={w:64,h:32}; // 512 wide: rows 0..4 the 40 stock plates, rows 5..9 the 40 order plates (green edge), rows 10 and 11 the 11 glyphs of an order's number
export const GLYPHS='#0123456789',ORDER_COLOUR='#4fd16a',GLYPH_SCALE={x:1.1,y:.55,advance:.3}
const makeCanvas=()=>document.createElement('canvas');

// plate `n` (1..PALLET_CAP) of the planks atlas: a dark plate with a honey edge, a stack of planks seen from the end on the left (three boards, each with its end grain and a light top edge)
// and the number on the right in white with a dark outline so it reads against any background
function drawAtlas(canvas){
 canvas.width=COLS*CELL.w;canvas.height=ROWS*CELL.h;const g=canvas.getContext('2d');if(!g)return false;
 g.clearRect(0,0,canvas.width,canvas.height);
 for(let k=0;k<PALLET_CAP*2;k++){
  const n=k%PALLET_CAP+1,order=k>=PALLET_CAP,i=n-1,x=(i%COLS)*CELL.w,y=(Math.floor(i/COLS)+(order?PLAIN_ROWS:0))*CELL.h;
  g.fillStyle='rgba(21,19,14,.92)';g.fillRect(x+1,y+1,CELL.w-2,CELL.h-2);g.strokeStyle=order?ORDER_COLOUR:'#f5c518';g.lineWidth=2;g.strokeRect(x+2,y+2,CELL.w-4,CELL.h-4);
  // the plank icon: three boards stacked, each a light face over a darker end with a ring of grain
  for(let b=0;b<3;b++){const by=y+6+b*7,tone=['#e0b878','#d3ab6e','#c29a5c'][b];
   g.fillStyle='#3a2a18';g.fillRect(x+5,by,25,7);g.fillStyle=tone;g.fillRect(x+6,by+1,23,4);g.fillStyle='rgba(255,255,255,.35)';g.fillRect(x+6,by+1,23,1);
   g.fillStyle='#8a6a40';g.fillRect(x+26,by+1,3,5);g.strokeStyle='#5c4426';g.lineWidth=1;g.beginPath();g.arc(x+27.5,by+3.5,1.1,0,6.3);g.stroke()}
  g.font='bold 22px Arial, Helvetica, sans-serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=3;g.strokeStyle='#15130e';g.strokeText(String(n),x+47,y+17);g.fillStyle='#fff7da';g.fillText(String(n),x+47,y+17);
 }
 // the glyphs of an order's number: big white characters with a green outline, one per cell (the plate's number sits above the stock count)
 g.font='bold 22px Arial, Helvetica, sans-serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=4;g.lineJoin='round';
 [...GLYPHS].forEach((ch,i)=>{const x=(i%COLS)*CELL.w+CELL.w/2,y=(Math.floor(i/COLS)+PLAIN_ROWS*2)*CELL.h+CELL.h/2+1;g.strokeStyle='#15350f';g.strokeText(ch,x,y);g.fillStyle='#e8ffe0';g.fillText(ch,x,y)});
 return true;
}
// row counted from the bottom (texture space). order: the green plate for an order's pallet
export const tagCell=(count,order=false)=>{const i=Math.max(1,Math.min(PALLET_CAP,count))-1;return {col:i%COLS,row:ROWS-1-Math.floor(i/COLS)-(order?PLAIN_ROWS:0)}};
export const glyphCell=ch=>{const i=GLYPHS.indexOf(ch);if(i<0)return null;return {col:i%COLS,row:ROWS-1-Math.floor(i/COLS)-PLAIN_ROWS*2}};

export function createPalletTags({max=TAG_MAX,range=TAG_RANGE,makeCanvasFn=makeCanvas}={}){
 const canvas=makeCanvasFn(),drawn=drawAtlas(canvas),texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.minFilter=T.LinearFilter;texture.generateMipmaps=false;
 const geometry=new T.PlaneGeometry(TAG_SIZE.w,TAG_SIZE.h),cells=new Float32Array(max*6*2),attr=new T.InstancedBufferAttribute(cells,2);geometry.setAttribute('tagCell',attr);
 const material=new T.MeshBasicMaterial({map:texture,transparent:true,toneMapped:false,fog:false});
 // each instance reads its own plate of the atlas
 material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 tagCell;').replace('#include <uv_vertex>','#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv=(uv+tagCell)*vec2(1.0/'+COLS+'.0,1.0/'+ROWS+'.0);\n#endif')};
 const mesh=new T.InstancedMesh(geometry,material,max*6);mesh.name='pallet-tags';mesh.count=0;mesh.frustumCulled=false;mesh.renderOrder=5;mesh.castShadow=mesh.receiveShadow=false;
 const m4=new T.Matrix4(),pos=new T.Vector3(),one=new T.Vector3(1,1,1);let shown=[];
 // list: [{x,y,z,count,product}]; camera: the room's camera; near: {x, z} the player. Returns how many tags are drawn.
 function update(list,camera,near){
  const within=[];
  for(const p of list){const d=Math.hypot(p.x-near.x,p.z-near.z);if(d<=range)within.push({p,d})}
  within.sort((a,b)=>a.d-b.d);const n=Math.min(max,within.length);
  let used=n;const right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion),gs=new T.Vector3(GLYPH_SCALE.x,GLYPH_SCALE.y,1);
  for(let i=0;i<n;i++){const {p}=within[i],c=tagCell(p.count,!!p.order);pos.set(p.x,p.y,p.z);m4.compose(pos,camera.quaternion,one);mesh.setMatrixAt(i,m4);cells[i*2]=c.col;cells[i*2+1]=c.row
   if(p.order){ // '#12' above the plate: one glyph quad per character, centred, facing the camera
    const text='#'+String(p.order).slice(0,4),w=(text.length-1)*GLYPH_SCALE.advance;
    for(let k=0;k<text.length&&used<max*6;k++){const g=glyphCell(text[k]);if(!g)continue;const o=-w/2+k*GLYPH_SCALE.advance;pos.set(p.x+right.x*o,p.y+.4,p.z+right.z*o);m4.compose(pos,camera.quaternion,gs);mesh.setMatrixAt(used,m4);cells[used*2]=g.col;cells[used*2+1]=g.row;used++}
   }
  }
  mesh.count=used;mesh.instanceMatrix.needsUpdate=true;attr.needsUpdate=true;shown=within.slice(0,n).map(({p})=>p);return n;
 }
 return {mesh,update,get shown(){return shown},drawn,max,range};
}
