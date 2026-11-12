// Mikkadr Hub v2.5a: the cache rules (hub/cache.js) and the runner's cache numbers.
import assert from 'node:assert/strict';
import {usageOf,addUsage,contextOf,splitOf,observe,lifetime,stateOf,rewriteCost,stripText,coldSendWarning,modelSwitchWarning,newChatHint,MIN,COLD_WARN_TOKENS} from '../hub/web/cache.js';
import {createReducer,windowOf} from '../hub/runner.js';

assert.deepEqual(usageOf({input_tokens:5,output_tokens:7,cache_read_input_tokens:100,cache_creation_input_tokens:20,junk:'x'}),{input:5,output:7,cacheRead:100,cacheWrite:20});
assert.deepEqual(usageOf(null),{input:0,output:0,cacheRead:0,cacheWrite:0});assert.deepEqual(usageOf({input_tokens:-4,output_tokens:'9'}),{input:0,output:0,cacheRead:0,cacheWrite:0},'junk is zero');
assert.deepEqual(addUsage({input:1,output:2,cacheRead:3,cacheWrite:4},{input:1}),{input:2,output:2,cacheRead:3,cacheWrite:4});
const u={input:10,output:50,cacheRead:900,cacheWrite:90};
assert.equal(contextOf(u),1000,'context = input + re-used + written');
assert.deepEqual(splitOf(u),{reused:900,written:100,output:50,reusedShare:0.9});assert.equal(splitOf(null).reusedShare,0);

// hit and miss: at least half of the previous context re-used
const prev={at:0,model:'sonnet',input:10,cacheRead:0,cacheWrite:990};
assert.deepEqual(observe(prev,{at:2*MIN,model:'sonnet',input:10,cacheRead:990,cacheWrite:100}),{gapMs:2*MIN,hit:true,modelSwitch:false,model:'sonnet',context:1100});
assert.equal(observe(prev,{at:9*MIN,model:'sonnet',input:1000,cacheRead:0,cacheWrite:50}).hit,false);
assert.equal(observe(prev,{at:MIN,model:'opus',cacheRead:0,input:1000}).modelSwitch,true);
assert.equal(observe(prev,{at:-1}),null);assert.equal(observe(null,prev),null);

// lifetime: not sure with too little data; a model-switch miss is ignored; sure when 3 hits and a miss agree
const hit=g=>({gapMs:g*MIN,hit:true,modelSwitch:false}),miss=(g,sw=false)=>({gapMs:g*MIN,hit:false,modelSwitch:sw});
assert.equal(lifetime([]).sure,false);assert.equal(lifetime([hit(1),hit(2),miss(9)]).sure,false,'only 2 hits');
assert.equal(lifetime([hit(1),hit(2),hit(3)]).sure,false,'no miss yet');
assert.equal(lifetime([hit(1),hit(2),hit(3),miss(1,true)]).sure,false,'a model switch is not a cold cache');
assert.equal(lifetime([hit(1),hit(4),hit(3),miss(9)]).sure,true);
assert.equal(lifetime([hit(1),hit(8),hit(3),miss(6)]).sure,false,'a miss shorter than a hit disagrees');
const sure=lifetime([hit(1),hit(4),hit(3),miss(9)]);assert.equal(sure.longestHitMs,4*MIN);assert.equal(sure.shortestMissMs,9*MIN);

// state: a countdown only when sure
const unsure=lifetime([hit(1)]);
assert.deepEqual(stateOf({lastReplyAt:0,now:3*MIN,lifetime:unsure}),{state:'unknown',ageMs:3*MIN});
assert.deepEqual(stateOf({lastReplyAt:0,now:3*MIN,lifetime:sure}),{state:'warm',ageMs:3*MIN,countdownMs:MIN});
assert.equal(stateOf({lastReplyAt:0,now:10*MIN,lifetime:sure}).state,'cold');assert.equal(stateOf({lastReplyAt:0,now:6*MIN,lifetime:sure}).state,'unknown','between the longest hit and the shortest miss nobody knows');
assert.equal(stateOf({lastReplyAt:null,now:5,lifetime:sure}).state,'unknown');assert.equal(stateOf({lastReplyAt:0,now:3*MIN,lifetime:unsure}).countdownMs,undefined);

// words and warnings
assert.equal(stripText(stateOf({lastReplyAt:0,now:4*MIN,lifetime:unsure})),'Last reply 4 min ago');
assert.equal(stripText(stateOf({lastReplyAt:0,now:3*MIN,lifetime:sure})),'Cache warm · last reply 3 min ago · about 1 min left');
assert.equal(stripText(stateOf({lastReplyAt:0,now:10*MIN,lifetime:sure})),'Cache probably cold · last reply 10 min ago');assert.equal(stripText(null),'No reply yet');
const cold=stateOf({lastReplyAt:0,now:10*MIN,lifetime:sure});
assert.match(coldSendWarning(cold,COLD_WARN_TOKENS+1),/probably cold/);assert.equal(coldSendWarning(cold,1000),null);assert.equal(coldSendWarning({state:'unknown'},900000),null);
assert.match(modelSwitchWarning(120000),/120,000 tokens written new/);assert.equal(modelSwitchWarning(0),null);
assert.match(newChatHint(65000,100000),/60%/);assert.equal(newChatHint(65000,null),null,'no window known, no hint');assert.equal(newChatHint(10,100000),null);
assert.equal(rewriteCost(5000).tokens,5000);

// the runner: the tokens event carries the last message's four numbers; the window only when the summary has one
assert.equal(windowOf({modelUsage:{'claude-sonnet':{contextWindow:200000}}}),200000);assert.equal(windowOf({}),null);assert.equal(windowOf({modelUsage:{a:{contextWindow:'x'}}}),null);
const red=createReducer({}),L=o=>JSON.stringify(o);
const r1=red.take(L({type:'assistant',message:{id:'m1',content:[],usage:{input_tokens:3,output_tokens:4,cache_read_input_tokens:50,cache_creation_input_tokens:6}}}));
assert.deepEqual(r1.usage,{id:'m1',usage:{input_tokens:3,output_tokens:4,cache_read_input_tokens:50,cache_creation_input_tokens:6}});
red.take(L({type:'result',is_error:false,result:'ok',modelUsage:{m:{contextWindow:1000000}}}));assert.equal(red.window,1000000);
const red2=createReducer({});red2.take(L({type:'result',is_error:false,result:'ok'}));assert.equal(red2.window,null);
// the store: observations are appended per reply, learned from, and carry no text
{const fs=(await import('node:fs')).default,os=(await import('node:os')).default,path=(await import('node:path')).default;
 const {replyCache,lifeOf,loadObservations}=await import('../hub/cache-store.mjs');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'hub-cache-'));
 const turn=(u,at)=>({first:{...u,at},last:{...u,at},window:200000});
 let c=replyCache(root,null,'sonnet',turn({input:10,output:5,cacheRead:0,cacheWrite:1000},0),0,1000);
 assert.equal(c.cacheWrite,1000);assert.equal(c.window,200000);assert.deepEqual(loadObservations(root),[],'the first reply has nothing to compare with');
 let t=1000;
 for(const [gap,read] of [[1,1000],[2,1100],[4,1200]]){t+=gap*MIN;c=replyCache(root,c,'sonnet',turn({input:10,output:5,cacheRead:read,cacheWrite:100},t),t,t)}
 assert.equal(loadObservations(root).filter(o=>o.hit).length,3);assert.equal(lifeOf(root).sure,false,'3 hits, no miss yet');
 t+=9*MIN;c=replyCache(root,c,'sonnet',turn({input:2000,output:5,cacheRead:0,cacheWrite:100},t),t,t);
 assert.equal(lifeOf(root).sure,true);assert.equal(lifeOf(root).longestHitMs,4*MIN);assert.equal(lifeOf(root).shortestMissMs,9*MIN);
 t+=MIN;c=replyCache(root,c,'opus',turn({input:5000,output:5,cacheRead:0,cacheWrite:0},t),t,t);assert.equal(loadObservations(root).at(-1).modelSwitch,true,'a switch is marked');assert.equal(lifeOf(root).shortestMissMs,9*MIN,'and does not shorten the lifetime');
 assert.equal(replyCache(root,c,'opus',{first:null,last:null},t,t),c,'a turn with no usage keeps the old record');
 for(const l of fs.readFileSync(path.join(root,'.hub','cache.jsonl'),'utf8').trim().split('\n'))assert.deepEqual(Object.keys(JSON.parse(l)).sort(),['at','context','gapMs','hit','modelSwitch','model'].sort(),'numbers and flags only');
 fs.rmSync(root,{recursive:true,force:true})}
console.log('hub-cache: usage, context and split, hit and miss, lifetime not sure on thin data, model switch ignored, countdown only when sure, warnings, and the runner window passed.');