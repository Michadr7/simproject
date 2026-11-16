import assert from 'node:assert/strict';
import {MAP,validateMap,weaponZoneAt,fishingAt,nearestRoad} from '../dist/map-definition.js';
let n=0;const ok=(c,m)=>{assert(c,m);n++};
const broken=edit=>{const map=structuredClone(MAP);edit(map);return validateMap(map)},has=(p,re)=>ok(p.some(m=>re.test(m)),`expected ${re}, got ${JSON.stringify(p)}`);

// RU1 (map-master 7.1): weapon and fishing zone data, the two lookups, the new validateMap checks.
ok(validateMap(MAP).length===0,'the real map validates with the zones');
const Z=Object.fromEntries(MAP.weaponZones.map(z=>[z.id,z]));
ok(MAP.weaponZones.length===6&&Z.blackstone.kind==='hunting'&&['old-block','kaspian-bay','eden','eden-outdoors','ranch-growth'].every(id=>Z[id]?.kind==='noWeapon'),'one hunting ground and five no-weapon zones');
ok(Z.blackstone.x0===350&&Z.blackstone.x1===1050&&Z.blackstone.z0===-1200&&Z.blackstone.z1===-700,'the hunting ground is the Blackstone Pass rectangle');
ok(MAP.fishing.spots.length===5&&MAP.fishing.rects[0].id==='lake-basin','five fishing spots and the lake basin');

// lookups
ok(weaponZoneAt(MAP.spawn.x,MAP.spawn.z).kind==='noWeapon'&&weaponZoneAt(MAP.spawn.x,MAP.spawn.z).id==='old-block','the spawn is in the old-block no-weapon zone');
ok(weaponZoneAt(340,340).id==='kaspian-bay'&&weaponZoneAt(850,-200).id==='eden'&&weaponZoneAt(700,-410).id==='eden-outdoors'&&weaponZoneAt(-300,-300).id==='ranch-growth','towns and the ranch are no-weapon');
ok(weaponZoneAt(400,-400).kind==='open'&&weaponZoneAt(-400,300).kind==='open','in-between land is open (carry, no fire)');
// a hunting spot: inside the rectangle, far from roads and keep-outs
const far=[[420,-1100],[560,-1000],[1000,-1100],[420,-800]].find(([x,z])=>weaponZoneAt(x,z).kind==='hunting');
ok(far&&weaponZoneAt(...far).id==='blackstone','there is hunting ground in the pass');
ok(weaponZoneAt(760,-790).kind==='open'&&weaponZoneAt(900,-950).kind==='open'&&weaponZoneAt(480,-900).kind==='open','100 m round camps C1, C2 and plot P2 is not hunting ground');
{const q=nearestRoad(830,-705);ok(q&&q.d<=6&&weaponZoneAt(830,-710).kind==='open','the trailhead road end is not hunting ground');}
ok(weaponZoneAt(349.9,-1000).kind==='open'&&weaponZoneAt(1050.1,-1000).kind==='open'&&weaponZoneAt(560,-699).kind==='open','just outside the rectangle is open');

// fishing
ok(fishingAt(650,-470).id==='dock-end'&&fishingAt(540,-470).id==='outflow-weir'&&fishingAt(600,-680).id==='p1-shore','spots are found');
ok(fishingAt(600,-560).kind==='basin'&&fishingAt(600,-560).id==='lake-basin','the lake basin rectangle counts');
ok(fishingAt(-400,300)===null&&fishingAt(100,-300)===null,'dry land far from water is no fishing');
{const r=MAP.water.rivers[0],p=r.points[Math.floor(r.points.length/2)],hit=fishingAt(p.x,p.z);ok(hit&&hit.kind==='water'&&hit.id==='river','standing in the river counts as river fishing');}
{const hit=[430,450,470,500,540].map(z=>fishingAt(200,z)).find(Boolean);ok(hit&&hit.kind==='water'&&hit.id==='sea','the sea shore counts');}

// validateMap catches
has(broken(m=>{m.weaponZones[1].x1=2000}),/reaches outside the world/);
has(broken(m=>{m.weaponZones[1].kind='soft'}),/unknown kind/);
has(broken(m=>{m.weaponZones[2].id='old-block'}),/duplicate weapon zone/);
has(broken(m=>{m.weaponZones[0].x0=-100;m.weaponZones[0].x1=100;m.weaponZones[0].z0=-300;m.weaponZones[0].z1=-200}),/overlap/);
has(broken(m=>{m.weaponZones.push({id:'second',kind:'hunting',x0:400,x1:500,z0:-900,z1:-800,roadMargin:100})}),/overlap/);
has(broken(m=>{m.weaponZones[0].roadMargin=50}),/road margin/);
has(broken(m=>{m.weaponZones[0].keepOut[0].r=-1}),/bad keep-out/);
has(broken(m=>{m.weaponZones[1].x0=100;m.weaponZones[1].x1=50}),/invalid bounds/);
has(broken(m=>{m.weaponZones=m.weaponZones.filter(z=>z.id!=='old-block')}),/spawn is not inside a no-weapon zone/);
has(broken(m=>{m.weaponZones=m.weaponZones.filter(z=>z.id!=='kaspian-bay')}),/town kaspian/);
has(broken(m=>{m.fishing.spots[0].x=900;m.fishing.spots[0].z=-900}),/inside a hunting zone/);
has(broken(m=>{m.fishing.rects[0].z0=-1000}),/overlaps a hunting zone/);
has(broken(m=>{m.fishing.spots[1].id='dock-end'}),/duplicate fishing spot/);
has(broken(m=>{m.fishing.spots[0].z=5000}),/inside the world/);
has(broken(m=>{m.fishing.water=['swamp']}),/unknown water kind/);
// two no-weapon zones may overlap (the ranch growth overlaps the old block by design)
ok(validateMap(MAP).length===0&&Z['ranch-growth'].x1>Z['old-block'].x0,'no-weapon zones may overlap each other');
console.log(`PASS zones-ru1 (${n} checks)`);
