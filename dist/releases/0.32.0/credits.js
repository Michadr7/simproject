// Credits for every model and library in the game, shown on the Controls panel (Credits). `covers` lists the source folders or files (as recorded in props-assets.js and nature-assets.js)
// each entry accounts for: a test fails if a shipped model is not covered, so a new asset cannot ship without its credit. CC-BY items must say who made them, the licence and a link.
export const CREDITS=Object.freeze([
 {who:'Kenney',what:'City Kit (Suburban): the houses. City Kit (Commercial): the shops and offices. Furniture Kit: the furniture inside the houses.',licence:'CC0 1.0',url:'https://kenney.nl',covers:['kenney-suburban/','kenney-commercial/','kenney-furniture/']},
 {who:'Quaternius',what:'Stylized Nature MegaKit (the trees), Ultimate Modular Men and Women (the characters), the farm buildings, the cars and the Hut.',licence:'CC0 1.0',url:'https://quaternius.com',covers:['quaternius-farm/','quaternius-cars/','polypizza/Hut_by_Quaternius.glb','nature/','characters/']},
 {who:'Poly Pizza',what:'The Store and the Wood Log (authors not recorded; both published for free use on Poly Pizza).',licence:'as published on Poly Pizza',url:'https://poly.pizza',covers:['polypizza/Store.glb','polypizza/Wood_Log.glb']},
 {who:'SpawnCamp Games',what:'Low-poly flatbed truck.',licence:'free to use, credit given',url:'https://spawncampgames.itch.io/lowpoly-flatbed-truck',covers:['vehicles/Flatbed.fbx']},
 {who:'CGTrader free model',what:'Pickup truck (author not recorded).',licence:'CGTrader royalty-free licence',url:'https://www.cgtrader.com',covers:['vehicles/Pickup.fbx']},
 {who:'Tripo',what:'The sawmill: a Tripo v1 model, edited in Blender.',licence:'generated model, personal project',url:'https://www.tripo3d.ai',covers:['tripo/sawmill.glb']},
 {who:'three.js',what:'The 3D engine (r160).',licence:'MIT',url:'https://threejs.org',covers:[]},
 {who:'meshoptimizer',what:'Mesh simplification used while converting models.',licence:'MIT',url:'https://github.com/zeux/meshoptimizer',covers:[]}
]);
export const creditFor=source=>CREDITS.find(c=>c.covers.some(prefix=>source.startsWith(prefix)))||null;
