// Mikkadr Hub v2.5c: the Tokens page, built fresh on every visit from the readings (.hub/usage.jsonl) and the session logs on this PC. `npm run watcher` still writes its own file.
// logTotal() is what a chat turn or a run adds to a reading as `tokensTotal`, so learnRate gets pairs it can use. Reading the logs is slow, so the scans are kept for 20 seconds.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadReadings,evaluate,learnRate,scanLogs} from './watcher.js';
import {renderPage} from './page.js';

export const defaultLogs=()=>path.join(process.env.USERPROFILE||os.homedir(),'.claude','projects');
const startOfDay=(ms)=>{const d=new Date(ms);return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime()};
const memo=new Map();
function scans(logs,now){
 const m=memo.get(logs);if(m&&now-m.at<20000)return m;
 const day=startOfDay(now),fresh={at:now,today:scanLogs(logs,{since:day}).byModel,week:scanLogs(logs,{since:day-6*86400000}).byModel};memo.set(logs,fresh);return fresh}
// The billable tokens in all logs now, or null if they cannot be read. Never throws.
export function logTotal(logs=defaultLogs()){try{const t=scanLogs(logs).total.billable;return Number.isFinite(t)?t:null}catch{return null}}
export function buildTokensPage({root,now=Date.now(),logs,state=null}={}){
 logs=logs||defaultLogs();
 const readings=loadReadings(path.join(root,'.hub','usage.jsonl')),st=evaluate(readings,{now}),rate=learnRate(readings);
 let today={},week={};try{const s=scans(logs,now);today=s.today;week=s.week}catch{}
 return renderPage({state:st,today,week,readings,rate,generatedAt:now,fresh:true})}