# Private village preview

Admin accounts get **Try village** beside the existing header controls. It opens an original, isometric island with raised terrain, paths, trees, a fountain, a pond, and thirteen illustrated buildings. It is a 3D-style SVG scene, not a WebGL world; it does not require downloaded models, a game engine, or a continuous rendering loop.

Drag/swipe to pan, use wheel/pinch or the zoom buttons, and recenter with the compass button. Keyboard users can focus the map and use arrow keys and +/−, tab through buildings, or use **Find a building**. Tap a building and choose **Enter building**. Existing game screens handle every action. **Village** returns to the same camera position and refreshes progression. **Exit village mode** restores ordinary navigation. The mode preference is stored per account on the device. Enabling the preview does not publish it to players.

## Access and persistence

`GET /admin/village` authenticates the existing session, checks `users/{id}.isAdmin === true`, then returns the account's converter progression and configured tiers. Unauthenticated requests get 401; non-admins get 403. The entry button is also hidden for non-admin accounts and is removed when the UI role changes. Saved mode preferences do not bypass server verification. No new Firestore collection, write, rule or index is needed. There is one user read on each map entry plus the existing cached tier lookup; panning, zooming and previewing levels never access Firebase.

The preview uses the actual `gemConverterLevel`, or the top tier when `gemConverterAllUnlocked` is set. Normal admin access to all converter recipes does not artificially advance the village. **Use my account progression** follows these saved values; the other dropdown choices simulate levels locally without granting buildings, spending gems, changing equipment, or altering the account. Returning after a real converter upgrade refreshes the scene.

## Initial building progression

Displayed forge levels start at 1 (the first configured tier; Bronze in the standard catalogue). The private map proposes these milestones:

| Forge level | Buildings available |
|---|---|
| 1 | Card archive, marketplace, gem forge, Brawl arena, fortune pavilion, Footy vault, town hall |
| 2 | Blacksmith and Ruby emporium |
| 3 | Companion lodge |
| 4 | Colour studio |
| 5 | Crystal refinery |
| 6 | Royal hall |

Locked destinations appear as construction plots with an explicit forge requirement and a shortcut to the gem forge. This is a private navigation prototype: these gates do not change access to existing menus or backend game mechanics. Final public unlock requirements and costs can be revised after review.

The gem forge changes roof material after the first upgrade, gains extra crystals at level 3, a reinforced roof at level 5, a floating core at level 6, and a diamond appearance at level 9. Tier names come from the real configured tier order. Animated chimney smoke, fire, crystals, fountain water and a slowly turning wheel bring the island to life; reduced-motion settings disable them.

## Destinations

- Card archive: cards, packs, consumable inventory and ascensions.
- Marketplace: listings and daily packs, with a separate Sell an item entrance.
- Gem forge: converter, upgrades and gem balances.
- Blacksmith: existing gem-priced amulet shop, inventory and slots.
- Arena: Bob, PvP, Skill Level and trophy rewards.
- Companion lodge: pets and four-hour journeys.
- Ruby emporium: pets, food, utilities, collectibles and cosmetic effects.
- Colour studio / crystal refinery: the existing dye and compressor workshop.
- Fortune pavilion: wheel.
- Footy vault: balance, transfers and history.
- Royal hall: VIP.
- Town hall: admin workspace and battle-card editor.

## Deployment and checks

Deploy the backend and frontend together, including `village-routes.js`, `public/village.js`, `public/village-art.js`, and `public/village.css`. The server gate remains admin-only after deployment. Public rollout requires a separate change; this implementation does not enable it.

`node --test village-routes.test.js` covers session checks, admin authorization, defaults and bounded real progression. The fixture-only browser harness supports `VILLAGE_CHECK_ONLY=1` and checks rendering, level previews, native touch pinch, drag, building taps, destination routing, mobile layout, return, exit, and role removal. Screenshots are written to `.ui-tools/village-*.png`.
