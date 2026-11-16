// Takes the wheels out of a converted prop record (dist/props-assets.js) so the game can spin and steer them: every wheel becomes its own small mesh centred on its axle (record.wheels), and the body keeps
// the rest. Works on the finished record (positions, byte normals, colours or uvs, 16-bit indices), so it can also be run on a record whose source model is no longer around (the old pickup).
// A wheel is a tyre island (triangles joined by shared vertices) that is round, thin along x and stands on the ground, plus every smaller island lying inside its box (hub caps, rims, brake discs).
// Returns the fields to merge into the record: {pos, nor, idx, vertices, col|uv, norQ, wheels, bodyTriangles}; throws unless exactly four wheels are found.
const dec=(text,Type)=>{const b=Buffer.from(text,'base64');return new Type(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength))};
const enc=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64');
export function splitWheels(record,{minTyreTris=100,id='record'}={}){
 const P=dec(record.pos,Float32Array),N=record.norQ?dec(record.nor,Int8Array):null,I=dec(record.idx,Uint16Array);
 if(!N)throw new Error(id+': wheel splitting needs byte normals');
 const textured=!!record.uv,A=textured?dec(record.uv,Float32Array):dec(record.col,Uint8Array),stride=textured?2:3;
 // islands by shared position (a colour or texture seam does not cut a wheel in two)
 const key=v=>`${Math.round(P[v*3]*100)},${Math.round(P[v*3+1]*100)},${Math.round(P[v*3+2]*100)}`,ids=new Map(),par=[],find=a=>{while(par[a]!==a){par[a]=par[par[a]];a=par[a]}return a},idOf=v=>{const k=key(v);if(!ids.has(k)){ids.set(k,par.length);par.push(par.length)}return ids.get(k)};
 const triNode=[];for(let t=0;t<I.length;t+=3){const a=idOf(I[t]),b=idOf(I[t+1]),c=idOf(I[t+2]);par[find(a)]=find(b);par[find(b)]=find(c);triNode.push(a)}
 const isl=new Map();for(let t=0;t<triNode.length;t++){const r=find(triNode[t]);if(!isl.has(r))isl.set(r,{tris:[],lo:[1e9,1e9,1e9],hi:[-1e9,-1e9,-1e9]});const e=isl.get(r);e.tris.push(t);for(let k=0;k<3;k++)for(let d=0;d<3;d++){const v=P[I[t*3+k]*3+d];e.lo[d]=Math.min(e.lo[d],v);e.hi[d]=Math.max(e.hi[d],v)}}
 const all=[...isl.values()],tyres=all.filter(e=>{const dx=e.hi[0]-e.lo[0],dy=e.hi[1]-e.lo[1],dz=e.hi[2]-e.lo[2];return e.tris.length>=minTyreTris&&Math.abs(dy-dz)<=.12*Math.max(dy,dz)&&dx<.65*dy&&dy>.5&&dy<1.4&&e.lo[1]<.08});
 if(tyres.length!==4)throw new Error(`${id}: expected four wheels, found ${tyres.length}`);
 const inside=(e,w,m)=>[0,1,2].every(d=>e.lo[d]>=w.lo[d]-m&&e.hi[d]<=w.hi[d]+m);
 for(const e of all){if(tyres.includes(e)||e.tris.length>=200)continue;const owner=tyres.find(w=>inside(e,w,.03));if(owner){owner.tris=owner.tris.concat(e.tris);e.taken=true}}
 const taken=new Set(tyres.flatMap(e=>e.tris));
 const subset=tris=>{const map=new Map(),pp=[],nn=[],aa=[],ii=[];for(const t of tris)for(let k=0;k<3;k++){const o=I[t*3+k];if(!map.has(o)){map.set(o,map.size);pp.push(P[o*3],P[o*3+1],P[o*3+2]);nn.push(N[o*3],N[o*3+1],N[o*3+2]);for(let c=0;c<stride;c++)aa.push(A[o*stride+c])}ii.push(map.get(o))}return {pp,nn,aa,ii,count:map.size}};
 const pack=s=>({pos:enc(Float32Array.from(s.pp)),nor:enc(Int8Array.from(s.nn)),idx:enc(Uint16Array.from(s.ii)),norQ:true,vertices:s.count,...(textured?{uv:enc(Float32Array.from(s.aa))}:{col:enc(Uint8Array.from(s.aa))})});
 const body=subset([...Array(I.length/3).keys()].filter(t=>!taken.has(t)));
 let zLo=1e9,zHi=-1e9;for(let i=2;i<P.length;i+=3){zLo=Math.min(zLo,P[i]);zHi=Math.max(zHi,P[i])}const zMid=(zLo+zHi)/2;
 const wheels=tyres.map(e=>{const at=[0,1,2].map(d=>+((e.lo[d]+e.hi[d])/2).toFixed(4)),s=subset(e.tris);for(let k=0;k<s.pp.length;k+=3)for(let d=0;d<3;d++)s.pp[k+d]-=at[d];
  return {at,radius:+((e.hi[1]-e.lo[1])/2).toFixed(3),width:+(e.hi[0]-e.lo[0]).toFixed(3),front:at[2]>zMid,triangles:e.tris.length,...pack(s)}}).sort((a,b)=>b.at[2]-a.at[2]||b.at[0]-a.at[0]);
 return {...pack(body),wheels,bodyTriangles:body.ii.length/3};
}

// The same result for a model whose wheels are NAMED nodes (the farm tractors, notes/farm-vehicle-contract.md): build-props with spec.nodes writes record.parts (body first, then one index run per wheel_XX / steer_XX / steering_wheel node) and
// record.nodes (their pivots). Each wheel_FL/FR/RL/RR run becomes its own mesh centred on its hub node; everything else (steering wheel, steer pivots' own parts) stays in the body. record.parts is dropped (its runs no longer match), record.nodes kept.
export function splitWheelsByParts(record,{id='record'}={}){
 const P=dec(record.pos,Float32Array),N=dec(record.nor,Int8Array),I=dec(record.idx,Uint16Array),textured=!!record.uv,A=textured?dec(record.uv,Float32Array):dec(record.col,Uint8Array),stride=textured?2:3;
 const runs=(record.parts||[]).filter(p=>/^wheel_(FL|FR|RL|RR)$/.test(p.name));
 if(runs.length!==4)throw new Error(`${id}: expected four wheel_* parts, found ${runs.length}`);
 const subset=tris=>{const map=new Map(),pp=[],nn=[],aa=[],ii=[];for(const t of tris)for(let k=0;k<3;k++){const o=I[t*3+k];if(!map.has(o)){map.set(o,map.size);pp.push(P[o*3],P[o*3+1],P[o*3+2]);nn.push(N[o*3],N[o*3+1],N[o*3+2]);for(let c=0;c<stride;c++)aa.push(A[o*stride+c])}ii.push(map.get(o))}return {pp,nn,aa,ii,count:map.size}};
 const pack=s=>({pos:enc(Float32Array.from(s.pp)),nor:enc(Int8Array.from(s.nn)),idx:enc(Uint16Array.from(s.ii)),norQ:true,vertices:s.count,...(textured?{uv:enc(Float32Array.from(s.aa))}:{col:enc(Uint8Array.from(s.aa))})});
 const taken=new Set(),wheelTris=run=>{const out=[];for(let q=run.from;q<run.from+run.count;q+=3)out.push(q/3);return out};
 const wheels=runs.map(run=>{const tris=wheelTris(run);tris.forEach(t=>taken.add(t));const hub=record.nodes?.[run.name];if(!hub)throw new Error(`${id}: no pivot for ${run.name}`);
  const lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(const t of tris)for(let k=0;k<3;k++)for(let d=0;d<3;d++){const v=P[I[t*3+k]*3+d];lo[d]=Math.min(lo[d],v);hi[d]=Math.max(hi[d],v)}
  const s=subset(tris);for(let k=0;k<s.pp.length;k+=3)for(let d=0;d<3;d++)s.pp[k+d]-=hub[d];
  return {at:hub.map(v=>+v.toFixed(4)),radius:+((hi[1]-lo[1])/2).toFixed(3),width:+(hi[0]-lo[0]).toFixed(3),front:run.name[6]==='F',triangles:tris.length,...pack(s)}}).sort((a,b)=>b.at[2]-a.at[2]||b.at[0]-a.at[0]);
 const body=subset([...Array(I.length/3).keys()].filter(t=>!taken.has(t)));
 const {parts,...rest}=record;
 return {...pack(body),wheels,bodyTriangles:body.ii.length/3};
}
