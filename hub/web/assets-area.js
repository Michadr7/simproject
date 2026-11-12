// Hub v2 V4: the Assets page (shell area)

// Six stages in a strip (Wanted, Received, Staged you set by hand; Converted, In game, Credited the game's modules decide), the Add asset form, rows grouped by stage with "Move to" and Undo,
// and the new files in assets-src/ that no row accounts for. The pure helpers come first so tests can import them; mountAssets draws with textContent only (never markup).
// V4b: "It is <row>" under a new file attaches that file to the row (POST /api/assets/file), with Undo like every other change.
// Reads GET /api/assets/summary; every write is a click and goes through records-api.js (the same checks as the master's RECORD: lines). Names of files are read, never the files.
import {recordsCall} from './records-api.js';
import {errorText} from './runs-api.js';
import {agoText} from './plans.js';

export const STAGE_ORDER=Object.freeze(['wanted','received','staged','converted','in-game','credited']);
export const STAGE_LABEL=Object.freeze({wanted:'Wanted',received:'Received',staged:'Staged',converted:'Converted','in-game':'In game',credited:'Credited',retired:'Retired'});
export const HAND_STAGES=Object.freeze(['wanted','received','staged']),MOVE_STAGES=Object.freeze(['wanted','received','staged','retired']),KIND_CHOICES=Object.freeze(['model','sound','texture','picture']);
export const stageName=s=>Object.hasOwn(STAGE_LABEL,s)?STAGE_LABEL[s]:String(s);
// [{key,label,count,hand}] in order; the three hand-set ones are marked
export const stripOf=stages=>STAGE_ORDER.map(k=>({key:k,label:STAGE_LABEL[k],count:Number(stages&&Object.hasOwn(stages,k)?stages[k]:0)||0,hand:HAND_STAGES.includes(k)}));
export const moveOptions=stage=>MOVE_STAGES.filter(s=>s!==stage);
export const safeLink=src=>typeof src==='string'&&/^https?:\/\/[^\s/]/i.test(src)&&!/\s/.test(src)?src:null;
export function groupRows(rows){
 const g={wanted:[],received:[],staged:[],retired:[]};
 for(const r of Array.isArray(rows)?rows:[])if(r&&Object.hasOwn(g,r.stage))g[r.stage].push(r);
 return g}
// The "Next step" line: what needs the owner first.
export function nextStep(s){
 if(!s||!s.stages)return 'Reading the asset register…';
 const nf=s.newFiles&&s.newFiles.total||0,rows=Array.isArray(s.rows)?s.rows:[],by=st=>rows.filter(r=>r.stage===st);
 if(nf>0)return `${nf} new file${nf===1?'':'s'} in assets-src/ ${nf===1?'has':'have'} no row. Tell the hub which asset ${nf===1?'it is':'each one is'}, or add it below.`;
 const staged=by('staged'),received=by('received'),wanted=by('wanted');
 if(staged.length)return `${staged.length} staged: ${staged[0].name}${staged.length>1?` and ${staged.length-1} more`:''} ${staged.length>1?'are':'is'} ready to convert. Ask the master for a plan.`;
 if(received.length)return `${received.length} received: stage ${received.length>1?'them':'it'} when the file is named and ready (${received[0].name}${received.length>1?', …':''}).`;
 if(wanted.length)return `${wanted.length} wanted. Nothing to do until a file arrives.`;
 return 'Nothing is waiting. Add an asset below when you have one in mind.'}
// A file name made into a name for the form: "oak_tree.glb" -> "oak tree"
export const nameFromFile=f=>String(f||'').replace(/\.[A-Za-z0-9]{2,4}$/,'').replace(/[_\-.]+/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
// What pressing "It is <row>" does (V4b): the file is attached to that row; a wanted row becomes received.
export const attachTitle=c=>c&&c.stage==='wanted'?'Attach this file to the row and move it to Received':'Attach this file to the row';
export const filesText=r=>Array.isArray(r&&r.files)&&r.files.length?`${r.files.length} file${r.files.length===1?'':'s'}: ${r.files.map(f=>String(f).slice(String(f).lastIndexOf('/')+1)).join(', ')}`:'';
export const newFileLine=f=>`New file: ${f.name}. Which asset is it?`;
export const readHidden=raw=>{try{const a=JSON.parse(raw);return Array.isArray(a)?a.filter(x=>typeof x==='string').slice(0,500):[]}catch{return []}};
export const recordLine=r=>`${r.label}${r.by==='master'?' (by the master)':''}${r.undone?' · undone':''}`;

const h=(tag,props,...kids)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(props||{})){if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(v!==false&&v!=null)e.setAttribute(k,v===true?'':v)}for(const c of kids.flat())if(c!=null)e.append(c);return e};
async function getJson(url){try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)return null;return await r.json()}catch{return null}}
const store={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};

export function mountAssets(view,{onChange}={}){
 let alive=true,timer=null,busy=false,data=null,sig=null,hidden=readHidden(store.get('hub.assets.hidden'));
 const next=h('p',{class:'next'}),note=h('p',{class:'msg err',role:'alert',hidden:true}),ok=h('p',{class:'msg approved',role:'status',hidden:true});
 const strip=h('div',{class:'as-strip','aria-label':'Assets by stage'}),formBox=h('div',{class:'box as-gap'}),filesBox=h('div',{}),rowsBox=h('div',{}),recBox=h('div',{class:'box as-gap'}),links=h('p',{class:'small dim'});
 // 2.4.2: the six stage cells are a switch; the rows of the chosen stage sit on the right, the new files, the form and the recent changes on the left (no long scroll)
 let stage=store.get('hub.assets.stage');if(!STAGE_ORDER.includes(stage))stage='wanted';
 const left=h('div',{class:'pane'},filesBox,formBox,recBox,links),right=h('div',{class:'pane'},rowsBox);
 view.append(h('div',{class:'page two'},next,note,ok,strip,h('div',{class:'cols even'},left,right)));
 const say=t=>{note.textContent=t;note.hidden=!t;if(t)ok.hidden=true},good=t=>{ok.textContent=t;ok.hidden=!t;if(t)note.hidden=true};

 // the form is built once and never rebuilt, so typing is never interrupted by a redraw
 const f={name:h('input',{type:'text',maxlength:'80','aria-label':'Name',placeholder:'Name, for example Oak tree'}),kind:h('select',{'aria-label':'Kind'},KIND_CHOICES.map(k=>h('option',{value:k},k))),
  stage:h('select',{'aria-label':'Stage'},HAND_STAGES.map(s=>h('option',{value:s},stageName(s)))),source:h('input',{type:'url',maxlength:'300','aria-label':'Source link',placeholder:'Link to the page it came from (optional)'}),
  licence:h('input',{type:'text',maxlength:'80','aria-label':'Licence',placeholder:'Licence, for example CC0 (optional)'}),note:h('input',{type:'text',maxlength:'300','aria-label':'Note',placeholder:'Note (optional)'})};
 const addBtn=h('button',{class:'btn pri',type:'button',onclick:()=>doAdd()},'Add asset');
 formBox.append(h('div',{class:'label'},'Add asset'),h('div',{class:'as-form'},f.name,h('div',{class:'as-pair'},f.kind,f.stage),f.source,f.licence,f.note),h('div',{class:'btns'},addBtn,h('span',{class:'small dim'},'Wanted, received or staged. The hub fills in the rest.')));

 async function call(op,body,done){
  if(busy)return;busy=true;say('');good('');
  const res=await recordsCall(op,body);busy=false;if(!alive)return;
  if(res.ok){good(done(res.data));await load(true);if(onChange)onChange();return true}
  say(errorText(res));return false}
 const doAdd=()=>call('add',{name:f.name.value,kind:f.kind.value,stage:f.stage.value,source:f.source.value,licence:f.licence.value,note:f.note.value},d=>`Added: ${d.row.name} (${stageName(d.row.stage)}). Undo is in the list below.`).then(added=>{if(added){f.name.value='';f.source.value='';f.licence.value='';f.note.value=''}});
 const doMove=(id,stage)=>call('stage',{id,stage},d=>`${d.row.name} is now ${stageName(d.row.stage)}.`);
 const doAttach=(id,file)=>call('file',{id,file},d=>`${d.change.label}. Undo is in the list below.`);
 const doUndo=id=>call('undo',{id},d=>`Undone: ${d.undone.label}.`);

 const pill=s=>h('span',{class:'as-pill st-'+s},stageName(s));
 function drawStrip(){
  strip.textContent='';
  for(const s of stripOf(data.stages))strip.append(h('button',{type:'button',class:'cell'+(s.hand?' hand':''),'aria-pressed':String(s.key===stage),onclick:()=>{stage=s.key;store.set('hub.assets.stage',stage);drawStrip();drawRows()}},h('b',{},String(s.count)),h('span',{},s.label),s.hand?h('i',{title:'You set this stage by hand'},'you set'):h('i',{title:"The game's modules decide this stage"},'by the game')))}
 function drawFiles(){
  filesBox.textContent='';
  const nf=data.newFiles||{total:0,items:[]},items=(nf.items||[]).filter(i=>!hidden.includes(i.path));
  if(!items.length)return;
  const box=h('div',{class:'box as-gap'},h('div',{class:'label'},`New files (${nf.total})`));
  for(const i of items){
   const cands=(i.candidates||[]).map(c=>h('button',{class:'btn',type:'button',disabled:busy,title:attachTitle(c),onclick:()=>doAttach(c.id,i.path)},`It is ${c.name}`));
   box.append(h('div',{class:'as-file'},h('div',{class:'plan-title'},newFileLine(i)),h('code',{class:'cm-path'},i.path),
    h('div',{class:'btns'},cands,h('button',{class:'btn',type:'button',onclick:()=>{f.name.value=nameFromFile(i.name);f.stage.value='received';f.name.scrollIntoView({block:'center'});f.name.focus()}},'Add as a new asset'),
     h('button',{class:'btn',type:'button',title:'Hide in this browser only',onclick:()=>{hidden=[...hidden,i.path].slice(-500);store.set('hub.assets.hidden',JSON.stringify(hidden));drawFiles()}},'Hide'))))}
  if(nf.total>items.length)box.append(h('p',{class:'small dim'},'Only the first files are listed.'));
  filesBox.append(box)}
 function drawRows(){
  rowsBox.textContent='';
  const g=groupRows(data.rows);
  const hand=HAND_STAGES.includes(stage);
  rowsBox.append(h('h2',{class:'sect'},stageName(stage),h('span',{},String(data.stages&&data.stages[stage]!=null?data.stages[stage]:0)),h('span',{class:'x'},hand?'you set this stage by hand':'the game decides this stage')));
  for(const s of hand?[stage,'retired']:[]){
   const list=g[s],det=h('details',{class:'fold as-group',open:s===stage});
   det.append(h('summary',{},`${stageName(s)} · ${list.length}`));
   if(!list.length)det.append(h('p',{class:'small dim'},'None.'));
   for(const r of list){
    const link=safeLink(r.source);
    det.append(h('div',{class:'as-row'},h('div',{class:'tool-head'},h('span',{class:'plan-main'},h('span',{class:'plan-title'},r.name),h('span',{class:'plan-meta'},[r.kind,r.licence,filesText(r),r.note].filter(Boolean).join(' · ')),link?h('a',{class:'small',href:link,target:'_blank',rel:'noopener noreferrer'},'source'):(r.source?h('span',{class:'small dim'},r.source):null)),
     h('span',{class:'acts'},pill(r.stage),
      h('select',{class:'sel','aria-label':`Move ${r.name} to`,onchange:e=>{const v=e.target.value;e.target.value='';if(v)doMove(r.id,v)}},h('option',{value:''},'Move to…'),moveOptions(r.stage).map(m=>h('option',{value:m},stageName(m)))),
      r.undo?h('button',{class:'btn',type:'button',onclick:()=>doUndo(r.undo)},'Undo'):null))))}
   rowsBox.append(det)}
  const shipped=Array.isArray(data.shipped)?data.shipped:[];
  for(const [s,label,pick] of [['converted','Converted',x=>x.stage==='converted'],['in-game','In game',x=>x.stage==='in-game'],['credited','Credited',x=>x.credited]]){
   if(s!==stage)continue;
   const list=shipped.filter(pick),det=h('details',{class:'fold as-group',open:true});
   det.append(h('summary',{},`${label} · ${data.stages?data.stages[s]:list.length} (the game decides)`));
   const ul=h('ul',{class:'as-names'},list.map(x=>h('li',{},x.name)));if(!list.length)det.append(h('p',{class:'small dim'},'None.'));else det.append(ul);
   rowsBox.append(det)}}
 function drawRecords(){
  recBox.textContent='';recBox.append(h('div',{class:'label'},'Recent changes'));
  const list=data.records||[];
  if(!list.length)recBox.append(h('p',{class:'small dim'},'No changes recorded yet. Every change made here, or by the master, appears with an Undo.'));
  for(const r of list)recBox.append(h('div',{class:'as-rec'},h('span',{class:'plan-meta'},`${agoText(r.at)} · ${recordLine(r)}`),r.canUndo?h('button',{class:'btn',type:'button',onclick:()=>doUndo(r.id)},'Undo'):null))}
 function drawLinks(){
  links.textContent='';
  links.append(h('a',{href:'/assets',target:'_blank',rel:'noopener'},'The pictures page'),' · ',h('a',{href:'/viewer.html',target:'_blank',rel:'noopener'},'3D viewer'),data.loadError?h('span',{class:'warn'},` · The game's modules could not be read (${data.loadError}); the shipped counts are missing.`):null)}

 async function load(force){
  clearTimeout(timer);
  const d=await getJson('/api/assets/summary');if(!alive)return;
  const s=JSON.stringify(d);
  if(!force&&s===sig){/* nothing changed: leave the page as it is (open groups stay open) */}
  else if(sig=s,!d||d.error){next.textContent='Could not read the asset register. Is the hub still running?';strip.textContent='';formBox.hidden=true;filesBox.textContent='';rowsBox.textContent='';recBox.hidden=true;links.textContent=''}
  else if(d.enabled===false){next.textContent='Asset records are off in this hub.';formBox.hidden=true;recBox.hidden=true}
  else{data=d;formBox.hidden=false;recBox.hidden=false;next.textContent='';next.append(h('b',{},'NEXT STEP'),nextStep(d));drawStrip();drawFiles();drawRows();drawRecords();drawLinks()}
  if(!alive)return;
  timer=setTimeout(()=>{if(document.hidden)timer=setTimeout(load,5000);else load()},15000)}
 load();
 return ()=>{alive=false;clearTimeout(timer)}}
