import bpy
import os
import mathutils

def report_glb(filepath):
    # Reset to an empty scene
    bpy.ops.wm.read_factory_settings(use_empty=True)

    abs_path = os.path.abspath(filepath)
    if not os.path.exists(abs_path):
        print(f"ERROR: File not found: {abs_path}")
        return

    # Import GLB
    bpy.ops.import_scene.gltf(filepath=abs_path)

    mesh_objs = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']

    total_triangles = 0
    unique_materials = set()
    min_coord = [float('inf')] * 3
    max_coord = [float('-inf')] * 3

    for obj in mesh_objs:
        mesh = obj.data
        mesh.calc_loop_triangles()
        total_triangles += len(mesh.loop_triangles)

        for slot in obj.material_slots:
            if slot.material:
                unique_materials.add(slot.material.name)

        for corner in obj.bound_box:
            world_corner = obj.matrix_world @ mathutils.Vector(corner)
            for i in range(3):
                min_coord[i] = min(min_coord[i], world_corner[i])
                max_coord[i] = max(max_coord[i], world_corner[i])

    size = [max_coord[i] - min_coord[i] for i in range(3)]

    print("--- GLB REPORT ---")
    print(f"File: {os.path.basename(abs_path)}")
    print(f"Triangles: {total_triangles}")
    print(f"Material count: {len(unique_materials)}")
    print(f"Bounding box size (m): {size[0]:.3f} x {size[1]:.3f} x {size[2]:.3f} (W x D x H / X x Y x Z)")
    print("------------------")

if __name__ == '__main__':
    target = os.path.join("assets-src", "Farm", "sr90", "bale_round_hay.glb")
    report_glb(target)
