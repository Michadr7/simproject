import assert from 'node:assert/strict';
import {CONTRACTS,acceptContract,completeContract,tickContract,gameMinutes,refreshGigBoard,availableContracts,gigTarget} from '../dist/contracts.js';
import {freshProgress,normalizeProgress,transactJob,saveProgress,loadProgress} from '../dist/jobs.js';
import {advanceTime} from '../dist/routine.js';
import {createShop} from '../dist/shops.js';
const start=freshProgress();assert.deepEqual(start.cooldowns,{});assert.equal(CONTRACTS.length,6);
assert(acceptContract(start,'unknown').error);
let state=acceptContract({...start,life:{...start.life,energy:1}},'bench-check').state;
assert.equal(state.life.energy,1);assert.equal(state.cooldowns['bench-check'],gameMinutes(state)+120);
assert(acceptContract(state,'notice-check').error);
state=advanceTime(state,10);state=transactJob(state,'pickup',{x:0,z:-2},{shop:'market'}).state;
let raw;const storage={getItem:()=>raw,setItem:(k,v)=>raw=v};saveProgress(storage,state);state=loadProgress(storage);
assert.equal(state.activeJob.id,'bench-check');assert.equal(state.cooldowns['bench-check'],660);
assert.equal(normalizeProgress({activeJob:{id:'made-up'}}).activeJob,null);
assert.equal(normalizeProgress({activeJob:{id:'bench-check',reward:999999}}).activeJob.reward,1000);
const tick=(s,point,extra={})=>tickContract(s,{position:point,room:point.room,dt:.1,...extra});
for(const template of CONTRACTS){
 let s=acceptContract(freshProgress(),template.id).state;
 if(template.location.room==='cafe')assert(!createShop('cafe').blocked(template.location.x,template.location.z));
 assert(completeContract(s,template.returnLocation,template.returnLocation.room).error);
 s=tick(s,template.location);assert.equal(s.activeJob.stage,'task');
 if(template.mode==='timed'){
  for(let i=0;i<10;i++)s=tick(s,template.location);
  s=tick(s,template.location,{moving:true});assert.equal(s.activeJob.workSeconds,0,'moving resets uninterrupted work');
  for(let i=0;i<template.duration*10+1;i++)s=tick(s,template.location);
 }else if(template.mode==='courier'){
  s=tick(s,template.taskLocation);assert.equal(s.activeJob.stage,'task','walking/teleporting cannot satisfy courier');
  s=tick(s,template.taskLocation,{running:true,distance:0});assert.equal(s.activeJob.runMetres,0,'held Shift with no distance earns nothing');
  for(let i=0;i<40;i++)s=tick(s,template.location,{running:true,moving:true,distance:.5});
  s=tick(s,template.taskLocation);
 }else s=tick(s,template.taskLocation);
 assert.equal(s.activeJob.stage,'return',template.id);
 s=normalizeProgress(s);assert.equal(s.activeJob.stage,'return','stage survives save normalization');
 assert(completeContract(s,{x:1000,z:1000}).error);
 const result=completeContract(s,template.returnLocation,template.returnLocation.room);
 assert.equal(result.paid,template.reward);assert.equal(result.state.routine.earned,template.reward);
 assert(completeContract(result.state,template.returnLocation).error);
 assert(acceptContract(result.state,template.id).error,'cooldown persists after completion');
 assert(!acceptContract(advanceTime(result.state,120),template.id).error);
}
let board=refreshGigBoard(freshProgress(),()=>.5);assert.equal(availableContracts(board).length,3);
assert.equal(refreshGigBoard(board,()=>0),board,'opening phone cannot reroll board');
const selected=availableContracts(board)[0];board=acceptContract(board,selected.id).state;assert.equal(availableContracts(board).length,2);
const second=availableContracts(board)[0];const depleted=acceptContract({...board,activeJob:null},second.id).state;assert.equal(availableContracts(refreshGigBoard(depleted,()=>.5)).length,3,'replenish offers when fewer than two remain');
const reloaded=normalizeProgress(board);assert.deepEqual(reloaded.gigBoard,board.gigBoard);
const acrossMidnight=acceptContract({...freshProgress(),routine:{...freshProgress().routine,minutes:1430}},'bench-check').state;
const later=advanceTime({...acrossMidnight,activeJob:null},119);assert(acceptContract(later,'bench-check').error);assert(!acceptContract(advanceTime(later,1),'bench-check').error);
// Eating/drinking pauses timed work without losing it; only real movement resets it.
{let s=acceptContract(freshProgress(),'bench-check').state;const at=CONTRACTS.find(c=>c.id==='bench-check').location;
 s=tick(s,at);for(let i=0;i<30;i++)s=tick(s,at);const before=s.activeJob.workSeconds;assert(before>2.9);
 for(let i=0;i<10;i++)s=tick(s,at,{paused:true});assert.equal(s.activeJob.workSeconds,before,'paused work is preserved');
 s=tick(s,at);assert(s.activeJob.workSeconds>before,'work resumes after eating');
 s=tick(s,at,{paused:true,moving:true});assert.equal(s.activeJob.workSeconds,0,'movement still resets');}
console.log('Six gig flows, eating pauses timed work, timed resets, courier distance, board persistence, save migration and midnight-safe cooldowns passed.');
