"""Optimize a supplied GLB as mesh data; retain UVs and material textures."""
import argparse,pathlib,sys,bpy
p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--output',required=True);p.add_argument('--ratio',type=float,default=.10)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=a.input)
for obj in bpy.context.scene.objects:
 if obj.type!='MESH':continue
 bpy.context.view_layer.objects.active=obj
 m=obj.modifiers.new('Web detail','DECIMATE');m.ratio=a.ratio
 bpy.ops.object.modifier_apply(modifier=m.name)
 print('MESH',obj.name,len(obj.data.vertices),len(obj.data.polygons),flush=True)
for image in bpy.data.images:
 if image.size[0]>2048 or image.size[1]>2048:
  factor=2048/max(image.size);image.scale(round(image.size[0]*factor),round(image.size[1]*factor))
bpy.ops.export_scene.gltf(filepath=str(pathlib.Path(a.output).resolve()),export_format='GLB',export_image_format='JPEG',export_jpeg_quality=90)
