import {normalizeCafe} from './cafe-job.js';
import {normalizeRoutine} from './routine.js';
import {normalizeLife} from './life.js';
import {freshHousing,normalizeHousing} from './housing.js';
export const MARKET={name:'Corner Market',x:19,z:-6.3};
export const ROUTES=[
 {name:'18 Oak Street',description:'A grocery order for a resident at the apartments.',x:1,z:-6.3,pay:1200},
 {name:'Alder Coffee',description:'A fresh produce order for the coffee shop.',x:36,z:-6.3,pay:1400},
 {name:'Oak Street Laundry',description:'A grocery order for the laundry staff.',x:-13,z:-6.3,pay:1800}
];
export const PROGRESS_KEY='citylife.progress.v1';
export const freshProgress=()=>({cash:0,completed:0,phase:'available',position:null,housing:freshHousing(),life:normalizeLife(),routine:normalizeRoutine(),cafe:normalizeCafe()});
export const money=cents=>'$'+(cents/100).toFixed(2);
export function normalizeProgress(value){
 const a=value&&typeof value==='object'?value:{},s=freshProgress();
 if(Number.isSafeInteger(a.cash)&&a.cash>=0&&a.cash<=1e10)s.cash=a.cash;
 if(Number.isSafeInteger(a.completed)&&a.completed>=0&&a.completed<=100000)s.completed=a.completed;
 if(a.phase==='carrying')s.phase='carrying';
 if(a.position&&Number.isFinite(a.position.x)&&Number.isFinite(a.position.z)&&a.position.x>=-61&&a.position.x<=58&&a.position.z>=-48&&a.position.z<=48)s.position={x:a.position.x,z:a.position.z};
 s.housing=normalizeHousing(a.housing);s.life=normalizeLife(a.life);s.routine=normalizeRoutine(a.routine);s.cafe=normalizeCafe(a.cafe);return s;
}
export const routeFor=s=>ROUTES[s.completed%ROUTES.length];
export const targetFor=s=>s.phase==='carrying'?routeFor(s):MARKET;
export const nearby=(position,target)=>Math.hypot(position.x-target.x,position.z-target.z)<=2.5;
export function transactJob(state,action,position){
 const s=normalizeProgress(state);
 if(action==='pickup'&&s.phase==='available'&&nearby(position,MARKET))return {state:{...s,phase:'carrying'},paid:0};
 if(action==='deliver'&&s.phase==='carrying'&&nearby(position,routeFor(s))){const pay=routeFor(s).pay;return {state:{...s,phase:'available',completed:s.completed+1,cash:s.cash+pay,routine:{...s.routine,earned:s.routine.earned+pay}},paid:pay}}
 return {state:s,paid:0,error:'Move to the marked entrance to continue.'};
}
export function loadProgress(storage){try{const a=JSON.parse(storage.getItem(PROGRESS_KEY));return a?.version===1?normalizeProgress(a.progress):freshProgress()}catch{return freshProgress()}}
export function saveProgress(storage,progress){try{storage.setItem(PROGRESS_KEY,JSON.stringify({version:1,progress:normalizeProgress(progress)}));return true}catch{return false}}
