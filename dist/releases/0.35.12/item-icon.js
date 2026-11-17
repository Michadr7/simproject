// Item pictures (user feedback 2026-11-06: "items in the inventory need to match the actual item"): tools and materials show a picture rendered from their real held model (item-icons.js,
// written by `npm run icons`); food, drinks and clothes keep their emoji. The picture is a CSS background (--icon), so any element can wear it and a fake page in a test still works.
import {ITEM_ICONS} from './item-icons.js';

const pictureOf=(el,item)=>ITEM_ICONS[item?.id]&&el?.style?.setProperty?ITEM_ICONS[item.id]:null;
// an icon on its own: the element becomes the picture (or holds the emoji)
export function fillIcon(el,item){
 const src=pictureOf(el,item);if(!src){el.textContent=item.icon;return}
 el.textContent='';el.style.setProperty('--icon','url("'+src+'")');el.className=(el.className?el.className+' ':'')+'has-picture';el.title=item.name;
}
// a text label with the icon in front of the name
export function iconLabel(el,item){
 const src=pictureOf(el,item);if(!src){el.textContent=item.icon+' '+item.name;return}
 el.textContent=item.name;el.style.setProperty('--icon','url("'+src+'")');el.className=(el.className?el.className+' ':'')+'has-icon';
}
export const hasPicture=id=>!!ITEM_ICONS[id];