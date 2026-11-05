# Creature Brawl rebalance v2

New matches use `creature-brawl-balance-v2`. Existing matches retain their stored unit stats and move definitions and remain playable; no grades, ownership, tokens, or rewards are reset.

## Design

Every creature has a free single-target basic attack, a role special, and a signature special. Specials spend shared team AP. Costs replace cooldowns. Roles have consistent same-grade stat budgets, with only a 3% health/speed trade-off for named variants. Rarity provides no hidden combat advantage.

| Role | Class special | AP |
| --- | --- | --- |
| Swift | 120% strike; enemy attack -20%, 2 turns | 2 |
| Cunning | 110% strike; enemy defence -25%, 2 turns | 2 |
| Furious | 110% strike; own attack +20%, 2 future turns | 2 |
| Protector | Team heal 12%; own defence +20%, 2 future turns | 3 |

Control has a damage trade-off; no team-wide stuns, infinite damage-over-time, resurrection, or free AP loops. Existing stun recovery immunity, non-stacking statuses, capped shields, and surge/draw rules remain. Status durations count the affected creature's activations, rather than whole team rounds. Velkris venom uses the existing Burn status (5% max HP per tick), so the HUD continues to display Burn.

The AI now values useful buff duration and magnitude rather than giving all statuses the same flat score. It uses the same moves and AP rules as the player.

## Signature abilities

| Creature | Ability | AP | Effect |
| --- | --- | --- | --- |
| Ember Fox | Woodland Rally | 3 | Raise team speed 20% and attack 15% for 2 turns. |
| Crystal Snail | Steadfast Shell | 3 | Shield self for 22% max HP and draw single-target attacks for 2 future turns. |
| Pocket Dragon | Ember Storm | 4 | Strike all enemies at 85% power. Burn each for 5% max HP on its next 2 turns. |
| Aeri | Slipstream | 3 | Raise team speed 25% for 2 turns. |
| Rill | Uplifting Call | 3 | Heal one ally 20%, shield it for 10% max HP, and remove one debuff. |
| Brakk | Bedrock Challenge | 3 | Draw single-target attacks, raise defence 30%, and shield self 15% for 2 future turns. |
| Brugar | Grounded Crush | 4 | Strike one enemy at 215% power, ignoring 30% defence. |
| Virex | Expose Weakness | 4 | Strike all enemies at 80% power and lower defence 25% for 2 turns. |
| Krynn | Disrupting Roar | 4 | Strike all enemies at 75% power and lower attack 20% for 2 turns. |
| Saelis | Clear Resolve | 4 | Remove one debuff per ally, heal each 15% max HP, and raise attack 15% for 2 turns. |
| Fenra | Crest Pulse | 4 | Strike all enemies at 80% power and heal every ally 10% max HP. |
| Kael | Predator Frenzy | 3 | Strike one enemy twice at 95% power per hit. |
| Tharos | Thunderous Sweep | 4 | Strike all enemies at 110% power. |
| Talren | Breaking Bellow | 4 | Strike all enemies at 80% power and lower defence 25% for 2 turns. |
| Northern Talren | Unbroken Stand | 3 | Heal self 20% max HP and draw single-target attacks for 2 future turns. |
| Defender Talren | Shield Check | 3 | Strike at 115% power and skip the target's next turn. Recovery prevents immediate repeat stuns. |
| Defender Rill | Swooping Assault | 4 | Strike all enemies at 95% power and lower speed 20% for 2 turns. |
| Kanji | Wing Guard | 3 | Shield each ally for 18% max HP and raise defence 15% for 2 turns. |
| Trusk | Armoured Rush | 3 | Strike at 170% power, ignoring 25% defence. Raise own defence 20% for 2 future turns. |
| Velkris | Venomous Sting | 3 | Strike at 85% power. Venom deals 5% max HP on the next 2 turns; Bind blocks specials for 1 turn. |

## Reference patterns

Inspired by Rise of Berk's shared AP, free basic attacks, role identities, healing, shields, buffs/debuffs, and costly control. The values are tuned for Valemere's own health, speed, defence formula, and activation rules; they are not claimed to be exact Rise of Berk presets.

- [Official action point rules](https://ludia.helpshift.com/hc/en/11-dragons-rise-of-berk/faq/247-brawl-what-are-action-points/)
- [Official Brawl roles](https://ludia.helpshift.com/hc/en/11-dragons-rise-of-berk/faq/256-brawl-what-do-the-colored-circle-symbols-in-brawl-next-to-my-dragon-mean/)
- [Official control and damage-over-time examples](https://dragonsriseofberk.com/release-notes/rise-of-berk-1-70/)

## Validation

`node scripts/check-ability-balance.cjs` runs 760 deterministic equal-grade substitution matches: identical support creatures on both teams, each focal creature against every other creature, two support compositions, and both starting priorities. Results are written to `output/ability-balance-report.json`. Draws count as half a win. This catches obvious gaps; two support compositions and automated play do not prove equal win rates for all player strategies.

Unit coverage checks the class budgets, effect caps, friendly/enemy targeting at grades 1/5/10, deterministic combat, animation clips, ownership, settlement, and compatibility with saved v1 matches.

Validation result: 39 automated tests passed, all 760 substitution matches completed, and the full-index desktop/mobile battle smoke test passed.
