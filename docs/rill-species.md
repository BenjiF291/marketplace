# Rill species

The nameless teal Rill species entry appears alongside Aeri. They share admin-edited species lore and origin, while rarity and Aeri's individual story remain separate. Unowned gallery portraits fade; details retain full color.

The supplied Meshy FBX is converted to `rill-species-source.glb`. `createRillSpecies()` adds 29 joints, an eight-second looping idle, planted talons, and movable crest, beak, head, wings and tail. `jointMap`, `applyPose`, `resetPose`, `clips` and `update(time, {idleWeight, pose, poseWeight})` support future attack animations. Export: `rill-species-rigged.glb`; preview: `/rill-species-3d-preview.html`.

Validation: `node --test --test-isolation=none rill-species-3d.test.js rill-3d.test.js creature-book-routes.test.js`; browser checks cover planted talons, loop seam, deformation, export, gallery/details, admin controls, mobile and loading visibility.
