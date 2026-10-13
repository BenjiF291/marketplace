# Supplied Meshy dragon

The dragon uses the user's `Meshy_AI_Stylized_Teal_Purple__1013161626_image-to-3d-texture_fbx.zip`. The FBX is a textured mesh without bones or skin deformers. The original mesh and UVs are preserved in `public/assets/companions/dragon-meshy-source.glb`, simplified to about 94,000 triangles with resized color, normal, roughness, and metallic textures. This browser source is approximately 3.4 MB.

Reproduce conversion with Blender 4.5: `blender --background --python scripts/prepare-meshy-model.py -- --archive <zip> --output public/assets/companions/dragon-meshy-source.glb --name Dragon`. The ZIP is read as mesh/texture data; no bundled scripts or instructions are executed.

`public/dragon-3d-model.js` adds an anatomical 29-joint rig: torso, head, four joints per wing, three joints per leg, and seven tail joints. Joint placement uses the supplied mesh's actual coordinates. Low toe vertices follow their own feet, outer membranes follow wing bones, and the face follows the head. Wings and tail have separate weights so their movement does not drag the face or lower legs.

The helper exports `createDragon()` with the same root/update/clips/dispose interface as the fox. Idle includes subtle head, wing, and tail movement. Walking has a four-beat grounded stance and lifted return swing; running is faster. Flight blends into wingbeats, tucked legs, and a raised body; stopping blends back to the rest pose. Clips are exported as idle/walk/run/fly in `public/assets/companions/dragon-meshy-rigged.glb`. These are hand-authored skin weights and procedural animation, not a pre-existing rig from the archive.

`companionArt('pet:dragon')` displays this model directly throughout the game. The fox and dragon share one WebGL renderer while keeping separate rigs, clocks, and source caches. Hidden portraits do not render and removed rigs dispose their instance resources. The snail now also uses its supplied 3D model; see `SNAIL_3D.md`. The island dragon uses flight while moving and lands when stopped; pet-room movement uses its walking gait. A transparent model portrait covers loading or unavailable WebGL.

Open `/dragon-3d-preview.html` or **Try 3D dragon** in the Companion Lodge navigation. The full viewer supports all four movements, travel, look back, viewing from behind, and downloading the animated GLB. The fox's existing viewer remains available.

Validation: `node --test --test-isolation=none dragon-3d.test.js fox-3d.test.js` checks valid skin weights, toe attachments, wing/head separation, and seamless exported clips. Browser checks measure actual skinned toe lift and stationary stance, wing displacement, smooth transitions, all viewpoints, mobile layout, shared portrait rendering, disposal, island flight/landing, and both Lodge viewers.
