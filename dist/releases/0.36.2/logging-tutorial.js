// logging-tutorial.js: 4-step logging guide (timber-redesign T-C)
import {HANDS_SPEED,PLANKS_PER_STACK} from './carry.js';
import {SAW_SECONDS_PER_LOG,SAW_SECONDS_PER_TRUNK,TRUNK_TO_LOGS,TRUNK_TO_SLABS,LOGS_TO_PLANKS} from './plank-economy.js';

const pctNum=v=>Math.round(v*100);
const pct=v=>pctNum(v)+'%';
const SVG_NS='http://www.w3.org/2000/svg';
const P={coal:'#181612',char:'#23201a',bone:'#f1efdf',amber:'#facd38',timber:'#c88b2a',moss:'#4d8a55'};

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
 Object.freeze({id:'haul',num:4,title:'Haul & Sell',rail:'Hauling',facts:[`${PLANKS_PER_STACK} Boards / stack`,'Hut storage only'],desc:'Carry boards and slabs into the lumber hut, then haul to the lumberyard and warehouse.'})
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
const sp=(d,f,s,w=2.5,ex={})=>doc=>svgEl(doc,'path',{d,fill:f||'none',stroke:s||'none','stroke-width':w,'stroke-linecap':'round','stroke-linejoin':'round',...ex});
const sr=(x,y,w,h,rx,f,s,sw=2.5)=>doc=>svgEl(doc,'rect',{x,y,width:w,height:h,rx,fill:f||'none',stroke:s||'none','stroke-width':sw,'stroke-linecap':'round','stroke-linejoin':'round'});
const sc=(cx,cy,r,f,s,sw=2.5,ex={})=>doc=>svgEl(doc,'circle',{cx,cy,r,fill:f||'none',stroke:s||'none','stroke-width':sw,...ex});
const se=(cx,cy,rx,ry,f,s,sw=2.5,ex={})=>doc=>svgEl(doc,'ellipse',{cx,cy,rx,ry,fill:f||'none',stroke:s||'none','stroke-width':sw,...ex});
const sg=(cls,kids)=>doc=>svgEl(doc,'g',{class:cls},kids.map(k=>k(doc)));
const svgBox=(doc,w,h,cls,specs)=>svgEl(doc,'svg',{viewBox:`0 0 ${w} ${h}`,width:w,height:h,class:cls,'aria-hidden':'true'},specs.map(fn=>fn(doc)));

function sawPath(cx,cy,r0,r1,n){
 let d='';
 for(let i=0;i<n;i++){
  const a0=i*2*Math.PI/n,a1=a0+1.1*Math.PI/n,a2=a0+1.65*Math.PI/n;
  const pt=(r,a)=>`${(cx+r*Math.cos(a)).toFixed(1)} ${(cy+r*Math.sin(a)).toFixed(1)}`;
  d+=(i?'L':'M')+pt(r0,a0)+'L'+pt(r1,a1)+'L'+pt(r0,a2);
 }
 return d+'Z';
}

function logCyl(x,y,w,h,side='right',sw=2.5,rings=2){
 const rx=Math.max(2,+(h*.28).toFixed(1)),ry=+(h/2).toFixed(1),cy=+(y+ry).toFixed(1);
 const cx=side==='left'?+(x+rx).toFixed(1):+(x+w-rx).toFixed(1);
 const body=side==='left'
  ?`M${x+rx} ${y} H${x+w-rx} A${rx} ${ry} 0 0 1 ${x+w-rx} ${y+h} H${x+rx} Z`
  :`M${x+rx} ${y} H${x+w-rx} V${y+h} H${x+rx} A${rx} ${ry} 0 0 1 ${x+rx} ${y} Z`;
 const out=[sp(body,P.timber,P.bone,sw),se(cx,cy,rx,ry,P.bone,P.timber,Math.max(1.2,sw*.65)),se(cx,cy,+(rx*.52).toFixed(1),+(ry*.52).toFixed(1),null,P.timber,Math.max(1,sw*.48))];
 if(rings>=2)out.push(sc(cx,cy,Math.max(.8,sw*.42),P.coal));
 return sg('',out);
}

function axeGlyph(gx,gy,hx,hy,scale=1){
 const dx=hx-gx,dy=hy-gy,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,lx=uy,ly=-ux,rx=-uy,ry=ux;
 const pt=(o,n)=>`${(hx+o*ux+n*rx).toFixed(1)} ${(hy+o*uy+n*ry).toFixed(1)}`;
 const ptL=(o,n)=>`${(hx+o*ux+n*lx).toFixed(1)} ${(hy+o*uy+n*ly).toFixed(1)}`;
 const head=`M${pt(5*scale,5*scale)} L${pt(-4*scale,5*scale)} L${ptL(-7*scale,13*scale)} Q${ptL(0,16*scale)} ${ptL(7*scale,13*scale)} Z`;
 const edge=`M${ptL(-7*scale,13*scale)} Q${ptL(0,16*scale)} ${ptL(7*scale,13*scale)}`;
 return [sp(`M${gx} ${gy} L${(hx+2*ux).toFixed(1)} ${(hy+2*uy).toFixed(1)}`,null,P.timber,3.2*scale),sp(head,P.bone,P.coal,2*scale),sp(edge,null,P.amber,2.5*scale)];
}

const BADGE=[
 sc(20,20,18.5,P.coal,P.amber,1.4),
 sp(sawPath(20,20,14.8,17.2,16),P.char,P.amber,1.4),
 sc(20,20,12.5,P.coal,P.bone,1),
 sp('M20 29 V22',null,P.timber,2.4),
 sp('M20 9 L26.5 17 H22.8 L28.5 23.5 H11.5 L17.2 17 H13.5 Z',P.moss,P.bone,1.4)
];

const GND=sp('M10 82 H150',null,'rgba(241,239,223,.26)',2.5),SHD=(cx,rx)=>se(cx,82,rx,4.5,'rgba(0,0,0,.45)');

const SCENES={
 fell:[GND,SHD(52,32),sp('M16 82 L13 75 M21 82 L22 74',null,P.moss,2.2),sp('M47 82 V50 H57 V63 L49 67 L57 71 V82 Z',P.timber,P.bone,2.5),sp('M47 56 H57',null,P.amber,2.5),sp('M52 10 L72 34 H61 L77 54 H27 L43 34 H32 Z',P.moss,P.bone,2.5),sp('M114 24 A46 46 0 0 0 65 62',null,P.amber,2.5,{'stroke-dasharray':'4 4'}),sg('lt-anim-chip',[sp('M62 66 L69 61 L68 69 Z',P.amber,P.coal,1.6)]),sg('lt-anim-axe',axeGlyph(132,70,104,28,1))],
 buck:[GND,SHD(42,32),SHD(127,22),logCyl(12,58,58,20,'left',2.5,2),sp('M32 65 H43 M52 72 H61',null,P.coal,2),sg('lt-anim-cut',[sp('M43 52 V82',null,P.amber,2.5,{'stroke-dasharray':'3.5 3'})]),sr(10,23,20,13,3,P.amber,P.bone,2.5),sp('M10 26 H5 V34 H10 M16 23 V18 H25 V23',null,P.bone,2.5),sp('M29 30 L45 50 A2.5 2.5 0 0 1 41 54 L25 34 Z',P.coal,P.bone,2.5),...axeGlyph(76,58,69,24,.88),sp('M82 68 H95 M91 64 L95 68 L91 72',null,P.amber,2.5),logCyl(104,66,44,14,'right',2.5,2),sg('lt-anim-log',[logCyl(107,52,44,14,'right',2.5,2)])],
 saw:[GND,SHD(49,39),SHD(129,20),sp('M18 68 V82 M80 68 V82',null,P.bone,2.5),sr(10,60,78,8,4,P.coal,P.bone,2.5),sc(15,64,1.8,P.amber),sc(49,64,1.8,P.amber),sc(83,64,1.8,P.amber),logCyl(10,46,29,13,'left',2.5,1),sg('lt-anim-saw',[sp(sawPath(44,44,12.5,16.5,12),P.char,P.bone,2.5),sc(44,44,7,null,P.amber,2),sc(44,44,3.2,P.amber,P.coal,1.6)]),sg('lt-anim-sparks',[sp('M35 24 L30 16 M43 21 L43 13 M52 23 L57 16',null,P.amber,2.5)]),sr(63,54,23,5,1.2,P.amber,P.coal,1.8),sr(63,48,23,5,1.2,P.bone,P.coal,1.8),sp('M93 58 H102 M99 54 L102 58 L99 62',null,P.amber,2.5),sp('M109 75 Q128 69 147 75 V81 H109 Z',P.timber,P.bone,2.2),sr(109,66,38,5.5,1.2,P.amber,P.coal,1.8),sr(109,59,38,5.5,1.2,P.bone,P.coal,1.8),sr(109,52,38,5.5,1.2,P.amber,P.coal,1.8)],
 haul:[GND,SHD(50,34),SHD(125,26),sp('M16 87 H34 M48 87 H66',null,'rgba(250,205,56,.45)',2.5),sg('lt-anim-truck',[sp('M8 52 H15 M6 60 H13',null,P.amber,2.5),sr(20,44,28,5,1,P.amber,P.coal,1.8),sr(20,38,28,5,1,P.bone,P.coal,1.8),sr(17,50,34,18,2,P.moss,P.bone,2.5),sp('M51 38 H68 L76 49 L84 52 V68 H51 Z',P.amber,P.bone,2.5),sp('M55 42 H66 L72 49 H55 Z',P.coal,P.bone,2),sc(81,58,1.8,P.bone),sc(31,72,8.5,P.coal,P.bone,2.5),sc(69,72,8.5,P.coal,P.bone,2.5),sc(31,72,2.5,P.amber),sc(69,72,2.5,P.amber)]),sp('M99 40 L125 22 L151 40 Z',P.char,P.bone,2.5),sp('M94 40 L125 20 L156 40',null,P.amber,3),sp('M103 40 V82 M147 40 V82 M100 72 H150 M103 60 H147',null,P.bone,2.5),sp('M108 66 Q116 61 124 66 V71 H108 Z',P.timber,P.bone,1.8),sr(127,65,16,5,1,P.amber,P.coal,1.6),sr(127,59,16,5,1,P.bone,P.coal,1.6)]
};

const MINI={
 trunk:[logCyl(1,2.5,18,9,'right',1.4,2)],
 log:[logCyl(2,3.5,16,7,'right',1.3,1)],
 logs2:[logCyl(1,7,14,5.5,'right',1.2,1),logCyl(4,1.5,14,5.5,'right',1.2,1)],
 slab:[sp('M2 8 Q10 3 18 8 V12 H2 Z',P.timber,P.bone,1.4)],
 boards:[sr(2,9.5,16,3.2,.8,P.amber,P.coal,1.1),sr(2,5.6,16,3.2,.8,P.bone,P.coal,1.1),sr(2,1.7,16,3.2,.8,P.amber,P.coal,1.1)]
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
  item.appendChild(el(doc,'span','lt-rail-dot'));
  item.appendChild(el(doc,'span','lt-rail-label',s.rail));
  rail.appendChild(item);
 }
 card.appendChild(rail);

 const grid=el(doc,'div','lt-steps');
 for(const s of STEPS){
  const box=el(doc,'article','lt-step',null,{'data-step':s.id});
  const scene=el(doc,'div','lt-scene');
  scene.appendChild(el(doc,'span','lt-step-num',String(s.num)));
  scene.appendChild(svgBox(doc,160,96,'lt-svg lt-scene-svg',SCENES[s.id]||[]));
  const sh=el(doc,'div','lt-step-head');
  sh.appendChild(el(doc,'h3','lt-step-title',s.title));
  const facts=el(doc,'div','lt-facts');
  for(const f of s.facts)facts.appendChild(el(doc,'span','lt-fact',f));
  box.appendChild(scene);box.appendChild(sh);box.appendChild(el(doc,'p','lt-step-desc',s.desc));box.appendChild(facts);
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
