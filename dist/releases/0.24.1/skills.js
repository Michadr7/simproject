// Skills: experience that persists in progress.skills. Only the lumberjack exists so far.
export const MAX_LEVEL=20;
export const XP={hit:2,fell:12};
// XP needed to go from `level` to the next one.
export const xpForNext=level=>40+20*(level-1);
export function levelOf(xp){
 let level=1,remaining=Math.max(0,xp);
 while(level<MAX_LEVEL&&remaining>=xpForNext(level)){remaining-=xpForNext(level);level++}
 return {level,into:level>=MAX_LEVEL?0:remaining,next:level>=MAX_LEVEL?0:xpForNext(level)};
}
export const freshSkills=()=>({lumberjack:{xp:0}});
export function normalizeSkills(value){
 const xp=value?.lumberjack?.xp;
 return {lumberjack:{xp:Number.isSafeInteger(xp)&&xp>=0&&xp<=1e7?xp:0}};
}
export function addXp(progress,skill,amount){
 const before=levelOf(progress.skills[skill].xp).level,xp=progress.skills[skill].xp+amount;
 const level=levelOf(xp).level;
 return {state:{...progress,skills:{...progress.skills,[skill]:{xp}}},level,leveledUp:level>before};
}
// Lumberjack perks by level.
export const swingTime=level=>Math.max(.5,.8-.03*(level-1)); // seconds per swing
export const hitsNeeded=level=>level>=6?2:3;
export const logsPerTree=level=>2+(level>=3?1:0)+(level>=8?1:0);
export function perkText(level){
 return level===3||level===8?'One more log per tree.':level===6?'Trees fall in two hits.':'Faster swings.';
}

// Lifetime counters shown in the phone's Skills section.
export const freshStats=()=>({treesFelled:0,logsCollected:0});
export function normalizeStats(value){
 const n=x=>Number.isSafeInteger(x)&&x>=0&&x<=1e9?x:0;
 return {treesFelled:n(value?.treesFelled),logsCollected:n(value?.logsCollected)};
}
export const perksText=level=>`Swing ${swingTime(level).toFixed(2)} s · ${hitsNeeded(level)} hits per tree · ${logsPerTree(level)} logs per tree`;
