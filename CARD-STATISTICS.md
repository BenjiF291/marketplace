# Card statistics

The Marketplace filename catalogue remains available at `GET /card-images`. To read the statistics for one card, call `GET /card-data?card=<filename-or-id>`. This uses the same public access as the image catalogue. It returns the card's ID, name, tier, saved Overall, six stats and image URL. A missing image, missing structured record or malformed record returns HTTP 404 with an unavailable message. A temporary read failure returns HTTP 503. Special-tier dashes are returned as JSON `null`.

Browser code can call `await window.CardData.getCardData(filenameOrId)`. It returns the card object or `null` when unavailable. A temporary request failure throws. In Marketplace and inventory, open the artwork and activate the enlarged card to flip it. The reverse uses the saved allocation from `GET /card-data?card=<filename-or-id>&mode=ben-bal`.

## Prepare a release

1. From the Marketplace checkout with the reviewed Card Creator records on disk, run `npm run package:card-data` after adding or correcting a card.
2. Check the command's included and missing counts and review the changes to `data/card-statistics.json`. Package errors leave the previous export in place.
3. Include the generated `data/card-statistics.json`, `data/ben-bal-allocations.json` and the corresponding catalogue image files under `public/images` when preparing the normal Render release. Keep `.card-creator/` private. The [Ben-Bal release notes](BEN-BAL.md) describe how packaging assigns stat keys to eligible new cards.

Render starts the Marketplace server with `npm start`. The server uses validated local sidecars when present and the packaged statistics otherwise. The export lives outside static hosting paths and includes only card statistics, names, IDs, tiers and image references. The build does not require the Card Creator checkout, the Card Creator service or Firebase access to supply card statistics.

Run `node --test --test-isolation=none card-statistics.test.js` to check the read-only route and packaging with disposable fixtures and the shipped catalogue.
