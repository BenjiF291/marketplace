# Free seven-hour pack

The retractable island toolbar occupies the creature book corner and contains the book, Daily pack, Arrange village, Profile, and Building help. The toolbar follows the active game dialog. Arrangement and building help return to the island before invoking the original controls.

Players open Daily pack and select **Claim free pack**. All five rewards and the next claim time are saved atomically before the five cards are revealed. The cooldown is measured from the last successful claim, not a calendar date. The last five rewards can be viewed again. The browser keeps a pending request ID until a successful response, allowing safe retry after a dropped connection. Concurrent claims cannot bypass the cooldown.

Default card chances are 20% each for the first four cards. Cards 1?3 draw 5?15 Rubies, 3?12 Footy, 1 Skip, 1 Leap, or 3?6 Garnet. Card 4 draws 10?25 Rubies, 7?17 Footy, 2 Skips, 1 Leap, or 6?15 Garnet. Card 5 temporarily awards 10 Rubies at 100% until an admin configures it. Ranges are inclusive, whole-number, uniform draws. Each card awards one of its configured possibilities.

Admins open Daily pack ? **Edit pack**. Edit the pack name, enabled setting, claim interval, five card titles, and each card's reward possibilities, amounts, and percentage chances. Add and remove options freely; each card must total 100%. Rewards can be Footy, any standard gem currency, Skip/Leap, shop items, amulets, catalogue cards, or configured collection packs. Card and pack rewards enter the normal inventory. Configured collection packs must have cards. Setting changes affect future claims; already-awarded rewards remain unchanged.

The authenticated server endpoints are GET `/free-pack`, POST `/free-pack/claim`, and admin-only GET/PUT `/admin/free-pack`. Settings live at `gameSettings/freePack`; claim time and the latest receipt live on the user. The existing marketplace daily-pack scheduler remains independent.

Deploy the backend and frontend together. No initial database setup is needed: defaults apply until the first admin save. Validation rejects invalid items, malformed percentages, and fractional reward quantities. Tests cover reward ranges, wallet updates, authorization, atomic cooldown, duplicate claims, editor wiring, and toolbar actions.
