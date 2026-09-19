// The admin gate on /war and /payouts.
//
// An admin with "War Leader" was refused. The roles are configured — faction
// 42055 lists leader, co-leader, admin leader, war leader and banker under BOTH
// adminRoles and broadcastRoles — and the comparison is a lowercase exact
// match, so the position in the token cannot have been any of them.
//
// The token carries factionPosition straight from Torn's
// user/?selections=basic,profile as `data.faction?.position ?? ""`. A key whose
// scope returns no faction block therefore yields an EMPTY position, which
// matches no role and is refused with "Admin role required" — a message about
// roles for what is actually a key-scope problem. The owner never sees it: they
// are isDev and skip the check.
//
// Three copies of this gate existed, which is how they drifted out of anyone's
// attention. One now, and it reports what it actually saw.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SRC = fs.readFileSync(new URL("./routes.js", import.meta.url), "utf8");
function fn(name) {
  const i = SRC.indexOf("function " + name + "(");
  assert.ok(i >= 0, "not in routes.js: " + name);
  let p = SRC.indexOf("(", i), depth = 0, k = p;
  for (; k < SRC.length; k++) {
    if (SRC[k] === "(") depth++;
    else if (SRC[k] === ")" && --depth === 0) break;
  }
  const o = SRC.indexOf("{", k);
  let d = 0;
  for (let j = o; j < SRC.length; j++) {
    if (SRC[j] === "{") d++;
    else if (SRC[j] === "}" && --d === 0) return SRC.slice(i, j + 1);
  }
  throw new Error("unbalanced braces in " + name);
}
const ROLES = ["leader", "co-leader", "admin leader", "war leader", "banker"];
function gate(user) {
  const box = { console: { log() {} } };
  vm.createContext(box);
  vm.runInContext(fn("warAdminDenial") + "\nglobalThis.deny = warAdminDenial;", box);
  return box.deny(user, ROLES);
}

test("a configured role is allowed", () => {
  for (const pos of ["War Leader", "Admin Leader", "Leader", "Banker"]) {
    assert.equal(gate({ playerId: "1", factionPosition: pos }), null, pos);
  }
});

test("case and padding do not matter", () => {
  // Torn's wording is not ours to control.
  assert.equal(gate({ playerId: "1", factionPosition: "  WAR LEADER " }), null);
});

test("a refusal names the position it actually saw", () => {
  // This is the whole point. A faction renamed a position to "Nihilus" and the
  // holder was told "Admin role required" — so they went looking for a
  // permission setting, when the answer was that their position was not on the
  // list. The message has to close that gap without anyone reading a log.
  const d = gate({ playerId: "1", factionPosition: "Nihilus" });
  assert.ok(d, "an unlisted position got in");
  assert.match(d.error, /Nihilus/, "did not say which position: " + d.error);
});

test("and names what would be accepted", () => {
  const d = gate({ playerId: "1", factionPosition: "Nihilus" });
  assert.match(d.error, /war leader/i, "did not say what IS allowed: " + d.error);
});

test("an ordinary member is refused too, same way", () => {
  const d = gate({ playerId: "1", factionPosition: "Soldier" });
  assert.ok(d);
  assert.match(d.error, /Soldier/);
});

test("an EMPTY position is refused as a key problem, not a role one", () => {
  // The reported case. "Admin role required" sent an admin hunting a
  // permissions setting that was already correct.
  const d = gate({ playerId: "1", factionPosition: "" });
  assert.ok(d, "an empty position got in");
  assert.match(d.error, /key/i, "still blaming the role: " + d.error);
});

test("a missing position is treated the same as an empty one", () => {
  for (const u of [{ playerId: "1" }, { playerId: "1", factionPosition: null }]) {
    assert.match(gate(u).error, /key/i);
  }
});

test("the owner is let through regardless", () => {
  assert.equal(gate({ playerId: "137558", factionPosition: "" }), null);
});
