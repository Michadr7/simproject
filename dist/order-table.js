// The order table's screens (user feedback 2026-11-06: a list of Tasks, click one for its info, then Accept or Go back). Pure: the board lists the orders as short buttons,
// a click opens that order's card (who it is for, what to do, where, when, what it pays, the rank it needs), and the card offers Accept or Back. game.js draws it with the in-world dialog.
import {MAP,zoneById} from './map-definition.js';
import {dueText,TAKE_RANK,DONE_REP,FAIL_REP,openTickets,takenBy,stagingOf} from './tickets.js';
import {PIECE_PAY} from './shift.js';
import {money} from './jobs.js';

export const BOARD_PAGE=3; // buttons on one screen of the board (with more orders, the last button is "More orders")
// a house a delivery goes to, as a person would say it: "3 Cedar Loop, Cedar Heights" (never the id)
export function destinationName(id){
 const p=(MAP.properties||[]).find(x=>x.id===id);if(!p)return 'the customer';
 const lm=(MAP.landmarks||[]).find(l=>l.id===(p.landmark||p.id)),zone=lm?.zone?zoneById(lm.zone)?.name:null;
 return zone?`${p.name}, ${zone}`:p.name;
}
const rankName=(ranks,rank)=>ranks[rank-1]?.name||('rank '+rank);

// The board: your orders first, then the open ones you can take (soonest due first), then the ones that need a higher rank.
// Returns [{id, kind:'mine'|'open'|'locked', label}] for every order; game.js shows BOARD_PAGE at a time.
export function boardEntries(company,{now,rank,ranks,playerId='me'}){
 const locked=k=>rank<TAKE_RANK[k.kind],due=k=>dueText(k,now);
 const mine=takenBy(company,playerId).sort((a,b)=>a.id-b.id).map(k=>({id:k.id,kind:'mine',label:`#${k.id} · ${k.customer} · yours`}));
 const open=openTickets(company).sort((a,b)=>locked(a)-locked(b)||a.dueAt-b.dueAt).map(k=>locked(k)
  ?{id:k.id,kind:'locked',label:`#${k.id} · ${k.customer} · needs ${rankName(ranks,TAKE_RANK[k.kind])}`}
  :{id:k.id,kind:'open',label:`#${k.id} · ${k.customer} · ${k.planks} planks · ${k.kind==='pickup'?'pickup':'delivery'} ${due(k)}`});
 return [...mine,...open];
}
// The board's short text above the buttons.
export function boardText(entries){
 const mine=entries.filter(e=>e.kind==='mine').length,open=entries.filter(e=>e.kind==='open').length,locked=entries.filter(e=>e.kind==='locked').length;
 if(!entries.length)return 'No tasks on the board right now: new ones are put up during the shift.';
 const parts=[];if(mine)parts.push(`${mine} of yours`);if(open)parts.push(`${open} to take`);if(locked)parts.push(`${locked} for a higher rank`);
 return `Tasks: ${parts.join(' · ')}. Pick one to see the details.`;
}
// one page of the board: up to BOARD_PAGE buttons; when there are more orders than that, the last button is "More orders" (it goes to the next page, round to the start)
export function boardPage(entries,page=0){
 if(entries.length<=BOARD_PAGE)return {items:entries,more:null};
 const size=BOARD_PAGE-1,pages=Math.ceil(entries.length/size),p=((page%pages)+pages)%pages;
 return {items:entries.slice(p*size,p*size+size),more:{page:p+1,label:`More orders (${entries.length-size} others)`}};
}

// The card for one order. ctx: {now, rank, ranks, company}. Returns {title, text, canAccept, mine, next} where `next` is what to do now (for an order you hold) or null.
export function orderCard(k,{now,rank,ranks,company}){
 const pickup=k.kind==='pickup',pay=money(pickup?PIECE_PAY.orders:PIECE_PAY.deliveries),need=TAKE_RANK[k.kind],locked=rank<need;
 const mine=['taken','staged','loaded'].includes(k.status),sq=stagingOf(company).findIndex(s=>s&&s.id===k.id);
 let next=null;
 if(k.status==='taken')next=`Fill it: take planks from a pallet in the racks to square S${sq+1} (${k.staged} of ${k.planks} staged).`;
 else if(k.status==='staged')next=pickup?'It is staged. Load the customer’s truck at the loading door.':'It is staged. Park a truck with a bed outside the loading door and load it there.';
 else if(k.status==='loaded')next=`It is on your truck. Drive it to ${destinationName(k.dest)} and unload it there.`;
 const lines=[
  `${k.customer} · ${k.planks} planks`,
  pickup?'Pickup: their truck collects it at the loading door.':`Delivery: you take it to ${destinationName(k.dest)}.`,
  `Due ${dueText(k,now)}.`,
  `Pays ${pay} and +${DONE_REP} reputation. Late or missed: ${FAIL_REP} reputation and the planks go back.`
 ];
 if(k.status==='open'){lines.push(locked?`Needs a ${rankName(ranks,need)} (rank ${need}). You are a ${rankName(ranks,rank)}: keep working shifts to get there.`:'Accept it and it goes on your task list with an arrow.')}
 else if(next)lines.push(next);
 return {title:`Order #${k.id}`,text:lines.join('\n'),canAccept:k.status==='open'&&!locked,mine,next};
}
