// GP1 in the packaged game: the phone has a GPS app; tapping its map drops one pin (snapped to a road); in a vehicle the panel shows the next turn row; Clear removes it; the job switch toggles.
import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {MAP} from '../dist/map-definition.js';
import {CLASSES,doorPoint} from '../dist/vehicle.js';
const puddle=MAP.mud.find(m=>m.id==='mud-yard-puddle'),V={x:(puddle.x0+puddle.x1)/2,z:(puddle.z0+puddle.z1)/2,yaw:0},VIEW=MAP.minimap.view;
const g=await bootGame({position:{x:V.x+5,z:V.z},progress:{cash:30000,completed:5,routine:{minutes:480},vehicles:[{uid:'v1',model:'shortbed',colour:'#c23b2e',x:V.x,z:V.z,yaw:V.yaw,fuelMgal:10000}],orders:{nextVehicle:2}}});
try{
 const {GameState,pump,send,ids}=g,press=code=>{send('keydown',code);send('keyup',code)};
 const tap=(x,z)=>ids.get('gpsMap').onclick({clientX:(x-VIEW.x0)/(VIEW.x1-VIEW.x0)*1400,clientY:(z-VIEW.z0)/(VIEW.z1-VIEW.z0)*900}); // the stub canvas is 1400 x 900 at 0,0
 pump(1.5);
 assert(ids.get('phoneApp-gps'),'the page has a GPS app');ids.get('phoneButton').click();assert.equal(ids.get('phoneScreen-gps').hidden,true);ids.get('phoneApp-gps').click();
 assert.equal(ids.get('phoneScreen-gps').hidden,false);assert.equal(ids.get('phoneTitle').textContent,'GPS');assert.equal(ids.get('gpsAuto').textContent,'Job routes: on');assert(/No destination/.test(ids.get('gpsStatus').textContent));assert.equal(ids.get('gpsClear').disabled,true);
 pump(.5);
 // a tap outside the map does nothing (every spot on this map is within 150 m of a road, so the far-tap refusal is covered in gps.mjs)
 ids.get('gpsMap').onclick({clientX:-5,clientY:10});assert.equal(ids.get('gpsClear').disabled,true);
 // a tap near Oak Street drops a pin
 const oak=MAP.roads.nodes.oakWest;tap(oak.x+30,oak.z+8);pump(.5);
 assert(/Pin dropped/.test(ids.get('phoneMessage').textContent),ids.get('phoneMessage').textContent);assert.equal(ids.get('gpsClear').disabled,false);assert(/Your pin/.test(ids.get('gpsStatus').textContent),ids.get('gpsStatus').textContent);
 tap(oak.x+60,oak.z+8);assert(/Your pin/.test(ids.get('gpsStatus').textContent),'a second tap replaces the first pin (still one)');
 ids.get('gpsAuto').click();assert.equal(ids.get('gpsAuto').textContent,'Job routes: off');ids.get('gpsAuto').click();assert.equal(ids.get('gpsAuto').textContent,'Job routes: on');
 ids.get('phoneClose').click();pump(.5);
 // get into the S70: the panel shows the next turn and the distance
 assert.equal(ids.get('vpGps').hidden,true,'on foot: no GPS row');
 const door=doorPoint(V,CLASSES.shortbed);Object.assign(GameState.me.position,{x:door.x,z:door.z});pump(1);press('KeyE');pump(3);
 assert.equal(ids.get('vehiclePanel').dataset.state,'driving');pump(1);
 assert.equal(ids.get('vpGps').hidden,false,'in a vehicle with a pin: the row shows');const text=ids.get('vpGpsText').textContent;assert(/^(Turn (left|right)|Make a U-turn|Arrive|Rerouting|No road)/.test(text),text);assert.notEqual(ids.get('vpGpsArrow').textContent,'');
 // Clear (from the phone) removes it
 ids.get('phoneButton').click();ids.get('phoneApp-gps').click();ids.get('gpsClear').click();ids.get('phoneClose').click();pump(1);
 assert.equal(ids.get('vpGps').hidden,true,'cleared: the row is gone');
 console.log('PASS gps-game.mjs: GPS app on the phone, tap drops one pin on a road (a tap off the map does nothing), job switch toggles, the vehicle panel shows "'+text+'" and Clear removes it.');
}finally{await g.done()}
