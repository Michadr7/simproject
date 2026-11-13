# Grab3D base characters: what the two files really contain (measured 2026-11-12)

Measured by reading the GLB headers (JSON chunk) of `assets-src/Character/man-base-character.glb` and `woman-base-character.glb`. Nothing was converted, run in Blender or changed. Use these facts first; do not open the 12 MB binaries to find them again.

| | man | woman |
|---|---|---|
| file size | 11.8 MB | 12.6 MB |
| generator | glTF-Transform 4.5.1 | glTF-Transform 4.5.1 |
| nodes / meshes | 1 / 1 | 1 / 1 |
| mesh parts | 1 primitive, one mesh named `man-base-character` | 1 primitive, one mesh named `woman-base-character` |
| triangles | 262,348 | 305,702 |
| vertices | 143,446 | 166,130 |
| skeleton (skins) | none | none |
| animation clips | none | none |
| materials | 1 (`Material_0`) | 1 (`Material_0`) |
| textures | 3 JPEG images, embedded | 3 JPEG images, embedded |
| height (mesh space, metres) | 0 to 1.80 | 0 to 1.68 |
| width x depth | 1.08 x 0.34 (arms out) | 0.90 x 0.30 (arms out) |

## What this means
- Both files are **one static, unskinned mesh**: no bones, no head/top/legs/feet parts, no hands that can be told apart, no clips. They cannot walk, hold a tool, chop or sit as they are.
- They are far above the budget: the Quaternius characters in the game are a few thousand triangles each and 1.4 to 1.8 MB embedded. These are 260,000 and 300,000 triangles (about 80 to 100 times more) and 12 MB.
- A width of 0.9 to 1.08 m against a height of 1.7 to 1.8 m says the arms are held out: a T-pose or a wide A-pose. This is a guess from the bounds, not seen in a picture.
- One material means no separate skin, hair or clothing tint without painting or splitting the mesh.
- The asset register notes (`assets-register.json`) said "Light GLB 131k triangles; the rigged copy is a separate download". These files are 262k and 306k, so they are probably not that light copy.

## What would be needed before they can replace the Quaternius bodies
1. A **rigged** copy (the site says one exists as a separate download), or rigging these in Blender or with a rigging service.
2. A **decimated** body of a few thousand triangles, with the three textures baked down to game size.
3. Animation clips for at least Idle, Walk and Run, on the same skeleton.
4. A decision between a fixed-look body beside the Quaternius ones, or a modular one (the file is not modular today).

Not checked: the pose in a picture, the texture sizes in pixels, the normals, and the licence text.