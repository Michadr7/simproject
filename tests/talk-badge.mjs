// Pure tests for dist/talk-badge.js: deterministic portrait badge, friendly tier/mood mapping, and purity.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {badgeFor,formatChip,BADGE_PALETTE,TIER_LABELS,MOOD_DOTS} from '../dist/talk-badge.js';

// 1. Portrait badge: initial + deterministic colour from name
const noah1=badgeFor('Noah'),noah2=badgeFor('Noah'),noahCase=badgeFor('  noah ');
assert.equal(noah1.initial,'N');
assert.deepEqual(noah1,noah2,'same name gives same badge');
assert.deepEqual(noah1,noahCase,'whitespace and case normalize');
assert.ok(BADGE_PALETTE.some(p=>p.bg===noah1.bg&&p.fg===noah1.fg),'uses palette');
assert.equal(badgeFor('').initial,'?','empty name falls back to ?');
assert.equal(badgeFor(null).initial,'?','null name falls back to ?');
const names=['Noah','Elena','Hal','Walt','Sophie','Alex','Malik','Brentster','Lincoln','Oscar'];
const used=new Set(names.map(n=>badgeFor(n).bg));
assert.ok(used.size>=4,'distinct names spread across the palette (got '+used.size+')');

// 2. Relationship chip: friendly tier labels and mood dot
const sg=formatChip('Stranger · good');
assert.equal(sg.label,'New face');
assert.equal(sg.mood,'good');
assert.equal(sg.dotColor,MOOD_DOTS.good.color);
assert.match(sg.title,/New face/);

assert.equal(formatChip('Stranger - low').label,'New face');
assert.equal(formatChip('Stranger - low').dotColor,MOOD_DOTS.low.color);
assert.equal(formatChip('Acquaintance · okay').label,TIER_LABELS.acquaintance);
assert.equal(formatChip('Friend · delighted').label,'Friend');
assert.equal(formatChip('Friend · delighted').dotColor,MOOD_DOTS.delighted.color);
assert.equal(formatChip('Close · miserable').label,'Close friend');
assert.equal(formatChip('Close · miserable').dotColor,MOOD_DOTS.miserable.color);
assert.equal(formatChip('Stranger').label,'New face');
assert.equal(formatChip('Stranger').dotColor,'');
assert.equal(formatChip({tier:'acquaintance',mood:'good'}).label,'Getting to know you');
assert.equal(formatChip('CustomTier · okay').label,'CustomTier');
assert.equal(formatChip(''),null);
assert.equal(formatChip(null),null);

// 3. Purity: no DOM, no clock, no random
const src=fs.readFileSync(new URL('../dist/talk-badge.js',import.meta.url),'utf8').replace(/\/\/.*$/gm,'');
for(const bad of ['document','window','Date.now','Math.random','performance.now','three'])assert(!src.includes(bad),'talk-badge.js must not use '+bad);

console.log('PASS talk-badge.mjs: portrait initial/colour deterministic across '+names.length+' names ('+used.size+' colours), friendly tier/mood chip mapping, and purity.');
