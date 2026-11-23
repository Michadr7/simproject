// PET3 prep (pet3-prep.md): pure cat clip, wander, snapshot and spawn helpers.
import {DAY_MINUTES,EAT_MINUTES,PURR_MINUTES,SLEEP_FROM,SLEEP_TO,NAME_MAX,hungerOf} from './pets.js';

export const CLIP_IDS=Object.freeze(['idle','walk','eat','pet','sleep','Lie_Down','Get_Up','Sit','Sit_Groom','Stretch','Meow','Run']);
export const CLIP_LOOP=Object.freeze({idle:true,walk:true,eat:true,pet:true,sleep:true,Lie_Down:false,Get_Up:false,Sit:true,Sit_Groom:true,Stretch:false,Meow:false,Run:true});
export const VARIETY_CLIPS=Object.freeze(['idle','Sit','Sit_Groom','Stretch']);
export const VARIETY_MINUTES=3;
export const DEFAULT_BLEND=0.25;
export const BLEND_TIMES=Object.freeze({
 idle:Object.freeze({walk:0.15,Run:0.15,Sit:0.25,Sit_Groom:0.25,Stretch:0.2,Meow:0.15,eat:0.2,pet:0.2,Lie_Down:0.15,sleep:0.35}),
 walk:Object.freeze({idle:0.15,Run:0.12,Sit:0.25,eat:0.2,pet:0.2,Meow:0.15,Lie_Down:0.2,sleep:0.35}),
 Run:Object.freeze({walk:0.12,idle:0.2}),
 Sit:Object.freeze({idle:0.25,Sit_Groom:0.15,walk:0.25,Meow:0.2,eat:0.25,pet:0.2,sleep:0.35}),
 Sit_Groom:Object.freeze({Sit:0.15,idle:0.25,walk:0.25}),
 Stretch:Object.freeze({idle:0.2,walk:0.2,Sit:0.25}),
 Lie_Down:Object.freeze({sleep:0.1,idle:0.25}),
 sleep:Object.freeze({Get_Up:0.1,idle:0.35,walk:0.35,Meow:0.25,eat:0.3,pet:0.3}),
 Get_Up:Object.freeze({idle:0.1,walk:0.15,Meow:0.15}),
 eat:Object.freeze({idle:0.2,walk:0.2,Sit:0.25,pet:0.2}),
 pet:Object.freeze({idle:0.2,walk:0.2,Sit:0.25,eat:0.2}),
 Meow:Object.freeze({idle:0.18,walk:0.18,eat:0.2,pet:0.2})
});
export const CAT_RADIUS=0.35;
export const COORD_MAX=2000;

const CLIP_SET=new Set(CLIP_IDS);
const STUDIO_SPAWNS=Object.freeze([
 Object.freeze({x:-1.4,z:1.9}),
 Object.freeze({x:0.2,z:-0.4}),
 Object.freeze({x:0.8,z:-2.6}),
 Object.freeze({x:-1.2,z:-2.4}),
 Object.freeze({x:1.4,z:2.2})
]);
const DEFAULT_SPAWNS=Object.freeze([
 Object.freeze({x:0,z:0}),
 Object.freeze({x:0.8,z:0.4}),
 Object.freeze({x:-0.8,z:0.4}),
 Object.freeze({x:0,z:-0.8})
]);

const round3=v=>+v.toFixed(3);
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const wrapYaw=yaw=>{
 const tau=Math.PI*2;
 let a=((yaw+Math.PI)%tau+tau)%tau-Math.PI;
 if(a===-Math.PI&&yaw>0)a=Math.PI;
 return clamp(round3(a),-Math.PI,Math.PI);
};
const cleanHome=v=>typeof v==='string'&&/^[\w.:-]{1,48}$/.test(v)?v:null;
const cleanName=v=>{
 if(typeof v!=='string')return null;
 const s=v.replace(/[^\p{L}\p{N} '-]/gu,'').trim().slice(0,NAME_MAX).trim();
 return s||null;
};

// Deterministic 32-bit hash returning [0, 1) from arbitrary numeric/string inputs.
function hashUnit(...parts){
 let h=2166136261>>>0;
 for(const p of parts){
  const s=typeof p==='string'?p:String(p??0);
  for(let i=0;i<s.length;i++){
   h^=s.charCodeAt(i);
   h=Math.imul(h,16777619)>>>0;
  }
  h^=0x9e3779b9;
  h=Math.imul(h,0x85ebca6b)>>>0;
 }
 h^=h>>>16;h=Math.imul(h,0x7feb352d)>>>0;
 h^=h>>>15;h=Math.imul(h,0x846ca68b)>>>0;
 h^=h>>>16;
 return (h>>>0)/4294967296;
}

const pickVariety=u=>u<0.4?'idle':u<0.65?'Sit':u<0.85?'Sit_Groom':'Stretch';

// Pick the cat animation clip from pets.js state + deterministic seed in ctx.
export function clipFor(pet,nowMinutes,ctx={}){
 if(!pet||!Number.isFinite(nowMinutes))return {clip:'idle',loop:true,speed:1};
 const c=ctx&&typeof ctx==='object'?ctx:{};
 const justFed=Number.isFinite(pet.fedAt)&&nowMinutes>=pet.fedAt&&nowMinutes-pet.fedAt<EAT_MINUTES&&(!Number.isFinite(pet.adoptedAt)||pet.fedAt>pet.adoptedAt);
 if(justFed)return {clip:'eat',loop:true,speed:1};
 if(Number.isFinite(pet.patAt)&&nowMinutes>=pet.patAt&&nowMinutes-pet.patAt<PURR_MINUTES)return {clip:'pet',loop:true,speed:1};
 const stage=hungerOf(pet,nowMinutes).stage;
 const speedNum=Number.isFinite(c.speed)?c.speed:0;
 const moving=!!(c.moving||c.walking||c.running||speedNum>0.01);
 if(stage==='hungry'||stage==='starving'){
  const urgent=stage==='starving'?1.15:1;
  return moving?{clip:'walk',loop:true,speed:urgent}:{clip:'Meow',loop:false,speed:urgent};
 }
 const tod=((nowMinutes%DAY_MINUTES)+DAY_MINUTES)%DAY_MINUTES;
 if(tod>=SLEEP_FROM||tod<SLEEP_TO)return {clip:'sleep',loop:true,speed:1};
 if(c.running||speedNum>=2)return {clip:'Run',loop:true,speed:1};
 if(moving)return {clip:'walk',loop:true,speed:1};
 const bucket=Math.floor(Math.floor(nowMinutes)/VARIETY_MINUTES);
 const seed=c.seed??pet.adoptedAt??0;
 const clip=pickVariety(hashUnit('clip',seed,bucket));
 return {clip,loop:CLIP_LOOP[clip],speed:1};
}

// Crossfade duration in seconds between two clip names.
export function blendTime(fromClip,toClip){
 if(!fromClip||!toClip||fromClip===toClip)return 0;
 return BLEND_TIMES[fromClip]?.[toClip]??DEFAULT_BLEND;
}

function parseBounds(roomBounds){
 if(!roomBounds||typeof roomBounds!=='object')return null;
 let x0,x1,z0,z1;
 if(Number.isFinite(roomBounds.x0)&&Number.isFinite(roomBounds.x1)&&Number.isFinite(roomBounds.z0)&&Number.isFinite(roomBounds.z1)){
  ({x0,x1,z0,z1}=roomBounds);
 }else if(Number.isFinite(roomBounds.minX)&&Number.isFinite(roomBounds.maxX)&&Number.isFinite(roomBounds.minZ)&&Number.isFinite(roomBounds.maxZ)){
  x0=roomBounds.minX;x1=roomBounds.maxX;z0=roomBounds.minZ;z1=roomBounds.maxZ;
 }else if(Number.isFinite(roomBounds.W)&&Number.isFinite(roomBounds.D)){
  x0=-roomBounds.W/2;x1=roomBounds.W/2;z0=-roomBounds.D/2;z1=roomBounds.D/2;
 }else if(Number.isFinite(roomBounds.width)&&Number.isFinite(roomBounds.depth)){
  x0=-roomBounds.width/2;x1=roomBounds.width/2;z0=-roomBounds.depth/2;z1=roomBounds.depth/2;
 }else if(Number.isFinite(roomBounds.hw)&&Number.isFinite(roomBounds.hd)){
  x0=-roomBounds.hw;x1=roomBounds.hw;z0=-roomBounds.hd;z1=roomBounds.hd;
 }else return null;
 if(x1<=x0||z1<=z0)return null;
 return {x0,x1,z0,z1};
}

function toRect(r){
 if(!r||typeof r!=='object')return null;
 if(Number.isFinite(r.x0)&&Number.isFinite(r.x1)&&Number.isFinite(r.z0)&&Number.isFinite(r.z1)){
  return {x0:Math.min(r.x0,r.x1),x1:Math.max(r.x0,r.x1),z0:Math.min(r.z0,r.z1),z1:Math.max(r.z0,r.z1)};
 }
 if(Number.isFinite(r.x)&&Number.isFinite(r.z)&&Number.isFinite(r.hx)&&Number.isFinite(r.hz)){
  const hx=Math.abs(r.hx),hz=Math.abs(r.hz);
  return {x0:r.x-hx,x1:r.x+hx,z0:r.z-hz,z1:r.z+hz};
 }
 const w=Number.isFinite(r.w)?r.w:r.width,d=Number.isFinite(r.d)?r.d:r.depth;
 if(Number.isFinite(r.x)&&Number.isFinite(r.z)&&Number.isFinite(w)&&Number.isFinite(d)){
  const hx=Math.abs(w)/2,hz=Math.abs(d)/2;
  return {x0:r.x-hx,x1:r.x+hx,z0:r.z-hz,z1:r.z+hz};
 }
 return null;
}

const inRect=(x,z,r,pad=0)=>x>=r.x0-pad&&x<=r.x1+pad&&z>=r.z0-pad&&z<=r.z1+pad;
const pointFree=(x,z,b,rects,wallMargin=0,pad=0)=>{
 if(x<b.x0+wallMargin||x>b.x1-wallMargin||z<b.z0+wallMargin||z>b.z1-wallMargin)return false;
 for(const r of rects)if(inRect(x,z,r,pad))return false;
 return true;
};

function gatherRects(roomBounds,avoid){
 const raw=avoid??roomBounds?.avoid??roomBounds?.furniture??roomBounds?.obstacles??roomBounds?.rects??roomBounds?.colliders??[];
 const list=Array.isArray(raw)?raw:[];
 const out=[];
 for(const item of list){const r=toRect(item);if(r)out.push(r)}
 return out;
}

// Deterministic waypoint inside roomBounds avoiding furniture rectangles.
export function nextWaypoint(roomBounds,seed=0,step=0,avoid=null){
 const b=parseBounds(roomBounds);
 if(!b)return null;
 const rects=gatherRects(roomBounds,avoid);
 const reqMargin=Number.isFinite(roomBounds.margin)?Math.max(0,roomBounds.margin):CAT_RADIUS;
 const s=Number.isFinite(step)?Math.floor(step):0;
 const m1=Math.min(reqMargin,(b.x1-b.x0)*0.45,(b.z1-b.z0)*0.45);
 const m2=Math.min(0.05,(b.x1-b.x0)*0.1,(b.z1-b.z0)*0.1);
 const tryAccept=(x,z,pad)=>{
  const rx=round3(x),rz=round3(z);
  return pointFree(rx,rz,b,rects,0,0)&&pointFree(x,z,b,rects,0,pad)?{x:rx,z:rz}:null;
 };
 for(let i=0;i<48;i++){
  const x=b.x0+m1+hashUnit('wx',seed,s,i)*(b.x1-b.x0-2*m1);
  const z=b.z0+m1+hashUnit('wz',seed,s,i)*(b.z1-b.z0-2*m1);
  const p=tryAccept(x,z,Math.min(reqMargin*0.7,0.25));
  if(p)return p;
 }
 for(let i=0;i<48;i++){
  const x=b.x0+m2+hashUnit('fx',seed,s,i)*(b.x1-b.x0-2*m2);
  const z=b.z0+m2+hashUnit('fz',seed,s,i)*(b.z1-b.z0-2*m2);
  const p=tryAccept(x,z,0);
  if(p)return p;
 }
 const n=16,ox=Math.floor(hashUnit('gx',seed,s)*n),oz=Math.floor(hashUnit('gz',seed,s)*n);
 for(const margin of [m2,0]){
  const spanX=b.x1-b.x0-2*margin,spanZ=b.z1-b.z0-2*margin;
  for(let iy=0;iy<=n;iy++)for(let ix=0;ix<=n;ix++){
   const gx=(ix+ox)%(n+1),gz=(iy+oz)%(n+1);
   const p=tryAccept(b.x0+margin+(gx/n)*spanX,b.z0+margin+(gz/n)*spanZ,0);
   if(p)return p;
  }
 }
 return null;
}

// Compact multiplayer snapshot: {name, homeId, clip, x, z, yaw}.
export function petSnapshot(pet,extra=null){
 if(!pet||typeof pet!=='object'||Array.isArray(pet))return null;
 const name=cleanName(pet.name);
 const homeId=cleanHome(pet.homeId);
 if(!name||!homeId)return null;
 const ex=extra&&typeof extra==='object'?extra:{};
 const rawClip=ex.clip??pet.clip??(Number.isFinite(ex.nowMinutes)?clipFor(pet,ex.nowMinutes,ex.ctx).clip:'idle');
 if(typeof rawClip!=='string'||!CLIP_SET.has(rawClip))return null;
 const rx=ex.x!==undefined?ex.x:(pet.x!==undefined?pet.x:0);
 const rz=ex.z!==undefined?ex.z:(pet.z!==undefined?pet.z:0);
 const ry=ex.yaw!==undefined?ex.yaw:(pet.yaw!==undefined?pet.yaw:0);
 if(![rx,rz,ry].every(Number.isFinite))return null;
 return {name,homeId,clip:rawClip,x:round3(clamp(rx,-COORD_MAX,COORD_MAX)),z:round3(clamp(rz,-COORD_MAX,COORD_MAX)),yaw:wrapYaw(ry)};
}

// Strict validator/normalizer for incoming multiplayer pet snapshots.
export function applyPetSnapshot(snapshot){
 if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))return null;
 const name=cleanName(snapshot.name);
 const homeId=cleanHome(snapshot.homeId);
 if(!name||!homeId)return null;
 if(typeof snapshot.clip!=='string'||!CLIP_SET.has(snapshot.clip))return null;
 if(![snapshot.x,snapshot.z,snapshot.yaw].every(Number.isFinite))return null;
 return {
  name,
  homeId,
  clip:snapshot.clip,
  x:round3(clamp(snapshot.x,-COORD_MAX,COORD_MAX)),
  z:round3(clamp(snapshot.z,-COORD_MAX,COORD_MAX)),
  yaw:wrapYaw(snapshot.yaw)
 };
}

function layoutObstacles(layout){
 const rects=gatherRects(layout,null);
 if(Array.isArray(layout.partitions))for(const p of layout.partitions){const r=toRect(p);if(r)rects.push(r)}
 if(!rects.length&&Array.isArray(layout.items?.[0])){
  for(const item of layout.items[0]){
   if(!item||item.id==='f-rug'||(item.y??0)>0||!Number.isFinite(item.x)||!Number.isFinite(item.z))continue;
   rects.push({x0:item.x-0.65,x1:item.x+0.65,z0:item.z-0.65,z1:item.z+0.65});
  }
 }
 return rects;
}

// Deterministic spawn point {x, z, floor, yaw} inside a home from free points.
export function interiorSpawn(homeId,layout=null){
 const id=cleanHome(homeId);
 if(!id)return null;
 const yaw0=wrapYaw((hashUnit('spawn-yaw',id)-0.5)*Math.PI*2);
 const list=Array.isArray(layout)?layout:(layout?.freePoints||layout?.points||layout?.spots);
 if(Array.isArray(list)){
  const rects=Array.isArray(layout)?[]:gatherRects(layout,null);
  const valid=list.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&!rects.some(r=>inRect(p.x,p.z,r,0)));
  if(!valid.length)return null;
  const pick=valid[Math.floor(hashUnit('spawn',id)*valid.length)];
  return {x:round3(pick.x),z:round3(pick.z),floor:Number.isInteger(pick.floor)?pick.floor:0,yaw:Number.isFinite(pick.yaw)?wrapYaw(pick.yaw):yaw0};
 }
 const bounds=parseBounds(layout);
 if(bounds){
  const rects=layoutObstacles(layout);
  const cand=[];
  const pushIfFree=(x,z)=>{
   if(!Number.isFinite(x)||!Number.isFinite(z))return;
   const rx=round3(x),rz=round3(z);
   if(pointFree(rx,rz,bounds,rects,0.2,0.1))cand.push({x:rx,z:rz});
  };
  if(layout.kitchen)pushIfFree(layout.kitchen.x,layout.kitchen.z);
  if(layout.entry){pushIfFree(layout.entry.x,layout.entry.z-0.6);pushIfFree(layout.entry.x,layout.entry.z)}
  if(layout.bed&&(layout.bed.floor??0)===0)pushIfFree(layout.bed.x,layout.bed.z);
  if(Array.isArray(layout.items?.[0])){
   for(const item of layout.items[0])if(item?.id==='f-rug'){
    for(const [dx,dz] of [[0.9,0],[-0.9,0],[0,0.9],[0,-0.9]])pushIfFree(item.x+dx,item.z+dz);
   }
  }
  for(let k=0;k<6;k++){const w=nextWaypoint(bounds,id,k,rects);if(w)cand.push(w)}
  const uniq=[];
  for(const p of cand)if(!uniq.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<0.2))uniq.push(p);
  if(uniq.length){
   const pick=uniq[Math.floor(hashUnit('spawn',id)*uniq.length)];
   return {x:pick.x,z:pick.z,floor:0,yaw:yaw0};
  }
  const fallback=nextWaypoint(bounds,id,99,rects);
  return fallback?{x:fallback.x,z:fallback.z,floor:0,yaw:yaw0}:null;
 }
 const table=id==='studio'?STUDIO_SPAWNS:DEFAULT_SPAWNS;
 const pick=table[Math.floor(hashUnit('spawn',id)*table.length)];
 return {x:pick.x,z:pick.z,floor:0,yaw:yaw0};
}
