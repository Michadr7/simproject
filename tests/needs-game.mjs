import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';

// Needs in the game (DESIGN 4.18): one phone message when a need reaches 25, none repeated while it stays low, again after it recovers; at 10 thirst Shift stops running;
// at 0 thirst the screen edges dim.
const g=await bootGame({position:{x:0,z:3}});
try{
 const {GameState,pump,send}=g,me=GameState.me,body=document.body,p=()=>GameState.progress,hungry=()=>p().messages.filter(m=>/hungry/.test(m.text)).length;
 pump(.3);assert.equal(hungry(),0);
 p().life.food=24;pump(.3);assert.equal(hungry(),1,'a message at 25 or under');assert.equal(p().messages[0].app,'player');
 p().life.food=20;pump(.5);assert.equal(hungry(),1,'not repeated while it stays low');
 p().life.food=60;pump(.3);p().life.food=24;pump(.3);assert.equal(hungry(),2,'again after it recovered');
 const run=(thirst)=>{p().life.thirst=thirst;const z0=me.position.z;send('keydown','ShiftLeft');send('keydown','KeyW');pump(1);send('keyup','KeyW');send('keyup','ShiftLeft');return Math.abs(me.position.z-z0)};
 const fast=run(100),slow=run(9);p().life.thirst=100;
 assert(slow<fast*.8,`thirst 9: no running (${slow.toFixed(1)} m vs ${fast.toFixed(1)} m)`);
 p().life.thirst=0;pump(.3);assert(body.classList.contains('thirst-dry'),'edges dim at 0 thirst');p().life.thirst=80;pump(.3);assert(!body.classList.contains('thirst-dry'));
 console.log('Needs in the game: one message per need at 25, repeated only after recovery, no running at 10 thirst, edges dim at 0 thirst.');
}finally{g.done?.()}