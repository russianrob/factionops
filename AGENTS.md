# AGENTS.md — Briefing for Codex / coding agents

This repo is **warboard**, the server + userscript suite behind tornwar.com. It's a mix of:
- A Node.js / Express server (`server/`) that hosts the warboard web app, faction war overlays, and a JSON pricing endpoint (`/data/rwp-prices.json`).
- A collection of Tampermonkey userscripts (`server/scripts/`) that ride on top of torn.com and pda.torn.com. Built copies are served from `server/public/scripts/`.
- Apple / Android native shells in sibling repos (warboard-ios, warboard-native).

Codex is invoked by the project owner (a Claude Code session) to write specific tasks. Claude plans, you implement, Claude verifies the diff. The standing brief below applies to every task unless the per-task prompt overrides it.

---

## Repo layout

| Path | Purpose |
|---|---|
| `server/` | Express app, route handlers, helpers. Entry point is `server/index.js`. |
| `server/scripts/*.user.js` | **Source of truth** for every userscript. Edit here. |
| `server/scripts/*.meta.js` | Tampermonkey update-check stubs (auto-generated from the .user.js header). |
| `server/public/scripts/` | **Deployed copies**. Served at `https://tornwar.com/scripts/*`. Must be kept in sync with `server/scripts/`. |
| `server/public/data/rwp-prices.json` | Live pricing data consumed by `torn-rw-pricer.user.js`. |

---

## Userscript workflow (rigid — do not skip steps)

For any change to a script under `server/scripts/`:

1. **Edit `server/scripts/<name>.user.js`** (the source).
2. **Bump the version in two places**:
   - The `// @version  X.Y.Z` header line.
   - The in-file `SCRIPT_VERSION` constant if one exists.
   These MUST match. Several scripts in this repo will misbehave if they diverge.
3. **Pick the right version number**: read both the current source version AND the currently-served version (`curl -s http://127.0.0.1:3000/scripts/<name>.meta.js | grep @version`). Use `max(source, served) + 1`. Never accidentally regress a user to a lower number than what's already deployed.
4. **Syntax-check**: `node --check server/scripts/<name>.user.js` must pass.
5. **Deploy** by copying source → public AND regenerating the meta stub:
   ```bash
   cp server/scripts/<name>.user.js server/public/scripts/<name>.user.js
   sed -n '1,16p' server/public/scripts/<name>.user.js > server/public/scripts/<name>.meta.js
   ```
   (The meta is just the `==UserScript==` header block — first ~16 lines.)
6. **Verify served**: `curl -s http://127.0.0.1:3000/scripts/<name>.meta.js | grep @version` — should show the new version.
7. **Commit and push to `origin/main`**. Standing authorization: commit + push without re-asking on any userscript change. Commit message format is plain prose (no Conventional Commits prefix); end with the Claude co-author trailer used in recent commits.

If you edit anything under `server/` that isn't a userscript (the Node app itself), the host will need `pm2 reload warboard` after — but Codex isn't authorized to bounce pm2; report what you changed and leave it for the orchestrator.

---

## Hard rules — Torn-specific

These have caused incidents in the past. Read every one before touching any Torn-facing script.

- **No autonomous clicking of Torn UI controls.** Don't fire actions while the user is afk or loop on background timers — no auto-clicking Next/pagination to scrape, no auto-attack/auto-bid/auto-use, no auto-tabbing through categories. Reading the DOM passively is fine; adding your own UI for the user to click is fine. **One exception**: routing a single user-initiated click into an optimized version of the same action IS allowed (e.g., user clicks Train → script intercepts the train fetch, swaps the gym to the best one, forwards the train). One user intent → one optimized action chain. The test: would Torn view this as "the user did it, the script just helped"? If yes, fine. If the script is the actor not the user, refuse.
- **PDA WebView lies about `document.hidden`.** It reports `hidden=true` during active use on Android. Gate any `document.hidden` / `visibilitychange` optimization on `!IS_PDA` or skip the optimization entirely.
- **Tampermonkey isolated-world: use `unsafeWindow` for page XHR/fetch hooks.** Patching `XMLHttpRequest.prototype` from the sandbox does NOT touch page traffic. If you need to hook the page's network, add `@grant unsafeWindow` and patch via `unsafeWindow.XMLHttpRequest.prototype`. **Caveat**: Stay/Safari refuses scripts with `@grant unsafeWindow`. For iOS, redirect users to the warboard-iOS native app rather than fighting Safari.
- **Torn DOM: check `aria-label` before `textContent`.** Semantic state words (e.g., "Travelling", "Hospital") live only in `aria-label`; visible text is just data like a country name. Use literal classes (`.travelling`) first, `aria-label` second, text walker last.
- **Torn API v1 inventory is deprecated.** Use v2: `GET /v2/user/inventory?cat=Primary`. The `cat` param is required. Cannot be combined with the `basic` selection — Torn returns error 21 "Incorrect category". Use as a standalone call.
- **Torn API v2 auth is `Authorization: ApiKey <key>` HEADER**, not `?key=` query string. The rw-pricer script has the canonical pattern.
- **React-mangled selectors**: when Torn's React-generated class names (`name___xY7zQ`) break after 2–3 selector variants, pivot to the `/v2/` API instead of fighting more selectors.
- **`@grant none` is the default** for new scripts unless they specifically need GM\_xmlhttpRequest, GM_setValue, or unsafeWindow.
- **PDA Dev Tools Terminal quirks**: can't return objects/Promises (use `;"ok"` to coerce), prefer flat statements + double quotes. When logging objects for diagnostics, `JSON.stringify` them first — PDA renders raw objects as `[object Object]`.

---

## Naming conventions

- **No `wb-` prefix on new scripts.** Use topical prefix: `torn-`, `oc-`, `arson-`, `ffs-`, `factionops-`. Existing `wb-*` scripts keep their names because users already have them installed.
- Userscripts live as `<prefix>-<feature>.user.js` (e.g., `torn-rw-pricer.user.js`, `oc-spawn-assistance.user.js`).

---

## Server-side conventions

- The Express app uses ESM (`.cjs` for ecosystem config, `.js` ESM elsewhere — match the file you're editing).
- The `/health` route is excluded from the gate middleware (cherry-picked from a prior Cursor branch). When adding new always-public routes, follow the same pattern in `routes.js`.
- Tests live next to their subject (`server/key-encryption.test.js`). Run with the project's existing test command if one is documented in `package.json`. Adding tests is welcome where they actually verify behaviour; don't add tests as ceremony.

---

## What NOT to do

- Don't bundle unrelated UX changes. If the task says "fix widget A", change widget A only. Mention sibling improvements in the report; don't ship them unprompted.
- Don't add comments that just restate the code or reference the current task ("fix for issue #123", "added for the X flow"). Comments are for non-obvious WHY only.
- Don't introduce backwards-compat shims, feature flags, or "in case" abstractions. This codebase changes things in place.
- Don't expand error handling beyond system boundaries. Trust internal callers.
- Don't programmatically click any Torn UI control. (Repeated because it's the most common rule someone tries to break.)
- Don't restore unrelated "missing" files Codex/AI tools surface as `git status` curiosities — several of those are gitignored on purpose. Ask before adding anything that wasn't in the explicit task scope.

---

## Useful project facts

- **Owner faction** in the warboard data is faction id 42055 (Dead Fragment). It's the reference faction for any "show me data for one faction" feature.
- **Torn time vs local time**: Torn server is CEST; when reporting times to a user, convert to EDT (UTC-4) — that's their local zone.
- **External CDN** used by rw-pricer for the weapon/armour CSV: `cdn.marches.cafe`. Don't reroute these to the warboard server.
- **OC checkpoint attribution** is working end-to-end via `unsafeWindow` XHR/fetch patching (see `oc-checkpoint-attribution.user.js` for the canonical pattern if you need to hook page-issued network calls).

---

## Output the orchestrator expects from you

When you finish a task:
1. State which files you changed and why, one line each.
2. Show the version number(s) you bumped (for userscript tasks).
3. List anything you intentionally did NOT do that the brief might have implied. Especially flag if you stopped short of deploying / committing.
4. If anything in the brief was ambiguous, state the assumption you made.

Be terse. The orchestrator will read the git diff to verify the actual change — your summary is a pointer, not a substitute.
