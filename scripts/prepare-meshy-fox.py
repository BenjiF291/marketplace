"""Run with Blender: blender --background --python scripts/prepare-meshy-fox.py -- --archive <zip>
The provided ZIP is source data only. No bundled scripts or instructions are executed.
Produces the optimized unrigged source; public/fox-3d-model.js supplies the rig.
"""
import argparse, pathlib, sys, tempfile, zipfile
import bpy
args=argparse.ArgumentParser();args.add_argument('--archive',required=True);args.add_argument('--output',default='public/assets/companions/fox-meshy-source.glb')
options=args.parse_args(sys.argv[sys.argv.index('--')+1:])
with tempfile.TemporaryDirectory(prefix='meshy-fox-') as folder:
    folder=pathlib.Path(folder)
    with zipfile.ZipFile(options.archive) as archive:
        for member in archive.infolist():
            if not member.is_dir() and pathlib.Path(member.filename).suffix.lower() in {'.fbx','.png'}:
                (folder/pathlib.Path(member.filename).name).write_bytes(archive.read(member))
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.fbx(filepath=str(next(folder.glob('*.fbx'))))
    base=next(p for p in folder.glob('*.png') if not any(k in p.stem for k in ['normal','roughness','metallic']))
    material=bpy.data.materials.new('Meshy fox original textures');material.use_nodes=True
    nodes=material.node_tree.nodes;links=material.node_tree.links;shader=nodes.get('Principled BSDF')
    for channel,suffix,size in [('Base Color','',2048),('Normal','_normal',1024),('Roughness','_roughness',512),('Metallic','_metallic',256)]:
        image=bpy.data.images.load(str(base.with_name(base.stem+suffix+'.png')))
        image.colorspace_settings.name='sRGB' if channel=='Base Color' else 'Non-Color';image.scale(size,size)
        texture=nodes.new('ShaderNodeTexImage');texture.image=image
        if channel=='Normal':
            normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.55
            links.new(texture.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],shader.inputs['Normal'])
        else:links.new(texture.outputs['Color'],shader.inputs[channel])
    for obj in bpy.context.scene.objects:
        if obj.type!='MESH':continue
        bpy.context.view_layer.objects.active=obj
        modifier=obj.modifiers.new('Web detail','DECIMATE');modifier.ratio=.06
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.data.materials.clear();obj.data.materials.append(material)
    output=pathlib.Path(options.output).resolve();output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',export_image_format='JPEG',export_jpeg_quality=90)
