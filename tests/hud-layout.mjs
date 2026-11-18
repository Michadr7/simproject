// HUD right-column layout test: parses dist/index.html + dist/style.css to verify all JS-read IDs, docked top-to-bottom column order,
// large-map centering rule, safe-area & reduced-motion rules, and zero CSS box overlaps at 1920x1080, 1280x720, 1024x600, and 360x780.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../dist/style.css',import.meta.url),'utf8');

// 1. Every ID read by game.js, minimap.js, vehicle-hud.js, and scene-editor.js exists once in dist/index.html.
const REQUIRED_IDS=[
 'help','hudRight','minimapDock','streetChips','chipStreet','chipCross',
 'minimapCard','minimap','minimapNorth','minimapKey','minimapScale','minimapScaleText',
 'clockChip','statusDock','vehiclePanel','vpName','vpSpeed','vpSpeedBar','vpSpeedFill',
 'vpFuelLabel','vpFuel','vpFuelBar','vpFuelFill','vpDamage','vpLamp','vpDmgText',
 'vpDmgBar','vpDmgFill','vpStuck','vpGps','vpGpsArrow','vpGpsText','vpKeys','vpNote',
 'vitals','vitalFood','vitalFoodFill','vitalFoodValue','vitalThirst','vitalThirstFill',
 'vitalThirstValue','vitalEnergy','vitalEnergyFill','vitalEnergyValue'
];
for(const id of REQUIRED_IDS){
 const hits=html.match(new RegExp(`id="${id}"`,'g'))||[];
 assert.equal(hits.length,1,`expected exactly 1 #${id} in dist/index.html, found ${hits.length}`);
}

// 2. Right-column DOM order inside #hudRight: #minimapDock (#streetChips, #minimapCard, #clockChip) then #statusDock (#vehiclePanel, #vitals).
const hudSlice=html.slice(html.indexOf('id="hudRight"'));
const order=['hudRight','minimapDock','streetChips','chipStreet','chipCross','minimapCard','minimap','minimapNorth','minimapKey','minimapScale','clockChip','statusDock','vehiclePanel','vitals'];
let prevPos=-1;
for(const id of order){
 const pos=hudSlice.indexOf(`id="${id}"`);
 assert(pos>prevPos,`#${id} must appear after previous right-column element inside #hudRight`);
 prevPos=pos;
}
assert(html.indexOf('id="clockChip"')>html.indexOf('id="minimapCard"')&&html.indexOf('id="clockChip"')<html.indexOf('id="statusDock"'),'#clockChip is docked inside #minimapDock directly after #minimapCard');

// 3. CSS structural checks: no stale fixed top/bottom overrides on #clockChip/#statusDock/#minimap(small); large-map rule intact; safe-area + reduced motion.
assert(!/#clockChip\{[^}]*(top:\s*(200|305|176|246)px|position:\s*fixed)/.test(css),'#clockChip must not use stale fixed top coordinates');
assert(!/#statusDock\{[^}]*position:\s*fixed/.test(css),'#statusDock flows inside #hudRight rather than fixed bottom');
assert(/\.hud-right\{[^}]*position:\s*fixed[^}]*flex-direction:\s*column[^}]*align-items:\s*flex-end/.test(css),'.hud-right is the single fixed right-hand column');
assert(/\.hud-right\{[^}]*env\(safe-area-inset-top[^}]*env\(safe-area-inset-right/.test(css),'safe-area insets applied on #hudRight');
assert(/@media\(prefers-reduced-motion:reduce\)\{[^}]*#minimap[^}]*\.vehicle-panel[^}]*transition:\s*none/.test(css),'prefers-reduced-motion disables HUD transitions');
assert(/\.gps-card\{[^}]*border-radius:\s*16px/.test(css),'map card uses 16px rounded corners');
assert(!/\.gps-card\{[^}]*(backdrop-filter|transform:|filter:)/.test(css),'.gps-card has no backdrop-filter/transform that would trap fixed #minimap.large');
assert(/\.gps-card #minimap\.large\{[^}]*position:\s*fixed;[^}]*right:\s*50%;[^}]*bottom:\s*50%;[^}]*transform:\s*translate\(50%,50%\);[^}]*z-index:\s*60/.test(css),'large-map rule centres #minimap.large over everything');
// 4. Parse CSS custom properties & box metrics from dist/style.css and assert zero overlaps across the 4 viewport sizes.
const num=(re,src,fallback)=>{const m=src.match(re);return m?Number(m[1]):fallback};
const block=(marker,src=css)=>{const i=src.indexOf(marker);assert(i>=0,'missing CSS marker: '+marker);let depth=0,start=-1;for(let k=i;k<src.length;k++){if(src[k]==='{'){if(depth===0)start=k+1;depth++}else if(src[k]==='}'){depth--;if(depth===0)return src.slice(start,k)}}throw Error('unclosed CSS block: '+marker)};

const hudCss=css.slice(css.indexOf('/* HUD restyle'));
const baseHud=block('.hud-right{',hudCss);
const media760=block('@media(max-height:760px){',hudCss);
const media680=block('@media(max-height:680px){',hudCss);
const media600=block('@media(max-width:600px){',hudCss);
const media600_680=block('@media(max-width:600px) and (max-height:680px){',hudCss);
assert(/\.gps-card #minimap\.large\{transform:\s*translate\(50%,50%\) scale\(\.5\)\}/.test(media600),'large-map rule scales cleanly on narrow screens');
const headerCss=block('header{');
const headerMobCss=block('header{',block('@media(max-width:700px){'));
const footerCss=block('footer{');
const footerMobCss=block('footer{',block('@media(max-width:700px){'));
const mobileCss=block('#mobile{',block('@media(max-width:700px){'));

const parseVars=src=>({
 top:num(/--hud-top:\s*([\d.]+)px/,src),
 right:num(/--hud-right:\s*([\d.]+)px/,src),
 gap:num(/--hud-gap:\s*([\d.]+)px/,src),
 dockGap:num(/--hud-dock-gap:\s*([\d.]+)px/,src),
 colW:num(/--hud-col-w:\s*([\d.]+)px/,src),
 mapSize:num(/--hud-map-size:\s*([\d.]+)px/,src)
});

function varsFor(w,h){
 const v=parseVars(baseHud);
 const apply=s=>{for(const [k,val] of Object.entries(parseVars(s)))if(Number.isFinite(val))v[k]=val};
 if(h<=760)apply(media760);
 if(h<=680)apply(media680);
 if(w<=600)apply(media600);
 if(w<=600&&h<=680)apply(media600_680);
 return v;
}

const VIEWPORTS=[
 {name:'1920x1080',w:1920,h:1080},
 {name:'1280x720', w:1280,h:720},
 {name:'1024x600', w:1024,h:600},
 {name:'360x780',  w:360, h:780}
];

for(const vp of VIEWPORTS){
 const v=varsFor(vp.w,vp.h);
 const mobile=vp.w<=700,narrow=vp.w<=600,short760=vp.h<=760,short680=vp.h<=680;
 const hdrTop=num(/top:\s*([\d.]+)px/,mobile?headerMobCss:headerCss);
 const hdrRight=num(/right:\s*([\d.]+)px/,mobile?headerMobCss:headerCss);
 const helpH=vp.w<=400?36:40,helpW=vp.w<=400?68:90;
 const helpBox={x0:vp.w-hdrRight-helpW,y0:hdrTop,x1:vp.w-hdrRight,y1:hdrTop+helpH};

 // Conservative upper-bound heights matching the CSS padding/font/bar rules in driving mode (tallest state).
 const chipsH=narrow?16:18,chipsW=narrow?141:151;
 const cardSize=v.mapSize+2; // 1px top/bottom/left/right border on .gps-card
 const clockH=24,clockW=109;
 const vpH=short680?204:short760?232:narrow?232:248;
 const vitalsH=short680?66:short760?72:narrow?72:80;

 const rx1=vp.w-v.right;
 let y=v.top;
 const boxes=[];
 const push=(id,width,height,gapAfter)=>{
  const b={id,x0:rx1-width,y0:y,x1:rx1,y1:y+height};
  boxes.push(b);
  y=b.y1+gapAfter;
  return b;
 };
 const chips=push('streetChips',chipsW,chipsH,v.dockGap);
 const card=push('minimapCard',cardSize,cardSize,v.dockGap);
 const clock=push('clockChip',clockW,clockH,v.gap);
 const veh=push('vehiclePanel',v.colW,vpH,v.gap);
 const vitals=push('vitals',v.colW,vitalsH,0);

 // Must clear top-right Menu button.
 assert(chips.y0>helpBox.y1,`${vp.name}: #streetChips (${chips.y0}) must sit below #help (${helpBox.y1})`);

 // Clock pill must sit strictly below the map card and align with its right edge.
 assert(clock.y0>=card.y1+v.dockGap-0.01,`${vp.name}: #clockChip (${clock.y0}) must sit below #minimapCard (${card.y1})`);
 assert.equal(clock.x1,card.x1,`${vp.name}: #clockChip right-aligned with #minimapCard`);

 // No two right-column boxes may overlap and all stay inside the viewport.
 for(let i=0;i<boxes.length;i++){
  const a=boxes[i];
  assert(a.x0>=0&&a.x1<=vp.w&&a.y0>=0&&a.y1<=vp.h,`${vp.name}: #${a.id} (${JSON.stringify(a)}) inside viewport`);
  for(let j=i+1;j<boxes.length;j++){
   const b=boxes[j];
   const xOverlap=a.x0<b.x1&&b.x0<a.x1,yOverlap=a.y0<b.y1&&b.y0<a.y1;
   assert(!(xOverlap&&yOverlap),`${vp.name}: #${a.id} overlaps #${b.id}`);
   assert(a.y1<b.y0,`${vp.name}: #${a.id} (${a.y1}) above #${b.id} (${b.y0})`);
  }
 }

 // Must clear bottom-right footer (#fps) or mobile #touchE button.
 const ftBottom=num(/bottom:\s*([\d.]+)px/,mobile?footerMobCss:footerCss);
 const touchBottom=mobile?num(/bottom:\s*([\d.]+)px/,mobileCss):0;
 const bottomLimit=mobile?vp.h-(touchBottom+58):vp.h-(ftBottom+20);
 assert(vitals.y1<=bottomLimit,`${vp.name}: #vitals bottom (${vitals.y1}) clears bottom HUD (${bottomLimit})`);
}

console.log('PASS hud-layout.mjs: right-column DOM order, all required JS IDs, large-map centering, safe-area & reduced-motion rules, and zero box overlaps at 1920x1080, 1280x720, 1024x600, and 360x780.');
