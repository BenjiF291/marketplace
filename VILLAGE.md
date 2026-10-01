> Public island release: island navigation is now mandatory for every signed-in account. Admin tools and local level previews remain admin-only. All accounts earn personal Town Hall XP. The server must run as one instance for shared presence. Deploy the frontend and backend together. Earlier preview notes below describe development history.

# Public island and Town Hall

Every signed-in account opens directly on the island. Classic/new UI and village exit switches are hidden. Normal accounts see their own progression; only administrators can simulate Town Hall levels and enter admin tools.

## Painted island

The map uses original generated, painted isometric artwork: layered cliffs, shoreline, waterfalls, forest, cobbled roads, a fountain and thirteen individually clickable buildings. This is a 2.5D scene, not a fully rotatable 3D engine. The island, building atlas and repeating ocean texture load when the map opens. A separate interior atlas loads on the first building visit; every building shares these cached assets. There are no remote image dependencies and no Firebase reads for rendering, panning or zooming. The large assets are deliberately excluded from the ordinary practice service-worker precache, so opening the normal app does not pre-download them.

Assets and the generation prompts are documented in [public/assets/village/ART.md](public/assets/village/ART.md). The atlas is clipped in SVG without extracting or duplicating individual images. Reduced-motion preferences disable the subtle glints and selection transitions. The forge has copper, advanced crystal (level 5) and diamond (level 9) appearances based on its own progression.

Drag/swipe to pan, pinch/wheel or use the zoom buttons, and recenter with the compass button. Maximum zoom is 2.4x for inspecting details. The camera center is bounded to x=270..1170 and y=190..810 in island coordinates. The viewport always paints repeating water, synchronized with camera pan/zoom, and the island image edges are feathered into it. No finite background edge can be reached. Keyboard users can focus the map and use arrows and +/- or tab through buildings. **Find a building** centers it and opens its details. **Village** returns from a destination and refreshes progression. Exiting restores ordinary navigation. The mode preference is local and per account.

## Town Hall progression

`GET /admin/village` authenticates the existing session and checks `users/{id}.isAdmin === true`. Each account's Town Hall XP determines its own level and building unlocks. Shared room state never controls another player's level. A personal gem converter upgrade changes only that account's forge appearance and recipes.

| Town Hall level | Newly available buildings |
|---|---|
| 1 | Town Hall, archive, marketplace, gem forge, Skystones arena, fortune pavilion, Footy vault |
| 2 | Blacksmith and Ruby emporium |
| 3 | Companion lodge |
| 4 | Colour studio |
| 5 | Crystal refinery |
| 6 | Royal hall |

Locked buildings are absent from the island and the destination picker. Increasing the Town Hall level places newly unlocked buildings with a short arrival animation (disabled for reduced motion). Lowering the preview hides them again. The map dropdown simulates levels locally without writes or purchases. **Use your Town Hall progression** follows that account's XP level. The old manual level setter has been removed. Everyday gameplay activities fill the personal XP bar; reaching a threshold automatically upgrades the hall. See [TOWN_HALL.md](TOWN_HALL.md) for progression values. Building navigation follows personal Town Hall unlocks. Existing server-side economy permissions are unchanged.

## Shared community room

The Town Hall is the only shared building; everyone else keeps their own village destinations and account inventory. Two admin accounts can enter simultaneously to test:

- Saved character appearance: skin, hair, hairstyle and clothing.
- Click/tap to walk, routing around the long table.
- Eight exclusive seats, chat and emotes.
- Eight shared wall displays with books, plants, banners, crystals and trophies. Displays require owned Ruby-shop collectibles. Pieces are lent rather than consumed, credited to their owners, and cannot be duplicated across shelves by the same owner.
- Seated players can invite each other to the existing Skystones (formerly called Brawl) PvP game. Both must accept the same deck limit and timer. Matches have zero Footy stake and reuse existing deck selection, rules, clocks and battle polling.

Characters save to `users/{id}.townHallCharacter`. Only shared decorations save to `communityRooms/town-hall`. Personal XP saves to each user account. Concurrent decoration changes use a transaction and revision check. Accepted invitations create a deterministic battle document transactionally, preventing duplicate matches on retries.

Presence, movement, chat and pending invitations are in memory on a **single Node server process** with the current deployment. Polling runs every 1.5 seconds without per-poll Firestore reads; shared decoration reads are cached for 15 seconds. Presence expires after 12 seconds without contact. Room tokens last five minutes, then the client rejoins using normal account authentication. Closing the room stops polling and leaves. A process restart loses presence/chat/pending invitations; characters, shared decorations, personal XP and created games survive. Keep the deployment on one backend instance; multiple instances would need shared presence transport.

Only explicit character saves, decoration changes and accepted games write persistent state. Existing Firestore default-deny rules keep the new room collection server-only. No client Firestore subscription or new index is required.

## Deployment and checks

Deploy frontend and backend together, including the Town Hall routes, shared battle-match builder, world logic, room UI and local artwork. The island and Town Hall endpoints now admit all authenticated accounts. The legacy `/admin/` route names remain for client compatibility and do not imply administrative access. No Firestore rule changes are required.

`node --test` includes village authorization, independent forge progression, room access, two-player presence, collision routing, exclusive seats, character sanitization, decoration ownership/revisions, private XP and idempotent Skystones creation. The fixture browser harness supports `VILLAGE_CHECK_ONLY=1` and `TOWN_HALL_CHECK_ONLY=1`; both use local fixtures rather than live account writes. The Town Hall check uses two browser sessions and verifies the handoff to the existing PvP setup. Screenshots live under `.ui-tools/`.

## Building interiors

Entering a building uses an illustrated interior with matching game controls, parchment panels and a persistent Return to island button. The ordinary navigation shell is hidden and restored on exit. Existing live forms and event handlers remain authoritative; inventories, purchases, matches and crafting are not duplicated.

The marketplace has browsing and selling counters. The blacksmith has crafting, equipment and owned-amulet stations. The archive keeps collection, pack opening and supplies together. The lodge focuses on pets and journeys. The gem forge shows its conversion chamber first with instructions in an expandable guide. Dye and compression tools are separated into their own buildings. The Ruby emporium embeds the existing shop as a nonmodal counter while nested choice dialogs keep working normally. Arena, wheel, treasury and royal hall receive matching interior scenery. The shared Town Hall keeps its interactive multiplayer room.

Artwork is loaded only as needed; no new Firebase writes or polling were added for these interiors. New client assets are `village-interiors.js`, `village-interiors.css`, `assets/village/interiors-painted.png` and `assets/village/ocean-painted.png`. Asset prompts are in `public/assets/village/INTERIORS-ART.md`. Large artwork remains outside the normal practice precache.

## Island arrival guide and navigation

The short guide appears on the first visit after this release, saved per account in browser storage. The question-mark button reopens it. It explains the shared Town Hall and personal XP/unlocks, without individual building tutorials. The map has no building nameplates or progression/zoom counters. Select a building to reveal its entrance button; entering zooms toward the doorway and fades into the interior, respecting reduced-motion preferences. Phone orientation is left to the player; no rotation prompt is shown. Building taps preserve the current map position. Leaving a building zooms back out from its door; the Town Hall is exited by clicking its illustrated doorway. Drag, pinch, wheel and keyboard navigation remain supported.

## Land plots and residents

All accounts now receive a 24-plot layout. Arrange village previews moves, swaps and house construction locally; Save layout validates and stores the entire layout in one user transaction. Cancel spends and saves nothing. Layout revisions reject stale saves from another session. Existing buildings are retained, and their future unlock plots stay reserved. There is no construction cost in this first version. Up to eleven houses fit beside the thirteen core buildings. Each saved house contributes exactly three residents; moving never duplicates them and removal removes its residents. The resident count is derived from houses, not a separate editable counter. Villagers wander and respond to clicks locally, with no periodic Firebase writes. Daily tasks and resource rewards are not introduced in this version.

Building sprites now use individually traced SVG clip boundaries rather than grid-cell viewboxes, including upgraded forges. Plot positions describe ground-footprint centres; buildings align at their base with a fixed footprint, and the 24 occupied spaces have been visually reviewed together against the painted paths. Placement guides remain edit-only. Run `VILLAGE_ART_CHECK_ONLY=1 node scripts/check-studio.cjs` for the full-island and enlarged sprite review captures.


### Homes and ruby mines
Houses cost 10 rubies when saving the layout, capped at the personal Town Hall level (1?10). Existing homes remain free of retroactive charges and can be moved. Click each home to upgrade: 3 residents initially; 25 rubies for 5 residents; 40 rubies for 10 residents.

Mines unlock automatically at Town Hall 2, 4, 5, 7, 10. Send 3 villagers to produce one ruby every five minutes, stopping after 20 rubies (100 minutes). Started shifts continue while away and never restart automatically. Collect in the mine panel; restarting also collects any remaining output. Workers remain assigned until the full shift ends or they are recalled. All assignments and claims are server-validated transactions.

Forge upgrades add one ruby per level to two- and three-card Ruby recipes: 7/12, 8/13, 9/14, etc. Single-card output and other gems are unchanged.

Households are sent from their house, not from the mine. Call the household back at any time from the house or mine to end the shift and collect all unclaimed rubies from completed five-minute intervals. Recalling before the first interval earns zero, and partial intervals are discarded. Existing individual shifts remain collectible and recallable.

Villagers use 12 x 18 island-unit sprites and wander between random destinations along authored corridors following the painted paths. The navigation graph excludes terrain outside those corridors and subtracts building/mine footprints with clearance. Moving any building rebuilds routes. Villagers pause while arranging, while the island is closed/hidden, when hovered/focused, and with reduced-motion enabled.


### Pet station, farmhouse and happiness
The pet station is a new enterable building at Town Hall 3. Assign an available household and an owned, non-exploring pet. The room displays the caretakers and pet: click caretakers to talk, click the pet or Play together to play, and choose an owned meal to feed. Recall returns the household and pet to the island. Owned pets outside the station wander on the same obstacle-aware routes as villagers; exploring pets are absent. Station pets must be recalled before exploring.

The farmhouse unlocks at Town Hall 2 and starts at tier 1. Tier 2 costs 50 rubies and tier 3 costs 100. Assign a household to a specific ingredient; jobs stop after three units, regardless of household size. Water takes 5 minutes/unit, carrots 10, corn 20, milk 30, meat 60. Tier 1 unlocks water/carrot, tier 2 adds corn, tier 3 adds milk/meat. Collect while working or after completion; recalling collects completed units and discards the partial interval. Completed jobs free the household even before collection. A household cannot mine, farm, or care for a pet concurrently.

Cook one serving from one of each ingredient: water + carrot makes regular food, water + corn makes better food, milk + meat makes extraordinary food. Meals enter the existing Ruby food inventory, usable for feeding or journey provisions. Feeding grants +1, +2, or +4 happiness; station play grants +1. Each pet's happiness caps at 10 and resets to 1 when its exploration rewards are collected. It does not otherwise decay. The multiplier curve is [1, 1.08, 1.2, 1.38, 1.65, 2, 2.45, 3, 3.6, 4.25, 5].

Exploration multiplies the odds of non-baseline outcomes (higher gem tiers versus the first, multiple gems versus one, bonus items versus none), then normalizes each distribution to 100%. Thus 5x means odds relative to the baseline, not five times every displayed probability. Existing food and species perks still apply. The journey snapshots happiness when starting; its rewards and end time remain fixed afterward. Displayed pet-specific loot tables use the same calculation as server draws.


### Individual worker assignments
New mine shifts reserve 3 available villagers, ingredient jobs reserve 2 per resource, and pet-station care reserves 1. Villagers are selected automatically across houses with no overlapping assignments. Multiple ingredient jobs may run concurrently. Completed timed jobs release their workers before collection. Legacy household assignments retain their original workers until recalled or finished. The island top bar shows available/total villagers, Footy and rubies; guide and logout are inside the Town Hall. Farmhouse exterior art uses the same 80 by 104 unit bounds as other buildings.


### Job station, vault work and pet guidance
The Central job station is available at Town Hall 1 and lists current/max staff for mines, ingredient gathering, pet care, and the vault. It uses the same assignment, collect and recall actions as the individual buildings. The vault has one staff slot, earning 1 Footy per completed 2 hours, capped at 12 after 24 hours. Recall pays completed intervals; no job restarts automatically. The vault interior also exposes a Vault staff button.

Assignment animations route villagers from their current island positions to the destination approach along the obstacle-aware path graph. Job timers and worker reservations take effect immediately; animations are visual only.

Pet explorations is a top-bar button and each owned pet has a Send on an exploration action. Pet purchases show an exploration tutorial; the care station shows its own first-visit tutorial. Owned pet Buy buttons are removed, and the server continues to reject duplicate pet purchases.

House upgrades require Town Hall 4 for tier 2 and Town Hall 7 for tier 3. Ruby costs remain 25 and 40 respectively. Existing upgraded houses are retained.

Ruby mines are saved in the village layout and can be moved or swapped using Arrange village once unlocked. Existing islands receive mine plots at their previous locations. The island loading screen uses the existing pets, villagers and huts, and waits for map artwork decoding before revealing the island.
