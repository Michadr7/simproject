// Mikkadr Hub, P3c: the import checklist. For a received or wanted asset, the steps between "we have it" and "it is in the game", worked out from the register's facts
// (format, triangles, unit, class, textures, files). Pure: no files, no model calls. The page shows the steps as boxes; `blockers` are the steps that stop an import today.
// Credit and licence steps are marked `later`: they do not count in the progress until the public release (the user, 2026-11-10).

// Triangle budgets per class, from what already ships: furniture up to about 1,600, cars about 3,000, shops up to 3,500, houses about 2,000. A character is budgeted at 20,000
// because the frame budget is about 15 skinned characters on screen (15 x 20,000 = 300,000); the shipped ones are 49,158 and 36,682. These are the user's to change.
export const BUDGET={building:6000,furniture:1500,prop:1500,tool:1300,vehicle:3500,animal:1500,character:20000};
export const DEFAULT_CLASS='prop';

const num=n=>Number(n).toLocaleString('en-US');
const step=(id,label,state,extra={})=>({id,label,state,...extra}); // state: done | todo

export function checklistFor(a){
 const steps=[],files=a.files||[],cls=BUDGET[a.class]?a.class:DEFAULT_CLASS,budget=a.targetTriangles||BUDGET[cls]; // an entry can set its own target (the Jeep: about 2,500)
 const kind=a.kind||'model',wanted=a.stage==='wanted';
 // 1. the original
 steps.push(files.length?step('original','The original is in assets-src','done',{blocker:false}):step('original',wanted?'Get the model (download or make it)':'Put the original into assets-src (it is not on this PC)','todo',{blocker:true}));
 if(kind!=='model'){
  steps.push(step('use',`Use it: ${a.plannedUse||'say what it is for'}`,'todo'));
  steps.push(step('docs','Record it in ASSETS.md','todo'));
  return finish(a,steps);
 }
 // 2. format
 const fmt=(a.format||'').toLowerCase();
 if(fmt==='glb'||fmt==='gltf')steps.push(step('format',`Format is ${fmt.toUpperCase()}: no conversion`,'done',{blocker:false}));
 else if(fmt)steps.push(step('format',a.archive?`Unpack the ${a.archive.toUpperCase()} archive and convert the ${fmt.toUpperCase()} to GLB (one-time)`:`Convert the ${fmt.toUpperCase()} to GLB (one-time)`,'todo',{blocker:true}));
 else steps.push(step('format','Check the file format (GLB or glTF is ready)','todo',{blocker:!wanted}));
 // 3. textures
 if(a.textures==='tga')steps.push(step('textures','Convert the TGA textures to PNG','todo',{blocker:true}));
 // 4. size
 const t=a.triangles;
 if(t==null)steps.push(step('size','Count the triangles (budget about '+num(budget)+' for a '+cls+')','todo'));
 else if(t>budget){
  const pack=/\b(pack|kit|bundle)\b/i.test(a.name||''); // for a pack, `triangles` is the largest piece
  steps.push(step('size',`Simplify ${pack?'the largest piece ':''}from ${num(t)} to about ${num(budget)} triangles`,'todo',{from:t,to:budget}));
 }else steps.push(step('size',`${num(t)} triangles: within the budget of about ${num(budget)}`,'done',{blocker:false}));
 // 5. scale
 steps.push(step('scale',a.unit?`Set the scale: ${a.unit} m per model unit (check a door against the 1.95 m player)`:a.scaleNote?`Fix the scale (${a.scaleNote}) against the 1.95 m player`:'Measure the scale against the 1.95 m player','todo'));
 // 6. convert
 steps.push(step('convert',a.skinned?'Add it as a rigged model (see rigged-assets.js and rigged-props.js)':'Add it to scripts/build-props.mjs and run it (writes props-assets.js)','todo'));
 // 7. place
 steps.push(step('use',`Use it: ${a.plannedUse||'say what it is for'}`,'todo'));
 // 8. docs
 steps.push(step('docs','Record it in ASSETS.md (Shipped) and run npm test','todo'));
 return finish(a,steps);
}

function finish(a,steps){
 const lic=a.licence||'';
 if(!lic||/check|confirm|presum/i.test(lic))steps.push(step('licence','Confirm the licence and author','todo',{later:true}));
 if(/CC-BY/i.test(lic)||!a.credit)steps.push(step('credits','Add a credits.js line'+(/CC-BY/i.test(lic)?' (CC-BY: required)':''),'todo',{later:true}));
 const counted=steps.filter(s=>!s.later),done=counted.filter(s=>s.state==='done').length;
 const blockers=counted.filter(s=>s.state==='todo'&&s.blocker).map(s=>s.label);
 return {steps,done,total:counted.length,blockers,ready:a.stage==='received'&&blockers.length===0,next:(counted.find(s=>s.state==='todo')||{}).label||null};
}

// All received and wanted assets with their checklists, the most ready first (ready, then fewest steps left, then name).
export function checklists(assets){
 return assets.filter(a=>a.origin==='register'&&(a.stage==='received'||a.stage==='wanted')&&!a.shippedAs).map(a=>({asset:a,...checklistFor(a)}))
  .sort((x,y)=>(y.ready-x.ready)||((x.total-x.done)-(y.total-y.done))||x.asset.name.localeCompare(y.asset.name));
}
