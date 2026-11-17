// Stage C-A (notes/cargo-redesign.md): the pure cargo item model in cargo-items.js. No game, no DOM.
import assert from 'node:assert/strict';
import {BEDS,addCrates,addPlanks,capacity,normalizeCargo,CRATE_MIX} from '../dist/cargo.js';
import {ITEM_KINDS,KIND_ORDER,itemOf,normalizeItem,normalizeItems,bedRules,canLoad,loadItem,unloadItem,takeKind,summarize,handsRule,massOf,usedSpaceOf,
 fromLegacyCargo,toLegacyCargo,toSavedCargo,fromLegacyCarry,toLegacyCarry,fromLegacyParcel,parcelLocation,migrateParcel} from '../dist/cargo-items.js';
import {freshProgress,normalizeProgress} from '../dist/jobs.js';

const log=()=>itemOf('log'),crate=()=>itemOf('crate'),planks=(n,o)=>itemOf('planks',{count:n,...(o?{o}:{})}),parcel=(g=7,large=false)=>itemOf('parcel',{gig:g,large}),box=()=>itemOf('box');
const fillOne=(model,make)=>{let items=[];for(let i=0;i<500;i++){const r=loadItem(model,items,make());if(r.error)return items;items=r.items}throw new Error('never full')};

// 1. The item shape and the registry.
{const l=log();assert.deepEqual({k:l.kind,c:l.count,s:l.space,m:l.massKg,h:l.hand,st:l.stackable},{k:'log',c:1,s:5,m:40,h:true,st:false});
 const p=planks(3,12);assert.equal(p.space,3);assert.equal(p.massKg,18);assert.equal(p.o,12);assert.equal(p.stackable,true);
 assert.equal(crate().space,2);assert.equal(crate().massKg,12);assert.equal(parcel(7,false).space,1);assert.equal(parcel(7,true).space,2);assert.equal(parcel(7,true).massKg,6);assert.equal(parcel().massKg,3);
 assert.equal(parcel().model,'prop.carton-small');assert.equal(box().space,1);assert.deepEqual([...KIND_ORDER].sort(),Object.keys(ITEM_KINDS).sort());
 const f=Object.freeze({...l});assert.deepEqual(normalizeItem(f),l,'normalising is stable');assert.deepEqual(normalizeItem(normalizeItem(p)),p)}

// 2. Garbage in: null, never a throw.
for(const bad of [[ 'nope'],[undefined],[null],[42],[{}],['__proto__'],['toString'],['planks'],['planks',{count:0}],['planks',{count:5}],['planks',{count:NaN}],['planks',{count:-1}],['planks',{count:2.5}],['planks',{count:'2'}],['planks',{count:2,o:-3}],['planks',{count:2,o:NaN}],['parcel'],['parcel',{gig:NaN}],['parcel',{gig:-1}],['parcel',{gig:0}],['parcel',{gig:'a'}],['log',{o:Infinity}]])
 assert.equal(itemOf(...bad),null,'rejected '+JSON.stringify(bad));
assert.equal(normalizeItem(null),null);assert.equal(normalizeItem('log'),null);assert.equal(normalizeItem({kind:'x'}),null);assert.deepEqual(normalizeItems('x'),[]);assert.deepEqual(normalizeItems([null,1,{kind:'log'},{kind:'zzz'}]).map(i=>i.kind),['log']);
assert.equal(bedRules('car'),null);assert.equal(bedRules(undefined),null);assert.equal(bedRules('__proto__'),null);
assert.equal(canLoad('car',[],log()).error,'This vehicle has no bed.');assert(canLoad('flatbed',[],{kind:'planks',count:NaN}).error);assert(canLoad('flatbed',null,null).error);assert(canLoad('flatbed','junk',log()).ok);
assert(takeKind([log()],'weird').error);assert(takeKind(null,'log').error);assert(unloadItem(null).error);assert(unloadItem([]).error);assert(!loadItem('flatbed',[],{kind:'planks',count:-4}).ok);
assert.deepEqual(handsRule(null),{carryable:false,speedMul:1,sprint:true});assert.deepEqual(handsRule({kind:'ghost'}),{carryable:false,speedMul:1,sprint:true});assert.deepEqual(summarize(undefined),[]);assert.equal(massOf(NaN),0);
assert.deepEqual(fromLegacyCargo('x'),[]);assert.deepEqual(fromLegacyCargo([null,{k:'planks',n:9},{k:'planks',n:NaN},{k:'zz'},{k:'parcel',g:-1},{k:'log'}]).map(i=>i.kind),['log']);assert.equal(toLegacyCargo(undefined),null);assert.equal(fromLegacyCarry({kind:'planks',count:99}),null);assert.equal(fromLegacyCarry('log'),null);assert.equal(toLegacyCarry({kind:'qq'}),null);
assert.equal(fromLegacyParcel(null),null);assert.equal(fromLegacyParcel('x'),null);assert.equal(migrateParcel(null),null);assert.equal(migrateParcel(undefined),undefined);assert.equal(parcelLocation(null),null);

// 3. Capacity per bed model agrees with cargo.js (logs and planks on every bed, crates only where the bed takes them).
for(const model of Object.keys(BEDS)){
 assert.equal(fillOne(model,log).length,capacity(model,'log'),model+' logs');
 assert.equal(usedSpaceOf(fillOne(model,()=>planks(4))),model==='atv'?4:capacity(model,'planks'),model+' planks (stacks of four; the rack holds one stack of 4, cargo.js capacity() says 5 there)');
 if(BEDS[model].crates)assert.equal(fillOne(model,crate).length,capacity(model,'crate')||0,model+' crates');
 else{assert.equal(canLoad(model,[],crate()).error,'Crates do not go on this bed.');assert.equal(bedRules(model).crates,false)}
}
assert.equal(fillOne('flatbed',log).length,24);assert.equal(usedSpaceOf(fillOne('flatbed',()=>planks(4))),120);assert.equal(fillOne('worktruck',log).length,6);assert.equal(fillOne('shortbed',log).length,8);
assert.equal(bedRules('shortbed').space,44);assert.equal(bedRules('atv').maxPieces,1);assert.equal(bedRules('flatbed').maxPieces,Infinity);assert(!bedRules('flatbed').accepts.includes('crate'));assert(bedRules('shortbed').accepts.includes('crate'));
for(const m of Object.keys(BEDS))assert(canLoad(m,[],parcel()).ok&&canLoad(m,[],box()).ok,m+' takes parcel and box');

// 4. The ATV rack: ONE piece in total (maxPieces), whatever its kind.
for(const first of [log,crate,()=>planks(4),parcel,box]){const r=loadItem('atv',[],first());assert(!r.error,first().kind);for(const second of [log,crate,()=>planks(1),parcel,box])assert(loadItem('atv',r.items,second()).error,first().kind+' then '+second().kind+' refused on the rack')}
assert(canLoad('atv',[],planks(4)).ok);assert(canLoad('atv',[],log()).ok);

// 5. Crate rules: same count as cargo.js addCrates; piled at most as high as fits(); never mixed with timber (the legacy rule); two high.
{const per=Object.fromEntries(['worktruck','offroad','shortbed'].map(m=>[m,fillOne(m,crate).length]));
 for(const m of Object.keys(per)){let c=null,n=0;while(true){const r=addCrates(c,m,1);if(r.error)break;c=r.cargo;n++}assert.equal(per[m],n,m+' same crate count as cargo.js addCrates');assert(per[m]>=6,m+' holds a few crates')}
 assert.equal(canLoad('shortbed',[log()],crate()).error,CRATE_MIX);assert.equal(canLoad('shortbed',[crate()],log()).error,CRATE_MIX);assert.equal(canLoad('shortbed',[crate()],planks(2)).error,CRATE_MIX);
 assert(canLoad('shortbed',[crate()],parcel()).ok,'a parcel may ride with crates');assert(canLoad('shortbed',[crate(),box()],crate()).ok);
 assert(canLoad('shortbed',[log()],crate(),{mixCrates:true}).ok,'the mix switch exists for the wheel stage');
 assert.equal(ITEM_KINDS.crate.stackable,true);assert.equal(ITEM_KINDS.log.stackable,false);
 // height: a third layer never fits (3 x 0.44 m is above the 1.25 m limit only once the layer count says so)
 const k=per.shortbed;assert(k<=2*18+0,'two layers at most on the shortbed')}

// 6. Space accounting with mixed kinds, and the over-full refusal leaves the list alone.
{let items=[];for(const it of [log(),planks(4),parcel(3,true),box(),log()]){const r=loadItem('worktruck',items,it);assert(!r.error);items=r.items}
 assert.equal(usedSpaceOf(items),5+4+2+1+5);const before=JSON.stringify(items);let full=items;while(true){const r=loadItem('worktruck',full,log());if(r.error){assert.match(r.error,/full/);break}full=r.items}
 assert.equal(JSON.stringify(items),before,'the input list is not mutated');assert(usedSpaceOf(full)<=32);assert(usedSpaceOf(full)>=28)}

// 7. unloadItem and takeKind: last on first off, an order's planks stay, one or all, new objects only.
{const items=[log(),planks(2),planks(3,9),crate().kind&&box(),planks(4)];const frozen=JSON.stringify(items);
 const u=unloadItem(items);assert.equal(u.item.kind,'planks');assert.equal(u.item.count,4);assert.equal(u.items.length,4);assert.equal(JSON.stringify(items),frozen);
 const u2=unloadItem([planks(3,9),planks(2,9)]);assert.match(u2.error,/order #9/);
 const u3=unloadItem([log(),planks(3,9)]);assert.equal(u3.item.kind,'log');assert.deepEqual(u3.items.map(i=>i.o),[9]);
 const one=takeKind(items,'planks');assert.equal(one.taken.length,1);assert.equal(one.taken[0].count,4);assert.equal(one.items.length,4);
 const all=takeKind(items,'planks',true);assert.equal(all.taken.length,2,'all of mine: the order stack stays');assert.deepEqual(all.taken.map(i=>i.count),[2,4]);assert(all.items.some(i=>i.o===9));assert.equal(all.items.length,3);
 assert.match(takeKind([planks(3,9)],'planks',true).error,/order #9/);assert.match(takeKind([log()],'crate').error,/no crate/);assert.equal(JSON.stringify(items),frozen);
 const t=takeKind([log(),log(),log()],'log');assert.equal(t.items.length,2);assert.notEqual(t.items[0],t.taken[0]);assert.equal(takeKind([log(),log()],'log',true).items.length,0)}

// 8. summarize: what the wheel shows.
{const s=summarize([log(),planks(4),planks(2,5),crate(),crate(),parcel(2),box(),log()]);
 assert.deepEqual(s,[{kind:'log',count:2,space:10,free:2},{kind:'planks',count:6,space:6,free:4},{kind:'crate',count:2,space:4,free:2},{kind:'parcel',count:1,space:1,free:1},{kind:'box',count:1,space:1,free:1}]);
 assert.deepEqual(summarize([]),[]);assert.equal(massOf([log(),planks(2),crate(),parcel()]),40+12+12+3)}

// 9. Hands rule: crates carried slowly, no sprint; nothing in hands walks freely.
{assert.deepEqual(handsRule(crate()),{carryable:true,speedMul:.6,sprint:false});assert.equal(handsRule(log()).speedMul,.8);assert.equal(handsRule(planks(2)).speedMul,.85);assert.equal(handsRule(parcel()).sprint,false);
 for(const k of KIND_ORDER)assert(handsRule(itemOf(k,{count:1,gig:1})).speedMul<1,k);assert.deepEqual(handsRule({kind:'crate'}),handsRule(crate()),'a loose object is normalised')}

// 10. Legacy conversion: round trips equal the original.
{const legacy=[{k:'log'},{k:'planks',n:4},{k:'planks',n:2,o:31},{k:'log'},{k:'planks',n:1}];
 assert.deepEqual(toLegacyCargo(fromLegacyCargo(legacy)),legacy);assert.deepEqual(fromLegacyCargo(legacy).map(i=>i.kind),['log','planks','planks','log','planks']);
 assert.deepEqual(toLegacyCargo(fromLegacyCargo([{k:'crate'},{k:'crate'},{k:'crate'}])),[{k:'crate'},{k:'crate'},{k:'crate'}]);
 assert.deepEqual(fromLegacyCargo(null),[]);assert.equal(toLegacyCargo([]),null);assert.equal(toLegacyCargo(fromLegacyCargo(null)),null);
 for(const m of Object.keys(BEDS)){const c=normalizeCargo([{k:'log'},{k:'planks',n:3},{k:'planks',n:2,o:4}],m);assert.deepEqual(toLegacyCargo(fromLegacyCargo(c)),c,m);assert.deepEqual(normalizeCargo(toLegacyCargo(fromLegacyCargo(c)),m),c)}
 assert.deepEqual(toLegacyCargo([log(),parcel(),box(),crate()]),[{k:'log'},{k:'crate'}],'parcel and box are not in the old shape');
 const full=[log(),parcel(5,true),box(),planks(2,8),crate()];assert.deepEqual(fromLegacyCargo(toSavedCargo(full)),full,'the saved superset round trips');assert.deepEqual(toSavedCargo(full)[1],{k:'parcel',g:5,m:'prop.carton-small',l:1});assert.equal(toSavedCargo([]),null);
 assert.deepEqual(toLegacyCarry(fromLegacyCarry({kind:'log'})),{kind:'log'});assert.deepEqual(toLegacyCarry(fromLegacyCarry({kind:'planks',count:3})),{kind:'planks',count:3});assert.deepEqual(toLegacyCarry(fromLegacyCarry({kind:'crate'})),{kind:'crate'});
 assert.deepEqual(toLegacyCarry(fromLegacyCarry({kind:'parcel',gig:4,model:'prop.carton-medium',large:true})),{kind:'parcel',gig:4,model:'prop.carton-medium',large:true});assert.equal(fromLegacyCarry(null),null)}

// 11. The old parcel and its migration.
const gig=(extra={})=>({id:12,type:'parcel',client:'Ada',large:false,origin:null,pickedAt:null,drop:null,...extra});
const prog=(active,extra={})=>({...freshProgress(),gigs:{...freshProgress().gigs,active},...extra});
{const it=fromLegacyParcel(gig());assert.equal(it.kind,'parcel');assert.equal(it.gig,12);assert.equal(it.space,1);assert(/^prop\.carton-small/.test(it.model));
 assert.equal(fromLegacyParcel(gig({large:true})).space,2);assert(/^prop\.carton-medium/.test(fromLegacyParcel(gig({large:true})).model));
 assert.equal(fromLegacyParcel(gig({drop:{x:1,z:2}})),null,'on the ground: not an item');assert.equal(fromLegacyParcel(gig({origin:{x:1,z:1},pickedAt:null})),null,'still waiting at the pickup');assert(fromLegacyParcel(gig({origin:{x:1,z:1},pickedAt:30})));assert.equal(fromLegacyParcel(gig({needId:3})),null)}
{const old=prog(gig()),before=JSON.stringify(old);assert.equal(parcelLocation(old),'held');
 const m=migrateParcel(old);assert.equal(JSON.stringify(old),before,'input untouched');assert.notEqual(m,old);assert.equal(parcelLocation(m),'hands');assert.deepEqual(m.carry,{kind:'parcel',gig:12,model:m.carry.model});assert.equal(m.gigs.active.drop,null);assert.equal(m.gigs.active.id,12);
 assert.equal(migrateParcel(m),m,'second run changes nothing (same object)');assert.deepEqual(migrateParcel(migrateParcel(m)),m);assert.deepEqual(m.carry,fromLegacyCarry(m.carry)&&toLegacyCarry(fromLegacyCarry(m.carry)))}
{const v={uid:'v1',model:'atv',x:0,z:0,yaw:0,cargo:null},old=prog(gig({large:true}),{vehicles:[v]}),m=migrateParcel(old,{vehicleUid:'v1'});
 assert.equal(parcelLocation(m),'bed');assert.equal(m.carry,old.carry,'hands stay free');assert.deepEqual(m.vehicles[0].cargo,[{k:'parcel',g:12,m:m.vehicles[0].cargo[0].m,l:1}]);assert.equal(old.vehicles[0].cargo,null);assert.equal(migrateParcel(m,{vehicleUid:'v1'}),m);
 // a full rack: falls back to the hands; unknown uid: hands; a car with no bed: hands
 const rack={...v,cargo:[{k:'log'}]},a=migrateParcel(prog(gig(),{vehicles:[rack]}),{vehicleUid:'v1'});assert.equal(parcelLocation(a),'hands');assert.deepEqual(a.vehicles[0].cargo,[{k:'log'}]);
 assert.equal(parcelLocation(migrateParcel(prog(gig(),{vehicles:[v]}),{vehicleUid:'zz'})),'hands');assert.equal(parcelLocation(migrateParcel(prog(gig(),{vehicles:[{...v,model:'sedan'}]}),{vehicleUid:'v1'})),'hands')}
{const busy=prog(gig(),{carry:{kind:'log'}}),m=migrateParcel(busy);assert.equal(m,busy,'hands full and no bed: left as it was');assert.equal(parcelLocation(m),'held')}
for(const [p,loc] of [[prog(null),null],[prog(gig({drop:{x:1,z:1}})),'ground'],[prog(gig({origin:{x:1,z:1}})),'waiting'],[prog(gig({needId:2})),null]]){assert.equal(parcelLocation(p),loc);assert.equal(migrateParcel(p),p,'nothing to migrate: '+loc)}
// a migrated state still loads through the real save normaliser without throwing (the parcel carry is dropped by the OLD normaliser: noted in the report)
{const m=migrateParcel(prog(gig()));assert.doesNotThrow(()=>normalizeProgress(JSON.parse(JSON.stringify(m))));assert.doesNotThrow(()=>normalizeProgress(JSON.parse(JSON.stringify(prog(gig())))))}

console.log('PASS cargo-items: item shape, garbage rejected, bed rules per model, ATV rack, crates, take/summarize, hands rule, legacy round trips, parcel migration');
