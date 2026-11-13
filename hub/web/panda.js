// Mikkadr Hub 2.4.2: the panda drawn on a canvas (the shelf). From hub/design/hub-v2-panda.js, with a size setting and a stop().
// Poses are targets; the drawn pose glides toward them, so every change is smooth. F holds the facts from GET /api/activity (names and counts only); S is what is drawn, gliding toward F.
// States: idle, think, read, write, test, pass, fail, stopped, wait, done. bot.js picks one from the hub's mood. Nothing here reads or sends anything.
export function mountPanda(cv,{scale=0.9,win=window}={}){
const K=scale;let alive=true,raf=0;
// the bot: a panda. Poses are targets; the drawn pose glides toward them, so every change is smooth.
// pass 2: the scene also shows the feed's numbers (F): allowance as bamboo, cache as a tea cup, test result, stop reason, gauge mood, file names.
const cx=cv.getContext('2d');
const C={ink:'#f1efe9',dim:'#a3a39d',faint:'#6e6f6c',line:'#2a2d33',acc:'#3b82f6',eye:'#9cc2ff',ok:'#5fbf85',warn:'#e0b060',crit:'#f2766d',calm:'#8a93a6',screen:'#0b0c0e',paper:'#efece3',fur:'#353a43',fur2:'#191b20',rim:'#69707d',white:'#ffffff',white2:'#d6d2c9',pink:'#f0a9a4',wood:'#4a505c',leaf:'#6fcf8a'};
const still=win.matchMedia('(prefers-reduced-motion: reduce)').matches,sin=Math.sin,PI=Math.PI;
let W=0,H=0,now=0;
const bot={x:40,dir:1,s:.5,state:'idle',want:'idle',t0:0,goal:null,pause:1,idleKind:'idle'};
const P={Lx:-25,Ly:-28,Rx:25,Ry:-28,lx:0,ly:0,tilt:0,hy:0,open:1,smile:.15,wide:0,sit:0,lean:0,happy:0,worry:0,droop:0};
// F: facts from the activity feed (names and counts only). S: the drawn values, gliding toward F.
// Everything starts unknown: no allowance (no bamboo), no cache reading (no cup), no gauge. Nothing is drawn from a number the hub did not give.
const F={used:0,cap:null,file:'',cmd:'',asks:1,sign:null,cacheMin:null,cache:null,gauge:null};
const S={fill:0,warm:1,prop:0};
const FONT='"Segoe UI",system-ui,sans-serif',RUN=['read','write','test','pass','fail','stopped'];
const fillOf=()=>F.cap>0?F.used/F.cap:0,haveCup=()=>Number.isFinite(F.cacheMin);
// the steam thins over 60 minutes; "cold" (frost) only when the hub has measured the cache lifetime and says so
const warmOf=()=>haveCup()?(F.cache==='cold'?0:Math.max(0,Math.min(1,1-F.cacheMin/60))):0;
const pace=()=>F.gauge>=90?.6:F.gauge>=60?1.35:1;
const homeX=()=>Math.max(W*.5,W-176),ground=()=>H-18,big=()=>W<430?.78:1;
// the scale is the size setting, but never so big that the tallest sign (about 206 drawing units) is cut off by the top of the shelf
function size(){const r=cv.getBoundingClientRect(),d=Math.min(2,win.devicePixelRatio||1),k=Math.min(K,(r.height||206)/206);W=r.width/k;H=r.height/k;cv.width=Math.round(r.width*d);cv.height=Math.round(r.height*d);cx.setTransform(d*k,0,0,d*k,0,0)}
const rgba=(h,a)=>'rgba('+parseInt(h.slice(1,3),16)+','+parseInt(h.slice(3,5),16)+','+parseInt(h.slice(5,7),16)+','+a+')';
const rr=(x,y,w,h,r)=>{cx.beginPath();cx.roundRect(x,y,w,h,r)};
const ell=(x,y,rx,ry,rot=0)=>{cx.beginPath();cx.ellipse(x,y,rx,ry,rot,0,7)};
const line=(a,b,c,d)=>{cx.beginPath();cx.moveTo(a,b);cx.lineTo(c,d);cx.stroke()};
const poly=p=>{cx.beginPath();p.forEach(([x,y],i)=>i?cx.lineTo(x,y):cx.moveTo(x,y));cx.closePath()};
const font=(px,w=600)=>{cx.font=w+' '+px+'px '+FONT};
// a file or command name, cut to fit a prop (the last part of the path, then an ellipsis)
function fit(s,max){s=String(s).split(/[\\/]/).pop();if(cx.measureText(s).width<=max)return s;while(s.length>1&&cx.measureText(s+'…').width>max)s=s.slice(0,-1);return s+'…'}
function dark(x,y,rx,ry,rot=0){ell(x,y,rx,ry,rot);const g=cx.createLinearGradient(x-rx,y-ry,x+rx,y+ry);g.addColorStop(0,C.fur);g.addColorStop(1,C.fur2);cx.fillStyle=g;cx.fill();cx.strokeStyle=C.rim;cx.lineWidth=1.2;cx.stroke()}
function light(x,y,rx,ry){ell(x,y,rx,ry);const g=cx.createRadialGradient(x-rx*.3,y-ry*.4,ry*.2,x,y,Math.max(rx,ry)*1.05);g.addColorStop(0,C.white);g.addColorStop(1,C.white2);cx.fillStyle=g;cx.fill()}
function pads(x,y,r){cx.fillStyle=C.pink;ell(x,y+r*.18,r*.5,r*.42);cx.fill();for(const d of[-1,0,1]){ell(x+d*r*.5,y-r*.48,r*.17,r*.2);cx.fill()}}
function arm(sx,sy,hx,hy){cx.lineCap='round';cx.beginPath();cx.moveTo(sx,sy);cx.quadraticCurveTo((sx+hx)/2+(hx>sx?6:-6),(sy+hy)/2+8,hx,hy);cx.strokeStyle=C.rim;cx.lineWidth=15.5;cx.stroke();cx.strokeStyle=C.fur;cx.lineWidth=13;cx.stroke();dark(hx,hy,8,8);if(hy<-78)pads(hx,hy,8)}

function step(dt,t){
 const working=bot.want!=='idle';bot.s+=((working?big():.5)-bot.s)*(1-Math.exp(-dt*3));
 const k=1-Math.exp(-dt*2.5);S.fill+=(fillOf()-S.fill)*k;S.warm+=(warmOf()-S.warm)*k;S.prop+=((working?1:0)-S.prop)*(1-Math.exp(-dt*4));
 const go=(tx,max)=>{const d=tx-bot.x,ad=Math.abs(d);if(ad<2){bot.x=tx;return true}bot.dir=d>0?1:-1;bot.x+=bot.dir*Math.min(ad,Math.min(max,Math.max(34,ad*2.5))*dt);bot.state='walk';return false};
 if(working){if(go(homeX(),Math.max(170,W*.32)*(F.gauge>=90?.7:1))){bot.dir=1;if(bot.state!==bot.want){bot.state=bot.want;bot.t0=t}}}
 else if(bot.pause>0){bot.pause-=dt;if(bot.state!==bot.idleKind){bot.state=bot.idleKind;bot.t0=t}}
 else if(bot.goal==null)bot.goal=36+Math.random()*Math.max(40,W-80);
 else if(go(bot.goal,62)){bot.goal=null;const r=Math.random();bot.idleKind=r<.35?'eat':r<.55?'nap':'idle';bot.pause=bot.idleKind==='idle'?1.5+Math.random()*2.5:4.5+Math.random()*3}}

function target(st,tt,t){
 const T={Lx:-25,Ly:-28,Rx:25,Ry:-28,lx:0,ly:0,tilt:0,hy:0,open:(t%4.1)<.13?0:1,smile:.15,wide:0,sit:0,lean:0,happy:0,worry:0,droop:0};
 if(st==='walk'){const w=sin(t*9);T.Ly=-30+w*6;T.Ry=-30-w*6;T.Lx=-24;T.Rx=24;T.lx=4;T.lean=.07;T.tilt=w*.04;T.smile=.3}
 else if(st==='idle'){T.lx=sin(t*.9)*5;T.tilt=sin(t*.7)*.06}
 else if(st==='eat'){T.Rx=17;T.Ry=-57;T.ly=3;T.smile=.4+.35*sin(tt*10);T.tilt=.07;T.happy=sin(tt*1.3)>.55?1:0}
 else if(st==='nap'){T.sit=1;T.open=0;T.tilt=.2;T.hy=3;T.Lx=-22;T.Ly=-22;T.Rx=22;T.Ry=-22;T.smile=0}
 else if(st==='think'){T.Rx=12;T.Ry=-61;T.lx=3;T.ly=-5;T.tilt=-.1;T.smile=0}
 else if(st==='read'){T.Lx=-23;T.Ly=-38;T.Rx=23;T.Ry=-38;T.ly=5;T.lx=Math.min(1,(tt%2.5)/1.75)*8-4;T.hy=3}
 else if(st==='write'){T.Lx=36;T.Ly=-47;T.Rx=52;T.Ry=-47;T.lx=5;T.ly=1;T.lean=.05;T.tilt=.04}
 else if(st==='test'){T.Lx=-23;T.Ly=-40;T.Rx=35;T.Ry=-70+sin(tt*3)*5;T.lx=5;T.ly=-3;T.smile=.4}
 else if(st==='pass'){T.Lx=-40;T.Ly=-94+sin(tt*9)*4;T.Rx=40;T.Ry=-94-sin(tt*9)*4;T.smile=1;T.happy=1;T.tilt=sin(tt*4.5)*.07}
 else if(st==='fail'){T.Lx=-31;T.Ly=-95;T.Rx=36;T.Ry=-64;T.lx=7;T.ly=-2;T.smile=-.8;T.worry=1;T.droop=1;T.tilt=-.09;T.wide=.6}
 else if(st==='stopped'){T.sit=1;T.droop=1;T.worry=.7;T.smile=-.5;T.Lx=-22;T.Ly=-22;T.Rx=42;T.Ry=-46;T.ly=3;T.tilt=.07;T.hy=2}
 else if(st==='wait'){T.Lx=-41;T.Ly=-88+sin(tt*8)*7;T.Rx=42;T.Ry=-54;T.wide=1;T.smile=.7;T.tilt=sin(tt*3)*.05}
 else if(st==='done'){T.Lx=-46;T.Ly=-100;T.Rx=46;T.Ry=-100;T.smile=1;T.happy=1}
 // the weekly and 5-hour gauges: from 90% the panda is tired; past 80% of the allowance it glances at the bamboo
 if(F.gauge>=90&&st!=='nap'){T.open=Math.min(T.open,.5);T.hy+=2.5;if(T.smile>0)T.smile*=.4}
 if(RUN.includes(st)&&st!=='stopped'&&fillOf()>=.8&&(t%5)<1.1){T.lx=-9;T.ly=1;T.worry=Math.max(T.worry,.6)}
 return T}
function glide(T,dt){for(const k in T)P[k]+=(T[k]-P[k])*(1-Math.exp(-dt*(k==='open'?32:13)))}

function head(){
 const dr=P.droop;
 for(const d of[-1,1]){cx.save();cx.translate(d*(27+dr*4),-25+dr*8);cx.rotate(d*dr*.5);dark(0,0,12,12);cx.fillStyle=rgba(C.pink,.8);ell(0,1,6,6);cx.fill();cx.restore()}
 light(0,0,36,31);
 for(const d of[-1,1]){cx.fillStyle=C.fur2;ell(d*14.5,-1,10.5,13,d*-.38);cx.fill();
  const ex=d*13.5+P.lx*.6,ey=-2+P.ly*.5,R=7+P.wide*1.5;
  if(P.happy>.5){cx.strokeStyle='#fff';cx.lineWidth=2.6;cx.lineCap='round';cx.beginPath();cx.arc(ex,ey+3,5.5,PI*1.12,PI*1.88);cx.stroke()}
  else{cx.save();cx.translate(ex,ey);cx.scale(1,Math.max(.08,P.open));cx.fillStyle='#fff';ell(0,0,R,R);cx.fill();cx.fillStyle='#3d261a';ell(P.lx*.35,P.ly*.3,R*.74,R*.74);cx.fill();cx.fillStyle='#0b0c0e';ell(P.lx*.4,P.ly*.34,R*.42,R*.42);cx.fill();cx.fillStyle='#fff';ell(P.lx*.3-R*.3,P.ly*.3-R*.34,R*.27,R*.27);cx.fill();ell(P.lx*.3+R*.28,P.ly*.3+R*.3,R*.11,R*.11);cx.fill();cx.restore()}
  if(P.worry>.2){cx.globalAlpha=Math.min(1,P.worry*1.3);cx.strokeStyle=C.fur2;cx.lineWidth=2.4;cx.lineCap='round';line(d*23,-17,d*9,-17-P.worry*6);cx.globalAlpha=1}}
 cx.fillStyle=rgba(C.pink,.38);for(const d of[-1,1]){ell(d*24,10,5.5,3.4);cx.fill()}
 cx.fillStyle='#1a1c20';ell(0,10,4.4,3.1);cx.fill();cx.fillStyle='rgba(255,255,255,.5)';ell(-1.2,9,1.3,.8);cx.fill();
 const m=P.smile;
 if(m>.45){cx.beginPath();cx.moveTo(-6*m-1,15);cx.quadraticCurveTo(0,15+15*m,6*m+1,15);cx.closePath();cx.fillStyle='#7a2f35';cx.fill();cx.fillStyle=C.pink;ell(0,15+5.5*m,3.2*m,2.4*m);cx.fill()}
 else if(m<-.2){cx.strokeStyle='#1a1c20';cx.lineWidth=1.8;cx.lineCap='round';cx.beginPath();cx.moveTo(-5.5,19);cx.quadraticCurveTo(0,19+m*8,5.5,19);cx.stroke()}
 else{cx.strokeStyle='#1a1c20';cx.lineWidth=1.6;cx.lineCap='round';cx.beginPath();cx.moveTo(-5,15);cx.quadraticCurveTo(-2.5,18+m*4,0,15);cx.quadraticCurveTo(2.5,18+m*4,5,15);cx.stroke()}
 // hurrying (gauges from 60%): a sweat drop slides down the side of the head
 if(F.gauge>=60&&F.gauge<90&&RUN.includes(bot.state)&&bot.state!=='stopped'){const p=still?.4:(now*.7)%1;cx.globalAlpha=1-p*.8;cx.fillStyle=C.eye;cx.beginPath();cx.moveTo(33,-22+p*14);cx.quadraticCurveTo(38.5,-13+p*14,33,-11+p*14);cx.quadraticCurveTo(27.5,-13+p*14,33,-22+p*14);cx.fill();cx.globalAlpha=1}}

// the run's token allowance: a bamboo stalk that grows to the dashed outline; the 80% warning is the amber notch
function bamboo(t){
 const x=-92,full=140,seg=14,f=Math.min(1.04,S.fill),h=Math.min(full,f*full),over=S.fill>=.995,warn=S.fill>=.8;
 cx.setLineDash([3,4]);cx.strokeStyle=C.faint;cx.lineWidth=1;rr(x-5.5,-full,11,full,4);cx.stroke();cx.setLineDash([]);
 cx.strokeStyle=C.warn;cx.lineWidth=2;cx.lineCap='round';line(x-11,-full*.8,x+11,-full*.8);
 font(10);cx.textAlign='right';cx.fillStyle=C.warn;cx.fillText('80%',x-15,-full*.8);cx.textAlign='center';
 for(let i=0;i*seg<h-.5;i++){const sh=Math.min(seg,h-i*seg),col=over?C.crit:i>=8?C.warn:C.leaf;
  rr(x-4.5,-i*seg-sh+.8,9,Math.max(1,sh-1.4),3);cx.fillStyle=col;cx.fill();cx.fillStyle='rgba(255,255,255,.28)';cx.fillRect(x-3,-i*seg-sh+2,1.8,Math.max(0,sh-4));
  if(sh>=seg&&i%2===1&&i!==7){const d=i%4===1?1:-1;cx.fillStyle=rgba(col,.85);ell(x+d*12,-(i+1)*seg-2,8,2.8,-d*.4);cx.fill()}}
 const sw=still?0:sin(t*2.1)*.12,tip=over?C.crit:warn?C.warn:C.leaf;cx.fillStyle=tip;ell(x-6,-h-4,7,2.6,.7+sw);cx.fill();ell(x+6,-h-5,7.5,2.6,-.7+sw);cx.fill();
 if(warn&&!still){cx.save();cx.globalAlpha=.35+.3*sin(t*5);cx.strokeStyle=tip;cx.lineWidth=1.5;rr(x-8.5,-full-3,17,full+3,6);cx.stroke();cx.restore()}
 font(11,700);cx.fillStyle=over?C.crit:warn?C.warn:C.dim;cx.fillText(Math.round(S.fill*100)+'%',x,-full-18)}

// the cache: a tea cup that steams while warm and frosts over when cold; the label is minutes since the last reply
function cup(t){
 const x=-50,w=S.warm,cold=F.cache==='cold';
 cx.fillStyle=C.white2;ell(x,-1.5,12.5,2.6);cx.fill();
 poly([[x-8.5,-16],[x+8.5,-16],[x+6,-2.5],[x-6,-2.5]]);cx.fillStyle=cold?'#b7cfee':C.paper;cx.fill();
 cx.strokeStyle=cold?'#b7cfee':C.paper;cx.lineWidth=2.2;cx.beginPath();cx.arc(x+8.5,-9.5,4,-PI/2,PI/2);cx.stroke();
 cx.fillStyle=cold?'#7fa3d4':'#b9763a';ell(x,-16,8.5,2.3);cx.fill();
 if(cold){cx.strokeStyle='#fff';cx.lineWidth=1;for(const[a,b]of[[-4,-11],[2,-6],[4,-12]]){line(x+a-1.8,b,x+a+1.8,b);line(x+a,b-1.8,x+a,b+1.8)}}
 else{cx.strokeStyle=C.ink;cx.lineWidth=1.7;cx.lineCap='round';for(let i=0;i<3;i++){const ph=still?i:t*1.8+i*2.1;cx.globalAlpha=w*(.6-i*.08);cx.beginPath();for(let k=0;k<=8;k++){const y=-21-k*(1.6+w*1.9),xx=x-5+i*5+sin(ph+k*.8)*(1.2+k*.28);k?cx.lineTo(xx,y):cx.moveTo(xx,y)}cx.stroke()}cx.globalAlpha=1}
 font(10);cx.fillStyle=cold?C.eye:C.dim;cx.fillText(F.cache==='unknown'||!F.cache?F.cacheMin+' min since last reply':'cache '+(cold?'cold':'warm')+' - '+F.cacheMin+' min',x-8,10)}

// the lamp board (running, passed, failed)
const BAD=[9,14,20,4,17,11];
function board(st,tt){
 cx.strokeStyle=C.wood;cx.lineWidth=3.5;cx.lineCap='round';line(62,-32,57,0);line(126,-32,131,0);
 cx.save();if(st!=='test'){cx.shadowColor=st==='pass'?C.ok:C.crit;cx.shadowBlur=18}rr(44,-114,100,84,9);cx.fillStyle=C.screen;cx.fill();cx.restore();cx.strokeStyle=st==='pass'?C.ok:st==='fail'?C.crit:C.rim;cx.lineWidth=1.5;cx.stroke();
 const n=st==='test'?Math.floor(tt*3.5)%30:24,bad=st==='fail'?BAD.slice(0,3):[],blink=still||(tt*2.4)%1<.62;
 for(let i=0;i<24;i++){const x=56.5+(i%6)*15,y=-101+Math.floor(i/6)*15,isBad=bad.includes(i),cur=st==='test'&&i===n,on=i<n;
  const col=isBad?(blink?C.crit:'#4a2422'):on?C.ok:cur?C.ink:C.line;cx.save();if((on&&!isBad)||cur||(isBad&&blink)){cx.shadowColor=col;cx.shadowBlur=isBad?12:7}cx.fillStyle=col;ell(x,y,cur||isBad?5:4,cur||isBad?5:4);cx.fill();cx.restore()}
 font(11,st==='test'?600:700);cx.fillStyle=st==='pass'?C.ok:st==='fail'?C.crit:C.dim;
 cx.fillText(st==='pass'?'passed':st==='fail'?'failed':fit(F.cmd||'tests',88),94,-41)} // no counts: the feed gives passed or failed, never the number of tests

function sign(x,y,w,h,col,glow,text,px,sub){
 cx.strokeStyle=C.wood;cx.lineWidth=3.5;cx.lineCap='round';line(42,P.Ry-P.sit*9,42,y+h);
 cx.save();cx.shadowColor=col;cx.shadowBlur=glow;rr(x,y,w,h,9);cx.fillStyle=col;cx.fill();cx.restore();
 cx.fillStyle='#1b1e23';font(px,700);cx.fillText(fit(text,w-12),x+w/2,y+h/2-(sub?6:0));if(sub){font(11);cx.fillText(sub,x+w/2,y+h/2+10)}}

function draw(t){
 now=t;const g=ground(),st=bot.state,tt=(t-bot.t0)*(RUN.includes(st)?pace():1),walk=st==='walk',board3=st==='test'||st==='pass'||st==='fail';
 cx.clearRect(0,0,W,H);
 const fg=cx.createLinearGradient(0,g,0,H);fg.addColorStop(0,'rgba(255,255,255,.08)');fg.addColorStop(1,'rgba(255,255,255,0)');cx.fillStyle=fg;cx.fillRect(0,g,W,H-g);
 cx.textAlign='center';cx.textBaseline='middle';
 // the stage's fixed props: bamboo (allowance) and cup (cache). They fade in while the hub works.
 if(S.prop>.02){cx.save();cx.globalAlpha=S.prop;cx.translate(homeX(),g);cx.scale(big(),big());if(F.cap>0)bamboo(t);if(haveCup())cup(t);cx.restore()}
 const mood=st==='wait'?C.warn:st==='done'||st==='pass'?C.ok:st==='fail'||st==='stopped'?C.crit:(st==='idle'||st==='nap'||st==='eat'||(walk&&bot.want==='idle'))?C.calm:C.acc;
 const hop=walk?-Math.abs(sin(t*9))*3.5:st==='done'?-Math.abs(sin(tt*5))*18:st==='pass'?-Math.abs(sin(tt*4.5))*9:st==='wait'?-Math.abs(sin(tt*3))*4:0,breath=sin(t*2.2)*.018;
 cx.save();cx.translate(bot.x,g);cx.scale(bot.dir*bot.s,bot.s);
 cx.save();cx.scale(1,.2);const gl=cx.createRadialGradient(0,0,4,0,0,100);gl.addColorStop(0,rgba(mood,.34));gl.addColorStop(1,rgba(mood,0));cx.fillStyle=gl;ell(0,0,100,100);cx.fill();
 // needs you: two rings pulse outward on the floor
 if(st==='wait')for(let i=0;i<2;i++){const p=still?.35+i*.4:(tt*.7+i*.5)%1;cx.globalAlpha=(1-p)*.75;cx.strokeStyle=C.warn;cx.lineWidth=5;ell(0,0,50+p*95,50+p*95);cx.stroke()}
 cx.globalAlpha=1;cx.restore();
 cx.fillStyle='rgba(0,0,0,.5)';ell(0,2,30+hop*.4,4.5);cx.fill();
 font(11);
 // things behind the panda
 if(st==='write'){cx.strokeStyle=C.wood;cx.lineWidth=3.5;cx.lineCap='round';line(40,-42,40,0);line(128,-42,128,0);line(97,-58,97,-46);rr(28,-47,108,6,3);cx.fillStyle=C.wood;cx.fill();rr(33,-51,30,4,2);cx.fillStyle=C.faint;cx.fill();
  cx.save();cx.shadowColor=C.acc;cx.shadowBlur=22;rr(60,-112,76,54,6);cx.fillStyle=C.screen;cx.fill();cx.restore();cx.strokeStyle=C.rim;cx.lineWidth=1.5;cx.stroke();
  rr(60,-112,76,13,[6,6,0,0]);cx.fillStyle=C.line;cx.fill();font(8.5);cx.fillStyle=C.ink;cx.fillText(fit(F.file,70),98,-105.5);
  const L=[46,30,54,22,40],col=[C.eye,C.ok,C.dim,C.eye,C.warn],p=(tt*1.3)%6.5,k=Math.floor(p);
  for(let i=0;i<5;i++){const w=i<k?L[i]:i===k?L[i]*(p%1):0;if(w>0){rr(67,-94+i*7,w,3,1.5);cx.fillStyle=col[i];cx.fill()}if(i===k&&(tt*3)%1<.6){cx.fillStyle=C.ink;cx.fillRect(68+w,-95+i*7,3,5)}}}
 if(board3)board(st,tt);
 if(st==='read'){for(let i=0;i<5;i++){rr(46+(i%2)*2,-3-i*3.6,28,2.6,1);cx.fillStyle=i%2?C.white2:C.paper;cx.fill()}}
 // the panda
 cx.save();cx.translate(0,hop+P.sit*9);cx.rotate(P.lean);
 for(const d of[-1,1]){const ph=t*9+(d>0?0:PI),lift=walk?Math.max(0,sin(ph))*6:0,fx=d*(13+P.sit*11)+(walk?sin(ph+1.2)*3:0),fy=-7-lift-P.sit*9;dark(fx,fy,12+P.sit*2,8.5+P.sit*3.5);if(P.sit>.5)pads(fx,fy,9)}
 cx.save();cx.translate(0,-36);cx.scale(1+breath,1-breath);dark(0,0,27,26);light(0,4,16,17);cx.restore();
 cx.strokeStyle=C.acc;cx.lineWidth=5;cx.lineCap='round';cx.beginPath();cx.ellipse(0,-58,17,6,0,.2,PI-.2);cx.stroke();
 cx.save();cx.shadowColor=mood;cx.shadowBlur=10+sin(t*4)*4;cx.fillStyle=mood;ell(0,-50.5,4,4);cx.fill();cx.restore();
 cx.save();cx.translate(0,-84+P.hy-breath*40);cx.rotate(P.tilt);head();cx.restore();
 if(st==='eat'){const x=P.Rx,y=P.Ry;cx.strokeStyle=C.leaf;cx.lineWidth=4.5;cx.lineCap='round';line(x-12,y+3,x+26,y-22);cx.strokeStyle='#3f9a5c';cx.lineWidth=1.5;line(x+4,y-10,x+7,y-6);line(x+15,y-17,x+18,y-13);cx.fillStyle=C.leaf;ell(x+35,y-25,9,3.2,-.2);cx.fill();ell(x+28,y-31,8,3,-1.1);cx.fill()}
 if(st==='wait')sign(-22,-186,128,48,C.warn,still?20:18+10*sin(tt*5),'I need you',18,Math.max(1,F.asks)+(F.asks<=1?' question':' questions'));
 if(st==='stopped')sign(-22,-152,128,32,'#c9a877',6,F.sign||'Stopped',13.5);
 const j=st==='write'?sin(tt*22)*2.5:0;arm(-20,-48,P.Lx,P.Ly+j);arm(20,-48,P.Rx,P.Ry-j);
 if(st==='test'){rr(-33,-55,16,21,2);cx.fillStyle=C.paper;cx.fill();cx.fillStyle=C.faint;for(let i=0;i<3;i++)cx.fillRect(-30,-49+i*5,10,1.5);dark(-23,-38,6,5)}
 if(st==='read'){ // the book faces us: the cover carries the file name; a page flips over the top edge
  cx.fillStyle=C.paper;cx.strokeStyle='#a9a59b';cx.lineWidth=1;poly([[-26,-63],[0,-56],[26,-63],[26,-58],[0,-51],[-26,-58]]);cx.fill();cx.stroke();
  const q=Math.max(0,((tt%2.5)-1.75)/.75);if(q>0){const x=24*Math.cos(q*PI),u=13*sin(q*PI);poly([[0,-55],[x,-62-u],[x,-56-u*.6],[0,-51]]);cx.fill();cx.stroke()}
  poly([[-28,-60],[0,-53],[28,-60],[28,-38],[0,-31],[-28,-38]]);cx.fillStyle=C.acc;cx.fill();cx.strokeStyle=rgba(C.white,.35);cx.lineWidth=1;line(0,-53,0,-31);
  rr(-26,-51.5,52,13,3);cx.fillStyle=C.paper;cx.fill();font(8.5,700);cx.fillStyle='#1b1e23';cx.fillText(fit(F.file,49),0,-44.5);
  dark(-25,-39,6,6);dark(25,-39,6,6)}
 if(st==='think'){cx.fillStyle=C.ink;for(const[x,y,r]of[[40,-120,3],[50,-132,4.5]]){ell(x,y,r,r);cx.fill()}rr(56,-168,52,28,14);cx.fill();for(let i=0;i<3;i++){cx.fillStyle=(Math.floor(tt*3)%3)===i?C.acc:'#9a9a94';ell(69+i*13,-154,3.2,3.2);cx.fill()}}
 if(st==='nap'){cx.fillStyle=C.eye;for(let i=0;i<3;i++){const p=((tt*.45+i/3)%1);cx.globalAlpha=(1-p)*.9;font(10+p*9,700);cx.fillText('z',34+p*20,-112-p*36)}cx.globalAlpha=1}
 cx.restore();
 if(st==='done'||st==='pass'){const cc=st==='pass'?[C.ok,C.leaf,C.ink]:[C.acc,C.ok,C.warn,C.crit,C.ink],n=st==='pass'?12:22;for(let i=0;i<n;i++){const y=-180+((tt*75+i*37)%180),x=((i*53)%180)-90+sin(tt*3+i)*7;cx.save();cx.translate(x,y);cx.rotate(tt*4+i);cx.fillStyle=cc[i%cc.length];cx.globalAlpha=Math.min(1,(-y)/40);cx.fillRect(-2,-3,4,6);cx.restore()}}
 cx.restore()}

let last=0;
function frame(ms){const t=ms/1000,dt=Math.min(.05,t-last||0);last=t;step(dt,t);glide(target(bot.state,(t-bot.t0)*(RUN.includes(bot.state)?pace():1),t),dt);draw(t);if(alive)raf=requestAnimationFrame(frame)}
function settle(){const w=bot.want!=='idle';bot.x=w?homeX():Math.min(bot.x,W-40);bot.s=w?big():.5;bot.state=bot.want;bot.dir=1;bot.t0=0;S.fill=fillOf();S.warm=warmOf();S.prop=w?1:0;Object.assign(P,target(bot.state,1.2,1.2));draw(1.2)}
function feed(patch){Object.assign(F,patch);if(still)settle()}
function want(s,patch){if(patch)Object.assign(F,patch);if(s===bot.want){if(still)settle();return}bot.want=s;if(s==='idle'){bot.goal=null;bot.pause=.6;bot.idleKind='idle'}if(still)settle()}
const onSize=()=>{size();if(still)settle()};
win.addEventListener('resize',onSize);
size();if(still)settle();else raf=requestAnimationFrame(frame);
return {want,feed,size:onSize,stop(){alive=false;win.cancelAnimationFrame(raf);win.removeEventListener('resize',onSize)}}}
