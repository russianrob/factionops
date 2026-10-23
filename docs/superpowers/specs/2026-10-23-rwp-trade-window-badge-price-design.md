# RW Pricer 3.14.3: the trade window shows the badge's price (design)

**Status:** for the owner's review. The owner chose this on 2026-10-23 (EDT): "b, leave the forum lists".
**Script:** `server/public/scripts/torn-rw-pricer.user.js` and `.meta.js`, 3.14.2 to 3.14.3. Tests: `server/rwp-trade-badge.test.mjs` (new). `rwp-trade.test.mjs`, `rwp-second-bonus.test.mjs` and `rwp-exact-gun.test.mjs` are updated.

## Why

The item badge and the trade window price the same gun in two different ways, so one weapon can show two prices. The owner's Orange Bushmaster Carbon 15 (14% Revitalize, 26% Conserve) has a badge of **$3,574,795,103** but counts in a trade at **$3,193,164,535**, which is what the 14% Revitalize is worth on its own.

The badge runs the full estimator. It uses the pair's own sales where there are any. Otherwise it builds the price up from each bonus, holds the 3.14.1 floor, and blends in this exact gun's own sales (3.14.2). The trade window runs `priceForumRow`, a shorter ladder written for forum price lists. It uses the pair's sales, or else the more valuable bonus alone at its roll, or else wider medians.

These figures come from the newest 20% of 293k sales, which were not used to build the tables, split into two halves. Each is the share of sales where the price missed by more than half:

| Guns | Trade window today | Badge (3.14.2) |
|---|---|---|
| One bonus (about 28k sales per half; both give the same price on 92.5%) | 8.2% / 10.3% | 6.3% / 8.4% |
| Two bonuses, the pair has sold before (193 / 172 sales) | 27.5% / 41.3% | 21.8% / 27.9% |
| Two bonuses, the pair has not (844 / 942 sales) | 60.0% / 56.8% | 20.7% / 19.3% |

On the last row, the trade window put the typical gun at 0.43 times what it sold for. Option (a), adding only the exact-gun blend to the trade window, would have taken the miss rate for two-bonus guns from 54% to 49%. With the badge's estimator, the trade window gets the badge's figures.

## Decisions

| # | Decision |
|---|---|
| Q1 | (b) The trade window shows the badge's price for every ranked-war weapon. Both use one estimator. |
| Q2 | Forum price lists, both tables and prose lines, stay on `priceForumRow`, unchanged. |
| Q3 | 3.14.2 shipped on its own first. Done. |
| My ruling, for the owner to confirm | A gun whose badge shows a range counts in the trade at the badge's estimate, which is the low end. See Range guns. |

## What changes

For each weapon row with a bonus in a trade, these now use the badge's price instead of `priceForumRow`'s:
- the row's figure;
- the side's "Total value: $X (Torn: $Y)";
- the "RW value:" line above the trade.

Torn's own figure stays beside ours, as it does now.

Everything else stays as it is:
- the badge's prices (byte-identical on every test sale);
- forum lists;
- armour, which still counts at market value in a trade;
- plain items, quantities and the layout.

## How

1. **`estimateItemPrice(weaponKey, itemKey, rarity, bonuses, median, comboFn, bonusFn)`**
   - This is the badge's estimator, moved unchanged out of `injectPriceTags` into its own function. In 3.14.2 it is lines 2462 to 2750.
   - It returns `{ price, source, deriv, bonusColors }`.
   - I checked the 3.14.2 code. The block:
     - reads only those seven inputs, plus the shared price tables;
     - writes nothing outside itself;
     - produces only those four values that `injectPriceTags` uses afterwards;
     - sets every variable before reading it on the same pass, so no badge can pick up a value left over from the item before it.
   - So moving it into a function cannot change a badge. `injectPriceTags` calls it at the same point and carries on as before.

2. **`badgePriceFor(weaponKey, rarity, bonuses)`**
   - Prices a weapon the way the badge does, without a page element.
   - Picks the same tables the badge picks: last year's sales for a one-bonus weapon, every year's for two bonuses.
   - Reads the colour median, then returns the badge's number (`estimate || median`, as the badge shows it).
   - Returns `null` when there is no colour median. The badge shows nothing in that case.
   - Afterwards it puts the table choice back as it found it, as `priceForumRow` does.
   - The table choice is written the same way here and in `injectPriceTags`, and a test keeps the two copies identical.

3. **`tradeRwValue(row, name)`**
   - Reads the bonuses and the colour from the row's info icon, as it does now.
   - For a known weapon with a colour, it returns `badgePriceFor`'s price.
   - It falls back to `priceForumRow`, which gives today's number, in two cases:
     - the icon gives no colour (`priceForumRow` works the colour out from the roll);
     - the weapon has no colour median.
   - Armour and unknown names still give 0 and count at market value.

On the test sales, three more things hold:
- The estimator gave an estimate on every one of the 58,363 that had a colour median, so in practice the trade shows the estimate.
- On the 2,151 with two bonuses, the order of the bonuses never changed the price.
- The estimator never changes the bonus list it is given.

One price takes about 0.03 ms on this box, and the trade window prices its rows again every 3 seconds.

## Range guns

Sometimes nothing with this bonus has sold at this colour. The badge's estimate is then the weapon's floor, and the badge shows a range, "⚠ $low–$high", where the high end is the colour median. The trade row has no room for a range or a warning, so it shows one figure: the badge's estimate, the low end. Today it shows the colour median, the high end.

There were 51 such test sales (7 with two bonuses). The share each figure missed by more than half:

| Figure | Halves |
|---|---|
| Low end (the badge's estimate) | 40.0% / 46.2% |
| Geometric middle | 56.0% / 61.5% |
| High end (today's trade figure) | 60.0% / 65.4% |

So where the badge shows "⚠ $low–$high", the trade will show a plain `$low`. If the owner would rather the trade show the high end or the middle, that is a one-line change.

## Testing

**New file `rwp-trade-badge.test.mjs`.** It is run against 3.14.2 first, where the tests that describe the change fail.
- The owner's gun prices at $3,574,795,103 in the trade window, not $3,193,164,535. It uses fixed tables, the ones in `rwp-exact-gun.test.mjs`.
- A two-bonus gun whose pair has never sold: the trade figure equals the badge, not the lead bonus alone.
- A one-bonus gun whose last-year and all-time sales disagree, and where `priceForumRow` and the badge disagree too: the trade figure equals the badge, read from last year's tables.
- A range gun: the trade gets the low end, not the colour median.
- No colour on the icon: today's `priceForumRow` number.
- No colour median: today's `priceForumRow` number.
- An armour name, and an unknown name: 0.
- The table choice is put back after a trade row is priced.
- The table choice is written identically in `injectPriceTags` and `badgePriceFor`: the line appears exactly twice.

"The trade figure equals the badge" means equal to the badge's figure as `injectPriceTags` works it out, not a second call to the same function.

**Updated files:**
- `rwp-second-bonus.test.mjs` and `rwp-exact-gun.test.mjs` currently cut the estimator out of the source by its comments. They will call `estimateItemPrice` when the script has it, and cut the block out when it does not. The same tests then pass on 3.14.2 and 3.14.3 with every assertion unchanged.
- `rwp-trade.test.mjs` gets what the estimator needs added to its sandbox. Its assertions stay.

**Also:**
- A back-test of 3.14.2 against 3.14.3 on all 58,363 test sales. The badge's price, source, tooltip lines and bonus colours must be byte-identical. `priceForumRow` must be byte-identical too, which shows the forum lists are untouched (Q2). The trade window's figure must equal the badge's.
- Mutants of the new code, then the full suite, then an Opus review before install.

## Release

- Version 3.14.3: `@version`, `SCRIPT_VERSION` and `.meta.js` change together.
- Client only. The feed and the server are untouched, so there is no reload and no Refresh tap.
- Some users have not tapped Refresh since 3.14.2. They get the badge without the exact-gun blend, and now the trade without it too, so the two still agree.
- Commit and push at the release.

## Not in this version

I found these along the way. Each is left as it is:
- Armour in a trade counts at market value. The badge prices armour; the trade window never has.
- The hover text on a trade row says "market value", even on an RW figure.
- The forum table tooltip checks for the source 'exact pair', but `priceForumRow` calls it 'sales of this exact pair of bonuses'. So every two-bonus row says "NOT priced in".
- `loadCachedPrices` never restores last year's tables, so after a load from cache, one-bonus guns read every year's tables. It affects the badge and the trade alike.
- Left over from 3.14.2: about five or six guns still show a range even though their own sales are blended in. Marking their source as this exact gun would drop the range.
