// PB2: the feet match what is drawn. For each surface, the y of the TOP of the drawn ground mesh (a ray straight down against the streamed world's ground meshes) is compared with standHeight (heightAt + footing),
// and the avatar's soles are compared with the stand height. Fails above 1.5 cm. Grass is a soft surface (the city is pinned to -.095), so it gets 3.0 cm. The city's own street boxes and pavement slabs are built in game.js
// (not reachable from Node): their tops are read from the source text and compared with FOOTING.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../dist/vendor/three.module.js';
import {createWorld,standHeight} from '../dist/world.js';
import {MAP} from '../dist/map-definition.js';
import {SURFACE,FOOTING,roadCenterline} from '../dist/terrain.js';
import {defaults,OUTFITS,outfit} from '../dist/appearance.js';
import {createCharacter,loadCharacterAssets,SOLE_LIFT} from '../dist/character.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};
// SOFT (grass): -.095 is pinned by the city; it sinks 1.3 cm on flat grass, 2.1 on the forest/farm ground (-.074), 2.5 to 2.7 on a hill slope (-.079 and the 2 m cells). The avatar's 1.6 cm sole lift cancels most of itlet tests=0;const ok=(c,m)=>{assert(c,m);tests++};
const LIMIT=1.5,SOFT=3.0;let tests=0;const ok=(c,m)=>{assert(c,m);tests++};

// ── the avatar: idle soles on the stand height ──
await loadCharacterAssets();
{let worst=0;const v=new THREE.Vector3();
 for(const body of ['male','female'])for(const [id] of OUTFITS[body]){const c=createCharacter(outfit(body,id));c.setMotion(0);for(let i=0;i<30;i++)c.update(.03);c.group.updateMatrixWorld(true);let low=9;
  for(const m of c.meshes){m.skeleton.update();const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++){m.getVertexPosition(i,v);v.applyMatrix4(m.matrixWorld);if(v.y<low)low=v.y}}
  worst=Math.max(worst,Math.abs(low*100))}
 console.log('avatar idle soles vs stand height: worst '+worst.toFixed(2)+' cm (SOLE_LIFT '+SOLE_LIFT+')');ok(worst<=1.2,'idle soles within 1.2 cm of the stand height ('+worst.toFixed(2)+' cm)')}

// ── the city's boxes (game.js) ──
{const src=readFileSync(new URL('../dist/game.js',import.meta.url),'utf8');
 const top=(re,h)=>{const m=src.match(re);assert(m,'found in game.js: '+re);return +m[1]+h/2};
 const oak=top(/box\(110,\.12,19,0,(-?[\d.]+),6,/,.12),alder=top(/box\(16,\.13,120,-30,(-?[\d.]+),0,/,.13);
 const slab=(()=>{const m=src.match(/slabOutline\(p,MAP\.roundedCorners\),(-?[\d.]+),(\.\d+),pavementColour/);assert(m);return +m[1]+ +m[2]})(),corner=(()=>{const m=src.match(/solid\(cornerRegion\(c\),(-?[\d.]+),(\.\d+),streetColour/);assert(m);return +m[1]+ +m[2]})();
 const near=(a,b,m)=>ok(Math.abs(a-b)*100<=LIMIT,m+': mesh top '+a.toFixed(3)+' vs footing '+b.toFixed(3));
 near(oak,FOOTING[SURFACE.STREET],'Oak Street box');near(alder,FOOTING[SURFACE.STREET],'Alder Avenue box');near(corner,FOOTING[SURFACE.STREET],'street corner patches');near(slab,FOOTING[SURFACE.PAVEMENT],'city pavement slabs')}

// ── the streamed world: raycast down ──
const scene=new THREE.Scene(),world=createWorld(scene,{cullRadius:Infinity,streaming:true}),view=world.chunks;
const pts=[];
for(const e of MAP.roads.edges){const c=roadCenterline(e);for(let i=1;i<c.length;i++){const dx=c[i][0]-c[i-1][0],dz=c[i][1]-c[i-1][1],L=Math.hypot(dx,dz),n=L||1,k=Math.max(1,Math.round(L/20));for(let s=0;s<k;s++){const f=(s+.5)/k;for(const off of [0,e.width*.3,-e.width*.3])pts.push({tag:e.id,x:c[i-1][0]+dx*f-dz/n*off,z:c[i-1][1]+dz*f+dx/n*off})}}}
for(const f of MAP.fields||[])for(const [a,b] of [[.3,.3],[.7,.7],[.5,.5]])pts.push({tag:'field-'+f.id,x:f.x0+(f.x1-f.x0)*a,z:f.z0+(f.z1-f.z0)*b});
for(const m of MAP.mud||[])pts.push({tag:'mud-'+m.id,x:(m.x0+m.x1)/2,z:(m.z0+m.z1)/2});
for(const p of MAP.pavements||[])if(p.draw)pts.push({tag:'pavement',x:(p.x0+p.x1)/2,z:(p.z0+p.z1)/2});
for(const p of MAP.paving||[])pts.push({tag:'paving',x:(p.x0+p.x1)/2,z:(p.z0+p.z1)/2});
for(const l of MAP.lots||[])pts.push({tag:'lot-'+l.id,x:(l.x0+l.x1)/2,z:(l.z0+l.z1)/2});
for(const r of MAP.reserved||[]){if(r.driveway)pts.push({tag:'driveway',x:(r.driveway.x0+r.driveway.x1)/2,z:(r.driveway.z0+r.driveway.z1)/2});if(r.path)pts.push({tag:'path',x:(r.path.x0+r.path.x1)/2,z:(r.path.z0+r.path.z1)/2})}
for(let x=-300;x<=1000;x+=50)for(let z=-1000;z<=560;z+=50)pts.push({tag:'grid',x:x+3.7,z:z+1.9}); // open ground, hills and the dug banks
for(const p of pts)world.ensure(p.x,p.z,0);
const GROUND=/^(ground-(?!far)|dirt-road|gravel-road|track-|field-|mud-|hill-|dug-|lot-|bridge-deck|pavement|town-square|eastbank-paving)/,meshes=[];scene.traverse(o=>{if(o.isMesh&&GROUND.test(o.name)){o.material.side=THREE.DoubleSide;meshes.push(o)}});scene.updateMatrixWorld(true);
const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),table=new Map();let bad=[];
for(const p of pts){const s=view.surfaceAt(p.x,p.z);if(!s||s===SURFACE.WATER||s===SURFACE.BANK||s===SURFACE.STREET)continue;
 ray.set(new THREE.Vector3(p.x,200,p.z),down);const h=ray.intersectObjects(meshes,false);if(!h.length)continue;
 if(s===SURFACE.PAVEMENT&&!/pavement|town-square/.test(h[0].object.name))continue; // the city's own pavements are game.js boxes (checked above)
 const d=(standHeight(p.x,p.z)-h[0].point.y)*100,lim=s===SURFACE.GRASS?SOFT:LIMIT;let row=table.get(s);if(!row)table.set(s,row={n:0,min:99,max:-99,sum:0});row.n++;row.sum+=d;row.min=Math.min(row.min,d);row.max=Math.max(row.max,d);
 if(Math.abs(d)>lim)bad.push(p.tag+' ('+p.x.toFixed(1)+','+p.z.toFixed(1)+') surface '+s+' '+h[0].object.name+' '+d.toFixed(2)+' cm')}
const NAME=Object.fromEntries(Object.entries(SURFACE).map(([k,v])=>[v,k]));
console.log('surface      samples  min cm  mean cm  max cm   (stand height minus mesh top; + = feet float, - = feet sink)');
for(const [s,r] of [...table].sort((a,b)=>a[0]-b[0]))console.log(String(NAME[s]).padEnd(12),String(r.n).padStart(7),r.min.toFixed(2).padStart(8),(r.sum/r.n).toFixed(2).padStart(8),r.max.toFixed(2).padStart(8));
ok(table.size>=8,'many surfaces were measured: '+table.size);
ok(bad.length===0,bad.length+' sample(s) over the limit: '+bad.slice(0,8).join('; '));
console.log('footing-match: '+tests+' checks passed');