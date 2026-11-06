// Axes (0.35 step 5, DESIGN 4.15 F): the ladder of swings, the level a purchase needs (shops and the phone), the company handing out the tiers, and the converted models
// (handle along +z, head at the far end, edge down, a sane size) in the held-item frame.
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {AXES,AXE_IDS,isAxe,isSaw,SAW_IDS,hitsFor,bestAxe,equippedAxe,PINE_TOUGHNESS} from '../dist/tools.js';
import {SAWS as SAW_MESHES} from '../dist/saw-assets.js';
import {isBuyable} from '../dist/items.js';
import {hire,promote,storeItems,storeLine,buyFromCompany,careerOf} from '../dist/careers.js';
import {orderable} from '../dist/orders.js';
import {AXES as MESHES} from '../dist/axe-assets.js';
import {itemById,ITEMS} from '../dist/items.js';
import {freshProgress} from '../dist/jobs.js';
import {addItem,requirementError,equipTool,hotbarItems} from '../dist/inventory.js';
import {placeOrder,STUDIO_ID} from '../dist/orders.js';
import {createHeldItem,disposeHeldItem} from '../dist/item-models.js';
import {xpForNext} from '../dist/skills.js';
import {MAP} from '../dist/map-definition.js';

assert.deepEqual(AXE_IDS,['axe','logging-axe','steel-axe']);assert(isAxe('axe')&&!isAxe('apple')&&!isAxe('toString')&&!isAxe(undefined));
// the ladder: each tier is worth a rung, and levels shave swings off
assert.deepEqual(['axe','logging-axe','steel-axe'].map(id=>hitsFor(id,1)),[4,3,2],'tier 1, 2, 3 at level 1');
assert.equal(hitsFor('axe',1),4);assert.equal(hitsFor('axe',20),3,'a starter axe never gets to two');assert.equal(hitsFor('logging-axe',5),3);assert.equal(hitsFor('steel-axe',10),2);assert.equal(hitsFor('steel-axe',20),2);
for(const id of AXE_IDS)for(let l=1;l<20;l++)assert(hitsFor(id,l)>=hitsFor(id,l+1),`${id}: a higher level never needs more swings`);
for(let l=1;l<=20;l++)assert(hitsFor('axe',l)>=hitsFor('logging-axe',l)&&hitsFor('logging-axe',l)>=hitsFor('steel-axe',l),`level ${l}: a better axe never needs more swings`);
assert.equal(PINE_TOUGHNESS,12);
// items: three tools, the better two need a level
for(const id of AXE_IDS)assert.equal(itemById(id).type,'tool',id);
assert.equal(itemById('axe').price,2000);assert.equal(itemById('logging-axe').price,12000);assert.equal(itemById('steel-axe').price,35000);
assert.equal(requirementError(freshProgress(),itemById('axe')),null);
assert.match(requirementError(freshProgress(),itemById('logging-axe')),/needs Lumberjack level 5 \(you are level 1\)/);
const xpFor=level=>{let xp=0;for(let l=1;l<level;l++)xp+=xpForNext(l);return xp};
const at=level=>({...freshProgress(),cash:100000,skills:{lumberjack:{xp:xpFor(level)}}});
assert.match(addItem(at(4),'logging-axe',{purchase:true}).error,/needs Lumberjack level 5/,'level 4 cannot buy the Logging Axe');
assert.equal(addItem(at(5),'logging-axe',{purchase:true}).state.cash,100000-12000,'level 5 can');assert.match(addItem(at(9),'steel-axe',{purchase:true}).error,/level 10/);assert(!addItem(at(10),'steel-axe',{purchase:true}).error);
assert(!addItem(at(1),'steel-axe').error,'a company can hand it over without the level (no purchase)');
// the phone's order refuses it too
{const home={...at(1),housing:{...at(1).housing,rented:true}};const r=placeOrder(home,[{id:'logging-axe',qty:1}],STUDIO_ID);assert.match(r.error||'',/needs Lumberjack level 5/,'the Store order is refused: '+r.error);
 const ok=placeOrder({...home,skills:{lumberjack:{xp:xpFor(5)}}},[{id:'logging-axe',qty:1}],STUDIO_ID);assert(!ok.error,'and goes through at level 5: '+ok.error)}
// equipping and which axe is best
{let p=addItem(addItem(freshProgress(),'axe').state,'steel-axe').state;assert.equal(bestAxe(p),'steel-axe');assert.equal(bestAxe(freshProgress()),null);assert.equal(equippedAxe(p),null);
 p=equipTool(p,'logging-axe').error?equipTool(p,'axe').state:p;assert.equal(equippedAxe(p),'axe');assert(hotbarItems(p).some(h=>h.item.id==='steel-axe'),'every axe is on the hotbar')}
// the company hands the better tiers over at Hauler and Sawyer
{const e=MAP.employers.find(x=>x.id==='ridgeline'),grants=e.ranks.flatMap(r=>r.grants);assert.deepEqual(grants,['axe','logging-axe','steel-axe']);
 for(const g of grants)assert(AXES[g].level<=e.ranks.find(r=>r.grants.includes(g)).needs.level||g==='axe','a tier is handed over at a rank that has its level')}

// the models: in the held frame
for(const id of AXE_IDS){
 const m=MESHES[id];assert(m.triangles>=100&&m.triangles<=700,`${id}: ${m.triangles} triangles`);
 const held=createHeldItem(itemById(id));held.updateMatrixWorld(true);const box=new T.Box3().setFromObject(held),size=box.getSize(new T.Vector3());
 assert(size.z>.6&&size.z<1.05,`${id}: handle length ${size.z.toFixed(2)} m runs along +z`);assert(size.x<.12&&size.y<.45,`${id}: slim across the handle (${size.x.toFixed(2)} x ${size.y.toFixed(2)})`);
 assert(Math.abs(box.min.z+.07)<.01,`${id}: the butt is 7 cm behind the fist`);
 // the head is the heavy end: most of the width sits in the far half; the edge hangs below the handle line
 const pos=held.children[0].geometry.attributes.position;let far=0,near=0,low=0;for(let i=0;i<pos.count;i++){const z=pos.getZ(i),y=pos.getY(i);if(z>box.min.z+size.z*.7&&Math.abs(y)>.05)far++;if(z<box.min.z+size.z*.3&&Math.abs(y)>.05)near++;if(y<-.05)low++}
 assert(far>near*3,`${id}: the head is at the far end (${far} wide vertices far, ${near} near)`);assert(box.min.y<-.08,`${id}: the blade reaches below the handle (${box.min.y.toFixed(2)})`);
 const colours=held.children[0].geometry.attributes.color;assert(colours&&colours.count===pos.count,`${id}: vertex colours`);
 const geometry=held.children[0].geometry;disposeHeldItem(held);assert(createHeldItem(itemById(id)).children[0].geometry===geometry,`${id}: the geometry is shared and survives a dispose`)}
// ── Chainsaws (user-supplied models): company only ──
assert.deepEqual(SAW_IDS,['chainsaw','logging-chainsaw']);assert(isSaw('chainsaw')&&!isSaw('axe')&&!isSaw('toString'));assert(!isAxe('chainsaw'),'a saw is not an axe: it cannot fell a pine with the axe rules');
for(const id of SAW_IDS){const item=itemById(id);assert.equal(item.type,'tool',id);assert(!isBuyable(item)&&!orderable(item),`${id}: not on the Corner Market's shelves or the phone Store`);assert.equal(item.companyOnly,'ridgeline')}
assert.equal(itemById('chainsaw').price,60000);assert.equal(itemById('logging-chainsaw').price,150000);assert.equal(itemById('chainsaw').requires.level,15);assert.equal(itemById('logging-chainsaw').requires.level,20);
{const E=MAP.employers.find(x=>x.id==='ridgeline'),foreman=E.ranks.length;assert.deepEqual(E.store,[{item:'chainsaw',rank:foreman},{item:'logging-chainsaw',rank:foreman}]);
 assert.equal(storeItems('ridgeline').length,2);assert.match(storeLine(freshProgress(),'ridgeline','chainsaw').error,/staff/,'only staff');
 const lv=(level,rank)=>{let p=hire({...freshProgress(),cash:500000},'ridgeline').state;p={...p,skills:{lumberjack:{xp:xpFor(level)}},careers:{ridgeline:{...careerOf(p,'ridgeline'),rank}}};return p};
 assert.match(buyFromCompany(lv(20,5),'ridgeline','chainsaw').error,/Foreman rank up/,'a Sawyer cannot buy a chainsaw: '+buyFromCompany(lv(20,5),'ridgeline','chainsaw').error);
 assert.match(buyFromCompany(lv(10,6),'ridgeline','chainsaw').error,/level 15/,'a Foreman below level 15 cannot');
 const ok=buyFromCompany(lv(15,6),'ridgeline','chainsaw');assert(!ok.error);assert.equal(ok.state.cash,500000-60000);assert(ok.state.inventory.slots.some(s=>s.id==='chainsaw'));
 assert.match(buyFromCompany(lv(19,6),'ridgeline','logging-chainsaw').error,/level 20/);assert(!buyFromCompany(lv(20,6),'ridgeline','logging-chainsaw').error);
 assert.match(buyFromCompany({...lv(20,6),cash:100},'ridgeline','chainsaw').error,/cash/i,'and it costs cash');assert.match(buyFromCompany(lv(20,6),'ridgeline','axe').error,/does not sell/)}
for(const id of SAW_IDS){
 const m=SAW_MESHES[id];assert(m.triangles>=1500&&m.triangles<=5200,`${id}: ${m.triangles} triangles`);
 const held=createHeldItem(itemById(id));held.updateMatrixWorld(true);const box=new T.Box3().setFromObject(held),size=box.getSize(new T.Vector3());
 assert(size.z>.55&&size.z<.85,`${id}: the saw is ${size.z.toFixed(2)} m long, along +z`);assert(size.x<.4&&size.y<.45,`${id}: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} across`);
 // the bar (thin, few vertices) points forward (+z), the engine and handles are behind it
 const pos=held.children[0].geometry.attributes.position;let front=0,rear=0;for(let i=0;i<pos.count;i++){const z=(pos.getZ(i)-box.min.z)/size.z;if(z>.6)front++;if(z<.25)rear++}
 assert(front*4<rear,`${id}: the bar is at the front (${front} vertices ahead, ${rear} behind)`);assert(box.min.z<-.1&&box.max.z>.3,`${id}: the rear grip is near the origin`);disposeHeldItem(held)}
console.log('PASS tools.mjs: the axe ladder (4/3/2 swings at level 1, levels shave swings), purchases need the level in the shop and on the phone, the company hands the tiers over at Hauler and Sawyer, the three converted axes stand in the held frame (handle along +z, head far, edge down, shared geometry), and the two chainsaws (company store only, Foreman rank and level 15 or 20) have their bar forward.');
