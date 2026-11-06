// The forklift guide's drawing (fork-guide.js says what to show): a honey beam and a bobbing diamond over the pallet to lift or the order square to take it to, and a ghost outline
// (green: fine, amber: not yet) of where the pallet in front of the forks is, or where the carried pallet will rest. Four small meshes, drawn only while you drive the forklift.
import * as THREE from './vendor/three.module.js';

export function createForkGuide(){
 const group=new THREE.Group();group.name='fork-guide';group.visible=false;
 const honey=new THREE.Color('#f5c518');
 const beam=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,4.5,12,1,true),new THREE.MeshBasicMaterial({color:honey,transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide,fog:false}));beam.name='fork-beacon-beam';
 const ring=new THREE.Mesh(new THREE.RingGeometry(.55,.72,32),new THREE.MeshBasicMaterial({color:honey,transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide,fog:false}));ring.rotation.x=-Math.PI/2;ring.name='fork-beacon-ring';
 const diamond=new THREE.Mesh(new THREE.OctahedronGeometry(.26),new THREE.MeshBasicMaterial({color:honey,fog:false}));diamond.name='fork-beacon-diamond';
 const beacon=new THREE.Group();beacon.name='fork-beacon';beacon.visible=false;beacon.add(beam,ring,diamond);
 const box=new THREE.BoxGeometry(1,1,1),fill=new THREE.MeshBasicMaterial({color:'#7fe08a',transparent:true,opacity:.2,depthWrite:false,fog:false}),edge=new THREE.LineBasicMaterial({color:'#7fe08a',fog:false});
 const ghost=new THREE.Group();ghost.name='fork-ghost';ghost.visible=false;
 const ghostFill=new THREE.Mesh(box,fill),ghostEdge=new THREE.LineSegments(new THREE.EdgesGeometry(box),edge);ghost.add(ghostFill,ghostEdge);
 group.add(beacon,ghost);
 const OK=new THREE.Color('#7fe08a'),WARN=new THREE.Color('#ffb347');
 // beacon: {x, y, z} the place to mark (y: its top) or null; ghost: {x, y, z, yaw, w, d, h, ok} or null; t: seconds (for the bobbing)
 function update(target,place,t=0){
  beacon.visible=!!target;
  if(target){beam.position.set(target.x,target.y+2.25,target.z);ring.position.set(target.x,target.kind==='staging'?.16:.03,target.z);diamond.position.set(target.x,target.y+.8+Math.sin(t*2.4)*.12,target.z);diamond.rotation.y=t*1.6}
  ghost.visible=!!place;
  if(place){ghost.position.set(place.x,place.y+place.h/2,place.z);ghost.rotation.y=place.yaw;ghost.scale.set(place.w,place.h,place.d);const c=place.ok?OK:WARN;fill.color.copy(c);edge.color.copy(c)}
  group.visible=!!target||!!place;
 }
 return {group,beacon,ghost,update};
}
