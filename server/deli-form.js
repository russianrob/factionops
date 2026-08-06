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
  { row: 7,  item: "Bologna",      match: t => /bologna/.test(t) },
  // Salami: only Black Bear, and the cell always reads just "Black Bear" (the
  // product is "Black Bear Classico Genoa Salami" — drop the "Classico" sub-line).
  { row: 8,  item: "Salami",       match: t => /salami/.test(t) && /black bear/.test(t), label: () => "Black Bear" },
  { row: 9,  item: "Pepperoni",    match: t => /pepperoni/.test(t) },
  // Roast Beef's cell shows the CUT, not the brand: Eye Round, London Broil, or
  // "Regular" when it's neither.
  { row: 10, item: "Roast Beef",   match: t => /roast beef/.test(t),
    label: o => { const s = `${o.product || ""} ${o.description || ""}`.toLowerCase();
      return /eye round/.test(s) ? "Eye Round" : /london broil/.test(s) ? "London Broil" : "Regular"; } },
  { row: 11, item: "American",     match: t => /american/.test(t) && !/\bham\b|turkey|chicken/.test(t) },
  { row: 12, item: "Provolone",    match: t => /provolone/.test(t) },
  { row: 13, item: "Mozzarella",   match: t => /mozzarella/.test(t) },
  { row: 14, item: "Muenster",     match: t => /muenster|munster/.test(t) },
  { row: 15, item: "Swiss",        match: t => /swiss/.test(t) },
  { row: 16, item: "Cheddar",      match: t => /cheddar/.test(t) },
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
  return DELI_ROWS.map(({ row, item, match, label }) => {
    const t = (o) => `${o.product || ""} ${o.description || ""}`.toLowerCase();
    const cands = usable.filter(o => match(t(o))).sort((a, b) => num(a) - num(b));
    if (!cands.length) return { row, item, brand: null, price: null };
    const best = cands[0];
    // A row may override how its "brand" cell is labelled (Roast Beef shows the
    // cut, not the maker); default is the offer's brand.
    const brand = label ? label(best) : ((best.brand || "").trim() || null);
    return { row, item, brand, price: num(best), product: best.product };
  });
}

export function countFilled(fills) { return fills.filter(f => f.price != null).length; }

// ── Deli-page detection ─────────────────────────────────────────────────────

// Which PDF pages hold the deli counter. Primary signal is the literal section
// header; the reliable secondary is "Store Sliced" — the deli counter's own
// phrasing, which appears only on deli pages (raw-meat/produce pages have high
// "lb" counts but ZERO "Store Sliced", so lb density is NOT a usable signal).
// This week: pages 4 (2) and 5 (14); every other page 0. Returns page numbers;
// caller logs them and treats [] as a hard failure.
export function findDeliPages(pageTexts) {
  const pages = [];
  for (const { page, text } of pageTexts) {
    const header = /Deli,?\s*Specialty\s*Cheese/i.test(text);
    const sliced = (text.match(/Store\s*Sliced/gi) || []).length;
    if (header || sliced >= 2) pages.push(page);
  }
  return pages;
}

// ── Vision prompt for the deli page ─────────────────────────────────────────

export function buildDeliVisionPrompt() {
  return `These images are the "Deli, Specialty Cheese & Snacking" section of a supermarket weekly circular (one physical page, split top/bottom). Extract every DELI-COUNTER item — the ones sold by the pound, "Store Sliced".

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
