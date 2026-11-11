// Mikkadr Hub P4, S3: the shell's pure rules (no DOM, so tests can import it): the rows, the hash routes, the accent from the weekly gauge, the tab title.
export const ROWS=[
 {key:'chat',num:'01',label:'Chat'},
 {key:'waiting',num:'02',label:'Waiting for you'},
 {key:'plans',num:'03',label:'Plans'},
 {key:'assets',num:'04',label:'Assets'},
 {key:'tokens',num:'05',label:'Tokens'},
 {key:'runs',num:'06',label:'Runs'}];
export const ROUTES=ROWS.filter(r=>!r.off).map(r=>r.key);
export const routeOf=hash=>{const k=String(hash||'').replace(/^#\/?/,'').split(/[?&/]/)[0].toLowerCase();return ROUTES.includes(k)?k:'waiting'};
export const planIdOf=hash=>{const m=/^#\/?plans\/([a-z0-9][a-z0-9-]{0,79})(?:[?&].*)?$/.exec(String(hash||''));return m?m[1]:null}; // #plans/<id> opens that plan
export const runIdOf=hash=>{const m=/^#\/?runs\/(run-[0-9]{8}-[0-9]{6}-[0-9a-f]{4})(?:[?&].*)?$/.exec(String(hash||''));return m?m[1]:null}; // #runs/<id> opens that run
// Accent: blue under 60 percent weekly, orange from 60, red from 90. No reading means blue.
export const accentOf=pct=>!Number.isFinite(pct)?'blue':pct>=90?'red':pct>=60?'orange':'blue';
// Gauge bar colour class: the zone of its own window.
export const barOf=(pct,orangeAt,redAt)=>!Number.isFinite(pct)?'none':pct>=redAt?'red':pct>=orangeAt?'orange':'ok';
export const titleOf=(route,waitingCount)=>{const row=ROWS.find(r=>r.key===route)||ROWS.find(r=>r.key==='waiting');return `${waitingCount>0?`(${waitingCount}) `:''}${row.label} · Mikkadr Hub`};
export const pageOf=route=>route==='assets'?'/assets':route==='tokens'?'/tokens':null; // routes that open an existing page inside the shell
