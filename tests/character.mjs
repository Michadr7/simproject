import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {defaults,palettes,OUTFITS,normalizeAppearance,saveAppearance,loadAppearance,outfit,SAVE_KEY} from '../dist/appearance.js';
import {createCharacter,loadCharacterAssets,characterAssetsReady,MODEL_SCALE} from '../dist/character.js';

// ── Saves ─────────────────────────────────────────────────────────────────────
let raw=null;const storage={getItem:()=>raw,setItem:(key,value)=>{assert.equal(key,SAVE_KEY);raw=value}};
const chosen={...outfit('female','Formal',{name:'Alex',skin:'#79513c',hair:'#bca06a'}),feet:'Worker'};
assert(saveAppearance(storage,chosen));assert.equal(JSON.parse(raw).version,2);assert.deepEqual(loadAppearance(storage),chosen);
raw='{';assert.equal(loadAppearance(storage),null);
raw=JSON.stringify({version:99,appearance:chosen});assert.equal(loadAppearance(storage),null);
assert.equal(loadAppearance({getItem(){throw Error('blocked')}}),null);assert.equal(saveAppearance({setItem(){throw Error('quota')}},chosen),false);
// A version 1 save from the old hand-built character keeps its name and colours and gets the default look.
raw=JSON.stringify({version:1,appearance:{name:'Old',skin:'#a67350',hair:'#292b2b',shirt:'#66869b',trousers:'#303235',style:'Bob'}});
assert.deepEqual(loadAppearance(storage),{...defaults,name:'Old',skin:'#a67350',hair:'#292b2b'});
assert.equal(normalizeAppearance({skin:'invalid',name:' \u0000Alex '}).skin,defaults.skin);assert.equal(normalizeAppearance({name:' \u0000Alex '}).name,'Alex');
// Parts must belong to the chosen body type.
assert.equal(normalizeAppearance({body:'female',head:'Farmer'}).head,'Casual');assert.equal(normalizeAppearance({body:'alien'}).body,'male');
assert.equal(normalizeAppearance({body:'male',top:'Suit',legs:'Beach'}).legs,'Beach');
// Placeholder until the models are decoded; the game and every test that needs real bodies wait for them.
assert(!characterAssetsReady());const stand=createCharacter(defaults);assert(stand.fallback);stand.update(.1);stand.setMotion(3);stand.reach('R',new T.Vector3(),1);

await loadCharacterAssets();assert(characterAssetsReady());
// ── Models ────────────────────────────────────────────────────────────────────
const heightOf=c=>{const box=new T.Box3();c.group.updateMatrixWorld(true);for(const m of c.meshes){m.skeleton.update();m.computeBoundingBox();box.union(m.boundingBox.clone().applyMatrix4(m.matrixWorld))}return box.getSize(new T.Vector3())};
for(const body of ['male','female'])for(const [id] of OUTFITS[body]){
 const c=createCharacter(outfit(body,id));assert(!c.fallback);c.update(.05);
 assert.deepEqual([...new Set(c.meshes.map(m=>m.name.split('__')[1]))].sort(),['Body','Feet','Head','Legs'],`${body} ${id} has all four parts`);
 const size=heightOf(c);assert(size.y>1.7&&size.y<2.15,`${body} ${id} height ${size.y}`);assert(size.x<1,'arms hang down in the idle pose');
 let triangles=0;for(const m of c.meshes)triangles+=m.geometry.index.count/3;assert(triangles<8000,`${body} ${id} ${triangles} triangles`);
}
// A new character is never seen in the rig's T-pose, even before its first update.
for(const body of ['male','female']){const fresh=createCharacter(outfit(body,OUTFITS[body][0][0]));fresh.group.updateMatrixWorld(true);const w=new T.Vector3();fresh.bone('WristR').getWorldPosition(w);assert(Math.abs(fresh.group.worldToLocal(w).x)<.4,body+' arms hang down immediately')}
// Parts mix freely within a body type and swap in place; the other body type is a different rig.
const a=createCharacter(outfit('male','Casual_Hoodie')),b=createCharacter(outfit('male','Casual_Hoodie'));
a.apply({...outfit('male','Casual_Hoodie'),head:'Farmer',legs:'Suit',feet:'Beach'});
assert(a.meshes.some(m=>m.name==='Farmer__Head')&&a.meshes.some(m=>m.name==='Suit__Legs')&&a.meshes.some(m=>m.name==='Beach__Feet')&&!a.meshes.some(m=>m.name==='Casual_Hoodie__Head'));
assert(b.meshes.some(m=>m.name==='Casual_Hoodie__Head'),'other characters are unaffected');
const bonesBefore=a.bone('Head');a.apply(outfit('female','Casual'));assert.notEqual(a.bone('Head'),bonesBefore);assert(a.meshes.every(m=>/^Casual__/.test(m.name)),'female parts after switching body');
// Skin and hair colours apply only to the role-tagged materials and never leak between characters.
const roleColors=(c,role)=>c.meshes.flatMap(m=>[].concat(m.material)).filter(x=>x.userData.role===role).map(x=>x.color.getHexString());
const pale=createCharacter({...outfit('male','Suit'),skin:'#edc9ae',hair:'#a8aaa5'}),dark=createCharacter({...outfit('male','Suit'),skin:'#4b332b',hair:'#292b2b'});
assert(roleColors(pale,'skin').length>0&&roleColors(pale,'skin').every(h=>h==='edc9ae'));assert(roleColors(dark,'skin').every(h=>h==='4b332b'));
assert(roleColors(pale,'hair').some(h=>h==='a8aaa5')&&roleColors(dark,'hair').some(h=>h==='292b2b'));
pale.apply({...outfit('male','Suit'),skin:'#d9ae8d'});assert(roleColors(pale,'skin').every(h=>h==='d9ae8d')&&roleColors(dark,'skin').every(h=>h==='4b332b'));
// Clothes keep the pack's own colours.
const vest=createCharacter(outfit('male','Worker')).meshes.flatMap(m=>[].concat(m.material)).find(x=>x.name==='Worker_Vest');assert(vest&&vest.color.r>vest.color.b*2,'orange hi-vis vest, not darkened');
// ── Motion ────────────────────────────────────────────────────────────────────
const m=createCharacter(outfit('male','Casual_Hoodie'));
assert.equal(m.motion,'Idle_Neutral');m.setMotion(1);assert.equal(m.motion,'Walk');m.setMotion(4.5);assert.equal(m.motion,'Run');m.setMotion(8.2);assert.equal(m.motion,'Sprint','Shift-running uses the pack run');m.setMotion(4.5);m.setMotion(0);assert.equal(m.motion,'Idle_Neutral');
const pose=()=>m.bone('UpperLegR').quaternion.toArray();
m.setMotion(4.5);const frames=new Set();for(let i=0;i<20;i++){m.update(.05);frames.add(pose().map(v=>v.toFixed(2)).join())}assert(frames.size>5,'legs actually cycle');
// No thigh swings out sideways at any point of the walk or run (the pack's baked leg rotations did in the Run clip).
for(const body of ['male','female'])for(const speed of [1.4,4.5,8.2]){
 const g=createCharacter(outfit(body,OUTFITS[body][0][0]));g.setMotion(speed);g.update(.5);let widest=0,lowest=9;
 for(let i=0;i<40;i++){g.update(.03);g.group.updateMatrixWorld(true);for(const side of ['R','L']){const hip=new T.Vector3(),knee=new T.Vector3(),foot=new T.Vector3();g.bone('UpperLeg'+side).getWorldPosition(hip);g.bone('LowerLeg'+side).getWorldPosition(knee);g.bone('Foot'+side).getWorldPosition(foot);
  widest=Math.max(widest,Math.abs(knee.x-hip.x));lowest=Math.min(lowest,foot.y)}}
 assert(widest<.3,`${body} at ${speed}: thigh swings ${widest.toFixed(2)} m sideways`);assert(lowest>-.15,'feet stay at or above the ground');
}
// Hands: open and relaxed while walking and jogging (the idle finger pose); fists only in a sprint.
for(const body of ['male','female']){
 const curl=speed=>{const h=createCharacter(outfit(body,OUTFITS[body][0][0]));h.setMotion(speed);h.update(.5);const idle=createCharacter(outfit(body,OUTFITS[body][0][0]));idle.update(.5);
  return ['Index2R','Middle2L','Ring3R','Thumb2L'].reduce((worst,name)=>Math.max(worst,h.bone(name).quaternion.angleTo(idle.bone(name).quaternion)),0)};
 assert(curl(1.4)<.05,`${body}: relaxed hands walking`);assert(curl(4.5)<.05,`${body}: relaxed hands jogging`);assert(curl(8.2)>.5,`${body}: fists while sprinting (${curl(8.2).toFixed(2)} rad)`);
}
// Walkers swing hanging arms against the stride: each wrist moves opposite the foot on its own side, smoothly, and the hands stay low.
for(const body of ['male','female'])for(const speed of [1.4,2.2,4.5]){
 const w=createCharacter(outfit(body,OUTFITS[body][0][0]));w.setMotion(speed);w.update(.5);const xs=[],ys=[],wrist=[],prevQ={R:null,L:null};let hanging=0,fastest=0;const frames=90;
 for(let i=0;i<frames;i++){w.update(.016);w.group.updateMatrixWorld(true);const pos=n=>{const v=new T.Vector3();w.bone(n).getWorldPosition(v);return w.group.worldToLocal(v)};
  xs.push(pos('FootL').z-pos('FootR').z);ys.push(pos('WristR').z-pos('WristL').z);if(pos('UpperArmR').y-pos('WristR').y>.3&&pos('UpperArmR').y-pos('WristL').y>.3)hanging++;
  for(const side of ['R','L']){const q=w.bone('Wrist'+side).getWorldQuaternion(new T.Quaternion());if(prevQ[side])fastest=Math.max(fastest,q.angleTo(prevQ[side])/.016);prevQ[side]=q}}
 const mean=a=>a.reduce((x,y)=>x+y,0)/a.length,mx=mean(xs),my=mean(ys),cov=xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0),corr=cov/Math.sqrt(xs.reduce((s,x)=>s+(x-mx)**2,0)*ys.reduce((s,y)=>s+(y-my)**2,0));
 assert(corr>.6,`${body} at ${speed}: the right wrist leads when the left foot leads (correlation ${corr.toFixed(2)})`);assert(hanging>frames*.9,`${body} at ${speed}: arms hang below the shoulders (${hanging}/${frames})`);
 assert(fastest<14,`${body} at ${speed}: the wrists turn smoothly (peak ${fastest.toFixed(1)} rad/s)`);
}
// An axe carried while walking or jogging does not make the arm or the axe spin.
for(const body of ['male','female'])for(const speed of [0,2.2,4.5]){
 const w=createCharacter(outfit(body,OUTFITS[body][0][0])),item=new T.Group();w.hold(item,{axis:'z',grip:.12});w.alignHeld(new T.Vector3(.7,.6,.15));w.reach('R',new T.Vector3(-.14,1.2,.3),1);w.setTwoHanded(1);w.setMotion(speed);for(let i=0;i<45;i++)w.update(.016); // let the walk/jog crossfade and the carry blend finish
 let prev=null,prevL=null,fastest=0,fastestL=0,fastestItem=0,prevItem=null;
 for(let i=0;i<120;i++){w.update(.016);w.group.updateMatrixWorld(true);const q=w.bone('LowerArmR').getWorldQuaternion(new T.Quaternion()),ql=w.bone('LowerArmL').getWorldQuaternion(new T.Quaternion()),qi=item.getWorldQuaternion(new T.Quaternion());if(prev)fastest=Math.max(fastest,q.angleTo(prev)/.016);if(prevL)fastestL=Math.max(fastestL,ql.angleTo(prevL)/.016);if(prevItem)fastestItem=Math.max(fastestItem,qi.angleTo(prevItem)/.016);prev=q;prevL=ql;prevItem=qi}
 assert(fastest<24,`${body} at ${speed}: carrying arm turns smoothly (peak ${fastest.toFixed(1)} rad/s)`);assert(fastestL<24,`${body} at ${speed}: the supporting arm turns smoothly (peak ${fastestL.toFixed(1)} rad/s)`);assert(fastestItem<2,`${body} at ${speed}: the carried tool holds steady (${fastestItem.toFixed(1)} rad/s)`);
}
m.update(0);const held=pose();m.update(0);assert.deepEqual(pose(),held,'paused (dt 0) holds the pose');
// ── Reach and held items ──────────────────────────────────────────────────────
const reachCheck=(c,side,target)=>{c.update(.016);c.group.updateMatrixWorld(true);const w=new T.Vector3();c.bone('Wrist'+side).getWorldPosition(w);return c.group.worldToLocal(w).distanceTo(target)};
for(const body of ['male','female']){
 const c=createCharacter(outfit(body,OUTFITS[body][0][0]));c.group.position.set(5,0,-3);c.group.rotation.y=1.3;
 c.update(.1);const rest=c.bone('LowerArmR').quaternion.clone();
 c.reach('R',c.mouth,1);assert(reachCheck(c,'R',c.mouth)<.03,`${body}: hand reaches the mouth (${reachCheck(c,'R',c.mouth)})`);
 const target=new T.Vector3(-.15,1.88,-.18);c.reach('R',target,1);assert(reachCheck(c,'R',target)<.05,`${body}: overhead reach ${reachCheck(c,'R',target)}`);
 c.reach('R',target,0);c.update(.016);assert(c.bone('LowerArmR').quaternion.angleTo(rest)<.2,'weight 0 returns to the animation pose');
 c.reach('R',new T.Vector3(0,5,5),1);c.update(.016);for(const n of ['UpperArmR','LowerArmR','WristR'])assert(c.bone(n).quaternion.toArray().every(Number.isFinite),'unreachable targets stay finite');
}
const h=createCharacter(outfit('female','Casual'));h.group.position.y=0;const cup=new T.Group();h.hold(cup,{upright:true});h.reach('R',h.mouth,1);h.setHeldTilt(0);h.update(.016);
assert.equal(cup.parent,h.hand);const up=new T.Vector3(0,1,0).applyQuaternion(cup.getWorldQuaternion(new T.Quaternion()));assert(up.y>.99,'upright items stay level while the arm moves');
h.setHeldTilt(.7);h.update(.016);assert(new T.Vector3(0,1,0).applyQuaternion(cup.getWorldQuaternion(new T.Quaternion())).y<.8,'tilted');
h.release();assert.equal(cup.parent,null);
const axe=new T.Group();h.hold(axe,{axis:'z'});h.reach('R',new T.Vector3(-.1,1.2,.5),1);h.update(.016);
const along=new T.Vector3(0,0,1).applyQuaternion(axe.getWorldQuaternion(new T.Quaternion())),fore=new T.Vector3(),elbow=new T.Vector3();h.bone('WristR').getWorldPosition(fore);h.bone('LowerArmR').getWorldPosition(elbow);
assert(along.dot(fore.sub(elbow).normalize())>.99,'tools point along the forearm');
// Seated: thighs forward.
const s=createCharacter(outfit('female','Casual'));s.setSeated(true);s.update(.05);s.group.updateMatrixWorld(true);
const knee=new T.Vector3(),hip=new T.Vector3();s.bone('LowerLegR').getWorldPosition(knee);s.bone('UpperLegR').getWorldPosition(hip);assert(knee.z-hip.z>.3&&Math.abs(knee.y-hip.y)<.15,'thigh points forward when seated');
assert(MODEL_SCALE>0);
console.log('Save migration, 14 outfits (4 parts, <8k triangles, ~1.9 m), part swapping, skin/hair roles, motion clips, hand reach, held items and seated pose passed.');
