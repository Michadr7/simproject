// Tracker text for restock gigs (dist/gig-bridge.js activeView): plank gigs say planks at the sawmill, crate gigs keep the crates wording.
import assert from 'node:assert/strict';
import {normalizeWorld} from '../dist/world-state.js';
import {needsFrom} from '../dist/needs.js';
import {boardFor,acceptGig,pickNeedHaul,freshGigs} from '../dist/gigs.js';
import {normalizeYard} from '../dist/sawmill-yard.js';
import {SUPPLIER,SAWMILL} from '../dist/plank-needs.js';
import {activeView} from '../dist/gig-bridge.js';

const DAY=10,NOW=DAY*1440+600;
const w=normalizeWorld(null,7301,DAY);
w.stock[SUPPLIER].planks=0;w.stock[SAWMILL].planks=40;
const needs=needsFrom(w,DAY,{boardOnly:true,plankStock:{}});
const base={cash:0,routine:{earned:0,minutes:600},housing:{day:DAY+1},vehicles:[{uid:'v1',model:'worktruck',loan:false}],world:w,needs,sawmillYard:normalizeYard({planks:40}),gigs:freshGigs(),npcs:{},standing:{people:{}}};
const board=boardFor(base,NOW);
const plank=board.find(s=>s.type==='need-restock'&&s.good==='planks');
assert(plank,'a plank restock is on the board');
let p=acceptGig(base,plank.slot,NOW).state;
let d=activeView(p).description;
assert(d.includes('Load the planks at the sawmill (E)'),'plank gig, before loading: '+d);
assert(!/crates/i.test(d),'plank gig never says crates: '+d);
p=pickNeedHaul(p,NOW+5,{uid:'v1',maxUnits:32}).state;
d=activeView(p).description;
assert(/Planks loaded/.test(d)&&!/crates/i.test(d),'plank gig, loaded: '+d);

const crate=board.find(s=>s.type==='need-restock'&&s.good&&s.good!=='planks'&&s.mode==='vehicle');
if(crate){
 const c=acceptGig(base,crate.slot,NOW).state;
 const cd=activeView(c).description;
 assert(cd.includes('Load the crates at the pile (E)'),'crate gig keeps old wording: '+cd);
 assert(!/planks/i.test(cd));
}else{
 // no crate gig on this board: check the crate wording on a hand-made active gig
 const a={...p.gigs.active,needGood:'eggs',haul:0};
 const cd=activeView({...p,gigs:{...p.gigs,active:a}}).description;
 assert(cd.includes('Load the crates at the pile (E)'),'crate gig keeps old wording: '+cd);
}
console.log('PASS gig-tracker-text.mjs: plank gigs read "Load the planks at the sawmill (E)"; crate gigs keep "Load the crates at the pile (E)".');