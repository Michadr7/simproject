import assert from 'node:assert/strict';
import {WAKE_MINUTE,SLEEP_DRAIN_FACTOR,minutesToWake,sleepThrough} from '../dist/sleep.js';
import {freshProgress} from '../dist/jobs.js';
import {tickLife} from '../dist/life.js';

// Sleeping (0.34): single player skips to 6 AM with a slow drain; multiplayer only restores energy.
assert.equal(WAKE_MINUTE,360);assert.equal(minutesToWake(22*60),8*60,'10 PM: eight hours');assert.equal(minutesToWake(0),360,'midnight: six hours');assert.equal(minutesToWake(300),60,'5 AM: one hour (today)');assert.equal(minutesToWake(359.6),1);assert.equal(minutesToWake(360),1440,'exactly 6 AM: a whole day');assert.equal(minutesToWake(361),1439);
const at=(day,minutes,extra={})=>{const p=freshProgress();return {...p,housing:{...p.housing,day},routine:{...p.routine,minutes},life:{...p.life,energy:20,food:80,thirst:80},...extra}};
{const s=at(3,22*60+30),r=sleepThrough(s);assert.equal(r.minutes,7.5*60);assert.equal(r.state.routine.minutes,360,'wakes at 6 AM');assert.equal(r.state.housing.day,4,'on the next day');assert.equal(r.state.life.energy,100);
 const hours=7.5,expectFood=80-hours*60*2*SLEEP_DRAIN_FACTOR*.018,expectThirst=80-hours*60*2*SLEEP_DRAIN_FACTOR*.028;assert(Math.abs(r.state.life.food-expectFood)<1e-6&&Math.abs(r.state.life.thirst-expectThirst)<1e-6,'slow drain over the skipped hours');
 // slower than being awake for the same time (a game minute is two real seconds)
 let awake=at(3,0).life;for(let i=0;i<hours*60*2*4;i++)awake=tickLife(awake,.25,false,false);assert(r.state.life.food>awake.food+5&&r.state.life.thirst>awake.thirst+5,'much slower than awake');
 assert(/6:00 AM/.test(r.message)&&/7.5 h/.test(r.message),r.message)}
{const s=at(2,3*60),r=sleepThrough(s);assert.equal(r.state.housing.day,2,'before 6 AM: the same day');assert.equal(r.state.routine.minutes,360)}
{const s=at(3,22*60),r=sleepThrough(s,{online:true});assert.equal(r.minutes,0);assert.equal(r.state.routine.minutes,22*60,'multiplayer: the clock never moves');assert.equal(r.state.housing.day,3);assert.equal(r.state.life.food,80,'no drain');assert.equal(r.state.life.energy,100);assert.equal(r.message,'Rested · Energy restored')}
{const s=at(1,23*60,{life:{...freshProgress().life,food:1,thirst:1,energy:5}}),r=sleepThrough(s,{drainMultiplier:50});assert.equal(r.state.life.food,0);assert.equal(r.state.life.thirst,0,'never below zero');assert.equal(r.state.life.energy,100)}
{// a week of nights bills rent through the day change (the housing day advances once per night)
 let s=at(1,23*60);for(let i=0;i<3;i++)s=sleepThrough({...s,routine:{...s.routine,minutes:23*60}}).state;assert.equal(s.housing.day,4)}
console.log('Sleep: wake at 6 AM (today or tomorrow), the next day starts when midnight is crossed, food and thirst drain at a quarter of the awake rate, never below zero, and multiplayer moves nothing but energy.');