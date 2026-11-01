// Browser lab: drives headless Edge (software WebGL, so about 4 FPS: good for looks and for A/B checks, not for frame rate) over the DevTools protocol, with the game's ?debug hook.
//   1. serve the site:        npm run dev          (http://127.0.0.1:8000; or set LAB_URL)
//   2. run a scenario:        node scripts/browser-lab.mjs <outDir> <scenario.json>     (EDGE=<path to msedge.exe> if Edge is somewhere else)
// A scenario is {"steps": [...]}; each step may have: x, z (place the player), minutes (time of day 0-1439), yaw, pitch, zoom (camera), eval (JS to run in the page),
//   log (JS whose result is printed), reload (reload the page first), wait (ms before the next thing, default 2500), name (screenshot <outDir>/<name>.png),
//   flicker N (take N screenshots and print how many pixels changed between them), measure N + patch [x,y,w,h] (mean colour of a screen patch over N frames with the camera nudged: z-fighting shows as jumps).
// Made for the 0.32.0 playtest: the ground-layer flicker was reproduced and fixed with `measure` (see README).
import {createRequire} from 'node:module';import {writeFile,mkdir,readFile} from 'node:fs/promises';import {spawn} from 'node:child_process';
const require=createRequire(import.meta.url),WebSocket=require('ws'),BASE=(process.env.LAB_URL||'http://127.0.0.1:8000').replace(/\/$/,'');
const [,, out,scenarioFile]=process.argv,scenario=JSON.parse((await readFile(scenarioFile,'utf8')).replace(/^\uFEFF/,''));
const edge=process.env.EDGE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',port=9444;
await mkdir(out,{recursive:true});
const proc=spawn(edge,['--headless=new','--disable-gpu','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars',`--remote-debugging-port=${port}`,`--user-data-dir=${out}/profile`,'--window-size=1400,800','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let targets;for(let i=0;i<50;i++){try{targets=await (await fetch(`http://127.0.0.1:${port}/json`)).json();if(targets.some(t=>t.type==='page'))break}catch{}await sleep(200)}
const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.on('open',r));
let id=0;const pending=new Map();ws.on('message',m=>{const d=JSON.parse(m);if(d.id&&pending.has(d.id)){pending.get(d.id)(d);pending.delete(d.id)}});
const cdp=(method,params={})=>new Promise(r=>{const n=++id;pending.set(n,r);ws.send(JSON.stringify({id:n,method,params}))});
const run=async js=>{const r=await cdp('Runtime.evaluate',{expression:js,awaitPromise:true,returnByValue:true});if(r.result.exceptionDetails)console.log('EVAL ERROR',JSON.stringify(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text).slice(0,400));return r.result.result?.value};
const shotB64=async()=>(await cdp('Page.captureScreenshot',{format:'png'})).result.data;
await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1400,height:800,deviceScaleFactor:1,mobile:false});
await cdp('Page.navigate',{url:BASE+'/'});await sleep(1500);
await run(`localStorage.setItem('citylife.character.v1',JSON.stringify({version:1,appearance:{name:'Tester'}}));localStorage.removeItem('citylife.progress.v1');true`);
await cdp('Page.navigate',{url:BASE+'/?debug'});
for(let i=0;i<160;i++){if(await run(`!!window.__city&&!!document.getElementById('start')`))break;await sleep(500)}
await run(`document.getElementById('start').click();document.body.dataset.lab='1';true`);await sleep(1500);
// a page-side helper that counts pixels that differ between two screenshots
await run(`window.__diff=async(a,b)=>{const load=s=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src='data:image/png;base64,'+s});const [ia,ib]=await Promise.all([load(a),load(b)]);const c=document.createElement('canvas');c.width=ia.width;c.height=ia.height;const x=c.getContext('2d');x.drawImage(ia,0,0);const da=x.getImageData(0,0,c.width,c.height).data;x.drawImage(ib,0,0);const db=x.getImageData(0,0,c.width,c.height).data;let n=0,bright=0,far=0;const cx=c.width/2,cy=c.height/2,grid={};for(let i=0;i<da.length;i+=4){const d=Math.abs(da[i]-db[i])+Math.abs(da[i+1]-db[i+1])+Math.abs(da[i+2]-db[i+2]);if(d>60){n++;const px=(i/4)%c.width,py=Math.floor(i/4/c.width);if(Math.abs(px-cx)>140||Math.abs(py-cy)>220){far++;const k=Math.floor(px/175)+','+Math.floor(py/160);grid[k]=(grid[k]||0)+1}if(db[i]>200&&db[i+1]>200&&db[i+2]>200)bright++}}return {changed:n,farFromCharacter:far,brightNow:bright,cells:Object.entries(grid).sort((a,b)=>b[1]-a[1]).slice(0,4)}};true`);
for(const s of scenario.steps){
 if(s.reload){await cdp('Page.navigate',{url:BASE+'/?debug'});for(let i=0;i<160;i++){if(await run(`!!window.__city&&!!document.getElementById('menuDev')`))break;await sleep(500)}await run(`document.getElementById('start').click();true`);await sleep(1500)}
 if(s.eval)await run(s.eval);
 if(s.log)console.log(s.name||'log',JSON.stringify(await run(s.log)));
 if(s.minutes!==undefined)await run(`__city.GameState.progress.routine.minutes=${s.minutes};true`);
 if(s.x!==undefined)await run(`__city.place(${s.x},${s.z});true`);
 if(s.yaw!==undefined||s.pitch!==undefined||s.zoom!==undefined)await run(`__city.view(${s.yaw??'undefined'},${s.pitch??'undefined'},${s.zoom??'undefined'});true`);
 await sleep(s.wait??2500);
 if(s.measure){ // mean colour of a ground patch over several frames with the camera nudged a hair each time: z-fighting makes it jump between layers
  await run(`window.__patch=async(b64,x0,y0,w,h)=>{const i=await new Promise(r=>{const im=new Image();im.onload=()=>r(im);im.src='data:image/png;base64,'+b64});const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);const d=x.getImageData(x0,y0,w,h).data;let r=0,g=0,b=0,n=d.length/4,min=999,max=0;for(let k=0;k<d.length;k+=4){r+=d[k];g+=d[k+1];b+=d[k+2];const l=d[k]+d[k+1]+d[k+2];if(l<min)min=l;if(l>max)max=l}return {r:Math.round(r/n),g:Math.round(g/n),b:Math.round(b/n),spread:max-min}};true`);
  const out=[];for(let i=0;i<s.measure;i++){await run(`__city.view(${s.yaw??0}+${i}*0.0007,${s.pitch??1.2},${s.zoom??9});true`);await sleep(700);out.push(await run(`__patch(${JSON.stringify(await shotB64())},${s.patch.join(',')})`))}
  console.log(s.name,JSON.stringify(out));
 } if(s.flicker){const frames=[];for(let i=0;i<s.flicker;i++){frames.push(await shotB64());await sleep(150)}
  const res=[];for(let i=1;i<frames.length;i++)res.push(await run(`__diff(${JSON.stringify(frames[i-1])},${JSON.stringify(frames[i])})`));
  console.log(s.name,'frame diffs',JSON.stringify(res));await writeFile(`${out}/${s.name}.png`,Buffer.from(frames.at(-1),'base64'))}
 else if(s.name){await writeFile(`${out}/${s.name}.png`,Buffer.from(await shotB64(),'base64'));console.log('shot',s.name)}
}
ws.close();proc.kill();process.exit(0);
