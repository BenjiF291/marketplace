# Talren

Nameless Talren species entry in the creature book, using the supplied Meshy brown horned beast model. It is not registered as an adoptable pet.

The UV-preserving skin has 33 joints: pelvis, torso, breathing chest, neck, head, jaw, two horns, two ears, four four-joint legs, and a seven-joint curved tail. The eight-second idle loop keeps paws planted. `createTalren()` exposes `jointMap`, `applyPose(pose, weight)`, `resetPose()`, `clips()`, and `update(time, {idleWeight, pose, poseWeight})` for future attacks.

Assets: `public/assets/creatures/talren-{source,rigged}.glb` and `talren-poster.png`. Preview: `/talren-3d-preview.html`. Species description, origin, and rarity are admin editable; no individual story is shown. Unobtained gallery portraits fade while detail previews retain full color.

Validation: `node --test --test-isolation=none talren-3d.test.js creature-book-routes.test.js`; browser checks cover idle deformation, planted paws, loop seam, GLB export, book entry and mobile layout.
