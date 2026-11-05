# Creature anatomy and movement pass

The existing rigs remain the source of the animation. Brugar and Brakk expose separate upper/lower tail chains and clubs; most newer creatures supply idle clips rather than source combat clips.

- Brugar/Brakk: staggered twin-tail wind-up and sweep, tail guard, and heavy club strike. The arena computes contact from the posed upper club, turns the body toward the target, and uses that reach to choose the approach endpoint.
- Krynn: forked-tail release for its area special.
- Kael: alternating mauls with a separate second contact for the two-hit special.
- Trusk: planted heavy paw hook and shoulder rush.
- Velkris: articulated stinger; no generic attack hop.
- Ground creatures: low diagonal leg cycles, small weight shifts, and minimal vertical displacement. Kanji uses wing-assisted running rather than repeated leaps.
- Flyers: takeoff, sustained flight with repeated wingbeats, and a single landing. The snail retains its foot wave and Velkris its alternating scuttle.

The shaft/club influence transition on both Brugar skins now blends continuously. Joint limits keep the two tails within the mesh's deformation range. Motion returns to its exact starting position and orientation after the attack or interruption.

Combat damage, ability effects, targeting rules, and rewards are unchanged. Brugar basic attack labels now describe the tail strike.

Validation: 37 combat/presentation/animation tests; all 60 clips exercised on the real weighted models; approach/return checks for grounded, flying, crawling, and scuttling creatures; full-index desktop/mobile battle smoke. The local animation workshop remains available at `/creature-brawl-animation-preview.html`.
