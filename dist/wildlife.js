// B5 wildlife & hunting rules.
import {weaponZoneAt} from './map-definition.js';
import {hasHuntingLicence} from './kiosk-shift.js';
import {addXp} from './skills.js';
import {wildlifeWeatherMod} from './weather.js';

export const WILDLIFE_MAX=12;
export const DAILY_BAG_LIMIT=3;

export const WILDLIFE_SPECIES=Object.freeze({
 rabbit:Object.freeze({name:'Rabbit',cap:4,meatCents:1000,peltCents:1500,xp:8,fleeRadius:14}),
 turkey:Object.freeze({name:'Wild Turkey',cap:3,meatCents:1800,peltCents:2000,xp:12,fleeRadius:18}),
 deer:Object.freeze({name:'Whitetail Deer',cap:4,meatCents:3000,peltCents:4000,xp:18,fleeRadius:26}),
 elk:Object.freeze({name:'Blackstone Elk',cap:1,meatCents:4000,peltCents:6000,xp:28,fleeRadius:34}),
});

const SPECIES_ENTRIES=Object.freeze(Object.entries(WILDLIFE_SPECIES));
const CHUNK_SIZE=100;
const SPAWN_MARGIN=6;

function hashSeed(key,seed){
 let h=(2166136261^(Math.trunc(Number(seed)||0)>>>0))>>>0;
 const s=String(key??'');
 for(let i=0;i<s.length;i++){
  h^=s.charCodeAt(i);
  h=Math.imul(h,16777619)>>>0;
 }
 return h>>>0;
}

function makeRng(state){
 let s=(state>>>0)||1;
 return ()=>{
  s=(s+0x6d2b79f5)>>>0;
  let t=Math.imul(s^(s>>>15),1|s);
  t=(t+Math.imul(t^(t>>>7),61|t))^t;
  return ((t^(t>>>14))>>>0)/4294967296;
 };
}

export function rollChunkWildlife(chunkKey,seed=1){
 const key=String(chunkKey??'');
 const rng=makeRng(hashSeed(key,seed));
 const counts=Object.create(null);
 const spawns=[];
 const target=Math.min(WILDLIFE_MAX,3+Math.floor(rng()*(WILDLIFE_MAX-2)));
 for(let i=0;i<target;i++){
  let remaining=0;
  for(const [id,sp] of SPECIES_ENTRIES)remaining+=Math.max(0,sp.cap-(counts[id]||0));
  if(remaining<=0)break;
  let ticket=rng()*remaining;
  let chosen=SPECIES_ENTRIES[0][0];
  for(const [id,sp] of SPECIES_ENTRIES){
   const avail=Math.max(0,sp.cap-(counts[id]||0));
   if(avail<=0)continue;
   ticket-=avail;
   if(ticket<0){chosen=id;break}
  }
  counts[chosen]=(counts[chosen]||0)+1;
  const offsetX=Math.round((SPAWN_MARGIN+rng()*(CHUNK_SIZE-SPAWN_MARGIN*2))*100)/100;
  const offsetZ=Math.round((SPAWN_MARGIN+rng()*(CHUNK_SIZE-SPAWN_MARGIN*2))*100)/100;
  const yaw=Math.round(rng()*Math.PI*2*1000)/1000;
  spawns.push({id:`${key}:${i}`,speciesId:chosen,offsetX,offsetZ,yaw});
 }
 return spawns;
}

export function normalizeHunting(val){
 if(!val||typeof val!=='object'||Array.isArray(val))return null;
 const n=(x,max)=>Number.isSafeInteger(x)&&x>=0&&x<=max?x:0;
 const rawDay=n(val.day,1e7);
 const bagged=Math.min(DAILY_BAG_LIMIT,n(val.bagged,1e7));
 const meatCents=n(val.meatCents,1e8);
 const peltCents=n(val.peltCents,1e8);
 const count=n(val.count,1e7);
 if(!bagged&&!meatCents&&!peltCents&&!count)return null;
 return {day:rawDay>0?rawDay:1,bagged,meatCents,peltCents,count};
}

export function canHuntAt(progress,x,z){
 if(!Number.isFinite(x)||!Number.isFinite(z))return {error:'Invalid hunting coordinates.'};
 const zone=weaponZoneAt(x,z);
 if(zone?.kind!=='hunting'){
  return zone?.kind==='noWeapon'
   ?{error:'No weapons or hunting allowed here.'}
   :{error:'You can only hunt inside Blackstone hunting grounds.'};
 }
 if(!hasHuntingLicence(progress))return {error:'You need a valid Hunting Licence from Eden Outdoors.'};
 const day=progress?.housing?.day||1;
 const h=progress?.hunting;
 const bagged=h?.day===day?(h.bagged||0):0;
 if(bagged>=DAILY_BAG_LIMIT)return {error:`Daily bag limit reached (${DAILY_BAG_LIMIT} per day).`};
 return {ok:true};
}

export function harvestAnimal(progress,speciesId,x,z){
 const check=canHuntAt(progress,x,z);
 if(check.error)return check;
 const sp=Object.hasOwn(WILDLIFE_SPECIES,speciesId)?WILDLIFE_SPECIES[speciesId]:null;
 if(!sp)return {error:`Unknown wildlife species: ${speciesId}.`};
 const day=progress?.housing?.day||1;
 const prev=progress?.hunting;
 const sameDay=prev?.day===day;
 const bagged=(sameDay?(prev.bagged||0):0)+1;
 const hunting={
  day,
  bagged,
  meatCents:(prev?.meatCents||0)+sp.meatCents,
  peltCents:(prev?.peltCents||0)+sp.peltCents,
  count:(prev?.count||0)+1,
 };
 const base={...progress,skills:progress?.skills||{},hunting};
 const xpRes=addXp(base,'hunting',sp.xp);
 return {
  state:xpRes.state,
  speciesId,
  species:sp,
  xp:sp.xp,
  level:xpRes.level,
  leveledUp:xpRes.leveledUp,
  bagged,
  remaining:DAILY_BAG_LIMIT-bagged,
  message:`Harvested ${sp.name} (+${sp.xp} hunting XP, ${bagged}/${DAILY_BAG_LIMIT} today).`,
 };
}

export function effectiveFleeRadius(speciesId,weather=null){
 const sp=Object.hasOwn(WILDLIFE_SPECIES,speciesId)?WILDLIFE_SPECIES[speciesId]:null;
 if(!sp)return 0;
 return +(sp.fleeRadius*wildlifeWeatherMod(weather).fleeMult).toFixed(2);
}

export function sellHuntHaul(progress){
 const h=progress?.hunting;
 const meat=h?.meatCents||0;
 const pelt=h?.peltCents||0;
 const earned=meat+pelt;
 if(earned<=0)return {error:'You have no meat or pelts to sell.'};
 const day=h?.day||(progress?.housing?.day||1);
 const bagged=h?.bagged||0;
 const count=h?.count||0;
 const hunting={day,bagged,meatCents:0,peltCents:0,count:0};
 const state={
  ...progress,
  cash:(progress?.cash||0)+earned,
  routine:{...(progress?.routine||{}),earned:(progress?.routine?.earned||0)+earned},
  hunting,
 };
 return {
  state,
  earned,
  message:`Sold hunt haul (${count} animal${count===1?'':'s'}) at Eden Outdoors for $${(earned/100).toFixed(2)}.`,
 };
}
