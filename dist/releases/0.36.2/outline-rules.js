// Pure selective inverted-hull outline rules (notes/visual-identity-design.md, V-C). No three.js, no DOM.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};

export const OUTLINE=Object.freeze({
 widthChar:.0022,widthVehicle:.006,widthMin:0,widthMax:.02,
 fadeStart:28,fadeEnd:45,
 vehicleMaxNearby:2,vehicleMaxDist:35,
 colour:'#161b26',
});

export const clampOutlineWidth=w=>Number.isFinite(w)?clamp(w,OUTLINE.widthMin,OUTLINE.widthMax):OUTLINE.widthChar;

// Distance fade: 1 within 28 m, 0 at or beyond 45 m (non-finite distances fade to 0).
export const outlineFade=distance=>Number.isFinite(distance)?1-smoothstep(OUTLINE.fadeStart,OUTLINE.fadeEnd,Math.max(0,distance)):0;

// Effective hull extrusion width in metres: strictly 0 on Low quality or when disabled.
export function outlineWidthAt(distance,{quality='high',enabled=true,baseWidth=OUTLINE.widthChar}={}){
 if(quality!=='high'||!enabled)return 0;
 return clampOutlineWidth(baseWidth)*outlineFade(distance);
}

// Selects uids to outline: driven vehicle (if any) plus up to 2 nearest vehicles within 35 m on High; [] on Low/disabled.
export function selectOutlinedVehicles(vehicles,listenerPos,{drivenUid=null,quality='high',enabled=true,maxNearby=OUTLINE.vehicleMaxNearby,maxDist=OUTLINE.vehicleMaxDist}={}){
 if(quality!=='high'||!enabled||!Array.isArray(vehicles)||!vehicles.length)return [];
 const out=[];
 if(drivenUid&&vehicles.some(v=>v?.uid===drivenUid))out.push(drivenUid);
 if(!listenerPos||!Number.isFinite(listenerPos.x)||!Number.isFinite(listenerPos.z))return out;
 const maxN=Math.max(0,maxNearby|0),maxD2=Math.max(0,maxDist)**2;
 const nearby=[];
 for(const v of vehicles){
  if(!v?.uid||v.uid===drivenUid||!Number.isFinite(v.x)||!Number.isFinite(v.z))continue;
  const dx=v.x-listenerPos.x,dz=v.z-listenerPos.z,d2=dx*dx+dz*dz;
  if(d2<=maxD2)nearby.push({uid:v.uid,d2});
 }
 nearby.sort((a,b)=>a.d2-b.d2||String(a.uid).localeCompare(String(b.uid)));
 for(let i=0;i<Math.min(maxN,nearby.length);i++)out.push(nearby[i].uid);
 return out;
}
