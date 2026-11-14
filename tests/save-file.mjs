import assert from 'node:assert/strict';
import {PROFILE_KEY,CHARACTER_KEY,BACKUPS_KEY,SAVE_FORMAT,SAVE_FORMAT_VERSION,MAX_BACKUPS,MAX_BACKUP_BYTES,MAX_FILE_BYTES,readStoredSave,writeStoredSave,makeSaveFile,saveFileName,readSaveFile,summarize,loadBackups,addBackup,replaceSave} from '../dist/save-file.js';
import {loadProfile} from '../dist/profile.js';
import {loadAppearance} from '../dist/appearance.js';

const memory=(limit=Infinity)=>{const m=new Map();return {m,getItem:k=>m.get(k)??null,setItem:(k,v)=>{const used=[...m].reduce((n,[a,b])=>a===k?n:n+b.length,0);if(used+v.length>limit)throw new Error('QuotaExceededError');m.set(k,v)},removeItem:k=>m.delete(k)}};
const player=(cash,name='Ada')=>({profile:{playerId:'p-1',name,progress:{cash}},character:{name,gender:'female'}});

assert.equal(PROFILE_KEY,'edenridge.profile.v1');assert.equal(CHARACTER_KEY,'edenridge.character.v1');

// Stored save: none, written, read back in the shapes the game reads
{const s=memory();assert.equal(readStoredSave(s),null,'a new player has no save');
 assert(writeStoredSave(s,player(12345)));
 const back=readStoredSave(s);assert.equal(back.profile.progress.cash,12345);assert.equal(back.profile.playerId,'p-1');assert.equal(back.character.name,'Ada');
 assert.equal(JSON.parse(s.m.get(PROFILE_KEY)).version,1);assert.equal(JSON.parse(s.m.get(CHARACTER_KEY)).version,2);
 // the game's own loaders accept what we wrote
 globalThis.localStorage=s;assert.equal(loadProfile().progress.cash,12345);assert.equal(loadAppearance(s).name,'Ada');
 assert(writeStoredSave(s,{profile:{name:'X',progress:{}},character:null}));assert(!s.m.has(CHARACTER_KEY),'no character in the save clears it');
 assert(JSON.parse(s.m.get(PROFILE_KEY)).playerId.length>10,'a missing player id is made up');
 assert.equal(writeStoredSave({setItem(){throw new Error('blocked')}},player(1)),false,'blocked storage reports failure');}

// Save files: round trip, name, refusals
{const file=makeSaveFile(player(500),{version:'0.35.0',now:Date.UTC(2026,10,5,12)});
 assert.equal(file.format,SAVE_FORMAT);assert.equal(file.formatVersion,SAVE_FORMAT_VERSION);assert.equal(file.game,'0.35.0');assert.equal(file.savedAt,'2026-11-05T12:00:00.000Z');
 assert.equal(saveFileName(file),'edenridge-ada-2026-11-05.json');assert.equal(saveFileName({...file,profile:{name:'Ü ../x'}}),'edenridge-x-2026-11-05.json');
 const r=readSaveFile(JSON.stringify(file));assert(r.ok);assert.equal(r.save.profile.progress.cash,500);
 assert.deepEqual(r.summary,{name:'Ada',cash:500,vehicles:0,day:1,clock:'9:00 AM',game:'0.35.0',savedAt:'2026-11-05T12:00:00.000Z'});
 assert(readSaveFile('﻿'+JSON.stringify(file)).ok,'a byte-order mark (Windows editors) is fine');
 for(const [text,re] of [['not json',/not a save file from Eden Ridge/],['{"format":"other"}',/not a save file from Eden Ridge/],[JSON.stringify({...file,formatVersion:SAVE_FORMAT_VERSION+1,game:'9.0.0'}),/newer version of the game \(9\.0\.0\)/],[JSON.stringify({...file,formatVersion:'1'}),/damaged/],[JSON.stringify({...file,profile:null}),/no player/],['x'.repeat(MAX_FILE_BYTES+1),/too big/],[null,/too big/]]){const bad=readSaveFile(text);assert.equal(bad.ok,false);assert.match(bad.error,re)}
 // a hand-edited file cannot inject anything: unknown fields go, bad values are normalised
 const evil=readSaveFile(JSON.stringify({...file,profile:{playerId:7,name:'x'.repeat(99),progress:{cash:'lots',hack:true}},character:'<img>'}));
 assert(evil.ok);assert.equal(evil.save.profile.playerId,null);assert.equal(evil.save.profile.name.length,24);assert.equal(evil.save.profile.progress.hack,undefined);assert(Number.isInteger(evil.save.profile.progress.cash));assert.equal(evil.save.character,null);
 assert.equal(summarize(evil.save).name.length,24);}

// Backups: newest first, duplicates skipped, count and byte limits, a full disk
{const s=memory();assert.deepEqual(addBackup(s,{reason:'play'}),{ok:false,why:'no-save'});
 writeStoredSave(s,player(1));assert.equal(addBackup(s,{reason:'play',version:'0.35.0',now:1}).count,1);
 assert(addBackup(s,{reason:'play',now:2}).skipped,'the same save twice is one backup');
 for(let i=2;i<=8;i++){writeStoredSave(s,player(i));addBackup(s,{reason:'play',now:i})}
 const list=loadBackups(s);assert.equal(list.length,MAX_BACKUPS);assert.deepEqual(list.map(b=>b.save.profile.progress.cash),[8,7,6,5,4],'newest first, oldest dropped');assert.equal(list[0].reason,'play');
 s.m.set(BACKUPS_KEY,'garbage');assert.deepEqual(loadBackups(s),[],'damaged backups read as none');
 s.m.set(BACKUPS_KEY,JSON.stringify([{at:'x'},null,{at:1,save:{profile:{progress:{cash:3}}}}]));assert.equal(loadBackups(s).length,1);
 // byte cap: big saves keep fewer copies
 const big=memory();const name='B';writeStoredSave(big,{profile:{name,progress:{cash:1,homeNotices:['x'.repeat(400)]}},character:null});
 const one=JSON.stringify(readStoredSave(big)).length;assert(one*MAX_BACKUPS<MAX_BACKUP_BYTES,'normal saves always fit '+MAX_BACKUPS+' copies ('+one+' bytes each)');
 // storage full: oldest dropped until it fits, never an exception
 const tight=memory(3000);writeStoredSave(tight,player(1));for(let i=1;i<=5;i++){writeStoredSave(tight,player(i));const r=addBackup(tight,{reason:'play',now:i});assert(r.ok||r.why==='storage-full')}
 assert(loadBackups(tight).length>=1&&loadBackups(tight).length<MAX_BACKUPS,'a full disk keeps fewer backups: '+loadBackups(tight).length);assert.equal(loadBackups(tight)[0].save.profile.progress.cash,5,'and the newest');}

// Replace (import / restore): what was there is backed up first
{const s=memory();writeStoredSave(s,player(100,'Old'));
 assert(replaceSave(s,player(999,'New').valueOf(),{reason:'before import',version:'0.35.0',now:5}));
 assert.equal(readStoredSave(s).profile.progress.cash,999);
 const b=loadBackups(s)[0];assert.equal(b.reason,'before import');assert.equal(b.save.profile.name,'Old');assert.equal(b.save.profile.progress.cash,100);
 assert(replaceSave(s,b.save,{reason:'before restore',now:6}));assert.equal(readStoredSave(s).profile.name,'Old','restoring a backup brings it back');
 assert.equal(loadBackups(s)[0].save.profile.name,'New','and the replaced save is itself backed up');}
console.log('Save files: stored save read/write in the game\'s own shapes, export/import round trip, file name, refusals (not a save, newer format, damaged, too big), hand-edited files normalised, backups (newest first, duplicates skipped, 5 kept, 1 MB cap, full storage), import and restore keep a backup.');
