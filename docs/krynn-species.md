# Krynn species

Nameless shadow Krynn species entry alongside Virex. Admin-edited species description and origin are shared; rarity and Virex's individual story stay separate. Unowned gallery portraits fade, and details retain full color.

The supplied Meshy FBX becomes `krynn-species-source.glb`; `createKrynnSpecies()` adds an anatomical skin, looping idle and pose controls. The API exposes `jointMap`, `applyPose`, `resetPose`, `clips`, and `update(time, {idleWeight, pose, poseWeight})` for future battles. Preview: `/krynn-species-3d-preview.html`. Export: `krynn-species-rigged.glb`.

Validation: `node --test --test-isolation=none krynn-species-3d.test.js krynn-3d.test.js creature-book-routes.test.js`. Browser verification covers animation, planted paws, loop seam, GLB export, book entry, admin controls and mobile layout.
