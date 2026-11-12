// Mikkadr Hub P5 R1: the Run block parser, the caps, and every gate of startCheck. Pure; no model call, no process.
import assert from 'node:assert/strict';
import {parseRunBlock,capTokens,startCheck,describeRun,CAPS,NEEDS,PLACEHOLDER_RATE} from '../hub/runplan.js';
import {submitPlan,answerPlan} from '../hub/plans.js';
import {evaluate} from '../hub/watcher.js';

const T0=Date.UTC(2026,10,11,12);
const block=(o={})=>`# Plan\nsome text\n\n## Run\nmodel: ${o.model??'sonnet'}   # why\nwhy: ${o.why??'builds against tests'}\nsize: ${o.size??'M'}\nneeds: ${o.needs??'npm test, release'}\n\n## Later\nmodel: opus\n`;

// parsing
let p=parseRunBlock(block());
assert.ok(p.ok);assert.deepEqual(p.run,{model:'sonnet',size:'M',why:'builds against tests',needs:['test','release']});
assert.equal(parseRunBlock('# no run here').ok,false);
assert.match(parseRunBlock('# x').errors[0],/no "## Run"/);
assert.equal(parseRunBlock(block()).run.model,'sonnet','a later section\'s model line is not read');
assert.equal(parseRunBlock('## Run\r\nmodel: haiku\r\nsize: S\r\n').run.model,'haiku','CRLF');
assert.equal(parseRunBlock('## Run\n```\nmodel: haiku\nsize: s\n```\n').run.size,'S','inside a code fence, lower-case size');
assert.equal(parseRunBlock('## Run\n- model: haiku\n- size: S\n').ok,true,'bullet list form');
// unknown keys and extra text never matter
p=parseRunBlock('## Run\nmodel: sonnet\nsize: S\nflags: --dangerously-skip-permissions\ntools: Bash\nneeds: npm test\n');
assert.ok(p.ok);assert.deepEqual(Object.keys(p.run).sort(),['model','needs','size','why']);assert.deepEqual(p.run.needs,['test']);
// bad values
assert.equal(parseRunBlock('## Run\nmodel: gpt\nsize: S\n').ok,false);
assert.equal(parseRunBlock('## Run\nmodel: sonnet\nsize: XL\n').ok,false);
assert.equal(parseRunBlock('## Run\nmodel: sonnet\n').ok,false,'size missing');
assert.equal(parseRunBlock('## Run\nmodel: haiku\nsize: M\n').ok,false,'haiku has only S');
assert.equal(parseRunBlock('## Run\nmodel: opus\nsize: L\n').ok,false,'opus has no L');
p=parseRunBlock('## Run\nmodel: sonnet\nsize: S\nneeds: git push, npm test\n');
assert.equal(p.ok,false);assert.match(p.errors.join(' '),/git push/);assert.deepEqual(p.run.needs,['test']);
// fable is never taken from a plan
p=parseRunBlock('## Run\nmodel: fable\nsize: S\n');assert.equal(p.ok,false);assert.equal(p.fableAsked,true);assert.equal(p.run.model,null);
// why is one clean line, capped
p=parseRunBlock('## Run\nmodel: sonnet\nsize: S\nwhy: '+'x'.repeat(500)+'\n');assert.equal(p.run.why.length,200);
// caps
assert.equal(capTokens('haiku','S'),150000);assert.equal(capTokens('sonnet','M'),1500000);assert.equal(capTokens('opus','S'),400000);
assert.equal(capTokens('haiku','M'),null);assert.equal(capTokens('nothing','S'),null);
assert.deepEqual(Object.keys(NEEDS),['test','release','check','index']);
assert.match(describeRun(block()),/model sonnet · size M · cap 1,500,000 tokens · needs npm test, npm run release -- --force · why: builds against tests/);
assert.match(describeRun('# x'),/no "## Run"/);
assert.match(describeRun('## Run\nmodel: fable\nsize: S\n'),/fable \(ask refused/);

// startCheck: helper to build an approved plan
const approve=(text,{answerAt=T0+1000}={})=>{let r=submitPlan(null,{source:'p.md',title:'T',from:'master',text,now:T0});r=answerPlan(r.plan,{verdict:'approved',note:'go',revision:1,now:answerAt});return r.plan};
const gauges=(weekly=10,five=20)=>evaluate([{at:T0,weekly:{pct:weekly,resetsAt:Math.floor(T0/1000)+86400},fiveHour:{pct:five,resetsAt:Math.floor(T0/1000)+3600}}],{now:T0+60000});
const ok=(o)=>startCheck({plan:approve(block()),picked:'sonnet',state:gauges(),...o});

let c=ok();assert.equal(c.ok,true);assert.equal(c.code,'ok');assert.equal(c.model,'sonnet');assert.equal(c.capTokens,1500000);
assert.equal(c.estimatePct,Math.round(1.5*PLACEHOLDER_RATE*10)/10);assert.deepEqual(c.needs,['test','release']);

// plan state
let waiting=submitPlan(null,{source:'p.md',title:'T',from:'master',text:block(),now:T0}).plan;
c=startCheck({plan:waiting,picked:'sonnet',state:gauges()});assert.equal(c.ok,false);assert.match(c.reasons.join(' '),/not approved/);
let denied=answerPlan(waiting,{verdict:'denied',note:'no',revision:1,now:T0+1}).plan;
assert.equal(startCheck({plan:denied,picked:'sonnet',state:gauges()}).ok,false);
// a new revision after approval is not approved
let rev2=submitPlan(approve(block()),{source:'p.md',from:'master',text:block({size:'L'}),now:T0+5000}).plan;
assert.equal(startCheck({plan:rev2,picked:'sonnet',state:gauges()}).ok,false,'revision 2 is waiting again');
// approval older than the revision
assert.equal(startCheck({plan:approve(block(),{answerAt:T0-5}),picked:'sonnet',state:gauges()}).ok,false,'approval stamped before the revision');
// active run
c=ok({activeRun:true});assert.equal(c.ok,false);assert.match(c.reasons.join(' '),/already active/);
// bad Run block
c=startCheck({plan:approve('# x\nno run block'),picked:'sonnet',state:gauges()});assert.equal(c.ok,false);
c=startCheck({plan:approve(block({size:'XL'})),picked:'sonnet',state:gauges()});assert.equal(c.ok,false);
// the model on the card must be the approved one
c=ok({picked:'haiku'});assert.equal(c.ok,false);assert.match(c.reasons.join(' '),/approved plan says sonnet/);
c=ok({picked:'gpt'});assert.equal(c.ok,false);
// opus: always a second yes
const opusPlan=approve(block({model:'opus',size:'S'}));
c=startCheck({plan:opusPlan,picked:'opus',state:gauges(5)});assert.equal(c.ok,false);assert.equal(c.code,'second-yes');assert.equal(c.needsSecondYes,true);assert.equal(c.capTokens,400000);
c=startCheck({plan:opusPlan,picked:'opus',state:gauges(5),secondYes:true});assert.equal(c.ok,true);
// a second yes does not rescue another refusal
c=startCheck({plan:opusPlan,picked:'opus',state:gauges(5),secondYes:true,activeRun:true});assert.equal(c.ok,false);assert.equal(c.code,'refused');
// fable: never from a plan, only on the user's pick
const fablePlan=approve(block({model:'fable',size:'S'}));
c=startCheck({plan:fablePlan,picked:'sonnet',state:gauges()});assert.equal(c.ok,false);assert.match(c.reasons.join(' '),/pick it/);
c=startCheck({plan:fablePlan,picked:'fable',state:gauges(5)});assert.equal(c.ok,true,'picked on the card, weekly under 60: no second yes');assert.equal(c.model,'fable');assert.equal(c.capTokens,400000);
c=startCheck({plan:fablePlan,picked:'fable',state:gauges(65)});assert.equal(c.code,'second-yes','fable from 60 needs the second yes');
c=startCheck({plan:approve(block()),picked:'fable',state:gauges(5)});assert.equal(c.ok,true,'the user may pick fable for any approved plan');
// gauges: weekly never reaches the stop (97) with the whole cap counted
c=ok({state:gauges(97)});assert.equal(c.ok,false,'already at the stop');
c=ok({state:gauges(90)});assert.equal(c.ok,true,'90 + 4.5 = 94.5, under 97');
c=ok({state:gauges(94)});assert.equal(c.ok,false,'94 + 4.5 = 98.5, past 97');assert.match(c.reasons.join(' '),/past the stop at 97%/);
c=ok({state:gauges(94),rate:0.5});assert.equal(c.ok,true,'a learned rate of 0.5 %/M: 94 + 0.75');assert.equal(c.estimatePct,0.8);
c=startCheck({plan:approve(block({size:'S'})),picked:'sonnet',state:gauges(94)});assert.equal(c.ok,true,'a small run fits: 600k at 3 %/M = 1.8, 94 + 1.8 = 95.8');
c=startCheck({plan:approve(block({size:'S'})),picked:'sonnet',state:gauges(96)});assert.equal(c.ok,false,'96 + 1.8 = 97.8, past 97');
c=ok({state:gauges(10,100)});assert.equal(c.ok,false,'5-hour at 100: paused until the reset');
c=startCheck({plan:approve(block()),picked:'sonnet'});assert.equal(c.ok,false,'no gauge state at all');
c=ok({state:evaluate([],{now:T0})});assert.equal(c.ok,false,'no reading: refused');assert.equal(c.needsProbe,true);assert.match(c.reasons.join(' '),/no current weekly reading/);
console.log('hub-runplan: ok');

