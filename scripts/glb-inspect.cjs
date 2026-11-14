const fs=require('fs');
for(const f of process.argv.slice(2)){
 const b=fs.readFileSync(f);const len=b.readUInt32LE(12);const j=JSON.parse(b.slice(20,20+len).toString('utf8'));
 console.log('==',f.split('\\').pop(),'bytes',b.length,'gen',j.asset&&j.asset.generator);
 const acc=j.accessors||[];let tri=0;
 (j.meshes||[]).forEach((m,i)=>{let t=0;for(const p of m.primitives){const n=p.indices!==undefined?acc[p.indices].count:acc[p.attributes.POSITION].count;t+=n/3}tri+=t;console.log(' mesh',i,m.name,'tris',t,'materials',m.primitives.map(p=>j.materials[p.material]&&j.materials[p.material].name))});
 console.log(' total tris',tri,'materials',(j.materials||[]).map(m=>m.name+' '+JSON.stringify(m.pbrMetallicRoughness&&m.pbrMetallicRoughness.baseColorFactor&&m.pbrMetallicRoughness.baseColorFactor.map(x=>+x.toFixed(2)))));
 console.log(' images',(j.images||[]).length,'extensionsUsed',j.extensionsUsed);
 console.log(' nodes',(j.nodes||[]).map(n=>n.name+(n.mesh!==undefined?'':' (empty)')+(n.translation?' t'+JSON.stringify(n.translation.map(x=>+x.toFixed(3))):'')+(n.rotation?' r'+JSON.stringify(n.rotation.map(x=>+x.toFixed(2))):'')+(n.scale?' s'+JSON.stringify(n.scale):'')).join(' | '));
 let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];
 for(const m of j.meshes||[])for(const p of m.primitives){const a=acc[p.attributes.POSITION];if(a.min){for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],a.min[k]);mx[k]=Math.max(mx[k],a.max[k])}}}
 console.log(' local bbox min',mn.map(x=>+x.toFixed(3)),'max',mx.map(x=>+x.toFixed(3)),'size',mx.map((x,k)=>+(x-mn[k]).toFixed(3)));
}