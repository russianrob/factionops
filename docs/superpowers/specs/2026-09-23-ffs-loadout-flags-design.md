# FFS loadout flags — design

**Status:** scope for approval. Nothing built.

A warning marker beside a war-row target when that player has recently been
seen carrying a **red-rarity primary** or **EOD armour**, so a caller knows
before they commit.

---

## Why this is small

Three things checked before writing this, each of which could have made it big:

- **FFS already runs everywhere.** `@match https://www.torn.com/*` covers attack
  pages, so capture and display live in one script. No second userscript, no
  second install.
- **FFS already has `@connect tornwar.com`.** No new permission, no re-consent.
- **FFS already resolves a row's player id.** `a.href.match(/XID=(\d+)/)` at
  three existing call sites; the display hook is a lookup away.

## What Torn actually gives us

From the attack payload, per equipped item:

| Field | Use |
|---|---|
| `item.rarity` | `"yellow" \| "orange" \| "red"` — the red-primary flag |
| `item.currentBonuses` | `{ title, value }`; armour title `"Full"` is EOD |
| `item.equipSlot` | which slot the item is in |
| `item.name`, `item.ID` | identification |

**Torn does not always reveal this.** Enemy items appear only when the fight
reaches a state that shows them. So a single player's sightings are sparse —
which is the whole reason a crowd-sourced service exists for it.

**Warboard is already faction-wide, and that is the answer.** Pool sightings
across all 86 members and the coverage problem mostly dissolves for the targets
that matter: the faction we are currently at war with, which everybody is
hitting at once.

## Shape

```
attack page  ──capture──▶  POST /api/loadout/seen  ──▶  per-player store
                                                            │
war page     ◀──flags────  GET /api/loadout/flags?ids=…  ───┘
```

**Capture** (FFS, attack pages). Read the equipped items already present in the
page's attack data. Emit one record per sighting: `targetId`, `seenAt`,
`redPrimary` (bool), `eod` (bool), plus the item names behind them so a flag can
explain itself rather than being an unexplained icon.

Only when the page is **focused**. Torn's rules prohibit acting on an unfocused
page, and KAL gates its own capture the same way — this is not a detail to get
casual about.

**Store** (warboard). Last sighting per player, faction-scoped. One row per
player, overwritten by a newer sighting: this answers "what were they last seen
with", not "what is their history", and the smaller claim is the one the data
can actually support.

**Display** (FFS, war rows). One batched lookup per page for the ids on screen,
then a marker beside the stats pill on any flagged row. Marked with
`data-ffs-*` like every other FFS injection, so it is traceable and removable.

## What a flag will and will not mean

It means: **somebody in this faction saw this player carrying that, at that
time.** It does not mean they have it equipped now, and the display must not
imply otherwise — a stale flag that reads as current is worse than no flag,
because it gets acted on.

So every flag carries its age, and the age is visible, not buried in a tooltip.

## Open decisions

**1. How old is too old?** A red primary seen three months ago says nothing
about today. My recommendation: **show flags up to 14 days, dim them past 3
days, drop them past 14.** War rosters change loadouts between wars, and 14 days
comfortably spans one war plus the run-up.

**2. One marker or two?** Red primary and EOD are different problems — one says
"they hit hard", the other "they are hard to kill". I would use **two small
markers rather than one generic warning**, because a caller's decision differs.

**3. Anything beyond those two?** Orange primaries, particular armour bonuses,
and ammo type are all in the same payload for the same cost. I would **ship the
two asked for** and see whether they get used before adding more.

## Not doing

- **Not reading KAL's API.** Their service, their key registration, All Rights
  Reserved. Using it uninvited risks the key and is not ours to take.
- **Not building a public database.** This is one faction's own observations,
  pooled internally for its own war. That is materially different from
  redistributing them, and the difference should stay.
- **Not inferring.** If Torn did not reveal the item, there is no sighting. No
  guessing from level, stats, or past wars.

## Risk

The honest one: **coverage may be too thin to be useful.** If Torn reveals items
rarely enough, most rows carry no flag and the feature is decoration. That is
measurable before building any UI — capture for one war, count what share of
enemy rows ever got a sighting, and decide with the number in hand.

I would do that first.
