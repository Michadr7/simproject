// I4/I5 models, plots, doors and jobs on the expanded Ironwood streets.
import assert from 'node:assert/strict';
import {MAP,validateMap} from '../dist/map-definition.js';
import {DOWNTOWN_PROPS as PROPS} from '../dist/props-assets-downtown.js';
import {DOWNTOWN_LANDMARKS,DOWNTOWN_PROPERTIES,DOWNTOWN_POSTS,DOWNTOWN_DETAILS,DOWNTOWN_SIGNS} from '../dist/downtown.js';
import {doorOf,worldDoors} from '../dist/properties.js';
import {townPopulation} from '../dist/population.js';
import {terrain,SURFACE} from '../dist/terrain.js';

assert.deepEqual(validateMap(),[]);
assert.deepEqual(DOWNTOWN_PROPERTIES.map(p=>p.plot),['C11','C13','C14','C15','C16','C17','C18','C19','C20']);
assert.equal(MAP.properties.find(p=>p.plot==='C12').id,'alder-barber');
const doors=worldDoors(),people=townPopulation().people;
let triangles=0;
for(const landmark of DOWNTOWN_LANDMARKS){
 const plot=MAP.reserved.find(p=>p.id===landmark.plot);
 const property=DOWNTOWN_PROPERTIES.find(p=>p.landmark===landmark.id);
 const model=PROPS[landmark.prop];
 const west=plot.facing==='west',w=west?model.depth:model.width,d=west?model.width:model.depth;
 assert(landmark.x-w/2>=plot.x0&&landmark.x+w/2<=plot.x1,landmark.id+' x fit');
 assert(landmark.z-d/2>=plot.z0&&landmark.z+d/2<=plot.z1,landmark.id+' z fit');
 const door=doorOf(property);
 assert.deepEqual([Math.round(door.faceX)||0,Math.round(door.faceZ)||0],west?[-1,0]:[0,-1]);
 assert(terrain().walkable(door.x+door.faceX,door.z+door.faceZ),'door sidewalk: '+landmark.id);
 assert(doors.some(d=>d.id===landmark.id&&d.open&&d.state==='public'));
 assert(people.some(p=>p.post===landmark.id),'staff post: '+landmark.id);
 triangles+=model.triangles;
}
assert.equal(DOWNTOWN_POSTS.length,9);
assert.equal(new Set(DOWNTOWN_LANDMARKS.map(l=>l.prop)).size,9);
assert(triangles<25000);
for(const id of ['awning','awning-wide','overhang','overhang-wide','parasol-a','parasol-b']){
 assert(PROPS[id].triangles>0);
 assert.equal(PROPS[id].colliders.length,0);
}
assert.equal(DOWNTOWN_DETAILS.length,18);
for(const d of DOWNTOWN_DETAILS){
 assert(PROPS[d.prop],'detail prop: '+d.prop);
 assert.equal(terrain().surfaceAt(d.x,d.z),SURFACE.PAVEMENT,'detail on pavement: '+d.prop+'@'+d.x+','+d.z);
}
assert.equal(DOWNTOWN_SIGNS.length,15);
for(const s of DOWNTOWN_SIGNS){
 assert(s.text&&s.w>0&&s.h>0&&s.y>2.5,'sign valid: '+s.id);
}
console.log('PASS downtown: 9 unique facades, sidewalk doors, staff posts, 6 converted details, 18 awnings/parasols and 14 signs; '+triangles+' placed triangles');
