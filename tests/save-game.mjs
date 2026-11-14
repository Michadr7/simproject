// Save export, import and backups in the packaged game: the backup on Play, and the reload after an import must not save the old game over the new one.
import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {makeSaveFile,BACKUPS_KEY,PROFILE_KEY} from '../dist/save-file.js';

const g=await bootGame({play:false});
try{
 const profile=()=>JSON.parse(g.store.get(PROFILE_KEY)),backups=()=>JSON.parse(g.store.get(BACKUPS_KEY)||'[]');
 // Export on the main menu: a file with this player's game
 let exported=null;globalThis.__download=(name,text)=>{exported={name,text}};
 g.ids.get('menuExport').click();
 assert.match(exported.name,/^edenridge-tester-\d{4}-\d\d-\d\d\.json$/);const file=JSON.parse(exported.text);
 assert.equal(file.profile.progress.cash,1000);assert.equal(file.character.name,'Tester');assert.match(g.ids.get('menuSaveStatus').textContent,/Saved as/);
 // Play makes one backup: the save as it was loaded
 assert.equal(backups().length,0);g.ids.get('start').click();
 assert.equal(backups().length,1);assert.equal(backups()[0].reason,'play');assert.equal(backups()[0].save.profile.progress.cash,1000);
 // Playing changes the game; leaving the page saves it as usual
 g.GameState.progress.cash=77700;g.win.dispatchEvent(new Event('pagehide'));assert.equal(profile().progress.cash,77700,'pagehide still saves normally');
 // Import a save: asks, backs up the current game, writes, reloads
 const incoming=makeSaveFile({profile:{playerId:'other',name:'Imported',progress:{cash:500}},character:{name:'Imported'}},{version:'0.34.3'});
 g.ids.get('menuImportFile').files=[{text:async()=>JSON.stringify(incoming)}];await g.ids.get('menuImportFile').onchange();
 assert(!g.ids.get('menuSaveConfirm').hidden);assert.match(g.ids.get('menuSaveConfirmText').textContent,/Imported \(\$5\.00/);
 globalThis.__reloaded=false;g.ids.get('menuSaveConfirmYes').click();
 assert.equal(globalThis.__reloaded,true,'the page reloads');assert.equal(profile().progress.cash,500);assert.equal(profile().name,'Imported');
 assert.equal(backups()[0].reason,'before import');assert.equal(backups()[0].save.profile.progress.cash,77700,'the game that was replaced is backed up');
 // The old game is still in memory: neither pagehide nor hiding the tab may write it back during the reload
 g.win.dispatchEvent(new Event('pagehide'));globalThis.document.hidden=true;globalThis.document.dispatchEvent(new Event('visibilitychange'));globalThis.document.hidden=false;
 assert.equal(profile().progress.cash,500,'the imported save survives the reload');assert.equal(profile().name,'Imported');
 console.log('Save in the game: export from the menu, one backup on Play, pagehide saves normally, an import backs up and replaces the save, and the reload cannot write the old game over it.');
}finally{delete globalThis.__download;await g.done()}
