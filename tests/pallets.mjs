import assert from 'node:assert/strict';
import {palletsOf,withPallets,racksMap,forkCount,totalPlanks,rackPallet,forkPallet,freeCells,addToRack,takeFromRackCell,liftPallet,setPallet,palletById,floorPallets,useForkPlanks,crewPutAway,putAwayOrder,normalizePallets,PALLET_CAP,MAX_FLOOR} from '../dist/pallets.js';
import {normalizeCompanies} from '../dist/careers.js';
import {tagCell,createPalletTags,TAG_MAX} from '../dist/pallet-tags.js';
import {RACK_SLOTS,DOCK_DOOR,HALL} from '../dist/warehouse-layout.js';

// Pallets (DESIGN 4.16 I): objects with a product and a count, one per rack cell, one on the forks, kept on the company.
// the old counts are read as pallets (a save or a test from before), in a fixed order with stable ids
{const old={racks:{'B4-2':40,'A1-1':12},forkload:7,name:'x'};const l=palletsOf(old);assert.equal(l.length,3);assert.deepEqual(l.map(p=>p.at),[{rack:'A1-1'},{rack:'B4-2'},{fork:true}]);assert.deepEqual(racksMap(old),{'A1-1':12,'B4-2':40});assert.equal(forkCount(old),7);assert.equal(totalPlanks(old),59);
 assert.deepEqual(palletsOf(old).map(p=>p.id),[1,2,3],'ids are stable');assert.equal(old.racks['A1-1'],12,'the input is never changed');
 const w=withPallets(old,l);assert.equal(w.racks,undefined);assert.equal(w.forkload,undefined);assert.equal(w.name,'x','the rest of the company is kept');assert.equal(withPallets(w,[]).pallets,undefined,'an empty list is not stored');assert.equal(totalPlanks(withPallets(w,[])),0)}
// stacking by hand: joins the pallet in the cell or starts one; a cell holds 40; the warehouse holds MAX_PALLETS
{let c={};let r=addToRack(c,'A1-1',12);assert.equal(r.put,12);assert.deepEqual(rackPallet(r.company,'A1-1'),{id:1,product:'planks',count:12,at:{rack:'A1-1'}});
 r=addToRack(r.company,'A1-1',40);assert.equal(r.put,28,'only what fits');assert.equal(racksMap(r.company)['A1-1'],PALLET_CAP);assert.equal(addToRack(r.company,'A1-1',4).put,0,'a full cell takes nothing');
 assert.equal(addToRack(c,'Z9-9',4).put,0,'no such cell');assert.equal(addToRack(c,'A1-1',0).put,0)}
// picking: the pallet shrinks and goes when empty
{let c=addToRack({},'C2-1',6).company;let r=takeFromRackCell(c,'C2-1',4);assert.equal(r.taken,4);assert.equal(racksMap(r.company)['C2-1'],2);r=takeFromRackCell(r.company,'C2-1',4);assert.equal(r.taken,2,'only what is there');assert.equal(rackPallet(r.company,'C2-1'),null,'an empty pallet is collected');assert.equal(takeFromRackCell(r.company,'C2-1',4).taken,0)}
// the forklift: lifts a pallet by its id from a cell or the floor (one at a time) and sets it down in an empty cell or on the floor; it shrinks and goes when its planks are used
{let c=addToRack(addToRack({},'A1-3',40).company,'B2-2',30).company;const id=rackPallet(c,'A1-3').id;
 let r=liftPallet(c,id);assert.equal(r.lifted,40);assert.equal(forkPallet(r.company).id,id);assert.equal(rackPallet(r.company,'A1-3'),null);assert.equal(liftPallet(r.company,rackPallet(c,'B2-2').id).lifted,0,'the forks carry one pallet');assert.equal(liftPallet(c,999).lifted,0,'no such pallet');
 assert.equal(palletById(r.company,id).count,40);assert.equal(palletById(c,12345),null);
 const into=setPallet(r.company,{rack:'E8-1'});assert.equal(into.placed,true);assert.equal(rackPallet(into.company,'E8-1').id,id,'the same pallet, in its new cell');assert.equal(forkPallet(into.company),null);
 const busy=setPallet(r.company,{rack:'B2-2'});assert.equal(busy.placed,false);assert.match(busy.error,/already holds/,'a cell holds one pallet');assert.equal(forkCount(busy.company),40,'it stays on the forks');
 assert.match(setPallet(r.company,{rack:'Z9-9'}).error,/no such rack/);assert.match(setPallet(c,{rack:'E8-1'}).error,/Nothing on the forks/);
 const down=setPallet(r.company,{floor:{x:1.234,z:-2.5,yaw:.7891}});assert.equal(down.placed,true);assert.deepEqual(palletById(down.company,id).at,{floor:{x:1.23,z:-2.5,yaw:.789}},'on the floor, turned the way it was set');assert.equal(floorPallets(down.company).length,1);assert.equal(forkPallet(down.company),null);
 assert.match(setPallet(r.company,{floor:{x:99,z:0,yaw:0}}).error,/No room/,'not outside the hall');assert.match(setPallet(r.company,{floor:{x:NaN,z:0,yaw:0}}).error,/No room/);
 const up=liftPallet(down.company,id);assert.equal(up.lifted,40,'a pallet on the floor can be lifted again');assert.deepEqual(forkPallet(up.company).at,{fork:true});
 const crowded=withPallets(r.company,[...palletsOf(r.company),...Array.from({length:MAX_FLOOR},(_,i)=>({id:100+i,product:'planks',count:4,at:{floor:{x:-15+(i%10)*3,z:-9+Math.floor(i/10)*3,yaw:0}}}))]);assert.match(setPallet(crowded,{floor:{x:0,z:0,yaw:0}}).error,/floor is full/);
 const used=useForkPlanks(r.company,12);assert.equal(forkCount(used),28);assert.equal(forkCount(useForkPlanks(used,99)),0);assert.equal(forkPallet(useForkPlanks(used,99)),null,'an empty pallet goes')}// the crew's put-away: the free cell nearest the roller door on the lowest level first, pallets of 40, the last one smaller; stops when the racks are full
{const order=putAwayOrder();assert(order.slice(0,24).every(s=>s.level===1),'the floor level first');const d=s=>Math.hypot(s.x-DOCK_DOOR.x,s.z-HALL.halfD);assert(d(order[0])<=d(order[1])&&d(order[1])<=d(order[2]),'nearest the door first');
 const r=crewPutAway({},100);assert.equal(r.placed,100);assert.equal(r.pallets,3);assert.deepEqual(palletsOf(r.company).map(p=>p.count),[40,40,20]);assert.deepEqual(r.cells,order.slice(0,3).map(s=>s.id));assert.equal(r.left,0);
 const again=crewPutAway(r.company,40);assert.equal(again.cells[0],order[3].id,'skips the cells in use');
 assert.equal(freeCells(r.company).length,117);
 const full=crewPutAway({},120*40+50);assert.equal(full.placed,4800);assert.equal(full.pallets,120);assert.equal(full.left,50,'the racks are full: the rest is left');assert.equal(crewPutAway(full.company,40).placed,0);assert.equal(crewPutAway({},0).company.pallets,undefined)}
// saved: clean entries only; old counts migrate on load and the old fields go
{const bad=normalizePallets([{id:1,product:'planks',count:900,at:{rack:'A1-1'}},{id:1,product:'planks',count:5,at:{rack:'A1-1'}},{id:2,product:'gold',count:5,at:{rack:'A2-1'}},{id:3,product:'planks',count:5,at:{rack:'Q9-9'}},{id:4,product:'planks',count:5,at:{fork:true}},{id:5,product:'planks',count:5,at:{fork:true}},{id:6,product:'planks',count:0,at:{rack:'A3-1'}},{id:7,product:'planks',count:2,at:{floor:{x:0,z:0}}},null,'x']);
 assert.deepEqual(bad.map(p=>[p.id,p.count,JSON.stringify(p.at)]),[[1,40,'{"rack":"A1-1"}'],[4,5,'{"fork":true}']],'a cell holds one pallet, 40 at most, the forks one, unknown products and places are dropped');
 const n=normalizeCompanies({ridgeline:{racks:{'B4-2':40,'bad':3},forkload:900,stock:{logs:1,planks:2}}}).ridgeline;assert.equal(n.racks,undefined);assert.equal(n.forkload,undefined);assert.deepEqual(n.pallets.map(p=>[p.count,JSON.stringify(p.at)]),[[40,'{"rack":"B4-2"}'],[40,'{"fork":true}']],'migrated');assert.deepEqual(n.stock,{logs:1,planks:2});
 const saved=normalizeCompanies({ridgeline:n}).ridgeline;assert.deepEqual(saved.pallets,n.pallets,'normalising twice changes nothing');assert.equal(normalizeCompanies({ridgeline:{pallets:[]}}).ridgeline,undefined)}
// floor pallets are saved too: position clamped into the hall, a missing or odd place dropped, at most MAX_FLOOR
{const f=normalizePallets([{id:1,product:'planks',count:12,at:{floor:{x:1.234,z:-2.5,yaw:.7891}}},{id:2,product:'planks',count:5,at:{floor:{x:99,z:-99,yaw:1}}},{id:3,product:'planks',count:5,at:{floor:{x:0,z:0}}},{id:4,product:'planks',count:5,at:{floor:'here'}}]);
 assert.deepEqual(f.map(p=>[p.id,p.at.floor.x,p.at.floor.z,p.at.floor.yaw]),[[1,1.23,-2.5,.789],[2,17,-11,1]],'kept, rounded and clamped into the hall; the ones without a position dropped');
 const many=normalizePallets(Array.from({length:MAX_FLOOR+8},(_,i)=>({id:i+1,product:'planks',count:3,at:{floor:{x:i%30-15,z:0,yaw:0}}})));assert.equal(many.length,MAX_FLOOR);
 assert.equal(totalPlanks({pallets:f}),17,'planks on the floor count as held');assert.deepEqual(racksMap({pallets:f}),{},'but are not in a rack')}
// the tag atlas: plate n of 1..40 sits in an 8 x 5 grid (read from the bottom); one instanced mesh for every pallet, only the nearest TAG_MAX drawn, within range
{assert.deepEqual(tagCell(1),{col:0,row:4});assert.deepEqual(tagCell(8),{col:7,row:4});assert.deepEqual(tagCell(9),{col:0,row:3});assert.deepEqual(tagCell(40),{col:7,row:0});assert.deepEqual(tagCell(99),tagCell(40));assert.deepEqual(tagCell(0),tagCell(1));
 const fakeCanvas=()=>({width:0,height:0,getContext:()=>new Proxy({},{get:(t,k)=>k==='measureText'?()=>({width:10}):()=>{},set:()=>true})});
 const tags=createPalletTags({makeCanvasFn:fakeCanvas});assert.equal(tags.mesh.isInstancedMesh,true);assert.equal(tags.max,TAG_MAX);
 const cam={quaternion:{x:0,y:0,z:0,w:1,isQuaternion:true,_x:0,_y:0,_z:0,_w:1}};
 const list=[...Array(30)].map((_,i)=>({x:i*.3,y:1,z:0,count:(i%40)+1,product:'planks'})).concat([{x:50,y:1,z:0,count:40,product:'planks'}]);
 const n=tags.update(list,{quaternion:new (await import('../dist/vendor/three.module.js')).Quaternion()},{x:0,z:0});assert.equal(n,TAG_MAX,'at most 24 are drawn');assert.equal(tags.mesh.count,TAG_MAX);assert(tags.shown.every(p=>p.x<=10),'only within 10 m');assert.equal(tags.shown[0].x,0,'the nearest first');
 assert.equal(tags.update([{x:50,y:1,z:0,count:3,product:'planks'}],{quaternion:new (await import('../dist/vendor/three.module.js')).Quaternion()},{x:0,z:0}),0,'nothing in range, nothing drawn')}
console.log('PASS pallets.mjs: pallets as objects (one per rack cell, one on the forks), old counts read and migrated and then dropped, stacking, picking (an empty pallet is collected), the forklift lifting a whole pallet and setting it down or merging, the crew\'s put-away (floor level first, nearest the door, pallets of 40), clean saves, and the one-draw-call tag atlas (24 nearest within 10 m).');
