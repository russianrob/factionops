/// Auto-fill the Bulk-On-Sale deli/cheese form from a week's circular.
///
/// The form (store 190 Pelham) has 12 fixed rows the user tracks; each week the
/// item on sale for each row changes. This maps a week's deli-counter offers onto
/// those rows under the user's rules and writes a filled .xlsx.
///
/// Why this exists separately from the main text extraction: the deli section
/// draws prices DETACHED from product names, and a single tile can price several
/// products together ("$7.99 lb — Black Bear Deli Classic Ham OR Bowl & Basket
/// Chicken Breast" means BOTH are $7.99). pdftotext scrambles that — it read the
/// chicken as $5.99. So the deli page is read by VISION (see circular-store's
/// generateDeliForm), and this module holds the pure matching + xlsx fill.

// ── Rules (user-set) ────────────────────────────────────────────────────────

// Named brand exclusions — a genuine preference, kept as a list, not buried in a
// regex. The user does not buy Carolina or Butterball (both turkey brands).
export const EXCLUDE_BRANDS = ["carolina", "butterball"];

// A ham is "flavored" when its name/description carries a flavor word; otherwise
// it is a domestic ham. Encoding the REASON (not "Glen Rock") means next week's
// honey ham from any brand still lands in Flavored Ham. "Smoked" is deliberately
// NOT here — nearly every deli ham is smoked, so it does not distinguish.
const FLAVOR_WORDS = /\b(honey|maple|glazed|brown sugar|virginia|black forest|cajun|peppered|pepper[- ]crusted|rosemary|prosciutt)\b/i;
export function isFlavoredHam(text) { return FLAVOR_WORDS.test(String(text)); }

// The form rows, in sheet order (row = Production-sheet row number). Each has
// a predicate over an offer {product, description}. Ham rows share the flavored
// split. Predicates are intentionally narrow so raw-meat / packaged lookalikes
// (chicken thighs, mozzarella cups) do not leak in — the per-lb filter in
// matchDeliOffers is the second guard.
export const DELI_ROWS = [
  { row: 3,  item: "Turkey",       match: t => /turkey/.test(t) && !/kielbasa|bacon|burger|ground|roaster/.test(t) },
  { row: 4,  item: "Chicken",      match: t => /chicken breast/.test(t) && !/tender|thigh|drumstick|ground|wing|nugget|breaded|roaster|family/.test(t) },
  { row: 5,  item: "Domestic Ham", match: t => /\bham\b/.test(t) && !/turkey|chicken/.test(t) && !isFlavoredHam(t) },
  { row: 6,  item: "Flavored Ham", match: t => /\bham\b/.test(t) && !/turkey|chicken/.test(t) && isFlavoredHam(t) },
  // Bowl & Basket bologna is the standing buy at $3.99 when nothing beats it.
  { row: 7,  item: "Bologna",      match: t => /bologna/.test(t), def: { brand: "Bowl & Basket", price: 3.99 } },
  // Salami: any brand on sale (Carando Genoa, Black Bear, etc.) — NOT Black-Bear-
  // only, which skipped this week's Carando. The cell shows the brand with the
  // "Classico" sub-brand stripped (Black Bear's product is "Black Bear Classico
  // Genoa Salami"; the deli cell just reads "Black Bear").
  { row: 8,  item: "Salami",       match: t => /salami/.test(t),
    label: o => { const b = (o.brand || "").replace(/\bclassico\b/i, "").replace(/\s+/g, " ").trim(); return b || null; } },
  // Pepperoni is rarely on the circular; when it isn't, the user's standing
  // order is Black Bear at $7.99, so fall back to that instead of a blank cell.
  { row: 9,  item: "Pepperoni",    match: t => /pepperoni/.test(t), def: { brand: "Black Bear", price: 7.99 } },
  // Roast Beef's cell shows the CUT, not the brand: Eye Round, London Broil, or
  // "Regular" when it's neither.
  // The standing buy is the eye round at $10.99; `def.brand` is the CUT here, to
  // match what `label` puts in the cell on a week that does have a deal.
  { row: 10, item: "Roast Beef",   match: t => /roast beef/.test(t),
    def: { brand: "Eye Round", price: 10.99 },
    label: o => { const s = `${o.product || ""} ${o.description || ""}`.toLowerCase();
      return /eye round/.test(s) ? "Eye Round" : /london broil/.test(s) ? "London Broil" : "Regular"; } },
  // American cheese — but NOT "American Cheddar" (that's a sharp cheddar, belongs
  // in the Cheddar row). Without the cheddar exclusion, "Ultra Sharp American
  // Cheddar" wrongly filled American.
  { row: 11, item: "American",     match: t => /american/.test(t) && !/cheddar/.test(t) && !/\bham\b|turkey|chicken/.test(t) },
  { row: 12, item: "Provolone",    match: t => /provolone/.test(t) },
  { row: 13, item: "Mozzarella",   match: t => /mozzarella/.test(t) },
  { row: 14, item: "Muenster",     match: t => /muenster|munster/.test(t) },
  { row: 15, item: "Swiss",        match: t => /swiss/.test(t) },
  // Cheddar cell includes the sharpness variety (e.g. "Bowl & Basket Ultra Sharp")
  // when the text names one, since that's how the user identifies the cheddar.
  // Exclude "-wurst" sausages (a Black Bear "Cheddarwurst" bratwurst wrongly
  // filled Cheddar at $3.99) and other non-cheese uses of the word.
  // Standing buy: Bowl & Basket at $6.99. No sharpness on the default — the
  // label below adds one only when a real offer names it.
  { row: 16, item: "Cheddar",      match: t => /cheddar/.test(t) && !/wurst|sausage|brat\b/.test(t),
    def: { brand: "Bowl & Basket", price: 6.99 },
    label: o => { const brand = (o.brand || "").trim();
      const m = `${o.product || ""} ${o.description || ""}`.match(/\b(extra sharp|ultra sharp|sharp|medium|mild)\b/i);
      return m ? `${brand} ${m[1].replace(/\b\w/g, c => c.toUpperCase())}`.trim() : (brand || null); } },
];

// ── Matching ────────────────────────────────────────────────────────────────

const num = (o) => (typeof o.pricePerLb === "number" ? o.pricePerLb
  : (() => { const m = String(o.priceText || "").match(/\$?([\d]+\.\d{2})/); return m ? parseFloat(m[1]) : null; })());

const isPerLb = (o) => (o.unit === "lb") || /\/?\s*lb\b|per\s*lb/i.test(String(o.priceText || ""));

const excluded = (o) => EXCLUDE_BRANDS.some(b => (String(o.brand || "") + " " + String(o.product || "")).toLowerCase().includes(b));

// Map deli offers onto the 12 form rows. Rules: per-lb deli-counter items only,
// exclude named brands, cheapest per row, blank if no deal. Returns an array
// aligned to DELI_ROWS: { row, item, brand, price } with brand/price null when
// blank.
export function matchDeliOffers(offers) {
  const usable = offers.filter(o => isPerLb(o) && num(o) != null && !excluded(o));
  return DELI_ROWS.map(({ row, item, match, label, def }) => {
    const t = (o) => `${o.product || ""} ${o.description || ""}`.toLowerCase();
    const cands = usable.filter(o => match(t(o))).sort((a, b) => num(a) - num(b));
    // No deal this week: use the row's standing default (e.g. Pepperoni →
    // Black Bear $7.99) if it has one, otherwise leave the cell blank.
    // `fromDefault` marks a cell the circular did NOT supply. The overwrite guard
    // counts only real matches: defaults fill regardless of how badly the vision
    // read went, so counting them would let a half-broken read clear the bar and
    // clobber the user's approved form.
    if (!cands.length) {
      return def
        ? { row, item, brand: def.brand, price: def.price, fromDefault: true }
        : { row, item, brand: null, price: null };
    }
    const best = cands[0];
    // A row may override how its "brand" cell is labelled (Roast Beef shows the
    // cut, not the maker); default is the offer's brand.
    const brand = label ? label(best) : ((best.brand || "").trim() || null);
    return { row, item, brand, price: num(best), product: best.product };
  });
}

export function countFilled(fills) { return fills.filter(f => f.price != null).length; }

/// Rows the CIRCULAR actually supplied — standing defaults excluded. This is the
/// number the overwrite guard must use: `countFilled` includes defaults, which
/// fill even when the vision read returned nothing at all, so gating on it would
/// let a badly-degraded run overwrite the user's approved form.
export function countMatched(fills) { return fills.filter(f => f.price != null && !f.fromDefault).length; }

// ── Deli-page detection ─────────────────────────────────────────────────────

// Which PDF pages hold deli-counter items. Signal = the section header OR any
// "Store Sliced" (the deli counter's own phrasing — specific enough that even a
// single occurrence is a real by-the-pound item, e.g. the lone "Black Bear Eye
// Round Roast Beef (Deli) Store Sliced $10.99" tucked into a "Lunchbox
// Essentials" grocery page — a locked-in price valid this week too). Raw-meat/
// produce pages have high "lb" counts but ZERO "Store Sliced", so lb density is
// NOT a usable signal. Returns page numbers; caller treats [] as a hard failure.
export function findDeliPages(pageTexts) {
  const pages = [];
  for (const { page, text } of pageTexts) {
    const header = /Deli,?\s*Specialty\s*Cheese/i.test(text);
    const sliced = (text.match(/Store\s*Sliced/gi) || []).length;
    if (header || sliced >= 1) pages.push(page);
  }
  return pages;
}

// ── Vision prompt for the deli page ─────────────────────────────────────────

export function buildDeliVisionPrompt() {
  return `This is ONE page from a supermarket weekly circular. Find EVERY DELI-COUNTER item on it — the ones sold BY THE POUND and marked "Store Sliced" (sliced turkey, ham, salami, bologna, roast beef, and deli cheeses: American, provolone, mozzarella, muenster, swiss, cheddar). They usually sit in a dedicated "Deli / Specialty Cheese" section, but they ALSO appear as featured tiles ANYWHERE on the page — e.g. a front-page store-brand showcase with a "Store Sliced ... $X.YY lb" turkey or American cheese. Look over the WHOLE page, not just a deli-labelled block. Some pages have NONE — return an empty array [] if so.

Return ONLY a JSON array. Each element:
{"product": string, "brand": string, "priceText": string, "pricePerLb": number|null, "unit": "lb"|"each"|null, "description": string}

CRITICAL — grouped tiles: one big price often covers MULTIPLE products joined by "or". Example: a "$7.99 lb" tile reading "Black Bear Deli Classic Ham ... or Bowl & Basket Chicken Breast ..." means BOTH are $7.99/lb. Emit a SEPARATE entry for EACH product, each with that same price. A "your choice $5.99 lb" tile listing six cheeses/meats = six entries at $5.99.

- brand is the maker (Black Bear, Bowl & Basket, Farmland, Glen Rock, Carando, Auricchio, Land O'Lakes, Smithfield, etc.), separate from the product.
- description keeps the flavor/style words ("Deep Smoked, Maple Glazed", "Virginia or Honey", "Oven Roasted, BBQ or Buffalo") — they decide which form row an item belongs to.
- pricePerLb: the dollars-per-pound number when the price is "$X.YY lb", else null.
- Include only true deli-counter (by-the-pound) items. Skip packaged grab-and-go (Sargento sliced, Galbani cups, Hillshire packages), prepared hot foods, crackers, hummus, and dips.

Be exhaustive and re-read both images before finalizing.`;
}

// ── xlsx fill (zip/XML surgery — no openpyxl on the box) ─────────────────────

// Fill the template's Production sheet1.xml: DATE (C1) + Brand (C) / Price (D)
// per row, preserving every other cell, style and the sheet-2 dropdowns. Text
// cells become inline strings (so sharedStrings is untouched); price cells stay
// numeric; blank rows are cleared. Pure over the XML string; the zip repack that
// wraps it lives in circular-store (IO). Node stdlib only.
export function fillSheetXml(sheetXml, fills, dateRange) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let xml = sheetXml;
  const styleOf = (ref) => {
    const m = xml.match(new RegExp(`<c r="${ref}"([^>]*)>`));
    const s = m && m[1].match(/s="(\d+)"/);
    return s ? ` s="${s[1]}"` : "";
  };
  const rep = (ref, inner) => { xml = xml.replace(new RegExp(`<c r="${ref}"[^>]*>.*?</c>`), inner); };
  if (dateRange) rep("C1", `<c r="C1"${styleOf("C1")} t="inlineStr"><is><t>${esc(dateRange)}</t></is></c>`);
  for (const f of fills) {
    const cB = `C${f.row}`, cP = `D${f.row}`, sB = styleOf(cB), sP = styleOf(cP);
    if (f.price == null) {
      rep(cB, `<c r="${cB}"${sB} t="inlineStr"><is><t></t></is></c>`);
      rep(cP, `<c r="${cP}"${sP} t="inlineStr"><is><t></t></is></c>`);
    } else {
      rep(cB, `<c r="${cB}"${sB} t="inlineStr"><is><t>${esc(f.brand || "")}</t></is></c>`);
      rep(cP, `<c r="${cP}"${sP} t="n"><v>${f.price}</v></c>`);
    }
  }
  return xml;
}

// "2026-08-02","2026-08-08" → "8/2-8/8"
export function dateRangeLabel(validFrom, validThru) {
  const fmt = (iso) => { const m = String(iso).match(/^\d{4}-(\d{2})-(\d{2})$/); return m ? `${+m[1]}/${+m[2]}` : null; };
  const a = fmt(validFrom), b = fmt(validThru);
  return a && b ? `${a}-${b}` : (a || "");
}
