# Tiara de estrellas para la Pasarela, hecha en Blender con un script (así se puede volver a generar igual).
# Es el ejemplo de "prenda con Blender" de docs/ASSETS.md: se puede correr dentro de Blender (Scripting → Abrir →
# Ejecutar) o sin abrir Blender:
#
#   blender --background --python herramientas/blender/tiara.py            (Blender 4.2 o más nuevo)
#   python3 herramientas/blender/tiara.py                                   (con el módulo bpy: pip install bpy)
#
# Convenciones (docs/ASSETS.md § Prendas con Blender):
#   - metros; el origen (0, 0, 0) es el ancla de la prenda (aquí "cabeza": la parte de arriba del cuello);
#   - el personaje mira hacia −Y en Blender (la vista "Frente", tecla 1 del teclado numérico). Al exportar, Blender
#     convierte Z-arriba a Y-arriba (glTF) y −Y queda como +Z, que es el frente en el juego;
#   - la cabeza es una esfera de radio 0.21 con centro en (0, 0, 0.19): se agrega como "referencia" (no se exporta);
#   - materiales llamados "principal" (toma el color que escoge Noelia) y "secundario" (el color secundario de la
#     prenda); cualquier otro nombre se queda con su color;
#   - menos de 2 000 triángulos por prenda.
import math
import os
import bpy

AQUI = os.path.dirname(os.path.abspath(__file__))
SALIDA = os.path.normpath(os.path.join(AQUI, "..", "..", "modelos", "tiara.glb"))

# Empezar de cero
bpy.ops.wm.read_factory_settings(use_empty=True)
escena = bpy.context.scene
escena.unit_settings.system = "METRIC"


def material(nombre, rgba):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = 0.4
    return m


principal = material("principal", (0.89, 0.69, 0.16, 1))   # dorado (el juego lo cambia por el color escogido)
secundario = material("secundario", (1.0, 0.49, 0.71, 1))  # rosa (el juego usa "secundario" de prendas.json)

# Referencia: la cabeza del personaje (en su propia colección, no se exporta)
ref = bpy.data.collections.new("referencia")
escena.collection.children.link(ref)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.21, location=(0, 0, 0.19), segments=24, ring_count=16)
cabeza = bpy.context.active_object
cabeza.name = "cabeza-referencia"
for c in cabeza.users_collection:
    c.objects.unlink(cabeza)
ref.objects.link(cabeza)

piezas = []

# Banda: medio aro sobre la cabeza, de oreja a oreja, un poco hacia el frente
bpy.ops.mesh.primitive_torus_add(major_radius=0.232, minor_radius=0.014, major_segments=32, minor_segments=8,
                                 location=(0, -0.03, 0.2), rotation=(math.radians(90 - 12), 0, 0))
banda = bpy.context.active_object
banda.name = "banda"
# Quitar la mitad de abajo del aro (los vértices con z menor que el centro)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="DESELECT")
bpy.ops.object.mode_set(mode="OBJECT")
for v in banda.data.vertices:
    mundo = banda.matrix_world @ v.co
    v.select = mundo.z < 0.19
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.delete(type="VERT")
bpy.ops.object.mode_set(mode="OBJECT")
banda.data.materials.append(principal)
piezas.append(banda)


def estrella(nombre, x, z, tam):
    """Estrella de 5 picos con volumen (un círculo de 10 vértices, picos y valles, extruido)"""
    malla = bpy.data.meshes.new(nombre)
    obj = bpy.data.objects.new(nombre, malla)
    escena.collection.objects.link(obj)
    import bmesh
    bm = bmesh.new()
    frente, atras = [], []
    for i in range(10):
        r = tam if i % 2 == 0 else tam * 0.45
        a = math.pi / 2 + i * math.pi / 5
        frente.append(bm.verts.new((math.cos(a) * r, -0.012, math.sin(a) * r)))
        atras.append(bm.verts.new((math.cos(a) * r, 0.012, math.sin(a) * r)))
    cf = bm.verts.new((0, -0.022, 0))
    ca = bm.verts.new((0, 0.022, 0))
    for i in range(10):
        j = (i + 1) % 10
        bm.faces.new((cf, frente[i], frente[j]))
        bm.faces.new((ca, atras[j], atras[i]))
        bm.faces.new((frente[i], atras[i], atras[j], frente[j]))
    bm.normal_update()
    bm.to_mesh(malla)
    bm.free()
    obj.location = (x, -0.17, z)
    obj.rotation_euler = (math.radians(-12), 0, 0)
    obj.data.materials.append(secundario)
    piezas.append(obj)


estrella("estrella-centro", 0.0, 0.43, 0.06)
estrella("estrella-izq", 0.11, 0.39, 0.04)
estrella("estrella-der", -0.11, 0.39, 0.04)

# Exportar solo la tiara (sin la referencia)
bpy.ops.object.select_all(action="DESELECT")
for p in piezas:
    p.select_set(True)
bpy.context.view_layer.objects.active = piezas[0]
os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=SALIDA,
    export_format="GLB",       # un solo archivo
    use_selection=True,        # solo lo seleccionado (no la cabeza de referencia)
    export_yup=True,           # Z-arriba de Blender → Y-arriba de glTF/Three.js
    export_apply=True,         # aplica modificadores
    export_texcoords=False,    # sin texturas: el color lo pone el juego
    export_normals=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
    export_animations=False,
)
tris = sum(len(p.data.loop_triangles) if p.data.calc_loop_triangles() is None else 0 for p in piezas)
print(f"Listo: {SALIDA} ({os.path.getsize(SALIDA)} bytes, {tris} triángulos)")
