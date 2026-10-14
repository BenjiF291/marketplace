# Kael / Veyrin

Kael is a named Veyrin in the creature book, using the supplied Meshy black winged demon cat FBX and textures. He is book/brawl content and is not registered as an adoptable pet or island wanderer. Attack gameplay is not implemented yet.

`public/assets/creatures/kael-source.glb` is the optimized static source; `kael-rigged.glb` contains the weighted skin and an eight-second seamless idle clip. The original archive remains unchanged. Conversion uses `scripts/prepare-meshy-model.py` with `--name Kael --ratio .06`.

`createVeyrin()` in `public/veyrin-3d-model.js` creates an independent 43-joint entity. Stable controls include Pelvis, Torso, Chest_breath, Neck_joint, Head_joint, Jaw_joint, Horn_left/right, Ear_left/right, four hip/knee/foot/toe chains, five joints per membrane wing (root, elbow, wrist, fingers, tip), and Tail_curve_0 through Tail_curve_5 plus Tail_curve_tip. Each limb follows the actual angled stance. Head/horn masks separate the skull from nearby wings; paw masks keep wing movement out of all four foot areas.

Idle breathes above the legs, turns the head slightly, twitches the ears, gently settles the wings, and sways the curved tail. Paw vertices remain stationary. Horns remain rigid with the head. Large attack/flight animations will need visual tuning; this change validates idle and prepares the joints.

The API matches the other brawl creatures: `update(time, {idleWeight, pose, poseWeight})`, `jointMap`, `resetPose()`, `applyPose(pose, weight)`, `clips()` and `dispose()`. Pose offsets are additive joint-local XYZ rotations in radians or local position offsets by name. Update resets the bind pose before applying animation to avoid drift. Future keyed attacks can also use AnimationMixer on the exported GLB.

The developer viewer is `veyrin-3d-preview.html`, with rotation, zoom, pause and rigged export. The public book retains the Info-only interface. Admins can edit species description, Origin, Kael's individual description and rarity. Origin and rarity remain unassigned until filled by the admin.

Validation: `node --test --test-isolation=none veyrin-3d.test.js creature-book-routes.test.js fenra-3d.test.js krynn-3d.test.js brugar-3d.test.js rill-3d.test.js`. Browser checks cover deformation, stationary paws, loop seams, export, all eight cards, desktop/mobile display, admin persistence, ordinary-player display, actual island loading and Lodge access. Review images are in `output/creatures/`.
