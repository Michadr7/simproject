// Mikkadr Hub, P3c: what the viewer's compare mode says about two assets. Pure (no three.js, no DOM), served as /compare.js and pinned by tests/assets-viewer.mjs.
// A "fact set" is {name, stage, pack, triangles, size:{w,d,h}|null}; the viewer builds one per asset from the catalog, overridden by the measurement of the model it actually built.
export const PLAYER_HEIGHT=1.95;

export function factsOf(asset,measured){
 const m=measured||{};
 return {name:asset.name,stage:asset.stage,pack:asset.pack,triangles:m.triangles??asset.triangles??null,size:m.size||asset.size||null};
}

const times=x=>x>=10?Math.round(x).toLocaleString('en-US'):(Math.round(x*10)/10).toString();

// "B has 2.4 times the triangles of A", "about the same", or a note when a number is unknown. `small`: ratios below this count as "about the same".
export function ratioLine(what,nameA,nameB,a,b,small=1.05){
 if(a==null||b==null||a<=0||b<=0)return `${what}: unknown for ${a==null||a<=0?nameA:nameB}`;
 const r=b/a;
 if(r<small&&r>1/small)return `${what}: about the same (${nameA} and ${nameB})`;
 return r>=1?`${nameB} has ${times(r)} times the ${what.toLowerCase()} of ${nameA}`:`${nameA} has ${times(1/r)} times the ${what.toLowerCase()} of ${nameB}`;
}

export function compareFacts(A,B){
 const lines=[];
 lines.push(ratioLine('Triangles',A.name,B.name,A.triangles,B.triangles));
 if(A.size&&B.size){
  lines.push(ratioLine('Height',A.name,B.name,A.size.h,B.size.h));
  const fa=A.size.w*A.size.d,fb=B.size.w*B.size.d;
  lines.push(ratioLine('Floor area',A.name,B.name,fa,fb));
 }
 for(const f of [A,B])if(f.size)lines.push(`${f.name} is ${times(f.size.h/PLAYER_HEIGHT)} ${f.size.h/PLAYER_HEIGHT===1?'time':'times'} the player's height`);
 return {lines,triRatio:A.triangles>0&&B.triangles>0?B.triangles/A.triangles:null,heightRatio:A.size&&B.size&&A.size.h>0?B.size.h/A.size.h:null};
}

// Where two models stand side by side: centres along x with `gap` metres between their edges, and the middle of the gap for the 1.95 m figure.
export function sideBySide(wA,wB,gap=2.2){
 const total=wA+gap+wB;
 return {a:-total/2+wA/2,b:total/2-wB/2,gapCentre:-total/2+wA+gap/2,total};
}
