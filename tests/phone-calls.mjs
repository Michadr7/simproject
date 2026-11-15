// PH1: the phone's Call app, pure rules (dist/phone-calls.js): the contact list is data, the tow line is busy unless you are in a vehicle, the tow flow lists your vehicles with the quote, a workshop tells you to visit,
// a placeholder business answers in its hours and does not answer outside them, ringing is 1 to 2 s; and the sound files are registered.
import assert from 'node:assert/strict';
import {existsSync,statSync} from 'node:fs';
import {CONTACTS,contactById,dial,isOpen,towLineOpen,towOptions,towLabel,BUSY_LINE,NO_ANSWER_LINE,PHONE_CLIPS,KIND_LABEL} from '../dist/phone-calls.js';
import {ALL_FILES,SOUND_EXT} from '../dist/vehicle-sounds.js';
import {statusOf,bayPose,hoursNow} from '../dist/garage.js';

// the list: data with a unique id and number, a known kind, a handler, hours as [opens, closes) or null, rings of 1 to 2 s
assert(CONTACTS.length>=6,'a tow service, a workshop and placeholder businesses');
assert.equal(new Set(CONTACTS.map(c=>c.id)).size,CONTACTS.length,'unique ids');assert.equal(new Set(CONTACTS.map(c=>c.number)).size,CONTACTS.length,'unique numbers');
for(const c of CONTACTS){assert(c.name&&c.number&&KIND_LABEL[c.kind],c.id+' has a name, a number and a known kind');assert(['tow','shop','line'].includes(c.handler),c.id+' has a handler');assert(c.hours===null||(c.hours[0]<c.hours[1]&&c.hours[1]<=1440),c.id+' hours');assert(c.rings>=1&&c.rings<=2,c.id+' rings 1 to 2 s')}
assert.equal(contactById('tow').handler,'tow');assert.equal(contactById('nobody'),null);
assert(CONTACTS.some(c=>c.id==='repair')&&CONTACTS.some(c=>c.handler==='line'),'the workshop and placeholders are there');

// the tow line: busy on foot, answered in a vehicle
assert.equal(towLineOpen({inVehicle:false}),false);assert.equal(towLineOpen({inVehicle:true}),true);assert.equal(towLineOpen({}),false);
{const r=dial('tow',{inVehicle:false,minutes:600});assert.equal(r.outcome,'busy');assert.equal(r.line,BUSY_LINE);assert.equal(BUSY_LINE,'Line busy');assert.equal(r.pick,false);assert.equal(r.ringSeconds,0,'a busy line does not ring')}
{const r=dial('tow',{inVehicle:true,minutes:600});assert.equal(r.outcome,'answered');assert.equal(r.pick,true,'it asks which vehicle');assert(r.ringSeconds>=1&&r.ringSeconds<=2);const night=dial('tow',{inVehicle:true,minutes:60});assert.equal(night.outcome,'answered','the tow service works at any hour')}

// the workshop: always answers, says to visit (no phone repairs)
{const r=dial('repair',{inVehicle:false,minutes:1300});assert.equal(r.outcome,'answered');assert(/in person|bring it in|counter/i.test(r.line)&&/phone/i.test(r.line),r.line);assert.equal(r.pick,false)}

// a placeholder business: a fixed line in its hours, no answer outside them (the edges: opens is in, closes is out)
{const b=contactById('bakery');const [o,c]=b.hours;assert.equal(isOpen(b,o),true);assert.equal(isOpen(b,c-1),true);assert.equal(isOpen(b,c),false);assert.equal(isOpen(b,o-1),false);
 const open=dial('bakery',{minutes:o+30}),shut=dial('bakery',{minutes:c+30});assert.equal(open.outcome,'answered');assert.equal(open.line,b.say);assert.equal(shut.outcome,'no-answer');assert.equal(shut.line,NO_ANSWER_LINE);assert.equal(shut.pick,false)}
assert.equal(dial('nope',{}).outcome,'no-answer','an unknown number');assert.equal(dial(CONTACTS[2],{minutes:600}).contact.id,CONTACTS[2].id,'a contact object works too');

// the tow choices: one per owned vehicle with the garage quote (free this time, a fee, or already in the shop)
{const B=bayPose(),p={cash:50000,routine:{minutes:600},housing:{day:3},garage:{hardLuckDay:null,shop:{v1:{readyAt:hoursNow({housing:{day:3},routine:{minutes:600}})+4,to:1000}}},
  vehicles:[{uid:'v1',model:'shortbed',x:B.x,z:B.z,yaw:0,cond:0},{uid:'v2',model:'offroad',x:60,z:15,yaw:0,cond:0}]};
 const opts=towOptions(p.vehicles,uid=>statusOf(p,uid,hoursNow(p)),v=>v.model.toUpperCase());
 assert.equal(opts.length,2);assert.equal(opts[0].inShop,true);assert.equal(opts[0].tow,null);assert.equal(towLabel(opts[0]),'In the shop');
 assert.equal(opts[1].inShop,false);assert(opts[1].tow>7000,'a fee in cents: '+opts[1].tow);assert(/^Tow to the repair shop · \$\d+\.\d\d$/.test(towLabel(opts[1])),towLabel(opts[1]));
 assert.equal(towLabel({inShop:false,tow:0}),'Tow · free this time');assert.deepEqual(towOptions([],()=>null,()=>''),[],'no vehicles, no choices')}

// TR4 'Pull me out': offered on the tow line only with a Stuck or soft-ground vehicle under you (pull flag), never on a busy (on foot) line; $40 and half a game hour; free in hard luck; refused when broke or not stuck; the clock moves on.
{const {pullLabel}=await import('../dist/phone-calls.js'),{pullOut,pullFee,BOG_PULL_CENTS,BOG_PULL_HOURS}=await import('../dist/garage.js'),{pullOutAvailable}=await import('../dist/surface-table.js');
 assert.equal(dial('tow',{inVehicle:true,minutes:600}).pull,false,'no pull-out line when not stuck');assert.equal(dial('tow',{inVehicle:true,minutes:600,pull:true}).pull,true);assert(/pull you out/.test(dial('tow',{inVehicle:true,minutes:600,pull:true}).line));assert.equal(dial('tow',{inVehicle:false,minutes:600,pull:true}).outcome,'busy','on foot the line is busy even if a bogged vehicle is near');assert(!dial('tow',{inVehicle:false,pull:true}).pull);
 assert.equal(pullLabel({cents:4000,hours:.5}),'Pull me out · $40.00 · 30 min');assert.equal(pullLabel({cents:0,hours:.5}),'Pull me out · free this time · 30 min');
 const mk=(over={})=>({cash:50000,routine:{minutes:600},housing:{day:3},garage:{hardLuckDay:null,shop:{}},vehicles:[{uid:'v1',model:'shortbed',x:135,z:-23,yaw:0,cond:1000}],...over}),dest={x:128,z:-30,yaw:1.5};
 {const p=mk(),r=pullOut(p,'v1',dest,{drivenUid:'v1',available:true});assert(!r.error,r.error);assert.equal(r.fee,BOG_PULL_CENTS);assert.equal(r.state.cash,50000-4000,'$40 charged');assert.equal(r.free,false);assert.equal(r.state.routine.minutes,630,'half a game hour passes');assert.deepEqual([r.state.vehicles[0].x,r.state.vehicles[0].z,r.state.vehicles[0].yaw],[128,-30,1.5],'moved to the firm spot');assert.deepEqual(r.appear,{uid:'v1',x:128,z:-30,yaw:1.5});assert(/\$40\.00/.test(r.message)&&/half an hour/.test(r.message));assert.equal(BOG_PULL_HOURS,.5)}
 {const r=pullOut(mk({housing:{day:3},routine:{minutes:1430}}),'v1',dest,{drivenUid:'v1',available:true});assert(!r.error);assert.equal(r.state.routine.minutes,20);assert.equal(r.state.housing.day,4,'the half hour carries over midnight')}
 assert(pullOut(mk(),'v1',dest,{drivenUid:'v1',available:false}).error,'not stuck: refused');assert(pullOut(mk(),'v1',dest,{drivenUid:null,available:true}).error,'not driving it: refused');assert(pullOut(mk(),'v1',null,{drivenUid:'v1',available:true}).error,'no firm ground: refused (never a blocked or missing spot)');
 {const p=mk({cash:3999,garage:{hardLuckDay:null,pullFreeAt:50,shop:{}}}),r=pullOut(p,'v1',dest,{drivenUid:'v1',available:true});assert(/costs \$40\.00/.test(r.error)&&/Rock it/.test(r.error),r.error);assert.equal(r.state.cash,3999,'nothing charged')}
 {const hl=mk({cash:1000,vehicles:[{uid:'v1',model:'shortbed',x:135,z:-23,yaw:0,cond:0}]});assert.equal(pullFee(hl),0,'hard luck: free');const r=pullOut(hl,'v1',dest,{drivenUid:'v1',available:true});assert(!r.error&&r.fee===0&&r.free&&r.state.cash===1000&&r.state.garage.hardLuckDay===null,'free, and the weekly hard-luck day is not used up');assert(/free this time/.test(r.message))}
 assert.equal(pullFee(mk()),4000);assert.equal(pullOutAvailable({inVehicle:true,soft:true}),true)}
 // TR4b: one free pull-out per 7 game days when broke (cash under $40), independent of hard luck
 {const mk=(over={})=>({cash:50000,routine:{minutes:600},housing:{day:3},garage:{hardLuckDay:null,shop:{}},vehicles:[{uid:'v1',model:'shortbed',x:135,z:-23,yaw:0,cond:1000}],...over}),dest={x:128,z:-30,yaw:1.5},{pullOut,pullFee}=await import('../dist/garage.js');
  const {pullFreeLeft,normalizeGarage,PULL_FREE_DAYS,startRepair,collect}=await import('../dist/garage.js'),D={drivenUid:'v1',available:true};
  const broke=mk({cash:1000});assert.equal(pullFee(broke),0,'broke in a healthy truck: free');
  const r=pullOut(broke,'v1',dest,D);assert(!r.error,r.error);assert(r.free&&r.weekly&&r.fee===0&&r.state.cash===1000);assert(/free/.test(r.message)&&/7 game days/.test(r.message));assert.equal(r.state.garage.pullFreeAt,2*24+10,'recorded in game hours');assert.equal(r.state.garage.hardLuckDay,null,'hard luck untouched');
  assert.equal(pullFee(r.state),4000,'used: the next one costs');assert.equal(pullFee({...r.state,cash:1000,routine:{minutes:630}}),4000,'used: not free any more');
  assert(pullOut(r.state,'v1',dest,D).error,'second pull-out the same week: refused when broke');
  const later=(d)=>({...r.state,housing:{day:3+d},routine:{minutes:600}});assert.equal(pullFee(later(6)),4000);assert.equal(pullFee(later(7)),0,'7 game days later it is free again');assert.equal(pullFreeLeft(later(5)),48);assert.equal(PULL_FREE_DAYS,7);
  assert.equal(pullFee(mk({cash:4000})),4000,'cash enough: not free');const rich=pullOut(mk({cash:4000}),'v1',dest,D);assert(!rich.free&&rich.state.cash===0&&rich.state.garage.pullFreeAt===undefined,'paying does not use the free one');
  assert.deepEqual(normalizeGarage({hardLuckDay:null,shop:{}}),{hardLuckDay:null,shop:{}},'old saves load as unused');assert.equal(normalizeGarage({pullFreeAt:50.12345,shop:{}}).pullFreeAt,50.123);assert.equal(normalizeGarage({pullFreeAt:'x'}).pullFreeAt,undefined);assert.equal(normalizeGarage({pullFreeAt:-1}).pullFreeAt,undefined);
  const hl=mk({cash:1000,garage:{hardLuckDay:null,pullFreeAt:60,shop:{}},vehicles:[{uid:'v1',model:'shortbed',x:135,z:-23,yaw:0,cond:0}]});const h=pullOut(hl,'v1',dest,D);assert(h.free&&!h.weekly&&h.state.garage.pullFreeAt===60&&h.state.garage.hardLuckDay===null,'hard luck path: free, uses neither');
  const w=pullOut(mk({cash:1000,vehicles:[{uid:'v1',model:'shortbed',x:135,z:-23,yaw:0,cond:0}]}),'v1',dest,D);assert(w.free&&!w.weekly,'hard luck wins when both apply');
  const sr=startRepair(mk({cash:1000,garage:{hardLuckDay:null,pullFreeAt:60,shop:{}},vehicles:[{uid:'v1',model:'shortbed',x:bayPose().x,z:bayPose().z,yaw:0,cond:0}]}),'v1',50,{free:true});assert(!sr.error&&sr.state.garage.pullFreeAt===60&&sr.state.garage.hardLuckDay===3,'hard luck repair keeps the pull-out record and uses the hard-luck day')}
// the sounds: five clips, registered with the other recorded sounds, on disk and small
assert.deepEqual([...PHONE_CLIPS],['phone-key','phone-pickup','phone-ring','phone-busy','phone-hangup']);
for(const n of PHONE_CLIPS){assert(ALL_FILES.includes(n),n+' is registered');const u=new URL('../dist/assets/sounds/'+n+SOUND_EXT,import.meta.url);assert(existsSync(u),n+' exists');assert(statSync(u).size<40000,n+' is small')}
console.log('PASS phone-calls.mjs: the contact list is data (ids, numbers, kinds, handlers, hours, 1 to 2 s of ringing); the tow line is busy ("Line busy", no ringing) unless you are in a vehicle and then asks which one, with the garage quote per vehicle; the workshop says to visit; a placeholder business answers in its hours and does not answer outside them; the five phone clips are registered, on disk and small.');
