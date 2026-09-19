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
    _ffsLastPollStatus: {},
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
// A real capture from the war page, hospitalised member, chip in place:
//   class   = "status left hospital prevColumn___UOKmY status___BLAOt not-ok"
//   hasChip = true,  text = "00:00:01"
//
// Two things that settles. React keeps its OWN class on that cell — we only
// ever replace innerHTML, so the class is untouched by us and stays current —
// and React does NOT wipe our chip when the member's state changes. So the
// cell's text is always ours and can never be the signal; the class is always
// Torn's, and is. The first attempt read the text and could therefore never
// have fired, which is exactly what the reader saw: still frozen on zero.
//
// Release is still decided on a POSITIVE reading. The local countdown must
// never decide it — a target can extend hospital defensively (ipecac, a wrong
// blood bag SETS the timer to 60-90 min) and our cached `until` is then the old
// short time, so releasing on it flashes a still-hospitalised target as
// attackable. Torn's class cannot be stale that way.
function nativeCheck() {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(fn("ffs_nativeSaysReleased") + "\nglobalThis.chk = ffs_nativeSaysReleased;", sandbox);
  return sandbox.chk;
}
const cell = (cls) => ({ className: cls });
const HOSP = "status left hospital prevColumn___UOKmY status___BLAOt not-ok";

test("the captured hospital cell is not a release", () => {
  assert.equal(nativeCheck()(cell(HOSP)), false);
});

test("not-ok blocks a release on its own", () => {
  // Torn's own marker for "cannot be attacked" — whatever else the cell says,
  // that settles it.
  assert.equal(nativeCheck()(cell("status left okay status___BLAOt not-ok")), false);
});

test("not-ok is matched as a class, not as a substring", () => {
  // "not-ok" CONTAINS "ok". A substring test would read the captured hospital
  // cell as okay and release a hospitalised target — the precise failure the
  // clamp exists to prevent.
  const chk = nativeCheck();
  assert.equal(chk(cell(HOSP)), false);
  assert.equal(chk(cell("status left ok status___BLAOt")), true);
});

test("jail, travel and federal are not releases", () => {
  const chk = nativeCheck();
  for (const s of ["jail", "traveling", "travelling", "abroad", "federal"]) {
    assert.equal(chk(cell("status left " + s + " status___X not-ok")), false, s);
  }
});

test("a class with no status token is no opinion", () => {
  // Mid-render, or an element that is not the status cell. Saying nothing
  // leaves the poll in charge, which is the safe direction.
  const chk = nativeCheck();
  assert.equal(chk(cell("")), false);
  assert.equal(chk(cell("prevColumn___UOKmY")), false);
  assert.equal(chk(cell(null)), false);
});

test("a status cell caught mid-render is NOT a release", () => {
  // The real reason the rule cannot be "nothing is blocking it". React
  // re-renders these cells constantly — that is why our chip keeps getting
  // wiped — and a cell caught with only its hashed class carries no blocker
  // either. Under absence-of-blockers that reads as free, which would release a
  // hospitalised target: the exact failure the clamp exists to prevent, arrived
  // by a different road.
  const chk = nativeCheck();
  assert.equal(chk(cell("status___BLAOt")), false);
  assert.equal(chk(cell("status left status___BLAOt")), false);
  assert.equal(chk(cell("status left prevColumn___UOKmY status___BLAOt")), false);
});

test("a missing element is no opinion", () => {
  assert.equal(nativeCheck()(null), false);
});

test("the poll's own answer is recorded verbatim for the diag", () => {
  // Instrumentation, but it rides inside ffs_recordMemberTravel, so it is worth
  // knowing it records what the poll said rather than what we concluded.
  const s = recorder();
  s._ffsLastPollStatus = {};
  s.rec({ id: "3", status: { state: "Hospital", until: 1789811536, description: "In hospital" } });
  assert.equal(s._ffsLastPollStatus["3"].state, "Hospital");
  assert.equal(s._ffsLastPollStatus["3"].until, 1789811536);
});

test("recording the poll does not disturb the release stamp", () => {
  const s = recorder({ hospital: { "4": 111 }, hospitalState: { "4": "Hospital" } });
  s._ffsLastPollStatus = {};
  s.rec({ id: "4", status: { state: "Okay", description: "Okay" } });
  assert.equal(s._ffsJustReleasedAt["4"], 1_000_000);
  assert.equal(s._ffsLastPollStatus["4"].state, "Okay");
});

// ── Measured, not inferred ─────────────────────────────────────
// The attackable side finally captured from the war page:
//   "status left okay prevColumn___UOKmY status___BLAOt ok"
// So Torn marks a hittable member with BOTH `okay` and `ok`, and drops
// `not-ok`. That turns the release rule from "nothing is blocking it" into a
// positive reading, which also disposes of the other sample in the same
// capture — "status left status___BLAOt tab___uGxm5", a tab rather than a
// member's status, which absence-of-blockers alone would have read as free.
const OK_CELL  = "status left okay prevColumn___UOKmY status___BLAOt ok";
const TAB_CELL = "status left status___BLAOt tab___uGxm5";

test("the captured attackable cell is a release", () => {
  assert.equal(nativeCheck()(cell(OK_CELL)), true);
});

test("a status cell that says nothing about okay is not a release", () => {
  // Captured in the same payload, and it is not a member's status at all.
  assert.equal(nativeCheck()(cell(TAB_CELL)), false);
});

test("okay alone and ok alone both count", () => {
  const chk = nativeCheck();
  assert.equal(chk(cell("status left okay status___BLAOt")), true);
  assert.equal(chk(cell("status left ok status___BLAOt")), true);
});
