# Trusk species

Trusk is creature-book entry 19: a species, with no invented individual name or story. Admins can edit its description, origin and rarity independently. It starts with rarity unassigned and origin unrecorded; existing accounts receive no automatic ownership.

## In the game

- Creature book: animated 3D portrait and species information.
- Admin pack builder and reward-card viewer: animal `trusk`, with its own transparent artwork.
- Stable: owned Trusks appear on the carousel and rotate through all sides.
- Creature Brawl: available as a Practice loan, or for ranked teams after being awarded through normal packs. Initial stats: Protector, HP 1170, ATK 238, DEF 112, SPD 71, Special 1.02. Heavy Swipe costs 0 AP. Scale Guard costs 2 AP, shields self for 28% max HP and raises defence 20% for two activations. Armoured Rush costs 3 AP, deals 1.6-power damage and ignores 25% defence. Existing creatures and combat rules are unchanged.

Restart `npm start` and refresh the app to reload both catalogues. Inspect directly at `/trusk-3d-preview.html`, or select Trusk in Arena -> Creature Brawl -> Practice with loan creatures. Add it as an animal reward in an admin pack to award normal ownership.

## Supplied asset and animation

The supplied `Meshy_AI_scaly_armored_bear_be_1019140005_image-to-3d-texture_fbx.zip` contains a static FBX and four texture PNGs. Only those assets were extracted into ignored `.ui-tools/trusk-source`; archive content was not treated as instructions or executed.

The source has 1,636,333 vertices, 3,272,690 polygons and no rig or animation clips. `scripts/prepare-trusk.py` converts it through local Blender 4.5 to 40,000 triangles with the supplied albedo, normal, roughness and metallic maps resized for browser use. The optimized source GLB is 1.76 MB; the exported rigged GLB is 2.69 MB.

The model was visually inspected from front, side, back and above before placing joints. `public/trusk-3d-model.js` normalizes its diagonal facing to +Z, creates a fresh 31-joint skin per instance and adds a seamless eight-second idle: breathing, restrained head/ear movement and gentle curled-tail settling. Paw chains stay fixed. Original proportions, spines, paws, UVs and textures remain. Source downloads are cached; each actor has independent geometry/material clones and a skeleton.

The source has no authored attacks. Brawl uses its existing parent-group attack, impact and defeat presentation with the new idle rig. No additional authored combat clips are claimed.

Outputs:

- `public/assets/creatures/trusk-source.glb`
- `public/assets/creatures/trusk-rigged.glb`
- `public/assets/creatures/trusk-poster.png`: transparent 768x630; alpha bounds [176,178,607,490], padded by the reward renderer.
- `public/trusk-3d-preview.html` and `.js`: rotatable preview and rigged GLB download.

## Verification

```powershell
node --test --test-isolation=none --test-force-exit trusk-3d.test.js kanji-3d.test.js creature-book-routes.test.js free-pack.test.js stable.test.js creature-brawl-engine.test.js creature-brawl-routes.test.js creature-brawl-presentation.test.js companion-lifecycle.test.js
node scripts/check-trusk.cjs
node scripts/check-trusk-admin.cjs
node scripts/check-trusk-game.cjs
```

All 76 focused tests pass. Rig checks cover finite normalized weights, valid joints, meaningful head/tail influences, fixed paws and seamless idle export. Browser checks cover three-angle rendering, transparent unclipped artwork, desktop/mobile book, independent admin editing, Stable rotation/platform contact, reward presentation and full Brawl matches with duplicate Trusk actors. Practice tests use isolated accounts and confirm no permanent rewards or ownership. No live Firebase writes, deployment or push.

[Model preview](../output/creatures/trusk-idle.png) | [Creature book](../output/creatures/trusk-book.png) | [Stable](../output/creatures/trusk-stable.png) | [Reward card](../output/creatures/trusk-reward-card.png) | [Brawl](../output/creatures/trusk-brawl-1366x768.png) | [Mobile Brawl](../output/creatures/trusk-brawl-390x844.png)
