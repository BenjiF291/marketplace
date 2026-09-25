# Private village and Town Hall preview

Admin accounts get **Try village** beside the header controls. This remains an admin-only, switchable preview. Nothing has been deployed or enabled for ordinary players.

## Painted island

The map uses original generated, painted isometric artwork: layered cliffs, shoreline, waterfalls, forest, cobbled roads, a fountain and thirteen individually clickable buildings. This is a 2.5D scene, not a fully rotatable 3D engine. Two local PNG assets (about 6.3 MB together) load when the map opens; every building shares one transparent atlas. There are no remote image dependencies and no Firebase reads for rendering, panning or zooming. The large assets are deliberately excluded from the ordinary practice service-worker precache, so opening the normal app does not pre-download them.

Assets and the generation prompts are documented in [public/assets/village/ART.md](public/assets/village/ART.md). The atlas is clipped in SVG without extracting or duplicating individual images. Reduced-motion preferences disable the subtle glints and selection transitions. The forge has copper, advanced crystal (level 5) and diamond (level 9) appearances based on its own progression.

Drag/swipe to pan, pinch/wheel or use the zoom buttons, and recenter with the compass button. Maximum zoom is 2.4x for inspecting details. Keyboard users can focus the map and use arrows and +/- or tab through buildings. **Find a building** centers it and opens its details. **Village** returns from a destination and refreshes progression. Exiting restores ordinary navigation. The mode preference is local and per account.

## Town Hall progression

`GET /admin/village` authenticates the existing session and checks `users/{id}.isAdmin === true`. Shared Town Hall level controls the private preview's building unlocks. A personal gem converter upgrade changes only that account's forge appearance and recipes.

| Town Hall level | Newly available buildings |
|---|---|
| 1 | Town Hall, archive, marketplace, gem forge, Skystones arena, fortune pavilion, Footy vault |
| 2 | Blacksmith and Ruby emporium |
| 3 | Companion lodge |
| 4 | Colour studio |
| 5 | Crystal refinery |
| 6 | Royal hall |

The map dropdown simulates levels locally without writes or purchases. **Use shared Town Hall progression** follows the saved community level. Inside the Town Hall, admins can set its shared level from 1 to 10 for testing. Upgrade prices have not been invented. These preview navigation gates do not change access to existing app menus.

## Shared community room

The Town Hall is the only shared building; everyone else keeps their own village destinations and account inventory. Two admin accounts can enter simultaneously to test:

- Saved character appearance: skin, hair, hairstyle and clothing.
- Click/tap to walk, routing around the long table.
- Eight exclusive seats, chat and emotes.
- Eight shared wall displays with books, plants, banners, crystals and trophies. Display pieces are free preview objects, not inventory rewards.
- Seated players can invite each other to the existing Skystones (formerly called Brawl) PvP game. Both must accept the same deck limit and timer. Matches have zero Footy stake and reuse existing deck selection, rules, clocks and battle polling.

Characters save to `users/{id}.townHallCharacter`. The shared level and decorations save to `communityRooms/town-hall`. Concurrent decoration changes use a transaction and revision check. Accepted invitations create a deterministic battle document transactionally, preventing duplicate matches on retries.

Presence, movement, chat and pending invitations are in memory on a **single Node server process** during this preview. Polling runs every 1.5 seconds without per-poll Firestore reads; shared decoration/level reads are cached for 15 seconds. Presence expires after 12 seconds without contact. Room tokens last five minutes, then the client rejoins using normal account authentication. Closing the room stops polling and leaves. A process restart loses presence/chat/pending invitations; characters, shared decorations, level and created games survive. Multiple backend instances would need shared presence transport before public rollout.

Only explicit character saves, decoration/level changes and accepted games write persistent state. Existing Firestore default-deny rules keep the new room collection server-only. No client Firestore subscription or new index is required.

## Deployment and checks

Deploy frontend and backend together, including the Town Hall routes, shared battle-match builder, world logic, room UI and local artwork. The gate remains admin-only. Public rollout is a separate change.

`node --test` includes village authorization, independent forge progression, room access, two-player presence, collision routing, exclusive seats, character sanitization, decoration revisions and idempotent Skystones creation. The fixture browser harness supports `VILLAGE_CHECK_ONLY=1` and `TOWN_HALL_CHECK_ONLY=1`; both use local fixtures rather than live account writes. The Town Hall check uses two browser sessions and verifies the handoff to the existing PvP setup. Screenshots live under `.ui-tools/`.
