import assert from 'node:assert/strict';
import {boardEntries,boardText,boardPage,orderCard,destinationName,BOARD_PAGE} from '../dist/order-table.js';
import {DESTINATIONS} from '../dist/tickets.js';
import {employerById} from '../dist/careers.js';

// The order table's screens (playtest 2026-11-06): short buttons on the board, a card per order, Accept or Back.
const DAY=3,at=m=>(DAY-1)*1440+m,ranks=employerById('ridgeline').ranks,now=at(480);
const k=(id,kind,planks,status='open',extra={})=>({id,customer:['Greenway Builders','Alder Hardware','Eastbank Joinery','Cedar Heights Homes'][id%4],kind,planks,issuedAt:at(420),dueAt:kind==='pickup'?at(840):at(1440+1080),status,staged:0,...(kind==='delivery'?{dest:DESTINATIONS[0]}:{}),...extra});
const company=list=>({tickets:{nextId:20,day:DAY,released:[0,1,2,3],list}});
const ctx=(rank,co)=>({now,rank,ranks,company:co});

// an address, never an id
assert.match(destinationName(DESTINATIONS[0]),/^\d+ Cedar Loop, Cedar Heights$/);assert.equal(destinationName('nowhere'),'the customer');

// the board: yours first, then what you can take soonest-due first, then what needs a higher rank
{const co=company([k(1,'pickup',12,'open',{dueAt:at(900)}),k(2,'delivery',24),k(3,'pickup',40,'open',{dueAt:at(700)}),k(4,'pickup',12,'taken',{takenBy:'me',staged:4}),k(5,'pickup',12,'taken',{takenBy:'sam'}),k(6,'pickup',12,'done',{takenBy:'me'})]);
 const e=boardEntries(co,{now,rank:4,ranks});
 assert.deepEqual(e.map(x=>[x.id,x.kind]),[[4,'mine'],[3,'open'],[1,'open'],[2,'locked']],'yours, then soonest due, then locked; other people\'s and finished orders are not on the board');
 assert.match(e[0].label,/^#4 · .* · yours$/);assert.match(e[1].label,/^#3 · .* · 40 planks · pickup by 11:40 AM$/);assert.match(e[3].label,/^#2 · .* · needs Sawyer$/);
 assert.equal(boardText(e),'Tasks: 1 of yours · 2 to take · 1 for a higher rank. Pick one to see the details.');assert.match(boardText([]),/No tasks on the board right now/);
 assert.equal(boardEntries(co,{now,rank:5,ranks}).find(x=>x.id===2).kind,'open','a Sawyer can take the delivery')}
// paging: three buttons at most, and with more orders the last one is "More orders"
{const many=Array.from({length:7},(_,i)=>({id:i+1,kind:'open',label:'#'+(i+1)}));
 assert.equal(BOARD_PAGE,3);assert.deepEqual(boardPage(many.slice(0,3)).items.map(x=>x.id),[1,2,3]);assert.equal(boardPage(many.slice(0,3)).more,null,'three or fewer: no More button');
 let v=boardPage(many,0);assert.deepEqual(v.items.map(x=>x.id),[1,2]);assert.match(v.more.label,/More orders \(5 others\)/);assert.equal(v.more.page,1);
 v=boardPage(many,1);assert.deepEqual(v.items.map(x=>x.id),[3,4]);v=boardPage(many,3);assert.deepEqual(v.items.map(x=>x.id),[7]);assert.deepEqual(boardPage(many,v.more.page).items.map(x=>x.id),[1,2],'More on the last page goes round to the first');
 const seen=new Set();for(let p=0;p<4;p++)for(const x of boardPage(many,p).items)seen.add(x.id);assert.equal(seen.size,7,'every order is reachable')}

// the cards
{const co=company([k(1,'pickup',12),k(2,'delivery',24),k(3,'pickup',12,'taken',{takenBy:'me',staged:4}),k(4,'delivery',24,'staged',{takenBy:'me',staged:24}),k(5,'delivery',24,'loaded',{takenBy:'me',staged:24,vehicle:'v1'}),k(6,'pickup',12,'staged',{takenBy:'me',staged:12})]);
 const card=(id,rank=4)=>orderCard(co.tickets.list.find(x=>x.id===id),ctx(rank,co));
 let c=card(1);assert.equal(c.title,'Order #1');assert.equal(c.canAccept,true);assert.equal(c.mine,false);
 assert.match(c.text,/Pickup: their truck collects it at the loading door\./);assert.match(c.text,/Due by 2:00 PM\./);assert.match(c.text,/Pays \$8\.00 and \+1 reputation\. Late or missed: -3 reputation and the planks go back\./);assert.match(c.text,/Accept it and it goes on your task list with an arrow\./);assert(c.text.split('\n').length>=5,'one fact a line');
 c=card(2);assert.equal(c.canAccept,false,'a Yard hand cannot take a delivery');assert.match(c.text,/Delivery: you take it to \d+ Cedar Loop, Cedar Heights\./);assert.match(c.text,/Pays \$25\.00/);assert.match(c.text,/Needs a Sawyer \(rank 5\)\. You are a Yard hand/);assert(!/house-/.test(c.text));
 assert.equal(card(2,5).canAccept,true,'a Sawyer can');
 c=card(3);assert.equal(c.mine,true);assert.equal(c.canAccept,false);assert.match(c.next,/take planks from a pallet in the racks to square S1 \(4 of 12 staged\)/);assert(c.text.endsWith(c.next),'the next step is the last line');
 assert.match(card(4,5).next,/staged\. Park a truck with a bed outside the loading door/);assert.match(card(5,5).next,/on your truck\. Drive it to \d+ Cedar Loop, Cedar Heights and unload it there/);assert.match(card(6).next,/staged\. Load the customer.s truck at the loading door/)}
console.log('PASS order-table.mjs: the board lists your orders, then the ones you can take (soonest due first), then the ones for a higher rank, three buttons at a time with a More button; each order has a card with the customer, what to do, the address (never an id), the due time, the pay and the penalty, what rank it needs, and for your own orders what to do next; only an order you can take offers Accept.');
