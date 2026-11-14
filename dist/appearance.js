import './legacy-keys.js';
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
// What each part looks like, for the creator's buttons (named from renders of every outfit, 0.34.6). A part missing here is a
// duplicate of another (the men's Explorer top, trousers and shoes are the Suit's) and is not offered, unless it is already worn.
export const PART_NAMES={
 male:{
  head:{Casual_Hoodie:'Swept back',Casual_2:'Ponytail',Suit:'Side part',Worker:'Hard hat & moustache',Farmer:'Straw hat',Beach:'Spiky',Punk:'Mohawk',Adventurer:'Long hair & beard'},
  top:{Casual_Hoodie:'Hoodie',Casual_2:'T-shirt',Suit:'Suit jacket',Worker:'Hi-vis vest',Farmer:'Work shirt & braces',Beach:'Tank top',Punk:'Sleeveless jacket'},
  legs:{Casual_Hoodie:'Shorts',Casual_2:'Jeans',Suit:'Suit trousers',Worker:'Work trousers',Farmer:'Overalls',Beach:'Swim shorts',Punk:'Ripped jeans'},
  feet:{Casual_Hoodie:'Purple sneakers',Casual_2:'Red sneakers',Suit:'Dress shoes',Worker:'Work boots',Farmer:'Brown boots',Beach:'Flip-flops',Punk:'Black boots'}
 },
 female:{
  head:{Casual:'Bob',Formal:'Updo',Suit:'Long bob',Worker:'Hard hat',Punk:'Mohawk',Adventurer:'Short crop'},
  top:{Casual:'T-shirt',Formal:'Dress top',Suit:'Blazer',Worker:'Hi-vis vest',Punk:'Crop top',Adventurer:'Field shirt'},
  legs:{Casual:'Trousers',Formal:'Skirt',Suit:'Suit trousers',Worker:'Work trousers',Punk:'Ripped jeans',Adventurer:'Shorts'},
  feet:{Casual:'Sneakers',Formal:'Flats',Suit:'Dress shoes',Worker:'Work boots',Punk:'Platform boots',Adventurer:'Tall boots'}
 }
};
// Clothes only: a quick outfit sets top, legs and feet and leaves the hairstyle alone.
export const CLOTHES_KEYS=['top','legs','feet'];
// The choices offered for one part: [label, model id], duplicates left out unless `current` wears one.
export function partChoices(body,key,current){const names=(PART_NAMES[body]||PART_NAMES.male)[key];return outfitIds(body).filter(id=>names[id]||id===current).map(id=>[names[id]||(OUTFITS[body]||OUTFITS.male).find(([o])=>o===id)[1],id])}
// Quick outfits: the ones whose clothes are all on offer (the men's Explorer is the Suit's clothes, so it is left out).
export function quickOutfits(body){const names=(PART_NAMES[body]||PART_NAMES.male);return (OUTFITS[body]||OUTFITS.male).filter(([id])=>CLOTHES_KEYS.every(k=>names[k][id]))}
// Changing body type keeps every part the other body also has, and the colours.
export function switchBody(a,body){return normalizeAppearance({...a,body})}
// A random look for the same body: any hairstyle, one quick outfit's clothes, any skin and hair colour. rand() is in [0,1).
export function randomLook(a,rand=Math.random){const pick=list=>list[Math.floor(rand()*list.length)%list.length];const body=a.body,clothes=pick(quickOutfits(body))[0];
 return normalizeAppearance({...a,head:pick(partChoices(body,'head'))[1],top:clothes,legs:clothes,feet:clothes,skin:pick(palettes.skin)[1],hair:pick(palettes.hair)[1]})}
export const outfitIds=body=>(OUTFITS[body]||OUTFITS.male).map(([id])=>id);
export const defaults={name:'',body:'male',head:'Casual_Hoodie',top:'Casual_Hoodie',legs:'Casual_Hoodie',feet:'Casual_Hoodie',skin:'#b88f72',hair:'#574033'};
// A whole outfit from one set, e.g. outfit('female','Formal').
export const outfit=(body,id,extra={})=>({...defaults,body,head:id,top:id,legs:id,feet:id,...extra});
export const SAVE_KEY='edenridge.character.v1';
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
