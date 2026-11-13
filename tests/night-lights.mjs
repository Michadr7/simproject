// Night lights (dist/night-lights-rules.js, dist/night-lights.js): when lamps, windows and headlights are on, as pure rules of the day and night rig; then the drawing
// on three.js without a renderer (what it adds to the scene, what it costs); then the packaged game (lamps, windows, the L key, the vehicle panel, the one SpotLight).
import assert from 'node:assert/strict';
import {skyAt,moodAt} from '../dist/daynight.js';
import {MAP} from '../dist/map-definition.js';
import {CLASSES,doorPoint} from '../dist/vehicle.js';
import {vehicleHudModel} from '../dist/vehicle-hud.js';
import {SWITCH_FROM,SWITCH_FULL,BASE_LEVEL,SHOW_FROM,DUSK_MINUTE,DAWN_MINUTE,LAMP,WINDOW,BEAM,BEAM_VERTICES,BEAM_INDICES,SPOT,VEHICLE_LAMPS,LIGHT_KEY,LIGHT_MODES,MOVING_HOLD,DAY_BEAM,GLOW_SCALE_MIN,GLOW_SCALE_MAX,
 lightSwitch,lightLevel,isDark,glowScale,lampHeadGlow,poolShape,hashOf,windowsLit,windowBucket,buildingKind,isGlass,GLASS_PROPS,glassMaskBytes,nextLightMode,headlightsOn,lightsLabel,vehicleGlow,lampPoints,beamShape,spotlightPlan} from '../dist/night-lights-rules.js';
import {bootGame} from './support/boot-game.mjs';

const near=(a,b,eps,msg)=>assert(Math.abs(a-b)<=eps,`${msg}: ${a} vs ${b}`);
const clock=(h,m=0)=>h*60+m,share=(list,fn)=>list.filter(fn).length/list.length;

// --- When it is dark: the switch follows the sun, the strength follows the night share --------------------------------------
assert(SWITCH_FROM>0&&SWITCH_FULL<0,'lamps start before sunset and are fully switched just after it');assert.equal(LIGHT_KEY,'KeyL');
assert.equal(lightSwitch(1),0);assert.equal(lightSwitch(-1),1);assert.equal(lightLevel(skyAt(720)),0,'nothing glows at noon');assert.equal(lightLevel(skyAt(0)),1,'everything is full at midnight');
for(let m=0;m<1440;m++){const s=skyAt(m),l=lightLevel(s);assert(l>=0&&l<=1,`level in 0..1 at ${m}`);if(s.weights.night>0)assert(l>=BASE_LEVEL-1e-9,`once any night has mixed in the lamps are fully switched (${m})`);if(s.weights.day>=.5)assert.equal(l,0,`no glow while it is mostly day (${m})`)}
for(let m=clock(6,30);m<=clock(17,30);m++)assert.equal(lightLevel(skyAt(m)),0,`off from 06:30 to 17:30 (${m})`);
for(let m=clock(19,45);m<1440+clock(4,15);m++)near(lightLevel(skyAt(m)),1,.01,`full all night (${m%1440})`);
{const sunset=lightLevel(skyAt(1080));assert(sunset>.25&&sunset<BASE_LEVEL,'at sunset the lamps are on but not yet at night strength: '+sunset.toFixed(2));near(lightLevel(skyAt(clock(18,12))),BASE_LEVEL,.02,'fully switched by 18:12, at the base strength');
 let worst=0;for(let i=0;i<1440*4;i++)worst=Math.max(worst,Math.abs(lightLevel(skyAt(i/4))-lightLevel(skyAt((i+1)/4))));assert(worst<.03,`the level never jumps (worst step ${worst.toFixed(4)} per quarter minute)`);
 near(lightLevel(skyAt(1439.99)),lightLevel(skyAt(0)),1e-3,'none across midnight');}
assert(!isDark(skyAt(DUSK_MINUTE-1))&&isDark(skyAt(DUSK_MINUTE)),'dark starts at 17:52');assert(isDark(skyAt(DAWN_MINUTE))&&!isDark(skyAt(DAWN_MINUTE+1)),'and ends at 06:08');assert.equal(DUSK_MINUTE,clock(17,52));assert.equal(DAWN_MINUTE,clock(6,8));
assert(!isDark(skyAt(720))&&isDark(skyAt(0)));assert.equal(moodAt(DUSK_MINUTE).night,0,'the switch comes before the night share: lamps are lit through dusk');
assert.equal(glowScale(99),GLOW_SCALE_MAX);assert.equal(glowScale(0),GLOW_SCALE_MIN);assert.equal(glowScale(NaN),1);assert.equal(glowScale(1.5),1.5);

// --- Street lamps ----------------------------------------------------------------------------------------------------------
assert.equal(lampHeadGlow(0),.55,'by day the heads keep the glow they always had');assert.equal(lampHeadGlow(1),LAMP.headNight);assert(lampHeadGlow(.5)>lampHeadGlow(.2));assert.equal(lampHeadGlow(7),LAMP.headNight);
{const p=poolShape();assert.deepEqual(p.vertices[0],[0,0,1],'brightest in the middle');assert.equal(p.vertices.length,1+LAMP.poolRings*LAMP.poolSegments);assert.equal(p.indices.length/3,LAMP.poolSegments*(1+2*(LAMP.poolRings-1)));
 for(const [dx,dz,s] of p.vertices){assert(Math.hypot(dx,dz)<=LAMP.poolRadius+1e-9,'inside the radius');assert(s>=0&&s<=1)}
 for(const v of p.vertices.slice(-LAMP.poolSegments)){near(Math.hypot(v[0],v[1]),LAMP.poolRadius,1e-9,'the last ring is the rim');assert.equal(v[2],0,'nothing at the rim: the pool has no edge')}
 for(const i of p.indices)assert(Number.isInteger(i)&&i>=0&&i<p.vertices.length);}

// --- Windows: the occupied-hours rule --------------------------------------------------------------------------------------
{const ids=Array.from({length:800},(_,i)=>'house-'+i),hs=ids.map(id=>hashOf(id));for(const h of hs)assert(h>=0&&h<1);near(hs.reduce((a,b)=>a+b,0)/hs.length,.5,.05,'the hash spreads evenly');assert.equal(hashOf('a',1),hashOf('a',1));assert.notEqual(hashOf('a',1),hashOf('a',2));
 for(const kind of ['home','shop','office','works','always','vacant'])for(let m=0;m<1440;m+=10)assert.equal(windowsLit('x',m,{kind,dark:false}),false,`nothing is lit while it is not dark (${kind}, ${m})`);
 const lit=m=>share(ids,id=>windowsLit(id,m,{kind:'home',dark:isDark(skyAt(m))}));
 assert.equal(lit(720),0,'never at noon');assert(lit(clock(20))>.8,`most houses are lit at 20:00 (${lit(clock(20)).toFixed(2)})`);
 for(let m=clock(23,46);m<1440+clock(5,30);m+=2)assert.equal(lit(m%1440),0,`every house is dark from 23:46 to 05:30 (${m%1440})`);
 const morning=lit(clock(6,5));assert(morning>.25&&morning<.45,`about a third are up before sunrise (${morning.toFixed(2)})`);
 const away=share(ids,id=>!Array.from({length:144},(_,i)=>i*10).some(m=>windowsLit(id,m,{kind:'home'})));assert(away>.08&&away<.17,`about one in eight is away all night (${away.toFixed(2)})`);
 assert(lit(clock(17,55))<lit(clock(18,35)),'they do not all come on in the same minute');assert(lit(clock(22))>lit(clock(23,30))&&lit(clock(23,30))>0,'and go to bed between 21:30 and 23:45');
 for(const id of ids.slice(0,50))for(const m of [clock(19),clock(22,30),clock(5,50)])assert.equal(windowsLit(id,m),windowsLit(id,m),'the same house and minute give the same answer');
 // shops follow their hours, offices close, industry and the police keep a light on
 assert(windowsLit('s',clock(19),{kind:'shop'})&&!windowsLit('s',clock(21,30),{kind:'shop'}),'a shop is lit until it closes (21:00 by default)');
 assert(windowsLit('market',clock(21,30),{kind:'shop',hours:MAP.shops.market.hours})&&!windowsLit('market',clock(22,30),{kind:'shop',hours:MAP.shops.market.hours}),'the market until 22:00');
 assert(!windowsLit('cafe',clock(19),{kind:'shop',hours:MAP.shops.cafe.hours}),'the cafe closed at 18:00');
 assert.equal(share(ids,id=>windowsLit(id,clock(18,30),{kind:'office'})),1,'every office is lit at 18:30');near(share(ids,id=>windowsLit(id,clock(2),{kind:'office'})),WINDOW.nightShare,.06,'half leave a light on all night');
 near(share(ids,id=>windowsLit(id,clock(2),{kind:'works'})),WINDOW.nightShare,.06,'one industrial unit in two keeps a light on');
 assert(windowsLit('p',clock(3),{kind:'always'})&&!windowsLit('p',clock(3),{kind:'vacant'})&&!windowsLit('p',clock(20),{kind:null}));
 assert.equal(windowBucket(1207),1200);assert.equal(windowBucket(-5),1430);assert.equal(windowBucket(1440),0);}
// what kind of building each landmark is, from the map
{const L=id=>MAP.landmarks.find(l=>l.id===id),P=id=>MAP.properties.find(p=>p.landmark===id)||null,kind=(id,held=false)=>buildingKind(L(id),P(id),held);
 assert.equal(kind('house-r1'),'vacant','a house nobody lives in stays dark');assert.equal(kind('house-r1',true),'home','until the player rents or buys it');assert.equal(kind('house-r2'),'home');assert.equal(kind('farm-house'),'home');
 assert.equal(kind('alder-bakery'),'shop');assert.equal(kind('alder-offices'),'office');assert.equal(kind('police-station'),'always');assert.equal(kind('eastbank-warehouse'),'works');assert.equal(kind('eastbank-gas-kiosk'),'always');
 assert.equal(kind('farm-barn'),null);assert.equal(kind('park-cs-1'),null,'a parked car is not a building');assert.equal(kind('sawmill'),null);
 const glass=MAP.landmarks.filter(l=>GLASS_PROPS(l.prop));assert.equal(glass.length,23,'9 houses, 9 Alder buildings and 5 industrial units have windows to light');for(const l of glass)assert(buildingKind(l,P(l.id)),`${l.id} has a kind`);
 assert(!GLASS_PROPS('store')&&!GLASS_PROPS('barn')&&!GLASS_PROPS('car'));}
// the glass swatch of the Kenney palette textures
assert(isGlass(203,228,254)&&isGlass(108,152,219)&&isGlass(150,186,234),'the light-blue gradient strip is glass, top to bottom');
assert(!isGlass(208,232,255)&&!isGlass(103,148,217),'the flat swatches beside it are not');assert(!isGlass(255,255,255)&&!isGlass(87,194,134)&&!isGlass(95,100,124)&&!isGlass(0,0,0));
{const m=glassMaskBytes(new Uint8Array([150,186,234,255, 87,194,134,255, 203,228,254,255]));assert.equal(m.count,2);assert.deepEqual([...m.bytes],[255,255,255,255,0,0,0,255,255,255,255,255])}

// --- Vehicles --------------------------------------------------------------------------------------------------------------
assert.deepEqual([...LIGHT_MODES],['auto','on','off']);assert.equal(nextLightMode('auto'),'on');assert.equal(nextLightMode('on'),'off');assert.equal(nextLightMode('off'),'auto');assert.equal(nextLightMode(undefined),'on');
for(const inUse of [false,true])for(const dark of [false,true])for(const mode of LIGHT_MODES)assert.equal(headlightsOn({inUse,dark,mode}),inUse&&(mode==='on'||(mode==='auto'&&dark)),`headlights: in use ${inUse}, dark ${dark}, ${mode}`);
assert.equal(headlightsOn({inUse:false,dark:true,mode:'on'}),false,'a parked vehicle is dark whatever the switch says');assert.equal(headlightsOn(),false);
assert.equal(lightsLabel('auto',true),'Lights: auto (on)');assert.equal(lightsLabel('auto',false),'Lights: auto (off)');assert.equal(lightsLabel('on',true),'Lights: on');assert.equal(lightsLabel('off',false),'Lights: off');
{const m=vehicleHudModel({driving:{},seat:'driver',name:'Worktruck',speed:0,lights:lightsLabel('auto',true)});assert.deepEqual(m.keys[1],{kbd:'L',text:'Lights: auto (on)'},'the vehicle panel shows the key and the state');
 assert.equal(vehicleHudModel({driving:{},seat:'driver',name:'X',speed:0}).keys.length,1,'no row without it');assert.equal(vehicleHudModel({driving:{},seat:'passenger',name:'X',lights:'Lights: on'}).keys.length,1,'a passenger has no switch');}
assert.equal(vehicleGlow(0),DAY_BEAM,'lamps switched on by day are still seen');assert.equal(vehicleGlow(1),1);
for(const [model,cls] of Object.entries(CLASSES)){
 assert(VEHICLE_LAMPS[model],`${model} has its own lamp spots`);
 const p=lampPoints(model,{hx:cls.hx,hz:cls.hz});assert.equal(p.front.length,2);assert.equal(p.rear.length,2);
 for(const [x,y,z] of p.front){assert(Math.abs(x)<cls.hx&&Math.abs(x)>cls.hx*.3,`${model}: a headlamp each side, inside the width`);assert(z>cls.hz-.3&&z<cls.hz+.15,`${model}: at the nose`);assert(y>.4&&y<1.6,`${model}: at lamp height`)}
 for(const [x,y,z] of p.rear){assert(Math.abs(x)<cls.hx&&Math.abs(x)>cls.hx*.3);assert(z<-cls.hz+.3&&z>-cls.hz-.15,`${model}: tail lamps at the back`);assert(y>.4&&y<1.6)}
 assert.equal(p.front[0][0],-p.front[1][0]);assert.equal(p.rear[0][0],-p.rear[1][0]);
}
{const p=lampPoints('some-npc-car',{hx:.9,hz:2.2,height:1.4});for(const [x,y,z] of [...p.front,...p.rear]){assert(Math.abs(x)<.9&&y>0&&y<1.4&&Math.abs(z)<2.3,'a model without its own entry gets lamps from its size')}assert(p.front[0][2]>0&&p.rear[0][2]<0)}
{const b=beamShape(3);assert.equal(b.vertices.length,BEAM_VERTICES);assert.equal(b.indices.length,BEAM_INDICES);for(const i of b.indices)assert(i>=0&&i<BEAM_VERTICES);
 for(const [x,z,s] of b.vertices){assert(z>=3+BEAM.start-1e-9&&z<=3+BEAM.start+BEAM.length+1e-9,'the beam lies ahead of the nose');assert(s>=0&&s<=1);if(x!==0)assert.equal(s,0,'nothing at its sides')}
 assert.equal(b.vertices[1][2],0,'nothing where it starts');assert.equal(b.vertices[BEAM_VERTICES-2][2],0,'nothing where it ends');assert(b.vertices[4][2]>b.vertices[7][2]&&b.vertices[7][2]>b.vertices[10][2],'brightest near the vehicle');
 near(b.vertices[2][0]*2,BEAM.nearWidth,1e-9,'near width');near(b.vertices[BEAM_VERTICES-1][0]*2,BEAM.farWidth,1e-9,'far width');}
// the one real light: High only, only while it is dark, kept (at 0) while it is merely switched off
assert.deepEqual(spotlightPlan({high:false,on:true,level:1,present:true}),{present:false,intensity:0},'Low never has the SpotLight');
assert.deepEqual(spotlightPlan({high:true,on:true,level:0,present:true}),{present:false,intensity:0},'nor does the day: the spotlight is night-only');
assert.deepEqual(spotlightPlan({high:true,on:true,level:1}),{present:true,intensity:SPOT.intensity});assert(spotlightPlan({high:true,on:true,level:.5}).intensity<SPOT.intensity);
assert.deepEqual(spotlightPlan({high:true,on:false,level:1,present:true}),{present:true,intensity:0},'switched off at night it stays in the scene at 0 (no recompile for a key press)');
assert.deepEqual(spotlightPlan({high:true,on:false,level:1,present:false}),{present:false,intensity:0},'and it is not added before it is needed');assert(SHOW_FROM>0&&SHOW_FROM<.1);

// --- The drawing on three.js, without a renderer ---------------------------------------------------------------------------
{const THREE=await import('../dist/vendor/three.module.js'),{createNightLights,maskTexture,MAX_VEHICLES}=await import('../dist/night-lights.js');
 const scene=new THREE.Scene();scene.fog=new THREE.Fog('#000',30,120);scene.add(new THREE.HemisphereLight(),new THREE.DirectionalLight());
 const heads=new THREE.InstancedMesh(new THREE.BoxGeometry(.75,.14,.3),new THREE.MeshStandardMaterial({emissive:'#ffe9a8',emissiveIntensity:.55}),3);heads.name='street-lamp-heads';
 [[0,0],[30,0],[60,5]].forEach(([x,z],i)=>heads.setMatrixAt(i,new THREE.Matrix4().makeTranslation(x,4.6,z)));scene.add(heads);
 const building=id=>{const l=MAP.landmarks.find(x=>x.id===id),mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());mesh.name='prop-'+l.prop;mesh.position.set(l.x,0,l.z);scene.add(mesh);return mesh};
 const r1=building('house-r1'),r2=building('house-r2'),police=building('police-station');
 const glass=new THREE.MeshStandardMaterial({color:'#435d68'}),cityWindows=Array.from({length:40},(_,i)=>({mesh:new THREE.Mesh(new THREE.BoxGeometry(1,1,1),glass),id:'city@0,0'}));
 const headMat=new THREE.MeshStandardMaterial({color:'#f2e4b7'}),cityLampHeads=[0,1].map(i=>{const m=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),headMat);m.position.set(i*10,4.9,20);return m});
 const footing=(x,z)=>x*.01,masksMade=[];
 const before=scene.children.length,lights=createNightLights({scene,footing,cityWindows,cityLampHeads,makeMask:(src,done)=>{masksMade.push(src);done(maskTexture(new Uint8Array(16),2,2))}});
 assert.equal(scene.children.length,before+2,'two objects are added: the sprites and the ground patches');assert(scene.getObjectByName('night-sprites')&&scene.getObjectByName('night-ground'));
 const count=()=>{let n=0;scene.traverse(o=>{if(o.isLight)n++});return n};assert.equal(count(),2,'no light is added');
 assert.equal(lights.lamps.length,5,'three road lamps and two city lamps');assert.equal(lights.buildings.length,3);assert.equal(masksMade.length,2,'one mask per distinct texture (houses share one, shops another)');
 for(const m of [r1,r2,police]){assert.equal(m.material.emissiveMap?.name,'glass-mask','each building got the mask as its emissive map');assert.equal(m.material.emissiveIntensity,0)}
 assert.notEqual(r1.material,r2.material);assert(!lights.sprites.castShadow&&!lights.ground.castShadow&&!lights.ground.material.depthWrite&&!lights.sprites.material.depthWrite);
 // the pools lie on the ground
 {const pos=lights.ground.geometry.attributes.position,per=1+LAMP.poolRings*LAMP.poolSegments;for(let i=0;i<5*per;i++)near(pos.getY(i),footing(pos.getX(i),pos.getZ(i))+LAMP.poolLift,1e-5,'a pool vertex sits just above the ground');
  near(pos.getX(per),30,1e-6,'the second pool is under the second lamp');assert.equal(lights.ground.geometry.drawRange.count,5*poolShape().indices.length,'only the pools are drawn while no vehicle is lit')}
 // noon: nothing shown, nothing changed
 let s=lights.update(.04,{sky:skyAt(720),high:true});
 assert.deepEqual({v:lights.sprites.visible,g:lights.ground.visible,calls:s.drawCalls,lit:s.windowsLit},{v:false,g:false,calls:0,lit:0},'by day the night lights cost no draw call');
 assert.equal(heads.material.emissiveIntensity,.55);assert.equal(cityLampHeads[0].material.emissiveIntensity,0);assert(cityWindows.every(w=>w.mesh.material===glass));
 // 20:00: lamps full, windows by the rule
 s=lights.update(.04,{sky:skyAt(clock(20)),high:true});
 assert.deepEqual({v:lights.sprites.visible,g:lights.ground.visible,calls:s.drawCalls},{v:true,g:true,calls:2},'at night: two draw calls, whatever the number of lamps, windows and vehicles');
 near(s.level,1,1e-9,'full night at 20:00');assert.equal(heads.material.emissiveIntensity,LAMP.headNight);assert.equal(cityLampHeads[0].material.emissiveIntensity,LAMP.headNight);assert.equal(cityLampHeads[0].material,cityLampHeads[1].material);
 assert.equal(r1.material.emissiveIntensity,0,'the vacant house stays dark');assert.equal(police.material.emissiveIntensity,WINDOW.strength,'the police station is lit');
 assert.equal(r2.material.emissiveIntensity,windowsLit('house-r2',clock(20))?WINDOW.strength:0,'a lived-in house follows the rule');
 {const litFlats=cityWindows.filter(w=>w.mesh.material.name==='city-window-lit').length;assert(litFlats>28&&litFlats<40,`most of the city's flats are lit at 20:00, not all (${litFlats} of 40)`);assert.equal(s.windowsLit,litFlats+1+(windowsLit('house-r2',clock(20))?1:0));
  assert.equal(new Set(cityWindows.map(w=>w.mesh.material)).size,2,'the flats share two materials: dark and lit')}
 s=lights.update(.04,{sky:skyAt(clock(20)),high:true,held:['house-r1']});assert.equal(r1.material.emissiveIntensity,windowsLit('house-r1',clock(20))?WINDOW.strength:0,'the house the player holds follows the rule too');
 s=lights.update(.04,{sky:skyAt(clock(3)),high:true});assert.equal(r2.material.emissiveIntensity,0);assert(cityWindows.every(w=>w.mesh.material===glass),'at 03:00 every flat is dark');assert.equal(police.material.emissiveIntensity,WINDOW.strength);assert.equal(s.windowsLit,1);
 // the dev slider
 lights.tune({scale:2});s=lights.update(.04,{sky:skyAt(clock(3))});assert.equal(police.material.emissiveIntensity,WINDOW.strength*2);assert.equal(lights.tune({scale:99}).scale,GLOW_SCALE_MAX);assert.equal(lights.tune({scale:null}).scale,1);
 // a vehicle in use at night: four sprites, one beam, and on High the player's gets the SpotLight
 const truck=new THREE.Group();truck.position.set(100,1,50);truck.rotation.order='YXZ';truck.rotation.y=Math.PI/2;scene.add(truck); // nose towards +x
 const own={key:'own',mesh:truck,model:'worktruck',use:'driver',mode:'auto',own:true},night=skyAt(clock(23)),lamps0=5;
 s=lights.update(.04,{sky:night,high:false,vehicles:[own]});
 assert.deepEqual({sprites:s.vehicleSprites,beams:s.beams,spot:s.spot,own:s.ownOn,calls:s.drawCalls},{sprites:4,beams:1,spot:false,own:true,calls:2},'Low: lamps and the beam on the ground, no SpotLight, still two draw calls');assert.equal(count(),2);
 assert.equal(lights.sprites.geometry.instanceCount,lamps0+4);assert.equal(lights.ground.geometry.drawRange.count,5*poolShape().indices.length+BEAM_INDICES);
 {const c=lights.sprites.geometry.attributes.aCentre,t=lights.sprites.geometry.attributes.aTint;near(c.getX(lamps0),100+CLASSES.worktruck.hz+.02,1e-4,'the headlamps are at the nose');near(c.getY(lamps0),1+VEHICLE_LAMPS.worktruck.front.y,1e-4,'at lamp height');assert(c.getX(lamps0+2)<100-2.9,'the tail lamps at the back');
  assert(t.getY(lamps0)>.5&&t.getY(lamps0+2)<.2&&t.getX(lamps0+2)>.5,'white in front, red behind');
  const pos=lights.ground.geometry.attributes.position,g0=5*(1+LAMP.poolRings*LAMP.poolSegments);for(let i=g0;i<g0+BEAM_VERTICES;i++){assert(pos.getX(i)>100+3,'the beam lies ahead of the truck');near(pos.getY(i),footing(pos.getX(i),pos.getZ(i))+LAMP.poolLift+.01,1e-5,'on the ground')}}
 s=lights.update(.04,{sky:night,high:true,vehicles:[own]});assert.equal(s.spot,true);assert.equal(count(),3,'High: ONE SpotLight is added');near(s.spotIntensity,SPOT.intensity,1e-6,'at full strength in full night');
 {const spot=scene.getObjectByName('player-headlight');assert(spot.isSpotLight&&!spot.castShadow);assert(spot.position.x>102.9&&spot.target.position.x>spot.position.x+10,'it sits at the nose and points ahead');assert(spot.target.position.y<spot.position.y,'slightly down')}
 s=lights.update(.04,{sky:night,high:true,vehicles:[{...own,mode:'off'}]});assert.deepEqual({sprites:s.vehicleSprites,spot:s.spot,i:s.spotIntensity,own:s.ownOn},{sprites:0,spot:true,i:0,own:false},'switched off: dark, the light stays in the scene at 0');assert.equal(count(),3);
 s=lights.update(.04,{sky:night,high:true,vehicles:[]});assert.equal(s.spot,true,'out of the vehicle at night: still in, at 0');assert.equal(s.spotIntensity,0);
 s=lights.update(.04,{sky:night,high:false,vehicles:[own]});assert.equal(s.spot,false,'dropping to Low takes it out');assert.equal(count(),2);
 s=lights.update(.04,{sky:night,high:true,vehicles:[own]});assert.equal(count(),3);s=lights.update(.04,{sky:skyAt(720),high:true,vehicles:[own]});
 assert.deepEqual({spot:s.spot,sprites:s.vehicleSprites,own:s.ownOn,calls:s.drawCalls},{spot:false,sprites:0,own:false,calls:0},'day takes it out too; on auto the lamps are off');assert.equal(count(),2);
 s=lights.update(.04,{sky:skyAt(720),high:true,vehicles:[{...own,mode:'on'}]});assert.deepEqual({spot:s.spot,sprites:s.vehicleSprites,own:s.ownOn,calls:s.drawCalls},{spot:false,sprites:4,own:true,calls:2},'switched on by day: lamps and beam, but the SpotLight is night-only');
 assert.equal(lights.sprites.material.uniforms.uLevel.value,0,'and the street lamps stay off');
 // parked is dark; a truck that only counts while it moves
 s=lights.update(.04,{sky:night,vehicles:[{key:'p',mesh:truck,model:'flatbed',use:'parked',mode:'on'}]});assert.equal(s.vehicleSprites,0,'a parked vehicle is dark');
 const npc={key:'npc',mesh:truck,model:'flatbed',use:'moving'};s=lights.update(.04,{sky:night,vehicles:[npc]});assert.equal(s.vehicleSprites,0,'standing still: dark');
 truck.position.x+=.4;s=lights.update(.04,{sky:night,vehicles:[npc]});assert.equal(s.vehicleSprites,4,'moving: lit');s=lights.update(MOVING_HOLD/2,{sky:night,vehicles:[npc]});assert.equal(s.vehicleSprites,4,'a short stop keeps them on');
 s=lights.update(MOVING_HOLD,{sky:night,vehicles:[npc]});assert.equal(s.vehicleSprites,0,'parked: off');
 // capacity: more vehicles than slots never overflows
 s=lights.update(.04,{sky:night,vehicles:Array.from({length:MAX_VEHICLES+3},(_,i)=>({key:'v'+i,mesh:truck,model:'offroad',use:'driver'}))});assert.equal(s.beams,MAX_VEHICLES);assert.equal(lights.sprites.geometry.instanceCount,lamps0+MAX_VEHICLES*4);assert.equal(s.drawCalls,2);
 // the cost in triangles: 40 lamps in the real game
 const tris=(40*poolShape().indices.length+MAX_VEHICLES*BEAM_INDICES)/3+(40+MAX_VEHICLES*4)*2;assert(tris<3000,`at most ${tris} triangles for every pool, beam and sprite in the real game`);
 // without a mask (Node, or a texture that would not decode) a building simply stays dark
 {const scene2=new THREE.Scene(),l=MAP.landmarks.find(x=>x.id==='house-r2'),mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());mesh.name='prop-'+l.prop;mesh.position.set(l.x,0,l.z);scene2.add(mesh);
  const bare=createNightLights({scene:scene2,makeMask:()=>{}}),st=bare.update(.04,{sky:skyAt(clock(20))});assert.equal(mesh.material.emissive.getHex(),0,'its material is not touched');assert.equal(mesh.material.emissiveMap,null);assert.equal(st.ready,0);assert.equal(st.lamps,0);assert.equal(st.drawCalls,2)}
}

// --- The packaged game ------------------------------------------------------------------------------------------------------
{const pick=MAP.vehicles.find(v=>v.id==='eastbank-worktruck'),door=doorPoint(pick.home,CLASSES.worktruck);
 const g=await bootGame({position:{x:door.x,z:door.z},progress:{cash:5000,completed:5,vehicles:[{uid:'v1',model:'worktruck',x:pick.home.x,z:pick.home.z,yaw:pick.home.yaw}],orders:{nextVehicle:2}}}),S=g.GameState;
 try{
  g.pump(1);const scene=g.scene(),sprites=scene.getObjectByName('night-sprites'),ground=scene.getObjectByName('night-ground'),heads=scene.getObjectByName('street-lamp-heads');
  assert(sprites&&ground&&heads,'the world scene has the night lights');
  const lights=()=>{let n=0;scene.traverse(o=>{if(o.isLight)n++});return n},objects=()=>{let n=0;scene.traverse(()=>n++);return n},at=m=>{S.progress.routine.minutes=m;g.pump(.2)};
  const flatsLit=()=>{let n=0;scene.traverse(o=>{if(o.material?.name==='city-window-lit')n++});return n},keys=()=>g.ids.get('vpKeys').children.map(r=>r.children.map(c=>c.textContent).join(' '));
  const press=code=>{g.send('keydown',code);g.send('keyup',code);g.pump(.3)};
  at(720);const noonObjects=objects();
  assert.deepEqual({s:sprites.visible,g:ground.visible},{s:false,g:false},'noon: the night lights are not drawn');near(heads.material.emissiveIntensity,.55,1e-9,'the lamp heads look as they did');assert.equal(flatsLit(),0);assert.equal(lights(),2);
  at(clock(20));
  assert.deepEqual({s:sprites.visible,g:ground.visible},{s:true,g:true},'20:00: sprites and ground patches are drawn (+2 draw calls)');near(heads.material.emissiveIntensity,LAMP.headNight,.01,'the lamp heads are bright');
  assert.equal(sprites.geometry.instanceCount,40,'34 street lamps and the 6 Oak Street lamps each have a halo');assert.equal(ground.geometry.drawRange.count,40*poolShape().indices.length,'and a pool');
  assert(flatsLit()>20,`the old city's flats are lit (${flatsLit()})`);assert.equal(lights(),2,'still two lights: nothing recompiles at dusk');assert.equal(objects(),noonObjects,'no object is added or removed between noon and 20:00');
  at(clock(3));assert.equal(flatsLit(),0,'03:00: every flat is dark');assert.equal(sprites.visible,true,'the lamps stay on all night');
  // get in at night (High is the default quality): the lamps come on by themselves, the panel shows the key, ONE SpotLight appears
  press('KeyE');assert.match(g.ids.get('vpName').textContent,/Worktruck/,'in the Worktruck');
  assert.deepEqual(keys().slice(-1),['L Lights: auto (on)'],'the vehicle panel: L, auto, on');assert.equal(sprites.geometry.instanceCount,44,'two headlamps and two tail lamps');assert.equal(ground.geometry.drawRange.count,40*poolShape().indices.length+BEAM_INDICES,'and the beam on the ground');
  assert.equal(lights(),3,'High: the one SpotLight');assert(scene.getObjectByName('player-headlight').intensity>0);
  press('KeyL');assert.deepEqual(keys().slice(-1),['L Lights: on']);assert.equal(sprites.geometry.instanceCount,44);
  press('KeyL');assert.deepEqual(keys().slice(-1),['L Lights: off']);assert.equal(sprites.geometry.instanceCount,40,'L again: off');assert.equal(lights(),3,'the SpotLight stays in the scene at 0 while it is dark');assert.equal(scene.getObjectByName('player-headlight').intensity,0);
  press('KeyL');assert.deepEqual(keys().slice(-1),['L Lights: auto (on)'],'and back to auto');
  // Low has no SpotLight; the lamps and the beam stay
  g.ids.get('quality').value='low';g.ids.get('quality').onchange();g.pump(.2);assert.equal(lights(),2,'Low: no SpotLight');assert.equal(sprites.geometry.instanceCount,44,'the glow stays');
  g.ids.get('quality').value='high';g.ids.get('quality').onchange();g.pump(.2);assert.equal(lights(),3);
  // by day: auto is off, the SpotLight leaves the scene; the switch still works
  at(720);assert.deepEqual(keys().slice(-1),['L Lights: auto (off)']);assert.equal(lights(),2,'day: the SpotLight is gone');assert.equal(sprites.visible,false);
  press('KeyL');assert.deepEqual(keys().slice(-1),['L Lights: on']);assert.equal(sprites.visible,true,'switched on by day');assert.equal(lights(),2,'but never the SpotLight by day');
  // get out: the vehicle is parked and dark, and the switch is back on auto for next time
  at(clock(22));press('KeyE');assert.equal(g.ids.get('vpName').textContent,'Not in a vehicle');assert.equal(sprites.geometry.instanceCount,40,'a parked vehicle is dark');
  press('KeyE');assert.deepEqual(keys().slice(-1),['L Lights: auto (on)'],'getting back in: auto again');
  assert.equal(S.progress.vehicles[0].lights,undefined,'the switch is not saved');
 }finally{await g.done()}
}
console.log('night lights tests passed');
