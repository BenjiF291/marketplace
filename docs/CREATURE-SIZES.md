# Creature scale

The user-supplied comparison chart is authoritative, including its proposed sizes. `public/creature-sizes.js` is the shared presentation table.

| Kind / named variant | Height (metres) |
|---|---:|
| Crystal Snail / Glimmer | 0.45 |
| Ember Fox / Vulpera | 0.65 |
| Pocket Dragon / Zephyros | 1.2 |
| Velkris | 1.4 |
| Krynn, Virex | 1.6 |
| Talren | 2.0 |
| Northern Talren | 2.1 |
| Defender Talren | 2.2 |
| Kanji | 2.3 |
| Rill, Aeri | 2.6 |
| Defender Rill | 2.7 |
| Trusk | 3.0 |
| Fenra, Saelis | 3.3 |
| Brugar, Brakk | 4.0 |
| Kael / Veyrin | 5.0 |
| Tharos / Veyrin | 5.5 |

The chart's companion aliases identify the models; this change does not rename existing creatures.

Stable displays use one conversion, 0.5 scene units per metre, with a fixed platform radius and common camera. The stable camera is now approximately 30% closer than the initial size-chart framing, aimed lower to keep the pedestal in view. Scaling is uniform in all axes, based on the imported neutral-pose vertical bounds. Small species are no longer enlarged to fill their stall. Wing and tail overhang is permitted, rather than resizing each species independently to fill its platform. The 17 species currently resident in the stable were checked against these target heights and against canvas-edge clipping. Companion heights are applied in Brawl; they retain their existing lodge residence.

Brawl uses `1.85 * sqrt(heightMetres / 2.6)` as its nominal scene height, followed by a shared viewport multiplier. This preserves ordering but compresses the 12.22x physical height range to 3.50x. A two-pass lineup fit applies one common shrink factor to every actor, avoiding individual silhouette fitting reversing the apparent size order. Formation perspective remains, so front and rear slots can differ in projected size. Combat stats, grades, growth and ownership are independent of this presentation scale.

Checks: `creature-sizes.test.js`, `scripts/check-creature-sizes.cjs`, and `scripts/check-brawl-movement.cjs`. Browser coverage includes all 17 stable residents and a six-creature lineup spanning Snail, Fox, Pocket Dragon, Rill, Brugar and Tharos at desktop, mobile portrait and mobile landscape sizes.
