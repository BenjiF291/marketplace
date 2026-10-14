# Defender Rill

Nameless armored teal bird in the creature book, with independent admin-edited description, origin and rarity. Unowned gallery portraits fade; details retain full color.

The supplied GLB is optimized as `defender-rill-source.glb`. `createDefenderRill()` supplies an anatomical skin and an eight-second idle loop, exposing `jointMap`, `applyPose`, `resetPose`, `clips` and `update(time, {idleWeight, pose, poseWeight})` for future battle animation. Preview: `/defender-rill-3d-preview.html`; export: `defender-rill-rigged.glb`.

Validation: `node --test --test-isolation=none defender-rill-3d.test.js creature-book-routes.test.js`. Browser checks cover planted talons, loop, deformation, export, book entry, mobile layout and admin controls.
