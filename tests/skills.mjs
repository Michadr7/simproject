import assert from 'node:assert/strict';
import {levelOf,xpForNext,addXp,normalizeSkills,freshSkills,hitsNeeded,logsPerTree,swingTime,perkText,MAX_LEVEL,XP} from '../dist/skills.js';
// Levels: 40 XP to level 2, then 60, 80, ...
assert.deepEqual(levelOf(0),{level:1,into:0,next:40});assert.equal(levelOf(39).level,1);assert.deepEqual(levelOf(40),{level:2,into:0,next:60});
assert.equal(levelOf(99).level,2);assert.equal(levelOf(100).level,3);
const toLevel=n=>{let xp=0;for(let l=1;l<n;l++)xp+=xpForNext(l);return xp};
assert.equal(levelOf(toLevel(6)).level,6);assert.equal(levelOf(toLevel(6)-1).level,5);
assert.deepEqual(levelOf(toLevel(MAX_LEVEL)+9999),{level:MAX_LEVEL,into:0,next:0},'capped');
// Perks.
assert.deepEqual([1,5,6,12].map(hitsNeeded),[3,3,2,2]);assert.deepEqual([1,2,3,7,8].map(logsPerTree),[2,2,3,3,4]);
assert(swingTime(1)===.8&&swingTime(5)<swingTime(2)&&swingTime(20)===.5,'swings get faster to a floor');
assert.match(perkText(3),/log/);assert.match(perkText(6),/two hits/);assert.match(perkText(4),/swing/i);
// Adding XP reports level-ups and leaves the input alone.
const start={skills:freshSkills()};
const a=addXp(start,'lumberjack',XP.hit);assert.equal(a.state.skills.lumberjack.xp,2);assert(!a.leveledUp);assert.equal(start.skills.lumberjack.xp,0);
const b=addXp({skills:{lumberjack:{xp:39}}},'lumberjack',XP.hit);assert(b.leveledUp&&b.level===2);
// Saves.
assert.deepEqual(normalizeSkills(undefined),freshSkills());assert.deepEqual(normalizeSkills({lumberjack:{xp:-5}}),freshSkills());assert.deepEqual(normalizeSkills({lumberjack:{xp:1.5}}),freshSkills());
assert.deepEqual(normalizeSkills({lumberjack:{xp:120}}),{lumberjack:{xp:120}});assert.deepEqual(normalizeSkills({lumberjack:{xp:'9'}}),freshSkills());
console.log('Lumberjack levels, perks (swing speed, hits per tree, logs per tree), XP gains, level-ups, cap and save validation passed.');
