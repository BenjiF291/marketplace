# Creature Brawl attack choreography

All 20 roster entries now have three skeletal attack/ability clips, with their own routines, timing and anatomy. These are Three.js quaternion/position keyframes on the existing weighted rigs, authored in `public/creature-brawl-attacks.js`. They replace the previous idle-plus-parent-tilt attack presentation. The original mesh, textures, book and Stable animations are preserved.

## What plays

| Creature | Basic / second / third routine |
|---|---|
| Ember Fox | Bite / evasive paw feint / raised-head rally |
| Crystal Snail | Twisting shell bump / head-and-feeler retraction / rocking shell taunt |
| Pocket Dragon | Claw swipe / braced breath / two-wing sweep |
| Aeri | Left talon kick / hopping dive / updraft wingbeat |
| Rill | Right talon jab / two timed talon strikes / uplifting wing call |
| Brakk | Left paw slam / planted brace / threatening roar |
| Brugar | Right paw slam / twin-tail guard / two-paw crush |
| Virex | Left rake / binding pounce / sweeping tails |
| Krynn | Right rake / crossed claws / raised-head roar |
| Saelis | Raised hoof strike / crest call / wide wing call |
| Fenra | Crest jab / crest guard / crest pulse |
| Kael | Heavy fang strike / wing-assisted pounce / wing-spread roar |
| Tharos | Horn uppercut / horn charge / broad wing sweep |
| Talren | Horn jab / committed charge / bellow |
| Northern Talren | Left shoulder strike / guarding pose / resolute stand |
| Defender Talren | Right armoured shoulder strike / wide brace / shield check |
| Defender Rill | Guarded talon strike / feather cover / swooping assault |
| Kanji | Saber bite / feathered pounce / wing cover |
| Trusk | Hooking paw swipe / scale brace / shoulder rush |
| Velkris | Articulated fang snap / segmented stinger strike / carapace guard |

Shared anatomical helpers resolve the actual bone names for each rig; numbered pet legs and named species chains are both supported. Routines differ in limb choice, poses, wing/tail involvement, timing, weight and leap height. Motion does not grant extra hits, stats or abilities.

A melee attacker faces its target, approaches with distance-driven leg cycles, winds up, strikes, follows through, turns and returns to its original formation and facing. Leaps lift and land with the limb pose. Ranged and support powers perform their own skeletal casting movements in place. Damage uses a skeletal head/neck recoil; healing and shielding do not flinch the recipient.

`CombatAnimationPlayer` holds each clip at its 54% contact marker before the existing ordered queue displays authoritative results. Twin Talons advances to a separate 73% contact for its second hit. Recovery completes the clip, then restores idle. Each actor owns its mixer/actions; duplicate creatures animate independently. Playback respects 1x/2x, reduced motion, background tabs and cancellation. No combat-engine, balance, AP, reward, ownership or persistence behavior changed.

## Preview and verification

Open `/creature-brawl-animation-preview.html` locally. Choose any creature and power, play the full sequence or scrub the skeletal clip. This preview uses local catalogue data and has no account/API writes.

```powershell
node --test --test-isolation=none --test-force-exit creature-brawl-attacks.test.js creature-brawl-presentation.test.js creature-brawl-engine.test.js creature-brawl-routes.test.js companion-lifecycle.test.js
node scripts/inspect-brawl-attack-rigs.cjs
node scripts/check-brawl-attacks.cjs
node scripts/check-trusk-game.cjs
```

32 focused tests pass. The browser check constructs all 19 real rigs, exercises all 57 powers, checks finite visibly deformed skin vertices, neutral endpoints, contact holds, approach/return, original facing, independent actors, effect cleanup, 2x/mobile and cancellation. The full-index fixture passes complete ranked/Practice matches, navigation, refresh/resume, fullscreen, desktop/mobile fit, immediate input/idempotency, existing Skystones return, Stable and reward UI. Test accounts are isolated in memory; no live Firebase writes.

Evidence: `output/brawl-attacks/verification.json`, `output/brawl-attacks-check.txt`, `output/brawl-attacks-tests.txt`, `output/brawl-attacks-game-check.txt`. Per-creature three-power contact sheets are in `output/brawl-attacks/*-contact.png`.

Refresh the app to load the new versioned modules. No deployment or push was performed.


## Approach movement update

Approach and return now use species-specific locomotion from `creature-brawl-locomotion.js`. Ground creatures take short sprints with stronger hip/knee strides and a running bounce; the fox uses its existing rigged run clip. The snail uses its existing fast-crawl clip with pulsed forward movement. Dragon and Fenra fly with clear wingbeats; Rills, Kael and Tharos use wing-assisted hops. Krynn bounds and Kanji pounces, with tucked legs, an airborne arc and a landing before attacking. Horizontal travel eases into takeoff and settles on landing. The ground shadow follows the creature and softens with height. Return movement uses the same gait and finishes at the exact saved formation position/facing.

Reduced motion skips the travel arc. Attack timing, authoritative results, 1x/2x playback and combat rules remain unchanged. The preview page plays the updated full approaches and returns.

35 focused tests pass including `creature-brawl-locomotion.test.js`. The all-19-rig/all-57-power browser suite passes, as do nine additional visible travel audits and the full-index desktop/mobile battle regression. Travel audits measure skeletal pose changes, actual airborne height, return position/facing and effect cleanup. Evidence: `output/brawl-travel-tests.txt`, `output/brawl-travel-browser.txt`, `output/brawl-travel-visual-check.txt`, `output/brawl-travel-game-check.txt` and `output/brawl-attacks/travel-verification.json`. Run the visible audit with `node scripts/check-brawl-travel.cjs`; approach screenshots are `output/brawl-attacks/*-approach.png`.

Velkris adds a scuttling gait with alternating phases across all eight legs. Its tail contact is solved in the sagittal plane on the actual rig, preserving segment lengths before the resulting joint rotations are sampled into the strike clip. See [Velkris](VELKRIS.md) for current integration checks.
