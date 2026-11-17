# Character skeleton contract (for the build agent and Tripo/Blender)

Source of truth: dist/character.js (376 lines, loader + animation + IK), dist/appearance.js (59, pure data), scripts/build-characters.mjs (builds dist/character-male.js and dist/character-female.js, each a base64 GLB, 1.9 MB and 1.5 MB). Written 2026-11-16 from the code and from the packed GLBs (bone, clip, mesh and material names below were read out of the files).

## What exists today (do not rebuild what is already modular)
The game already has a modular character: the Quaternius Ultimate Modular Men/Women packs (CC0). One GLB per body type (male, female). Each GLB is ONE skeleton plus swappable skinned meshes. The creator picks one outfit id per part. New Tripo/Blender bodies must fit this contract or character.js changes with them.

## Files and loading
- character-<male|female>.js: `export default` a base64 GLB. loadCharacterAssets() decodes both once (GLTFLoader.parseAsync), extract() builds {rigRoot, bones, boneInverses, parts, clips}. Until loaded, createCharacter returns a capsule stand-in (`fallback:true`).
- GLB scene root node is named `character`. rigRoot = the top-level node containing skeleton.bones[0]; every other top-level node is a part.
- A part is a top-level node named `<OutfitId>__<Slot>`; its skinned meshes share the one skeleton. Parts are cached as {geometry, material, bindMatrix}; createCharacter clones the rig, builds a new Skeleton on the cloned bones, and creates SkinnedMeshes per chosen part (castShadow on, frustumCulled off, mesh.name = `<id>__<Slot>`).

## Slots (the 4 swappable parts, appearance.js PART_KEYS)
| key | node suffix | what it is |
| head | `__Head` | head with face, eyes, eyebrows AND the hair/hat (hair is part of the head mesh) |
| top | `__Body` | torso and arms (sleeves) |
| legs | `__Legs` | trousers/skirt |
| feet | `__Feet` | shoes |
Outfit ids: male Casual_Hoodie, Casual_2, Suit, Worker, Farmer, Beach, Punk, Adventurer (8 x 4 = 32 meshes); female Casual, Formal, Suit, Worker, Punk, Adventurer (6 x 4 = 24). Any part can mix from any outfit of the same body type. Saved look = {name, body, head, top, legs, feet, skin, hair} (key edenridge.character.v1, version 2).

## Tinting (how skin tone and hair colour work today)
- Materials carry `extras.role`: `skin` or `hair`. createCharacter clones those materials and sets `color` from appearance.skin / appearance.hair. Eyebrows (name matches /^eyebrows/i or userData.brows) use the hair colour x 0.7.
- Palettes (appearance.js): skin Fair #edc9ae, Light #d9ae8d, Medium #b88f72, Tan #a67350, Brown #79513c, Deep #4b332b; hair Black, Brown, Chestnut, Blond, Auburn, Gray.
- Male materials with a role: Skin, Eyebrows, Hair, Moustache. Female: Skin, Hair_Brown, Hair_Blond, DarkBrown (the women's pack left some hair untagged: tagFemaleHair() in character.js retags it at load, Formal's hair material "Red" and the eyebrow material "Brown"; fix by tagging in Blender instead).
- Rule for new meshes: flat/lightly shaded material named for its role, role set in glTF extras, colour is the multiplier. No per-tone textures.

## Skeleton (62 joints, identical for male and female, same order)
Root, Body, Hips, Abdomen, Torso, Chest, Neck, Head,
ShoulderL, UpperArmL, LowerArmL, WristL, Index1-4L, Middle1-4L, Ring1-4L, Pinky1-4L, Thumb1-3L (the same for R),
UpperLegL, LowerLegL, UpperLegR, LowerLegR, FootL, PTL, FootR, PTR.
Code looks bones up BY NAME, so these exact names are the contract. Bones the code depends on: Body (hips drop for crouch/sit), Abdomen/Torso/Chest (lean, arm-swing twist), Head (+ optional Head_end: absent in both packs, code falls back to 22 cm above Head), UpperArm/LowerArm/Wrist L+R (two-bone arm IK for reaching, tools, carrying), fingers Index/Middle/Ring/Pinky 1-4 and Thumb 1-3 (grip curl, taken from the Sprint clip's fist), UpperLeg/LowerLeg L+R and FootL/FootR (two-bone leg solve toward the animated foot control bones; PTL/PTR are the pole targets). The hand socket (`hand-socket`) is created in code under WristL/WristR, not a bone in the file.

## Animation clips (in each GLB, names exact)
Idle, Idle_Neutral, Walk, Run, Sprint, Interact, Wave.
Speeds at normal playback: Walk 1.5 u/s, Run 4.4 u/s (Sprint above 6.2). Idle loops are closed in code (closeLoop). Leg poses come from the foot control bones, not from the baked leg rotations.
Procedural on top of the clips (so a new rig must keep the bones above): arm swing, spine lean, crouch, seated pose, held-item hand alignment, two-handed grip, hand reach to mouth.

## Scale and origin
- Pack is authored in centimetres, about 187 units high. MODEL_SCALE = 0.0104 gives about 1.95 m. SOLE_LIFT = 0.012 m lifts the group so the soles sit on the ground (soles hang 1.4-2.0 cm below the origin in the pack). Origin at the feet. +Z is forward. Bind pose is a T-pose (idle is shown after mixer.update(0)).

## What a Tripo/Blender replacement must deliver
1. A GLB with scene root `character`, the 62-joint skeleton above (same names, same hierarchy, rest pose compatible with the pack's clips), and the 7 clips, OR new meshes weighted to a copy of the pack's armature so the clips keep working (recommended: retarget by weighting to the existing armature, do not make a new one).
2. Parts as top-level nodes `<Id>__Head|Body|Legs|Feet`, each skinned to that armature. Skin and hair materials with extras.role. No hair outside the Head part unless the code gains a 5th slot.
3. A body that fits the existing clothing slots, or the clothing slots become the new base: if the base body is a separate mesh under clothes, hide body faces under clothes (the current packs avoid this by having each outfit's parts include the skin they show).
4. Budget: draw calls and materials matter more than triangles (soft caps). Today a character is 4 skinned meshes plus eye/skin materials.
5. Test hooks: tests/character.mjs, tests/carry-pose.mjs, tests/waist.mjs, tests/creator.mjs read these files; run them after any change.

## Open design points for the owner
- Hair is baked into the head part today. Separate hair needs a 5th slot (appearance.js PART_KEYS, creator UI, saves) and head meshes without hair.
- Separate underwear/base body + clothing layers needs masking rules the current packs do not have.
- Crowd NPCs share the same builder; the plan for baked crowd meshes is not built.
