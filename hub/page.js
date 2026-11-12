// P3: the watcher page

// Mikkadr Hub, P3: the watcher page as one static HTML file (no scripts, no network, opens from disk). The look follows the hub's design: a dark calm surface,
// monospace micro-labels, an accent that follows the weekly gauge (blue under 60, orange from 60, red from 90), colour never the only signal (every state also has words).
import {LIMITS,canStart,effectiveStop} from './watcher.js';

const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num=n=>Math.round(n).toLocaleString('en-US');
export const duration=ms=>{if(ms==null)return '';const m=Math.round(ms/60000);if(m<60)return `${m} min`;const h=Math.floor(m/60);if(h<48)return `${h} h ${m%60} min`;return `${Math.floor(h/24)} d ${h%24} h`};
const when=ms=>ms==null?'':new Date(ms).toLocaleString('en-US',{weekday:'short',hour:'numeric',minute:'2-digit'});
const ZONE_TEXT={calm:'Calm',watch:'Watch',high:'High',critical:'Critical',stop:'Stop',unknown:'No reading'};
const ACCENT={calm:'59,130,246',watch:'232,150,40',high:'232,110,40',critical:'220,52,62',stop:'220,52,62',unknown:'120,128,140'};

function gauge(win,config){
 const L=LIMITS[win.key],stop=win.key==='weekly'?effectiveStop(config):L.stop,pct=win.known?win.pct:null,w=pct==null?0:Math.min(100,pct); // the weekly stop drawn is the effective one (the internal guard, if on)
 const ticks=[L.watch,L.high,L.critical,stop].map(v=>`<i class="tick${v===stop?' stop':''}" style="left:${Math.min(v,100)}%"></i>`).join('');
 const labels=[0,L.watch,L.high,stop].map(v=>`<span style="left:${Math.min(v,100)}%">${v}${v===stop?' '+(win.key==='weekly'?'stop':'pause'):''}</span>`).join('');
 const reset=win.resetsAt?`${win.resetSinceReading?'Reset at':'Resets'} ${esc(when(win.resetsAt))}${win.known&&win.resetIn!=null?` (in ${esc(duration(win.resetIn))})`:''}`:'';
 return `<section class="card gauge z-${win.zone}" aria-label="${esc(L.label)} usage">
  <div class="mono">${esc(L.label.toUpperCase())}</div>
  <div class="big">${pct==null?'<span class="dim">no reading</span>':`${pct}<small>%</small>`} <span class="chip">${esc(ZONE_TEXT[win.zone])}</span></div>
  <div class="bar" role="img" aria-label="${pct==null?'no reading':pct+' percent'}"><div class="fill" style="width:${w}%"></div>${ticks}</div>
  <div class="scale">${labels}</div>
  <div class="note">${esc(reset)}${win.readingAt?`${reset?' · ':''}read ${esc(duration(Date.now()-win.readingAt))} ago`:''}</div>
 </section>`}

export function renderPage({state,today,week,readings=[],rate=null,generatedAt=Date.now(),probeCommand='npm run watcher -- --probe'}){
 const accent=ACCENT[state.weekly.known?state.weekly.zone:'unknown'];
 const banners=state.warnings.map(w=>`<div class="banner b-${w.level}" role="${w.level==='stop'?'alert':'status'}"><b>${esc(({stop:'STOP',critical:'CRITICAL',high:'HIGH',watch:'WATCH',info:'NOTE'})[w.level])}</b> ${esc(w.text)}</div>`).join('')||'<div class="banner b-ok" role="status"><b>OK</b> Both gauges are inside their limits.</div>';
 const cases=[['Sonnet, small task',{estimatePct:1,model:'sonnet'}],['Sonnet, large task',{estimatePct:5,model:'sonnet'}],['Opus, medium task',{estimatePct:3,model:'opus'}],['Any model, no estimate',{estimatePct:null,model:'sonnet'}],['Opus, huge task',{estimatePct:15,model:'opus'}]];
 const rows=cases.map(([label,opts])=>{const r=canStart(state,opts);return `<tr><td>${esc(label)}</td><td>${opts.estimatePct==null?'unknown':opts.estimatePct+'%'}</td><td><span class="chip ${!r.ok?'c-no':r.needsProbe||r.secondYes?'c-warn':'c-ok'}">${!r.ok?'refused':r.needsProbe?'new reading first':r.secondYes?'needs a second yes':'allowed'}</span></td><td>${esc(r.reasons.join('; ')||(r.needsProbe?'take a new reading first':''))}</td></tr>`}).join('');
 const modelRows=m=>Object.entries(m).sort((a,b)=>b[1].billable-a[1].billable).map(([name,t])=>`<tr><td>${esc(name)}</td><td class="n">${num(t.messages)}</td><td class="n">${num(t.billable)}</td><td class="n">${num(t.output)}</td><td class="n dim">${num(t.cacheRead)}</td></tr>`).join('')||'<tr><td colspan="5" class="dim">Nothing logged.</td></tr>';
 const history=[...readings].reverse().slice(0,10).map(r=>`<tr><td>${esc(new Date(r.at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))}</td><td>${esc(r.source||'')}</td><td class="n">${r.weekly?r.weekly.pct+'%':'-'}</td><td class="n">${r.fiveHour?r.fiveHour.pct+'%':'-'}</td></tr>`).join('')||'<tr><td colspan="4" class="dim">No readings yet.</td></tr>';
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mikkadr Hub · Token watcher</title>
<style>
:root{--acc:${accent};--bg:#0b0c0e;--ink:#f1efe9;--dim:rgba(241,239,233,.55);--line:rgba(255,255,255,.14);--panel:rgba(255,255,255,.045);--ok:#5fbf85;--watch:#e0b060;--high:#e8905f;--crit:#f2766d}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(120% 90% at 100% 100%,rgba(var(--acc),.26),transparent 62%),var(--bg);color:var(--ink);font:15px/1.55 "Segoe UI",system-ui,sans-serif;min-height:100vh}
main{max-width:1000px;margin:0 auto;padding:28px max(16px,env(safe-area-inset-left,0px)) 56px max(16px,env(safe-area-inset-right,0px))}
h1{font-size:28px;margin:6px 0 2px;letter-spacing:-.01em}h2{font:500 11px/1 ui-monospace,Consolas,monospace;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);margin:34px 0 12px}
.mono{font:500 11px/1 ui-monospace,Consolas,monospace;letter-spacing:.16em;color:var(--dim)}.dim{color:var(--dim)}
.banner{border:1px solid var(--line);background:var(--panel);border-radius:10px;padding:10px 14px;margin:8px 0;border-left-width:4px}.banner b{font:600 11px ui-monospace,Consolas,monospace;letter-spacing:.14em;margin-right:8px}
.b-ok{border-left-color:var(--ok)}.b-info{border-left-color:rgba(255,255,255,.4)}.b-watch{border-left-color:var(--watch)}.b-high{border-left-color:var(--high)}.b-critical,.b-stop{border-left-color:var(--crit)}
.gauges{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}.card{border:1px solid var(--line);background:var(--panel);border-radius:12px;padding:16px 18px;min-width:0}
.big{font-size:44px;font-weight:600;letter-spacing:-.02em;margin:10px 0 12px;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.big small{font-size:22px;color:var(--dim)}
.chip{font:600 11px ui-monospace,Consolas,monospace;letter-spacing:.1em;text-transform:uppercase;border:1px solid currentColor;border-radius:99px;padding:3px 10px;color:var(--dim)}
.z-calm .chip,.c-ok{color:var(--ok)}.z-watch .chip,.c-warn{color:var(--watch)}.z-high .chip{color:var(--high)}.z-critical .chip,.z-stop .chip,.c-no{color:var(--crit)}
.bar{position:relative;height:16px;border-radius:5px;background:rgba(255,255,255,.1)}.fill{position:absolute;inset:0 auto 0 0;border-radius:5px;background:var(--ok)}
.z-watch .fill{background:var(--watch)}.z-high .fill{background:var(--high)}.z-critical .fill,.z-stop .fill{background:var(--crit)}
.tick{position:absolute;top:-5px;bottom:-5px;width:2px;background:var(--ink);opacity:.5}.tick.stop{background:var(--crit);opacity:1;width:3px}
.scale{position:relative;height:20px;margin-top:8px;font:11px ui-monospace,Consolas,monospace;color:var(--dim);font-variant-numeric:tabular-nums}.scale span{position:absolute;transform:translateX(-50%);white-space:nowrap}.scale span:first-child{transform:none}.scale span:last-child{transform:translateX(-100%);color:var(--crit)}
.note{font-size:13.5px;color:var(--dim);margin-top:4px}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}th{font:500 10.5px ui-monospace,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}.n{text-align:right;font-variant-numeric:tabular-nums}
.wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--panel)}.wrap table{min-width:480px}
.split{display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(500px,1fr))}
footer{margin-top:30px;color:var(--dim);font-size:13.5px}code{font:13px ui-monospace,Consolas,monospace;background:rgba(255,255,255,.08);padding:2px 6px;border-radius:5px}
</style></head><body><main>
<div class="mono">MIKKADR HUB</div><h1>Token watcher</h1><div class="dim">Built ${esc(new Date(generatedAt).toLocaleString('en-US',{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))}. Weekly stop at ${effectiveStop(state.config)}%${state.config.internalGuard!=null?` (internal guard on; your hard limit is ${LIMITS.weekly.stop}%)`:''}; the 5-hour limit may reach 100%.</div>
<h2>Warnings</h2>${banners}
<h2>Gauges</h2><div class="gauges">${gauge(state.weekly,state.config)}${gauge(state.fiveHour,state.config)}</div>
<h2>Would a run start now?</h2><div class="wrap"><table><thead><tr><th>Run</th><th>Estimate</th><th>Decision</th><th>Why</th></tr></thead><tbody>${rows}</tbody></table></div>
<div class="note" style="margin-top:8px">${rate?`Learned rate: about ${rate.rate}% of the weekly limit per million tokens (${rate.n} pair${rate.n===1?'':'s'} of readings, rough).`:'No learned rate yet: estimates stay unknown until two readings a few percent apart have been taken.'}</div>
<h2>Tokens used on this PC</h2><div class="split">
<div><div class="mono" style="margin-bottom:8px">TODAY</div><div class="wrap"><table><thead><tr><th>Model</th><th class="n">Msgs</th><th class="n">Used</th><th class="n">Output</th><th class="n">Cache read</th></tr></thead><tbody>${modelRows(today)}</tbody></table></div></div>
<div><div class="mono" style="margin-bottom:8px">LAST 7 DAYS</div><div class="wrap"><table><thead><tr><th>Model</th><th class="n">Msgs</th><th class="n">Used</th><th class="n">Output</th><th class="n">Cache read</th></tr></thead><tbody>${modelRows(week)}</tbody></table></div></div></div>
<div class="note" style="margin-top:8px">Used = input + output + cache writes. Counted from Claude Code session logs on this PC only; other devices and the web are not included, so the gauges above are the truth and this is a guide.</div>
<h2>Readings</h2><div class="wrap"><table><thead><tr><th>When</th><th>Source</th><th class="n">Weekly</th><th class="n">5-hour</th></tr></thead><tbody>${history}</tbody></table></div>
<footer>To take a new reading: <code>${esc(probeCommand)}</code> (one Haiku call, about 7,600 tokens, under a cent). Any agent run the hub starts also records one. This page is rebuilt each time <code>npm run watcher</code> runs; it does not refresh itself.</footer>
</main></body></html>`}
