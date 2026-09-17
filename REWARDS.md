# Rewards and progression

## VIP and wheel

- VIP gives a 20% chance of exactly one extra matching gem per successful converter
  use, regardless of whether one, two, or three cards are used.
- The roll is server-side and fixed across transaction retries. Consumed cards
  cannot be submitted again for another payout.
- VIP and full-batch amulet bonuses stack, and the conversion result identifies both.
- The wheel cooldown is seven hours from the last successful spin. Existing timers
  use the shorter cooldown immediately. VIP still doubles the base wheel reward;
  amulet bonuses are added afterward.

## Amulet variety

The original five amulets per gem tier keep their IDs and powers. Two additional
amulets per tier rotate through four new power families, giving seven per tier.
Only the strongest equipped amulet of each family applies. Existing slot prices
and the five-day removal lock are unchanged.

| New family | Effect | Scaling by tier rank, starting at zero |
| --- | --- | --- |
| Prism Brush | Extra dyes from each gem crafted into dye | floor(min(3, 1 + rank × 0.15)) |
| Hidden Geode | Chance of one Ruby from an opened pack | min(25, 10 + rank)% |
| Third Chime | Extra Footy on every third wheel spin | min(18, 6 + rank) |
| Perfect Furnace | Extra matching gem for a three-card conversion | 1 |

New shop prices are 35 or 42 matching gems, plus 3 per tier rank (rank capped at
12 for pricing). Third Chime follows the player's successful spin count; the amulet
must be equipped on the third spin to receive its bonus. Its slot shows spins left.

Four exclusive amulets come from the trophy road. They cannot be bought in the
gem shop; administrators can grant them for testing using the existing grant hub.

| Trophies | Exclusive amulet | Effect |
| --- | --- | --- |
| 100 | Trailblazer Chime | +9 Footy on every third wheel spin |
| 500 | Chromatic Compass | +2 dyes per gem crafted into dye |
| 1,750 | Champion's Laurel | +3 trophies per ranked win; no effect on Skill Level |
| 3,000 | Eternal Furnace | +2 matching gems for a three-card conversion |

## Trophy road

There are 24 milestones. Original rewards and their claim IDs remain unchanged.
Existing players can claim newly inserted milestones below their peak, once each.
Packs, amulets, currencies, dyes, and the claim marker are granted in one transaction.

| Trophies | Footy | Other rewards |
| --- | --- | --- |
| 25 | 50 | — |
| 50 | 60 | 3 Ruby, 5 Ruby dyes |
| 75 | 100 | 5 Ruby |
| 100 | 100 | Trailblazer Chime |
| 150 | 150 | 5 Garnet |
| 200 | 125 | Ruby Victory Pack |
| 250 | 200 | 5 Moonstone |
| 350 | 200 | 5 Moonstone, 10 Moonstone dyes |
| 400 | 300 | 5 Opal |
| 500 | 250 | Chromatic Compass |
| 600 | 400 | 5 Citrine |
| 750 | 350 | Moonstone Victory Pack |
| 850 | 500 | 5 Emerald |
| 1,000 | 500 | 10 Citrine, 15 Citrine dyes |
| 1,150 | 650 | 5 Sapphire |
| 1,250 | 600 | Citrine Victory Pack |
| 1,500 | 800 | 5 Amethyst |
| 1,750 | 800 | Champion's Laurel |
| 2,000 | 1,000 | 5 Diamond |
| 2,250 | 1,000 | Sapphire Victory Pack |
| 2,500 | 1,200 | 15 Amethyst, 20 Amethyst dyes |
| 3,000 | 1,500 | 10 Diamond, Eternal Furnace |
| 4,000 | 2,000 | 15 Diamond, Diamond Victory Pack |
| 5,000 | 2,500 | 25 Diamond, two Diamond Victory Packs |

Victory packs contain one randomly selected normal card from their matching
configured gem tier. Their pack definitions are created when claimed. If that
tier has no configured cards, claiming fails without consuming the reward.

Deploy frontend and backend together. These changes use existing server-managed
account, item, and pack fields; no new Firestore rules are required.
