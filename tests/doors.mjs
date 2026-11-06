import assert from 'node:assert/strict';
import {createSlidingDoor,createHingedDoor,createDoubleDoor} from '../dist/doors.js';
import {MAP} from '../dist/map-definition.js';

// Doors (0.35): the sliding door still opens from setOpen; the hinged and double doors are manual (toggle), swing about their hinges toward -z (into the room),
// mirror each other in a pair, and can be snapped shut.
const run=(d,s=1)=>{for(let i=0;i<s*60;i++)d.update(1/60)};
assert.equal(createSlidingDoor({}).manual,undefined,'the sliding door is automatic');

{const d=createHingedDoor({width:1.4,height:2.2,frame:false,handle:false}),leaf=d.group.children[0];
 assert.equal(d.manual,true);assert.equal(d.isOpen,false);assert.equal(d.amount,0);assert.equal(leaf.rotation.y,0);
 assert.equal(d.toggle(),true,'toggle opens');run(d);assert(d.amount>.99&&d.isOpen);assert(leaf.rotation.y>1.4&&leaf.rotation.y<1.6,'a quarter turn and a bit: '+leaf.rotation.y);
 // the free edge of the leaf swings toward -z (into the room): a point 1.4 m from the hinge along the leaf
 leaf.updateMatrixWorld(true);const edge=leaf.children[0].children[0].getWorldPosition(leaf.position.clone());assert(edge.z<-.3,'the leaf swings into the room (z '+edge.z.toFixed(2)+')');
 assert.equal(d.toggle(),false);run(d);assert(Math.abs(leaf.rotation.y)<1e-9,'and shuts again');
 d.snap(true);assert.equal(d.amount,1);d.snap(false);assert.equal(d.amount,0);assert.equal(d.isOpen,false,'snap jumps without the swing');
 const body=d.group.children[0].children[0];assert.equal(body.children.length,1,'with no handle the leaf is one mesh (it fades with its wall as one piece)')}

{const d=createDoubleDoor({width:2.2,height:2.5}),[a,b]=d.group.children.filter(c=>c.type==='Group');
 assert(a&&b,'two leaves');d.setOpen(true);run(d);assert(a.rotation.y>1.4&&b.rotation.y<-1.4,'the leaves turn opposite ways about their own hinges: '+a.rotation.y.toFixed(2)+', '+b.rotation.y.toFixed(2));
 assert(a.position.x<0&&b.position.x>0,'hinged at the two outer edges');assert.equal(d.manual,true)}

// the map: the market keeps its sliding door; the cafe and the Ridgeline office have double glass doors
assert.equal(MAP.shops.market.interior.exitDoor.kind,'sliding');assert.equal(MAP.shops.cafe.interior.exitDoor.kind,'double');assert.equal(MAP.offices[0].interior.exitDoor.kind,'double');
console.log('Doors: sliding stays automatic; hinged and double doors are manual, swing into the room about their hinges, a pair mirrors, snap shuts without the swing, a handle-less leaf is one mesh; the market is sliding, the cafe and the office have double glass doors.');
