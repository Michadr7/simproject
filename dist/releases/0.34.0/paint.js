// Vehicle paint colours (0.34). The converted models carry one painted texture each; a colour is a hue, saturation and brightness change applied only to the paint
// pixels in the fragment shader (driving.js applyPaint), so every colour costs no extra triangles or textures. Pure data and lookups: tests/paint.mjs.
// `src` is the model's own paint hue in degrees and `band` how far from it a pixel still counts as paint (windows, tyres, lights and chrome are left alone).
// A colour: {id, name, swatch (the UI chip), hue (degrees, or null to keep the model's own), sat, val (multipliers, default 1)}.
export const PAINT=Object.freeze({
 worktruck:{src:85,band:50,colours:[
  {id:'olive',name:'Army olive',swatch:'#6b7a45',hue:null},
  {id:'red',name:'Barn red',swatch:'#b3362b',hue:4,sat:1.7,val:1.8},
  {id:'blue',name:'Work blue',swatch:'#2f5f9e',hue:228,sat:1.7,val:1.5},
  {id:'yellow',name:'Site yellow',swatch:'#e0b21d',hue:48,sat:1.7,val:1.7},
  {id:'black',name:'Black',swatch:'#222222',hue:null,sat:.1,val:.4},
  {id:'white',name:'White',swatch:'#e8e8e4',hue:null,sat:.08,val:2}]},
 offroad:{src:118,band:45,colours:[
  {id:'green',name:'Trail green',swatch:'#2fb51a',hue:null},
  {id:'red',name:'Rally red',swatch:'#c4301f',hue:4,sat:1,val:1.05},
  {id:'blue',name:'Sky blue',swatch:'#2a6fcf',hue:225,sat:1.1,val:1.05},
  {id:'orange',name:'Sunset orange',swatch:'#e8741b',hue:24,sat:1,val:1.15},
  {id:'black',name:'Black',swatch:'#202020',hue:null,sat:.1,val:.35},
  {id:'white',name:'White',swatch:'#ececec',hue:null,sat:.06,val:1.9}]}
});
export const coloursOf=model=>PAINT[model]?.colours||[];
export const defaultColour=model=>coloursOf(model)[0]?.id||null;
export const colourOf=(model,id)=>coloursOf(model).find(c=>c.id===id)||null;
export const validColour=(model,id)=>!!colourOf(model,id);
// The shader numbers for a colour: {hue: 0..1 or -1 (keep), sat, val, src: 0..1, band: 0..1}.
export function paintUniforms(model,id){
 const p=PAINT[model],c=colourOf(model,id)||p?.colours[0];if(!p||!c)return {hue:-1,sat:1,val:1,src:0,band:0};
 return {hue:c.hue===null||c.hue===undefined?-1:((c.hue%360)+360)%360/360,sat:c.sat??1,val:c.val??1,src:p.src/360,band:p.band/360};
}
