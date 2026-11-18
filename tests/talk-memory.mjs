// C3 (notes/conversation-design.md 2f): talk memory caps, junk, frozen results, progress.talk cap 48, migration, and an old 0.35.18 save that loads unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../dist/talk-memory.js';
import {normalizeProgress,freshProgress} from '../dist/jobs.js';
import {normalizeNpcs} from '../dist/npc-life.js';
import {ROSTER_ORDER} from '../dist/npc-roster.js';

// junk -> the empty, frozen mem
for(const g of [null,undefined,0,'x',[],{last:'a',seen:[1],beats:{}},{last:[1,null,'__proto__','constructor',''],seen:{__proto__:{a:1}},beats:[7]}]){
 const m=T.normalizeTalkMem(g);assert.deepEqual(m,{last:[],seen:{},beats:[],lastMin:-1});assert.ok(T.isEmptyMem(m));assert.ok(Object.isFrozen(m)&&Object.isFrozen(m.last)&&Object.isFrozen(m.seen))}
// caps: last 6 (newest kept, a repeat moves to the end), seen 32 (highest counts), beats 16 (first kept, unique)
{const m=T.normalizeTalkMem({last:['a','b','a','c','d','e','f','g','h'],seen:Object.fromEntries([...Array(40).keys()].map(i=>['n'+i,40-i])),beats:[...Array(20).keys()].map(i=>'b'+(i%18)),lastMin:5.9});
 assert.deepEqual([...m.last],['c','d','e','f','g','h']);assert.equal(Object.keys(m.seen).length,T.MEM_SEEN);assert.equal(m.seen.n0,40);assert.equal(m.seen.n39,undefined);
 assert.equal(m.beats.length,T.MEM_BEATS);assert.equal(m.beats[0],'b0');assert.equal(m.lastMin,5);
 assert.deepEqual(T.normalizeTalkMem(JSON.parse(JSON.stringify(m))),m,'round trip')}
// helpers: new frozen data, input untouched, deterministic
{let m=T.EMPTY_MEM;for(const k of ['k1','k2','k3','k4','k5','k6','k7','k2'])m=T.recordLine(m,k);assert.deepEqual([...m.last],['k3','k4','k5','k6','k7','k2']);assert.ok(Object.isFrozen(m));
 assert.equal(T.recordLine(m,'bad key!'),m);
 let s=T.recordNode(T.recordNode(m,'noah.open'),'noah.open');assert.equal(T.seenCount(s,'noah.open'),2);assert.equal(T.seenCount(m,'noah.open'),0,'input untouched');
 for(let i=0;i<40;i++)s=T.recordNode(s,'x.'+i);assert.equal(Object.keys(s.seen).length,T.MEM_SEEN);assert.equal(T.seenCount(s,'noah.open'),2,'the most-seen node stays');assert.equal(T.seenCount(s,'x.39'),1,'the newest is in');
 let b=T.EMPTY_MEM;for(let i=0;i<20;i++)b=T.recordBeat(b,'beat.'+i);assert.equal(b.beats.length,16);assert.ok(T.hasBeat(b,'beat.0')&&!T.hasBeat(b,'beat.19'));assert.equal(T.recordBeat(b,'beat.3'),b);
 assert.equal(T.stampMem(b,1440*3+600).lastMin,4920);assert.equal(T.stampMem(b,-50).lastMin,-1);
 assert.deepEqual(T.withMem({id:'noah',mood:5,mem:s},T.EMPTY_MEM),{id:'noah',mood:5},'an empty mem is not saved');assert.equal(T.withMem({id:'noah'},s).mem,s)}
// progress.talk: junk, cap 48 (oldest lastDay out, never the one just written), metDay kept
{assert.deepEqual(T.normalizeTalkPeople('junk'),{v:1,people:{}});assert.ok(T.isEmptyTalk(T.normalizeTalkPeople({people:{a:{}}})),'an empty person is dropped');
 const raw={v:1,people:Object.fromEntries([...Array(60).keys()].map(i=>['p'+i+'#1',{metDay:i,lastDay:100+i,last:['l'+i]}]))};raw.people.__proto__={metDay:1};
 const t=T.normalizeTalkPeople(raw);assert.equal(Object.keys(t.people).length,T.TALK_PEOPLE);assert.equal(t.people['p0#1'],undefined);assert.equal(t.people['p59#1'].lastDay,159);assert.ok(Object.isFrozen(t.people));
 const t2=T.notePerson(t,'old#1',5,T.recordLine(T.EMPTY_MEM,'hello'));assert.equal(Object.keys(t2.people).length,48);assert.equal(t2.people['old#1'].lastDay,5,'the one just written stays even though its day is oldest');assert.equal(t2.people['p12#1'],undefined);
 const t3=T.notePerson(t2,'old#1',9,T.personMem(t2,'old#1'));assert.equal(t3.people['old#1'].metDay,5);assert.equal(t3.people['old#1'].lastDay,9);assert.deepEqual([...T.personMem(t3,'old#1').last],['hello']);
 assert.deepEqual(T.normalizeTalkPeople(JSON.parse(JSON.stringify(t3))),t3,'round trip');assert.deepEqual(T.notePerson(t,'old#1',5,T.EMPTY_MEM),T.notePerson(t,'old#1',5,T.EMPTY_MEM),'deterministic')}
// migration from an old save: met -> '<id>.first', Lincoln's hunting talks -> seen, story beats, hired, Elena met through the cafe job
const old=JSON.parse(fs.readFileSync(new URL('./fixtures/save-0.35.18-talk.json',import.meta.url),'utf8')).progress;
const oldCopy=JSON.stringify(old);
const P=normalizeProgress(old);assert.equal(JSON.stringify(old),oldCopy,'input not mutated');
for(const k of Object.keys(old))if(k!=='npcs'&&k!=='sawmillYard')assert.deepEqual(P[k],old[k],'old field kept unchanged: '+k);
if(old.sawmillYard)for(const k of Object.keys(old.sawmillYard))if(k!=='v')assert.deepEqual(P.sawmillYard[k],old.sawmillYard[k],'old yard field kept: '+k); // the yard is upgraded to v2 (trunks, slabs) on load
assert.equal(P.talk,undefined,'no progress.talk until someone outside the roster is talked to');
for(const id of Object.keys(old.npcs)){const {mem,...rest}=P.npcs[id];assert.deepEqual(rest,old.npcs[id],'npc kept: '+id)}
assert.deepEqual(Object.keys(P.npcs),ROSTER_ORDER);
assert.equal(P.npcs.hal.mem.seen['hal.first'],1);assert.ok(P.npcs.hal.mem.beats.includes('hal.met'));
assert.equal(P.npcs.lincoln.mem.seen['lincoln.hunt.deer'],2);assert.equal(P.npcs.lincoln.mem.seen['lincoln.hunt.rifles'],1);assert.equal(P.npcs.lincoln.mem.seen['lincoln.hunt.chat'],undefined);
assert.ok(P.npcs.sophie.mem.beats.includes('sophie.groceries-delivered'));assert.deepEqual([...P.npcs.walt.mem.beats],['walt.note','walt.hired']);
assert.equal(P.npcs.elena.metDay,11,'Elena is met: you work for her (npc day = housing.day - 1)');assert.equal(P.npcs.elena.mem.seen['elena.first'],1);
assert.equal(P.npcs.grace.mem,undefined,'not met: no mem');assert.equal(P.npcs.foreman.mem,undefined,'dormant: no mem');
assert.deepEqual(normalizeProgress(JSON.parse(JSON.stringify(P))),P,'a second load is identical (migration runs once)');
// a skipped story gives no story beats; a fresh game has no mem anywhere and no talk block
{const f=normalizeProgress(freshProgress());assert.ok(ROSTER_ORDER.every(id=>!f.npcs[id].mem));assert.equal(f.talk,undefined);
 const sk=normalizeProgress({...old,starter:{...old.starter,step:10,done:true,skipped:true,noteGiven:false},careers:{}});assert.equal(sk.npcs.sophie.mem.beats.length,0);assert.equal(sk.npcs.walt.mem.beats.length,0)}
// a saved mem is never re-migrated, and a progress.talk entry survives a save
{const m=T.recordBeat(T.EMPTY_MEM,'walt.custom');const Q=normalizeProgress({...old,npcs:{...old.npcs,walt:{...old.npcs.walt,mem:m}},talk:{v:1,people:{'oak-apartments/3#1':{metDay:2,lastDay:4,last:['zz']}}}});
 assert.deepEqual([...Q.npcs.walt.mem.beats],['walt.custom']);assert.equal(Q.talk.people['oak-apartments/3#1'].lastDay,4);assert.deepEqual(normalizeNpcs(Q.npcs).walt.mem,Q.npcs.walt.mem)}
// pure: no clock, no chance, no DOM; a short header line
{const src=fs.readFileSync(new URL('../dist/talk-memory.js',import.meta.url),'utf8'),code=src.replace(/\/\/.*$/gm,'');assert.ok(!/Math\.random|Date\.now|new Date/.test(code));assert.ok(!/\b(document|window|THREE)\b/.test(code));const h=src.split('\n')[0];assert.ok(h.startsWith('// talk-memory.js:')&&h.length<200,h.length)}
console.log('PASS talk-memory: caps (6/32/16, 48 people), junk, frozen, helpers, old 0.35.18 save loads unchanged, migration beats, Elena met via the cafe, once only');
