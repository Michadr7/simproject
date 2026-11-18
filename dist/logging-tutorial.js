// logging-tutorial.js: 4-step logging guide overlay (timber-redesign-design.md T-C)
import {HANDS_SPEED,PLANKS_PER_STACK} from './carry.js';
import {SAW_SECONDS_PER_LOG,SAW_SECONDS_PER_TRUNK,TRUNK_TO_LOGS,TRUNK_TO_SLABS,LOGS_TO_PLANKS} from './plank-economy.js';

const pct=v=>Math.round(v*100)+'%';
const SVG_NS='http://www.w3.org/2000/svg';

export const CARRY_RULES=Object.freeze([
 `Trunk: ${pct(HANDS_SPEED.trunk)} speed (no sprint)`,
 `1 Log: ${pct(HANDS_SPEED.log)} speed`,
 `2 Logs: ${pct(HANDS_SPEED.logs2)} speed`,
 `Slab: ${pct(HANDS_SPEED.slab)} speed`,
 `Boards: ${PLANKS_PER_STACK} per stack`
]);
export const CARRY_TEXT=CARRY_RULES.join(' · ');

export const STEPS=Object.freeze([
 Object.freeze({id:'fell',num:1,title:'Fell',icons:['pine','+','tool','→','trunk'],desc:'Chop a marked pine to drop 1 heavy Trunk.'}),
 Object.freeze({id:'buck',num:2,title:'Buck',icons:['trunk','+','tool','→','logs2'],desc:`Cut a Trunk into ${TRUNK_TO_LOGS} Logs. Chainsaws cut faster.`}),
 Object.freeze({id:'saw',num:3,title:'Saw',icons:['log','→','saw','→','boards4','|','trunk','→','slabs2'],desc:`Logs make ${LOGS_TO_PLANKS} Boards (${SAW_SECONDS_PER_LOG} s); Trunks make ${TRUNK_TO_SLABS} Slabs (${SAW_SECONDS_PER_TRUNK} s).`}),
 Object.freeze({id:'haul',num:4,title:'Haul & Sell',icons:['truck','→','warehouse'],desc:'Stack at the shed or haul to the lumberyard & warehouse.'})
]);

export const shouldShow=progress=>progress?.tutorial?.loggingSeen!==true;

export function markSeen(progress){
 const p=progress&&typeof progress==='object'?progress:{};
 const tut=p.tutorial&&typeof p.tutorial==='object'?p.tutorial:{};
 return {...p,tutorial:{...tut,loggingSeen:true}};
}

const el=(doc,tag,cls,text)=>{
 const n=doc.createElement(tag);
 if(cls)n.className=cls;
 if(text!==undefined)n.textContent=text;
 return n;
};

const svgNode=(doc,tag,attrs={},kids=[])=>{
 const n=doc.createElementNS?doc.createElementNS(SVG_NS,tag):doc.createElement(tag);
 for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));
 for(const k of kids)n.appendChild(k);
 return n;
};

function iconSvg(doc,kind){
 const s=(w,h,kids)=>svgNode(doc,'svg',{viewBox:`0 0 ${w} ${h}`,width:w,height:h,class:'lt-svg','aria-hidden':'true'},kids);
 const p=(d,fill,stroke,sw=1.5)=>svgNode(doc,'path',{d,fill:fill||'none',stroke:stroke||'none','stroke-width':sw,'stroke-linecap':'round','stroke-linejoin':'round'});
 const r=(x,y,w,h,rx,fill,stroke)=>svgNode(doc,'rect',{x,y,width:w,height:h,rx,fill:fill||'none',stroke:stroke||'none','stroke-width':1.4});
 const c=(cx,cy,rad,fill,stroke)=>svgNode(doc,'circle',{cx,cy,r:rad,fill:fill||'none',stroke:stroke||'none','stroke-width':1.4});
 switch(kind){
  case 'pine': return s(34,34,[r(15,24,4,8,1,'#8c5e3c'),p('M17 3 L26 14 L21 14 L28 24 L6 24 L13 14 L8 14 Z','#4d8a55','#8ec994',1.3)]);
  case 'tool': return s(30,30,[p('M6 24 L20 10','#b8926a','#c8a47e',2.4),p('M17 6 L24 11 L20 16 L14 11 Z','#d6d2c4','#f1efdf',1.3)]);
  case 'trunk': return s(40,30,[r(4,8,28,14,5,'#8b5a36','#cfa074'),c(32,15,7,'#d9b48a','#8b5a36'),c(32,15,2.5,'none','#8b5a36'),p('M9 12 H24 M11 18 H22',null,'#5a3820',1.2)]);
  case 'log': return s(36,28,[r(4,9,24,10,4,'#9c6a42','#d7ab80'),c(28,14,5,'#dec098','#9c6a42'),p('M9 14 H21',null,'#633f24',1.2)]);
  case 'logs2': return s(38,30,[r(4,14,24,9,4,'#9c6a42','#d7ab80'),c(28,18.5,4.5,'#dec098','#9c6a42'),r(7,5,24,9,4,'#8b5a36','#cfa074'),c(31,9.5,4.5,'#d9b48a','#8b5a36')]);
  case 'saw': return s(30,30,[c(15,15,10,'#c9c5ba','#f1efdf'),c(15,15,3,'#191713','#facd38'),p('M15 2 V5 M15 25 V28 M2 15 H5 M25 15 H28 M6 6 L8 8 M22 22 L24 24 M24 6 L22 8 M8 22 L6 24',null,'#facd38',1.6)]);
  case 'boards4': return s(38,30,[r(4,18,30,4,1,'#e2c08d','#8c6239'),r(4,13,30,4,1,'#d4ae78','#8c6239'),r(4,8,30,4,1,'#e2c08d','#8c6239'),r(4,3,30,4,1,'#d4ae78','#8c6239')]);
  case 'slabs2': return s(38,30,[p('M4 16 Q19 11 34 16 L34 21 L4 21 Z','#b88450','#6b4423',1.4),p('M4 7 Q19 2 34 7 L34 12 L4 12 Z','#a47242','#5a381b',1.4)]);
  case 'truck': return s(44,30,[r(3,12,22,8,1.5,'#4b6b8a','#9ec0df'),p('M25 8 H35 L40 14 V20 H25 Z','#facd38','#f1efdf',1.3),c(11,22,3.5,'#191713','#d2cfc6'),c(33,22,3.5,'#191713','#d2cfc6')]);
  case 'warehouse': return s(36,30,[p('M4 13 L18 4 L32 13 V27 H4 Z','#333029','#c9c5ba',1.4),r(12,17,12,10,1,'#191713','#facd38'),p('M18 19 V25 M16 20.5 H20 M16 23.5 H20',null,'#facd38',1.3)]);
  default: return s(20,20,[]);
 }
}

export function buildOverlay(doc){
 const root=el(doc,'div','lt-overlay');
 root.id='logging-tutorial';
 root.setAttribute('role','dialog');
 root.setAttribute('aria-modal','true');
 root.setAttribute('aria-labelledby','lt-title');

 const card=el(doc,'div','lt-card');
 const head=el(doc,'div','lt-head');
 const titles=el(doc,'div','lt-titles');
 titles.appendChild(el(doc,'div','lt-eyebrow','RIDGELINE TIMBER · FIELD GUIDE'));
 const h2=el(doc,'h2','lt-title','Logging Workflow');
 h2.id='lt-title';
 titles.appendChild(h2);

 const closeBtn=el(doc,'button','lt-close','Close');
 closeBtn.type='button';
 closeBtn.setAttribute('aria-label','Close logging guide');
 head.appendChild(titles);
 head.appendChild(closeBtn);
 card.appendChild(head);

 const grid=el(doc,'div','lt-steps');
 for(const step of STEPS){
  const box=el(doc,'article','lt-step');
  box.setAttribute('data-step',step.id);
  const sh=el(doc,'div','lt-step-head');
  sh.appendChild(el(doc,'span','lt-step-num',String(step.num)));
  sh.appendChild(el(doc,'h3','lt-step-title',step.title));
  box.appendChild(sh);

  const diag=el(doc,'div','lt-diagram');
  for(const tok of step.icons){
   if(tok==='+'||tok==='→'||tok==='|')diag.appendChild(el(doc,'span',tok==='|'?'lt-sep':'lt-op',tok));
   else diag.appendChild(iconSvg(doc,tok));
  }
  box.appendChild(diag);
  box.appendChild(el(doc,'p','lt-step-desc',step.desc));
  grid.appendChild(box);
 }
 card.appendChild(grid);

 const strip=el(doc,'div','lt-carry');
 strip.appendChild(el(doc,'span','lt-carry-label','CARRY RULES'));
 for(const rule of CARRY_RULES)strip.appendChild(el(doc,'span','lt-carry-item',rule));
 card.appendChild(strip);

 card.appendChild(el(doc,'p','lt-hint','Press Esc, Enter, Space, or E to close'));
 root.appendChild(card);
 return root;
}

const findCloseBtn=root=>{
 if(!root)return null;
 if(typeof root.className==='string'&&root.className.split(/\s+/).includes('lt-close'))return root;
 for(const c of root.children||[]){const f=findCloseBtn(c);if(f)return f}
 return null;
};

export function bindClose(elRoot,doc,onClose){
 let closed=false;
 const btn=findCloseBtn(elRoot);
 const finish=()=>{
  if(closed)return;
  closed=true;
  doc?.removeEventListener?.('keydown',onKey);
  btn?.removeEventListener?.('click',onClick);
  onClose?.();
 };
 const onKey=e=>{
  const k=e?.key;
  if(k==='Escape'||k==='Enter'||k===' '||k==='Spacebar'||k==='e'||k==='E'||e?.code==='Space'){
   e?.preventDefault?.();
   finish();
  }
 };
 const onClick=()=>finish();
 doc?.addEventListener?.('keydown',onKey);
 btn?.addEventListener?.('click',onClick);
 return ()=>{
  if(closed)return;
  closed=true;
  doc?.removeEventListener?.('keydown',onKey);
  btn?.removeEventListener?.('click',onClick);
 };
}
