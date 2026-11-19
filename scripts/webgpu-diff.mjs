// WebGPU parity harness (WebGPU T6, notes/eval/outbox/webgpu-T6.md): runs the real game in headless Edge on the real GPU once per renderer mode and diffs 16 camera spots against WebGL.
//   node scripts/webgpu-diff.mjs <outDir> [modes] [--perf]      (serves dist/ itself; EDGE=<msedge.exe> if Edge is elsewhere)
// modes (comma list, default all): webgl (the default renderer), t5 (?webgpu=1&direct=0: T5's single output pass), webgpu (?webgpu=1), gl2 (?webgpu=1&webgl=1: WebGPURenderer on WebGL2).
// Spots: 10 by day, 4 at night, the main menu and the character creator; time is pinned with __city.lookAt (the sky), the player placed with __city.place/view, shops entered by walking
// through the door. Diff = mean absolute difference per channel (0..255) against the webgl run, max, and % of pixels over 15. People, smoke and the menu's motion move between runs, so a
// part of every diff is motion, not the renderer. --perf: afterwards each mode also runs ?perf=1 for 600 frames (headless Edge is vsync-capped: the numbers only prove the tool works).
// Writes <outDir>/<mode>-<spot>.png and <outDir>/webgpu-diff.json, prints a markdown table.
import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import {spawn} from 'node:child_process';import {fileURLToPath,pathToFileURL} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),DIST=path.join(ROOT,'dist');
const OUT=path.resolve(process.argv[2]||path.join(ROOT,'webgpu-diff-out'));const ALL={webgl:'',t5:'webgpu=1&direct=0',webgpu:'webgpu=1',gl2:'webgpu=1&webgl=1'};
const MODES=(process.argv[3]&&!process.argv[3].startsWith('--')?process.argv[3].split(','):Object.keys(ALL)).filter(m=>m in ALL);const PERF=process.argv.includes('--perf');
if(!MODES.includes('webgl'))MODES.unshift('webgl');
await fs.mkdir(OUT,{recursive:true});
const {skipStarter}=await import(pathToFileURL(path.join(DIST,'starter.js')).href);const PROGRESS=JSON.stringify({version:1,progress:{cash:1000,completed:0,phase:'available',starter:skipStarter()}});
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.webp':'image/webp','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.svg':'image/svg+xml'};
const srv=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://x');const rel=decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname);const full=path.resolve(DIST,'.'+rel);if(!full.startsWith(DIST)){res.writeHead(403);res.end();return}
 try{const d=await fs.readFile(full);res.writeHead(200,{'Content-Type':MIME[path.extname(full)]||'application/octet-stream'});res.end(d)}catch{res.writeHead(404);res.end()}});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));const BASE='http://127.0.0.1:'+srv.address().port;
const EDGE=process.env.EDGE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',GPU=['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-features=Vulkan'],sleep=ms=>new Promise(r=>setTimeout(r,ms));
const NIGHT=1320,DAY=720;
export const SPOTS=[
 {name:'day-sky',x:-5,z:15,yaw:0,pitch:-.25,zoom:9},
 {name:'day-ground',x:-5,z:15,yaw:0,pitch:1.2,zoom:9},
 {name:'day-depot',x:86.5,z:-8.5,yaw:0,pitch:.45,zoom:8},
 {name:'day-market',shop:'market',x:19},
 {name:'day-diner',shop:'cafe',x:36},
 {name:'day-sawmill',x:92,z:-266,yaw:.8,pitch:.35,zoom:14},
 {name:'day-gas',x:156,z:6,yaw:0,pitch:.3,zoom:12},
 {name:'day-lake',x:0,z:400,yaw:Math.PI,pitch:.15,zoom:10},
 {name:'day-alder',x:20,z:-90,yaw:.6,pitch:.3,zoom:11},
 {name:'day-forest',x:60,z:-250,yaw:2.4,pitch:.3,zoom:11},
 {name:'night-oak',x:-5,z:15,yaw:2.2,pitch:.25,zoom:9,minutes:NIGHT},
 {name:'night-gas',x:156,z:6,yaw:0,pitch:.3,zoom:12,minutes:NIGHT},
 {name:'night-alder',x:20,z:-90,yaw:.6,pitch:.3,zoom:11,minutes:NIGHT},
 {name:'night-headlights',vehicle:'eastbank-offroad',fresh:true,x:88.75,z:-9.5,yaw:Math.PI,pitch:.3,zoom:9,minutes:NIGHT}, // stand at the offroad's door in the depot, get in (lamps on: auto + dark)
];
async function browser(port,profile){
 const proc=spawn(EDGE,['--headless=new','--hide-scrollbars',`--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'--window-size=1280,720','--autoplay-policy=no-user-gesture-required',...GPU,'about:blank'],{stdio:'ignore'});
 let targets;for(let i=0;i<60;i++){try{targets=await(await fetch(`http://127.0.0.1:${port}/json`)).json();if(targets.some(t=>t.type==='page'))break}catch{}await sleep(200)}
 const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>{ws.onopen=r});
 let id=0;const pending=new Map(),logs=[];
 ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);p(m)}
  else if(m.method==='Runtime.consoleAPICalled'&&['error','warning','info','log'].includes(m.params.type)){const text=m.params.args.map(a=>a.value??a.description??'').join(' ').slice(0,600);if(m.params.type!=='log'||/renderer|WebGPU|TSL|THREE|perf/i.test(text))logs.push({kind:m.params.type,text})}
  else if(m.method==='Runtime.exceptionThrown')logs.push({kind:'exception',text:String(m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text||'').slice(0,400)})};
 const cdp=(method,params={})=>new Promise(r=>{const n=++id;pending.set(n,r);ws.send(JSON.stringify({id:n,method,params}))});
 const run=async js=>{const r=await cdp('Runtime.evaluate',{expression:js,awaitPromise:true,returnByValue:true});if(r.result?.exceptionDetails)return {evalError:String(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text).slice(0,300)};return r.result?.result?.value};
 const shot=async()=>(await cdp('Page.captureScreenshot',{format:'png'})).result.data;
 await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
 const close=async()=>{ws.close();proc.kill();await sleep(800)};
 const open=async query=>{await cdp('Page.navigate',{url:BASE+'/'});await sleep(1500);
  await run(`localStorage.clear();localStorage.setItem('edenridge.character.v1',JSON.stringify({version:1,appearance:{name:'Tester'}}));localStorage.setItem('edenridge.progress.v1',${JSON.stringify(PROGRESS)});true`);
  await cdp('Page.navigate',{url:BASE+'/?debug'+(query?'&'+query:'')});
  for(let i=0;i<240;i++){if(await run(`!!window.__city&&!!document.getElementById('start')`)===true)return true;await sleep(500)}return false};
 return {run,shot,open,close,logs};
}
const key=(b,code,down)=>b.run(`document.body.dispatchEvent(new KeyboardEvent('${down?'keydown':'keyup'}',{code:'${code}',key:'${code.slice(-1).toLowerCase()}',bubbles:true}));true`);
async function runMode(mode,port){
 const b=await browser(port,path.join(OUT,'profile-'+mode)),save=(name,png)=>fs.writeFile(path.join(OUT,`${mode}-${name}.png`),Buffer.from(png,'base64'));
 const result={mode,query:ALL[mode],booted:await b.open(ALL[mode]),shots:{},spots:{},logs:b.logs};
 if(!result.booted){await b.close();return result}
 await sleep(2500);result.shots.menu=await b.shot();await save('menu',result.shots.menu);
 await b.run(`document.getElementById('start').click();true`);await sleep(4000);
 result.backend=await b.run(`(()=>{const r=__city.renderer;return {isWebGPURenderer:!!r.isWebGPURenderer,backend:r.backend?(r.backend.isWebGPUBackend?'WebGPUBackend':(r.backend.isWebGLBackend?'WebGLBackend':'?')):'WebGLRenderer',direct:!!r.__directOutput,fps:__city.fps()}})()`);
 for(const s of SPOTS){
  if(s.fresh){await b.open(ALL[mode]);await sleep(2500);await b.run(`document.getElementById('start').click();true`);await sleep(4000)} // a new page: the earlier spots move the story and the depot vehicles
  await b.run(`__city.lookAt(${s.minutes??DAY});true`);
  if(s.shop){await b.run(`__city.place(${s.x},-6.2);__city.view(0,.35,6);true`);await sleep(800);await key(b,'KeyW',true);await sleep(2600);await key(b,'KeyW',false);await sleep(1800);result.spots[s.name]={inside:await b.run(`__city.shop||null`)}}
  else if(s.vehicle){await b.run(`__city.place(${s.x},${s.z});true`);await sleep(1500);const v=await b.run(`(()=>{const d=__city.driving;const ok=d.enter('${s.vehicle}');return {ok,driving:!!d.driving}})()`);await b.run(`__city.view(${s.yaw},${s.pitch},${s.zoom});true`);await sleep(3500);result.spots[s.name]={vehicle:v}}
  else{await b.run(`__city.place(${s.x},${s.z});__city.view(${s.yaw},${s.pitch},${s.zoom});true`);await sleep(3000);result.spots[s.name]={}}
  const png=await b.shot();await save(s.name,png);result.shots[s.name]=png;
  if(s.shop&&result.spots[s.name].inside){await key(b,'KeyS',true);await sleep(2600);await key(b,'KeyS',false);await sleep(1500)} // walk back out
 }
 result.cost=await b.run(`(()=>{const d=__city.renderer.__directOutput?.last,i=__city.renderer.info?.render;return {lastCalls:d?d.calls:null,infoNow:i?.drawCalls??i?.calls??null}})()`);
 await b.open(ALL[mode]);await sleep(2500);await b.run(`document.getElementById('customizeSaved')?.click();true`);await sleep(3500);result.shots.creator=await b.shot();await save('creator',result.shots.creator);
 if(PERF){await b.open([ALL[mode],'perf=1'].filter(Boolean).join('&'));await sleep(2000);await b.run(`document.getElementById('start').click();true`);await b.run(`__city.lookAt(${NIGHT});__city.place(-5,15);__city.view(2.2,.25,9);true`);
  for(let i=0;i<90;i++){await sleep(1000);const t=await b.run(`document.getElementById('perfProbe')?.textContent||''`);if(/click to measure again/.test(t)){result.perf=t;break}}}
 await b.close();return result;
}
const results={};let port=9480;for(const m of MODES)results[m]=await runMode(m,port++);
// pixel diffs in a plain page of one more browser
const d=await browser(port++,path.join(OUT,'profile-diff'));
const diff=(a,b)=>d.run(`(async()=>{const load=s=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src='data:image/png;base64,'+s});const [ia,ib]=await Promise.all([load(${JSON.stringify(a)}),load(${JSON.stringify(b)})]);const c=document.createElement('canvas');c.width=ia.width;c.height=ia.height;const x=c.getContext('2d');x.drawImage(ia,0,0);const da=x.getImageData(0,0,c.width,c.height).data;x.drawImage(ib,0,0);const db=x.getImageData(0,0,c.width,c.height).data;let s=0,mx=0,gt=0,ma=0,mb=0;const n=da.length/4;for(let i=0;i<da.length;i+=4){let e3=0;for(let k=0;k<3;k++){const e=Math.abs(da[i+k]-db[i+k]);e3+=e;if(e>mx)mx=e;ma+=da[i+k];mb+=db[i+k]}s+=e3/3;if(e3/3>15)gt++}return {mean:+(s/n).toFixed(2),max:mx,over15:+(100*gt/n).toFixed(2),meanA:+(ma/n/3).toFixed(1),meanB:+(mb/n/3).toFixed(1)}})()`);
const names=[...SPOTS.map(s=>s.name),'menu','creator'],table={};
for(const n of names){table[n]={};for(const m of MODES){if(m==='webgl')continue;const A=results.webgl.shots[n],B=results[m].shots[n];table[n][m]=A&&B?await diff(A,B):null}}
await d.close();
for(const r of Object.values(results))delete r.shots;
await fs.writeFile(path.join(OUT,'webgpu-diff.json'),JSON.stringify({modes:MODES,results,table},null,1));
const others=MODES.filter(m=>m!=='webgl');
console.log('| spot | '+others.map(m=>m+' mean / max / %>15').join(' | ')+' |');console.log('|---|'+others.map(()=>'---').join('|')+'|');
for(const n of names)console.log(`| ${n} | `+others.map(m=>{const v=table[n][m];return v?`${v.mean} / ${v.max} / ${v.over15}%`:'n/a'}).join(' | ')+' |');
for(const m of MODES){const r=results[m];console.log(`\n${m}: booted ${r.booted}, backend ${JSON.stringify(r.backend)}, spots ${JSON.stringify(r.spots)}, cost ${JSON.stringify(r.cost)}`);for(const l of r.logs.filter(l=>l.kind!=='log'||/perf/.test(l.text)).slice(0,25))console.log(`  [${l.kind}] ${l.text.replace(/\s+/g,' ').slice(0,300)}`);if(r.perf)console.log('  perf overlay:\n'+r.perf.split('\n').map(x=>'    '+x).join('\n'))}
srv.close();process.exit(0);
