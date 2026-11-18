// Timber redesign T-B: sawmill yard v2 with trunks and slabs (old v1 saves load, a trunk sawn whole is 2 slabs in 12 s, logs first, frame-rate independent).
import assert from 'node:assert/strict';
import * as Y from '../dist/sawmill-yard.js';
import {SAW_MIN_PER_LOG,SAW_MIN_PER_TRUNK} from '../dist/plank-economy.js';
const run=(s,min,hz)=>{const n=Math.round(min*hz);for(let i=0;i<n;i++)s=Y.tick(s,1/hz);return s};
let s=Y.feed(Y.freshYard(),2,'trunk').state;assert.equal(s.trunks,2);assert.equal(s.on,true);assert.equal(s.logs,0);
s=Y.tick(s,SAW_MIN_PER_TRUNK-.01);assert.equal(s.slabs,0,'not done yet');assert.equal(s.cutKind,'trunk');
s=Y.tick(s,.02);assert.equal(s.slabs,2,'one trunk = 2 slabs');assert.equal(s.trunks,1);assert.equal(s.trunksSawn,1);
s=Y.tick(s,SAW_MIN_PER_TRUNK);assert.equal(s.slabs,4);assert.equal(s.on,false,'nothing left to cut');assert.equal(s.cutKind,null);
assert.equal(SAW_MIN_PER_TRUNK/SAW_MIN_PER_LOG,1.5,'12 s against 8 s');
// logs first, then trunks, in one long tick
let m=Y.feed(Y.feed(Y.freshYard(),1,'trunk').state,2,'log').state;m=Y.tick(m,2*SAW_MIN_PER_LOG+SAW_MIN_PER_TRUNK+.01);assert.deepEqual([m.logs,m.trunks,m.planks,m.slabs],[0,0,8,2]);
// a cut in progress finishes before another kind starts, and the saved state round-trips
let p=Y.feed(Y.freshYard(),1,'trunk').state;p=Y.tick(p,SAW_MIN_PER_TRUNK/2);p=Y.feed(p,1,'log').state;p=Y.tick(p,SAW_MIN_PER_TRUNK/2);assert.equal(p.slabs,2,'the trunk cut finished first');assert.equal(p.logs,1);
const q=Y.normalizeYard(JSON.parse(JSON.stringify(Y.tick(Y.feed(Y.freshYard(),2,'trunk').state,3))));assert.equal(q.cutKind,'trunk');assert.equal(q.cutMin,3);
// frame-rate independence
for(const hz of [30,60,144]){const a=run(Y.feed(Y.feed(Y.freshYard(),2,'trunk').state,2,'log').state,20,hz);assert.deepEqual([a.logs,a.trunks,a.planks,a.slabs],[0,0,8,4],hz+' Hz')}
// caps and refusals
let f=Y.freshYard();const r=Y.feed(f,99,'trunk');assert.equal(r.accepted,Y.YARD_MAX_TRUNKS);assert.equal(r.refused,99-Y.YARD_MAX_TRUNKS);
let full=Y.normalizeYard({trunks:1,slabs:Y.YARD_MAX_SLABS,on:true});assert.equal(full.on,false,'a full slab pile blocks the trunk cut');
assert.equal(Y.switchSaw(full,true).on,false);
// takeSlab
const t1=Y.takeSlab(Y.normalizeYard({slabs:3}));assert.equal(t1.slabs,1);assert.equal(t1.state.slabs,2);assert.equal(Y.takeSlab(Y.freshYard()).slabs,0);
// old v1 save and garbage load
const old=Y.normalizeYard({v:1,logs:2,logsSawn:5,planks:8,cutMin:1.5,on:true,lastTrickleDay:3});assert.equal(old.v,2);assert.equal(old.trunks,0);assert.equal(old.slabs,0);assert.equal(old.logs,2);
for(const junk of [null,undefined,5,'x',[],{trunks:-4,slabs:'a',cutKind:'zzz',cutMin:NaN}]){const n=Y.normalizeYard(junk);assert.equal(n.v,2);assert.ok(n.trunks>=0&&n.slabs>=0)}
assert.equal(Y.summarize(Y.normalizeYard({trunks:2,slabs:5})).canTakeSlab,true);assert(Object.isFrozen(Y.freshYard()));
console.log('PASS sawmill-yard-trunks.mjs: trunks sawn whole into 2 slabs in 12 s, logs before trunks, a cut finishes first, caps (20 trunks, 80 slabs), takeSlab, v1 saves load, frame-rate independent.');