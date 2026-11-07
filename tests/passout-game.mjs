import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {PASS_OUT_MINUTES,passOutThrough} from '../dist/sleep.js';
const absolute=q=>(q.housing.day-1)*1440+q.routine.minutes;

// Passing out (DESIGN 4.18): the pure rule, then the game: at 0 energy the screen fades, you wake in your home with energy 25 two game hours later, a message says so.
{const s={life:{food:80,thirst:80,energy:0},routine:{minutes:600},housing:{day:1}},a=passOutThrough(s,{}),b=passOutThrough(s,{online:true});
 assert.equal(a.minutes,PASS_OUT_MINUTES);assert.equal(a.state.life.energy,25);assert(a.state.life.food<80&&a.state.life.food>70,'food drains at the sleep rate: '+a.state.life.food);
 assert.equal(b.minutes,0);assert.equal(b.state.life.energy,25);assert.equal(b.state.life.food,80,'online nothing moves but energy');}
const g=await bootGame({position:{x:0,z:3}});
try{
 const {GameState,pump}=g,p=()=>GameState.progress,fade=g.ids.get('sleepFade');
 p().housing={...p().housing,rented:true};pump(.3);const before=absolute(p());
 p().life.energy=0;pump(.3);assert(!fade.hidden,'the screen fades');assert.equal(fade.textContent,'You passed out from exhaustion');
 pump(1);assert.equal(Math.round(p().life.energy),25,'woke with energy 25');
 assert.equal(absolute(p())-before>=PASS_OUT_MINUTES,true,'two game hours passed: '+(absolute(p())-before));
 assert(p().messages.some(m=>/passed out/.test(m.text)&&m.app==='player'),'a message says what happened');
 pump(2);assert(fade.hidden,'the fade ends');
 console.log('Passing out: the pure rule, and in the game the fade, waking at home with energy 25 two game hours later, and a message.');
}finally{g.done?.()}