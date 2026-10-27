export const palettes={
 skin:[['Fair','#edc9ae'],['Light','#d9ae8d'],['Medium','#b88f72'],['Tan','#a67350'],['Brown','#79513c'],['Deep','#4b332b']],
 hair:[['Black','#292b2b'],['Brown','#574033'],['Chestnut','#825337'],['Blond','#bca06a'],['Auburn','#924e35'],['Gray','#a8aaa5']],
 shirt:[['Sand','#c5bd9f'],['Ivory','#e5e1d2'],['Sage','#758b73'],['Blue','#66869b'],['Rust','#ab6d51'],['Charcoal','#454b4f']],
 trousers:[['Slate','#35494c'],['Denim','#405d7d'],['Khaki','#9a8b6c'],['Black','#303235']]
};
export const styles=['Short','Side part','Bob','Bun','Shaved'];
export const defaults={name:'',skin:'#b88f72',hair:'#574033',shirt:'#c5bd9f',trousers:'#35494c',style:'Short'};
export const SAVE_KEY='citylife.character.v1';
export function normalizeAppearance(value){
 const a=value&&typeof value==='object'?value:{};const result={...defaults};
 result.name=typeof a.name==='string'?a.name.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,24):'';
 for(const [key,colors] of Object.entries(palettes))if(colors.some(([,hex])=>hex===a[key]))result[key]=a[key];
 if(styles.includes(a.style))result.style=a.style;return result;
}
export function loadAppearance(storage){try{const raw=JSON.parse(storage.getItem(SAVE_KEY));if(raw?.version!==1)return null;return normalizeAppearance(raw.appearance)}catch{return null}}
export function saveAppearance(storage,appearance){try{storage.setItem(SAVE_KEY,JSON.stringify({version:1,appearance:normalizeAppearance(appearance)}));return true}catch{return false}}
