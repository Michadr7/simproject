// Logging tutorial overlay and trigger rules (timber-redesign-design.md T-C).
import assert from 'node:assert/strict';
import {STEPS,CARRY_RULES,CARRY_TEXT,shouldShow,markSeen,buildOverlay,bindClose} from '../dist/logging-tutorial.js';
import {HANDS_SPEED,PLANKS_PER_STACK} from '../dist/carry.js';
import {SAW_SECONDS_PER_LOG,SAW_SECONDS_PER_TRUNK,TRUNK_TO_LOGS,TRUNK_TO_SLABS,LOGS_TO_PLANKS} from '../dist/plank-economy.js';

class Node{
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.attrs={};this.listeners={};this.style={};this.className='';this.id='';this._text='';this.type='';this.parent=null}
 set textContent(v){this._text=String(v)}
 get textContent(){return this._text+this.children.map(c=>c.textContent).join('')}
 appendChild(c){c.parent=this;this.children.push(c);return c}
 setAttribute(k,v){this.attrs[k]=String(v);if(k==='class')this.className=String(v);if(k==='id')this.id=String(v)}
 addEventListener(t,f){if(!this.listeners[t])this.listeners[t]=new Set();this.listeners[t].add(f)}
 removeEventListener(t,f){this.listeners[t]?.delete(f)}
 focus(){if(this.ownerDocument)this.ownerDocument.activeElement=this}
 contains(target){let p=target;while(p){if(p===this)return true;p=p.parent}return false}
}
function makeDoc(){
 const listeners={};
 const doc={
  listeners,
  activeElement:null,
  body:{tagName:'body',children:[]},
  createElement(t){return new Node(t,this)},
  createElementNS(_ns,t){return new Node(t,this)},
  createTextNode(t){const n=new Node('#text',this);n.textContent=t;return n},
  addEventListener(t,f){if(!listeners[t])listeners[t]=new Set();listeners[t].add(f)},
  removeEventListener(t,f){listeners[t]?.delete(f)},
  emitKey(key,code,shiftKey=false){let prevented=false;for(const f of [...(listeners.keydown||[])])f({key,code,shiftKey,preventDefault(){prevented=true}});return prevented},
  emitFocusIn(target){for(const f of [...(listeners.focusin||[])])f({target})}
 };
 return doc;
}
const find=(n,pred,out=[])=>{if(pred(n))out.push(n);for(const c of n.children)find(c,pred,out);return out};
const hasCls=(n,c)=>typeof n.className==='string'&&n.className.split(/\s+/).includes(c);

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
assert.equal(overlay.attrs['aria-modal'],'true');
assert.equal(overlay.attrs['aria-labelledby'],'lt-title');
const titleEl=find(overlay,n=>n.id==='lt-title');
assert.equal(titleEl.length,1,'title matches aria-labelledby');
const steps=find(overlay,n=>hasCls(n,'lt-step'));
assert.equal(steps.length,4,'overlay has 4 steps');
assert.deepEqual(steps.map(s=>s.attrs['data-step']),['fell','buck','saw','haul']);
const svgs=find(overlay,n=>n.tagName==='svg');
assert.ok(svgs.length>=10,'overlay renders inline SVGs for steps');
const closeBtns=find(overlay,n=>hasCls(n,'lt-close'));
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
 const d=makeDoc(),el=buildOverlay(d),btn=find(el,n=>hasCls(n,'lt-close'))[0];
 let calls=0;
 bindClose(el,d,()=>{calls++});
 trigger.fire(d,btn);
 trigger.fire(d,btn);
 assert.equal(calls,1,`${trigger.name} calls onClose once`);
}

// 6. 10 repeats of open/close leave no leaked listeners
const d10=makeDoc();
for(let i=0;i<10;i++){
 const el=buildOverlay(d10),btn=find(el,n=>hasCls(n,'lt-close'))[0];
 let calls=0;
 bindClose(el,d10,()=>{calls++});
 if(i%2===0)d10.emitKey('Escape','Escape');
 else for(const f of [...btn.listeners.click])f();
 assert.equal(calls,1);
 assert.equal(btn.listeners.click?.size||0,0,'no leaked click listeners on close button');
}
assert.equal(d10.listeners.keydown?.size||0,0,'no leaked keydown listeners on document after 10 open/close cycles');
assert.equal(d10.listeners.focusin?.size||0,0,'no leaked focusin listeners on document after 10 open/close cycles');

// 7. Header badge, goal, connected rail, step facts, and keycap styling
assert.equal(find(overlay,n=>hasCls(n,'lt-badge')).length,1,'header renders Ridgeline badge SVG');
assert.ok(find(overlay,n=>hasCls(n,'lt-goal'))[0].textContent.includes('From tree to truck in 4 steps'),'header shows goal line');
const railItems=find(overlay,n=>hasCls(n,'lt-rail-item'));
assert.deepEqual(railItems.map(r=>r.attrs['data-step']),['fell','buck','saw','haul'],'step rail connects all 4 steps');
const kbds=find(overlay,n=>n.tagName==='kbd'&&hasCls(n,'lt-kbd')).map(k=>k.textContent);
assert.deepEqual(kbds,['Esc','Enter','Space','E'],'hint uses keycap elements for close keys');
const overlayText=overlay.textContent;
for(const expected of [`${TRUNK_TO_LOGS} Logs`,`${LOGS_TO_PLANKS} Boards`,`${SAW_SECONDS_PER_LOG} s`,`${TRUNK_TO_SLABS} Slabs`,`${SAW_SECONDS_PER_TRUNK} s`,`${PLANKS_PER_STACK} per stack`]){
 assert.ok(overlayText.includes(expected),`overlay text includes constant-backed value "${expected}"`);
}

// 8. Carry-speed meter row derives bars and percentages from HANDS_SPEED
const meters=find(overlay,n=>n.attrs.role==='meter');
assert.equal(meters.length,4,'carry section has 4 speed meters');
const expectedSpeeds=[HANDS_SPEED.trunk,HANDS_SPEED.log,HANDS_SPEED.logs2,HANDS_SPEED.slab].map(v=>Math.round(v*100));
assert.deepEqual(meters.map(m=>Number(m.attrs['aria-valuenow'])),expectedSpeeds,'meter aria-valuenow matches HANDS_SPEED');
const fills=find(overlay,n=>hasCls(n,'lt-bar-fill'));
assert.deepEqual(fills.map(f=>f.style.width),expectedSpeeds.map(v=>`${v}%`),'meter bar widths match HANDS_SPEED');

// 9. Every SVG has aria-hidden="true" or a non-empty <title>
for(const svg of svgs){
 const hasHidden=svg.attrs['aria-hidden']==='true';
 const title=find(svg,n=>n.tagName==='title'&&n.textContent.trim().length>0);
 assert.ok(hasHidden||title.length>0,'every SVG has aria-hidden="true" or a <title>');
}

// 10. Focus handling: focuses Close on open, traps Tab/Shift+Tab & external focusin, restores previous focus
{
 const fd=makeDoc();
 const triggerBtn=fd.createElement('button');
 triggerBtn.focus();
 const el=buildOverlay(fd);
 const closeBtn=find(el,n=>hasCls(n,'lt-close'))[0];
 const outside=fd.createElement('button');
 let closed=0;
 bindClose(el,fd,()=>{closed++});
 assert.equal(fd.activeElement,closeBtn,'opening focuses the Close button');
 assert.equal(fd.emitKey('Tab','Tab',false),true,'Tab is handled inside overlay');
 assert.equal(fd.activeElement,closeBtn,'Tab keeps focus trapped on Close');
 assert.equal(fd.emitKey('Tab','Tab',true),true,'Shift+Tab is handled inside overlay');
 assert.equal(fd.activeElement,closeBtn,'Shift+Tab keeps focus trapped on Close');
 fd.emitFocusIn(outside);
 assert.equal(fd.activeElement,closeBtn,'focusin outside overlay returns focus inside');
 assert.equal(closed,0,'Tab and focusin do not close overlay');
 fd.emitKey('Escape','Escape');
 assert.equal(closed,1,'Escape closes overlay');
 assert.equal(fd.activeElement,triggerBtn,'closing restores previous focus');
 assert.equal(fd.listeners.keydown?.size||0,0,'keydown listener cleaned up');
 assert.equal(fd.listeners.focusin?.size||0,0,'focusin listener cleaned up');
}

console.log('PASS logging-tutorial');
