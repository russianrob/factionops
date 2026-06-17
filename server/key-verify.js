// Periodically verify each pooled key's access level + faction selections
// (Torn key/info) and record them on the pool opt. The per-purpose key
// router (store.getPooledKeysForFaction with a requiredSelection) then skips
// keys that can't serve a given call — e.g. a Custom key with only
// [timestamp, basic, lookup] is routed away from `chain` instead of failing
// every poll with code 16 — while staying available for calls it CAN serve
// (e.g. enemy-profile, which needs no faction selection).
//
// Non-destructive: it never disables a key, it only records what each can do.

import * as store from "./store.js";
import { fetchKeyInfo } from "./torn-api.js";

/** Verify + record access for every enabled pool key. Rate-limited. */
export async function verifyPoolKeyAccess() {
  const keys = store.getAllPooledKeys();
  let ok = 0, fail = 0;
  for (const { playerId, factionId, key } of keys) {
    try {
      const info = await fetchKeyInfo(key);
      store.setKeyPoolingOpt(playerId, true, factionId, {
        accessLevel: info.accessLevel,
        factionSelections: info.factionSelections,
      });
      ok++;
    } catch (_) {
      // Leave the opt as-is (don't disable on a transient failure); the
      // next sweep retries. An unverified key stays usable until proven otherwise.
      fail++;
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  console.log(
    `[key-verify] recorded access for ${ok}/${keys.length} pool key(s)` +
    (fail ? `, ${fail} failed (will retry next sweep)` : ""),
  );
  return { ok, fail, total: keys.length };
}
