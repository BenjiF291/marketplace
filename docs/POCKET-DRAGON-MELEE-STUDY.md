Pocket Dragon: one melee attack for visual review
=================================================

Run npm start and open http://localhost:3000/dragon-melee-study.html (replace the port if needed). The dedicated page is restricted to loopback hosts. It is not linked into production gameplay and does not modify other creature factories.

Controls: Play/Pause, Replay, 0.25x/0.5x/1x, timeline scrubbing, arena/side/front cameras, and an arena-parent-motion toggle. The JSON editor applies explicit poses in degrees, supports restoring the initial study, and exports JSON. Timeline values are normalized 0–1. Measurements shown under diagnostics cover the initial study, not subsequent editor changes.

Inspection before authoring
--------------------------

The existing dragon-meshy-rigged.glb has one skin, 63,357 vertices, 29 bones, and embedded idle/walk/run/fly clips. It has a torso, head, four hip/knee/paw chains, two four-bone wings and seven tail bones. There is no spine, jaw or individual toe rig.

Raw weights sum to one, and coincident vertices have matching weights. These checks do not establish anatomical correctness. A specific chest issue was isolated by sampling the authored attack: neighboring chest vertices near X=0 were assigned roughly 83–85% to opposite front hips. An 0.0081-unit edge stretched 15.72x when only one leg moved. The original factory selects front legs partly from the sign of X, allowing that boundary to cut through the chest. This is a rig/weight problem.

Separately, the existing generic claw asks for approximately 43 degrees of upper-leg anticipation, adds sideways movement, and rotates the torso. Generic combat clamps reduce those values, changing the intended silhouette and timing. Torso rotation moves all attached support legs. The imported movement clips also deform when played independently of those attack functions. Large requests, generic clamps, moving parents and unsuitable skin weights are distinct issues; additional sine-wave motion would not resolve them.

Implementation
--------------

- Loads the existing rigged GLB through the existing BrawlArena development import path. Stops if loading falls back to the procedural factory.
- Uses a frozen bind pose and exclusively AnimationMixer-controlled quaternion keyframes. Imported idle and procedural updates do not overwrite the study.
- One 1.25-second near-side claw attack: lift, anticipation at 40%, contact at 54%, follow-through at 65%, settle and exact neutral recovery. Smooth quaternion interpolation is baked into an AnimationClip. No scale or root translation tracks.
- Torso and three supporting leg chains remain fixed in pose-only mode. Head and tail rotations are small. Maximum authored component is 30 degrees; editor validation caps components at 35 degrees. This is deliberately a conservative attack, not a full locomotion redesign.
- The original arena poseAttack method supplies whole-body wind-up, lean and lunge exactly once. The toggle isolates skeletal movement. Supporting feet move with that existing parent in combined mode; this preview does not add world-space foot IK or claim those feet are world-locked during the parent lean.
- A localized smooth chest-weight correction transfers erroneous central-chest front-leg influence to Torso on 1,325 vertices of the cloned preview geometry. The GLB, source factory and production skin weights are unchanged.

Verification and limits
-----------------------

Real browser screenshots were inspected at start, anticipation, contact and follow-through using the actual BrawlArena renderer. Desktop and mobile controls/layout were exercised. The selected claw moves visibly from a raised anticipation pose into a forward strike, while the chest stays together. The elbow/knee transition still shows compression at anticipation; this rig is not certified as production quality.

Across 31 sampled poses after the chest correction: supporting paw bone drift in pose-only mode is below 3e-16 world units; final vertex recovery error is zero; 99th-percentile sampled edge expansion is 1.061x; worst sampled edge expansion is 2.372x near the moving knee. Before the correction, the maximum was 15.723x at the chest. These edge measurements do not certify volume preservation, all triangles, or perceptual quality. No bone scales or whole-body squashing are used; remaining local skinning distortion needs visual judgment.

Commands:

    node --test --test-isolation=none dragon-melee-study.test.js
    node scripts/check-dragon-melee-study.cjs

Evidence: output/dragon-melee-study/report.json and phase screenshots in that directory.

Stop here for visual feedback. No additional creature, attack, gameplay rollout, paid animation service, or asset purchase is included.
