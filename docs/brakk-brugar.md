# Brakk / Brugar

Brakk is a named Brugar in the creature book, using the supplied Meshy armored stone beast FBX and textures. He is not registered as an adoptable pet or island wanderer. Attack gameplay is not implemented yet.

Assets: `public/assets/creatures/brakk-source.glb` is the optimized static source (about 4.9 MB); `brakk-rigged.glb` is the weighted export with its eight-second seamless `idle` clip. The original archive remains unchanged. Conversion uses `scripts/prepare-meshy-model.py` with `--name Brakk --ratio .06`.

`createBrugar()` in `public/brugar-3d-model.js` creates an independent 34-joint entity. The authored mesh has an angled stance; each limb follows its actual paw coordinates rather than a symmetric template. Stable joints include Pelvis, Torso, Chest_breath, Neck_joint, Head_joint, Jaw_joint, four hip/knee/foot/toe chains, and two six-joint tail chains ending in Tail_upper_club and Tail_lower_club. The clubs have rigid skin influences. During idle, all four paws remain planted and only the underside breathes; armored plates remain stable while the head and tails move subtly.

The API matches Aeri's rig: `update(time, {idleWeight, pose, poseWeight})`, `jointMap`, `resetPose()`, `applyPose(pose, weight)`, `clips()` and `dispose()`. Pose offsets are additive XYZ rotations in radians or local position offsets by joint name. Update resets the bind pose before applying offsets to avoid drift. Future attack animations can blend over idle through these controls or use AnimationMixer on the exported GLB. Large attack poses will need visual tuning; current validation covers idle and rig preparation.

The developer viewer is `brugar-3d-preview.html`, with rotation, zoom, pause and export. The public book retains the requested Info-only interface. Admin fields for Brakk include species description, Origin, individual description and rarity. Rarity and Origin remain unassigned until an admin fills them.

Validation: `node --test --test-isolation=none brugar-3d.test.js creature-book-routes.test.js rill-3d.test.js`. Browser checks additionally verify actual idle mesh deformation, stationary paws, GLB export, five gallery cards, named species details, admin editing, mobile and island loading behavior. Review images are in `output/creatures/`.
