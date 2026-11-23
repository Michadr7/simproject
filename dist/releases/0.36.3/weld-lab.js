import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { TUNING, braceTarget, seamPath, tipMotion, weldSampler } from './weld-core.js';
import { FEEDBACK, weldFeedback, weldAudio } from './weld-game.js';

const $ = id => document.getElementById(id);
const assets = './assets/weld-lab/';
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.prepend(renderer.domElement);
const canvas = renderer.domElement;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#4f5b6b');
const camera = new THREE.PerspectiveCamera();
const pointer = new THREE.Vector2();
const ray = new THREE.Raycaster();
const workPlane = new THREE.Plane(new THREE.Vector3(0,1,0));
const hit = new THREE.Vector3();
const lights = [
  new THREE.HemisphereLight(0xeaf1ff,0x30404d,1.9),
  new THREE.DirectionalLight(0xffead8,2.2),
  new THREE.DirectionalLight(0xc4d9ff,.8),
];
lights[1].position.set(-1,1.8,-.6);
lights[2].position.set(1,.7,.6);
scene.add(...lights);

const plateY=-.186, deckY=-.20, centerX=.033, centerZ=.318;
const stock = new THREE.MeshStandardMaterial({color:'#89949e',metalness:.37,roughness:.53});
const lapStock = new THREE.MeshStandardMaterial({color:'#a0a8af',metalness:.37,roughness:.49});
const pieces = new THREE.Group();
scene.add(pieces);
function plate(x,y,z,w,h,d,material=stock) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  mesh.position.set(x,y,z);
  pieces.add(mesh);
}
const plateDepth=.34, plateThickness=.014, gap=.005;
function buttStock() {
  const width=.21;
  for (const side of [-1,1]) plate(centerX+side*(width+gap)/2,plateY-plateThickness/2,
    centerZ,width,plateThickness,plateDepth);
}
function curvedStock() {
  function ellipse(radius,index) {
    const a=Math.PI*(.045+.91*index/40);
    return new THREE.Vector2(centerX+(.175+radius)*Math.cos(a),.195+(.275+radius)*Math.sin(a));
  }
  for(const side of [-1,1]) {
    const edges=Array.from({length:41},(_,i)=>ellipse(side*gap/2,i));
    for(let i=40;i>=0;i--)edges.push(ellipse(side*.089,i));
    const geometry=new THREE.ExtrudeGeometry(new THREE.Shape(edges),{depth:plateThickness,bevelEnabled:false});
    const mesh=new THREE.Mesh(geometry,stock);
    mesh.rotation.x=Math.PI/2;
    mesh.position.y=plateY;
    pieces.add(mesh);
  }
}
const choices = [
  {shape:buttStock, path:[[centerX,plateY,.165],[centerX,plateY,.47]]},
  {shape:curvedStock,
    path:Array.from({length:33},(_,i)=>{
      const phase=Math.PI*(.08+.84*i/32);
      return [centerX+.175*Math.cos(phase),plateY,.195+.275*Math.sin(phase)];
    })},
  {shape() {plate(centerX,plateY-.007,centerZ,.44,.014,plateDepth);
    plate(centerX-.007,plateY+.038,centerZ,.014,.076,plateDepth-.02,lapStock);},
    path:[[centerX+.002,plateY,.17],[centerX+.002,plateY,.47]]},
  {shape() {plate(centerX-.015,plateY-.007,centerZ,.46,.014,plateDepth);
    plate(centerX-.109,plateY+.007,centerZ,.215,.014,plateDepth-.015,lapStock);},
    path:[[centerX+.001,plateY,.17],[centerX+.001,plateY,.47]]},
];
const feedback=weldFeedback(scene);
const audio=weldAudio();
const zeroStatus={speed:0,errorMm:0,dwell:0,defect:null};
let torch,cable,glove,target,baseTip,standoff, deform=[], path,sampler,choice=0;
let arc=false, finished=false, brace=false, bracePoint, lift=false, debug=false, ready=false;
let status=zeroStatus,time=0, clock=0, previous, guided, replaying=false, replayArc=false, lastOps=0, maxOps=0;
const seed=33421, liftHeight=.03, timeStep=1/120, maxFrameSeconds=.05;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function size() {
  const w=innerWidth,h=innerHeight;
  renderer.setSize(w,h);
  camera.aspect=w/h;
  camera.updateProjectionMatrix();
}
addEventListener('resize',size);

function deformable(root, weight) {
  root.traverse(o=>{
    if(!o.isMesh)return;
    const position=o.geometry.attributes.position;
    const base=position.array.slice();
    const influence=new Float32Array(position.count);
    for(let i=0;i<position.count;i++) {
      influence[i]=weight(base[i*3],base[i*3+2]);
    }
    o.frustumCulled=false;
    position.setUsage(THREE.DynamicDrawUsage);
    deform.push({base,position,influence});
  });
}

function pose(point,height=0) {
  torch.position.set(point[0]-baseTip[0],point[1]+standoff+height-baseTip[1],point[2]-baseTip[2]);
  const d=torch.position;
  for(const {base,position,influence} of deform) {
    for(let i=0;i<influence.length;i++) {
      const j=i*3,a=influence[i];
      position.setXYZ(i,base[j]+a*d.x,base[j+1]+a*d.y,base[j+2]+a*d.z);
    }
    position.needsUpdate=true;
  }
}
function reset(next=choice) {
  for(const child of [...pieces.children]) {pieces.remove(child);child.geometry.dispose();}
  choice=next;
  $('joint').value=choice;
  const joint=choices[choice];
  joint.shape();
  path=seamPath(joint.path);
  sampler=weldSampler(path);
  target=choice===0 ? [centerX,plateY,centerZ] : path.pointAt(path.length/2);
  workPlane.constant=-joint.path[0][1];
  feedback.reset();
  arc=finished=brace=lift=false;
  previous=undefined; bracePoint=undefined;
  clock=time;
  guided=target;
  replaying=false;
  replayArc=false;
  status=zeroStatus; lastOps=maxOps=0;
  $('result').hidden=true;
  $('finish').disabled=false;
  pose(target);
}
function finish() {
  if(!ready||finished)return;
  arc=false;
  audio.update(false,status);
  finished=true;
  $('finish').disabled=true;
  const report=sampler.finish();
  $('score').textContent=`${report.score}/100 · Grade ${report.grade}`;
  const labels=[...new Set(report.worst.map(x=>x.defect))].join(', ');
  $('details').textContent=`${Math.round(report.coverage*100)}% seam coverage${labels ? ' · '+labels : ''}`;
  $('result').hidden=false;
  feedback.mark(report.worst);
  if(document.pointerLockElement)document.exitPointerLock();
  return report.score;
}
function aim(x,y) {
  pointer.set(x,y);
  ray.setFromCamera(pointer,camera);
  if(!ray.ray.intersectPlane(workPlane,hit))return;
  target=[clamp(hit.x,-.31,.35),hit.y,clamp(hit.z,.065,.61)];
}
function motion(e) {
  if(!ready||finished||replaying)return;
  if(document.pointerLockElement===canvas) {
    aim(clamp(pointer.x+2*e.movementX/innerWidth,-1,1),clamp(pointer.y-2*e.movementY/innerHeight,-1,1));
  } else aim(2*e.clientX/innerWidth-1,1-2*e.clientY/innerHeight);
}
canvas.addEventListener('pointermove',motion);
canvas.addEventListener('pointerdown',e=>{
  if(!ready||finished||e.button!==0)return;
  document.activeElement?.blur();
  motion(e);audio.enable();arc=true;e.preventDefault();
});
addEventListener('pointerup',e=>{if(e.button===0)arc=false;});
addEventListener('pointercancel',()=>{arc=false;});
addEventListener('blur',()=>{arc=brace=lift=false;bracePoint=undefined;audio.update(false,status);});
document.addEventListener('pointerlockchange',()=>{
  $('capture').textContent=document.pointerLockElement===canvas?'Release mouse':'Capture mouse';
  if(!document.pointerLockElement)arc=false;
});
$('capture').onclick=async()=>{
  if(document.pointerLockElement)document.exitPointerLock();
  else {
    try {await canvas.requestPointerLock();}
    catch { $('capture').textContent='Capture unavailable'; }
  }
};
$('joint').onchange=()=>ready&&reset(Number($('joint').value));
$('finish').onclick=finish;
$('reset').onclick=$('retry').onclick=()=>ready&&reset();
$('mute').onclick=()=>{$('mute').textContent=audio.toggleMute()?'Unmute':'Mute';};
addEventListener('keydown',e=>{
  if(!ready||e.repeat)return;
  if(e.key==='Enter'&&['SELECT','BUTTON'].includes(e.target.tagName))return;
  if(e.key==='Shift'&&!finished){brace=true;bracePoint=target.slice();}
  if(e.key==='Alt'&&!finished){e.preventDefault();lift=true;}
  if(e.key.toLowerCase()==='h')$('debug').hidden=!(debug=!debug);
  if(e.key.toLowerCase()==='r')reset();
  if(e.key==='Enter')finish();
  if(/^[1-4]$/.test(e.key))reset(Number(e.key)-1);
});
addEventListener('keyup',e=>{
  if(e.key==='Shift'){brace=false;bracePoint=undefined;}
  if(e.key==='Alt')lift=false;
});
function frame(ms) {
  requestAnimationFrame(frame);
  const elapsed=previous===undefined?0:(ms-previous)/1000;
  const dt=Math.min(maxFrameSeconds,elapsed);
  previous=ms;
  time+=elapsed;
  if(ready) {
    if(!finished&&!replaying) {
      const before=sampler.operations;
      // Keep motion and scoring at a fixed cadence even if drawing is slow.
      const end=time;
      if(end-clock>maxFrameSeconds+timeStep)clock=end-maxFrameSeconds;
      const start=clock, destination=braceTarget(target,bracePoint);
      const origin=guided;
      let p;
      while(clock+timeStep<=end){
        clock+=timeStep;
        const amount=(clock-start)/(end-start);
        guided=origin.map((v,j)=>v+(destination[j]-v)*amount);
        p=tipMotion(guided,clock,seed,bracePoint);
        status=sampler.update(p,clock,arc,lift?liftHeight:0,feedback.deposit,guided);
      }
      pose(p??tipMotion(target,time,seed,bracePoint),lift?liftHeight:0);
      lastOps=sampler.operations-before;maxOps=Math.max(maxOps,lastOps);
    } else clock=time;
    feedback.frame(time,dt,(arc||replayArc)&&!lift, [torch.position.x+baseTip[0],
      torch.position.y+baseTip[1]-standoff,torch.position.z+baseTip[2]]);
    audio.update(arc,status);
    if(debug) $('debug').textContent=`Speed  ${(status.speed*1000).toFixed(0)} mm/s\nError  ${status.errorMm.toFixed(1)} mm\nDwell  ${status.dwell.toFixed(2)} s\nBrace  ${brace?'on':'off'}`;
  }
  renderer.render(scene,camera);
}
function replay(kind,showResult=false) {
  const oldTime=time;
  reset();
  $('joint').disabled=false;
  replaying=true;
  finished=true;
  const speed=kind==='fast'?.128:kind==='slow'?.020:TUNING.idealSpeed;
  const duration=path.length/speed;
  const sampleAt=t=>{
    const p=path.pointAt(Math.min(t*speed,path.length));
    if(kind==='wander') p[0]+=.013+.006*Math.sin(21*p[2]);
    return p;
  };
  const ageStart=oldTime-duration;
  for(let t=0;t<duration;t+=timeStep) {
    const before=sampler.operations;
    status=sampler.update(sampleAt(t),ageStart+t,true,0,feedback.deposit);
    maxOps=Math.max(maxOps,sampler.operations-before);
  }
  status=sampler.update(sampleAt(duration),oldTime,true,0,feedback.deposit);
  if(kind==='slow') {
    for(let i=1;i<=84;i++) status=sampler.update(sampleAt(duration),oldTime+i*timeStep,true,0,feedback.deposit);
    time=oldTime+.7;
  }
  pose(sampleAt(duration));
  replayArc=kind==='arc';
  if(showResult){finished=false;finish();}
  return { ...sampler.finish(), ...feedback.stats(), drawCalls:renderer.info.render.calls,
    samplerEdgeChecks:sampler.operations, peakReplayStepEdgeChecks:maxOps };
}
async function init() {
  const loader=new GLTFLoader();
  const [viewmodel,station,m]=await Promise.all([
    loader.loadAsync(assets+'fp-torch-glove.glb'),
    loader.loadAsync(assets+'Weldingv3.glb'),
    fetch(assets+'fp-torch-glove-manifest.json').then(r=>{if(!r.ok)throw Error('Viewmodel manifest missing');return r.json();}),
  ]);
  const requireNode=(root,name)=>{
    let node=root.getObjectByName(name);
    if(!node)root.traverse(o=>{if(o.userData.name===name)node=o;});
    if(!node)throw Error(`Missing model node ${name}`);
    return node;
  };
  const table=requireNode(station.scene,'Prop_WeldTable');
  const clampModel=requireNode(station.scene,'GroundClamp.anim');
  table.position.set(0,deckY-.90,.33);
  clampModel.position.set(-.35,deckY+.018,.40);
  clampModel.rotation.set(0,Math.PI*.5,0);
  scene.add(table,clampModel,viewmodel.scene);
  torch=requireNode(viewmodel.scene,'FP_Torch');
  glove=requireNode(viewmodel.scene,'FP_Glove');
  cable=requireNode(viewmodel.scene,'FP_Cable');
  deformable(glove,(x,z)=>x>.10 ? 0 : 1-clamp((-z-.075)/.23,0,1));
  deformable(cable,(_,z)=>1-clamp((-z-.12)/.45,0,1));
  camera.position.fromArray(m.anchors.anchor_camera_hint.game);
  camera.lookAt(new THREE.Vector3().fromArray(m.anchors.anchor_camera_target.game));
  camera.fov=m.camera.verticalFovDeg;
  camera.near=m.camera.nearM;camera.far=m.camera.farM;
  baseTip=m.anchors.anchor_tip.game;
  standoff=baseTip[1]-m.anchors.anchor_seam.game[1];
  size();
  ready=true;
  reset();
  $('error').hidden=true;
  for(const id of ['finish','reset','capture','mute'])$(id).disabled=false;
  if(new URLSearchParams(location.search).has('debug')){
    window.__weld={ready:true,replay,reset:(i=0)=>{replaying=false;reset(i);},
      stats:()=>({...feedback.stats(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
        latestFrameEdgeChecks:lastOps,peakFrameEdgeChecks:maxOps,edgeCount:path.edgeCount,
        maxBeadTriangles:FEEDBACK.maxBeadSections*8,maxSparks:FEEDBACK.maxSparks})};
  }
  requestAnimationFrame(frame);
}
init().catch(error=>{$('error').textContent=error.message;console.error(error);});
