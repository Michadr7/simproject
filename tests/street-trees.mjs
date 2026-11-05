import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {terrain,SURFACE} from '../dist/terrain.js';
import {townSpots} from '../dist/town.js';

// Street trees never stand in the road (0.34): the town's own (town.js) and Oak Street's list in game.js (OAK_TREES), the trunk is never on the road, and Oak Street's also keep 0.8 m clear of it.
const T=terrain(),ROADS=new Set([SURFACE.STREET,SURFACE.ROAD,SURFACE.BRIDGE,SURFACE.DRIVEWAY,SURFACE.WATER]);
const oak=JSON.parse(/const OAK_TREES=(\[\[[^;]*?\]\]);/.exec(readFileSync(new URL('../dist/game.js',import.meta.url),'utf8'))[1]);
const trees=[...townSpots().tree.map(t=>[t.x,t.z,'town']),...oak.map(([x,z])=>[x,z,'oak'])];
assert(trees.length>=20);
for(const [x,z,who] of trees){for(const [dx,dz] of who==='oak'?[[0,0],[.8,0],[-.8,0],[0,.8],[0,-.8]]:[[0,0]])assert(!ROADS.has(T.surfaceAt(x+dx,z+dz)),`${who} tree at ${x},${z} stands on or against the road`)}
console.log(`Street trees: ${trees.length} (${oak.length} on Oak Street, the rest in the town), none in a road.`);