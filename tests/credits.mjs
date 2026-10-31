import assert from 'node:assert/strict';
import {PROPS} from '../dist/props-assets.js';
import {CREDITS,creditFor} from '../dist/credits.js';

// Every model that ships has a credit: a new asset cannot be added without saying who made it.
for(const [id,p] of Object.entries(PROPS))assert(creditFor(p.source),`${id} (${p.source}) has no credit in credits.js`);
for(const c of CREDITS){assert(c.who&&c.what&&c.licence&&/^https:\/\//.test(c.url),`${c.who}: author, what, licence and a link`);assert(Array.isArray(c.covers))}
assert.equal(new Set(CREDITS.map(c=>c.who)).size,CREDITS.length,'one entry per author');
// Everything in the game that is not CC0 or MIT must be named with its licence (none ship at present: the CC-BY pieces wait for their features).
const nonFree=CREDITS.filter(c=>!/CC0|MIT/.test(c.licence));
console.log(`Credits: ${CREDITS.length} entries cover all ${Object.keys(PROPS).length} shipped models (${CREDITS.length-nonFree.length} CC0 or MIT; ${nonFree.map(c=>c.who).join(', ')} with their own terms, credited with a link).`);
