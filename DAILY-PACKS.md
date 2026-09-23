# Automatic daily marketplace packs

The server schedules one pack listing per Amsterdam calendar date, at startup or on the next minute tick after midnight. It posts today's listing when waking after downtime; it does not backfill missed days. An always-running server is needed for exact daily availability.

Tier probabilities: Bronze 80%, Rare Bronze 6%, Silver 4%, Rare Silver 2.5%, Gold 2%, Rare Gold 1.8%, Platinum 1.5%, Lightning 1.2%, Ultra 1%.

Prices use the tier's configured card sell price, sampled from a triangular distribution with minimum 1x, most likely multiplier 1.4x, and maximum 2x, rounded to two decimals. A 25 Footy tier gives prices from 25 to 50, concentrated around 35. The chosen price is saved with the listing and does not change on refresh or restart.

Default stock is 20 packs, one per player per daily listing. These settings are in the daily pack service configuration in server.js. Listings use an existing admin as seller, existing assigned packs and the normal purchase flow. No automatic VIP discount is applied.

Each listing expires 120 hours after scheduling. Expiry cleanup preserves purchased inventory. Daily notices appear in the existing planned listing admin list. Durable daily markers prevent a second listing after restarts, concurrent workers, or dismissal/deletion of a notice. Successful days skip subsequent scheduler reads in the same process.

Every tier needs a positive sell price and at least one assigned pack containing cards. Missing configuration is logged and retried without rerolling the tier, preserving the probabilities.

Deploy the backend to enable this feature. No frontend, Firestore rule, or composite index changes are needed.
