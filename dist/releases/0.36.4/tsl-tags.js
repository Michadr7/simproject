// TSL pallet tag atlas UV material (notes/webgpu-spike.md T3): twin of dist/pallet-tags.js:40.
import { PALLET_CAP } from './pallets.js';
import { tagCell } from './pallet-tags.js';

export function tagAtlasGrid() {
 const row0 = tagCell(1, false).row;
 let cols = 1;
 while (cols < PALLET_CAP && tagCell(cols + 1, false).row === row0) cols++;
 return { cols, rows: row0 + 1 };
}

export function createPalletTagMaterialTSL({ THREE, TSL, NodeMaterial, map = null, cols = null, rows = null } = {}) {
 const Mat = NodeMaterial || THREE?.MeshBasicNodeMaterial || THREE?.NodeMaterial || TSL?.NodeMaterial;
 const { varying, vec2, uv, attribute, texture } = TSL;
 const grid = cols && rows ? { cols, rows } : tagAtlasGrid();
 const tex = map || new THREE.Texture();
 const atlasUv = varying(uv().add(attribute('tagCell', 'vec2')).mul(vec2(1 / grid.cols, 1 / grid.rows)), 'vTagUv');

 const material = new Mat();
 material.name = 'pallet-tags-tsl';
 material.transparent = true;
 material.toneMapped = false;
 material.fog = false;
 material.lights = false;
 material.map = tex;
 material.colorNode = texture(tex, atlasUv);

 return { material, cols: grid.cols, rows: grid.rows, uvNode: atlasUv };
}
