// Where a war row sits once its hospital timer ends.
//
// Reported: "when people med out and reaches 0 they get sent to the bottom of
// the list instead the top". A target who has just become attackable is the
// most time-critical one on the page — they are hittable NOW, and whoever sees
// it first gets the hit. The sort put them wherever their FFS score happened to
// fall, which for an unscored member is dead last: the comparator sinks a null
// score with `return 1`.
//
// Functions are lifted out of the shipping userscript and run in a vm, so what
// is tested is what ships.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SRC = fs.readFileSync(new URL("./public/scripts/ffs-banner-estimates-beta.user.js", import.meta.url), "utf8");

function fn(name) {
  const i = SRC.indexOf("function " + name + "(");
  assert.ok(i >= 0, "not in the shipping script: " + name);
  const o = SRC.indexOf("{", i);
  let d = 0;
  for (let j = o; j < SRC.length; j++) {
    if (SRC[j] === "{") d++;
    else if (SRC[j] === "}" && --d === 0) return SRC.slice(i, j + 1);
  }
  throw new Error("unbalanced braces in " + name);
}
function v(name) {
  const m = SRC.match(new RegExp("^[ \\t]*const[ \\t]+" + name + "[ \\t]*=.*$", "m"));
  assert.ok(m, "const not found: " + name);
  return m[0].trim();
}

/** A war row carrying nothing but a player id. */
function row(pid) {
  const r = {
    nodeType: 1, _pid: pid, classList: { contains: () => false },
    nextElementSibling: null,
    querySelector(sel) {
      if (sel.includes("XID=")) return { href: "https://www.torn.com/profiles.php?XID=" + pid };
      return null;
    },
  };
  return r;
}

/**
 * Sort a list of rows and report the resulting pid order.
 * `state` seeds the module-scope maps the sort reads.
 */
function order(pids, state = {}) {
  const rows = pids.map(row);
  const parent = { children: [], appendChild(f) { this.children = f._kids.slice(); } };
  rows.forEach((r) => { r.parentElement = parent; });
  parent.children = rows.slice();

  const sandbox = {
    location: { search: "?type=1", hash: "" },          // a war view
    document: { createDocumentFragment: () => ({ _kids: [], appendChild(n) { this._kids.push(n); } }) },
    WeakMap,
    _ffsMemberCountdowns: state.countdowns || {},
    _ffsMemberHospitalUntil: state.hospital || {},
    _ffsMemberHospitalState: state.hospitalState || {},
    _ffsJustReleasedAt: state.released || {},
    _ffsScoreCache: state.scores || {},
    _ffsPureStatSort: false,
    _ffsAppliedDesc: true,
    _ffsSortSignatures: new WeakMap(),
    Date: { now: () => state.now || 1_000_000 },
  };
  vm.createContext(sandbox);
  vm.runInContext([
    v("FFS_JUST_RELEASED_MS"),
    fn("ffs_isWarContext"), fn("ffs_rowGroup"), fn("ffs_hospKey"),
    fn("ffs_unreachKey"), fn("ffs_applyWarSort"),
    "ffs_applyWarSort(ROWS);",
  ].join("\n"), Object.assign(sandbox, { ROWS: rows }), { timeout: 5000 });

  return parent.children.map((r) => r._pid);
}

const NOW = 1_000_000;

test("someone whose hospital timer just ended goes to the top", () => {
  // "1" is out of hospital as of two seconds ago. "2" and "3" are ordinary
  // attackable members with good scores; "4" is still hospitalised.
  const got = order(["2", "3", "1", "4"], {
    now: NOW,
    released: { "1": NOW - 2_000 },
    scores: { "2": 900, "3": 800 },
    hospital: { "4": 99_999_999 },
  });
  assert.equal(got[0], "1", "the freshly attackable target must lead: " + got.join(","));
});

test("a released member with no FFS score still goes to the top", () => {
  // This is the reported case exactly. An unscored member hits `return 1` in
  // the attackable comparator and sinks to the very bottom.
  const got = order(["2", "3", "1"], {
    now: NOW,
    released: { "1": NOW - 1_000 },
    scores: { "2": 900, "3": 800 },      // "1" deliberately absent
  });
  assert.equal(got[0], "1", "an unscored fresh target sank: " + got.join(","));
});

test("two fresh releases put the most recent first", () => {
  const got = order(["1", "2"], {
    now: NOW,
    released: { "1": NOW - 30_000, "2": NOW - 1_000 },
  });
  assert.deepEqual(got, ["2", "1"]);
});

test("the pin wears off, so the top does not fill up with stale targets", () => {
  const got = order(["2", "1"], {
    now: NOW,
    released: { "1": NOW - 10 * 60_000 },   // ten minutes ago
    scores: { "2": 900 },
  });
  assert.equal(got[0], "2", "a long-released member must sort normally again: " + got.join(","));
});

test("a member who went back into hospital is not pinned to the top", () => {
  // Release then re-hospitalise: hospital wins, or the top of the list shows a
  // target that cannot be hit.
  const got = order(["2", "1"], {
    now: NOW,
    released: { "1": NOW - 2_000 },
    hospital: { "1": NOW / 1000 + 600 },
    scores: { "2": 900 },
  });
  assert.equal(got[0], "2", "a re-hospitalised member stayed pinned: " + got.join(","));
});

test("hospital still sorts by soonest release, under the attackable ones", () => {
  // The existing behaviour has to survive.
  // Numeric ids: the sort reads the pid out of the profile href with
  // /XID=(\d+)/, so letters here would make every pid null and the test would
  // "fail" against perfectly good code.
  const got = order(["10", "11", "12"], {
    now: NOW,
    scores: { "10": 500 },
    hospital: { "11": 2_000, "12": 1_000 },
  });
  assert.deepEqual(got, ["10", "12", "11"]);
});

test("travel and jail stay last", () => {
  const got = order(["20", "21", "22"], {
    now: NOW,
    scores: { "22": 100 },
    countdowns: { "20": 5_000 },
    hospital: { "21": 1_000 },
  });
  assert.deepEqual(got, ["22", "21", "20"]);
});

// ── Who gets stamped as just-released ──────────────────────────
// The pin is only earned by crossing OUT of hospital. Without that edge check
// every poll stamps every attackable member, so the whole list lands in the
// pinned group and the FFS-score ordering it is supposed to sit above stops
// meaning anything. Seeding the maps by hand cannot catch that — this runs the
// recorder the poll actually calls.
function recorder(state = {}) {
  const sandbox = {
    _ffsMemberCountdowns: state.countdowns || {},
    _ffsMemberAbbr: {}, _ffsMemberReturning: {},
    _ffsMemberHospitalUntil: state.hospital || {},
    _ffsMemberHospitalState: state.hospitalState || {},
    _ffsJustReleasedAt: state.released || {},
    ffs_fetchFlightForMember: () => {},
    Date: { now: () => state.now || 1_000_000 },
    isFinite, parseInt, String, Number,
  };
  vm.createContext(sandbox);
  vm.runInContext(fn("ffs_recordMemberTravel") + "\nglobalThis.rec = ffs_recordMemberTravel;", sandbox);
  return sandbox;
}

test("leaving hospital earns the pin", () => {
  const s = recorder({ hospital: { "7": 12345 }, hospitalState: { "7": "Hospital" } });
  s.rec({ id: "7", status: { state: "Okay", description: "Okay" } });
  assert.equal(s._ffsJustReleasedAt["7"], 1_000_000);
  assert.equal(s._ffsMemberHospitalUntil["7"], undefined, "and the hospital entry goes");
});

test("a member who was never in hospital is not pinned", () => {
  // Every poll reports every healthy member. If that stamped them, the pinned
  // group would be the whole faction.
  const s = recorder();
  s.rec({ id: "8", status: { state: "Okay", description: "Okay" } });
  assert.equal(s._ffsJustReleasedAt["8"], undefined, "an ordinary member claimed the top");
});

test("a healthy member polled repeatedly is still never pinned", () => {
  const s = recorder();
  for (let i = 0; i < 5; i++) s.rec({ id: "9", status: { state: "Okay", description: "Okay" } });
  assert.equal(s._ffsJustReleasedAt["9"], undefined);
});

test("still being in hospital does not earn the pin", () => {
  const s = recorder({ hospital: { "5": 12345 }, hospitalState: { "5": "Hospital" } });
  s.rec({ id: "5", status: { state: "Hospital", until: 99999, description: "In hospital" } });
  assert.equal(s._ffsJustReleasedAt["5"], undefined);
  assert.equal(s._ffsMemberHospitalUntil["5"], 99999, "the timer must still be tracked");
});

test("coming out of jail earns the pin too", () => {
  // Jail is tracked in the same map, and leaving it makes them hittable.
  const s = recorder({ hospital: { "6": 12345 }, hospitalState: { "6": "Jail" } });
  s.rec({ id: "6", status: { state: "Okay", description: "Okay" } });
  assert.equal(s._ffsJustReleasedAt["6"], 1_000_000);
});

// ── Who decides a target is out ────────────────────────────────
// Reported: "it stays on 0 when it should be instant okay". By design, release
// is decided ONLY by the API poll — the local countdown must never decide it,
// because a target can extend hospital defensively (ipecac, wrong blood bag)
// and our cached `until` is then the OLD short time. Releasing on the countdown
// flashes a still-hospitalised target as attackable, which is worse than a slow
// chip.
//
// Torn's own cell is a third thing, and it is neither of those: it is not our
// countdown and it cannot be stale. React re-renders the status cell when a
// member's state changes, which wipes our chip — and a cell with no chip in it
// is holding Torn's current answer.
//
// The rule that keeps this safe: release on a POSITIVE reading only. An empty
// cell, a cell mid-render, a wording nobody anticipated — all mean "no opinion",
// and the poll stays in charge. The failure mode is the old slow behaviour,
// never a false release.
function nativeCheck() {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(fn("ffs_nativeSaysReleased") + "\nglobalThis.chk = ffs_nativeSaysReleased;", sandbox);
  return sandbox.chk;
}
const cell = (text, aria, hasChip) => ({
  textContent: text,
  getAttribute: () => aria || null,
  querySelector: (sel) => (hasChip && sel.includes("ffs-hosp") ? {} : null),
});

test("Torn saying the member is okay releases them", () => {
  const chk = nativeCheck();
  assert.equal(chk(cell("Okay")), true);
  assert.equal(chk(cell("", "Okay")), true, "aria alone is enough");
});

test("Torn still saying hospital does not release them", () => {
  const chk = nativeCheck();
  assert.equal(chk(cell("Hospital")), false);
  assert.equal(chk(cell("In hospital for 10 minutes")), false);
});

test("jail and travel are not releases either", () => {
  const chk = nativeCheck();
  assert.equal(chk(cell("Jail")), false);
  assert.equal(chk(cell("Traveling to Switzerland")), false);
  assert.equal(chk(cell("In a Swiss hospital")), false);
});

test("an empty cell is not a release", () => {
  // A cell caught mid-render says nothing, and "nothing" must never mean "out".
  const chk = nativeCheck();
  assert.equal(chk(cell("")), false);
  assert.equal(chk(cell("   ")), false);
  assert.equal(chk(cell(null)), false);
});

test("a wording nobody anticipated is not a release", () => {
  // The whole point of a positive list: an unknown word leaves the poll in
  // charge rather than guessing the member is free.
  const chk = nativeCheck();
  assert.equal(chk(cell("Federal")), false);
  assert.equal(chk(cell(" ")), false);
});

test("our own chip in the cell means Torn has not re-rendered it", () => {
  // With the chip present the cell is still OURS — Torn has not re-rendered,
  // so anything else in there is leftover, not an answer. The text is
  // deliberately "Okay" here: without the chip check this cell would read as a
  // release, which is the whole point of looking for the chip first.
  const chk = nativeCheck();
  assert.equal(chk(cell("Okay", null, true)), false);
  assert.equal(chk(cell("00:00:00", null, true)), false);
  // And the same cell WITHOUT our chip is Torn's answer, so it does release.
  assert.equal(chk(cell("Okay", null, false)), true);
});
