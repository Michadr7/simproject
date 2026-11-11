// 3D viewer (Mikkadr Hub P3c, hub/orbit.js, hub/viewer.html, hub/builders.js): the orbit maths, the catalog the viewer reads, and what the pages may load.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {orbitPosition,applyDrag,applyZoom,applyPan,clamp,PITCH_LIMIT} from '../hub/orbit.js';
import {factsOf,ratioLine,compareFacts,sideBySide,PLAYER_HEIGHT} from '../hub/compare.js';
import {resolveRoute} from '../hub/server.js';
import {loadAssets} from '../hub/assets-load.mjs';
import {catalogOf} from '../hub/assets-cli.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const near=(a,b,eps=1e-9,msg='')=>assert(Math.abs(a-b)<eps,`${msg} ${a} vs ${b}`);

// Orbit maths: the camera sits `distance` from the target, in front (+z) at yaw 0, and always looks at it.
const S={target:{x:1,y:2,z:3},yaw:0,pitch:0,distance:10};
let p=orbitPosition(S);near(p.x,1);near(p.y,2);near(p.z,13,1e-9,'in front');
p=orbitPosition({...S,yaw:Math.PI/2});near(p.x,11);near(p.z,3,1e-9,'quarter turn');
p=orbitPosition({...S,pitch:Math.PI/2});near(p.y,12);
for(const s of [{...S,yaw:1.2,pitch:.7},{...S,yaw:-2,pitch:-1}]){const q=orbitPosition(s);near(Math.hypot(q.x-1,q.y-2,q.z-3),10,1e-9,'distance is kept')}
// dragging right turns the model to the right (the camera goes left), dragging down tips the camera up, and the pitch is clamped
assert(applyDrag(S,100,0).yaw<S.yaw);assert(applyDrag(S,0,100).pitch>0);
near(applyDrag(S,0,1e6).pitch,PITCH_LIMIT);near(applyDrag(S,0,-1e6).pitch,-PITCH_LIMIT);
// zoom: a wheel notch away from you moves out by about 12 percent, never past the limits
assert(applyZoom(S,100,.5,50).distance>10);assert(applyZoom(S,-100,.5,50).distance<10);near(applyZoom(S,100,.5,50).distance,10*Math.exp(.12),1e-9);
near(applyZoom(S,1e6,.5,50).distance,50);near(applyZoom(S,-1e6,.5,50).distance,.5);
// pan moves the target, not the distance; at yaw 0 pitch 0 dragging right moves the target left and dragging down moves it up
const pan=applyPan(S,100,0,.01);near(pan.target.x,0);near(pan.target.y,2);near(pan.distance,10);
near(applyPan(S,0,100,.01).target.y,3);
assert.equal(clamp(5,0,3),3);

// The pages and what they load: only the viewer's own modules and the game's, from the same origin (the server allowlist), no outside scripts.
const viewer=fs.readFileSync(path.join(root,'hub','viewer.html'),'utf8'),studio=fs.readFileSync(path.join(root,'hub','studio.html'),'utf8'),builders=fs.readFileSync(path.join(root,'hub','builders.js'),'utf8');
for(const [name,text] of [['viewer.html',viewer],['studio.html',studio],['builders.js',builders]]){
 assert(!/<script[^>]+src=/i.test(text),`${name}: no script tags with a source`);
 assert(!/https?:\/\/(?!127\.0\.0\.1)/i.test(text.replace(/<!--[\s\S]*?-->/g,'')),`${name}: loads nothing from outside`);
 for(const m of text.matchAll(/(?:from\s+|import\()\s*['"]([^'"]+)['"]/g)){const spec=m[1];assert(spec.startsWith('/'),`${name}: ${spec} is an absolute path on the server`);assert(resolveRoute(root,spec,'127.0.0.1:1',1).file,`${name}: ${spec} is on the allowlist`)}
}
assert(/fetch\('\/previews\/catalog\.json'\)/.test(viewer),'the viewer reads the catalog');
assert(!/innerHTML=`[^`]*\$\{a\.(name|notes)\}/.test(viewer),'names are escaped before they go into the page');
for(const id of ['wire','player','grid','reset','q'])assert(viewer.includes(`id="${id}"`),`the ${id} control exists`);
assert(/PLAYER=1\.95/.test(viewer),'the scale figure is the 1.95 m player');
assert(/dblclick/.test(fs.readFileSync(path.join(root,'hub','orbit.js'),'utf8')),'double-click resets');

// ---- Compare mode: what is said about two assets, where they stand, and how the viewer wires it.
near(PLAYER_HEIGHT,1.95);
const fa=factsOf({name:'A',stage:'in-game',pack:'P',triangles:100,size:{w:2,d:2,h:1}}),fb=factsOf({name:'B',stage:'in-game',pack:'P',triangles:250,size:{w:1,d:4,h:3.9}},{triangles:300,size:{w:1,d:4,h:3.9}});
assert.equal(fb.triangles,300,'a measurement beats the catalog value');assert.equal(fa.triangles,100);
assert.equal(ratioLine('Triangles','A','B',100,300),'B has 3 times the triangles of A');
assert.equal(ratioLine('Triangles','A','B',300,100),'A has 3 times the triangles of B');
assert.match(ratioLine('Height','A','B',2,2.05),/about the same/);
assert.match(ratioLine('Triangles','A','B',null,5),/unknown for A/);assert.match(ratioLine('Triangles','A','B',5,0),/unknown for B/);
assert.equal(ratioLine('Triangles','A','B',1,1234),'B has 1,234 times the triangles of A');
const cf=compareFacts(fa,fb);
assert(cf.lines[0].includes('3 times the triangles of A'));assert(cf.lines.some(l=>/B has 3.9 times the height of A|B has 3\.9 times/.test(l)));assert(cf.lines.some(l=>/B is 2 times the player's height/.test(l)),'height against the 1.95 m player');
near(cf.triRatio,3);near(cf.heightRatio,3.9);
assert.equal(compareFacts(fa,{...fb,size:null}).heightRatio,null,'no height ratio without a size');assert(compareFacts({...fa,triangles:null},fb).lines[0].includes('unknown'));
const sb=sideBySide(10,2,2.2);near(sb.total,14.2);near(sb.b-sb.a,10/2+2.2+2/2,1e-9,'centres are half-widths plus the gap apart');near(sb.gapCentre,-7.1+10+1.1);
assert(sb.a-5>=-7.1-1e-9&&sb.b+1<=7.1+1e-9,'both models stay inside the total width');
assert(sb.gapCentre>sb.a+5&&sb.gapCentre<sb.b-1,'the figure stands in the gap between the two');
for(const id of ['compare','swap','labA','labB'])assert(viewer.includes(`id="${id}"`),`the ${id} element exists`);
assert(/import \{compareFacts,factsOf,sideBySide\} from '\/compare\.js'/.test(viewer),'the viewer uses the pure compare rules');
assert(/location\.hash\.includes\('~'\)/.test(viewer),'a link #A~B opens compare mode');
assert(/function dropSlot/.test(viewer)&&/dropSlot\(i\);slots\[i\]=slot/.test(viewer),'a replaced model leaves the scene');
// The catalog: one record per asset with a way to draw it and no model data.
const r=await loadAssets(root),cat=catalogOf(r.assets,'v1',{});
assert.equal(cat.length,r.assets.length);assert.equal(new Set(cat.map(c=>c.id)).size,cat.length);
for(const c of cat){assert(/^[a-f0-9]{20}$/.test(c.key),c.id+' has a picture key');assert(c.spec&&c.spec.mode,c.id+' has a spec');assert(c.pack&&c.stage&&c.name)}
const json=JSON.stringify(cat);assert(json.length<400000,'the catalog is small: '+json.length+' bytes');assert(!/"(pos|nor|positions|normals)"/.test(json),'no model fields in the catalog');
const modes={};for(const c of cat)modes[c.spec.mode]=(modes[c.spec.mode]||0)+1;
console.log(`Viewer: orbit maths pinned; pages load only allowlisted same-origin modules; catalog ${cat.length} assets, ${Math.round(json.length/1024)} KB, modes ${JSON.stringify(modes)}.`);
