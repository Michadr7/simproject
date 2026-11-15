import assert from 'node:assert/strict';
import {crashPoints,applyPoints,bandOf,percent} from '../dist/damage.js';
import {CLASSES} from '../dist/vehicle.js';

// The crash table (VD7a): ONE table that shows the whole tuning. Retune IMPACT_MIN / CRASH_K / POINT_CAP / BANDS in damage.js or `tough` in vehicle.js, run `node tests/damage-table.mjs`, read the table, then fix the asserts at the bottom on purpose.
const speeds=[3,4,5,6,8,10,12,15,18,20,25,29,32];
const toughs=[.6,.8,.85,1];
const hitsToWreck=(pts)=>{let c=1000,n=0;while(c>0&&n<99){c=applyPoints(c,pts);n++}return n};
const label=c=>`${String(percent(c)).padStart(3)}% ${bandOf(c).label}`;
const lines=['Crash table: points and the band after ONE crash from a perfect (1000) vehicle; last column = hits at that speed to reach Wrecked',
 ['m/s'.padStart(5),...toughs.map(t=>('tough '+t).padStart(24))].join('')];
for(const v of speeds)lines.push([String(v).padStart(5),...toughs.map(t=>{const p=crashPoints(v,t);return `${String(p).padStart(5)} -> ${label(applyPoints(1000,p))}`.padStart(24)})].join(''));
lines.push('hits to Wrecked at 29 m/s: '+toughs.map(t=>`tough ${t}: ${hitsToWreck(crashPoints(29,t))}`).join(' | '));
lines.push('Real classes at their top speed into a wall, from Fine:');
const rows={};
for(const c of Object.values(CLASSES)){const p=crashPoints(c.top,c.tough),seq=[];let cond=1000;while(cond>0&&seq.length<9){cond=applyPoints(cond,p);seq.push(cond)}rows[c.id]={top:c.top,points:p,left:applyPoints(1000,p),seq,hits:seq.length};
 lines.push(`  ${c.id.padEnd(9)} tough ${String(c.tough).padEnd(4)} top ${String(c.top).padEnd(5)} m/s: ${String(p).padStart(3)} points, ${label(applyPoints(1000,p))}; after each hit: ${seq.map(x=>percent(x)+'%').join(' > ')}`)}
console.log(lines.join('\n'));

// The target (the user, 2026-11-17): a full-speed wall hit leaves the vehicle Damaged with about 40 to 60% left; Wrecked needs two or three hard hits; a bump under 4 m/s costs nothing; a scrape costs little.
for(const [id,r] of Object.entries(rows)){assert(r.left>=370&&r.left<=640,id+': a full-speed hit leaves about 40 to 60% ('+r.left+')');assert.equal(bandOf(r.left).id,'damaged',id+': and reads Damaged');assert(r.hits>=2&&r.hits<=3,id+': Wrecked after 2 or 3 full-speed hits ('+r.hits+')')}
assert(rows.shortbed.left>=450&&rows.shortbed.left<=550,'the S70: about 50% left');
for(const t of toughs){assert.equal(crashPoints(3.9,t),0,'under 4 m/s is free');assert.equal(crashPoints(4,t),0);assert(crashPoints(6,t)<=25,'a scrape (6 m/s) costs little: '+crashPoints(6,t));assert(applyPoints(1000,crashPoints(8,t))>=bandMin('fine'),'8 m/s (a clumsy tap) leaves a Fine vehicle')}
function bandMin(id){return id==='fine'?800:0}
for(const t of toughs){assert(crashPoints(20,t)<crashPoints(25,t)&&crashPoints(25,t)<=600,'harder hits cost more, inside the 600 cap')}
console.log('PASS damage-table.mjs: the crash table (printed above): every class loses about half at full speed and is Wrecked on the 2nd or 3rd hit, bumps under 4 m/s are free, a 6 m/s scrape costs 25 points or less.');
