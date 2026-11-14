const fs=require('fs');
const f=process.argv[2];
const b=fs.readFileSync(f);const len=b.readUInt32LE(12);const j=JSON.parse(b.slice(20,20+len).toString('utf8'));
const acc=j.accessors||[],nodes=j.nodes||[];
console.log('bytes',b.length,'nodes',nodes.length,'meshes',(j.meshes||[]).length,'materials',(j.materials||[]).length,'images',(j.images||[]).length,'skins',(j.skins||[]).length,'animations',(j.animations||[]).length,'cameras',(j.cameras||[]).length,'ext',j.extensionsUsed,'extReq',j.extensionsRequired);
if(j.animations)console.log('animations',j.animations.map(a=>a.name+' ch'+a.channels.length).join(' | '));
const triOf=m=>{let t=0;for(const p of m.primitives){const n=p.indices!==undefined?acc[p.indices].count:acc[p.attributes.POSITION].count;t+=n/3}return t};
const sub=(i,agg)=>{const n=nodes[i];if(n.mesh!==undefined){const m=j.meshes[n.mesh];agg.tris+=triOf(m);agg.meshes++;for(const p of m.primitives){agg.prims++;if(p.material!==undefined)agg.mats.add(j.materials[p.material].name)}}else if(!n.children||!n.children.length)agg.empties.push(n.name);else agg.groups++;for(const c of n.children||[])sub(c,agg)};
const scene=j.scenes[j.scene||0];let total=0;
const rows=[];
for(const r of scene.nodes){const a={tris:0,meshes:0,prims:0,mats:new Set(),empties:[],groups:0};sub(r,a);total+=a.tris;rows.push([nodes[r].name,nodes[r].translation?nodes[r].translation.map(x=>+x.toFixed(2)).join(','):'',a.tris,a.meshes,a.prims,a.mats.size,a.empties.length,(a.empties.slice(0,6).join(' '))])}
console.log('roots',scene.nodes.length,'total tris',total);
for(const r of rows)console.log(r.join(' | '));
const camNodes=nodes.filter(n=>n.camera!==undefined).map(n=>n.name);if(camNodes.length)console.log('camera nodes',camNodes.join(','));
const dup=nodes.map(n=>n.name).filter(n=>/\.\d{3}$/.test(n));console.log('suffixed names',dup.length,dup.slice(0,12).join(' '));