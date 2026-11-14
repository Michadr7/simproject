// Bridge between the game's old gig hooks (the names contracts.js used) and gigs.js (notes/gigs-starter-design.md section 3).
// game.js, phone.js and objective.js keep calling acceptContract, tickContract, completeContract, availableContracts and gigTarget; the new
// rules live in gigs.js. progress.gigs.active is the truth; progress.activeJob is a derived VIEW of it (title, stage, locations), rebuilt after every change here.
// The board is derived from counters, so refreshGigBoard has nothing to do. Walking types only: the vehicle types wait for the vehicle work.
import {boardFor,acceptGig,tickGig,completeGig,gigDone,typeById,payFor,repeatsToday,townContext,gameMinutes,GIG_TYPES,BOARD_SLOTS} from './gigs.js';
export {gameMinutes};
const slotId=i=>'slot-'+i,slotOf=id=>/^slot-[0-3]$/.test(id)?+id.slice(5):-1;
const point=pl=>({x:pl.x,y:.165,z:pl.z,room:pl.room||'street'});
const nameOf=id=>townContext().clients.find(c=>c.id===id)?.name||'a neighbor';
const stopsText=places=>'Go to '+places.map(x=>x.name||'the marked spot').join(', then ')+'.';
export const atGigPoint=(position,room,point)=>room===point.room&&Math.hypot(position.x-point.x,position.z-point.z)<=1.35;
// The shape the old code reads from progress.activeJob.
export function activeView(p){
 const a=p.gigs?.active;if(!a)return null;const t=typeById(a.type),done=gigDone(p),next=a.places.find((_,i)=>!a.visited[i])||a.places.at(-1);
 const last=a.places.at(-1),now=gameMinutes(p);
 return {id:'gig-'+a.id,type:a.type,title:`${t.title} for ${nameOf(a.client)}`,description:stopsText(a.places)+' '+t.twist+'.',reward:payFor(a.type,100,repeatsToday(p.gigs.recent,a.type,now),p.gigs.rep,0,a.large),mode:'delivery',
  stage:done?'return':a.visited.some(Boolean)?'task':'travel',location:point(next),taskLocation:point(next),returnLocation:point(last),stops:a.places.length,done:a.visited.filter(Boolean).length,dueAt:a.dueAt};
}
const withView=p=>({...p,activeJob:activeView(p)});
// What the board slot offers (the phone card reads title, description, reward, terms).
function offer(p,s){
 const t=typeById(s.type),now=gameMinutes(p),large=s.large;
 return {id:slotId(s.slot),title:`${t.title} for ${s.clientName||nameOf(s.client)}`,description:stopsText(s.places)+' '+t.twist+'.',reward:payFor(s.type,100,repeatsToday(p.gigs.recent,s.type,now),p.gigs.rep,0,large),terms:t.limit?`${t.limit} min limit`:'No time limit',mode:'delivery'};
}
// Walking types only, until the vehicle gigs have their cargo and knock code.
const LIVE=new Set(GIG_TYPES.filter(t=>t.live!==false).map(t=>t.id));
const liveBoard=p=>boardFor(p,gameMinutes(p)).filter(s=>LIVE.has(s.type));
export const CONTRACTS=Object.freeze([0,1,2,3].map(i=>Object.freeze({id:slotId(i),title:'Gig',description:'',reward:0,terms:'',mode:'delivery'})));
export const contractById=id=>CONTRACTS.find(c=>c.id===id);
export const refreshGigBoard=progress=>progress;
export const availableContracts=p=>p.activeJob||p.gigs?.active?[]:liveBoard(p).map(s=>offer(p,s));
export function acceptContract(p,id){
 const i=slotOf(id);if(i<0)return {error:'This gig is unavailable.'};
 if(!liveBoard(p).some(s=>s.slot===i))return {error:'This gig is unavailable.'};
 const r=acceptGig(p,i,gameMinutes(p));return r.error?r:{state:withView(r.state)};
}
// What Noah's counter offers: the grocery and parcel gigs of the board.
export const marketContracts=p=>p.activeJob||p.gigs?.active?[]:liveBoard(p).filter(s=>s.type==='grocery'||s.type==='parcel').map(s=>offer(p,s));
export const gigTarget=job=>job.stage==='return'?job.returnLocation:job.location;
export function tickContract(p,{position,room='street',dt=0,moving=false,distance=0}){
 if(!p.gigs?.active)return p;
 const before=p.gigs.active.visited.join(),next=tickGig(p,{position,room,dt,moving,metres:distance,now:gameMinutes(p)});
 return next.gigs.active&&next.gigs.active.visited.join()===before&&p.activeJob?{...next,activeJob:p.activeJob}:withView(next);
}
export function completeContract(p,position,room='street'){
 const job=activeView(p);if(!job||job.stage!=='return'||!atGigPoint(position,room,job.returnLocation))return {error:'Complete the task and return to the marked contact first.'};
 const r=completeGig(p,gameMinutes(p));return r.error?r:{state:withView(r.state),paid:r.paid};
}