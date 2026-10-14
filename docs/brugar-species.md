# Brugar species

Nameless blue Brugar species entry alongside Brakk. Admin-edited species description and origin are shared; rarity and Brakk's individual story stay separate. Unowned gallery portraits fade, and details retain full color.

The supplied Meshy FBX becomes `brugar-species-source.glb`; `createBrugarSpecies()` adds an anatomical skin, looping idle and pose controls. The API exposes `jointMap`, `applyPose`, `resetPose`, `clips`, and `update(time, {idleWeight, pose, poseWeight})` for future battles. Preview: `/brugar-species-3d-preview.html`. Export: `brugar-species-rigged.glb`.

Validation: `node --test --test-isolation=none brugar-species-3d.test.js brugar-3d.test.js creature-book-routes.test.js`. Browser verification covers animation, planted paws, loop seam, GLB export, book entry, admin controls and mobile layout.
