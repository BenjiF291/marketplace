# Tharos / Veyrin

Tharos is a second named Veyrin in the creature book, using his own supplied Meshy scaly black winged cat FBX and textures. He is book/brawl content, not an adoptable pet or island wanderer. Attack gameplay is not implemented yet.

The optimized static source is `public/assets/creatures/tharos-source.glb`; `tharos-rigged.glb` contains his weighted skin and eight-second seamless idle clip. The original archive remains untouched. Conversion uses `scripts/prepare-meshy-model.py` with `--name Tharos --ratio .06`.

`createTharos()` in `public/tharos-3d-model.js` creates an independent 43-joint entity. Tharos uses the same stable Veyrin control names as Kael, with anatomy tuned to his own head, ears, horns, hind-paw positions and tail curve: Pelvis, Torso, Chest_breath, Neck_joint, Head_joint, Jaw_joint, Horn_left/right, Ear_left/right, four hip/knee/foot/toe chains, five joints per membrane wing, and Tail_curve_0 through Tail_curve_5 plus Tail_curve_tip. His model, source cache, materials, skeleton and animation clock are independent of Kael's.

Idle includes restrained breathing, head turns, ear twitches, wing settling and tail sway, keeping all four paws steady. Head/horn and paw masks prevent wing weights from tugging those regions. The API exposes `update(time, {idleWeight, pose, poseWeight})`, `jointMap`, `resetPose()`, `applyPose(pose, weight)`, `clips()` and `dispose()` for later brawl poses. Rotations are additive local XYZ radians. Future large attack/flight tracks will need visual tuning; this change prepares joints and verifies idle.

The renderer/book entry key is `tharos`, while the displayed species is `Veyrin`. The existing `veyrin` key still identifies Kael, preserving stored admin data. Species description and Origin are shared via the existing Veyrin record. Tharos's individual description and rarity are stored separately under `tharos`. Saving Tharos atomically merges only the two species fields into the Veyrin record and writes his own character fields. Kael's individual story and rarity remain intact. Public reads resolve the shared fields for both entries; the UI updates both species panels immediately. No database migration is needed.

The developer viewer is `tharos-3d-preview.html`, with rotation, zoom, pause and export. The public book retains Info-only cards and admin-only editing. Tharos's rarity remains unassigned until chosen by an admin; Origin inherits any existing Veyrin Origin.

Validation includes `tharos-3d.test.js`, `creature-book-routes.test.js` and the existing rig tests. Browser checks cover deformation, stationary paws, loop seams, export, all nine gallery cards, mobile, and actual island startup/Lodge access. An end-to-end browser check uses the actual creature-book routes with an in-memory database to confirm shared lore/origin edits in both directions, independent character descriptions/rarities, reload persistence and ordinary-player display. Review images are in `output/creatures/`.
