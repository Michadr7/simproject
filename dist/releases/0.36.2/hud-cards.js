// Pure HUD card math (notes/hud-restyle-spec.md): speed text/bar/band, fuel/damage bars, street-chip names, view-cone angle. No DOM, no three.js.
import {mph} from './fuel.js';

export const SPEED_AMBER=.80,SPEED_RED=.95,FUEL_LOW=.30,FUEL_CRIT=.15,DAMAGE_WARN=550,DAMAGE_CRIT=250;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

export function speedCard({speedMs=0,topSpeedMs=29,engineMode='run',cond=1000}={}){
 const s=Number.isFinite(speedMs)?Math.abs(speedMs):0,top=Number.isFinite(topSpeedMs)&&topSpeedMs>0?topSpeedMs:29;
 const off=cond<=0||engineMode==='off',fraction=off?0:clamp(s/top,0,1);
 const band=off?'off':fraction>=SPEED_RED?'red':fraction>=SPEED_AMBER?'amber':'normal';
 return {text:String(mph(s)),unit:'MPH',fraction,band};
}

export function fuelBar(fuel){
 if(!fuel||!(fuel.capacityMgal>0))return {text:'—',fraction:0,band:'off'};
 const fraction=clamp((fuel.mgal||0)/fuel.capacityMgal,0,1);
 return {text:Math.round(fraction*100)+'%',fraction,band:fraction<=FUEL_CRIT?'red':fraction<=FUEL_LOW?'amber':'ok'};
}

export function damageBar(cond){
 const c=Number.isFinite(cond)?clamp(cond,0,1000):1000,fraction=c/1000;
 return {text:Math.round(fraction*100)+'%',fraction,band:c<DAMAGE_CRIT?'red':c<DAMAGE_WARN?'amber':'ok'};
}

// Canvas radians for the camera view cone (+x right, +z down; camera looks along -sin(yaw), -cos(yaw)).
export const viewConeAngle=yaw=>Number.isFinite(yaw)?Math.atan2(-Math.cos(yaw),-Math.sin(yaw)):-Math.PI/2;

export function roadDisplayName(edge){
 if(!edge)return '';
 if(edge.name)return edge.name;
 return String(edge.id||'').split('-').filter(Boolean).map(w=>w[0].toUpperCase()+w.slice(1)).join(' ');
}

function distToPolySq(x,z,poly){
 let best=Infinity;
 for(let i=0;i<poly.length-1;i++){
  const ax=poly[i][0],az=poly[i][1],dx=poly[i+1][0]-ax,dz=poly[i+1][1]-az,l2=dx*dx+dz*dz;
  const t=l2>0?clamp(((x-ax)*dx+(z-az)*dz)/l2,0,1):0,px=ax+dx*t-x,pz=az+dz*t-z,d2=px*px+pz*pz;
  if(d2<best)best=d2;
 }
 return best;
}

// Nearest road and distinct cross street within maxDist / crossDist metres from precomputed edge array (Object.values(roadGraph(MAP).edges)).
export function streetChips(x,z,edges,{maxDist=45,crossDist=55}={}){
 const list=Array.isArray(edges)?edges:edges&&typeof edges==='object'?Object.values(edges):null;
 if(!Number.isFinite(x)||!Number.isFinite(z)||!list||!list.length)return {street:null,cross:null};
 const maxD2=maxDist*maxDist,crossD2=crossDist*crossDist;
 let bestD2=Infinity,bestName=null,secondD2=Infinity,secondName=null;
 for(let i=0;i<list.length;i++){
  const e=list[i];if(!e?.poly||e.poly.length<2)continue;
  const name=roadDisplayName(e);if(!name)continue;
  const d2=distToPolySq(x,z,e.poly);
  if(d2<bestD2){if(bestName&&bestName!==name&&bestD2<secondD2){secondD2=bestD2;secondName=bestName}bestD2=d2;bestName=name}
  else if(name!==bestName&&d2<secondD2){secondD2=d2;secondName=name}
 }
 const street=bestD2<=maxD2?bestName:null;
 const cross=street&&secondD2<=crossD2?secondName:null;
 return {street,cross};
}
