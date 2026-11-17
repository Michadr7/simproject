// One-time fallback for the Eden Ridge rename: copies each old citylife.* browser key to its new edenridge.* key when the new one is empty. The old keys are left alone (no data is deleted). Runs once, as a side effect of being imported; every module that owns a storage key imports it first. Uses a fixed list, not key enumeration, so it works on any storage that has getItem and setItem.
export const KEY_NAMES=['character.v1','progress.v1','profile.v1','audio.v1','cloud.v1','devUnlocked','dev.sky.v1','server.v1','settings.v1','backups.v1','sceneEdit.v1'];
export const OLD_PREFIX='citylife.',NEW_PREFIX='edenridge.';
export function migrateKeys(storage){let copied=0;if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')return 0;
 for(const name of KEY_NAMES){try{if(storage.getItem(NEW_PREFIX+name)!=null)continue;const old=storage.getItem(OLD_PREFIX+name);if(old==null)continue;storage.setItem(NEW_PREFIX+name,old);copied++}catch{/* a full or blocked storage: leave the old key as it is */}}
 return copied}
let storage=null;try{storage=globalThis.localStorage}catch{/* blocked */}
export const migrated=migrateKeys(storage);