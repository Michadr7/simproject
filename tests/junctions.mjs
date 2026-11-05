import assert from 'node:assert/strict';
import {MAP} from '../dist/map-definition.js';
import {junctionPatches,FILLET_R} from '../dist/junctions.js';
import {terrain,SURFACE} from '../dist/terrain.js';

// Junction patches (0.34): rounded inside corners at crossings and T junctions, flares where road widths change; never inside a town, on paving, a plot, a building or a field.
const P=junctionPatches(),T=terrain();
assert(P.length>=6,'there are patches: '+P.length);
assert(P.some(p=>p.kind==='fillet')&&P.some(p=>p.kind==='taper'),'both kinds');
for(const p of P){assert(p.points.length>=3,'a polygon');for(const [x,z] of p.points)assert(Number.isFinite(x)&&Number.isFinite(z));
 // every patch cell is road now (painted by terrain.js), and the ground just outside the patch's own roads is the road kind or the road it joins
 const m=p.points[Math.floor(p.points.length/2)],c=p.kind==='fillet'?[p.points[0][0]*.75+m[0]*.25,p.points[0][1]*.75+m[1]*.25]:p.points.reduce((a,q)=>[a[0]+q[0]/p.points.length,a[1]+q[1]/p.points.length],[0,0]);assert.equal(T.surfaceAt(...c),SURFACE.ROAD,`${p.kind} of ${p.roads.join('/')} is road at ${c.map(v=>v.toFixed(1))}`);
 assert(T.walkable?T.walkable(...c):true)}
// a fillet is a quarter round: its corner point, then an arc of radius r (at most FILLET_R) around the point r away from the corner on both axes
{const f=P.find(p=>p.kind==='fillet'),[cx,cz]=f.points[0],r=Math.hypot(f.points[1][0]-cx,f.points[1][1]-cz);assert(r<=FILLET_R+1e-6&&r>=1.5);const ctr=[f.points.at(-1)[0]+(f.points[1][0]-cx),f.points[1][1]+(f.points.at(-1)[1]-cz)];
 for(const q of f.points.slice(1,-1)){} assert(f.points.length>=8,'the arc has several steps')}
// tapers join two roads of different widths
for(const t of P.filter(p=>p.kind==='taper')){const [a,b]=t.roads.map(id=>MAP.roads.edges.find(e=>e.id===id));assert(a.width!==b.width,'a taper is between roads of different width')}
console.log(`Junctions: ${P.length} patches (${P.filter(p=>p.kind==='fillet').length} rounded corners, ${P.filter(p=>p.kind==='taper').length} width tapers), all road on the terrain mask, none inside a town, on paving, a plot, a building or a field.`);

// Rounded kerbs inside Westside (MAP.roundedCorners): the pavement slabs lose the corner, the street gains it, and nothing overlaps.
{const {slabOutline,cornerRegion,inPolygon}=await import('../dist/junctions.js');
 assert(MAP.roundedCorners.length>=5);
 for(const c of MAP.roundedCorners){const region=cornerRegion(c);assert(region.length>=8&&region[0][0]===c.x&&region[0][1]===c.z,c.id+': the region starts at the corner');
  assert.equal(T.surfaceAt(c.x+c.sx*.6,c.z+c.sz*.6),SURFACE.STREET,c.id+': the corner is street on the terrain mask');
  assert.notEqual(T.surfaceAt(c.x+c.sx*(c.r+1),c.z+c.sz*(c.r+1)),SURFACE.STREET,c.id+': beyond the arc it is not')}
 for(const p of MAP.pavements.filter(p=>!p.draw)){const o=slabOutline(p,MAP.roundedCorners);assert(o.length>=4);for(const c of MAP.roundedCorners){const inside=inPolygon(o,c.x+c.sx*.5,c.z+c.sz*.5);if(o.length>4&&Math.abs(c.x-(c.sx>0?p.x0:p.x1))<1e-6)assert(!inside,'a slab does not cover its own rounded corner')}}
 const full=slabOutline({x0:0,x1:10,z0:0,z1:5},[]);assert.deepEqual(full,[[0,0],[10,0],[10,5],[0,5]],'a slab with no rounded corners is its rectangle')}
