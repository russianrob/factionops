# FFS loadout flags — design

**Status:** scope for approval. Nothing built.

A marker beside a player's name, **anywhere FFS shows them**, when that player
has recently been seen carrying **EOD armour** — or a red-rarity primary.

This is a property of the PLAYER, not of a war. Somebody who runs EOD is
somebody you want flagged on their profile, in a faction list, in a mini-profile
and on an attack page, not only when they happen to be on the other side of a
ranked war. The war row is one surface among several, and not the important
one.

---

## Why this is small

Three things checked before writing this, each of which could have made it big:

- **FFS already runs everywhere.** `@match https://www.torn.com/*` covers attack
  pages, so capture and display live in one script. No second userscript, no
  second install.
- **FFS already has `@connect tornwar.com`.** No new permission, no re-consent.
- **FFS already resolves a player id.** `a.href.match(/XID=(\d+)/)` at three
  existing call sites; the display hook is a lookup away.
- **FFS already injects on every surface this needs.** Counted in the source:
  faction member lists (35 references), `factions.php` (18), `profiles.php`
  (11), mini-profiles (10), attack pages (5), war rows (3). The flag goes
  wherever FFS already draws, which is everywhere a player's name appears.

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

**Store** (warboard). Last sighting per player. One row per player, overwritten
by a newer sighting: this answers "what were they last seen with", not "what is
their history", and the smaller claim is the one the data can actually support.

Keyed by the OBSERVED player, not by war and not by faction. A player who runs
EOD runs it against everyone; tying the record to the war it was seen in would
throw the fact away the moment the war ended. Sightings are contributed by
faction members and readable by the faction — the pooling is what makes it
work — but the subject is any player, not only a current enemy.

**Display** (FFS, every surface). One batched lookup per page for the ids on
screen, then a marker beside the name or stats pill. Marked with `data-ffs-*`
like every other FFS injection, so it is traceable and removable.

Batched deliberately: a faction list is ninety names, and ninety requests to
draw one page is how a feature gets a script banned.

## What a flag will and will not mean

It means: **somebody in this faction saw this player carrying that, at that
time.** It does not mean they have it equipped now, and the display must not
imply otherwise — a stale flag that reads as current is worse than no flag,
because it gets acted on.

So every flag carries its age, and the age is visible, not buried in a tooltip.

## Open decisions

**1. How old is too old? — DECIDED: 30 days.** Dim past 7 days, drop past 30.
An armour set is not a per-war choice the way a temporary loadout is; somebody
who owns EOD owns it next month too. Thirty days is long enough to still be
carrying a sighting when you next run into them.

**2. One marker or two?** Red primary and EOD are different problems — one says
"they hit hard", the other "they are hard to kill". I would use **two small
markers rather than one generic warning**, because a caller's decision differs.

**3. Anything beyond those two?** Orange primaries, particular armour bonuses,
and ammo type are all in the same payload for the same cost. I would **ship the
two asked for** and see whether they get used before adding more.

## Not doing

- **Not reading KAL's API.** Their service, their key registration, All Rights
  Reserved. Using it uninvited risks the key and is not ours to take.
- **Not building a public database.** One faction's own observations, pooled
  internally and read by that faction. Materially different from redistributing
  them, and the difference should stay.
- **Not inferring.** If Torn did not reveal the item, there is no sighting. No
  guessing from level, stats, or past wars.

## Risk

The honest one: **coverage may be too thin to be useful.** If Torn reveals items
rarely enough, most names carry no flag and the feature is decoration.

Being player-scoped rather than war-scoped cuts both ways here. The pool of
players who could be flagged is far larger than one enemy roster, so the share
of names carrying a flag starts lower — but sightings now accumulate
permanently instead of being thrown away with each war, so it improves on its
own over time, and a 30-day window keeps more of them than 14 would.

Still measurable before building any UI: capture for a week, then count how
many distinct players got a sighting and what share of the names on a typical
page they cover. Decide with the number in hand.

I would do that first.
