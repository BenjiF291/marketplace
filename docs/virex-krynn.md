# Virex / Krynn

Virex is a named Krynn in the creature book, using the supplied Meshy black shadow beast FBX and textures. He is book/brawl content and is not added to the pet shop, care systems or island roaming. Attack gameplay is not implemented yet.

The optimized static source is `public/assets/creatures/virex-source.glb` (about 3.2 MB). `virex-rigged.glb` contains the weighted skin and an eight-second seamless idle clip. The original archive is unchanged. Conversion uses `scripts/prepare-meshy-model.py` with `--name Virex --ratio .06`.

`createKrynn()` in `public/krynn-3d-model.js` creates an independent 37-joint entity. Each limb follows the mesh's actual angled stance. Stable names include Pelvis, Torso, Chest_breath, Neck_joint, Head_joint, Jaw_joint, Ear_left, Ear_right, four hip/knee/foot/toe chains, Tail_upper_0 through Tail_upper_5 plus Tail_upper_tip, and Tail_lower_0 through Tail_lower_4 plus Tail_lower_tip. The tail curves are weighted independently. Idle breathes above the legs, turns the head slightly, twitches the ears and gently sways the tails; sampled paw vertices remain stationary.

The rig API matches Aeri and Brakk: `update(time, {idleWeight, pose, poseWeight})`, `jointMap`, `resetPose()`, `applyPose(pose, weight)`, `clips()` and `dispose()`. Pose offsets use additive joint-local XYZ rotations in radians or local position offsets by stable joint name. Update resets the bind pose before applying idle and offsets to avoid accumulated drift. Future attack tracks can blend over idle through these controls, or use AnimationMixer on the exported GLB. Large attacks will need visual tuning; this change validates idle and prepares the joints.

The developer viewer is `krynn-3d-preview.html`, with rotation, zoom, pause and rigged export. The public book retains its Info-only interface. Admins can edit species description, Origin, Virex's individual description and rarity. Origin and rarity remain unassigned until entered by an admin.

Validation: `node --test --test-isolation=none krynn-3d.test.js creature-book-routes.test.js brugar-3d.test.js rill-3d.test.js`. Browser checks cover actual deformation, planted paws, loop seams, GLB export, all six gallery cards, desktop/mobile layout, admin persistence, the ordinary-player view, actual island startup and Lodge access. Review images are in `output/creatures/`.
