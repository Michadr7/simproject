// Plot rules. Plots are stored sparsely in progress.plots, keyed "ix,iz" (see world.js):
// a cell with no entry is in its generated default state.
//   farm:   {type:'farm', crop:null|string, tilled:boolean}
//   forest: {type:'forest', tree:'pine', hits:0..2}  a standing pine (the default)
//           {type:'forest', tree:null, hits:0, felledAt:gameMinutes|null}  felled: stump, then sapling, then a pine again
// Felling a pine leaves logs on the ground (progress.logs) that the player picks up.
import {gridZoneAt,parseCellKey,cuttableTreeAt,cellCenter,isWalkable} from './world.js';
import {addItem,hasItem} from './inventory.js';
import {addXp,levelOf,hitsNeeded,logsPerTree,XP} from './skills.js';

export const TREE_HITS=3; // hits for a level 1 lumberjack (skills.js has the perks)
export const CHOP_RANGE=2.2;
// Game minutes since felling: a sapling after 3 days, a full tree again after 7.
export const SAPLING_AFTER=4320,MATURE_AFTER=10080;
export const MAX_LOGS=80,LOG_LIFETIME=2880; // logs left lying are gone after 2 game days
const MAX_PLOTS=20000;
// Same clock as contracts.js gameMinutes, repeated here to avoid an import cycle.
const minutesOf=p=>((p.housing?.day||1)-1)*1440+(p.routine?.minutes||0);

export function defaultPlot(key){
 const cell=parseCellKey(key),zone=cell&&gridZoneAt(cell.ix,cell.iz);
 if(zone==='farm')return {type:'farm',crop:null,tilled:false};
 if(zone==='forest')return {type:'forest',tree:cuttableTreeAt(key)?'pine':null,hits:0};
 return null;
}
// Drops anything malformed, off-grid, or describing a tree the world never generated.
export function normalizePlots(value){
 const plots={};if(!value||typeof value!=='object')return plots;
 let count=0;
 for(const [key,raw] of Object.entries(value)){
  if(count>=MAX_PLOTS)break;
  const base=defaultPlot(key);if(!base||!raw||typeof raw!=='object'||raw.type!==base.type)continue;
  let plot;
  if(base.type==='farm')plot={type:'farm',crop:typeof raw.crop==='string'&&/^[a-z][a-z-]{0,23}$/.test(raw.crop)?raw.crop:null,tilled:raw.tilled===true};
  else{
   if(base.tree===null)continue; // nothing generated here to remember
   if(raw.tree===null)plot={type:'forest',tree:null,hits:0,felledAt:Number.isFinite(raw.felledAt)&&raw.felledAt>=0&&raw.felledAt<=1e9?Math.floor(raw.felledAt):null};
   else plot={type:'forest',tree:'pine',hits:Number.isInteger(raw.hits)?Math.max(0,Math.min(TREE_HITS-1,raw.hits)):0};
  }
  // Only store plots that differ from their default.
  if(JSON.stringify(plot)!==JSON.stringify(base)){plots[key]=plot;count++}
 }
 return plots;
}
export const plotAt=(progress,key)=>progress.plots?.[key]||defaultPlot(key);
export function setPlot(progress,key,plot){
 const base=defaultPlot(key);if(!base)return progress;
 const plots={...(progress.plots||{})};
 if(JSON.stringify(plot)===JSON.stringify(base))delete plots[key];else plots[key]=plot;
 return {...progress,plots};
}
// Keys of trees that are not standing (stump or sapling), for rebuilding the world after loading.
export const felledTrees=progress=>Object.entries(progress.plots||{}).filter(([,p])=>p.type==='forest'&&p.tree===null).map(([key])=>key);

// ── Logs lying on the ground ──────────────────────────────────────────────────
export function normalizeLogs(value){
 const logs=[],seen=new Set();
 for(const raw of Array.isArray(value)?value:[]){
  if(!raw||!Number.isSafeInteger(raw.id)||raw.id<1||seen.has(raw.id)||!Number.isFinite(raw.x)||!Number.isFinite(raw.z)||!isWalkable(raw.x,raw.z))continue;
  seen.add(raw.id);
  logs.push({id:raw.id,x:raw.x,z:raw.z,rot:Number.isFinite(raw.rot)?raw.rot:0,t:Number.isFinite(raw.t)&&raw.t>=0?Math.floor(raw.t):0});
 }
 return logs.slice(-MAX_LOGS);
}
export const nextLogIdFor=(value,logs)=>Math.max(Number.isSafeInteger(value)&&value>0?value:1,1+Math.max(0,...logs.map(l=>l.id)));
export function expireLogs(progress,now){
 const logs=(progress.logs||[]).filter(l=>now-l.t<LOG_LIFETIME);
 return logs.length===(progress.logs||[]).length?progress:{...progress,logs};
}
export function collectLog(progress,id){
 if(!(progress.logs||[]).some(l=>l.id===id))return {error:'That log is gone.'};
 const added=addItem(progress,'wood-log');
 if(added.error)return {error:'Your bag is full.'};
 return {state:{...added.state,logs:progress.logs.filter(l=>l.id!==id)},message:'Picked up a wood log.'};
}

// ── Chopping ──────────────────────────────────────────────────────────────────
// One swing of the axe. Returns {error} or {state, hits, need, felled, logs, leveledUp, level, message}.
// The axe must be owned and equipped; the lumberjack level sets how many hits a tree takes and how many logs it drops.
export function chopTree(progress,key,position){
 const plot=plotAt(progress,key);
 if(plot?.type!=='forest'||plot.tree!=='pine')return {error:'There is no tree to chop here.'};
 const c=parseCellKey(key),center=cellCenter(c.ix,c.iz);
 if(position&&Math.hypot(position.x-center.x,position.z-center.z)>CHOP_RANGE)return {error:'Move closer to the tree.'};
 if(!hasItem(progress,'axe'))return {error:'You need an axe. The Corner Market sells them.'};
 if(progress.equipped!=='axe')return {error:'Equip your axe first: press its hotbar number.'};
 const level=levelOf(progress.skills.lumberjack.xp).level,need=hitsNeeded(level),hits=plot.hits+1;
 if(hits<need){
  const gained=addXp(setPlot(progress,key,{type:'forest',tree:'pine',hits}),'lumberjack',XP.hit);
  return {state:gained.state,hits,need,felled:false,logs:[],leveledUp:gained.leveledUp,level:gained.level,message:`Chop ${hits} / ${need}`};
 }
 // Felled: the trunk falls away from the player and breaks into logs along the ground.
 const now=Math.floor(minutesOf(progress)),count=logsPerTree(level);
 let dx=position?center.x-position.x:0,dz=position?center.z-position.z:1;const length=Math.hypot(dx,dz)||1;dx/=length;dz/=length;
 const made=[];let id=progress.nextLogId||1;
 for(let i=0;i<count;i++){
  const along=.9+i*.75,side=((i%2)*2-1)*.2;
  made.push({id:id++,x:center.x+dx*along-dz*side,z:center.z+dz*along+dx*side,rot:Math.atan2(dx,dz)+Math.PI/2+side*.4,t:now});
 }
 const felled=setPlot(progress,key,{type:'forest',tree:null,hits:0,felledAt:now});
 const gained=addXp({...felled,logs:[...(felled.logs||[]),...made].slice(-MAX_LOGS),nextLogId:id},'lumberjack',XP.fell);
 return {state:gained.state,hits,need,felled:true,logs:made,leveledUp:gained.leveledUp,level:gained.level,message:`Timber! ${count} logs on the ground.`};
}

// ── Regrowth ──────────────────────────────────────────────────────────────────
export function treeStage(plot,now){
 if(plot.tree==='pine')return 'mature';
 if(plot.felledAt==null||now-plot.felledAt<SAPLING_AFTER)return 'stump';
 return now-plot.felledAt<MATURE_AFTER?'sapling':'mature';
}
export const felledStages=(progress,now)=>Object.entries(progress.plots||{}).filter(([,p])=>p.type==='forest'&&p.tree===null).map(([key,p])=>[key,treeStage(p,now)]);
// Starts the clock for trees felled before regrowth existed, and restores trees that have fully regrown
// (unless isBlocked(key), e.g. the player is standing there). Returns {state, restored:[keys]}.
export function regrowTrees(progress,now,isBlocked=()=>false){
 const plots={...(progress.plots||{})},restored=[];let changed=false;
 for(const [key,plot] of Object.entries(plots)){
  if(plot.type!=='forest'||plot.tree!==null)continue;
  if(plot.felledAt==null){plots[key]={...plot,felledAt:now};changed=true;continue}
  if(now-plot.felledAt>=MATURE_AFTER&&!isBlocked(key)){delete plots[key];restored.push(key);changed=true}
 }
 return {state:changed?{...progress,plots}:progress,restored};
}
