import assert from 'node:assert/strict';
import {ACTION_KINDS,activeAction,canStart,refusal} from '../dist/actions.js';

const idle={chop:false,consume:false,work:false,sleep:false,door:false};
assert.deepEqual([...ACTION_KINDS],['chop','consume','work','sleep','door']);
assert.equal(activeAction(idle),null);assert.equal(activeAction(),null);
// When nothing is going on, everything may start.
for(const kind of [...ACTION_KINDS,'equip','interact','bag'])assert(canStart(kind,idle),`${kind} may start when idle`);
// When any one action is going on, nothing else may start, in either direction, including the same action twice.
for(const running of ACTION_KINDS){
 const flags={...idle,[running]:true};assert.equal(activeAction(flags),running);
 for(const kind of [...ACTION_KINDS,'equip','interact','bag'])assert(!canStart(kind,flags),`${kind} must not start during ${running}`);
}
// Eating during a swing (the bug) and swinging during a meal are both refused.
assert(!canStart('consume',{...idle,chop:true}));assert(!canStart('chop',{...idle,consume:true}));
assert.equal(refusal(),'Finish your current action first.');
// Missing flags count as not running.
assert(canStart('chop',{work:false}));assert(!canStart('chop',{sleep:true}));
console.log('Action exclusivity (every action blocks every other, both ways) passed.');
