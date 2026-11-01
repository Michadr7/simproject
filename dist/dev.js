// Dev mode: a "Dev Mode" entry on the main menu and a panel with teleport, set time, add money, spawn items and unstick.
// Loaded only when DEV_MODE (dev-flag.js) is true. It touches the game only through the `api` object game.js passes in, and adds its own markup and CSS at runtime,
// so deleting this file (and the block at the end of game.js) leaves no trace in index.html or style.css.
// Changes go to your normal save: this is not a separate profile.
export const QUICK_TIMES=[['Dawn',360],['Noon',720],['Dusk',1080],['Night',1380]];
export const MONEY_STEPS=[10000,100000,1000000]; // cents
export const clockLabel=minutes=>{const total=Math.floor(minutes)%1440,hour=Math.floor(total/60);return `${hour%12||12}:${String(total%60).padStart(2,'0')} ${hour<12?'AM':'PM'}`};
const dollars=cents=>'$'+(cents/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

const STYLE=`
:is(#devPanel,#devInteriorBody){position:fixed;top:84px;right:12px;z-index:90;width:min(320px,calc(100vw - 24px));max-height:calc(100vh - 100px);overflow:auto;box-sizing:border-box;padding:14px;border-radius:10px;border:1px solid #d4e7b366;background:#0b191bf5;color:#eef6e6;font:12px/1.5 system-ui,sans-serif}
:is(#devPanel,#devInteriorBody)[hidden]{display:none}
#devInteriorBody{right:auto;left:12px;width:min(360px,calc(100vw - 24px))}
:is(#devPanel,#devInteriorBody) h2{margin:0 0 2px;font-size:15px;display:flex;justify-content:space-between;align-items:center}
:is(#devPanel,#devInteriorBody) h3{margin:14px 0 6px;font-size:10px;letter-spacing:2px;color:#cae0ad;text-transform:uppercase}
:is(#devPanel,#devInteriorBody) .dev-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
:is(#devPanel,#devInteriorBody) select,:is(#devPanel,#devInteriorBody) input{box-sizing:border-box;padding:7px 8px;border-radius:6px;border:1px solid #ffffff3a;background:#14292b;color:#eef6e6;font:inherit;min-width:0}
:is(#devPanel,#devInteriorBody) select{flex:1}:is(#devPanel,#devInteriorBody) input[type=number]{width:72px}:is(#devPanel,#devInteriorBody) input[type=range]{flex:1;padding:0}
:is(#devPanel,#devInteriorBody) button{padding:7px 10px;border-radius:6px;border:1px solid #ffffff3a;background:#1d3d3a;color:#eef6e6;font:inherit;cursor:pointer}
:is(#devPanel,#devInteriorBody) button:hover,:is(#devPanel,#devInteriorBody) button:focus-visible{background:#2a5551;border-color:#d4e7b3;outline:none}
#devReadout{font-variant-numeric:tabular-nums;color:#c4d6cb;margin:6px 0 0}
#devMessage{min-height:1.5em;margin:10px 0 0;color:#cfe8a8}#devMessage[data-kind=error]{color:#ffb4a8}
:is(#devPanel,#devInteriorBody) .dev-note{color:#9fb5a8;margin:8px 0 0}
:is(#devPanel,#devInteriorBody) select[size]{flex:none;width:100%;margin:6px 0}#devProblems{margin:8px 0 4px;font-size:11px;line-height:1.5;color:#cfe8a8}#devProblems[data-kind=error]{color:#ffb4a8}
`;

function make(tag,props={},...children){
 const node=document.createElement(tag);
 for(const [k,v] of Object.entries(props)){if(k==='role')node.setAttribute('role',v);else if(k==='dataset')Object.assign(node.dataset,v);else node[k]=v}
 node.append(...children);return node;
}

export function installDevMode(api){
 const {$}=api;
 let entered=false,timer=null;
 const style=make('style',{id:'devStyle',textContent:STYLE});document.body.append(style);

 // ── The panel ─────────────────────────────────────────────────────────────────────────────────────────────────────────
 const message=make('p',{id:'devMessage',role:'status'}),readout=make('p',{id:'devReadout'});
 const say=(text,kind='')=>{message.textContent=text;message.dataset.kind=kind};
 let syncInterior=null;
 const refresh=()=>{syncInterior?.();const p=api.position(),s=api.snapshot();readout.textContent=`${p.where}  ·  x ${p.x.toFixed(1)}  z ${p.z.toFixed(1)}  ·  ${clockLabel(s.minutes)}  ·  ${dollars(s.cash)}`};

 // Teleport
 const place=make('select',{id:'devPlace'}),x=make('input',{id:'devX',type:'number',step:'any',placeholder:'x'}),z=make('input',{id:'devZ',type:'number',step:'any',placeholder:'z'});
 for(const p of api.places)place.append(make('option',{value:p.id,textContent:p.label}));
 const go=(px,pz,label)=>{const r=api.teleport(px,pz);say(r.ok?`${label}${r.snapped?' (moved to the nearest clear spot)':''}`:r.message,r.ok?'':'error');refresh()};
 const goButton=make('button',{id:'devGo',textContent:'Go',onclick:()=>{const p=api.places.find(q=>q.id===place.value);if(p)go(p.x,p.z,`At ${p.label}`)}});
 const goCustom=make('button',{id:'devGoXZ',textContent:'Go to x, z',onclick:()=>{const px=Number(x.value),pz=Number(z.value);if(x.value===''||z.value===''||!Number.isFinite(px)||!Number.isFinite(pz)){say('Enter both x and z.','error');return}go(px,pz,`At ${px}, ${pz}`)}});

 // Time
 const slider=make('input',{id:'devTime',type:'range',min:'0',max:'1439',step:'15',value:'540'}),timeLabel=make('b',{id:'devTimeLabel',textContent:clockLabel(540)});
 slider.oninput=()=>{timeLabel.textContent=clockLabel(Number(slider.value))};
 const setTime=minutes=>{const m=api.setTime(minutes);slider.value=String(m);timeLabel.textContent=clockLabel(m);say(`It is ${clockLabel(m)}.`);refresh()};
 const quick=QUICK_TIMES.map(([name,m])=>make('button',{textContent:name,dataset:{minutes:m},onclick:()=>setTime(m)}));

 // Money
 const money=MONEY_STEPS.map(c=>make('button',{textContent:'+'+dollars(c).replace('.00',''),dataset:{cents:c},onclick:()=>{const r=api.addMoney(c);say(r.error||`You have ${dollars(r.cash)}.`,r.error?'error':'');refresh()}}));

 // Items
 const item=make('select',{id:'devItem'}),qty=make('input',{id:'devQty',type:'number',min:'1',max:'20',value:'1'});
 for(const it of api.items)item.append(make('option',{value:it.id,textContent:`${it.icon} ${it.name}`}));
 const spawn=make('button',{id:'devSpawn',textContent:'Spawn',onclick:()=>{const r=api.giveItem(item.value,Number(qty.value));say(r.added?`Added ${r.added} × ${r.name}.${r.error?' '+r.error:''}`:r.error,r.added?'':'error');refresh()}});

 // Rendering: switches for finding what causes a visual glitch on your GPU (shadows, the dissolve of trees between the camera and you)
 const renderSwitch=(id,label,apply)=>{let on=true;const b=make('button',{id,textContent:label+': on',onclick:()=>{on=!on;apply(on);b.textContent=label+(on?': on':': off');say(label+(on?' on.':' off.'))}});return b};
 const shadows=renderSwitch('devShadows','Shadows',on=>api.setShadows(on)),fade=renderSwitch('devFade','Tree dissolve',on=>api.setTreeFade(on));

 // Interior editor (api.interior): pick any house (you do not have to rent it) and go inside, choose a piece, move it by compass direction (N is the kitchen wall, S is the door), turn it, copy or
 // delete it, add new pieces, and Save to code (needs `npm run dev`). A yellow box shows the chosen piece; what is wrong with the layout is listed as you go.
 const ix=api.interior;
 let selected=null,fine=false,shownKey='';
 const houseSel=make('select',{id:'devHouse'}),pieceSel=make('select',{id:'devPiece',size:7}),addSel=make('select',{id:'devAddItem'}),status=make('p',{id:'devInteriorStatus',className:'dev-note'}),problems=make('p',{id:'devProblems'});
 for(const h of ix.houses)houseSel.append(make('option',{value:h.id,textContent:h.name}));
 for(const c of ix.catalogue)addSel.append(make('option',{value:c.id,textContent:c.label}));
 const step=()=>fine?ix.steps.fine:ix.steps.coarse;
 const stepButton=make('button',{id:'devStep',textContent:'Step: 25 cm',onclick:()=>{fine=!fine;stepButton.textContent=fine?'Step: 5 cm':'Step: 25 cm'}});
 const sync=force=>{ // the piece list is rebuilt only when something changed
  const info=ix.info();
  if(!info){status.textContent='Choose a house and press Go inside.';problems.textContent='';if(shownKey!==''){pieceSel.replaceChildren();shownKey=''}return}
  const key=JSON.stringify([info.id,info.floor,info.items.map(i=>i.text),selected,info.problems]);
  if(!force&&key===shownKey)return;shownKey=key;
  status.textContent=`${info.name} (${info.prop}), floor ${info.floor+1} of ${info.floors}. N is the kitchen wall, S is the door.`;
  pieceSel.replaceChildren(...info.items.map(i=>make('option',{value:String(i.index),textContent:i.text})));if(selected!==null)pieceSel.value=String(selected);
  problems.textContent=info.problems.length?'⚠ '+info.problems.join(' · '):'✓ Nothing wrong: you can walk everywhere you need to.';problems.dataset.kind=info.problems.length?'error':'ok';
 };
 syncInterior=sync;
 pieceSel.onchange=()=>{selected=Number(pieceSel.value);ix.select(selected);sync(true)};
 const edit=(label,fn)=>make('button',{textContent:label.text,id:label.id,title:label.title||'',onclick:()=>{if(selected===null){say('Pick a piece from the list first.','error');return}const r=fn();say(r===false?'That piece cannot do that (it is fixed, or already against a wall).':label.done);sync(true)}});
 const nudge=(id,text,dx,dz,title)=>edit({id,text,title,done:'Moved.'},()=>ix.move(selected,dx*step(),dz*step()));
 const interiorBody=make('section',{id:'devInteriorBody',hidden:true},make('h2',{},'Interior editor',make('button',{id:'devInteriorClose',textContent:'×',title:'Close',onclick:()=>{interiorBody.hidden=true;interiorToggle.textContent='Interior editor ▸'}})),
  make('div',{className:'dev-row'},houseSel,make('button',{id:'devVisit',textContent:'Go inside',onclick:()=>{const r=ix.visit(houseSel.value);selected=null;ix.select(null);say(r.ok?'Inside.':r.message,r.ok?'':'error');sync(true)}})),
  status,pieceSel,
  make('div',{className:'dev-row'},nudge('devWest','◀ W',-1,0,'west'),nudge('devNorth','▲ N',0,-1,'north: the kitchen wall'),nudge('devSouth','S ▼',0,1,'south: the door'),nudge('devEast','E ▶',1,0,'east'),stepButton),
  make('div',{className:'dev-row'},
   edit({id:'devTurnLeft',text:'⟲ Turn left',done:'Turned.'},()=>ix.rotate(selected,1)),edit({id:'devTurnRight',text:'⟳ Turn right',done:'Turned.'},()=>ix.rotate(selected,-1)),
   edit({id:'devCopy',text:'Copy',done:'Copied: the copy is selected.'},()=>{const n=ix.duplicate(selected);if(n<0)return false;selected=n}),
   edit({id:'devDelete',text:'Delete',done:'Deleted.'},()=>{if(!ix.remove(selected))return false;selected=null})),
  make('div',{className:'dev-row'},addSel,make('button',{id:'devAdd',textContent:'Add',onclick:()=>{const n=ix.add(addSel.value);if(n<0){say('Go inside a house first.','error');return}selected=n;say('Added in the middle of the room: move it into place.');sync(true)}})),
  problems,
  make('div',{className:'dev-row'},
   make('button',{id:'devInteriorReset',textContent:'Reset to generated',onclick:()=>{ix.reset();selected=null;say('Back to the generated layout (not saved until you press Save).');sync(true)}}),
   make('button',{id:'devInteriorSave',textContent:'Save to code',onclick:async()=>{say('Saving…');const r=await ix.save();say(r.message,r.ok?'':'error')}})));
 const interiorToggle=make('button',{id:'devInteriorToggle',textContent:'Interior editor ▸',onclick:()=>{interiorBody.hidden=!interiorBody.hidden;ix.select(null);interiorToggle.textContent='Interior editor '+(interiorBody.hidden?'▸':'▾');sync(true)}});
 // Unstick
 const unstick=make('button',{id:'devUnstick',textContent:'Unstick',onclick:()=>{const r=api.unstick();say(r.moved?'Moved to the nearest clear spot.':r.found?'You are already on clear ground.':'No clear ground within 30 m of here.',r.found?'':'error');refresh()}});
 const home=make('button',{id:'devSpawnPoint',textContent:'Back to spawn (R)',onclick:()=>{const r=api.reset();say(r.moved?'Back at the starting point (nearest clear spot).':'Back at the starting point.');refresh()}});

 const panel=make('section',{id:'devPanel',hidden:true},
  make('h2',{},'Dev mode',make('button',{id:'devClose',textContent:'×',title:'Close (F2)',onclick:()=>close()})),
  readout,
  make('h3',{},'Teleport'),make('div',{className:'dev-row'},place,goButton),make('div',{className:'dev-row'},x,z,goCustom),
  make('h3',{},'Time of day'),make('div',{className:'dev-row'},slider,timeLabel,make('button',{id:'devSetTime',textContent:'Set',onclick:()=>setTime(Number(slider.value))})),make('div',{className:'dev-row'},...quick),
  make('h3',{},'Money'),make('div',{className:'dev-row'},...money),
  make('h3',{},'Spawn items'),make('div',{className:'dev-row'},item,qty,spawn),
  make('h3',{},'Rendering'),make('div',{className:'dev-row'},shadows,fade),
  make('h3',{},'Furniture'),interiorToggle,
  make('h3',{},'Safety'),make('div',{className:'dev-row'},unstick,home),
  message,
  make('p',{className:'dev-note'},'F2 shows or hides this panel. Changes are saved to your normal save.'));
 // Typing in the panel must not move the character or trigger game keys. Escape closes it; F2 still reaches the window so it can close it too.
 for(const window of [panel,interiorBody])for(const type of ['keydown','keyup'])window.addEventListener(type,e=>{if(e.code==='F2')return;e.stopPropagation();if(type==='keydown'&&e.code==='Escape')close()});
 document.body.append(panel,interiorBody);

 function open(){panel.hidden=false;api.releaseCursor();refresh();clearInterval(timer);timer=setInterval(refresh,250)} // the readout only runs while the panel is open, four times a second
 function close(){panel.hidden=true;interiorBody.hidden=true;interiorToggle.textContent='Interior editor ▸';clearInterval(timer);timer=null}
 function toggle(){if(panel.hidden)open();else close()}

 // ── The way in: a Dev Mode button on the main menu, then F2 ────────────────────────────────────────────────────────────
 const button=make('button',{id:'menuDev',className:'menu-button',textContent:'Dev Mode',onclick:()=>{entered=true;api.start();if(api.active())open()}}); // with no character yet the creator opens first; F2 then shows the panel
 $('menuHome').append(button);
 window.addEventListener('keydown',e=>{if(entered&&e.code==='F2'){e.preventDefault();toggle()}});

 return {panel,button,open,close,toggle,get entered(){return entered}};
}
