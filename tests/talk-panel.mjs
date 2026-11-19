import assert from 'node:assert/strict';
import {createTalkPanel,TRANSCRIPT_MAX,BYE_ID,TYPING_MS} from '../dist/talk-panel.js';

// C5: the talk panel DOM module. A minimal stub of ONLY the DOM methods the module uses (not the game).
class Node{
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.attrs={};this.listeners={};this.style={};this.hidden=false;this.className='';this._text='';this.scrollTop=0;this.scrollHeight=0;this.parent=null;
  const self=this;this.classList={_s:new Set(),add(c){this._s.add(c)},toggle(c,f){f?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)||self.className.split(/\s+/).includes(c)}}}
 set textContent(v){this._text=String(v);if(v==='')this.children=[]}
 get textContent(){return this._text}
 appendChild(c){c.parent=this;this.children.push(c);return c}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this)}
 setAttribute(k,v){this.attrs[k]=String(v)}
 addEventListener(t,f){this.listeners[t]=f}
 focus(){this.ownerDocument.active=this}
}
const doc={active:null,createElement:t=>new Node(t,doc)};
const root=new Node('section',doc);
const picks=[];let closed=0;
const timers=new Map();let nextTid=1;
const fakeTimer={setTimeout(fn,ms){const id=nextTid++;timers.set(id,{fn,ms});return id},clearTimeout(id){timers.delete(id)}};
const flushTimers=()=>{for(const [id,t] of [...timers]){timers.delete(id);t.fn()}};
const panel=createTalkPanel(root,{onPick:id=>picks.push(id),onClose:()=>{closed++},timer:fakeTimer});
const byClass=(n,c,out=[])=>{if(n.className.split(/\s+/).includes(c))out.push(n);n.children.forEach(k=>byClass(k,c,out));return out};
const log=()=>byClass(root,'talk-log')[0],btns=()=>byClass(root,'talk-reply');
const labels=()=>btns().map(b=>b.children[1].textContent);

assert.equal(root.hidden,true,'hidden until show');
assert.equal(panel.handleKey('1'),false,'keys ignored while closed');
panel.show({name:'Noah',chip:'Friend · cheerful',lines:[{who:'noah',text:'Morning!'},{who:'noah',text:'Coffee?'}],replies:[{id:'a',label:'Any work going?',asked:false},{id:'b',label:'How is the shop?',asked:true},{id:BYE_ID,label:'See you',asked:false}]});
assert.equal(root.hidden,false);assert.ok(panel.isOpen());
assert.equal(byClass(root,'talk-name')[0].textContent,'Noah');
assert.equal(byClass(root,'talk-portrait')[0].textContent,'N','portrait initial badge');
assert.ok(byClass(root,'talk-portrait')[0].style.backgroundColor,'portrait colour set');
assert.equal(byClass(root,'talk-chip-text')[0].textContent,'Friend','friendly chip label');
assert.ok(byClass(root,'talk-mood-dot')[0].style.backgroundColor,'mood dot colour set');
assert.equal(byClass(root,'talk-typing')[0].hidden,false,'typing beat visible before timer fires');
assert.ok(log().children[0].className.includes('typing'),'NPC line waits for typing beat');
assert.equal([...timers.values()][0].ms,TYPING_MS,'typing beat uses 350 ms');
assert.equal(log().children.length,2);
assert.deepEqual(labels(),['Any work going?','How is the shop?','See you'],'options are never held back by typing beat');
flushTimers();
assert.equal(byClass(root,'talk-typing')[0].hidden,true,'typing beat hides when timer fires');
assert.ok(!log().children[0].className.includes('typing'),'NPC line reveals after beat');
assert.ok(btns().every(b=>b.tagName==='button'&&b.type==='button'),'replies are real buttons');
assert.ok(btns()[1].className.includes('asked'),'asked reply is dimmed, not hidden');
assert.equal(doc.active,btns()[0],'first reply has focus');

panel.focusNext();assert.equal(doc.active,btns()[1]);
panel.focusPrev();panel.focusPrev();assert.equal(doc.active,btns()[2],'wraps to See you');
panel.focusNext();panel.confirm();assert.deepEqual(picks,['a']);
assert.equal(panel.handleKey('2'),true);assert.deepEqual(picks,['a','b'],'number picks');
panel.handleKey('ArrowDown');panel.handleKey('Enter');assert.deepEqual(picks,['a','b',BYE_ID],'Down then Enter');
panel.handleKey('9');assert.equal(picks.length,3,'number past the list does nothing');
btns()[0].listeners.click();assert.equal(picks.at(-1),'a','click picks');

panel.append({who:'you',text:'Any work going?'});panel.append({who:'system',text:'x'.repeat(220)});panel.append({who:'noah',text:''});
assert.equal(log().children.length,4,'empty lines are ignored');
assert.ok(log().children[2].className.includes('you'));assert.ok(log().children[3].className.includes('system'));
for(let i=0;i<10;i++)panel.append({who:'noah',text:'line '+i});
assert.equal(log().children.length,TRANSCRIPT_MAX,'transcript keeps the last 6');
assert.equal(log().children.at(-1).textContent,'line 9');
assert.equal(panel.speaker(),'noah');

panel.setReplies([{id:'z',label:'Right.',asked:false}]);
assert.equal(btns().length,1);
panel.setReplies([]);assert.deepEqual(labels(),['Continue'],'ended talk offers Continue');
panel.confirm();assert.equal(closed,1);assert.equal(root.hidden,true);assert.equal(btns().length,0);

panel.show({name:'Hal',lines:[],replies:[{id:'a',label:'Hi',asked:false},{id:BYE_ID,label:'See you',asked:false}]});
const n=picks.length;panel.handleKey('Escape');assert.equal(picks.at(-1),BYE_ID);assert.equal(picks.length,n+1,'Escape says See you when offered');
panel.setReplies([]);panel.leave();assert.equal(closed,2,'leave closes when no bye is offered');
panel.close();assert.equal(closed,2,'close is idempotent');
panel.show({name:'Hal',replies:[{id:'a',label:'Hi'}]});
panel.moveChevron(10.4,20.6,true);assert.equal(byClass(root,'talk-chevron')[0].style.transform,'translate3d(10px,21px,0)');
panel.moveChevron(0,0,false);assert.equal(byClass(root,'talk-chevron')[0].hidden,true);
panel.setChip('Stranger · good');
assert.equal(byClass(root,'talk-chip-text')[0].textContent,'New face','Stranger maps to New face');
panel.append({who:'noah',text:'Still here!'});
assert.equal(byClass(root,'talk-typing')[0].hidden,false,'typing beat starts on NPC append');
panel.append({who:'you',text:'Got it.'});
assert.equal(byClass(root,'talk-typing')[0].hidden,true,'player echo flushes pending typing beat');
panel.handleKey('q');assert.equal(closed,3);
console.log('PASS talk-panel');
