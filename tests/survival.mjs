import assert from 'node:assert/strict';
import {normalizeLife,tickLife} from '../dist/life.js';
import {freshProgress,normalizeProgress} from '../dist/jobs.js';
import {GameState,initializeState,setStatDrainMultiplier,tickLife as stateTick} from '../dist/state.js';
assert.equal(normalizeLife({food:40}).thirst,100);assert.equal(normalizeLife({thirst:-9}).thirst,0);assert.equal(normalizeLife({thirst:200}).thirst,100);
const normal=tickLife({food:100,thirst:100,energy:100},.1,true,false,1,1),fast=tickLife({food:100,thirst:100,energy:100},.1,true,false,1,50);
for(const stat of ['food','thirst','energy'])assert(Math.abs((100-normal[stat])*50-(100-fast[stat]))<1e-9);
assert(100-normal.thirst>100-normal.food);
assert(tickLife({food:0,thirst:100,energy:100},.1,false,false).energy<99.91);
assert(tickLife({food:100,thirst:0,energy:100},.1,false,false).energy<99.91);
assert(tickLife({food:0,thirst:0,energy:100},.1,false,false).energy<99.81);
for(const fps of [5,25,120]){
 let l={food:.01,thirst:.01,energy:100};for(let i=0;i<fps*5;i++)l=tickLife(l,1/fps,false,false);
 assert(Math.abs(l.energy-(100-5*.002-(5-.01/.018)-(5-.01/.028)))<1e-8,'depletion crossing is FPS-independent');
}
initializeState({playerId:'test',name:'Tester',progress:freshProgress()});const minutes=GameState.progress.routine.minutes;
setStatDrainMultiplier('50');stateTick(.1,false,false);assert.equal(GameState.progress.routine.minutes,minutes);assert.equal(GameState.progress.settings.statDrainMultiplier,50);
assert.deepEqual(normalizeProgress(GameState.progress).settings,{statDrainMultiplier:50});setStatDrainMultiplier('999');assert.equal(GameState.progress.settings.statDrainMultiplier,1);
assert.equal(normalizeProgress({}).life.thirst,100);assert.deepEqual(normalizeProgress({}).inventory,{slots:[],equipment:{jacket:null,backpack:null}});
console.log('Thirst migration, drain multipliers, energy penalties, depletion boundaries, state settings and clock independence passed.');
