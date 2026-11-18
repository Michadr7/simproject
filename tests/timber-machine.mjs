// Warehouse timber machine M-A: modes, 10/12/8 s cuts, cut-first rule, mode lock, caps, chips, frame-rate independence, saves.
import assert from 'node:assert/strict';
import * as M from '../dist/timber-machine.js';
import {GOODS} from '../dist/world-goods.js';
import {GAME_MIN_PER_REAL_SEC as G} from '../dist/gig-pay.js';
import {readFileSync} from 'node:fs';
const run=(s,min,hz)=>{const n=Math.round(min*hz);for(let i=0;i<n;i++)s=M.tick(s,1/hz);return s};
const fed=(k,n,s=M.freshMachine())=>M.feed(s,k,n).state;
const unlock=s=>M.tick(s,M.SWITCH_MIN);
// modes and counts
assert.deepEqual([M.MODES.post.input,M.MODES.post.output,M.MODES.post.count],['log','post',1]);
assert.deepEqual([M.MODES.beam.input,M.MODES.beam.output,M.MODES.beam.count],['log','beam',1]);
assert.deepEqual([M.MODES.dowel.input,M.MODES.dowel.output,M.MODES.dowel.count],['post','dowel',6]);
assert.deepEqual([M.MODES.post.seconds,M.MODES.beam.seconds,M.MODES.dowel.seconds],[10,12,8]);
assert.equal(M.MODES.post.min,10*G);assert.equal(M.MODES.beam.min,12*G);assert.equal(M.MODES.dowel.min,8*G);
assert.equal(M.SWITCH_MIN,1*G);
// post: 1 log -> 1 post in 10 s
let s=fed('log',2);assert.equal(s.on,true);
s=M.tick(s,M.MODES.post.min-.01);assert.equal(s.posts,0,'not done');assert.equal(s.cutKind,'post');
s=M.tick(s,.02);assert.equal(s.posts,1);assert.equal(s.logsIn,1);assert.equal(s.postsMade,1);assert.equal(s.chips,1,'1 chip per cut');
s=M.tick(s,M.MODES.post.min);assert.equal(s.posts,2);assert.equal(s.on,false,'tray empty');assert.equal(s.cutKind,null);assert.equal(s.chips,2);
// beam in 12 s
let b=unlock(M.setMode(fed('log',1),'beam').state);b=M.tick(b,M.MODES.beam.min-.01);assert.equal(b.beams,0);b=M.tick(b,.02);assert.equal(b.beams,1);assert.equal(b.beamsMade,1);assert.equal(b.logsIn,0);
// dowel: 1 post -> 6 dowels in 8 s
let d=unlock(M.setMode(fed('post',2),'dowel').state);d=M.tick(d,M.MODES.dowel.min-.01);assert.equal(d.dowels,0);d=M.tick(d,.02);assert.equal(d.dowels,6);assert.equal(d.postsIn,1);assert.equal(d.dowelsMade,1);assert.equal(d.chips,1);
// dowel mode does not use logs; post mode does not use posts
let w=unlock(M.setMode(fed('log',3),'dowel').state);assert.equal(w.on,false);w=M.tick(w,100);assert.deepEqual([w.dowels,w.logsIn],[0,3]);
let w2=fed('post',3);assert.equal(w2.on,false);assert.deepEqual([M.tick(w2,100).posts,M.tick(w2,100).postsIn],[0,3]);
// setMode refused during a cut, allowed after; a cut finishes before another mode starts
let c=M.tick(fed('log',2),1);assert.ok(c.cutKind);
const ref=M.setMode(c,'beam');assert.equal(ref.ok,false);assert.equal(typeof ref.reason,'string');assert.deepEqual(ref.state,c,'same state');assert.equal(ref.state.mode,'post');
c=M.tick(c,M.MODES.post.min);assert.equal(c.posts,1);assert.equal(c.cutKind,'post','second cut already running');
c=M.tick(c,M.MODES.post.min);assert.equal(c.posts,2);assert.equal(c.cutKind,null);
const ok=M.setMode(c,'beam');assert.equal(ok.ok,true);assert.equal(ok.reason,null);assert.equal(ok.state.mode,'beam');
assert.equal(M.setMode(M.freshMachine(),'zzz').ok,false);assert.equal(M.setMode(M.freshMachine(),'post').state.switchMin,0,'same mode, no lock');
// switch lock: 1 real second
let l=M.setMode(fed('log',1),'beam').state;assert.equal(l.switchMin,M.SWITCH_MIN);assert.equal(l.on,false,'locked');
assert.equal(M.setMode(l,'post').ok,false,'selector still moving');
l=M.tick(l,M.SWITCH_MIN/2);assert.equal(l.switchMin,M.SWITCH_MIN/2);assert.equal(l.cutKind,null);
l=M.tick(l,M.SWITCH_MIN/2+M.MODES.beam.min/2);assert.equal(l.switchMin,0);assert.equal(l.cutKind,'beam');assert.equal(l.cutMin,M.MODES.beam.min/2,'leftover goes into the cut');
// tray caps
let f=M.feed(M.freshMachine(),'log',99);assert.equal(f.accepted,8);assert.equal(f.refused,91);
f=M.feed(M.feed(M.freshMachine(),'post',5).state,'post',5);assert.equal(f.accepted,3);assert.equal(f.state.postsIn,8);
assert.equal(M.feed(M.freshMachine(),'plank',3).accepted,0);assert.equal(M.feed(M.freshMachine(),'log',0).accepted,0);assert.equal(M.feed(M.freshMachine(),'log',-2).accepted,0);
// pallet cap: 40 per kind, stops when full, resumes after take
let p=M.normalizeMachine({posts:39,logsIn:3,on:true});p=M.tick(p,M.MODES.post.min*3);assert.equal(p.posts,40);assert.equal(p.logsIn,2);assert.equal(p.on,false,'pallet full');assert.equal(p.cutKind,null);
p=M.tick(p,50);assert.equal(p.posts,40);assert.equal(p.logsIn,2);
const tk=M.take(p,'post',5);assert.equal(tk.taken,5);assert.equal(tk.state.posts,35);assert.equal(tk.state.on,true);
assert.equal(M.tick(tk.state,M.MODES.post.min*2).posts,37);
let dp=unlock(M.setMode(M.normalizeMachine({dowels:34,postsIn:3}),'dowel').state);dp=M.tick(dp,100);assert.equal(dp.dowels,40);assert.equal(dp.postsIn,2);assert.equal(dp.on,false,'no room for 6 more');assert.equal(M.normalizeMachine({dowels:36,postsIn:3,mode:'dowel'}).on,false,'36 + 6 does not fit');
// chip hopper cap, chips independent of pallet; take and takeChips
let ch=M.normalizeMachine({chips:39,logsIn:3});ch=M.tick(ch,M.MODES.post.min*3);assert.equal(ch.chips,40);assert.equal(ch.posts,3,'cutting goes on with a full hopper');
const tc=M.takeChips(ch,15);assert.equal(tc.taken,15);assert.equal(tc.state.chips,25);assert.equal(M.takeChips(M.freshMachine()).taken,0);assert.equal(M.takeChips(ch).state.chips,0);
assert.equal(M.take(M.freshMachine(),'beam',3).taken,0);assert.equal(M.take(M.normalizeMachine({beams:2}),'beam',9).taken,2);assert.equal(M.take(M.normalizeMachine({beams:2}),'log',1).taken,0);
// frame-rate independence
for(const hz of [30,60,144]){const a=run(M.feed(M.feed(M.freshMachine(),'log',3).state,'log',0).state,3*M.MODES.post.min+.5,hz);assert.deepEqual([a.posts,a.logsIn,a.chips,a.postsMade],[3,0,3,3],'post '+hz);
 const bb=run(unlock(M.setMode(fed('log',2),'beam').state),2*M.MODES.beam.min+M.SWITCH_MIN,hz);assert.deepEqual([bb.beams,bb.logsIn,bb.chips],[2,0,2],'beam '+hz);
 const dd=run(unlock(M.setMode(fed('post',2),'dowel').state),2*M.MODES.dowel.min+1,hz);assert.deepEqual([dd.dowels,dd.postsIn],[12,0],'dowel '+hz);
 const half=run(fed('log',1),M.MODES.post.min/2,hz);assert.equal(half.cutMin,M.MODES.post.min/2,'progress '+hz)}
// a cut in progress survives a save
const sv=M.normalizeMachine(JSON.parse(JSON.stringify(M.tick(fed('log',2),2))));assert.equal(sv.cutKind,'post');assert.equal(sv.cutMin,2);
// junk and old saves
for(const junk of [null,undefined,5,'x',[],{mode:'zzz',logsIn:-4,posts:'a',cutKind:'beam',cutMin:NaN,chips:1e9,switchMin:-3}]){const n=M.normalizeMachine(junk);assert.equal(n.v,1);assert.equal(n.mode,'post');assert.ok(n.logsIn>=0&&n.chips<=M.MAX_CHIPS&&n.switchMin>=0)}
const old=M.normalizeMachine({logsIn:50,posts:99,mode:'beam',cutKind:'dowel',cutMin:3});assert.equal(old.logsIn,8);assert.equal(old.posts,40);assert.equal(old.cutKind,null,'cut for another mode dropped');
assert.equal(M.normalizeMachine({logsIn:1,cutKind:'post',cutMin:99}).cutKind,null,'cutMin past the cut length dropped');
assert.equal(M.normalizeMachine({cutKind:'post',cutMin:1}).cutKind,null,'no log for the cut');
// frozen results
for(const x of [M.freshMachine(),M.tick(fed('log',1),1),M.feed(M.freshMachine(),'log',1),M.take(M.freshMachine(),'post'),M.takeChips(M.freshMachine()),M.setMode(M.freshMachine(),'beam'),M.summarize(M.freshMachine()),M.MODES,M.MODES.post,M.PRODUCT_CENTS])assert(Object.isFrozen(x));
// bad dt
const z=fed('log',1);assert.deepEqual(M.tick(z,0),z);assert.deepEqual(M.tick(z,-1),z);assert.deepEqual(M.tick(z,NaN),z);
// purity: no clock, no random, no DOM
const src=readFileSync(new URL('../dist/timber-machine.js',import.meta.url),'utf8');
assert.equal(/Date\.now|Math\.random|performance\.now|document|window|\bimport\s+\*?\s*as\s+THREE|from\s+'three/.test(src),false);
const j=JSON.stringify(run(fed('log',4),30,60));assert.equal(j,JSON.stringify(run(fed('log',4),30,60)),'deterministic');
// prices equal the design and the goods data
assert.deepEqual({...M.PRODUCT_CENTS},{post:3000,beam:3800,dowel:700,chip:100});
for(const [g,k] of [['posts','post'],['beams','beam'],['dowels','dowel'],['chips','chip']]){assert.equal(GOODS[g].baseCents,M.PRODUCT_CENTS[k],g);assert.equal(GOODS[g].group,'lumber');assert.equal(GOODS[g].unit,k)}
// summarize
const sm=M.summarize(M.tick(fed('log',2),2.5));assert.equal(sm.cutting,true);assert.equal(sm.cutProgress,.5);assert.equal(sm.canChangeMode,false);assert.equal(sm.output,'post');assert.equal(M.summarize(M.freshMachine()).inputMissing,true);
console.log('PASS timber-machine.mjs: post/beam/dowel modes (1/1/6 per cut, 10/12/8 s), cut finishes first, mode lock and 1 s switch, caps (8 in, 40 out, 40 chips), chips +1 per cut, take, frame-rate independent, saves load, frozen, pure, prices.');