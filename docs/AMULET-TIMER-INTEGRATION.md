# Pack, amulet and timer integration

- Time Bank Skips/Leaps support the daily pack and each active personal pack-shop cooldown, alongside the existing mine, farm, vault, care, journey, amulet-removal and Time Bank timers. Server-side configuration is read before transactional writes. Game/match clocks, UTC reward caps and VIP entitlement days are not personal production cooldowns and are not accelerated.
- Daily pack timing and pack-shop timing use shared `pack-timing.js` helpers. Equipped cooldown amulets apply to the configured duration; Skips/Leaps then advance the stored personal start timestamp. A boost stops at completion, spends once under retry, and leaves other packs alone. Timers reflect the current equipped amulets and current admin configuration.
- Daily claims now include Unsealer Footy and Hidden Geode Ruby bonuses, shown as extra reward cards and included in the saved claim receipt. Claim retries return the same rewards without another payout.
- Token Cache augments creature-token reward quantities for daily and regular pack openings and their shop odds. Matches remain a zero-token source.
- Pack-shop prices use Pack Patron/Merchant Hourglass discounts and the existing Footy-only Bargainer discount, choosing the strongest applicable percentage. Gem prices round upward. The server validates and charges the displayed effective price.
- Victor Crest battle percentages apply to eligible creature-Brawl win Footy and ranked card-Brawl booster Footy, in addition to existing player-duel winnings. Practice awards no permanent rewards. Trophy-only bonuses still affect existing trophy payouts; no new creature-Brawl trophy payout was introduced.
- Pack odds previews start at the last configured card, including packs with fewer or more than five cards.

## Four new designs per gem tier

| Design | Base effects before existing rarity scaling |
|---|---|
| Discovery Hourglass | 8% shorter daily-pack cooldown |
| Merchant Hourglass | 8% shorter shop cooldowns, 4% off shop prices |
| Token Cache | +1 token per packed creature-token reward, +3 Footy per pack opening |
| Temporal Lens | 10% more time removed by Skips/Leaps |

Equipped non-price bonuses add, including duplicate copies. Percentage price discounts retain the highest applicable value. Daily/shop cooldown reductions and Ruby chances add up to 100%. Per-item caps remain: daily/shop cooldown reductions 40%, shop discount 30% (existing Bargainer retains its own cap), packed-token bonus 5, boost duration increase 50%; these are not aggregate caps. New designs cost 42 matching-tier gems before amulet-shop discounts; the five existing per-tier prices, all existing IDs, special-tier design selection, trophy exclusives and equipped removal locks are preserved. There are now nine regular designs per tier.

Frontend caches are versioned. Restart the Node server and refresh the browser to activate the changes. No deployed account settings were edited as part of implementation.
