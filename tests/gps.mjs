// GP1: the GPS rules (dist/gps.js): routes over the real road graph and a synthetic one, turn directions, progress, the vehicle panel row, pins, job auto-route and its switch, reroute with a cooldown, arrival. Pure.
import assert from 'node:assert/strict';
import {MAP,roadGraph} from '../dist/map-definition.js';
import {buildRoute,routeProgress,hudRow,fmtDist,snapPin,createGps,ARRIVE_RADIUS,OFF_ROUTE,REROUTE_COOLDOWN,PIN_MAX_SNAP} from '../dist/gps.js';
import {vehicleHudModel} from '../dist/vehicle-hud.js';

// Synthetic crossroads: t-main runs east (0,0)->(100,0); t-side runs (50,60)->(50,-60) (north is -z); they cross at (50,0). t-far is a separate piece.
const map={...MAP,roads:{nodes:{...structuredClone(MAP.roads.nodes),a:{x:0,z:0},b:{x:100,z:0},c:{x:50,z:60},d:{x:50,z:-60},e:{x:300,z:300},f:{x:340,z:330}},
 edges:[{id:'t-main',from:'a',to:'b',width:8,surface:'asphalt',level:'rural',class:'rural'},{id:'t-side',from:'c',to:'d',width:6,surface:'dirt',class:'gravel'},{id:'t-far',from:'e',to:'f',width:6,surface:'dirt'}]}};
roadGraph(map);

// turns: east then north is a left turn, east then south is a right turn
{const L=buildRoute({x:10,z:0},{x:50,z:-50},map),R=buildRoute({x:10,z:0},{x:50,z:50},map);
 assert(!L.direct&&!R.direct);assert.deepEqual(L.turns.map(t=>t.kind),['left','arrive']);assert.deepEqual(R.turns.map(t=>t.kind),['right','arrive']);
 assert(Math.abs(L.turns[0].s-40)<1&&Math.abs(L.turns[0].angle+90)<2,'left turn at 40 m, about -90 degrees: '+JSON.stringify(L.turns[0]));assert(Math.abs(R.turns[0].angle-90)<2);
 assert(Math.abs(L.length-90)<1,'40 m east + 50 m north: '+L.length);assert.deepEqual(L.points[0],[10,0]);assert.deepEqual(L.points.at(-1),[50,-50]);
 for(let i=1;i<L.cum.length;i++)assert(L.cum[i]>L.cum[i-1],'strictly increasing');
 // straight on through the crossing: no turn
 const S=buildRoute({x:10,z:0},{x:90,z:0},map);assert.deepEqual(S.turns.map(t=>t.kind),['arrive']);assert(Math.abs(S.length-80)<1e-6);
 // same road, going back: also no turn, and the start is joined to the road when you are off it
 const B=buildRoute({x:80,z:10},{x:20,z:0},map);assert.deepEqual(B.points[0],[80,10]);assert(B.length>60&&B.length<75);
 // no road joins the two pieces: a straight line, flagged
 const D=buildRoute({x:10,z:0},{x:320,z:315},map);assert(D.direct&&D.turns.length===1&&D.turns[0].kind==='arrive');assert(Math.abs(D.length-Math.hypot(310,315))<1e-6);
 assert.equal(hudRow(D,routeProgress(D,10,0)).text,'No road: straight line, '+fmtDist(D.length))}

// progress, next turn, rounding
{const L=buildRoute({x:10,z:0},{x:50,z:-50},map);
 let p=routeProgress(L,10,0);assert(Math.abs(p.along)<1e-6&&p.off<1e-6&&p.next.kind==='left'&&Math.abs(p.next.dist-40)<1);
 p=routeProgress(L,40,0,p.along);assert(Math.abs(p.along-30)<1e-6&&Math.abs(p.next.dist-10)<1e-6);
 p=routeProgress(L,50,-20,30);assert(Math.abs(p.along-60)<1e-6&&p.next.kind==='arrive'&&Math.abs(p.remaining-30)<1e-6);
 p=routeProgress(L,40,25);assert(Math.abs(p.off-25)<1e-6,'off the route by 25 m');
 assert.equal(hudRow(L,routeProgress(L,10,0)).text,'Turn left in 40 m · 90 m to go');assert.equal(hudRow(L,routeProgress(L,10,0)).arrow,'←');
 assert.equal(hudRow(L,routeProgress(L,50,-20)).text,'Arrive in 30 m');assert.equal(hudRow(L,null,true).text,'Rerouting…');assert.equal(hudRow(null,null),null);
 assert.equal(fmtDist(4),'now');assert.equal(fmtDist(123),'120 m');assert.equal(fmtDist(1480),'1.5 km');
 // the panel carries the row only while driving
 assert.equal(vehicleHudModel({driving:{},name:'x',speed:3,gps:{arrow:'a',text:'b'}}).gps.text,'b');assert(!('gps' in vehicleHudModel({driving:{},name:'x',speed:3})))}

// pins: snap to the nearest road, refuse far points
{const q=snapPin(70,12,map);assert(q&&Math.abs(q.x-70)<1e-6&&Math.abs(q.z)<1e-6&&q.edge==='t-main'&&Math.abs(q.d-12)<1e-6);
 assert.equal(snapPin(5000,5000,map),null);assert.equal(PIN_MAX_SNAP,150)}

// the controller: pin wins over a job, the switch, clear, arrival, reroute with a cooldown
{const g=createGps({map}),pos={x:10,z:0};
 assert(!g.active&&g.hud===null&&g.ahead===null);assert.equal(g.update(1,pos),null);
 g.setJobTarget({x:50,z:-50});assert(g.active&&g.source==='job','a started job routes by itself');assert.equal(g.update(.1,pos),'routed');assert(g.route&&g.hud&&g.ahead.points.length>=2);
 assert.equal(g.hud.text.startsWith('Turn left'),true);
 // the off switch ends the job route and keeps it off
 g.setAuto(false);assert(!g.active&&g.route===null);g.setJobTarget({x:52,z:-50});assert(!g.active,'switch off: a new target does not route');g.setAuto(true);assert(g.active&&g.source==='job');
 // a pin replaces the job route, and Clear goes back to the job
 assert.equal(g.setPin(90,3).error,undefined);assert.equal(g.source,'pin');assert.deepEqual([g.pin.x,g.pin.z],[90,0]);assert.equal(g.update(.1,pos),'routed');assert.equal(g.route.turns.length,1);
 assert.equal(g.setPin(5000,5000).error,'No road near there.');assert.equal(g.source,'pin','a refused tap changes nothing');
 g.setPin(50,40);assert.deepEqual([g.pin.x,g.pin.z],[50,40],'one pin at a time');g.clear();assert(g.pin===null&&g.source==='job','Clear drops the pin; the job route returns');g.update(.1,pos);
 g.clear();assert(!g.active,'Clear again ends the job route');g.setJobTarget({x:52,z:-50});assert(!g.active,'a cleared job stays cleared (same target)');g.setJobTarget({x:300,z:-50});assert(g.active,'a new target routes again');
 // arrival clears the pin and tells you once
 g.clear();const h=createGps({map});h.setPin(90,0);assert.equal(h.update(.1,{x:10,z:0}),'routed');assert.equal(h.update(.1,{x:60,z:0}),null);assert.equal(h.update(.1,{x:90-ARRIVE_RADIUS+1,z:0}),'arrived');assert(!h.active&&h.pin===null);assert.equal(h.update(.1,{x:90,z:0}),null)}
{const g=createGps({map});g.setPin(90,0);g.update(.1,{x:10,z:0});const r0=g.route;
 // leaving the road: first it only says Rerouting, then (after the cooldown) a new route from where you are
 assert.equal(g.update(.5,{x:30,z:OFF_ROUTE+10}),null);assert.equal(g.rerouting,true);assert.equal(g.hud.text,'Rerouting…');assert.equal(g.route,r0,'cooldown: not rebuilt yet');
 assert.equal(g.update(REROUTE_COOLDOWN,{x:30,z:OFF_ROUTE+10}),'rerouted');assert.notEqual(g.route,r0);assert.equal(g.rerouting,false);assert.deepEqual(g.route.points[0],[30,OFF_ROUTE+10]);
 assert.equal(g.update(.1,{x:30,z:OFF_ROUTE+10}),null,'on the new route: quiet')}

// the real map: Oak Street to the P3 lane node (R4's connected graph) has turns and ends at the plot
{const to=MAP.roads.nodes.p3Lane,t0=performance.now(),r=buildRoute({x:-55,z:6},to,MAP),ms=performance.now()-t0;
 assert(!r.direct&&r.length>470&&r.length<540,'about 500 m: '+r.length);assert.equal(r.turns.at(-1).kind,'arrive');assert(r.turns.length>=2,'at least one turn: '+r.turns.map(t=>t.kind));assert(ms<80,'a route takes '+ms.toFixed(1)+' ms');
 // east to west across the whole map is one route too
 const far=buildRoute({x:1000,z:60},{x:-300,z:0},MAP);assert(!far.direct&&far.length>1300);
 console.log(`PASS gps.mjs: routes with left/right/arrive turns, direct fallback, pins, job auto-route and switch, reroute cooldown, arrival; Oak Street to the P3 lane is ${Math.round(r.length)} m with ${r.turns.length-1} turn(s), built in ${ms.toFixed(1)} ms`)}
