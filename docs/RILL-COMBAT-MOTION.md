# Rill combat motion

Rill, Aeri, and Defender Rill share the same 29-joint bird hierarchy. Their supplied assets expose an idle animation, so this pass authors a dedicated skeletal controller in `public/rill-combat-motion.js`.

The movement set includes an alert grounded idle, a crouch/push-off, an asymmetric wingbeat loop, talon and hooking-rake strikes, a wing-fan support action, a hit reaction, and a landing with leg extension and compression. Wing roots, elbows, wrists, and tips use different timing. Hips, knees, ankles, and toes tuck for flight and open for contact. The pelvis and torso shift weight while the neck, head, crest, beak, and seven tail joints stabilize or counterbalance the movement.

The arena keeps Rill above the ground through its melee strike, calculates approach distance using the posed toe socket, continues wingbeats during the return turn, and lands at home. Travel speed and flap counts suit the larger strokes. Takeoff/flight/landing transitions are checked for matching joint poses. Animation clips are generated once per model instance; battle playback seeks their keyframes using the existing shared renderer.

Ability IDs, damage, AP costs, rewards, and ownership are unchanged. The local workshop remains `/creature-brawl-animation-preview.html`.

Validation:

- 36 joint, animation, presentation, combat, and route tests passed.
- Actual weighted skins checked for finite poses, deformation, clip seams, contact events, recovery, and cancellation across all three Rill variants.
- Recorded real arena playback confirms airborne strikes, claw gaps below 0.2 actor height, exact home return, 2× playback, and phone layout, without browser errors.
- Preview video: `output/rill-motion/rill-arena-demo.webm`.
- Pose sheets and reports: `output/rill-motion/`.
