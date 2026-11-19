// Diner sound registry, mix levels, and pure shot picker (CC0).
const freeze=Object.freeze;
const shot=(clip,level,jitter=.06)=>freeze({clips:freeze([clip]),level,jitter,slot:clip});
const loop=(file,level)=>freeze({file,level});

export const DINER_SHOTS=freeze({
 'steam-shot':shot('diner-steam-shot',.50,.06),
 'pour':shot('diner-pour',.45,.05),
 'grill-flip':shot('diner-grill-flip',.50,.07),
 'plate-clink':shot('diner-plate-clink',.50,.08),
 'cutlery':shot('diner-cutlery',.45,.08),
 'till':shot('diner-till',.55,.04),
 'bell':shot('diner-bell',.55,.03),
 'oven-ding':shot('diner-oven-ding',.55,.02),
 'door-bell':shot('diner-door-bell',.50,.03),
 'order-chime':shot('diner-order-chime',.45,.02)
});

export const DINER_LOOPS=freeze({
 'espresso-pump':loop('diner-espresso-pump',.45),
 'espresso-steam':loop('diner-espresso-steam',.45),
 'grinder':loop('diner-grinder',.50),
 'grill-sizzle':loop('diner-grill-sizzle',.35),
 'room-tone':loop('diner-room-tone',.18)
});

export const DINER_FILES=freeze([...new Set([
 ...Object.values(DINER_SHOTS).flatMap(s=>s.clips),
 ...Object.values(DINER_LOOPS).map(l=>l.file)
])]);

export const DINER_MAX_FILE_BYTES=40000,DINER_MAX_TOTAL_BYTES=400000;

export function pickShot(kind,random,last=-1){
 const s=DINER_SHOTS[kind];if(!s||!s.clips.length)return null;
 const r=typeof random==='function'?random:()=>0,n=s.clips.length;
 let index=Math.min(n-1,Math.max(0,Math.floor(r()*n)));
 if(n>1&&index===last)index=(index+1+Math.floor(r()*(n-1)))%n;
 const rate=+(1+(r()-.5)*s.jitter*2).toFixed(4);
 return {file:s.clips[index],index,level:s.level,rate,slot:s.slot};
}
