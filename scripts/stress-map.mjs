// Real-GPU CDP map stress test: frame times, renderer.info, heap and chunk hitch test.
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createDevServer} from './dev-server.mjs';

export function percentile(values,p){
 if(!values.length)return 0;
 const s=[...values].sort((a,b)=>a-b);
 const idx=Math.min(s.length-1,Math.max(0,Math.ceil((p/100)*s.length)-1));
 return s[idx];
}

export function summarizeFrames(deltas){
 if(!deltas.length)return {count:0,mean:0,p95:0,max:0,fps:0};
 const sum=deltas.reduce((a,b)=>a+b,0);
 const mean=sum/deltas.length;
 return {
  count:deltas.length,
  mean:+mean.toFixed(2),
  p95:+percentile(deltas,95).toFixed(2),
  max:+Math.max(...deltas).toFixed(2),
  fps:mean>0?+(1000/mean).toFixed(1):0
 };
}

export function formatMarkdownTable(rows){
 const head='| Spot | Time | Mean (ms) | p95 (ms) | Max (ms) | FPS | Calls | Tris | Progs | Tex | Geom | Heap (MB) |';
 const sep='|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|';
 const lines=rows.map(r=>`| ${r.spot} | ${r.timeLabel} | ${r.mean} | ${r.p95} | ${r.max} | ${r.fps} | ${r.calls} | ${r.triangles} | ${r.programs} | ${r.textures} | ${r.geometries} | ${r.jsHeapMB??'n/a'} |`);
 return [head,sep,...lines].join('\n');
}

const SPOTS=[
 {id:'spawn',name:'Spawn',x:-5,z:15,yaw:0},
 {id:'oak-street',name:'Oak Street',x:0,z:6,yaw:-Math.PI/2},
 {id:'market',name:'Corner Market',x:19,z:-4.5,yaw:0},
 {id:'ridgeline-warehouse',name:'Ridgeline Warehouse',x:166.9,z:28,yaw:Math.PI},
 {id:'sawmill-yard',name:'Sawmill Yard',x:94,z:-278,yaw:-Math.PI/2},
 {id:'pine-ridge',name:'Pine Ridge Forest',x:82,z:-270,yaw:0},
 {id:'farm',name:'Willow Fields (Farm)',x:-102,z:-230,yaw:0},
 {id:'bridge',name:'County Bridge',x:-30,z:-160,yaw:0},
 {id:'lake-shore',name:'Lake Shore',x:620,z:-435,yaw:0},
 {id:'estuary-coast',name:'Estuary / Coast',x:125,z:420,yaw:Math.PI},
 {id:'far-east',name:'Far East Edge',x:1020,z:68,yaw:-Math.PI/2}
];

const TIMES=[
 {id:'noon',label:'12:00',minutes:720},
 {id:'night',label:'20:00',minutes:1200}
];

const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function findBrowser(){
 const {access}=await import('node:fs/promises');
 const candidates=[
  process.env.STRESS_BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
 ].filter(Boolean);
 for(const p of candidates){try{await access(p);return p}catch{}}
 throw new Error('No Chrome or Edge executable found.');
}

async function main(){
 const root=resolve(import.meta.dirname,'..');
 const outDir=join(root,'notes','eval','outbox');
 await mkdir(outDir,{recursive:true});
 const browserPath=await findBrowser();
 const dev=createDevServer({root:join(root,'dist'),port:0,host:'127.0.0.1'});
 const httpPort=await dev.listen();
 const baseUrl=`http://127.0.0.1:${httpPort}`;
 const cdpPort=Number(process.env.STRESS_CDP_PORT)||9455;
 const profileDir=join(tmpdir(),`eden-stress-${Date.now()}`);
 await mkdir(profileDir,{recursive:true});

 const proc=spawn(browserPath,[
  `--remote-debugging-port=${cdpPort}`,
  `--user-data-dir=${profileDir}`,
  '--window-size=1400,800',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-gpu-vsync',
  'about:blank'
 ],{stdio:'ignore'});

 let ws=null;
 try{
  let targets;
  for(let i=0;i<60;i++){
   try{
    targets=await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
    if(targets.some(t=>t.type==='page'))break;
   }catch{}
   await sleep(200);
  }
  const pageTarget=targets?.find(t=>t.type==='page');
  if(!pageTarget)throw new Error('CDP page target not found');

  ws=new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=e=>rej(e.error||new Error('WS open failed'))});

  let nextId=0;
  const pending=new Map();
  const consoleErrors=[];
  ws.onmessage=ev=>{
   const d=JSON.parse(ev.data);
   if(d.id&&pending.has(d.id)){
    const p=pending.get(d.id);pending.delete(d.id);
    if(d.error)p.reject(new Error(d.error.message));else p.resolve(d.result);
    return;
   }
   if(d.method==='Runtime.consoleAPICalled'&&d.params?.type==='error'){
    consoleErrors.push(d.params.args?.map(a=>a.value??a.description??'').join(' ')||'console.error');
   }else if(d.method==='Runtime.exceptionThrown'){
    const ex=d.params?.exceptionDetails;
    consoleErrors.push(ex?.exception?.description||ex?.text||'uncaught exception');
   }else if(d.method==='Log.entryAdded'&&d.params?.entry?.level==='error'){
    consoleErrors.push((d.params.entry.text||'log error')+(d.params.entry.url?' '+d.params.entry.url:''));
   }
  };
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{
   const id=++nextId;pending.set(id,{resolve,reject});
   ws.send(JSON.stringify({id,method,params}));
  });
  const evalPage=async expression=>{
   const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
   if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
   return r.result?.value;
  };

  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Log.enable');
  await cdp('Emulation.setDeviceMetricsOverride',{width:1400,height:800,deviceScaleFactor:1,mobile:false});

  const browserVersion=await cdp('Browser.getVersion').catch(()=>null);
  const sysInfo=await cdp('SystemInfo.getInfo').catch(()=>null);

  await cdp('Page.navigate',{url:baseUrl+'/'});
  await sleep(1000);
  await evalPage(`localStorage.setItem('citylife.character.v1',JSON.stringify({version:1,appearance:{name:'StressTester'}}));localStorage.removeItem('citylife.progress.v1');true`);

  const t0=Date.now();
  await cdp('Page.navigate',{url:baseUrl+'/?debug'});
  for(let i=0;i<160;i++){
   if(await evalPage(`!!window.__city&&!!document.getElementById('start')`))break;
   await sleep(100);
  }
  await evalPage(`document.getElementById('start').click();true`);
  await evalPage(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  const startupMs=Date.now()-t0;

  const gpuInfo=await evalPage(`(()=>{
   const gl=__city.renderer.getContext();
   const dbg=gl.getExtension('WEBGL_debug_renderer_info');
   return {
    vendor:dbg?gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),
    renderer:dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
    version:gl.getParameter(gl.VERSION)
   };
  })()`);

  const rows=[];
  for(const time of TIMES){
   for(const spot of SPOTS){
    await evalPage(`(()=>{
     __city.place(${spot.x},${spot.z});
     __city.view(${spot.yaw},0.35,9);
     __city.GameState.progress.routine.minutes=${time.minutes};
     __city.lookAt(null);
     return true;
    })()`);
    await sleep(3000);
    const sample=await evalPage(`new Promise(resolve=>{
     const deltas=[];
     let prev=0;
     const start=performance.now();
     function step(now){
      if(prev)deltas.push(now-prev);
      prev=now;
      if(now-start>=10000){
       const info=__city.renderer.info;
       resolve({
        deltas,
        calls:info.render.calls,
        triangles:info.render.triangles,
        programs:info.programs?info.programs.length:0,
        textures:info.memory.textures,
        geometries:info.memory.geometries,
        jsHeapMB:performance.memory?+(performance.memory.usedJSHeapSize/1048576).toFixed(1):null,
        pos:__city.pos
       });
       return;
      }
      requestAnimationFrame(step);
     }
     requestAnimationFrame(step);
    })`);
    const stats=summarizeFrames(sample.deltas);
    const row={
     spotId:spot.id,spot:spot.name,timeId:time.id,timeLabel:time.label,
     ...stats,
     calls:sample.calls,triangles:sample.triangles,programs:sample.programs,
     textures:sample.textures,geometries:sample.geometries,jsHeapMB:sample.jsHeapMB,
     pos:sample.pos
    };
    rows.push(row);
    console.log(`${spot.name} (${time.label}): mean ${row.mean}ms p95 ${row.p95}ms max ${row.max}ms | ${row.calls} calls, ${row.triangles} tris`);
   }
  }

  // Hitch test: drive straight east across chunk boundary x=250 (from x=215, z=68)
  await evalPage(`(()=>{
   __city.GameState.progress.routine.minutes=720;
   __city.lookAt(null);
   __city.place(212,68);
   const v=__city.driving.addDev('shortbed',null,{x:215,z:68,yaw:Math.PI/2});
   if(v)__city.driving.enter(v.id,'driver',0);
   __city.view(-Math.PI/2,0.35,9);
   return !!v;
  })()`);
  await sleep(1000);
  const startPos=await evalPage(`__city.pos`);
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87,nativeVirtualKeyCode:87});
  const hitchSample=await evalPage(`new Promise(resolve=>{
   const deltas=[];let prev=0;const start=performance.now();
   function step(now){
    if(prev)deltas.push(now-prev);
    prev=now;
    if(now-start>=8000){resolve({deltas,endPos:__city.pos});return}
    requestAnimationFrame(step);
   }
   requestAnimationFrame(step);
  })`);
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87,nativeVirtualKeyCode:87});
  const hitchStats=summarizeFrames(hitchSample.deltas);
  const hitch={startX:startPos.x,endX:hitchSample.endPos.x,z:hitchSample.endPos.z,...hitchStats};
  console.log(`Hitch test (drive x ${hitch.startX} -> ${hitch.endX}): mean ${hitch.mean}ms p95 ${hitch.p95}ms max ${hitch.max}ms`);

  const worst=[...rows].sort((a,b)=>b.p95-a.p95||b.mean-a.mean).slice(0,3);
  const result={
   timestamp:new Date().toISOString(),
   browser:browserVersion,
   gpu:gpuInfo,
   sysInfoGpu:sysInfo?.gpu||null,
   startupMs,
   consoleErrors,
   rows,
   hitch,
   worst3:worst.map(w=>({spot:w.spot,time:w.timeLabel,mean:w.mean,p95:w.p95,max:w.max,calls:w.calls,triangles:w.triangles}))
  };

  await writeFile(join(outDir,'stress-map.json'),JSON.stringify(result,null,2),'utf8');
  const md=[
   'michadr.',
   '',
   `Browser: ${browserVersion?.product||'unknown'} (${browserPath})`,
   `WebGL GPU: ${gpuInfo.renderer} (${gpuInfo.vendor})`,
   `Startup to playable: ${startupMs} ms`,
   `Console errors: ${consoleErrors.length}`,
   ...(consoleErrors.length?consoleErrors.map(e=>`- ${e}`):[]),
   '',
   '## Spot Measurements (10 s after 3 s warm-up)',
   '',
   formatMarkdownTable(rows),
   '',
   '## Chunk Boundary Hitch Test (Driving)',
   '',
   `Drove from x=${hitch.startX} to x=${hitch.endX} (z=${hitch.z}): mean ${hitch.mean} ms, p95 ${hitch.p95} ms, max single frame ${hitch.max} ms (${hitch.fps} FPS).`,
   '',
   '## Worst 3 Spots',
   '',
   ...worst.map((w,i)=>`${i+1}. **${w.spot} (${w.timeLabel})** — mean ${w.mean} ms, p95 ${w.p95} ms, max ${w.max} ms, ${w.calls} draw calls, ${w.triangles} triangles.`),
   ''
  ].join('\n');
  await writeFile(join(outDir,'stress-map.md'),md,'utf8');
  console.log('Wrote notes/eval/outbox/stress-map.md and stress-map.json');
 }finally{
  ws?.close();
  proc.kill();
  await dev.close();
 }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch(err=>{console.error(err);process.exitCode=1});
}
