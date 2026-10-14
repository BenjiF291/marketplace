# Fenra species

Nameless silver-winged Fenra species entry alongside Saelis. Admin-edited species description and origin are shared; rarity and Saelis's individual story stay separate. Unowned gallery portraits fade, and details retain full color.

The supplied Meshy FBX becomes `fenra-species-source.glb`; `createFenraSpecies()` adds an anatomical skin, looping idle and pose controls. The API exposes `jointMap`, `applyPose`, `resetPose`, `clips`, and `update(time, {idleWeight, pose, poseWeight})` for future battles. Preview: `/fenra-species-3d-preview.html`. Export: `fenra-species-rigged.glb`.

Validation: `node --test --test-isolation=none fenra-species-3d.test.js fenra-3d.test.js creature-book-routes.test.js`. Browser verification covers animation, planted paws, loop seam, GLB export, book entry, admin controls and mobile layout.
