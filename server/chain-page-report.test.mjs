// Page chain reports (FactionOps 5.6.28): when a member's focused Torn page
// shows the chain ahead of Torn's API, the chain alerts follow the page.
//
// On 2026-10-28 Torn's API ran behind the game for about two hours, showing
// the chain over while it ran on, and the server could send no chain alert.
// The server still reads the API as before. A page report decides the alerts
// only while it is ahead of the API's reading; with none, nothing changes.
// These tests run the rule in chain-alert-rule.js, and check the route in
// routes.js' text. Counts and ids are made up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as rule from "./chain-alert-rule.js";

const T = 2_000_000_000_000; // a fixed moment, in ms

// ── The API's reading as ends ───────────────────────────────────────────

test("the API's reading as ends: its clock and its cooldown from when it was read, a stored end as it is", () => {
  assert.deepEqual(rule.apiChainView({ current: 1240, timeout: 40, cooldown: 0 }, T),
    { current: 1240, endsAtMs: T + 40_000, cooldownEndsAtMs: 0 });
  assert.deepEqual(rule.apiChainView({ current: 1240, chainEndsAt: T + 9_000, cooldown: 0 }, T - 5_000),
    { current: 1240, endsAtMs: T + 9_000, cooldownEndsAtMs: 0 });
  assert.deepEqual(rule.apiChainView({ current: 1240, timeout: 0, cooldown: 7_440 }, T),
    { current: 1240, endsAtMs: 0, cooldownEndsAtMs: T + 7_440_000 });
  assert.deepEqual(rule.apiChainView({ current: "1240", chainEndsAt: 0, cooldown: 0 }, T),
    { current: 1240, endsAtMs: 0, cooldownEndsAtMs: 0 });
  assert.deepEqual(rule.apiChainView(undefined, T), { current: 0, endsAtMs: 0, cooldownEndsAtMs: 0 });
});

// ── When a page report leads ────────────────────────────────────────────

// A page report `ageMs` old of `count` hits whose clock runs out `leftS`
// after T, and the API's reading at T.
const page = (count, leftS, ageMs = 0) => ({ count, endsAtMs: T + leftS * 1000, atMs: T - ageMs });
const api = (current, { leftS = 0, cooldownS = 0 } = {}) =>
  rule.apiChainView({ current, timeout: leftS, cooldown: cooldownS }, T);

test("a page ahead of the API's count leads it, as when Torn showed the chain over while it ran on", () => {
  assert.equal(rule.pageLeadsApi(page(1250, 25), api(1240, { cooldownS: 7_440 }), T), true);
  assert.equal(rule.pageLeadsApi(page(1250, 25), api(1240, { leftS: 20 }), T), true);
});

test("a page behind the API's count does not lead: the page is the one behind", () => {
  assert.equal(rule.pageLeadsApi(page(1235, 240), api(1240, { leftS: 25 }), T), false);
});

test("a page report leads for 75 s, and no report never leads", () => {
  assert.equal(rule.pageLeadsApi(page(1250, 25, 75_000), api(1240, { cooldownS: 7_440 }), T), true);
  assert.equal(rule.pageLeadsApi(page(1250, 25, 76_000), api(1240, { cooldownS: 7_440 }), T), false);
  assert.equal(rule.pageLeadsApi(null, api(1240), T), false);
  assert.equal(rule.pageLeadsApi(undefined, api(1240), T), false);
});

test("at the API's count in a cooldown, a page clock the cooldown ends up to 5 s before or 45 s after is that cooldown counting down", () => {
  // The cooldown ends 30 s after the page's clock: the page counts it down.
  assert.equal(rule.pageLeadsApi(page(1240, 50), api(1240, { cooldownS: 80 }), T), false);
  assert.equal(rule.pageLeadsApi(page(1240, 50), api(1240, { cooldownS: 46 }), T), false, "4 s before");
  assert.equal(rule.pageLeadsApi(page(1240, 50), api(1240, { cooldownS: 94 }), T), false, "44 s after");
  // Outside that: another clock than the cooldown's.
  assert.equal(rule.pageLeadsApi(page(1240, 50), api(1240, { cooldownS: 45 }), T), true, "5 s before");
  assert.equal(rule.pageLeadsApi(page(1240, 50), api(1240, { cooldownS: 95 }), T), true, "45 s after");
  // A cooldown hours long while the page's clock runs: the API is behind.
  assert.equal(rule.pageLeadsApi(page(1240, 50), api(1240, { cooldownS: 7_440 }), T), true);
});

test("at the API's count with no cooldown, the page leads when its clock ends 15 s or more after the API's", () => {
  assert.equal(rule.pageLeadsApi(page(1240, 40), api(1240, { leftS: 25 }), T), true, "15 s after");
  assert.equal(rule.pageLeadsApi(page(1240, 39), api(1240, { leftS: 25 }), T), false, "14 s after");
  assert.equal(rule.pageLeadsApi(page(1240, 25), api(1240, { leftS: 25 }), T), false, "the same clock");
  assert.equal(rule.pageLeadsApi(page(1240, 40), api(1240), T), true, "the API shows no clock");
});

// ── A page report as sent ───────────────────────────────────────────────

test("a page report: the count, and Torn's end or the seconds left, as a running clock", () => {
  assert.deepEqual(rule.parsePageReport({ count: 1250, endsAt: (T + 25_000) / 1000 }, T), { count: 1250, endsAtMs: T + 25_000 });
  assert.deepEqual(rule.parsePageReport({ count: 1250, left: 25 }, T), { count: 1250, endsAtMs: T + 25_000 });
  assert.deepEqual(rule.parsePageReport({ count: "1250", left: "25" }, T), { count: 1250, endsAtMs: T + 25_000 });
  assert.deepEqual(rule.parsePageReport({ count: 1250, endsAt: (T + 310_000) / 1000 }, T), { count: 1250, endsAtMs: T + 310_000 });
  assert.deepEqual(rule.parsePageReport({ count: 1, left: 310 }, T), { count: 1, endsAtMs: T + 310_000 });
  assert.deepEqual(rule.parsePageReport({ count: 100_000, left: 1 }, T), { count: 100_000, endsAtMs: T + 1_000 });
});

test("no running clock or no good count is no report, and an end sent stands alone", () => {
  const bad = [
    { count: 1250, endsAt: T / 1000 }, { count: 1250, endsAt: (T - 1_000) / 1000 },
    { count: 1250, endsAt: (T + 311_000) / 1000 }, { count: 1250, endsAt: "abc" },
    { count: 1250, endsAt: T / 1000, left: 25 },
    { count: 1250, left: 0 }, { count: 1250, left: -1 }, { count: 1250, left: 311 }, { count: 1250, left: "abc" },
    { count: 0, left: 25 }, { count: 1.5, left: 25 }, { count: 100_001, left: 25 }, { count: "x", left: 25 },
    { left: 25 }, { count: 1250 }, {}, null, undefined, "1250",
  ];
  bad.forEach((b, i) => assert.equal(rule.parsePageReport(b, T), null, "case " + i));
});

// ── Who may report ──────────────────────────────────────────────────────

test("only a member on the war's roster reports: a sign-in outlives a member's time in the faction", () => {
  const war = { ourMemberIds: ["1000001", "1000002"] };
  assert.equal(rule.onWarRoster(war, "1000001"), true);
  assert.equal(rule.onWarRoster(war, 1000002), true, "an id as a number");
  assert.equal(rule.onWarRoster(war, "1000099"), false, "a member who has left, whose page shows another faction's chain");
  assert.equal(rule.onWarRoster({ ourMemberIds: [] }, "1000001"), false, "no roster, no one on it");
  assert.equal(rule.onWarRoster({}, "1000001"), false);
  assert.equal(rule.onWarRoster(null, "1000001"), false);
  assert.equal(rule.onWarRoster(war, undefined), false);
});

// ── The route ───────────────────────────────────────────────────────────

const ROUTES = readFileSync(new URL("./routes.js", import.meta.url), "utf8");

test("the route: POST /api/chain-page, signed in, the report checked, for the faction's own war, from its roster", () => {
  const i = ROUTES.indexOf('router.post("/api/chain-page", requireAuth,');
  assert.ok(i > 0, "no route");
  const body = ROUTES.slice(i, ROUTES.indexOf("\n});", i));
  assert.match(body, /parsePageReport\(req\.body \|\| \{\}, Date\.now\(\)\)/);
  assert.match(body, /status\(400\)/);
  assert.match(body, /const warId = `war_\$\{factionId\}`;/);
  assert.match(body, /status\(404\)/);
  assert.match(body, /recordPageChain\(warId, report, playerId\)/);
  const refuse = body.slice(body.indexOf("if (!onWarRoster(war, playerId)) {"), body.indexOf("\n  }\n", body.indexOf("onWarRoster(")));
  assert.match(refuse, /^if \(!onWarRoster\(war, playerId\)\) \{\n[\s\S]*return res\.status\(403\)/);
  assert.ok(body.indexOf("onWarRoster(") < body.indexOf("recordPageChain("), "the roster is checked before the report is held");
  assert.match(ROUTES, /^import \{[^}]*\bonWarRoster\b[^}]*\} from "\.\/chain-alert-rule\.js";$/m);
  assert.match(ROUTES, /^import \{[^}]*\brecordPageChain\b[^}]*\} from "\.\/chain-monitor\.js";$/m);
  assert.match(ROUTES, /^import \{[^}]*\bparsePageReport\b[^}]*\} from "\.\/chain-alert-rule\.js";$/m);
});
