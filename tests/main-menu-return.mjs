// Back to the main menu from inside the game: it saves, disconnects and reloads the page.
import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
let reloads=0;globalThis.location={reload(){reloads++}};
const g=await bootGame({position:{x:1,z:-6.3}}),me=g.GameState.me.position;
assert(g.ids.get('mainMenu'),'the Controls screen has a main menu button');
g.ids.get('help').click();assert(!g.ids.get('controls').hidden,'Esc / Controls opens the screen it is on');
Object.assign(me,{x:14,z:-6.1});g.pump(.1); // paused: the position does not move on its own
g.ids.get('mainMenu').click();
assert.equal(reloads,1,'the page reloads');
const saved=JSON.parse(g.store.get('citylife.profile.v1')).progress;assert.equal(saved.position.x,14,'and the game was saved first, where you were standing');
// with no multiplayer connection it still works
g.ids.get('mainMenu').click();assert.equal(reloads,2);
await g.done();
console.log('Back to the main menu: the button is on the Controls screen, saves where you stand, disconnects and reloads the page.');
process.exit(0);
