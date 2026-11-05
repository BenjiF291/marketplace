# Pocket Dragon embedded-GLB animation pilot

## Enable locally

- Workshop: `http://localhost:3000/creature-brawl-animation-preview.html?brawlDragonRig=embedded`
- Full game: `http://localhost:3000/index.html?brawlDragonRig=embedded`, then enter Creature Brawl with Pocket Dragon in the team.
- The experiment requires both a loopback hostname and `brawlDragonRig=embedded`. Without the flag, or on a non-loopback host, the original production factory/player remains in use.
- Only Pocket Dragon is affected. Remove the flag and reload to restore normal behavior. Failure to load/validate the rigged asset falls back to the original source-mesh factory.

## Integration

`public/dragon-embedded-brawl.js` loads `assets/companions/dragon-meshy-rigged.glb` through GLTFLoader. SkeletonUtils clones independently bound skeletons for each actor; geometry and materials are independently owned for disposal. No skeleton, bind matrices or skin weights are regenerated. The imported model's procedural `update()` is deliberately a no-op.

The arena selects the imported combat adapter only for the opted-in model. It never calls the procedural combat-clip builder or skin conditioner for that actor. AnimationMixer plays the embedded clips directly. Other creature factories and the parent movement, facing, height planning, hit timing, camera fitting and projectile implementations remain unchanged.

The workshop exposes clip selection, playback, scrubbing, return to Brawl idle, and a root-motion/missing-animation diagnostic panel. Its embedded clips use the same root normalization as combat.

## Asset findings

One skinned mesh, 29 bones, +Y up and +Z forward. Existing uniform arena sizing works; no mirroring, orientation correction or nonuniform actor scaling was necessary.

| Embedded clip | Duration | Tracks | Raw torso Y range |
|---|---:|---:|---:|
| idle | 4.8 s | 30 | 0.900 |
| walk | 1.0 s | 30 | 0.786-0.794 |
| run | 0.68 s | 30 | 0.756-0.764 |
| fly | 0.8 s | 30 | 1.302-1.338 |

All four clips have constant torso X/Z translation and zero net horizontal drift. The fly clip starts 0.42 model units above the bind-pose torso height (0.90); retaining this would add a second elevation on top of the arena's flight height. The adapter removes that constant flight offset while retaining its +/-0.018 bob. Walk/run keep their authored crouch and bob to avoid raising the paws. X/Z root translation is held at bind-pose values defensively. Original loaded clip arrays are not modified.

The GLB has no melee attack, ranged cast, hit reaction, defeat, victory, jump, takeoff or landing clip. Missing combat phases explicitly use neutral embedded idle; this is a pipeline test, not a complete new combat animation set. Existing parent lunges and projectile effects still execute. Dragon advancement/retreat uses the embedded fly cycle, consistent with its existing flight locomotion profile. Walk and run are available in the workshop.

## Deformation limitations

The imported asset's own walk/run/fly skinning still stretches. No procedural pose or skin smoothing was applied to hide this. Sampled triangle-edge expansion relative to idle, across five sampled poses:

| Clip | 99th percentile edge ratio | Maximum sampled edge ratio |
|---|---:|---:|
| idle | 1.014x | 1.161x |
| walk | 1.996x | 7.636x |
| run | 2.338x | 11.294x |
| fly | 2.450x | 6.289x |

These are diagnostic samples, not a complete quality certification; small edges amplify the maximum ratio. All sampled vertices were finite. The result demonstrates that switching import/playback paths alone does not solve the asset's deformation. Imported clips also switch without new crossfades; further animation/skin authoring and missing action clips are needed before considering a production rollout.

## Verification

- `node --test --test-isolation=none dragon-embedded-brawl.test.js creature-brawl-attacks.test.js creature-brawl-locomotion.test.js`
- `node scripts/check-dragon-embedded.cjs`: real BrawlArena renderer, all four clips, scrubbing/playback, unmodified bone ownership/skin, independent same-kind actors, melee contact, approach/return, facing, uniform scale, projectile path, mobile rendering, default path and load-failure fallback.
- `node scripts/check-dragon-embedded-game.cjs`: full index game with six rendered creatures and the rigged Pocket Dragon asset, desktop/mobile checks.
- A heavier initial full-game lineup reached only five of six models before the existing 15-second arena-load timeout. The successful full-game check uses a lighter practice lineup with two independently loaded embedded Pocket Dragons. The production timeout and other creature factories were not changed.
- 24 focused unit/regression tests passed, plus both browser scripts.
- Numeric observations and screenshots: `output/dragon-embedded/`.
