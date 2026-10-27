// Rewards use cents, matching the existing economy. Locations are street coordinates.
export const CONTRACTS = Object.freeze([
  Object.freeze({id:'bench-check',title:'Check the Oak Street bench',description:'Visit the bench on the south sidewalk and confirm it is ready for visitors.',reward:800,energyCost:8,location:Object.freeze({x:9,y:.165,z:16}),action:'Confirm bench condition'}),
  Object.freeze({id:'notice-check',title:'Check the apartment notices',description:'Stop by the collection box outside 18 Oak Street and confirm the notices are in place.',reward:1000,energyCost:10,location:Object.freeze({x:3.8,y:.165,z:-5.8}),action:'Confirm notices checked'}),
  Object.freeze({id:'street-check',title:'Report on the east sidewalk',description:'Walk to the east end of Oak Street and report whether the sidewalk is clear.',reward:1200,energyCost:12,location:Object.freeze({x:47,y:.165,z:-3.2}),action:'Submit sidewalk report'})
]);
export const contractById=id=>CONTRACTS.find(job=>job.id===id);
export function normalizeActiveJob(value){
  const job=contractById(value?.id);
  return job?{...job,location:{...job.location}}:null;
}
export function acceptContract(progress,id){
  const job=contractById(id);
  if(!job)return {error:'This gig is unavailable.'};
  if(progress.activeJob)return {error:'Finish your active gig before accepting another.'};
  if(progress.life.energy<job.energyCost)return {error:`You need ${job.energyCost} energy for this gig.`};
  return {state:{...progress,activeJob:normalizeActiveJob(job),life:{...progress.life,energy:progress.life.energy-job.energyCost}}};
}
export function completeContract(progress,position,room='street'){
  const job=normalizeActiveJob(progress.activeJob);
  if(!job)return {error:'There is no active gig.'};
  if(room!=='street'||Math.hypot(position.x-job.location.x,position.z-job.location.z)>1.6)return {error:'Go to the marked gig location first.'};
  return {state:{...progress,activeJob:null,cash:progress.cash+job.reward,routine:{...progress.routine,earned:progress.routine.earned+job.reward}},paid:job.reward};
}
