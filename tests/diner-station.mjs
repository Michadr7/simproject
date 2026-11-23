// Diner Station View tests (notes/diner-design.md, D-C): key paths, scoring, burn, remake, cancel, and dinerAct wiring.
import assert from 'node:assert/strict';
import {createStationSession,addStationPart,toggleStationHeat,tickStation,remakeStation,finishStation,createDinerStationUI} from '../dist/diner-station.js';
import {dinerAct} from '../dist/diner-flow.js';
import {recipeById} from '../dist/diner-recipes.js';
import {normalizeProgress} from '../dist/jobs.js';

const espresso=recipeById('espresso');
let s=createStationSession({id:'t1',recipeId:'espresso',tableId:'t1',customerName:'Maya',waitMin:5},espresso);
assert.equal(s.station,'espresso');
s=addStationPart(s,'cup_demitasse');
s=addStationPart(s,'coffee_grounds');
s=addStationPart(s,'espresso_shot');
s=toggleStationHeat(s);
for(let i=0;i<15;i++)s=tickStation(s,0.2);
assert.equal(s.burnt,false);
const good=finishStation(s,5);
assert(good.ok&&good.quality>=0.9&&good.tipCents>0,'good espresso scores high with tip');

// Burn & remake
let burnt=createStationSession({id:'t2',recipeId:'espresso',tableId:'t1',customerName:'Maya',waitMin:5},espresso);
burnt=toggleStationHeat(burnt);
for(let i=0;i<40;i++)burnt=tickStation(burnt,0.2);
assert.equal(burnt.burnt,true,'heating past burnSec burns');
assert.equal(finishStation(burnt,5).ok,false);
burnt=remakeStation(burnt);
assert.equal(burnt.burnt,false);
assert.equal(burnt.remakes,1);
assert.deepEqual(burnt.placed,[]);

// DOM tray key paths
const makeEl=tag=>({tagName:tag,style:{},children:[],hidden:false,disabled:false,textContent:'',replaceChildren(...a){this.children=a},append(...a){this.children.push(...a)}});
const doc={body:{append(){}},createElement:makeEl};
let closed=0,finished=0;
const ui=createDinerStationUI({document:doc,onPart:id=>{s=addStationPart(s,id)},onHeat:()=>{s=toggleStationHeat(s)},onFinish:()=>{finished++},onRemake:()=>{s=remakeStation(s)},onClose:()=>{closed++;ui.hide()}});
ui.render(s);
assert.equal(ui.root.hidden,false);
assert.equal(ui.onKey('Digit1',s),true);
assert.equal(ui.onKey('Space',s),true);
assert.equal(ui.onKey('Enter',s),true);
assert.equal(finished,1);
assert.equal(ui.onKey('Escape',s),true);
assert.equal(closed,1);

// dinerAct integration with Station View result
let p=normalizeProgress({});
p={...p,shift:{employer:'diner',startMin:500,tasks:[],pieces:{},diner:{rank:2,startMin:500,elapsedMin:10,tipsCents:0,tables:[{id:'t1',status:'ordered',ticketId:'t1',customer:{name:'Maya'}}],tickets:[{id:'t1',tableId:'t1',customerName:'Maya',recipeId:'espresso',stage:'open',waitMin:5}],carried:[]}}};
const failRes=dinerAct(p,'make','t1',{ok:false,burnt:true,quality:0,tipCents:0});
assert.equal(failRes.failed,true);
const okRes=dinerAct(p,'make','t1',good);
assert.equal(okRes.state.shift.diner.tickets[0].stage,'ready');
assert.equal(okRes.state.shift.diner.tickets[0].tipCents,good.tipCents);
console.log('PASS diner-station: scoring, burn, remake, key paths (1-9/Space/Enter/Esc), and dinerAct wiring');
