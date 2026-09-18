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
// Days since epoch, as the feed stores them. UTC throughout: a local getter
// here would report a sale a day early for anyone west of Greenwich.
const dayToDate = (d) => (num(d) ? new Date(num(d) * 86400000).toISOString().slice(0, 10) : "an unknown date");

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
  // One observation is a price for THAT roll and nothing else. Handing it back
  // for a different roll is not an estimate, it is a coincidence with a dollar
  // sign on it -- a Diamond Bladed Knife got the single Orange Achilles sale at
  // 76% quoted as its 61% price, a ninth of what the knife was worth.
  if (points.length === 1) {
    return points[0][0] === pct ? { value: points[0][1], extrapolated: false } : null;
  }
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
  // Least-squares through the whole curve, extended to pct. Two points make a
  // line through noise rather than a trend, and the roll-agnostic median below
  // is better evidence than that, so extrapolation needs three.
  if (points.length < 3) return null;
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
 * Match a read BONUS name to the dataset's spelling.
 *
 * The reader returns what is printed on the card — "Double Tap" — and every
 * price table says "Double-Tap". That one hyphen made an S&W Revolver miss its
 * own sale record, rank the wrong bonus as the lead, and quote $353m for a
 * weapon that had sold for $2.14b.
 *
 * Case, hyphens and spaces are the only things forgiven. Anything further would
 * be guessing at which bonus a card carries, and the wrong bonus is a wrong
 * price with a confident number on it.
 */
let _bonusIndex = null, _bonusIndexFor = null;
export function resolveBonus(feed, raw) {
  const want = String(raw || "").toLowerCase().replace(/[\s-]+/g, "");
  if (!want) return null;
  if (_bonusIndexFor !== feed) {
    _bonusIndex = new Map();
    for (const t of [feed && feed.bonusPrices, feed && feed.armourBonusPrices]) {
      for (const k of Object.keys(t || {})) {
        const norm = k.toLowerCase().replace(/[\s-]+/g, "");
        if (!_bonusIndex.has(norm)) _bonusIndex.set(norm, k);
      }
    }
    _bonusIndexFor = feed;
  }
  return _bonusIndex.get(want) || null;
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
export function rarityForRoll(feed, name, bonus, pct, bonusCount) {
  if (!Number.isFinite(pct)) return null;
  const tbl = table(feed, "levelPrices", "weaponLevelPrices")[name + "|" + bonus]
           || (feed && feed.armourLevelPrices || {})[name + "|" + bonus];
  if (!tbl) return null;

  // Two bonuses are never Yellow: of 8,004 recorded two-bonus sales, not one
  // was. A roll sitting in a Yellow band therefore cannot place a two-bonus
  // weapon there, which is how a Cobra Derringer with 97% Assassinate and 23%
  // Specialist was called Yellow off the Specialist and priced at a fourteenth
  // of what it was worth.
  const rarities = Object.keys(tbl).filter((r) => !(num(bonusCount) >= 2 && r === "Yellow"));

  // A sale at exactly this roll is the strongest answer.
  const exact = rarities.filter((r) => tbl[r] && tbl[r][String(pct)]);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;

  // Otherwise the observed BAND, when the roll falls inside exactly one of
  // them. A Diamond Bladed Knife's 61% Achilles never sold at that exact roll,
  // but Yellow ones run 50-73% and Orange ones start at 76, so it is Yellow and
  // cannot be anything else. Requiring one band and only one is the same
  // discipline as the exact match: where two overlap, nothing is claimed.
  const inBand = rarities.filter((r) => {
    const lv = Object.keys(tbl[r] || {}).map(Number).filter(Number.isFinite);
    return lv.length >= 2 && pct >= Math.min(...lv) && pct <= Math.max(...lv);
  });
  return inBand.length === 1 ? inBand[0] : null;
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

/**
 * Which rarity a quality belongs to, when the card shows no colour.
 *
 * myGear lists a weapon with its quality on the thumbnail and its rarity
 * nowhere: "Enfield SA-80, 245.2%, 75% Cupid, 41% Specialist". Both bonuses
 * read fine and it priced at nothing, because every rung needs a rarity and 75%
 * Cupid is not a roll any single rarity recorded.
 *
 * Quality settles it from the sales themselves. An Enfield's Yellows top out at
 * 178.3 and its Oranges at 217.09, while its Reds run 219.79 to 275.15 — 245.2
 * is inside one span and outside the others. Across every weapon that has sold
 * in more than one rarity, a quality names exactly one about 7 times in 10;
 * the rest are refused rather than guessed.
 *
 * Two bonuses rule out Yellow, which can settle a tie on its own: of 8,004
 * recorded two-bonus sales, exactly zero were Yellow.
 */
export function rarityForQuality(feed, name, quality, bonusCount) {
  const q = num(quality);
  if (!q) return null;
  const ranges = (isArmour(feed, name) ? (feed && feed.armourQualityRanges) : (feed && feed.weaponQualityRanges)) || {};
  const t = ranges[name];
  if (!t) return null;
  let hits = Object.keys(t).filter((r) => Array.isArray(t[r]) && q >= num(t[r][0]) && q <= num(t[r][1]));
  if (num(bonusCount) >= 2) hits = hits.filter((r) => r !== "Yellow");
  return hits.length === 1 ? hits[0] : null;
}

/**
 * What a bonus is worth on this weapon: the median of sales carrying it.
 *
 * Used to decide which bonus the price is really about. Percentages are not
 * comparable across bonus types -- 61% Achilles and 35% Bleed are different
 * scales -- and on a Diamond Bladed Knife at Orange the Achilles is worth $249m
 * against the Bleed's $2.1b. Ranking by the bigger number picked the cheap one.
 *
 * Rarity is optional because the ranking is needed before the rarity has been
 * worked out; without one, the best any rarity shows stands in.
 */
function bonusWorth(feed, name, bonus, rarity) {
  const t = table(feed, "comboPrices", "weaponComboPrices")[name + "|" + bonus]
         || (feed && feed.armourComboPrices || {})[name + "|" + bonus] || {};
  if (rarity && Array.isArray(t[rarity])) return num(t[rarity][1]) || 0;
  let best = 0;
  for (const r of Object.keys(t)) best = Math.max(best, (Array.isArray(t[r]) && num(t[r][1])) || 0);
  return best;
}

/**
 * Why a price could not be pinned to the roll, in terms of what DID sell.
 *
 * "This ignores the 50%" says what the pricer failed to do. The reader wants to
 * know why the number is what it is, and the answer is almost always that
 * nothing sold at their roll while something sold either side of it — a Red
 * Glock 17 with Wither has 47% twice and 55% once, neither enough to price
 * from, both worth knowing.
 */
function rollNeighbours(feed, name, bonus, rarity, pct) {
  const thin = ((feed.weaponThinRolls || {})[name + "|" + bonus] || {})[rarity] || {};
  const lv = ((table(feed, "levelPrices", "weaponLevelPrices")[name + "|" + bonus] || {})[rarity]) || {};
  const all = [];
  for (const src of [thin, lv]) {
    for (const k of Object.keys(src)) {
      const e = src[k];
      const v = Array.isArray(e) ? num(e[0]) : num(e);
      if (num(k) && v) all.push({ pct: num(k), value: v, n: (Array.isArray(e) && num(e[1])) || 1 });
    }
  }
  if (!all.length) return null;
  all.sort((a, b) => a.pct - b.pct);
  const below = all.filter((p) => p.pct < pct).pop() || null;
  const above = all.filter((p) => p.pct > pct)[0] || null;
  const at = all.find((p) => p.pct === pct) || null;
  return { below, above, at };
}

const salesWord = (n) => n + " sale" + (n === 1 ? "" : "s");

function rollNote(feed, name, bonus, rarity, pct) {
  const near = rollNeighbours(feed, name, bonus, rarity, pct);
  const side = (p) => `${p.pct}% went for ${money(p.value)} (${salesWord(p.n)})`;
  if (near && near.at) {
    return `Only ${salesWord(near.at.n)} of ${thing(rarity, name)} at ${pct}% ${bonus} — too few to price from on their own, so this is the middle of every ${bonus} sale.`;
  }
  const parts = [];
  if (near && near.below) parts.push(side(near.below));
  if (near && near.above) parts.push(side(near.above));
  if (parts.length) {
    return `Nothing has sold at ${pct}% ${bonus}. The nearest on record: ${parts.join(", and ")}. This is the middle of every ${bonus} sale rather than a price for the ${pct}%.`;
  }
  return `Nothing has sold at ${pct}% ${bonus}, so this is the middle price across every ${bonus} one, good or bad.`;
}

/**
 * What to say when a second bonus could not be priced.
 *
 * Which WAY the number is wrong matters more than the fact that it is. Across
 * 950 pairs that have both a pair comp and a single-bonus one, the pair goes
 * for about 1.4x the better single at the median, so the quoted figure is
 * usually a floor. Usually, not always -- a quarter of those pairs sold for
 * LESS than the best single, which is why no multiplier is applied and the
 * wording promises a direction rather than an amount.
 */
function withNearMiss(out, nearMiss) {
  if (nearMiss) out.notes.push(nearMiss);
  return out;
}

function secondBonusNote(bonuses) {
  return `The ${bonuses[1].pct}% ${bonuses[1].name} isn't counted. Nobody has sold this exact pair, so there's nothing to price it from — treat this as a floor. Two-bonus weapons usually go for more than either bonus alone, often around half again, sometimes far more.`;
}

/** Is this name an armour piece rather than a weapon? They price differently. */
function isArmour(feed, name) {
  return !!((feed && feed.armourPrices) || {})[name];
}

export function priceItem(feed, item) {
  const name = resolveName(feed, item && item.name);
  let rarity = item && item.rarity;
  // Spelled the way the tables spell it, before anything looks one up.
  const bonuses = (Array.isArray(item && item.bonuses) ? item.bonuses : []).map((b) => {
    const fixed = resolveBonus(feed, b && b.name);
    return fixed ? { ...b, name: fixed } : b;
  });
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

  // The bonus the price is really about: the one worth more on this weapon,
  // with the bigger roll breaking a tie. Ranked once before the rarity is known
  // so the rarity can be worked out from the right bonus, and again after, now
  // that the rarity narrows what each is worth.
  const rank = (r) => bonuses.sort((a, b) =>
    (bonusWorth(feed, name, b.name, r) - bonusWorth(feed, name, a.name, r)) ||
    ((num(b.pct) || 0) - (num(a.pct) || 0)));
  rank(rarity);

  // No rarity on the card? The roll usually names it. Never overrides a rarity
  // that WAS read -- this only fills a hole.
  let inferredRarity = false, rarityFrom = null, rarityBy = null;

  // A recorded sale of this exact pair at these exact rolls names the rarity
  // outright. That is a record rather than an inference, so it is asked first
  // and nothing below gets to overrule it.
  if (!rarity && bonuses.length >= 2) {
    const order = [bonuses[0].name, bonuses[1].name].sort();
    const pctOf = {};
    pctOf[bonuses[0].name] = num(bonuses[0].pct);
    pctOf[bonuses[1].name] = num(bonuses[1].pct);
    const rolls = order.map((n) => pctOf[n]).join("+");
    const bucket = (feed.weaponPairLevelPrices || {})[name + "|" + order.join("+")] || {};
    const hits = Object.keys(bucket).filter((r) => bucket[r] && bucket[r][rolls]);
    if (hits.length === 1) { rarity = hits[0]; inferredRarity = true; rarityFrom = "sale"; }
  }
  // Any bonus may place the weapon, not only the leading one. A Diamond Bladed
  // Knife with 61% Achilles and 35% Bleed leads on the Bleed, which is worth
  // more — but 35% Bleed sold at no single rarity while 61% Achilles sold only
  // as Yellow. Asking the lead alone gave up and priced nothing.
  if (!rarity) {
    for (const b of bonuses) {
      const guess = rarityForRoll(feed, name, b.name, num(b.pct), bonuses.length);
      if (guess) { rarity = guess; inferredRarity = true; rarityFrom = "roll"; rarityBy = b; break; }
    }
  }
  // The roll is the stronger signal — it needs an exact recorded match — so
  // quality only gets asked when the roll could not answer.
  if (!rarity) {
    const byQ = rarityForQuality(feed, name, item && item.quality, bonuses.length);
    if (byQ) { rarity = byQ; inferredRarity = true; rarityFrom = "quality"; }
  }

  rank(rarity);

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
        out.notes.push(rollNote(feed, name, lead.name, rarity, num(lead.pct)));
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
  if (inferredRarity && rarityFrom === "sale") {
    out.notes.push(`No colour was given, but this weapon with these exact bonuses has only ever sold as ${rarity}.`);
  } else if (inferredRarity && rarityFrom === "roll") {
    const by = rarityBy || bonuses[0];
    out.notes.push(`No colour was given. Only ${rarity} ones have ever sold with ${by.pct}% ${by.name}, so that's what this assumes.`);
  } else if (inferredRarity && rarityFrom === "quality") {
    out.notes.push(`No colour was given, but at ${num(item && item.quality)}% quality only ${rarity} ones have ever sold, so that's what this assumes.`);
  }

  // 0. The exact weapon: both bonuses AND both rolls.
  //
  // Every rung below is an estimate built from weapons that share SOME of what
  // is on the card. This one is a record of the card itself, and a record beats
  // a model — an S&W Revolver with 70% Assassinate and 52% Double-Tap was being
  // priced at $375m off one bonus while that very weapon had sold for $2.14b.
  //
  // No minimum sample: one sale of THIS weapon is better evidence than a median
  // over a dozen that share one bonus with it, provided it is reported as the
  // single sale it is, with its date. The table is built from the last year
  // only, because a three-year-old sale of it is a different market rather than
  // a better record.
  if (bonuses.length >= 2 && rarity) {
    const order = [bonuses[0].name, bonuses[1].name].sort();
    const pctOf = {};
    pctOf[bonuses[0].name] = num(bonuses[0].pct);
    pctOf[bonuses[1].name] = num(bonuses[1].pct);
    const rolls = order.map((n) => pctOf[n]).join("+");
    const e = (((feed.weaponPairLevelPrices || {})[name + "|" + order.join("+")] || {})[rarity] || {})[rolls];
    if (Array.isArray(e) && num(e[0])) {
      const n = num(e[1]) || 1;
      const when = dayToDate(num(e[2]));
      out.basis = "what this exact weapon has sold for — both bonuses, both rolls";
      out.estimate = num(e[0]);
      out.samples = n;
      out.notes.push(n === 1
        ? `This exact weapon — both bonuses, both rolls — sold once, on ${when}.`
        : `This exact weapon — both bonuses, both rolls — has sold ${n} times, most recently on ${when}.`);
      return out;
    }
  }

  // No sale of these exact rolls, but perhaps of rolls near them. That is
  // still a record of this weapon carrying this pair, and it is worth far more
  // to a reader than another reminder that the number is a floor — a Beretta M9
  // at 107%/30% was quoted $354m while the same pair at 106%/36% had sold for
  // $750.6m. Reported as context, never as the estimate: the rolls it actually
  // carried are named so the reader can judge the comparison themselves.
  let nearMiss = null;
  if (bonuses.length >= 2 && rarity) {
    const order = [bonuses[0].name, bonuses[1].name].sort();
    const pctOf = {};
    pctOf[bonuses[0].name] = num(bonuses[0].pct);
    pctOf[bonuses[1].name] = num(bonuses[1].pct);
    const want = order.map((n) => pctOf[n]);
    const bucket = ((feed.weaponPairLevelPrices || {})[name + "|" + order.join("+")] || {})[rarity] || {};
    let best = null;
    for (const key of Object.keys(bucket)) {
      const got = key.split("+").map(Number);
      if (got.length !== 2 || !want[0] || !want[1]) continue;
      // Relative, because rolls of different bonuses run on different scales:
      // six points is nothing on a 107% Assassinate and a fifth of a 30%
      // Double-Tap. Both have to be close for the sale to be comparable.
      const da = Math.abs(got[0] - want[0]) / want[0];
      const db = Math.abs(got[1] - want[1]) / want[1];
      if (da > 0.25 || db > 0.25) continue;
      const dist = da + db;
      if (!best || dist < best.dist) best = { dist, rolls: got, e: bucket[key] };
    }
    if (best && Array.isArray(best.e) && num(best.e[0])) {
      nearMiss = `The closest recorded sale of this pair — ${best.rolls[0]}% ${order[0]} and ${best.rolls[1]}% ${order[1]} — went for ${money(num(best.e[0]))} on ${dayToDate(num(best.e[2]))}.`;
    }
  }

  // 0b. Both bonuses, whatever the rolls.
  //
  // Rung 1 below already does this, but only where three or more sales of the
  // pair exist — and 1,551 of 2,246 weapon+pair+rarity groups have recorded
  // sales and miss that bar, so two thirds of every pair fell past it to the
  // single-bonus rungs. Measured leave-one-out over 1,708 two-bonus sales from
  // the last year, that cost a lot:
  //
  //   single-bonus median   median |log err| 0.442   71.5% within 2x
  //   same pair, any rolls                   0.175   94.7% within 2x
  //
  // One sale of this weapon carrying this pair is worth more than a median over
  // weapons that share half of it. The count is reported, and where a close
  // roll exists the near-miss note names what it actually sold at.
  if (bonuses.length >= 2 && rarity) {
    const order = [bonuses[0].name, bonuses[1].name].sort();
    const bucket = ((feed.weaponPairLevelPrices || {})[name + "|" + order.join("+")] || {})[rarity] || {};
    const entries = Object.keys(bucket).map((k) => bucket[k]).filter((e) => Array.isArray(e) && num(e[0]));
    if (entries.length) {
      // Count-weighted: a roll that sold four times speaks four times.
      const spread = [];
      for (const e of entries) for (let i = 0; i < (num(e[1]) || 1); i++) spread.push(num(e[0]));
      spread.sort((a, b) => a - b);
      const mid = Math.floor(spread.length / 2);
      out.basis = `what ${thing(rarity, name)} with both ${order[0]} and ${order[1]} has sold for, at any rolls`;
      out.estimate = spread.length % 2 ? spread[mid] : Math.round((spread[mid - 1] + spread[mid]) / 2);
      out.low = spread[0];
      out.high = spread[spread.length - 1];
      if (out.low === out.high) { out.low = null; out.high = null; }
      out.samples = spread.length;
      return withNearMiss(out, nearMiss);
    }
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
    let at = valueAtPct(pts, num(lead.pct));

    // A roll can sit outside its own rarity's band. This weapon is Orange
    // because of its 82% Achilles, while its 17% Warlord is a Yellow-band roll
    // — Orange Warlords start at 20%, so "Orange Warlord at 17%" asks for
    // something that cannot exist as a single-bonus sale, and extrapolating
    // below the floor returned $1.43b. Yellow recorded that roll twenty-two
    // times at $755m. An exact roll somebody actually sold beats a line drawn
    // past the end of a different one, so it is borrowed, and said so.
    let borrowed = null;
    if (!at || at.extrapolated) {
      const tbl = table(feed, "levelPrices", "weaponLevelPrices")[name + "|" + lead.name] || {};
      for (const r of Object.keys(tbl)) {
        if (r === rarity) continue;
        const e = tbl[r] && tbl[r][String(num(lead.pct))];
        if (Array.isArray(e) && num(e[0])) {
          if (!borrowed || (num(e[1]) || 0) > borrowed.n) borrowed = { r, v: num(e[0]), n: num(e[1]) || 1 };
        }
      }
      if (borrowed) at = { value: borrowed.v, extrapolated: false };
      else borrowed = null;
    }

    if (at) {
      if (borrowed) {
        out.notes.push(`No ${rarity} one has sold at ${lead.pct}% ${lead.name} — that roll makes a ${borrowed.r} weapon on its own. This is what ${borrowed.n} ${borrowed.r} ones went for at that roll.`);
      }
      // "matched to the 40%" and "nothing this good has ever sold" cannot both
      // be true, and the badge said both. A price carried past the end of the
      // curve is matched to nothing, and the sales quoted beside it are at
      // other rolls — so it says that instead.
      out.basis = at.extrapolated
        ? `what ${thing(rarity, name)} with ${lead.name} has sold for at other rolls, carried out to the ${lead.pct}%`
        : `what ${thing(rarity, name)} with ${lead.name} has sold for, matched to the ${lead.pct}%`;
      out.estimate = at.value;
      out.extrapolated = at.extrapolated;
      if (at.extrapolated && !borrowed) {
        // Before declaring nothing has sold at this roll, look at the rolls too
        // thin to price from. A 40% Weaken Orange Jackhammer HAS sold — once,
        // for $308m — and the curve, which needs three, never saw it.
        const near = rollNeighbours(feed, name, lead.name, rarity, num(lead.pct));
        if (near && near.at) {
          out.notes.push(`Only ${salesWord(near.at.n)} at ${lead.pct}% ${lead.name}, for ${money(near.at.value)} — too few to price from, so this follows the trend from the rolls that have more.`);
        } else {
          const below = num(lead.pct) < pts[0][0];
          out.notes.push(below
            ? `Nothing this low has ever sold — the lowest on record is ${pts[0][0]}%. This follows the trend below that, so treat it as a guess rather than a price.`
            : `Nothing this good has ever sold — the best on record is ${pts[pts.length - 1][0]}%. This follows the trend past that, so treat it as a guess rather than a price.`);
        }
      }
      // A second bonus is worth something, but there is no measurement of THIS
      // pair — flagged rather than silently multiplied in.
      if (bonuses.length > 1) {
        out.notes.push(secondBonusNote(bonuses));
      }
      // Same window for the range as for the estimate. Quoting an all-time
      // low-high beside a last-year median reads as one measurement and is two.
      // Sales at THIS roll where the roll was actually recorded; the pooled
      // range only when the price had to be estimated between or beyond them.
      const exact = borrowed
        ? [borrowed.v, borrowed.n]
        : levelEntry(table(feed, "levelPrices", "weaponLevelPrices"), name, lead.name, rarity, num(lead.pct));
      if (exact) {
        out.samples = num(exact[1]);
      } else {
        const combo = (table(feed, "comboPrices", "weaponComboPrices")[name + "|" + lead.name] || {})[rarity];
        if (combo) { out.low = num(combo[0]); out.high = num(combo[2]); out.samples = cntOf(combo); }
      }
      const histAt = valueAtPct(curveOf(feed.weaponLevelPrices, name, lead.name, rarity), num(lead.pct));
      if (histAt && at.value && Math.abs(histAt.value - at.value) / at.value > 0.05) {
        // With the longer view's sample size, because "3 sales" on its own
        // reads as too little to trust and invites widening the window.
        // Measured, widening to three years nearly DOUBLES the error: RW prices
        // fall about a quarter a year, so older sales are a different market
        // rather than more of this one. Saying how much evidence sits back
        // there lets the reader weigh it without the estimate moving.
        const histCombo = ((feed.weaponComboPrices || {})[name + "|" + lead.name] || {})[rarity];
        const histN = cntOf(histCombo);
        out.notes.push(`These are the last year's prices. Going all the way back it's ${money(histAt.value)}${histN ? ` across ${histN} sales` : ""}, but those older sales were a different market, not a bigger one — prices fall roughly a quarter a year.`);
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
      out.notes.push(rollNote(feed, name, bonuses[0].name, rarity, num(bonuses[0].pct)));
      // This rung drops the second bonus too, and said nothing about it. The
      // S&W Revolver that exposed this quoted $375m off one bonus; the same
      // revolver, both bonuses, had sold three weeks earlier for $2.14b.
      if (bonuses.length > 1) out.notes.push(secondBonusNote(bonuses));
      return withNearMiss(out, nearMiss);
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
