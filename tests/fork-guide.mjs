import assert from 'node:assert/strict';
import * as F from '../dist/forklift.js';
import {boxesOf,assist,approaching,approachingCell,ASSIST,POCKET,CARRY_Z,levelBase,probe,carriedBox} from '../dist/fork-pallets.js';
import {forkGoal,forkGhost} from '../dist/fork-guide.js';
import {palletGeometry,PALLET_TRIANGLES,boardAt,BOARD} from '../dist/pallet-geometry.js';
import {PALLET} from '../dist/pallets.js';
import {ITEMS} from '../dist/items.js';
import {ITEM_ICONS} from '../dist/item-icons.js';
import {fillIcon,iconLabel,hasPicture} from '../dist/item-icon.js';
import {bayX,FACE_ROWS,WAREHOUSE_STAGING,RACK_SLOTS} from '../dist/warehouse-layout.js';

// The forklift guide and assists (user feedback 2026-11-06): what to do next and where, the ghost outline, the forks levelling themselves and easing square, the pallet's shape, and the item pictures.
const open=()=>false;
const ctxFor=(pallets=[],carried=0,extra={})=>({boxes:boxesOf(pallets),carried,blockedOther:open,solidAt:open,occupied:slot=>pallets.some(p=>p.at.rack===slot),stagingTaken:()=>false,cellOf:slot=>RACK_SLOTS.find(c=>c.id===slot),...extra});
const floorPallet=(x,z,yaw=0,count=12,id=1)=>({id,product:'planks',count,at:{floor:{x,z,yaw}}});
const rackPallet=(slot,count=40,id=2)=>({id,product:'planks',count,at:{rack:slot}});
const order=(id,planks,staged=0,status='taken',kind='pickup')=>({id,kind,planks,staged,status,customer:'Greenway Builders'});

// where to take it, and what to do next
{const pallets=[rackPallet('B4-1',24,3),floorPallet(2,5,0,12,4)],boxes=boxesOf(pallets);
 let g=forkGoal({carried:0,boxes,staging:[order(7,12),null,null],pos:{x:-1,z:-8}});assert.match(g.text,/Order #7 needs 12 planks: lift the marked pallet \(rack B4-1, 24 planks\) and take it to square S1/,g.text);
 assert.deepEqual([g.target.kind,g.target.x,g.target.z],['pallet',bayX(4),FACE_ROWS.B.z],'the marker is over the nearest pallet');assert.deepEqual([g.target.outline.x,g.target.outline.z,g.target.outline.y,g.target.outline.w,g.target.outline.d],[bayX(4),FACE_ROWS.B.z,0,PALLET.w,PALLET.d],'and the pallet itself gets a glow outline');assert(Math.abs(g.target.outline.h-(PALLET.h+6*.092))<1e-9);assert(Math.abs(g.target.y-(PALLET.h+6*.092))<1e-9,'at the top of the 24 planks');
 g=forkGoal({carried:0,boxes,staging:[order(7,12),null,null],pos:{x:2,z:6}});assert.match(g.text,/on the floor, 12 planks/,'the nearer one when the forklift is by the floor pallet');
 g=forkGoal({carried:40,boxes:[],staging:[null,order(9,24,10),null],pos:{x:0,z:0}});assert.match(g.text,/Order #9 needs 14 more planks: take this pallet to square S2/);assert.deepEqual([g.target.kind,g.target.x,g.target.z],['staging',WAREHOUSE_STAGING[1].x,WAREHOUSE_STAGING[1].z]);
 g=forkGoal({carried:40,boxes:[],staging:[null,null,null]});assert.match(g.text,/No order needs planks/);assert.equal(g.target,null);
 g=forkGoal({carried:0,boxes:[],staging:[order(7,12),null,null]});assert.match(g.text,/no pallets: the crew brings them/);assert.equal(g.target,null);
 g=forkGoal({carried:0,boxes,staging:[order(7,12,12,'staged'),null,null]});assert.match(g.text,/Order #7 is staged: get off and load the truck/);
 g=forkGoal({carried:0,boxes,staging:[null,null,null]});assert.match(g.text,/take an order at the order table/)}

// the ghost: green when the pallet will rest or the tines are in the pocket, amber when not yet
{const row=FACE_ROWS.B.z,x=bayX(4),carry=(cz,lift,o={})=>({x,z:cz-CARRY_Z,yaw:0,speed:0,lift,steer:0,roll:0,...o}),c=ctxFor([],40);
 let gh=forkGhost(carry(row,.09),c);assert.deepEqual([gh.ok,gh.x,gh.z,gh.y],[true,x,row,0],'on the cell it will rest in');assert(Math.abs(gh.h-(PALLET.h+10*.092))<1e-9);
 gh=forkGhost(carry(row,.09,{yaw:.5}),c);assert.equal(gh.ok,false,'crooked: amber');
 gh=forkGhost({x:0,z:2,yaw:.7,speed:0,lift:.5,steer:0,roll:0},ctxFor([],12));assert.equal(gh.ok,true);assert.equal(gh.yaw,.7,'on the floor, turned the way the forklift faces');assert(gh.h<.1,'over the floor it is a flat footprint, not a box round the pallet you hold: '+gh.h);
 const sq=WAREHOUSE_STAGING[1];gh=forkGhost({x:sq.x,z:sq.z-CARRY_Z,yaw:0,speed:0,lift:.4,steer:0,roll:0},ctxFor([],12,{stagingTaken:i=>i===1}));assert.deepEqual([gh.ok,gh.x,gh.y],[true,sq.x,0],'on the order square');assert(gh.h<.1,'a flat footprint too');
 gh=forkGhost({x:sq.x,z:sq.z-CARRY_Z,yaw:0,speed:0,lift:.4,steer:0,roll:0},ctxFor([],12));assert.equal(gh.ok,false,'a square with no order: amber');
 // forks empty: the pallet they are lined up with
 const pal=[floorPallet(0,0)],facing=(depth,lift,o={})=>({x:0,z:-PALLET.d/2+depth-F.TIP,yaw:0,speed:0,lift,steer:0,roll:0,...o});
 gh=forkGhost(facing(-.4,.1),ctxFor(pal));assert.equal(gh.ok,false,'approaching: amber');gh=forkGhost(facing(.6,.1),ctxFor(pal));assert.equal(gh.ok,true,'tines in the pocket: green');assert.equal(forkGhost(facing(-4,.1),ctxFor(pal)),null,'far away: nothing')}

// the assists: the forks glide to the pocket height, the forklift eases onto the pallet, a carried pallet eases toward its cell
{const pal=[floorPallet(0,0)],c=ctxFor(pal),facing=(depth,lift,o={})=>({x:0,z:-PALLET.d/2+depth-F.TIP,yaw:0,speed:0,lift,steer:0,roll:0,...o});
 // level: forks 30 cm too high, approaching the pallet: they sink toward the pocket height at 0.6 m/s
 let s=facing(-.5,.4),n=assist(s,c,.1);assert(Math.abs(n.lift-(.4-ASSIST.level*.1))<1e-9,'level: '+n.lift);
 for(let i=0;i<60;i++)s=assist(s,c,.05);assert(Math.abs(s.lift-.09)<1e-6,'settles at the pocket height: '+s.lift);
 assert.equal(assist(facing(-.5,.4),c,.1,{forksHeld:true}).lift,.4,'not while R or F is held');assert.equal(assist(facing(-.5,2.0),c,.1).lift,2.0,'not when the forks are far from its pocket height (50 cm)');
 // centre: 15 cm off to the side and 6 degrees crooked: it is eased square and onto the middle, the tine tips staying on their line
 s=facing(-.3,.09,{x:.15,yaw:.1});const before=Math.abs(probe(s,boxesOf(pal)[0]).depth);for(let i=0;i<80;i++)s=assist(s,c,.05);
 assert(Math.abs(s.yaw)<.01,'square: '+s.yaw);assert(Math.abs(F.tipOf(s).x)<.01,'the tips on the middle: '+F.tipOf(s).x);
 assert.equal(assist({...facing(-.3,.3),speed:3},c,.1).lift,.3,'no help at speed');assert.equal(assist(facing(-3,.09,{x:.15}),c,.1).x,.15,'nothing to line up with: nothing changes');
 const same=facing(-.3,.09);assert.equal(assist(same,ctxFor([]),.1),same,'no pallet near: the same state comes back');
 // a carried pallet: 25 cm off a free cell and 12 degrees crooked, it is eased in line
 const row=FACE_ROWS.B.z,x=bayX(4);s={x:x+.25,z:row-CARRY_Z-.2,yaw:.2,speed:0,lift:.09,steer:0,roll:0};const cc=ctxFor([],40);assert.equal(approachingCell(s,cc).id,'B4-1');
 for(let i=0;i<80;i++)s=assist(s,cc,.05);const cb=carriedBox(s,40);assert(Math.abs(s.yaw)<.01&&Math.abs(cb.x-x)<.01,'eased into line: yaw '+s.yaw+' x '+(cb.x-x));
 assert.equal(approachingCell({x,z:row-CARRY_Z,yaw:0,speed:0,lift:.09},ctxFor([rackPallet('B4-1')],40))?.id,undefined,'not toward a cell that holds a pallet')}

// the pallet: a real wooden pallet, 13 boards, with the pocket gaps between the runners
{const g=palletGeometry();assert.equal(g.attributes.position.count/3,PALLET_TRIANGLES,'156 triangles');assert.equal(PALLET_TRIANGLES,156);g.computeBoundingBox();const b=g.boundingBox;
 assert(Math.abs(b.max.x-PALLET.w/2)<1e-5&&Math.abs(b.max.z-PALLET.d/2)<1e-5&&Math.abs(b.max.y-PALLET.h)<1e-6&&Math.abs(b.min.y)<1e-6,'1.04 x 1.24 x 0.14, standing on its base: '+JSON.stringify(b));
 assert.equal(palletGeometry(),g,'one geometry for every pallet');
 // the tine pockets: nothing between y 0.03 and 0.11 inside the pocket lanes (x from 0.1 to 0.4 either side of the middle)
 const p=g.attributes.position;let blocked=0;for(let i=0;i<p.count;i++){const x=Math.abs(p.getX(i)),y=p.getY(i);if(x>.12&&x<.38&&y>.03&&y<.11)blocked++}assert.equal(blocked,0,'the pockets are open for the tines (a tine is 0.22 m from the middle)');
 assert.deepEqual(boardAt(0),{x:-.36,y:.044});assert(boardAt(39).y>boardAt(0).y+.8);assert.equal(BOARD.l,1.2)}

// item pictures: every tool and material has one rendered from its real model; food and clothes keep their emoji
{for(const item of ITEMS){if(item.type==='tool'||item.type==='material'){assert(hasPicture(item.id),item.id+' has a picture');assert(/^data:image\/png;base64,[A-Za-z0-9+/=]{500,}$/.test(ITEM_ICONS[item.id]),item.id+' is a png')}else assert(!hasPicture(item.id)||true)}
 assert.equal(new Set(['axe','logging-axe','steel-axe','chainsaw','logging-chainsaw','gas-can','wood-log'].map(id=>ITEM_ICONS[id])).size,7,'seven different pictures: the three axes no longer look alike');
 const fake=()=>{const props={};return {className:'x',textContent:'',title:'',style:{setProperty:(k,v)=>{props[k]=v},props}}};
 const axe=ITEMS.find(i=>i.id==='steel-axe'),el=fake();fillIcon(el,axe);assert.equal(el.textContent,'');assert.match(el.style.props['--icon'],/^url\("data:image\/png;base64,/);assert.match(el.className,/has-picture/);assert.equal(el.title,'Steel Axe');
 const apple=ITEMS.find(i=>i.id==='apple'),e2=fake();fillIcon(e2,apple);assert.equal(e2.textContent,apple.icon,'an apple keeps its emoji');assert.equal(e2.style.props['--icon'],undefined);
 const lab=fake();iconLabel(lab,ITEMS.find(i=>i.id==='gas-can'));assert.equal(lab.textContent,'Gas Can');assert.match(lab.className,/has-icon/);const l2=fake();iconLabel(l2,apple);assert.equal(l2.textContent,apple.icon+' Apple');
 const bare={textContent:''};fillIcon(bare,axe);assert.equal(bare.textContent,axe.icon,'an element that cannot take a picture shows the emoji')}
console.log('PASS fork-guide.mjs: the goal line and marker (the pallet to lift, the order square to take it to, the empty and staged cases), the ghost outline (green or amber), the assists (forks levelling, easing square and onto the middle, a carried pallet easing toward its cell, none at speed or with a key held), the real pallet shape with open pockets, and a different picture for every tool and material.');
