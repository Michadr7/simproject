// Bridge between the game's old gig hooks (the names the old contracts module used; it is deleted) and gigs.js (notes/gigs-starter-design.md section 3).
// game.js, phone.js and objective.js keep calling acceptContract, tickContract, completeContract, availableContracts and gigTarget; the new
// rules live in gigs.js. progress.gigs.active is the truth; progress.activeJob is a derived VIEW of it (title, stage, locations), rebuilt after every change here.
// The board is derived from counters, so refreshGigBoard has nothing to do. Walking types only: the vehicle types wait for the vehicle work.
import {isBakeryGood,GOODS as BAKERY_GOODS} from './bakery-goods.js';
import {dropParcel,pickParcel} from './gig-parcel.js';import {PARCEL_PIECES_ENABLED,removeParcelPieces,fromLegacyParcel,toLegacyCarry} from './cargo-items.js';import {boardFor,acceptGig,tickGig,completeGig,gigDone,typeById,payFor,doneTodayOf,noMoreWork,NO_MORE_WORK,townContext,gameMinutes,GIG_TYPES,BOARD_SLOTS,parRoute,doorChoices,doorHint,pickNeedHaul,deliverHaul,abandonGig,settleNeed,slotOffer,needOf,needReward,needsPickup,NO_WORK_POSTED,hasCrateBed,atPickup,pickedUp,pickUpGig} from './gigs.js';
export {NO_WORK_POSTED,hasCrateBed};
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
 const bakery=a.needId&&isBakeryGood(a.needGood);
 const bakeryText=bakery?(a.haul>0?' Deliver the '+BAKERY_GOODS[a.needGood].label.toLowerCase()+' to Ironwood Bakery.':a.mode==='vehicle'?' Park at Eden Wholesale’s dock and load the pallet.':' Pick up a sack at Eden Wholesale.'):'';
 const need=!!a.needId,pick=needsPickup(a),boxWaits=!need&&!pickedUp(a); // G-D: boxWaits = the parcel is still at the pickup point; the marker leads there first and the text says so. // W-D2: a need gig reads its own title and text, pays by needPay, and its marker leads to the farm pile until the crates are on the truck
 return {id:'gig-'+a.id,type:a.type,title:need?(a.needTitle||t.title):`${t.title} for ${nameOf(a.client)}`,description:need?(a.needText||'')+(bakeryText||(pick?(a.needGood==='planks'?' Load the planks at the sawmill (E), then deliver them.':' Load the crates at the pile (E), then bring them to the market door.'):a.haul>0?(a.needGood==='planks'?' Planks loaded: deliver them.':' Crates loaded: take them to the market door.'):'') ):(boxWaits?`Pick up the parcel at ${a.origin.name||'the pickup point'}. Then `+stopsText(a.places).replace(/^Go/,'go'):stopsText(a.places))+' '+t.twist+'.'+doorHint(a.type,a.client,nameOf(a.client)),reward:need?(needOf(p,a)?needReward(p,needOf(p,a),a.mode,a.parM,now):a.needReward||0):payFor(a.type,100,doneTodayOf(p.gigs,now),p.gigs.rep,0,a.large,a.origin?a.parM:null,a.starter),mode:'delivery',
  stage:done?'return':a.visited.some(Boolean)?'task':'travel',location:pick||boxWaits?point(a.origin):point(next),pickup:boxWaits,pickupName:boxWaits?(a.origin.name||''):'',taskLocation:point(next),returnLocation:point(last),kind:a.type,stops:a.places.length,left:a.places.length-a.visited.filter(Boolean).length,done:a.visited.filter(Boolean).length,dueAt:a.dueAt,dropped:!!a.drop};
}
const withView=p=>({...p,activeJob:activeView(p)});
// What the board slot offers (the phone card reads title, description, reward, terms).
function offer(p,s){
 const t=typeById(s.type),now=gameMinutes(p),large=s.large;
 if(s.needId){const o=slotOffer(p,s,now);return {id:slotId(s.slot),title:s.title,description:s.description,reward:o.reward,terms:o.terms,mode:'delivery',blocked:s.blocked||''}} // W-D2: a world need
 return {id:slotId(s.slot),title:`${t.title} for ${s.clientName||nameOf(s.client)}`,description:stopsText(s.places)+' '+t.twist+'.'+doorHint(s.type,s.client,s.clientName||nameOf(s.client)),reward:payFor(s.type,100,doneTodayOf(p.gigs,now),p.gigs.rep,0,large,s.parM,s.starter),terms:t.limit?`${t.limit} min limit`:'No time limit',mode:'delivery'};
}
// Walking types only, until the vehicle gigs have their cargo and knock code.
const LIVE=new Set(GIG_TYPES.filter(t=>t.live!==false).map(t=>t.id));
const liveBoard=(p,opts)=>boardFor(p,gameMinutes(p),undefined,opts).filter(s=>LIVE.has(s.type));
// The beat-8 starter gigs (exempt from minimum par and fatigue): offers for the phone, and accept with acceptContract(p,id,position,{starter:true}).
export const starterContracts=p=>p.activeJob||p.gigs?.active?[]:liveBoard(p,{starter:true}).slice(0,2).map(s=>offer(p,s));
export const CONTRACTS=Object.freeze([0,1,2,3].map(i=>Object.freeze({id:slotId(i),title:'Gig',description:'',reward:0,terms:'',mode:'delivery'})));
export const contractById=id=>CONTRACTS.find(c=>c.id===id);
export const refreshGigBoard=progress=>progress;
// The story's gig beat (starter.js steps 6 and 7, until a gig is done): the phone shows the two starter gigs, not the open-needs board (which is empty for a new player: W-D2 made the normal board the needs list and nothing asked for the starter board).
export const starterGigBeat=p=>{const s=p?.starter;return !!s&&!s.done&&(s.step===6||s.step===7)&&!s.gigDone};
export const availableContracts=p=>p.activeJob||p.gigs?.active?[]:starterGigBeat(p)?starterContracts(p):liveBoard(p).map(s=>offer(p,s));
export function acceptContract(p,id,position=null,opts={}){
 const i=slotOf(id),starter=opts?.starter===true||(opts?.starter===undefined&&starterGigBeat(p));if(i<0)return {error:'This gig is unavailable.'};
 if(!starter&&noMoreWork(p))return {error:NO_MORE_WORK}; // the daily hard stop (the board is empty then too)
 if(!liveBoard(p,{starter}).some(s=>s.slot===i))return {error:'This gig is unavailable.'};
 const r=acceptGig(p,i,gameMinutes(p),undefined,position&&Number.isFinite(position.x)&&Number.isFinite(position.z)?{x:position.x,z:position.z}:null,{starter});return r.error?r:{state:withView(r.state)};
}
// What Noah's counter offers: the grocery and parcel gigs of the board.
export const marketContracts=p=>p.activeJob||p.gigs?.active?[]:liveBoard(p).filter(s=>s.type==='grocery'||s.type==='parcel'||!!s.needId).map(s=>offer(p,s));
// W-D2: the egg run. Load at the farm pile / hand over at the market door (gigs.js has the rules); the derived view is rebuilt after each.
const view=r=>r.error?r:{...r,state:withView(r.state)};
export const pickNeedCrates=(p,opts={})=>view(pickNeedHaul(p,gameMinutes(p),opts));
export const deliverNeedCrates=(p,opts={})=>view(deliverHaul(p,gameMinutes(p),opts));
export const abandonContract=(p,pieces=PARCEL_PIECES_ENABLED)=>view(abandonGig(p,pieces)); // the gig's parcel piece goes with it (hands and every bed) when pieces are on
export const settleNeedGig=p=>{const r=settleNeed(p);return r.text?{...r,state:withView(r.state)}:r};
export const gigTarget=job=>job.stage==='return'?job.returnLocation:job.location;
export function tickContract(p,{position,room='street',dt=0,moving=false,distance=0}){
 if(!p.gigs?.active)return p;
 const before=p.gigs.active.visited.join(),next=tickGig(p,{position,room,dt,moving,metres:distance,now:gameMinutes(p),requirePickup:true});
 return next.gigs.active&&next.gigs.active.visited.join()===before&&p.activeJob?{...next,activeJob:p.activeJob}:withView(next);
}
// The round's par: the shortest order of the three stops from where you accepted, plus slack because streets are not straight lines.
export const PAR_SLACK=1.2;
export const parFor=p=>{const a=p.gigs?.active;return a?.type==='round'&&a.start&&a.places.length>1?Math.round(parRoute(a.places,a.start).length*PAR_SLACK):0};
// The parcel's door dialog: null for any other gig, else the client's name and the three ways to greet them (each with the tip it earns).
export const gigDoor=p=>{const a=p.gigs?.active,choices=doorChoices(a);return choices?{name:nameOf(a.client),text:'You are at the door. How do you greet '+nameOf(a.client)+'?',choices}:null};
// X and E on the parcel: the pure drop/pick, with the derived activeJob view rebuilt (tickContract would keep a stale one).
export const dropGigParcel=(p,at,pieces=PARCEL_PIECES_ENABLED)=>{const r=dropParcel(p,at);if(r.error)return r;const a=p.gigs.active;return {...r,state:withView(pieces?removeParcelPieces(r.state,a.id):r.state)}}; // pieces: the parcel in the hands becomes the ground drop
export const pickGigParcel=(p,pieces=PARCEL_PIECES_ENABLED)=>{const r=pickParcel(p);if(r.error)return r;const item=pieces?fromLegacyParcel(r.state.gigs.active):null;return {...r,state:withView(item?{...r.state,carry:toLegacyCarry(item)}:r.state)}}; // pieces: the picked-up parcel is in the hands as a piece
// G-D: E at the pickup point (within PICKUP_RADIUS_M, same room) takes the box; the on-time and too-fast clocks start now. gigPickupHere is what the world prompt asks.
export const gigPickupHere=(p,position,room='street')=>{const a=p.gigs?.active;return !!a&&!a.needId&&atPickup(a,position,room)};
export function pickUpGigBox(p,position,room='street',pieces=PARCEL_PIECES_ENABLED){
 if(!gigPickupHere(p,position,room))return {error:'You are not at the pickup point.'};
 if(p.carry)return {error:'Your hands are full. Put it down first (X).'};
 const r=pickUpGig(p,gameMinutes(p));if(r.error)return r;const item=pieces?fromLegacyParcel(r.state.gigs.active):null;return {state:withView(item?{...r.state,carry:toLegacyCarry(item)}:r.state),message:'You pick up the parcel. The clock is running.'};
}
export function completeContract(p,position,room='street',tip=0,pieces=PARCEL_PIECES_ENABLED){
 const job=activeView(p);if(!job||job.stage!=='return'||!atGigPoint(position,room,job.returnLocation))return {error:'Complete the task and return to the marked contact first.'};
 const r=completeGig(p,gameMinutes(p),{tip,par:parFor(p),pieces});return r.error?r:{state:withView(r.state),paid:r.paid,failed:!!r.failed,closed:!!r.closed};
}