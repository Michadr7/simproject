// The dev server (npm run dev): serves the site and writes a house's furniture into interior-layouts.js, and refuses everything else.
import assert from 'node:assert/strict';
import http from 'node:http';
import {cp,mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
import {createDevServer,serialize} from '../scripts/dev-server.mjs';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};
// a copy of the site without its old releases, with one release folder for the server to keep in step
const root=await mkdtemp(join(tmpdir(),'city-dev-'));
await cp('dist',root,{recursive:true,filter:p=>!/releases/.test(p)});await mkdir(join(root,'releases','9.9.9'),{recursive:true});
await writeFile(join(root,'index.html'),`<script>import('./releases/9.9.9/game.js')</script>`);
await writeFile(join(root,'interior-layouts.js'),'export const INTERIOR_LAYOUTS={};\n'); // a known starting point: the real file holds whatever the editor has saved
const dev=createDevServer({root,port:0}),port=await dev.listen();
const call=(method,path,{headers={},body=null,host=`127.0.0.1:${port}`}={})=>new Promise((ok,fail)=>{const req=http.request({host:'127.0.0.1',port,method,path,headers:{host,...headers}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>ok({status:res.statusCode,body:Buffer.concat(chunks).toString(),headers:res.headers}))});req.on('error',fail);if(body)req.write(body);req.end()});
const save=(payload,extra={})=>call('POST','/__dev/save-interior',{headers:{'content-type':'application/json','x-city-dev':'1',...extra.headers},body:typeof payload==='string'?payload:JSON.stringify(payload),...(extra.host?{host:extra.host}:{})});
const {houseLayout,FLOORS}=await import(pathToFileURL(join(root,'interiors.js')).href);
try{
 // ── a static server for dist/
 assert.equal((await call('GET','/')).status,200);assert.match((await call('GET','/')).headers['content-type'],/text\/html/);
 assert.equal((await call('GET','/interiors.js')).headers['content-type'].startsWith('text/javascript'),true);
 assert.equal((await call('GET','/nope.js')).status,404);assert.equal((await call('GET','/../package.json')).status,404,'no way out of the site folder');assert.equal((await call('GET','/..%2fpackage.json')).status,403,'an encoded slash does not get out either');assert.equal((await call('GET','/%2e%2e/package.json')).status,404,'a normalised dot-dot stays inside the site');
 assert.equal((await call('PUT','/interiors.js',{body:'x'})).status,405,'it only reads');assert.equal((await call('POST','/anything')).status,405);
 // ── refusing what it should
 const L=houseLayout('house-a'),good={prop:'house-a',layout:{items:L.items}};
 assert.equal((await call('POST','/__dev/save-interior',{headers:{'content-type':'application/json'},body:JSON.stringify(good)})).status,403,'no dev header');
 assert.equal((await save(good,{host:'evil.example.com'})).status,403,'a foreign Host header (DNS rebinding)');
 assert.equal((await save(good,{headers:{origin:'http://evil.example.com'}})).status,403,'a cross-origin page');
 assert.equal((await call('POST','/__dev/save-interior',{headers:{'content-type':'text/plain','x-city-dev':'1'},body:JSON.stringify(good)})).status,415);
 assert.equal((await save('not json')).status,400);assert.equal((await save({prop:'../../etc/passwd',layout:good.layout})).status,400,'unknown house');
 assert.equal((await save({prop:'house-e',layout:good.layout})).status,400,'wrong number of floors');
 for(const bad of [{id:'tree',x:0,z:0,yaw:0},{id:'f-sofa',x:0,z:0,yaw:.4},{id:'f-sofa',x:500,z:0,yaw:0},{id:'f-sofa',x:'a',z:0,yaw:0},{id:'f-nonexistent',x:0,z:0,yaw:0},null])assert.equal((await save({prop:'house-a',layout:{items:[[bad]]}})).status,400,'refused: '+JSON.stringify(bad));
 assert.equal((await save({prop:'house-a',layout:{items:[Array.from({length:130},()=>L.items[0][0])]}})).status,400,'too many pieces');
 assert.equal((await save('{"x":"'+'a'.repeat(250_000)+'"}')).status,413,'too large');
 assert.match(await readFile(join(root,'interior-layouts.js'),'utf8'),/INTERIOR_LAYOUTS=\{\};/,'nothing was written by any of that');
 // ── saving
 const sofa=L.items[0].find(i=>i.id==='f-sofa'),moved=L.items[0].map(i=>i===sofa?{...i,x:+(i.x+.5).toFixed(3)}:i);
 let r=await save({prop:'house-a',layout:{items:[moved]}});assert.equal(r.status,200,r.body);const done=JSON.parse(r.body);assert.equal(done.ok,true);assert.equal(done.prop,'house-a');assert.deepEqual(done.files,['interior-layouts.js','releases/9.9.9/interior-layouts.js']);
 const text=await readFile(join(root,'interior-layouts.js'),'utf8');assert.equal(await readFile(join(root,'releases','9.9.9','interior-layouts.js'),'utf8'),text,'the release the page loads has the same file');
 const saved=(await import(pathToFileURL(join(root,'interior-layouts.js')).href+'?a')).INTERIOR_LAYOUTS;assert.deepEqual(Object.keys(saved),['house-a']);
 assert.equal(saved['house-a'].items[0].find(i=>i.id==='f-sofa').x,sofa.x+.5,'the move is in the file');
 // a second house merges, a second save of the first replaces it, the stairs are never written
 const E=houseLayout('house-e');r=await save({prop:'house-e',layout:{items:E.items}});assert.equal(r.status,200);
 const merged=(await import(pathToFileURL(join(root,'interior-layouts.js')).href+'?b')).INTERIOR_LAYOUTS;assert.deepEqual(Object.keys(merged),['house-a','house-e']);assert(!merged['house-e'].items.flat().some(i=>i.id==='f-stairs'),'stairs are not saved');
 assert.equal(merged['house-e'].items[1].length,E.items[1].length);
 // and the game reads what was saved
 const reread=(await import(pathToFileURL(join(root,'interiors.js')).href+'?fresh')).houseLayout;
 // (the module above was loaded before the file changed; a fresh copy of interior-layouts.js is what a reload sees)
 assert.match(text,/^\/\/ Saved house interiors/);assert.match(text,/"id":"f-sofa"/);assert.equal(serialize(saved),text,'the file is written the way serialize() writes it');
 assert.equal(typeof reread,'function');
}finally{await dev.close();await rm(root,{recursive:true,force:true})}
console.log('Dev server: serves the site (no way out of its folder, read-only), refuses a foreign Host, a cross-origin page, a missing dev header, bad JSON, unknown houses, wrong floors, invalid or oversized pieces and oversized bodies without writing anything; a valid save writes interior-layouts.js and the current release, merges houses, never writes the stairs, and the file reads back.');