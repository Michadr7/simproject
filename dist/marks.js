// The paint marks of the day's cut blocks (0.35 step 4): an orange band round the trunk of each marked pine, and a ring on the ground at its foot so the mark shows from a distance.
// Two InstancedMeshes in all (two draw calls, at most MAX instances each), refilled only when the day or the trees change. Also the landing's ground ring.
import * as THREE from './vendor/three.module.js';
export const MAX_MARKS=400;
const ORANGE='#ff7a1a';
export function createTreeMarks({scene,groundAt=()=>0,max=MAX_MARKS}){
 const bandMat=new THREE.MeshBasicMaterial({color:ORANGE,side:THREE.DoubleSide,toneMapped:false}),ringMat=new THREE.MeshBasicMaterial({color:ORANGE,side:THREE.DoubleSide,transparent:true,opacity:.7,depthWrite:false,toneMapped:false});
 const band=new THREE.InstancedMesh(new THREE.CylinderGeometry(.27,.31,.3,10,1,true),bandMat,max),ring=new THREE.InstancedMesh(new THREE.RingGeometry(.7,.9,24).rotateX(-Math.PI/2),ringMat,max);
 band.name='tree-marks';ring.name='tree-mark-rings';band.frustumCulled=ring.frustumCulled=false;band.count=ring.count=0;band.renderOrder=ring.renderOrder=3;scene.add(band,ring);
 const m=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),s=new THREE.Vector3();let shown='';
 return {
  band,ring,
  get count(){return band.count},
  // trees: [{key, x, z, scale}]. The same list again changes nothing.
  set(trees){
   const key=trees.map(t=>t.key).join();if(key===shown)return;shown=key;const n=Math.min(trees.length,max);
   for(let i=0;i<n;i++){const t=trees[i],y=groundAt(t.x,t.z),k=t.scale||1;
    s.set(k,1,k);p.set(t.x,y+1.45*k,t.z);m.compose(p,q,s);band.setMatrixAt(i,m);
    s.set(1,1,1);p.set(t.x,y+.04,t.z);m.compose(p,q,s);ring.setMatrixAt(i,m)}
   band.count=ring.count=n;band.instanceMatrix.needsUpdate=ring.instanceMatrix.needsUpdate=true;
  },
  setVisible(on){band.visible=ring.visible=!!on}
 };
}
// The landing: a flat ring where logs are stacked.
export function createLandingRing({scene,x,z,y=0,radius=2.4}){
 const mesh=new THREE.Mesh(new THREE.RingGeometry(radius-.25,radius,40).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:ORANGE,side:THREE.DoubleSide,transparent:true,opacity:.75,depthWrite:false,toneMapped:false}));
 mesh.name='landing-ring';mesh.position.set(x,y+.05,z);mesh.renderOrder=3;scene.add(mesh);return mesh;
}

// Company stock you can see (0.35): plank stacks on the lumberyard's pallets (up to 54 stacks of four: three side by side, three high, on each of the six pallets), used by the
// lumberyard delivery and the customer-truck loading. One InstancedMesh, refilled only when the count changes. The log pile at the landing (stock-logs) was removed (owner 2026-11-18).
export function createStockPiles({scene,groundAt=()=>0,pallets}){
 const planks=new THREE.InstancedMesh(new THREE.BoxGeometry(1.2,.38,.22),new THREE.MeshStandardMaterial({color:'#c99f63',roughness:.9}),pallets.length*9);
 planks.name='stock-planks';planks.count=0;planks.castShadow=planks.receiveShadow=true;planks.frustumCulled=false;scene.add(planks);
 const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),one=new THREE.Vector3(1,1,1);let nPlanks=-1;
 const plankSpots=[];for(const pl of pallets)for(let layer=0;layer<3;layer++)for(let i=0;i<3;i++)plankSpots.push({x:pl.x,y:.16+.19+layer*.38,z:pl.z+(i-1)*.24});
 return {planks,
  setPlanks(planksCount){const n=Math.min(Math.ceil(planksCount/4),plankSpots.length);if(n===nPlanks)return;nPlanks=n;for(let i=0;i<n;i++){const s=plankSpots[i];m4.compose(p.set(s.x,groundAt(s.x,s.z)+s.y,s.z),q,one);planks.setMatrixAt(i,m4)}planks.count=n;planks.instanceMatrix.needsUpdate=true}};
}
