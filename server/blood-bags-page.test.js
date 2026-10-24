// The /bloodbags page: its named functions run in vm, the way hof-page.test.mjs
// runs /hof's, with document, localStorage and fetch stubbed. Every number comes
// from /api/bloodbags; these pin how the page words, links and loads it.
// Spec: docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Torn City Time is UTC. Running in New York makes any slip into local time show.
process.env.TZ = "America/New_York";

const PAGE = readFileSync(new URL("./pages/bloodbags.html", import.meta.url), "utf8");
function fn(name) {
  const i = PAGE.indexOf("function " + name + "(");
  assert.ok(i >= 0, "not in bloodbags.html: " + name);
  let k = PAGE.indexOf("(", i), depth = 0;
  for (; k < PAGE.length; k++) {
    if (PAGE[k] === "(") depth++;
    else if (PAGE[k] === ")" && --depth === 0) break;
  }
  const o = PAGE.indexOf("{", k);
  let d = 0;
  for (let j = o; j < PAGE.length; j++) {
    if (PAGE[j] === "{") d++;
    else if (PAGE[j] === "}" && --d === 0) return PAGE.slice(i, j + 1);
  }
  throw new Error("unbalanced braces in " + name);
}
const NAMES = ["$", "esc", "sep", "signed", "pad2", "monthYear", "dayMonth", "windowLabel", "typeLabel", "apiPath",
  "tct", "ago", "updatedLine", "noteText", "youLine", "tile", "overviewHtml", "listHtml", "options", "render",
  "token", "setToken", "showSignin", "showBoard", "load", "signIn"];
const CONSTS = PAGE.match(/^var [A-Z_]+ = .*;$/gm);

// A page whose document has one plain object per element id.
function page({ stored = {}, fetchImpl } = {}) {
  const els = {};
  const document = { getElementById: (id) => els[id] || (els[id] = { id, className: "", textContent: "", innerHTML: "", value: "", disabled: false }) };
  const localStorage = {
    getItem: (k) => (k in stored ? stored[k] : null),
    setItem: (k, v) => { stored[k] = String(v); },
    removeItem: (k) => { delete stored[k]; },
  };
  const box = { document, localStorage, fetch: fetchImpl, Date };
  vm.createContext(box);
  vm.runInContext([...CONSTS, ...NAMES.map(fn), `globalThis.P = { ${NAMES.join(", ")}, STATE };`].join("\n"), box);
  return { P: box.P, els, stored };
}
const flush = () => new Promise((r) => setImmediate(r));
const answer = (status, body) => Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) });

const BOARD = {
  window: "7d", type: "all", fromSec: 0, toSec: 0,
  overview: { given: 1490, used: 855, usedInWars: 612, net: 635, members: 56 },
  topGiven: [{ rank: 1, playerId: "1", name: "Ann", value: 136 }],
  topNet: [{ rank: 1, playerId: "1", name: "Ann", value: 103 }],
  wall: [{ rank: 1, playerId: "2", name: "Bob", value: -69 }],
  you: { rank: 14, of: 95, given: 12, used: 4, usedInWars: 1, net: 9 },
  updatedAt: Date.UTC(2026, 9, 24, 3, 5), reachSec: Date.UTC(2025, 9, 24) / 1000, backfillDone: true, liveWar: null,
  windows: ["24h", "7d", "30d", "90d", "all"], types: ["all", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"], rosterStale: false,
};

test("a blood type goes into the link encoded, so A+ never arrives as A and a space", () => {
  const { P } = page();
  assert.equal(P.apiPath("7d", "A+"), "/api/bloodbags?window=7d&type=A%2B");
  assert.equal(P.apiPath("all", "all"), "/api/bloodbags?window=all&type=all");
});

test("each list links names to their Torn profile, escaped, with the right sign", () => {
  const { P } = page();
  const given = P.listHtml([{ rank: 1, playerId: "1001", name: "<b>Ash</b>", value: 1234 }], "given");
  assert.ok(given.includes('href="https://www.torn.com/profiles.php?XID=1001"'));
  assert.ok(given.includes("&lt;b&gt;Ash&lt;/b&gt;"));
  assert.ok(given.includes('<span class="val">1,234</span>'));
  assert.ok(P.listHtml([{ rank: 1, playerId: "1", name: "A", value: 4 }], "net").includes(">+4<"));
  assert.ok(P.listHtml([{ rank: 1, playerId: "1", name: "A", value: -3 }], "wall").includes(">-3<"));
  assert.ok(P.listHtml([], "wall").includes("Nobody is below zero."));
  assert.ok(P.listHtml([], "given").includes("Nobody yet."));
});

test("the viewer's line, ranked, unranked and empty", () => {
  const { P } = page();
  assert.equal(P.youLine({ rank: 14, of: 95, given: 12, used: 4, usedInWars: 1, net: 9 }),
    "You: #14 of 95 - 12 given, 4 used (1 during wars), net +9");
  assert.equal(P.youLine({ rank: null, of: 95, given: 0, used: 3, usedInWars: 0, net: -3 }),
    "You: 0 given, 3 used (0 during wars), net -3");
  assert.equal(P.youLine(null), "You: no blood bags given or used in this window");
});

test("the update time is in Torn City Time, whatever the viewer's zone", () => {
  const { P } = page();
  const at = Date.UTC(2026, 9, 24, 3, 5);
  assert.equal(P.updatedLine(at, at + 12 * 60000), "Latest update: 12 minutes ago (03:05 TCT)");
  assert.equal(P.updatedLine(at, at + 30000), "Latest update: just now (03:05 TCT)");
  assert.equal(P.updatedLine(at, at + 61 * 60000), "Latest update: 1 hour ago (03:05 TCT)");
  assert.equal(P.updatedLine(at, at + 50 * 3600000), "Latest update: 2 days ago (03:05 TCT)");
  assert.equal(P.updatedLine(null, at), "No update yet.");
});

test("all time names the month the history reaches back to", () => {
  const { P } = page();
  assert.equal(P.windowLabel("all", Date.UTC(2025, 9, 24) / 1000), "All time (since Oct 2025)");
  assert.equal(P.windowLabel("all", null), "All time");
  assert.equal(P.windowLabel("24h", null), "Past 24 hours");
  assert.equal(P.typeLabel("all"), "All types");
});

test("the note says when there is no data yet, and how far back the history reaches while it fills in", () => {
  const { P } = page();
  const reach = Date.UTC(2026, 9, 20) / 1000;
  assert.equal(P.noteText({ updatedAt: null }), "No data yet: the first update runs within the hour.");
  assert.equal(P.noteText({ updatedAt: 1, backfillDone: false, reachSec: reach, liveWar: null }),
    "History so far reaches back to 20 Oct; the rest of the year is still being filled in.");
  assert.equal(P.noteText({ updatedAt: 1, backfillDone: false, reachSec: reach, liveWar: { id: 1 } }),
    "History so far reaches back to 20 Oct; the rest of the year is still being filled in, slowly while the ranked war is on.");
  assert.equal(P.noteText({ updatedAt: 1, backfillDone: true, reachSec: reach }), "");
});

test("the overview shows the war part of use and a signed net", () => {
  const { P } = page();
  const html = P.overviewHtml(BOARD.overview);
  for (const bit of [">1,490<", ">855<", "612 during wars", ">+635<", ">56<"]) assert.ok(html.includes(bit), bit);
});

test("signing in sends the key to /api/auth as bloodbags and keeps only the token", async () => {
  const calls = [];
  const { P, els, stored } = page({
    fetchImpl: (url, init) => {
      calls.push({ url, init });
      return url === "/api/auth" ? answer(200, { token: "tok-1" }) : answer(200, BOARD);
    },
  });
  P.$("key").value = "  abcdEFGHijklMNOP  ";
  P.signIn({ preventDefault() {} });
  await flush(); await flush();
  assert.deepEqual(JSON.parse(calls[0].init.body), { apiKey: "abcdEFGHijklMNOP", scriptName: "bloodbags" });
  assert.equal(stored.bloodbags_token, "tok-1");
  assert.equal(els.key.value, "");
  assert.ok(!JSON.stringify(stored).includes("abcdEFGHijklMNOP"), "the key itself is never stored");
  assert.equal(calls[1].url, "/api/bloodbags?window=7d&type=all");
  assert.equal(calls[1].init.headers.Authorization, "Bearer tok-1");
  assert.equal(els.you.textContent, "You: #14 of 95 - 12 given, 4 used (1 during wars), net +9");
  assert.ok(els.win.innerHTML.includes("All time (since Oct 2025)"));
});

test("a refused key from another faction gets the board's own message", async () => {
  const { P, els } = page({ fetchImpl: () => answer(403, { error: "Access denied. FactionOps is currently restricted to faction 42055." }) });
  P.$("key").value = "k";
  P.signIn({ preventDefault() {} });
  await flush(); await flush();
  assert.equal(els["signin-msg"].textContent, "This board is for Dead Fragment members.");
});

test("an expired token shows the sign-in again; a 403 clears it and says who the board is for", async () => {
  const first = page({ stored: { bloodbags_token: "old" }, fetchImpl: () => answer(401, { error: "Invalid or expired token" }) });
  first.P.load();
  await flush(); await flush();
  assert.equal(first.stored.bloodbags_token, undefined);
  assert.equal(first.els.signin.className, "card signin");
  assert.equal(first.els["signin-msg"].textContent, "That session has expired. Sign in again.");

  const second = page({ stored: { bloodbags_token: "t" }, fetchImpl: () => answer(403, { error: "This board is for Dead Fragment members." }) });
  second.P.load();
  await flush(); await flush();
  assert.equal(second.stored.bloodbags_token, undefined);
  assert.equal(second.els["signin-msg"].textContent, "This board is for Dead Fragment members.");
});

test("the page is plain ASCII, asks for the key in a text field, and serves through blood-bags-page.js", async () => {
  assert.ok(/^[\x00-\x7F]*$/.test(PAGE), "no curly quotes or other non-ASCII characters");
  assert.match(PAGE, /<input id="key" type="text"/);
  const { renderBloodBagsPage } = await import("./blood-bags-page.js");
  assert.equal(renderBloodBagsPage(), PAGE);
});

// ── review fixes ────────────────────────────────────────────────────────────
test("the note says when the first update failed, and when the member list may be out of date", () => {
  const { P } = page();
  const reach = Date.UTC(2026, 9, 20) / 1000;
  assert.equal(P.noteText({ updatedAt: null, lastPollFailed: true }),
    "No data yet: the last update failed, and it tries again every hour.");
  assert.equal(P.noteText({ updatedAt: 1, backfillDone: true, rosterStale: true }),
    "The member list could not be refreshed just now, so it may be out of date.");
  assert.equal(P.noteText({ updatedAt: 1, backfillDone: false, reachSec: reach, liveWar: null, rosterStale: true }),
    "History so far reaches back to 20 Oct; the rest of the year is still being filled in. " +
    "The member list could not be refreshed just now, so it may be out of date.");
});

test("a slow answer for an earlier choice never replaces the board for a later one", async () => {
  const pending = [];
  const { P, els } = page({
    stored: { bloodbags_token: "t" },
    fetchImpl: (url) => new Promise((resolve, reject) => pending.push({ url, resolve, reject })),
  });
  const given = (n, window) => ({ ...BOARD, window, overview: { ...BOARD.overview, given: n } });
  P.STATE.win = "24h"; P.load();
  P.STATE.win = "all"; P.load();
  assert.equal(pending.length, 2);
  pending[1].resolve(answer(200, given(2, "all")));
  await flush(); await flush();
  pending[0].resolve(answer(200, given(1, "24h")));
  await flush(); await flush();
  assert.equal(P.STATE.data.window, "all");
  assert.match(els.tiles.innerHTML, /Given<\/div><div class="value">2</);

  // A stale failure says nothing either.
  P.STATE.win = "7d"; P.load();
  P.STATE.win = "30d"; P.load();
  pending[3].resolve(answer(200, given(3, "30d")));
  await flush(); await flush();
  pending[2].reject(new Error("offline"));
  await flush(); await flush();
  assert.equal(P.STATE.data.window, "30d");
  assert.doesNotMatch(els.lede.textContent, /Could not/);
});

test("the key field asks for no input mode browsers do not know", () => {
  const known = ["none", "text", "decimal", "numeric", "tel", "search", "email", "url"];
  for (const m of PAGE.matchAll(/inputmode="([^"]*)"/g)) assert.ok(known.includes(m[1]), m[1]);
});
