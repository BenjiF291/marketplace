# Velkris species

Velkris is species entry 20 in the creature book. It has no individual name/story; origin starts unrecorded and rarity unassigned. Admins edit its lore and rarity independently. No existing account receives automatic ownership.

## Available in game

- Creature book: live 3D model and species editor.
- Admin pack builder and reward-card viewer: animal `velkris`, with transparent artwork showing all eight legs and the tail.
- Stable: owned Velkris appear on the carousel and can be rotated through 360 degrees.
- Creature Brawl: available as a Practice loan; ranked selection requires normal ownership. Initial stats: Cunning, HP 900, ATK 255, DEF 82, SPD 105, Special 1.12. Fang Snap is free. Tail Strike costs 2 AP, deals 1.55-power damage and ignores 20% defence. Carapace Guard costs 3 AP, shields self for 25% max HP and raises defence 20% for two activations. Existing creature stats, combat rules and reward logic are unchanged.

Restart `npm start` and refresh to load the server catalogue. Preview the model at `/velkris-3d-preview.html`; preview its combat routines at `/creature-brawl-animation-preview.html` or select it in Practice. Award ownership by adding Velkris as an animal reward to an admin pack.

## Supplied model and rig

Source: `Meshy_AI_green_spider_scorpion_1020150307_image-to-3d-texture_fbx.zip`. Only FBX and PNG assets were extracted into ignored `.ui-tools/velkris-source`. Archive contents were not treated as instructions or executed.

The source is a static mesh with 499,695 vertices, 999,410 polygons and no rig or authored clips. Local Blender conversion reduces it to 40,000 triangles, retaining the supplied albedo, normal, roughness and metallic maps at browser-appropriate sizes. The optimized source GLB is 2.49 MB and the exported rigged GLB is 3.83 MB.

The supplied shape was inspected from front, side, back and above. Its existing +Z facing is preserved. The new rig has 48 joints: eight four-joint leg chains, head/neck/jaw, two articulated fangs, torso/abdomen and an eight-joint segmented tail ending at `Stinger_joint`. Smooth normalized four-weight skinning preserves the original mesh, UVs and proportions. Idle is an eight-second seamless loop with restrained head, fang and tail motion; the supplied feet remain fixed.

Brawl adds Fang Snap, Tail Strike and Carapace Guard keyframes on the real bones. The stinger's forward contact uses a planar joint solver; rotations preserve every segment length. A distinct eight-legged scuttle animates the approach and return. These runtime combat clips are separate from the idle-only exported GLB. Each actor has an independent skeleton and mixer; source downloads are cached.

Assets and tools:

- `public/assets/creatures/velkris-source.glb`
- `public/assets/creatures/velkris-rigged.glb`
- `public/assets/creatures/velkris-poster.png`: 768x630 with transparent alpha bounds [109,208,584,547], plus a 10px reward crop margin.
- `public/velkris-3d-model.js` and `public/velkris-3d-preview.html` / `.js`.
- `scripts/prepare-velkris.py`, `scripts/inspect-velkris.cjs`.

## Verification

91 focused tests pass across all three added species, book routes, packs, Stable, attacks/locomotion, combat engine/routes and portrait lifecycle. Velkris tests verify finite normalized skin weights, useful fang/tail/stinger influences, eight articulated legs, exact idle endpoints, reward crop, species/ownership rules and a reachable tail contact without stretching segments.

Browser checks pass for the real rig/export, transparent poster, desktop/mobile book, independent admin editing, Stable rotation and platform contact, reward card, and full desktop/mobile ranked and Practice battles with duplicate Velkris actors. All 60 roster powers were exercised on their actual skins. A final Velkris-specific combat run checks the refined stinger, scuttle return, mobile and cancellation. No live Firebase test writes, deployment or push.

```powershell
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test --test-isolation=none --test-force-exit velkris-3d.test.js trusk-3d.test.js kanji-3d.test.js creature-book-routes.test.js free-pack.test.js stable.test.js creature-brawl-attacks.test.js creature-brawl-locomotion.test.js creature-brawl-engine.test.js creature-brawl-routes.test.js creature-brawl-presentation.test.js companion-lifecycle.test.js
node scripts/check-velkris.cjs
node scripts/check-velkris-admin.cjs
node scripts/check-velkris-game.cjs
node scripts/check-velkris-combat.cjs
```

Evidence: `output/velkris-focused-tests.txt`, `output/velkris-model-check.txt`, `output/velkris-game-check.txt`, `output/velkris-combat-check.txt`, and `output/creatures/velkris-combat-checks.json`.

[Model](../output/creatures/velkris-idle.png) | [Book](../output/creatures/velkris-book.png) | [Stable](../output/creatures/velkris-stable.png) | [Reward card](../output/creatures/velkris-reward-card.png) | [Brawl](../output/creatures/velkris-brawl-1366x768.png) | [Mobile Brawl](../output/creatures/velkris-brawl-390x844.png) | [Attack poses](../output/brawl-attacks/velkris-contact.png)
