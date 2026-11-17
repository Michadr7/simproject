import * as T from './vendor/three.module.js';
export function polishWorld(scene,box,label,trees){
 function texture(kind){const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');let seed=91;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};ctx.fillStyle=kind==='brick'?'#9b725b':kind==='paving'?'#bcb9a9':'#62686a';ctx.fillRect(0,0,256,256);
 for(let i=0;i<6500;i++){ctx.fillStyle=random()>.5?'#ffffff0b':'#0000000b';ctx.fillRect(random()*256,random()*256,2,2)}
 if(kind==='brick'){for(let y=0;y<256;y+=32){ctx.fillStyle='#c4b3a0';ctx.fillRect(0,y,256,2);for(let x=-64;x<256;x+=64)ctx.fillRect(x+(y/32%2)*32,y,2,32)}}
 if(kind==='paving'){ctx.strokeStyle='#8f9288';ctx.lineWidth=2;for(let n=0;n<256;n+=128){ctx.strokeRect(n,0,128,128);ctx.strokeRect(n,128,128,128)}}
 const tex=new T.CanvasTexture(c);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return tex;
 }
 const brick=texture('brick'),paving=texture('paving'),asphalt=texture('asphalt');
 scene.traverse(m=>{if(!m.isMesh||!m.geometry.parameters)return;const p=m.geometry.parameters;if(p.width===17&&p.height===17&&p.depth===13){m.material=m.material.clone();m.material.color.set('#ffffff');m.material.map=brick;brick.repeat.set(7,7)}if(p.height<.3&&p.width!==180&&(p.width>40||p.width===16||p.width===5)){m.material=m.material.clone();const map=(p.depth===19||p.width===16)?asphalt.clone():paving.clone();map.needsUpdate=true;map.repeat.set(p.width/4,p.depth/4);m.material.map=map;m.material.color.set('#ffffff')}});
 // Market frontage: framed glazing, striped canopy, recessed-looking display.
 for(let i=0;i<20;i++){const awning=box(.72,.10,1.55,12.1+i*.72,3.1,-7.8,i%2?'#d9d0ae':'#4b6656');awning.rotation.x=.14;box(.72,.24,.08,12.1+i*.72,2.85,-7.03,i%2?'#d9d0ae':'#4b6656')}
 label('FRESH PRODUCE',19,2.85,-6.98,3.4,0,'#4b6656','#ded9bd',.18);
 for(const x of [13,25]){box(1.2,.52,.7,x,.45,-7.2,'#856746');for(let i=0;i<4;i++)for(let j=0;j<2;j++){const fruit=new T.Mesh(new T.SphereGeometry(.12,8,6),new T.MeshStandardMaterial({color:x===13?'#a99f51':'#a65d45',roughness:.9}));fruit.position.set(x-.4+i*.26,.78,-7.4+j*.27);scene.add(fruit)}}
 // Apartment frontage and handrails, avoiding the entrance opening.
 for(const x of [-5,7]){box(1.4,.65,.7,x,.45,-7.4,'#b4ab94');for(let i=0;i<3;i++){const plant=new T.Mesh(new T.IcosahedronGeometry(.45,1),new T.MeshStandardMaterial({color:'#607a4d'}));plant.position.set(x-.4+i*.4,1,-7.4);scene.add(plant)}}
 for(const x of [-5,-2,4,7])for(const y of [5,7.8,10.6,13.4]){box(1.4,.1,.65,x,y-.85,-8.15,'#c4b59b');box(1.4,.05,.05,x,y-.4,-7.85,'#394a43');for(const dx of [-.65,-.3,.3,.65])box(.035,.45,.035,x+dx,y-.63,-7.85,'#394a43')}
 // A little visual variety without adding more scene meshes per tree.
 trees.forEach((tree,i)=>{const geo=tree.canopy.geometry;const pos=geo.attributes.position;for(let j=0;j<pos.count;j++){const x=pos.getX(j),y=pos.getY(j),z=pos.getZ(j);const f=1+.13*Math.sin(x*4+z*3+i);pos.setXYZ(j,x*f,y*(1+.07*Math.cos(z*5+i)),z*f)}geo.computeVertexNormals();tree.canopy.material.color.set(i%2?'#6d8559':'#58774e')});
}
