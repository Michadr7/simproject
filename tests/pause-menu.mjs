// The pause menu: a short first screen (Resume, Settings, Edit character, Save and exit to menu) and a Settings panel with Controls, Graphics, mouse capture and Credits.
// It boots the game with the CURRENT dist sources copied over the scratch copy of the release (editRelease), so it checks the new menu before the next release is packaged. The released folder is never touched.
import assert from 'node:assert/strict';
import {readFile,readdir,copyFile} from 'node:fs/promises';import {join} from 'node:path';
import {bootGame,El} from './support/boot-game.mjs';
El.prototype.appendChild??=function(c){this.children.push(c);return c}; // the credits list is built with appendChild
let reloads=0;globalThis.location={reload(){reloads++}};
const html=await readFile('dist/index.html','utf8'),src=await readFile('dist/game.js','utf8');
// ── the markup: exactly four buttons on the first screen, in this order
const first=html.match(/<section id="controls"[\s\S]*?<\/section>/)[0];
const buttons=[...first.matchAll(/<button id="([^"]+)"[^>]*>([^<]*)<\/button>/g)].map(m=>[m[1],m[2]]);
assert.deepEqual(buttons,[['resume','Resume'],['showSettings','Settings'],['editCharacter','Edit character'],['mainMenu','Save and exit to menu']],'the first screen has exactly these four buttons');
assert.ok(first.includes('id="lobbyInfo"'),'the lobby line stays under Save and exit');
assert.ok(!first.includes('control-groups')&&!first.includes('id="quality"')&&!first.includes('id="showCredits"'),'nothing else is on the first screen');
const set=html.match(/<section id="settings"[\s\S]*?<section id="credits"/)[0];
for(const id of ['quality','mouseMode','retryCapture','showCredits','settingsBack'])assert.ok(set.includes(`id="${id}"`),`${id} is in Settings`);
assert.ok(set.includes('control-groups')&&set.includes('Pause menu / back'),'the controls lists are in Settings, with the new Esc line');
assert.ok(set.lastIndexOf('id="showCredits"')<set.lastIndexOf('id="settingsBack"')&&set.indexOf('id="quality"')<set.indexOf('id="showCredits"'),'Credits is the last row, Back below it');
assert.ok(/<button id="help">Menu /.test(html),'the HUD button is called Menu');
assert.ok(!/lookLeft|lookRight|Turn left|Turn right/.test(html+src),'Turn left / Turn right are gone from the page and the game');
assert.ok(/id="credits"/.test(html));

const g=await bootGame({position:{x:1,z:-6.3},editRelease:async dir=>{for(const f of await readdir('dist'))if(f.endsWith('.js')||f==='style.css')await copyFile(join('dist',f),join(dir,f))}});
const id=n=>g.ids.get(n),shown=n=>!id(n).hidden,esc=()=>g.send('keydown','Escape');
for(const n of ['controls','settings','credits','dialog'])id(n).hidden=true; // the synthetic page does not apply the hidden attribute from the markup
const me=g.GameState.me.position;
const only=(...open)=>{for(const n of ['controls','settings','credits'])assert.equal(shown(n),open.includes(n),`${n} is ${open.includes(n)?'open':'closed'}`)};

// ── Esc order: game -> pause -> Settings -> pause -> game
g.pump(.2);esc();only('controls');
esc();only();
esc();only('controls');
id('showSettings').click();only('settings');
esc();only('controls');
esc();only();
// the Menu button opens the pause menu; Settings and Back swap the two panels
id('help').click();only('controls');
id('showSettings').click();only('settings');
id('settingsBack').click();only('controls');
// while either panel is open the world stands still: moving between them did not resume the game
Object.assign(me,{x:5,z:-6});id('showSettings').click();g.pump(.5);assert.equal(me.x,5,'paused in Settings: the position does not move');id('settingsBack').click();

// ── Credits from Settings returns to Settings, by the button and by Esc
id('showSettings').click();id('showCredits').click();only('credits');
id('closeCredits').click();only('settings');
id('showCredits').click();only('credits');
esc();only('settings');
esc();only('controls');
esc();only();
esc();only('controls');

// ── Graphics still changes and saves
id('showSettings').click();id('quality').value='low';id('quality').onchange();
assert.equal(id('menuQuality').value,'low','the in-game select drives the main-menu setting');
assert.ok([...g.store.values()].some(v=>/"quality":"low"/.test(v)),'and it is saved');
id('quality').value='high';id('quality').onchange();
esc();esc();only();

// ── Resume closes everything
esc();id('showSettings').click();id('settingsBack').click();id('resume').click();only();

// ── Save and exit still goes to the main menu, from the first screen
id('help').click();Object.assign(me,{x:14,z:-6.1});id('mainMenu').click();
assert.equal(reloads,1,'the page reloads');
assert.equal(JSON.parse(g.store.get('citylife.profile.v1')).progress.position.x,14,'and the game was saved where you stood');
await g.done();
console.log('Pause menu: four buttons on the first screen, Settings and Back, Esc goes back one level, Credits returns to Settings, Graphics saves, Save and exit works.');
process.exit(0);
