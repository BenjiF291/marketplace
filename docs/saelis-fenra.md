# Saelis / Fenra

Saelis is a named Fenra in the creature book, using the supplied Meshy silver winged creature FBX and textures. She is book/brawl content and is not registered as an adoptable pet, care-room creature or island wanderer. Attack gameplay is not implemented yet.

Assets: `public/assets/creatures/saelis-source.glb` is the optimized static source. `saelis-rigged.glb` contains the weighted skin and an eight-second seamless idle clip. The original archive remains unchanged. Conversion uses `scripts/prepare-meshy-model.py` with `--name Saelis --ratio .06`.

`createFenra()` in `public/fenra-3d-model.js` creates an independent 44-joint entity. The anatomy uses a two-joint long neck, head/jaw/crest controls, four hip/knee/foot/toe chains, five joints per feathered wing, and three tail-plume chains under a shared tail root. Stable names include Pelvis, Torso, Chest_breath, Neck_lower, Neck_joint, Head_joint, Jaw_joint, Crest_joint, Wing_left/right_root, elbow, wrist, feathers, tip, Tail_root, and Tail_outer/middle/inner_0, 1, tip. Each hoof follows its actual source position, retaining the supplied standing stance.

Idle breathes above the legs, gently turns the head, settles the feathered wings and moves the plumes. Hoof vertices remain stationary. Tail/wing masks keep low feathers distinct from the leg skin. The named controls prepare the creature for future battle poses; large attack/flight animations will require visual tuning.

The API matches Aeri, Brakk and Virex: `update(time, {idleWeight, pose, poseWeight})`, `jointMap`, `resetPose()`, `applyPose(pose, weight)`, `clips()` and `dispose()`. Pose offsets are additive joint-local XYZ rotations in radians or local position offsets by joint name. Update resets the bind pose before applying animation, preventing accumulated drift. Use these controls to blend future poses over idle or AnimationMixer on the exported GLB.

The developer viewer is `fenra-3d-preview.html`, with rotation, zoom, pause and rigged export. The public book retains its Info-only interface. Admins can edit the species description, Origin, Saelis's individual description and rarity. Origin and rarity remain unassigned until entered by the admin.

Validation: `node --test --test-isolation=none fenra-3d.test.js creature-book-routes.test.js krynn-3d.test.js brugar-3d.test.js rill-3d.test.js`. Browser checks cover actual deformation, steady hooves, loop seams, export, all seven gallery cards, desktop/mobile display, admin persistence, the ordinary-player view, actual island startup and Lodge access. Review images are in `output/creatures/`.
