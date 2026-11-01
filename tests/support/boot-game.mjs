// Boots the real packaged game (the release dist/index.html points at) in Node with a synthetic DOM and a renderer stub, like startup.mjs.
// Not a test itself: it lives in tests/support so run-tests.mjs (which only reads tests/*.mjs) leaves it alone.
import {mkdtemp,readFile,writeFile,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';

export class El extends EventTarget{
 constructor(tag='div'){super();this.tag=tag;this.hidden=false;this.value='';this.children=[];this.dataset={};this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){}};this.selectors=new Map()}
 append(...els){this.children.push(...els)}replaceChildren(...els){this.children=[...els]}setAttribute(k,v){this[k]=v}querySelector(s){if(!this.selectors.has(s))this.selectors.set(s,new El());return this.selectors.get(s)}focus(){}matches(s){return ['input','textarea','select'].includes(this.tag)}setCustomValidity(){}reportValidity(){}setPointerCapture(){}click(){this.onclick?.({preventDefault(){}})}
 getBoundingClientRect(){return {left:0,top:0,width:1400,height:900}}
 getContext(){return new Proxy({measureText:t=>({width:t.length*20})},{get:(o,k)=>o[k]??(()=>{})})}
}

// position: a saved player position, or null for none. play: press Play once the game has loaded. editRelease(dir): change the copied release before it loads.
export async function bootGame({position=null,play=true,editRelease=async()=>{}}={}){
 const html=await readFile('dist/index.html','utf8');
 const dir=await mkdtemp(join(tmpdir(),'city-boot-'));
 const release=html.match(/import\('\.\/(releases\/[^/]+)\/game\.js'/)[1];
 await cp('dist/'+release,dir,{recursive:true});
 const threeURL=pathToFileURL(resolve('dist/vendor/three.module.js')).href;
 await writeFile(join(dir,'vendor/three.module.js'),`export * from '${threeURL}';export class WebGLRenderer{constructor(){this.shadowMap={}}setPixelRatio(){}setSize(){}setViewport(){}clear(){}render(scene){globalThis.__renderScene=scene}}`);
 await editRelease(dir);
 const ids=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new El(m[1]==='characterName'?'input':'div')]));
 const created=[],doc=new EventTarget();
 doc.getElementById=id=>ids.get(id)||null;doc.createElement=tag=>{const e=new El(tag);created.push(e);return e};doc.body=new El();doc.querySelectorAll=()=>[];doc.hidden=false;
 const win=new EventTarget();win.matches=()=>false;const store=new Map();
 store.set('citylife.character.v1',JSON.stringify({version:1,appearance:{name:'Tester'}}));
 store.set('citylife.progress.v1',JSON.stringify({version:1,progress:{cash:1000,completed:0,phase:'available',...(position?{position}:{})}}));
 let nextFrame;Object.assign(globalThis,{document:doc,window:win,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},innerWidth:1400,innerHeight:900,devicePixelRatio:1,requestAnimationFrame:fn=>{nextFrame=fn}});
 await import(pathToFileURL(join(dir,'game.js')).href);
 const {GameState}=await import(pathToFileURL(join(dir,'state.js')).href);
 nextFrame(performance.now()+16);if(play)ids.get('start').click();
 let simTime=performance.now()+100;
 const pump=seconds=>{for(let i=0;i<seconds*25;i++){simTime+=40;nextFrame(simTime)}};
 const send=(type,code)=>{const e=new Event(type,{cancelable:true});e.code=code;win.dispatchEvent(e);return e};
 const find=id=>ids.get(id)||created.find(e=>e.id===id)||null; // an element from the page, or one the game created
 const scene=()=>globalThis.__renderScene;
 return {GameState,pump,send,ids,find,created,win,store,dir,scene,done:()=>rm(dir,{recursive:true,force:true})};
}
