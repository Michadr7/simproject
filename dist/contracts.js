// Currency is cents. Cooldowns use absolute game minutes, never wall-clock time.
const street=(x,z)=>({x,y:.165,z,room:'street'});
const templates=[
 {id:'bench-check',title:'Bench maintenance',description:'Inspect the south-side bench for 8 seconds, then report back at the apartments.',reward:1000,mode:'timed',duration:8,location:street(9,16),returnLocation:street(3.8,-5.8)},
 {id:'notice-check',title:'Apartment notices',description:'Spend 10 seconds sorting notices by the collection box, then report to the market.',reward:1200,mode:'timed',duration:10,location:street(3.8,-5.8),returnLocation:street(19,-4.8)},
 {id:'street-check',title:'Sidewalk survey',description:'Check the east sidewalk for 12 seconds, then deliver your report to the apartments.',reward:1400,mode:'timed',duration:12,location:street(47,-3.2),returnLocation:street(3.8,-5.8)},
 {id:'heavy-delivery',title:'Heavy box delivery',description:'Collect a box outside the market, carry it to the apartments, then return to the market. Carrying doubles movement energy drain.',reward:2200,mode:'delivery',energyMultiplier:2,location:street(19,-4.8),taskLocation:street(3.8,-5.8),returnLocation:street(19,-4.8)},
 {id:'cafe-shift',title:'Café shift',description:'Enter Alder Coffee and hold the marked station for 30 uninterrupted seconds. Step away and the timer resets. Report outside afterward.',reward:2400,mode:'timed',duration:30,location:{x:1.5,y:.02,z:0,room:'cafe'},returnLocation:street(36,-6.3)},
 {id:'courier-run',title:'Express courier run',description:'Collect the envelope at the apartments, run at least 20 metres on your way to the east sidewalk, then return for payment.',reward:2000,mode:'courier',runDistance:20,location:street(3.8,-5.8),taskLocation:street(47,-3.2),returnLocation:street(3.8,-5.8)}
];
export const CONTRACTS=Object.freeze(templates.map(job=>Object.freeze({...job,location:Object.freeze(job.location),taskLocation:job.taskLocation&&Object.freeze(job.taskLocation),returnLocation:Object.freeze(job.returnLocation)})));
export const contractById=id=>CONTRACTS.find(job=>job.id===id);
export const gameMinutes=p=>(p.housing.day-1)*1440+p.routine.minutes;
const bounded=(v,max)=>Number.isFinite(v)?Math.max(0,Math.min(max,v)):0;
export function normalizeCooldowns(value){
 const result={};for(const job of CONTRACTS)if(Number.isFinite(value?.[job.id])&&value[job.id]>=0)result[job.id]=Math.min(value[job.id],144001440);
 return result;
}
export function normalizeGigBoard(value){
 return {ids:[...new Set(Array.isArray(value?.ids)?value.ids:[])].filter(id=>contractById(id)).slice(0,3),refreshAt:bounded(value?.refreshAt,144001440)};
}
export function normalizeActiveJob(value){
 const job=contractById(value?.id);if(!job)return null;
 return {...job,location:{...job.location},stage:['travel','task','return'].includes(value.stage)?value.stage:'travel',workSeconds:bounded(value.workSeconds,job.duration||0),runMetres:bounded(value.runMetres,job.runDistance||0)};
}
export function refreshGigBoard(progress,random=Math.random){
 const now=gameMinutes(progress),board=normalizeGigBoard(progress.gigBoard);
 const keeping=board.refreshAt>now?availableContracts({...progress,gigBoard:board}):[];
 if(keeping.length>=2)return progress;
 const jobs=CONTRACTS.filter(job=>(progress.cooldowns?.[job.id]||0)<=now&&progress.activeJob?.id!==job.id&&!keeping.some(old=>old.id===job.id));
 for(let i=jobs.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[jobs[i],jobs[j]]=[jobs[j],jobs[i]]}
 const ids=[...keeping,...jobs].slice(0,3).map(job=>job.id),refreshAt=board.refreshAt>now?board.refreshAt:now+30;
 if(refreshAt===board.refreshAt&&ids.join('|')===board.ids.join('|'))return progress;
 return {...progress,gigBoard:{ids,refreshAt}};
}
export function availableContracts(progress){
 const now=gameMinutes(progress);
 return (progress.gigBoard?.ids||[]).map(contractById).filter(job=>job&&job.id!==progress.activeJob?.id&&(progress.cooldowns?.[job.id]||0)<=now);
}
export function acceptContract(progress,id){
 const job=contractById(id);if(!job)return {error:'This gig is unavailable.'};
 if(progress.activeJob)return {error:'Finish your active gig before accepting another.'};
 const now=gameMinutes(progress),remaining=(progress.cooldowns?.[id]||0)-now;
 if(remaining>0)return {error:`This gig returns in ${Math.ceil(remaining)} game minutes.`};
 return {state:{...progress,activeJob:normalizeActiveJob({id}),cooldowns:{...normalizeCooldowns(progress.cooldowns),[id]:now+120}}};
}
export function gigTarget(job){return job.stage==='return'?job.returnLocation:job.stage==='task'?(job.taskLocation||job.location):job.location}
export const atGigPoint=(position,room,point)=>room===point.room&&Math.hypot(position.x-point.x,position.z-point.z)<=1.35;
export function tickContract(progress,{position,room='street',dt=0,moving=false,running=false,distance=0}){
 const previous=progress.activeJob;if(!previous)return progress;
 let job=normalizeActiveJob(previous);dt=Math.max(0,Math.min(dt,.25));
 if(job.stage==='travel'&&atGigPoint(position,room,job.location))job.stage='task';
 if(job.stage==='task'){
  if(job.mode==='timed'){
   const working=atGigPoint(position,room,job.location)&&!moving;
   job.workSeconds=working?Math.min(job.duration,job.workSeconds+dt):0;
   if(job.workSeconds>=job.duration)job.stage='return';
  }else{
   if(job.mode==='courier'&&running&&room==='street')job.runMetres=Math.min(job.runDistance,job.runMetres+bounded(distance,1));
   if(atGigPoint(position,room,job.taskLocation)&&(job.mode!=='courier'||job.runMetres>=job.runDistance))job.stage='return';
  }
 }
 return {...progress,activeJob:job};
}
export function completeContract(progress,position,room='street'){
 const job=normalizeActiveJob(progress.activeJob);
 if(!job||job.stage!=='return'||!atGigPoint(position,room,job.returnLocation))return {error:'Complete the task and return to the marked contact first.'};
 return {state:{...progress,activeJob:null,cash:progress.cash+job.reward,routine:{...progress.routine,earned:progress.routine.earned+job.reward}},paid:job.reward};
}
