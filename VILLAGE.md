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

The farmhouse unlocks at Town Hall 2 and starts at tier 1. Tier 2 costs 50 rubies and tier 3 costs 100. Assign a household to a specific ingredient; jobs stop after three units, regardless of household size. Water takes 20 minutes/unit, carrots 40, corn 80, milk 120, meat 240. Existing shifts retain their original interval. Tier 1 unlocks water/carrot, tier 2 adds corn, tier 3 adds milk/meat. Collect while working or after completion; recalling collects completed units and discards the partial interval. Completed jobs free the household even before collection. A household cannot mine, farm, or care for a pet concurrently.

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

### Welcome posters and island names
Landscape and portrait devices load separate wallpaper illustrations via a picture source and orientation-specific preload. The welcome sign uses a local serif font and an account-keyed name cache before app startup, avoiding web-font swaps. Unnamed accounts are prompted on their next island visit; `/village/name` validates and saves the name transactionally to the authenticated account. Repeat requests retain the first saved name. Other devices read it from `/admin/village`.
The loading bar reports approximate completed stages: account data, decoded map artwork, fonts and camera preparation. It reaches 100 only when the island is ready; it does not advance on a timer. Failed account loads retain retry/logout controls.
Building sprites use explicit source-space ground anchors mapped to the same plot coordinate, including house tiers, mines, the job station and forge variants. Plot markers are centered on those coordinates.

The welcome wallpaper is shown only until the first successful island startup in a page session. Pet visits, building returns and background refreshes reuse the island without reopening it. All 32 plot footprints have been retraced onto grass in the original painting and scaled to world coordinates; their IDs are preserved so existing layouts migrate without deleting buildings or changing jobs.

### Care room and progression updates
Hut and mine clicks show compact map actions. Upgrade restrictions and prices remain available on the upgrade control; mine collection only appears when a ruby is ready.
Farmhouse tiers 2 and 3 require Town Hall 5 and 6 respectively, with unchanged costs of 50 and 100 rubies. Existing purchased tiers remain usable. The Town Hall progression road lists each level's XP threshold and unlocks.
The farmhouse and job centre have dedicated painted interior backdrops. The pet station has its own exterior and overhead room with locally animated caretaker and pet. Meals and the ball support pointer dragging onto the pet or tapping the item. Pet play has a one-hour cooldown and feeding has a two-hour cooldown, independently per pet and persisted server-side. Failed actions do not consume food or start cooldowns. The island exploration shortcut is removed; journeys remain in the companion lodge.

### Marketplace street and room presentation
Entering the marketplace opens a painted, overhead street with four stalls. Click the open paving to move your character locally; walking creates no backend requests. The cards-and-packs stall opens the existing trading interface, with a return link to the street. The food stall sells existing meals only after their farmhouse tier is unlocked (also enforced by the purchase transaction). The clothing stall sells permanent extra outfits: Botanist apron 15 Footy, Mariner jacket 25 Footy, Starlight robe 40 Footy. Owned outfits can be equipped there or selected in the Town Hall character editor; the server rejects unowned premium outfits.
The farmhouse artwork fills its room background. The pet station preserves its 480-by-960 room proportions in a scrollable viewport, including mobile. Hut actions display the unchanged tier prices, 25/40 rubies. Active mines show a small local countdown to the next five-minute ruby interval beneath their actions.

### Wardrobe and player stall
The clothing stall has 48 choices across ten equipment categories, with large previews and slot selection. Starter and currently worn clothes remain usable; additional clothes are purchased with Footy. Body, face, hair and beard choices stay free. Town Hall character saves and shop equipment actions validate ownership transactionally.
The fourth market stall trades owned shop goods, clothing, ingredients, dyes, amulets and unopened packs. Cards stay in the existing card market. Goods enter escrow when listed, and withdrawals restore remaining stock. In-use pets, equipped goods and lent collectibles cannot be listed. Buyers pay 90% of the base game price in the original currency; clothing uses Footy. Prices are calculated server-side, transactions are atomic and action IDs deduplicate retries.
Assigned base prices for goods without a game shop price: water/carrot/corn/milk/meat cost 2/4/8/12/24 Footy before the 10% reduction; dyes cost 5 Footy times tier rank (starting at one); trophy-exclusive amulets use 100 Footy. Packs use the current daily game-offer price when available; otherwise they use three times their tier card sell value, or 100 Footy for an unclassified pack, before the reduction. These are fixed reference values, not player-entered asking prices.
Villager purchases exclude packs and cards. Stock of 1-9 eligible units earns one sale/day, 10-99 earns two, 100-999 earns three, and 1000+ earns four. Sales choose a random stocked product. Offline settlement is capped at seven days and happens when the owner opens the stall or another player buys from it. Movement is cosmetic and local; no continuous background database polling is added. Market browsing is paginated in groups of 50 stalls. Sales history is capped at 20 entries.
The farmhouse now uses a unique red-roofed farm building sprite with a hay loft, vegetable beds, feed sacks and fenced yard, at the existing plot scale.


### Multi-pet care and Time Bank
The pet station supports one caretaker per owned pet simultaneously. Legacy single-pet assignments migrate when changed. Each pet can be recalled individually; assigned pets cannot explore or be sold. Walking uses animated paws (or a snail glide), with local bed rests, drinking, ball play and visible feeding. These animations make no network calls. Room zoom buttons preserve the painting's proportions, with larger residents, a wider desktop control layout and a smaller mobile starting zoom.
Building pointer targets are generated from each local PNG's alpha channel, clipped to the same atlas frame as its artwork. Transparent corners and gaps no longer intercept buildings behind them. Pointer taps have no rectangular focus flash; keyboard focus retains a visible glow.
The Time Bank unlocks at Town Hall 4 and accepts 0-10 workers. With n workers (1-10), production interval is 5 - (n-1)*2.5/9 hours and leap probability is 5 + (n-1)*10/9 percent. Skips advance one personal timer by 20 minutes; leaps advance it by one hour. The bank stores three unharvested boosts, pauses at capacity with no overflow, and keeps workers assigned until recalled. Changing worker count preserves fractional progress. Harvesting awards 2 XP per boost. Production uses server-owned time and persisted random rolls, with no background writes.
Manage the bank through its building or the central job station. Harvested boosts are spent from the Time Bank's timer selector: mines, ingredients, vault work, bank production, pet journeys, pet play/feed cooldowns the fortune pavilion cooldown and personal amulet removal locks. Boosts stop at timer completion; unused time is lost. Rewards are still collected normally. Transactions validate owned boosts and active timers, retain the last 50 spending receipts to deduplicate retries, and preserve existing farm intervals. The added plot leaves all legacy buildings and houses in place.


### Whole gems and personal marketplace limits
Gem-denominated player-stall prices use the nearest whole gem (minimum one); Footy still supports cents. Existing fractional gem listings are normalized when viewed or traded, and all gem spending/reward paths use whole balances. Legacy fractional balances round up to preserve player value; island entry persists this repair only when needed, with no recurring migration writes.
The marketplace filters out listings whose group purchase count has reached that viewer's limit, as well as one-per-player items already purchased. Group counts remain authoritative and purchase transactions still enforce limits. New one-per-player purchases also retain an account-owned identity so consuming or selling the item cannot reopen its limit. Sellers retain their listing-management view. Player stalls hide unique goods the viewer already owns. Daily-pack previews receive the same filtered marketplace results.
Validation: all 220 Node tests pass; local Edge checks cover silhouette click targets, three pets and caretakers, feeding/play animations, mobile overflow, ten Time Bank workers and spending a time skip.
