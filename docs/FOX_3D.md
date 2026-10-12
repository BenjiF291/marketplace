# Fox 3D prototype

Open `public/fox-3d-preview.html` through the project's HTTP server, or click **Try 3D fox** on its Companion Lodge card.

`fox-3d-model.js` creates an original procedural 3D fox with a sculpted torso/head, articulated head and ears, four skinned legs with foot placement, and a skinned tail. `createFox()` returns the entity, animation controller, animation clips, and disposal method. Its movement uses elapsed time; it needs no animal sprite frames. The preview lets you orbit, see the backside, walk/run around a clearing, pause, and export a GLB.

`public/assets/companions/fox-prototype-v1.glb` is the exported review asset with idle, walk and run clips. This is a prototype for judging 3D movement and styling, not a replacement for the island renderer or a finished battle mode. The other animals retain their existing artwork.

Three.js 0.186.1 is vendored locally in `public/vendor/three`; its MIT license is included there. The viewer loads only when opened. Close disposes its meshes, skins, textures, and renderer.
