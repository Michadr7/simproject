// Save files and local backups. A player's game is two storage keys: the profile (id, name, all progress; profile.js) and the character (appearance.js).
// A save file is one JSON envelope around both, so it can be downloaded, imported on another browser or address, and later sent to cloud saves.
// Everything read back goes through the game's own normalisers, so an old, hand-edited or damaged file can never put bad data into the game.
// Backups are whole copies kept in this browser (newest first), taken when Play starts and before an import or restore replaces the save.
import {normalizeProgress} from './jobs.js';
import {normalizeAppearance,SAVE_KEY as CHARACTER_KEY} from './appearance.js';
import {PROFILE_KEY} from './profile.js';
import {formatClock} from './routine.js';

export {PROFILE_KEY,CHARACTER_KEY};
import {SAVE_FORMAT,SAVE_FORMAT_VERSION} from './save-file-format.js';
export {SAVE_FORMAT,SAVE_FORMAT_VERSION};
export const BACKUPS_KEY='citylife.backups.v1';
export const MAX_BACKUPS=5,MAX_BACKUP_BYTES=1_000_000,MAX_FILE_BYTES=2_000_000;

const parse=text=>{try{return JSON.parse(text)}catch{return undefined}};
const cleanProfile=p=>({playerId:typeof p?.playerId==='string'&&p.playerId?p.playerId.slice(0,64):null,name:typeof p?.name==='string'?p.name.slice(0,24):'',progress:normalizeProgress(p?.progress)});
const cleanCharacter=c=>c&&typeof c==='object'?normalizeAppearance(c):null;

// The current save as stored, or null when there is none (a new player).
export function readStoredSave(storage){
 let raw;try{raw=parse(storage.getItem(PROFILE_KEY))}catch{return null}
 if(raw?.version!==1)return null;
 let ch=null;try{const c=parse(storage.getItem(CHARACTER_KEY));if(c?.version===1||c?.version===2)ch=c.appearance}catch{}
 return {profile:cleanProfile(raw),character:cleanCharacter(ch)};
}
// Writes a save in exactly the shapes profile.js and appearance.js read. A save without a character clears it (the game then opens the creator).
// Both keys or neither: if the second write fails, the first is put back.
export function writeStoredSave(storage,save){
 let before;try{before=[storage.getItem(PROFILE_KEY),storage.getItem(CHARACTER_KEY)]}catch{return false}
 const undo=()=>{try{for(const [k,v] of [[PROFILE_KEY,before[0]],[CHARACTER_KEY,before[1]]])v===null?storage.removeItem?.(k):storage.setItem(k,v)}catch{}};
 try{
  const profile=cleanProfile(save.profile);profile.playerId||=crypto.randomUUID();
  storage.setItem(PROFILE_KEY,JSON.stringify({version:1,...profile}));
  if(save.character)storage.setItem(CHARACTER_KEY,JSON.stringify({version:2,appearance:cleanCharacter(save.character)}));
  else storage.removeItem?.(CHARACTER_KEY);
  return true;
 }catch{undo();return false}
}

export function makeSaveFile(save,{version,now=Date.now()}){
 return {format:SAVE_FORMAT,formatVersion:SAVE_FORMAT_VERSION,game:version,savedAt:new Date(now).toISOString(),profile:cleanProfile(save.profile),character:cleanCharacter(save.character)};
}
export function saveFileName(file){
 const who=(file.profile?.name||file.character?.name||'player').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'player';
 return `citylife-${who}-${String(file.savedAt||'').slice(0,10)||'save'}.json`;
}
// What the player is told about a save before it replaces theirs.
export function summarize(save,meta={}){
 const p=save.profile.progress;
 return {name:save.profile.name||save.character?.name||'Unnamed',cash:p.cash,vehicles:p.vehicles?.length||0,day:p.housing?.day??1,clock:formatClock(p.routine?.minutes??0),game:meta.game??null,savedAt:meta.savedAt??null};
}
export function readSaveFile(text){
 if(typeof text!=='string'||text.length>MAX_FILE_BYTES)return {ok:false,error:'That file is too big to be a City Life save.'};
 const f=parse(text.replace(/^﻿/,''));
 if(!f||typeof f!=='object'||f.format!==SAVE_FORMAT)return {ok:false,error:'That is not a City Life save file.'};
 if(!Number.isInteger(f.formatVersion)||f.formatVersion<1)return {ok:false,error:'That save file is damaged.'};
 if(f.formatVersion>SAVE_FORMAT_VERSION)return {ok:false,error:`That save was made by a newer version of the game (${typeof f.game==='string'?f.game.slice(0,12):'?'}). Update the game, then import it.`};
 if(!f.profile||typeof f.profile!=='object')return {ok:false,error:'That save file has no player in it.'};
 const save={profile:cleanProfile(f.profile),character:cleanCharacter(f.character)};
 const meta={game:typeof f.game==='string'?f.game.slice(0,12):null,savedAt:typeof f.savedAt==='string'&&!isNaN(Date.parse(f.savedAt))?f.savedAt:null};
 return {ok:true,save,summary:summarize(save,meta)};
}

// Backups: [{at, game, reason, save}], newest first.
export function loadBackups(storage){
 let list;try{list=parse(storage.getItem(BACKUPS_KEY))}catch{return []}
 if(!Array.isArray(list))return [];
 return list.filter(b=>b&&Number.isFinite(b.at)&&b.save?.profile).slice(0,MAX_BACKUPS).map(b=>({at:b.at,game:typeof b.game==='string'?b.game.slice(0,12):null,reason:typeof b.reason==='string'?b.reason.slice(0,40):'',save:{profile:cleanProfile(b.save.profile),character:cleanCharacter(b.save.character)}}));
}
// Adds the current save as the newest backup. Skips a copy identical to the newest; trims to the count and byte limits; if storage is full it drops the oldest and tries again.
export function addBackup(storage,{reason,version,now=Date.now()}){
 const save=readStoredSave(storage);if(!save)return {ok:false,why:'no-save'};
 const list=loadBackups(storage);
 if(list[0]&&JSON.stringify(list[0].save)===JSON.stringify(save))return {ok:true,skipped:true};
 let next=[{at:now,game:version??null,reason,save},...list].slice(0,MAX_BACKUPS);
 while(next.length>1&&JSON.stringify(next).length>MAX_BACKUP_BYTES)next=next.slice(0,-1);
 for(;next.length;next=next.slice(0,-1)){try{storage.setItem(BACKUPS_KEY,JSON.stringify(next));return {ok:true,count:next.length}}catch{}}
 return {ok:false,why:'storage-full'};
}
// Replaces the save with a backup or an imported file, keeping a backup of what was there first.
export function replaceSave(storage,save,{reason,version,now=Date.now()}){
 addBackup(storage,{reason,version,now});
 return writeStoredSave(storage,save);
}
