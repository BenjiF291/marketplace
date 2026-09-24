# Ruby Cabinet

The header Ruby shop opens the shop in both UI styles. Home shows owned relics and the selected companion; profile styles decorate the Current User panel. Three companions (100/150/250 Rubies) roam on Home, react to clicks, and optionally enjoy 2-Ruby treats. No hunger, decay, or gameplay penalties. Local movement makes no server requests and respects reduced motion. Relics cost 150/250/400, pack reveal effects 100, and profile styles 60/120. Permanent items may be equipped/unequipped; collectibles stay on the shelf.

## Consumables

- Recall: 40 Rubies, removes one equipped amulet immediately, returns it to inventory, consumes one token.
- Fuel: 15 Rubies. Arm in the shop, then the next successful conversion consumes one fuel. Saves half the Footy cost after amulet discounts, capped at 100 Footy.
- Wheel retry: 20 Rubies. Replaces the last spin payout (can be lower), preserving that spin's VIP multiplier and amulet bonus. Must be within seven hours of that spin. Once per Amsterdam date; does not change cooldown or spin count. Players must have enough balance to cover a worse replacement. Spins made before this deployment are not eligible.

## Compass prices and eligibility

| Compass | Rubies | Highest eligible tier |
|---|---:|---|
| Common | 12 | Silver |
| Uncommon | 25 | Rare Gold |
| Rare | 45 | Lightning |
| Ultra Rare | 80 | Ultra |
| Mythical | 140 | All configured special tiers |
| Legendary | 220 | All packs, including unclassified packs |

Choose a compass when opening an inventory pack. The server draws up to three distinct cards from its contents and saves the choices on the pack while consuming one compass. Pick one card. The other cards are not awarded. Closing/reopening resumes the same choices. Packs with a pending choice cannot be listed for sale. Small packs offer only the number of unique cards they contain. Lower compasses also cover lower tiers. Existing configured tier ordering and pack assignments determine eligibility; known trophy packs use their matching tier.

## Persistence and deployment

Ruby shop purchases and uses are authenticated, transactional, and deduplicated by action ID. Utility rewards and consumption are server controlled. Ruby shop items can also be granted from the existing admin grant hub. New account fields use empty defaults; no account migration is needed. `rubyActions` receipts are server-only under existing default-deny rules.

Deploy backend and frontend together. No new Firestore composite indexes or rule changes. Converter base costs are now one tier sell price per card, replacing the previous 1.5x multiplier. Pack-opening, VIP, and amulet rewards remain compatible.
