// The interior editor's rules: moving, turning, copying, deleting and adding pieces, what counts as a problem, saved layouts, and a room that refreshes itself from its layout.
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {houseLayout,applySaved,deriveSpots,layoutProblems,buildHouseRoom,footprintOf,FLOORS,LOCKED,cleanItem} from '../dist/interiors.js';
import {moveItem,rotateItem,removeItem,duplicateItem,addItem,restoreItems,toSaved,describe,FURNITURE,STEPS} from '../dist/interior-edit.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};
const props=Object.keys(FLOORS),clone=x=>structuredClone(x);

// ── Every generated layout is free of problems (the editor's checks agree with tests/interiors.mjs)
for(const prop of props)assert.deepEqual(layoutProblems(houseLayout(prop,{saved:false})),[],`${prop} has no problems`);

// ── Moving and turning
{const L=houseLayout('house-a',{saved:false}),sofa=L.items[0].findIndex(i=>i.id==='f-sofa'),x0=L.items[0][sofa].x;
 assert(moveItem(L,0,sofa,.25,0));assert.equal(L.items[0][sofa].x,+(x0+.25).toFixed(3));assert(moveItem(L,0,sofa,-.25,0));assert.equal(L.items[0][sofa].x,x0,'moves are exact steps (no drift)');
 for(let i=0;i<200;i++)moveItem(L,0,sofa,-.25,-.25);const r=footprintOf(L.items[0][sofa]);assert(r.x0>=-L.W/2-1e-6&&r.z0>=-L.D/2-1e-6,'a piece cannot be pushed through a wall');
 assert.equal(moveItem(L,0,sofa,NaN,0),false);assert.equal(moveItem(L,0,999,.25,0),false,'no such piece');
 const yaw=L.items[0][sofa].yaw;for(let i=0;i<4;i++)assert(rotateItem(L,0,sofa,1));assert.equal(L.items[0][sofa].yaw,yaw,'four quarter turns come back');
 rotateItem(L,0,sofa,-1);assert(Math.abs(Math.round(L.items[0][sofa].yaw/(Math.PI/2))*(Math.PI/2)-L.items[0][sofa].yaw)<1e-9,'always a quarter turn');
 assert.equal(moveItem(L,0,sofa,.05,0),true,'fine steps work');assert.deepEqual([STEPS.coarse,STEPS.fine],[.25,.05]);
}
// ── The stairs belong to the building
{const L=houseLayout('house-e',{saved:false}),st=L.items[0].findIndex(i=>i.id==='f-stairs');assert(st>=0&&LOCKED.has('f-stairs'));
 assert.equal(moveItem(L,0,st,.25,0),false);assert.equal(rotateItem(L,0,st,1),false);assert.equal(removeItem(L,0,st),false);assert.equal(duplicateItem(L,0,st),-1);assert.equal(addItem(L,0,'f-stairs'),-1);
 assert(!FURNITURE.includes('f-stairs'),'and they are not on the list of things to add');assert(!toSaved(L).items.flat().some(i=>i.id==='f-stairs'),'nor saved')}
// ── Remove, copy, add
{const L=houseLayout('house-c',{saved:false}),n=L.items[1].length;
 const copy=duplicateItem(L,1,0);assert.equal(copy,n);assert.equal(L.items[1].length,n+1);assert.notDeepEqual(L.items[1][copy],L.items[1][0],'the copy is beside the original');assert.equal(L.items[1][copy].id,L.items[1][0].id);
 assert(removeItem(L,1,copy));assert.equal(L.items[1].length,n);
 const added=addItem(L,1,'f-bookcase');assert(added>=0);assert.equal(describe(L.items[1][added]).startsWith('bookcase'),true);
 assert.equal(addItem(L,1,'f-does-not-exist'),-1);assert.equal(addItem(L,1,'tree'),-1,'only furniture');assert.equal(addItem(L,5,'f-sofa'),-1,'only a floor that exists');
 assert(FURNITURE.length>=20&&FURNITURE.every(id=>id.startsWith('f-')),FURNITURE.length+' pieces to choose from')}
// ── Problems are found, in words
{const L=houseLayout('house-a',{saved:false});
 const noStove=clone(L);noStove.items[0]=noStove.items[0].filter(i=>i.id!=='f-stove');assert(layoutProblems(noStove).some(p=>/no stove/.test(p)),'a missing stove');
 const noBed=clone(L);noBed.items[0]=noBed.items[0].filter(i=>i.id!=='f-bed-double');assert(layoutProblems(noBed).some(p=>/no bed/.test(p)),'a missing bed');
 const door=clone(L);door.items[0].push({id:'f-wardrobe',x:L.doorX,z:L.D/2-.4,yaw:Math.PI,y:0});assert(layoutProblems(door).some(p=>/blocking the door/.test(p)),'a piece in the doorway: '+layoutProblems(door).join(' | '));
 const overlap=clone(L),sofa=overlap.items[0].find(i=>i.id==='f-sofa');overlap.items[0].push({...sofa});assert(layoutProblems(overlap).some(p=>/sofa and the sofa overlap/.test(p)),'two sofas on top of each other');
 const outside=clone(L);outside.items[0].push({id:'f-bookcase',x:L.W/2+2,z:0,yaw:0,y:0});assert(layoutProblems(outside).some(p=>/outside the room/.test(p)),'outside the room');
 // a wall of cabinets across the room: the door cannot reach the stove or the bed
 const wall=clone(L);for(let x=-L.W/2+.3;x<L.W/2;x+=.6)wall.items[0].push({id:'f-cabinet',x,z:L.D/2-3.2,yaw:0,y:0});
 const walled=layoutProblems(wall);assert(walled.some(p=>/cannot walk from the door to/.test(p)),'walled off: '+walled.join(' | '));
 // upstairs: a house with a bed upstairs and the landing walled off
 const two=houseLayout('house-e',{saved:false}),sealed=clone(two);for(let x=-two.W/2+.3;x<two.W/2;x+=.6)sealed.items[1].push({id:'f-cabinet',x,z:two.stairs.topZ+1.2,yaw:0,y:0});
 assert(layoutProblems(sealed).some(p=>/upstairs/.test(p)),'upstairs sealed: '+layoutProblems(sealed).join(' | '))}

// ── Saved layouts: validated whole, with the building's parts always from the generator
{const gen=houseLayout('house-e',{saved:false}),saved={items:[gen.items[0].map(i=>({...i})),gen.items[1].map(i=>({...i}))]};
 const sofa=saved.items[0].find(i=>i.id==='f-sofa');sofa.x+=.5;const bed=saved.items[1].find(i=>i.id==='f-bed-double');bed.x+=.25;const stove=saved.items[0].find(i=>i.id==='f-stove');stove.x+=.25;
 saved.items[0]=saved.items[0].filter(i=>i.id!=='f-stairs'); // a file without the stairs still gets them
 const L=applySaved(houseLayout('house-e',{saved:false}),saved);
 assert.equal(L.items[0].find(i=>i.id==='f-sofa').x,sofa.x,'the saved sofa');assert(L.items[0].some(i=>i.id==='f-stairs'),'the stairs are back');assert.deepEqual(L.stairs,gen.stairs);
 assert.equal(L.bed.x,bed.x,'the bed spot follows the bed');assert.equal(+L.kitchen.x.toFixed(3),+(stove.x).toFixed(3),'the kitchen spot follows the stove');
 for(const bad of [{items:[[{id:'f-sofa',x:0,z:0,yaw:0}]]},{items:[saved.items[0],[{id:'tree',x:0,z:0,yaw:0}]]},{items:[saved.items[0],[{id:'f-sofa',x:99,z:0,yaw:0}]]},{items:[saved.items[0],[{id:'f-sofa',x:0,z:0,yaw:.3}]]},{items:'x'},null]){
  const kept=applySaved(houseLayout('house-e',{saved:false}),bad);assert.deepEqual(kept.items,gen.items,'a bad saved layout is ignored whole: '+JSON.stringify(bad).slice(0,60))}
 assert.equal(cleanItem({id:'f-sofa',x:1.00049,z:2,yaw:3*Math.PI/2}).yaw,-Math.PI/2,'three quarter turns is written as minus one');
 assert.deepEqual(toSaved(L).items.map(l=>l.length),[gen.items[0].length-1,gen.items[1].length],'what is saved: everything but the stairs');
 // restoring puts the generated furniture back
 restoreItems(L,houseLayout('house-e',{saved:false}));assert.deepEqual(L.items,gen.items)}
assert.deepEqual(houseLayout('house-c',{saved:false}),houseLayout('house-c',{saved:false}),'the generator is deterministic');

// ── A built room follows its layout
{const room=buildHouseRoom('house-a'),L=room.layout,i=L.items[0].findIndex(p=>p.id==='f-sofa'),mesh=()=>room.scene.getObjectByName('f:f-sofa');
 const x0=mesh().position.x,hit=(x,z)=>room.blocked(x,z);
 const where=L.items[0][i];assert(hit(where.x,where.z),'the sofa is solid where it is');
 moveItem(L,0,i,-1,0);room.refresh();
 assert(Math.abs(mesh().position.x-(x0-1))<1e-9,'the model moved');const moved=L.items[0][i];assert(hit(moved.x,moved.z),'and so did its collision box');assert(Math.abs(moved.x-(where.x))<1e-9);
 let pieces=0;room.scene.traverse(o=>{if(o.name?.startsWith('f:'))pieces++});assert.equal(pieces,L.items.flat().length,'one model per piece, none left over');
 removeItem(L,0,L.items[0].findIndex(p=>p.id==='f-stove'));room.refresh();pieces=0;room.scene.traverse(o=>{if(o.name?.startsWith('f:'))pieces++});assert.equal(pieces,L.items.flat().length);
 const marker=room.scene.getObjectByName('selection');assert.equal(marker.visible,false);room.highlight(0,i);assert.equal(marker.visible,true);assert(!marker.box.isEmpty(),'a box around the piece');room.highlight(null);assert.equal(marker.visible,false);
 // the bed spot follows the bed
 const bi=L.items[0].findIndex(p=>p.id==='f-bed-double'),bed0={...room.BED};moveItem(L,0,bi,-.5,0);room.refresh();assert.notEqual(room.BED.x,bed0.x,'the bed spot moved with the bed');assert.equal(room.BED.x,room.layout.bed.x)}
console.log('Interior editor: nine generated layouts have no problems; moving (exact steps, kept inside the walls), turning, copying, deleting and adding; the stairs are fixed; missing stove or bed, a blocked door, overlaps, pieces outside and walled-off routes are named; saved layouts are validated whole and keep the stairs; a room refreshes its models, collision boxes, bed and kitchen spots and selection box from its layout.');