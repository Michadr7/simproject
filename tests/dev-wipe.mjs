// PB1: Dev Mode 'Wipe player (fresh save)': two clicks (the first only arms it, closing the panel disarms it), then ONLY the player keys go (both prefixes), persist is locked and the page reloads; settings, audio, server, sky tuning, the dev unlock and backups stay. Plus the pure wipePlayerKeys.
import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {wipePlayerKeys} from '../dist/profile.js';
const g=await bootGame({play:false});
try{
 const st=g.store;for(const k of ['edenridge.profile.v1','citylife.profile.v1','citylife.character.v1'])st.set(k,'{}');for(const k of ['edenridge.settings.v1','edenridge.audio.v1','edenridge.server.v1','edenridge.dev.sky.v1','edenridge.backups.v1'])st.set(k,'keep');
 for(let i=0;i<4;i++)g.send('keydown','KeyD');g.find('menuDev').click();
 const w=g.find('devWipePlayer');assert(w&&w.textContent==='Wipe player (fresh save)','the button is in the panel');globalThis.__reloaded=false;
 w.click();assert.equal(globalThis.__reloaded,false,'the first click only arms it');assert.match(w.textContent,/Really wipe/);assert.equal(st.has('edenridge.progress.v1'),true,'nothing deleted yet');
 g.find('devClose').click();assert.equal(w.textContent,'Wipe player (fresh save)','closing the panel disarms it');g.send('keydown','F2');w.click();assert.equal(globalThis.__reloaded,false,'armed again, not wiped');
 w.click();assert.equal(globalThis.__reloaded,true,'the second click reloads the page');
 for(const k of ['edenridge.profile.v1','edenridge.progress.v1','edenridge.character.v1','citylife.profile.v1','citylife.character.v1'])assert.equal(st.has(k),false,k+' is gone');
 for(const k of ['edenridge.settings.v1','edenridge.audio.v1','edenridge.server.v1','edenridge.dev.sky.v1','edenridge.backups.v1'])assert.equal(st.get(k),'keep',k+' stays');assert.equal(st.get('edenridge.devUnlocked'),'1','the dev unlock stays');
 g.win.dispatchEvent(new Event('pagehide'));assert.equal(st.has('edenridge.profile.v1'),false,'pagehide does not write the old game back');
 const m=new Map([['edenridge.profile.v1','a'],['citylife.progress.v1','b'],['edenridge.settings.v1','c']]),removed=wipePlayerKeys({getItem:k=>m.get(k)??null,removeItem:k=>m.delete(k)});
 assert.deepEqual(removed.sort(),['citylife.progress.v1','edenridge.profile.v1']);assert.deepEqual([...m.keys()],['edenridge.settings.v1']);assert.deepEqual(wipePlayerKeys(null),[],'no storage: nothing');
 console.log('PASS dev-wipe.mjs: Wipe player needs two clicks, removes only the player keys (both prefixes), locks persist and reloads; settings, audio, server, sky tuning, dev unlock and backups stay.');
}finally{await g.done()}