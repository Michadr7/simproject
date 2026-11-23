// Diner game flow, pure (diner D-A2, notes/diner-design.md): the player's actions on a diner shift (take order, make, pick up, serve, bus) as progress -> progress, the spots the game offers, and the tracker hint. Placeholder food quality until the Station View (D-C).
import {DINER_ID,TABLES,MAX_TICKETS,MAX_CARRY,takeOrder,pickupOrder,serveOrder,busTable} from './diner-job.js';
import {recipeById} from './diner-recipes.js';
import {recordPiece} from './shift.js';
import {addXp} from './skills.js';

export const PASS=Object.freeze({x:1,z:-2.2}),MAKE=Object.freeze({x:-3.1,z:-8.0}),COUNTER_AT=Object.freeze({x:0,z:-2}),DINER_XP=Object.freeze({take:3,serve:6,bus:3,make:5}),TABLE_RANGE=1.8,SPOT_RANGE=1.35;
const ACTS_FOR=Object.freeze({take_order:['take'],serve_plate:['serve','pickup'],bus_table:['bus'],brew_drink:['make'],prep_food:['make'],combo_order:['make'],bake_pizza:['make'],rush_hour:['take','pickup','serve']});
export const dinerOf=p=>p?.shift?.employer===DINER_ID&&p.shift.diner?p.shift.diner:null;
const money=c=>'$'+(c/100).toFixed(2),tableName=id=>TABLES[id]?.name||'a table',nameOf=id=>recipeById(id)?.name||'order';
const rushNow=d=>{const m=(d.startMin+Math.floor(d.elapsedMin))%1440;return m>=690&&m<840};

// pieces: [[piece, count]]; xp: hospitality experience. Returns the state plus the task texts this finished.
function apply(p,d,pieces,xp){let s={...p,shift:{...p.shift,diner:d}};const finished=[];for(const [k,n] of pieces){const r=recordPiece(s,k,n);s=r.state;finished.push(...r.finished)}if(xp)s=addXp(s,'hospitality',xp).state;return {state:s,finished}}

// act: 'take' (ref table id), 'make' (ticket id; optional Station View result {ok,quality,tipCents,burnt}), 'pickup' (ticket id), 'serve' (ticket id), 'bus' (table id). -> {state, message, tipCents?, finished, sound} | {error}
export function dinerAct(p,act,ref,result=null){
 const d=dinerOf(p);if(!d)return {error:'You are not on a diner shift.'};
 if(act==='take'){const r=takeOrder(d,ref);if(r.error)return {error:r.error};const a=apply(p,r.state,[[r.piece,1]],DINER_XP.take);return {...a,sound:'ui-click',message:`${r.ticket.customerName}: ${nameOf(r.ticket.recipeId)}, please. (${tableName(ref)})`}}
 if(act==='make'){const t=d.tickets.find(x=>x.id===ref);if(!t||t.stage!=='open')return {error:'Nothing to make for that ticket.'};const rc=recipeById(t.recipeId);
  if(result&&(!result.ok||result.burnt)){const a=apply(p,d,[['failedOrders',1]],0);return {...a,failed:true,sound:'ui-toast',message:result.burnt?`${rc.name} burnt! Remake it or try again.`:`${rc.name} was incomplete. Remake it.`}}
  const pieces=[[rc.category==='drink'?'drinksBrewed':'foodPrepped',1],...(rc.category==='pizza'?[['pizzasBaked',1]]:[]),...(d.rank>=3?[['combos',1]]:[])];
  const next={...d,tickets:d.tickets.map(x=>x.id===ref?{...x,stage:'ready',...(result?{quality:result.quality,tipCents:result.tipCents}:{})}:x)};const a=apply(p,next,pieces,DINER_XP.make);return {...a,sound:'ui-click',message:`${rc.name} is ready on the pass.`}}
 if(act==='pickup'){const r=pickupOrder(d,ref);if(r.error)return {error:r.error};const t=d.tickets.find(x=>x.id===ref),a=apply(p,r.state,[],0);return {...a,sound:'ui-click',message:`Picked up the ${nameOf(t.recipeId)} for ${tableName(t.tableId)}.`}}
 if(act==='serve'){const t=d.tickets.find(x=>x.id===ref);if(!t)return {error:'Unknown ticket.'};if(!d.carried.includes(ref))return {error:'Pick the order up at the counter first.'};
  const r=serveOrder(d,ref);if(r.error)return {error:r.error};
  if(r.failed){const a=apply(p,r.state,[['failedOrders',1]],0);return {...a,sound:'ui-toast',tipCents:0,message:`${t.customerName} waited too long and left. Reputation -2.`}}
  const tip=Number.isFinite(t.tipCents)?t.tipCents:r.tipCents;
  const nextD={...r.state,tipsCents:r.state.tipsCents-r.tipCents+tip};
  const a=apply(p,nextD,[['platesServed',1],...(rushNow(d)?[['rushServed',1]]:[]),['tips',tip]],DINER_XP.serve);return {...a,sound:'cash-register',tipCents:tip,message:`Served ${t.customerName}. Tip ${money(tip)}.`}}
 if(act==='bus'){const r=busTable(d,ref);if(r.error)return {error:r.error};const a=apply(p,r.state,[[r.piece,1]],DINER_XP.bus);return {...a,sound:'ui-click',message:`${tableName(ref)} cleared.`}}
 return {error:'Unknown action.'};
}

// What the game offers on a diner shift, in the cafe's own coordinates: [{id, act, ref, x, z, range, label}] (empty off shift).
export function dinerSpots(p){
 const d=dinerOf(p);if(!d)return [];const out=[]; // mx, mz: where the floor marker stands (the aisle beside a table; the spot itself at the pass)
 for(const tb of d.tables){const spec=TABLES[tb.id],at={x:spec.x,z:spec.z,mx:spec.x<0?-2.55:2.55,mz:spec.z,range:TABLE_RANGE};
  if(tb.status==='seated'&&d.tickets.length<MAX_TICKETS)out.push({id:'take-'+tb.id,act:'take',ref:tb.id,...at,label:`Take the order · ${spec.name} (${tb.customer.name})`});
  else if(tb.status==='ordered'){const t=d.tickets.find(x=>x.id===tb.ticketId);if(t&&d.carried.includes(t.id))out.push({id:'serve-'+t.id,act:'serve',ref:t.id,...at,label:`Serve the ${nameOf(t.recipeId)} · ${spec.name}`})}
  else if(tb.status==='dirty')out.push({id:'bus-'+tb.id,act:'bus',ref:tb.id,...at,label:`Clear ${spec.name}`})}
 for(const t of d.tickets){
  if(t.stage==='ready'&&!d.carried.includes(t.id)&&d.carried.length<MAX_CARRY)out.push({id:'pickup-'+t.id,act:'pickup',ref:t.id,...PASS,mx:PASS.x,mz:PASS.z,range:SPOT_RANGE,label:`Pick up the ${nameOf(t.recipeId)} · ${tableName(t.tableId)}`});
  if(t.stage==='open')out.push({id:'make-'+t.id,act:'make',ref:t.id,...MAKE,mx:MAKE.x,mz:MAKE.z,range:2.2,label:`Make the ${nameOf(t.recipeId)} · ${tableName(t.tableId)}`})}
 return out;
}

// The next thing to do, as a title and a detail line for the objective card.
export function dinerHint(p){
 const d=dinerOf(p);if(!d)return null;const state=d.tables.map(t=>`${TABLES[t.id].name.replace('Table ','T')} ${{free:'free',seated:'waiting',ordered:'ordered',eating:'eating',dirty:'dirty'}[t.status]}`).join(' · ');
 const spots=dinerSpots(p),by=a=>spots.find(s=>s.act===a);
 const next=d.carried.length&&by('serve')?by('serve'):by('pickup')||by('make')||by('take')||by('bus');
 return {title:next?next.label:'Wait for customers',detail:state+' · tips so far '+money(d.tipsCents),spots,next:next||null};
}

// Where a shift task is done, in the cafe: the nearest spot of the right kind, else the counter (tracker.js, inside the cafe).
export function dinerTarget(kind,p,from){
 const acts=ACTS_FOR[kind]||[],hits=dinerSpots(p).filter(s=>acts.includes(s.act));
 if(!hits.length)return {pos:{x:COUNTER_AT.x,z:COUNTER_AT.z},place:'Counter'};
 const s=hits.reduce((b,x)=>!b||Math.hypot(x.x-from.x,x.z-from.z)<Math.hypot(b.x-from.x,b.z-from.z)?x:b,null);
 return {pos:{x:s.x,z:s.z},place:s.act==='pickup'?'Pass counter':s.act==='make'?'Kitchen counter':tableName(s.act==='serve'?tableOfTicket(p,s.ref):s.ref)};
}
const tableOfTicket=(p,id)=>dinerOf(p)?.tickets.find(t=>t.id===id)?.tableId;
export const DINER_KINDS=Object.freeze(Object.keys(ACTS_FOR));
