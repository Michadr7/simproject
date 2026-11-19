import * as THREE from 'three';
import { TUNING } from './weld-core.js';

export const FEEDBACK = Object.freeze({
  maxBeadSections:448, maxSparks:200, coolingSeconds:2.2,
  sparkLife:.24, sparksPerSecond:360, beadRadius:.0032,
});
const hot = new THREE.Color('#ffb875'), cold = new THREE.Color('#555c66');

export function weldFeedback(scene) {
  const {maxBeadSections,maxSparks,coolingSeconds,sparkLife,sparksPerSecond,beadRadius} = FEEDBACK;
  const edgeIndices = [0,1,4,1,5,4,1,2,5,2,6,5,2,3,6,3,7,6,3,0,7,0,4,7];
  const geo = new THREE.BufferGeometry();
  const v = new Float32Array(maxBeadSections*24*3), colors = new Float32Array(v.length);
  geo.setAttribute('position',new THREE.BufferAttribute(v,3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3).setUsage(THREE.DynamicDrawUsage));
  geo.setDrawRange(0,0);
  const bead = new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));
  bead.frustumCulled = false;
  scene.add(bead);
  const sections = [];
  const byId = new Map();
  let head = 0;
  function write(section, index) {
    const a = section.from, b = section.point;
    let dx = b[0]-a[0], dz = b[2]-a[2], l = Math.hypot(dx,dz);
    if (l < .001) {dx = TUNING.spacing; dz = 0; l = dx;}
    const slow = section.defect === 'burn-through' || section.defect === 'sag';
    const fast = section.defect === 'cold lap';
    const radius = beadRadius*(slow ? 2.45 : fast ? .45 + (section.id%3)*.14 : 1);
    const height = slow ? .006 : fast ? .001 : .0028;
    const widthX = -dz/l*radius, widthZ = dx/l*radius;
    const verts = [a,b].flatMap((p,k) => {
      const x = p[0] + (slow ? dx/l*(k ? .003 : -.003) : 0);
      const z = p[2] + (slow ? dz/l*(k ? .003 : -.003) : 0);
      const y = p[1]+.0005;
      return [[x-widthX,y,z-widthZ],[x-widthX*.45,y+height,z-widthZ*.45],
        [x+widthX*.45,y+height,z+widthZ*.45],[x+widthX,y,z+widthZ]];
    });
    edgeIndices.forEach((i,k)=>v.set(verts[i],index*72+k*3));
    geo.attributes.position.needsUpdate = true;
  }
  function deposit(s, revise) {
    let index = byId.get(s.id);
    if (index === undefined) {
      index = head;
      head = (head+1)%maxBeadSections;
      if (sections[index]) byId.delete(sections[index].id);
      byId.set(s.id,index);
    }
    sections[index] = {...s};
    if (revise) sections[index].time = s.time;
    write(sections[index],index);
    geo.setDrawRange(0,sections.length*24);
  }
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(maxSparks*3);
  sparkGeo.setAttribute('position',new THREE.BufferAttribute(sparkPos,3).setUsage(THREE.DynamicDrawUsage));
  sparkGeo.setDrawRange(0,0);
  const sparks = new THREE.Points(sparkGeo,new THREE.PointsMaterial({
    color:0xffb374,size:.009,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false,
  }));
  sparks.frustumCulled = false;
  scene.add(sparks);
  const flying = [];
  let accumulator = 0;
  const glow = new THREE.Mesh(new THREE.SphereGeometry(.007,8,6),
    new THREE.MeshBasicMaterial({color:0xffe4bc}));
  glow.visible = false;
  scene.add(glow);
  const ticksGeo = new THREE.BufferGeometry();
  const tickPos = new Float32Array(TUNING.worstCount*6);
  ticksGeo.setAttribute('position',new THREE.BufferAttribute(tickPos,3));
  ticksGeo.setDrawRange(0,0);
  const ticks = new THREE.LineSegments(ticksGeo,new THREE.LineBasicMaterial({color:0xff4734,depthTest:false}));
  ticks.frustumCulled = false;
  ticks.renderOrder = 3;
  scene.add(ticks);
  function mark(worst) {
    worst.forEach(({point:p},i)=>tickPos.set([p[0]-.007,p[1]+.008,p[2],p[0]+.007,p[1]+.008,p[2]],i*6));
    ticksGeo.attributes.position.needsUpdate = true;
    ticksGeo.setDrawRange(0,worst.length*2);
  }
  function frame(time, dt, arc, point) {
    const c = new THREE.Color();
    sections.forEach((s,i)=>{
      c.copy(hot).lerp(cold,Math.min(1,Math.max(0,time-s.time)/coolingSeconds));
      for (let j=0;j<24;j++) {
        const flank = j < 6 || (j >= 12 && j < 18);
        const tone = (flank ? .64 : 1.0)*(s.id%2 ? .90 : 1);
        const o=i*72+j*3;
        colors[o]=c.r*tone;
        colors[o+1]=c.g*tone;
        colors[o+2]=c.b*tone;
      }
    });
    geo.attributes.color.needsUpdate = true;
    glow.visible = arc;
    if (arc) {
      glow.position.fromArray(point);
      glow.position.y += .006;
      accumulator += dt*sparksPerSecond;
      while (accumulator >= 1 && flying.length < maxSparks) {
        accumulator--;
        const angle = Math.random()*Math.PI*2, magnitude = .1+Math.random()*.65;
        flying.push({start:time,p:point.slice(),vx:Math.cos(angle)*magnitude,
          vz:Math.sin(angle)*magnitude,vy:.25+Math.random()*.6});
      }
    }
    accumulator %= 1;
    let count=0;
    for (let i=flying.length-1;i>=0;i--) {
      const s=flying[i], age=time-s.start, height=s.p[1]+.004+s.vy*age-2.25*age*age;
      if (age>sparkLife || height<s.p[1]) {
        flying[i]=flying.at(-1);
        flying.pop();
        continue;
      }
      sparkPos.set([s.p[0]+s.vx*age,height,s.p[2]+s.vz*age],count++*3);
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.setDrawRange(0,count);
  }
  function reset() {
    sections.length=0; byId.clear(); head=0; flying.length=0; accumulator=0;
    geo.setDrawRange(0,0);sparkGeo.setDrawRange(0,0);mark([]);
  }
  return {deposit,frame,reset,mark, stats:()=>({beadTriangles:sections.length*8,sparks:flying.length})};
}

export function weldAudio() {
  let ctx, gain, filter, buzz, muted = false;
  function enable() {
    if (!ctx) {
      ctx = new AudioContext();
      const noise = ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate), samples = noise.getChannelData(0);
      for(let i=0;i<samples.length;i++) samples[i]=(Math.random()*2-1)*(i%47<5 ? 1 : .28);
      const source = ctx.createBufferSource();
      source.buffer=noise;source.loop=true;
      filter=ctx.createBiquadFilter();
      filter.type='bandpass';
      gain=ctx.createGain();gain.gain.value=0;
      buzz=ctx.createOscillator();buzz.type='triangle';
      const buzzGain=ctx.createGain();buzzGain.gain.value=.19;
      source.connect(filter).connect(gain).connect(ctx.destination);
      buzz.connect(buzzGain).connect(gain);
      source.start();buzz.start();
    }
    if(ctx.state==='suspended') void ctx.resume();
  }
  function update(arc,{speed,errorMm,dwell}) {
    if (!ctx) return;
    const rough=Math.min(1,errorMm/10 + dwell + (speed<TUNING.minSpeed ? .3 : 0));
    const t=ctx.currentTime;
    gain.gain.setTargetAtTime(arc&&!muted ? .09 : 0,t,.025);
    filter.frequency.setTargetAtTime(520+Math.min(.2,speed)*4800-rough*220,t,.035);
    filter.Q.setTargetAtTime(.9+rough*3,t,.035);
    buzz.frequency.setTargetAtTime(92+Math.min(.2,speed)*410,t,.05);
  }
  return {enable,update,toggleMute:()=>muted=!muted};
}
