// NPC chat (NPC-NAMES): every person gets a name, a time-of-day greeting and one fact; the same person says the same thing on the same day and hour; garbage input does not throw.
import assert from 'node:assert/strict';
import {chatLine,periodOf,homeName,workPhrase,GREETINGS} from '../dist/npc-chat.js';
import {townPopulation} from '../dist/population.js';
const people=townPopulation().people;assert.ok(people.length>=20);
for(const p of people){const a=chatLine(p,{day:3,minute:600}),b=chatLine(p,{day:3,minute:600});assert.deepEqual(a,b,'deterministic');assert.equal(a.name,p.name);assert.ok(a.text.includes(p.name),'says its name');assert.ok(GREETINGS.morning.some(g=>a.text.startsWith(g)),'morning greeting: '+a.text);assert.ok(!/undefined|NaN|\[object/.test(a.text),a.text)}
assert.equal(periodOf(0),'night');assert.equal(periodOf(300),'morning');assert.equal(periodOf(720),'afternoon');assert.equal(periodOf(1200),'evening');assert.equal(periodOf(-60),'night');assert.equal(periodOf(NaN),'night');
const resident=people.find(p=>p.resident&&homeName(p));assert.ok(resident,'someone lives at a named property');assert.ok(/\d/.test(homeName(resident)));
const worker=people.find(p=>workPhrase(p));assert.ok(worker&&/^I work as/.test(workPhrase(worker)));
{const texts=new Set(people.map(p=>chatLine(p,{day:1,minute:600}).text));assert.ok(texts.size>people.length/2,'people do not all say the same thing')}
assert.ok(chatLine({id:'x',name:'Ann'},{weather:'blizzard',minute:1e9}).text.includes('Ann'));assert.equal(chatLine(null).name,'A neighbour');assert.equal(chatLine({}).name,'A neighbour');assert.ok(chatLine(undefined,{day:NaN,minute:'x'}).text.length>3);
console.log('PASS npc-chat: '+people.length+' people greet by name, deterministic, time of day, home and job facts, garbage safe');