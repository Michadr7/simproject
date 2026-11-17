// Ground cover job and view (audit C): coverJob stepped one kind at a time equals coverFor; the view's update() builds a chunk over several calls, builds each chunk once, does not re-place an empty chunk every check, survives setTier or a chunk going and coming back mid-job, and cancels a job for a chunk the player teleported away from.
import assert from 'node:assert/strict';
import {coverFor,coverJob,SURF} from '../dist/ground-cover-rules.js';
// 1. the stepped job is the same placement as coverFor
for(const tier of ['low','high'])for(const [i,j] of [[0,0],[3,-2]]){const s={surfaceAt:(x,z)=>((Math.floor(x/7)+Math.floor(z/5))%4)+1},job=coverJob(i,j,4242,s,{tier});let steps=0;while(!job.done){job.step();steps++}assert.ok(steps>=1&&(tier!=='high'||steps>1),'one step per kind');assert.deepEqual(job.result(),coverFor(i,j,4242,s,{tier}))}
// 2. the view with a tiny fake THREE
globalThis.Image=class{set src(v){}};
class Obj{constructor(){this.children=[];this.parent=null}add(c){c.parent=this;this.children.push(c)}removeFromParent(){if(this.parent){this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null}}}
class Geo{constructor(){this.attrs={}}setAttribute(k,v){this.attrs[k]=v}setIndex(){}clone(){return new Geo()}dispose(){}}
const THREE={Vector4:class{constructor(...a){this.a=a}set(){}},Vector3:class{},Sphere:class{},Texture:class{},SRGBColorSpace:1,LinearMipmapLinearFilter:1,LinearFilter:1,ClampToEdgeWrapping:1,DoubleSide:2,ShaderChunk:{normal_fragment_begin:''},
 MeshStandardMaterial:class{constructor(){this.userData={}}},BufferGeometry:Geo,BufferAttribute:class{constructor(a){this.array=a}},InstancedBufferAttribute:class{constructor(a){this.array=a}},
 InstancedMesh:class extends Obj{constructor(g,m,n){super();this.geometry=g;this.instanceMatrix={array:new Float32Array(n*16)}}dispose(){}},Group:Obj};
const {createCoverView}=await import('../dist/ground-cover-view.js');const A=await import('../dist/cover-assets.js');
const road=()=>SURF.ROAD,grass=()=>SURF.GRASS,B=(i,j)=>({x0:i*100,z0:j*100,x1:i*100+100,z1:j*100+100});
function make(chunks,tier='high'){const v=createCoverView({THREE,heightAt:()=>0,seed:1,rects:[],tier});v.setAssets({atlas:A.COVER_ATLAS,models:A.COVER_MODELS});for(const c of chunks)v.onChunk({key:c.key,i:c.i,j:c.j,bounds:B(c.i,c.j)},{surfaceAt:c.surf,biomeAt:()=>'open'});return v}
const frames=(v,parent,n,x=50,z=50,ev={})=>{for(let f=0;f<n;f++){if(ev[f])ev[f]();v.update(x,z,1/60,parent)}};
{const v=make([{key:'0:0',i:0,j:0,surf:grass}]),p=new Obj();v.update(50,50,1/60,p);v.update(50,50,1/60,p);assert.equal(v.stats().builtChunks,0,'a chunk is not built in two calls');frames(v,p,120);assert.equal(v.stats().builtChunks,1,'built after a few calls');assert.equal(p.children.length,1);assert.ok(v.stats().maxFrameMs>0,'maxFrameMs is measured')}
{const v=make([{key:'0:0',i:0,j:0,surf:road},{key:'1:0',i:1,j:0,surf:grass}]),p=new Obj();frames(v,p,200);const t=v.stats().placeMsTotal;frames(v,p,200);assert.equal(v.stats().placeMsTotal,t,'a chunk that placed nothing is not placed again');assert.equal(p.children.length,1,'only the grass chunk has meshes')}
{const v=make([{key:'0:0',i:0,j:0,surf:grass}]),p=new Obj();frames(v,p,200,50,50,{3:()=>v.setTier('low'),5:()=>v.setTier('high')});assert.equal(v.stats().builtChunks,1,'setTier mid job: rebuilt once');assert.equal(p.children.length,1,'no stale group left')}
{const v=make([{key:'0:0',i:0,j:0,surf:grass}]),p=new Obj();frames(v,p,200,50,50,{3:()=>v.onChunkGone('0:0'),4:()=>v.onChunk({key:'0:0',i:0,j:0,bounds:B(0,0)},{surfaceAt:grass,biomeAt:()=>'open'})});assert.equal(v.stats().builtChunks,1,'gone and back mid job: built once');assert.equal(p.children.length,1)}
{const v=make([{key:'0:0',i:0,j:0,surf:grass},{key:'9:0',i:9,j:0,surf:grass}]),p=new Obj();frames(v,p,6);frames(v,p,200,950,50);assert.equal(v.stats().builtChunks,1,'after a teleport only the near chunk is built');assert.ok(p.children.every(c=>c.name==='cover-9:0'),'the old chunk is gone: '+p.children.map(c=>c.name))}
console.log('PASS cover-view-job: stepped job = coverFor, staged build, empty chunk once, setTier / gone-and-back / teleport mid job');