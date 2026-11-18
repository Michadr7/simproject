// talk-bug (2026-11-18, testers on 0.35.20: "Talk to Noah/Elena", E, nothing shows, no console error). Root cause: dist/index.html had <section id="talk"> nested
// INSIDE the hidden #settings, so the docked panel opened (game state said talking) but a hidden ancestor kept it from rendering. The Node DOM in boot-game.mjs has
// no nesting, so the game tests could not see it. This test builds the REAL tree of dist/index.html and checks that, once createTalkPanel has run and show() is
// called, no ancestor of #talk is hidden (and the panel is at body level).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createTalkPanel,BYE_ID} from '../dist/talk-panel.js';

class Node{
 constructor(tag,doc,attrs={}){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.attrs=attrs;this.listeners={};this.style={};this.hidden='hidden' in attrs;this.id=attrs.id||'';this.className=attrs.class||'';this._text='';this.parentNode=null;
  const self=this;this.classList={_s:new Set(),add(c){this._s.add(c)},toggle(c,f){f?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)||self.className.split(/\s+/).includes(c)}}}
 set textContent(v){this._text=String(v);if(v==='')this.children=[]}
 get textContent(){return this._text}
 appendChild(c){if(c.parentNode)c.remove();c.parentNode=this;this.children.push(c);return c}
 remove(){const p=this.parentNode;if(p)p.children=p.children.filter(c=>c!==this);this.parentNode=null}
 setAttribute(k,v){this.attrs[k]=String(v)}
 addEventListener(t,f){this.listeners[t]=f}
 focus(){this.ownerDocument.active=this}
}
// A small tolerant HTML tree builder: enough for index.html (void elements, self-closing SVG, raw <script>/<style>, comments).
const VOID=new Set(['area','base','br','col','embed','hr','img','input','link','meta','source','track','wbr']);
function parse(html,doc){
 const top=new Node('#root',doc),stack=[top],re=/<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;let m;
 while((m=re.exec(html))){
  if(!m[2])continue;const tag=m[2].toLowerCase();
  if(m[1]){const i=stack.map(n=>n.tagName).lastIndexOf(tag);if(i>0)stack.length=i;continue}
  const attrs={};for(const a of m[3].matchAll(/([^\s=\/]+)(?:="([^"]*)"|='([^']*)')?/g))attrs[a[1].toLowerCase()]=a[2]??a[3]??'';
  const n=stack.at(-1).appendChild(new Node(tag,doc,attrs));
  if(tag==='script'||tag==='style'){const end=html.indexOf('</'+tag,re.lastIndex);re.lastIndex=end<0?html.length:end;continue}
  if(!VOID.has(tag)&&!/\/\s*$/.test(m[3]))stack.push(n);
 }
 return top;
}
const find=(n,pred)=>{if(pred(n))return n;for(const c of n.children){const f=find(c,pred);if(f)return f}return null};
const chain=n=>{const out=[];for(let p=n.parentNode;p;p=p.parentNode)out.push(p);return out};
const label=n=>n.tagName+(n.id?'#'+n.id:'')+(n.className?'.'+n.className.split(/\s+/)[0]:'');

const doc={active:null,createElement:t=>new Node(t,doc)};
const tree=parse(fs.readFileSync('dist/index.html','utf8'),doc);
doc.body=find(tree,n=>n.tagName==='body');
assert(doc.body,'index.html has a body');
const root=find(tree,n=>n.id==='talk');
assert(root,'index.html has #talk');
for(const id of ['settings','controls','dialog','welcome'])assert(!find(doc.body,n=>n.id===id)||!chain(find(doc.body,n=>n.id===id)).some(p=>p===root),'#'+id+' is not inside #talk');

const panel=createTalkPanel(root,{onPick(){},onClose(){}});
panel.show({name:'Noah',chip:'Stranger',lines:[{who:'noah',text:'Welcome in!'}],replies:[{id:'a',label:'Any work going?',asked:false},{id:BYE_ID,label:'See you',asked:false}]});
assert.equal(root.hidden,false,'show() un-hides #talk');
const hiddenAbove=chain(root).filter(p=>p.hidden);
assert.deepEqual(hiddenAbove.map(label),[],'no hidden ancestor may keep the open talk panel from rendering (it sat inside '+chain(root).map(label).join(' < ')+')');
assert.equal(root.parentNode,doc.body,'the panel sits at body level');
assert.equal(doc.active?.tagName,'button','the first reply has focus');
// a panel already at body level stays where it is (nothing moves twice)
{const d2={active:null,createElement:t=>new Node(t,d2)};d2.body=new Node('body',d2);const r2=d2.body.appendChild(new Node('section',d2,{id:'talk',hidden:''}));const before=d2.body.children.length;createTalkPanel(r2,{});assert.equal(r2.parentNode,d2.body);assert.equal(d2.body.children.length,before)}
// a document without a usable body (the boot-game stub) is left alone
{const d3={active:null,createElement:t=>new Node(t,d3),body:{appendChild:undefined}};const host=new Node('div',d3),r3=host.appendChild(new Node('section',d3));createTalkPanel(r3,{});assert.equal(r3.parentNode,host)}
console.log('PASS talk-stuck.mjs: the docked talk panel renders in the real index.html tree (no hidden ancestor such as #settings), sits at body level, and a panel already there is not moved.');
