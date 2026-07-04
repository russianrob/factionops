# Client-Sourced Chain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make factionops push the chain it already reads from the war-page DOM to the existing `/api/chain-update` endpoint, so the server skips its own Torn chain poll while members are on the war page — killing the heaviest pool-key draw (the `code 5` rate-limiting).

**Architecture:** One factionops change: add a throttled push inside `parseChainFromDOM` (the DOM path already running every 2s on the war page), mirroring the push that today lives only in the rarely-used API-poll fallback — but sourced from the DOM-parsed `state.chain`, so it costs zero Torn calls and works even when the user's key is maxed. The server side (`/api/chain-update` + the 8s skip gate + the source-agnostic alert pipeline) already exists and is unchanged.

**Tech Stack:** factionops userscript (`server/public/scripts/factionops.user.js`, directly edited, served via static mount); Node warboard server (verify only).

**Spec:** `docs/superpowers/specs/2026-07-04-client-sourced-chain-design.md`

## Global Constraints

- **The change is factionops-side only.** The server endpoint, `recordClientChainData` dedup, and the `CLIENT_CHAIN_FRESH_MS = 8000` skip already exist — do NOT modify them (verify only).
- **Zero Torn calls:** the push sources from `state.chain` (already filled by `parseChainFromDOM` from the DOM bar), NOT a Torn API request. Do not add any `api.torn.com` call.
- **Cadence:** push at most once per **~5 s** (under the 8 s server gate) **plus immediately when the chain count changes**. All members on the war page push (server dedups).
- **Version bump 5.1.39 → 5.1.40** in **all three** places, in sync: `@version` header (`factionops.user.js:4`), `SCRIPT_VERSION` const (`factionops.user.js:89`), and `factionops.meta.js` `@version`. Plain semver, no suffix. (Served baseline confirmed 5.1.39.)
- **factionops.user.js is served directly** from `server/public/scripts/` (static mount) — editing the file is the deploy; no pm2 restart. Clients pick it up on update (Tampermonkey auto-prompts via `meta.js`; PDA re-add).
- Mirror the existing authed-POST helper `postAction(endpoint, body)` (line ~4562) and the existing chain-update body shape (line ~7135). Commit with the warboard repo identity.

---

### Task 1: Add the DOM-sourced chain push + version bump

**Files:**
- Modify: `server/public/scripts/factionops.user.js`
- Modify: `server/public/scripts/factionops.meta.js`

**Interfaces (already in the file — consume, don't redefine):**
- `parseChainFromDOM()` @ line 7318 — reads the DOM chain bar into `state.chain.current` / `.max` / `.timeout`; `return true` on a successful read (bar found), `return false` if no bar. `state.chain.cooldown` is maintained elsewhere.
- `postAction(endpoint, body) -> Promise` @ line ~4562 — authed POST (`Bearer ${state.jwtToken}`), retries once.
- `deriveWarId()` — returns the current warId (used by other war-scoped POSTs, e.g. `/api/war-target` @ 6445).
- `state.jwtToken`, `state.chain`.

- [ ] **Step 1: Add the throttled push function** — in `factionops.user.js`, immediately BEFORE the `function parseChainFromDOM() {` line (7318), insert:

```javascript
    // Push the DOM-read chain to warboard so its chain-monitor gates its own
    // Torn poll (saves the shared pool-key budget). DOM-sourced = no Torn call,
    // so it works even when the user's key is rate-limited. Throttled to ~5s
    // (under the server's 8s freshness gate) + immediately on a count change.
    let _lastChainPushAt = 0;
    let _lastChainPushCurrent = -1;
    function pushChainToServer() {
        if (!state.jwtToken) return;
        const warId = deriveWarId();
        if (!warId) return;
        const c = state.chain;
        if (!c || typeof c.current !== 'number') return;
        const now = Date.now();
        const changed = c.current !== _lastChainPushCurrent;
        if (!changed && now - _lastChainPushAt < 5000) return;
        _lastChainPushAt = now;
        _lastChainPushCurrent = c.current;
        postAction('/api/chain-update', {
            warId,
            chainData: {
                current:  c.current || 0,
                timeout:  c.timeout || 0,
                cooldown: c.cooldown || 0,
                serverTimestamp: Math.floor(now / 1000),
            },
        }).catch(() => {});
    }
```

- [ ] **Step 2: Call it after a successful DOM parse** — in `parseChainFromDOM`, replace the trailing:

```javascript
        if (changed) {
        }

        return true;
    }
```
with:
```javascript
        if (changed) {
        }

        pushChainToServer();
        return true;
    }
```
(So the push only runs when the bar was found and parsed — the early `return false` paths never push.)

- [ ] **Step 3: Bump the version in all three spots**

- `factionops.user.js:4` — `// @version      5.1.39` → `// @version      5.1.40`
- `factionops.user.js:89` — `const SCRIPT_VERSION = '5.1.39';` → `const SCRIPT_VERSION = '5.1.40';`
- `factionops.meta.js` — the `// @version` line → `5.1.40`

- [ ] **Step 4: Syntax check**

Run: `node --check /opt/warboard/server/public/scripts/factionops.user.js`
Expected: no output (exit 0).

- [ ] **Step 5: Commit**

```bash
cd /opt/warboard
git add server/public/scripts/factionops.user.js server/public/scripts/factionops.meta.js
git commit -m "factionops 5.1.40: push DOM-read chain to /api/chain-update (server skips its Torn poll — rate-limit fix)"
```

---

### Task 2: Live verification (no code — controller runs after members update)

**Files:** none.

- [ ] **Step 1: Confirm the served version flipped**

```bash
curl -s https://tornwar.com/scripts/factionops.meta.js | grep -E '@version'   # -> 5.1.40
curl -s https://tornwar.com/scripts/factionops.user.js | grep -m1 SCRIPT_VERSION  # -> '5.1.40'
```

- [ ] **Step 2: Update factionops on a client (e.g. RussianRob) and open the war page.** Then watch the server log for the mode flip:

```bash
timeout 90 tail -f /var/log/warboard/warboard-out.log | grep -E "\[chain/(client|skip|poll)\]"
```
Expected: `[chain/client] war=…` appears (the push arriving) and `[chain/skip] war=… client data is Ns old` fires, while `[chain/poll]` (the Torn fetches) drops toward zero for that war.

- [ ] **Step 3: Confirm alerts still fire + fallback intact**
- With client chain flowing, confirm a real chain warning/panic still pushes (it runs through the same `_processChain` pipeline).
- Leave the war page on all clients for > 8 s and confirm `[chain/poll]` resumes (server fallback) — no coverage gap.

- [ ] **Step 4: Confirm the rate-limiting eases** — over the next several minutes, confirm the `[war-status]/[chain] … Too many requests (code 5)` failures subside as the chain poll stops competing for pool keys.

---

## Notes for the executor

- This edits a **live production userscript during an active war** — make the exact three edits, `node --check`, and commit; nothing else. The static mount serves it immediately; there is no build and no pm2 restart.
- **Reversible:** the server's own chain poll is untouched and remains the fallback, so if the push misbehaves, un-bumped clients (or reverting the commit) simply return to server-polling. Alerts never depend solely on the client push.
- Rollout is gradual as members update to 5.1.40; the rate-relief scales with how many war-page members are on the new version.
