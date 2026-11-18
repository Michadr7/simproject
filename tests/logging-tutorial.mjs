// Logging tutorial overlay and trigger rules (timber-redesign-design.md T-C).
import assert from 'node:assert/strict';
import {STEPS,CARRY_RULES,CARRY_TEXT,shouldShow,markSeen,buildOverlay,bindClose} from '../dist/logging-tutorial.js';
import {SAW_SECONDS_PER_LOG,SAW_SECONDS_PER_TRUNK} from '../dist/plank-economy.js';

class Node{
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.attrs={};this.listeners={};this.style={};this.className='';this.id='';this._text='';this.type=''}
 set textContent(v){this._text=String(v)}
 get textContent(){return this._text}
 appendChild(c){this.children.push(c);return c}
 setAttribute(k,v){this.attrs[k]=String(v);if(k==='class')this.className=String(v)}
 addEventListener(t,f){if(!this.listeners[t])this.listeners[t]=new Set();this.listeners[t].add(f)}
 removeEventListener(t,f){this.listeners[t]?.delete(f)}
}
function makeDoc(){
 const listeners={};
 return {
  listeners,
  createElement(t){return new Node(t,this)},
  createElementNS(_ns,t){return new Node(t,this)},
  addEventListener(t,f){if(!listeners[t])listeners[t]=new Set();listeners[t].add(f)},
  removeEventListener(t,f){listeners[t]?.delete(f)},
  emitKey(key,code){let prevented=false;for(const f of [...(listeners.keydown||[])])f({key,code,preventDefault(){prevented=true}});return prevented}
 };
}
const find=(n,pred,out=[])=>{if(pred(n))out.push(n);for(const c of n.children)find(c,pred,out);return out};

// 1. shouldShow on fresh save, after markSeen, and for a veteran
assert.equal(shouldShow({}),true,'fresh save shows tutorial');
assert.equal(shouldShow({tutorial:{loggingSeen:false}}),true,'explicit false shows tutorial');
assert.equal(shouldShow({careers:{ridgeline:{hired:true,shifts:5}}}),true,'veteran without tutorial flag sees it once');

// 2. markSeen purity (input not mutated, tutorial key preserved)
const orig={cash:2500,tutorial:{otherFlag:42}};
const next=markSeen(orig);
assert.equal(orig.tutorial.loggingSeen,undefined,'input progress.tutorial not mutated');
assert.equal(orig.cash,2500,'input cash untouched');
assert.equal(next.tutorial.loggingSeen,true,'loggingSeen set to true');
assert.equal(next.tutorial.otherFlag,42,'existing tutorial keys preserved');
assert.equal(shouldShow(next),false,'shouldShow is false after markSeen');

// 3. carry text uses real numbers from carry.js and saw times from plank-economy.js
for(const pct of ['60%','95%','90%','80%']){
 assert.ok(CARRY_TEXT.includes(pct),`CARRY_TEXT includes ${pct}`);
}
assert.equal(CARRY_RULES.length,5);
assert.ok(STEPS[2].desc.includes(`${SAW_SECONDS_PER_LOG} s`),'saw step uses SAW_SECONDS_PER_LOG');
assert.ok(STEPS[2].desc.includes(`${SAW_SECONDS_PER_TRUNK} s`),'saw step uses SAW_SECONDS_PER_TRUNK');

// 4. buildOverlay has the 4 steps, inline SVGs, and the Close button
const doc=makeDoc();
const overlay=buildOverlay(doc);
assert.equal(overlay.id,'logging-tutorial');
assert.equal(overlay.attrs.role,'dialog');
const steps=find(overlay,n=>n.className.split(/\s+/).includes('lt-step'));
assert.equal(steps.length,4,'overlay has 4 steps');
assert.deepEqual(steps.map(s=>s.attrs['data-step']),['fell','buck','saw','haul']);
const svgs=find(overlay,n=>n.tagName==='svg');
assert.ok(svgs.length>=10,'overlay renders inline SVGs for steps');
const closeBtns=find(overlay,n=>n.className.split(/\s+/).includes('lt-close'));
assert.equal(closeBtns.length,1,'overlay has Close button');
assert.equal(closeBtns[0].type,'button');

// 5. Escape / Enter / Space / E / Close each call onClose once
for(const trigger of [
 {name:'Escape',fire:d=>d.emitKey('Escape','Escape')},
 {name:'Enter',fire:d=>d.emitKey('Enter','Enter')},
 {name:'Space',fire:d=>d.emitKey(' ','Space')},
 {name:'E',fire:d=>d.emitKey('e','KeyE')},
 {name:'Close',fire:(_d,b)=>{for(const f of [...b.listeners.click])f()}}
]){
 const d=makeDoc(),el=buildOverlay(d),btn=find(el,n=>n.className.split(/\s+/).includes('lt-close'))[0];
 let calls=0;
 bindClose(el,d,()=>{calls++});
 trigger.fire(d,btn);
 trigger.fire(d,btn);
 assert.equal(calls,1,`${trigger.name} calls onClose once`);
}

// 6. 10 repeats of open/close leave no leaked listeners
const d10=makeDoc();
for(let i=0;i<10;i++){
 const el=buildOverlay(d10),btn=find(el,n=>n.className.split(/\s+/).includes('lt-close'))[0];
 let calls=0;
 bindClose(el,d10,()=>{calls++});
 if(i%2===0)d10.emitKey('Escape','Escape');
 else for(const f of [...btn.listeners.click])f();
 assert.equal(calls,1);
 assert.equal(btn.listeners.click?.size||0,0,'no leaked click listeners on close button');
}
assert.equal(d10.listeners.keydown?.size||0,0,'no leaked keydown listeners on document after 10 open/close cycles');

console.log('PASS logging-tutorial');
