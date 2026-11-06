import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {hire} from '../dist/careers.js';

// The Jobs app in the packaged game (0.35 step 2): it is on the phone, says so when you have no job, lets you clock in on site, pays only for time on site,
// clocks you out by itself when you leave the site or the day ends, lists the pay stub, shows the next rank's needs, and quits with a confirmation.
const g=await bootGame({position:{x:0,z:3}});
try{
 const {GameState,pump,ids,created}=g,p=()=>GameState.progress;const find=id=>[...created].reverse().find(e=>e.id===id)||ids.get(id); // the Jobs view is rebuilt on every refresh: the newest element is the one on screen
 const text=e=>[e.textContent||'',...(e.children||[]).map(text)].join(' | ');
 const root=()=>text(ids.get('phoneJobs')),open=()=>{if(ids.get('phoneOverlay').hidden)ids.get('phoneButton').click();ids.get('phoneApp-jobs').click()};
 const tab=name=>find('jobs-tab-'+name).onclick();
 const FOREST={x:100,z:-270},CITY={x:-5,z:15};
 const put=(at,minutes,day)=>{GameState.me.position.x=at.x;GameState.me.position.z=at.z;GameState.progress={...p(),routine:{...p().routine,minutes},housing:{...p().housing,day:day??p().housing.day}}};

 // not hired: the app says where to go, and there is nothing to clock in to
 put(CITY,480);open();
 assert(!ids.get('phoneScreen-jobs').hidden&&ids.get('phoneTitle').textContent==='Jobs','the Jobs app opens');
 assert(/no job yet/.test(root()),'no job: '+root());
 tab('employers');assert(/Ridgeline Timber Co\./.test(root())&&/Walt Hargrove/.test(root())&&/Trainee/.test(root())&&/apply at the office/i.test(root()),'Employers lists the company, its owner and the ranks: '+root());
 ids.get('phoneClose').click();

 // hired (the interview is step 3: here the rules hire you), then clock in on the site
 GameState.progress=hire(p(),'ridgeline').state;put(FOREST,480,3);open();
 assert(/Ridgeline Timber Co\./.test(root())&&/Trainee/.test(root()),'the Shift view lists the job: '+root());
 assert(!find('jobs-clockin-ridgeline').disabled,'clock-in is available at 8 AM');
 put(FOREST,330,3);ids.get('phoneClose').click();open();assert(find('jobs-clockin-ridgeline').disabled&&/6:00 AM/.test(root()),'before 6 AM it is refused, and says why: '+root());
 put(FOREST,480,3);ids.get('phoneClose').click();open();
 find('jobs-clockin-ridgeline').click();
 assert.equal(p().shift.employer,'ridgeline','clocked in');assert(/on shift/.test(root())&&/On site/.test(root())&&/Today's tasks/.test(root()),'the shift view shows the shift: '+root());
 assert(p().shift.tasks.length>=2&&/Fell|Carry/.test(root()),'tasks are listed');

 // two hours on site: paid by the hour (rank 1: $8.00)
 put(FOREST,600,3);pump(1);
 assert(p().shift.paidMinutes>=119&&p().shift.paidMinutes<=122,'two hours on site are paid: '+p().shift.paidMinutes);
 // off site: not paid, and the count runs; back on site resets it
 put(CITY,630,3);pump(1);assert(p().shift&&p().shift.paidMinutes<=122,'off site is not paid');assert(p().shift.offSiteMinutes>=29,'the off-site count runs');
 ids.get('phoneClose').click();open();assert(/Off site/.test(root()),'the view says off site: '+root());
 put(FOREST,640,3);pump(1);assert.equal(p().shift.offSiteMinutes,0,'back on site');
 // clock out with the button: paid in cash, a pay stub, the shift counts
 const cash=p().cash;find('jobs-clockout').click();
 assert.equal(p().shift,null,'clocked out');assert.equal(p().cash,cash+p().payStubs[0].total,'paid in cash');assert(p().payStubs[0].wage>=1500,'the wage is about 2 hours at $8: '+p().payStubs[0].wage);
 assert.equal(p().careers.ridgeline.shifts,1);assert(/Clocked out/.test(ids.get('phoneMessage').textContent));
 tab('pay');assert(/Wage \$/.test(root())&&/Total \$/.test(root()),'the Pay tab lists the stub: '+root());
 tab('shift');assert(find('jobs-clockin-ridgeline').disabled&&/already worked a shift/.test(root()),'one shift a day: '+root());

 // the next day: an hour away from the site clocks you out by itself, with a toast
 put(FOREST,420,4);ids.get('phoneClose').click();open();find('jobs-clockin-ridgeline').click();assert(p().shift);
 ids.get('phoneClose').click();put(CITY,430,4);pump(1);put(CITY,500,4);pump(1);
 assert.equal(p().shift,null,'an hour off site ends the shift');assert.equal(p().payStubs[0].reason,'off-site');assert(/left the site/.test(ids.get('jobToast').textContent),'toast: '+ids.get('jobToast').textContent);
 // and at 6 PM the shift ends by itself
 put(FOREST,900,5);open();find('jobs-clockin-ridgeline').click();ids.get('phoneClose').click();put(FOREST,1085,5);pump(1);
 assert.equal(p().shift,null,'6 PM ends the shift');assert.equal(p().payStubs[0].reason,'end-of-day');assert.equal(p().payStubs[0].to,1080,'paid up to 6 PM only');

 // My job: rank, reputation, what the next rank needs; quitting asks twice and resets the rank
 open();tab('job');assert(/Trainee/.test(root())&&/Reputation/.test(root())&&/Next rank: Feller/.test(root())&&/level 3/.test(root()),'My job shows the rank and the next rank\'s needs: '+root());
 find('jobs-quit-ridgeline').click();assert(p().careers.ridgeline.hired,'the first click only asks');assert(/Really quit/.test(root()));
 find('jobs-quit-ridgeline').click();assert.equal(p().careers.ridgeline.hired,false,'the second click quits');assert.equal(p().careers.ridgeline.rank,0);assert(/no longer|do not work/.test(root())||/not work/.test(root()),'My job: '+root());
 console.log('PASS jobs-game.mjs: the Jobs app on the phone: no job, Employers, clock in (not before 6 AM, once a day), wage only on site, off-site and 6 PM clock-outs with a toast, pay stub, next rank, quit with a confirmation.');
}finally{await g.done()}
