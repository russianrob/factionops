import test from "node:test";
import assert from "node:assert/strict";
import { parseWeekOf, plannerId, looksLikePlanner, parseObject } from "./planner-store.js";

// The WRAP leads with "week of 08/23/2026" and repeats the date in several other
// formats further down; only the lead line is reliable as the week key.
test("parseWeekOf reads the lead line, not the later formats", () => {
  const t = "week of 08/23/2026\nMARKETING\n08.23.2026\nChainwide Corporate WRAP";
  assert.equal(parseWeekOf(t), "2026-08-23");
  assert.equal(parseWeekOf("week of 8/3/26 MARKETING"), "2026-08-03");   // pads, expands year
  assert.equal(parseWeekOf("no date here"), null);
});

// Content-addressed so a re-fired Shortcut reuses the record instead of paying
// for another extraction — the same property the circular gets from its URL.
test("plannerId is stable and content-addressed", () => {
  assert.equal(plannerId("a week"), plannerId("a week"));
  assert.notEqual(plannerId("a week"), plannerId("another week"));
  assert.match(plannerId("x"), /^[a-f0-9]{16}$/);
});

// Two independent markers, so a stray body that merely says "MARKETING" is not
// filed as a week's brief — and a real one is never mistaken for a URL.
test("looksLikePlanner needs both markers and real length", () => {
  const body = "week of 08/23/2026 MARKETING Chainwide Corporate WRAP ".repeat(20);
  assert.equal(looksLikePlanner(body), true);
  assert.equal(looksLikePlanner("week of 08/23/2026 MARKETING"), false, "too short");
  assert.equal(looksLikePlanner("MARKETING ".repeat(100)), false, "no week line");
  assert.equal(looksLikePlanner("week of 08/23/2026 ".repeat(100)), false, "no marketing marker");
  assert.equal(looksLikePlanner("https://x.cloudfront.net/a.pdf"), false, "a link is not a planner");
});

// The model is asked for a bare object; a fence or a preamble is the usual slip.
test("parseObject survives fences and preamble", () => {
  assert.deepEqual(parseObject('{"weekOf":"2026-08-23"}'), { weekOf: "2026-08-23" });
  assert.deepEqual(parseObject('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseObject('Here you go:\n{"a":[1,2]}\nhope that helps'), { a: [1, 2] });
  assert.throws(() => parseObject("no json at all"));
});
