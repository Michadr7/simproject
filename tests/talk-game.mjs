import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {fresh,PLACES} from '../dist/starter.js';
import {talkOpen,talkName,talkLines,talkText,talkReplies,reply,closeTalk} from './support/talk.mjs';

// C6 wiring in the packaged game (notes/conversation-design.md 4): Noah, Elena and Hal talk through the engine in the docked #talk panel. The clock keeps running while you talk
// (only walking is locked), Esc says "See you" instead of pausing, an act runs before its line and a failed act keeps the old replies, the talk memory is saved without the
// derived beats, Noah's first talk marks his phone message read, the recent-events ring feeds Elena's next greeting, and Hal hands over his truck at story step 3.
const g=await bootGame({position:{x:19,z:-6.3},progress:{starter:fresh()}});
try{
 const {GameState,pump,send,ids}=g,p=()=>GameState.progress,me=()=>GameState.me.position;
 const key=c=>send('keydown',c),press=(c='KeyE')=>{send('keydown',c);send('keyup',c);pump(.3)},go=(x,z)=>Object.assign(me(),{x,y:.02,z});
 const at=minutes=>{GameState.progress={...p(),routine:{...p().routine,minutes}}};
 const enter=x=>{go(x,-7.5);pump(1);go(x,-8.9);pump(2.5)},leave=()=>{go(0,3.9);pump(.4);press();pump(1);go(0,4.4);pump(2.5)};
 const noIsBeats=who=>!(p().npcs[who].mem?.beats||[]).some(b=>b.startsWith('is.'));
 // ---- Noah at the counter, story step 0
 at(540);enter(19);assert.equal(ids.get('locationName').textContent,'CORNER MARKET');
 go(0,-2);pump(.3);press();
 assert(talkOpen(ids)&&ids.get('dialog').hidden,'the counter opens the docked panel, not #dialog');assert.equal(talkName(ids),'Noah');
 assert.equal(p().starter.step,1,'opening a talk with Noah at step 0 marks his phone message read (H7)');assert(/I am Noah/.test(talkText(ids)),'the first meeting: '+talkText(ids));
 {const m0=p().routine.minutes,x0=me().x,z0=me().z;send('keydown','KeyW');pump(3);send('keyup','KeyW');
  assert(p().routine.minutes>m0,'game time keeps running during a talk: '+m0+' -> '+p().routine.minutes);assert(me().x===x0&&me().z===z0,'walking is locked while the panel is open');assert(talkOpen(ids))}
 reply(ids,/^Any work going/);assert(/Sophie in Flat two/.test(talkText(ids)),talkText(ids));
 reply(ids,/Take Sophie/);assert.equal(p().phase,'carrying','the pickup act ran');assert(/Order collected/.test(talkText(ids))&&/Take the bag straight to the awning/.test(talkText(ids)),talkText(ids));
 assert.deepEqual(talkReplies(ids),['Continue'],'an ended talk offers Continue');
 key('Escape');assert(!talkOpen(ids),'Esc closes an ended talk');{const m=p().routine.minutes;pump(2);assert(p().routine.minutes>m,'and does not pause the game')}
 {const n=p().npcs.noah;assert(n.metDay>=0&&n.mem?.seen?.['noah.counter']>=1&&n.mem.seen['noah.first']>=1,'Noah remembers the talk: '+JSON.stringify(n.mem));assert(noIsBeats('noah'))}
 // B1: a failed act (a second pickup while carrying) shows the error and keeps the old replies; its line is never said
 press();reply(ids,/^Any work going/);const before=talkLines(ids).length;reply(ids,/Take Sophie/);
 assert.equal(talkLines(ids).length,Math.min(6,before+2),'the echo and the error only');assert(/Speak to the market clerk|marked delivery point/.test(talkLines(ids).at(-1)),'the error: '+talkLines(ids).at(-1));
 assert(!/Take the bag straight to the awning/.test(talkText(ids)),'the success line is not said');assert(talkReplies(ids).some(l=>/Take Sophie/.test(l)),'the old replies stay: '+talkReplies(ids).join(' | '));
 key('Escape');assert(talkOpen(ids)&&/See you/.test(talkText(ids)),'Esc says see you');{const m=p().routine.minutes;pump(1);assert(p().routine.minutes>m,'not the pause menu: time runs')}assert(closeTalk(ids,key));
 leave();assert.equal(ids.get('locationName').textContent,'WESTSIDE');
 // ---- Elena: clock out through the talk, then the recent-events ring changes her greeting
 at(14*60+10);enter(36);assert.equal(ids.get('locationName').textContent,'ALDER COFFEE & DINER'); // diner D-A2: the shop is renamed and the cafe shift is the diner career (a shift of two hours on site, paid by the hour)
 GameState.progress={...p(),careers:{...p().careers,diner:{hired:true,rank:1,rep:10,shifts:0,lastShiftDay:0,granted:[],owed:[]}}};
 go(0,-2);pump(.3);press();assert.equal(talkName(ids),'Elena');
 assert(!talkReplies(ids).some(l=>/produce delivery/.test(l)),'no undeliverable produce reply (B2): '+talkReplies(ids).join(' | '));
 reply(ids,/cafe work/);reply(ids,/Clock me in/);assert.equal(p().shift?.employer,'diner','clocked in through the talk');assert(closeTalk(ids,key));
 GameState.progress={...p(),shift:{...p().shift,paidMinutes:120}};const cash0=p().cash;
 press();reply(ids,/cafe work/);reply(ids,/Clock me out/);{const stub=p().payStubs[0];assert(stub.wage>=1600&&stub.total>=1600,'clocked out and paid by the hour: '+JSON.stringify(stub));assert.equal(p().cash,cash0+stub.total,'clocked out and paid');assert(/Paid \$/.test(talkText(ids)),talkText(ids))}assert(closeTalk(ids,key));
 press();assert(/Sharp shift earlier/.test(talkText(ids)),'recent cafe-shift: '+talkText(ids));assert(closeTalk(ids,key));assert(noIsBeats('elena'));
 leave();
 // ---- Hal at story step 3: the groceries hand over his truck; is.loaded is derived each turn and never saved
 GameState.progress={...p(),starter:{...fresh(),step:3}};at(600);go(PLACES.hal.x+1.2,PLACES.hal.z);pump(2);
 assert(/Talk to Hal/.test(ids.get('prompt').querySelector('span').textContent),'Hal is here: '+ids.get('prompt').querySelector('span').textContent);
 press();assert.equal(talkName(ids),'Hal Brennan');assert(/Noah's helper/.test(talkText(ids)),talkText(ids));
 reply(ids,/Hand over the groceries/);assert.equal(p().starter.step,4,'the loan started');assert(p().starter.loanUid,'the loan truck');assert(/Keys are in her/.test(talkText(ids)),talkText(ids));assert(closeTalk(ids,key));
 assert(p().npcs.hal.mem.beats.includes('hal.met')&&noIsBeats('hal'),'Hal keeps hal.met: '+JSON.stringify(p().npcs.hal.mem.beats));
 GameState.progress={...p(),starter:{...p().starter,loaded:true}};press();assert(/The crates are on/.test(talkText(ids)),'is.loaded comes from the save: '+talkText(ids));assert(closeTalk(ids,key));assert(noIsBeats('hal'),'and is never stored');
 console.log('PASS talk-game.mjs: Noah, Elena and Hal talk in the docked panel; time runs and walking is locked while talking; Esc says see you without pausing; acts run first and a failed act keeps the old replies; memory saved without derived beats; H7 read-message; recent cafe-shift; Hal hands over the truck at step 3.');
}finally{await g.done()}
