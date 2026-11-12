import assert from 'node:assert/strict';
import {MAP,YARD_CAPS} from '../dist/map-definition.js';
import {propInfo} from '../dist/props.js';
import {SCENE_EDITS} from '../dist/scene-edits.js';
import {emptyEdits,normaliseEdits,place,move,turn,remove,copy,snap,snapYaw,validateEdits,drawCallCost,summary,createHistory,nextId} from '../dist/scene-edit.js';
const ok=r=>{assert(r.ok,r.error);return r.edits};
const known=id=>{try{propInfo(id);return true}catch{return false}};
const ctx={knownProps:['crate','barrel'],knownKeys:['tree-1','lamp-2'],bounds:MAP.playable,caps:YARD_CAPS};

{ // empty and normalise
 assert.deepEqual(emptyEdits(),{version:1,added:[],moved:{},removed:[]});
 assert.notEqual(emptyEdits(),emptyEdits());
 const n=normaliseEdits({version:9,junk:1,added:[{id:'e-0002',prop:'crate',x:1.234,z:-2.236,yaw:.123456,extra:5},{id:'e-0001',prop:'barrel',x:0,z:0,yaw:0}],moved:{b:{x:1.006,z:2,yaw:1,q:1},a:{x:0,z:0,yaw:0}},removed:['z','a','z']});
 assert.equal(n.version,1);assert.deepEqual(n.added.map(a=>a.id),['e-0001','e-0002']);
 assert.deepEqual(n.added[1],{id:'e-0002',prop:'crate',x:1.23,z:-2.24,yaw:.1235});
 assert.deepEqual(Object.keys(n.moved),['a','b']);assert.deepEqual(n.moved.b,{x:1.01,z:2,yaw:1});assert.deepEqual(n.removed,['a','z']);
 assert.deepEqual(normaliseEdits(null),emptyEdits());
 // stable: the same content in any order gives the same JSON, and normalising twice changes nothing
 const flip={removed:['a','z'],moved:{a:{yaw:0,z:0,x:0},b:{yaw:1,z:2,x:1.006}},added:[n.added[1],n.added[0]]};
 assert.equal(JSON.stringify(normaliseEdits(flip)),JSON.stringify(normaliseEdits(n)));assert.equal(JSON.stringify(normaliseEdits(n)),JSON.stringify(n));
 assert(Object.is(normaliseEdits({added:[{id:'e-0001',prop:'a',x:-0.001,z:0,yaw:0}]}).added[0].x,0),'no negative zero');
}
{ // snap
 assert.equal(snap(1.26),1.5);assert.equal(snap(1.2),1);assert.equal(snap(-0.2),0);assert.equal(snap(1.3,.25),1.25);assert.equal(snap(7,5),5);
 assert(Math.abs(snapYaw(.3)-15*Math.PI/180)<1e-12);assert.equal(snapYaw(.05),0);assert(Math.abs(snapYaw(1.6,90)-Math.PI/2)<1e-12);
}
{ // nextId
 assert.equal(nextId(emptyEdits()),'e-0001');
 assert.equal(nextId({added:[{id:'e-0007'},{id:'e-0003'},{id:'odd'}]}),'e-0008');
}
{ // place
 let e=ok(place(emptyEdits(),{prop:'crate',x:1,z:2,yaw:.5}));assert.deepEqual(e.added,[{id:'e-0001',prop:'crate',x:1,z:2,yaw:.5}]);
 const r=place(e,{prop:'barrel',x:3,z:4});assert.equal(r.id,'e-0002');assert.equal(r.edits.added[1].yaw,0);assert.equal(e.added.length,1,'input not changed');
 assert.equal(place(e,{x:1,z:1}).ok,false);assert.equal(place(e,{prop:'crate',x:NaN,z:1}).ok,false);assert.equal(place(e,{prop:'crate',x:1,z:1,yaw:Infinity}).ok,false);assert.equal(place(e,null).ok,false);
}
{ // move
 let e=ok(place(emptyEdits(),{prop:'crate',x:1,z:2,yaw:.5}));
 e=ok(move(e,{id:'e-0001',x:5,z:6}));assert.deepEqual(e.added[0],{id:'e-0001',prop:'crate',x:5,z:6,yaw:.5});
 e=ok(move(e,{id:'e-0001',x:5,z:6,yaw:1}));assert.equal(e.added[0].yaw,1);
 assert.equal(move(e,{id:'e-9999',x:0,z:0}).ok,false);assert.equal(move(e,{id:'e-0001',x:NaN,z:0}).ok,false);assert.equal(move(e,{x:0,z:0}).ok,false);
 const m=ok(move(emptyEdits(),{key:'tree-1',x:10.004,z:-3,yaw:.2}));assert.deepEqual(m.moved,{'tree-1':{x:10,z:-3,yaw:.2}});assert.deepEqual(m.added,[]);
 assert.deepEqual(ok(move(m,{key:'tree-1',x:1,z:1})).moved['tree-1'],{x:1,z:1,yaw:.2},'keeps its turn');
}
{ // turn
 let e=ok(place(emptyEdits(),{prop:'crate',x:1,z:2}));e=ok(turn(e,{id:'e-0001',yaw:1.5}));assert.deepEqual(e.added[0],{id:'e-0001',prop:'crate',x:1,z:2,yaw:1.5});
 assert.equal(turn(e,{id:'e-0001',yaw:NaN}).ok,false);assert.equal(turn(e,{id:'nope',yaw:1}).ok,false);
 assert.equal(turn(emptyEdits(),{key:'lamp-2',yaw:1}).ok,false,'a map prop never moved needs its position');
 assert.deepEqual(ok(turn(emptyEdits(),{key:'lamp-2',x:4,z:5,yaw:1})).moved['lamp-2'],{x:4,z:5,yaw:1});
 const m=ok(move(emptyEdits(),{key:'lamp-2',x:4,z:5}));assert.deepEqual(ok(turn(m,{key:'lamp-2',yaw:2})).moved['lamp-2'],{x:4,z:5,yaw:2});
}
{ // remove
 let e=ok(place(emptyEdits(),{prop:'crate',x:1,z:2}));e=ok(remove(e,{id:'e-0001'}));assert.deepEqual(e,emptyEdits(),'placed prop is deleted from added');
 assert.equal(remove(e,{id:'e-0001'}).ok,false);
 let m=ok(move(emptyEdits(),{key:'tree-1',x:1,z:1}));m=ok(remove(m,{key:'tree-1'}));assert.deepEqual(m,{version:1,added:[],moved:{},removed:['tree-1']},'named prop: key added to removed, move dropped');
 assert.equal(remove(m,{key:'tree-1'}).ok,false);assert.equal(move(m,{key:'tree-1',x:0,z:0}).ok,false);assert.equal(remove(m,{}).ok,false);
}
{ // copy
 let e=ok(place(emptyEdits(),{prop:'crate',x:1,z:2,yaw:.5}));const c=copy(e,{id:'e-0001',x:3,z:3});assert(c.ok);
 assert.deepEqual(c.edits.added[1],{id:'e-0002',prop:'crate',x:3,z:3,yaw:.5});assert.equal(c.id,'e-0002');assert.equal(copy(e,{id:'x',x:0,z:0}).ok,false);
 assert.equal(copy(emptyEdits(),{key:'tree-1',x:0,z:0}).ok,false,'a named prop needs its model');
 assert.equal(ok(copy(emptyEdits(),{key:'tree-1',prop:'barrel',x:2,z:2})).added[0].prop,'barrel');
 assert.equal(copy(e,{id:'e-0001',x:NaN,z:0}).ok,false);
}
{ // validateEdits
 const v=(e,c=ctx)=>validateEdits(normaliseEdits(e),c);
 assert.deepEqual(v(emptyEdits()),[]);
 assert.deepEqual(v({added:[{id:'e-0001',prop:'crate',x:0,z:0,yaw:0}],moved:{'tree-1':{x:1,z:1,yaw:0}},removed:['lamp-2']}),[]);
 assert.match(v({added:[{id:'e-0001',prop:'ufo',x:0,z:0,yaw:0}]})[0],/unknown prop/);
 assert.match(v({moved:{ghost:{x:0,z:0,yaw:0}}})[0],/not a known map prop/);
 assert.match(v({removed:['ghost']})[0],/not a known map prop/);
 assert.match(v({added:[{id:'e-0001',prop:'crate',x:999,z:0,yaw:0}]})[0],/outside the playable area/);
 assert.match(v({added:[{id:'e-0001',prop:'crate',x:0,z:-381,yaw:0}]})[0],/outside the playable area/);
 assert.match(v({moved:{'tree-1':{x:0,z:500,yaw:0}}})[0],/outside the playable area/);
 assert.match(v({added:[{id:'e-0001',prop:'crate',x:NaN,z:0,yaw:0}]})[0],/not finite/);
 assert.match(v({added:[{id:'e-0001',prop:'crate',x:0,z:0,yaw:Infinity}]})[0],/not finite/);
 assert.match(v({moved:{'tree-1':{x:NaN,z:0,yaw:0}}})[0],/not finite/);
 assert.match(v({added:[{id:'e-0001',prop:'crate',x:0,z:0,yaw:0},{id:'e-0001',prop:'barrel',x:1,z:1,yaw:0}]})[0],/more than once/);
 const many=(n,prop='crate',s=0)=>Array.from({length:n},(_,i)=>({id:'e-'+String(s+i+1).padStart(4,'0'),prop,x:0,z:0,yaw:0}));
 assert.deepEqual(v({added:many(32)}),[]);assert.match(v({added:many(33)})[0],/Too many of one model/);
 const mix=[...many(32,'crate'),...many(32,'barrel',32)];assert.deepEqual(v({added:mix}),[]);
 const ctx2={...ctx,knownProps:p=>/^p\d+$/.test(p)};const spread=Array.from({length:161},(_,i)=>({id:'e-'+String(i+1).padStart(4,'0'),prop:'p'+(i%10),x:0,z:0,yaw:0}));
 assert(v({added:spread},ctx2).some(m=>/Too many props in all/.test(m)));assert.deepEqual(v({added:spread.slice(0,160)},ctx2),[]);
 assert.equal(validateEdits(normaliseEdits({added:[{id:'e-0001',prop:'ufo',x:9999,z:0,yaw:0}]}),{}).length,0,'checks only what it is given');
 assert.deepEqual(validateEdits(emptyEdits(),{knownProps:new Set(['a']),knownKeys:new Set(['b']),bounds:MAP.playable,caps:YARD_CAPS}),[]);
}
{ // drawCallCost
 const e=normaliseEdits({added:[{id:'e-0001',prop:'a',x:0,z:0,yaw:0},{id:'e-0002',prop:'a',x:0,z:0,yaw:0},{id:'e-0003',prop:'b',x:0,z:0,yaw:0},{id:'e-0004',prop:'c',x:0,z:0,yaw:0}]});
 assert.equal(drawCallCost(e,[]),3);assert.equal(drawCallCost(e,['a']),2);assert.equal(drawCallCost(e,new Set(['a','b','c'])),0);assert.equal(drawCallCost(emptyEdits(),[]),0);assert.equal(drawCallCost(e),3);
}
{ // summary
 let e=ok(place(emptyEdits(),{prop:'a',x:0,z:0}));e=ok(place(e,{prop:'a',x:1,z:1}));e=ok(place(e,{prop:'a',x:2,z:2}));
 e=ok(move(e,{key:'k1',x:1,z:1}));e=ok(move(e,{key:'k2',x:1,z:1}));e=ok(remove(e,{key:'k3'}));
 assert.deepEqual(summary(e,emptyEdits()),{added:3,moved:2,removed:1});assert.deepEqual(summary(e),{added:3,moved:2,removed:1});
 assert.deepEqual(summary(e,e),{added:0,moved:0,removed:0});
 const b=ok(place(emptyEdits(),{prop:'a',x:0,z:0}));assert.deepEqual(summary(e,b),{added:2,moved:2,removed:1});
 const b2=ok(move(emptyEdits(),{key:'k1',x:1,z:1}));assert.equal(summary(e,b2).moved,1,'unchanged moves do not count');
}
{ // history
 const h=createHistory(),a=ok(place(emptyEdits(),{prop:'a',x:0,z:0})),b=ok(place(a,{prop:'a',x:1,z:1}));
 assert(!h.canUndo()&&!h.canRedo());assert.equal(h.undo(),null);assert.equal(h.redo(),null);
 h.push(a);h.push(b);assert(h.canUndo()&&!h.canRedo());
 assert.equal(h.undo(),a);assert(h.canRedo());assert.equal(h.undo().added.length,0);assert(!h.canUndo());
 assert.equal(h.redo(),a);assert.equal(h.redo(),b);assert.equal(h.redo(),null);
 h.undo();h.push(a);assert(!h.canRedo(),'a new push drops redo');assert.equal(h.current(),a);
 const g=createHistory();for(let i=0;i<150;i++)g.push({n:i});assert.equal(g.size(),100,'capped at 100');
 let n=0;while(g.canUndo()){g.undo();n++}assert.equal(n,99);assert.equal(g.current().n,50,'oldest entries dropped');
}
{ // the shipped overlay file
 assert.deepEqual(SCENE_EDITS,emptyEdits());assert.deepEqual(normaliseEdits(SCENE_EDITS),SCENE_EDITS);
 assert.deepEqual(validateEdits(SCENE_EDITS,{knownProps:known,bounds:MAP.playable,caps:YARD_CAPS}),[]);
 assert.equal(known('definitely-not-a-prop'),false);
}
console.log('scene-edit ok');
