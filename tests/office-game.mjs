import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {MAP} from '../dist/map-definition.js';
import {addItem,countItem} from '../dist/inventory.js';
import {xpForNext} from '../dist/skills.js';

// The Ridgeline office in the packaged game (0.35 step 3): the door outside (open 6 AM to 6 PM), the room, Walt's interview that hires you (an axe, the old logs bought back),
// the time clock and the closed forest and sawmill until you are on shift.
const g=await bootGame({position:{x:82.5,z:58.3}});
try{
 const {GameState,pump,send,ids,scene}=g,p=()=>GameState.progress,me=()=>GameState.me.position;
 const office=()=>scene().getObjectByName('office-interior'),prompt=()=>ids.get('prompt').querySelector('span').textContent,dialog=()=>ids.get('dialogText').textContent;
 const press=(code='KeyE',seconds=1.5)=>{send('keydown',code);send('keyup',code);pump(seconds)};
 const at=minutes=>{GameState.progress={...p(),routine:{...p().routine,minutes}}};
 const O=MAP.offices[0],xpFor=level=>{let xp=0;for(let l=1;l<level;l++)xp+=xpForNext(l);return xp};
 assert.equal(office().visible,false,'the room is not drawn while you are outside');
 // before 6 AM the door is shut
 at(330);pump(.5);assert(/closed/i.test(prompt()),'closed at 5:30 AM: '+prompt());press();assert.equal(office().visible,false,'a closed door stays shut');assert.equal(g.find?.('x')??null,null);
 // open: walk up, E, through the fade
 at(540);me().x=O.door.x+.8;me().z=O.door.z;pump(.6);assert(/Enter · Ridgeline Timber Co\./.test(prompt()),'the door offers to go in: '+prompt());
 press('KeyE',2.5);assert.equal(office().visible,true,'inside: the room is drawn');assert(Math.abs(me().x)<2&&me().z>2,'standing just inside the door: '+me().x+','+me().z);
 assert(/RIDGELINE TIMBER/i.test(ids.get('locationName').textContent)||/Ridgeline Timber Office/i.test(ids.get('locationName').textContent),'the HUD names the office: '+ids.get('locationName').textContent);
 // Walt: the interview. First some old logs in the bag, to be bought back once.
 GameState.progress=addItem(addItem(p(),'wood-log').state,'wood-log').state;
 me().x=0;me().z=-1.1;pump(.6);assert(/Talk to Walt Hargrove/.test(prompt()),'Walt is at the counter: '+prompt());
 press();assert(!ids.get('dialog').hidden,'the talk opens');assert(/Can I help you/.test(dialog()),dialog());
 ids.get('jobAction').onclick();assert(/bottom|axe/i.test(dialog()),'the offer: '+dialog());
 ids.get('jobAction').onclick(); // I'll take it
 assert.equal(p().careers.ridgeline.hired,true,'hired');assert.equal(p().careers.ridgeline.rank,1);assert.equal(countItem(p(),'axe'),1,'the axe is handed over');assert.equal(countItem(p(),'wood-log'),0,'the old logs were bought back');assert.equal(p().cash,1000+200,'$2.00 for two logs');
 assert(/crew/.test(dialog())&&/axe/.test(dialog())&&/logs/.test(dialog()),'Walt says what he gave you: '+dialog());
 ids.get('closeDialog').onclick();
 // the time clock: clock in with E
 me().x=5;me().z=-.6;pump(.6);assert(/Time clock · clock in/.test(prompt()),'the time clock: '+prompt());press();assert.equal(p().shift?.employer,'ridgeline','clocked in at the wall');
 pump(.6);assert(/Time clock · clock out/.test(prompt()),'and now offers to clock out: '+prompt());
 // inside the office counts as on site
 pump(1);assert.equal(p().shift.offSiteMinutes,0,'the office is on site');
 // a promotion Walt can explain, and one he gives
 me().x=0;me().z=-1.1;pump(.6);press();ids.get('jobAction').onclick?.();
 {const text=dialog();assert(/Not yet/.test(text)&&/level 3/.test(text),'not yet a Feller: '+text)}
 ids.get('closeDialog').onclick();
 GameState.progress={...p(),skills:{lumberjack:{xp:xpFor(3)}},careers:{ridgeline:{...p().careers.ridgeline,shifts:3,rep:30}}};
 press();assert(/Good to see you/.test(dialog()),dialog());ids.get('jobAction').onclick();assert(/Feller/.test(dialog())&&/earned it/.test(dialog()),'promoted: '+dialog());assert.equal(p().careers.ridgeline.rank,2);ids.get('closeDialog').onclick();
 // the company store: only a Foreman at level 15 can buy a chainsaw
 me().x=4.2;me().z=-2.3;pump(.6);assert(/Company store/.test(prompt()),'the shelf: '+prompt());
 press();assert(/Chainsaw \$600\.00/.test(dialog())&&/Logging Chainsaw \$1500\.00/.test(dialog()),'the shelf lists both saws: '+dialog());assert(/Foreman/.test(dialog()),'and who they are sold to: '+dialog());ids.get('jobAction').onclick();assert.equal(p().inventory.slots.some(s=>s.id==='chainsaw'),false,'a Feller cannot buy it: '+ids.get('jobToast').textContent);assert(/Foreman|staff|sold to/i.test(ids.get('jobToast').textContent),ids.get('jobToast').textContent);ids.get('closeDialog').onclick();
 GameState.progress={...p(),cash:200000,skills:{lumberjack:{xp:xpFor(15)}},careers:{ridgeline:{...p().careers.ridgeline,rank:6}}};press();ids.get('jobAction').onclick();
 assert.equal(p().inventory.slots.some(s=>s.id==='chainsaw'),true,'a level 15 Foreman buys the Chainsaw');assert.equal(p().cash,200000-60000,'for $600.00');ids.get('closeDialog')?.onclick?.();
 // leave by the front door
 me().x=0;me().z=3.9;pump(.4);assert(/Open the doors/.test(ids.get('prompt').querySelector('span').textContent),'a shut double door offers to open: '+ids.get('prompt').querySelector('span').textContent);press('KeyE',1);me().x=0;me().z=4.5;pump(3);assert.equal(office().visible,false,'outside again: the room is hidden');assert(me().x>O.door.out.x-1&&Math.abs(me().z-O.door.out.z)<1.5,'standing at the door: '+me().x+','+me().z);
 // sign: a renamed company shows its new name (the board redraws from the save)
 GameState.progress={...p(),companies:{ridgeline:{name:'Pine & Sons'}}};pump(1);me().x=O.door.x+.8;me().z=O.door.z;pump(.6);assert(/Enter · Pine & Sons/.test(prompt()),'the new name: '+prompt());
 // after 6 PM it is closed again
 at(1090);pump(.6);assert(/closed/i.test(prompt()),'closed at 6:10 PM: '+prompt());
 console.log('PASS office-game.mjs: the Ridgeline office door (closed outside 6 AM to 6 PM), the room, Walt\'s interview (axe, old logs bought back), the time clock, the office as an on-site place, promotion talk and promotion, leaving, and a renamed company on the door prompt.');
}finally{await g.done()}
