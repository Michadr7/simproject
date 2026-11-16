michadr.

# PET1: cat model conversion (Blender only). Nothing was seen in three.js or the game.

## Licence record
Tripo Pro plan output (user's Pro plan). Source: Assets Sim Project\cat.blend (read only, never changed).

## Files
- Assets Sim Project\cat game.blend : working copy with the rig, weights and 5 actions (NLA tracks).
- Assets Sim Project\Cat Game.glb : 978,744 bytes (about 956 KB). Draco off, skin + animations on, texture embedded as 512 x 512 JPEG (q88).
- Assets Sim Project\cat previews\ : insp_*.png (source views), cat_rest/idle/walk_a/walk_b/eat/pet/sleep(+_top).png
- scripts\cat-finish.py (modes: build, render [names], glbcheck). No other repo file touched. No git, no tests, no index run.

## What the source is (looked at)
Grey/charcoal long-haired cat (Maine-coon type), white chest, belly, front and hind paws and muzzle, green eyes, a very fluffy tail. STANDING in a walking pose, side-on, facing -X in Blender (Z up). Source 1.0 x 0.29 x 0.525 m including the tail. The 23 vertex groups were NOT usable: 11 are 'tripo::...' names but 7 are anonymous 'bone_8..bone_21', there is no armature and no rest positions. So I built a new rig and new weights.
Oddities in the mesh (not fixed): a thin white fin/flap at the left hind thigh, a dark fur flap at the cheek/neck, Blender reports 'Mesh is not valid' (harmless in export). Mesh looks fine from the front/top.

## Numbers
- Mesh: ONE mesh 'Cat', 8,295 tris (unchanged), 4,485 source verts (9,795 in the GLB after UV/normal splits), 1 material, 1 primitive, max 4 joint influences per vertex.
- Size in the GLB: length nose to tail tip 0.726 m, nose to tail base about 0.45 m (the tail base x was estimated by eye from the side view, not measured per vertex: treat 0.45 as +-0.03), width 0.21 m, height to the ear tips 0.381 m. Feet on y = 0 (min y 0.000). Origin at the ground under the body centre (between the front and hind paws), faces +Z (glTF).
- Skin cost: 1 skinned mesh = 1 draw call, 24 bones, 9,795 verts x up to 4 influences. Fine for one cat; with many cats each is its own draw call and its own skeleton update (flag if more than a few are ever on screen).
- Bones (24): root, spine1, spine2, spine3, neck, head, ear.L, ear.R, tail1..tail4, front_upper/front_lower/front_paw .L and .R, hind_upper/hind_lower/hind_paw .L and .R. .L is the cat's left (+X in glTF).
- Weights: computed by my own distance-to-bone falloff (Blender's automatic weights gave the ear bone 1,670 vertices and left 79 unweighted, so I dropped them). 0 unweighted vertices.
- Clips (24 fps, first key = last key, so loops are seamless when the game plays them with LoopRepeat; every clip animates all 24 bones: 72 channels each, translation + rotation + scale):
  - idle 3.0 s (2 breaths, tail flick, one left-ear twitch, small head look)
  - walk 1.0 s (diagonal gait, spine/tail sway, in place: no root motion; one cycle = about 2 body lengths is NOT measured, the game should drive speed)
  - eat 2.0 s (head and neck down, chew 4 times, ear twitch, tail sway)
  - pet 2.0 s (head lifted and tilted into a hand, purr pulses at 6 Hz on the spine scale, ear twitches, body squash about 3 percent)
  - sleep 4.0 s (see below)
- Glb re-imported headless: 28 nodes, 1 skin with 24 joints, 1 material, 1 mesh, 1 image (image/jpeg), 5 animations with the right durations.

## What the previews show (viewed)
- rest/idle: clean standing cat, texture reads well at 512 (grey fur, white paws, green eyes).
- walk_a/walk_b: legs swing in a believable diagonal walk, paws lift. Flaws: the far hind paw dips about 1 to 2 cm below the ground at the back of the stride; the hind thigh blob (weights near the hip) stretches slightly; top view not judged beyond a glance.
- eat: head and neck come down well, chin about 0.14 m above the ground (limit of the mesh: the shoulders stop the head). The front paws sink about 1.5 cm into the ground in this pose. A bowl for this cat should therefore be raised about 10 cm (or the cat is placed on a low step), or the game lowers the bowl anchor; otherwise it reads as eating from a plate on a table or a tall dish.
- pet: head up, tilted, looks right; the purr pulses and squash are not visible in a still.
- sleep: NOT a lie-down. I did not attempt curling: the pose is the standing rest pose with head dropped, root 1.2 cm lower, slow breathing (about 2 percent chest scale) and a slow tail. As a sleeper it looks like a cat standing very still with its head lowered. If a real sleep is wanted, the legs need folding (loaf pose) and would need weight fixes; best done by hand in Blender or a second pass.
- Not viewed: front view of the clips, ear.R twitch, the 6 Hz purr, any crossfades.

## Node names the game should use
- Scene root node: 'CatRig' (the armature), child skinned mesh 'Cat' (one primitive, one material).
- Clip names: 'idle', 'walk', 'eat', 'pet', 'sleep'.
- Anchors (empties parented to the head BONE, so they follow the head): 'anchor_mouth' (nose tip, about 0.09 m above and 0.02 m behind the head bone tail in rig space; use it for a bowl alignment / food particles) and 'anchor_head' (above the skull). They export as child nodes of the 'head' bone node. No 'anchor_eat' beyond anchor_mouth, no hand/lap anchors yet.
- Bone nodes are named as listed above; skeleton root is 'root'.

## What PET3 (wiring) needs
1. Copy Cat Game.glb into the game assets via scripts/build-props.mjs or the rigged-assets path (like the rigged sawmill); the GLB is about 0.96 MB, of which about 0.3 MB is animation data (all 24 bones x TRS x 5 clips). If size matters, drop the scale/translation tracks on bones that never move (translation and scale are constant on most bones) in a post step.
2. Load with GLTFLoader through dist/rigged-props.js (SkinnedMesh, AnimationMixer; clips by name; set LoopRepeat; crossfade 0.2 to 0.3 s between clips since poses differ).
3. Forward is +Z, up +Y, metres, 0.45 m body. Ensure the mixer clock uses frame-rate-independent dt.
4. Frustum culling: for skinned meshes in three.js set frustumCulled = false or compute the bounding sphere after posing (the tail reaches 0.5 m behind the origin).
5. Eat: the bowl needs to be about 10 cm tall or the mesh will intersect the ground (see above).
6. Nothing here was tested in three.js: confirm the JPEG image, the quaternion order and the NLA-exported clip names load as expected.

## Unverified / confidence
- High: geometry, scale, orientation, texture, bone and clip counts, durations (read back from the GLB JSON).
- Medium: walk and idle deformation (looked at one or two frames each, side view only).
- Low: eat height vs a bowl, sleep (not a real sleep pose), in-game look and cost.
- Re-run: blender -b --python scripts/cat-finish.py -- build ; then -- render ; then -- glbcheck.