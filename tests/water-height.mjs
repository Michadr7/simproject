// W2: height.js digs the water contract: polyline valleys in any direction, lake and sea basins, fords, x-axis bridges. Synthetic maps only (the shipped map has no new water).
import assert from 'node:assert/strict';
import {MAP,waterAt,RIVER_PROFILE,riverPath} from '../dist/map-definition.js';
import {heightAt,valleyAt,valleyIn,heightIn,bridgeRise,BRIDGE_RISE,deckAt,LAKE_BANK,SEA_BANK,RIVER_SHOULDER,RIVER_SLOPE} from '../dist/height.js';

// The shipped map is unchanged: the same legacy channel as before (pinned numbers from tests/height.mjs) and valleyIn(MAP) is valleyAt
assert.equal(valleyIn(MAP,50,0),valleyAt(50,0));assert.equal(heightIn(MAP,50,0),heightAt(50,0));assert.equal(heightAt(10,20),0);

const river={id:'big-river',bank:2.6,shore:3,points:[
 {x:-330,z:-100,w:14,depth:.8,y:-.95,speed:.6},{x:-330,z:0,w:14,depth:.8,y:-.95,speed:.6},{x:-330,z:100,w:14,depth:.8,y:-.95,speed:.6},{x:-100,z:380,w:14,depth:.8,y:-.95,speed:.4}]};
const lake={id:'lake',outline:[[520,-660],[800,-660],[800,-440],[520,-440]],y:-.9,depth:2.5,shore:6};
const sea={shoreline:[[-450,430],[0,440],[1050,440]],y:-2,beach:25,depth:.6};
const ford={river:'big-river',x:-330,z:0,w:6,depth:.3};
const map={...MAP,water:{...MAP.water,rivers:[...MAP.water.rivers,river],fords:[ford],lakes:[lake],sea}};
const H=(x,z)=>valleyIn(map,x,z);

// River (north-south reach, so the old by-x search could not do it): bed deepest in the centre, waterline at the edge, then bank, shoulder, ground
{assert(Math.abs(H(-330,-50)-(-.95-.8))<1e-9,'centre bed y - depth: '+H(-330,-50));
 assert(Math.abs(H(-330+3.5,-50)-(-.95-.8*RIVER_PROFILE(.5)))<1e-9,'half way to the edge the bed is half as deep');
 assert(Math.abs(H(-330+7,-50)-(-.95))<1e-9,'the waterline is at the water y');assert(Math.abs(H(-330-7,-50)-H(-330+7,-50))<1e-9,'symmetric');
 assert(Math.abs(H(-330+7+2.6,-50)+RIVER_SHOULDER)<1e-9,'end of the bank is the shoulder');assert.equal(H(-330+7+2.6+RIVER_SLOPE+1,-50),0,'ground beyond');
 // consistent with waterAt: bed height = water y - water depth wherever there is water
 for(const dx of [0,1.5,3,5,6.5]){const w=waterAt(-330+dx,-50,map);assert(Math.abs(H(-330+dx,-50)-(w.y-w.depth))<1e-9,'bed = y - depth at '+dx)}
 // gentle everywhere across the section (cosine profile, bank, slope)
 let steepest=0,last=H(-330,-50);for(let d=.1;d<=14;d+=.1){const v=H(-330+d,-50);steepest=Math.max(steepest,Math.abs(v-last)/.1);last=v}assert(steepest<.7,'section slope '+steepest.toFixed(2));
 // the diagonal reach (any direction): same section measured across the path
 const P=riverPath(river,2),s=P[Math.floor(P.length*.8)];assert(Math.abs(s.tx)>.3&&Math.abs(s.tz)>.3,'a diagonal sample');
 assert(Math.abs(H(s.x,s.z)-(-.95-.8))<.02,'diagonal centre bed '+H(s.x,s.z));assert(Math.abs(H(s.x-s.tz*3.5,s.z+s.tx*3.5)-(-.95-.8*RIVER_PROFILE(.5)))<.05,'diagonal reaches dig the same section');
 // continuous along the river (no steps at the bends)
 let jump=0,p=H(-330,-90);for(let z=-89.5;z<=-10;z+=.5){const v=H(-330,z);jump=Math.max(jump,Math.abs(v-p));p=v}assert(jump<1e-9,'straight reach is level');}
// Ford: the bed is raised to y - 0.3 over w metres and blends back over FORD_RAMP, equal to waterAt
{assert(Math.abs(H(-330,0)-(-.95-.3))<1e-9,'ford bed '+H(-330,0));assert(Math.abs(H(-330,2.9)-(-.95-.3))<1e-9);assert(Math.abs(H(-330,0.3)-H(-330,-.3))<1e-9);
 assert(H(-330,0)>H(-330,-50)+.4,'the ford is shallower than the river');assert(Math.abs(H(-330,-60)-H(-330,-50))<1e-9,'far from the ford the river bed is back');
 for(const z of [0,2,3.5,5,7])assert(Math.abs(H(-330,z)-(waterAt(-330,z,map).y-waterAt(-330,z,map).depth))<1e-9,'ford z '+z);
 let steepest=0,l=H(-330,-10);for(let z=-9.9;z<=10;z+=.1){const v=H(-330,z);steepest=Math.max(steepest,Math.abs(v-l)/.1);l=v}assert(steepest<.5,'ford ramp is gentle '+steepest.toFixed(2))}
// Lake: waterline at the outline, bed deepens by a cosine over `shore`, ground a bank beyond
{assert(Math.abs(H(660,-550)-(-.9-2.5))<1e-9,'full depth');const e=H(522,-550);assert(e<-.9&&e>-3.4);
 assert(Math.abs(H(520.0001,-550)-(-.9))<1e-3,'the outline is the waterline');assert(Math.abs(H(520-.0001,-550)-(-.9))<1e-3,'no step across the outline');
 assert(Math.abs(H(520-LAKE_BANK/2,-550)-(-.45))<1e-9,'half way up the bank');assert.equal(H(520-LAKE_BANK-1,-550),0,'ground beyond the bank');
 for(const z of [-600,-500]){const w=waterAt(700,z,map);assert(Math.abs(H(700,z)-(w.y-w.depth))<1e-9,'lake bed = y - depth')}
 let steep=0,l=H(500,-550);for(let x=500.1;x<=540;x+=.1){const v=H(x,-550);steep=Math.max(steep,Math.abs(v-l)/.1);l=v}assert(steep<.7,'lake shore slope '+steep.toFixed(2))}
// Sea: ground to the waterline over SEA_BANK, then 0 to -2.6 m offshore over `beach`
{// at x=-225 the line is at z 435
 assert(Math.abs(H(-225,435)-(-2))<1e-9,'the waterline is the shoreline: bed at the sea y');assert(Math.abs(H(-225,435+25)-(-2.6))<1e-9,'-2.6 m beyond the beach');assert(Math.abs(H(-225,435+200)-(-2.6))<1e-9,'flat far out');
 assert.equal(H(-225,435-SEA_BANK-1),0,'inland is ground');assert(Math.abs(H(-225,435-SEA_BANK/2)+1)<1e-9,'half way up the beach');
 for(const z of [440,445,460,520]){const w=waterAt(-225,z,map);assert(Math.abs(H(-225,z)-(w.y-w.depth))<1e-9,'sea bed = y - depth at '+z)}
 assert.equal(waterAt(-225,435,map),null,'depth 0 right at the line is not water yet (the line itself is dry by the contract)');
 let steep=0,l=H(-225,400);for(let z=400.1;z<=480;z+=.1){const v=H(-225,z);steep=Math.max(steep,Math.abs(v-l)/.1);l=v}assert(steep<.2,'beach slope '+steep.toFixed(3))}
// Combined: the shipped legacy channel still wins where it is deepest; heightIn adds relief
assert.equal(H(50,0)<=valleyAt(50,0)+1e-12,true);assert.equal(heightIn(map,300,0),H(300,0)+0);
// Bridges: axis 'x' follows x, default follows z
{const bz={x0:0,x1:10,z0:0,z1:40},bx={...bz,axis:'x',x0:0,x1:40,z0:0,z1:10};
 assert(Math.abs(bridgeRise(bz,20)-BRIDGE_RISE)<1e-9&&bridgeRise(bz,0)===0&&bridgeRise(bz,40)===0&&bridgeRise(bz,20,999)===bridgeRise(bz,20),'z-axis bridges ignore x');
 assert(Math.abs(bridgeRise(bx,5,20)-BRIDGE_RISE)<1e-9&&bridgeRise(bx,5,0)===0&&bridgeRise(bx,5,40)===0&&Math.abs(bridgeRise(bx,5,10)-BRIDGE_RISE/2)<1e-9,'x-axis bridges rise along x')}
assert.equal(deckAt(9999,9999),null);
console.log('water-height ok');
