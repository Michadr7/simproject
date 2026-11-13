// Eden Ridge desktop launcher: serves the bundled game from 127.0.0.1 and shows it in a window.
// A fixed port keeps the web address (and so the saves in localStorage) the same every run.
const {app,BrowserWindow,shell,dialog,Menu}=require('electron');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'game'),FIRST_PORT=47231;
const os=require('os');
const LOG=path.join(os.tmpdir(),'citylife-launcher.log');
const log=m=>{try{fs.appendFileSync(LOG,new Date().toISOString()+' '+m+'\n')}catch{}};
process.on('uncaughtException',e=>log('uncaught: '+(e&&e.stack||e)));
process.on('unhandledRejection',e=>log('unhandled: '+(e&&e.stack||e)));
log('start, electron '+process.versions.electron);
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.woff2':'font/woff2','.ico':'image/x-icon'};
function handler(req,res){
 let rel;try{rel=decodeURIComponent(new URL(req.url,'http://x').pathname)}catch{res.writeHead(400);return res.end()}
 if(rel.endsWith('/'))rel+='index.html';
 const file=path.normalize(path.join(ROOT,rel));
 if(file!==ROOT&&!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end()}
 fs.readFile(file,(err,data)=>{
  if(err){res.writeHead(404);return res.end('Not found')}
  res.writeHead(200,{'content-type':TYPES[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-cache'});res.end(data);
 });
}
function listen(port,last){return new Promise((resolve,reject)=>{
 const server=http.createServer(handler);
 server.once('error',e=>{if(e.code==='EADDRINUSE'&&port<last)resolve(listen(port+1,last));else reject(e)});
 server.listen(port,'127.0.0.1',()=>resolve({server,port}));
})}
async function start(){
 let port;try{({port}=await listen(FIRST_PORT,FIRST_PORT+9));log('listening on '+port)}catch(e){log('listen failed: '+e.message);dialog.showErrorBox('Eden Ridge','Could not start the local game server: '+e.message);return app.quit()}
 const win=new BrowserWindow({width:1280,height:800,backgroundColor:'#000000',title:'Eden Ridge',autoHideMenuBar:true,webPreferences:{contextIsolation:true,sandbox:true}});
 Menu.setApplicationMenu(null);
 win.webContents.setWindowOpenHandler(({url})=>{if(/^https?:/.test(url)&&!url.startsWith('http://127.0.0.1:'))shell.openExternal(url);return {action:'deny'}});
 win.webContents.on('before-input-event',(e,i)=>{if(i.type==='keyDown'&&i.key==='F11'){win.setFullScreen(!win.isFullScreen());e.preventDefault()}});
 win.loadURL('http://127.0.0.1:'+port+'/');
}
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
if(!app.requestSingleInstanceLock()){log('another instance holds the lock: quitting');app.quit()}
else{log('ready wait');app.whenReady().then(()=>{log('ready');return start()});app.on('window-all-closed',()=>app.quit())}