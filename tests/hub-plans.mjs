// Mikkadr Hub P4 S1: plans as pure data (ids, revisions, answers, the 409 rule, deny needs a reason) and the plans folder (atomic write, ignored.json skipped, hand-edited files survive).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {submitPlan,answerPlan,statusOf,normalizePlan,planId,slugify,titleOf,hashText,latestRevision} from '../hub/plans.js';
import {sendPlan,listPlans,readPlan,findPlan} from '../hub/plans-store.mjs';

const T0=Date.UTC(2026,10,10,12);
// ids and titles
assert.equal(slugify('Mikkadr Hub: P4 plan!'),'mikkadr-hub-p4-plan');assert.equal(slugify('!!!'),'plan');
assert.equal(planId(T0,'Build the Hub'),'2026-11-10-build-the-hub');
assert.equal(titleOf('intro\n## The Title ##\nbody','x'),'The Title');assert.equal(titleOf('no heading','fallback'),'fallback');
assert.equal(hashText('a\r\nb'),hashText('a\nb'),'line endings do not change the hash');

// create, no-op, revision, answered text refused
let r=submitPlan(null,{source:'p.md',title:'T',from:'claude',text:'# T\nbody',now:T0});
assert.equal(r.action,'created');assert.equal(r.plan.status,'waiting');assert.equal(r.plan.revisions.length,1);assert.equal(r.plan.id,'2026-11-10-t');
let plan=r.plan;
assert.equal(submitPlan(plan,{source:'p.md',from:'claude',text:'# T\nbody',now:T0+1}).action,'noop','identical text while waiting');
assert.ok(submitPlan(null,{source:'p.md',text:'  \n',now:T0}).error,'empty plan');
assert.ok(submitPlan(null,{source:'p.md',text:'x'.repeat(200001),now:T0}).error,'too long');

// answers
assert.equal(answerPlan(plan,{verdict:'maybe',revision:1,now:T0}).code,400);
assert.equal(answerPlan(plan,{verdict:'denied',note:'  ',revision:1,now:T0}).code,400,'deny needs a reason');
assert.equal(answerPlan(plan,{verdict:'approved',revision:2,now:T0}).code,400,'revision that does not exist');
const rev2=submitPlan(plan,{source:'p.md',from:'claude',text:'# T\nbody v2',now:T0+5}).plan;
assert.equal(rev2.revisions.length,2);assert.equal(latestRevision(rev2).n,2);
assert.equal(answerPlan(rev2,{verdict:'approved',revision:1,now:T0}).code,409,'answer to an old revision');
const denied=answerPlan(rev2,{verdict:'denied',note:'too big',revision:2,now:T0+9}).plan;
assert.equal(denied.status,'denied');assert.deepEqual(statusOf(denied),{id:denied.id,title:'T',status:'denied',revision:2,verdict:'denied',note:'too big',buildable:false});
assert.equal(answerPlan(denied,{verdict:'approved',revision:2,now:T0}).code,409,'already answered');
assert.ok(submitPlan(denied,{source:'p.md',from:'claude',text:'# T\nbody v2',now:T0}).error,'the answered revision cannot be re-sent unchanged');
const again=submitPlan(denied,{source:'p.md',from:'claude',text:'# T\nbody v3',now:T0+20});
assert.equal(again.action,'revision');assert.equal(again.plan.status,'waiting','a new revision is waiting again after an answer');assert.equal(again.plan.answers.length,1,'old answers stay');
const ok=answerPlan(again.plan,{verdict:'approved',revision:3,now:T0+30}).plan;
assert.equal(statusOf(ok).buildable,true);assert.equal(statusOf(again.plan).buildable,false);assert.equal(statusOf(again.plan).verdict,null,'no answer for revision 3 yet');

// normalizePlan survives bad files
assert.equal(normalizePlan(null),null);assert.equal(normalizePlan({id:'Bad Id',revisions:[{n:1,text:'x'}]}),null);assert.equal(normalizePlan({id:'a',revisions:[]}),null);
assert.equal(normalizePlan({id:'a',status:'weird',revisions:[{n:1,text:'x'}]}).status,'waiting');

// the store
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hub-plans-')),plans=path.join(dir,'plans');
try{
 assert.deepEqual(listPlans(plans),[],'no folder yet');
 const a=sendPlan(plans,{source:'notes/a.md',title:'Alpha',from:'claude',text:'# Alpha\none',now:T0});
 assert.equal(a.action,'created');assert.ok(fs.existsSync(path.join(plans,'2026-11-10-alpha.json')));
 assert.deepEqual(fs.readdirSync(plans).filter(f=>f.endsWith('.tmp')),[],'no temp file left behind');
 assert.equal(sendPlan(plans,{source:'notes/a.md',title:'Alpha',from:'claude',text:'# Alpha\none',now:T0+1}).action,'noop');
 assert.equal(sendPlan(plans,{source:'notes/a.md',from:'claude',text:'# Alpha\ntwo',now:T0+2}).action,'revision');
 assert.equal(readPlan(plans,'2026-11-10-alpha').revisions.length,2);
 const other=sendPlan(plans,{source:'notes/a.md',title:'Alpha',from:'someone-else',text:'# Alpha\none',now:T0+3});
 assert.equal(other.action,'created','another sender is another plan');assert.equal(other.plan.id,'2026-11-10-alpha-2','id collision gets a suffix');
 fs.writeFileSync(path.join(plans,'ignored.json'),'["abc"]');fs.writeFileSync(path.join(plans,'broken.json'),'{nope');fs.writeFileSync(path.join(plans,'wrong-name.json'),JSON.stringify(a.plan));
 assert.deepEqual(listPlans(plans).map(p=>p.id),['2026-11-10-alpha','2026-11-10-alpha-2'],'ignored.json, broken and misnamed files are skipped');
 assert.equal(readPlan(plans,'../etc/passwd'),null);assert.equal(readPlan(plans,'nope'),null);
 assert.equal(findPlan(plans,'2026-11-10-alpha').id,'2026-11-10-alpha');assert.equal(findPlan(plans,'notes/a.md').source,'notes/a.md');assert.equal(findPlan(plans,'zzz'),null);
 assert.ok(sendPlan(plans,{source:'x.md',text:'',now:T0}).error);
}finally{fs.rmSync(dir,{recursive:true,force:true})}

// found plan files: names, the unsent filter, hide-by-hash, and the scan
import {isPlanFileName,unsentOf,HASH_PATTERN} from '../hub/plans.js';
import {scanPlanFiles,readIgnored,addIgnored,foundPlans} from '../hub/plans-store.mjs';
for(const [n,ok] of [['plan.md',true],['PLAN.md',true],['PLAN-hub.md',true],['my-plan-v2.md',true],['plan.txt',false],['Plan.md',false],['notes.md',false],['plan.md.bak',false]])assert.equal(isPlanFileName(n),ok,n);
assert.ok(HASH_PATTERN.test('0123456789abcdef')&&!HASH_PATTERN.test('0123456789ABCDEF')&&!HASH_PATTERN.test('abc'));
const F=[{path:'a/plan.md',hash:'1111111111111111'},{path:'b/plan.md',hash:'2222222222222222'},{path:'c/plan.md',hash:'3333333333333333'}];
assert.deepEqual(unsentOf(F,['a/plan.md'],['2222222222222222']).map(f=>f.path),['c/plan.md'],'sent files and hidden hashes are left out');
assert.equal(unsentOf(F,[],[]).length,3);assert.deepEqual(unsentOf([{path:'b/plan.md',hash:'9999999999999999'}],[],['2222222222222222']).length,1,'an edited file (new hash) shows again');
const d2=fs.mkdtempSync(path.join(os.tmpdir(),'hub-scan-'));
try{
 fs.mkdirSync(path.join(d2,'deep','er'),{recursive:true});fs.mkdirSync(path.join(d2,'dist','releases'),{recursive:true});fs.mkdirSync(path.join(d2,'dist','other'),{recursive:true});fs.mkdirSync(path.join(d2,'plans'));
 for(const f of ['PLAN.md','deep/er/x-plan.md','dist/other/plan.md','dist/releases/plan.md','plans/plan.md','empty-plan.md'])fs.writeFileSync(path.join(d2,f),f==='empty-plan.md'?'  ':'# '+f);
 fs.writeFileSync(path.join(d2,'bom-plan.md'),'﻿# bom');
 assert.deepEqual(scanPlanFiles(d2).map(f=>f.path),['PLAN.md','bom-plan.md','deep/er/x-plan.md','dist/other/plan.md'],'dist/releases, plans/ and empty files are skipped');
 assert.equal(scanPlanFiles(d2).find(f=>f.path==='bom-plan.md').text,'# bom','a BOM is stripped');
 assert.equal(scanPlanFiles(d2,{maxFiles:2}).length,2,'capped');
 const pd=path.join(d2,'plans');assert.deepEqual(readIgnored(pd),[]);
 const h=scanPlanFiles(d2)[0].hash;addIgnored(pd,h);addIgnored(pd,h);assert.deepEqual(readIgnored(pd),[h],'hiding twice keeps one entry');assert.throws(()=>addIgnored(pd,'nope'));
 assert.equal(foundPlans(d2,pd).length,3);fs.writeFileSync(path.join(pd,'ignored.json'),'{broken');assert.deepEqual(readIgnored(pd),[],'a broken ignored file counts as empty');
}finally{fs.rmSync(d2,{recursive:true,force:true})}
console.log('hub-plans ok');
