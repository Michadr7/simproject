// Mikkadr Hub P4 S3, tree from Hub v2 V1: the shell's rules (the tree, hash routes, accent thresholds, tab title) and that its page, script and style are wired and served.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {HUB_VERSION,TREE,ROUTES,routeOf,runIdOf,accentOf,barOf,titleOf,pageOf} from '../hub/web/shell.js';
import {resolveRoute} from '../hub/server.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
assert.deepEqual(TREE.areas.map(r=>r.label),['Chat','Work','Assets']);assert.deepEqual(TREE.foot.map(r=>r.label),['Commit','Deploy','Tools','Tokens']);
assert.deepEqual(ROUTES,['chat','work','assets','commit','deploy','tools','tokens'],'three areas and four foot rows, each with its own route; Waiting, Plans and Runs live inside Work');
assert.equal(runIdOf('#runs/run-20261111-140211-ab12'),'run-20261111-140211-ab12');assert.equal(runIdOf('#runs/../x'),null);assert.equal(runIdOf('#runs'),null);assert.equal(runIdOf('#plans/run-20261111-140211-ab12'),null);
for(const [h,r] of [['#waiting','work'],['#plans','work'],['#assets','assets'],['#tokens','tokens'],['#/plans','work'],['#Plans?id=x','work'],['#plans/2026-11-10-x','work'],['','work'],[undefined,'work'],['#sessions','work'],['#chat','chat'],['#runs','work'],['#runs/run-20261111-140211-ab12','work'],['#nope','work'],['#__proto__','work']])assert.equal(routeOf(h),r,`route of ${JSON.stringify(h)}`);
// the accent follows the weekly gauge: blue under 60, orange from 60, red from 90
for(const [p,a] of [[0,'blue'],[7,'blue'],[59.9,'blue'],[60,'orange'],[89.9,'orange'],[90,'red'],[100,'red'],[null,'blue'],[undefined,'blue'],[NaN,'blue']])assert.equal(accentOf(p),a,`accent at ${p}`);
// each gauge bar uses its own thresholds (weekly 60/90, 5-hour 50/90)
assert.equal(barOf(55,60,90),'ok');assert.equal(barOf(55,50,90),'orange');assert.equal(barOf(90,50,90),'red');assert.equal(barOf(null,60,90),'none');
assert.equal(titleOf('work',4),'(4) Work · Mikkadr Hub');assert.equal(titleOf('chat',0),'Chat · Mikkadr Hub');assert.equal(titleOf('zzz',0),'Work · Mikkadr Hub');
assert.match(HUB_VERSION,/^2\.\d+(\.\d+)?$/,'the hub shows its own version, 2.<step>');
assert.equal(pageOf('assets'),null,'Assets draws its own page since V4');assert.equal(pageOf('tokens'),'/tokens');assert.equal(pageOf('plans'),null);

// S4: opening one plan by hash, and the Plans page's pure helpers
import {planIdOf} from '../hub/web/shell.js';
import {agoText,groupPlans,sizeText,STATUS_LABEL} from '../hub/web/plans.js';
for(const [h,id] of [['#plans/2026-11-10-hub-p4','2026-11-10-hub-p4'],['#/plans/a1','a1'],['#plans','' ],['#plans/UPPER',''],['#plans/../x',''],['#assets/a1',''],['#plans/a?x=1','a'],[undefined,'']])assert.equal(planIdOf(h)||'',id,`plan id of ${h}`);
assert.equal(agoText(0),'');assert.equal(agoText(1000,1000),'just now');assert.equal(agoText(0+1,1+5*60000),'5 min ago');assert.equal(agoText(1,1+3*3600000),'3 h ago');assert.equal(agoText(1,1+5*86400000),'5 days ago');
assert.equal(sizeText(300),'300 B');assert.equal(sizeText(4096),'4 KB');assert.deepEqual(Object.keys(STATUS_LABEL),['waiting','approved','denied']);
const g=groupPlans([{id:'a',status:'waiting',sentAt:5},{id:'b',status:'approved',sentAt:1},{id:'c',status:'waiting',sentAt:2},{id:'d',status:'denied',sentAt:9}]);
assert.deepEqual(g.waiting.map(p=>p.id),['c','a'],'oldest waiting first');assert.deepEqual(g.answered.map(p=>p.id),['d','b'],'newest answered first');
const plansJs=fs.readFileSync(path.join(root,'hub','web','plans.js'),'utf8');
assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(plansJs),'the Plans page sets text only; the plan body goes through DOMParser');assert.ok(plansJs.includes('DOMParser'));
assert.ok(!/https?:\/\//.test(plansJs),'nothing is loaded from outside');
assert.equal((plansJs.match(/method:'POST'/g)||[]).length,1,'one place sends writes, always as JSON');assert.ok(plansJs.includes("'Content-Type':'application/json'"));

// the page is wired to files the server serves
const html=fs.readFileSync(path.join(root,'hub','web','index.html'),'utf8');
for(const id of ['menutab','panel','nav','g-weekly','g-five','title','view','frame'])assert.ok(html.includes(`id="${id}"`),`index.html has #${id}`);
for(const u of ['/web/hub.css','/web/app.js'])assert.ok(html.includes(u)&&resolveRoute(root,u,'127.0.0.1:1',1).file&&fs.existsSync(resolveRoute(root,u,'127.0.0.1:1',1).file),`${u} is linked and served`);
const app=fs.readFileSync(path.join(root,'hub','web','app.js'),'utf8');
assert.ok(fs.existsSync(resolveRoute(root,'/web/shell.js','127.0.0.1:1',1).file)&&app.includes("'./shell.js'"));
assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(app),'the shell builds its DOM with text only');
assert.ok(!/https?:\/\//.test(html+app+fs.readFileSync(path.join(root,'hub','web','hub.css'),'utf8')),'nothing is loaded from outside');
assert.ok(/method\s*:\s*'POST'/.test(app)===false,'S3 sends no writes');
console.log('hub-shell ok');
