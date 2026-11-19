// Talk badge and relationship chip helpers (pure): portrait initial badge and friendly tier/mood mapping (notes/owner-feedback-2026-11-18.md item 5).
export const BADGE_PALETTE=Object.freeze([
 Object.freeze({bg:'#c87d4b',fg:'#1a1612'}),
 Object.freeze({bg:'#6e9e75',fg:'#141a15'}),
 Object.freeze({bg:'#5d8aa8',fg:'#f4f6f8'}),
 Object.freeze({bg:'#d4a64a',fg:'#1c1810'}),
 Object.freeze({bg:'#9b6b9e',fg:'#f6f2f7'}),
 Object.freeze({bg:'#4e9a94',fg:'#101c1b'}),
 Object.freeze({bg:'#b85d5d',fg:'#f9f2f2'}),
 Object.freeze({bg:'#7d8a55',fg:'#161911'})
]);
export const TIER_LABELS=Object.freeze({
 stranger:'New face',
 acquaintance:'Getting to know you',
 friend:'Friend',
 close:'Close friend'
});
export const MOOD_DOTS=Object.freeze({
 miserable:Object.freeze({color:'#d9534f',label:'rough mood'}),
 low:Object.freeze({color:'#e08b4f',label:'low mood'}),
 okay:Object.freeze({color:'#c8c2b0',label:'steady mood'}),
 good:Object.freeze({color:'#86c46d',label:'good mood'}),
 delighted:Object.freeze({color:'#facd38',label:'great mood'}),
 cheerful:Object.freeze({color:'#86c46d',label:'good mood'})
});
export function badgeFor(name){
 const s=typeof name==='string'?name.trim():'';
 const initial=s?s[0].toUpperCase():'?';
 const key=s.toLowerCase();
 let h=2166136261;
 for(let i=0;i<key.length;i++){h^=key.charCodeAt(i);h=Math.imul(h,16777619)}
 const pal=BADGE_PALETTE[(h>>>0)%BADGE_PALETTE.length];
 return {initial,bg:pal.bg,fg:pal.fg};
}
export function formatChip(raw){
 if(raw===null||raw===undefined)return null;
 let tierRaw='',moodRaw='';
 if(typeof raw==='object'){
  tierRaw=String(raw.tier||'').trim();
  moodRaw=String(raw.mood||'').trim();
 }else{
  const s=String(raw).trim();
  if(!s)return null;
  const parts=s.split(/\s*[·-]\s*/);
  tierRaw=(parts[0]||'').trim();
  moodRaw=(parts[1]||'').trim();
 }
 if(!tierRaw&&!moodRaw)return null;
 const label=TIER_LABELS[tierRaw.toLowerCase()]||tierRaw;
 const mood=moodRaw.toLowerCase();
 const dot=MOOD_DOTS[mood]||null;
 const moodLabel=dot?dot.label:moodRaw;
 return {
  label,
  mood,
  dotColor:dot?dot.color:'',
  moodLabel,
  title:moodLabel?`${label} · ${moodLabel}`:label
 };
}
