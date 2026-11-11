// Mikkadr Hub, P3c step 4: the asset tracker page. A static page (no scripts) in the token watcher's look: every pack is a folded row with a few pictures and its stage counts,
// opening it shows each asset as a card with its picture, stage, triangles, size, licence and credit. The stage filter is CSS only (radio buttons and :has()).
// Pure: `renderAssetsPage` takes the grouped assets, the pictures as data URIs and the studio's measurements, and returns the HTML text.
import {STAGES,isRecent,heaviest,frameBudget,RECENT_DAYS,usesText} from './assets.js';
import {checklistFor,checklists} from './checklist.js';
import {hashText} from './plans.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>n==null?'-':Number(n).toLocaleString('en-US');
const STAGE_LABEL={wanted:'Wanted',received:'Received',converted:'Converted','in-game':'In game',retired:'Retired'};
const ACCENT='59,130,246';
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const sizeText=s=>s?`${s.w} × ${s.d} × ${s.h} m`:'';

// An asset's best known numbers: the register or module value, else what the studio measured when it drew the picture.
export function facts(a,manifest={}){
 const m=manifest[a.id]||{};
 return {triangles:a.triangles??m.triangles??null,size:a.size||m.size||null};
}

// What needs a human: shipped assets nothing references, shipped assets with no credit line, forced in-game claims, and anything the studio could not draw.
// Credit and licence lines wait for the public release (the user, 2026-11-10): they are listed apart, folded.
const RELEASE_KINDS=new Set(['credit','licence']);
export function attention(assets,manifest={}){
 const out=[];
 for(const a of assets){
  if(a.shippedAs)out.push({id:a.id,name:a.name,kind:'outdated',text:`The register says "${a.stage}", but the game already ships this as ${a.shippedName}. Remove the entry, or fix it if it is a different model.`});
  if(a.stage==='converted'&&a.origin==='module')out.push({id:a.id,name:a.name,kind:'unused',text:'Converted into the game files but nothing in the game code or map uses it.'});
  if(a.origin==='module'&&a.hasCredit===false)out.push({id:a.id,name:a.name,kind:'credit',text:'credits.js has no line that covers this asset\'s source, so the Credits screen may be missing it.'});
  if(a.evidence&&/^override/.test(a.evidence))out.push({id:a.id,name:a.name,kind:'override',text:'Counted as in game by a manual override: '+a.evidence.replace(/^override: /,'')+'.'});
  const m=manifest[a.id];if(m&&m.error)out.push({id:a.id,name:a.name,kind:'picture',text:'The studio could not draw it: '+m.error});
  if(/CC-BY/i.test(a.licence||'')&&a.origin==='register'&&a.stage!=='wanted')out.push({id:a.id,name:a.name,kind:'licence',text:'CC-BY: needs a credit line on the Credits screen before it ships ('+a.licence+').'});
 }
 return out;
}

// What the hub's Waiting for you list reads (written to .hub/attention.json by `npm run assets`): the attention rows a person can act on now. Credit, licence and manual-override rows stay out.
// `hash` is the content hash of the row (its text, the asset's own content hash and stage), so a hidden item shows again when the asset really changes.
const HUB_KINDS=new Set(['unused','outdated','picture']);
export function attentionItems(assets,manifest={}){
 const byId=new Map(assets.map(a=>[a.id,a]));
 return attention(assets,manifest).filter(x=>HUB_KINDS.has(x.kind)).map(x=>{const a=byId.get(x.id);
  return {id:x.id,name:x.name,kind:x.kind,text:String(x.text).slice(0,240),viewable:hasModel(a),hash:hashText(JSON.stringify([x.id,x.kind,x.text,a.hash||'',a.stage||'']))}});
}

// "New" or "Changed" for an asset whose entry in the changes file is recent (the first run is only a baseline and marks nothing).
const recentChip=(c,now)=>isRecent(c,now)?` <span class="chip c-new" title="${esc(new Date(c.changedAt).toLocaleDateString('en-US'))}">${c.kind==='new'?'New':'Changed'}</span>`:'';

// A received or wanted asset's import progress on its card: "Import 2 of 6 · next: ...".
function importLine(a){
 if(a.origin!=='register'||(a.stage!=='received'&&a.stage!=='wanted'))return '';
 if(a.shippedAs)return `<div class="meta imp"><span class="chip c-warn">outdated</span> <span class="dim">already ships as ${esc(a.shippedName)}</span></div>`;
 const c=checklistFor(a);
 return `<div class="meta imp"><span class="chip ${c.ready?'c-ok':'c-warn'}">${c.ready?'ready to import':`import ${c.done}/${c.total}`}</span> ${c.next?`<span class="dim">next: ${esc(c.next)}</span>`:''}</div>`;
}

function card(a,pictures,manifest,viewer,changes={},now=Date.now()){
 const f=facts(a,manifest),pic=pictures.get(a.id),meta=[];
 if(f.triangles!=null)meta.push(`${num(f.triangles)} triangles`);
 if(f.size)meta.push(sizeText(f.size));
 const lic=[a.licence,a.credit&&a.credit!==a.licence?a.credit:''].filter(Boolean).join(' · ');
 return `<article class="item s-${esc(a.stage)}" id="${esc(slug(a.id))}">
  ${pic?`<img src="${pic}" width="128" height="128" alt="${esc(a.name)}" loading="lazy">`:`<div class="noimg">no picture</div>`}
  <div class="info"><div class="name">${esc(a.name)}${viewer&&hasModel(a)?` <a class="v3d" href="${esc(viewer)}#${encodeURIComponent(a.id)}" title="Open in the 3D viewer (npm run hub)">3D</a>`:''}</div><span class="chip st-${esc(a.stage)}">${esc(STAGE_LABEL[a.stage]||a.stage)}</span>${recentChip(changes[a.id],now)}
  ${meta.length?`<div class="meta">${esc(meta.join(' · '))}</div>`:''}
  ${a.origin==='module'?`<div class="meta used">${usesText(a.uses)?'Used: '+esc(usesText(a.uses)):'<b>Not used anywhere in the game</b>'}</div>`:''}
  ${a.plannedUse?`<div class="use">${esc(a.plannedUse)}</div>`:''}
  ${importLine(a)}
  ${lic?`<div class="meta dim">${esc(lic)}</div>`:''}
  ${a.notes?`<div class="meta dim">${esc(a.notes)}</div>`:''}
  </div></article>`;
}

function group(g,pictures,manifest,openAt,viewer,changes={},now=Date.now()){
 const fresh=g.items.filter(a=>isRecent(changes[a.id],now)).length;
 const chips=STAGES.filter(s=>g.stages[s]).map(s=>`<span class="chip st-${s}">${g.stages[s]} ${esc(STAGE_LABEL[s].toLowerCase())}</span>`).join('')+(fresh?`<span class="chip c-new">${fresh} new or changed</span>`:'');
 const strip=g.items.filter(a=>pictures.get(a.id)&&!(manifest[a.id]||{}).placeholder).slice(0,4).map(a=>`<img src="${pictures.get(a.id)}" width="44" height="44" alt="">`).join('');
 const info=(g.info||[]).map(p=>`${p.licence?esc(p.licence):''}${p.credit?` · ${esc(p.credit)}`:''}`).filter(Boolean).join('; ');
 const stageClasses=STAGES.filter(s=>g.stages[s]).map(s=>'h-'+s).join(' ');
 return `<details class="pack ${stageClasses}"${g.items.length<=openAt?' open':''}><summary><span class="strip">${strip}</span><span class="pname">${esc(g.pack)}</span><span class="count">${g.items.length}</span><span class="chips">${chips}</span></summary>
 ${info||g.triangles?`<div class="pinfo dim">${[info,g.triangles?num(g.triangles)+' triangles in all':''].filter(Boolean).join(' · ')}</div>`:''}
 <div class="grid">${g.items.map(a=>card(a,pictures,manifest,viewer,changes,now)).join('')}</div></details>`;
}

export const VIEWER_URL='http://127.0.0.1:8765/viewer.html';
// A model the viewer can show (not a wanted asset, a placeholder, or a picture).
const hasModel=a=>a.kind==='model'&&(a.origin==='module'||(a.files||[]).some(f=>/\.(glb|gltf)$/i.test(f)));

// The heaviest shipped assets against the frame budget (the brief: about 15 skinned characters and 10 cars on screen). Triangles only: draw calls are not known here.
function heavySection(all){
 const top=heaviest(all,12);if(!top.length)return '';
 const max=top[0].triangles,fb=frameBudget(all);
 const rows=top.map(a=>`<tr><td><a href="#${esc(slug(a.id))}">${esc(a.name)}</a>${a.skinned?' <span class="chip">skinned</span>':''}</td><td class="n">${num(a.triangles)}</td><td class="barcell"><div class="hbar${a.skinned?' sk':''}" style="width:${Math.max(2,Math.round(a.triangles/max*100))}%"></div></td></tr>`).join('');
 const line=(label,b)=>b.each?`<li><b>${b.count} ${label}</b> at the heaviest (${esc(b.heaviest)}, ${num(b.each)}) is about <b>${num(b.total)}</b> triangles.</li>`:'';
 return `<h2>Heaviest assets</h2><div class="wrap"><table><thead><tr><th>Asset</th><th class="n">Triangles</th><th>Share of the heaviest</th></tr></thead><tbody>${rows}</tbody></table></div>
<ul class="dim budget">${line('characters on screen',fb.characters)}${line('cars on screen',fb.cars)}<li>Only shipped assets, from the game's files or the studio's measurement. Draw calls (budget 300) are not counted here.</li></ul>`;
}

// The import checklist: every received and wanted asset, the most ready first, each with its steps as boxes (done steps ticked; credit and licence steps wait until the release).
function importSection(all){
 const list=checklists(all);if(!list.length)return '';
 const ready=list.filter(x=>x.ready).length,blocked=list.filter(x=>!x.ready&&x.asset.stage==='received').length;
 const rows=list.map(x=>`<details class="imp-row"><summary><span class="iname"><a href="#${esc(slug(x.asset.id))}">${esc(x.asset.name)}</a></span><span class="chip st-${esc(x.asset.stage)}">${esc(STAGE_LABEL[x.asset.stage])}</span><span class="chip ${x.ready?'c-ok':'c-warn'}">${x.ready?'ready':`${x.done}/${x.total}`}</span><span class="dim ib">${x.blockers.length?'blocked by: '+esc(x.blockers.join('; ')):x.next?'next: '+esc(x.next):''}</span></summary>
  <ul class="steps">${x.steps.map(s=>`<li class="${s.state}${s.later?' later':''}"><span class="box">${s.state==='done'?'✓':''}</span>${esc(s.label)}${s.later?' <span class="dim">(before the public release)</span>':''}</li>`).join('')}</ul></details>`).join('');
 return `<h2>Import checklist (${list.length})</h2><div class="note dim">${ready} received asset${ready===1?'':'s'} ready to import now, ${blocked} blocked (most by an original that is not on this PC). Triangle budgets per class are in <code>hub/checklist.js</code>. Open a row for its steps.</div><div class="wrap impwrap">${rows}</div>`;
}

export function renderAssetsPage({groups,summary,pictures=new Map(),manifest={},changes={},generatedAt=Date.now(),openAt=3,viewer=VIEWER_URL}){
 const now=generatedAt,all=groups.flatMap(g=>g.items),fresh=all.filter(a=>isRecent(changes[a.id],now)),everything=attention(all,manifest),later=everything.filter(x=>RELEASE_KINDS.has(x.kind)),att=everything.filter(x=>!RELEASE_KINDS.has(x.kind));
 const stageCards=STAGES.filter(s=>(summary.byStage[s]||0)>0).map(s=>`<div class="card stat"><div class="mono">${esc(STAGE_LABEL[s].toUpperCase())}</div><div class="big">${summary.byStage[s]}</div></div>`).join('');
 const filters=[['all','All']].concat(STAGES.filter(s=>(summary.byStage[s]||0)>0).map(s=>[s,STAGE_LABEL[s]])).map(([v,l],i)=>`<input type="radio" name="stage" id="f-${v}" class="fx"${i===0?' checked':''}><label for="f-${v}" class="fl">${esc(l)}</label>`).join('');
 const filterCss=STAGES.map(s=>`body:has(#f-${s}:checked) .item:not(.s-${s}){display:none}body:has(#f-${s}:checked) .pack:not(.h-${s}){display:none}`).join('');
 const attRow=x=>`<tr><td><a href="#${esc(slug(x.id))}">${esc(x.name)}</a></td><td><span class="chip c-${x.kind==='picture'||x.kind==='credit'||x.kind==='outdated'?'warn':x.kind==='licence'?'no':'ok'}">${esc(x.kind)}</span></td><td>${esc(x.text)}</td></tr>`;
 const attRows=att.map(attRow).join('')||'<tr><td colspan="3" class="dim">Nothing needs attention.</td></tr>',laterRows=later.map(attRow).join('');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mikkadr Hub · Assets</title>
<style>
:root{--acc:${ACCENT};--bg:#0b0c0e;--ink:#f1efe9;--dim:rgba(241,239,233,.55);--line:rgba(255,255,255,.14);--panel:rgba(255,255,255,.045);--ok:#5fbf85;--watch:#e0b060;--high:#e8905f;--crit:#f2766d;--blue:#6aa7ff}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(120% 90% at 100% 100%,rgba(var(--acc),.26),transparent 62%),var(--bg);color:var(--ink);font:15px/1.55 "Segoe UI",system-ui,sans-serif;min-height:100vh}
main{max-width:1100px;margin:0 auto;padding:28px max(16px,env(safe-area-inset-left,0px)) 56px max(16px,env(safe-area-inset-right,0px))}
h1{font-size:28px;margin:6px 0 2px;letter-spacing:-.01em}h2{font:500 11px/1 ui-monospace,Consolas,monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);margin:34px 0 12px}
.mono{font:500 11px/1 ui-monospace,Consolas,monospace;letter-spacing:.16em;color:var(--dim)}.dim{color:var(--dim)}a{color:var(--blue)}
.card{border:1px solid var(--line);background:var(--panel);border-radius:12px;padding:14px 16px;min-width:0}.stats{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr))}.big{font-size:36px;font-weight:600;letter-spacing:-.02em;margin-top:8px}
.chip{font:600 10.5px ui-monospace,Consolas,monospace;letter-spacing:.09em;text-transform:uppercase;border:1px solid currentColor;border-radius:99px;padding:2px 9px;color:var(--dim);white-space:nowrap}
.st-in-game,.c-ok{color:var(--ok)}.st-converted{color:var(--blue)}.st-received{color:var(--watch)}.st-wanted{color:var(--dim)}.st-retired{color:var(--crit)}.c-warn{color:var(--watch)}.c-no{color:var(--crit)}
.filters{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 14px}.fx{position:absolute;opacity:0;pointer-events:none}.fl{cursor:pointer;border:1px solid var(--line);border-radius:99px;padding:5px 14px;font-size:13.5px;background:var(--panel)}.fx:checked+.fl{background:rgba(var(--acc),.28);border-color:rgb(var(--acc))}.fx:focus-visible+.fl{outline:2px solid var(--blue)}
${filterCss}
.pack{border:1px solid var(--line);background:var(--panel);border-radius:12px;margin:10px 0;overflow:hidden}.pack>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:12px;padding:10px 14px;flex-wrap:wrap}.pack>summary::-webkit-details-marker{display:none}.pack>summary::before{content:"▸";color:var(--dim);width:12px}.pack[open]>summary::before{content:"▾"}
.pack>summary:hover{background:rgba(255,255,255,.04)}.strip{display:flex;gap:4px;min-width:50px}.strip img{border-radius:6px;background:rgba(0,0,0,.25);object-fit:contain}.pname{font-weight:600;flex:1 1 220px}.count{font:600 12px ui-monospace,Consolas,monospace;color:var(--dim)}.chips{display:flex;gap:6px;flex-wrap:wrap}
.pinfo{padding:0 16px 8px 40px;font-size:13px}.grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));padding:6px 14px 14px}
.item{display:flex;gap:10px;border:1px solid var(--line);border-radius:10px;padding:8px;background:rgba(0,0,0,.18);min-width:0}.item img,.noimg{flex:none;width:96px;height:96px;object-fit:contain;border-radius:8px;background:rgba(255,255,255,.04)}.noimg{display:grid;place-items:center;font-size:11px;color:var(--dim)}
.info{min-width:0;font-size:13px}.name{font-weight:600;font-size:14px;margin-bottom:3px;overflow-wrap:anywhere}.meta{margin-top:3px;overflow-wrap:anywhere}.use{margin-top:3px}.v3d{font:600 10.5px ui-monospace,Consolas,monospace;letter-spacing:.08em;border:1px solid var(--blue);border-radius:99px;padding:1px 8px;text-decoration:none;margin-left:6px;vertical-align:middle}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}th{font:500 10.5px ui-monospace,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.c-new{color:#7fd6e0}.note{margin:0 0 8px;font-size:13.5px}.n{text-align:right;font-variant-numeric:tabular-nums}.barcell{width:46%}.hbar{height:10px;border-radius:5px;background:var(--blue)}.hbar.sk{background:var(--watch)}.budget{margin:8px 0 0;padding-left:20px;font-size:13.5px}
.impwrap{overflow:visible}.imp-row{border-bottom:1px solid var(--line)}.imp-row:last-child{border-bottom:0}.imp-row>summary{list-style:none;cursor:pointer;display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 14px}.imp-row>summary::-webkit-details-marker{display:none}.imp-row>summary::before{content:"▸";color:var(--dim);width:10px}.imp-row[open]>summary::before{content:"▾"}.imp-row>summary:hover{background:rgba(255,255,255,.04)}
.iname{font-weight:600;min-width:200px}.ib{font-size:13px;flex:1 1 300px}.steps{list-style:none;margin:0;padding:2px 14px 12px 38px;font-size:13.5px}.steps li{display:flex;gap:10px;align-items:baseline;padding:2px 0}.steps .box{flex:none;width:16px;height:16px;border:1.5px solid var(--dim);border-radius:4px;display:inline-grid;place-items:center;font-size:12px;line-height:1;color:var(--ok);transform:translateY(3px)}.steps .done .box{border-color:var(--ok)}.steps .done{color:var(--dim)}.steps .later{opacity:.6}.imp{margin-top:5px}
.wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--panel)}.wrap table{min-width:520px}
footer{margin-top:30px;color:var(--dim);font-size:13.5px}code{font:13px ui-monospace,Consolas,monospace;background:rgba(255,255,255,.08);padding:2px 6px;border-radius:5px}
@media(max-width:560px){.item img,.noimg{width:72px;height:72px}.strip{display:none}}
</style></head><body><main>
<div class="mono">MIKKADR HUB</div><h1>Assets</h1><div class="dim">Built ${esc(new Date(generatedAt).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))}. ${summary.total} assets in ${groups.length} packs: the ${summary.fromModules} that ship are read from the game's own files, the rest from <code>assets-register.json</code>.</div>
<h2>Stages</h2><div class="stats">${stageCards}</div>
<h2>Needs attention (${att.length})</h2><div class="wrap"><table><thead><tr><th>Asset</th><th>Kind</th><th>What</th></tr></thead><tbody>${attRows}</tbody></table></div>
${later.length?`<details class="pack later"><summary><span class="pname">Before the public release</span><span class="count">${later.length}</span><span class="dim">credit lines and CC-BY licences: not urgent</span></summary><div class="wrap" style="margin:0 14px 14px"><table><thead><tr><th>Asset</th><th>Kind</th><th>What</th></tr></thead><tbody>${laterRows}</tbody></table></div></details>`:''}
${heavySection(all)}
${importSection(all)}
<h2>Packs</h2>${fresh.length?`<div class="note dim">New or changed in the last ${RECENT_DAYS} days (${fresh.length}): ${fresh.slice(0,12).map(a=>`<a href="#${esc(slug(a.id))}">${esc(a.name)}</a>`).join(', ')}${fresh.length>12?', …':''}.</div>`:''}<div class="filters" role="radiogroup" aria-label="Show stage">${filters}</div>
${groups.map(g=>group(g,pictures,manifest,openAt,viewer,changes,now)).join('\n')}
<footer>Pictures are drawn by <code>npm run asset-pictures</code> with the game's own models in software WebGL, so they are stills. Packs of more than ${openAt} assets start folded; click a row to open it. Rebuild this page with <code>npm run assets</code>. The <b>3D</b> links need the viewer running: <code>npm run hub</code>.</footer>
</main></body></html>
`;
}
