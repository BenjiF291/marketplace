> Public island release: island navigation is now mandatory for every signed-in account. Admin tools and local level previews remain admin-only. All accounts earn personal Town Hall XP. The server must run as one instance for shared presence. Deploy the frontend and backend together. Earlier preview notes below describe development history.

# Town Hall: private progression, shared community room

Available to all authenticated accounts. Frontend and backend must deploy together. The room, table, chat and decorations are shared. Every account has its OWN Town Hall level and village building unlocks, derived only from server-owned `townHallXP`. Previous shared test levels are ignored; accounts without personal XP start at level 1. The admin-only simulated level dropdown changes appearance only.

## XP and upgrades

Cumulative thresholds for levels 1-10: **0, 100, 300, 650, 1150, 1850, 2850, 4200, 6000, 8500**. Level 2 unlocks Blacksmith/Ruby emporium, 3 companions, 4 dyes, 5 refinery, 6 Royal hall. Levels 7-10 are prestige levels for now. XP never exceeds 8500. The room shows current progress and the next unlock. Upgrades happen automatically, with a golden level-up celebration; reduced-motion preferences disable motion. Returning to the island refreshes its unlocked buildings.

Small activity rewards replace the former resource-for-XP projects. Existing XP is preserved. The combined daily limit is 100 XP per UTC day, including collectible display bonuses.

| Completed activity | XP |
|---|---:|
| Wheel spin | 3 |
| Pack opening | 5 |
| Pet journey claim | 6 |
| Ranked win / draw / loss | 10 / 6 / 4 |
| Training battle / fully played PvP battle | 2 / 6 |
| Marketplace purchase / sale | 2 / 3 |
| Sell card to bank / ascend cards | 2 / 5 |
| Convert cards / compress gems | 3 / 2 |
| Craft dyes / consume dye on a change | 1 / 1 |
| Upgrade converter / build compressor | 8 / 8 |
| Craft amulet / unlock amulet slot | 4 / 5 |
| Ruby-shop purchase / feed pet | 2 / 1 |
| Claim trophy reward / first collectible display | 3 / 3 |

No XP for transfers, listing/cancelling an unsold item, free cosmetic/equipment toggles, grants, opening menus, forfeits or failed actions. PvP XP requires finishing the deck, not a timeout. Marketplace records carry the rewarded buyer/seller histories through resale: each account earns each role's XP once per physical item, up to 32 distinct accounts per role. This prevents repeat back-and-forth sale XP. Activity rewards apply to every account.

XP commits alongside existing gameplay transactions. Paid PvP already reads accounts; zero-stake completed PvP now reads both accounts to award XP. No extra per-move XP reads occur. Retried pack openings, card consumption, trades, trophy/journey claims and match settlements follow existing exactly-once protections. Crafting only grants XP after successful resource consumption; XP is per action, not per resource spent. The retired project endpoint rejects old clients without spending resources.

## Collectible displays

The existing Ruby Rose, Crimson Moon and Ancient Geode Crown can be displayed. New Ruby-shop collectibles: Archivist Books (60 Rubies), Fern Planter (75), Community Pennant (100), Skystones Trophy (300), Obsidian Dragon (500). No freely placed test decorations remain visible.

A display is a loan: the account retains ownership and its personal collectible. A single owned type can occupy only one shared shelf for that contributor. Other owners can display their own copy. Placement verifies ownership from the user document within the room transaction. Contributors' names appear below displays. The owner can remove or replace their display; admins retain moderation access. Room revisions prevent concurrent edits from silently overwriting one another.

## Character creator and art

Twelve saved appearance settings: skin, hair colour, eye colour, clothing colour, trim, trousers, six hairstyles, three outfits, four headwear choices, three cape lengths, four accessories and three beard choices. Every value is allowlisted server-side. Layered SVG characters preserve direct customisation and support walking, blinking and seated poses.

The painted room keeps the established walkable floor, long table, eight seats and eight wall displays. The original multiplayer/game invitation flow is reused. Room and collectible art load from local PNG files only. Art prompts and asset paths: `public/assets/village/TOWN-HALL-ART.md`.

Presence/chat remain in server memory on one backend process. Walking/polling do not read Firestore per tick. Progress and ownership refresh when joining or opening projects/displays; decorators/projects write only explicit changes. Default-deny Firestore rules cover new `townHallActions` receipts. No new index is needed. User accounts remain server-only.

## Verification

`node --test` covers progression thresholds/caps, retired projects and transaction retries, independent levels, missing ownership, display duplication, one-time showcase XP, authorisation and existing game regressions. `TOWN_HALL_CHECK_ONLY=1 node scripts/check-studio.cjs` uses two local fixture sessions to check character persistence, shared owned decorations, private level-up celebration, chat, seats and the Skystones handoff. Browser fixtures do not mutate live accounts.
