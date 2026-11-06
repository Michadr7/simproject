// Shifts (0.35, DESIGN 4.15): clocking in and out, the day's tasks, wage on site, piece pay, the shift bonus, pay stubs. Pure.
//   progress.shift = null | {employer, day, startedAt, last (absolute game minutes), paidMinutes, offSiteMinutes, tasks:[{kind, piece, target, done}], pieces:{piece:count}}
//   progress.payStubs = the last 7 stubs, newest first.
// Time comes from the save itself (housing.day, routine.minutes); call tickShift whenever the clock moves (every frame, or after a sleep skip).
import {MAP} from './map-definition.js';
import {employerById,careerOf,employerName,taskKinds,changeRep} from './careers.js';
import {normalizeTruck} from './customers.js';

export const OFF_SITE_LIMIT=60,MIN_COUNTED_SHIFT=60,STUBS_KEPT=7;
// Task kinds: the piece they count and the amounts handed out (picked by counters, so a save always gets the same day). Placeholders.
export const TASKS=Object.freeze({
 fell:{piece:'trees',amounts:[4,6,8],label:n=>`Fell ${n} marked pines`},
 landing:{piece:'logs',amounts:[8,12,16],label:n=>`Carry ${n} logs to the landing`},
 gather:{piece:'gathered',amounts:[6,10,14],label:n=>`Gather ${n} fallen logs`}, // pick up logs lying on the ground (each log counts once a shift)
 stumps:{piece:'stumps',amounts:[3,5,8],label:n=>`Dig out ${n} stump${n===1?'':'s'}`},
 mill:{piece:'planks',amounts:[20,30,40],label:n=>`Mill ${n} planks`},
 haul:{piece:'delivered',amounts:[12,24,40],label:n=>`Deliver ${n} planks to the lumberyard`},
 load:{piece:'shipped',amounts:[20,40],label:n=>`Load a customer's truck with ${n} planks`},
 stack:{piece:'racks',amounts:[2,3],label:n=>`Stack ${n} racks in the warehouse`},
 pick:{piece:'orders',amounts:[1,2],label:n=>`Pick ${n} customer order${n===1?'':'s'}`},
 deliver:{piece:'deliveries',amounts:[1],label:n=>`Deliver ${n} plank order${n===1?'':'s'}`},
 replant:{piece:'saplings',amounts:[6,10],label:n=>`Plant ${n} saplings in a cleared block`}
});
// Piece pay in cents. Placeholders (DESIGN 4.15 K): the finished planks pay the most.
export const PIECE_PAY=Object.freeze({trees:300,stray:75,logs:25,gathered:25,stumps:150,planks:0,delivered:100,shipped:50,racks:500,orders:800,deliveries:2500,saplings:50}); // trees: a marked pine felled; stray: an unmarked one; logs: stacked at the landing; planks: milled (counted, paid on delivery); delivered: a plank at the lumberyard
export const BONUS_PER_RANK=2500;
export const REP={allTasks:5,fullShift:2,unfinishedTask:-2};
export const taskText=t=>TASKS[t.kind].label(t.target);

const absolute=p=>(p.housing.day-1)*1440+p.routine.minutes;
const dayEnd=(employer,day)=>(day-1)*1440+employer.hours.to;

// The day's tasks: 2 at rank 1, 3 at rank 2-3, 4 from rank 4; kinds rotate through the rank's pool by the shifts worked and the day, and the newest
// kind of the rank is always in (a promotion shows at once). Never random.
export function dailyTasks(employer,rank,shifts,day){
 const pool=taskKinds(employer,rank).filter(k=>TASKS[k]);if(!pool.length)return [];
 const count=Math.min(pool.length,rank>=4?4:rank>=2?3:2),start=(shifts*3+day)%pool.length,picked=[];
 const newest=employer.ranks.slice(0,rank).reverse().find(r=>r.tasks.some(k=>TASKS[k]))?.tasks.find(k=>TASKS[k]);if(newest)picked.push(newest);
 for(let i=0;picked.length<count&&i<pool.length;i++){const k=pool[(start+i)%pool.length];if(!picked.includes(k))picked.push(k)}
 return picked.map((kind,i)=>{const a=TASKS[kind].amounts;return {kind,piece:TASKS[kind].piece,target:a[(shifts+day+i)%a.length],done:0}});
}

export function normalizeShift(value,careers,map=MAP){
 const v=value&&typeof value==='object'?value:null;const e=v&&employerById(v.employer,map);if(!e||!careers?.[e.id]?.hired)return null;
 const n=(x,max)=>Number.isSafeInteger(x)&&x>=0&&x<=max?x:0;
 const tasks=(Array.isArray(v.tasks)?v.tasks:[]).filter(t=>TASKS[t?.kind]).slice(0,6).map(t=>{const target=Math.max(1,n(t.target,1000));return {kind:t.kind,piece:TASKS[t.kind].piece,target,done:Math.min(target,n(t.done,1000))}});
 const pieces={};for(const k of Object.keys(PIECE_PAY))if(n(v.pieces?.[k],1e6))pieces[k]=n(v.pieces[k],1e6);
 const truck=normalizeTruck(v.truck),gathered=(Array.isArray(v.gathered)?v.gathered:[]).filter(id=>Number.isSafeInteger(id)&&id>0).slice(-300);
 return {employer:e.id,day:Math.max(1,n(v.day,1e7)),startedAt:n(v.startedAt,1439),last:n(v.last,1e10),paidMinutes:n(v.paidMinutes,1440),offSiteMinutes:n(v.offSiteMinutes,1440),tasks,pieces,...(truck?{truck}:{}),...(gathered.length?{gathered}:{})};
}
export function normalizePayStubs(value){
 if(!Array.isArray(value))return [];const n=x=>Number.isSafeInteger(x)&&x>=0&&x<=1e10?x:0;
 return value.filter(s=>s&&typeof s==='object'&&typeof s.employer==='string').slice(0,STUBS_KEPT).map(s=>({employer:s.employer,name:typeof s.name==='string'?s.name.slice(0,40):'',day:n(s.day),from:n(s.from),to:n(s.to),paidMinutes:n(s.paidMinutes),wage:n(s.wage),piecePay:n(s.piecePay),bonus:n(s.bonus),total:n(s.total),tasksDone:n(s.tasksDone),tasksTotal:n(s.tasksTotal),reason:['clock-out','end-of-day','off-site'].includes(s.reason)?s.reason:'clock-out'}));
}

export function canClockIn(progress,id,map=MAP){
 const e=employerById(id,map);if(!e)return {error:'No such employer.'};
 const c=careerOf(progress,id);if(!c.hired)return {error:`You do not work for ${employerName(progress,id,map)}. Apply at their office.`};
 if(progress.shift)return {error:progress.shift.employer===id?'You are already clocked in.':`You are on a shift for ${employerName(progress,progress.shift.employer,map)}. Clock out first.`};
 const m=progress.routine.minutes;if(m<e.hours.from||m>e.hours.lastIn)return {error:'Shifts run from 6:00 AM to 6:00 PM; the last clock-in is 5:30 PM.'};
 if(c.lastShiftDay===progress.housing.day)return {error:'You have already worked a shift here today. Come back tomorrow.'};
 return {ok:true,employer:e};
}
export function clockIn(progress,id,map=MAP){
 const ok=canClockIn(progress,id,map);if(ok.error)return ok;
 const c=careerOf(progress,id),day=progress.housing.day,tasks=dailyTasks(ok.employer,c.rank,c.shifts,day);
 return {state:{...progress,shift:{employer:id,day,startedAt:progress.routine.minutes,last:absolute(progress),paidMinutes:0,offSiteMinutes:0,tasks,pieces:{}}},tasks};
}

// Pay for a shift: the wage for the minutes on site, the pieces, and the bonus when every task is done.
export function shiftPay(progress,shift=progress.shift,map=MAP){
 const e=employerById(shift.employer,map),rank=careerOf(progress,shift.employer).rank||1,r=e.ranks[rank-1];
 const wage=Math.round(shift.paidMinutes*r.wage/60),piecePay=Object.entries(shift.pieces).reduce((s,[k,n])=>s+(PIECE_PAY[k]||0)*n,0);
 const tasksDone=shift.tasks.filter(t=>t.done>=t.target).length,all=shift.tasks.length>0&&tasksDone===shift.tasks.length,bonus=all?BONUS_PER_RANK*rank:0;
 return {wage,piecePay,bonus,total:wage+piecePay+bonus,tasksDone,tasksTotal:shift.tasks.length,all};
}

export function clockOut(progress,reason='clock-out',map=MAP){
 const sh=progress.shift;if(!sh)return {error:'You are not clocked in.'};
 const id=sh.employer,e=employerById(id,map),pay=shiftPay(progress,sh,map),c=careerOf(progress,id);
 const counted=sh.paidMinutes>=MIN_COUNTED_SHIFT,full=sh.paidMinutes>=(e.hours.to-e.hours.from)/2;
 const repDelta=(pay.all?REP.allTasks:0)+(full?REP.fullShift:0)+REP.unfinishedTask*(pay.tasksTotal-pay.tasksDone);
 const endAbs=Math.min(sh.last,dayEnd(e,sh.day)),to=endAbs-(sh.day-1)*1440;
 const stub={employer:id,name:employerName(progress,id,map),day:sh.day,from:sh.startedAt,to:Math.max(sh.startedAt,to),paidMinutes:sh.paidMinutes,wage:pay.wage,piecePay:pay.piecePay,bonus:pay.bonus,total:pay.total,tasksDone:pay.tasksDone,tasksTotal:pay.tasksTotal,reason};
 let s={...progress,shift:null,cash:progress.cash+pay.total,routine:{...progress.routine,earned:(progress.routine.earned||0)+pay.total},payStubs:[stub,...(progress.payStubs||[])].slice(0,STUBS_KEPT),
  careers:{...progress.careers,[id]:{...c,shifts:c.shifts+(counted?1:0),lastShiftDay:sh.day}}};
 s=changeRep(s,id,repDelta);
 return {state:s,stub,repDelta,counted};
}

// Advance the shift to the save's clock. onSite: the player is in one of the employer's sites or in a company vehicle (the game decides; see onSiteAt).
// Ends the shift at closing time (or on a later day after a sleep skip) and after OFF_SITE_LIMIT minutes away.
export function tickShift(progress,{onSite},map=MAP){
 const sh=progress.shift;if(!sh)return {state:progress};
 const e=employerById(sh.employer,map),now=absolute(progress),end=dayEnd(e,sh.day),upTo=Math.min(now,end),dt=Math.max(0,upTo-sh.last);
 const next={...sh,last:Math.max(sh.last,upTo)};
 if(onSite){next.paidMinutes=Math.min(1440,sh.paidMinutes+dt);next.offSiteMinutes=0}else next.offSiteMinutes=Math.min(1440,sh.offSiteMinutes+dt);
 const s={...progress,shift:next};
 if(now>=end)return {...clockOut(s,'end-of-day',map)};
 if(next.offSiteMinutes>=OFF_SITE_LIMIT)return {...clockOut(s,'off-site',map)};
 return {state:s};
}

// A piece of work done on shift (a log at the landing, a plank milled, a load hauled...). Off shift it counts for nothing.
export function recordPiece(progress,piece,count=1){
 const sh=progress.shift;if(!sh||!(piece in PIECE_PAY)||!(count>0))return {state:progress,finished:[]};
 const finished=[];const tasks=sh.tasks.map(t=>{if(t.piece!==piece||t.done>=t.target)return t;const done=Math.min(t.target,t.done+count);if(done>=t.target)finished.push(taskText(t));return {...t,done}});
 return {state:{...progress,shift:{...sh,tasks,pieces:{...sh.pieces,[piece]:(sh.pieces[piece]||0)+count}}},finished};
}

// Is (x, z) or the room on one of the employer's sites? Zones and plots are rectangles from the map; rooms are interior scene ids.
export function onSiteAt(employerId,{x,z,room=null,inCompanyVehicle=false},map=MAP){
 const e=employerById(employerId,map);if(!e)return false;if(inCompanyVehicle)return true;
 return e.sites.some(s=>{if(s.room)return room===s.room;if(room&&room!=='street')return false;
  const r=s.zone?map.zones.find(zn=>zn.id===s.zone)?.bounds:map.reserved.find(p=>p.id===s.plot);return !!r&&x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1});
}
