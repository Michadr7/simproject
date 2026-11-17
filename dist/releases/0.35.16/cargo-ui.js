// The Cargo panel (0.35): opened with E at a bed that holds more than one kind of cargo. One row per kind ("Take a log · 2 on the bed", "Take planks · 7 on the bed") and the bulk
// actions that apply where you stand (unload all planks at the lumberyard, move planks to a waiting customer's truck). Click a row or press its number (1-9); Esc closes.
// UI only: rows come from the game (rows(): [{label, run, bulk?, disabled?}]; run() returns {close} to shut the panel, e.g. once your hands are full).
export function createCargoUI({document:doc,onOpen,onClose}){
 const $=id=>doc.getElementById(id);let opened=false,rowsOf=null;
 $('cargoOverlay').hidden=true;
 function render(){
  const rows=rowsOf?rowsOf():[];if(opened&&!rows.length){close();return}
  $('cargoRows').replaceChildren(...rows.map((r,i)=>{const b=doc.createElement('button');b.type='button';b.id='cargo-row-'+i;b.className='cargo-row'+(r.bulk?' cargo-bulk':'');b.disabled=!!r.disabled;b.textContent=(i<9?(i+1)+' · ':'')+r.label;b.onclick=()=>pick(i);return b}));
 }
 function pick(i){const r=rowsOf?.()[i];if(!r||r.disabled)return;const res=r.run()||{};if(res.close)close();else render()}
 function open(title,rows){rowsOf=rows;opened=true;$('cargoTitle').textContent=title;$('cargoOverlay').hidden=false;onOpen?.();render()}
 function close(){if(!opened)return;opened=false;rowsOf=null;$('cargoOverlay').hidden=true;onClose?.()}
 $('cargoClose').onclick=close;
 return {open,close,pick,render,get isOpen(){return opened},
  // a key while the panel is open: Digit1-9 picks a row, Escape closes; true if the key was used
  key(code){if(!opened)return false;if(code==='Escape'){close();return true}const m=/^Digit([1-9])$/.exec(code);if(m){pick(+m[1]-1);return true}return false}};
}
