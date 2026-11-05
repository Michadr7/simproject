// "Your save" in the main menu's Settings: export the save to a file, import one, and restore a backup. The rules live in save-file.js.
// Replacing the save always backs up the current one first, then reloads the page (the caller's reload() must stop the game saving over it on the way out).
import {readStoredSave,makeSaveFile,saveFileName,readSaveFile,loadBackups,addBackup,replaceSave} from './save-file.js';

export const money=cents=>(cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
export const REASON_TEXT={'play':'when you pressed Play','before import':'before an import','before restore':'before a restore'};
const when=at=>new Date(at).toLocaleString(undefined,{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});

export function createSaveMenu({$,doc,storage,version,download,reload,now=()=>Date.now()}){
 const status=(text,kind='')=>{$('menuSaveStatus').textContent=text;$('menuSaveStatus').dataset.kind=kind};
 let pendingYes=null;
 const closeAsk=()=>{pendingYes=null;$('menuSaveConfirm').hidden=true};
 const ask=(text,yes)=>{pendingYes=yes;$('menuSaveConfirmText').textContent=text;$('menuSaveConfirm').hidden=false;status('')};
 $('menuSaveConfirmYes').onclick=()=>{const run=pendingYes;closeAsk();run?.()};
 $('menuSaveConfirmNo').onclick=()=>{closeAsk();status('Nothing was changed.')};
 const replace=(save,reason)=>{
  if(!replaceSave(storage,save,{reason,version,now:now()})){status('The browser would not store the save (storage may be full or blocked). Nothing was changed.','error');return}
  status('Loading…','ok');reload();
 };

 function refresh(){
  const has=!!readStoredSave(storage);
  $('menuExport').disabled=!has;
  const list=loadBackups(storage),box=$('menuBackups');
  const rows=list.map((b,i)=>{
   const row=doc.createElement('div');row.className='backup-row';
   const text=doc.createElement('span');text.textContent=`${when(b.at)} · ${b.save.profile.name||b.save.character?.name||'Unnamed'} · ${money(b.save.profile.progress.cash)}`;
   const sub=doc.createElement('small');sub.textContent=[REASON_TEXT[b.reason]||b.reason,b.game&&'v'+b.game].filter(Boolean).join(' · ');
   const button=doc.createElement('button');button.className='menu-button backup-restore';button.textContent='Restore';button.dataset.index=String(i);
   button.onclick=()=>ask(`Go back to the backup from ${when(b.at)} (${money(b.save.profile.progress.cash)})? Your current save is backed up first.`,()=>replace(b.save,'before restore'));
   text.append(sub);row.append(text,button);return row;
  });
  if(!rows.length){const none=doc.createElement('p');none.className='menu-help';none.textContent='No backups yet. One is made each time you press Play.';rows.push(none)}
  box.replaceChildren(...rows);
 }

 $('menuExport').onclick=()=>{
  const save=readStoredSave(storage);
  if(!save){status('There is no save yet: play first.','error');return}
  const file=makeSaveFile(save,{version,now:now()}),name=saveFileName(file);
  try{download(name,JSON.stringify(file,null,1))}catch{status('The browser blocked the download.','error');return}
  status(`Saved as ${name}. Keep it somewhere safe; Import loads it on any browser.`,'ok');
 };
 $('menuImport').onclick=()=>{closeAsk();$('menuImportFile').value='';$('menuImportFile').click()};
 $('menuImportFile').onchange=async()=>{
  const file=$('menuImportFile').files?.[0];if(!file)return;
  let text;try{text=await file.text()}catch{status('That file could not be read.','error');return}
  const read=readSaveFile(text);
  if(!read.ok){status(read.error,'error');return}
  const s=read.summary,from=[s.game&&'v'+s.game,s.savedAt&&when(Date.parse(s.savedAt))].filter(Boolean).join(', ');
  ask(`Replace your save with ${s.name} (${money(s.cash)}, day ${s.day} ${s.clock}${s.vehicles?`, ${s.vehicles} vehicle${s.vehicles>1?'s':''}`:''}${from?`; saved ${from}`:''})? Your current save is backed up first.`,()=>replace(read.save,'before import'));
 };

 // One backup per page load, when the player first enters the world: the save exactly as it was loaded.
 let backedUp=false;
 const backupOnPlay=()=>{if(backedUp)return;backedUp=true;addBackup(storage,{reason:'play',version,now:now()})};
 closeAsk();refresh();
 $('menuSettings')?.addEventListener?.('click',()=>{closeAsk();status('');refresh()}); // the list is redrawn each time Settings opens
 return {refresh,backupOnPlay};
}
