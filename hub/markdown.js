// P4 S1: the plan reader

// Mikkadr Hub P4, S1: a small Markdown reader for plans. It escapes everything first, then adds only the tags it builds itself:
// headings, paragraphs, bullet and numbered lists, fenced code, inline code, bold, and tables. Links and raw HTML are never made, so a plan cannot inject markup.
export const escapeHtml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const inline=s=>escapeHtml(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
const cells=l=>l.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(c=>c.trim());
const isRule=l=>/^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(l)&&l.includes('-');
const isRow=l=>l.includes('|');

export function renderMarkdown(text){
 const lines=String(text??'').replace(/\r\n/g,'\n').split('\n'),out=[];
 let i=0;
 while(i<lines.length){
  const line=lines[i];
  if(/^```/.test(line)){const code=[];i++;while(i<lines.length&&!/^```/.test(lines[i]))code.push(lines[i++]);i++;out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);continue}
  const h=/^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
  if(h){out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);i++;continue}
  if(isRow(line)&&i+1<lines.length&&isRule(lines[i+1])){
   const head=cells(line),rows=[];i+=2;while(i<lines.length&&isRow(lines[i])&&lines[i].trim())rows.push(cells(lines[i++]));
   out.push(`<table><thead><tr>${head.map(c=>`<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);continue}
  const ul=/^\s*[-*]\s+/.test(line),ol=/^\s*\d+[.)]\s+/.test(line);
  if(ul||ol){const re=ul?/^\s*[-*]\s+/:/^\s*\d+[.)]\s+/,items=[];while(i<lines.length&&re.test(lines[i]))items.push(lines[i++].replace(re,''));
   out.push(`<${ul?'ul':'ol'}>${items.map(t=>`<li>${inline(t)}</li>`).join('')}</${ul?'ul':'ol'}>`);continue}
  if(!line.trim()){i++;continue}
  const para=[];while(i<lines.length&&lines[i].trim()&&!/^```|^#{1,6}\s|^\s*[-*]\s+|^\s*\d+[.)]\s+/.test(lines[i])&&!(isRow(lines[i])&&i+1<lines.length&&isRule(lines[i+1])))para.push(lines[i++]);
  if(!para.length){out.push(`<p>${inline(lines[i++])}</p>`);continue}
  out.push(`<p>${para.map(inline).join('<br>')}</p>`)}
 return out.join('\n')}
