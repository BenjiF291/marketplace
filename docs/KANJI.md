# Kanji species

Kanji is a species, not a named individual or a Companion lodge pet. It is entry 18 in the creature book. Admins can independently edit its species description, origin and rarity. Rarity starts unassigned and origin unrecorded. Existing players are not automatically granted ownership.

## Where it appears

- Creature book: Kanji, with the real animated model and no individual-story section.
- Admin pack reward options and reward-card viewer: animal `kanji`, using its transparent poster with padded alpha bounds.
- Stable: owned instances appear on the carousel and can be rotated by drag, slider and buttons.
- Creature Brawl: Kanji can be selected as a Practice loan, or for a ranked team after ownership is awarded. Initial presentation-compatible balance: Swift, HP 890, ATK 264, DEF 70, SPD 118, Special 1.06. Saber Bite is free, Feather Rush costs 2 AP and applies the existing slow, and Wing Guard costs 3 AP and uses the existing team-shield effect. No existing creature stats or battle rules changed.

Restart `npm start` to reload the server catalogue, then refresh. Preview directly at `/kanji-3d-preview.html`, or try a Practice loan in Arena -> Creature Brawl. To award ownership, add Kanji as an animal reward in an admin pack; it then uses normal pack/Stable ownership persistence.

## Asset pipeline

Source: the user-provided Meshy `Feathered_Winged_Sabe_1019124931_image-to-3d-texture_fbx.zip`. Only its FBX and four texture PNGs were extracted into the ignored `.ui-tools/kanji-source` folder. No archive content was treated as instructions or executed as a script.

The static FBX had 1,254,075 vertices, 2,508,730 polygons and no armature/modifiers. `scripts/prepare-kanji.py` uses the existing local Blender 4.5 installation to reduce it to approximately 40,000 triangles and preserve the supplied albedo/normal/roughness/metallic maps at web-appropriate sizes (2048/1024/512/256). The source GLB is about 2.5 MB, rather than shipping the 184 MB ZIP. Original fangs, feathered wings, tail, paws, UVs and proportions remain visible.

`public/kanji-3d-model.js` follows the existing rig-factory pipeline: normalize the actual mesh, align its diagonal forward direction to +Z, construct 40 independent bones, bind normalized four-weight skin influences, and expose joints, jointMap, applyPose, resetPose, update and clips. It has four fixed leg chains, two feathered wing chains, head/jaw/ears, torso breathing and a tail chain. A seamless eight-second idle adds restrained breathing, head turns, wing settling and tail motion. The supplied paw stance is preserved, including raised paws. Each instance receives an independent skeleton and mixer; cached source geometry/textures are not mutated.

Outputs:

- `public/assets/creatures/kanji-source.glb`: optimized supplied mesh/textures.
- `public/assets/creatures/kanji-rigged.glb`: exported 40-joint skin and idle clip.
- `public/assets/creatures/kanji-poster.png`: transparent 768x630 poster; alpha bounds [198,176,659,499].
- `public/kanji-3d-preview.html` / `.js`: turntable, front/side/back views and rig download.

The source has no authored animation clips. The idle rig was added locally; Brawl uses its existing procedural action/reaction/defeat presentation. No authored attack, cast or defeat clip is claimed. The balance numbers above are initial game data, not lore inferred from the asset.

## Verification

```powershell
node --test --test-isolation=none --test-force-exit kanji-3d.test.js creature-book-routes.test.js free-pack.test.js stable.test.js creature-brawl-engine.test.js creature-brawl-routes.test.js companion-lifecycle.test.js
node scripts/check-kanji.cjs
node scripts/check-kanji-admin.cjs
node scripts/check-kanji-game.cjs
```

All 66 focused tests pass. Checks cover normalized finite skin weights, valid bone indices, useful wing/head/tail influences, fixed paw stance, seamless idle/export, species/editor/ownership behavior, padded reward crop and existing combat/reward protections. Browser checks verify three-angle rendering, transparent unclipped poster, desktop/mobile book, independent admin editing, Stable rotation, a Kanji reward preview, duplicate Kanji actors in one shared Brawl scene, full Practice results with no permanent rewards, and existing navigation/resize/fullscreen behavior. Browser API data uses isolated fixtures, never live Firebase account writes.

A broader run including `reward-card-art.test.js` passed 71 checks and hit its previously documented legacy failure expecting the old collection-card-first reward order. That expectation is unrelated to Kanji and was left unchanged. Captured output: `output/kanji-tests.txt`; focused green output: `output/kanji-focused-tests.txt`.

Screenshots:

- [3D model](../output/creatures/kanji-idle.png)
- [Book](../output/creatures/kanji-book.png), [mobile book](../output/creatures/kanji-book-mobile.png)
- [Admin species editor](../output/creatures/kanji-admin-info.png)
- [Stable](../output/creatures/kanji-stable.png)
- [Reward card](../output/creatures/kanji-reward-card.png)
- [Brawl](../output/creatures/kanji-brawl-1366x768.png), [mobile](../output/creatures/kanji-brawl-390x844.png)

Nothing was deployed or pushed.
