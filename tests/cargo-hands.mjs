// Cargo redesign stage C-B (pure side): crate/box/parcel in the hands, carry normalising, bed pieces for parcel and box, load drag, the save migration behind PARCEL_PIECES_ENABLED, and gigs ending their parcel piece.
import assert from 'node:assert/strict';
import {normalizeCarry,carryEffects,HANDS_SPEED,putDownCrate,pickUpCrate,normalizeCrateDrops,MAX_CRATE_DROPS} from '../dist/carry.js';
import {parcelHeld,parcelTaken} from '../dist/gig-parcel.js';
import {loadCarry,unloadOne,unloadKind,normalizeCargo,slotPositions,usedSpace,cargoText,countOf,addCrates,BEDS,CRATES_BY_HAND,CRATE_STAYS,CRATE_MIX,fits} from '../dist/cargo.js';
import {handsRule,PARCEL_PIECES_ENABLED,migrateParcel,parcelLocation,parcelCarried,removeParcelPieces,summarize,fromLegacyCargo,normalizeItems,massOf} from '../dist/cargo-items.js';
import {cargoMassKg,MASS_KG,loadFactor} from '../dist/load-drag.js';
import {normalizeProgress,normalizeProgressWith,freshProgress} from '../dist/jobs.js';
import {failGig,completeGig,abandonGig,endParcel} from '../dist/gigs.js';
import {dropGigParcel,pickGigParcel,abandonContract,pickUpGigBox} from '../dist/gig-bridge.js';

const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);

// ---- 1. carry.js: normalizeCarry and carryEffects
same(normalizeCarry({kind:'crate',junk:1}),{kind:'crate'});same(normalizeCarry({kind:'box'}),{kind:'box'});same(normalizeCarry({kind:'log'}),{kind:'log'});same(normalizeCarry({kind:'planks',count:3}),{kind:'planks',count:3});
assert.equal(normalizeCarry({kind:'planks',count:5}),null);assert.equal(normalizeCarry({kind:'planks'}),null);assert.equal(normalizeCarry({kind:'sofa'}),null);assert.equal(normalizeCarry(null),null);assert.equal(normalizeCarry('crate'),null);assert.equal(normalizeCarry(7),null);
const pc=normalizeCarry({kind:'parcel',gig:4,model:'prop.carton-medium',large:true});same(pc,{kind:'parcel',gig:4,model:'prop.carton-medium',large:true});same(normalizeCarry(pc),pc,'twice the same');
assert.equal(normalizeCarry({kind:'parcel',gig:0}),null);assert.equal(normalizeCarry({kind:'parcel',gig:'4'}),null);assert.match(normalizeCarry({kind:'parcel',gig:2}).model,/^prop\.carton/);assert.equal(normalizeCarry({kind:'parcel',gig:2,large:1}).large,undefined);
same(carryEffects(null),{speed:1,sprint:true,load:1});same(carryEffects({kind:'log'}),{speed:.8,sprint:false,load:1.5});same(carryEffects({kind:'planks',count:2}),{speed:.85,sprint:false,load:1.25});
assert.equal(carryEffects({kind:'crate'}).speed,.6);assert.equal(carryEffects({kind:'crate'}).sprint,false);assert.equal(carryEffects({kind:'parcel',gig:1}).speed,.9);assert.equal(carryEffects({kind:'__proto__'}).sprint,true);assert.equal(carryEffects({kind:'toString'}).sprint,true);
for(const k of ['log','planks','crate','parcel','box'])assert.equal(handsRule({kind:k,count:1,gig:1}).speedMul,HANDS_SPEED[k],'cargo-items handsRule reads the carry.js table: '+k);

// ---- 2. cargo.js: crate off a bed into the hands (switch on), switch off keeps the old refusal, parcel and box pieces
assert.equal(CRATES_BY_HAND,true,'flipped with the X put-down wiring (OPUS-wiring)');assert.match(CRATE_STAYS,/Crates stay/);
const four=addCrates(null,'shortbed',4).cargo;
assert.equal(unloadOne(null,four,'shortbed',false).error,CRATE_STAYS);assert.equal(unloadKind(null,four,'shortbed','crate',false).error,CRATE_STAYS);
same(unloadOne(null,four,'shortbed').carry,{kind:'crate'},'the default now takes a crate by hand');
{const r=unloadOne(null,four,'shortbed',true);same(r.carry,{kind:'crate'});assert.equal(r.cargo.length,3);assert.match(r.message,/Took a crate off/);
 assert.equal(unloadOne({kind:'log'},four,'shortbed',true).error,'Your hands are full.');
 const one=unloadKind(null,four,'shortbed','crate',true);same(one.carry,{kind:'crate'});assert.equal(one.cargo.length,3);
 const last=unloadOne(null,[{k:'crate'}],'atv',true);same(last.carry,{kind:'crate'});assert.equal(last.cargo,null);
 const back=loadCarry(r.carry,r.cargo,'shortbed');assert.equal(back.carry,null);assert.equal(back.cargo.length,4);
 assert.match(loadCarry({kind:'crate'},null,'flatbed').error,/do not go on this bed/);assert.equal(loadCarry({kind:'crate'},[{k:'log'}],'shortbed').error,CRATE_MIX);assert.equal(loadCarry({kind:'log'},four,'shortbed').error,CRATE_MIX);assert.equal(loadCarry({kind:'planks',count:2},four,'shortbed').error,CRATE_MIX);
 assert.equal(loadCarry({kind:'crate'},addCrates(null,'shortbed',22).cargo,'shortbed').error.startsWith('The bed is full'),true);assert(!loadCarry({kind:'crate'},null,'atv').error);assert(loadCarry({kind:'crate'},[{k:'crate'}],'atv').error,'one piece on the rack')}
// a parcel and a box: any bed, on top of timber or crates, one or two space, and they come off again as a parcel/box carry (the parcel needs no switch)
const P=(g=7,l)=>({k:'parcel',g,m:'prop.carton-small',...(l?{l:1}:{})});
{const c1=loadCarry({kind:'parcel',gig:7,model:'prop.carton-small'},[{k:'log'}],'flatbed');assert(!c1.error);same(c1.cargo,[{k:'log'},P()]);assert.equal(usedSpace(c1.cargo),6);assert.equal(cargoText(c1.cargo),'1 parcel, 1 log');
 const big=loadCarry({kind:'parcel',gig:7,model:'prop.carton-medium',large:true},null,'worktruck');same(big.cargo,[{k:'parcel',g:7,m:'prop.carton-medium',l:1}]);assert.equal(usedSpace(big.cargo),2);
 const onCrates=loadCarry({kind:'parcel',gig:7},four,'shortbed');assert(!onCrates.error,'a parcel rides with crates');assert.equal(onCrates.cargo.length,5);
 const bx=loadCarry({kind:'box'},[{k:'planks',n:2}],'shortbed');assert.equal(usedSpace(bx.cargo),3);assert.equal(cargoText(bx.cargo),'1 box, 2 planks');
 for(const m of Object.keys(BEDS))assert(!loadCarry({kind:'parcel',gig:7},null,m).error,'parcel on '+m);
 assert(loadCarry({kind:'parcel',gig:7},[{k:'log'}],'atv').error,'the rack holds one piece');assert(loadCarry({kind:'parcel',gig:0},null,'atv').error);assert.match(loadCarry({kind:'sofa'},null,'atv').error,/cannot go/);assert.match(loadCarry({kind:'parcel',gig:7},null,'sedan').error,/no bed/);
 const off=unloadOne(null,c1.cargo,'flatbed');same(off.carry,{kind:'parcel',gig:7,model:'prop.carton-small'});same(off.cargo,[{k:'log'}]);assert.match(off.message,/the parcel/);
 const offBig=unloadKind(null,[P(3,true),{k:'log'}],'flatbed','parcel');same(offBig.carry,{kind:'parcel',gig:3,model:'prop.carton-small',large:true});same(offBig.cargo,[{k:'log'}]);
 same(unloadOne(null,[{k:'box'}],'atv',true).carry,{kind:'box'});assert.equal(unloadOne(null,[{k:'box'}],'atv',false).error,CRATE_STAYS);assert.match(unloadKind(null,[{k:'log'}],'flatbed','parcel').error,/no parcel/);
 // round trip: bed piece -> hands -> bed piece
 same(loadCarry(off.carry,off.cargo,'flatbed').cargo,[{k:'log'},P()])}
// normalizeCargo keeps parcel and box, drops garbage, twice-stable, keeps crates beside parcels
{const raw=[{k:'log'},{k:'parcel',g:7,m:'prop.carton-small'},{k:'parcel',g:0},{k:'parcel',g:'x'},{k:'box'},{k:'sofa'},null,{k:'parcel',g:8,l:true},{k:'parcel',g:9,m:'x'.repeat(80)}],n=normalizeCargo(raw,'flatbed');
 same(n.map(p=>p.k),['log','parcel','box','parcel','parcel']);assert.equal(n[3].l,1);assert.match(n[3].m,/^prop\.carton/);assert.match(n[4].m,/^prop\.carton/);same(normalizeCargo(n,'flatbed'),n,'twice the same');
 same(normalizeCargo([{k:'crate'},{k:'parcel',g:2,m:'prop.carton-small'},{k:'crate'}],'shortbed').map(p=>p.k),['crate','parcel','crate'],'crates and a parcel mix');same(normalizeCargo([{k:'log'},{k:'crate'},{k:'box'}],'shortbed').map(p=>p.k),['log','box'],'timber still wins over crates');
 assert.equal(normalizeCargo([{k:'parcel',g:2},{k:'box'}],'atv').length,1,'the rack keeps one piece');assert.equal(normalizeCargo([{k:'parcel',g:2}],'sedan'),null);
 assert.equal(normalizeCargo(Array.from({length:60},(_,i)=>({k:'parcel',g:i+1})),'worktruck').length,32,'a parcel is 1 space: 32 on a worktruck');assert.equal(normalizeCargo(Array.from({length:30},(_,i)=>({k:'parcel',g:i+1,l:1})),'worktruck').length,16,'a large parcel is 2 space');
 // every piece of a mixed load lies inside the bed and the old shapes are untouched
 const slots=slotPositions('shortbed',[{k:'crate'},P(),{k:'box'},{k:'crate'}]);assert.equal(slots.length,4);assert.deepEqual(slots.map(s=>s.kind),['crate','parcel','box','crate']);assert(slots.every(s=>s.x>=BEDS.shortbed.x0&&s.x<=BEDS.shortbed.x1&&s.z>=BEDS.shortbed.z0&&s.z<=BEDS.shortbed.z1));
 const flat=slotPositions('flatbed',[{k:'log'},P(),P(3,true),{k:'box'},{k:'planks',n:4}]);assert.deepEqual(flat.map(s=>s.kind),['log','parcel','parcel','box','planks']);assert(fits('flatbed',[{k:'log'},P(),{k:'box'}]));
 assert.equal(countOf([P(),P(2),{k:'box'}],'parcel'),2);assert.equal(cargoText([P(),P(2),{k:'box'}]),'2 parcels, 1 box');assert.equal(cargoText([{k:'box'},{k:'box'}]),'2 boxes');
 // the item model reads the new pieces
 assert.deepEqual(summarize(fromLegacyCargo([P(),{k:'box'},{k:'log'}])).map(r=>r.kind+r.count),['log1','parcel1','box1'])}

// ---- 3. load-drag.js: a stowed parcel and a box count
assert.equal(cargoMassKg([P()]),MASS_KG.parcelSmall);assert.equal(cargoMassKg([P(1,true)]),MASS_KG.parcelMedium);assert.equal(cargoMassKg([{k:'box'}]),5);assert.equal(cargoMassKg([{k:'log'},{k:'planks',n:4},{k:'crate'},P(),P(2,true),{k:'box'}]),40+24+12+3+6+5);assert.equal(cargoMassKg(null),0);assert.equal(cargoMassKg([null,{k:'sofa'}]),0);assert.equal(cargoMassKg('x'),0);
assert.equal(massOf(normalizeItems([{kind:'parcel',gig:1}])),cargoMassKg([P(1)]),'item mass and bed mass agree');assert(Math.abs(loadFactor(cargoMassKg([{k:'log'},P()]))-(1-.004*43))<1e-9);

// ---- 4. jobs.js normalizeProgress and the switch
assert.equal(PARCEL_PIECES_ENABLED,true,'the switch is on (flipped with the game.js wiring)');
const place=[{x:19,z:-6.3,room:'street',name:'Door'}];
const gigOf=(extra={})=>({id:12,type:'parcel',client:'Ada',places:place,visited:[false],large:false,origin:null,drop:null,...extra});
const raw=(active,extra={})=>({...freshProgress(),gigs:{...freshProgress().gigs,nextId:13,active},...extra});
const atv={uid:'v1',model:'atv',x:19,z:-10,yaw:0};
const json=o=>JSON.parse(JSON.stringify(o));
{ // switch OFF (the explicit off path): an old held parcel is exactly as before; nothing is moved
 const old=json(raw(gigOf())),a=normalizeProgressWith(old,false);assert.equal(a.carry,null);assert.equal(a.gigs.active.id,12);assert.equal(a.gigs.active.drop,null);assert.equal(parcelLocation(a),'held');
 same(normalizeProgressWith(json(a),false),a,'twice the same (off)');same(normalizeProgressWith(json(old),true),normalizeProgress(json(old)),'the default is now the on path')}
{ // switch ON: the old held parcel migrates once, into the hands; twice the same
 const old=json(raw(gigOf())),a=normalizeProgressWith(old,true);same(a.carry,{kind:'parcel',gig:12,model:a.carry.model});assert.match(a.carry.model,/^prop\.carton-small/);assert.equal(parcelLocation(a),'hands');assert.equal(a.gigs.active.drop,null);assert(parcelCarried(a));
 same(normalizeProgressWith(json(a),true),a,'normalise twice: same result (on)');same(normalizeProgressWith(normalizeProgressWith(json(a),true),true),a);
 const large=normalizeProgressWith(json(raw(gigOf({large:true}))),true);assert.equal(large.carry.large,true);assert.match(large.carry.model,/^prop\.carton-medium/);
 // a stowed one: already a bed piece in a saved vehicle: stays on the bed, hands free, stable
 const bed=normalizeProgressWith(json(raw(gigOf(),{vehicles:[{...atv,cargo:[{k:'parcel',g:12,m:'prop.carton-small'}]}]})),true);assert.equal(parcelLocation(bed),'bed');assert.equal(bed.carry,null);same(bed.vehicles[0].cargo,[{k:'parcel',g:12,m:'prop.carton-small'}]);same(normalizeProgressWith(json(bed),true),bed);assert(parcelCarried(bed));
 // the same saved state with the switch OFF keeps the bed piece in the vehicle (cargo.js keeps it) and the gig flag as it was
 const bedOff=normalizeProgressWith(json(raw(gigOf(),{vehicles:[{...atv,cargo:[{k:'parcel',g:12,m:'prop.carton-small'}]}]})),false);same(bedOff.vehicles[0].cargo,[{k:'parcel',g:12,m:'prop.carton-small'}]);
 // an old held parcel and a busy pair of hands: left alone ('held'), retried on the next load, still stable
 const busy=normalizeProgressWith(json(raw(gigOf(),{carry:{kind:'log'}})),true);same(busy.carry,{kind:'log'});assert.equal(parcelLocation(busy),'held');same(normalizeProgressWith(json(busy),true),busy);
 // an old held parcel migrated in hands, a log stranded nowhere: a second load does not duplicate the parcel
 assert.equal(JSON.stringify(a.vehicles),'[]');
 // orphans go: a parcel carry for a gig that is gone, a piece for another gig, a gig whose parcel lies on the ground
 assert.equal(normalizeProgressWith(json(raw(null,{carry:{kind:'parcel',gig:12,model:'prop.carton-small'}})),true).carry,null,'orphan in hands');
 assert.equal(normalizeProgressWith(json(raw(gigOf({drop:{x:19,z:-8}}),{carry:{kind:'parcel',gig:12,model:'prop.carton-small'}})),true).carry,null,'the parcel is on the ground: no piece in the hands');
 const orph=normalizeProgressWith(json(raw(gigOf(),{vehicles:[{...atv,cargo:[{k:'parcel',g:99,m:'prop.carton-small'}]}]})),true);assert.equal(orph.vehicles[0].cargo,undefined,'a piece of another gig is removed');assert.equal(parcelLocation(orph),'hands','the real parcel migrated');
 // a new save of crates in the hands survives the load (the switch is only about gigs): the hands numbers apply
 same(normalizeProgress(json(raw(null,{carry:{kind:'crate'}}))).carry,{kind:'crate'});same(normalizeProgress(json(raw(null,{carry:{kind:'box'}}))).carry,{kind:'box'});
 // garbage and old shapes still load
 for(const bad of [null,undefined,0,'x',[],{carry:{kind:'parcel'}},{carry:{kind:'crate',x:1},vehicles:'x'}])for(const on of [false,true]){const n=normalizeProgressWith(json(bad===undefined?{}:bad),on);same(normalizeProgressWith(json(n),on),n,'garbage twice-stable')}}

// ---- 5. gigs.js and gig-bridge.js: the parcel piece goes when the gig ends (switch on); nothing happens when it is off
const held=normalizeProgressWith(json(raw(gigOf(),{vehicles:[{...atv,cargo:[{k:'parcel',g:99,m:'prop.carton-small'}]},{uid:'v2',model:'flatbed',x:0,z:0,yaw:0,cargo:[{k:'log'},{k:'parcel',g:12,m:'prop.carton-small'}]}]})),false);
{const hands=normalizeProgressWith(json(raw(gigOf())),true),other={...hands,vehicles:held.vehicles};
 assert(other.carry&&other.vehicles.length===2);
 // endParcel / removeParcelPieces
 const a=hands.gigs.active;assert.equal(endParcel(other,a,false),other,'off: untouched');const e=endParcel(other,a,true);assert.equal(e.carry,null);same(e.vehicles[1].cargo,[{k:'log'}]);same(e.vehicles[0].cargo,[{k:'parcel',g:99,m:'prop.carton-small'}],'another gig piece stays');assert.equal(JSON.stringify(other.carry).includes('parcel'),true,'input untouched');
 assert.equal(removeParcelPieces(e,12),e,'nothing to remove: the same object');assert.equal(endParcel(other,{...a,needId:'n1'},true),other,'a need gig has no parcel');
 const all=removeParcelPieces(other);assert.equal(all.carry,null);assert.equal(all.vehicles[0].cargo,undefined);same(all.vehicles[1].cargo,[{k:'log'}]);
 // fail, abandon, complete
 const f=failGig(other,0,'late',true);assert.equal(f.gigs.active,null);assert.equal(f.carry,null);same(f.vehicles[1].cargo,[{k:'log'}]);assert.equal(failGig(other,0,'late',false).carry.kind,'parcel','off: the hands keep it');
 const ab=abandonGig(other,true);assert.equal(ab.state.carry,null);same(ab.state.vehicles[1].cargo,[{k:'log'}]);assert.equal(abandonGig(other,false).state.carry.kind,'parcel');assert.equal(abandonContract(other,true).state.carry,null);assert.equal(abandonContract(other,false).state.carry.kind,'parcel');
 const done={...other,gigs:{...other.gigs,active:{...other.gigs.active,visited:[true],stage:1}}};
 const c=completeGig(done,0,{pieces:true});assert(!c.error,c.error);assert.equal(c.state.gigs.active,null);assert.equal(c.state.carry,null);same(c.state.vehicles[1].cargo,[{k:'log'}]);assert(c.paid>0);
 const c0=completeGig(done,0,{pieces:false});assert.equal(c0.state.carry.kind,'parcel','off: the piece is left');
 // drop (X) and pick up (E) with pieces: the hands piece becomes the ground drop and back
 const dr=dropGigParcel(hands,{x:19,z:-8},true);assert(!dr.error,dr.error);assert.equal(dr.state.carry,null);assert.deepEqual(dr.state.gigs.active.drop,{x:19,z:-8});assert.equal(parcelLocation(dr.state),'ground');
 const pk=pickGigParcel(dr.state,true);assert(!pk.error,pk.error);assert.equal(pk.state.carry.kind,'parcel');assert.equal(pk.state.carry.gig,12);assert.equal(parcelLocation(pk.state),'hands');
 const dr0=dropGigParcel({...hands,carry:null},{x:19,z:-8},false);assert.equal(dr0.state.carry,null);const pk0=pickGigParcel(dr0.state,false);assert.equal(pk0.state.carry,null,'off: the flag only');
 assert.match(pickGigParcel({...dr.state,carry:{kind:'log'}},true).error,/hands are full/);
 // pickup at the origin puts the box in the hands (on)
 const orig={...hands,carry:null,gigs:{...hands.gigs,active:{...hands.gigs.active,origin:{x:19,z:-6.3,room:'street'},pickedAt:null}}};assert.equal(parcelLocation(orig),'waiting');
 const up=pickUpGigBox(orig,{x:19,z:-6.3},'street',true);assert(!up.error,up.error);assert.equal(up.state.carry.kind,'parcel');assert.equal(pickUpGigBox(orig,{x:19,z:-6.3},'street',false).state.carry,null)}
// the time-of-day independent parts: a save in the middle of everything loads twice-stable with the switch on
{const mid=normalizeProgressWith(json(raw(gigOf(),{carry:null,vehicles:[{...atv,cargo:[{k:'parcel',g:12,m:'prop.carton-small'}]}]})),true);same(normalizeProgressWith(json(mid),true),mid)}

// ---- 6. the switches are ON (wired in game.js, OPUS-wiring): old saves with a held or stowed parcel load through the DEFAULT normalizeProgress
{const held=normalizeProgress(json(raw(gigOf(),{carry:null})));same(held.carry,{kind:'parcel',gig:12,model:held.carry.model});assert.equal(parcelLocation(held),'hands');assert.equal(parcelHeld(held),false,'a piece in the hands: progress.carry blocks the hands, not the old flag');assert(parcelTaken(held));
 same(normalizeProgress(json(held)),held,'normalising twice is stable');
 // an old 'stowed' parcel (ATV-STOW saved it exactly like a held one: drop null, nothing on the rack) comes back into the hands too (old saves do not say which vehicle was ridden)
 const st=normalizeProgress(json(raw(gigOf(),{carry:null,vehicles:[{...atv}]})));assert.equal(parcelLocation(st),'hands');same(normalizeProgress(json(st)),st);
 // hands busy with a log: the parcel stays the old flag ('held'), which still blocks the hands and is retried on the next load
 const busy=normalizeProgress(json(raw(gigOf(),{carry:{kind:'log'}})));same(busy.carry,{kind:'log'});assert.equal(parcelLocation(busy),'held');assert(parcelHeld(busy));same(normalizeProgress(json(busy)),busy);
 // a parcel left on a bed: the hands are free (the old flag no longer blocks them)
 const bed=normalizeProgress(json(raw(gigOf(),{carry:null,vehicles:[{...atv,cargo:[{k:'parcel',g:12,m:'prop.carton-small'}]}]})));assert.equal(parcelLocation(bed),'bed');assert.equal(bed.carry,null);assert.equal(parcelHeld(bed),false);assert(parcelCarried(bed));
 // a crate in the hands of a save loads as a crate
 same(normalizeProgress(json(raw(null,{carry:{kind:'crate'}}))).carry,{kind:'crate'})}

// ---- 7. crates and boxes on the ground (carry.js crateDrops): a put-down ALWAYS works (the oldest is cleared at the limit), pick up, the save
{const base={carry:{kind:'crate'}};
 const a=putDownCrate(base,{x:104,z:-260,q:5});assert(!a.error,a.error);assert.equal(a.state.carry,null);same(a.state.crateDrops,[{id:1,x:104,z:-260,k:'crate',q:1}]);
 assert.match(putDownCrate({carry:{kind:'planks',count:4}},{x:104,z:-260}).error,/not carrying a crate/);assert.match(putDownCrate({carry:null},{x:104,z:-260}).error,/not carrying a crate/);
 const b=putDownCrate({carry:{kind:'box'},crateDrops:a.state.crateDrops},{x:105,z:-260});same(b.state.crateDrops[1],{id:2,x:105,z:-260,k:'box',q:0});
 const full=Array.from({length:MAX_CRATE_DROPS},(_,i)=>({id:i+1,x:100+i*.5,z:-260,k:'crate',q:0}));
 const c=putDownCrate({carry:{kind:'crate'},crateDrops:full},{x:104,z:-261});assert(!c.error,c.error);assert.equal(c.state.carry,null);assert.equal(c.state.crateDrops.length,MAX_CRATE_DROPS);assert(!c.state.crateDrops.some(d=>d.id===1),'the oldest went');assert.match(c.message,/cleared away/);
 const u=pickUpCrate(b.state,2);same(u.state.carry,{kind:'box'});same(u.state.crateDrops,a.state.crateDrops);
 assert.match(pickUpCrate({...b.state,carry:{kind:'log'}},1).error,/hands are full/);assert.match(pickUpCrate(b.state,99).error,/gone/);
 same(normalizeCrateDrops([...b.state.crateDrops,{id:2,x:104,z:-260,k:'crate'},{id:3,x:NaN,z:0,k:'crate'},{id:4,x:104,z:-260,k:'sofa'},null,'x']),b.state.crateDrops,'bad and duplicate drops are skipped');
 assert.equal(normalizeCrateDrops(full.concat([{id:99,x:104,z:-260,k:'crate'}])).length,MAX_CRATE_DROPS);
 const n0=normalizeProgress(json(raw(null)));assert.equal(n0.crateDrops,undefined,'absent when there are none');
 const n1=normalizeProgress(json(raw(null,{carry:{kind:'crate'},crateDrops:b.state.crateDrops})));same(n1.crateDrops,b.state.crateDrops);same(n1.carry,{kind:'crate'});same(normalizeProgress(json(n1)),n1,'twice the same');
 // a crate comes off a crate bed into the hands, goes down on the ground, comes back up and onto the bed again (the whole loop the game wires)
 const off=unloadOne(null,[{k:'crate'},{k:'crate'}],'worktruck');same(off.carry,{kind:'crate'});const down=putDownCrate({carry:off.carry},{x:104,z:-260});const up2=pickUpCrate(down.state,1);const back=loadCarry(up2.state.carry,off.cargo,'worktruck');same(back.cargo,[{k:'crate'},{k:'crate'}])}

console.log('PASS cargo-hands: crate/box/parcel carry normalised and slowed (one table), a crate off the bed into the hands and back (switch), parcel and box bed pieces, load drag counts them, the save migration behind PARCEL_PIECES_ENABLED (off changes nothing, on moves a held parcel once), gigs end their parcel piece');
