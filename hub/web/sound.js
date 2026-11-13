// Mikkadr Hub 2.6: the hub's sounds. Generated in the browser (Web Audio, no file), OFF by default, and every sound has its own switch.
//   finished  the hub finished something: a chat reply, a run, or a tool such as the tests
//   needs     something now waits for you: a question, a second yes
//   stopped   a run ended short (cap, limit, error)
// The pure rules come first so tests can import them. A sound plays once per change and never repeats while the state holds. It reads the activity answer the corner bot already polls; it makes no request.
export const SOUNDS=Object.freeze([
 {key:'finished',label:'Finished',about:'Two rising notes when the hub finishes something: a chat reply, a run, a tool such as the tests.',notes:[[659,0],[880,.17]]},
 {key:'needs',label:'Needs you',about:'Two high notes when something starts waiting for you: a question, a second yes.',notes:[[880,0],[1175,.15],[880,.3]]},
 {key:'stopped',label:'Stopped',about:'Two low notes when a run ends short: its allowance, a limit, an error.',notes:[[330,0],[247,.2]]}]);
export const DEFAULTS=Object.freeze({on:false,finished:true,needs:true,stopped:true});
export const COOLDOWN_MS=15000; // the same sound never plays twice within this time (an index rebuild right after a run must not chime again)

// What the stored settings say, with anything unknown or broken replaced by the default.
export function readSettings(raw){
 let j=null;try{j=JSON.parse(raw)}catch{}
 const s={...DEFAULTS};if(j&&typeof j==='object')for(const k of Object.keys(DEFAULTS))if(typeof j[k]==='boolean')s[k]=j[k];
 return s}
// The one rule: which sound (or none) a change from `before` to `after` deserves. Both are activity answers ({mood, jobRunning, facts:{asks}}). The first answer after the page opens never sounds.
export function soundFor(before,after){
 if(!before||!after)return null;
 const asks=a=>a&&a.facts&&Number.isFinite(a.facts.asks)?a.facts.asks:0,busy=a=>a.mood==='working'||!!a.jobRunning;
 if(asks(after)>asks(before))return 'needs';
 if(before.mood==='working'&&after.mood==='stopped')return 'stopped';
 if(busy(before)&&!busy(after)&&after.mood!=='question'&&after.mood!=='stopped')return 'finished';
 return null}
// May it play now? The master switch, the sound's own switch, and the cooldown.
export const shouldPlay=(kind,settings,lastAt,now)=>!!kind&&!!settings&&settings.on===true&&settings[kind]===true&&!(Number.isFinite(lastAt)&&now-lastAt<COOLDOWN_MS);

export function mountSound(box,{store=null,win=window,doc=document}={}){
 const settings=readSettings(store?store.get('hub.sound'):null),last={};let ac=null,prev=null;
 const save=()=>{if(store)store.set('hub.sound',JSON.stringify(settings))};
 const h=(tag,props={},...kids)=>{const e=doc.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='class')e.className=v;else e.setAttribute(k,v)}e.append(...kids);return e};
 // browsers keep sound locked until the page has been clicked: the first click on this panel (or anywhere) opens it
 const unlock=()=>{try{ac=ac||new (win.AudioContext||win.webkitAudioContext)();if(ac.state==='suspended')ac.resume()}catch{ac=null}};
 function tone(kind){
  const def=SOUNDS.find(s=>s.key===kind);if(!def)return;unlock();if(!ac)return;
  const t0=ac.currentTime;
  for(const [f,d] of def.notes){const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.0001,t0+d);g.gain.linearRampToValueAtTime(.06,t0+d+.02);g.gain.exponentialRampToValueAtTime(.0001,t0+d+.8);o.connect(g);g.connect(ac.destination);o.start(t0+d);o.stop(t0+d+.85)}}
 const det=h('details',{class:'soundbox'}),sum=h('summary',{}),body=h('div',{class:'soundbody'});det.append(sum,body);
 const master=h('input',{type:'checkbox',id:'snd-on'});master.checked=settings.on;
 body.append(h('label',{class:'snd-row snd-master'},master,h('span',{},h('b',{},'Sound'),h('span',{class:'small dim'},' The master switch. Off, nothing ever plays.'))));
 const boxes={};
 for(const s of SOUNDS){const cb=h('input',{type:'checkbox'});cb.checked=settings[s.key];boxes[s.key]=cb;
  const test=h('button',{class:'btn',type:'button'},'Play');test.addEventListener('click',()=>tone(s.key));
  cb.addEventListener('change',()=>{settings[s.key]=cb.checked;save()});
  body.append(h('div',{class:'snd-row'},h('label',{},cb,h('span',{},h('b',{},s.label),h('span',{class:'small dim'},' '+s.about))),test))}
 const draw=()=>{sum.textContent='Sound: '+(settings.on?'on':'off');for(const k of Object.keys(boxes))boxes[k].disabled=!settings.on};
 master.addEventListener('change',()=>{settings.on=master.checked;if(settings.on)unlock();save();draw()});
 det.addEventListener('click',unlock);
 draw();box.append(det);
 return {
  settings,
  // called with every activity answer the bot reads
  observe(a){const kind=soundFor(prev,a);prev=a&&typeof a==='object'?a:prev;const now=Date.now();if(shouldPlay(kind,settings,last[kind],now)){last[kind]=now;tone(kind)}},
  play:tone,
  unmount(){det.remove()}}}
