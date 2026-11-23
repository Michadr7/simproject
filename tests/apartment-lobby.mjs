// Oak Street Apartments Lobby, Elevator & Residential Hallway tests (Step 1).
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {LOBBY_ORIGIN,LOBBY_ENTRY,LOBBY_EXIT,LOBBY_DESK,LOBBY_ELEVATOR,HALLWAY_ORIGIN,HALLWAY_ENTRY,HALLWAY_ELEVATOR,ELEVATOR_UNITS,elevatorChoices,createApartmentLobby,createApartmentHallway,buildOakLobbyExterior} from '../dist/apartment-lobby.js';

assert.equal(LOBBY_ORIGIN.z,1200);
assert.equal(HALLWAY_ORIGIN.z,1260);
assert.equal(ELEVATOR_UNITS.length,4);
const locked=elevatorChoices({rented:false});
assert.equal(locked[0].locked,true);
const open=elevatorChoices({rented:true,otherPlayers:[{id:'p2',name:'Maya'}]});
assert.equal(open[0].locked,false);
assert(open.some(o=>o.id==='player:p2'&&o.label.includes('Maya')),'co-op player unit listed');
const lobby=createApartmentLobby();
assert.equal(lobby.scene.isScene,true,'lobby builds its own Three.js Scene');
assert.equal(lobby.scene.background?.isColor,true,'lobby scene sets a background');
assert(lobby.scene.children.some(c=>c.isLight),'lobby scene includes lighting');
assert.equal(lobby.blocked(LOBBY_ENTRY.x,LOBBY_ENTRY.z),false);
assert.equal(lobby.blocked(LOBBY_EXIT.x,LOBBY_EXIT.z),false,'lobby exit unblocked');
assert.equal(lobby.blocked(LOBBY_ELEVATOR.x,LOBBY_ELEVATOR.z),false);
assert.equal(lobby.blocked(LOBBY_DESK.x,LOBBY_DESK.z),false);
assert.equal(lobby.blocked(lobby.clerk.group.position.x,lobby.clerk.group.position.z),false,'concierge clear of desk & chair');
assert.equal(lobby.blocked(0,-6),true);
assert.equal(lobby.glass.length,4,'lobby has 2 sidelights + 2 picture windows');
for(const g of lobby.glass){
 assert(g.material.transparent&&g.material.opacity<.35&&g.material.depthWrite===false,'lobby front glass see-through');
 assert(!lobby.occluders.includes(g),'glass panes excluded from occluders');
}
const exitGlass=[];lobby.exitDoor.group.traverse(o=>{if(o.isMesh&&o.material?.transparent)exitGlass.push(o)});
assert.equal(exitGlass.length,2,'interior exit double door uses see-through glass panels');

const extScene=new THREE.Scene();
const ext=buildOakLobbyExterior(extScene,1,-8.5);
assert.equal(ext.group.name,'oak-lobby-exterior');
assert.equal(ext.group.position.x,1);
assert.equal(ext.group.position.z,-14.5,'exterior lobby front wall flush at z = -8.5');
assert.equal(ext.glass.length,4,'exterior lobby matches interior glazing panes');
assert.equal(ext.door.group.position.z,6);
const extDoorGlass=[];ext.door.group.traverse(o=>{if(o.isMesh&&o.material?.transparent)extDoorGlass.push(o)});
assert.equal(extDoorGlass.length,2,'exterior entrance double door matches interior glass panels');
assert.equal(ext.clerk.group.position.x,lobby.clerk.group.position.x);

for(const [floor,expectedUnits] of [[2,['2','2B']],[3,['7','8','9']],[4,['10','11']]]){
 const h=createApartmentHallway(floor);
 assert.equal(h.scene.isScene,true,'hallway builds Three.js Scene for floor '+floor);
 assert.equal(h.storey,floor);
 assert(h.occluders.length>=4,'hallway has 4 perimeter walls as occluders');
 assert.deepEqual(h.doors.map(d=>d.unit),expectedUnits,'expected unit doors on floor '+floor);
 assert.equal(h.blocked(HALLWAY_ENTRY.x,HALLWAY_ENTRY.z),false,'hallway entry clear on floor '+floor);
 assert.equal(h.blocked(HALLWAY_ELEVATOR.x,HALLWAY_ELEVATOR.z),false,'hallway elevator clear on floor '+floor);
 for(const d of h.doors)assert.equal(h.blocked(d.x,d.standZ),false,`door ${d.unit} standing zone clear on floor ${floor}`);
 assert.equal(h.blocked(0,-3.2),true,'north wall blocked');
 assert.equal(h.doorNpc.group.visible,false,'doorNpc starts hidden');
 h.showDoorNpc(null,h.doors[0]);
 assert.equal(h.doorNpc.group.visible,true,'showDoorNpc reveals doorway resident');
 h.hideDoorNpc();
 assert.equal(h.doorNpc.group.visible,false,'hideDoorNpc hides doorway resident');
}
console.log('PASS apartment-lobby: lobby & residential hallway floors 2-4, doors, occluders, colliders, and doorway NPC verified');
