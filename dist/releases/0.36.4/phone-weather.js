// Phone Weather app: live conditions, comfort readout, and 3-day forecast.
import {WEATHER_META,CLOTHING_PROTECTION} from './weather.js';
import {weekday} from './housing.js';

const cToF=c=>Math.round(c*9/5+32);

export function createPhoneWeather({document:doc,getWeather}){
 const el=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};

 function render(){
  const root=doc.getElementById('phoneWeather');
  if(!root)return;
  const data=getWeather?.();
  if(!data){root.replaceChildren(el('p','phone-subtitle','Weather station warming up…'));return}
  const {base,local,comfort,effects,shelter,jacketId,groundWet,forecast,advice}=data;
  const w=local||base;

  const hero=el('article','phone-balance-card pw-hero');
  const reg=el('span','pw-region',`${w.region||'Ironwood Valley'} · ${weekday(base.day)} Day ${base.day}`);
  const row=el('div','pw-top');
  row.append(el('span','pw-icon',w.icon||'☀'),el('strong','pw-temp',`${Math.round(w.tempC)}°C / ${cToF(w.tempC)}°F`));
  const meta=el('small','pw-meta',`${w.label} · Wind ${w.windMs.toFixed(1)} m/s · Road wet ${Math.round((groundWet||0)*100)}%`);
  const road=el('small','pw-road',w.snowCover>.25?'Mountain chill & snowy air: dress warm and take bends carefully.':w.roadNote);
  hero.append(reg,row,meta,road);

  const cCard=el('article','phone-contract pw-comfort');
  const cHead=el('div','pw-chead');
  cHead.append(el('h3',null,`Comfort · ${Math.round(comfort.value)} / 100`));
  const badge=el('span','pw-band',effects.label);
  badge.dataset.band=effects.band;
  cHead.append(badge);
  const meter=doc.createElement('meter');
  meter.min=0;meter.max=100;meter.value=comfort.value;
  const gearName=CLOTHING_PROTECTION[jacketId]?.label||'No jacket';
  const coverName=shelter.indoors?'Indoors':shelter.nearCampfire?'Campfire':shelter.inCab?'Vehicle cab':shelter.underAwning?'Awning cover':shelter.openVehicle?'Open vehicle':'Outdoors';
  const cStats=el('p','phone-home-status',`Soak ${Math.round(comfort.soak*100)}% · Gear: ${gearName} · Shelter: ${coverName}`);
  const cTip=el('p','pw-tip',advice||'Conditions feel comfortable.');
  cCard.append(cHead,meter,cStats,cTip);

  const fTitle=el('h4','phone-heading','3-Day Valley & Pass Forecast');
  const fList=el('div','pw-forecast');
  for(const d of forecast||[]){
   const card=el('article','phone-contract pw-day');
   const mW=WEATHER_META[d.morning],aW=WEATHER_META[d.afternoon],eW=WEATHER_META[d.evening];
   const head=el('div','pw-dayhead');
   head.append(el('b',null,`${weekday(d.day)} · Day ${d.day}`),el('span',null,`${mW.icon}→${aW.icon}→${eW.icon}`));
   const temps=el('p','pw-temps',`Valley ${d.valleyLowC}..${d.valleyHighC}°C · Blackstone Pass ${d.passLowC}..${d.passHighC}°C`);
   const note=el('p','phone-home-status',`${d.advisory}${d.stormRisk!=='None'?' · Storm risk: '+d.stormRisk:''}${d.snowPass?' · ❄️ Pass snow':''}`);
   card.append(head,temps,note);
   fList.append(card);
  }

  root.replaceChildren(hero,cCard,fTitle,fList);
 }

 return {render};
}
