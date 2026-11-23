// Region & site tests: Kaspian Bay businesses (BZ6), Eden Industries layout (E-I1), Eden Outdoors (B3), Pier/Gate & WJ/BZ3 skills.
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {MAP,validateMap,weaponZoneAt} from '../dist/map-definition.js';
import {createWorld} from '../dist/world.js';
import {addXp,normalizeSkills,freshSkills} from '../dist/skills.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};

assert.deepEqual(validateMap(MAP),[]);
const byId=Object.fromEntries(MAP.landmarks.map(l=>[l.id,l]));
for(const id of ['kaspian-harbor','kaspian-chandlery','kaspian-shack','kaspian-inn','kaspian-fish','kaspian-ferry','kaspian-police','eden-cargo-terminal']){
 const l=byId[id];assert.ok(l&&l.wild,'Kaspian Bay landmark present: '+id);
 assert.equal(weaponZoneAt(l.x,l.z).kind,'noWeapon',id+' inside Kaspian Bay noWeapon zone');
}
for(const id of ['eden-guard-hut','eden-office','eden-hall-a','eden-hall-b','eden-hall-c','eden-hall-d','eden-warehouse']){
 const l=byId[id];assert.ok(l&&l.wild,'Eden landmark present: '+id);
 assert.equal(weaponZoneAt(l.x,l.z).kind,'noWeapon',id+' inside Eden noWeapon zone');
}
assert.ok(byId['eden-outdoors']&&weaponZoneAt(byId['eden-outdoors'].x,byId['eden-outdoors'].z).kind==='noWeapon');

const scene=new THREE.Scene();
createWorld(scene,{cullRadius:Infinity});
assert.ok(scene.getObjectByName('kaspian-pier'),'Kaspian Bay pier mesh added');
assert.ok(scene.getObjectByName('eden-gate-arch'),'Eden gate arch added');
assert.ok(scene.getObjectByName('blackstone-dock'),'Blackstone dock added');
assert.ok(scene.getObjectByName('eden-yard-prop.pallet-crate')?.isInstancedMesh,'E-I2 instanced Eden stockyard crates');
assert.ok(scene.getObjectByName('eden-yard-prop.pallet-medium-boxes')?.isInstancedMesh,'E-I2 instanced Eden loading yard pallets');

// WJ & BZ3 optional skills persist without breaking freshSkills
let st={skills:freshSkills()};
st=addXp(st,'welding',50).state;
st=addXp(st,'driving',60).state;
const norm=normalizeSkills(st.skills);
assert.equal(norm.welding.xp,50,'welding XP persisted');
assert.equal(norm.driving.xp,60,'driving XP persisted');
console.log('PASS regions: Kaspian Bay (BZ6), Eden site & gate (E-I1), Eden Outdoors (B3), pier & WJ/BZ3 skills');
