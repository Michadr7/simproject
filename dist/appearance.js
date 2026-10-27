// Character appearance: a body type (male/female), one outfit per part (head, top, legs, shoes) and
// skin/hair colours. Parts come from the Quaternius Ultimate Modular Men/Women packs (CC0); see
// scripts/build-characters.mjs. This file is pure data so it can be used without loading any models.
export const palettes={
 skin:[['Fair','#edc9ae'],['Light','#d9ae8d'],['Medium','#b88f72'],['Tan','#a67350'],['Brown','#79513c'],['Deep','#4b332b']],
 hair:[['Black','#292b2b'],['Brown','#574033'],['Chestnut','#825337'],['Blond','#bca06a'],['Auburn','#924e35'],['Gray','#a8aaa5']]
};
export const BODIES=[['male','Male'],['female','Female']];
// [model id, label]. A part may come from any outfit of the same body type.
export const OUTFITS={
 male:[['Casual_Hoodie','Hoodie'],['Casual_2','Casual'],['Suit','Suit'],['Worker','Worker'],['Farmer','Farmer'],['Beach','Beach'],['Punk','Punk'],['Adventurer','Explorer']],
 female:[['Casual','Casual'],['Formal','Formal'],['Suit','Suit'],['Worker','Worker'],['Punk','Punk'],['Adventurer','Explorer']]
};
export const PART_KEYS=['head','top','legs','feet'];
export const outfitIds=body=>(OUTFITS[body]||OUTFITS.male).map(([id])=>id);
export const defaults={name:'',body:'male',head:'Casual_Hoodie',top:'Casual_Hoodie',legs:'Casual_Hoodie',feet:'Casual_Hoodie',skin:'#b88f72',hair:'#574033'};
// A whole outfit from one set, e.g. outfit('female','Formal').
export const outfit=(body,id,extra={})=>({...defaults,body,head:id,top:id,legs:id,feet:id,...extra});
export const SAVE_KEY='citylife.character.v1';
export function normalizeAppearance(value){
 const a=value&&typeof value==='object'?value:{};const result={...defaults};
 result.name=typeof a.name==='string'?a.name.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,24):'';
 result.body=BODIES.some(([id])=>id===a.body)?a.body:'male';
 const ids=outfitIds(result.body);
 for(const key of PART_KEYS)result[key]=ids.includes(a[key])?a[key]:ids[0];
 for(const [key,colors] of Object.entries(palettes))if(colors.some(([,hex])=>hex===a[key]))result[key]=a[key];
 return result;
}
// Version 1 saves (old hand-built character) still load: their skin and hair colours carry over.
export function loadAppearance(storage){try{const raw=JSON.parse(storage.getItem(SAVE_KEY));if(raw?.version!==1&&raw?.version!==2)return null;return normalizeAppearance(raw.appearance)}catch{return null}}
export function saveAppearance(storage,appearance){try{storage.setItem(SAVE_KEY,JSON.stringify({version:2,appearance:normalizeAppearance(appearance)}));return true}catch{return false}}
