import assert from 'node:assert/strict';
import {MARKET,ROUTES,freshProgress,transactJob,routeFor,targetFor,loadProgress,saveProgress,normalizeProgress,money} from '../dist/jobs.js';
let state=freshProgress();assert.equal(state.cash,0);
assert(transactJob(state,'deliver',ROUTES[0]).error,'cannot get paid before pickup');
assert(transactJob(state,'pickup',{x:0,z:20}).error,'cannot collect remotely');
assert(transactJob(state,'pickup',MARKET).error,'door cannot dispense delivery orders');
let expected=0;
for(let i=0;i<5;i++){
 const picked=transactJob(state,'pickup',{x:0,z:-2},{shop:'market'});assert(!picked.error);state=picked.state;assert.equal(state.cash,expected);
 assert(transactJob(state,'pickup',{x:0,z:-2},{shop:'market'}).error,'cannot duplicate pickup');
 let raw;const storage={setItem:(k,v)=>raw=v,getItem:()=>raw};
 assert(saveProgress(storage,{...state,position:{x:19,z:-6.3}}));state=loadProgress(storage);assert.equal(state.phase,'carrying');assert.equal(state.position.x,19);
 assert.deepEqual(targetFor(state),routeFor(state));assert(transactJob(state,'deliver',MARKET).error,'cannot deliver at pickup');
 const route=routeFor(state),delivered=transactJob(state,'deliver',state.completed%3===1?{x:0,z:-2}:route,{shop:state.completed%3===1?'cafe':null});expected+=route.pay;state=delivered.state;
 assert.equal(state.cash,expected);assert.equal(state.completed,i+1);assert.equal(state.phase,'available');assert.equal(delivered.paid,route.pay);
 const duplicate=transactJob(state,'deliver',state.completed%3===1?{x:0,z:-2}:route,{shop:state.completed%3===1?'cafe':null});assert(duplicate.error);assert.equal(duplicate.state.cash,expected);
 saveProgress(storage,state);assert.equal(loadProgress(storage).cash,expected);
}
assert.equal(normalizeProgress({cash:-100,completed:NaN,position:{x:Infinity,z:0}}).cash,0);
assert.equal(normalizeProgress({position:{x:1000,z:0}}).position,null);
assert.equal(loadProgress({getItem:()=>'{'}).cash,0);
assert.equal(loadProgress({getItem(){throw Error('blocked')}}).phase,'available');
assert.equal(saveProgress({setItem(){throw Error('quota')}},state),false);
assert.equal(money(1200),'$12.00');
console.log('Job flow, proximity checks, one-time wages, route cycling, resume, corrupt saves and blocked storage passed.');
