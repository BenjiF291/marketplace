# Free seven-hour pack

The retractable island toolbar occupies the creature book corner and contains the book, Daily pack, Arrange village, Profile, and Building help. The toolbar follows the active game dialog. Arrangement and building help return to the island before invoking the original controls.

Players open Daily pack and select **Claim free pack**. All five rewards and the next claim time are saved atomically before the five cards are revealed. The cooldown is measured from the last successful claim, not a calendar date. Opening the toolbar pack presents a sealed illustrated pack over the island. Tapping opens a fanned stack of five illustrated reward cards. Each click sends exactly one front card off the top of the screen; after the fifth card the overlay closes. The last five rewards can be viewed again through Pack details & odds. The browser keeps a pending request ID until a successful response, allowing safe retry after a dropped connection. Concurrent claims cannot bypass the cooldown.

Default card chances are 20% each for the first four cards. Cards 1?3 draw 5?15 Rubies, 3?12 Footy, 1 Skip, 1 Leap, or 3?6 Garnet. Card 4 draws 10?25 Rubies, 7?17 Footy, 2 Skips, 1 Leap, or 6?15 Garnet. Card 5 temporarily awards 10 Rubies at 100% until an admin configures it. Ranges are inclusive, whole-number, uniform draws. Each card awards one of its configured possibilities.

Admins open Daily pack ? **Edit pack**. Edit the pack name, enabled setting, claim interval, five card titles, and each card's reward possibilities, amounts, and percentage chances. Add and remove options freely; each card must total 100%. Rewards can be animals, Footy, any standard gem currency, Skip/Leap, shop items, amulets, catalogue cards, or configured collection packs. Card and pack rewards enter the normal inventory. Configured collection packs must have cards. Setting changes affect future claims; already-awarded rewards remain unchanged.

The authenticated server endpoints are GET `/free-pack`, POST `/free-pack/claim`, and admin-only GET/PUT `/admin/free-pack`. Settings live at `gameSettings/freePack`; claim time and the latest receipt live on the user. The existing marketplace daily-pack scheduler remains independent.

Deploy the backend and frontend together. No initial database setup is needed: defaults apply until the first admin save. Validation rejects invalid items, malformed percentages, and fractional reward quantities. Tests cover reward ranges, wallet updates, authorization, atomic cooldown, duplicate claims, editor wiring, and toolbar actions.

## Animals and the Stable

Select **Animal** in any reward row, then choose a creature and its amount range/chance. The catalogue covers all 17 current book creatures. Fox, snail and pocket-dragon rewards go to the existing companion inventory. The other 14 creatures are counted in `users.stableAnimals`; duplicate awards increase their counts. The creature book reflects these owned animals.

The Stable unlocks at Town Hall level 1. Place it from **Arrange village**, then enter it to view owned animals, counts, and creature information. Existing island placements are preserved; no Stable is automatically inserted into an occupied island. Storage exists independently of placement, so claiming an animal before placing the building cannot lose it. GET `/stable` authenticates and returns only the caller's animals.

## Opening presentation

`reward-opening.js` and `reward-card-art.js` provide the shared sealed-pack and sequential card presentation. All configured rewards have a card showing the amount, item name, and an illustration or existing item/creature artwork. Standard collection packs use the same flow and show earned Footy/Ruby bonuses as additional cards. Purchased Embers/Aurora opening effects use the same sequence with their own wrapper and glow colours. Server rewards are saved before animation, so closing or refreshing never changes the claim. Card-flight inputs are locked until the flight finishes, with a timer fallback for missing animation events; reduced motion uses instant transitions. Close, keyboard buttons and Escape remain available outside request/transition locks.

Admins can claim unlimited enabled free packs for testing: server-side `isAdmin` bypasses the claim cooldown and the UI shows testing availability. These are real rewards added to the admin account. Other players keep the configured interval. Receipts keyed by account and request ID prevent repeated requests from awarding again, even after subsequent admin test claims. Cards show a plain numeric amount without a prefix or category heading. The next opaque card moves forward immediately as the outgoing card starts its shorter flight; no card-face fade is used.

## Admin card gallery

Open Daily pack ? **All reward cards**, or use **Pack details & odds ? Preview all reward cards**. The gallery reads the full admin catalogue, including options not currently configured in the pack. It shows one amount-1 example for each distinct reward, grouped as gems, Footy, time boosts, animals, shop items, amulets, collection cards, and collection packs; each category is alphabetical. Search by name or view a card full size and move through the ordered list with Previous/Next or arrow keys. Both gallery and real openings use the same card renderer. Previewing only reads the catalogue and never claims a pack or modifies inventory.
