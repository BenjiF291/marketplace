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

The short guide appears on the first visit after this release, saved per account in browser storage. The question-mark button reopens it. It explains the shared Town Hall and personal XP/unlocks, without individual building tutorials. The map has no building nameplates or progression/zoom counters. Select a building to reveal its entrance button; entering zooms toward the doorway and fades into the interior, respecting reduced-motion preferences. Phone portrait mode suggests turning to landscape, with an accessible portrait fallback. Drag, pinch, wheel and keyboard navigation remain supported.
