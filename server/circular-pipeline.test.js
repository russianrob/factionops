import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateCircularUrl, jobIdForUrl, parseValidRange, splitDisclaimerSegments,
  extractJsonArray, mergeOffers, coverageCheck, extractPage, chunkSegment,
} from "./circular-pipeline.js";

test("validateCircularUrl accepts an https cloudfront pdf", () => {
  const r = validateCircularUrl("https://d16fzx5hhs0dp6.cloudfront.net/a/b_31Jul2026_SM.pdf");
  assert.equal(r.ok, true);
});

test("validateCircularUrl rejects non-https, wrong host, non-pdf", () => {
  assert.equal(validateCircularUrl("http://x.cloudfront.net/a.pdf").ok, false);      // not https
  assert.equal(validateCircularUrl("https://evil.com/a.pdf").ok, false);              // wrong host
  assert.equal(validateCircularUrl("https://x.cloudfront.net/a.html").ok, false);     // not pdf
  assert.equal(validateCircularUrl("https://cloudfront.net.evil.com/a.pdf").ok, false); // suffix spoof
  assert.equal(validateCircularUrl("not a url").ok, false);
});

test("validateCircularUrl allows a query string after .pdf", () => {
  assert.equal(validateCircularUrl("https://x.cloudfront.net/a.pdf?v=2").ok, true);
});

test("jobIdForUrl is stable and url-specific (idempotency key)", () => {
  const a = jobIdForUrl("https://x.cloudfront.net/week1.pdf");
  assert.equal(a, jobIdForUrl("https://x.cloudfront.net/week1.pdf"));
  assert.notEqual(a, jobIdForUrl("https://x.cloudfront.net/week2.pdf"));
  assert.match(a, /^[a-f0-9]{16}$/);
});

test("parseValidRange reads the offers-valid banner", () => {
  const r = parseValidRange("OFFERS VALID SUNDAY, AUGUST 2ND THRU SATURDAY, AUGUST 8TH, 2026");
  assert.deepEqual(r, { validFrom: "2026-08-02", validThru: "2026-08-08" });
});

test("parseValidRange handles a cross-month range and returns null when absent", () => {
  assert.deepEqual(
    parseValidRange("Offers valid Friday, October 31st thru Thursday, November 6th, 2025"),
    { validFrom: "2025-10-31", validThru: "2025-11-06" });
  assert.equal(parseValidRange("no date here"), null);
});

test("splitDisclaimerSegments splits a flattened multi-page spread", () => {
  // Two physical pages flattened: the disclaimer repeats once per page.
  const raw = [
    "OFFERS VALID SUNDAY, AUGUST 2ND THRU SATURDAY, AUGUST 8TH, 2026",
    "Prices, programs and promotions effective Sun., Aug. 2 ...",
    "Hass Avocados", "5 for $4",
    "Prices, programs and promotions effective Sun., Aug. 2 ...",
    "Goya Rice 20-lb", "$9.99",
  ].join("\n");
  const segs = splitDisclaimerSegments(raw);
  assert.equal(segs.length, 2);
  assert.match(segs[0], /Hass Avocados/);
  assert.match(segs[1], /Goya Rice/);
  assert.ok(!segs[0].includes("Goya"), "first segment must not bleed into the second");
});

test("splitDisclaimerSegments returns a single page whole", () => {
  const raw = "Prices, programs and promotions effective ...\nHefty Bags\n4 for $7";
  assert.deepEqual(splitDisclaimerSegments(raw).length, 1);
});

test("extractJsonArray survives prose and code fences", () => {
  assert.deepEqual(extractJsonArray('```json\n[{"product":"Tuna"}]\n```'), [{ product: "Tuna" }]);
  assert.deepEqual(extractJsonArray('Here you go: [{"a":1}] hope that helps'), [{ a: 1 }]);
  assert.deepEqual(extractJsonArray("no array at all"), []);
  assert.deepEqual(extractJsonArray('[broken'), []);
});

test("mergeOffers drops exact product+price duplicates and stamps page", () => {
  const merged = mergeOffers([
    { page: 2, offers: [{ product: "Hass Avocados", priceText: "5 for $4" }] },
    { page: 2, offers: [{ product: "Hass Avocados", priceText: "5 for $4" }, { product: "Goya Rice", priceText: "$9.99" }] },
  ]);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged.map(o => o.product).sort(), ["Goya Rice", "Hass Avocados"]);
  assert.ok(merged.every(o => o.page === 2));
});

test("coverageCheck flags a product present in text but missing from offers", () => {
  const raw = "Hefty Slider Bags\n4 for $7\nGoya Canilla Rice\n$9.99";
  const offers = [{ product: "Hefty Slider Bags", detail: "box" }];  // Goya missing
  const cov = coverageCheck(raw, offers);
  assert.ok(cov.missed.some(m => /Goya/.test(m)), "should surface the missed Goya line");
});

test("coverageCheck passes clean when everything is covered", () => {
  const raw = "Hefty Slider Bags\n4 for $7";
  const cov = coverageCheck(raw, [{ product: "Hefty Slider Bags", detail: "box" }]);
  assert.equal(cov.missedCount, 0);
});

test("chunkSegment returns a short segment whole", () => {
  const short = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
  assert.deepEqual(chunkSegment(short, 220, 40).length, 1);
});

test("chunkSegment windows a long segment with overlap covering every line", () => {
  const lines = Array.from({ length: 401 }, (_, i) => `line ${i}`);
  const chunks = chunkSegment(lines.join("\n"), 220, 40);
  assert.ok(chunks.length >= 2, "401 lines must split");
  // Every source line appears in at least one window (no tile falls in a gap).
  const covered = new Set();
  for (const c of chunks) for (const l of c.split("\n")) covered.add(l);
  for (const l of lines) assert.ok(covered.has(l), `line missing from all windows: ${l}`);
});

test("extractPage windows an oversized segment and dedups overlap", async () => {
  // One physical page (no disclaimer seam) of 300 lines → multiple windows; the
  // extractor returns the same offer from overlapping windows; expect one.
  const raw = Array.from({ length: 300 }, (_, i) => `filler ${i}`).join("\n");
  let calls = 0;
  const extractor = async () => { calls++; return '[{"product":"Milk","priceText":"$2"}]'; };
  const r = await extractPage(5, raw, extractor, { maxLines: 220, overlap: 40 });
  assert.ok(r.chunks >= 2, "should window into >=2 chunks");
  assert.ok(calls >= 2, "extractor called per window");
  assert.equal(r.offers.length, 1, "overlap duplicates deduped");
});

test("extractPage splits segments and runs the injected extractor per segment", async () => {
  const raw = [
    "Prices, programs and promotions effective ...", "Avocados", "5 for $4",
    "Prices, programs and promotions effective ...", "Rice", "$9.99",
  ].join("\n");
  const calls = [];
  const fakeExtractor = async (prompt) => {
    calls.push(prompt);
    return prompt.includes("Avocados")
      ? '[{"product":"Avocados","priceText":"5 for $4"}]'
      : '[{"product":"Rice","priceText":"$9.99"}]';
  };
  const r = await extractPage(4, raw, fakeExtractor);
  assert.equal(r.segments, 2);
  assert.equal(calls.length, 2, "one extractor call per physical-page segment");
  assert.deepEqual(r.offers.map(o => o.product).sort(), ["Avocados", "Rice"]);
});
