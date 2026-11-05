import bpy,pathlib,json,math
from mathutils import Vector
root=pathlib.Path.cwd();source=root/'.ui-tools/kanji-source'
import tempfile
task_temp=root/'.ui-tools/kanji-temp';task_temp.mkdir(exist_ok=True);tempfile.tempdir=str(task_temp);bpy.context.preferences.filepaths.temporary_directory=str(task_temp)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
fbx=next(source.glob('*.fbx'));bpy.ops.import_scene.fbx(filepath=str(fbx))
info=[]
for o in bpy.context.scene.objects:
 if o.type=='MESH':
  points=[o.matrix_world@Vector(v) for v in o.bound_box]
  info.append({'name':o.name,'verts':len(o.data.vertices),'polygons':len(o.data.polygons),'min':[min(v[i] for v in points) for i in range(3)],'max':[max(v[i] for v in points) for i in range(3)],'modifiers':[m.type for m in o.modifiers]})
print('SOURCE_INSPECTION',json.dumps(info),flush=True)
base=next(p for p in source.glob('*.png') if not any(k in p.stem for k in ['normal','roughness','metallic']))
mat=bpy.data.materials.new('Kanji original Meshy textures');mat.use_nodes=True;n=mat.node_tree.nodes;l=mat.node_tree.links;bsdf=n.get('Principled BSDF')
for channel,suffix,limit in [('Base Color','',2048),('Normal','_normal',1024),('Roughness','_roughness',512),('Metallic','_metallic',256)]:
 image=bpy.data.images.load(str(base.with_name(base.stem+suffix+'.png')));image.colorspace_settings.name='sRGB' if channel=='Base Color' else 'Non-Color';image.scale(limit,limit);tex=n.new('ShaderNodeTexImage');tex.image=image
 if channel=='Normal':
  normal=n.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.55;l.new(tex.outputs['Color'],normal.inputs['Color']);l.new(normal.outputs['Normal'],bsdf.inputs['Normal'])
 else:l.new(tex.outputs['Color'],bsdf.inputs[channel])
for o in bpy.context.scene.objects:
 if o.type=='MESH':
  o.data.materials.clear();o.data.materials.append(mat);bpy.context.view_layer.objects.active=o
  if len(o.data.polygons)>40000:
   mod=o.modifiers.new('Web silhouette detail','DECIMATE');mod.ratio=40000/len(o.data.polygons);bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.export_scene.gltf(filepath=str(root/'public/assets/creatures/kanji-source.glb'),export_format='GLB',export_image_format='JPEG',export_jpeg_quality=90)
