import assert from 'node:assert/strict';
import {createSaveMenu,money} from '../dist/save-menu.js';
import {writeStoredSave,readStoredSave,loadBackups,makeSaveFile,BACKUPS_KEY} from '../dist/save-file.js';

class El{constructor(tag='div'){this.tag=tag;this.hidden=false;this.disabled=false;this.value='';this.textContent='';this.dataset={};this.children=[];this.className=''}append(...c){this.children.push(...c)}replaceChildren(...c){this.children=c}click(){this.onclick?.()}}
const memory=()=>{const m=new Map();return {m,getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
const player=(cash,name='Ada')=>({profile:{playerId:'p1',name,progress:{cash}},character:{name}});
function build({storage=memory(),clock=1_700_000_000_000}={}){
 const els=new Map(),$=id=>els.get(id)??els.set(id,new El()).get(id);
 const log=[];let t=clock;
 const menu=createSaveMenu({$,doc:{createElement:tag=>new El(tag)},storage,version:'0.34.3',download:(name,text)=>log.push(['download',name,text]),reload:()=>log.push('reload'),now:()=>t});
 return {els,$,storage,log,menu,tick:ms=>{t+=ms},rows:()=>$('menuBackups').children.filter(c=>c.className==='backup-row')};
}
const pickFile=async(t,text)=>{t.$('menuImportFile').files=[{text:async()=>text}];await t.$('menuImportFile').onchange()};

// No save yet: export is off, the backup list says how backups happen, Play makes none
{const t=build();assert(t.$('menuExport').disabled);assert.match(t.$('menuBackups').children[0].textContent,/No backups yet/);assert(t.$('menuSaveConfirm').hidden);
 t.$('menuExport').click();assert.equal(t.log.length,0);assert.match(t.$('menuSaveStatus').textContent,/no save yet/);
 t.menu.backupOnPlay();assert.equal(loadBackups(t.storage).length,0);}

// Export downloads a save file named after the player
{const s=memory();writeStoredSave(s,player(12345));const t=build({storage:s});
 assert(!t.$('menuExport').disabled);t.$('menuExport').click();
 const [kind,name,text]=t.log[0];assert.equal(kind,'download');assert.match(name,/^citylife-ada-\d{4}-\d\d-\d\d\.json$/);
 const file=JSON.parse(text);assert.equal(file.format,'citylife-save');assert.equal(file.game,'0.34.3');assert.equal(file.profile.progress.cash,12345);
 assert.match(t.$('menuSaveStatus').textContent,/Saved as citylife-ada/);}

// Backup on Play: once per page load
{const s=memory();writeStoredSave(s,player(1));const t=build({storage:s});
 t.menu.backupOnPlay();writeStoredSave(s,player(2));t.menu.backupOnPlay();
 const b=loadBackups(s);assert.equal(b.length,1,'only the first Play of a page load');assert.equal(b[0].reason,'play');assert.equal(b[0].game,'0.34.3');assert.equal(b[0].save.profile.progress.cash,1);}

// Import: a bad file says why and changes nothing; a good one asks first, Cancel keeps everything, Replace backs up, writes and reloads
{const s=memory();writeStoredSave(s,player(100,'Old'));const t=build({storage:s});
 await pickFile(t,'{"format":"nope"}');assert.equal(t.$('menuSaveStatus').dataset.kind,'error');assert(t.$('menuSaveConfirm').hidden);
 const good=JSON.stringify(makeSaveFile(player(250000,'New'),{version:'0.34.3',now:Date.UTC(2026,10,1)}));
 await pickFile(t,good);assert(!t.$('menuSaveConfirm').hidden,'asks before replacing');
 assert.match(t.$('menuSaveConfirmText').textContent,/Replace your save with New \(\$2,500\.00, day 1 9:00 AM; saved v0\.34\.3, /);
 t.$('menuSaveConfirmNo').click();assert(t.$('menuSaveConfirm').hidden);assert.equal(readStoredSave(s).profile.name,'Old');assert.equal(t.log.length,0);
 await pickFile(t,good);t.$('menuSaveConfirmYes').click();
 assert.equal(readStoredSave(s).profile.name,'New');assert.equal(readStoredSave(s).profile.progress.cash,250000);assert.deepEqual(t.log,['reload']);
 const b=loadBackups(s)[0];assert.equal(b.reason,'before import');assert.equal(b.save.profile.name,'Old');}

// Restore: the list shows each backup; Restore asks, then brings it back (backing up the current save) and reloads
{const s=memory();writeStoredSave(s,player(100,'First'));addPlay(s,1);writeStoredSave(s,player(200,'Second'));addPlay(s,2);
 function addPlay(st,i){const t=build({storage:st,clock:1_700_000_000_000+i*60_000});t.menu.backupOnPlay()}
 writeStoredSave(s,player(300,'Now'));const t=build({storage:s});
 const rows=t.rows();assert.equal(rows.length,2);assert.match(rows[0].children[0].textContent,/Second · \$2\.00/);assert.match(rows[1].children[0].textContent,/First · \$1\.00/);
 assert.match(rows[0].children[0].children[0].textContent,/when you pressed Play · v0\.34\.3/);
 rows[1].children[1].click();assert.match(t.$('menuSaveConfirmText').textContent,/Go back to the backup from .*\(\$1\.00\)/);
 t.$('menuSaveConfirmYes').click();assert.equal(readStoredSave(s).profile.name,'First');assert.deepEqual(t.log,['reload']);
 assert.equal(loadBackups(s)[0].save.profile.name,'Now','the save that was replaced is kept as the newest backup');}

// Storage that refuses the write: nothing changes, no reload, a clear message
{const s=memory();writeStoredSave(s,player(5,'Kept'));const t=build({storage:s});
 const good=JSON.stringify(makeSaveFile(player(9,'Other'),{version:'0.34.3'}));await pickFile(t,good);
 s.setItem=(k,v)=>{if(k!==BACKUPS_KEY)throw new Error('QuotaExceeded');s.m.set(k,v)};
 t.$('menuSaveConfirmYes').click();assert.equal(t.$('menuSaveStatus').dataset.kind,'error');assert.match(t.$('menuSaveStatus').textContent,/would not store/);assert.equal(t.log.length,0,'no reload');assert.equal(readStoredSave(s).profile.name,'Kept');}

// Half a write is undone: the character key refuses, the profile goes back to what it was
{const s=memory();writeStoredSave(s,player(5,'Kept'));const before=s.m.get('citylife.profile.v1');const set=s.setItem;s.setItem=(k,v)=>{if(k==='citylife.character.v1')throw new Error('Quota');set(k,v)};
 assert.equal(writeStoredSave(s,player(9,'Other')),false);assert.equal(s.m.get('citylife.profile.v1'),before,'profile rolled back');assert.equal(readStoredSave(s).character.name,'Kept');}
assert.equal(money(123456),'$1,234.56');assert.equal(money(0),'$0.00');
console.log('Save menu: export off without a save, export downloads a named file, one backup per Play, import refuses bad files, asks first, Cancel changes nothing, Replace backs up then reloads, the backup list and Restore, a refused write changes nothing.');
