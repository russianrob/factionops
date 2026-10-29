// Chain reports (faction-history.js): one call per chain, kept forever. A
// chain Torn refuses as "Incorrect ID" (code 6) is older than any report it
// serves (Feb 2022), so it is kept as unavailable and never asked again; any
// other failure is asked again next run. Torn is stubbed and the store lives
// in a temp dir: DATA_DIR is read when faction-history.js loads, so it is set
// before the import.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "chainreports-"));
const fh = await import("./faction-history.js");

// Torn, by the chain asked for: 900002 is too old, 900001 fails once with an
// HTTP error, and every other chain has a report. Each call is paced (about
// a second apart), so the tests keep to four.
const asked = [];
const failOnce = new Set(["900001"]);
globalThis.fetch = async (url) => {
  const id = new URL(url).searchParams.get("id");
  asked.push(Number(id));
  if (id === "900002") return { ok: true, json: async () => ({ error: { code: 6, error: "Incorrect ID" } }) };
  if (failOnce.delete(id)) return { ok: false, status: 502, json: async () => ({}) };
  return { ok: true, json: async () => ({ chainreport: { id: Number(id),
    attackers: [{ id: 1000001, respect: { total: 12.5 }, attacks: { total: 3 } }] } }) };
};

const counts = (r) => ({ fetched: r.fetched, unavailable: r.unavailable, remaining: r.remaining });

test("a chain Torn refuses with code 6 is kept as unavailable and never asked again; any other failure is asked again", async () => {
  const chains = [{ id: 900003, start: 1700000300 }, { id: 900002, start: 1700000200 }, { id: 900001, start: 1700000100 }];
  const warned = [];
  const realWarn = console.warn;
  console.warn = (...a) => { warned.push(a.join(" ")); };
  try {
    const r1 = await fh.captureChainReports("TESTKEY", "1001", chains, { budget: 200 });
    assert.deepEqual(counts(r1), { fetched: 1, unavailable: 1, remaining: 1 });
    assert.deepEqual(asked, [900003, 900002, 900001]);
    const file = JSON.parse(readFileSync(path.join(process.env.DATA_DIR, "faction-chainreports-1001.json"), "utf8"));
    assert.deepEqual(Object.keys(file.chains), ["900003"]);
    assert.deepEqual(file.unavailable, { "900002": 1 });
    // One warning each: the refused chain says it will not be asked again,
    // the chain that failed for another reason does not.
    assert.equal(warned.filter((m) => m.includes("900002") && m.includes("not asked again")).length, 1);
    assert.equal(warned.filter((m) => m.includes("900001") && !m.includes("not asked again")).length, 1);

    // The next run asks only for the chain that failed for another reason.
    asked.length = 0;
    const r2 = await fh.captureChainReports("TESTKEY", "1001", chains, { budget: 200 });
    assert.deepEqual(counts(r2), { fetched: 1, unavailable: 0, remaining: 0 });
    assert.deepEqual(asked, [900001]);
  } finally {
    console.warn = realWarn;
  }
  // Lifetime respect counts the two reports; the refused chain is not one.
  assert.equal(fh.lifetimeChainRespect(fh.loadChainReports("1001")).chains, 2);
});

test("the run's summary counts real reports only", () => {
  assert.equal(fh.chainReportsSummary({ fetched: 0, unavailable: 200, remaining: 37 }), "chainreports +0, 200 unavailable, 37 left");
  assert.equal(fh.chainReportsSummary({ fetched: 3, unavailable: 0, remaining: 0 }), "chainreports +3");
  assert.equal(fh.chainReportsSummary({ fetched: 1, unavailable: 0, remaining: 2 }), "chainreports +1, 2 left");
});

test("the daily tick reports with it", () => {
  const S = readFileSync(new URL("./faction-history-schedule.js", import.meta.url), "utf8");
  assert.match(S, /summary\.push\(fh\.chainReportsSummary\(await fh\.captureChainReports\(key, factionId, chains, \{ budget: 200 \}\)\)\);/);
});
