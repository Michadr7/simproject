// logging-tutorial.js: 4-step logging guide (timber-redesign T-C)
import {HANDS_SPEED,PLANKS_PER_STACK} from './carry.js';
import {SAW_SECONDS_PER_LOG,SAW_SECONDS_PER_TRUNK,TRUNK_TO_LOGS,TRUNK_TO_SLABS,LOGS_TO_PLANKS} from './plank-economy.js';

const pctNum=v=>Math.round(v*100);
const pct=v=>pctNum(v)+'%';
const SVG_NS='http://www.w3.org/2000/svg';
const P={coal:'#14120f',char:'#221f19',bone:'#f1efdf',muted:'#b2ad9d',amber:'#facd38',rust:'#c88b2a',moss:'#4d8a55',sage:'#8ec994'};

export const CARRY_RULES=Object.freeze([
 `Trunk: ${pct(HANDS_SPEED.trunk)} speed (no sprint)`,
 `1 Log: ${pct(HANDS_SPEED.log)} speed`,
 `2 Logs: ${pct(HANDS_SPEED.logs2)} speed`,
 `Slab: ${pct(HANDS_SPEED.slab)} speed`,
 `Boards: ${PLANKS_PER_STACK} per stack`
]);
export const CARRY_TEXT=CARRY_RULES.join(' · ');

export const STEPS=Object.freeze([
 Object.freeze({id:'fell',num:1,title:'Fell',rail:'Felling',facts:['1 Pine → 1 Trunk'],desc:'Chop a marked pine to drop 1 heavy Trunk.'}),
 Object.freeze({id:'buck',num:2,title:'Buck',rail:'Bucking',facts:[`1 Trunk → ${TRUNK_TO_LOGS} Logs`],desc:`Cut a Trunk into ${TRUNK_TO_LOGS} Logs. Chainsaws cut faster.`}),
 Object.freeze({id:'saw',num:3,title:'Saw',rail:'Sawing',facts:[`Log → ${LOGS_TO_PLANKS} Boards (${SAW_SECONDS_PER_LOG} s)`,`Trunk → ${TRUNK_TO_SLABS} Slabs (${SAW_SECONDS_PER_TRUNK} s)`],desc:`Logs make ${LOGS_TO_PLANKS} Boards (${SAW_SECONDS_PER_LOG} s); Trunks make ${TRUNK_TO_SLABS} Slabs (${SAW_SECONDS_PER_TRUNK} s).`}),
 Object.freeze({id:'haul',num:4,title:'Haul & Sell',rail:'Hauling',facts:[`${PLANKS_PER_STACK} Boards / stack`],desc:'Stack at the shed or haul to the lumberyard & warehouse.'})
]);

const CARRY_ITEMS=Object.freeze([
 {key:'trunk',label:'Trunk',speed:HANDS_SPEED.trunk,tone:'heavy'},
 {key:'log',label:'1 Log',speed:HANDS_SPEED.log,tone:'fast'},
 {key:'logs2',label:'2 Logs',speed:HANDS_SPEED.logs2,tone:'fast'},
 {key:'slab',label:'Slab',speed:HANDS_SPEED.slab,tone:'mid'}
]);

export const shouldShow=progress=>progress?.tutorial?.loggingSeen!==true;

export function markSeen(progress){
 const p=progress&&typeof progress==='object'?progress:{};
 const tut=p.tutorial&&typeof p.tutorial==='object'?p.tutorial:{};
 return {...p,tutorial:{...tut,loggingSeen:true}};
}

const setA=(n,a)=>{for(const [k,v] of Object.entries(a))n.setAttribute(k,String(v));return n};
const el=(doc,tag,cls,text,attrs)=>{
 const n=doc.createElement(tag);
 if(cls)n.className=cls;
 if(text!==undefined&&text!==null)n.textContent=text;
 return attrs?setA(n,attrs):n;
};
const svgEl=(doc,tag,attrs={},kids=[])=>{
 const n=setA(doc.createElementNS?doc.createElementNS(SVG_NS,tag):doc.createElement(tag),attrs);
 for(const k of kids)n.appendChild(k);
 return n;
};
const sp=(d,f,s,w=1.6,ex={})=>doc=>svgEl(doc,'path',{d,fill:f||'none',stroke:s||'none','stroke-width':w,'stroke-linecap':'round','stroke-linejoin':'round',...ex});
const sr=(x,y,w,h,rx,f,s,sw=1.4)=>doc=>svgEl(doc,'rect',{x,y,width:w,height:h,rx,fill:f||'none',stroke:s||'none','stroke-width':sw});
const sc=(cx,cy,r,f,s,sw=1.4,ex={})=>doc=>svgEl(doc,'circle',{cx,cy,r,fill:f||'none',stroke:s||'none','stroke-width':sw,...ex});
const sg=(cls,kids)=>doc=>svgEl(doc,'g',{class:cls},kids.map(k=>k(doc)));
const svgBox=(doc,w,h,cls,specs)=>svgEl(doc,'svg',{viewBox:`0 0 ${w} ${h}`,width:w,height:h,class:cls,'aria-hidden':'true'},specs.map(fn=>fn(doc)));

const BADGE=[
 sc(20,20,18,P.coal,P.amber,1.4),sc(20,20,16.5,'none',P.amber,2.6,{'stroke-dasharray':'2.2 2.4'}),
 sc(20,20,13.5,P.char,P.muted,.9),sp('M20 29 V22',null,P.rust,2.2),
 sp('M20 8 L27 17 H23 L29 24 H11 L17 17 H13 Z',P.moss,P.sage,1.3)
];

const SCENES={
 fell:[
  sp('M8 62 Q40 59 74 62 T112 61',null,P.moss,1.6),sp('M16 61 L14 56 M19 61 L20 55 M22 61 L25 57',null,P.sage,1.2),
  sp('M52 61 V36',null,P.rust,6.5),sp('M50 57 V41',null,P.coal,1.1),
  sp('M55 48 L49 51 L55 54',P.coal,P.amber,1.3),sp('M49 41 H55',null,P.amber,1.4),
  sp('M52 7 L68 25 H59 L73 40 H31 L45 25 H36 Z',P.moss,P.sage,1.6),sp('M47 18 L52 13 L57 18',null,P.bone,1.1),
  sp('M93 21 A25 25 0 0 0 62 49',null,P.amber,1.5,{'stroke-dasharray':'3 3'}),
  sg('lt-anim-axe',[sp('M96 19 L74 41',null,P.rust,2.4),sp('M70 37 L79 44 L73 49 L66 42 Z',P.bone,P.coal,1.3),sp('M70 37 L66 42',null,P.amber,1.6)])
 ],
 buck:[
  sp('M8 58 H112',null,P.moss,1.5),
  sp('M14 36 H54 A5 8 0 0 1 54 52 H14 A5 8 0 0 1 14 36 Z',P.rust,P.bone,1.5),
  sp('M21 41 H31 M24 47 H41',null,P.coal,1.1),sc(14,44,5.5,P.bone,P.rust,1.3),
  sg('lt-anim-cut',[sp('M34 29 V59',null,P.amber,1.8,{'stroke-dasharray':'3 2.5'}),sp('M31 31 L34 36 L37 31',P.amber,P.amber,1)]),
  sp('M61 44 H71 M68 41 L71 44 L68 47',null,P.amber,1.6),
  sr(76,43,28,12,5,P.rust,P.bone,1.5),sc(104,49,5.2,P.bone,P.rust,1.3),
  sg('lt-anim-log',[sr(80,28,28,12,5,P.rust,P.bone,1.5),sc(108,34,5.2,P.bone,P.rust,1.3),sp('M85 34 H98',null,P.coal,1.1)])
 ],
 saw:[
  sp('M10 49 H64 M18 49 V62 M54 49 V62',null,P.muted,1.6),sr(8,37,26,11,4,P.rust,P.bone,1.4),
  sg('lt-anim-saw',[
   sc(44,36,13.5,P.char,P.bone,1.6),
   sp('M44 20 V23 M44 49 V52 M28 36 H31 M57 36 H60 M33 25 L35 27 M53 45 L55 47 M55 25 L53 27 M35 45 L33 47',null,P.amber,1.6),
   sc(44,36,3.5,P.amber,P.coal,1.2)
  ]),
  sg('lt-anim-sparks',[sp('M34 21 L29 14 M41 18 L41 11 M49 20 L54 14',null,P.amber,1.6)]),
  sp('M62 36 H70 M67 33 L70 36 L67 39',null,P.muted,1.5),
  sr(74,45,36,4.5,1,P.amber,P.coal,1.2),sr(74,39,36,4.5,1,P.bone,P.coal,1.2),
  sr(74,33,36,4.5,1,P.amber,P.coal,1.2),sr(74,27,36,4.5,1,P.bone,P.coal,1.2),
  sp('M74 54 Q92 50 110 54 V59 H74 Z',P.rust,P.bone,1.3)
 ],
 haul:[
  sp('M6 59 H114',null,P.muted,1.5),sp('M12 64 H26 M38 64 H52',null,P.amber,1.2,{'stroke-opacity':'.45'}),
  sp('M86 59 V27 L100 18 L114 27 V59',P.char,P.muted,1.5),sr(92,39,16,20,1,P.coal,P.amber,1.3),
  sg('lt-anim-truck',[
   sr(15,32,28,4,1,P.bone,P.rust,1.2),sr(15,27,28,4,1,P.amber,P.rust,1.2),sr(12,37,34,12,2,P.moss,P.bone,1.5),
   sp('M46 28 H62 L71 38 V49 H46 Z',P.amber,P.bone,1.5),sp('M50 31 H59 L64 37 H50 Z',P.coal,P.bone,1),
   sc(23,52,6,P.coal,P.bone,1.6),sc(59,52,6,P.coal,P.bone,1.6),sc(23,52,2,P.amber),sc(59,52,2,P.amber)
  ])
 ]
};

const MINI={
 trunk:[sr(1,3,13,8,3,P.rust,P.bone,1.2),sc(14,7,3.6,P.bone,P.rust,1.1)],
 log:[sr(2,4,12,6,2.5,P.rust,P.bone,1.2),sc(14,7,2.8,P.bone,P.rust,1.1)],
 logs2:[sr(1,7,11,5,2,P.rust,P.bone,1.1),sc(12,9.5,2.3,P.bone,P.rust,1),sr(4,2,11,5,2,P.rust,P.bone,1.1),sc(15,4.5,2.3,P.bone,P.rust,1)],
 slab:[sp('M2 7 Q10 3 18 7 V11 H2 Z',P.rust,P.bone,1.2)],
 boards:[sr(2,9,16,3,.8,P.amber,P.coal,1),sr(2,5.5,16,3,.8,P.bone,P.coal,1),sr(2,2,16,3,.8,P.amber,P.coal,1)]
};

export function buildOverlay(doc){
 const root=el(doc,'div','lt-overlay',null,{id:'logging-tutorial',role:'dialog','aria-modal':'true','aria-labelledby':'lt-title',tabindex:'-1'});
 const card=el(doc,'div','lt-card');
 const head=el(doc,'div','lt-head');
 const brand=el(doc,'div','lt-brand');
 brand.appendChild(svgBox(doc,40,40,'lt-svg lt-badge',BADGE));
 const titles=el(doc,'div','lt-titles');
 titles.appendChild(el(doc,'div','lt-eyebrow','RIDGELINE TIMBER · FIELD GUIDE'));
 titles.appendChild(el(doc,'h2','lt-title','Logging Workflow',{id:'lt-title'}));
 titles.appendChild(el(doc,'p','lt-goal','From tree to truck in 4 steps'));
 brand.appendChild(titles);
 const closeBtn=el(doc,'button','lt-close','Close',{'aria-label':'Close logging guide'});
 closeBtn.type='button';
 head.appendChild(brand);head.appendChild(closeBtn);card.appendChild(head);

 const rail=el(doc,'div','lt-rail',null,{'aria-hidden':'true'});
 for(const s of STEPS){
  const item=el(doc,'div','lt-rail-item',null,{'data-step':s.id});
  item.appendChild(el(doc,'span','lt-rail-dot',String(s.num)));
  item.appendChild(el(doc,'span','lt-rail-label',s.rail));
  rail.appendChild(item);
 }
 card.appendChild(rail);

 const grid=el(doc,'div','lt-steps');
 for(const s of STEPS){
  const box=el(doc,'article','lt-step',null,{'data-step':s.id});
  const sh=el(doc,'div','lt-step-head');
  sh.appendChild(el(doc,'span','lt-step-num',String(s.num)));
  sh.appendChild(el(doc,'h3','lt-step-title',s.title));
  const scene=el(doc,'div','lt-scene');
  scene.appendChild(svgBox(doc,120,72,'lt-svg lt-scene-svg',SCENES[s.id]||[]));
  const facts=el(doc,'div','lt-facts');
  for(const f of s.facts)facts.appendChild(el(doc,'span','lt-fact',f));
  box.appendChild(sh);box.appendChild(scene);box.appendChild(el(doc,'p','lt-step-desc',s.desc));box.appendChild(facts);
  grid.appendChild(box);
 }
 card.appendChild(grid);

 const carry=el(doc,'div','lt-carry');
 const carryHead=el(doc,'div','lt-carry-head');
 carryHead.appendChild(el(doc,'span','lt-carry-label','CARRY SPEED & STACKS'));
 const stack=el(doc,'span','lt-stack-badge');
 stack.appendChild(svgBox(doc,20,14,'lt-svg lt-mini-svg',MINI.boards));
 stack.appendChild(el(doc,'span',null,`Boards: ${PLANKS_PER_STACK} per stack · no sprint`));
 carryHead.appendChild(stack);carry.appendChild(carryHead);

 const meters=el(doc,'div','lt-meters');
 for(const m of CARRY_ITEMS){
  const val=pctNum(m.speed);
  const cell=el(doc,'div','lt-meter',null,{'data-carry':m.key});
  const top=el(doc,'div','lt-meter-top');
  top.appendChild(svgBox(doc,20,14,'lt-svg lt-mini-svg',MINI[m.key]||[]));
  top.appendChild(el(doc,'span','lt-meter-name',m.label));
  top.appendChild(el(doc,'strong','lt-meter-val',`${val}%`));
  const bar=el(doc,'div','lt-bar',null,{role:'meter','aria-label':`${m.label} carry speed`,'aria-valuemin':'0','aria-valuemax':'100','aria-valuenow':String(val)});
  const fill=el(doc,'i','lt-bar-fill',null,{'data-tone':m.tone});
  fill.style.width=`${val}%`;
  bar.appendChild(fill);cell.appendChild(top);cell.appendChild(bar);meters.appendChild(cell);
 }
 carry.appendChild(meters);card.appendChild(carry);

 const hint=el(doc,'p','lt-hint');
 const txt=t=>hint.appendChild(doc.createTextNode?doc.createTextNode(t):el(doc,'span',null,t));
 const key=k=>hint.appendChild(el(doc,'kbd','lt-kbd',k));
 txt('Press ');key('Esc');key('Enter');key('Space');txt(' or ');key('E');txt(' to close');
 const foot=el(doc,'div','lt-foot');foot.appendChild(hint);
 card.appendChild(foot);root.appendChild(card);
 return root;
}

const hasCls=(n,c)=>typeof n?.className==='string'&&n.className.split(/\s+/).includes(c);
const findBy=(root,pred,out=[])=>{
 if(!root)return out;
 if(pred(root))out.push(root);
 for(const c of root.children||[])findBy(c,pred,out);
 return out;
};
const focusablesIn=root=>findBy(root,n=>{
 if(n.disabled||n.attrs?.disabled!==undefined)return false;
 const t=String(n.tagName||'').toLowerCase();
 return t==='button'||t==='a'||t==='input'||t==='select'||t==='textarea'||(Number(n.attrs?.tabindex)>=0&&!hasCls(n,'lt-overlay'));
});

export function bindClose(elRoot,doc,onClose){
 let closed=false;
 const btn=findBy(elRoot,n=>hasCls(n,'lt-close'))[0]||null;
 const prev=doc?.activeElement||null;
 const focusEl=n=>{try{n?.focus?.()}catch{}};
 const cleanup=()=>{
  doc?.removeEventListener?.('keydown',onKey);
  doc?.removeEventListener?.('focusin',onFocusIn);
  btn?.removeEventListener?.('click',onClick);
 };
 const finish=()=>{
  if(closed)return;
  closed=true;cleanup();onClose?.();
  if(prev&&prev!==elRoot&&prev!==doc?.body&&prev.isConnected!==false)focusEl(prev);
 };
 const onKey=e=>{
  const k=e?.key;
  if(k==='Tab'){
   e?.preventDefault?.();
   const list=focusablesIn(elRoot);
   if(!list.length){focusEl(elRoot);return}
   const i=list.indexOf(doc?.activeElement);
   focusEl(list[e?.shiftKey?(i<=0?list.length-1:i-1):(i<0||i>=list.length-1?0:i+1)]);
   return;
  }
  if(k==='Escape'||k==='Enter'||k===' '||k==='Spacebar'||k==='e'||k==='E'||e?.code==='Space'){
   e?.preventDefault?.();finish();
  }
 };
 const onFocusIn=e=>{if(e?.target&&typeof elRoot?.contains==='function'&&!elRoot.contains(e.target))focusEl(btn||elRoot)};
 const onClick=()=>finish();
 doc?.addEventListener?.('keydown',onKey);
 doc?.addEventListener?.('focusin',onFocusIn);
 btn?.addEventListener?.('click',onClick);
 focusEl(btn||elRoot);
 return ()=>{if(closed)return;closed=true;cleanup()};
}
