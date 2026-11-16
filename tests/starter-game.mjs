import assert from 'node:assert/strict';
import {freshProgress,normalizeProgress} from '../dist/jobs.js';
import {PLACES,BEATS,fresh,applyStory,startLoan,ensureLoan,halTalk,buyFromHal,halHere,knockQuality,cratePay,aimPoint,starterObjective,skipStarter,SKIP_SALE_PRICE,LOAN_FUEL_MGAL,CRATE_REACH,MARKET_REACH} from '../dist/starter.js';
import {vehicleCount,vehicleCapacity,loanUidOf,parkingAim,STUDIO_ID,VEHICLE_PRICE} from '../dist/orders.js';
import {isWalkable} from '../dist/world.js';
import {MAP} from '../dist/map-definition.js';
import {PROPS} from '../dist/props-assets.js';
import {CLASSES} from '../dist/vehicle.js';
import {createHal,turnToward,HAL_VIEW} from '../dist/hal.js';
// The story as the game plays it: pure applyStory/startLoan/ensureLoan/halTalk/buyFromHal on a real progress object (game.js only wires them to the world).
const cash=p=>p.cash;

// ---- places are on walkable ground and clear of every landmark's colliders (the farm buildings included)
const solid=(x,z,pad=0,skip='')=>MAP.landmarks.some(l=>{if(l.id===skip)return false;const info=PROPS[l.prop];if(!info)return false;const c=Math.round(Math.cos(l.yaw)),s=Math.round(Math.sin(l.yaw));return info.colliders.some(b=>{const bx=l.x+b.x*c+b.z*s,bz=l.z-b.x*s+b.z*c,turned=s!==0,hx=turned?b.hz:b.hx,hz=turned?b.hx:b.hz;return Math.abs(x-bx)<hx+pad&&Math.abs(z-bz)<hz+pad})});
for(const k of ['spawn','market','oakStreet18','farmhouse','gas','apartments','ridgeline','hal','crates','farmTruck'])assert(isWalkable(PLACES[k].x,PLACES[k].z),k+' is walkable');
for(const k of ['hal','crates','farmTruck','farmhouse'])assert(!solid(PLACES[k].x,PLACES[k].z,.4,k==='crates'?'farm-egg-crates':''),k+' is clear of the buildings');
{const t=PLACES.farmTruck,cls=CLASSES.shortbed,c=Math.cos(t.yaw),s=Math.sin(t.yaw);
 for(const [lx,lz] of [[cls.hx,cls.hz],[-cls.hx,cls.hz],[cls.hx,-cls.hz],[-cls.hx,-cls.hz],[0,0]]){const x=t.x+lx*c+lz*s,z=t.z-lx*s+lz*c;assert(isWalkable(x,z)&&!solid(x,z,.2),'truck corner free '+x+','+z)}
 assert(t.x>=MAP.playable.x0&&t.x<=MAP.playable.x1&&t.z>=MAP.playable.z0&&t.z<=MAP.playable.z1);
 const farmHouse=MAP.landmarks.find(l=>l.id==='farm-house');assert(Math.hypot(PLACES.hal.x-farmHouse.x,PLACES.hal.z-farmHouse.z)<12,'Hal stands at the farmhouse');
 assert(Math.hypot(PLACES.crates.x-t.x,PLACES.crates.z-t.z)<CRATE_REACH,'the truck can stand within reach of the pile');
 assert(MAP.landmarks.some(l=>l.id==='farm-egg-crates'&&l.x===PLACES.crates.x&&l.z===PLACES.crates.z),'the pallet of crates is drawn where the pile is');}
assert.deepEqual(aimPoint('hal'),{x:PLACES.hal.x,z:PLACES.hal.z});assert.equal(aimPoint('phone'),null);assert.equal(aimPoint(null),null);

// ---- beats 1 and 2 on a fresh save
let p=freshProgress();assert.equal(p.starter.step,0);assert.equal(starterObjective(p).aim,'market');
for(const wrong of ['delivered','ate','arrived','loaded','delivered-crates','refuelled','note-given','gig-done','rented','slept'])assert(applyStory(p,wrong).error,'step 0 refuses '+wrong);
let r=applyStory(p,'read-message');assert(r.progress);p=r.progress;assert.equal(p.starter.step,1);assert.equal(cash(p),0);
r=applyStory(p,'delivered');p=r.progress;assert.equal(p.starter.step,2);assert.equal(cash(p),300);assert.equal(p.routine.earned,300);assert(/\+\$3/.test(r.text));
r=applyStory(p,'ate');p=r.progress;assert.equal(p.starter.step,3);assert.equal(starterObjective(p).aim,'farmhouse');
// before Hal: a refused arrival and no truck yet
assert(applyStory(p,'loaded').error);assert.equal(p.vehicles.length,0);assert.equal(loanUidOf(p),null);

// ---- Hal in person: the talk changes with the story; the groceries start the loan
assert(halTalk(p).choices.some(c=>c.id==='groceries'));
const L=startLoan(p);assert(L.progress,JSON.stringify(L));p=L.progress;
assert.equal(p.starter.step,4);assert.equal(p.starter.loanUid,L.vehicle.uid);assert.equal(cash(p),300+2500);
assert.equal(L.vehicle.model,'shortbed');assert.equal(L.vehicle.x,PLACES.farmTruck.x);assert.equal(L.vehicle.z,PLACES.farmTruck.z);assert.equal(L.vehicle.fuelMgal,LOAN_FUEL_MGAL);assert(LOAN_FUEL_MGAL<MAP.vehicles.find(v=>v.model==='shortbed').fuel.tankMgal/4,'nearly empty');
assert(startLoan(p).error,'the loan is lent once');
// loan is not owned: it takes no place at home and is saved with the story
assert.equal(vehicleCount(p),0);assert.equal(loanUidOf(p),L.vehicle.uid);assert.equal(p.vehicles.length,1);
{const back=normalizeProgress(JSON.parse(JSON.stringify(p)));assert.equal(back.vehicles.length,1,'the loan survives a save');assert.equal(back.starter.loanUid,L.vehicle.uid);assert.equal(vehicleCount(back),0)}
// a broken save (story step no longer allows a loan) loses the truck: nobody keeps a free extra truck
{const bad=JSON.parse(JSON.stringify(p));bad.starter.step=2;const back=normalizeProgress(bad);assert.equal(back.vehicles.length,0);assert.equal(back.starter.loanUid,null);
 const gone=JSON.parse(JSON.stringify(p));gone.starter={step:10,done:true,loanUid:L.vehicle.uid};assert.equal(normalizeProgress(gone).vehicles.length,0)}
assert.equal(ensureLoan(p),null,'no second truck while the loan exists');
assert(halTalk(p).text.includes('Four crates')&&halTalk(p).choices.length===0);

// ---- beat 5: crates (loaded first, quality from knocks), beat 6: fuel
assert(applyStory(p,'delivered-crates',{quality:100}).error,'load first');
assert(applyStory(p,'refuelled').error&&applyStory(p,'slept').error);
r=applyStory(p,'loaded');p=r.progress;assert(p.starter.loaded);assert(applyStory(p,'loaded').error);assert.equal(starterObjective(p).aim,'market');assert(/waiting|Noah/.test(halTalk(p).text));
assert.equal(knockQuality(0),100);assert.equal(knockQuality(2),76);assert.equal(knockQuality(99),0);
const before=cash(p);r=applyStory(p,'delivered-crates',{quality:knockQuality(2)});p=r.progress;assert.equal(p.starter.step,5);assert.equal(cash(p)-before,cratePay(76));assert.equal(p.starter.loaded,false);
r=applyStory(p,'refuelled');p=r.progress;assert.equal(p.starter.step,6);assert.equal(p.starter.fuelGiven,true);assert.equal(r.progress.cash-before,cratePay(76)+3200);
// beats 7 and 8 either order; wrong events refused
for(const wrong of ['rented','slept','ate','delivered'])assert(applyStory(p,wrong).error);
p=applyStory(p,'gig-done').progress;assert.equal(p.starter.step,7);assert(applyStory(p,'gig-done').error);p=applyStory(p,'note-given').progress;assert.equal(p.starter.step,8);
// beat 9: renting (the game also sends it on its own when the studio is already rented)
assert(applyStory(p,'slept').error);r=applyStory({...p,housing:{...p.housing,rented:false}},'rented');assert.equal(r.progress.starter.step,9);p={...r.progress,housing:{...p.housing,rented:true}};
assert.equal(vehicleCapacity(p),1);assert.equal(vehicleCount(p),0);

// ---- the gift needs room: the loan becomes yours only if the studio has a free place
{const full={...p,vehicles:[...p.vehicles,{uid:'v90',model:'worktruck',colour:'white',x:100,z:50,yaw:0,fuelMgal:1000}]};
 assert.equal(vehicleCount(full),1);const no=applyStory(full,'slept');assert(no.error&&no.soft,'no room: soft refusal');assert(/place to park/.test(no.error));assert.equal(full.starter.step,9)}
r=applyStory(p,'slept');assert(r.progress&&!r.error);const q=r.progress,aim=parkingAim(STUDIO_ID);
assert(q.starter.done);assert.equal(q.starter.step,10);assert.equal(q.starter.loanUid,null);assert.equal(vehicleCount(q),1,'now it counts as yours');assert.equal(loanUidOf(q),null);
assert.deepEqual(r.moved,{uid:L.vehicle.uid,pose:{x:+aim.x.toFixed(2),z:+aim.z.toFixed(2),yaw:+aim.yaw.toFixed(3)}});assert.equal(q.vehicles.find(v=>v.uid===L.vehicle.uid).x,r.moved.pose.x);
assert(/keep her/i.test(r.text));assert(applyStory(q,'slept').error);assert.equal(starterObjective(q),null);
assert.equal(normalizeProgress(JSON.parse(JSON.stringify(q))).vehicles.length,1,'the gifted truck survives a save');
assert.match(halTalk(q).text,/Come by some mornings/);assert.equal(halTalk(q).choices.length,0);assert(buyFromHal(q).error,'already has one');

// ---- a save that reached the truck beats before the truck existed gets the loan in the farm yard once
{let s=freshProgress();s={...s,starter:{...fresh(),step:5,quality:100}};const e=ensureLoan(s);assert(e&&e.progress.starter.loanUid===e.vehicle.uid&&e.vehicle.x===PLACES.farmTruck.x);assert.equal(ensureLoan(e.progress),null);assert.equal(vehicleCount(e.progress),0)}
assert.equal(ensureLoan({...freshProgress(),starter:fresh()}),null,'not before beat 5');

// ---- an old save is skipped (no story), Hal sells the Shortbed at the store price
{const raw={...JSON.parse(JSON.stringify(freshProgress())),cash:5,completed:2};delete raw.starter;const old=normalizeProgress(raw); // a save from before the story has no starter fieldassert(old.starter.skipped&&old.starter.done);assert(applyStory(old,'read-message').error);assert.equal(old.starter.loanUid,null);
 const t=halTalk(old);assert(t.choices.some(c=>c.id==='buy')&&t.text.includes('$500'));assert.equal(SKIP_SALE_PRICE,VEHICLE_PRICE.shortbed);
 const poor={...old,cash:SKIP_SALE_PRICE-1,housing:{...old.housing,rented:true}};assert(buyFromHal(poor).error,'not enough cash');
 const homeless=buyFromHal({...old,cash:SKIP_SALE_PRICE*2});assert(/no room/i.test(homeless.error),'a place at home is needed');
 const rich={...old,cash:SKIP_SALE_PRICE+25,housing:{...old.housing,rented:true}},b=buyFromHal(rich);assert(b.progress,JSON.stringify(b));assert.equal(b.progress.cash,25);assert.equal(b.vehicle.x,PLACES.farmTruck.x);assert.equal(vehicleCount(b.progress),1);assert(buyFromHal(b.progress).error);
 const sk={...freshProgress(),starter:skipStarter()};assert(halTalk(sk).choices.some(c=>c.id==='buy'));assert(buyFromHal(freshProgress()).error,'not while the story is running')}

// ---- Hal's hours: at the farm in the working day, and always while the story needs him
assert(halHere({...freshProgress(),routine:{minutes:600}}));assert(!halHere({...freshProgress(),routine:{minutes:1200}}));assert(halHere({...freshProgress(),starter:{...fresh(),step:3},routine:{minutes:1200}}));assert(!halHere({...freshProgress(),starter:{...fresh(),step:0},routine:{minutes:1200}}));

// ---- the character: hidden far away, shown near, turns toward you, no per-frame allocation (numbers only), ground height refreshed rarely
assert(Math.abs(turnToward(0,0,1,1))<1e-9&&Math.abs(turnToward(0,1,0,1)-Math.PI/2)<1e-9);assert(Math.abs(turnToward(3,Math.sin(-3),Math.cos(-3),1)-(-3+2*Math.PI))<1e-6,'shortest way round');assert.equal(turnToward(1,5,5,0),1);
{let updates=0,groundCalls=0;const group={position:{x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z}},rotation:{y:0},visible:true,name:''},added=[];
 const hal=createHal({scene:{add:o=>added.push(o)},createCharacter:look=>{assert.equal(look.head,'Farmer');assert.equal(look.body,'male');return {group,update:()=>updates++}},outfit:(body,id,extra)=>({body,head:id,top:id,legs:id,feet:id,...extra}),groundAt:()=>{groundCalls++;return 1.5}});
 assert.deepEqual(added,[group]);assert.equal(group.visible,false);assert.equal(group.position.x,PLACES.hal.x);assert.equal(group.position.y,1.5);
 hal.update(.016,{x:0,z:0},true);assert.equal(group.visible,false);assert.equal(updates,0,'far away: hidden and not animated');
 const near={x:PLACES.hal.x+3,z:PLACES.hal.z};hal.update(.016,near,true);assert(group.visible&&hal.visible);assert.equal(updates,1);const g0=groundCalls;for(let i=0;i<63;i++)hal.update(.016,near,true);assert(groundCalls-g0<=2,'ground height not read every frame');assert(Math.abs(group.rotation.y-Math.PI/2)<.3,'he turned toward the player');
 hal.update(.016,near,false);assert.equal(group.visible,false);assert(HAL_VIEW>=40)}
assert.equal(BEATS.length,10);assert(CRATE_REACH>0&&MARKET_REACH>CRATE_REACH);
// G3b: the egg crates are a real cargo piece on the loan truck's deck (storyDeck is what game.js asks every frame)
{const {storyDeck,storyPalletHidden,STORY_CRATES}=await import('../dist/starter.js'),{countOf,hasCrates,addPlanks,slotPositions}=await import('../dist/cargo.js');
 assert.equal(STORY_CRATES,4,'four egg crates (the beat text says four)');
 const off={...fresh(),loaded:false},on={...fresh(),loaded:true};
 assert.equal(storyPalletHidden(off),false);assert.equal(storyPalletHidden(on),true);assert.equal(storyPalletHidden({...on,done:true}),false,'a finished or skipped story leaves the pallet alone');assert.equal(storyPalletHidden(null),false);
 assert.equal(storyDeck(off,null,'shortbed'),null,'before loading: nothing to do');
 const d=storyDeck(on,null,'shortbed');assert.equal(countOf(d.cargo,'crate'),4,'loaded puts four crates on the Shortbed deck');assert.equal(storyDeck(on,d.cargo,'shortbed'),null,'and then it is right (asked every frame, nothing churns)');
 assert.equal(slotPositions('shortbed',d.cargo).length,4);
 const gone=storyDeck(off,d.cargo,'shortbed');assert.equal(gone.cargo,null,'delivered: the deck is empty again');assert.equal(storyDeck(off,gone.cargo,'shortbed'),null);
 assert.equal(countOf(storyDeck(on,[{k:'crate'}],'shortbed').cargo,'crate'),4,'a stray crate count is corrected to four');
 assert.equal(storyDeck(on,[{k:'log'}],'shortbed'),null,'timber on the deck: the deck is left alone (game.js asks the player to clear it before loading)');
 // the whole beat 4 on a real save: loaded -> crates, delivered-crates -> none
 let q=freshProgress();q={...q,starter:{...fresh(),step:4,loanUid:'loan'}};const ld=applyStory(q,'loaded');assert(ld.progress,ld.error);assert(storyPalletHidden(ld.progress.starter),'the event sets loaded');assert(storyDeck(ld.progress.starter,null,'shortbed').cargo);
 const dl=applyStory(ld.progress,'delivered-crates',{quality:100});assert(dl.progress,dl.error);assert(!storyPalletHidden(dl.progress.starter),'after delivery the pallet is back');assert.equal(storyDeck(dl.progress.starter,d.cargo,'shortbed').cargo,null,'and the crates leave the deck');
 assert.equal(addPlanks(d.cargo,'shortbed',4).error!==undefined,true,'planks cannot join the story crates');}
console.log('starter-game ok');
