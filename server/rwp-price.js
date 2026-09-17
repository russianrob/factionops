// Price an item from its name, rarity and bonus rolls.
//
// RW Pricer prices live Torn DOM in the page. This exists for the case the page
// cannot cover — a SCREENSHOT on the forums — and works from the same
// rwp-prices.json feed the script loads, so both are reading one dataset.
//
// The ladder, best evidence first:
//   1. an exact sale curve at this bonus %          (weaponLevelPrices)
//   2. the exact pair of bonuses at this rarity     (weaponPairComboPrices)
//   3. this weapon with this bonus at this rarity   (weaponComboPrices)
//   4. the weapon alone at this rarity              (weaponPrices)
// Each rung says which it used, because an estimate whose basis is invisible
// gets trusted exactly as much as one that measured something.

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const medOf = (a) => (Array.isArray(a) ? num(a[1]) : null);
const cntOf = (a) => (Array.isArray(a) ? num(a[3]) : null);
const money = (n) => (n >= 1e9 ? "$" + (n / 1e9).toFixed(2) + "b" : "$" + Math.round(n / 1e6) + "m");
// "an Orange", "a Yellow", "a Red".
const an = (w) => (/^[aeiou]/i.test(String(w || "")) ? "an " : "a ");
// Every line below is read by somebody mid-trade who did not write this file.
// "sales by roll (Orange, 6 price points)" was the line that prompted the
// rewrite: nobody outside here knows what a roll is. The words to reach for
// are the ones on the card -- the colour, the bonus, the percentage.
const thing = (rarity, name) => (rarity ? an(rarity) + rarity + " " + name : name);

/**
 * Read a price table, newest evidence first.
 *
 * The feed ships a 365-day slice beside the all-time history, and the two can
 * disagree by a lot: SIG 552 + 9% Expose is $101m all-time and $86m over the
 * last year, because the history still counts 2022-23 sales made in a very
 * different economy. One gun in that table sold for $900m in 2023 and $121m in
 * 2025 at the same quality and the same roll -- an all-time median is not a
 * price, it is an average of several markets.
 *
 * The desktop script has always preferred the recent slice. This path did not,
 * so the same weapon priced differently on a forum screenshot than on its own
 * item.php page.
 *
 * feed.recent is already merged at build time -- it starts as a copy of the
 * history and a recent entry overwrites only where it has 3+ sales -- so
 * preferring it never drops a group, it only freshens one. Pair combos have no
 * recent table by design (thinnest data there is) and stay on the history.
 */
function table(feed, recentName, histName) {
  const rec = ((feed && feed.recent) || {})[recentName];
  return rec || (feed && feed[histName]) || {};
}

/**
 * Sales recorded at ONE exact roll: [median, count], or null.
 *
 * The count is what makes a roll-matched price honest. Quoting "4688 sales,
 * $68m to $3.5b" beside a price built from the 592 sales at 23% describes two
 * different things and labels only one.
 */
function levelEntry(tbl, name, bonus, rarity, pct) {
  const lv = ((tbl || {})[name + "|" + bonus] || {})[rarity];
  const e = lv && lv[String(pct)];
  return Array.isArray(e) ? e : null;
}

/** Points from one level table, as [pct, value] sorted by pct. */
function curveOf(tbl, name, bonus, rarity) {
  const lv = ((tbl || {})[name + "|" + bonus] || {})[rarity];
  if (!lv) return [];
  return Object.entries(lv)
    .map(([pct, v]) => [Number(pct), Array.isArray(v) ? num(v[0]) : num(v)])
    .filter((p) => p[0] && p[1])
    .sort((a, b) => a[0] - b[0]);
}

/** Points from a level curve, as [pct, value] sorted by pct. */
export function levelCurve(feed, name, bonus, rarity) {
  return curveOf(table(feed, "levelPrices", "weaponLevelPrices"), name, bonus, rarity);
}

/**
 * Value at `pct` from a curve of recorded sales.
 *
 * Inside the curve: interpolate. Outside it: extend the trend, but say so — an
 * extrapolated figure is a different kind of number from an observed one, and
 * the Cobra Derringer that prompted this sits 19 points beyond any sale.
 */
export function valueAtPct(points, pct) {
  if (!points.length) return null;
  if (points.length === 1) return { value: points[0][1], extrapolated: points[0][0] !== pct };
  let lo = null, hi = null;
  for (const p of points) {
    if (p[0] <= pct) lo = p;
    if (p[0] >= pct && !hi) hi = p;
  }
  if (lo && hi && lo[0] !== hi[0]) {
    const t = (pct - lo[0]) / (hi[0] - lo[0]);
    return { value: Math.round(lo[1] + (hi[1] - lo[1]) * t), extrapolated: false };
  }
  if (lo && hi && lo[0] === hi[0]) return { value: lo[1], extrapolated: false };
  // Least-squares through the whole curve, extended to pct.
  const n = points.length;
  const sx = points.reduce((s, p) => s + p[0], 0);
  const sy = points.reduce((s, p) => s + p[1], 0);
  const sxy = points.reduce((s, p) => s + p[0] * p[1], 0);
  const sxx = points.reduce((s, p) => s + p[0] * p[0], 0);
  const denom = n * sxx - sx * sx;
  if (!denom) return { value: Math.round(sy / n), extrapolated: true };
  const m = (n * sxy - sx * sy) / denom;
  const b = (sy - m * sx) / n;
  const v = Math.round(m * pct + b);
  // A negative or absurd extension is worse than admitting ignorance.
  if (!(v > 0)) return null;
  return { value: v, extrapolated: true };
}

/**
 * Match a read name to the dataset's name.
 *
 * Torn's tooltip introduces an item in a sentence -- "The China Lake is a Heavy
 * Artillery Weapon." -- so a reading taken from the picture comes back as "The
 * China Lake" while every price table says "China Lake". Exact-matching that
 * returns no price at all for a weapon there are 115 Orange sales of.
 */
export function resolveName(feed, name) {
  const tables = [feed.weaponPrices, feed.armourPrices].filter(Boolean);
  const has = (n) => tables.some((t) => Object.prototype.hasOwnProperty.call(t, n));
  const raw = String(name || "").trim();
  if (!raw) return null;
  if (has(raw)) return raw;

  const stripped = raw.replace(/^the\s+/i, "").trim();
  if (stripped !== raw && has(stripped)) return stripped;

  // Last resort, case- and article-insensitive. Deliberately not fuzzy: a near
  // match on a weapon name would price the wrong gun, which is worse than no
  // price at all.
  const want = stripped.toLowerCase();
  for (const t of tables) {
    for (const k of Object.keys(t)) {
      if (k.toLowerCase().replace(/^the\s+/, "") === want) return k;
    }
  }
  return null;
}

/**
 * Which rarity a roll belongs to, when the reading did not say.
 *
 * The reader drops the coloured word often enough to matter -- the Mag 7 post
 * came back with a name and a bonus but rarity null, and every rung below needs
 * a rarity, so a perfectly readable card priced at nothing.
 *
 * The roll almost always settles it: of 1043 weapon+bonus groups with more than
 * one rarity on record, only 62 have roll ranges that overlap at all. A 15%
 * Expose Mag 7 is Red and cannot be anything else.
 *
 * Only an EXACT recorded roll counts, and only when exactly one rarity recorded
 * it. Interpolating across a gap, or picking a side where ranges overlap, is
 * how a Yellow gets priced as a Red.
 */
export function rarityForRoll(feed, name, bonus, pct) {
  if (!Number.isFinite(pct)) return null;
  const tbl = table(feed, "levelPrices", "weaponLevelPrices")[name + "|" + bonus];
  if (!tbl) return null;
  const hits = Object.keys(tbl).filter((r) => tbl[r] && tbl[r][String(pct)]);
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Identify a weapon by the shop price printed on its card.
 *
 * A cropped card names no weapon and the reader fills the gap from the picture:
 * an ArmaLite M-15A4 came back as "M16A4", which is not a Torn item, so it
 * priced at nothing. But every card carries "Buy: $20,000,000 (Mexico)", and a
 * shop price is a fixed catalogue figure rather than a market value that
 * drifts, so it can be matched exactly instead of within a tolerance.
 *
 * Candidates are restricted to weapons the PRICE FEED knows, not every item in
 * Torn: identifying something we cannot price is not an identification, and
 * letting a plushie at the same shop price create a tie would throw away a
 * reading that was never ambiguous.
 *
 * Answers only when exactly one weapon matches. Two weapons at one shop price
 * cannot be told apart this way, and guessing between them prices the wrong gun.
 */
export function weaponByBuyPrice(feed, buyPrices, buy) {
  const want = num(buy);
  if (!want || !buyPrices) return null;
  const weapons = Object.keys((feed && feed.weaponPrices) || {});
  const hits = weapons.filter((w) => num(buyPrices[w.toLowerCase()]) === want);
  return hits.length === 1 ? hits[0] : null;
}

/** Is this name an armour piece rather than a weapon? They price differently. */
function isArmour(feed, name) {
  return !!((feed && feed.armourPrices) || {})[name];
}

export function priceItem(feed, item) {
  const name = resolveName(feed, item && item.name);
  let rarity = item && item.rarity;
  const bonuses = Array.isArray(item && item.bonuses) ? item.bonuses.slice() : [];
  // A name that matches nothing in the catalogue is a MISREAD, not a rare item.
  // A cropped card names no weapon, and the reader does not reliably decline:
  // the Kodachi post came back "Big Al's Gun Shop Katana" -- the sell shop
  // welded to what the picture looked like -- with confident:true. The model's
  // own confidence flag is therefore not a guard; existence is. Flagged rather
  // than merely refused, so the caller can stay silent instead of printing an
  // invented weapon name onto somebody's sale thread.
  if (!name) {
    return { ok: false, unknown: true,
             reason: `"${(item && item.name) || ""}" is not a Torn item — the picture probably does not name the weapon.` };
  }

  // Biggest roll first: it is what the price is really about.
  bonuses.sort((a, b) => (num(b.pct) || 0) - (num(a.pct) || 0));

  // No rarity on the card? The roll usually names it. Never overrides a rarity
  // that WAS read -- this only fills a hole.
  let inferredRarity = false;
  if (!rarity && bonuses.length) {
    const guess = rarityForRoll(feed, name, bonuses[0].name, num(bonuses[0].pct));
    if (guess) { rarity = guess; inferredRarity = true; }
  }

  const out = { ok: true, name, readAs: (item && item.name) || name, rarity, bonuses, basis: null, estimate: null,
                low: null, high: null, samples: null, extrapolated: false, inferredRarity, notes: [] };

  // ARMOUR. Every rung below reads weapon tables, so an armour card resolved to
  // a real item and then priced at nothing. The feed has carried armour prices
  // all along and nothing was looking at them.
  //
  // Armour has no pair table -- a piece carries one bonus in practice -- so the
  // ladder is shorter: the exact roll, then the piece with that bonus at any
  // roll, then the piece alone.
  if (isArmour(feed, name) && rarity) {
    const lead = bonuses[0];
    if (lead) {
      const pts = curveOf(feed.armourLevelPrices, name, lead.name, rarity);
      const at = valueAtPct(pts, num(lead.pct));
      if (at) {
        out.basis = `what ${thing(rarity, name)} with ${lead.name} has sold for, matched to the ${lead.pct}%`;
        out.estimate = at.value;
        out.extrapolated = at.extrapolated;
        if (at.extrapolated) {
          const top = pts[pts.length - 1];
          out.notes.push(`Nothing this good has ever sold — the best on record is ${top[0]}%. This follows the trend past that, so treat it as a guess rather than a price.`);
        }
        const exact = levelEntry(feed.armourLevelPrices, name, lead.name, rarity, num(lead.pct));
        if (exact) {
          out.samples = num(exact[1]);
        } else {
          const c = ((feed.armourComboPrices || {})[name + "|" + lead.name] || {})[rarity];
          if (c) { out.low = num(c[0]); out.high = num(c[2]); out.samples = cntOf(c); }
        }
        return out;
      }
      const combo = ((feed.armourComboPrices || {})[name + "|" + lead.name] || {})[rarity];
      if (combo) {
        out.basis = `what ${thing(rarity, name)} with ${lead.name} has sold for, at any percentage`;
        out.estimate = medOf(combo); out.low = num(combo[0]); out.high = num(combo[2]); out.samples = cntOf(combo);
        out.notes.push(`This ignores the ${lead.pct}% — it's the middle price for any ${lead.name} one, good or bad.`);
        return out;
      }
    }
    const solo = ((feed.armourPrices || {})[name] || {})[rarity];
    if (solo) {
      out.basis = `what ${thing(rarity, name)} has sold for, whatever bonus it had`;
      out.estimate = medOf(solo); out.low = num(solo[0]); out.high = num(solo[2]); out.samples = cntOf(solo);
      out.notes.push("This ignores the bonus completely — it's the middle price for the piece on its own.");
      return out;
    }
  }
  if (inferredRarity) {
    out.notes.push(`The picture doesn't show a colour. Only ${rarity} ones have ever sold with ${bonuses[0].pct}% ${bonuses[0].name}, so that's what this assumes.`);
  }

  // 1. The exact pair.
  if (bonuses.length >= 2 && rarity) {
    const pair = [bonuses[0].name, bonuses[1].name].sort().join("+");
    const arr = ((feed.weaponPairComboPrices || {})[name + "|" + pair] || {})[rarity];
    if (arr) {
      out.basis = `what ${thing(rarity, name)} with both ${bonuses[0].name} and ${bonuses[1].name} has sold for`;
      out.estimate = medOf(arr); out.low = num(arr[0]); out.high = num(arr[2]); out.samples = cntOf(arr);
      return out;
    }
  }

  // 2. The level curve for the leading bonus — the only rung that knows the ROLL.
  if (bonuses.length && rarity) {
    const lead = bonuses[0];
    const pts = levelCurve(feed, name, lead.name, rarity);
    const at = valueAtPct(pts, num(lead.pct));
    if (at) {
      out.basis = `what ${thing(rarity, name)} with ${lead.name} has sold for, matched to the ${lead.pct}%`;
      out.estimate = at.value;
      out.extrapolated = at.extrapolated;
      if (at.extrapolated) {
        const top = pts[pts.length - 1];
        out.notes.push(`Nothing this good has ever sold — the best on record is ${top[0]}%. This follows the trend past that, so treat it as a guess rather than a price.`);
      }
      // A second bonus is worth something, but there is no measurement of THIS
      // pair — flagged rather than silently multiplied in.
      if (bonuses.length > 1) {
        out.notes.push(`The ${bonuses[1].pct}% ${bonuses[1].name} isn't counted. Nobody has sold this exact pair, so there's nothing to price it from.`);
      }
      // Same window for the range as for the estimate. Quoting an all-time
      // low-high beside a last-year median reads as one measurement and is two.
      // Sales at THIS roll where the roll was actually recorded; the pooled
      // range only when the price had to be estimated between or beyond them.
      const exact = levelEntry(table(feed, "levelPrices", "weaponLevelPrices"), name, lead.name, rarity, num(lead.pct));
      if (exact) {
        out.samples = num(exact[1]);
      } else {
        const combo = (table(feed, "comboPrices", "weaponComboPrices")[name + "|" + lead.name] || {})[rarity];
        if (combo) { out.low = num(combo[0]); out.high = num(combo[2]); out.samples = cntOf(combo); }
      }
      const histAt = valueAtPct(curveOf(feed.weaponLevelPrices, name, lead.name, rarity), num(lead.pct));
      if (histAt && at.value && Math.abs(histAt.value - at.value) / at.value > 0.05) {
        out.notes.push(`These are the last year's prices. Going all the way back it's ${money(histAt.value)}, but those older sales were a different market, not a bigger one.`);
      }
      return out;
    }
  }

  // 3. Weapon + leading bonus, roll-agnostic.
  if (bonuses.length && rarity) {
    const arr = (table(feed, "comboPrices", "weaponComboPrices")[name + "|" + bonuses[0].name] || {})[rarity];
    if (arr) {
      out.basis = `what ${thing(rarity, name)} with ${bonuses[0].name} has sold for, at any percentage`;
      out.estimate = medOf(arr); out.low = num(arr[0]); out.high = num(arr[2]); out.samples = cntOf(arr);
      out.notes.push(`This ignores the ${bonuses[0].pct}% — it's the middle price for any ${bonuses[0].name} one, good or bad.`);
      return out;
    }
  }

  // 4. The weapon alone.
  const arr = (table(feed, "weaponPrices", "weaponPrices")[name] || {})[rarity];
  if (arr) {
    out.basis = `what ${thing(rarity, name)} has sold for, whatever bonus it had`;
    out.estimate = medOf(arr); out.low = num(arr[0]); out.high = num(arr[2]); out.samples = cntOf(arr);
    out.notes.push("This ignores the bonus completely — it's the middle price for the weapon on its own.");
    return out;
  }

  return { ok: false, reason: `no sales data for ${name}${rarity ? " (" + rarity + ")" : ""}` };
}
