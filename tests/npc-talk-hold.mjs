// Packaged street-dialogue regression for the NPC hold reported in notes/handoff.md.
import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {talkOpen,talkName} from './support/talk.mjs';

globalThis.location={search:'?debug&webgpu=0',hostname:'localhost',protocol:'http:',host:'localhost:8000',origin:'http://localhost:8000'};
const g=await bootGame();
try{
 const {GameState,pump,ids,send}=g,{pedestrians,place}=window.__city;
 const robert=pedestrians.people.find(person=>person.name==='Robert').group;
 const pos=({x,z})=>({x,z}),dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
 const press=code=>{send('keydown',code);send('keyup',code)};
 for(const minute of [385,410,435,450]){
  const p=GameState.progress;
  GameState.progress={...p,routine:{...p.routine,minutes:minute}};
  pump(.88);
 }
 const walking=pos(robert.position);
 pump(.2);
 assert(robert.visible&&dist(robert.position,walking)>.1,'Robert is walking along his schedule');
 place(robert.position.x+.8,robert.position.z);
 pump(.16);
 assert.equal(ids.get('prompt').querySelector('span').textContent,'Talk to Robert');
 press('KeyE');
 assert(talkOpen(ids)&&talkName(ids)==='Robert','E opens the street conversation in #talk');
 const at=pos(robert.position),player=pos(GameState.me.position),minute=GameState.progress.routine.minutes;
 pump(9);
 assert(talkOpen(ids),'the conversation remains open');
 assert.deepEqual(pos(robert.position),at,'the talking NPC holds position');
 assert.deepEqual(pos(GameState.me.position),player);
 assert(GameState.progress.routine.minutes>minute,'the town clock keeps advancing');
 press('Escape');
 assert(!talkOpen(ids),'Esc ends the conversation');
 pump(.12);
 assert(dist(robert.position,at)<1,'the NPC does not jump ahead when released');
 pump(1);
 assert(dist(robert.position,at)>.3,'the NPC resumes the route');
 console.log('PASS npc-talk-hold: Robert stays in place through street dialogue, town time advances, and he resumes the route without jumping.');
}finally{await g.done()}
