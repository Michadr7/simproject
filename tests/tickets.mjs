import assert from 'node:assert/strict';
import {RELEASES,CLOSE,MAX_TAKEN,MAX_LIST,FAIL_REP,DESTINATIONS,makeTicket,tickTickets,takeTicket,stagePlanks,shipTicket,loadTicket,deliverTicket,ticketsOf,openTickets,takenBy,normalizeTickets} from '../dist/tickets.js';
import {normalizeCompanies} from '../dist/careers.js';
import {normalizeProgress} from '../dist/jobs.js';

// Order tickets (0.35, DESIGN 4.16): released by the clock (never random), taken at the table by rank, staged, shipped or delivered; untaken ones expire
// at closing, taken ones fail at their deadline; every rule is pure company state + action, so a server can run it later.
const at=(day,min)=>(day-1)*1440+min,DAY=5,ME='me',SAM='sam';
const ids=c=>ticketsOf(c).list.map(k=>k.id);
// a full day's board (all four tickets) as it stands at 7:05 AM, for the rules below
const board=()=>({tickets:{nextId:5,day:DAY,released:[0,1,2,3],list:RELEASES.map((r,i)=>makeTicket(DAY,i,i+1))}}),EARLY=at(DAY,425);

// releases: nothing before 7:00; the 7:00 pickup at 7:00; all four by 1 PM; the same day twice gives the same tickets
{let c={};let r=tickTickets(c,{now:at(DAY,400)});assert.equal(r.released.length,0,'nothing before 7 AM');c=r.company;
 r=tickTickets(c,{now:at(DAY,420)});assert.equal(r.released.length,1);assert.equal(r.released[0].kind,'pickup');c=r.company;
 r=tickTickets(c,{now:at(DAY,420)});assert.equal(r.released.length,0,'released once');
 r=tickTickets(c,{now:at(DAY,800)});assert.deepEqual(r.released.map(k=>k.kind),['delivery','pickup','pickup']);c=r.company;assert.deepEqual(ids(c),[1,2,3,4]);
 const again=tickTickets(tickTickets({},{now:at(DAY,420)}).company,{now:at(DAY,800)}).company;assert.deepEqual(ticketsOf(again).list,ticketsOf(c).list,'the same day always gives the same tickets');
 const k=ticketsOf(c).list[0];assert.equal(k.issuedAt,at(DAY,420));assert(k.dueAt<=at(DAY,CLOSE)&&k.dueAt>k.issuedAt,'a pickup is due the same day');
 const d=ticketsOf(c).list.find(t=>t.kind==='delivery');assert(d.dueAt>=at(DAY+1,CLOSE)&&d.dueAt<=at(DAY+2,CLOSE),'a delivery has one or two days');assert(DESTINATIONS.includes(d.dest),'to a house: '+d.dest);
 assert.notDeepEqual(makeTicket(DAY,0,1),makeTicket(DAY+1,0,1),'another day, another order')}

// a save loaded late in the day does not release orders that are already past due; a sleep jump releases only today's
{const r=tickTickets({},{now:at(DAY,1000)});assert(r.released.every(k=>k.dueAt>at(DAY,1000)),'only orders that can still be done');assert(!r.released.some(k=>k.issuedAt===at(DAY,420)),'the 7 AM pickup (due 11 AM or noon) is skipped')
 const night=tickTickets({},{now:at(DAY,CLOSE+30)});assert.equal(night.released.length,0,'nothing after closing')}

// taking: rank 4 for pickups, 5 for deliveries, at most three, only open and in time
{let c=board();const [p1,dl,p2,p3]=ticketsOf(c).list;const now=EARLY;
 assert(/Yard hands/.test(takeTicket(c,{id:p1.id,playerId:ME,rank:3,now}).error),'rank 3 cannot take a pickup');
 assert(/Sawyers/.test(takeTicket(c,{id:dl.id,playerId:ME,rank:4,now}).error),'rank 4 cannot take a delivery');
 let r=takeTicket(c,{id:p1.id,playerId:ME,rank:4,now});assert(!r.error,r.error);c=r.company;assert.equal(ticketsOf(c).list[0].status,'taken');assert.equal(ticketsOf(c).list[0].takenBy,ME);
 assert(/already have/.test(takeTicket(c,{id:p1.id,playerId:ME,rank:4,now}).error));assert(/no longer on the board/.test(takeTicket(c,{id:p1.id,playerId:SAM,rank:4,now}).error),'one ticket, one taker');
 c=takeTicket(c,{id:p2.id,playerId:ME,rank:5,now}).company;c=takeTicket(c,{id:dl.id,playerId:ME,rank:5,now}).company;assert.equal(takenBy(c,ME).length,MAX_TAKEN);
 assert(/hold 3 tickets/.test(takeTicket(c,{id:p3.id,playerId:ME,rank:5,now}).error),'at most three');assert(!takeTicket(c,{id:p3.id,playerId:SAM,rank:4,now}).error,'another player may take the fourth');
 assert.deepEqual(openTickets(c).map(k=>k.id),[p3.id])}

// staging, shipping a pickup, loading and delivering a delivery; effects name the player and the piece
{let c=board();const [p1,dl]=ticketsOf(c).list,now=EARLY;
 c=takeTicket(c,{id:p1.id,playerId:ME,rank:5,now}).company;c=takeTicket(c,{id:dl.id,playerId:ME,rank:5,now}).company;
 assert(/Stage every plank/.test(shipTicket(c,{id:p1.id,playerId:ME,now}).error),'not before it is staged');
 let r=stagePlanks(c,{id:p1.id,count:4,now});assert.equal(r.used,4);c=r.company;assert.equal(ticketsOf(c).list[0].staged,4);
 r=stagePlanks(c,{id:p1.id,count:999,now});assert.equal(r.used,p1.planks-4,'never more than the order');c=r.company;assert.equal(ticketsOf(c).list[0].status,'staged');assert(/fully staged/.test(stagePlanks(c,{id:p1.id,count:1,now}).error));
 r=shipTicket(c,{id:p1.id,playerId:ME,now});assert(!r.error);c=r.company;assert.equal(ticketsOf(c).list[0].status,'done');assert.deepEqual(r.effects,[{playerId:ME,piece:'orders',rep:1}],'the shipper is paid the order');
 c=stagePlanks(c,{id:dl.id,count:dl.planks,now}).company;assert(/Load the order/.test(deliverTicket(c,{id:dl.id,playerId:ME,dest:dl.dest,now}).error));
 c=loadTicket(c,{id:dl.id,vehicle:'v1',now}).company;assert.equal(ticketsOf(c).list[1].vehicle,'v1');
 assert(/not the delivery address/.test(deliverTicket(c,{id:dl.id,playerId:ME,dest:'nowhere',now}).error));
 r=deliverTicket(c,{id:dl.id,playerId:ME,dest:dl.dest,now:at(DAY+1,600)});assert(!r.error,r.error);assert.deepEqual(r.effects,[{playerId:ME,piece:'deliveries',rep:1}],'a delivery can finish the next day')}

// expiry and failure: untaken tickets expire at closing with no effect; taken ones fail at their deadline and cost the taker reputation; old finished ones are forgotten
{let c=board();const [p1,dl,p2]=ticketsOf(c).list,now=EARLY;
 c=takeTicket(c,{id:p1.id,playerId:ME,rank:5,now}).company;c=takeTicket(c,{id:dl.id,playerId:SAM,rank:5,now}).company;
 let r=tickTickets(c,{now:p1.dueAt});assert.deepEqual(r.failed.map(k=>k.id),[p1.id]);assert.deepEqual(r.effects,[{playerId:ME,rep:FAIL_REP}]);c=r.company;
 r=tickTickets(c,{now:at(DAY,CLOSE)});assert(r.expired.some(k=>k.id===p2.id),'an untaken ticket expires at closing');assert.deepEqual(r.effects,[],'without a penalty');c=r.company;
 assert.equal(ticketsOf(c).list.find(k=>k.id===dl.id).status,'taken','a taken delivery carries over to the next day');
 r=tickTickets(c,{now:at(DAY+1,300)});c=r.company;assert(!ticketsOf(c).list.some(k=>k.id===p1.id||k.id===p2.id),'yesterday\'s finished tickets are gone');assert(ticketsOf(c).list.some(k=>k.id===dl.id),'the delivery is still there');
 r=tickTickets(c,{now:dl.dueAt});assert.deepEqual(r.effects,[{playerId:SAM,rep:FAIL_REP}],'its taker pays for a missed delivery')}

// many days without finishing anything never grows the list past its cap
{let c={};for(let d=1;d<=30;d++)for(const m of [420,600,800,CLOSE])c=tickTickets(c,{now:at(d,m)}).company;assert(ticketsOf(c).list.length<=MAX_LIST)}

// saving: through the company, junk dropped
{let c=board();c=takeTicket(c,{id:1,playerId:ME,rank:4,now:EARLY}).company;
 const saved=normalizeProgress({careers:{ridgeline:{hired:true,rank:4}},companies:{ridgeline:c}});assert.deepEqual(saved.companies.ridgeline.tickets,ticketsOf(c),'tickets survive a save');
 const bad=normalizeTickets({nextId:-4,list:[{id:1,kind:'pickup',status:'weird',customer:'x'},{id:'2'},{id:3,kind:'pickup',status:'open',customer:'Y',planks:9e9,staged:-2,dest:'mars'}]});
 assert.deepEqual(bad.list.map(k=>k.id),[3]);assert.equal(bad.list[0].planks,1,'absurd numbers are clamped away');assert.equal(bad.list[0].dest,undefined);assert(bad.nextId>3);
 assert.equal(normalizeTickets(null),null);assert.deepEqual(normalizeCompanies({ridgeline:{tickets:{list:[]}}}),{},'an empty board saves nothing')}
console.log('Tickets: released by the clock (the same every time, nothing past due or after closing), taken by rank (4 pickups, 5 deliveries, at most three, one taker each), staged, shipped and delivered with effects naming the player, expired untaken at closing without penalty, failed taken past the deadline with a reputation cost, deliveries carried over a day, the list capped, and saved on the company.');
