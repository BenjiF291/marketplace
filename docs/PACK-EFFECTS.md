# Pack effects

Ruby Cabinet → Pack effects offers a free preview before buying. Equip a purchased effect there. Existing Ember Burst / Crystal Aurora owners keep their purchases and receive the upgraded visuals automatically.

| Effect | Rubies | Presentation |
| --- | ---: | --- |
| Ember Burst | 100 | Golden fireworks, rising embers, warm blooms, and forge rings |
| Crystal Aurora | 100 | Layered mint/violet northern lights, crystal bursts, and portal rings |
| Starfall | 120 | Meteor trails, star fireworks, and celestial rings |
| Stormcaller | 120 | Local lightning bolts, electric rings, and rain |
| Sakura Festival | 100 | Drifting pink petals, blossom bursts, and golden glints |

The preview and actual opening share RewardOpening and PackEffects. Equipped effects also apply to daily packs. Preview uses three sample reward cards and never calls reward/purchase APIs. Cosmetics do not change odds or rewards.

The transparent canvas stays behind the cards and controls. It caps particles at 120 on phones / 240 on desktop, caps pixel density at 1.5, and runs at approximately 30 fps. Closing removes its animation frame, resize observer, visibility listener, and media-query listener. Hidden tabs pause rendering. Reduced motion uses a static decorative sky and disables the moving CSS rings.

Validation: 46 focused purchase, ownership, equip, reward-flow, and currency tests; five-theme desktop/mobile screenshots and browser checks; equipped daily pack; reduced motion; no surviving canvas/animation frames after close. `node scripts/check-pack-effects.cjs` runs an isolated local visual fixture with no account writes.
