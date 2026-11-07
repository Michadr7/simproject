import assert from 'node:assert/strict';
import {normalizeLife,tickLife,needsEffects,lifeTransaction} from '../dist/life.js';
import {freshProgress,normalizeProgress} from '../dist/jobs.js';
import {GameState,initializeState,setStatDrainMultiplier,tickLife as stateTick} from '../dist/state.js';
assert.equal(normalizeLife({food:40}).thirst,100);assert.equal(normalizeLife({thirst:-9}).thirst,0);assert.equal(normalizeLife({thirst:200}).thirst,100);
const normal=tickLife({food:100,thirst:100,energy:100},.1,true,false,1,1),fast=tickLife({food:100,thirst:100,energy:100},.1,true,false,1,50);
for(const stat of ['food','thirst','energy'])assert(Math.abs((100-normal[stat])*50-(100-fast[stat]))<1e-9);
assert(100-normal.thirst>100-normal.food);
// Needs effects (DESIGN 4.18): hunger at 10 or under drains energy 1.5x; thirst alone does not; no hidden penalty
const loss=l=>100-tickLife({...l,energy:100},1,false,false).energy,base=loss({food:100,thirst:100});
assert(Math.abs(loss({food:5,thirst:100})-base*1.5)<1e-9&&Math.abs(loss({food:0,thirst:0})-base*1.5)<1e-9&&Math.abs(loss({food:100,thirst:0})-base)<1e-9&&Math.abs(loss({food:11,thirst:100})-base)<1e-9);
assert(needsEffects({food:30,thirst:30,energy:30}).warn.length===0&&needsEffects({food:25,thirst:100,energy:100}).warn.join()==='food'&&needsEffects({food:10,thirst:20,energy:0}).warn.join()==='food,thirst,energy');
const fx=needsEffects;assert.deepEqual([fx({thirst:10}).canRun,fx({thirst:11}).canRun,fx({energy:10}).canRun,fx({energy:10}).speed,fx({energy:11}).speed],[false,true,false,.75,1]);
assert.deepEqual([fx({food:0}).energyCap,fx({thirst:0}).energyCap,fx({food:1,thirst:1}).energyCap,fx({energy:0}).passOut,fx({energy:1}).passOut,fx({thirst:0}).dry],[50,50,100,true,false,true]);
// a drink at 0 thirst lifts energy only to 50, and never lowers energy that is already above the cap
{const a=lifeTransaction({cash:1000,life:{food:80,thirst:0,energy:30}},'drink','market').state.life.energy,b=lifeTransaction({cash:1000,life:{food:80,thirst:0,energy:70}},'drink','market').state.life.energy;assert.equal(a,50);assert.equal(b,70);}
initializeState({playerId:'test',name:'Tester',progress:freshProgress()});const minutes=GameState.progress.routine.minutes;
setStatDrainMultiplier('50');stateTick(.1,false,false);assert.equal(GameState.progress.routine.minutes,minutes);assert.equal(GameState.progress.settings.statDrainMultiplier,50);
assert.deepEqual(normalizeProgress(GameState.progress).settings,{statDrainMultiplier:50});setStatDrainMultiplier('999');assert.equal(GameState.progress.settings.statDrainMultiplier,1);
assert.equal(normalizeProgress({}).life.thirst,100);assert.deepEqual(normalizeProgress({}).inventory,{slots:[],equipment:{jacket:null,backpack:null}});
console.log('Thirst migration, drain multipliers, energy penalties, depletion boundaries, state settings and clock independence passed.');
