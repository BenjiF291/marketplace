# Aeri / Rill animation

Aeri is the named Rill in the Book of Magical Creatures. It is not registered in the pet catalogue, shop, care systems, or island roaming. No brawl attacks or gameplay abilities are implemented yet.

The supplied Meshy GLB had no skeleton or clips. `scripts/prepare-meshy-glb.py` retains its UVs/materials, reduces the geometry and limits textures to 2048 pixels. The original download stays untouched. `public/assets/creatures/aeri-source.glb` is the optimized source; `aeri-rigged.glb` contains the 29-joint skin and the eight-second seamless `idle` clip. The poster is a transparent fallback while the book portrait loads.

`public/rill-3d-model.js` exports `createRill()`, using the same Three.js version as the other creatures. Each instance has its own joints and skin; source geometry/textures load once. The model faces +Z, is 2.6 units tall, and has feet at ground level. Names are stable for future animation tracks:

- Pelvis and Torso
- Neck_joint, Head_joint, Crest_joint, Beak_joint
- Wing_left/right_root, elbow, wrist, tip (four per wing)
- Leg_left/right_hip, knee; Foot_left/right; Toes_left/right
- Tail_0 through Tail_6, following the curled plume

The idle moves the chest, neck, head, wings, crest and tail. Legs and talons stay planted. `clips()` creates an exportable looping idle; it resets to bind pose afterwards. The interactive viewer has rotation, zoom, pause and a rigged GLB download.

For a future battle scene:

```js
import {createRill} from './rill-3d-model.js?v=rill1';
const aeri = await createRill();
scene.add(aeri.root);
// Normal frame update:
aeri.update(elapsedSeconds);
// Blend a future attack's additive joint offsets over idle (radians, local XYZ):
aeri.update(elapsedSeconds, {
  idleWeight: 1 - attackBlend,
  poseWeight: attackBlend,
  pose: {
    Head_joint: {rotation: [-0.1, 0, 0]},
    Wing_left_root: {rotation: [0, 0, 0.15]},
    Wing_right_root: {rotation: [0, 0, -0.15]}
  }
});
```

`jointMap`, `resetPose()` and `applyPose(pose, weight)` are also exposed. `update()` resets the bind pose before applying idle/offsets, preventing accumulated drift. For keyed attacks, use AnimationMixer on the exported rig instead of calling the procedural update in the same frame. Call `dispose()` when removing the entity. Large attack motions will need visual tuning of the folded-wing skin weights; the current scope verifies idle and prepares the joints.

Validation: `node --test --test-isolation=none rill-3d.test.js` checks normalized skin weights, named weighted joints, planted leg tracks, finite geometry, the loop seam and separation from the pet catalogue. Headless browser checks exercised actual deformation, GLB export, species/name search, book/viewer display and mobile layout. Review images are in `output/creatures/`.
