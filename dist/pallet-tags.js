// The tags above warehouse pallets (DESIGN 4.16 I: "every pallet shows what it holds"): a small plate with the product's icon and the count, e.g. a stack of boards and "40".
// ONE InstancedMesh and one 512 x 160 atlas (40 plates for 1..40 planks, 8 across), so any number of pallets costs one draw call. Only the nearest MAX tags within RANGE metres of the
// player are drawn, turned to face the camera. `update(list, camera, near)` is called every frame the warehouse is shown; `list` is [{x, y, z, count, product}] in room metres.
import * as T from './vendor/three.module.js';
import {PALLET_CAP} from './pallets.js';

export const TAG_MAX=24,TAG_RANGE=10,TAG_SIZE={w:.8,h:.4};
const COLS=8,ROWS=5,CELL={w:64,h:32}; // 40 plates, 64 x 32 px each: 512 x 160
const makeCanvas=()=>document.createElement('canvas');

// plate `n` (1..PALLET_CAP) of the planks atlas: a dark plate with a honey edge, a stack of planks seen from the end on the left (three boards, each with its end grain and a light top edge)
// and the number on the right in white with a dark outline so it reads against any background
function drawAtlas(canvas){
 canvas.width=COLS*CELL.w;canvas.height=ROWS*CELL.h;const g=canvas.getContext('2d');if(!g)return false;
 g.clearRect(0,0,canvas.width,canvas.height);
 for(let n=1;n<=PALLET_CAP;n++){
  const i=n-1,x=(i%COLS)*CELL.w,y=Math.floor(i/COLS)*CELL.h;
  g.fillStyle='rgba(21,19,14,.92)';g.fillRect(x+1,y+1,CELL.w-2,CELL.h-2);g.strokeStyle='#f5c518';g.lineWidth=2;g.strokeRect(x+2,y+2,CELL.w-4,CELL.h-4);
  // the plank icon: three boards stacked, each a light face over a darker end with a ring of grain
  for(let b=0;b<3;b++){const by=y+6+b*7,tone=['#e0b878','#d3ab6e','#c29a5c'][b];
   g.fillStyle='#3a2a18';g.fillRect(x+5,by,25,7);g.fillStyle=tone;g.fillRect(x+6,by+1,23,4);g.fillStyle='rgba(255,255,255,.35)';g.fillRect(x+6,by+1,23,1);
   g.fillStyle='#8a6a40';g.fillRect(x+26,by+1,3,5);g.strokeStyle='#5c4426';g.lineWidth=1;g.beginPath();g.arc(x+27.5,by+3.5,1.1,0,6.3);g.stroke()}
  g.font='bold 22px Arial, Helvetica, sans-serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=3;g.strokeStyle='#15130e';g.strokeText(String(n),x+47,y+17);g.fillStyle='#fff7da';g.fillText(String(n),x+47,y+17);
 }
 return true;
}
export const tagCell=count=>{const i=Math.max(1,Math.min(PALLET_CAP,count))-1;return {col:i%COLS,row:ROWS-1-Math.floor(i/COLS)}}; // row counted from the bottom (texture space)

export function createPalletTags({max=TAG_MAX,range=TAG_RANGE,makeCanvasFn=makeCanvas}={}){
 const canvas=makeCanvasFn(),drawn=drawAtlas(canvas),texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.minFilter=T.LinearFilter;texture.generateMipmaps=false;
 const geometry=new T.PlaneGeometry(TAG_SIZE.w,TAG_SIZE.h),cells=new Float32Array(max*2),attr=new T.InstancedBufferAttribute(cells,2);geometry.setAttribute('tagCell',attr);
 const material=new T.MeshBasicMaterial({map:texture,transparent:true,toneMapped:false,fog:false});
 // each instance reads its own plate of the atlas
 material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 tagCell;').replace('#include <uv_vertex>','#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv=(uv+tagCell)*vec2(1.0/'+COLS+'.0,1.0/'+ROWS+'.0);\n#endif')};
 const mesh=new T.InstancedMesh(geometry,material,max);mesh.name='pallet-tags';mesh.count=0;mesh.frustumCulled=false;mesh.renderOrder=5;mesh.castShadow=mesh.receiveShadow=false;
 const m4=new T.Matrix4(),pos=new T.Vector3(),one=new T.Vector3(1,1,1);let shown=[];
 // list: [{x,y,z,count,product}]; camera: the room's camera; near: {x, z} the player. Returns how many tags are drawn.
 function update(list,camera,near){
  const within=[];
  for(const p of list){const d=Math.hypot(p.x-near.x,p.z-near.z);if(d<=range)within.push({p,d})}
  within.sort((a,b)=>a.d-b.d);const n=Math.min(max,within.length);
  for(let i=0;i<n;i++){const {p}=within[i],c=tagCell(p.count);pos.set(p.x,p.y,p.z);m4.compose(pos,camera.quaternion,one);mesh.setMatrixAt(i,m4);cells[i*2]=c.col;cells[i*2+1]=c.row}
  mesh.count=n;mesh.instanceMatrix.needsUpdate=true;attr.needsUpdate=true;shown=within.slice(0,n).map(({p})=>p);return n;
 }
 return {mesh,update,get shown(){return shown},drawn,max,range};
}
