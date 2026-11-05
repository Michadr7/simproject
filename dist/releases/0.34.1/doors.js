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
