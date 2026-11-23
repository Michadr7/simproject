// Ironwood Hotel Lobby & Ground Suite tests (I7-I10).
import assert from 'node:assert/strict';
import {HOTEL_ORIGIN,HOTEL_ENTRY,HOTEL_EXIT,HOTEL_DESK,HOTEL_SUITE_BED,HOTEL_ROOM_PRICE,createHotelLobby} from '../dist/hotel-lobby.js';

assert.equal(HOTEL_ORIGIN.z,1350);
assert.equal(HOTEL_ROOM_PRICE,2500);
const hotel=createHotelLobby();
assert.equal(hotel.scene.isScene,true,'hotel lobby builds its own Three.js Scene');
assert.equal(hotel.scene.background?.isColor,true,'hotel lobby scene sets a background');
assert(hotel.scene.children.some(c=>c.isLight),'hotel lobby scene includes lighting');
assert.ok(hotel.frontDoor&&hotel.exitDoor,'double glass exit/front door exists');
assert.ok(hotel.clerk?.group,'receptionist Clara Reyes exists');
assert.equal(hotel.blocked(HOTEL_ENTRY.x,HOTEL_ENTRY.z),false,'entry is clear');
assert.equal(hotel.blocked(HOTEL_DESK.x,HOTEL_DESK.z),false,'reception desk stand is clear');
assert.equal(hotel.blocked(-8,-1),false,'suite archway at x=-8,z=-1 is passable');
assert.equal(hotel.blocked(-14.8,-0.2),false,'side of suite double bed is walkable');
assert.ok(Math.hypot(-14.8-(-14.8),-0.2-HOTEL_SUITE_BED.z)<1.4,'player beside bed is within sleep range');
assert.ok(Math.hypot(0-HOTEL_EXIT.x,5.5-HOTEL_EXIT.z)<1.5,'player at lobby south wall is within exit range');
assert.equal(hotel.blocked(0,-6.2),true,'north wall blocks');
assert.equal(hotel.blocked(-18.2,-1),true,'west suite wall blocks');
assert.equal(hotel.blocked(8.2,0),true,'east lobby wall blocks');
console.log('PASS hotel-lobby: lobby & suite geometry, reception desk, archway, bed sleep range, walls');
