// Customer trucks (0.35, DESIGN 4.15 K): the Load Truck task. When a shift's tasks include it, a customer's flatbed is due at the lumberyard a little after clock-in; it parks in
// the yard and waits to be loaded with its order of planks: from your hands (planks you made: they pay as delivered, $1.00 each), from your own truck's bed (the same), or from
// the company's stock on the pallets (already paid when they were delivered: these pay nothing more). When it is full you send it off at the cab: the shipped planks count for
// the task and pay $0.50 each; it drives away along the exit road and off the map. Unfilled at clock-out, it leaves without them. Pure: progress -> {state, ...} | {error}.
//   progress.shift.truck = {order (planks), loaded, stage: 'coming' | 'waiting' | 'gone', due (absolute game minutes)}
import {recordPiece} from './shift.js';
import {stockOf,addStock,EMPLOYER} from './forest.js';
import {takeAll,freeCount} from './cargo.js';

export const ARRIVE_AFTER=20; // game minutes after clock-in
// where the truck parks: in the timber yard, nose to the north, its bed's back toward the driveway
export const BAY=Object.freeze({x:87,z:52,yaw:Math.PI});
const absolute=p=>(p.housing.day-1)*1440+p.routine.minutes;
export const truckOf=p=>p.shift?.truck||null;
export const truckWaiting=p=>truckOf(p)?.stage==='waiting';
export const truckNeeds=p=>{const t=truckOf(p);return t?Math.max(0,t.order-t.loaded):0};
const setTruck=(p,patch)=>({...p,shift:{...p.shift,truck:{...p.shift.truck,...patch}}});
// After clock-in: a truck is due if today's tasks include loading one (its order is the task's number of planks).
export function scheduleTruck(progress){
 const sh=progress.shift,task=sh?.tasks.find(t=>t.kind==='load');if(!task||sh.employer!==EMPLOYER||sh.truck)return progress;
 return {...progress,shift:{...sh,truck:{order:task.target,loaded:0,stage:'coming',due:absolute(progress)+ARRIVE_AFTER}}};
}
export const truckDue=p=>{const t=truckOf(p);return !!t&&t.stage==='coming'&&absolute(p)>=t.due};
export const truckArrived=p=>truckOf(p)?.stage==='coming'?setTruck(p,{stage:'waiting'}):p;
export function normalizeTruck(v){if(!v||typeof v!=='object')return null;const n=(x,max)=>Number.isSafeInteger(x)&&x>=0&&x<=max?x:0,order=Math.max(1,n(v.order,1000));
 return {order,loaded:Math.min(order,n(v.loaded,1000)),stage:['coming','waiting','gone'].includes(v.stage)?v.stage:'coming',due:n(v.due,1e10)}}
const need=(p)=>{const t=truckOf(p);if(!t||t.stage!=='waiting')return {error:'No customer truck is waiting.'};if(t.loaded>=t.order)return {error:'The truck is loaded: send it off at the cab.'};return {left:t.order-t.loaded}};
// Planks in your hands onto the customer's truck (only what the order still needs; the rest stays in your hands).
export function loadFromHands(progress){
 const n=need(progress);if(n.error)return n;const c=progress.carry;if(c?.kind!=='planks')return {error:'Carry planks to load them.'};
 const take=Math.min(c.count,n.left),left=c.count-take,r=recordPiece(setTruck({...progress,carry:left?{kind:'planks',count:left}:null},{loaded:truckOf(progress).loaded+take}),'delivered',take);
 return {state:r.state,count:take,message:`${take} planks loaded · ${truckOf(r.state).loaded} of ${truckOf(r.state).order}`};
}
// A stack (up to four) from the company's stock on the pallets.
export function loadFromStock(progress){
 const n=need(progress);if(n.error)return n;const have=stockOf(progress).planks;if(!have)return {error:'The lumberyard has no planks in stock.'};
 const take=Math.min(4,n.left,have),s=setTruck(addStock(progress,{planks:-take}),{loaded:truckOf(progress).loaded+take});
 return {state:s,count:take,message:`${take} planks from the stock · ${truckOf(s).loaded} of ${truckOf(s).order} (${stockOf(s).planks} left in stock)`};
}
// Planks straight off your own truck's bed (as many as the order needs). Returns {state, cargo (what stays on your bed), count}.
export function loadFromBed(progress,cargo){
 const n=need(progress);if(n.error)return n;const have=freeCount(cargo,'planks');if(!have)return {error:'Your truck has no planks of your own on it.'};
 let take=Math.min(have,n.left),left=cargo;const all=takeAll(cargo,'planks');left=all.cargo;
 const back=have-take;if(back>0){left=[...(left||[])];let b=back;while(b>0){const k=Math.min(4,b);left.push({k:'planks',n:k});b-=k}} // what the order did not need goes back on your bed
 const r=recordPiece(setTruck(progress,{loaded:truckOf(progress).loaded+take}),'delivered',take);
 return {state:r.state,cargo:left&&left.length?left:null,count:take,message:`${take} planks moved to the customer's truck · ${truckOf(r.state).loaded} of ${truckOf(r.state).order}`};
}
// Send it off: only full. The shipped planks count for the task and pay $0.50 each.
export function sendOff(progress){
 const t=truckOf(progress);if(!t||t.stage!=='waiting')return {error:'No customer truck is waiting.'};
 if(t.loaded<t.order)return {error:`The order is ${t.order} planks: ${t.order-t.loaded} still to load.`};
 const r=recordPiece(setTruck(progress,{stage:'gone'}),'shipped',t.loaded);
 return {state:r.state,finished:r.finished,message:r.finished.length?`Task done: ${r.finished[0]}.`:`The truck is on its way with ${t.loaded} planks.`};
}

// The warehouse dock (0.35 step 3b, DESIGN 4.16 C): the customer's flatbed for a staged pickup order. It comes in from the map edge along Freight South, Freight Road and Oak Street East, down the
// inbound lane (x 156..164), parks along the warehouse's north wall with its bed against the loading door (heading east, the bed's middle at x 161.8), and leaves by the outbound lane (x 166..174),
// forward only. Visual only: the order's planks move by the ticket (tickets.js), not by the truck.
export const DOCK_BAY=Object.freeze({x:163.525,z:25.5,yaw:Math.PI/2});
export const dockRoute=exit=>({bay:DOCK_BAY,
 inPath:[...exit.in.slice(0,3),[196,62],[196,12],[192,8],[170,7.6],[162,9],[160,14],[160,20],[160.5,23.5],[162,25.5],[DOCK_BAY.x,DOCK_BAY.z]],
 outPath:[[DOCK_BAY.x,DOCK_BAY.z],[169,25.5],[171.5,22],[171,16],[170,10],[173,7.8],[190,7.8],[194,9],[194,60],[198,69],...exit.out.slice(1)]});
