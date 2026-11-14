import assert from 'node:assert/strict';
import {migrateKeys,KEY_NAMES} from '../dist/legacy-keys.js';
import {SAVE_FORMAT,isSaveFormat} from '../dist/save-file-format.js';
import {PROFILE_KEY,CHARACTER_KEY} from '../dist/save-file.js';
import {PROGRESS_KEY} from '../dist/jobs.js';
const store=()=>{const m=new Map();return {m,getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))}};
// the new key names
assert.equal(PROFILE_KEY,'edenridge.profile.v1');assert.equal(CHARACTER_KEY,'edenridge.character.v1');assert.equal(PROGRESS_KEY,'edenridge.progress.v1');
// every old key is copied to the new one, and the old ones stay
{const s=store();for(const n of KEY_NAMES)s.setItem('citylife.'+n,'old-'+n);
 assert.equal(migrateKeys(s),KEY_NAMES.length);
 for(const n of KEY_NAMES){assert.equal(s.getItem('edenridge.'+n),'old-'+n);assert.equal(s.getItem('citylife.'+n),'old-'+n,'the old key is left alone')}
 assert.equal(migrateKeys(s),0,'a second run copies nothing')}
// a new key is never overwritten
{const s=store();s.setItem('citylife.profile.v1','old');s.setItem('edenridge.profile.v1','new');assert.equal(migrateKeys(s),0);assert.equal(s.getItem('edenridge.profile.v1'),'new')}
// nothing to copy, missing or broken storage
assert.equal(migrateKeys(store()),0);assert.equal(migrateKeys(null),0);assert.equal(migrateKeys({}),0);
{const s=store();s.setItem('citylife.profile.v1','old');s.setItem=()=>{throw new Error('Quota')};assert.equal(migrateKeys(s),0,'a full storage does not throw')}
// save files: new marker written, old marker still accepted
assert.equal(SAVE_FORMAT,'edenridge-save');assert(isSaveFormat('edenridge-save'));assert(isSaveFormat('citylife-save'));assert(!isSaveFormat('other'));assert(!isSaveFormat(undefined));
console.log('PASS legacy-keys.mjs: the rename keeps old saves: citylife.* keys are copied once to edenridge.* (never overwriting, old keys kept, no throw on a full storage), and save files with the old marker are still accepted.');