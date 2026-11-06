import * as T from './vendor/three.module.js';

// A sliding glass door: two panels part sideways inside a frame. Call setOpen(true/false) and update(dt) every frame;
// `amount` runs from 0 (shut) to 1 (fully open). Used for the shop fronts and the shop interiors.
const frameMaterial=new T.MeshStandardMaterial({color:'#25413c',roughness:.6});
const glassMaterial=new T.MeshStandardMaterial({color:'#a9cfcb',roughness:.12,metalness:.15,transparent:true,opacity:.42,depthWrite:false});
export function createSlidingDoor({width=2.2,height=2.5}={}){
 const group=new T.Group(),half=width/2,panels=[];
 const part=(parent,w,h,d,x,y,material)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);mesh.position.set(x,y,0);parent.add(mesh);return mesh};
 part(group,width+.34,.2,.16,0,height+.1,frameMaterial);
 for(const side of [-1,1])part(group,.12,height+.2,.16,side*(half+.11),(height+.2)/2,frameMaterial);
 for(const side of [-1,1]){
  const panel=new T.Group(),paneWidth=half-.02;
  part(panel,paneWidth,height-.08,.03,0,height/2,glassMaterial);
  part(panel,paneWidth,.07,.06,0,.04,frameMaterial);part(panel,paneWidth,.07,.06,0,height-.04,frameMaterial);
  part(panel,.06,height-.08,.06,-side*(paneWidth/2-.03),height/2,frameMaterial);part(panel,.06,height-.08,.06,side*(paneWidth/2-.03),height/2,frameMaterial);
  part(panel,.04,.5,.08,-side*(paneWidth/2-.12),height*.5,frameMaterial); // pull handle at the meeting edge
  panel.position.z=side*.035; // the two panels pass each other
  panel.userData.side=side;group.add(panel);panels.push(panel);
 }
 let amount=0,target=0;
 const place=()=>{for(const panel of panels)panel.position.x=panel.userData.side*(half/2+amount*(half-.1))};
 place();
 return {
  group,
  get amount(){return amount},
  setOpen(open){target=open?1:0},
  update(dt){
   if(amount===target)return;
   amount+=(target-amount)*Math.min(1,Math.max(0,dt)*8);
   if(Math.abs(target-amount)<.004)amount=target;
   place();
  }
 };
}

// Hinged doors (0.35): a single leaf or a pair of glass leaves on hinges. Opened and closed by hand (E), so they are `manual`: the game does not open them as you walk up.
// Same controller as the sliding door ({group, amount, setOpen, update}) plus toggle(), isOpen and snap(open) (jump to open or shut without the swing).
// The leaves swing toward -z (into the room: rooms lie at lower z than their door), a quarter turn and a bit. The group's origin is the middle of the doorway on the floor.
const OPEN_ANGLE=1.5;
const woodMaterial=new T.MeshStandardMaterial({color:'#6e8073',roughness:.7});
function leaf({width,height,glass,hingeAt,handle=true}){ // a leaf whose hinge pivot is at hingeAt (-1 left, +1 right) and which extends toward the middle
 const pivot=new T.Group(),body=new T.Group(),dir=-hingeAt; // body.x runs from the hinge toward the other edge
 const bar=(w,h,d,x,y,m)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,0);body.add(mesh);return mesh};
 if(glass){bar(width-.12,height-.2,.03,dir*width/2,height/2,glassMaterial);bar(width,.1,.06,dir*width/2,.05,frameMaterial);bar(width,.1,.06,dir*width/2,height-.05,frameMaterial);bar(.08,height,.06,dir*.04,height/2,frameMaterial);bar(.08,height,.06,dir*(width-.04),height/2,frameMaterial);bar(.04,.7,.08,dir*(width-.14),height*.5,frameMaterial)} // push bar at the free edge
 else{bar(width,height,.06,dir*width/2,height/2,woodMaterial);if(handle)bar(.06,.1,.1,dir*(width-.12),height*.48,new T.MeshStandardMaterial({color:'#c8af70',roughness:.4,metalness:.4}))} // a handle (left off the interior doors of homes: they fade as one piece with their wall)
 pivot.add(body);return {pivot,dir,hingeAt};
}
function hinged(group,leaves,{closeSnap=.004}={}){
 let amount=0,target=0;const place=()=>{for(const l of leaves)l.pivot.rotation.y=-l.hingeAt*amount*OPEN_ANGLE};
 place();
 return {group,manual:true,
  get amount(){return amount},get isOpen(){return target===1},
  setOpen(open){target=open?1:0},toggle(){target=target?0:1;return target===1},
  snap(open){amount=target=open?1:0;place()},
  update(dt){if(amount===target)return;amount+=(target-amount)*Math.min(1,Math.max(0,dt)*8);if(Math.abs(target-amount)<closeSnap)amount=target;place()}};
}
export function createHingedDoor({width=1.2,height=2.2,glass=false,frame=true,handle=true}={}){
 const group=new T.Group(),l=leaf({width,height,glass,hingeAt:-1,handle});l.pivot.position.set(-width/2,0,0);group.add(l.pivot);
 if(frame){const f=(w,h,x,y)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,.12),frameMaterial);m.position.set(x,y,0);group.add(m)};f(width+.2,.1,0,height+.05);f(.08,height+.1,-width/2-.06,(height+.1)/2);f(.08,height+.1,width/2+.06,(height+.1)/2)}
 return hinged(group,[l]);
}
export function createDoubleDoor({width=2.2,height=2.5,glass=true}={}){
 const group=new T.Group(),half=width/2,leaves=[-1,1].map(hingeAt=>{const l=leaf({width:half-.01,height,glass,hingeAt});l.pivot.position.set(hingeAt*half,0,0);group.add(l.pivot);return l});
 const f=(w,h,x,y)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,.14),frameMaterial);m.position.set(x,y,0);group.add(m)};f(width+.34,.2,0,height+.1);for(const s of [-1,1])f(.12,height+.2,s*(half+.11),(height+.2)/2);
 return hinged(group,leaves);
}
