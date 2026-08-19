// Weekly merchandising planner ("Chainwide Corporate WRAP").
//
// A different document from the shopper circular and NOT a substitute for it:
// the circular is the customer-facing price book the deli form is built from,
// the planner is the internal brief — what to build, what to push, which items
// carry a sign, and the fresh-meat PLUs. The phone Shortcut posts it as text it
// has already pulled out of the PDF, so there is nothing to fetch and nothing to
// run pdftotext over; the text IS the input.
//
// It used to arrive at /api/circular, fail URL validation with "not a URL", and
// be discarded. A week's brief is not worth losing to a 400, so it now lands
// here.

import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { claudeExtract, extractJsonArray } from "./circular-pipeline.js";

export const PLANNER_DIR = process.env.PLANNER_DIR || "/opt/warboard/server/data/planner";

const MAX_TEXT = 1024 * 1024;      // a WRAP runs ~21 KB; 1 MB is absurd headroom

/// "week of 08/23/2026" → "2026-08-23". The WRAP leads with this line, and it is
/// the only reliable week key in the document — the body repeats the date in
/// several formats ("08.23.2026", "8/23/26") and in several places.
export function parseWeekOf(text) {
  const m = String(text).match(/week\s+of\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
  if (!m) return null;
  const [, mo, d, y] = m;
  const year = y.length === 2 ? `20${y}` : y;
  return `${year}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/// Content-addressed, like the circular's byte path: re-posting the same brief
/// must land on the same record rather than spending another extraction.
export function plannerId(text) {
  return createHash("sha1").update(String(text)).digest("hex").slice(0, 16);
}

/// Is this the planner rather than a stray text body? Two independent markers,
/// because a single one would misfile anything that happened to say "MARKETING".
export function looksLikePlanner(text) {
  const t = String(text);
  if (t.length < 500) return false;
  return /week\s+of\s+\d{1,2}\/\d{1,2}\/\d{2,4}/i.test(t) && /MARKETING|WRAP/i.test(t);
}

const PROMPT = (text) => `This is the internal weekly merchandising planner for a ShopRite supermarket
("Chainwide Corporate WRAP"). It is a staff brief, not a customer price book.

Pull out ONLY what a deli manager needs, as JSON. Return a single JSON object,
no prose, no markdown fence:

{
  "weekOf": "YYYY-MM-DD",
  "deli": [ { "item": "...", "price": "...", "note": "..." } ],
  "cheese": [ { "item": "...", "price": "...", "note": "..." } ],
  "meat": [ { "item": "...", "plu": "...", "price": "...", "note": "..." } ],
  "actions": [ "..." ]
}

Rules:
- "deli" and "cheese": anything sold at the deli or cheese counter, including
  the Cheese of the Week / Cheese of the Month / item of the week callouts.
- "meat": fresh meat department items. Keep the PLU number when one is given.
- "price" verbatim as written, including "/LB.", "w PP", "w/coupon" etc. Use
  null when an item has no price.
- "actions": short imperative lines a deli manager must actually DO this week
  (build a table, put up a sign, run an event). At most 8, most important first.
- Omit anything about other departments, contests for other teams, or generic
  corporate messaging.
- If a section has nothing, use an empty array. Never invent an item.

PLANNER TEXT:
${text}`;

export function plannerDir(id) { return join(PLANNER_DIR, id); }

export function readLatestPlanner() {
  try { return JSON.parse(readFileSync(join(PLANNER_DIR, "latest.json"), "utf8")); } catch { return null; }
}

export function readPlanner(id) {
  try { return JSON.parse(readFileSync(join(plannerDir(id), "planner.json"), "utf8")); } catch { return null; }
}

/// Store the raw text first, then extract. The raw file is written BEFORE the
/// API call so a failed or slow extraction never loses the week — the brief can
/// always be re-extracted from disk, but it cannot be re-sent from a phone once
/// the Shortcut has moved on.
export async function processPlanner(text, opts = {}) {
  const raw = String(text).slice(0, MAX_TEXT);
  const id = plannerId(raw);
  const dir = plannerDir(id);
  const extractor = opts.extractor || ((p) => claudeExtract(p));

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "raw.txt"), raw, "utf8");

  const weekOf = parseWeekOf(raw);
  const base = { id, weekOf, receivedAt: new Date().toISOString(), bytes: raw.length };

  let out;
  try {
    const reply = await extractor(PROMPT(raw));
    const parsed = parseObject(reply);
    out = { ...base, ...parsed, weekOf: parsed.weekOf || weekOf, state: "done", error: null };
  } catch (e) {
    // The raw text is already safe on disk; record why the extract failed rather
    // than throwing the week away with it.
    out = { ...base, state: "error", error: String((e && e.message) || e),
            deli: [], cheese: [], meat: [], actions: [] };
  }

  writeFileSync(join(dir, "planner.json"), JSON.stringify(out, null, 1), "utf8");
  writeFileSync(join(PLANNER_DIR, "latest.json"), JSON.stringify(out, null, 1), "utf8");
  return out;
}

/// The model is told to return a bare object, but wrapping it in a fence or a
/// sentence is the usual failure — reuse the array salvage where it applies and
/// otherwise find the outermost braces.
export function parseObject(reply) {
  const s = String(reply);
  try { return JSON.parse(s.trim()); } catch {}
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1].trim()); } catch {} }
  const i = s.indexOf("{"), j = s.lastIndexOf("}");
  if (i >= 0 && j > i) { try { return JSON.parse(s.slice(i, j + 1)); } catch {} }
  throw new Error("extractor did not return JSON");
}

export function listPlanners() {
  try {
    return readdirSync(PLANNER_DIR)
      .filter(n => existsSync(join(PLANNER_DIR, n, "planner.json")))
      .map(n => readPlanner(n))
      .filter(Boolean)
      .sort((a, b) => String(b.weekOf || "").localeCompare(String(a.weekOf || "")));
  } catch { return []; }
}
