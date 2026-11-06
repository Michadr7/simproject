import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {hire} from '../dist/careers.js';

// The tracker in the packaged game (0.35): on a Ridgeline shift every task is listed under the card with a distance; Y (or a tick) focuses one, which takes over the card;
// finishing the focused task moves on; the focus is saved.
const g=await bootGame({position:{x:0,z:3}});
try{
 const {GameState,pump,ids,send}=g,p=()=>GameState.progress;
 const card=()=>({eyebrow:ids.get('objective').querySelector('.eyebrow').textContent,h2:ids.get('objective').querySelector('h2').textContent}),rows=()=>ids.get('trackerList').children.filter(c=>/tracker-row/.test(c.className)),groups=()=>ids.get('trackerList').children.filter(c=>c.className==='tracker-group').map(c=>c.textContent);
 pump(.6);assert(ids.get('trackerList').hidden,'no tasks: the list is hidden and the card is the story objective');
 const story=card().h2;
 const task=(kind,piece,target,done)=>({kind,piece,target,done});
 GameState.progress={...hire({...p(),routine:{...p().routine,minutes:720}},'ridgeline').state,shift:{employer:'ridgeline',day:p().housing.day,startedAt:720,last:(p().housing.day-1)*1440+720,paidMinutes:0,offSiteMinutes:0,pieces:{},tasks:[task('fell','trees',6,0),task('landing','logs',8,0),task('load','shipped',20,0)]}};
 pump(.6);
 assert(!ids.get('trackerList').hidden&&rows().length===4,'the story objective and three tasks are listed: '+rows().length);assert.deepEqual(groups(),['Jobs · Ridgeline Timber Co.','Getting started'].sort((a,b)=>['Jobs','Getting'].findIndex(x=>a.startsWith(x))-['Jobs','Getting'].findIndex(x=>b.startsWith(x))),'sections: jobs, then getting started: '+groups());assert.equal(card().h2,story,'the card is still the story objective until you focus one');
 assert(rows().every(r=>/\d+ m|^$/.test(r.children[2].textContent)),'each row has a distance');assert(rows().some(r=>r.children[1].textContent==='Fell 6 marked pines'));assert(rows().find(r=>r.children[1].textContent===story).className.includes('focus'),'the story row has the dot until you pick another');
 // Y focuses the first task: it takes over the card, the story moves into the list
 send('keydown','KeyY');send('keyup','KeyY');pump(.6);
 assert.equal(p().focus,'task:fell','the focus is saved');assert(/^FOCUS/.test(card().eyebrow)&&card().h2==='Fell 6 marked pines',JSON.stringify(card()));assert(/ m · /.test(ids.get('distance').textContent),'with a distance and a place: '+ids.get('distance').textContent);
 assert.equal(rows().length,4,'every row stays in the list');assert(rows().find(r=>r.children[1].textContent==='Fell 6 marked pines').className.includes('focus')&&rows().find(r=>r.children[0].textContent==='◉'),'the dot moves to the focused row');
 // a tick focuses that row; the story's tick gives the focus back
 rows().find(r=>r.children[1].textContent.startsWith('Load a customer')).onclick();pump(.6);assert.equal(p().focus,'task:load');assert.equal(card().h2,"Load a customer's truck with 20 planks");
 rows().find(r=>r.children[1].textContent===story).onclick();pump(.6);assert.equal(p().focus,null);assert.equal(card().h2,story,'ticking the story objective brings it back');
 // finishing the focused task moves the focus on
 send('keydown','KeyY');send('keyup','KeyY');pump(.6);assert.equal(p().focus,'task:fell');
 GameState.progress={...p(),shift:{...p().shift,tasks:p().shift.tasks.map(t=>t.kind==='fell'?{...t,done:6}:t)}};pump(.6);
 assert.equal(p().focus,'task:landing','the finished task hands the focus to the next open one');
 // clocking out clears it
 GameState.progress={...p(),shift:null};pump(.6);assert.equal(p().focus,null);assert(ids.get('trackerList').hidden,'no shift, no list');
 console.log('Tracker in the game: tasks listed with distances, Y and ticks switch the focus, the focused task takes over the card, a finished one moves on, clocking out clears it, and the focus is saved.');
}finally{g.close?.()}
