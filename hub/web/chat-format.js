// Mikkadr Hub: the chat's reading layout. The master writes light markdown (headings, lists, tables, **bold**, links); this turns it into blocks the page draws as separate, colour-toned parts.
// Pure: parse() takes text and returns plain data. render() builds DOM with createElement and textContent only, never markup, and only http/https links become anchors.
// Tone: 'good' (green: recommendations, plans, things that worked) and 'warn' (orange: catches, risks, things that went wrong). Nothing else is coloured.
const WARN=/^(warning|caution|catch(es)?|problems?|risks?|not verified|unverified|failed|failures?|errors?|careful|heads up|issues?|blocked|missing|i haven.?t|couldn.?t|can.?t|did not|didn.?t|no\b)/i;
const GOOD=/^(my recommendation|recommend\w*|plan|proposed plan|done|passed|fixed|built|works?|worked|why it might fit|good news|next step|suggest\w*)/i;
export const toneOf=text=>{const t=String(text||'').replace(/[*_`#]/g,'').trim();return WARN.test(t)?'warn':GOOD.test(t)?'good':null};

const URL_RE=/https?:\/\/[^\s<>)\]"']+/g;
const cleanUrl=u=>u.replace(/[.,;:!?]+$/,'');
// Inline pieces: text, bold, code, link {href,text}. Links are [text](https://...) or a bare https address.
export function inline(text){
 const out=[],src=String(text||''),re=/\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+)\*\*|`([^`\n]+)`|(https?:\/\/[^\s<>)\]"']+)/g;
 let last=0,m;
 while((m=re.exec(src))){
  if(m.index>last)out.push({t:'text',text:src.slice(last,m.index)});
  if(m[2])out.push({t:'link',text:m[1],href:cleanUrl(m[2])});
  else if(m[3])out.push({t:'bold',text:m[3]});
  else if(m[4])out.push({t:'code',text:m[4]});
  else{const u=cleanUrl(m[5]);out.push({t:'link',text:u,href:u});if(u.length<m[5].length)last=re.lastIndex-(m[5].length-u.length);else last=re.lastIndex;continue}
  last=re.lastIndex}
 if(last<src.length)out.push({t:'text',text:src.slice(last)});
 return out}

const isSep=l=>/^\|?[\s:|-]+\|?$/.test(l)&&l.includes('-');
const cells=l=>{const c=l.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(s=>s.trim());return c};
// parse: text -> [{type:'heading'|'para'|'list'|'table'|'code', tone, ...}]. A heading's tone carries to the blocks under it until the next heading.
export function parse(text){
 const lines=String(text||'').replace(/\r\n/g,'\n').split('\n'),blocks=[];let para=[],sec=null;
 const push=b=>{if(b.type!=='heading'&&!b.tone)b.tone=sec;blocks.push(b)};
 const flush=()=>{if(para.length){const s=para.join('\n').trim();if(s){const own=toneOf(s.split('\n')[0].split(/[:.]/)[0]);push({type:'para',text:s,tone:own&&own!==sec?own:null})}}para=[]};
 for(let i=0;i<lines.length;i++){
  const l=lines[i];
  if(/^```/.test(l)){flush();const body=[];i++;while(i<lines.length&&!/^```/.test(lines[i]))body.push(lines[i++]);push({type:'code',text:body.join('\n')});continue}
  if(!l.trim()){flush();continue}
  let m=/^#{1,4}\s+(.+)$/.exec(l)||/^\*\*([^*]+?)\*\*:?\s*$/.exec(l);
  if(m){flush();const t=m[1].trim().replace(/:$/,'');sec=toneOf(t);blocks.push({type:'heading',text:t,tone:sec});continue}
  if(/^\s*\|/.test(l)){flush();const rows=[];while(i<lines.length&&/^\s*\|/.test(lines[i])){if(!isSep(lines[i]))rows.push(cells(lines[i]));i++}i--;
   if(rows.length){const head=rows[0],body=rows.slice(1);push({type:'table',head,rows:body,colTone:head.map(toneOf)})}continue}
  if(/^\s*([-*•]|\d+[.)])\s+/.test(l)){flush();const ordered=/^\s*\d+[.)]/.test(l),items=[];
   while(i<lines.length&&/^\s*([-*•]|\d+[.)])\s+/.test(lines[i])){items.push(lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/,'').trim());i++}i--;
   push({type:'list',ordered,items,tones:items.map(toneOf)});continue}
  para.push(l)}
 flush();return blocks}

// Every distinct address in a message, in order: shown as their own row under the text.
export function linksOf(text){const seen=new Map();
 for(const p of inline(text))if(p.t==='link'&&!seen.has(p.href))seen.set(p.href,p.text===p.href?null:p.text);
 return [...seen].map(([href,label])=>{let host=href;try{host=new URL(href).hostname.replace(/^www\./,'')}catch{}return {href,host,label:label||host}}).slice(0,12)}

const el=(tag,cls,...kids)=>{const e=document.createElement(tag);if(cls)e.className=cls;for(const k of kids.flat())if(k!=null)e.append(k);return e};
const safeHref=h=>/^https?:\/\//i.test(h);
function inlineNodes(text){return inline(text).map(p=>{
 if(p.t==='bold')return el('strong','',p.text);
 if(p.t==='code')return el('code','',p.text);
 if(p.t==='link'&&safeHref(p.href)){const a=el('a','clink',p.text);a.href=p.href;a.target='_blank';a.rel='noopener noreferrer';return a}
 return document.createTextNode(p.text)})}
const toneCls=t=>t?' t-'+t:'';
export function render(text){
 const box=el('div','mbody');
 for(const b of parse(text)){
  if(b.type==='heading')box.append(el('div','mh'+toneCls(b.tone),inlineNodes(b.text)));
  else if(b.type==='para')box.append(el('p','mp'+toneCls(b.tone),inlineNodes(b.text)));
  else if(b.type==='code')box.append(el('pre','mcode',b.text));
  else if(b.type==='list')box.append(el(b.ordered?'ol':'ul','ml'+toneCls(b.tone),b.items.map((it,i)=>el('li',toneCls(b.tones[i]).trim(),inlineNodes(it)))));
  else if(b.type==='table'){
   const t=el('table','mt'+toneCls(b.tone)),hr=el('tr','');b.head.forEach((c,i)=>hr.append(el('th',toneCls(b.colTone[i]).trim(),inlineNodes(c))));t.append(el('thead','',hr));
   t.append(el('tbody','',b.rows.map(r=>el('tr','',r.map((c,i)=>el('td',toneCls(b.colTone[i]).trim(),inlineNodes(c)))))));
   box.append(el('div','mtwrap',t))}}
 const links=linksOf(text);
 if(links.length)box.append(el('div','mlinks',el('span','label','Links'),links.map(l=>{const a=el('a','mlink',el('b','',l.label.length>60?l.label.slice(0,57)+'…':l.label),el('span','small dim',l.host));a.href=l.href;a.target='_blank';a.rel='noopener noreferrer';return a})));
 return box}
