import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {MAP} from '../dist/map-definition.js';

// Sleeping in the packaged game (0.34): in bed in the studio, the clock jumps to 6 AM of the next day and food and thirst drop a little; in a multiplayer room it does not move.
const g=await bootGame({position:{x:1,z:-6.3}});
try{
 const {GameState,pump,send,ids}=g,p=()=>GameState.progress,pressE=()=>{send('keydown','KeyE');send('keyup','KeyE');pump(.3)};
 GameState.progress={...p(),housing:{...p().housing,rented:true,day:3},routine:{...p().routine,minutes:22*60},life:{...p().life,energy:10,food:90,thirst:90}};pump(.5);
 pressE();pump(1);assert.equal(ids.get('locationName').textContent,'STUDIO 2B','inside the studio');
 const bed=MAP.studio.interior.bed,sleep=()=>{GameState.me.position.x=bed.x;GameState.me.position.z=bed.z;pump(.3);pressE();assert(/Sleep until 6:00 AM/.test(ids.get('dialogText').textContent),'the dialog: '+ids.get('dialogText').textContent);ids.get('jobAction').click();pump(3)};
 sleep();
 assert(p().life.energy>99.9,'rested: '+p().life.energy);assert.equal(p().housing.day,4,'the next day');assert(p().routine.minutes>=360&&p().routine.minutes<366,'6 AM (a moment later), not '+p().routine.minutes);
 assert(p().life.food<90&&p().life.food>80&&p().life.thirst<90&&p().life.thirst>75,`a little hungry and thirsty: ${p().life.food.toFixed(1)} / ${p().life.thirst.toFixed(1)}`);
 assert(/Rested · 6:00 AM · 8 h slept/.test(ids.get('jobToast').textContent),ids.get('jobToast').textContent);
 console.log('Sleep in the game: in bed in the studio the clock jumps to 6 AM of the next day, energy is full, food and thirst drop a little.');
}finally{await g.done()}