// Hub v2 V4: the asset record rules (pure)

// A record is one change to assets-register.json that the hub applied without a model call: {id, at, by: 'you'|'master', op: 'asset-add'|'asset-stage'|'asset-file', before, after}.
// `before` and `after` are whole register rows (null before for an add), so applying, undoing and "did the row change since?" are plain comparisons.
// Everything a person or the master can type goes through validateAdd and validateStage, so the form, the routes and the master's RECORD: lines share one set of limits.
// Nothing here reads a file or calls a model. A record can never set `converted` or `in-game`: only the wanted, received, staged and retired stages are accepted.
import {KINDS,HAND_STAGES,REGISTER_STAGES} from './assets.js';

export const MAX_NAME=80,MAX_SOURCE=300,MAX_LICENCE=80,MAX_NOTE=300,MAX_PER_REPLY=6,MAX_LINE=600,MAX_ROWS=2000;
export const ADD_STAGES=HAND_STAGES,MOVE_STAGES=REGISTER_STAGES,OPS=Object.freeze(['asset-add','asset-stage','asset-file']),BYS=Object.freeze(['you','master']);
export const ADD_KEYS=Object.freeze(['name','kind','source','licence','stage','note']),STAGE_KEYS=Object.freeze(['id','stage']),FILE_KEYS=Object.freeze(['id','file']);
// Hub v2 V4b: asset-file attaches a file that is in assets-src/ (a path under it, forward slashes) to a row's `files`; a wanted row becomes received in the same change.
export const MAX_FILE=300,MAX_FILES=20,FILE_EXT=/\.(glb|gltf|fbx|obj|wav|mp3|ogg)$/i;
export const ID_PATTERN=/^[a-z0-9][a-z0-9-]{0,59}$/,RECORD_ID=/^rec-[0-9a-z]{6,10}-[0-9a-f]{4,8}$/;
// ids the shipped (module) rows already use without a colon: a new row may not take them
const RESERVED=Object.freeze(['forklift','flatbed','water-cooler']);
// control characters, line and paragraph separators, zero-width and bidirectional marks, the byte order mark
// Review fix: by Unicode category (controls, format characters such as zero-width, bidi and tag characters, lone surrogates, private use, unassigned) plus variation selectors and the line separators.
export const CONTROL=new RegExp('[\\p{Cc}\\p{Cf}\\p{Cs}\\p{Co}\\p{Cn}\\u2028\\u2029\\ufe00-\\ufe0f]','u');

const bad=(error,code=400)=>({error,code});
const isPlain=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
function text(v,label,max,min=0){
 if(typeof v!=='string')return bad(`${label} must be text`);
 if(CONTROL.test(v))return bad(`${label} may not contain control characters`);
 const t=v.trim();
 if(t.length<min)return bad(`${label} is required`);
 if(t.length>max)return bad(`${label} is at most ${max} characters`);
 return {value:t}}
// '' or a web link: http or https, no spaces, no name or password in it. A file path, a javascript: link or a data: link is refused.
export function linkProblem(v){
 if(v==='')return null;
 if(v.length>MAX_SOURCE)return `source is at most ${MAX_SOURCE} characters`;
 if(!/^https?:\/\/[^\s/]/i.test(v)||/\s/.test(v))return 'source must be a web link that starts with http:// or https://, or empty';
 let u;try{u=new URL(v)}catch{return 'source must be a web link that starts with http:// or https://, or empty'}
 if(u.protocol!=='http:'&&u.protocol!=='https:')return 'source must be a web link that starts with http:// or https://, or empty';
 if(u.username||u.password)return 'source may not hold a name or password';
 const host=u.hostname.toLowerCase().replace(/^\[|\]$/g,'');
 if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')||host==='::1'||host==='::'||/^(fc|fd|fe80)/.test(host)||/^(0|10|127)\./.test(host)||/^192\.168\./.test(host)||/^169\.254\./.test(host)||/^172\.(1[6-9]|2\d|3[01])\./.test(host))return 'source may not point at this PC or a private network';
 return null}
const unknown=(o,allowed)=>Object.keys(o).filter(k=>!allowed.includes(k));

// {value:{name,kind,source,licence,stage,note}} or {error,code:400}. Unknown fields (a "__proto__" or "constructor" key among them) are refused, not ignored.
export function validateAdd(input){
 if(!isPlain(input))return bad('The asset must be an object');
 const extra=unknown(input,ADD_KEYS);if(extra.length)return bad(`Unknown field: ${JSON.stringify(extra[0]).slice(0,40)}`);
 const n=text(input.name,'name',MAX_NAME,1);if(n.error)return n;
 if(/[\\/]/.test(n.value)||n.value.startsWith('.'))return bad('name may not contain / or \\ or start with a dot (it is a name, not a path)');
 if(!/[\p{L}\p{N}]/u.test(n.value))return bad('name needs at least one letter or digit');
 if(typeof input.kind!=='string'||!KINDS.includes(input.kind))return bad(`kind must be one of: ${KINDS.join(', ')}`);
 const stage=input.stage===undefined?'wanted':input.stage;
 if(typeof stage!=='string'||!ADD_STAGES.includes(stage))return bad(`stage must be one of: ${ADD_STAGES.join(', ')}`);
 const src=text(input.source===undefined?'':input.source,'source',MAX_SOURCE);if(src.error)return src;
 const lp=linkProblem(src.value);if(lp)return bad(lp);
 const lic=text(input.licence===undefined?'':input.licence,'licence',MAX_LICENCE);if(lic.error)return lic;
 const note=text(input.note===undefined?'':input.note,'note',MAX_NOTE);if(note.error)return note;
 return {value:{name:n.value,kind:input.kind,source:src.value,licence:lic.value,stage,note:note.value}}}
// {value:{id,stage}} or {error,code:400}. Only wanted, received, staged and retired: converted and in-game are decided by the game's own modules.
export function validateStage(input){
 if(!isPlain(input))return bad('The move must be an object');
 const extra=unknown(input,STAGE_KEYS);if(extra.length)return bad(`Unknown field: ${JSON.stringify(extra[0]).slice(0,40)}`);
 if(typeof input.id!=='string'||!ID_PATTERN.test(input.id))return bad('id must be an asset id');
 if(typeof input.stage!=='string'||!MOVE_STAGES.includes(input.stage))return bad(`stage must be one of: ${MOVE_STAGES.join(', ')}`);
 return {value:{id:input.id,stage:input.stage}}}

// A path under assets-src/: forward slashes, no empty, "." or ".." part, no drive letter or leading slash, no control characters, a model or sound extension. Returns the problem or null.
export function filePathProblem(v){
 if(typeof v!=='string')return 'file must be text';
 if(CONTROL.test(v))return 'file may not contain control characters';
 if(v.length<3||v.length>MAX_FILE)return `file must be 3 to ${MAX_FILE} characters`;
 if(/[\\:*?"<>|]/.test(v)||v.startsWith('/')||v!==v.trim())return 'file must be a path under assets-src/ with forward slashes';
 if(v.split('/').some(p=>p===''||p==='.'||p==='..'||p!==p.trim()||p.endsWith('.')))return 'file must be a path under assets-src/ with no empty, . or .. part';
 if(!FILE_EXT.test(v))return 'file must be a model or sound file (glb, gltf, fbx, obj, wav, mp3, ogg)';
 return null}
// {value:{id,file}} or {error,code:400}
export function validateFile(input){
 if(!isPlain(input))return bad('The attachment must be an object');
 const extra=unknown(input,FILE_KEYS);if(extra.length)return bad(`Unknown field: ${JSON.stringify(extra[0]).slice(0,40)}`);
 if(typeof input.id!=='string'||!ID_PATTERN.test(input.id))return bad('id must be an asset id');
 const p=filePathProblem(input.file);if(p)return bad(p);
 return {value:{id:input.id,file:input.file}}}

export function slugOf(name){return String(name).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40).replace(/-+$/,'')}
export function newId(name,taken){
 const base=slugOf(name)||'asset';let id=base,n=2;
 while(taken.has(id)||RESERVED.includes(id)){id=`${base.slice(0,36)}-${n++}`}
 return id}

// A stable text of a row (keys sorted) so two rows compare equal whatever their key order.
export const canon=v=>JSON.stringify(v,(k,x)=>isPlain(x)?Object.fromEntries(Object.keys(x).sort().map(key=>[key,x[key]])):x);
export const sameRow=(a,b)=>canon(a)===canon(b);
// A register row the hub may change: an entry with an id, and not a pack entry (`covers`), which describes shipped assets.
export const rowOf=(register,id)=>(register.assets||[]).find(r=>isPlain(r)&&r.id===id&&!r.covers)||null;
export const handRows=register=>(register.assets||[]).filter(r=>isPlain(r)&&typeof r.id==='string'&&!r.covers&&REGISTER_STAGES.includes(r.stage));

// The new register row, in the key order the existing rows use so the diff stays small.
export const newEntry=(v,id)=>({id,name:v.name,kind:v.kind,stage:v.stage,source:v.source,licence:v.licence,credit:'',plannedUse:'',files:[],notes:v.note,pack:'Added in the hub'});

// Builds the change for an op without touching anything. `input` is the raw request or RECORD fields; `id` is the record id the caller made.
// `reserved`: ids of the shipped rows (from the game's modules) a new row may not take.
// `originals`: the file paths really under assets-src/ (names only), or null when that list has not been read: an attach is then refused. A file may be attached once, to one row.
export function makeChange({op,input,register,by,at,id,reserved=[],originals=null}){
 if(!BYS.includes(by)||!OPS.includes(op))return bad('Unknown record');
 const rows=register.assets||[];
 if(op==='asset-add'){
  const v=validateAdd(input);if(v.error)return v;
  if(rows.length>=MAX_ROWS)return bad('The register is full',409);
  const low=v.value.name.toLowerCase();
  if(rows.some(r=>isPlain(r)&&typeof r.name==='string'&&r.name.toLowerCase()===low))return bad(`A row called "${v.value.name}" already exists`,409);
  const taken=new Set([...rows.map(r=>isPlain(r)?r.id:null),...reserved]);
  const entry=newEntry(v.value,newId(v.value.name,taken));
  return {change:{id,at,by,op,before:null,after:entry}}}
 if(op==='asset-file'){
  const v=validateFile(input);if(v.error)return v;
  const row=rowOf(register,v.value.id);
  if(!row)return bad('No asset with that id in the register',404);
  if(!HAND_STAGES.includes(row.stage))return bad(`"${row.name}" is ${row.stage}; a file can only be attached to a wanted, received or staged row`,409);
  if(!Array.isArray(originals))return bad('The list of files in assets-src/ has not been read yet. Try again in a moment.',409);
  if(!originals.includes(v.value.file))return bad('That file is not in assets-src/ (the list is read once a minute)',404);
  const owner=rows.find(r=>isPlain(r)&&Array.isArray(r.files)&&r.files.includes(v.value.file));
  if(owner)return bad(`That file is already attached to "${owner.name}"`,409);
  const files=Array.isArray(row.files)?row.files:[];
  if(files.length>=MAX_FILES)return bad(`"${row.name}" already has ${MAX_FILES} files`,409);
  return {change:{id,at,by,op,before:row,after:{...row,files:[...files,v.value.file],stage:row.stage==='wanted'?'received':row.stage}}}}
 const v=validateStage(input);if(v.error)return v;
 const row=rowOf(register,v.value.id);
 if(!row)return bad('No asset with that id in the register',404);
 if(!REGISTER_STAGES.includes(row.stage))return bad(`"${row.name}" is ${row.stage}; only the game's modules change that`,409);
 if(row.stage===v.value.stage)return bad(`"${row.name}" is already ${row.stage}`,409);
 return {change:{id,at,by,op,before:row,after:{...row,stage:v.value.stage}}}}

// The shape of a stored change; a bad line in the log is skipped, never applied.
export function checkChange(c){
 if(!isPlain(c)||!OPS.includes(c.op)||!BYS.includes(c.by)||typeof c.id!=='string'||!RECORD_ID.test(c.id)||!Number.isFinite(c.at))return false;
 const ok=r=>isPlain(r)&&typeof r.id==='string'&&ID_PATTERN.test(r.id)&&typeof r.name==='string'&&REGISTER_STAGES.includes(r.stage)&&!r.covers;
 if(!ok(c.after))return false;
 // Review fix: a stored add must look like a row the hub makes, and a stored move may differ from its `before` in `stage` only, so a forged log line cannot delete or write any other row
 if(c.op==='asset-add')return c.before===null&&c.after.pack==='Added in the hub'&&Array.isArray(c.after.files)&&c.after.files.length===0&&c.after.credit===''&&c.after.plannedUse==='';
 if(!ok(c.before)||c.before.id!==c.after.id)return false;
 if(c.op==='asset-file'){ // the row gains exactly one file at the end (and a wanted row becomes received); nothing else differs
  const bf=Array.isArray(c.before.files)?c.before.files:null,af=Array.isArray(c.after.files)?c.after.files:null;
  if(!bf||!af||af.length!==bf.length+1||af.length>MAX_FILES||!bf.every((f,k)=>af[k]===f)||filePathProblem(af[af.length-1]))return false;
  if(!(c.after.stage===c.before.stage||c.before.stage==='wanted'&&c.after.stage==='received')||!HAND_STAGES.includes(c.before.stage))return false;
  return sameRow({...c.before,stage:0,files:0},{...c.after,stage:0,files:0})}
 return sameRow({...c.before,stage:0},{...c.after,stage:0})&&c.before.stage!==c.after.stage}

const conflict=why=>bad(why,409);
const replaceAt=(register,i,row)=>({...register,assets:register.assets.map((r,k)=>k===i?row:r)});
const indexOf=(register,id)=>(register.assets||[]).findIndex(r=>isPlain(r)&&r.id===id);
// {register} (a new object; the old one is not touched) or {error,code:409}.
export function applyRecord(register,change){
 if(!checkChange(change))return bad('That record is not valid',400);
 const i=indexOf(register,change.after.id);
 if(change.op==='asset-add')return i>=0?conflict('A row with that id already exists'):{register:{...register,assets:[...register.assets,change.after]}};
 if(i<0)return conflict('That row is no longer in the register');
 return sameRow(register.assets[i],change.before)?{register:replaceAt(register,i,change.after)}:conflict('That row changed, so the move was not made')}
export function undoRecord(register,change){
 if(!checkChange(change))return bad('That record is not valid',400);
 const i=indexOf(register,change.after.id);
 if(i<0||!sameRow(register.assets[i],change.after))return conflict('That row changed after the record, so it cannot be undone from here');
 return change.op==='asset-add'?{register:{...register,assets:register.assets.filter((r,k)=>k!==i)}}:{register:replaceAt(register,i,change.before)}}

// The register as text, in the layout the file already has: the top keys pretty-printed with two spaces, each asset on one line. The test pins that the real file round-trips.
export function formatRegister(register){
 const parts=Object.keys(register).map(k=>{
  const v=register[k];
  if(k==='assets'&&Array.isArray(v))return v.length?`  "assets": [\n${v.map(e=>'    '+JSON.stringify(e)).join(',\n')}\n  ]`:'  "assets": []';
  return `  ${JSON.stringify(k)}: ${JSON.stringify(v,null,2).replace(/\n/g,'\n  ')}`});
 return `{\n${parts.join(',\n')}\n}\n`}

const baseName=p=>p.slice(p.lastIndexOf('/')+1);
export const recordLabel=c=>c.op==='asset-add'?`Added ${c.after.name} (${c.after.stage})`:c.op==='asset-file'?`Attached ${baseName(c.after.files[c.after.files.length-1])} to ${c.after.name}${c.after.stage!==c.before.stage?' (now '+c.after.stage+')':''}`:`${c.after.name}: ${c.before.stage} → ${c.after.stage}`;
export const recordedText=c=>`Recorded: ${c.after.name} → ${c.after.stage}`;

// Which rows a new file in assets-src/ is probably about, by the words in its path (a script, no model). Returns up to n rows with a score above 0, best first.
const STOP=new Set(['by','the','and','of','glb','gltf','fbx','obj','wav','mp3','ogg','scene','model','models','pack','kit','src','assets','source']);
export const wordsOf=s=>String(s).replace(/\.[A-Za-z0-9]{2,4}$/,'').replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>1&&!STOP.has(w));
export function closestRows(filePath,rows,n=3){
 const fw=new Set(wordsOf(filePath));if(!fw.size)return [];
 return rows.map(r=>{const rw=new Set(wordsOf(r.name+' '+r.id));let hit=0;for(const w of rw)if(fw.has(w))hit++;return {r,score:hit/(rw.size+fw.size-hit||1)}})
  .filter(x=>x.score>0).sort((a,b)=>b.score-a.score||String(a.r.name).localeCompare(String(b.r.name))).slice(0,n).map(x=>x.r)}
