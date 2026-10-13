# Supplied crystal-shell snail

The snail uses `Meshy_AI_Crystal_Shell_Snail_1013165407_image-to-3d-texture_fbx.zip`, supplied by the user. The FBX contains a textured mesh without bones or skin deformers. Conversion uses `scripts/prepare-meshy-model.py` and portable Blender 4.5, preserving the original shape and UVs with resized color, normal, roughness, and metallic maps in `public/assets/companions/snail-meshy-source.glb`.

`public/snail-3d-model.js` adds a 22-joint rig: body root, rigid shell, head, nine foot-wave joints, six upper-feeler joints, and four lower-feeler joints. Shell plates and crystals stay rigid. The low underside stays planted while the upper foot gently contracts; the head and feelers move independently. Eyestalk tips remain rigid to avoid distorting their bulbs. There are no humanoid expressions or leg-style footsteps.

The three exported clips are idle, crawl, and fast_crawl in `public/assets/companions/snail-meshy-rigged.glb`. The shared model update contract uses idle/walk/run for compatibility with companion activity states. On the island, the snail moves more slowly than the fox and its contraction phase follows actual travelled distance. Stopping blends back to idle. Pet-room walking uses the crawl animation too.

All three companion kinds now use their supplied 3D models directly through `companionArt`. They share one WebGL context with separate rigs, source caches, and clocks. Transparent portraits cover loading or unavailable WebGL. Hidden portraits do not render, and removed rigs dispose their instance geometry, materials, and skeletons.

Open `/snail-3d-preview.html` or **Try 3D snail** in the Companion Lodge navigation. The viewer supports idle, crawl, faster crawl, travel, look back, all viewing directions, and animated GLB download.

Run `node --test --test-isolation=none snail-3d.test.js dragon-3d.test.js fox-3d.test.js`. These tests cover valid skin weights, dedicated shell/foot/feeler joints, rigid shell attachment, and seamless exported loops. Browser checks measure actual rigid-shell distances, foot contractions, feeler motion, ground contact, smooth transitions, all viewing angles, desktop/mobile shared rendering, cleanup, actual island movement, and all three Lodge previews.
