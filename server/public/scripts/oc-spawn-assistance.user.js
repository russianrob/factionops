// ==UserScript==
// @name         OC Spawn Assistance™
// @namespace    torn-oc-spawn-assistance
// @version      3.2.58
// @description  Analyzes faction OC slots vs member availability with scope budget and priority ordering
// @author       RussianRob
// @license      MIT (code) — OC Spawn Assistance™ name is an unregistered trademark of RussianRob; brand use requires permission
// @match        https://www.torn.com/factions.php*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @grant        unsafeWindow
// @connect      tornwar.com
// @connect      api.torn.com
// @downloadURL  https://tornwar.com/scripts/oc-spawn-assistance.user.js
// @updateURL    https://tornwar.com/scripts/oc-spawn-assistance.meta.js
// ==/UserScript==

// ═══════════════════════════════════════════════════════════════════════════════
//  CHANGELOG
// ═══════════════════════════════════════════════════════════════════════════════
// v3.1.76 — Member Projector now anchors on the member's highest STABLE OC level (avg CPR ≥ MINCPR), not just their highest completed. Previously a member who'd touched Lvl 6 at 57% avg CPR was shown as "OC Lvl 6 / 57%" with the projection targeting Lvl 7 ("Not Ready for Lvl 7") — a misleading double whammy: the displayed CPR was their unstable struggling number rather than where they're actually competent, and the projection skipped over the level they're still building. New logic: walk down from completedLevel to find the first level with CPR ≥ MINCPR, use that as the displayed anchor (currentOcLevel + currentLevelCpr); set the projection target to the level they've already attempted but not solidified (so their case becomes "OC Lvl 5 / 65% / attempting Lvl 6 at 57%" rendered as "Building for Lvl 6"). When no stable level exists yet (brand new member at Lvl 1 below MINCPR), anchor stays at completed level and projection targets that same level. Renderer surfaces an inline "attempting Lvl X at N%" tag in orange so the displayed numbers don't read as a contradiction with the projection.
// v3.1.75 — Loan + retrieve: accept both `entry.user.userID` and `entry.user.id` shapes. Torn's late-Apr 2026 auth refactor (changelog "Optimized authentication and last action updates by improving session log logic") flipped some loaned-item entries to expose the borrower as `user.id` instead of `user.userID`. The retrieve match condition (`String(entry.user.userID) === String(userID)`) silently failed against the new shape — every retrieve from the Unused tab raised "Could not find armory item" with no context (the catch block only set "Error" on the button). Fix: cascade `entry.user.userID ?? entry.user.id` everywhere we read the borrower id, both in retrieve's match check AND in `mgr_fetchArmoryIDsForCategory`'s isUnused check (which was mis-classifying loaned-to-others items as available, risking double-loans). Also widened retrieve's category sweep from [hint, alternate-spelling-of-armor] to every loanable bucket (utilities/weapons/armor/armour/medical/boosters/drugs/clothing) since Torn's `/v2/faction` selection name doesn't always match the page-AJAX `type` field. Replaced the silent "Error" button text with the actual reason (truncated to 28 chars, full text in tooltip + console.warn), so the next time something breaks the fix is one screenshot away.
// v3.1.70 — Banker-claim optimistic clear on vault-request Send. Hitting Send now POSTs to /api/oc/vault-request/:id/claim before opening the Controls tab. Server marks the request as claimed-by-this-banker and hides it from listRequests() for every viewer immediately, so all admins see it disappear without waiting for the 20s fundsnews poll → 15s client poll cycle (previously took ~3 manual refreshes to clear). If the matching fundsnews event arrives within the 90s claim TTL, the request is fully deleted as before. If the banker bails (closes Torn tab, never sends the money), the claim expires and the request reappears on every client's next list fetch — no orphaned requests. Two bankers clicking the same Send near-simultaneously: the second gets a 409 Conflict with "Already claimed by X" and their UI shows that message instead of removing the row.
// v3.1.69 — Scope DOM reader now rejects elements nested inside a completed-crime reward block. Torn's Completed tab shows per-OC "+N scope" chips (e.g. Pet Project +2 scope) whose wrapper class also contains the word "scope", so strategies 1 and 2 were scraping those per-OC rewards and pushing them as if they were the faction's current scope balance. That's the source of the 16 → 2 → 5 oscillation in v3.1.68's stability window logs. New insideCompletedContext() walks up ancestors and bails on any node whose className matches completed|executed|ended|reward|payout|result|history. Both strategy 1 (class-match) and strategy 2 (text-match) honor the guard.
// v3.1.68 — Scope stability window: Torn's React re-renders the scope badge during OC state transitions and the DOM class-match strategy sometimes catches intermediate values. Observed 04-24 05:00:24-05:00:41 EDT: 16 → 2 → 5 → 2 pushed in 20s, all class:container___THb7U scope_, when real scope was 16. Delay the commit + push by 2.5s; if a different value arrives inside the window, reset the timer and drop the transient. Legitimate scope changes settle well inside 2.5s so real edits feel ~live. Also moves CONFIG.SCOPE and GM_setValue inside the timer (previously they committed immediately; only the push was debounced).
// v3.1.67 — Fix Request button on vault-request form rendering as black text on a black background. The button was using class="w3b-btn" but that class never existed in the panel stylesheet — browsers fell back to UA default (which ends up ~invisible on the dark panel). Replaced with explicit inline styles matching the rest of the OC Spawn UI: green #2d6a4f background, white text, 1px green border, same padding/font-weight as Refresh.
// v3.1.66 — Drop the "= $X" preview line under the vault-request amount input. Now that the input live-translates "1k" → "1000" directly, the separate preview strip (v3.1.43) duplicates the same information and just adds noise. Removed the DOM element and the updatePreview() function; kept the input listener that does the translation.
// v3.1.65 — Vault-request amount input now live-translates shorthand. The moment the value ends in k/m/b and parses cleanly, the input text is overwritten with the expanded number — "1k" instantly becomes "1000", "10m" becomes "10000000". Works because people type the digits first and the suffix last, so by the time the k/m/b lands the digits are already fixed. The "1.5m" workflow still works: "1" → "1.5" stays as-is (no trailing suffix), and once the m arrives "1.5m" → "1500000" expands. v3.1.64's blur-only handler is replaced by this input-driven version.
// v3.1.64 — Vault-request amount input commits shorthand on blur. Previously typing "1m" showed a live "= $1,000,000" preview beside the input but the input itself stayed "1m". Now when the field loses focus we run parseVaultAmount and overwrite the input value with the expanded number ("1m" → "1000000"). Live preview is still shown during typing (important — so "1.5m" doesn't get clipped to "1000000" after the m keystroke). Only commits if the value contains k/m/b and parses successfully; plain numbers are untouched.
// v3.1.63 — Remove the dead vault-payout autofill path. The Send button's intent was to stash a {recipientId, amount} payload in sessionStorage and have a second listener on the Controls tab pre-fill Torn's give-to-user form via React input-setter hacks, but the selectors (input[name="money"], input[placeholder*="mount"]) haven't matched Torn's React DOM in a long time — autofill silently failed after a 10s poll, falling through to the clipboard-copy fallback that users actually see. Dead code removed (tryAutofillVaultPayout, setReactInputValue, maybeAutofill, hashchange listener). Send button now just copies the amount to clipboard and its <a> href handles the Controls-tab navigation. Status message updated from "Opening Controls tab — give X [id] $Y (autofill queued)" to "Amount copied. Paste into the Give form for X [id] — $Y" so it honestly describes what happens.
// v3.1.62 — Min CPR % setting description rewritten to explain what the threshold actually does in caller-facing terms: "Minimum checkpoint pass rate a member needs before the script considers them eligible to join a crime at their historical level. Anyone below this gets pinned to Lvl 1 only." Previous wording ("Below this, member defaults to Lvl 1 eligibility") was correct but required prior knowledge of what "defaults to Lvl 1" meant.
// v3.1.61 — Collapse the Notifications section of Settings into a single "Open Notifications Setup" button. Per-type toggles (Vault requests, OC ready to spawn) and the test button now live on the dedicated /notifications PWA page, which is the single source of truth for push preferences. Keeps the settings modal lean and works the same across desktop and PDA (PDA users get install-to-home-screen instructions on the page itself). Server whitelist (OC_PUSH_PREF_KEYS) and push-notifications.js NOTIFICATION_TYPES gain oc_ready_to_spawn (default: on) — the pref is stored now; the detection + broadcast side still needs to be wired, so toggling has no effect until that follow-up lands.
// v3.1.60 — Drop the PDA scheduleNotification polling loop; replace with a dedicated /notifications PWA page that partner factions install to their home screen. PDA's Flutter InAppWebView can't receive Web Push, but iOS 16.4+ Safari and Android Chrome can deliver Web Push to home-screen-installed PWAs — so the right answer is to give partners a proper PWA instead of trying to bridge PDA's native notification API. Server serves /notifications (with install-to-home-screen instructions, API-key login, Enable/Disable, vault-request pref toggle, Send test button) and /notifications/manifest.json (start_url: /notifications, short_name "OC Notif") so the installed icon launches straight into the flow. Previous /api/oc/push/pending endpoint + userscript polling infrastructure removed. Desktop Enable button now opens /notifications instead of /push/setup (which redirects for back-compat).
// v3.1.59 — PDA vault-request notifications via scheduleNotification. On Torn PDA (Flutter InAppWebView), the "Enable on This Device" button now toggles a client-side polling loop (30s interval) that hits the new GET /api/oc/push/pending endpoint for vault-request events created since the last bookmark, then fires each one as a local notification via window.flutter_inappwebview.callHandler('scheduleNotification', ...). Bookmark persists in GM storage so a page reload doesn't re-fire a backlog, and first-ever enable silently bookmarks "now" so enabling during a pending request doesn't spam the backlog either. Test button on PDA fires a local scheduleNotification directly (no server round-trip) so the user can verify the bridge works. ID range 700–799 rotated to avoid colliding with FactionOps' ranges. Desktop / mobile-web flow unchanged — they still hit /push/setup for the Web Push subscription.
// v3.1.58 — Enable-on-this-device fix for PDA: previous version opened tornwar.com/push/setup via GM_openInTab / window.open, which on Torn PDA's Flutter InAppWebView spawns a blank tab because Web Push isn't supported there at all (no Service Worker, no pushManager). Now detect PDA via window.flutter_inappwebview and show a yellow hint line directing the user to open the setup page in a desktop browser instead. Desktop / real mobile browsers still get the open-in-new-tab behavior unchanged. Push remains a per-device feature; PDA parity would need a PDA-native notifications path (scheduleNotification callHandler) which is out of scope for this change.
// v3.1.57 — Scope audit tag fix: _lastScopeDetectSource was initialized to the literal string 'auto', which short-circuited the `_lastScopeDetectSource || source || 'auto'` fallback chain inside pushScopeOnly. Result: every scope push logged on the server with source=auto, masking which strategy actually read the value (DOM state / class / text / AJAX XHR / AJAX Fetch). Initialize to null instead so the chain falls through to the caller's source arg (used by the AJAX interceptors) when no DOM read has landed a fresh value. Going forward the server audit log in pm2 will show specific tags like 'state', 'class:warScope', 'text:Scope … 1', or 'AJAX (XHR)' — makes the "where did that scope value come from?" question actually answerable.
// v3.1.56 — Vault-request notifications now work for partner factions that aren't running FactionOps. Added an "Enable on This Device" button next to "Send Test Notification" in Settings → Notifications. It opens tornwar.com/push/setup with the saved API key, which handles service-worker registration, VAPID fetch, and pushManager.subscribe on the tornwar.com origin, then POSTs to the new /api/oc/push/subscribe endpoint (auth'd by the same Torn API key used everywhere else). After enabling, the existing vault_request preference toggle + Send Test Notification flow work exactly as they did for FactionOps factions. Test-button error text updated to reference the Enable button instead of FactionOps.
// v3.1.38 — Outcome EV tables now include a Hit % column: empirical top-tier hit rate per scenario, computed from the faction's historical OC completions. We bucket by money payout since Torn doesn't label ending tiers directly — successful completions whose reward lands in the top quartile for that scenario count as top-tier hits. Lets admins compare predicted Top end % (tornprobability model) vs observed Hit % (faction's own history). Needs ≥4 successful completions to show a rate; otherwise displays '—' with the current sample count. Sortable like the other numeric columns.
// v3.1.37 — Empty-slot placeholder in Recruiting Outcome EV now uses the faction's avg CPR at each OC's difficulty level instead of the flat CPR-50. Average is computed client-side from cprCache across every member whose joinable/highestLevel reaches the OC's level, so the Recruiting numbers reflect "what-if-filled-by-an-average-one-of-us" instead of an artificially low floor. Planning panel unchanged (no empty slots to fill).
// v3.1.36 — Outcome EV table rows now link to the specific OC: the crime name is an anchor to /factions.php?step=your#/tab=crimes&crimeId=<id>, so "row with best Top end %" → one click → the exact OC in Torn's crimes list. Fill chip (e.g. 3/4) added next to each name so multiple same-named OCs at the same difficulty are distinguishable before clicking.
// v3.1.35 — Click-to-sort on Outcome EV tables: click any of the three numeric column headers (Pass %, Top end %, Q score) to rank OCs by that metric. Default sort is Top end % descending so the highest-payout slate is always on top once data lands. Click the same header twice to flip direction. Arrow (▼/▲) shows which column/direction is currently active. Rows still fetching stay anchored at the bottom of descending sorts. Info-icon (?) clicks continue to open tooltips without triggering a sort.
// v3.1.34 — Clickable info tooltips on Outcome EV column headers: click the ? next to Pass %, Top end %, or Q score for a short explanation of each metric. Reuses the existing CPR/scope tooltip pattern; tooltip closes on click-outside or second click on the same icon.
// v3.1.33 — Outcome EV now renders in BOTH tabs: Admin tab shows Recruiting OCs (so admins can see expected EV as slates fill), Engines tab keeps Planning OCs (locked slates, numbers reflect actual outcome). Both panels share the same /api/oc/outcome fetch path and 15-min server cache. Recruiting panel footer warns about CPR-50 neutral for empty slots; Planning panel has no caveat since every slot is filled.
// v3.1.32 — Outcome EV moved to Engines tab + repurposed the Slot Optimizer toggle. Previous v3.1.31 placement in the Admin tab is removed. The "Slot Optimizer" engine now renders as "Outcome EV" and shows per-OC Pass %, Top-end %, and Q score for OCs in Planning status (fully filled, waiting to launch or already running). No more CPR-50 fallback noise since every Planning slot has a real placed member. Legacy server toggle key eng-slot-optimizer reused so existing engine state persists; the server's old member-to-slot assignment payload is ignored client-side.
// v3.1.31 — Outcome EV analyzer (admin tab only): every recruiting OC gets a row with Pass %, Top-end %, and a weighted Q-score (goodEnding1=1.0, goodEnding2=0.7, goodEnding3=0.4, everything else=0.2). Data comes from a new server endpoint /api/oc/outcome that proxies tornprobability.com's CalculateSuccess with 15-min caching. Per-slot CPRs come from each placed member's byPosition history (fallback: overall CPR → 50 neutral for empty slots). Visibility: table renders inside the Admin tab, which is already role-gated, so rank-and-file members never see it. Server endpoint enforces the same role gate as defence-in-depth (403 for non-admins hitting it directly).
// v3.1.30 — MinCPR reset bug (and sibling settings): pushScopeOnly was hitting /api/oc/settings/update with only a `scope` query param, but that handler applied HARD-CODED defaults for every missing field — so every scope auto-detect tick silently reset mincpr → 60, cpr_boost → 15, active_days → 7, etc. Fixed on both sides: client pushScopeOnly now hits the dedicated /api/oc/scope endpoint, and /api/oc/settings/update now falls back to the stored value (not a constant) when a field is missing, so a partial push no longer clobbers untouched settings.
// v3.1.29 — Missing-items UX fix: after a successful loan the card now fades and collapses out of the list within ~1.4s, instead of sitting there with a ✓ Loaned button until the next full refresh (which was up to ~60s away on the API + armory cache cadence). The underlying filter via mgr_recentlyLoaned was already correct; only the visual feedback was lagging. If that was the last missing item, the "All OC items allocated" message takes its place without waiting for a full reload.
// v3.1.28 — Scope cleanup: auto-detect + auto-push is working correctly so dropped the verbose diagnostic logs (init snapshot, per-refresh overwrite decisions, strategy-fire lines). Kept the two useful console lines: "Detected scope change: X → Y (source: …)" and "pushed N to server". Strategy logs demoted to console.debug for Verbose-mode recovery if we ever need to diagnose again.
// v3.1.27 — Scope auto-push: when the DOM reader catches a fresh scope value (e.g. 14 from the Recruiting tab's currentScopes element), the script now debounce-pushes it to /api/oc/settings/update with the caller's API key, 1.5s debounce. Side effect: everyone else in the faction sees the fresh value on their next refresh — no one has to open the Recruiting tab themselves. Also makes the "revert to 11 on reload" class of bug impossible since the server's saved value matches the last detection.
// v3.1.26 — Scope diagnostic logging for "full reload reverts to 11": init now logs what GM storage contained at script boot (cfg_scope, cfg_scope_auto_ts, age in seconds, resulting CONFIG.SCOPE, autoDetected flag). fetchFactionSettings also logs whether it kept the fresh value or let the server overwrite, so we can tell exactly where a revert happens.
// v3.1.25 — Scope persistence: auto-detected scope now survives a full page reload. handleDetectedScope writes the value to GM_setValue('cfg_scope', …) and stamps GM_setValue('cfg_scope_auto_ts', now). On init, CONFIG._scopeAutoDetected is restored as true if that stamp is under 2h old, preventing fetchFactionSettings from clobbering the fresh detection with the stale server-saved value. Previously: reload → _scopeAutoDetected reset to false → server's 11 won even after user detected 14 on Recruiting.
// v3.1.24 — Scope diagnostics: upgraded the strategy-fired logs from console.debug to console.log so Chrome's default Console level shows them (Verbose was required to see debug). Detection log now includes the old→new transition so we can trace whether a strategy is actively overwriting a fresh value with a stale one vs. leaving it alone.
// v3.1.23 — ACTUAL scope root cause (turns out it was never the DOM reader): every runAnalysis refresh called fetchFactionSettings and unconditionally did CONFIG.SCOPE = srvSettings.scope, which overwrote a fresh auto-detected value (e.g. 14 from Recruiting DOM) with the last-saved server value (e.g. 11). Now only applies the server-side value when _scopeAutoDetected is false, so fresh local reads stick. The previous "scope goes back to 11 on Planning" wasn't a DOM-scrape issue — it was server-settings clobber. Strategies 0/1/2 kept as-is; 3.1.22's visibility gate + logs stay in place.
// v3.1.22 — Scope fix round 2: v3.1.21 removed fallback text-scraping entirely, but state (Strategy 0) apparently never populates on live Torn, so scope stopped updating altogether. Restored Strategies 1 (class-match) and 2 (text-match) but now gated on visibility — hidden tab panels (display:none, zero-size) are excluded, so Planning can't scrape stale 11 from an inactive Recruiting panel still sitting in the DOM. Each strategy now logs which fired + the element it matched so root-cause of any remaining mismatches is visible in devtools.
// v3.1.21 — Scope regression fix: DOM reader was overwriting a correct state-read value (e.g. 14 on Recruiting) with a stale DOM-text scrape from another tab (e.g. 11 on Planning from a tooltip/cached summary). Dropped the fallback text-scraping strategies entirely; scope now comes only from Torn's authoritative faction state (unsafeWindow.torn.faction.scope_balance). If state isn't populated on the current tab, last-known value stays put and the age chip indicates freshness.
// v3.1.20 — Scope source: Torn deleted the internal getCrimesData endpoint entirely ("Call to undefined method getCrimesData" on v3.1.19). Removed the HTTP refresh fetch; scope now comes exclusively from the DOM/state reader, which reads unsafeWindow.torn.faction.scope_balance from Torn's own state (populated whenever the user has loaded any factions page). Refresh button still nudges the reader in case a value is present but hasn't been picked up. Detection-age chip stays visible so stale readings are obvious.
// v3.1.19 — Scope fix: 3.1.18's direct getCrimesData call hit Torn's "Validation is required" wall because the internal endpoint requires an rfcv CSRF token (read from the rfc_v cookie). Added the token to the query string, matching the pattern used by the armory-cache fetches elsewhere in this script.
// v3.1.18 — Scope fix: v2 API dead-end — neither `basic` nor `crimes?cat=available` selections expose scope_balance (confirmed via shape dumps). Fell back to Torn's internal /factions.php?step=getCrimesData endpoint, same URL the crimes page uses internally. Called directly (not via the interceptor) with credentials:'include' + Accept:application/json. Logs the first 120 chars of the body when JSON.parse fails so we see exactly what Torn is returning.
// v3.1.17 — Scope fix: moved the refresh fetch from `/v2/faction?selections=basic` (which returns id/name/tag/respect/days_old/capacity — no scope) to `/v2/faction/crimes?cat=available` where scope_balance actually lives. Confirmed by 3.1.16's shape dump.
// v3.1.16 — Scope fix follow-up: 3.1.15's defensive lookup missed because Torn's `basic` selection wraps the payload one level deeper than checked. Replaced with a bounded recursive walk that finds any numeric field matching /scope/i at any depth. On miss, logs the full top-level shape so we can adapt without guesswork.
// v3.1.15 — Fix: scope wasn't refreshing. Old path fired at Torn's internal `step=getCrimesData` endpoint and relied on a sandbox AJAX interceptor to catch scope_balance — brittle because Torn's own XHRs happen in page context (bypass the wrapper) and sandbox-origin calls can get HTML responses that silently fail to parse as JSON. Now hits the documented v2 API via gmRequest with defensive field extraction + console.warn logging when the field isn't found.
// v3.1.14 — Fix: Admin tab was always visible to every member regardless of admin-roles list. Now hidden for non-admins alongside Manager/Metrics/Engines. Also removed the stale "Admin requires faction API access" locked message — gating is role-based now, the old copy was misleading.
// v3.1.13 — Admin settings (gear) now has a "Vault-Request Notifications" toggle and a "Send Test Notification" button. Toggle is server-backed via /api/oc/notification-prefs (auth'd by Torn API key — no FactionOps JWT needed). Test button fires a real push to the caller so they can verify their subscription before relying on live alerts.
// v3.1.12 — Vault-request amount input accepts shorthand: "500k" → 500,000, "2.5m" → 2,500,000, "1b" → 1,000,000,000. Also tolerates commas ("1,000"), leading $ ("$500"), and decimals. Input switched from type=number to type=text + inputmode=decimal so mobile still gets a numeric keypad.
// v3.1.11 — TornPDA fix: header buttons (Refresh, settings gear, close ✕) bind both click + touchend with a 350ms dedupe. Flutter InAppWebView swallows synthesized click events on children of the drag-handle <h2>, which is why taps in TornPDA did nothing. Handlers still fire exactly once on desktop / mobile web / WebView.
// v3.1.10 — Admin-roles config: in OC settings (gear), comma-separated faction positions that gate Admin/Manager/Engines tab visibility. Defaults to leader + co-leader. Replaces the API-key-tier check that was incorrectly granting tab access to anyone with a Limited+ key. Plus: $ button inside vault-request amount box auto-fills max balance; "Send anytime / Only when I'm online" is requester preference (push always goes to all admin-role members). "Send anytime / Only when I'm online" is now a requester preference about accepting money while offline (not notification filtering). Push notifications always go to everyone. Balance shown above form.
// v3.1.0 — Vault requests: My OC tab now shows a live "$X from vault" board. Any faction member submits an amount; Torn currencynews auto-removes the request when the transfer shows up. Push notifications on submit.
// v3.0.30 — Fix: Manager Delays tab used r.responseText, but gmRequest already returns { ok, status, data } with JSON parsed. That produced "JSON parse error: unexpected identifier undefined" every time. Now reads r.data and surfaces non-2xx responses with the server's error message.
// v3.0.29 — Feature: Delay tracking in OC history. Clients POST each flyer observation (crimeId, memberId, delayedSec) to /api/oc/flyer-delay (throttled per pair to 60s). Server keeps max delayedSec until the crime completes, then collectOcHistory bakes the value into the slot entry. New Manager → Delays sub-tab surfaces a 30-day leaderboard of who's held up the most OCs, total delay, longest single delay, and recent crimes; pending (in-flight) observations are included with a tag.
// v3.0.28 — Scope freshness: every Refresh now fires a call to Torn's internal getCrimesData endpoint to pull fresh scope_balance (existing AJAX interceptor catches the response and updates CONFIG.SCOPE). Scope strip also shows detection age next to "● live" — green under 1min, yellow 1-5min, red if older — so stale readings are visible instead of silent.
// v3.0.27 — Flyer alert "delayed Xm" label now ticks live (once per second) against Date.now() instead of freezing until the next Refresh. ready_at is fixed once Torn sets it, so no extra server/API load — purely client-side text update.
// v3.0.26 — Flyer alert urgency now shows how long the OC has been sitting ready ("delayed 47m", "delayed 1h12m") instead of a static "ready now" — a practical measure of how long the flyer is holding up the crew. Falls back to "ready now" only for Planning crimes where ready_at is null/0.
// v3.0.25 — Flyer names in the traveling-alert banner are now clickable: click a name to copy a preset fee-reminder ("You're holding off on the OC initiation...") to the clipboard and open the Torn compose page for that member, same UX as the eligible-members message button. Shared handler is attached to both the tooltip and the panel so either site fires it.
// v3.0.24 — Flyer alert now catches both "Traveling" (in-transit) and "Abroad" (landed overseas) — previously only Traveling fired, so members who'd already landed abroad were silently missed. Banner renamed to "flying" and shows each member's exact state.
// v3.0.23 — Traveling-alert only fires when the OC is truly "ready now" (not 30m out). Planning crimes with null/0 ready_at are treated as ready now (Torn V2 quirk); Recruiting crimes still need fully staffed + ready_at ≤ now.
// v3.0.34 — Remove confidence scoring + Bayesian shrinkage; trust raw CPR. Dev-only indicator now shows only sample count.
// v3.0.33 — Slot Optimizer engine toggle no longer force-reset to false on settings load; checkbox now persists.
// v3.0.32 — Confidence indicator shows info inline (stars + pct + samples) so it's readable on mobile without hover.
// v3.0.31 — Dev-only (XID 137558) confidence/samples indicator next to CPR values in Slot Optimizer output. Helps verify the server-side Bayesian CPR-tightening changes.
// v3.0.22 — Traveling-alert relaxed: Planning crimes always fire the flyer alert (ready_at in V2 is sometimes null/0 for Planning), and Recruiting crimes that are fully staffed + ready within 30m also fire. Urgency label now shows "ready in Nm" when not yet ready.
// v3.0.21 — Dispatcher shows "Subscribe to unlock" banner for non-subscribed factions
// v3.0.20 — Fix syntax error in dispatcher else-branch that broke entire script
// v3.0.17 — Skip new faction members (< 3 days) from eligible list with skip reason
// v3.0.16 — MutationObserver debouncing, shared crimes cache for Manager tab, loan button retry fix
// v3.0.15 — OC history collector fix: pull from completed crimes cache instead of active crimes
// v3.0.14 — Auto-Dispatcher defaults to enabled when not explicitly set in faction settings
// v3.0.13 — Remove spawn-key rate limiter
// v3.0.12 — Sync SCRIPT_VERSION to match @version header
// v3.0.11 — Reduced CPR boost threshold from 15% to 5% for more per-level consideration
// v3.0.10 — Disabled Slot Optimizer engine since Auto-Dispatcher serves similar purpose
// v3.0.9 — Removed hardcoded 15s refresh cooldown completely for faster button re-enable
// v3.0.8 — Reduced refresh cooldown from 15s to 3s for faster button re-enable
// v3.0.7 — Reduced retry delays (1s, 2s, 3s vs 5s, 10s, 20s) for faster refresh responsiveness
// v3.0.6 — Admin eligible list: prioritize OCs with most members filled, remove weight sorting
// v3.0.5 — fix: re-fetch data when navigating back to crimes tab (not just re-inject stale banner)
// v3.0.4 — travel alert: only show for fully staffed OCs (not partially filled ones with ready_at in past)
// v3.0.3 — dispatcher banner re-injects when navigating back to crimes tab
// v3.0.2 — dispatcher banner only visible on crimes tab, auto-hides on tab navigation
// v3.0.1 — auto-retry on fetch errors (3 retries w/ backoff), dispatcher banner shows retry/error state
// v3.0.0 — 6 engines: Slot Optimizer, Failure Risk, CPR Forecaster, Member Projector, Member Reliability, Auto-Dispatcher
// v2.7.1 — Remove scoring breakdown; add "Join" link on each fallback option
// v2.7.0 — Dispatcher shows actual execution countdown from Torn API (ready_at) instead of estimated time
// v2.6.9 — Hide negative hoursToExpiry in dispatcher banner (expired_at can be in the past for active crimes)
// v2.6.8 — Dispatcher banner always visible: loading spinner on init, status messages when no data or in OC
// v2.6.7 — Panel no longer auto-opens; stays closed until user clicks the toggle button (respects oc_panel_closed flag)
// v2.6.6 — Dispatcher banner: click navigates via hash URL (#crimeId=...) so Torn's own router expands the card; fallbacks also clickable
// v2.6.5 — Dispatcher banner: show OC name and position in recommendation
// v2.6.4 — Dispatcher auto-refresh on new data without manual click
// v2.6.3 — Dispatcher fallback: show top 3 alternative OCs if primary is full
// v2.6.2 — Dispatcher: factor in travel time for members abroad
// v2.6.1 — Dispatcher: skip members in hospital or jail
// v2.6.0 — Auto-Dispatcher engine: real-time OC recommendations on crimes page
// v2.5.3 — Expiry Risk engine: flag OCs expiring within configurable window
// v2.5.2 — Gap Analyzer engine: identify role/level shortages in faction
// v2.5.1 — Item ROI engine: track armory item costs vs OC payout returns
// v2.5.0 — OC Payout Tracker engine: payout per hour across OC types
// v2.4.3 — Fix engine cache invalidation on settings change
// v2.4.2 — Fix fetch interceptor causing uncaught promise rejections (red globe in TornPDA)
// v2.4.1 — Member Projector: stricter readiness tiers (Building 60-69%, Developing 70-74%, Ready 75%+)
// v2.4.0 — Rate limiting: 15s cooldown per user, countdown on Refresh button, 429 handling
// v2.3.9 — Member Reliability: predict scores for new members with no OC history
// v2.3.8 — Traveling alert: only show members flying in OCs that are ready now
// v2.3.7 — Traveling alert: include Recruiting OCs that are ready now
// v2.3.6 — Traveling alert: only flags members flying in OCs within 30 min of starting or in Planning
// v2.3.5 — Traveling alert banner: warns when members in an OC are flying
// v2.3.4 — Member Reliability engine: track success rates, consistency, activity, and reliability scores
// v2.3.3 — Member Projector engine: estimate OC potential, readiness, and progression timeline
// v2.3.2 — Slot Optimizer recommendation shown in My OC viewer card
// v2.3.1 — CPR Forecaster: per-level, per-role breakdown
// v2.3.0 — Remember active tab across refreshes
// v2.2.9 — CPR Forecaster: per-level trends instead of flat average
// v2.2.8 — CPR Forecaster engine: 90-day trends, 30-day projections per member
// v2.2.4 — Failure Risk engine + Slot Optimizer fit labels (Strong/Good/Weak Fit)
// v2.2.3 — Engines tab: greyed-out coming soon engines, removed Nerve Efficiency, renamed OC Payout Tracker
// v2.2.2 — Dedicated Engines tab with separate save, removed scope auto-push
// v2.2.1 — Slot Optimizer engine: auto-calculate best member-to-slot assignments
// v2.2.0 — Engine toggle system: 11 engines across Optimization, Risk, Economy, Recruitment categories
// v2.1.27 — Recommendations search downward through lower levels if none at joinable level
// v2.1.26 — Settings gear always visible so all members can change their API key
// v2.1.25 — API key guidance (Limited Access required), subscription timer in header
// v2.1.24 — Buttons render as action text if already on armoury tab at load time
// v2.1.23 — All loan/retrieve buttons update to action text when navigating to armoury
// v2.1.22 — Fix admin locked message to reference API access instead of role names
// v2.1.21 — Loan/Retrieve buttons start as "Go to Armoury", change to action after navigating
// v2.1.20 — Version bump
// v2.1.19 — Switch armory reads to Torn API; page AJAX only for loan/retrieve actions
// v2.1.18 — Remove dead ADMIN_ROLES config; graceful fallback when no faction-access key cached
// v2.1.17 — Admin access based on API key faction access, not role names
// v2.1.16 — Version bump
// v2.1.15 — Revert same-range joining: back to exact level match only
// v2.1.14 — Same scope range both directions (Lvl 5 can join Lvl 6 if that's what spawned)
// v2.1.13 — Expiry fallback within same scope range only (Lvl 5↔Lvl 6, not Lvl 5→Lvl 4)
// v2.1.12 — Recommend spawning 1 OC when members exist but zero OCs at that level
// v2.1.11 — Revert level fallback: members stay at their level (don't downgrade Lvl 7 to Lvl 4)
// v2.1.10 — Prioritize expiring OCs first (soonest deadline gets filled first)
// v2.1.9  — Members fall to next available level if their level has no OCs
// v2.1.8  — Show "waiting" when members exist but no OCs at that level
// v2.1.7  — Unblacklist Blood Bag (Irradiated) from Missing tab
// v2.1.6  — Save button disabled until server settings loaded (prevents default overwrite)
// v2.1.5  — Scope guard: don't push lower value than server has
// v2.1.4  — Unused tab: only show OC-relevant items
// v2.1.3  — Two-step loan/retrieve: navigate to armory tab first
// v2.1.2  — API key field plain text instead of asterisks
// v2.1.1  — Added Councilor to default admin roles
// v2.1.0  — Metrics tab: KPIs, per-OC breakdown, date range, item valuation
// v2.0.0  — Manager tab (Missing/Unused/Payouts), version gate, Message Player,
//           hidden config for non-admins, SCRIPT_VERSION constant, @updateURL
// v1.7.37 — Scope auto-push uses /api/oc/scope (no settings overwrite)
// v1.7.36 — Scope auto-push to server (debounced, after settings loaded)
// v1.7.35 — Trust server per-level joinable, don't override with overall CPR
// v1.7.34 — Per-level CPR gating + server applies faction MINCPR/CPR_BOOST
// v1.7.33 — Skipped members get full CPR/OC data (fixes viewer card for long OCs)
// v1.7.31 — Fix: pass weights to renderViewerCard
// v1.7.30 — Numbered role labels (#1, #2), weight lookups fixed
// v1.7.29 — Weight-based role selection, full slot names
// v1.7.28 — Use position name not position_id for byPosition keys
// v1.7.27 — Role CPR fallback: exact crime match, then any crime with same role
// v1.7.26 — Scope byPosition CPR to crime type (crimeName::role)
// v1.7.25 — Border + dim styling for "None needed" rows
// v1.7.24 — Always show levels with members or slots
// v1.7.23 — Gear always visible to dev regardless of admin roles
// v1.7.22 — Friendlier error for Incorrect ID-entity relation
// v1.7.21 — Cross-faction fetchKey fix, smarter error hints
// v1.7.20 — Configurable Admin Roles setting
// v1.7.19 — Show actual server 403 message to unsubscribed users
// v1.7.18 — Smarter error hints for Torn API timeouts
// v1.7.16 — Admin tab gated by faction position or dev ID
// v1.7.15 — Two-tab system: My OC (everyone) + Admin (admin-only)
// v1.7.14 — Settings restricted to owner faction only
// v1.7.13 — OWNER_API_KEY for faction fetches (Minimal keys work)
// v1.7.12 — Configurable weight threshold/CPR settings
// v1.7.11 — OC role weights from tornprobability.com
// ═══════════════════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // 2026-05-24 — PDA Android GM polyfill. TM's @grant occasionally fails
    // to bind GM_xxx as local vars on Android (xentac repro). Defining on
    // window lets the bare GM_xxx(...) call fall through to the global via
    // scope chain. Harmless on iOS — TM's local var always shadows window.
    // Skipped GM_xmlhttpRequest (fetch can't reliably emulate cross-origin).
    (function polyfillGM() {
        const w = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        if (typeof w.GM_addStyle !== 'function') {
            w.GM_addStyle = function (css) {
                const s = document.createElement('style');
                s.textContent = String(css || '');
                (document.head || document.documentElement).appendChild(s);
                return s;
            };
        }
        if (typeof w.GM_setValue !== 'function') {
            w.GM_setValue = function (k, v) { try { localStorage.setItem('ocsp:' + k, JSON.stringify(v)); } catch (_) {} };
        }
        if (typeof w.GM_getValue !== 'function') {
            w.GM_getValue = function (k, d) {
                try { const raw = localStorage.getItem('ocsp:' + k); return raw == null ? d : JSON.parse(raw); }
                catch (_) { return d; }
            };
        }
        if (typeof w.GM_openInTab !== 'function') {
            w.GM_openInTab = function (url, opts) {
                try { return window.open(String(url || ''), '_blank', 'noopener,noreferrer'); } catch (_) {}
            };
        }
    })();

    // ═══════════════════════════════════════════════════════════════════════
    //  SCOPE SYSTEM CONSTANTS
    //  Range → difficulty band, spawn cost, scope payout on success
    // ═══════════════════════════════════════════════════════════════════════
    const SCOPE_RANGES = [
        { range: 1, minDiff: 1,  maxDiff: 2,  cost: 1, payout: 2 },
        { range: 2, minDiff: 3,  maxDiff: 4,  cost: 2, payout: 3 },
        { range: 3, minDiff: 5,  maxDiff: 6,  cost: 3, payout: 4 },
        { range: 4, minDiff: 7,  maxDiff: 8,  cost: 4, payout: 5 },
        { range: 5, minDiff: 9,  maxDiff: 10, cost: 5, payout: 6 },
    ];
    const SCOPE_REGEN_PER_DAY = 1;
    const SCOPE_MAX           = 100;
    const DEFAULT_SLOTS_PER_OC = { 1: 2, 2: 4, 3: 3, 4: 6, 5: 8 };

    function diffToScopeRange(diff) {
        return SCOPE_RANGES.find(r => diff >= r.minDiff && diff <= r.maxDiff) || SCOPE_RANGES[0];
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  CONFIG  — defaults, overridden by faction-wide server settings
    // ═══════════════════════════════════════════════════════════════════════
    function loadConfig() {
        return {
            API_KEY:           'YOUR_API_KEY_HERE',
            FACTION_ID:        0, // Set by server
            ACTIVE_DAYS:             Number(GM_getValue('cfg_active_days',         7)),
            FORECAST_HOURS:          Number(GM_getValue('cfg_forecast_hours',     24)),
            MINCPR:                  Number(GM_getValue('cfg_mincpr',              60)),
            CPR_BOOST:               Number(GM_getValue('cfg_cpr_boost',          15)),
            CPR_LOOKBACK_DAYS:       Number(GM_getValue('cfg_lookback_days',     120)),
            HIGH_WEIGHT_THRESHOLD:   Number(GM_getValue('cfg_high_weight_pct',    25)),
            HIGH_WEIGHT_MIN_CPR:     Number(GM_getValue('cfg_high_weight_mincpr', 75)),
            FFS_KEY:                 String(GM_getValue('cfg_ffs_key', '')),
            SCOPE:             GM_getValue('cfg_scope', null),  // null = not configured
            // Persisted: remember that scope came from auto-detection so a page
            // reload doesn't let the server's older saved value clobber it. The
            // stamp is the last time a DOM/state reader read it; lasts 2h.
            _scopeAutoDetected:      (Date.now() - Number(GM_getValue('cfg_scope_auto_ts', 0))) < 2 * 60 * 60 * 1000,
            _scopeUpdatedAt:         Number(GM_getValue('cfg_scope_auto_ts', 0)) || null,
            // Engine toggles
            ENGINE_SLOT_OPTIMIZER:   GM_getValue('eng_slot_optimizer', false),
            VAULT_REQUESTS_ENABLED:  true,     // always on for now
            ENGINE_CPR_FORECASTER:   GM_getValue('eng_cpr_forecaster', false),
            ENGINE_FAILURE_RISK:     GM_getValue('eng_failure_risk', false),

            ENGINE_MEMBER_RELIABILITY: GM_getValue('eng_member_reliability', false),

            ENGINE_MEMBER_PROJECTOR: GM_getValue('eng_member_projector', false),
            ENGINE_AUTO_DISPATCHER:  GM_getValue('eng_auto_dispatcher', true),
            VERSION:           '2.7.3',
        };
    }
    let CONFIG = loadConfig();

    let cprBreakdownMap = {};
    let recMap = {}; // uid → { crime, position, cpr, count }
    // Vault-request board: list of { id, requesterId, requesterName, amount, target, createdAt }
    // Refreshed alongside the main analysis cycle.
    let S = { vaultRequests: [], vaultBalance: null };
    let lastScopeProjection = null;
    let scopePushTimer  = null;
    let settingsReady    = false;  // true after server settings loaded
    let _lastDispatcherData;         // cache last dispatcher result for tab re-injection
    let _coachingSnapshot = null;    // { cprCache, members } — populated each runAnalysis(); read on Coaching tab load
    let _lastHitRates = {};          // v3.1.38: per-scenario empirical top-tier hit rates
    let _lastPendingDelays = {};     // v3.1.49: per-member pending flyer delays (crimeId::memberId → seconds)
    let _lastRecentCompletions = []; // v3.1.52: last-10 completed crimes for Outcome EV engine
    let _lastAvailableCrimes = [];   // v3.2.13: stash of last fetched crimes (with IDs + slot assignments) for live-success crimeId resolution
    const SCRIPT_VERSION = '3.2.58';
    const SERVER = 'https://tornwar.com';

    // Torn PDA (Flutter InAppWebView) doesn't support Web Push. Instead
    // of polling, we direct users to open tornwar.com/push/setup in
    // Safari / Chrome and Add-to-Home-Screen it as a PWA — iOS and
    // Android both deliver Web Push to home-screen PWAs.
    const IS_PDA = typeof window.flutter_inappwebview !== 'undefined';

    // ═══════════════════════════════════════════════════════════════════════
    //  OC METRICS  — constants, state, and core logic (ported from Canixe's script)
    // ═══════════════════════════════════════════════════════════════════════
    const MET_CRIMES_API  = "https://api.torn.com/v2/faction/crimes";
    const MET_NEWS_API    = "https://api.torn.com/v2/faction/news";
    const MET_ITEMS_API   = "https://api.torn.com/v2/torn/items";
    const MET_API_COMMENT = "ocs-mtrcs";  // 9 chars — Torn truncates `comment=` to 10
    const MET_API_PAGE_CAP = 100;
    const MET_FIG = "\u2007";
    const MET_ITEM_CACHE_KEY = "oc-spawn-metrics:items_cache_v1.1";
    const MET_ITEM_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
    let   met_ITEM_INFO = null;
    const MET_VALUE_MODE_KEY = "oc-spawn-metrics:value_mode_v1";
    const MET_VALUE_MODES = { MV: "mv", PAID: "paid" };
    let   met_lastRender = null;
    let   met_abortCtrl = null;
    let   met_loaded = false; // true after first load

    // --- Metrics utility functions ---
    const met_delay = (ms) => new Promise(r => setTimeout(r, ms));
    const met_escapeHtml = (s) => String(s)
        .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
        .replace(/\"/g,"&quot;").replace(/'/g,"&#39;");
    const met_fmtMoneySpace = (n) => String(Math.round(n||0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const met_pad2   = (n) => String(n).padStart(2, MET_FIG);
    const met_padPct = (r) => r.toFixed(1).padStart(5, MET_FIG) + "%";

    function met_getValueMode() {
        try {
            const m = GM_getValue(MET_VALUE_MODE_KEY, MET_VALUE_MODES.MV) || MET_VALUE_MODES.MV;
            return (String(m) === MET_VALUE_MODES.PAID) ? MET_VALUE_MODES.PAID : MET_VALUE_MODES.MV;
        } catch { return MET_VALUE_MODES.MV; }
    }
    function met_setValueMode(val) {
        try { GM_setValue(MET_VALUE_MODE_KEY, val); } catch {}
    }

    function met_setError(msg) {
        const s = document.getElementById('met-status');
        if (!s) return;
        if (msg) { s.textContent = msg; s.style.display = 'inline'; }
        else { s.textContent = ''; s.style.display = 'none'; }
    }

    function met_grossUpFromPaid(paidToMembers, payoutPct) {
        const paid = Math.round(Number(paidToMembers || 0));
        const pct  = Number(payoutPct || 0);
        if (!paid || !(pct > 0)) return 0;
        const bp = Math.round(pct * 100);
        if (!(bp > 0)) return 0;
        return Math.round((paid * 10000) / bp);
    }

    // --- Metrics API fetching (uses direct fetch + getApiKey) ---
    async function met_fetchJSON(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (data && (data.error || data.code)) {
            const code = Number(data.error?.code ?? data.code ?? NaN);
            const raw  = data.error?.error ?? data.error?.message ?? "API error";
            const map = {
                1: "Missing API key", 2: "Invalid API key",
                5: "Rate limited: retry in ~30s", 7: "Requires Faction API Access",
                14: "Daily usage limit reached", 16: "Insufficient access — requires Limited Access",
            };
            const nice = Number.isFinite(code) ? (map[code] || raw) : raw;
            throw new Error('Torn API error' + (Number.isFinite(code) ? ' ' + code : '') + ': ' + nice);
        }
        return data;
    }

    const met_asCrimes = (p) =>
        Array.isArray(p?.crimes) ? p.crimes
        : (p?.crimes && typeof p.crimes === "object" ? Object.values(p.crimes)
        : (Array.isArray(p?.result?.crimes) ? p.result.crimes : []));

    const met_asNews = (p) =>
        Array.isArray(p?.news) ? p.news
        : (p?.news && typeof p.news === "object" ? Object.values(p.news)
        : (Array.isArray(p?.result?.news) ? p.result.news : []));

    async function met_fetchCrimesBatch({ key, startSec, endSec, signal }) {
        const u = new URL(MET_CRIMES_API);
        u.searchParams.set("comment", MET_API_COMMENT);
        u.searchParams.set("key", key.trim());
        u.searchParams.set("cat", "completed");
        u.searchParams.set("filter", "executed_at");
        u.searchParams.set("from", String(startSec));
        u.searchParams.set("to",   String(endSec));
        u.searchParams.set("sort", "DESC");

        const data   = await met_fetchJSON(u.toString());
        if (signal?.aborted) throw new Error("Aborted");
        const crimes = (met_asCrimes(data) || []).filter(c => Number.isFinite(c?.executed_at));
        return { crimes };
    }

    async function met_fetchNewsExpenses({ key, startSec, endSec, includeCrimeIds, signal }) {
        const paidToMembersByCrime = new Map();
        const grossTotalByCrime = new Map();
        const seenNewsIds = new Set();
        let cursorTo = endSec;

        while (cursorTo >= startSec) {
            if (signal?.aborted) throw new Error("Aborted");

            const u = new URL(MET_NEWS_API);
            u.searchParams.set("comment", MET_API_COMMENT);
            u.searchParams.set("key", key.trim());
            u.searchParams.set("cat", "crime");
            u.searchParams.set("sort", "DESC");
            u.searchParams.set("from", String(startSec));
            u.searchParams.set("to",   String(cursorTo));

            const news = (met_asNews(await met_fetchJSON(u.toString())) || []).filter(n => Number.isFinite(n?.timestamp));
            const count = news.length;
            if (!count) break;

            for (const n of news) {
                const nid = String(n?.id || "");
                if (nid) {
                    if (seenNewsIds.has(nid)) continue;
                    seenNewsIds.add(nid);
                }

                const txt = String(n?.text || "");
                const idm = txt.match(/crimeId=(\d+)/i); if (!idm) continue;
                const crimeId = Number(idm[1]);
                if (includeCrimeIds && !includeCrimeIds.has(crimeId)) continue;

                const pm = txt.match(
                    /money balance payout splitting\s+(\d+(?:\.\d+)?)%\s+of\s+the\s+\$([\d, ]+)\s+between\s+(\d+)\s+participants/i
                );
                if (!pm) continue;

                const pct = parseFloat(pm[1]);
                const total = parseInt(pm[2].replace(/[^\d]/g,""), 10);
                const participants = parseInt(pm[3], 10);

                const pool = Math.floor((total * pct + 1e-9) / 100);
                const each = Math.floor(pool / participants);
                const paidOutTotal = each * participants;

                paidToMembersByCrime.set(crimeId, (paidToMembersByCrime.get(crimeId) || 0) + paidOutTotal);
                grossTotalByCrime.set(crimeId, (grossTotalByCrime.get(crimeId) || 0) + total);
            }

            if (count < MET_API_PAGE_CAP) break;

            const asc = [...new Set(news.map(n => n.timestamp))].sort((a,b)=>a-b);
            const min = asc[0];
            const secondMin = asc.length >= 2 ? asc[1] : NaN;

            let nextTo = Number.isFinite(secondMin) ? secondMin : (min - 1);
            if (!(nextTo < cursorTo)) nextTo = cursorTo - 1;
            if (nextTo < startSec) break;
            cursorTo = nextTo;

            await met_delay(150);
        }

        return { paidToMembersByCrime, grossTotalByCrime };
    }

    // Items catalog with 24h localStorage cache
    async function met_ensureItemInfo(key) {
        if (met_ITEM_INFO) return;
        try {
            const raw = localStorage.getItem(MET_ITEM_CACHE_KEY);
            if (raw) {
                const obj = JSON.parse(raw);
                if (obj?.ts && obj?.data && (Date.now() - obj.ts) < MET_ITEM_CACHE_TTL) {
                    met_ITEM_INFO = new Map(obj.data);
                    return;
                }
            }
        } catch {}
        try {
            const u = new URL(MET_ITEMS_API);
            u.searchParams.set("comment", MET_API_COMMENT);
            u.searchParams.set("key", key.trim());
            const data = await met_fetchJSON(u.toString());
            const arr = Array.isArray(data?.items) ? data.items
                : (Array.isArray(data?.result?.items) ? data.result.items : []);
            const map = new Map();
            for (const it of arr) {
                const id = Number(it?.id);
                if (!Number.isFinite(id)) continue;
                const name = it?.name || 'Item #' + id;
                const mv   = Number(it?.value?.market_price ?? 0) || 0;
                map.set(id, { name, mv });
            }
            met_ITEM_INFO = map;
            try {
                localStorage.setItem(MET_ITEM_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: Array.from(map.entries()) }));
            } catch {}
        } catch(e) {
            console.warn("[OC Metrics] Items catalog fetch failed:", e);
            met_ITEM_INFO = new Map();
        }
    }
    const met_itemName = (id) => met_ITEM_INFO?.get(id)?.name ?? ('Item #' + id);
    const met_itemMV   = (id) => met_ITEM_INFO?.get(id)?.mv   ?? 0;

    // --- Metrics aggregation ---
    function met_aggregate(crimes) {
        const totals = {
            count: 0, success: 0, fail: 0,
            money: 0, respect: 0,
            payoutToMembers: 0, payoutToFaction: 0,
            ocBreakdown: new Map(),
        };
        for (const c of crimes) {
            const success = String(c?.status||"").toLowerCase() === "successful";
            totals.count += 1;
            success ? (totals.success += 1) : (totals.fail += 1);
            const name = c?.name || "Unknown OC";
            const diff = Number.isFinite(c?.difficulty) ? c.difficulty : null;
            const key  = name + "|" + (diff ?? "");
            let b = totals.ocBreakdown.get(key);
            if (!b) {
                b = { name, difficulty: diff, total: 0, success: 0, fail: 0, respect: 0, memMoney: 0, income: 0, itemsQty: 0, items: new Map() };
                totals.ocBreakdown.set(key, b);
            }
            b.total += 1;
            success ? (b.success += 1) : (b.fail += 1);
            const money   = Number(c?.rewards?.money   || 0);
            const respect = Number(c?.rewards?.respect || 0);
            totals.money   += money;
            totals.respect += respect;
            b.income       += money;
            b.respect      += respect;
            const itemsArr = Array.isArray(c?.rewards?.items) ? c.rewards.items : [];
            for (const it of itemsArr) {
                const iid = Number(it?.id);
                const qty = Number(it?.quantity || 0);
                if (!Number.isFinite(iid) || !qty) continue;
                b.itemsQty += qty;
                b.items.set(iid, (b.items.get(iid) || 0) + qty);
            }
            const pct       = Math.max(0, Math.min(100, Number(c?.rewards?.payout?.percentage ?? 0)));
            const toMembers = Math.round((money * pct) / 100);
            const toFaction = money - toMembers;
            totals.payoutToMembers += toMembers;
            totals.payoutToFaction += toFaction;
            b.memMoney += toMembers;
        }
        return { totals };
    }

    function met_buildOcExpenseMap(crimes, expenseByCrime) {
        const map = new Map();
        for (const c of crimes) {
            const e = expenseByCrime.get(c.id) || 0;
            if (!e) continue;
            const name = c.name || "Unknown OC";
            const diff = Number.isFinite(c.difficulty) ? c.difficulty : null;
            const key  = name + "|" + (diff ?? "");
            map.set(key, (map.get(key) || 0) + e);
        }
        return map;
    }

    function met_getMaxPaidAt(crimes) {
        let max = NaN;
        for (const c of crimes) {
            const ts = Number(c?.rewards?.payout?.paid_at);
            if (Number.isFinite(ts) && (!Number.isFinite(max) || ts > max)) max = ts;
        }
        return max;
    }

    function met_buildItemEstByKey(ocMap) {
        const byKey = new Map(); let total = 0;
        for (const [key, b] of ocMap) {
            let est = 0;
            if (b.items?.size) {
                for (const [iid, qty] of b.items) est += qty * (met_itemMV(iid) || 0);
            }
            est = Math.round(est);
            byKey.set(key, est);
            total += est;
        }
        return { byKey, total: Math.round(total) };
    }

    function met_buildOcTimeItemEstByKey(crimes, grossTotalByCrime) {
        const grossedByKey = new Map();
        const incomeByKey  = new Map();
        for (const c of crimes) {
            const name = c.name || "Unknown OC";
            const diff = Number.isFinite(c.difficulty) ? c.difficulty : null;
            const key  = name + "|" + (diff ?? "");
            const income = Math.round(Number(c?.rewards?.money || 0));
            incomeByKey.set(key, (incomeByKey.get(key) || 0) + income);
            const gross = grossTotalByCrime.get(c.id) || 0;
            if (!gross) continue;
            grossedByKey.set(key, (grossedByKey.get(key) || 0) + gross);
        }
        const byKey = new Map(); let total = 0;
        for (const [key, grossed] of grossedByKey) {
            const income = incomeByKey.get(key) || 0;
            const estItems = Math.max(0, Math.round(grossed - income));
            byKey.set(key, estItems);
            total += estItems;
        }
        return { byKey, total: Math.round(total) };
    }

    // --- Metrics rendering ---
    function met_renderTotals({ totals, countDays, paidToMembersOverride, netOverride }) {
        const host = document.getElementById('met-totals');
        if (!host) return;
        const days = Math.max(1, countDays|0);
        const rate = totals.count ? (totals.success / totals.count * 100) : 0;
        const paidMembers = Number.isFinite(paidToMembersOverride) ? paidToMembersOverride : (totals.payoutToMembers || 0);
        const netFaction  = Number.isFinite(netOverride)           ? netOverride           : (totals.payoutToFaction || 0);
        const grandTotal  = paidMembers + netFaction;
        const perRespect = totals.respect / days;
        const perMem     = paidMembers   / days;
        const perNet     = netFaction    / days;
        const perGrand   = grandTotal    / days;

        host.innerHTML = '<div class="met-kpis">'
          + '<div class="met-kpi"><div class="met-kpi-label">Crimes</div>'
          + '<div class="met-kpi-value">' + totals.count.toLocaleString() + '</div>'
          + '<div class="met-kpi-sub"><span style="color:#74c69d">' + totals.success.toLocaleString() + '</span> / <span style="color:#f87171">' + totals.fail.toLocaleString() + '</span> \u2013 ' + rate.toFixed(1) + '%</div></div>'
          + '<div class="met-kpi"><div class="met-kpi-label">Respect</div>'
          + '<div class="met-kpi-value">' + totals.respect.toLocaleString() + '</div>'
          + '<div class="met-kpi-sub">\u2248 ' + perRespect.toFixed(1) + ' / day</div></div>'
          + '<div class="met-kpi"><div class="met-kpi-label">Money to Members</div>'
          + '<div class="met-kpi-value">$' + paidMembers.toLocaleString() + '</div>'
          + '<div class="met-kpi-sub">\u2248 $' + met_fmtMoneySpace(perMem) + ' / day</div></div>'
          + '<div class="met-kpi"><div class="met-kpi-label">Money to Faction</div>'
          + '<div class="met-kpi-value">$' + netFaction.toLocaleString() + '</div>'
          + '<div class="met-kpi-sub">\u2248 $' + met_fmtMoneySpace(perNet) + ' / day</div></div>'
          + '<div class="met-kpi"><div class="met-kpi-label">Grand Total</div>'
          + '<div class="met-kpi-value">$' + grandTotal.toLocaleString() + '</div>'
          + '<div class="met-kpi-sub">\u2248 $' + met_fmtMoneySpace(perGrand) + ' / day</div></div>'
          + '</div>';
    }

    function met_renderOcBreakdown(ocMap, ocExpenseMap, itemEstByKey, opts) {
        const mode = (opts && opts.valueMode) || MET_VALUE_MODES.MV;
        const estLbl = (mode === MET_VALUE_MODES.PAID) ? "\u2248 $%s (OC-time)" : "\u2248 $%s (MV)";
        const host = document.getElementById('met-ocbreak');
        if (!host) return;

        const entries = Array.from(ocMap.entries()).map(([key, b]) => ({ key, ...b }));
        if (!entries.length) { host.innerHTML = '<span style="color:#6b7280;font-size:11px;">No crimes in range.</span>'; return; }

        entries.sort((a,b)=> ((a.difficulty??9999) - (b.difficulty??9999)) || a.name.localeCompare(b.name));

        const rows = entries.map(x => {
            const rate   = x.total ? (x.success / x.total * 100) : 0;
            const income = Math.round(x.income || 0);
            const paid   = Math.round(ocExpenseMap.get(x.key) || 0);
            const est    = Math.round(itemEstByKey.get(x.key) || 0);
            const net    = income + est - paid;
            const netCls = net >= 0 ? "color:#74c69d" : "color:#f87171";
            const label  = x.difficulty + ' - ' + met_escapeHtml(x.name);

            const parts = [];
            if (income > 0) parts.push('<div style="color:#74c69d">$' + income.toLocaleString() + '</div>');
            if (x.items?.size) {
                const li = [];
                for (const [iid, qty] of x.items) li.push('<li>' + qty.toLocaleString() + '\u00d7 ' + met_escapeHtml(met_itemName(iid)) + '</li>');
                li.sort((a,b)=> a.localeCompare(b));
                parts.push('<div class="met-items-col"><ul class="met-items-list">' + li.join("") + '</ul></div>');
                if (est > 0) parts.push('<div style="color:#f4a261">' + estLbl.replace("%s", est.toLocaleString()) + '</div>');
            }
            const merged = parts.length ? parts.join("") : "\u2014";

            const runsCell = '<span style="font-family:monospace">' + met_pad2(x.total) + ' (<span style="color:#74c69d">' + met_pad2(x.success) + '</span>/<span style="color:#f87171">' + met_pad2(x.fail) + '</span>) ' + met_padPct(rate) + '</span>';

            // items detail for mobile expandable row
            let itemsHTML = '';
            if (x.items && x.items.size) {
                const li2 = [];
                x.items.forEach((qty, iid) => {
                    li2.push('<li>' + qty.toLocaleString() + '\u00d7 ' + met_escapeHtml(met_itemName(iid)) + '</li>');
                });
                li2.sort((a,b) => a.localeCompare(b));
                itemsHTML = '<ul class="met-items-list">' + li2.join('') + '</ul>';
            }

            const detailsHtml = '<div class="met-details-wrap">'
                + '<div><strong>Runs</strong>: ' + runsCell + '</div>'
                + '<div><strong>Resp.</strong>: ' + x.respect.toLocaleString() + '</div>'
                + (income ? '<div style="color:#74c69d"><strong>Income</strong>: $' + income.toLocaleString() + '</div>' : '')
                + (paid   ? '<div style="color:#f87171"><strong>Paid to Members</strong>: $' + paid.toLocaleString() + '</div>' : '')
                + (x.items && x.items.size
                    ? '<div><strong>Items</strong>:' + itemsHTML + '</div>'
                      + (est ? '<div style="color:#f4a261"><strong>Item est.</strong>: $' + est.toLocaleString() + '</div>' : '')
                    : '')
                + '</div>';

            return '<tr class="met-main-row" aria-expanded="false">'
                + '<td class="met-oc-name">' + label + '</td>'
                + '<td class="met-w-min met-center met-col-runs">' + runsCell + '</td>'
                + '<td class="met-w-min met-center met-col-resp">' + x.respect.toLocaleString() + '</td>'
                + '<td class="met-col-items">' + merged + '</td>'
                + '<td class="met-w-min met-center met-col-paid" style="color:#f87171">$' + paid.toLocaleString() + '</td>'
                + '<td class="met-w-min met-center" style="' + netCls + '">$' + net.toLocaleString() + '</td>'
                + '</tr>'
                + '<tr class="met-row-details"><td colspan="6">' + detailsHtml + '</td></tr>';
        });

        host.innerHTML = '<table class="oc-table met-table">'
            + '<thead><tr>'
            + '<th>OC</th>'
            + '<th class="met-col-runs met-w-min">Runs</th>'
            + '<th class="met-col-resp met-w-min">Resp.</th>'
            + '<th class="met-col-items">' + ((mode === MET_VALUE_MODES.PAID) ? "Income & Items (OC-time est.)" : "Income & Items (Est. MV)") + '</th>'
            + '<th class="met-col-paid met-w-min">Paid to Members</th>'
            + '<th class="met-w-min">Net</th>'
            + '</tr></thead>'
            + '<tbody>' + rows.join('') + '</tbody>'
            + '</table>';
    }

    function met_renderFromCache(mode) {
        if (!met_lastRender) return;
        const isPaid = (mode === MET_VALUE_MODES.PAID);
        met_renderTotals({
            totals: met_lastRender.totals,
            countDays: met_lastRender.diffDays,
            paidToMembersOverride: met_lastRender.totalPaid,
            netOverride: isPaid ? met_lastRender.netTotalPaid : met_lastRender.netTotalMV
        });
        met_renderOcBreakdown(
            met_lastRender.totals.ocBreakdown,
            met_lastRender.ocExpenseMap,
            isPaid ? met_lastRender.itemEstByKeyPaid : met_lastRender.itemEstByKeyMV,
            { valueMode: mode }
        );
        const copyBtn = document.getElementById('met-copy');
        if (copyBtn) copyBtn.style.display = 'inline-flex';
    }

    function met_buildSummaryTSV() {
        if (!met_lastRender) return "";
        const fromStr = document.getElementById('met-from')?.value || "";
        const toStr   = document.getElementById('met-to')?.value || "";
        const mode = met_getValueMode();
        const modeLabel = (mode === MET_VALUE_MODES.PAID) ? "OC-Time" : "Current MV";
        const totals = met_lastRender.totals;
        const days   = Math.max(1, met_lastRender.diffDays|0);
        const rate   = totals.count ? (totals.success / totals.count * 100) : 0;
        const paidMembers = met_lastRender.totalPaid || 0;
        const netFaction = (mode === MET_VALUE_MODES.PAID) ? (met_lastRender.netTotalPaid || 0) : (met_lastRender.netTotalMV || 0);
        const grandTotal = paidMembers + netFaction;
        const headers = [
            "From(UTC)","To(UTC)","ValueMode",
            "Crimes","Success","Fail","SuccessRate(%)",
            "Respect","RespectPerDay",
            "MoneyToMembers","MoneyToMembersPerDay",
            "MoneyToFaction(Net)","MoneyToFactionPerDay",
            "GrandTotal","GrandTotalPerDay"
        ].join("\t");
        const row = [
            fromStr, toStr, modeLabel,
            totals.count, totals.success, totals.fail, rate.toFixed(1),
            totals.respect, (totals.respect / days).toFixed(1),
            paidMembers, Math.round(paidMembers / days),
            netFaction, Math.round(netFaction / days),
            grandTotal, Math.round(grandTotal / days)
        ].join("\t");
        return headers + "\n" + row;
    }

    // --- Metrics main run ---
    async function met_runQuery() {
        const copyBtn = document.getElementById('met-copy');
        if (copyBtn) copyBtn.style.display = 'none';

        const key = getApiKey();
        if (!key || key === 'YOUR_API_KEY_HERE') { met_setError("API key required — set it in Settings."); return; }

        const fromStr = document.getElementById('met-from')?.value?.trim();
        const toStr   = document.getElementById('met-to')?.value?.trim();
        if (!fromStr || !toStr) { alert("Pick both dates."); return; }

        const toUTC = (y,m,d,h,mi,s)=>Math.floor(Date.UTC(y,m-1,d,h||0,mi||0,s||0)/1000);
        const startSec = toUTC(+fromStr.slice(0,4), +fromStr.slice(5,7), +fromStr.slice(8,10), 0,0,0);
        const endSec   = toUTC(+toStr.slice(0,4),   +toStr.slice(5,7),   +toStr.slice(8,10),   23,59,59);
        if (endSec < startSec) { alert('"To" must be \u2265 "From".'); return; }

        const btnRun  = document.getElementById('met-run');
        const btnStop = document.getElementById('met-stop');
        met_abortCtrl = new AbortController();
        if (btnRun) btnRun.disabled = true;
        if (btnStop) btnStop.disabled = false;
        met_setError("");

        try {
            const seenIds = new Set(); const collected = [];
            let cursorTo = endSec;

            while (cursorTo >= startSec) {
                if (met_abortCtrl.signal.aborted) throw new Error("Aborted");
                const { crimes } = await met_fetchCrimesBatch({ key, startSec, endSec: cursorTo, signal: met_abortCtrl.signal });
                const count = crimes.length;
                if (!count) break;
                for (const c of crimes) {
                    const id = c?.id;
                    if (id != null && !seenIds.has(id)) { seenIds.add(id); collected.push(c); }
                }
                if (count < MET_API_PAGE_CAP) break;
                const asc = [...new Set(crimes.map(c => c.executed_at))].sort((a,b)=>a-b);
                const min = asc[0], secondMin = asc.length >= 2 ? asc[1] : NaN;
                let nextTo = Number.isFinite(secondMin) ? secondMin : (min - 1);
                if (!(nextTo < cursorTo)) nextTo = cursorTo - 1;
                if (nextTo < startSec) break;
                cursorTo = nextTo;
                await met_delay(150);
            }

            const ranged = collected.filter(c => c.executed_at >= startSec && c.executed_at <= endSec);

            await met_ensureItemInfo(key);
            const idSet   = new Set(ranged.map(c => c.id));
            const maxPaid = met_getMaxPaidAt(ranged);
            const newsEnd = Number.isFinite(maxPaid) ? Math.max(endSec, maxPaid) : endSec;

            let ocExpenseMap = new Map();
            let paidToMembersByCrime = new Map();
            let grossTotalByCrime = new Map();
            try {
                const news = await met_fetchNewsExpenses({
                    key, startSec, endSec: newsEnd, includeCrimeIds: idSet, signal: met_abortCtrl.signal
                });
                paidToMembersByCrime = news.paidToMembersByCrime || new Map();
                grossTotalByCrime    = news.grossTotalByCrime    || new Map();
                ocExpenseMap = met_buildOcExpenseMap(ranged, paidToMembersByCrime);
            } catch {}

            const diffDays = Math.ceil(((endSec - startSec + 1) * 1000) / (24*3600*1000));
            const { totals } = met_aggregate(ranged);

            const { byKey: itemEstByKeyMV, total: itemEstTotalMV } = met_buildItemEstByKey(totals.ocBreakdown);
            const { byKey: itemEstByKeyPaid, total: itemEstTotalPaid } = met_buildOcTimeItemEstByKey(ranged, grossTotalByCrime);

            let totalIncome = 0; for (const b of totals.ocBreakdown.values()) totalIncome += Math.round(b.income || 0);
            let totalPaid   = 0; for (const v of ocExpenseMap.values()) totalPaid += Math.round(v || 0);

            const netTotalMV   = totalIncome + itemEstTotalMV   - totalPaid;
            const netTotalPaid = totalIncome + itemEstTotalPaid - totalPaid;

            met_lastRender = {
                totals, diffDays, totalPaid,
                ocExpenseMap,
                itemEstByKeyMV, netTotalMV,
                itemEstByKeyPaid, netTotalPaid,
            };

            const mode = met_getValueMode();
            met_renderFromCache(mode);
        } catch (e) {
            if (e?.message !== "Aborted") met_setError(e?.message || "Unexpected error.");
        } finally {
            if (btnRun)  btnRun.disabled = false;
            if (btnStop) btnStop.disabled = true;
        }
    }

    // --- Metrics tab initialization ---
    function met_initTab() {
        if (met_loaded) return;
        met_loaded = true;

        const container = document.getElementById('oc-tab-metrics');
        if (!container) return;

        // Set default date range (last 7 days)
        const now = new Date();
        const toY = now.getUTCFullYear(), toM = now.getUTCMonth()+1, toD = now.getUTCDate();
        const fromDate = new Date(Date.UTC(toY, toM-1, toD-6));
        const iso = (d) => d.getUTCFullYear() + '-' + String(d.getUTCMonth()+1).padStart(2,"0") + '-' + String(d.getUTCDate()).padStart(2,"0");

        container.innerHTML = ''
            + '<div class="met-controls">'
            + '  <div class="met-ctrl-row">'
            + '    <label class="met-label">From</label>'
            + '    <input type="date" id="met-from" class="met-date-input" value="' + iso(fromDate) + '"/>'
            + '    <label class="met-label">To</label>'
            + '    <input type="date" id="met-to" class="met-date-input" value="' + iso(now) + '"/>'
            + '    <span class="met-pill-seg" id="met-valuemode">'
            + '      <button type="button" data-mode="mv" class="met-seg-btn">Current MV</button>'
            + '      <button type="button" data-mode="paid" class="met-seg-btn">OC-Time</button>'
            + '    </span>'
            + '    <span id="met-status" style="color:#f87171;font-size:11px;display:none;margin-left:6px;"></span>'
            + '    <span class="met-ctrl-right">'
            + '      <button id="met-copy" class="met-btn" style="display:none;" title="Copy summary">Copy</button>'
            + '      <button id="met-stop" class="met-btn" title="Stop" disabled>\u25A0 Stop</button>'
            + '      <button id="met-run" class="met-btn met-btn-primary" title="Run">\u25B6 Run</button>'
            + '    </span>'
            + '  </div>'
            + '</div>'
            + '<div id="met-totals"></div>'
            + '<div id="met-ocbreak" style="margin-top:8px;">\u2014 Click Run to fetch metrics.</div>';

        // Wire up buttons
        document.getElementById('met-run')?.addEventListener('click', met_runQuery);
        document.getElementById('met-stop')?.addEventListener('click', () => met_abortCtrl?.abort());

        // Copy button
        document.getElementById('met-copy')?.addEventListener('click', (ev) => {
            const btn = ev.currentTarget;
            const txt = met_buildSummaryTSV();
            if (!txt) { met_setError("Nothing to copy yet."); return; }
            // TornPDA-compatible copy
            try {
                const ta = document.createElement('textarea');
                ta.value = txt; ta.style.cssText = 'position:fixed;left:-9999px;';
                document.body.appendChild(ta); ta.select();
                document.execCommand('copy'); document.body.removeChild(ta);
            } catch {}
            const prev = btn.textContent;
            btn.textContent = "Copied \u2713";
            btn.disabled = true;
            setTimeout(() => { btn.textContent = prev; btn.disabled = false; }, 2000);
        });

        // KPI click-to-copy
        document.getElementById('met-totals')?.addEventListener('click', (ev) => {
            const sel = window.getSelection ? String(window.getSelection()) : "";
            if (sel && sel.trim().length) return;
            const kpi = ev.target?.closest?.('.met-kpi');
            if (!kpi) return;
            const label = kpi.querySelector('.met-kpi-label')?.textContent?.trim() || "KPI";
            const value = kpi.querySelector('.met-kpi-value')?.textContent?.trim() || "";
            const sub   = kpi.querySelector('.met-kpi-sub')?.textContent?.trim() || "";
            const txt = sub ? label + "\t" + value + "\t" + sub : label + "\t" + value;
            try {
                const ta = document.createElement('textarea');
                ta.value = txt; ta.style.cssText = 'position:fixed;left:-9999px;';
                document.body.appendChild(ta); ta.select();
                document.execCommand('copy'); document.body.removeChild(ta);
            } catch {}
            kpi.style.outline = '2px solid #2d4a3e';
            kpi.style.filter = 'brightness(1.06)';
            setTimeout(() => { kpi.style.outline = ''; kpi.style.filter = ''; }, 1500);
        });

        // Value mode toggle
        const wrap = document.getElementById('met-valuemode');
        if (wrap) {
            const mode = met_getValueMode();
            wrap.querySelectorAll('.met-seg-btn').forEach(b => {
                b.classList.toggle('met-seg-active', b.getAttribute('data-mode') === mode);
            });
            wrap.addEventListener('click', (ev) => {
                const btn = ev.target?.closest?.('button[data-mode]');
                if (!btn) return;
                const next = btn.getAttribute('data-mode');
                if (next !== MET_VALUE_MODES.MV && next !== MET_VALUE_MODES.PAID) return;
                met_setValueMode(next);
                wrap.querySelectorAll('.met-seg-btn').forEach(b => {
                    b.classList.toggle('met-seg-active', b.getAttribute('data-mode') === next);
                });
                if (met_lastRender) met_renderFromCache(next);
            });
        }

        // Mobile expandable rows
        container.addEventListener('click', (ev) => {
            const row = ev.target?.closest?.('tr.met-main-row');
            if (!row) return;
            if (ev.target.closest('a')) return;
            const details = row.nextElementSibling;
            if (!details || !details.classList.contains('met-row-details')) return;
            const open = details.classList.contains('met-open');
            if (open) {
                details.classList.remove('met-open');
                row.setAttribute('aria-expanded', 'false');
            } else {
                details.classList.add('met-open');
                row.setAttribute('aria-expanded', 'true');
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  SCOPE SYNC  — push detected scope to server ASAP
    // ═══════════════════════════════════════════════════════════════════════
    function handleDetectedScope(scope, source) {
        // Always stamp the update time, even if the value didn't change —
        // so the UI can say "confirmed Xs ago" instead of looking stale.
        CONFIG._scopeUpdatedAt = Date.now();
        if (scope === null) return;
        if (scope === CONFIG.SCOPE) return;

        // v3.1.68: stability check. Torn's React re-renders the scope
        // badge during OC state transitions and we sometimes catch
        // intermediate values (e.g. 16 → 2 → 5 → 2 over 20s, all class-
        // matched). Delay the commit + push; if a new detection with a
        // different value lands inside the stability window we reset
        // the timer and the transient value gets dropped. Legitimate
        // scope changes (OC fill, OC fire) settle in < 2.5s so this
        // window is ~invisible for real edits.
        clearTimeout(scopePushTimer);
        const pendingValue = scope;
        const pendingSource = source;
        const pendingDetectSource = _lastScopeDetectSource;
        scopePushTimer = setTimeout(() => {
            // Guard in case another handleDetectedScope already committed
            // the same value before this timer fired.
            if (pendingValue === CONFIG.SCOPE) return;

            console.log(`[OC Spawn] Detected scope change: ${CONFIG.SCOPE} → ${pendingValue} (source: ${pendingSource})`);
            CONFIG.SCOPE = pendingValue;
            CONFIG._scopeAutoDetected = true;
            // Persist so a full page reload survives the detection.
            GM_setValue('cfg_scope', pendingValue);
            GM_setValue('cfg_scope_auto_ts', Date.now());
            // Update settings panel input
            const scopeEl = document.getElementById('cfg-scope');
            if (scopeEl) scopeEl.value = pendingValue;
            // Push to server with the strategy tag captured at detect time.
            const apiKey = getApiKey();
            if (apiKey && apiKey !== 'YOUR_API_KEY_HERE') {
                pushScopeOnly(apiKey, pendingValue, pendingDetectSource || pendingSource || 'auto');
            }
        }, 2500);
    }

    // Force a fresh scope read via Torn's public v2 faction API. Prior
    // implementation fired at the internal `step=getCrimesData` endpoint
    // and relied on the sandbox AJAX interceptor to extract scope_balance
    // from the response — brittle because (a) Torn's own crimes-page
    // XHRs fire in page-context and bypass sandbox wrappers, and (b) the
    // internal endpoint responds with HTML (not JSON) for sandbox-origin
    // requests, which broke parsing silently. Direct v2 API call is
    // deterministic and documented.
    // Scope refresh history (all found dead in 3.1.15–3.1.19):
    //   - Torn's public v2 API: neither `basic` nor `crimes?cat=available`
    //     selections expose scope_balance.
    //   - Internal /factions.php?step=getCrimesData: returns
    //     "Call to undefined method getCrimesData" — endpoint deleted.
    // Fallback: trust the DOM/state reader (setupScopeDomReader) which
    // reads unsafeWindow.torn.faction.scope_balance whenever Torn's
    // internal state is populated — i.e., whenever the user has loaded
    // any factions page. The scope strip shows detection age so stale
    // readings surface visibly. Users who want a fresh value just open
    // the crimes tab; Torn's own code repopulates the state there.
    function refreshScopeFromTorn() {
        // One-shot nudge to the DOM reader in case state is present but
        // hasn't been picked up yet (e.g. panel opened before MutationObserver
        // caught the relevant DOM change).
        const s = readScopeFromDom();
        if (s !== null) handleDetectedScope(s, 'DOM/State (manual refresh)');
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  AJAX INTERCEPTOR  — Catches internal Torn data (ASAP detection)
    // ═══════════════════════════════════════════════════════════════════════
    function setupAjaxInterceptor() {
        // v3.2.0: patch via unsafeWindow when available. Tampermonkey
        // runs the script in an isolated sandbox; patching the
        // sandbox's XMLHttpRequest.prototype has no effect on the
        // page's actual XHR — which is why every diag log on
        // organizedCrimes traffic was empty even though the wrapper
        // was being installed correctly. unsafeWindow gives us a
        // reference to the page's real window.
        const _W = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;
        try {
            console.log('[OC Spawn][interceptor] using',
                        _W === window ? 'sandbox window (will likely miss page traffic)'
                                      : 'unsafeWindow (page traffic visible)');
        } catch {}

        // Intercept XMLHttpRequest
        const oldOpen = _W.XMLHttpRequest.prototype.open;
        _W.XMLHttpRequest.prototype.open = function() {
            this.addEventListener('load', function() {
                if (this.responseURL.includes('step=getCrimesData')) {
                    try {
                        const data = JSON.parse(this.responseText);
                        const s = data?.scope_balance ?? data?.scope;
                        if (typeof s === 'number') handleDetectedScope(s, 'AJAX (XHR)');
                    } catch (e) {}
                }
                // v3.1.98+: checkpoint capture via XHR. Mirrors the
                // fetch-branch logic; either path may fire depending on
                // how Torn dispatches a given page.php POST.
                try {
                    const url = this.responseURL || '';
                    if (url.includes('sid=organizedCrimesData') &&
                        (url.includes('step=animation') || url.includes('step=crimeList'))) {
                        const data = JSON.parse(this.responseText);
                        if (data?.success) {
                            const scenarios = Array.isArray(data.data) ? data.data
                                            : (data.data && typeof data.data === 'object') ? [data.data]
                                            : null;
                            if (scenarios) {
                                // v3.2.4: filter out Planning/in-flight
                                // scenarios. The crimeList endpoint
                                // returns whatever tab Torn is rendering,
                                // so Planning view payloads dump 17+
                                // in-flight scenarios that would parse
                                // to zero records. Skipping at intercept
                                // keeps the console quiet and saves the
                                // parser walk.
                                const completed = scenarios.filter(s => {
                                    const st = String(s?.status || '');
                                    return st === 'Successful' || st === 'Failed';
                                });
                                if (completed.length === 0) return;
                                console.log('[OC Spawn][checkpoints] intercepted (XHR)',
                                            url.includes('step=animation') ? 'animation' : 'crimeList',
                                            completed.length, 'completed');
                                captureCompletedScenarios(completed);
                            }
                        }
                    }
                } catch (_) {}
            });
            return oldOpen.apply(this, arguments);
        };

        // Intercept Fetch
        const oldFetch = _W.fetch;
        _W.fetch = function() {
            const args = arguments;
            const p = oldFetch.apply(this, args);
            p.then(res => {
                try {
                    const url = args[0] instanceof Request ? args[0].url : args[0];
                    if (url && url.includes('step=getCrimesData')) {
                        res.clone().json().then(data => {
                            const s = data?.scope_balance ?? data?.scope;
                            if (typeof s === 'number') handleDetectedScope(s, 'AJAX (Fetch)');
                        }).catch(() => {});
                    }
                    // v3.1.97: per-checkpoint attribution. Two Torn
                    // endpoints carry the data we need:
                    //   step=animation — fired when the user opens a
                    //     specific completed crime; response carries the
                    //     full scenario.scenes[].dialogues[] with
                    //     `[A<n>-C<m>P|F]` slugs and `userId-<id>`
                    //     placeholders in descriptions (most reliable
                    //     attribution source — exact IDs, not name match).
                    //   step=crimeList — list view; sometimes carries
                    //     scenario detail too. Match it loosely; parser
                    //     no-ops on entries that lack dialogue data.
                    //
                    // We don't filter on body fields any more — the old
                    // `group=Completed` check never matched what Torn
                    // actually sends, which is why the data dir stayed
                    // empty for two weeks.
                    if (url && url.includes('sid=organizedCrimesData') &&
                        (url.includes('step=animation') || url.includes('step=crimeList'))) {
                        res.clone().json().then(data => {
                            if (!data?.success) return;
                            const scenarios = Array.isArray(data.data) ? data.data
                                            : (data.data && typeof data.data === 'object') ? [data.data]
                                            : null;
                            if (!scenarios) return;
                            // v3.2.4: see XHR branch — filter out
                            // Planning/in-flight scenarios so we don't
                            // walk 17 no-op scenarios and log a
                            // misleading "17 scenario(s)" line on
                            // Planning navigation.
                            const completed = scenarios.filter(s => {
                                const st = String(s?.status || '');
                                return st === 'Successful' || st === 'Failed';
                            });
                            if (completed.length === 0) return;
                            try {
                                console.log('[OC Spawn][checkpoints] intercepted (fetch)',
                                            url.includes('step=animation') ? 'animation' : 'crimeList',
                                            completed.length, 'completed');
                            } catch {}
                            captureCompletedScenarios(completed);
                        }).catch(() => {});
                    }
                } catch (e) {}
            }).catch(() => {}); // never swallow the original rejection
            return p; // return original promise chain untouched
        };
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PER-CHECKPOINT ATTRIBUTION  — parses [C\d+-P/F] markers from the
    //  page-level Completed-group response and uploads to warboard. Cold-
    //  start: only captures crimes the user actually expands on the
    //  Completed tab. No backfill possible (page-level data is the only
    //  source; not exposed via /v2/faction API).
    // ═══════════════════════════════════════════════════════════════════════
    const _UPLOADED_KEY = 'oc_checkpoint_uploaded';
    const _UPLOADED_TTL_MS = 30 * 86400000; // remember 30 days; prevents
                                            // re-POST on every page load
    function _getUploadedSet() {
        try {
            const raw = GM_getValue(_UPLOADED_KEY, '{}');
            const obj = JSON.parse(raw);
            const cutoff = Date.now() - _UPLOADED_TTL_MS;
            const fresh = {};
            for (const [sid, ts] of Object.entries(obj)) {
                if (Number(ts) > cutoff) fresh[sid] = ts;
            }
            return fresh;
        } catch { return {}; }
    }
    function _markUploaded(sid) {
        const m = _getUploadedSet();
        m[String(sid)] = Date.now();
        try { GM_setValue(_UPLOADED_KEY, JSON.stringify(m)); } catch {}
    }

    /**
     * Parse one Torn page-level scenario object into the structured
     * shape the warboard server expects. Returns null if the scenario
     * has no parseable checkpoint outcomes.
     *
     * Real-world response shape (verified 2026-05-12 from animation
     * endpoint):
     *   { ID, status, playerSlots: [{key, name (role), player: {ID, name}}],
     *     scenario: { name, scenes: [{ slug, dialogues: [{ id, description }] }] } }
     *
     * Dialogue id format: `[A<act>-C<cp>]` (setup/event), `[A<act>-C<cp>P]`
     * (pass), `[A<act>-C<cp>F]` (fail). Descriptions reference players
     * via `userId-<numericID>` placeholders — exact ID, no name parsing.
     *
     * Attribution: outcome dialogue's first userId, fallback to the
     * setup dialogue's first userId for the same checkpoint. If a
     * checkpoint references a player not in this OC's slots, skip
     * them. If multiple userIds appear in one dialogue, ALL of them
     * get a record so collaborative checkpoints credit/blame each
     * actor.
     *
     * Checkpoint numbering is chronological across acts (server-side
     * key format is `C${n}` and the Coaching tab displays C1/C2/C3...
     * — preserves the existing schema).
     */
    function parseScenario(scenario) {
        if (!scenario || !scenario.ID) return null;
        const slots = Array.isArray(scenario.playerSlots) ? scenario.playerSlots : [];
        const roleByPlayerId = new Map();
        for (const s of slots) {
            const pid = s?.player?.ID;
            if (!pid) continue;
            roleByPlayerId.set(String(pid), String(s.name || s.key || ''));
        }
        if (roleByPlayerId.size === 0) return null;

        const checkpoints = [];
        let cpCounter = 0;
        const setupActorsBySlug = new Map();

        const scenes = Array.isArray(scenario?.scenario?.scenes) ? scenario.scenario.scenes : [];
        for (const scene of scenes) {
            const dialogues = Array.isArray(scene?.dialogues) ? scene.dialogues : [];
            for (const d of dialogues) {
                const slug = String(d?.id || d?.slug || '').replace(/^\[|\]$/g, '');
                const desc = String(d?.description || '');
                const ids = [...desc.matchAll(/userId-(\d+)/g)].map(m => m[1]);

                const setupMatch = slug.match(/^A\d+-C\d+$/);
                const outcomeMatch = slug.match(/^(A\d+-C\d+)([PF])$/);

                if (setupMatch) {
                    if (ids.length) setupActorsBySlug.set(slug, ids);
                    continue;
                }
                if (!outcomeMatch) continue;

                const baseSlug = outcomeMatch[1];
                const outcome = outcomeMatch[2];
                cpCounter += 1;

                let actors = ids;
                if (!actors.length) actors = setupActorsBySlug.get(baseSlug) || [];
                if (!actors.length) continue;

                for (const pid of actors) {
                    const role = roleByPlayerId.get(pid);
                    if (!role) continue;
                    checkpoints.push({
                        checkpoint: cpCounter,
                        outcome,
                        playerId: pid,
                        role,
                    });
                }
            }
        }
        if (checkpoints.length === 0) return null;
        return {
            id: String(scenario.ID),
            name: String(scenario?.scenario?.name || ''),
            executedAt: Number(scenario?.expiresAt) || 0,
            checkpoints,
        };
    }

    // v3.2.5: coalescing toast for checkpoint uploads. Page load
    // often fires crimeList 3-4 times in rapid succession (one per
    // Torn re-render), so we accumulate the new-scenario/new-
    // checkpoint counts and flush a single toast 800ms after the
    // last upload settles. Toast itself fades after 4s and is
    // tap-to-dismiss.
    // v3.2.6: toast fires on EVERY successful intercept of completed
    // crimes — even when no new data was uploaded — so the user has
    // visible confirmation the system is alive. Two visual variants:
    //   - new data > 0   → bold green toast, 4s
    //   - new data === 0 → small grey "checked, no new" toast, 2s
    // Coalesces multiple intercepts within 800ms into one toast.
    let _toastState = {
        scenarios: 0, checkpoints: 0, total: 0,
        checked: 0,                  // running tally of "intercepted but already-known" crimes
        lastKnownTotal: 0,           // last total reported by server, for "no new" displays
        timer: null, el: null,
    };
    function _showCheckpointToast(newScenarios, newCheckpoints, factionTotal, checkedCount) {
        _toastState.scenarios += (newScenarios || 0);
        _toastState.checkpoints += (newCheckpoints || 0);
        _toastState.checked += (checkedCount || 0);
        if (factionTotal != null) {
            _toastState.total = factionTotal;
            _toastState.lastKnownTotal = factionTotal;
        }
        if (_toastState.timer) clearTimeout(_toastState.timer);
        _toastState.timer = setTimeout(_flushCheckpointToast, 800);
    }
    function _flushCheckpointToast() {
        const { scenarios, checkpoints, checked, total, lastKnownTotal } = _toastState;
        _toastState.scenarios = 0;
        _toastState.checkpoints = 0;
        _toastState.checked = 0;
        _toastState.timer = null;
        if (scenarios === 0 && checked === 0) return;
        // Remove any existing toast (avoid stacking).
        if (_toastState.el && _toastState.el.parentNode) {
            _toastState.el.parentNode.removeChild(_toastState.el);
        }
        const hasNew = scenarios > 0;
        const el = document.createElement('div');
        el.id = 'oc-checkpoint-toast';
        const accent = hasNew ? '#74c69d' : '#6b7280';
        const padding = hasNew ? '10px 14px' : '7px 12px';
        const maxW = hasNew ? '300px' : '240px';
        const fontSize = hasNew ? '12px' : '11px';
        el.style.cssText = [
            'position:fixed', 'bottom:24px', 'right:24px', 'z-index:999999',
            'background:#131f18', 'border:1px solid #2d4a3e', `border-left:3px solid ${accent}`,
            'border-radius:6px', `padding:${padding}`, `font-size:${fontSize}`,
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
            'color:#d1d5db', 'box-shadow:0 4px 20px rgba(0,0,0,0.7)',
            'cursor:pointer', 'opacity:0', 'transition:opacity 200ms ease-out',
            `max-width:${maxW}`, 'line-height:1.4',
        ].join(';');
        if (hasNew) {
            const ocLabel = scenarios === 1 ? 'crime' : 'crimes';
            const cpLabel = checkpoints === 1 ? 'checkpoint' : 'checkpoints';
            el.innerHTML =
                `<div style="font-weight:600;color:${accent};font-size:11px;letter-spacing:0.3px;text-transform:uppercase;margin-bottom:3px;">Coaching data updated</div>` +
                `<div><b style="color:#f3f4f6;">${scenarios}</b> new ${ocLabel} · <b style="color:#f3f4f6;">${checkpoints}</b> ${cpLabel}</div>` +
                `<div style="color:#6b7280;font-size:10px;margin-top:3px;">Faction total: ${(total || 0).toLocaleString()} records</div>`;
        } else {
            // No-new variant — short, dim, auto-fades faster.
            const ocLabel = checked === 1 ? 'crime' : 'crimes';
            const totalLine = lastKnownTotal > 0
                ? ` · Total: ${lastKnownTotal.toLocaleString()}`
                : '';
            el.innerHTML =
                `<div style="color:#9ca3af;">Coaching: checked <b style="color:#d1d5db;">${checked}</b> ${ocLabel}, no new data${totalLine}</div>`;
        }
        document.body.appendChild(el);
        _toastState.el = el;
        requestAnimationFrame(() => { el.style.opacity = '1'; });
        const hide = () => {
            el.style.opacity = '0';
            setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
            if (_toastState.el === el) _toastState.el = null;
        };
        el.addEventListener('click', hide);
        setTimeout(hide, hasNew ? 4000 : 2000);
    }

    // v3.2.7: per-user localStorage cache of player ID → name. Lets the
    // Coaching tab show real names for ex-faction-members whose checkpoint
    // history is still in the server data but who aren't in the current
    // member roster. Populated as a side effect of every intercept (we have
    // the names in scenario.playerSlots; just stash them).
    const _PLAYER_NAMES_KEY = 'oc_player_names';
    function _getPlayerNames() {
        try { return JSON.parse(GM_getValue(_PLAYER_NAMES_KEY, '{}')) || {}; }
        catch { return {}; }
    }
    function _stashPlayerNamesFromScenarios(rawScenarios) {
        try {
            const map = _getPlayerNames();
            let added = 0;
            for (const raw of rawScenarios) {
                const slots = Array.isArray(raw?.playerSlots) ? raw.playerSlots : [];
                for (const s of slots) {
                    const id = s?.player?.ID;
                    const name = s?.player?.name;
                    if (id == null || !name) continue;
                    const key = String(id);
                    if (map[key] !== name) {
                        map[key] = String(name).slice(0, 40);
                        added++;
                    }
                }
            }
            if (added > 0) {
                GM_setValue(_PLAYER_NAMES_KEY, JSON.stringify(map));
            }
        } catch (_) {}
    }

    function captureCompletedScenarios(rawScenarios) {
        const apiKey = getApiKey();
        if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') return;
        // v3.2.7: stash player names regardless of upload outcome — even
        // already-known scenarios are useful for filling in ex-member names.
        _stashPlayerNamesFromScenarios(rawScenarios);
        const uploaded = _getUploadedSet();
        const fresh = [];
        for (const raw of rawScenarios) {
            const sid = String(raw?.ID || '');
            if (!sid || uploaded[sid]) continue;
            const parsed = parseScenario(raw);
            if (parsed) fresh.push(parsed);
        }
        // v3.2.6: if nothing fresh, surface a "no new data" toast so the
        // user gets visible confirmation the intercept happened. Use the
        // count of completed scenarios in the payload so the user sees
        // "checked N crimes" rather than 0.
        if (fresh.length === 0) {
            _showCheckpointToast(0, 0, null, rawScenarios.length || 0);
            return;
        }
        const url = SERVER + '/api/oc/checkpoint-history?key=' + encodeURIComponent(apiKey);
        const body = JSON.stringify({ scenarios: fresh });
        if (typeof GM_xmlhttpRequest === 'function') {
            GM_xmlhttpRequest({
                method: 'POST', url, data: body,
                headers: { 'Content-Type': 'application/json' },
                onload: (resp) => {
                    if (resp.status >= 200 && resp.status < 300) {
                        for (const s of fresh) _markUploaded(s.id);
                        try {
                            const r = JSON.parse(resp.responseText);
                            const newCount = r.scenariosNew || 0;
                            const newCps = r.checkpointsNew || 0;
                            // Always toast — green when new, grey when none.
                            // "Checked" count = total scenarios in this
                            // intercept's payload (matches user mental model).
                            const checked = (rawScenarios.length || 0) - newCount;
                            if (newCount > 0) {
                                console.log(`[OC Spawn][checkpoints] uploaded ${newCount} new scenarios (${newCps} checkpoints), faction total: ${r.total}`);
                            }
                            _showCheckpointToast(newCount, newCps, r.total, Math.max(0, checked));
                        } catch (_) {}
                    }
                },
                onerror: () => {},
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  DOM SCOPE READER  — fallback / secondary detection
    // ═══════════════════════════════════════════════════════════════════════
    // v3.1.53: module-level tag so the last detected strategy propagates
    // to the push path without threading a return tuple through callers.
    // v3.1.57: null sentinel (not 'auto') so the `||` chain in pushScopeOnly
    // actually falls through to the caller-supplied `source` arg for AJAX-
    // path detections. Previously a truthy default masked every non-DOM
    // source and the audit log always showed 'auto'.
    let _lastScopeDetectSource = null;
    function readScopeFromDom() {
        // Strategy 0: Torn's internal state (authoritative when populated).
        const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
        if (win.torn && win.torn.faction) {
             const s = win.torn.faction.scope_balance ?? win.torn.faction.scope;
             if (typeof s === 'number' && s >= 0 && s <= SCOPE_MAX) {
                 console.debug('[OC Spawn][scope] strategy 0 (state):', s);
                 _lastScopeDetectSource = 'state';
                 return s;
             }
        }

        // Helper: is this element actually visible to the user right now?
        // Torn hides inactive tabs via display:none; we don't want to
        // scrape scope numbers from a hidden Recruiting panel while the
        // user is on Planning.
        function visible(el) {
            if (!el) return false;
            if (!el.offsetParent && el.tagName !== 'BODY') return false;
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        }

        // v3.1.69: reject scope elements inside a completed-crime reward
        // block. Torn's Completed tab shows "+N scope" chips per OC
        // (e.g. Pet Project +2 scope) whose wrapper class also contains
        // the word "scope", so strategy 1 was scraping per-OC rewards
        // and pushing them as if they were the faction's current scope
        // balance. Walk up the ancestors and bail if we're nested inside
        // anything tagged completed / executed / ending / reward / payout.
        function insideCompletedContext(el) {
            for (let p = el; p; p = p.parentElement) {
                const cls = String(p.className || '').toLowerCase();
                if (!cls) continue;
                if (/completed|executed|ended|reward|payout|result|history/.test(cls)) return true;
            }
            return false;
        }

        // Strategy 1: element whose class contains 'scope' (visible only).
        const byClass = document.querySelectorAll('[class*="scope" i]:not(#oc-spawn-panel *)');
        for (const el of byClass) {
            if (!visible(el)) continue;
            if (insideCompletedContext(el)) continue;
            const num = parseInt(el.textContent.trim());
            if (!isNaN(num) && num >= 0 && num <= SCOPE_MAX) {
                console.debug('[OC Spawn][scope] strategy 1 (class):', num, '·', el.className);
                _lastScopeDetectSource = 'class:' + String(el.className || '').slice(0, 24);
                return num;
            }
            const numChild = el.querySelector('span, b, strong');
            if (numChild && visible(numChild)) {
                const n2 = parseInt(numChild.textContent.trim());
                if (!isNaN(n2) && n2 >= 0 && n2 <= SCOPE_MAX) {
                    console.debug('[OC Spawn][scope] strategy 1 (class-child):', n2, '·', el.className);
                    _lastScopeDetectSource = 'class-child:' + String(el.className || '').slice(0, 20);
                    return n2;
                }
            }
        }

        // Strategy 2: text matching a strict scope label. v3.2.3
        // tightened after a false positive on a Completed-tab chip
        // whose concatenated textContent (`Best of the Lot 2/4 ...
        // scope ... 1`) matched the old lax regex
        // `/scope[\s\w:]*?(\d+)/i` and pushed scope=1 over the real
        // value of 33. Three new guards:
        //   1. text length ≤ 40 chars (chip text with crime names is
        //      always longer)
        //   2. text has at most one number group (chips have a
        //      reward count AND a success ratio)
        //   3. regex requires the digit IMMEDIATELY adjacent to the
        //      "scope" / "scope balance" / "current scope" label with
        //      ≤3 chars of separator
        const candidates = document.querySelectorAll('span, div, p, li');
        for (const el of candidates) {
            if (el.closest('#oc-spawn-panel')) continue;
            if (el.children.length > 2) continue;
            if (!visible(el)) continue;
            if (insideCompletedContext(el)) continue;
            const text = el.textContent.trim();
            if (text.length > 40) continue;
            const digitGroups = (text.match(/\d+/g) || []).length;
            if (digitGroups > 1) continue;
            const m = text.match(/\b(?:current\s+)?(?:scope\s*balance|scope)\s*[:\s]\s*(\d+)\b/i);
            if (!m) continue;
            const val = parseInt(m[1]);
            if (val >= 0 && val <= SCOPE_MAX) {
                console.debug('[OC Spawn][scope] strategy 2 (text):', val, '·', text.slice(0, 60));
                _lastScopeDetectSource = 'text:' + text.slice(0, 24);
                return val;
            }
        }
        return null;
    }

    function setupScopeDomReader() {
        function check() {
            const s = readScopeFromDom();
            if (s !== null) handleDetectedScope(s, 'DOM/State');
        }
        let timer = null;
        function scheduleCheck() {
            if (timer) return; // coalesce mutation bursts into one trailing call
            timer = setTimeout(() => { timer = null; check(); }, 500);
        }
        check();
        const observer = new MutationObserver(scheduleCheck);
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  API KEY
    // ═══════════════════════════════════════════════════════════════════════
    function getApiKey() {
        const saved = GM_getValue('oc_spawn_api_key', '');
        if (saved) return saved;
        if (typeof window.localAPIkey === 'string' && window.localAPIkey.length > 0)
            return window.localAPIkey;
        return CONFIG.API_KEY;
    }
    function saveApiKey(key) { GM_setValue('oc_spawn_api_key', key.trim()); }

    // ═══════════════════════════════════════════════════════════════════════
    //  GENERIC REQUEST  — GM_xmlhttpRequest (TornPDA) or fetch
    // ═══════════════════════════════════════════════════════════════════════
    function gmRequest(url, timeoutMs = 15000) {
        if (typeof GM_xmlhttpRequest === 'function') {
            return new Promise((resolve, reject) => {
                let settled = false;
                const guard = setTimeout(() => { if (!settled) { settled = true; reject(new Error('Request timed out — tornwar.com is slow, try again')); } }, timeoutMs + 2000);
                GM_xmlhttpRequest({
                    method: 'GET', url, timeout: timeoutMs,
                    onload(r) {
                        if (settled) return; settled = true; clearTimeout(guard);
                        try {
                            const data = JSON.parse(r.responseText);
                            resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, data });
                        } catch (e) {
                            const msg = r.status === 502 || r.status === 503
                                ? 'Server temporarily unavailable — wait a moment and try again'
                                : `Unexpected server response (${r.status})`;
                            resolve({ ok: false, status: r.status, data: { error: msg } });
                        }
                    },
                    ontimeout() { if (settled) return; settled = true; clearTimeout(guard); reject(new Error('Request timed out — tornwar.com is slow, try again')); },
                    onerror() { if (settled) return; settled = true; clearTimeout(guard); reject(new Error('Network error — could not reach tornwar.com')); },
                });
            });
        }
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);
        return fetch(url, { signal: ctrl.signal }).then(async r => {
            clearTimeout(t);
            const text = await r.text();
            try { return { ok: r.ok, status: r.status, data: JSON.parse(text) }; }
            catch (e) {
                const msg = r.status === 502 || r.status === 503
                    ? 'Server temporarily unavailable — wait a moment and try again'
                    : `Unexpected server response (${r.status})`;
                return { ok: false, status: r.status, data: { error: msg } };
            }
        }, (err) => {
            clearTimeout(t);
            throw new Error(err && err.name === 'AbortError' ? 'Request timed out — tornwar.com is slow, try again' : 'Network error — could not reach tornwar.com');
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  OC MANAGER  — constants, state, and core logic
    // ═══════════════════════════════════════════════════════════════════════
    const BLACKLISTED_ITEM_IDS = new Set([226]);
    const mgr_memberNameMap = new Map();
    let   mgr_membersLoaded = false;
    const mgr_armoryCache   = new Map();
    let   mgr_lastRefreshTime = 0;
    const MGR_REFRESH_COOLDOWN_MS = 10000;
    const mgr_recentlyLoaned = new Map(); // Map<string (UID), Set<number (IID)>>
    // v3.1.79: per-row "✓ Has it" admin override. Same shape as
    // mgr_recentlyLoaned but populated by an explicit admin click or
    // (v3.1.87+) by the DOM auto-detect of Torn's orange no-item SVG.
    //
    // v3.1.89: now mirrored server-side via /api/oc/missing-override —
    // POST when we add an override locally; GET on every Missing tab
    // load to merge in any overrides recorded by other admins or by
    // our own previous sessions. Two effects:
    //   1) Persists across page navigation (the DOM auto-detect needs
    //      the OC list rendered to fire; once admin leaves crime page,
    //      DOM-only overrides would lapse — server-side keeps them).
    //   2) Shared with other admins in the faction so multiple bankers
    //      reviewing Missing don't all see the same false-positive.
    // Server TTL is 30 min; entries auto-clear before next OC scope.
    const mgr_haveItOverride = new Map(); // Map<string (UID), Set<number (IID)>>
    /** Track which overrides we've already POSTed in this session so
     *  we don't fire the same POST repeatedly (auto-detect runs on
     *  every Missing tab load). Keys: "uid:iid". */
    const mgr_haveItPosted = new Set();

    // v3.1.80: auto-detect "user has the item bound" via Torn's React
    // state / page DOM. If found, treat it the same as a manual ✓ Has it
    // click — filter the row out of Missing. Best-effort; falls back to
    // the manual button if it can't read state.

    // v3.1.86: read each slot's WRAPPER state class. Confirmed Torn
    // renders the wrapper as e.g.
    //   div.wrapper___Lpz_D.successGreen___EPVxn
    // and the inner slotBody as
    //   div.slotBody___oxizq.validSlot___n6ueL
    // when the slot is in a satisfied state. Color suffixes
    // (successGreen / successYellow / successRed) and validSlot vs
    // (presumably) invalidSlot are the per-state hints. We just dump
    // the class strings and let the user look at the data before
    // deciding what to filter on.
    // v3.1.87: detect the orange "no-item" SVG indicator that Torn
    // draws on slot icons whose required item isn't bound. Confirmed
    // shape:
    //   .slotIcon___VVnQy > svg > g > path[fill="#ff794c"]
    // (Bound slots show a div.planning___ with conic-gradient instead;
    // no SVG at all.)
    //
    // Returns Set of "userID:position(lowercase)" for slots whose DOM
    // currently shows the missing-item icon. The filter logic in
    // mgr_loadMissingTab uses this to distinguish genuine API Missing
    // entries from API false-positives: if a slot is rendered AND
    // doesn't have this icon, it's a false positive (the user has
    // the item, Torn API just hasn't caught up).
    function mgr_scrapeSlotMissingIndicators() {
        const flagged = new Set();
        try {
            const headers = document.querySelectorAll('[class*="slotHeader___"]');
            for (const header of headers) {
                const slotIcon = header.querySelector('[class*="slotIcon___"]');
                if (!slotIcon) continue;
                const path = slotIcon.querySelector('svg path');
                const fill = path?.getAttribute('fill') || '';
                // Torn's no-item icon uses fill="#ff794c". Any other
                // (or no) SVG in slotIcon means a different state.
                if (fill.toLowerCase() !== '#ff794c') continue;
                // Resolve (userID, position) for this slot
                const titleEl = header.querySelector('[class*="title___"]');
                const position = titleEl?.textContent?.trim().toLowerCase() || '';
                let walkEl = header.parentElement;
                let userID = null, walked = 0;
                while (walkEl && walked < 6 && !userID) {
                    const link = walkEl.querySelector('a[href*="XID="]');
                    if (link) {
                        const m = link.getAttribute('href').match(/XID=(\d+)/);
                        if (m) userID = m[1];
                    }
                    if (!userID) walkEl = walkEl.parentElement;
                    walked++;
                }
                if (userID && position) flagged.add(`${userID}:${position}`);
            }
        } catch (e) { console.warn('[OC Mgr] missing-icon scrape error:', e?.message); }
        return flagged;
    }

    function mgr_scrapeSlotIconStates() {
        const out = []; // [{ userID, position, deg, innerClass, wrapperClass, bodyClass, slotIconHTML }]
        try {
            const headers = document.querySelectorAll('[class*="slotHeader___"]');
            for (const header of headers) {
                const wrapperEl = header.parentElement;
                const wrapperClass = wrapperEl?.className || '';
                const bodyEl = header.nextElementSibling;
                const bodyClass = bodyEl?.className || '';
                const slotIcon = header.querySelector('[class*="slotIcon___"]');
                const inner = slotIcon?.firstElementChild;
                const innerClass = inner?.className || '';
                const innerTag  = inner?.tagName || '';
                const style = inner?.getAttribute('style') || '';
                const degMatches = [...style.matchAll(/(-?\d+(?:\.\d+)?)deg/g)];
                const deg = degMatches.length ? parseFloat(degMatches[degMatches.length - 1][1]) : null;
                // v3.1.87: capture the slotIcon's COMPLETE outerHTML so we
                // can inspect what changes when the user "doesn't have
                // the item." Caps at 800 chars to keep console output
                // readable.
                const slotIconHTML = slotIcon?.outerHTML?.slice(0, 800) || '';
                const titleEl = header.querySelector('[class*="title___"]');
                const position = titleEl?.textContent?.trim() || null;
                let walkEl = wrapperEl;
                let userID = null, walked = 0;
                while (walkEl && walked < 6 && !userID) {
                    const link = walkEl.querySelector('a[href*="XID="]');
                    if (link) {
                        const m = link.getAttribute('href').match(/XID=(\d+)/);
                        if (m) userID = m[1];
                    }
                    if (!userID) walkEl = walkEl.parentElement;
                    walked++;
                }
                out.push({ userID, position, deg, innerTag, innerClass, wrapperClass, bodyClass, slotIconHTML });
            }
        } catch (e) { console.warn('[OC Mgr] slot scrape error:', e?.message); }
        return out;
    }

    // v3.1.85: scrape Torn's per-slot Success Chance % from the OC page
    // DOM. Returns Map<"userID:positionLowercase", { successPct: number,
    // headerEl: Element }>. Used as authoritative state for "is this
    // slot satisfied" — high success% = item bound + member qualifies;
    // ~0% = something's missing.
    //
    // Class pattern (Torn's React CSS modules — hashed suffix):
    //   .slotHeader___ABCDE  ← per-slot header button
    //     .slotIcon___...
    //     .title___...        ← position name (e.g. "Thief")
    //     .successChance___…  ← "12%"
    //   parent → slot wrapper containing the player profile link
    function mgr_scrapeSlotSuccessChance() {
        const out = new Map();
        try {
            const headers = document.querySelectorAll('[class*="slotHeader___"]');
            for (const header of headers) {
                // Position from the title__ span inside the header.
                // v3.2.17: strip '#N' suffix so 'Muscle #1', 'Muscle #2',
                // 'Muscle #3' all key as 'muscle' — matches what the
                // server-side slot-composition lookup uses (s.position
                // is the bare label without numbering). Without this
                // strip, multi-slot positions in crimes like Stage Fright
                // (3× Muscle) had their successPct silently dropped as
                // 'unmatched' because the (uid, 'muscle #1') key didn't
                // match the server's (uid, 'muscle') composition entry.
                const titleEl = header.querySelector('[class*="title___"]');
                const positionRaw = titleEl?.textContent?.trim().toLowerCase() || '';
                const position = positionRaw.replace(/\s*#\d+$/, '');
                // Success chance from the successChance__ child
                const scEl = header.querySelector('[class*="successChance___"]');
                const scText = scEl?.textContent?.trim() || '';
                const scMatch = scText.match(/(-?\d+(?:\.\d+)?)/);
                const successPct = scMatch ? parseFloat(scMatch[1]) : 0;
                // Player ID — walk up from header to the slot wrapper
                // and ALSO try to find the enclosing crime ID. React
                // hashes class names so we can't target the crime card
                // directly; walk up looking for an href / hash that
                // contains crimeId=<n>.
                let wrapper = header.parentElement;
                let userID = null;
                let crimeId = null;
                let walked = 0;
                while (wrapper && walked < 12 && !(userID && crimeId)) {
                    if (!userID) {
                        const link = wrapper.querySelector('a[href*="XID="]');
                        if (link) {
                            const m = link.getAttribute('href').match(/XID=(\d+)/);
                            if (m) userID = m[1];
                        }
                    }
                    if (!crimeId) {
                        // Crime ID can appear in: hash anchors, data
                        // attributes, or our own dispatcher banner data.
                        const cidLink = wrapper.querySelector('a[href*="crimeId="]');
                        if (cidLink) {
                            const m = cidLink.getAttribute('href').match(/crimeId=(\d+)/);
                            if (m) crimeId = m[1];
                        }
                        if (!crimeId && wrapper.dataset?.crimeId) crimeId = wrapper.dataset.crimeId;
                    }
                    wrapper = wrapper.parentElement;
                    walked++;
                }
                // v3.2.11: fallback — when only one crime card is
                // expanded, the URL hash holds crimeId. Use it for any
                // slot we couldn't tag via DOM-walk.
                if (!crimeId) {
                    const hashMatch = window.location.hash.match(/crimeId=(\d+)/);
                    if (hashMatch) crimeId = hashMatch[1];
                }
                if (userID && position) {
                    out.set(`${userID}:${position}`, { successPct, headerEl: header, crimeId });
                }
            }
        } catch (e) {
            console.warn('[OC Mgr] slot scrape error:', e?.message);
        }
        return out;
    }

    // v3.2.11: scrape the per-slot Success Chance % from the OC page
    // DOM and POST to the server so the failure-risk engine can use
    // Torn's authoritative number instead of CPR/history estimation.
    // Throttled to once per 30s; only POSTs slots tagged with a crime
    // ID. Server entries TTL 30 min.
    let _liveSuccessLastPost = 0;
    function pushLiveSuccessChances() {
        if (Date.now() - _liveSuccessLastPost < 30_000) return;
        const scraped = mgr_scrapeSlotSuccessChance();
        if (!scraped.size) {
            console.log('[OC live-success] scraped 0 slots (DOM not ready)');
            return;
        }
        const apiKey = getApiKey();
        if (!apiKey) { console.log('[OC live-success] no api key'); return; }

        // v3.2.13: resolve crime IDs by matching (userID, position) against
        // the cached server crime list — DOM walk for crimeId href fails
        // on the OC list page where crimes aren't expanded. Each placed
        // (userId, position) combo usually maps to exactly one crime; if
        // ambiguous (member in multiple OCs at same position) we skip.
        const slotToCrime = new Map(); // "uid::position" → [crimeId, ...]
        for (const crime of _lastAvailableCrimes) {
            for (const s of (crime.slots || [])) {
                const uid = String(s.user_id || s.user?.id || '');
                if (!uid) continue;
                const pos = String(s.position || '').toLowerCase();
                const k = `${uid}:${pos}`;
                if (!slotToCrime.has(k)) slotToCrime.set(k, []);
                slotToCrime.get(k).push(crime.id);
            }
        }

        const byCrime = new Map();
        let droppedNoCrime = 0, droppedAmbiguous = 0;
        for (const [key, val] of scraped) {
            if (!Number.isFinite(val.successPct)) { droppedNoCrime++; continue; }
            // Prefer DOM-walk crimeId if we got one; else look up via cache.
            let crimeId = val.crimeId;
            if (!crimeId) {
                const matches = slotToCrime.get(key);
                if (!matches || matches.length === 0) { droppedNoCrime++; continue; }
                if (matches.length > 1) { droppedAmbiguous++; continue; }
                crimeId = matches[0];
            }
            const [userID, position] = key.split(':');
            const list = byCrime.get(crimeId) || [];
            list.push({ uid: userID, position, successPct: val.successPct });
            byCrime.set(crimeId, list);
        }
        console.log(`[OC live-success] scraped ${scraped.size} slot(s); ${byCrime.size} crime(s) resolved; dropped ${droppedNoCrime} (unmatched) + ${droppedAmbiguous} (ambiguous)`);
        if (!byCrime.size) {
            console.log('[OC live-success] no slots could be resolved to crimes — _lastAvailableCrimes has', _lastAvailableCrimes.length, 'crime(s). Run a Refresh first, then try again.');
            return;
        }
        _liveSuccessLastPost = Date.now();
        const post = (crimeId, slots) => {
            // v3.2.13: use SERVER (the actual constant), not the
            // undefined CONFIG.SERVER_URL — that bug silently sent
            // POSTs to 'undefined/api/oc/live-success' on every tick.
            const url = `${SERVER}/api/oc/live-success?key=${encodeURIComponent(apiKey)}`;
            const body = JSON.stringify({ crimeId, slots });
            const onload = (res) => {
                console.log('[OC live-success] POST crime=' + crimeId + ' slots=' + slots.length + ' → status=' + (res?.status ?? '?'));
            };
            const onerror = (err) => {
                console.warn('[OC live-success] POST failed:', err?.error || err);
            };
            try {
                if (typeof GM_xmlhttpRequest === 'function') {
                    GM_xmlhttpRequest({
                        method: 'POST', url, data: body,
                        headers: { 'Content-Type': 'application/json' },
                        onload, onerror, timeout: 8000,
                    });
                } else {
                    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
                        .then(r => onload({ status: r.status }))
                        .catch(onerror);
                }
            } catch (e) { onerror(e); }
        };
        for (const [crimeId, slots] of byCrime) post(crimeId, slots);
    }
    function startLiveSuccessPoller() {
        if (window.__ocLiveSuccessPoller) return;
        window.__ocLiveSuccessPoller = setInterval(() => {
            try { pushLiveSuccessChances(); } catch (_) {}
        }, 30_000);
        // Initial run after DOM has had a moment to settle.
        setTimeout(() => { try { pushLiveSuccessChances(); } catch (_) {} }, 5_000);
    }

    function mgr_scrapeBoundItems() {
        // Returns a Set of "userID:itemID" pairs where the slot's
        // requirement is satisfied per Torn's React state. Walks the
        // unsafeWindow.torn namespace (the scope reader uses the same
        // path) for an exposed crimes list. v3.1.86 confirmed Torn
        // doesn't currently expose OC slot data via unsafeWindow on
        // the OC 2.0 page, so this function returns an empty set today.
        // Kept as a fast pre-filter for future Torn deploys that might
        // re-expose OC state — it's cheap and a no-op when nothing's
        // there. The real auto-detect is mgr_scrapeSlotMissingIndicators
        // which works against the rendered DOM.
        const bound = new Set();
        const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

        // Path 1: Torn React state. Same `unsafeWindow.torn` namespace
        // the scope reader uses (v3.1.21 comment). Walk multiple known
        // candidate paths since Torn renames properties between OC 1.0
        // / 2.0 / future iterations.
        try {
            const candidates = [
                win?.torn?.faction?.crimes,
                win?.torn?.faction?.crimes2,
                win?.torn?.faction?.organizedCrimes,
                win?.torn?.crimes,
            ].filter(Boolean);
            for (const root of candidates) {
                const list = Array.isArray(root) ? root : Object.values(root);
                let stateHit = false;
                for (const c of list) {
                    const slots = Array.isArray(c?.slots) ? c.slots : null;
                    if (!slots) continue;
                    for (const s of slots) {
                        const uid = s?.user?.id ?? s?.user?.userID;
                        const iid = Number(s?.item_requirement?.id ?? 0);
                        if (!uid || !iid) continue;
                        // ANY of these flags being truthy means the slot
                        // has the item bound. is_available is the API's
                        // own answer, which we know is unreliable — but
                        // include it for completeness (won't cause harm
                        // since it's the same answer the API returned).
                        const sat = s?.item_requirement?.is_satisfied
                                  ?? s?.item_requirement?.has_item
                                  ?? s?.has_required_item
                                  ?? s?.item_requirement?.is_available;
                        if (sat === true) {
                            bound.add(`${uid}:${iid}`);
                            stateHit = true;
                        }
                    }
                }
                if (stateHit) {
                    console.log(`[OC Mgr] State scrape found ${bound.size} bound items`);
                    return bound;
                }
            }
        } catch (e) { console.warn('[OC Mgr] state scrape error:', e?.message); }

        // Path 2: DOM scrape. Best-effort because Torn ships React with
        // hashed CSS-module class names that change between deploys. We
        // look for any element with both a check/success indicator AND
        // an associated player-id link inside the same slot container.
        try {
            // Common patterns for "this slot is satisfied" — Torn often
            // renders a green check SVG, success badge, or class with
            // "satisfied" / "check" / "ok" in the name.
            const checks = document.querySelectorAll(
                'svg[class*="check"], svg[class*="Check"], ' +
                '[class*="satisfied"], [class*="Satisfied"], ' +
                '[class*="hasItem"], [class*="HasItem"], ' +
                '[aria-label*="checked" i], [title*="has item" i]'
            );
            for (const el of checks) {
                // Walk up to find the enclosing slot/row, then find the
                // member's profile link to extract their userID.
                const slotEl = el.closest('li, [class*="slot" i], [class*="position" i], tr, .row');
                if (!slotEl) continue;
                const link = slotEl.querySelector('a[href*="profiles.php?XID="], a[href*="XID="]');
                const m = link?.href?.match(/XID=(\d+)/);
                const uid = m?.[1];
                if (!uid) continue;
                // Item ID is harder to read from the DOM (Torn doesn't
                // surface it as a data attribute on every slot). Use
                // the item NAME from this slot and match against the
                // known itemNameMap. If we can't resolve, skip — the
                // manual button still works.
                const itemNameEl = slotEl.querySelector('[class*="item" i] [class*="name" i], [class*="itemName" i]')
                                || slotEl.querySelector('[class*="item" i]');
                const itemName = itemNameEl?.textContent?.trim();
                if (!itemName) continue;
                // Reverse lookup: itemName → itemID via mgr's name cache.
                let iid = null;
                const nameMap = mgr_getItemNameMap();
                for (const [id, name] of Object.entries(nameMap)) {
                    if (name === itemName) { iid = Number(id); break; }
                }
                if (iid) bound.add(`${uid}:${iid}`);
            }
            if (bound.size > 0) {
                console.log(`[OC Mgr] DOM scrape found ${bound.size} bound items`);
            }
        } catch (e) { console.warn('[OC Mgr] DOM scrape error:', e?.message); }

        return bound;
    }
    let   mgr_preparedArmoryID = null;
    let   mgr_pendingArmoryItemID = null;

    const ITEM_TYPE_TO_ARMORY_TAB = {
        'Tool': 'utilities', 'Drug': 'drugs', 'Medical': 'medical',
        'Booster': 'boosters', 'Temporary': 'temporary', 'Clothing': 'clothing', 'Armor': 'armor'
    };
    const ARMORY_TAB_TO_POST_TYPE = {
        'utilities': 'Tool', 'drugs': 'Drug', 'medical': 'Medical',
        'boosters': 'Booster', 'temporary': 'Temporary', 'clothing': 'Clothing', 'armor': 'Armor', 'weapons': 'Primary'
    };
    const ARMORY_API_SELECTIONS = ['utilities', 'drugs', 'medical', 'boosters', 'temporary', 'armor', 'weapons', 'caches'];
    const ARMORY_CATEGORIES = ['utilities', 'drugs', 'medical', 'boosters', 'temporary', 'clothing', 'armor', 'armour']; // page AJAX categories (loan/retrieve only)

    // --- Utilities ---
    const mgr_getRfcvToken = () => {
        const match = document.cookie.match(/rfc_v=([^;]+)/);
        return match ? match[1] : null;
    };
    const mgr_formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    // --- Item name cache (localStorage) ---
    const ITEM_NAME_CACHE_KEY = 'OCLM_ITEM_ID_NAME_MAP';
    // v3.1.90: HTML-escape every user-supplied string before
    // interpolating into innerHTML. Torn restricts member names to
    // alphanumerics+_/- (low risk there), but item names and crime
    // names from /v2/torn/items + /v2/faction/crimes routinely
    // include apostrophes/quotes/ampersands that break HTML rendering
    // at minimum and create attribute-injection paths at worst.
    // Defensive hardening before the Big Wheelers trial.
    const mgr_esc = (s) => String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const mgr_getItemNameMap = () => { try { return JSON.parse(localStorage.getItem(ITEM_NAME_CACHE_KEY) || '{}'); } catch { return {}; } };
    const mgr_setItemName = (itemID, name) => {
        const map = mgr_getItemNameMap();
        if (!map[itemID]) { map[itemID] = name; try { localStorage.setItem(ITEM_NAME_CACHE_KEY, JSON.stringify(map)); } catch {} }
    };
    const mgr_getItemName = (itemID) => mgr_getItemNameMap()[itemID] || null;

    // --- API helpers (use fetch directly with Torn API key) ---
    const mgr_loadMembers = async () => {
        if (mgr_membersLoaded) return;
        const key = getApiKey();
        if (!key || key === 'YOUR_API_KEY_HERE') throw new Error('API key required');
        const res = await fetch(`https://api.torn.com/v2/faction/members?key=${key}&comment=oc-spawn`);
        if (!res.ok) throw new Error('Failed to load members');
        const data = await res.json();
        const members = Array.isArray(data?.members) ? data.members : Object.values(data?.members || {});
        members.forEach(m => mgr_memberNameMap.set(String(m.id), m.name));
        mgr_membersLoaded = true;
    };

    // Shared cache for the available-crimes endpoint so mgr_getMissingOCItems and
    // mgr_getAllOCItemRequirements don't hit the API twice when both sub-tabs load.
    let _mgr_crimesCache = { data: null, ts: 0 };
    let _mgr_crimesInFlight = null;
    const MGR_CRIMES_TTL = 30000;
    const mgr_fetchAvailableCrimes = async () => {
        const now = Date.now();
        if (_mgr_crimesCache.data && (now - _mgr_crimesCache.ts) < MGR_CRIMES_TTL) return _mgr_crimesCache.data;
        if (_mgr_crimesInFlight) return _mgr_crimesInFlight;
        const key = getApiKey();
        if (!key || key === 'YOUR_API_KEY_HERE') throw new Error('API key required');
        _mgr_crimesInFlight = (async () => {
            try {
                const res = await fetch(`https://api.torn.com/v2/faction/crimes?cat=available&key=${key}&comment=oc-spawn`);
                if (!res.ok) throw new Error('Failed to load OC data');
                const data = await res.json();
                _mgr_crimesCache = { data, ts: Date.now() };
                return data;
            } finally { _mgr_crimesInFlight = null; }
        })();
        return _mgr_crimesInFlight;
    };

    const mgr_getMissingOCItems = async () => {
        const data = await mgr_fetchAvailableCrimes();
        const missing = [];
        const crimes = Array.isArray(data?.crimes) ? data.crimes : Object.values(data?.crimes || {});
        crimes.forEach(crime => {
            crime.slots?.forEach(slot => {
                if (slot.item_requirement && !slot.item_requirement.is_available && slot.user?.id && !BLACKLISTED_ITEM_IDS.has(Number(slot.item_requirement.id))) {
                    missing.push({
                        crimeID: crime.id,
                        crimeName: crime.name, position: slot.position,
                        // v3.1.91: expires_at lets the server cap the
                        // override TTL to the crime's actual execution
                        // time. Torn returns it in seconds; convert to
                        // ms here so the server can compare to Date.now().
                        crimeExpiresAtMs: crime.expires_at ? Number(crime.expires_at) * 1000 : null,
                        itemID: Number(slot.item_requirement.id),
                        userID: slot.user.id,
                        userName: mgr_memberNameMap.get(String(slot.user.id)) || `Unknown [${slot.user.id}]`
                    });
                }
            });
        });
        return missing;
    };

    const mgr_getAllOCItemRequirements = async () => {
        const data = await mgr_fetchAvailableCrimes();
        const neededByUser = new Map();
        const crimes = Array.isArray(data?.crimes) ? data.crimes : Object.values(data?.crimes || {});
        crimes.forEach(crime => {
            crime.slots?.forEach(slot => {
                if (slot.item_requirement && slot.user?.id) {
                    const uid = String(slot.user.id);
                    const iid = Number(slot.item_requirement.id);
                    if (!neededByUser.has(uid)) neededByUser.set(uid, new Set());
                    neededByUser.get(uid).add(iid);
                }
            });
        });
        return neededByUser;
    };

    const mgr_getUnpaidCompletedCrimes = async () => {
        const key = getApiKey();
        if (!key || key === 'YOUR_API_KEY_HERE') throw new Error('API key required');
        const now = Math.floor(Date.now() / 1000);
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
        const res = await fetch(`https://api.torn.com/v2/faction/crimes?cat=successful&filter=executed_at&from=${thirtyDaysAgo}&to=${now}&sort=DESC&limit=100&key=${key}&comment=oc-spawn`);
        if (!res.ok) throw new Error('Failed to load completed crimes');
        const data = await res.json();
        if (data?.error) throw new Error(`API error: ${data.error.error || JSON.stringify(data.error)}`);
        const crimes = Array.isArray(data?.crimes) ? data.crimes : (data?.crimes && typeof data.crimes === 'object' ? Object.values(data.crimes) : []);
        const unpaid = [];
        for (const c of crimes) {
            const paidAt = c?.rewards?.payout?.paid_at;
            if (paidAt) continue;
            const money = Number(c?.rewards?.money || 0);
            const respect = Number(c?.rewards?.respect || 0);
            const hasItems = Array.isArray(c?.rewards?.items) ? c.rewards.items.length > 0 : false;
            if (money <= 0 && respect <= 0 && !hasItems) continue;
            unpaid.push({ id: c.id, name: c.name || 'Unknown OC', difficulty: c.difficulty || null, executedAt: c.executed_at, money, respect, hasItems, payoutPct: c?.rewards?.payout?.percentage ?? null });
        }
        return unpaid;
    };

    const mgr_resolveItemNames = async (itemIDs) => {
        const unknown = itemIDs.filter(id => !mgr_getItemName(id));
        if (unknown.length === 0) return;
        const unique = [...new Set(unknown)];
        try {
            const key = getApiKey();
            if (!key || key === 'YOUR_API_KEY_HERE') return;
            const res = await fetch(`https://api.torn.com/v2/torn/items?ids=${unique.join(',')}&key=${key}&comment=oc-spawn`);
            const data = await res.json();
            const items = Array.isArray(data?.items) ? data.items : Object.values(data?.items || {});
            items.forEach(item => { if (item.id && item.name) mgr_setItemName(item.id, item.name); });
        } catch { /* ignore */ }
    };

    // --- Armory Cache (reads via Torn API, actions via page AJAX) ---
    const mgr_fetchAllArmoryItemsAPI = async () => {
        const key = getApiKey();
        if (!key || key === 'YOUR_API_KEY_HERE') throw new Error('API key required');
        const selections = ARMORY_API_SELECTIONS.join(',');
        const r = await gmRequest(`https://api.torn.com/v2/faction/?selections=${selections}&key=${encodeURIComponent(key)}&comment=oc-spawn`);
        if (!r.ok) throw new Error('Failed to load armory data');
        const data = r.data;
        const allItems = [];
        for (const sel of ARMORY_API_SELECTIONS) {
            const items = Array.isArray(data?.[sel]) ? data[sel] : [];
            const category = sel === 'weapons' ? 'weapons' : sel;
            for (const item of items) {
                if (item.ID && item.name) mgr_setItemName(item.ID, item.name);
                allItems.push({
                    itemID: Number(item.ID), name: item.name, type: item.type,
                    quantity: item.quantity || 0, available: item.available ?? item.quantity ?? 0,
                    loaned: item.loaned || 0, loaned_to: item.loaned_to || null,
                    armoryCategory: category
                });
            }
        }
        return allItems;
    };

    // Page AJAX: fetch armoryIDs for a specific category (only used for loan/retrieve actions)
    const mgr_fetchArmoryIDsForCategory = async (category) => {
        const rfcv = mgr_getRfcvToken();
        if (!rfcv) throw new Error('Missing RFCV token');
        const ids = [];
        let start = 0;
        while (start < 1000) {
            const body = new URLSearchParams({ step: 'armouryTabContent', type: category, start: String(start), ajax: 'true' });
            const res = await fetch(`https://www.torn.com/factions.php?rfcv=${rfcv}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
                body, credentials: 'same-origin'
            });
            if (!res.ok) break;
            try {
                const data = await res.json();
                if (!data?.items) break;
                const itemsArr = Array.isArray(data.items) ? data.items : Object.values(data.items);
                if (itemsArr.length === 0) break;
                let added = 0;
                for (const entry of itemsArr) {
                    // Accept either user.userID OR user.id when checking
                    // "is this item loaned to someone?" — Torn ships
                    // both shapes after the late-Apr 2026 auth refactor.
                    // Without the e.user.id fallback, items loaned to
                    // other members were being mis-classified as unused
                    // and could be re-loaned over the existing loan.
                    const occupant = entry.user && (entry.user.userID ?? entry.user.id);
                    const isUnused = entry.user === false || entry.user === '' || entry.user === 0 || (entry.user && !occupant);
                    if (isUnused && entry.armoryID) {
                        ids.push({ armoryID: entry.armoryID, itemID: Number(entry.itemID) });
                        added++;
                    }
                }
                if (added === 0 && itemsArr.length < 50) break;
                if (itemsArr.length < 50) break;
                start += 50;
            } catch (e) { break; }
        }
        return ids;
    };

    const mgr_refreshArmoryCache = async (force = false) => {
        const now = Date.now();
        if (!force && mgr_armoryCache.size > 0 && (now - mgr_lastRefreshTime < MGR_REFRESH_COOLDOWN_MS)) return;
        mgr_armoryCache.clear();
        const items = await mgr_fetchAllArmoryItemsAPI();
        for (const entry of items) {
            const avail = entry.available || 0;
            if (avail > 0) {
                if (!mgr_armoryCache.has(entry.itemID)) {
                    mgr_armoryCache.set(entry.itemID, { armoryIDs: [], qty: avail, armoryCategory: entry.armoryCategory });
                } else {
                    const cached = mgr_armoryCache.get(entry.itemID);
                    cached.qty += avail;
                }
            }
        }
        mgr_lastRefreshTime = Date.now();
    };

    const mgr_getPostTypeForItem = (itemID) => {
        const cached = mgr_armoryCache.get(itemID);
        return (cached?.armoryCategory ? ARMORY_TAB_TO_POST_TYPE[cached.armoryCategory] : null) || 'Tool';
    };

    const mgr_prepareArmouryForItem = async (itemID) => {
        if (!mgr_armoryCache.has(itemID)) await mgr_refreshArmoryCache(true);
        else await mgr_refreshArmoryCache(false);
        const entry = mgr_armoryCache.get(itemID);
        if (!entry || entry.qty <= 0) return null;
        // Fetch armoryID from page AJAX (user-initiated action)
        const category = entry.armoryCategory || 'utilities';
        // Try both singular and alternate names for the page AJAX category
        const categoriesToTry = [category];
        if (category === 'armor') categoriesToTry.push('armour');
        let armoryID = null;
        for (const cat of categoriesToTry) {
            const ids = await mgr_fetchArmoryIDsForCategory(cat);
            const match = ids.find(i => i.itemID === itemID);
            if (match) { armoryID = match.armoryID; break; }
        }
        if (!armoryID) return null;
        mgr_preparedArmoryID = armoryID;
        mgr_pendingArmoryItemID = itemID;
        return mgr_preparedArmoryID;
    };

    const mgr_loanItem = async ({ armoryID, itemID, userID, userName }) => {
        const rfcv = mgr_getRfcvToken();
        if (!rfcv) throw new Error('Missing RFCV token');
        const itemPostType = mgr_getPostTypeForItem(itemID);
        const body = new URLSearchParams({ ajax: 'true', step: 'armouryActionItem', role: 'loan', item: armoryID, itemID: itemID, type: itemPostType, user: `${userName} [${userID}]`, quantity: '1' });
        const res = await fetch(`https://www.torn.com/factions.php?rfcv=${rfcv}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
            body, credentials: 'same-origin'
        });
        if (!res.ok) throw new Error('Loan request failed');
        const text = await res.text();
        if (!text.includes('success')) throw new Error('Loan failed');
    };

    const mgr_loanPreparedItem = async ({ userID, userName }) => {
        if (!mgr_preparedArmoryID || mgr_pendingArmoryItemID === null) throw new Error('Armoury not prepared');
        const itemID = mgr_pendingArmoryItemID;
        await mgr_loanItem({ armoryID: mgr_preparedArmoryID, itemID: mgr_pendingArmoryItemID, userID, userName });
        const entry = mgr_armoryCache.get(mgr_pendingArmoryItemID);
        if (entry) {
            entry.qty -= 1;
            entry.armoryIDs.shift();
            if (entry.qty <= 0 || entry.armoryIDs.length === 0) mgr_armoryCache.delete(mgr_pendingArmoryItemID);
        }
        const uid = String(userID);
        if (!mgr_recentlyLoaned.has(uid)) mgr_recentlyLoaned.set(uid, new Set());
        mgr_recentlyLoaned.get(uid).add(itemID);
        mgr_preparedArmoryID = null; mgr_pendingArmoryItemID = null;
    };

    const mgr_retrieveItem = async ({ armoryID, itemID, userID, userName, postType }) => {
        const rfcv = mgr_getRfcvToken();
        if (!rfcv) throw new Error('Missing RFCV token');
        const itemPostType = postType || mgr_getPostTypeForItem(itemID);
        const body = new URLSearchParams({ ajax: 'true', step: 'armouryActionItem', role: 'retrieve', item: armoryID, itemID: itemID, type: itemPostType, user: `${userName} [${userID}]`, quantity: '1' });
        const res = await fetch(`https://www.torn.com/factions.php?rfcv=${rfcv}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' },
            body, credentials: 'same-origin'
        });
        if (!res.ok) throw new Error('Retrieve request failed');
        const text = await res.text();
        if (!text.includes('success')) throw new Error('Retrieve failed');
        const uid = String(userID);
        if (mgr_recentlyLoaned.has(uid)) { mgr_recentlyLoaned.get(uid).delete(itemID); if (mgr_recentlyLoaned.get(uid).size === 0) mgr_recentlyLoaned.delete(uid); }
    };

    // ═══════════════════════════════════════════════════════════════════════
    //  FACTION SETTINGS  — fetch & push via server (faction-wide)
    // ═══════════════════════════════════════════════════════════════════════
    async function fetchFactionSettings(apiKey) {
        try {
            const r = await gmRequest(`${SERVER}/api/oc/settings?key=${encodeURIComponent(apiKey)}`);
            if (!r.ok) return null;
            return r.data;
        } catch (e) {
            console.warn('[OC Spawn] Could not fetch faction settings:', e.message);
            return null;
        }
    }

    // Wire up form submit + delete buttons after each render. Safe to call
    // repeatedly; replaces handlers each time since render() rebuilds DOM.
    // v3.1.78: real-time vault list updates via SSE. Server pushes a
    // {type:'vault', action:'create'|'claim'|'remove'|'fulfill', id} event
    // whenever vault state changes; admin's open panel re-fetches the list
    // immediately. The 60s interval below is a safety-net for any events
    // missed during stream disconnect / reconnect — was 15s before SSE.
    let _vaultPollTimer = null;
    let _vaultStreamAbort = null;
    let _vaultStreamLastLen = 0;
    let _vaultStreamBuf = '';

    async function _refreshVaultListNow(apiKey, viewer) {
        try {
            const fresh = await fetchVaultRequests(apiKey);
            // Diff: only re-render if the list actually changed.
            const sigOld = (S.vaultRequests || []).map(r => r.id).sort().join(',');
            const sigNew = fresh.map(r => r.id).sort().join(',');
            if (sigOld === sigNew) return;
            S.vaultRequests = fresh;
            // Re-render the list portion only — extract the inner list
            // HTML from a fresh renderVaultRequestSection call and swap.
            const html = renderVaultRequestSection(viewer);
            const m = html.match(/<div id="oc-vault-list">([\s\S]*?)<\/div>\s*<form/);
            const list = document.getElementById('oc-vault-list');
            if (m && list) {
                list.innerHTML = m[1];
                bindVaultRequestHandlers(apiKey, viewer);
            }
        } catch (_) { /* swallow */ }
    }

    function _connectVaultStream(apiKey, viewer) {
        if (_vaultStreamAbort) return; // already connected / connecting
        if (typeof GM_xmlhttpRequest !== 'function') return; // PDA / no streaming
        _vaultStreamLastLen = 0;
        _vaultStreamBuf = '';
        try {
            _vaultStreamAbort = GM_xmlhttpRequest({
                method: 'GET',
                url: `${SERVER}/api/oc/stream/vault?key=${encodeURIComponent(apiKey)}`,
                responseType: 'text',
                timeout: 0,
                onloadstart: () => { console.log('[OC Spawn][vault-stream] connected'); },
                onprogress: (resp) => {
                    if (!resp || resp.responseText == null) return;
                    const responseText = resp.responseText;
                    const newText = responseText.substring(_vaultStreamLastLen);
                    _vaultStreamLastLen = responseText.length;
                    _vaultStreamBuf += newText;
                    let boundary;
                    while ((boundary = _vaultStreamBuf.indexOf('\n\n')) !== -1) {
                        const chunk = _vaultStreamBuf.slice(0, boundary).trim();
                        _vaultStreamBuf = _vaultStreamBuf.slice(boundary + 2);
                        if (!chunk) continue;
                        const m = chunk.match(/^data:\s*(.+)$/s);
                        if (!m) continue; // skip ": keepalive" comments
                        try {
                            const data = JSON.parse(m[1]);
                            if (data && data.type === 'vault') {
                                _refreshVaultListNow(apiKey, viewer);
                            }
                        } catch (_) { /* malformed event, skip */ }
                    }
                },
                onerror: () => {
                    _vaultStreamAbort = null;
                    setTimeout(() => _connectVaultStream(apiKey, viewer), 5000);
                },
                onload: () => {
                    // Stream ended (server restarted, idle close) — reconnect.
                    _vaultStreamAbort = null;
                    setTimeout(() => _connectVaultStream(apiKey, viewer), 5000);
                },
            });
        } catch (_) { _vaultStreamAbort = null; }
    }

    function ensureVaultPolling(apiKey, viewer) {
        if (_vaultPollTimer) { clearInterval(_vaultPollTimer); _vaultPollTimer = null; }
        if (_vaultStreamAbort) { try { _vaultStreamAbort.abort(); } catch (_) {} _vaultStreamAbort = null; }
        const myId = String(viewer?.playerId || '');
        const isAdmin = viewer?.hasFactionAccess === true || myId === '137558';
        if (!isAdmin) return;   // non-admins don't see the list anyway

        _connectVaultStream(apiKey, viewer);

        // Fallback safety-net poll. Was 15s before v3.1.78 — now 60s
        // since SSE handles the live case. PDA falls back to this entirely
        // since GM_xmlhttpRequest streaming isn't usable in InAppWebView.
        _vaultPollTimer = setInterval(async () => {
            await _refreshVaultListNow(apiKey, viewer);
        }, 60_000);
    }

    // Parse "500k" / "2.5m" / "1b" / "500,000" / "$500" / "500" → integer cents-free amount.
    // Returns NaN if unparseable.
    function parseVaultAmount(raw) {
        if (raw == null) return NaN;
        const s = String(raw).trim().replace(/[\s,$]/g, '');
        if (!s) return NaN;
        const m = s.match(/^(\d+(?:\.\d+)?)([kmb])?$/i);
        if (!m) return NaN;
        const n = parseFloat(m[1]);
        if (!isFinite(n) || n < 0) return NaN;
        const suf = (m[2] || '').toLowerCase();
        const mult = suf === 'k' ? 1e3 : suf === 'm' ? 1e6 : suf === 'b' ? 1e9 : 1;
        return Math.floor(n * mult);
    }

    function bindVaultRequestHandlers(apiKey, viewer) {
        ensureVaultPolling(apiKey, viewer);
        // v3.1.65: live-translate shorthand to the expanded number as
        // the user types. The moment the value ends in k/m/b and
        // parses cleanly, overwrite the input ("1k" → "1000",
        // "10m" → "10000000"). Works mid-stream because people type
        // the number first and the suffix last — by the time k/m/b
        // lands, the digits are already fixed. v3.1.66 dropped the
        // separate "= $X" preview element since the expanded number
        // now appears in the input itself.
        const amtField = document.getElementById('oc-vault-amount');
        if (amtField) {
            amtField.addEventListener('input', () => {
                const raw = amtField.value.trim();
                if (/[kmb]$/i.test(raw)) {
                    const n = parseVaultAmount(raw);
                    if (isFinite(n) && n > 0 && String(n) !== raw) {
                        amtField.value = String(n);
                    }
                }
            });
        }
        // $ button: fill amount input with the requester's current max balance
        const maxBtn = document.getElementById('oc-vault-max');
        if (maxBtn && S.vaultBalance && S.vaultBalance > 0) {
            maxBtn.addEventListener('click', () => {
                const amtInput = document.getElementById('oc-vault-amount');
                if (amtInput) amtInput.value = String(Math.floor(S.vaultBalance));
            }, { once: false });
        }
        const form = document.getElementById('oc-vault-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const amtInput = document.getElementById('oc-vault-amount');
                const tgtSel   = document.getElementById('oc-vault-target');
                const msgEl    = document.getElementById('oc-vault-msg');
                const amount = parseVaultAmount(amtInput?.value);
                const target = tgtSel?.value === 'online' ? 'online' : 'both';
                if (!(amount > 0)) {
                    if (msgEl) msgEl.textContent = 'Enter a valid amount (e.g. 500k, 2.5m, 1b).';
                    return;
                }
                if (msgEl) msgEl.textContent = 'Submitting…';
                const r = await submitVaultRequest(apiKey, amount, target);
                if (r.ok && r.data?.request) {
                    if (msgEl) {
                        const actual = Number(r.data.request.amount || 0).toLocaleString('en-US');
                        msgEl.textContent = `Posted — $${actual}. Notified ${target === 'online' ? 'online members' : 'everyone'}.`;
                    }
                    if (amtInput) amtInput.value = '';
                    // Refresh the list
                    S.vaultRequests = await fetchVaultRequests(apiKey);
                    const list = document.getElementById('oc-vault-list');
                    if (list) {
                        // Re-render just the list section
                        const html = renderVaultRequestSection(viewer).match(/<div id="oc-vault-list">([\s\S]*?)<\/div>\s*<form/);
                        if (html) list.innerHTML = html[1];
                        // Rebind delete buttons
                        bindVaultRequestHandlers(apiKey, viewer);
                    }
                } else {
                    if (msgEl) msgEl.textContent = `Failed: ${r.data?.error || 'unknown'}`;
                }
            }, { once: true });
        }
        // Send-button clicks: copy the raw amount to clipboard so the
        // admin can paste it into Torn's Give-to-member form on the
        // Controls tab (the row's <a> handles the navigation via its
        // href). The script does NOT auto-fill Torn's form — v3.1.63
        // removed the dead autofill path whose selectors hadn't matched
        // Torn's React DOM in a long time.
        document.querySelectorAll('.oc-vault-send').forEach(a => {
            a.addEventListener('click', (e) => {
                const reqId = a.dataset.reqId;
                const amt = a.dataset.amount;
                const recipient = a.dataset.recipient;
                const xid = a.dataset.recipientId;
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(String(amt));
                    }
                } catch (_) {}
                const msg = document.getElementById('oc-vault-msg');
                if (msg) msg.textContent = `Opening Give for ${recipient} [${xid}] — $${Number(amt).toLocaleString('en-US')} prefilled, just confirm.`;
                // Optimistic faction-wide hide: server marks the request as
                // banker-claimed so every other admin's next list fetch
                // drops it too. If the matching fundsnews event doesn't
                // arrive within the claim TTL (90s), the server expires the
                // claim and the request reappears for everyone.
                if (reqId) {
                    claimVaultRequest(apiKey, reqId).then(r => {
                        if (r.ok) {
                            S.vaultRequests = (S.vaultRequests || []).filter(x => x.id !== reqId);
                            const row = a.closest('div');
                            if (row) row.remove();
                        } else if (r.conflict && msg) {
                            msg.textContent = `Already being fulfilled${r.by ? ' by ' + r.by : ''}.`;
                        }
                    }).catch(() => {});
                }
            }, { once: false });
        });
        document.querySelectorAll('.oc-vault-del').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const id = btn.dataset.reqId;
                btn.disabled = true;
                const r = await deleteVaultRequest(apiKey, id);
                if (r.ok) {
                    S.vaultRequests = (S.vaultRequests || []).filter(x => x.id !== id);
                    const row = btn.closest('div');
                    if (row) row.remove();
                }
            }, { once: true });
        });
    }

    // ── Vault-request helpers ──────────────────────────────────────────────
    async function fetchVaultRequests(apiKey) {
        try {
            const r = await gmRequest(`${SERVER}/api/oc/vault-requests?key=${encodeURIComponent(apiKey)}`);
            if (!r.ok) return [];
            return Array.isArray(r.data?.requests) ? r.data.requests : [];
        } catch (_) { return []; }
    }
    async function fetchVaultBalance(apiKey) {
        try {
            const r = await gmRequest(`${SERVER}/api/oc/vault-balance?key=${encodeURIComponent(apiKey)}`);
            if (!r.ok) return null;
            return Number(r.data?.balance) || 0;
        } catch (_) { return null; }
    }
    async function submitVaultRequest(apiKey, amount, target) {
        const body = JSON.stringify({ key: apiKey, amount, target });
        const r = await new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: `${SERVER}/api/oc/vault-request`,
                headers: { 'Content-Type': 'application/json' },
                data: body,
                onload: (resp) => {
                    try { resolve({ ok: resp.status >= 200 && resp.status < 300, data: JSON.parse(resp.responseText) }); }
                    catch { resolve({ ok: false, data: {} }); }
                },
                onerror: () => resolve({ ok: false, data: {} }),
            });
        });
        return r;
    }
    async function deleteVaultRequest(apiKey, id) {
        const r = await new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'DELETE',
                url: `${SERVER}/api/oc/vault-request/${encodeURIComponent(id)}?key=${encodeURIComponent(apiKey)}`,
                onload: (resp) => resolve({ ok: resp.status >= 200 && resp.status < 300 }),
                onerror: () => resolve({ ok: false }),
            });
        });
        return r;
    }
    async function claimVaultRequest(apiKey, id) {
        const body = JSON.stringify({ key: apiKey });
        const r = await new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: `${SERVER}/api/oc/vault-request/${encodeURIComponent(id)}/claim`,
                headers: { 'Content-Type': 'application/json' },
                data: body,
                onload: (resp) => {
                    let data = {};
                    try { data = JSON.parse(resp.responseText); } catch {}
                    if (resp.status === 409) {
                        return resolve({ ok: false, conflict: true, by: data.error?.replace(/^Already claimed by\s+/, '') });
                    }
                    resolve({ ok: resp.status >= 200 && resp.status < 300, data });
                },
                onerror: () => resolve({ ok: false }),
            });
        });
        return r;
    }

    async function pushFactionSettings(apiKey, cfg) {
        try {
            const p = new URLSearchParams({
                key:                  apiKey,
                active_days:          cfg.ACTIVE_DAYS,
                forecast_hours:       cfg.FORECAST_HOURS,
                mincpr:               cfg.MINCPR,
                cpr_boost:            cfg.CPR_BOOST,
                lookback_days:        cfg.CPR_LOOKBACK_DAYS,
                high_weight_pct:      cfg.HIGH_WEIGHT_THRESHOLD,
                high_weight_mincpr:   cfg.HIGH_WEIGHT_MIN_CPR,
                scope:                cfg.SCOPE !== null ? cfg.SCOPE : '',
            });
            await gmRequest(`${SERVER}/api/oc/settings/update?${p}`);
        } catch (e) {
            console.warn('[OC Spawn] Could not push faction settings:', e.message);
        }
    }

    // Scope-only push. Used by the auto-detect path so a fresh read from
    // the Recruiting DOM propagates to the faction-wide server value
    // immediately — everyone else on Planning / Admin / etc sees the new
    // scope without that user having to tap Save Settings manually.
    async function pushScopeOnly(apiKey, scope, source) {
        if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') return;
        if (scope === null || scope === undefined) return;
        try {
            // v3.1.30: hit the dedicated /api/oc/scope endpoint. Previous
            // versions posted to /api/oc/settings/update with only `scope`,
            // which on the old server handler silently reset every other
            // OC setting (mincpr → 60, cpr_boost → 15, etc.) because the
            // handler applied hard-coded defaults for missing query params.
            // v3.1.53: pass the detection source tag so the server audit
            // log says 'state' / 'class' / 'text' and we can trace where
            // a spurious value came from next time.
            const p = new URLSearchParams({
                key: apiKey,
                scope: String(scope),
                source: String(source || 'auto').slice(0, 32),
            });
            await gmRequest(`${SERVER}/api/oc/scope?${p}`);
            console.log(`[OC Spawn][scope] pushed ${scope} to server (source=${source || 'auto'})`);
            // v3.1.77: trigger an immediate full refresh so the UI shows
            // scope-filtered data within ~3s instead of waiting 5-15s for
            // the next regular poll. Fire-and-forget — runAnalysis is the
            // same function the regular poll runs, so re-entrancy is the
            // same risk profile as a fast user-clicked Refresh and is
            // already tolerated. The 2.5s scope-detect debounce upstream
            // means this fires at most once per ~3 seconds in practice.
            try { runAnalysis(); } catch (e) { /* non-fatal */ }
        } catch (e) {
            console.warn('[OC Spawn][scope] push failed:', e.message);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  SERVER DATA  — GET /api/oc/spawn-key
    // ═══════════════════════════════════════════════════════════════════════
    async function fetchServerOcData(apiKey) {
        const scriptVer = SCRIPT_VERSION;
        const r = await gmRequest(`${SERVER}/api/oc/spawn-key?key=${encodeURIComponent(apiKey)}&v=${scriptVer}`);
        if (r.status === 403) {
            const err = new Error(r.data?.error || 'Access restricted to faction members only.');
            err.status = 403; throw err;
        }
        if (r.status === 429) {
            const err = new Error(r.data?.error || 'Too many requests — please wait a moment.');
            err.status = 429; throw err;
        }
        // 503 = Torn-side transient (gateway timeout / backend slow). Surface
        // as a tagged transient error so the retry loop can show a friendly
        // "Torn slow" message instead of the bare "Server error 503".
        if (r.status === 503) {
            const err = new Error(r.data?.error || 'Torn API is slow right now — retrying…');
            err.status = 503; err.transient = true; throw err;
        }
        if (!r.ok) throw new Error(r.data?.error || `Server error (${r.status})`);
        return r.data;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  STYLES
    // ═══════════════════════════════════════════════════════════════════════
    GM_addStyle(`
        #oc-spawn-toggle {
            position: fixed; bottom: 80px; right: 16px; z-index: 9999;
            background: #2d6a4f; color: #fff; border: none; border-radius: 6px;
            padding: 7px 13px; font-size: 12px; font-weight: bold; cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,.4);
        }
        #oc-spawn-toggle:hover { background: #1b4332; }
        #oc-spawn-panel {
            position: fixed; bottom: 115px; right: 16px; z-index: 9998;
            width: min(560px, calc(100vw - 48px)); max-height: 72vh; overflow-y: auto;
            background: #0f1a14; color: #d1d5db; border: 1px solid #2a3f30;
            border-radius: 10px; font-size: 12px; display: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            box-shadow: 0 4px 24px rgba(0,0,0,.7); padding: 14px 16px;
        }
        #oc-spawn-panel.oc-spawn-docked {
            position: static !important; top: auto; left: auto; right: auto; bottom: auto;
            width: 100%; max-width: 100%; max-height: none; overflow: visible;
            margin: 0 0 10px; box-shadow: none;
        }
        #oc-spawn-panel.oc-spawn-docked h2 { cursor: default; }
        #oc-spawn-toggle.oc-spawn-docked {
            position: static !important; top: auto; left: auto; right: auto; bottom: auto;
            display: inline-block; margin: 10px 0 6px;
        }
        #oc-spawn-panel h2 {
            margin: 0 0 10px; font-size: 15px; font-weight: 700; color: #74c69d;
            display: flex; justify-content: space-between; align-items: center;
            cursor: move; user-select: none;
        }
        #oc-spawn-panel h3 {
            margin: 14px 0 6px; font-size: 10px; font-weight: 600; color: #6b7280;
            text-transform: uppercase; letter-spacing: 0.7px;
            border-bottom: 1px solid #1a2e20; padding-bottom: 4px;
        }
        /* Settings */
        #oc-settings-panel { display: none; background: #0f1f16; border: 1px solid #2a3f30; border-radius: 8px; padding: 12px 12px 8px; margin-bottom: 10px; }
        .oc-setting-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 10px; }
        .oc-setting-info { flex: 1; min-width: 0; }
        .oc-setting-label { font-size: 11px; font-weight: 600; color: #f3f4f6; display: block; margin-bottom: 2px; }
        .oc-setting-desc { font-size: 10px; color: #6b7280; line-height: 1.4; }
        .oc-setting-num { width: 52px; padding: 4px 6px; background: #0d1b2a; color: #f3f4f6; border: 1px solid #2d4a3e; border-radius: 4px; font-size: 11px; text-align: right; font-family: monospace; flex-shrink: 0; }
        .oc-setting-divider { border: none; border-top: 1px solid #1a2e20; margin: 8px 0; }
        .oc-setting-key-wrap { display: flex; gap: 6px; margin-top: 4px; }
        .oc-setting-key-input { flex: 1; padding: 4px 8px; background: #0d1b2a; color: #f3f4f6; border: 1px solid #2d4a3e; border-radius: 4px; font-size: 11px; font-family: monospace; }
        .oc-setting-save-btn { padding: 5px 12px; background: #2d6a4f; color: #fff; border: none; border-radius: 5px; font-size: 11px; cursor: pointer; font-family: inherit; font-weight: 600; }
        .oc-setting-save-btn:hover { background: #1b4332; }
        .oc-engine-toggle { display:flex; align-items:center; gap:6px; padding:4px 0; font-size:11px; color:#d1d5db; cursor:pointer; flex-wrap:wrap; }
        .oc-engine-toggle input[type=checkbox] { accent-color:#2d6a4f; width:14px; height:14px; cursor:pointer; }
        .oc-engine-toggle span:first-of-type { font-weight:600; min-width:120px; }
        .oc-engine-desc { color:#6b7280; font-size:10px; font-weight:400; }
        .oc-engine-toggle.oc-engine-disabled { opacity:0.4; pointer-events:none; cursor:default; }
        .oc-engine-toggle.oc-engine-disabled span::after { content:' (Coming Soon)'; color:#6b7280; font-weight:400; font-size:9px; }
        /* Stats & banners */
        .oc-stats-strip { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
        .oc-stat-chip { background: #131f18; border: 1px solid #253525; border-radius: 20px; padding: 3px 10px; font-size: 11px; color: #9ca3af; }
        .oc-stat-chip b { color: #74c69d; font-weight: 600; }
        .oc-scope-strip { display: flex; align-items: center; gap: 8px; background: #12201a; border: 1px solid #2a3f30; border-radius: 6px; padding: 6px 10px; margin-bottom: 10px; font-size: 11px; }
        .oc-scope-bar-wrap { flex: 1; background: #0d1b14; border-radius: 3px; height: 6px; overflow: hidden; }
        .oc-scope-bar { height: 100%; border-radius: 3px; background: #2d6a4f; transition: width .3s; }
        .oc-scope-bar.warn { background: #b45309; }
        .oc-scope-bar.ok   { background: #2d6a4f; }
        .oc-spawn-banner { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; background: #1c1a0f; border: 1px solid #3d3010; border-left: 3px solid #f4a261; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; font-size: 11px; color: #9ca3af; }
        .oc-spawn-banner.oc-banner-ok { background: #0f1c14; border-color: #1b4332; border-left-color: #74c69d; color: #74c69d; }
        .oc-lvl-chip { background: rgba(244,162,97,.15); color: #f4a261; border: 1px solid rgba(244,162,97,.3); border-radius: 4px; padding: 2px 8px; font-size: 11px; font-weight: 600; }
        /* Tables */
        .oc-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
        .oc-table th { background: #0f1a14; color: #6b7280; padding: 5px 8px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #1a2e20; }
        .oc-table td { padding: 4px 8px; border-bottom: 1px solid #131f18; vertical-align: middle; white-space: nowrap; color: #f3f4f6; }
        .oc-table tr:hover td { background: #131f18; }
.oc-table-tight { margin-bottom: 6px; width: auto; }
.oc-table-tight th { padding: 3px 4px; }
.oc-table-tight td { padding: 2px 4px; vertical-align: top; line-height: 1.25; }
.oc-recent-1 { font-size: 10px; color: #9ca3af; }
.oc-recent-more { font-size: 10px; color: #34d399; cursor: pointer; margin-left: 5px; font-weight: 700; }
.oc-recent-pop { position: fixed; z-index: 2147483647; background: #0f1a14; border: 1px solid #1f6f4a; border-radius: 6px; padding: 6px 10px; font-size: 11px; color: #e5e7eb; white-space: pre-line; box-shadow: 0 4px 14px rgba(0,0,0,.55); max-width: 80vw; }
.oc-total-click { color: #f59e0b; font-weight: 600; cursor: pointer; text-decoration: underline dotted; }
.oc-recent-when { font-size: 9px; color: #6b7280; }
        .oc-row-spawn         > td:first-child { border-left: 2px solid #f4a261; padding-left: 6px; }
        .oc-row-spawn-partial > td:first-child { border-left: 2px solid #d97706; padding-left: 6px; }
        .oc-row-ok            > td:first-child { border-left: 2px solid #74c69d; padding-left: 6px; }
        .oc-row-surplus       > td:first-child { border-left: 2px solid #60a5fa; padding-left: 6px; }
        .oc-row-deferred      > td:first-child { border-left: 2px solid #374151; padding-left: 6px; }
        .oc-row-none          > td:first-child { border-left: 2px solid #374151; padding-left: 6px; }
        .oc-row-none td { color: #6b7280; }
        .oc-row-deferred td { color: #6b7280 !important; }
        /* Badges & tags */
        .oc-tag-spawn { display: inline-block; background: rgba(244,162,97,.15); color: #f4a261; border: 1px solid rgba(244,162,97,.3); border-radius: 4px; padding: 2px 7px; font-size: 10px; font-weight: 700; }
        .oc-tag-spawn-partial { display: inline-block; background: rgba(217,119,6,.15); color: #d97706; border: 1px solid rgba(217,119,6,.3); border-radius: 4px; padding: 2px 7px; font-size: 10px; font-weight: 700; }
        .oc-tag-deferred { display: inline-block; background: rgba(55,65,81,.2); color: #6b7280; border: 1px solid rgba(55,65,81,.3); border-radius: 4px; padding: 2px 7px; font-size: 10px; }
        .oc-tag-ok { display: inline-block; background: rgba(116,198,157,.12); color: #74c69d; border: 1px solid rgba(116,198,157,.25); border-radius: 4px; padding: 2px 7px; font-size: 10px; }
        .oc-tag-surplus { display: inline-block; background: rgba(96,165,250,.1); color: #90e0ef; border: 1px solid rgba(96,165,250,.2); border-radius: 4px; padding: 2px 7px; font-size: 10px; }
        .oc-tag-none { color: #6b7280; }
        .oc-badge { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; }
        .oc-badge-in   { background: rgba(59,130,246,.1);   color: #60a5fa; border: 1px solid rgba(59,130,246,.2); }
        .oc-badge-soon { background: rgba(244,162,97,.12);  color: #f4a261; border: 1px solid rgba(244,162,97,.25); }
        .oc-badge-free { background: rgba(116,198,157,.12); color: #74c69d; border: 1px solid rgba(116,198,157,.25); }
        .oc-range-chip { display: inline-block; background: #1a2a1f; color: #6b7280; border-radius: 3px; padding: 1px 5px; font-size: 9px; margin-left: 3px; }
        .oc-cpr-high { color: #74c69d; } .oc-cpr-mid { color: #f4a261; } .oc-cpr-low { color: #9ca3af; }
        .oc-member-name { color: #f3f4f6; font-weight: 500; }
        .oc-member-id   { color: #6b7280; font-size: 10px; }
        .oc-cpr-click, .oc-proj-click { cursor: pointer; border-bottom: 1px dotted currentColor; }
        .oc-cpr-click:hover, .oc-proj-click:hover { opacity: 0.75; }
        /* Tooltips */
        #oc-cpr-tooltip, #oc-scope-tooltip { position: fixed; z-index: 10001; background: #131f18; border: 1px solid #2d4a3e; border-radius: 6px; padding: 6px 8px; font-size: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #d1d5db; box-shadow: 0 4px 20px rgba(0,0,0,.7); min-width: 200px; max-width: 280px; display: none; pointer-events: none; }
        #oc-cpr-tooltip .oc-tt-title, #oc-scope-tooltip .oc-tt-title { font-weight: 600; color: #f3f4f6; margin-bottom: 2px; font-size: 11px; }
        #oc-cpr-tooltip .oc-tt-avg, #oc-scope-tooltip .oc-tt-avg   { color: #9ca3af; font-size: 9px; margin-bottom: 4px; }
        #oc-cpr-tooltip table, #oc-scope-tooltip table { width: 100%; border-collapse: collapse; }
        #oc-cpr-tooltip th, #oc-scope-tooltip th { color: #6b7280; font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; padding: 1px 3px; border-bottom: 1px solid #1a2e20; text-align: left; }
        #oc-cpr-tooltip td, #oc-scope-tooltip td { padding: 1px 3px; font-size: 10px; color: #f3f4f6; }
        #oc-cpr-tooltip .oc-tt-note, #oc-scope-tooltip .oc-tt-note { color: #6b7280; font-size: 9px; margin-top: 4px; border-top: 1px solid #1a2e20; padding-top: 3px; }
        #oc-cpr-tooltip .oc-tt-heat-wrap { margin-top: 3px; max-width: 100%; overflow-x: auto; }
        #oc-cpr-tooltip .oc-tt-heat { border-collapse: collapse; }
        #oc-cpr-tooltip .oc-tt-heat td.oc-tt-heat-cell { text-align: center; padding: 0 3px; line-height: 1.05; }
        #oc-cpr-tooltip .oc-tt-heat td.oc-tt-heat-cell .r { font-weight: 600; font-size: 9px; }
        #oc-cpr-tooltip .oc-tt-heat td.oc-tt-heat-cell .s { font-size: 7px; opacity: 0.7; }
        #oc-cpr-tooltip .oc-tt-heat td.oc-tt-heat-label { font-size: 9px; padding-right: 4px; white-space: nowrap; color: #d1d5db; }
        #oc-cpr-tooltip .oc-tt-heat td.oc-tt-heat-label .r { color: #6b7280; font-size: 8px; }
        /* v3.1.34: click-to-toggle tooltip for Outcome EV column headers */
        #oc-ev-tooltip { position: fixed; z-index: 10002; background: #131f18; border: 1px solid #2d4a3e; border-radius: 8px; padding: 10px 12px; font-size: 11px; color: #d1d5db; box-shadow: 0 4px 20px rgba(0,0,0,.7); max-width: 300px; display: none; line-height: 1.4; }
        #oc-ev-tooltip .oc-tt-title { font-weight: 600; color: #f3f4f6; margin-bottom: 5px; font-size: 12px; }
        .oc-ev-info { display: inline-flex; align-items: center; justify-content: center; width: 13px; height: 13px; margin-left: 4px; border-radius: 50%; background: #2d4a3e; color: #9ca3af; font-size: 10px; font-weight: 700; cursor: pointer; user-select: none; vertical-align: middle; }
        .oc-ev-info:hover { background: #3d5a4e; color: #f3f4f6; }
        /* Misc */
        #oc-spawn-status { color: #6b7280; font-style: italic; margin: -6px 0 10px; font-size: 10px; }
        #oc-spawn-refresh { background: #152018; color: #74c69d; border: 1px solid #2d4a3e; border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 11px; font-family: inherit; font-weight: 600; }
        #oc-spawn-refresh:hover { background: #2d6a4f; color: #fff; }
        #oc-spawn-refresh:disabled { opacity: .4; cursor: default; }
        .oc-error { color: #f87171; font-weight: 600; }
        .oc-hdr-btn { background: #1a2a1f; color: #9ca3af; border: 1px solid #2d4a3e; border-radius: 6px; padding: 4px 9px; font-size: 12px; cursor: pointer; line-height: 1; font-family: inherit; }
        .oc-hdr-btn:hover { background: #253525; color: #d1d5db; }
        /* Tab bar */
        .oc-tab-bar { display: flex; border-bottom: 1px solid #2d4a3e; margin-bottom: 10px; gap: 0; }
        .oc-tab { background: none; border: none; border-bottom: 2px solid transparent; color: #6b7280; padding: 6px 16px; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 500; margin-bottom: -1px; transition: color .15s; }
        .oc-tab:hover:not(.oc-tab-active) { color: #d1d5db; }
        .oc-tab-active { color: #74c69d; border-bottom-color: #74c69d; }
        /* Viewer personal card */
        .oc-viewer-card {
            background: #111f18; border: 1px solid #2d4a3e;
            border-left: 3px solid #74c69d;
            border-radius: 6px; padding: 8px 12px; margin-bottom: 10px; font-size: 11px;
        }
        .oc-viewer-name { font-weight: 600; color: #f3f4f6; margin-bottom: 4px; }
        .oc-viewer-meta { color: #9ca3af; margin-bottom: 5px; font-size: 10px; }
        .oc-viewer-crimes { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px; }
        .oc-viewer-crime {
            background: rgba(116,198,157,.12); color: #74c69d;
            border: 1px solid rgba(116,198,157,.25); border-radius: 4px;
            padding: 2px 8px; font-size: 10px;
        }
        .oc-viewer-none { color: #6b7280; font-size: 10px; font-style: italic; }
        /* Per-member OC recommendation */
        .oc-rec-btn {
            cursor: pointer; display: inline-block;
            background: rgba(116,198,157,.12); color: #74c69d;
            border: 1px solid rgba(116,198,157,.25); border-radius: 4px;
            padding: 2px 7px; font-size: 10px; font-weight: 600;
        }
        .oc-rec-btn:hover { background: rgba(116,198,157,.22); }
        #oc-rec-tooltip {
            position: fixed; z-index: 10001; background: #131f18;
            border: 1px solid #2d4a3e; border-radius: 8px;
            padding: 10px 12px; font-size: 11px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: #d1d5db; box-shadow: 0 4px 20px rgba(0,0,0,.7);
            min-width: 180px; max-width: 260px; display: none; pointer-events: auto;
        }
        #oc-rec-tooltip .oc-tt-title { font-weight: 600; color: #f3f4f6; margin-bottom: 5px; font-size: 12px; }
        #oc-rec-tooltip .oc-tt-note  { color: #6b7280; font-size: 10px; margin-top: 5px; }
        /* Manager sub-tab bar */
        .mgr-sub-tab-bar { display: flex; gap: 0; border-bottom: 1px solid #2d4a3e; margin-bottom: 10px; }
        .mgr-sub-tab { background: none; border: none; border-bottom: 2px solid transparent; color: #6b7280; padding: 5px 14px; cursor: pointer; font-family: inherit; font-size: 11px; font-weight: 500; margin-bottom: -1px; transition: color .15s; }
        .mgr-sub-tab:hover:not(.mgr-sub-tab-active) { color: #d1d5db; }
        .mgr-sub-tab-active { color: #74c69d; border-bottom-color: #74c69d; }
        /* Manager cards */
        .mgr-card { background: #111f18; border: 1px solid #253525; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; transition: border-color .2s; position: relative; }
        /* v3.1.79: dismiss-chip in card corner — admin says "they have it,
           hide this row." Quiet by default, lights up on hover so it's
           discoverable without competing with the green Loan button. */
        .mgr-haveit-x {
            position: absolute; top: 6px; right: 6px;
            width: 20px; height: 20px; padding: 0;
            border-radius: 4px; border: 1px solid #2a3a2a;
            background: transparent; color: #6b7280;
            font-size: 11px; line-height: 1; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: all .15s ease;
        }
        .mgr-haveit-x:hover { background: rgba(116,198,157,.15); border-color: #2d6a4f; color: #74c69d; }
        .mgr-haveit-x:disabled { opacity: .4; cursor: default; }
        .mgr-card:hover { border-color: #2d6a4f; }
        .mgr-card-header { display: flex; justify-content: space-between; margin-bottom: 6px; align-items: flex-start; }
        .mgr-crime-name { font-weight: 700; font-size: 12px; color: #f3f4f6; flex: 1; padding-right: 8px; }
        .mgr-pos-tag { font-size: 9px; padding: 2px 6px; background: rgba(116,198,157,.1); border-radius: 4px; color: #74c69d; text-transform: uppercase; }
        .mgr-card-body { font-size: 11px; color: #9ca3af; line-height: 1.5; }
        .mgr-item-row, .mgr-player-row { display: flex; align-items: center; gap: 8px; margin-top: 3px; }
        .mgr-label { color: #6b7280; width: 42px; flex-shrink: 0; font-size: 10px; }
        .mgr-value { color: #f3f4f6; font-size: 11px; }
        .mgr-player-link { color: #74c69d; text-decoration: none; font-weight: 500; font-size: 11px; }
        .mgr-player-link:hover { text-decoration: underline; }
        .mgr-action-btn { width: 100%; margin-top: 8px; padding: 8px; border-radius: 6px; border: none; font-weight: 700; font-size: 11px; cursor: pointer; transition: all .2s; display: flex; align-items: center; justify-content: center; gap: 5px; }
        .mgr-btn-loan { background: #2d6a4f; color: #fff; }
        .mgr-btn-loan:hover:not(:disabled) { background: #1b4332; }
        .mgr-btn-retrieve { background: rgba(200,60,60,.1); color: #c33; border: 1px solid rgba(200,60,60,.2); }
        .mgr-btn-retrieve:hover:not(:disabled) { background: rgba(200,60,60,.2); }
        .mgr-btn-success { background: #1b4332 !important; color: #74c69d !important; }
        .mgr-btn-warning { background: #3d3010 !important; color: #f4a261 !important; }
        .mgr-summary-box { background: rgba(116,198,157,.08); border-radius: 8px; padding: 12px; margin-bottom: 12px; border: 1px solid rgba(116,198,157,.2); }
        .mgr-summary-label { font-size: 10px; color: #74c69d; text-transform: uppercase; font-weight: 700; margin-bottom: 3px; letter-spacing: 0.4px; }
        .mgr-summary-amount { font-size: 16px; font-weight: 800; color: #f3f4f6; }
        .mgr-summary-detail { font-size: 11px; color: #6b7280; }
        .mgr-payout-link { display: block; margin-top: 10px; padding: 8px; background: #2d6a4f; color: #fff; text-align: center; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 12px; }
        .mgr-payout-link:hover { background: #1b4332; }
        .mgr-payout-card { text-decoration: none; color: inherit; display: block; }
        .mgr-loading { text-align: center; color: #6b7280; padding: 30px; font-size: 12px; }
        .mgr-ok { text-align: center; color: #74c69d; padding: 30px; font-size: 13px; font-weight: 600; }
        .mgr-error { text-align: center; color: #f87171; padding: 16px; font-size: 12px; }
        .mgr-sub-content { min-height: 60px; }

        /* ═══════════════════════════════════════════════════════════════════
           METRICS TAB STYLES
           ═══════════════════════════════════════════════════════════════════ */
        .met-controls { margin-bottom: 10px; }
        .met-ctrl-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
        .met-label { font-size: 11px; color: #6b7280; }
        .met-date-input { padding: 4px 6px; background: #0d1b2a; color: #f3f4f6; border: 1px solid #2d4a3e; border-radius: 4px; font-size: 11px; font-family: monospace; }
        .met-btn { padding: 4px 10px; background: #152018; color: #74c69d; border: 1px solid #2d4a3e; border-radius: 6px; cursor: pointer; font-size: 11px; font-family: inherit; font-weight: 600; }
        .met-btn:hover { background: #253525; color: #fff; }
        .met-btn:disabled { opacity: .4; cursor: default; }
        .met-btn-primary { background: #2d6a4f; color: #fff; }
        .met-btn-primary:hover:not(:disabled) { background: #1b4332; }
        .met-ctrl-right { margin-left: auto; display: flex; gap: 6px; }
        .met-pill-seg { display: inline-flex; border: 1px solid #2d4a3e; border-radius: 20px; overflow: hidden; }
        .met-seg-btn { background: transparent; border: 0; padding: 3px 10px; cursor: pointer; font-size: 11px; color: #9ca3af; font-family: inherit; }
        .met-seg-btn + .met-seg-btn { border-left: 1px solid #2d4a3e; }
        .met-seg-btn.met-seg-active { background: #253525; color: #74c69d; font-weight: 700; }
        /* KPI cards */
        .met-kpis { display: grid; gap: 6px; grid-template-columns: repeat(3, minmax(0,1fr)); margin-bottom: 8px; }
        @media (min-width:560px) { .met-kpis { grid-template-columns: repeat(5, minmax(0,1fr)); } }
        .met-kpi { background: #111f18; border: 1px solid #253525; border-radius: 8px; padding: 6px 8px; min-width: 0; box-sizing: border-box; cursor: pointer; transition: border-color .2s; }
        .met-kpi:hover { border-color: #2d6a4f; }
        .met-kpi-label { font-size: 11px; color: #6b7280; }
        .met-kpi-value { font-weight: 700; font-size: 14px; color: #f3f4f6; }
        .met-kpi-sub { font-size: 11px; color: #9ca3af; text-align: right; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        /* OC breakdown table */
        .met-table th { text-align: center !important; }
        .met-table td:first-child { text-align: left; }
        .met-w-min { width: 1%; white-space: nowrap; }
        .met-center { text-align: center; }
        .met-oc-name { white-space: nowrap; }
        .met-items-col { white-space: normal; }
        .met-items-list { margin: 0; padding-left: 18px; list-style: disc; }
        .met-items-list li { margin: 0; padding: 0; font-size: 11px; color: #f3f4f6; }
        .met-details-wrap { padding: 8px 10px; font-size: 12px; color: #d1d5db; }
        /* Mobile responsive */
        @media (max-width: 560px) {
            .met-col-runs, .met-col-items, .met-col-paid { display: none; }
            tr.met-main-row { cursor: pointer; }
            tr.met-main-row:hover td { background: #131f18; }
            td.met-oc-name { position: relative; padding-left: 22px; }
            td.met-oc-name::before { content: "▸"; position: absolute; left: 6px; top: 50%; transform: translateY(-50%); opacity: .85; }
            tr.met-main-row[aria-expanded="true"] td.met-oc-name::before { content: "▾"; }
            .met-row-details { display: none; background: #111f18; }
            .met-row-details.met-open { display: table-row; }
            .met-w-min { width: auto; }
            .met-oc-name { white-space: normal; }
        }
        @media (min-width: 561px) { .met-row-details { display: none !important; } }
    `);

    // ═══════════════════════════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════════════
    //  DRAGGABLE HELPER  — works for both mouse and touch (TornPDA)
    // ═══════════════════════════════════════════════════════════════════════
    function makeDraggable(el, { handle = el, onClickFn = null, storageKey = null } = {}) {
        // Restore saved position
        if (storageKey) {
            const saved = GM_getValue(storageKey, null);
            if (saved) {
                el.style.bottom = 'auto'; el.style.right = 'auto';
                el.style.top  = saved.top  + 'px';
                el.style.left = saved.left + 'px';
            }
        }

        let sx, sy, sl, st, moved, suppressClick = false;

        function evtPos(e) {
            return e.touches ? [e.touches[0].clientX, e.touches[0].clientY]
                             : [e.clientX, e.clientY];
        }

        // Click is handled via a dedicated listener so it works reliably after drags
        if (onClickFn) {
            handle.addEventListener('click', e => {
                if (suppressClick) { suppressClick = false; return; }
                // Only fire if no drag happened (mousedown case — touch fires click natively)
                onClickFn();
            });
        }

        function onStart(e) {
            // Skip interactive children (but not the handle element itself)
            const interactive = e.target.closest('button, input, select, a');
            if (interactive && interactive !== handle) return;
            const [x, y] = evtPos(e);
            sx = x; sy = y;
            const r = el.getBoundingClientRect();
            sl = r.left; st = r.top;
            moved = false;
            el.style.bottom = 'auto'; el.style.right = 'auto';
            el.style.top  = st + 'px';
            el.style.left = sl + 'px';
            document.addEventListener('mousemove', onMove);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('mouseup',   onEnd);
            document.addEventListener('touchend',  onEnd);
        }

        function onMove(e) {
            const [x, y] = evtPos(e);
            const dx = x - sx, dy = y - sy;
            if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) moved = true;
            if (!moved) return;
            const w = el.offsetWidth, h = el.offsetHeight;
            el.style.left = Math.max(0, Math.min(window.innerWidth  - w, sl + dx)) + 'px';
            el.style.top  = Math.max(0, Math.min(window.innerHeight - h, st + dy)) + 'px';
            if (e.cancelable) e.preventDefault();
        }

        function onEnd() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('mouseup',   onEnd);
            document.removeEventListener('touchend',  onEnd);
            if (moved) {
                suppressClick = true;
                setTimeout(() => { suppressClick = false; }, 300); // reset if no synthetic click arrives
                if (storageKey) GM_setValue(storageKey, {
                    top:  parseInt(el.style.top),
                    left: parseInt(el.style.left),
                });
            }
        }

        handle.style.cursor = 'grab';
        handle.addEventListener('mousedown',  onStart);
        handle.addEventListener('touchstart', onStart, { passive: true });
    }

    //  DOM SETUP
    // ═══════════════════════════════════════════════════════════════════════
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'oc-spawn-toggle';
    toggleBtn.textContent = '⚔ OC Spawn';
    document.body.appendChild(toggleBtn);

    const panel = document.createElement('div');
    panel.id = 'oc-spawn-panel';
    panel.innerHTML = `
        <h2>
            OC Spawn Assistance <span style="font-size:10px;font-weight:400;color:#6b7280;">v${SCRIPT_VERSION}</span>
            <span style="display:flex;gap:6px;align-items:center;">
                <button id="oc-spawn-refresh">↻ Refresh</button>
                <button id="oc-spawn-settings" class="oc-hdr-btn" title="Settings">⚙</button>
                <button id="oc-spawn-close" class="oc-hdr-btn">✕</button>
            </span>
        </h2>
        <div id="oc-spawn-status">Click Refresh to load data.</div>
        <div id="oc-sub-timer" style="display:none;color:#6b7280;font-size:10px;margin:-4px 0 8px;"></div>

        <div id="oc-settings-panel">
            <div class="oc-setting-row">
                <div class="oc-setting-info">
                    <span class="oc-setting-label">API Key</span>
                    <div class="oc-setting-desc">Your personal Torn API key (<b style="color:#e5b567;">Limited Access</b> or higher required for Admin/Manager/Metrics tabs).</div>
                    <div class="oc-setting-key-wrap">
                        <input id="oc-spawn-key-input" type="text" placeholder="Paste API key…" class="oc-setting-key-input"/>
                        <button id="oc-spawn-key-save" class="oc-setting-save-btn">Save</button>
                    </div>
                </div>
            </div>
            <div id="oc-cfg-section" style="display:none;">
            <hr class="oc-setting-divider"/>
            <div class="oc-setting-row">
                <div class="oc-setting-info">
                    <span class="oc-setting-label">Current Scope</span>
                    <div class="oc-setting-desc">Your faction's current scope balance (0–100). Check the spawn page and update here — the script projects forward from this value.</div>
                </div>
                <input class="oc-setting-num" id="cfg-scope" type="number" min="0" max="100" placeholder="—"/>
            </div>
            <div class="oc-setting-row">
                <div class="oc-setting-info">
                    <span class="oc-setting-label">Active Days</span>
                    <div class="oc-setting-desc">Members inactive longer than this are skipped entirely.</div>
                </div>
                <input class="oc-setting-num" id="cfg-active-days" type="number" min="1" max="30"/>
            </div>
            <div class="oc-setting-row">
                <div class="oc-setting-info">
                    <span class="oc-setting-label">Forecast Hours</span>
                    <div class="oc-setting-desc">Members whose OC ends within this window count as "soon free".</div>
                </div>
                <input class="oc-setting-num" id="cfg-forecast-hours" type="number" min="1" max="72"/>
            </div>
            <div class="oc-setting-row">
                <div class="oc-setting-info">
                    <span class="oc-setting-label">Min CPR %</span>
                    <div class="oc-setting-desc">Minimum checkpoint pass rate a member needs before the script considers them eligible to join a crime at their historical level. Anyone below this gets pinned to Lvl 1 only.</div>
                </div>
                <input class="oc-setting-num" id="cfg-mincpr" type="number" min="0" max="100"/>
            </div>
            <div class="oc-setting-row">
                <div class="oc-setting-info">
                    <span class="oc-setting-label">CPR Boost</span>
                    <div class="oc-setting-desc">CPR ≥ Min+Boost lets a member join one level above their best.</div>
                </div>
                <input class="oc-setting-num" id="cfg-cpr-boost" type="number" min="0" max="40"/>
            </div>
            <div class="oc-setting-row">
                <div class="oc-setting-info">
                    <span class="oc-setting-label">CPR Lookback Days</span>
                    <div class="oc-setting-desc">Days of completed crimes for CPR. Server-cached 6h.</div>
                </div>
                <input class="oc-setting-num" id="cfg-lookback-days" type="number" min="7" max="365"/>
            </div>
            <div class="oc-setting-row">
                <div class="oc-setting-info">
                    <span class="oc-setting-label">High-Weight % Cutoff</span>
                    <div class="oc-setting-desc">Slots at or above this weight % require the higher CPR below.</div>
                </div>
                <input class="oc-setting-num" id="cfg-high-weight-pct" type="number" min="1" max="100"/>
            </div>
            <div class="oc-setting-row">
                <div class="oc-setting-info">
                    <span class="oc-setting-label">High-Weight Min CPR</span>
                    <div class="oc-setting-desc">Min CPR required for slots at or above the cutoff above.</div>
                </div>
                <input class="oc-setting-num" id="cfg-high-weight-mincpr" type="number" min="0" max="100"/>
            </div>
            <!-- v3.1.48: optional faction-wide FFScouter key. Used server-side
                 to fetch each flyer's real takeoff_time so OC delay
                 attribution backdates correctly. Falls back to per-member
                 keys when unset. -->
            <div class="oc-setting-row" style="flex-direction:column;align-items:stretch;">
                <div class="oc-setting-info" style="margin-bottom:4px;">
                    <span class="oc-setting-label">FFScouter API Key</span>
                    <div class="oc-setting-desc">
                        Any Torn API key that's been <a href="https://ffscouter.com" target="_blank" style="color:#60a5fa;">registered at ffscouter.com</a>. Used server-side (never leaves the server) for <b>OC delay attribution</b> — looks up each blocker's real takeoff time so a member flying 6h shows 6h, one flying 20 min shows 20 min, instead of both showing the OC-ready age.
                        Leave blank to fall back to each member's own key (works for members registered at ffscouter.com themselves).
                    </div>
                </div>
                <input class="oc-setting-num" id="cfg-ffs-key" type="text" placeholder="(optional)" style="font-family:monospace;"/>
            </div>

            <div style="text-align:right;margin-top:4px;">
                <button id="oc-spawn-cfg-save" class="oc-setting-save-btn" disabled>Save for All Members</button>
            </div>

            <hr class="oc-setting-divider"/>
            <div class="oc-setting-row" style="flex-direction:column;align-items:stretch;">
                <div class="oc-setting-info" style="margin-bottom:6px;">
                    <span class="oc-setting-label">Admin Roles</span>
                    <div class="oc-setting-desc">Faction positions that can see Admin / Manager / Engines tabs. Comma-separated, case-insensitive (e.g. <code>leader, co-leader, banker</code>). Default: leader, co-leader.</div>
                </div>
                <div style="display:flex;gap:6px;align-items:center;">
                    <input id="cfg-admin-roles" type="text" placeholder="leader, co-leader, …"
                        style="flex:1;background:#0f1a2e;border:1px solid #1e3a5f;color:#dde;border-radius:5px;padding:6px 8px;font-size:12px;">
                    <button id="cfg-admin-roles-save" class="oc-setting-save-btn">Save Roles</button>
                </div>
                <div id="cfg-admin-roles-msg" style="font-size:10px;color:#6b7280;margin-top:4px;min-height:12px;"></div>
            </div>

            <hr class="oc-setting-divider"/>
            <div class="oc-setting-row" style="flex-direction:column;align-items:stretch;">
                <div class="oc-setting-info" style="margin-bottom:6px;">
                    <span class="oc-setting-label">Notifications</span>
                    <div class="oc-setting-desc">Enable push notifications for vault requests, OC spawn-ready alerts, and more. Setup and all per-type toggles live on a dedicated page — install it to your home screen from Safari/Chrome to get PDA-capable notifications.</div>
                </div>
                <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                    <button id="cfg-notif-open" class="oc-setting-save-btn" style="background:#2d6a4f;">Open Notifications Setup</button>
                    <span id="cfg-notif-msg" style="font-size:10px;color:#6b7280;flex:1;min-height:12px;line-height:1.4;"></span>
                </div>
            </div>

            </div><!-- /oc-cfg-section -->
        </div>

        <div id="oc-tab-bar" class="oc-tab-bar" style="display:none;">
            <button class="oc-tab oc-tab-active" data-tab="profile">My OC</button>
            <button class="oc-tab" data-tab="admin" id="oc-admin-tab" style="display:none;">Admin</button>
            <button class="oc-tab" data-tab="manager" id="oc-manager-tab" style="display:none;">Manager</button>
            <button class="oc-tab" data-tab="coaching" id="oc-coaching-tab" style="display:none;">Coaching</button>
            <!-- v3.2.10: Payouts moved to FactionOps overlay (💰 button in header). -->
            <button class="oc-tab" data-tab="metrics" id="oc-metrics-tab" style="display:none;">Metrics</button>
            <button class="oc-tab" data-tab="engines" id="oc-engines-tab" style="display:none;">Engines</button>
        </div>
        <div id="oc-dispatcher-banner" style="display:none;"></div>
        <div id="oc-tab-profile"></div>
        <div id="oc-tab-admin" style="display:none;"></div>
        <div id="oc-tab-manager" style="display:none;"></div>
        <div id="oc-tab-coaching" style="display:none;"></div>
        <div id="oc-tab-metrics" style="display:none;"></div>
        <div id="oc-tab-engines" style="display:none;"></div>
    `;
    document.body.appendChild(panel);

    // ── v3.2.27: dock the panel INLINE under the OC status tabs (Recruiting /
    //    Planning / Completed) instead of floating. The strip is found by its text
    //    labels (class-churn proof). Fully graceful: if the strip isn't found or
    //    anything throws, the panel keeps its default floating CSS. A light interval
    //    re-docks after Torn's React re-renders wipe the inserted node.
    function _ocCommonAncestor(nodes) {
        let a = nodes[0];
        while (a && a.parentElement && !nodes.every((n) => a.contains(n))) a = a.parentElement;
        return (a && nodes.every((n) => a.contains(n))) ? a : null;
    }
    function _ocTabStrip() {
        const want = { Recruiting: null, Planning: null, Completed: null };
        const els = document.querySelectorAll('button, a, [role="tab"], li, span, p, div');
        for (const el of els) {
            if (el.closest('#oc-spawn-panel')) continue;
            const t = (el.textContent || '').trim();
            const base = t.replace(/[\s\d().,]+$/, '').trim(); // tolerate a trailing count e.g. "Recruiting 3"
            if ((base in want) && t.length <= base.length + 6 && el.offsetParent !== null) {
                if (!want[base] || t.length < (want[base].textContent || '').trim().length) want[base] = el;
            }
        }
        if (!want.Recruiting || !want.Planning || !want.Completed) return null;
        return _ocCommonAncestor([want.Recruiting, want.Planning, want.Completed]);
    }
    function _ocAnchorByText(label) {
        let best = null;
        const els = document.querySelectorAll('button, a, [role="tab"], li, h1, h2, h3, h4, span, p, div');
        for (const el of els) {
            if (el.closest('#oc-spawn-panel')) continue;
            const t = (el.textContent || '').trim();
            const base = t.replace(/[\s\d().,:]+$/, '').trim();
            if (base === label && t.length <= base.length + 8 && el.offsetParent !== null) {
                if (!best || t.length < (best.textContent || '').trim().length) best = el;
            }
        }
        return best;
    }
    function _ocDockTarget() {
        const disp = _ocAnchorByText('Dispatcher');     // v3.2.28: preferred anchor
        if (disp) return { el: disp, how: 'dispatcher' };
        const strip = _ocTabStrip();                     // fallback: Recruiting/Planning/Completed strip
        if (strip) return { el: strip, how: 'tabstrip' };
        return null;
    }
    function _ocDescribe(el) {
        if (!el) return null;
        const cls = (el.className && typeof el.className === 'string') ? el.className.slice(0, 44) : '';
        return el.tagName + (cls ? '.' + cls : '') + (el.id ? '#' + el.id : '');
    }
    function _ocAncestry(el, n) {
        const chain = []; let cur = el;
        for (let i = 0; i < n && cur; i++) { chain.push(_ocDescribe(cur)); cur = cur.parentElement; }
        return chain;
    }
    let _ocDiagLogged = 0, _ocDiagScheduled = false;
    function _ocDockDiag() {
        if (_ocDiagLogged > 4) return;
        try {
            const all = document.querySelectorAll('button,a,span,div,h1,h2,h3,h4,p,li,th,td');
            let disp = null, dispChain = null;
            for (const el of all) {
                const t = (el.textContent || '').trim();
                if (/^Dispatcher\b/i.test(t) && t.length <= 16 && el.offsetParent !== null) { disp = _ocDescribe(el); dispChain = _ocAncestry(el, 6); break; }
            }
            const seen = new Set(), ocLabels = [];
            for (const el of all) {
                const t = (el.textContent || '').trim();
                if (t && t.length <= 18 && el.offsetParent !== null && /recruit|planning|complete|dispatch|available|spawn|slot|joinable/i.test(t) && !seen.has(t)) { seen.add(t); ocLabels.push(t); if (ocLabels.length >= 15) break; }
            }
            const tgt = _ocDockTarget();
            if (!tgt && !disp && ocLabels.length === 0) return; // OC content not rendered yet — wait for a later tick
            _ocDiagLogged++;
            GM_xmlhttpRequest({
                method: 'POST', url: 'https://tornwar.com/api/debug/client-log',
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({ tag: 'oc-dock', data: {
                    v: SCRIPT_VERSION, how: tgt ? tgt.how : 'none', url: location.href,
                    tgt: tgt ? _ocDescribe(tgt.el) : null, tgtChain: tgt ? _ocAncestry(tgt.el, 5) : [],
                    disp, dispChain, ocLabels,
                    pDocked: panel.classList.contains('oc-spawn-docked'), pDisp: panel.style.display || '', pParent: _ocDescribe(panel.parentElement),
                } }),
                onload: function () {}, onerror: function () {},
            });
        } catch (_) {}
    }
    function _ocMaybeScheduleDiag() {
        if (_ocDiagScheduled || _ocDiagLogged > 4) return;
        if (!/tab=crimes/.test(location.hash)) return; // only schedule on the OC crimes tab
        _ocDiagScheduled = true;
        [2500, 6000, 11000].forEach((ms) => setTimeout(_ocDockDiag, ms));
    }
    window.addEventListener('hashchange', () => { _ocDiagScheduled = false; });
    function dockPanel() {
        try {
            const hash = location.hash || '';
            // Loaning items happens on the ARMOURY tab (the panel's Loan Item
            // button), so the box must stay visible there too — not only on the
            // crimes tab. Hide only when off both.
            const onArmoury = /tab=armou?ry/i.test(hash);
            const onCrimes = !onArmoury && (/tab=crimes/.test(hash) || !!document.getElementById('faction-crimes-root'));
            if (!onCrimes && !onArmoury) {
                toggleBtn.classList.remove('oc-spawn-docked');
                toggleBtn.style.display = 'none'; panel.style.display = 'none';
                return;
            }
            // Panel is always a floating overlay; keep its open/closed state so
            // it survives the crimes → armoury jump (Loan Item stays reachable)
            // and never pushes/covers the page (the inline panel blocked loans).
            if (panel.parentElement !== document.body) document.body.appendChild(panel);
            panel.classList.remove('oc-spawn-docked');
            let _pv = false; try { _pv = !!panelVisible; } catch (_) {}
            panel.style.display = _pv ? 'block' : 'none';
            toggleBtn.style.display = '';
            const tgt = onCrimes ? _ocDockTarget() : null;
            if (tgt && tgt.el.parentNode) {
                // Crimes tab: dock the toggle button inline under the tabs.
                if (!toggleBtn.classList.contains('oc-spawn-docked') || tgt.el.nextElementSibling !== toggleBtn) {
                    _ocMaybeScheduleDiag();
                    toggleBtn.style.left = toggleBtn.style.top = toggleBtn.style.right = toggleBtn.style.bottom = toggleBtn.style.position = '';
                    toggleBtn.classList.add('oc-spawn-docked');
                    const parent = tgt.el.parentNode;
                    if (tgt.el.nextElementSibling !== toggleBtn) parent.insertBefore(toggleBtn, tgt.el.nextElementSibling);
                }
            } else {
                // Armoury tab (or strip not yet rendered): float the button
                // bottom-right so the panel + Loan Item stay reachable.
                if (toggleBtn.classList.contains('oc-spawn-docked')) toggleBtn.classList.remove('oc-spawn-docked');
                if (toggleBtn.parentElement !== document.body) document.body.appendChild(toggleBtn);
            }
        } catch (_) {}
    }
    setInterval(dockPanel, 1200);
    dockPanel();

    const cprTooltipEl = document.createElement('div');
    cprTooltipEl.id = 'oc-cpr-tooltip';
    document.body.appendChild(cprTooltipEl);

    const recTooltipEl = document.createElement('div');
    recTooltipEl.id = 'oc-rec-tooltip';
    document.body.appendChild(recTooltipEl);

    // v3.1.34: shared click-to-toggle tooltip for Outcome EV column
    // headers. Same panel reused for every info icon; moves to wherever
    // was clicked. Clicking outside closes it.
    const evTooltipEl = document.createElement('div');
    evTooltipEl.id = 'oc-ev-tooltip';
    document.body.appendChild(evTooltipEl);
    document.addEventListener('click', (e) => {
        const info = e.target.closest && e.target.closest('.oc-ev-info');
        if (info) {
            e.preventDefault();
            e.stopPropagation();
            const tt = info.dataset.tt || '';
            const title = info.dataset.ttTitle || '';
            if (evTooltipEl.style.display === 'block' && evTooltipEl.dataset.anchor === info.dataset.tt) {
                evTooltipEl.style.display = 'none';
                return;
            }
            evTooltipEl.innerHTML = (title ? `<div class="oc-tt-title">${title}</div>` : '') + `<div>${tt}</div>`;
            evTooltipEl.dataset.anchor = info.dataset.tt;
            const r = info.getBoundingClientRect();
            const top = Math.min(window.innerHeight - 160, r.bottom + 4);
            const left = Math.min(window.innerWidth - 300, r.left);
            evTooltipEl.style.top = top + 'px';
            evTooltipEl.style.left = left + 'px';
            evTooltipEl.style.display = 'block';
            return;
        }
        // Click outside closes
        if (!e.target.closest('#oc-ev-tooltip')) {
            evTooltipEl.style.display = 'none';
        }
    }, true);

    // Shared handler for any ".oc-msg-btn" click: copy the preset message
    // to the clipboard and open Torn's compose page for the target XID.
    // TornPDA-compatible (execCommand copy + <a>.click navigation).
    function handleOcMsgBtnClick(e) {
        const mb = e.target.closest && e.target.closest('.oc-msg-btn');
        if (!mb) return;
        e.preventDefault();
        e.stopPropagation();
        const xid = mb.dataset.xid;
        const msg = mb.dataset.msg;
        try {
            const ta = document.createElement('textarea');
            ta.value = msg; ta.style.cssText = 'position:fixed;left:-9999px;';
            document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); document.body.removeChild(ta);
        } catch (_) {}
        const orig = mb.textContent;
        mb.textContent = 'Copied! Opening…';
        setTimeout(() => { if (mb.isConnected) mb.textContent = orig; }, 2500);
        const a = document.createElement('a');
        a.href = `https://www.torn.com/messages.php#/p=compose&XID=${xid}`;
        a.target = '_blank'; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    recTooltipEl.addEventListener('click', handleOcMsgBtnClick);
    // Also catch clicks on .oc-msg-btn rendered inside the main panel
    // (e.g. flyer names in the traveling-alert banner). Tooltip is
    // appended to body so the two listeners cover disjoint subtrees.
    panel.addEventListener('click', handleOcMsgBtnClick);

    const scopeTooltipEl = document.createElement('div');
    scopeTooltipEl.id = 'oc-scope-tooltip';
    document.body.appendChild(scopeTooltipEl);

    let panelVisible = false, cprTipOpen = false, scopeTipOpen = false;

    // Draggable toggle button — tap to open/close, drag to reposition
    makeDraggable(toggleBtn, {
        onClickFn:  () => {
            panelVisible = !panelVisible;
            panel.style.display = panelVisible ? 'block' : 'none';
            if (panelVisible) GM_setValue('oc_panel_closed', false); // clear the closed flag
        },
        storageKey: 'oc_btn_pos',
    });

    // Draggable panel — drag the header to reposition (position not saved)
    makeDraggable(panel, {
        handle: panel.querySelector('h2'),
    });
    let _lastRefresh = 0;
    let _refreshTimer = null;
    function startRefreshCooldown() {
        const btn = document.getElementById('oc-spawn-refresh');
        btn.disabled = true;
        let remaining = 3;  // Reduced from 15 to 3 seconds for faster responsiveness
        btn.textContent = `\u21bb ${remaining}s`;
        clearInterval(_refreshTimer);
        _refreshTimer = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                clearInterval(_refreshTimer);
                btn.textContent = '\u21bb Refresh';
                btn.disabled = false;
            } else {
                btn.textContent = `\u21bb ${remaining}s`;
            }
        }, 1000);
    }
    // TornPDA (Flutter InAppWebView) swallows synthesized click events on
    // children of elements with touchstart listeners (the drag handle <h2>
    // the header buttons live inside). Bind both 'click' and 'touchend'
    // with a short dedupe window so a single tap fires the handler exactly
    // once across desktop, mobile web, and the Flutter WebView.
    function bindTap(el, fn) {
        if (!el) return;
        let lastFire = 0;
        const wrapped = (e) => {
            const now = Date.now();
            if (now - lastFire < 350) return;
            lastFire = now;
            if (e.type === 'touchend' && e.cancelable) e.preventDefault();
            fn(e);
        };
        el.addEventListener('click', wrapped);
        el.addEventListener('touchend', wrapped);
    }

    bindTap(document.getElementById('oc-spawn-refresh'), () => {
        if (Date.now() - _lastRefresh < 3000) return; // 3s cooldown between refreshes (reduced from 15s for faster responsiveness)
        _lastRefresh = Date.now();
        startRefreshCooldown();
        runAnalysis();
    });
    bindTap(document.getElementById('oc-spawn-close'), () => {
        panelVisible = false; panel.style.display = 'none';
        GM_setValue('oc_panel_closed', true); // stay closed until user taps button
    });
    bindTap(document.getElementById('oc-spawn-settings'), () => {
        // Switch to Admin tab first, then toggle settings
        switchTab('admin');
        const sp = document.getElementById('oc-settings-panel');
        const opening = sp.style.display === 'none' || sp.style.display === '';
        sp.style.display = opening ? 'block' : 'none';
        if (opening) populateSettings();
    });

    function switchTab(name) {
        document.querySelectorAll('.oc-tab').forEach(t => {
            t.classList.toggle('oc-tab-active', t.dataset.tab === name);
        });
        document.getElementById('oc-tab-profile').style.display  = name === 'profile'  ? '' : 'none';
        document.getElementById('oc-tab-admin').style.display    = name === 'admin'    ? '' : 'none';
        document.getElementById('oc-tab-engines').style.display  = name === 'engines'  ? '' : 'none';
        document.getElementById('oc-tab-manager').style.display  = name === 'manager'  ? '' : 'none';
        document.getElementById('oc-tab-coaching').style.display = name === 'coaching' ? '' : 'none';
        document.getElementById('oc-tab-metrics').style.display  = name === 'metrics'  ? '' : 'none';
        // Close settings panel when switching away from admin
        if (name !== 'admin') document.getElementById('oc-settings-panel').style.display = 'none';
        // Load manager content when switching to it
        if (name === 'manager')  loadManagerTab();
        if (name === 'coaching') loadCoachingTab();
        // v3.2.10: payouts tab removed (moved to FactionOps).
        // Init metrics tab when switching to it
        if (name === 'metrics') met_initTab();
    }

    document.querySelectorAll('.oc-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
            GM_setValue('oc_last_tab', btn.dataset.tab);
        });
    });

    function populateSettings() {
        const key = getApiKey();
        const inp = document.getElementById('oc-spawn-key-input');
        inp.value = '';
        inp.placeholder = (key && key !== 'YOUR_API_KEY_HERE') ? '••••••••' + key.slice(-4) : 'Paste API key…';
        const scopeEl = document.getElementById('cfg-scope');
        scopeEl.value = CONFIG.SCOPE !== null ? CONFIG.SCOPE : '';
        scopeEl.placeholder = CONFIG.SCOPE !== null ? '' : '—';
        document.getElementById('cfg-active-days').value    = CONFIG.ACTIVE_DAYS;
        document.getElementById('cfg-forecast-hours').value = CONFIG.FORECAST_HOURS;
        document.getElementById('cfg-mincpr').value              = CONFIG.MINCPR;
        document.getElementById('cfg-cpr-boost').value            = CONFIG.CPR_BOOST;
        document.getElementById('cfg-lookback-days').value        = CONFIG.CPR_LOOKBACK_DAYS;
        document.getElementById('cfg-high-weight-pct').value      = CONFIG.HIGH_WEIGHT_THRESHOLD;
        document.getElementById('cfg-high-weight-mincpr').value   = CONFIG.HIGH_WEIGHT_MIN_CPR;
        const ffsEl = document.getElementById('cfg-ffs-key');
        if (ffsEl) {
            ffsEl.value = '';
            ffsEl.placeholder = CONFIG._FFS_KEY_SET
                ? '••••••••' + (CONFIG._FFS_KEY_LAST4 || '') + '  (type to replace, blank to keep)'
                : 'Paste a Torn API key registered at ffscouter.com';
        }
        // Admin roles — fetched from server, populated async
        loadAdminRoles();
        // Engine toggles
    }

    async function loadAdminRoles() {
        const apiKey = getApiKey();
        if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') return;
        try {
            const r = await gmRequest(`${SERVER}/api/oc/admin-roles?key=${encodeURIComponent(apiKey)}`);
            if (!r.ok) return;
            const inp = document.getElementById('cfg-admin-roles');
            if (inp) inp.value = (r.data?.roles || []).join(', ');
        } catch (_) {}
    }

    function checkKeyRow() {
        const key = getApiKey();
        if (!key || key === 'YOUR_API_KEY_HERE') {
            document.getElementById('oc-settings-panel').style.display = 'block';
            populateSettings();
        }
    }
    checkKeyRow();

    // Admin-roles save handler. Server enforces three safeguards:
    //   - empty list rejected
    //   - your own position must remain
    //   - mass-removal (≥50% of roles) needs confirmRemove=true
    // Client handles the third by re-prompting with confirm() on a 409.
    const adminRolesSaveBtn = document.getElementById('cfg-admin-roles-save');
    if (adminRolesSaveBtn) adminRolesSaveBtn.addEventListener('click', async () => {
        const apiKey = getApiKey();
        const msg = document.getElementById('cfg-admin-roles-msg');
        if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
            if (msg) msg.textContent = 'Save your API key first.';
            return;
        }
        const raw = document.getElementById('cfg-admin-roles')?.value || '';
        const roles = raw.split(',').map(r => r.trim()).filter(Boolean);
        if (msg) msg.textContent = 'Saving…';

        const post = (confirmRemove = false) => new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: `${SERVER}/api/oc/admin-roles`,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify({ key: apiKey, roles, confirmRemove }),
                onload: (resp) => {
                    let data = {};
                    try { data = JSON.parse(resp.responseText); } catch (_) {}
                    resolve({ ok: resp.status >= 200 && resp.status < 300, status: resp.status, data });
                },
                onerror: () => resolve({ ok: false, status: 0, data: {} }),
            });
        });

        try {
            let r = await post(false);
            // 409 = mass-removal warning. Re-prompt the user with the list of
            // roles being removed and resend with confirmRemove=true if they
            // still want to proceed.
            if (r.status === 409 && Array.isArray(r.data?.removing)) {
                const ok = window.confirm(
                    `This will remove these admin roles:\n  ${r.data.removing.join(', ')}\n\nProceed?`
                );
                if (!ok) {
                    if (msg) msg.textContent = 'Cancelled. No changes saved.';
                    return;
                }
                r = await post(true);
            }
            if (r.ok) {
                if (msg) msg.textContent = `✓ Saved: ${(r.data.roles || []).join(', ')}`;
            } else {
                if (msg) msg.textContent = `Failed: ${r.data?.error || 'unknown'}`;
            }
        } catch (e) {
            if (msg) msg.textContent = `Error: ${e.message}`;
        }
    });

    // Single entry point: the Settings "Open Notifications Setup" button
    // opens tornwar.com/notifications — a dedicated PWA where the user
    // enables push, picks per-type toggles (vault requests, OC spawn-
    // ready, …) and fires a test. Works on desktop directly; on PDA,
    // Web Push can't fire from the Flutter WebView so the page itself
    // prompts the user to open in Safari/Chrome and Add to Home Screen.
    const notifOpenBtn = document.getElementById('cfg-notif-open');
    if (notifOpenBtn) bindTap(notifOpenBtn, () => {
        const apiKey = getApiKey();
        const msgEl = document.getElementById('cfg-notif-msg');
        const url = `${SERVER}/notifications${apiKey && apiKey !== 'YOUR_API_KEY_HERE' ? `?key=${encodeURIComponent(apiKey)}` : ''}`;
        if (IS_PDA) {
            if (msgEl) {
                msgEl.style.color = '#fbbf24';
                msgEl.innerHTML = 'PDA can\'t receive Web Push. Open <b>tornwar.com/notifications</b> in Safari / Chrome → Share → Add to Home Screen → open from home screen to enable.';
            }
            return;
        }
        try {
            if (typeof GM_openInTab === 'function') GM_openInTab(url, { active: true });
            else window.open(url, '_blank', 'noopener');
        } catch (_) { window.open(url, '_blank', 'noopener'); }
        if (msgEl) {
            msgEl.style.color = '#74c69d';
            msgEl.textContent = 'Opened in a new tab.';
        }
    });

    document.getElementById('oc-spawn-key-save').addEventListener('click', () => {
        const val = document.getElementById('oc-spawn-key-input').value.trim();
        if (val.length < 10) return;
        saveApiKey(val);
        GM_setValue('oc_srv_token', null);
        document.getElementById('oc-spawn-key-input').value = '';
        document.getElementById('oc-spawn-key-input').placeholder = '••••••••' + val.slice(-4);
        setStatus('API key saved. Click Refresh.');
    });

    document.getElementById('oc-spawn-cfg-save').addEventListener('click', async () => {
        if (!settingsReady) { alert('Settings not loaded yet — please Refresh first.'); return; }
        const get    = id => Math.max(0, parseInt(document.getElementById(id).value) || 0);
        const rawScope = parseInt(document.getElementById('cfg-scope').value, 10);
        CONFIG.SCOPE          = isNaN(rawScope) ? null : Math.max(0, Math.min(100, rawScope));
        CONFIG.ACTIVE_DAYS    = get('cfg-active-days');
        CONFIG.FORECAST_HOURS = get('cfg-forecast-hours');
        CONFIG.MINCPR                = get('cfg-mincpr');
        CONFIG.CPR_BOOST             = get('cfg-cpr-boost');
        CONFIG.CPR_LOOKBACK_DAYS     = get('cfg-lookback-days');
        CONFIG.HIGH_WEIGHT_THRESHOLD = get('cfg-high-weight-pct');
        CONFIG.HIGH_WEIGHT_MIN_CPR   = get('cfg-high-weight-mincpr');
        const ffsInput = document.getElementById('cfg-ffs-key');
        CONFIG.FFS_KEY               = ffsInput ? String(ffsInput.value || '').trim() : (CONFIG.FFS_KEY || '');

        // Local persistence
        GM_setValue('cfg_active_days',    CONFIG.ACTIVE_DAYS);
        GM_setValue('cfg_forecast_hours', CONFIG.FORECAST_HOURS);
        GM_setValue('cfg_mincpr',              CONFIG.MINCPR);
        GM_setValue('cfg_cpr_boost',           CONFIG.CPR_BOOST);
        GM_setValue('cfg_lookback_days',       CONFIG.CPR_LOOKBACK_DAYS);
        GM_setValue('cfg_high_weight_pct',     CONFIG.HIGH_WEIGHT_THRESHOLD);
        GM_setValue('cfg_high_weight_mincpr',  CONFIG.HIGH_WEIGHT_MIN_CPR);
        GM_setValue('cfg_ffs_key',             CONFIG.FFS_KEY);
        // v3.1.48: push FFS key via POST (body-only, never query params)
        // since it's a credential. Only send if the input has a non-empty
        // value — leaving it blank preserves the existing server-side key.
        // Uses GM_xmlhttpRequest directly (gmRequest is GET-only).
        const _apiKeyForFfs = getApiKey();
        if (CONFIG.FFS_KEY && _apiKeyForFfs && _apiKeyForFfs !== 'YOUR_API_KEY_HERE' && typeof GM_xmlhttpRequest === 'function') {
            await new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: `${SERVER}/api/oc/ffs-key`,
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({ key: _apiKeyForFfs, ffsKey: CONFIG.FFS_KEY }),
                    onload:  () => resolve(),
                    onerror: () => resolve(),
                });
            });
        }
        GM_setValue('cfg_scope',               CONFIG.SCOPE);
        document.getElementById('oc-settings-panel').style.display = 'none';
        setStatus('Saving settings for all faction members…');
        const apiKey = getApiKey();
        if (apiKey && apiKey !== 'YOUR_API_KEY_HERE') await pushFactionSettings(apiKey, CONFIG);
        setStatus('Settings saved for all faction members. Click Refresh.');
    });

    // Engine save button — uses event delegation since button is dynamically rendered
    document.addEventListener('click', async (e) => {
        if (e.target.id !== 'oc-engine-save') return;
        CONFIG.ENGINE_SLOT_OPTIMIZER   = document.getElementById('eng-slot-optimizer').checked;
        CONFIG.ENGINE_CPR_FORECASTER   = document.getElementById('eng-cpr-forecaster').checked;
        CONFIG.ENGINE_FAILURE_RISK     = document.getElementById('eng-failure-risk').checked;

        CONFIG.ENGINE_MEMBER_RELIABILITY = document.getElementById('eng-member-reliability').checked;

        CONFIG.ENGINE_MEMBER_PROJECTOR = document.getElementById('eng-member-projector').checked;
        CONFIG.ENGINE_AUTO_DISPATCHER  = document.getElementById('eng-auto-dispatcher').checked;

        GM_setValue('eng_slot_optimizer',       CONFIG.ENGINE_SLOT_OPTIMIZER);
        GM_setValue('eng_cpr_forecaster',       CONFIG.ENGINE_CPR_FORECASTER);
        GM_setValue('eng_failure_risk',         CONFIG.ENGINE_FAILURE_RISK);
        GM_setValue('eng_member_reliability',   CONFIG.ENGINE_MEMBER_RELIABILITY);
        GM_setValue('eng_member_projector',     CONFIG.ENGINE_MEMBER_PROJECTOR);
        GM_setValue('eng_auto_dispatcher',      CONFIG.ENGINE_AUTO_DISPATCHER);

        const apiKey = getApiKey();
        if (apiKey && apiKey !== 'YOUR_API_KEY_HERE') {
            const p = new URLSearchParams({
                key: apiKey,
                engine_slot_optimizer:   CONFIG.ENGINE_SLOT_OPTIMIZER,
                engine_cpr_forecaster:   CONFIG.ENGINE_CPR_FORECASTER,
                engine_failure_risk:     CONFIG.ENGINE_FAILURE_RISK,
                engine_member_reliability: CONFIG.ENGINE_MEMBER_RELIABILITY,
                engine_member_projector: CONFIG.ENGINE_MEMBER_PROJECTOR,
                engine_auto_dispatcher:  CONFIG.ENGINE_AUTO_DISPATCHER,
            });
            await gmRequest(`${SERVER}/api/oc/engines/update?${p}`);
        }
        setStatus('Engines saved for all faction members. Click Refresh.');
    });

    // ═══════════════════════════════════════════════════════════════════════
    //  CPR TOOLTIP
    // ═══════════════════════════════════════════════════════════════════════
    function showCprTooltip(el) {
        const uid = parseInt(el.dataset.uid), data = cprBreakdownMap[uid];
        if (!data || !data.entries.length) return;
        const byLevel = {};
        for (const e of data.entries) {
            if (!byLevel[e.diff]) byLevel[e.diff] = { sum: 0, count: 0 };
            byLevel[e.diff].sum += e.rate; byLevel[e.diff].count++;
        }
        const levels = Object.keys(byLevel).map(Number).sort((a, b) => b - a);
        const rows = levels.map(lvl => {
            const avg = Math.round(byLevel[lvl].sum / byLevel[lvl].count * 10) / 10;
            const c = avg >= 80 ? '#74c69d' : avg >= 60 ? '#f4a261' : '#9ca3af';
            return `<tr><td>Lvl ${lvl}</td><td>${byLevel[lvl].count} crime${byLevel[lvl].count > 1 ? 's' : ''}</td><td style="color:${c}">${avg}%</td></tr>`;
        }).join('');
        const oc = data.cpr >= 80 ? '#74c69d' : data.cpr >= 60 ? '#f4a261' : '#9ca3af';
        // v3.1.94: per-checkpoint heatmap. Group byCheckpoint keys
        // ("OcName::Role::Cn") into rows of (OcName + Role) → cells per
        // checkpoint, color-coded by pass rate. Only renders if the
        // userscript captured at least one Completed-tab response that
        // contained this member; otherwise the section is omitted.
        let checkpointHtml = '';
        const cps = data.byCheckpoint || {};
        const cpKeys = Object.keys(cps);
        if (cpKeys.length > 0) {
            const groups = {};
            for (const k of cpKeys) {
                const parts = k.split('::');
                if (parts.length !== 3) continue;
                const groupKey = parts[0] + '::' + parts[1];
                const cpNum = Number(String(parts[2]).replace(/^C/, ''));
                if (!groups[groupKey]) groups[groupKey] = {};
                groups[groupKey][cpNum] = cps[k];
            }
            const groupRows = Object.entries(groups).map(([groupKey, byCp]) => {
                const [oc, role] = groupKey.split('::');
                const nums = Object.keys(byCp).map(Number).sort((a, b) => a - b);
                const cells = nums.map(n => {
                    const e = byCp[n];
                    const total = (e.pass || 0) + (e.fail || 0);
                    const rate = total > 0 ? e.rate : 0;
                    const bg = rate >= 80 ? '#1b4332' : rate >= 60 ? '#3d3010' : '#3d1010';
                    const fg = rate >= 80 ? '#74c69d' : rate >= 60 ? '#f4a261' : '#ef4444';
                    return `<td class="oc-tt-heat-cell" style="background:${bg};color:${fg};">`
                         + `<div class="r">${rate}%</div><div class="s">${e.pass}/${total}</div></td>`;
                }).join('');
                return `<tr><td class="oc-tt-heat-label">${oc} <span class="r">${role}</span></td>${cells}</tr>`;
            }).join('');
            // v3.2.2: heatmap wrapped in a horizontal-scroll container so
            // OCs with many checkpoints (e.g. 12-cp scenarios) don't
            // explode the tooltip width. Cell + label classes carry the
            // sizing — see #oc-cpr-tooltip .oc-tt-heat* in the CSS block.
            checkpointHtml = `<div class="oc-tt-note" style="font-weight:600;color:#d1d5db;">Per-checkpoint pass rate</div>
                <div class="oc-tt-heat-wrap"><table class="oc-tt-heat"><tbody>${groupRows}</tbody></table></div>`;
        }

        cprTooltipEl.innerHTML = `
            <div class="oc-tt-title">${data.name}</div>
            <div class="oc-tt-avg">Avg: <b style="color:${oc}">${data.cpr}%</b> from ${data.entries.length} crime${data.entries.length > 1 ? 's' : ''}</div>
            <table><thead><tr><th>Level</th><th>Crimes</th><th>Avg CPR</th></tr></thead><tbody>${rows}</tbody></table>
            ${checkpointHtml}
            <div class="oc-tt-note">Only counts crimes within 1 level of player's best</div>`;
        cprTooltipEl.style.display = 'block';
        const rect = el.getBoundingClientRect();
        cprTooltipEl.style.top = (rect.bottom + 6) + 'px';
        cprTooltipEl.style.left = rect.left + 'px';
        requestAnimationFrame(() => {
            const tr = cprTooltipEl.getBoundingClientRect();
            if (tr.right  > window.innerWidth  - 8) cprTooltipEl.style.left = (window.innerWidth  - tr.width  - 8) + 'px';
            if (tr.bottom > window.innerHeight - 8) cprTooltipEl.style.top  = (rect.top - tr.height - 6) + 'px';
        });
        cprTipOpen = true;
    }
    function hideCprTooltip() { cprTooltipEl.style.display = 'none'; cprTipOpen = false; }

    // ═══════════════════════════════════════════════════════════════════════
    //  REC TOOLTIP
    // ═══════════════════════════════════════════════════════════════════════
    function showRecTooltip(el) {
        const uid = parseInt(el.dataset.uid);
        const rec = recMap[uid];
        if (!rec) return;
        let html;
        if (rec.type === 'inoc') {
            html = `<div class="oc-tt-title">Currently in OC</div><div class="oc-tt-avg">${rec.text}</div>`;
        } else if (rec.type === 'none') {
            html = `<div class="oc-tt-title">No OCs Available</div><div class="oc-tt-avg">${rec.text}</div>`;
        } else {
            const cprStr = rec.cpr > 0 ? ` <span style="color:#74c69d">${rec.cpr}%</span>` : '';
            const posStr = rec.position ? `<br><span style="color:#9ca3af">Role: ${rec.position}${cprStr}</span>` : '';
            const moreStr = rec.count > 1 ? `<div class="oc-tt-note">${rec.count - 1} other Lvl ${rec.level} OC${rec.count > 2 ? 's' : ''} also open</div>` : '';
            const msgText = `Please join ${rec.crime}${rec.position ? ' as ' + rec.position : ''}`;
            const msgBtn = `<button class="oc-msg-btn" data-xid="${uid}" data-msg="${msgText.replace(/"/g, '&quot;')}" style="margin-top:6px;width:100%;padding:4px 8px;background:#2d4a3e;color:#74c69d;border:1px solid #3d6a4e;border-radius:4px;cursor:pointer;font-size:10px;font-weight:600;">Message Player</button>`;
            html = `<div class="oc-tt-title">${rec.crime}</div><div class="oc-tt-avg">Lvl ${rec.level} OC${posStr}</div>${moreStr}${msgBtn}`;
        }
        recTooltipEl.innerHTML = html;
        recTooltipEl.style.display = 'block';
        const r = el.getBoundingClientRect();
        recTooltipEl.style.top  = (r.bottom + 6) + 'px';
        recTooltipEl.style.left = r.left + 'px';
        requestAnimationFrame(() => {
            const tr = recTooltipEl.getBoundingClientRect();
            if (tr.right  > window.innerWidth  - 8) recTooltipEl.style.left = (window.innerWidth  - tr.width  - 8) + 'px';
            if (tr.bottom > window.innerHeight - 8) recTooltipEl.style.top  = (r.top - tr.height - 6) + 'px';
        });
    }
    function hideRecTooltip() { recTooltipEl.style.display = 'none'; }

    // ═══════════════════════════════════════════════════════════════════════
    //  SCOPE TOOLTIP
    // ═══════════════════════════════════════════════════════════════════════
    function showScopeTooltip(el) {
        if (!lastScopeProjection || !lastScopeProjection.details.length) {
            if (lastScopeProjection) {
                scopeTooltipEl.innerHTML = `<div class="oc-tt-title">Scope Projection</div><div class="oc-tt-avg">No in-flight crimes found in ${CONFIG.FORECAST_HOURS}h window. Only daily regen (+${lastScopeProjection.regen}) applied.</div>`;
                scopeTooltipEl.style.display = 'block';
                const r = el.getBoundingClientRect();
                scopeTooltipEl.style.top = (r.bottom + 6) + 'px'; scopeTooltipEl.style.left = r.left + 'px';
                scopeTipOpen = true;
            }
            return;
        }
        const p = lastScopeProjection;
        const rows = p.details.map(d => {
            return `<tr><td>${d.name}</td><td>${d.avgCpr}%</td><td>+${d.expectedGain}</td></tr>`;
        }).join('');

        scopeTooltipEl.innerHTML = `
            <div class="oc-tt-title">Scope Calculation</div>
            <div class="oc-tt-avg">Base: <b>${p.current}</b> + ${p.regen} daily</div>
            <table><thead><tr><th>Crime</th><th>Prob.</th><th>Gain</th></tr></thead><tbody>${rows}</tbody></table>
            <div class="oc-tt-note">Gain = Success payout × Average member CPR</div>`;
        scopeTooltipEl.style.display = 'block';
        const rect = el.getBoundingClientRect();
        scopeTooltipEl.style.top = (rect.bottom + 6) + 'px';
        scopeTooltipEl.style.left = rect.left + 'px';
        requestAnimationFrame(() => {
            const tr = scopeTooltipEl.getBoundingClientRect();
            if (tr.right  > window.innerWidth  - 8) scopeTooltipEl.style.left = (window.innerWidth  - tr.width  - 8) + 'px';
            if (tr.bottom > window.innerHeight - 8) scopeTooltipEl.style.top  = (rect.top - tr.height - 6) + 'px';
        });
        scopeTipOpen = true;
    }
    function hideScopeTooltip() { scopeTooltipEl.style.display = 'none'; scopeTipOpen = false; }

    panel.addEventListener('click', e => {
        const t = e.target.closest('.oc-cpr-click');
        if (t) { e.stopPropagation(); hideScopeTooltip(); hideRecTooltip(); showCprTooltip(t); return; }
        const ps = e.target.closest('.oc-proj-click');
        if (ps) { e.stopPropagation(); hideCprTooltip(); hideRecTooltip(); showScopeTooltip(ps); return; }
        const rb = e.target.closest('.oc-rec-btn');
        if (rb) { e.stopPropagation(); hideCprTooltip(); hideScopeTooltip(); showRecTooltip(rb); return; }

        hideCprTooltip(); hideScopeTooltip(); hideRecTooltip();
    });
    document.addEventListener('click', (e) => {
        // Don't close rec tooltip if clicking inside it (for Message Player button)
        if (recTooltipEl.contains(e.target)) return;
        if (cprTipOpen) hideCprTooltip(); if (scopeTipOpen) hideScopeTooltip(); hideRecTooltip();
    });

    // ═══════════════════════════════════════════════════════════════════════
    //  UTILITY
    // ═══════════════════════════════════════════════════════════════════════
    const now = () => Math.floor(Date.now() / 1000);
    function setStatus(msg) { document.getElementById('oc-spawn-status').textContent = msg; }
    function updateSubTimer(viewer) {
        const el = document.getElementById('oc-sub-timer');
        if (!el || !viewer) return;
        const exp = viewer.subscriptionExpiresAt;
        if (!exp) { el.style.display = 'none'; return; }
        if (exp === 'permanent') {
            el.innerHTML = '\u2705 Subscription: <b style="color:#4ade80;">Permanent</b>';
            el.style.display = 'block'; return;
        }
        const expiresMs = new Date(exp).getTime();
        const nowMs = Date.now();
        const diffMs = expiresMs - nowMs;
        if (diffMs <= 0) {
            el.innerHTML = '\u26a0\ufe0f Subscription: <b style="color:#ef4444;">Expired</b>';
            el.style.display = 'block'; return;
        }
        const days = Math.floor(diffMs / 86400000);
        const hours = Math.floor((diffMs % 86400000) / 3600000);
        const color = days < 3 ? '#ef4444' : days < 7 ? '#e5b567' : '#4ade80';
        el.innerHTML = `\u23f3 Subscription: <b style="color:${color};">${days}d ${hours}h remaining</b>`;
        el.style.display = 'block';
    }
    function normArr(raw) { return Array.isArray(raw) ? raw : Object.values(raw || {}); }

    // ═══════════════════════════════════════════════════════════════════════
    //  PROCESS MEMBERS
    // ═══════════════════════════════════════════════════════════════════════
    function processMembers(members, availableCrimes, cprCache) {
        const activeCutoff = now() - CONFIG.ACTIVE_DAYS * 86400;
        const forecastCutoff = now() + CONFIG.FORECAST_HOURS * 3600;
        const memberOcMap = {};
        for (const crime of normArr(availableCrimes)) {
            if (crime.status === 'Expired') continue;
            if (!Array.isArray(crime.slots)) continue;
            for (const slot of crime.slots) {
                const uid = slot.user_id ?? slot.user?.id;
                if (!uid) continue;
                memberOcMap[uid] = { crimeDifficulty: crime.difficulty, crimeStatus: crime.status, readyAt: crime.ready_at ?? 0, crimeId: crime.id, crimeName: crime.name };
            }
        }
        const eligible = [], skipped = [];
        for (const m of normArr(members)) {
            const uid = m.id ?? m.player_id;
            const lastAction = m.last_action?.timestamp ?? 0;
            const ocInfo = memberOcMap[uid];
            const inOC   = !!ocInfo;
            // Enrich ALL members with CPR data (needed even for skipped — viewer card uses it)
            const cpr = cprCache[uid] ?? null;
            const cprValue = cpr?.cpr ?? null;
            const highestLvl = cpr?.highestLevel ?? 0;
            // Trust server's per-level joinable (already accounts for per-level CPR vs MINCPR)
            const joinable = cpr?.joinable ?? (cprValue !== null && cprValue >= CONFIG.MINCPR ? highestLvl : 1);
            const enriched = {
                ...m, id: uid, name: m.name, lastAction, status: m.status?.state ?? 'Unknown',
                inOC, ocReadyAt: inOC ? ocInfo?.readyAt : null,
                ocCrimeName: inOC ? ocInfo?.crimeName : null, ocStatus: inOC ? ocInfo?.crimeStatus : null,
                currentCrimeDiff: inOC ? ocInfo?.crimeDifficulty : null,
                cpr: cprValue, highestLevel: highestLvl, joinable,
                noCrimeHistory: cprValue === null,
                cprEstimated: cpr?.estimated || false,
                cprEntries: cpr?.entries ?? [],
                byPosition: cpr?.byPosition ?? {},
                byCheckpoint: cpr?.byCheckpoint ?? {},
            };
            const daysInFaction = m.days_in_faction ?? 999;
            if (daysInFaction < 3) { skipped.push({ ...enriched, skipReason: `New member (${daysInFaction}d, need 3d)` }); continue; }
            if (lastAction < activeCutoff) { skipped.push({ ...enriched, skipReason: `Inactive >${CONFIG.ACTIVE_DAYS}d` }); continue; }
            if (inOC && ocInfo.readyAt > forecastCutoff) { skipped.push({ ...enriched, skipReason: `In OC (ready ${fmtTs(ocInfo.readyAt)})` }); continue; }
            eligible.push(enriched);
        }
        return { eligible, skipped };
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  SCOPE PROJECTION
    // ═══════════════════════════════════════════════════════════════════════
    function projectScope(currentScope, eligible) {
        if (currentScope === null) return null;
        const regenDays = CONFIG.FORECAST_HOURS / 24;
        const regen = regenDays * SCOPE_REGEN_PER_DAY;

        // Expected scope from in-flight crimes completing within the forecast window
        const forecastCutoff = now() + CONFIG.FORECAST_HOURS * 3600;
        const completingSoon = eligible.filter(m => m.inOC && m.ocReadyAt && m.ocReadyAt <= forecastCutoff);

        // Group by crime (shared readyAt + difficulty)
        const crimeGroups = {};
        for (const m of completingSoon) {
            const key = `${m.ocReadyAt}_${m.currentCrimeDiff}`;
            if (!crimeGroups[key]) crimeGroups[key] = { diff: m.currentCrimeDiff, name: m.ocCrimeName, members: [] };
            crimeGroups[key].members.push(m);
        }

        let totalExpectedGain = 0;
        const details = [];
        for (const group of Object.values(crimeGroups)) {
            if (!group.diff) continue;
            const range   = diffToScopeRange(group.diff);
            const avgCPR  = group.members.reduce((s, m) => s + (m.cpr ?? 0), 0) / group.members.length;
            const gain    = Math.round((range.payout * (avgCPR / 100)) * 10) / 10;
            totalExpectedGain += gain;
            details.push({ name: group.name || `Lvl ${group.diff} OC`, avgCpr: Math.round(avgCPR), payout: range.payout, expectedGain: gain });
        }

        const projected = Math.min(SCOPE_MAX, currentScope + regen + totalExpectedGain);
        return { current: currentScope, regen: Math.round(regen * 10) / 10, expectedGain: Math.round(totalExpectedGain * 10) / 10, projected: Math.round(projected * 10) / 10, details };
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  SLOT COUNT
    // ═══════════════════════════════════════════════════════════════════════
    function countOpenSlots(availableCrimes) {
        // v3.2.25: count crimes at EVERY status (not just Recruiting)
        // so a level whose OCs are all filled (Planning) still shows
        // up in the recommendations table. Open-slot math still only
        // applies to Recruiting status — Planning OCs have no joinable
        // slots, but the crime itself is still active.
        const slotMap = {};
        for (const crime of normArr(availableCrimes)) {
            const d = crime.difficulty;
            if (!slotMap[d]) slotMap[d] = { totalSlots: 0, openSlots: 0, crimes: [] };
            let open = 0, total = 0;
            if (crime.status === 'Recruiting') {
                for (const slot of (crime.slots || [])) { total++; if (!slot.user_id && !slot.user?.id) open++; }
                slotMap[d].totalSlots += total;
                slotMap[d].openSlots  += open;
            }
            slotMap[d].crimes.push({
                id: crime.id, name: crime.name, status: crime.status,
                open, total, filled: total - open,
            });
        }
        return slotMap;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  RECOMMENDATIONS  — priority high→low, scope-budgeted
    // ═══════════════════════════════════════════════════════════════════════
    function buildRecommendations(eligible, slotMap, scopeProjection) {
        // Process HIGH levels first (priority), then walk down
        let scopeBudget = scopeProjection ? scopeProjection.projected : null;
        const recs = [];

        for (let lvl = 10; lvl >= 1; lvl--) {
            const membersForLevel = eligible.filter(m => m.joinable === lvl);
            const freeNow   = membersForLevel.filter(m => !m.inOC);
            const soonFree  = membersForLevel.filter(m => m.inOC);
            const totalNeeded = freeNow.length + soonFree.length;
            const info    = slotMap[lvl] || { totalSlots: 0, openSlots: 0, crimes: [] };
            const deficit = totalNeeded - info.openSlots;
            const sr      = diffToScopeRange(lvl);

            const recruitingCount = info.crimes.filter(c => c.status === 'Recruiting').length;
            const slotsPerOc = recruitingCount > 0 ? (info.totalSlots / recruitingCount) : DEFAULT_SLOTS_PER_OC[sr.range];
            // Only recommend spawning if we have enough people to FILL an OC
            const numOcsNeeded = Math.floor(deficit / slotsPerOc);

            let action, numOcsToSpawn = 0;

            if (totalNeeded === 0) {
                action = 'none';
            } else if (info.totalSlots === 0 && totalNeeded > 0) {
                // No OCs exist at all but members are waiting — recommend spawning 1
                action = 'spawn';
                numOcsToSpawn = 1;
                if (scopeBudget !== null) scopeBudget -= sr.cost;
            } else if (info.openSlots === 0 && numOcsNeeded === 0 && totalNeeded > 0) {
                // OCs exist but full, not enough members for another — show waiting
                action = 'waiting';
            } else if (deficit <= 0) {
                action = deficit === 0 ? 'ok' : 'surplus';
                numOcsToSpawn = 0;
            } else if (numOcsNeeded === 0) {
                // Deficit > 0 but not enough for a full OC. Open slots exist and are being filled.
                action = 'waiting';
                numOcsToSpawn = 0;
            } else if (scopeBudget === null) {
                // No scope configured — fall back to simple deficit
                action = 'spawn';
                numOcsToSpawn = numOcsNeeded;
            } else {
                const canAfford = Math.floor(scopeBudget / sr.cost);
                if (canAfford <= 0) {
                    action = 'deferred';
                    numOcsToSpawn = 0;
                } else if (canAfford < numOcsNeeded) {
                    action = 'spawn_partial';
                    numOcsToSpawn = canAfford;
                    scopeBudget -= canAfford * sr.cost;
                } else {
                    action = 'spawn';
                    numOcsToSpawn = numOcsNeeded;
                    scopeBudget -= numOcsNeeded * sr.cost;
                }
            }

            recs.push({
                level: lvl, freeMembers: freeNow.length, soonMembers: soonFree.length,
                openSlots: info.openSlots, totalSlots: info.totalSlots,
                recruitingOCs: info.crimes.length, deficit, numOcsToSpawn, action,
                scopeCost: sr.cost, scopeRange: sr.range,
                names: membersForLevel.map(m => m.name),
            });
        }

        // Display order: high levels first (already in correct order)
        return recs;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  RENDERING
    // ═══════════════════════════════════════════════════════════════════════
    function fmtTs(ts) {
        if (!ts) return '—';
        const d = new Date(ts * 1000), h = d.getHours().toString().padStart(2,'0'), m = d.getMinutes().toString().padStart(2,'0');
        if (d.toDateString() === new Date().toDateString()) return `today ${h}:${m}`;
        return `${d.getMonth()+1}/${d.getDate()} ${h}:${m}`;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ENGINE RENDERERS
    // ═══════════════════════════════════════════════════════════════════════
    function renderEnginesTab(engines, viewer, availableCrimes, cprCache) {
        engines = engines || {};
        let html = `<div style="padding:4px 0;">`;

        // Engine toggles
        html += `<div style="font-size:11px;font-weight:600;color:#f3f4f6;margin-bottom:8px;">Enable/Disable Engines</div>`;

        html += `<div style="font-size:10px;color:#9ca3af;margin-bottom:6px;font-weight:600;">Optimization</div>`;
        // v3.1.32: Slot Optimizer replaced by Outcome EV — same toggle id
        // (eng-slot-optimizer) so existing server-side engine state persists,
        // but the rendered panel is now per-OC outcome probabilities for
        // Planning crimes instead of member-to-slot assignments.
        html += `<label class="oc-engine-toggle"><input type="checkbox" id="eng-slot-optimizer" ${CONFIG.ENGINE_SLOT_OPTIMIZER ? 'checked' : ''}/> <span>Outcome EV</span><span class="oc-engine-desc">Per-OC Pass %, Top-end %, and Q score for Planning crimes</span></label>`;
        html += `<label class="oc-engine-toggle"><input type="checkbox" id="eng-cpr-forecaster" ${CONFIG.ENGINE_CPR_FORECASTER ? 'checked' : ''}/> <span>CPR Forecaster</span><span class="oc-engine-desc">Project member CPR trends over time</span></label>`;

        html += `<div style="font-size:10px;color:#9ca3af;margin:8px 0 6px;font-weight:600;">Risk</div>`;
        html += `<label class="oc-engine-toggle"><input type="checkbox" id="eng-failure-risk" ${CONFIG.ENGINE_FAILURE_RISK ? 'checked' : ''}/> <span>Failure Risk</span><span class="oc-engine-desc">Score OC failure probability before launch</span></label>`;

        html += `<label class="oc-engine-toggle"><input type="checkbox" id="eng-member-reliability" ${CONFIG.ENGINE_MEMBER_RELIABILITY ? 'checked' : ''}/> <span>Member Reliability</span><span class="oc-engine-desc">Track member availability, completion rates, and consistency</span></label>`;

        html += `<div style="font-size:10px;color:#9ca3af;margin:8px 0 6px;font-weight:600;">Recruitment</div>`;
        html += `<label class="oc-engine-toggle"><input type="checkbox" id="eng-member-projector" ${CONFIG.ENGINE_MEMBER_PROJECTOR ? 'checked' : ''}/> <span>Member Projector</span><span class="oc-engine-desc">Estimate member OC potential and project readiness for higher levels</span></label>`;

        html += `<div style="font-size:10px;color:#9ca3af;margin:8px 0 6px;font-weight:600;">Dispatch</div>`;
        html += `<label class="oc-engine-toggle"><input type="checkbox" id="eng-auto-dispatcher" ${CONFIG.ENGINE_AUTO_DISPATCHER ? 'checked' : ''}/> <span>Auto-Dispatcher</span><span class="oc-engine-desc">Personalized "join this OC" recommendation banner for each member</span></label>`;

        html += `<div style="text-align:right;margin-top:8px;"><button id="oc-engine-save" class="oc-setting-save-btn">Save Engines</button></div>`;

        // Engine results
        if (engines.slotOptimizer || engines.failureRisk || engines.cprForecaster || engines.memberProjector || engines.memberReliability) {
            html += `<div style="margin-top:12px;border-top:1px solid #374151;padding-top:10px;">`;
            // v3.1.32: Slot Optimizer engine toggle now renders Outcome EV
            // instead. engines.slotOptimizer still arrives from the server
            // (member-to-slot assignment data) but we ignore it — the new
            // panel derives everything from availableCrimes + cprCache.
            if (engines.slotOptimizer) {
                html += renderOutcomeEvEngineShell(availableCrimes);
                html += renderRecentCompletions(_lastRecentCompletions);
            }
            if (engines.failureRisk) html += renderFailureRisk(engines.failureRisk);
            if (engines.cprForecaster) html += renderCprForecaster(engines.cprForecaster);
            if (engines.memberProjector) html += renderMemberProjector(engines.memberProjector);
            if (engines.memberReliability) html += renderMemberReliability(engines.memberReliability);

            html += `</div>`;
        }
        // Note: Auto-Dispatcher renders as a persistent banner above tab content, not in engines tab

        html += `</div>`;
        return html;
    }

    function renderCprForecaster(engineData) {
        if (!engineData || !engineData.members || engineData.members.length === 0)
            return '<div style="color:#6b7280;font-size:11px;">Not enough OC history for forecasting yet.</div>';
        const { members } = engineData;
        let html = `<div style="margin:12px 0;border:1px solid #1e3a5f;border-radius:8px;padding:10px;background:#0a141f;">`;
        html += `<div style="font-size:12px;font-weight:700;color:#60a5fa;margin-bottom:8px;">\u{1f4c8} CPR Forecaster</div>`;
        html += `<div style="display:flex;flex-direction:column;gap:6px;">`;

        for (const m of members) {
            // Use highest level trend for the border color
            const topLvl = (m.levels || [])[0];
            const borderColor = topLvl ? (topLvl.trend === 'improving' ? '#4ade80' : topLvl.trend === 'declining' ? '#ef4444' : '#374151') : '#374151';

            html += `<div style="background:#111820;border-radius:4px;padding:6px 8px;border-left:3px solid ${borderColor};">`;
            html += `<div style="font-size:11px;margin-bottom:4px;"><span style="color:#f3f4f6;font-weight:600;">${m.name}</span></div>`;

            // Per-level breakdown with roles
            for (const lvl of (m.levels || [])) {
                const lTrendIcon = lvl.trend === 'improving' ? '\u25b2' : lvl.trend === 'declining' ? '\u25bc' : '\u25ac';
                const lTrendColor = lvl.trend === 'improving' ? '#4ade80' : lvl.trend === 'declining' ? '#ef4444' : '#6b7280';
                const lCprColor = lvl.currentCpr >= 80 ? '#4ade80' : lvl.currentCpr >= 60 ? '#e5b567' : '#ef4444';

                html += `<div style="font-size:10px;padding:2px 0;">`;
                html += `<div style="display:flex;align-items:center;gap:6px;color:#9ca3af;font-weight:600;">`;
                html += `<span style="min-width:35px;">Lvl ${lvl.level}</span>`;
                html += `<span style="color:${lCprColor};">${lvl.currentCpr.toFixed(0)}%</span>`;
                html += `<span style="color:${lTrendColor};">${lTrendIcon}</span>`;
                html += `<span style="color:#374151;font-size:9px;">(${lvl.count} OCs)</span>`;
                html += `</div>`;

                // Role breakdown within this level
                for (const r of (lvl.roles || [])) {
                    const rTrendIcon = r.trend === 'improving' ? '\u25b2' : r.trend === 'declining' ? '\u25bc' : '\u25ac';
                    const rTrendColor = r.trend === 'improving' ? '#4ade80' : r.trend === 'declining' ? '#ef4444' : '#6b7280';
                    const rCprColor = r.currentCpr >= 80 ? '#4ade80' : r.currentCpr >= 60 ? '#e5b567' : '#ef4444';
                    const rChange = r.changePerMonth > 0 ? `+${r.changePerMonth}` : `${r.changePerMonth}`;

                    html += `<div style="display:flex;align-items:center;gap:5px;font-size:9px;padding:0 0 0 16px;">`;
                    html += `<span style="color:#6b7280;min-width:60px;">${r.role}</span>`;
                    html += `<span style="color:${rCprColor};font-weight:600;min-width:30px;">${r.currentCpr.toFixed(0)}%</span>`;
                    html += `<span style="color:${rTrendColor};">${rTrendIcon}</span>`;
                    html += `<span style="color:${rTrendColor};min-width:40px;">${rChange}%/mo</span>`;
                    html += `<span style="color:#4b5563;">${r.projectedMin}%-${r.projectedMax}%</span>`;
                    html += `<span style="color:#374151;">(${r.count})</span>`;
                    html += `</div>`;
                }
                html += `</div>`;
            }
            html += `</div>`;
        }

        html += `</div></div>`;
        return html;
    }

    function renderFailureRisk(engineData) {
        if (!engineData || !engineData.crimes) return '';
        const { crimes } = engineData;
        if (crimes.length === 0) return '<div style="color:#6b7280;font-size:11px;">No recruiting OCs to analyze.</div>';
        let html = `<div style="margin:12px 0;border:1px solid #7f1d1d;border-radius:8px;padding:10px;background:#1a0a0a;">`;
        html += `<div style="font-size:12px;font-weight:700;color:#ef4444;margin-bottom:8px;">\u26a0\ufe0f Failure Risk Analysis</div>`;
        html += `<div style="display:flex;flex-direction:column;gap:6px;">`;
        for (const c of crimes) {
            const riskColor = c.failureRisk >= 60 ? '#ef4444' : c.failureRisk >= 30 ? '#e5b567' : '#4ade80';
            const riskLabel = c.failureRisk >= 60 ? 'High Risk' : c.failureRisk >= 30 ? 'Moderate' : 'Low Risk';
            html += `<div style="background:#111;border-radius:6px;padding:8px;border-left:3px solid ${riskColor};">`;
            html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">`;
            html += `<span style="color:#f3f4f6;font-weight:600;font-size:11px;">${c.crimeName} <span style="color:#6b7280;font-weight:400;">Lvl ${c.difficulty}</span></span>`;
            html += `<span style="color:${riskColor};font-weight:700;font-size:11px;">${c.failureRisk}% ${riskLabel}</span>`;
            html += `</div>`;
            html += `<div style="font-size:10px;color:#9ca3af;margin-bottom:4px;">${c.filledSlots}/${c.totalSlots} slots filled${c.emptySlots > 0 ? ` \u2014 <span style="color:#e5b567;">${c.emptySlots} empty</span>` : ''}</div>`;
            // v3.2.19: source-badge helper covers live / checkpoint-
            // history / CPR. Checkpoint-history shows sample count so
            // admins can see how trustworthy the number is.
            const sourceBadge = (s) => {
                if (s.successSource === 'live') {
                    return ' <span style="color:#74c69d;font-size:9px;">●live</span>';
                }
                if (s.successSource === 'checkpoint-history') {
                    return ` <span style="color:#a78bfa;font-size:9px;" title="from ${s.cpHistSamples} historical checkpoint sample(s)">★${s.cpHistSamples}</span>`;
                }
                return '';
            };
            if (c.dangerSlots && c.dangerSlots.length > 0) {
                for (const d of c.dangerSlots) {
                    const pct = d.successPct != null ? d.successPct : Math.round(d.cpr || 0);
                    html += `<div style="font-size:10px;color:#ef4444;padding:2px 0;">\u{1f6a8} <b>${d.name}</b> — ${d.position} (${pct}%${sourceBadge(d)}, ${d.weight.toFixed(0)}% weight)</div>`;
                }
            }
            if ((!c.dangerSlots || c.dangerSlots.length === 0) && c.weakestLink) {
                const w = c.weakestLink;
                let pctLabel;
                if (w.isNewMember) {
                    pctLabel = 'new member';
                } else {
                    const pct = w.successPct != null ? w.successPct : Math.round(w.cpr || 0);
                    pctLabel = `${pct}% chance${sourceBadge(w)}`;
                }
                html += `<div style="font-size:10px;color:#e5b567;padding:2px 0;">Weakest: <b>${w.name}</b> — ${w.position} (${pctLabel}, ${w.weight.toFixed(0)}% weight)</div>`;
            }
            html += `</div>`;
        }
        html += `</div></div>`;
        return html;
    }

    function renderSlotOptimizer(engineData, viewer) {
        if (!engineData || !engineData.assignments) return '';
        const { assignments, stats } = engineData;
        let html = `<div style="margin:12px 0;border:1px solid #2d6a4f;border-radius:8px;padding:10px;background:#0a1f14;">`;
        html += `<div style="font-size:12px;font-weight:700;color:#4ade80;margin-bottom:6px;">\u2699\ufe0f Slot Optimizer</div>`;
        html += `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;font-size:10px;color:#9ca3af;">`;
        html += `<span>\u{1f4ca} <b style="color:#f3f4f6;">${stats.openSlots}</b> open slots</span>`;
        html += `<span>\u{1f465} <b style="color:#f3f4f6;">${stats.freeMembers}</b> free members</span>`;
        html += `<span>\u2705 <b style="color:#4ade80;">${stats.assigned}</b> assigned</span>`;
        if (stats.unfilledSlots > 0) html += `<span>\u26a0\ufe0f <b style="color:#e5b567;">${stats.unfilledSlots}</b> unfilled</span>`;
        html += `</div>`;

        if (assignments.length === 0) {
            html += `<div style="color:#6b7280;font-size:11px;">No assignments possible — all slots filled or no eligible free members.</div>`;
        } else {
            html += `<div style="display:flex;flex-direction:column;gap:4px;">`;
            for (const a of assignments) {
                const cprColor = (a.positionCpr || a.memberCpr) >= 80 ? '#4ade80' : (a.positionCpr || a.memberCpr) >= 60 ? '#e5b567' : '#ef4444';
                html += `<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;background:#111b14;border-radius:4px;font-size:10px;flex-wrap:wrap;">`;
                html += `<span style="color:#f3f4f6;font-weight:600;min-width:90px;">${a.memberName}</span>`;
                html += `<span style="color:#6b7280;">\u2192</span>`;
                html += `<span style="color:#74c69d;font-weight:600;">${a.crimeName}</span>`;
                html += `<span style="color:#9ca3af;">${a.position}</span>`;
                const displayCpr = a.positionCpr || a.memberCpr;
                const cprPrefix = a.isEstimatedCpr ? '~' : '';
                html += `<span style="color:${cprColor};font-weight:600;">${cprPrefix}${displayCpr.toFixed(0)}%</span>`;
                // Dev-only sample count (XID 137558). Lets you see how much
                // history a member has without needing confidence scoring.
                if (isDev(viewer) && a.samples !== undefined) {
                    const samples = a.samples || 0;
                    const sampleColor = samples >= 5 ? '#74c69d' : samples >= 1 ? '#e5b567' : '#6b7280';
                    html += `<span style="color:${sampleColor};font-size:9px;">${samples}s</span>`;
                }
                html += `<span style="color:#6b7280;">Lvl ${a.difficulty}</span>`;

                const cprVal = a.positionCpr || a.memberCpr;
                const fitLabel = cprVal >= 80 ? 'Strong Fit' : cprVal >= 60 ? 'Good Fit' : 'Weak Fit';
                const fitColor = cprVal >= 80 ? '#4ade80' : cprVal >= 60 ? '#e5b567' : '#ef4444';
                html += `<span style="color:${fitColor};font-size:9px;font-weight:600;">${fitLabel}</span>`;
                html += `</div>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
        return html;
    }

    function renderMemberProjector(engineData) {
        if (!engineData || !engineData.members || engineData.members.length === 0)
            return '<div style="color:#6b7280;font-size:11px;padding:8px;">No member data available for projection. Members need OC history to generate projections.</div>';
        const { members, benchmarks, progressionTimes } = engineData;

        let html = `<div style="margin:12px 0;border:1px solid #1d4ed8;border-radius:8px;padding:10px;background:#0a1425;">`;
        html += `<div style="font-size:12px;font-weight:700;color:#60a5fa;margin-bottom:8px;">\u{1f52e} Member Projector</div>`;

        // Summary stats
        const ready = members.filter(m => m.projection?.readiness === 'ready').length;
        const developing = members.filter(m => m.projection?.readiness === 'developing').length;
        const building = members.filter(m => m.projection?.readiness === 'building').length;
        const notReady = members.filter(m => m.projection?.readiness === 'not_ready').length;
        const estimated = members.filter(m => m.isEstimated).length;

        html += `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;font-size:10px;color:#9ca3af;">`;
        html += `<span>\u{1f7e2} <b style="color:#4ade80;">${ready}</b> ready</span>`;
        html += `<span>\u{1f7e1} <b style="color:#e5b567;">${developing}</b> developing</span>`;
        html += `<span>\u{1f7e0} <b style="color:#f97316;">${building}</b> building</span>`;
        html += `<span>\u{1f534} <b style="color:#ef4444;">${notReady}</b> not ready</span>`;
        if (estimated > 0) html += `<span>\u{1f535} <b style="color:#60a5fa;">${estimated}</b> estimated (no OC data)</span>`;
        html += `</div>`;

        // Benchmarks bar
        if (benchmarks && Object.keys(benchmarks).length > 0) {
            html += `<div style="margin-bottom:10px;padding:6px 8px;background:#111827;border-radius:4px;">`;
            html += `<div style="font-size:10px;color:#6b7280;margin-bottom:4px;">Faction OC Level Benchmarks (avg CPR)</div>`;
            html += `<div style="display:flex;gap:6px;flex-wrap:wrap;">`;
            for (const lvl of Object.keys(benchmarks).sort((a, b) => Number(a) - Number(b))) {
                const b = benchmarks[lvl];
                html += `<span style="background:#1e293b;padding:2px 6px;border-radius:3px;font-size:10px;color:#d1d5db;">`;
                html += `Lvl ${lvl}: <b style="color:#60a5fa;">${b.avgCpr}%</b>`;
                html += `<span style="color:#4b5563;"> (${b.minCpr}-${b.maxCpr}%)</span>`;
                html += `</span>`;
            }
            html += `</div></div>`;
        }

        // Member cards
        html += `<div style="display:flex;flex-direction:column;gap:4px;">`;
        for (const m of members) {
            const proj = m.projection;
            // Border color by readiness
            let borderColor = '#374151'; // default grey
            if (proj?.readiness === 'ready') borderColor = '#2d6a4f';
            else if (proj?.readiness === 'developing') borderColor = '#92400e';
            else if (proj?.readiness === 'building') borderColor = '#78350f';
            else if (proj?.readiness === 'not_ready') borderColor = '#7f1d1d';

            html += `<div style="padding:6px 8px;background:#111827;border-left:3px solid ${borderColor};border-radius:4px;">`;

            // Header row: name, current level, CPR
            const cprColor = m.currentLevelCpr >= 75 ? '#4ade80' : m.currentLevelCpr >= 60 ? '#e5b567' : '#ef4444';
            html += `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">`;
            html += `<span style="color:#f3f4f6;font-weight:600;font-size:11px;min-width:90px;">${m.name}</span>`;
            html += `<span style="color:#9ca3af;font-size:10px;">Lvl ${m.level}</span>`;
            html += `<span style="color:#6b7280;font-size:10px;">OC Lvl ${m.currentOcLevel}</span>`;
            html += `<span style="color:${cprColor};font-weight:600;font-size:10px;">${m.currentLevelCpr}%</span>`;
            // When the member has already touched a higher level than
            // their stable anchor, surface that context inline so the
            // displayed OC Lvl + CPR isn't confusing on its own.
            // ("OC Lvl 5 / 65% / attempting Lvl 6 at 57%")
            if (m.attemptingAbove && m.attemptedLevel != null && m.attemptedCpr != null) {
                html += `<span style="color:#fb923c;font-size:9px;font-style:italic;">attempting Lvl ${m.attemptedLevel} at ${m.attemptedCpr}%</span>`;
            }
            if (m.isEstimated) html += `<span style="color:#60a5fa;font-size:9px;font-style:italic;">est.</span>`;
            html += `</div>`;

            // Detail row: OC experience + best roles
            html += `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:2px;font-size:9px;color:#6b7280;">`;
            if (m.totalOCs > 0) {
                html += `<span>${m.totalOCs} OCs over ${m.daysSinceFirstOC}d</span>`;
                if (m.daysSinceLastOC > 7) html += `<span style="color:#ef4444;">inactive ${m.daysSinceLastOC}d</span>`;
            } else {
                html += `<span>No OC history</span>`;
            }
            if (m.bestRoles.length > 0) {
                html += `<span>Best: ${m.bestRoles.map(r => `${r.role} (${r.cpr}%)`).join(', ')}</span>`;
            }
            html += `</div>`;

            // Projection row
            if (proj) {
                const readinessColor = proj.readiness === 'ready' ? '#4ade80' : proj.readiness === 'developing' ? '#e5b567' : proj.readiness === 'building' ? '#f97316' : '#ef4444';
                html += `<div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap;">`;
                html += `<span style="color:${readinessColor};font-weight:600;font-size:10px;">${proj.readinessLabel}</span>`;
                html += `<span style="color:#9ca3af;font-size:10px;">for Lvl ${proj.nextLevel}</span>`;
                if (proj.benchmarkCpr !== null) {
                    html += `<span style="color:#6b7280;font-size:9px;">bench: ${proj.benchmarkCpr}%</span>`;
                }
                if (proj.gapToBenchmark !== null && proj.gapToBenchmark > 0) {
                    html += `<span style="color:#ef4444;font-size:9px;">gap: -${proj.gapToBenchmark}%</span>`;
                }
                if (proj.estimatedDays !== null && proj.estimatedDays > 0) {
                    html += `<span style="color:#60a5fa;font-size:9px;">~${proj.estimatedDays}d</span>`;
                }
                if (proj.suggestedRoles.length > 0 && (proj.readiness === 'ready' || proj.readiness === 'developing')) {
                    html += `<span style="color:#4b5563;font-size:9px;">try: ${proj.suggestedRoles.join(', ')}</span>`;
                }
                html += `</div>`;
            }

            html += `</div>`;
        }
        html += `</div></div>`;
        return html;
    }

    function renderMemberReliability(engineData) {
        if (!engineData || !engineData.members || engineData.members.length === 0)
            return '<div style="color:#6b7280;font-size:11px;padding:8px;">No reliability data available. Members need OC history to generate scores.</div>';
        const { members, summary } = engineData;

        let html = `<div style="margin:12px 0;border:1px solid #7c3aed;border-radius:8px;padding:10px;background:#0f0a25;">`;
        html += `<div style="font-size:12px;font-weight:700;color:#a78bfa;margin-bottom:8px;">\u{1f4ca} Member Reliability</div>`;

        // Summary bar
        html += `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;font-size:10px;color:#9ca3af;">`;
        html += `<span>Avg: <b style="color:#f3f4f6;">${summary.avgReliability}</b>/100</span>`;
        html += `<span style="color:#4ade80;">\u{1f7e2} ${summary.tierCounts.Reliable || 0} Reliable</span>`;
        html += `<span style="color:#60a5fa;">\u{1f535} ${summary.tierCounts.Dependable || 0} Dependable</span>`;
        html += `<span style="color:#e5b567;">\u{1f7e1} ${summary.tierCounts.Inconsistent || 0} Inconsistent</span>`;
        html += `<span style="color:#f97316;">\u{1f7e0} ${summary.tierCounts.Unreliable || 0} Unreliable</span>`;
        html += `<span style="color:#ef4444;">\u{1f534} ${summary.tierCounts.Inactive || 0} Inactive</span>`;
        if (summary.tierCounts.New) html += `<span style="color:#a78bfa;">\u{1f7e3} ${summary.tierCounts.New} New</span>`;
        html += `</div>`;

        // Member cards
        html += `<div style="display:flex;flex-direction:column;gap:3px;">`;
        for (const m of members) {
            // Score bar width
            const barWidth = Math.max(2, m.reliabilityScore);

            html += `<div style="padding:5px 8px;background:#111827;border-left:3px solid ${m.tierColor};border-radius:4px;">`;

            // Row 1: Name, score, tier
            html += `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">`;
            html += `<span style="color:#f3f4f6;font-weight:600;font-size:11px;min-width:90px;">${m.name}</span>`;
            html += `<span style="color:${m.tierColor};font-weight:700;font-size:11px;">${m.reliabilityScore}</span>`;
            html += `<div style="flex:1;min-width:40px;max-width:80px;height:4px;background:#1f2937;border-radius:2px;overflow:hidden;">`;
            html += `<div style="width:${barWidth}%;height:100%;background:${m.tierColor};border-radius:2px;"></div></div>`;
            html += `<span style="color:${m.tierColor};font-size:10px;font-weight:600;">${m.tier}</span>`;
            html += `</div>`;

            // Row 2: Stats
            html += `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:2px;font-size:9px;color:#6b7280;">`;
            if (m.successRate !== null) {
                const srColor = m.successRate >= 90 ? '#4ade80' : m.successRate >= 70 ? '#e5b567' : '#ef4444';
                html += `<span>Win: <b style="color:${srColor};">${m.successRate}%</b> (${m.succeeded}/${m.totalOCs})</span>`;
            } else if (m.isNewMember) {
                const dif = m.daysInFaction || 0;
                html += `<span style="color:#a78bfa;">New member${dif > 0 ? ` (${dif}d in faction)` : ''}</span>`;
            } else {
                html += `<span>No OC data</span>`;
            }
            if (m.ocsPerMonth > 0) html += `<span>${m.ocsPerMonth}/mo</span>`;
            if (m.consistency > 0) html += `<span>Consist: ${m.consistency}%</span>`;
            if (m.currentStreak > 0) html += `<span style="color:#4ade80;">\u{1f525} ${m.currentStreak} streak</span>`;
            html += `<span style="color:${m.activityScore >= 60 ? '#4ade80' : m.activityScore >= 30 ? '#e5b567' : '#ef4444'};">${m.activityLabel}</span>`;
            if (m.topRole) html += `<span>${m.topRole.role} (${m.topRole.count}x)</span>`;
            if (m.daysSinceLastOC !== null && m.daysSinceLastOC > 14) html += `<span style="color:#ef4444;">last OC ${m.daysSinceLastOC}d ago</span>`;
            html += `</div>`;

            html += `</div>`;
        }
        html += `</div></div>`;
        return html;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  AUTO-DISPATCHER BANNER — injected into the actual Torn OC page
    //  Finds the Recruiting/Planning/Completed tabs and inserts above them
    // ═══════════════════════════════════════════════════════════════════════
    function findTornOcTabAnchor() {
        // Strategy 1: buttonsContainer inside faction-crimes-root (Recruiting/Planning/Completed tabs)
        const btns = document.querySelector('#faction-crimes-root [class*="buttonsContainer"]');
        if (btns) return { parent: btns.parentElement, ref: btns };
        // Strategy 2: .faction-tabs
        const tabs = document.querySelector('.faction-tabs');
        if (tabs) return { parent: tabs.parentElement, ref: tabs };
        // Strategy 3: faction-crimes root element
        const crimes = document.getElementById('faction-crimes') || document.getElementById('faction-crimes-root');
        if (crimes) return { parent: crimes, ref: crimes.firstChild };
        return null;
    }

    function isOnCrimesTab() {
        const h = window.location.hash || '';
        const u = window.location.href || '';
        return h.includes('tab=crimes') || u.includes('tab=crimes') || !!document.getElementById('faction-crimes-root');
    }

    // Show a persistent dispatcher banner on the Torn page immediately (loading state)
    function injectDispatcherLoading() {
        const key = getApiKey();
        if (!key || key === "YOUR_API_KEY_HERE") return;
        if (!CONFIG.ENGINE_AUTO_DISPATCHER) return;
        if (!isOnCrimesTab()) return; // only show on crimes tab
        if (document.getElementById('oc-dispatcher-torn-banner')) return; // already exists
        const anchor = findTornOcTabAnchor();
        if (!anchor) return;
        const bannerEl = document.createElement('div');
        bannerEl.id = 'oc-dispatcher-torn-banner';
        bannerEl.innerHTML = `<div style="padding:8px 10px;background:#0a1628;border:1px solid #1e3a5f;border-radius:8px;margin:8px 10px;display:flex;align-items:center;gap:8px;">`
            + `<span style="font-size:14px;animation:oc-spin 1.2s linear infinite;">\u{1f504}</span>`
            + `<span style="font-size:11px;color:#9ca3af;">Auto-Dispatcher loading...</span>`
            + `</div>`;
        anchor.parent.insertBefore(bannerEl, anchor.ref || null);
        // Add spin animation if not already present
        if (!document.getElementById('oc-dispatch-spin-style')) {
            const style = document.createElement('style');
            style.id = 'oc-dispatch-spin-style';
            style.textContent = '@keyframes oc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }
    }

    // Helper: inject a simple one-line status into the Torn page dispatcher slot
    function _injectDispatcherStatus(icon, text, color) {
        if (!isOnCrimesTab()) { const old = document.getElementById('oc-dispatcher-torn-banner'); if (old) old.remove(); return; }
        const anchor = findTornOcTabAnchor();
        if (!anchor) return;
        const bannerEl = document.createElement('div');
        bannerEl.id = 'oc-dispatcher-torn-banner';
        bannerEl.innerHTML = `<div style="padding:6px 10px;background:#0a1628;border:1px solid #1e3a5f;border-radius:8px;margin:8px 10px;display:flex;align-items:center;gap:8px;">`
            + `<span style="font-size:13px;">${icon}</span>`
            + `<span style="font-size:11px;color:${color};">${text}</span>`
            + `</div>`;
        anchor.parent.insertBefore(bannerEl, anchor.ref || null);
    }

    // Helper: inject a "Subscribe to unlock" CTA when the server returns 403
    function _injectDispatcherSubscribePrompt(serverMessage) {
        if (!isOnCrimesTab()) { const old = document.getElementById('oc-dispatcher-torn-banner'); if (old) old.remove(); return; }
        const anchor = findTornOcTabAnchor();
        if (!anchor) return;
        const oldBanner = document.getElementById('oc-dispatcher-torn-banner');
        if (oldBanner) oldBanner.remove();
        const detail = (serverMessage && typeof serverMessage === 'string')
            ? serverMessage
            : 'Send 2 Xanax for a 7-day trial or 20 Xanax for 30 days to RussianRob.';
        const bannerEl = document.createElement('div');
        bannerEl.id = 'oc-dispatcher-torn-banner';
        bannerEl.innerHTML = `<div style="padding:10px 12px;background:linear-gradient(135deg,#1a0f2e,#0a1628);border:1px solid #7c3aed;border-radius:8px;margin:8px 10px;display:flex;align-items:center;gap:10px;">`
            + `<span style="font-size:18px;">\u{1f512}</span>`
            + `<div style="flex:1;min-width:0;">`
            + `<div style="font-size:12px;font-weight:600;color:#c4b5fd;">Subscribe to unlock Auto-Dispatcher</div>`
            + `<div style="font-size:10px;color:#9ca3af;margin-top:2px;">${detail.replace(/</g,'&lt;')}</div>`
            + `</div>`
            + `<a href="https://www.torn.com/messages.php#/p=compose&XID=2556388" target="_blank" rel="noopener" style="font-size:11px;font-weight:600;padding:6px 10px;background:#7c3aed;color:#fff;border-radius:6px;text-decoration:none;white-space:nowrap;">Message RussianRob</a>`
            + `</div>`;
        anchor.parent.insertBefore(bannerEl, anchor.ref || null);
    }

    function renderDispatcherBanner(dispatcherData) {
        _lastDispatcherData = dispatcherData; // cache for tab re-injection
        // Remove old banner if it exists
        const oldBanner = document.getElementById('oc-dispatcher-torn-banner');
        if (oldBanner) oldBanner.remove();
        // Only render on crimes tab
        if (!isOnCrimesTab()) return;

        // Also update the in-panel fallback
        const panelBanner = document.getElementById('oc-dispatcher-banner');

        if (!dispatcherData || !dispatcherData.recommendation) {
            if (panelBanner) panelBanner.style.display = 'none';
            if (dispatcherData && dispatcherData.inOC) {
                // Player is in an OC -- show a brief status
                _injectDispatcherStatus('\u2705', 'You\'re assigned to an OC', '#4ade80');
                return;
            }
            if (dispatcherData && dispatcherData.reason) {
                // Has a reason but no recommendation
                _injectDispatcherStatus('\u{1f4e1}', dispatcherData.reason, '#9ca3af');
                return;
            }
            // No data at all (API error etc) -- show waiting state
            _injectDispatcherStatus('\u{1f4e1}', 'Dispatcher active -- waiting for OC data', '#6b7280');
            return;
        }

        const rec = dispatcherData.recommendation;
        const fb = dispatcherData.fallbacks || [];
        const bd = rec.breakdown || {};

        // CPR source badge
        const cprBadge = rec.cprSource === 'position' ? '\u{1f3af}' : rec.cprSource === 'level' ? '\u{1f4ca}' : '\u{1f4d0}';
        const cprLabel = rec.cprSource === 'position' ? 'position CPR' : rec.cprSource === 'level' ? 'level CPR' : 'est. CPR';

        // Urgency styling
        let urgencyColor = '#374151';
        let urgencyBorder = '#1e3a5f';
        let urgencyBg = '#0a1628';
        if (rec.isLastSlot) { urgencyColor = '#f59e0b'; urgencyBorder = '#92400e'; urgencyBg = '#1a150a'; }
        else if (rec.hoursToExpiry && rec.hoursToExpiry > 0 && rec.hoursToExpiry < 8) { urgencyColor = '#ef4444'; urgencyBorder = '#7f1d1d'; urgencyBg = '#1a0a0a'; }
        else if (rec.emptySlots <= 2) { urgencyColor = '#60a5fa'; urgencyBorder = '#1e3a5f'; urgencyBg = '#0a1628'; }

        let html = `<div style="padding:8px 10px;background:${urgencyBg};border:1px solid ${urgencyBorder};border-radius:8px;margin:8px 10px;cursor:pointer;transition:opacity 0.15s;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'" data-crime-id="${rec.crimeId}">`;

        // Main recommendation row
        html += `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">`;
        html += `<span style="font-size:16px;">\u{1f680}</span>`;
        html += `<span style="font-size:12px;font-weight:700;color:#f3f4f6;">Join <span style="color:#60a5fa;">'${rec.crimeName}'</span></span>`;
        html += `<span style="font-size:11px;color:#9ca3af;">\u2014</span>`;
        html += `<span style="font-size:11px;font-weight:600;color:${urgencyColor};">${rec.positionBase} slot</span>`;
        html += `</div>`;

        // Stats row
        html += `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;font-size:10px;color:#9ca3af;">`;
        const cprColor = rec.cpr >= 80 ? '#4ade80' : rec.cpr >= 60 ? '#e5b567' : '#ef4444';
        html += `<span>${cprBadge} <b style="color:${cprColor};">${rec.cpr}%</b> ${cprLabel}</span>`;
        if (rec.roleWeight > 0) html += `<span>\u2696\uFE0F ${rec.roleWeight}% weight</span>`;
        html += `<span>\u{1f4e6} ${rec.filledPct}% filled (${rec.totalSlots - rec.emptySlots}/${rec.totalSlots})</span>`;
        if (rec.isLastSlot) html += `<span style="color:#f59e0b;font-weight:700;">\u26A1 LAST SLOT</span>`;
        if (rec.hoursToExpiry !== null && rec.hoursToExpiry > 0) {
            const expColor = rec.hoursToExpiry < 8 ? '#ef4444' : rec.hoursToExpiry < 24 ? '#e5b567' : '#6b7280';
            html += `<span style="color:${expColor};">\u23F1 ${rec.hoursToExpiry}h left</span>`;
        }
        if (rec.readyAtHours && rec.readyAtHours > 0) {
            const rh = rec.readyAtHours;
            const execStr = rh >= 24 ? `${Math.floor(rh / 24)}d ${Math.round(rh % 24)}h` : `${rh}h`;
            html += `<span>\u{1f552} ~${execStr}</span>`;
        }
        html += `</div>`;

        // Fallbacks
        if (fb.length > 0) {
            html += `<details style="margin-top:4px;">`;
            html += `<summary style="font-size:10px;color:#4b5563;cursor:pointer;">\u{1f504} ${fb.length} more option${fb.length > 1 ? 's' : ''}</summary>`;
            html += `<div style="display:flex;flex-direction:column;gap:3px;margin-top:4px;">`;
            for (const f of fb) {
                const fCprColor = f.cpr >= 80 ? '#4ade80' : f.cpr >= 60 ? '#e5b567' : '#ef4444';
                html += `<div style="padding:4px 8px;background:#111827;border-radius:4px;border-left:2px solid #374151;display:flex;align-items:center;gap:8px;flex-wrap:wrap;cursor:pointer;" data-fallback-crime-id="${f.crimeId}" onmouseover="this.style.background='#1f2937'" onmouseout="this.style.background='#111827'">`;
                html += `<span style="font-size:10px;font-weight:600;color:#d1d5db;">${f.crimeName}</span>`;
                html += `<span style="font-size:10px;color:#9ca3af;">${f.positionBase}</span>`;
                html += `<span style="font-size:10px;color:${fCprColor};">${f.cpr}%</span>`;
                if (f.roleWeight > 0) html += `<span style="font-size:9px;color:#6b7280;">${f.roleWeight}%w</span>`;
                html += `<span style="font-size:9px;color:#6b7280;">${f.filledPct}% full</span>`;
                if (f.isLastSlot) html += `<span style="font-size:9px;color:#f59e0b;font-weight:700;">LAST</span>`;
                if (f.readyAtHours && f.readyAtHours > 0) {
                    const fRh = f.readyAtHours;
                    const fExec = fRh >= 24 ? `${Math.floor(fRh / 24)}d ${Math.round(fRh % 24)}h` : `${fRh}h`;
                    html += `<span style="font-size:9px;color:#6b7280;">\u{1f552} ~${fExec}</span>`;
                }
                html += `<span style="font-size:9px;color:#60a5fa;cursor:pointer;text-decoration:underline;margin-left:auto;" data-fallback-crime-id="${f.crimeId}">Join \u2192</span>`;
                html += `</div>`;
            }
            html += `</div></details>`;
        }

        html += `</div>`;

        // Inject into the Torn page itself
        const anchor = findTornOcTabAnchor();
        if (anchor) {
            const bannerEl = document.createElement('div');
            bannerEl.id = 'oc-dispatcher-torn-banner';
            bannerEl.innerHTML = html;
            bannerEl.addEventListener('click', (e) => {
                if (e.target.closest('details summary')) return; // don't scroll when toggling details
                // Check if a fallback item was clicked
                const fallbackEl = e.target.closest('[data-fallback-crime-id]');
                const targetCrimeId = fallbackEl ? fallbackEl.dataset.fallbackCrimeId : rec.crimeId;
                // Navigate to the crime's hash URL -- Torn's React router handles
                // expanding the card and scrolling to it automatically
                if (targetCrimeId) {
                    window.location.hash = `/tab=crimes&crimeId=${targetCrimeId}`;
                }
            });
            anchor.parent.insertBefore(bannerEl, anchor.ref || null);
        } else {
            // Fallback: inject into the panel banner div
            if (panelBanner) {
                panelBanner.style.display = '';
                panelBanner.innerHTML = html;
            }
        }
    }

    function renderScopeStrip(scopeProjection) {
        if (!scopeProjection) {
            return `<div class="oc-scope-strip" style="color:#6b7280;font-size:10px;">
                Scope not configured — set it in ⚙ Settings to enable budget planning
            </div>`;
        }
        const { current, regen, expectedGain, projected } = scopeProjection;
        const barClass = projected < 10 ? 'warn' : 'ok';
        let ageLabel = '';
        if (CONFIG._scopeUpdatedAt) {
            const s = Math.max(0, Math.floor((Date.now() - CONFIG._scopeUpdatedAt) / 1000));
            const m = Math.floor(s / 60), h = Math.floor(m / 60);
            const age = h > 0 ? `${h}h${(m % 60).toString().padStart(2,'0')}m`
                       : m > 0 ? `${m}m`
                       : `${s}s`;
            // Red if over 5min old, yellow over 1min, green fresh.
            const col = s > 300 ? '#ef4444' : s > 60 ? '#fbbf24' : '#2d6a4f';
            ageLabel = ` <span style="font-size:9px;color:${col};">${age}</span>`;
        }
        const autoTag = CONFIG._scopeAutoDetected
            ? `<span style="font-size:9px;color:#2d6a4f;margin-left:4px;">● live${ageLabel}</span>`
            : `<span style="font-size:9px;color:#374151;margin-left:4px;">manual</span>`;
        return `<div class="oc-scope-strip">
            <div style="white-space:nowrap;color:#9ca3af;font-size:10px;">Scope${autoTag}</div>
            <div style="font-weight:600;color:#f3f4f6;white-space:nowrap;">${current}</div>
            <div class="oc-scope-bar-wrap"><div class="oc-scope-bar ${barClass}" style="width:${Math.round(current/SCOPE_MAX*100)}%"></div></div>
            <div style="color:#6b7280;font-size:10px;white-space:nowrap;">→ <span class="oc-proj-click"><b style="color:#74c69d">${projected}</b> projected</span>
                <span style="color:#374151">(+${regen} daily, +${expectedGain} from crimes)</span>
            </div>
        </div>`;
    }

    function renderRecommendations(recs, scopeProjection) {
        // v3.2.24: show ALL levels 1–10 instead of hiding empty rows.
        // The old filter dropped levels with no members + no OCs +
        // no action — confusing on faction-war prep when an adjacent
        // scope-range level (e.g. Lvl 8 alongside an active Lvl 7)
        // silently vanished. Empty rows still render with "None
        // needed" so the user can see the level exists and is idle.
        const visible = recs.slice();
        if (!visible.length) return '<p class="oc-tag-none">No eligible members found for any level.</p>';

        const rows = visible.map(r => {
            let actionHtml;
            if (r.action === 'spawn') {
                actionHtml = `<span class="oc-tag-spawn">Spawn ${r.numOcsToSpawn} OC${r.numOcsToSpawn > 1 ? 's' : ''} <span style="font-size:9px;opacity:.8">(${r.deficit} slot${r.deficit > 1 ? 's' : ''} needed)</span></span>`;
            } else if (r.action === 'spawn_partial') {
                actionHtml = `<span class="oc-tag-spawn-partial">Spawn ${r.numOcsToSpawn} OC${r.numOcsToSpawn > 1 ? 's' : ''} <span style="font-size:9px;opacity:.8">(${r.deficit} slot${r.deficit > 1 ? 's' : ''} needed)</span></span>`;
            } else if (r.action === 'deferred') {
                actionHtml = `<span class="oc-tag-deferred">Deferred — no scope</span>`;
            } else if (r.action === 'ok') {
                actionHtml = `<span class="oc-tag-ok">✓ Covered</span>`;
            } else if (r.action === 'waiting') {
                actionHtml = `<span class="oc-tag-deferred">${r.deficit} waiting</span>`;
            } else {
                actionHtml = `<span class="oc-tag-surplus">None needed</span>`;
            }
            const soonBadge = r.soonMembers > 0 ? ` <span class="oc-badge oc-badge-soon">+${r.soonMembers}</span>` : '';
            const costBadge = scopeProjection ? `<span class="oc-range-chip">R${r.scopeRange} · ${r.scopeCost}sp</span>` : '';
            return `<tr class="oc-row-${r.action.replace('_','-')}">
                <td><b>Lvl ${r.level}</b>${costBadge}</td>
                <td>${r.freeMembers}${soonBadge}</td>
                <td>${r.openSlots} / ${r.totalSlots} <span style="color:#374151">(${r.recruitingOCs})</span></td>
                <td>${actionHtml}</td>
            </tr>`;
        }).join('');

        return `<table class="oc-table">
            <thead><tr><th>Level</th><th>Free + Soon</th><th>Slots</th><th>Action</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
    }

    const HIGH_WEIGHT_THRESHOLD = CONFIG.HIGH_WEIGHT_THRESHOLD;  // configurable via settings
    const HIGH_WEIGHT_MIN_CPR    = CONFIG.HIGH_WEIGHT_MIN_CPR;   // configurable via settings

    function _wKey(str) { return (str || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

    // Add "#1", "#2" to duplicate positions within a crime (matching Torn UI labels)
    function labelSlotPositions(slots) {
        const total = {};
        for (const s of slots) { const p = s.position || ''; total[p] = (total[p] || 0) + 1; }
        const counts = {};
        return slots.map(s => {
            const p = s.position || '';
            if (total[p] > 1) {
                counts[p] = (counts[p] || 0) + 1;
                return { ...s, label: `${p} #${counts[p]}` };
            }
            return { ...s, label: p };
        });
    }
    function getSlotWeight(weights, ocName, roleName) {
        if (!weights) return null;
        const oc   = weights[_wKey(ocName)] || {};
        const role = oc[_wKey(roleName)];
        return typeof role === 'number' ? role : null;
    }

    // Look up byPosition CPR by role NAME (not position_id which is a generic slot number)
    function lookupPosCPR(byPos, crimeName, roleName) {
        if (!roleName) return null;
        const exactKey = `${crimeName}::${roleName}`;
        if (byPos[exactKey]) return byPos[exactKey];
        // Fallback: same role name from any other crime type
        const roleKey = roleName.toLowerCase();
        for (const [k, v] of Object.entries(byPos)) {
            const parts = k.split('::');
            if (parts.length === 2 && parts[1].toLowerCase() === roleKey) return v;
        }
        return null;
    }

    function buildMemberRec(m, availableCrimes, weights) {
        if (m.inOC) {
            const readyLabel = (m.ocReadyAt && m.ocReadyAt > now()) ? fmtTs(m.ocReadyAt) : 'active (paused)';
            return { type: 'inoc', text: `In OC — free ${readyLabel}` };
        }
        const byPos    = m.byPosition || {};
        const memberCPR = m.cpr ?? 0;
        // Try exact level first, then search downward if none available
        let openOCs = [];
        let matchedLevel = m.joinable;
        for (let lvl = m.joinable; lvl >= 1; lvl--) {
            openOCs = normArr(availableCrimes).filter(c =>
                c.status === 'Recruiting' &&
                (c.difficulty || 0) === lvl &&
                (c.slots || []).some(s => !s.user_id && !s.user?.id)
            );
            if (openOCs.length) { matchedLevel = lvl; break; }
        }
        // Sort: most filled first, then expiry, then difficulty
        openOCs.sort((a, b) => {
            const aSlots = a.slots || [], bSlots = b.slots || [];
            const aFilled = aSlots.filter(s => (s.user_id ?? s.user?.id) != null).length;
            const bFilled = bSlots.filter(s => (s.user_id ?? s.user?.id) != null).length;
            if (aFilled !== bFilled) return bFilled - aFilled; // most filled first
            const aExp = a.expired_at || Infinity;
            const bExp = b.expired_at || Infinity;
            if (aExp !== bExp) return aExp - bExp; // soonest expiry first
            return (b.difficulty || 0) - (a.difficulty || 0);
        });
        if (!openOCs.length) return { type: 'none', text: `No OCs open (Lvl 1-${m.joinable})` };

        let bestCrime = null, bestPos = null, bestPosCPR = -1;

        for (const c of openOCs) {
            const labeled = labelSlotPositions(c.slots || []);
            for (const slot of labeled.filter(s => !s.user_id && !s.user?.id)) {
                if (memberCPR < CONFIG.MINCPR) continue; // CPR too low for this slot

                const pd  = lookupPosCPR(byPos, c.name, slot.position);
                const posCPR = pd?.cpr || 0;
                // Prefer: highest role CPR (OCs already sorted by fill count)
                if (!bestCrime || posCPR > bestPosCPR) {
                    bestPosCPR = posCPR; bestPos = slot.label;
                    bestCrime = c;
                }
            }
            // Once we find a match in the most-filled OC, stop
            if (bestCrime) break;
        }

        // Fallback: if no qualifying slot (CPR too low), show best available anyway with a warning
        if (!bestCrime) {
            const c = openOCs[0];
            const labeled = labelSlotPositions(c.slots || []);
            const openSlot = labeled.find(s => !s.user_id && !s.user?.id);
            const pd  = lookupPosCPR(byPos, c.name, openSlot?.position);
            return { type: 'rec', crime: c.name, position: openSlot?.label || openSlot?.position || null,
                cpr: pd?.cpr || null, level: matchedLevel, count: openOCs.length, lowCpr: true };
        }

        return { type: 'rec', crime: bestCrime.name, position: bestPos,
            cpr: bestPosCPR > 0 ? bestPosCPR : null, level: matchedLevel, count: openOCs.length };
    }

    function renderEligibleMembers(eligible, availableCrimes, weights) {
        cprBreakdownMap = {};
        recMap = {};
        // Sort by joinable level desc, then name
        const sorted = [...eligible].sort((a, b) => (b.joinable - a.joinable) || a.name.localeCompare(b.name));
        const rows = sorted.map(m => {
            const readyLabel = (m.ocReadyAt && m.ocReadyAt > now())
                ? `free ${fmtTs(m.ocReadyAt)}` : 'active (paused)';
            const sb = m.inOC
                ? `<span class="oc-badge oc-badge-in">In OC → ${readyLabel}</span>`
                : `<span class="oc-badge oc-badge-free">Free</span>`;
            let cc = 'oc-cpr-low';
            if (m.cpr !== null && m.cpr >= 80)                cc = 'oc-cpr-high';
            else if (m.cpr !== null && m.cpr >= CONFIG.MINCPR) cc = 'oc-cpr-mid';
            let cs;
            if (m.cpr !== null && !m.cprEstimated) {
                cprBreakdownMap[m.id] = { name: m.name, cpr: m.cpr, entries: m.cprEntries, byCheckpoint: m.byCheckpoint };
                cs = `<span class="oc-cpr-click ${cc}" data-uid="${m.id}">${m.cpr}%</span>`;
            } else if (m.cprEstimated) {
                cs = `<span class="oc-cpr-est" title="Estimated from level — no faction crime history yet">~${m.cpr}%</span>`;
            } else { cs = '<span class="oc-cpr-low">—</span>'; }
            // Build rec for this member
            const rec = buildMemberRec(m, availableCrimes, weights);
            recMap[m.id] = rec;
            const recBtn = rec.type === 'rec'
                ? `<span class="oc-rec-btn" data-uid="${m.id}">→ ${rec.crime.length > 14 ? rec.crime.slice(0,13) + '…' : rec.crime}</span>`
                : `<span class="oc-rec-btn" data-uid="${m.id}" style="background:rgba(55,65,81,.2);color:#6b7280;border-color:rgba(55,65,81,.3);">${rec.type === 'inoc' ? 'In OC' : 'None open'}</span>`;

            return `<tr>
                <td><span class="oc-member-name">${m.name}</span> <span class="oc-member-id">[${m.id}]</span></td>
                <td>${sb}</td><td>${cs}</td>
                <td style="color:#6b7280">${m.highestLevel > 0 ? m.highestLevel : '—'}</td>
                <td>${recBtn}</td>
            </tr>`;
        }).join('');
        return `<table class="oc-table">
            <thead><tr><th>Member</th><th>Status</th><th>CPR</th><th>Highest</th><th>Join</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
    }

    function renderViewerCard(viewer, eligible, skipped, availableCrimes, weights, engines) {
        // Always show card if we have at least a name
        if (!viewer || (!viewer.playerId && !viewer.playerName)) return '';
        const vid   = viewer.playerId ? String(viewer.playerId) : null;
        const vname = viewer.playerName || '';

        // Find viewer — ID match (string or number) with name fallback
        const idMatch   = m => vid && (String(m.id) === vid || Number(m.id) === Number(vid));
        const nameMatch = m => vname && m.name === vname;
        const me = eligible.find(m => idMatch(m) || nameMatch(m))
                || skipped.find(m => idMatch(m) || nameMatch(m));

        const cprText  = me?.cpr != null
            ? (me.cprEstimated ? `~${me.cpr}% est.` : `${me.cpr}% CPR`)
            : 'No CPR data';
        const cprColor = me?.cprEstimated ? '#6b7280'
            : me?.cpr >= 80 ? '#74c69d' : me?.cpr >= 60 ? '#f4a261' : '#9ca3af';
        const joinable = me?.joinable || 1;

        let statusHtml;
        if (!me) {
            statusHtml = `<span style="color:#6b7280">Not found in eligible members</span>`;
        } else if (me.inOC) {
            const readyLabel = (me.ocReadyAt && me.ocReadyAt > now())
                ? `free ${fmtTs(me.ocReadyAt)}`
                : 'active (timer paused)';
            statusHtml = `<span class="oc-badge oc-badge-in">In OC → ${readyLabel}</span>`;
        } else {
            statusHtml = `<span class="oc-badge oc-badge-free">Free now</span>`;
        }

        // Find recruiting OCs with best-fit position recommendation
        const byPos = me?.byPosition || {};
        const myOcs = normArr(availableCrimes).filter(c => {
            if (c.status !== 'Recruiting') return false;
            if (c.difficulty !== joinable) return false;
            return (c.slots || []).some(s => !s.user_id && !s.user?.id);
        });

        // Check Slot Optimizer assignment for this member
        const optAssignment = engines?.slotOptimizer?.assignments?.find(a => String(a.memberId) === vid);

        let recsHtml;
        if (me?.inOC) {
            recsHtml = `<div class="oc-viewer-none">You\'re already in an OC.</div>`;
        } else if (optAssignment) {
            const cprVal = optAssignment.positionCpr || optAssignment.memberCpr;
            const fitLabel = cprVal >= 80 ? 'Strong Fit' : cprVal >= 60 ? 'Good Fit' : 'Weak Fit';
            const fitColor = cprVal >= 80 ? '#4ade80' : cprVal >= 60 ? '#e5b567' : '#ef4444';
            recsHtml = `<div style="background:#0a1f14;border:1px solid #2d6a4f;border-radius:6px;padding:8px;margin-top:4px;">`
                + `<div style="font-size:10px;color:#4ade80;font-weight:600;margin-bottom:4px;">\u2699\ufe0f Slot Optimizer Recommendation</div>`
                + `<div style="font-size:12px;color:#f3f4f6;font-weight:700;">${optAssignment.crimeName}</div>`
                + `<div style="font-size:11px;color:#9ca3af;margin-top:2px;">Join as <b style="color:#74c69d;">${optAssignment.position}</b> (Lvl ${optAssignment.difficulty})</div>`
                + `<div style="font-size:10px;margin-top:3px;"><span style="color:${fitColor};font-weight:600;">${cprVal.toFixed(0)}% CPR — ${fitLabel}</span></div>`
                + `</div>`;
        } else if (myOcs.length === 0) {
            recsHtml = `<div class="oc-viewer-none">No open Lvl ${joinable} OCs recruiting right now.</div>`;
        } else {
            const chips = myOcs.map(c => {
                const labeled = labelSlotPositions(c.slots || []);
                const openSlots = labeled.filter(s => !s.user_id && !s.user?.id);
                let bestPos = null, bestCPR = -1, bestW = -1;
                for (const slot of openSlots) {
                    const w  = getSlotWeight(weights, c.name, slot.label) ?? 0;
                    const pd = lookupPosCPR(byPos, c.name, slot.position);
                    const cpr = pd?.cpr || 0;
                    if (w > bestW || (w === bestW && cpr > bestCPR)) { bestCPR = cpr; bestPos = slot.label; bestW = w; }
                }
                const posTag = bestPos
                    ? ` <span style="color:#9ca3af;font-size:9px;">as ${bestPos}${bestCPR > 0 ? ' ' + bestCPR + '%' : ''}</span>`
                    : ` <span style="color:#6b7280;font-size:9px;">${openSlots.length} slot${openSlots.length > 1 ? 's' : ''}</span>`;
                return `<span class="oc-viewer-crime">${c.name}${posTag}</span>`;
            }).join('');
            recsHtml = `<div class="oc-viewer-crimes">${chips}</div>`;
        }

        // Faction role (Leader / Co-Leader / Banker / etc.) — small chip
        // under the name so admins know who's logged in at a glance.
        const posText = viewer.position ? met_escapeHtml(viewer.position) : '';
        const posHtml = posText
            ? `<div style="font-size:10px;color:#9ca3af;margin-bottom:4px;">🏛 ${posText}</div>`
            : '';

        return `<div class="oc-viewer-card">
            <div class="oc-viewer-name">${met_escapeHtml(viewer.playerName)} • Lvl ${joinable} • <span style="color:${cprColor}">${cprText}</span></div>
            ${posHtml}
            <div class="oc-viewer-meta">${statusHtml}</div>
            ${recsHtml}
            ${renderVaultRequestSection(viewer)}
        </div>`;
    }

    // ── Vault request board ─────────────────────────────────────────────────
    // Lets any faction member ask for $X from the vault. Everyone in the
    // faction sees the pending list (polled every 30s alongside the main
    // refresh cycle). Auto-removes when Torn's currencynews shows the
    // request was fulfilled. Push notifications to online / online+offline
    // members per the requester's choice.
    function renderVaultRequestSection(viewer) {
        const requests = S.vaultRequests || [];
        const myId = String(viewer.playerId);
        const balance = S.vaultBalance;
        const balanceLabel = (balance != null && balance > 0)
            ? `$${Number(balance).toLocaleString('en-US')}`
            : null;

        // Gate the request LIST to admin-role viewers only. Regular members
        // (incl. the requester themselves) submit requests but don't see
        // the pending list — only the admins responsible for fulfilling
        // them get to see the queue.
        const isAdmin = viewer.hasFactionAccess === true || myId === '137558';

        const rowsHtml = !isAdmin ? '' : requests.map(r => {
            const amt = Number(r.amount || 0).toLocaleString('en-US');
            const ts = Math.round((Date.now() - (r.createdAt || Date.now())) / 60000);
            const isMine = String(r.requesterId) === myId;
            const canDelete = isMine || viewer.hasFactionAccess === true || myId === '137558';
            const delBtn = canDelete
                ? `<button class="oc-vault-del" data-req-id="${met_escapeHtml(r.id)}" style="background:none;border:0;color:#ef4444;cursor:pointer;font-size:11px;margin-left:6px;">✕</button>`
                : '';
            // Show the requester's delivery preference — whether it's OK to
            // send money while they're offline. Fulfillers see this so they
            // know not to bother sending right now if the flag is "only when online".
            const prefLabel = r.target === 'online'
                ? '<span style="color:#9ca3af;" title="Only send while requester is online">⏱ online only</span>'
                : '<span style="color:#4ade80;" title="OK to send even while requester is offline">✓ anytime</span>';
            // Send link: opens Torn's faction Controls "Give to user" tab
            // PREFILLED with the requester + amount via the giveMoneyTo/money
            // URL params, so the admin just confirms. Our fundsnews poll
            // auto-removes this request once the money lands.
            const _amtNum = Math.round(Number(r.amount) || 0);
            const payUrl = `https://www.torn.com/factions.php?step=your#/tab=controls&giveMoneyTo=${encodeURIComponent(r.requesterId)}&money=${_amtNum}`;
            const sendBtn = `<a href="${payUrl}" target="_blank" rel="noopener"
                class="oc-vault-send"
                data-req-id="${met_escapeHtml(r.id)}"
                data-amount="${met_escapeHtml(r.amount)}"
                data-recipient="${met_escapeHtml(r.requesterName)}"
                data-recipient-id="${met_escapeHtml(r.requesterId)}"
                title="Opens Give-to-user prefilled — give $${amt} to ${met_escapeHtml(r.requesterName)} [${met_escapeHtml(r.requesterId)}], you confirm"
                style="display:inline-block;background:#166534;color:#f3f4f6;text-decoration:none;font-weight:600;font-size:10px;padding:2px 8px;border-radius:3px;margin-left:auto;">Send</a>`;
            return `<div style="display:flex;align-items:center;gap:6px;padding:3px 6px;font-size:11px;background:#111b14;border-radius:3px;margin-bottom:3px;">
                <span style="color:#f3f4f6;font-weight:600;">${met_escapeHtml(r.requesterName)}</span>
                <span style="color:#facc15;">$${amt}</span>
                <span style="color:#6b7280;font-size:9px;">${ts}m</span>
                <span style="font-size:9px;">${prefLabel}</span>
                ${sendBtn}
                ${delBtn}
            </div>`;
        }).join('');

        // $ button inside the amount input fills with the requester's max
        // balance. Sits absolutely positioned on the input's left edge.
        const amountBoxHtml = `
            <div style="flex:1;min-width:140px;position:relative;">
                <button type="button" id="oc-vault-max" title="${balanceLabel ? 'Fill with your max vault balance: ' + balanceLabel : 'Vault balance unknown'}"
                    style="position:absolute;left:2px;top:1px;bottom:1px;width:26px;background:#1e3a5f;border:0;color:#facc15;font-weight:700;border-radius:3px;cursor:${balance ? 'pointer' : 'default'};font-size:12px;">$</button>
                <input type="text" autocomplete="off" placeholder="${balanceLabel ? 'Max ' + balanceLabel + ' — e.g. 500k, 2.5m' : 'Amount — e.g. 500k, 2.5m'}" id="oc-vault-amount"
                    style="width:100%;box-sizing:border-box;background:#0f1a2e;border:1px solid #1e3a5f;color:#dde;border-radius:4px;padding:4px 6px 4px 32px;font-size:11px;">
            </div>`;

        const headerLabel = isAdmin ? '💰 Vault requests' : '💰 Request from vault';
        const listHtml = isAdmin
            ? `<div id="oc-vault-list">${rowsHtml || '<div style="color:#6b7280;font-size:10px;font-style:italic;">No pending requests.</div>'}</div>`
            : '';   // non-admins don't see the queue at all

        return `<div class="oc-vault" style="margin-top:10px;border-top:1px solid #2d4a3e;padding-top:8px;">
            <div style="font-size:11px;color:#9ca3af;font-weight:600;margin-bottom:4px;">${headerLabel}${balanceLabel ? ` <span style="color:#6b7280;font-weight:400;font-size:10px;">(your balance: ${balanceLabel})</span>` : ''}</div>
            ${listHtml}
            <form id="oc-vault-form" style="display:flex;gap:4px;align-items:center;margin-top:6px;flex-wrap:wrap;">
                ${amountBoxHtml}
                <select id="oc-vault-target" title="Can the money be sent while you're offline?" style="background:#0f1a2e;border:1px solid #1e3a5f;color:#dde;border-radius:4px;padding:4px;font-size:10px;">
                    <option value="both">Send anytime</option>
                    <option value="online">Only when I'm online</option>
                </select>
                <button type="submit" style="background:#2d6a4f;color:#fff;border:1px solid #3d8a6f;border-radius:4px;padding:5px 14px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;">Request</button>
            </form>
            <div id="oc-vault-msg" style="font-size:10px;color:#6b7280;margin-top:4px;min-height:12px;"></div>
        </div>`;
    }

    function buildTravelingAlert(availableCrimes, members, pendingDelays = {}) {
        const memberArr = Array.isArray(members) ? members : Object.values(members || {});
        const statusMap = {}; // uid -> { name, state }
        for (const m of memberArr) {
            const uid = String(m.id || m.playerId || m.uid);
            const state = (m.status?.state || 'Okay').toLowerCase();
            statusMap[uid] = { name: m.name || m.playerName || uid, state, desc: String(m.status?.description || '').toLowerCase() };
        }

        const FLYER_MESSAGE = "You're holding off on the OC initiation. You still have an outstanding fee that needs paying before we can crack on. Drop me a message as soon as it's done.";
        const now = Math.floor(Date.now() / 1000);

        const alerts = []; // { memberName, crimeName, position, difficulty, urgency }
        for (const crime of (availableCrimes || [])) {
            if (crime.status !== 'Recruiting' && crime.status !== 'Planning') continue;
            const readyAt = crime.ready_at || 0;

            const slots = crime.slots || [];
            const filledSlots = slots.filter(s => (s.user_id ?? s.user?.id) != null).length;
            const totalSlots = slots.length;
            const fullyStaffed = totalSlots > 0 && filledSlots >= totalSlots;

            // Only alert when the OC is ready to execute right now — a
            // traveling member only matters at the moment we'd otherwise
            // click Initiate. Treat a Planning crime with a null/0 ready_at
            // as "ready now" since Torn V2 sometimes omits the field once
            // the OC is fully assembled.
            const isReadyNow = (readyAt > 0 && readyAt <= now)
                || (crime.status === 'Planning' && (!readyAt || readyAt <= now));
            if (!isReadyNow) continue;
            if (!fullyStaffed && crime.status !== 'Planning') continue;
            // How long has this OC been sitting ready? When a flyer is in
            // the crew, this doubles as the delay they're holding up.
            // For Planning crimes with null ready_at we can't measure (just
            // say "ready now" with no age).
            const readyForSec = readyAt > 0 ? Math.max(0, now - readyAt) : 0;
            const fmtReadyAge = (s) => {
                const m = Math.floor(s / 60), h = Math.floor(m / 60);
                if (h > 0) return `${h}h${(m % 60).toString().padStart(2,'0')}m`;
                if (m > 0) return `${m}m`;
                return `${s}s`;
            };
            const urgency = readyForSec > 0
                ? `delayed ${fmtReadyAge(readyForSec)}`
                : 'ready now';

            for (const slot of (crime.slots || [])) {
                const uid = String(slot.user_id ?? slot.user?.id ?? '');
                if (!uid) continue;
                const info = statusMap[uid];
                if (!info) continue;
                // "Flying" in Torn covers both in-transit ("Traveling") and
                // landed-in-a-foreign-country ("Abroad"). Both block OC
                // initiation, so flag either.
                if (info.state === 'traveling' || info.state === 'abroad') {
                    // Outbound = flying AWAY from Torn ("Traveling to X"). Only
                    // then did a home-at-ready member just leave, so the server
                    // may use their takeoff. Abroad or return-leg ("... to
                    // Torn") = away continuously → server anchors to OC-ready
                    // (so the flight home doesn't reset a multi-hour block).
                    const outbound = info.state === 'traveling' && !/\bto torn\b|returning/.test(info.desc || '');
                    // v3.1.49: prefer server-supplied per-member delay
                    // (backdated to real takeoff via FFScouter). Falls
                    // back to OC-ready-age when no server data yet.
                    const pdKey = `${crime.id}::${uid}`;
                    const memberSec = Number(pendingDelays[pdKey]);
                    const effSec = Number.isFinite(memberSec) && memberSec >= 0 ? memberSec : readyForSec;
                    const memberUrgency = effSec > 0
                        ? `delayed ${fmtReadyAge(effSec)}`
                        : 'ready now';
                    alerts.push({
                        memberId: uid,
                        memberName: info.name,
                        crimeId: String(crime.id || ''),
                        crimeName: crime.name || 'Unknown',
                        position: slot.position || 'Unknown',
                        difficulty: crime.difficulty || 0,
                        urgency: memberUrgency,
                        state: info.state,
                        outbound: outbound,
                        readyAt: readyAt || 0,
                        delayedSec: effSec,
                    });
                }
            }
        }
        if (alerts.length === 0) return '';

        // Report each observation to the server (throttled per pair so we
        // don't spam the endpoint). Server stores max delayedSec per
        // (crimeId, memberId) and bakes it into OC history when the crime
        // completes. Swallow errors — reporting is best-effort.
        try {
            if (!window.__ocFlyerReported) window.__ocFlyerReported = {};
            const rptMap = window.__ocFlyerReported;
            const nowMs = Date.now();
            const apiKey = getApiKey();
            if (apiKey && apiKey !== 'YOUR_API_KEY_HERE') {
                for (const a of alerts) {
                    if (!a.crimeId || !a.memberId) continue;
                    const k = `${a.crimeId}::${a.memberId}`;
                    if (rptMap[k] && (nowMs - rptMap[k]) < 60_000) continue;
                    rptMap[k] = nowMs;
                    const url = `${SERVER}/api/oc/flyer-delay?key=${encodeURIComponent(apiKey)}`;
                    // v3.1.47: send readyAt (unix seconds) so the server
                    // can backdate delay attribution to max(takeoffTime,
                    // readyAt) instead of the moment of first observation.
                    const body = JSON.stringify({
                        crimeId: a.crimeId, memberId: a.memberId,
                        memberName: a.memberName, crimeName: a.crimeName,
                        delayedSec: a.delayedSec || 0,
                        readyAt: Number(a.readyAt) || 0,
                        outbound: !!a.outbound,
                    });
                    if (typeof GM_xmlhttpRequest === 'function') {
                        GM_xmlhttpRequest({ method: 'POST', url, data: body, headers: { 'Content-Type': 'application/json' }, onerror(){}, onload(){} });
                    } else {
                        fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
                    }
                }
            }
        } catch (_) {}

        const escAttr = (s) => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const msgAttr = escAttr(FLYER_MESSAGE);
        let html = `<div style="background:#7f1d1d;border:1px solid #ef4444;border-radius:6px;padding:8px 10px;margin-bottom:8px;">`;
        html += `<div style="font-size:11px;font-weight:700;color:#fca5a5;margin-bottom:4px;">\u2708\ufe0f ${alerts.length} member${alerts.length > 1 ? 's' : ''} flying in an OC ready to execute</div>`;
        for (const a of alerts) {
            const stateLabel = a.state === 'abroad' ? 'abroad' : 'traveling';
            html += `<div style="font-size:10px;color:#fecaca;padding:2px 0;">`;
            if (a.memberId) {
                html += `<b class="oc-msg-btn" data-xid="${escAttr(a.memberId)}" data-msg="${msgAttr}" title="Click to message ${escAttr(a.memberName)} (copies preset fee-reminder + opens compose)" style="color:#f3f4f6;cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;">${a.memberName}</b>`;
            } else {
                html += `<b style="color:#f3f4f6;">${a.memberName}</b>`;
            }
            html += ` <span style="color:#9ca3af;">(${stateLabel})</span>`;
            html += ` <span style="color:#ef4444;">\u2192</span> `;
            html += `${a.crimeName} (${a.position}) <span style="color:#9ca3af;">Lvl ${a.difficulty}</span>`;
            if (a.readyAt > 0 || a.delayedSec > 0) {
                // v3.1.51: stash per-member base delay + render timestamp so
                // the live-tick increments from THIS value instead of
                // recalculating from OC-ready-age (which clobbered the
                // per-member attribution with a shared crime-level value).
                html += ` <span class="oc-flyer-delay" data-ready-at="${a.readyAt}" data-base-sec="${a.delayedSec || 0}" data-base-ts="${Date.now()}" style="color:#fbbf24;font-weight:600;">${a.urgency}</span>`;
            } else {
                html += ` <span style="color:#fbbf24;font-weight:600;">${a.urgency}</span>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
        return html;
    }

    // Live-tick the "delayed Xm" text in the flyer banner against Date.now()
    // so the number stays current between refreshes. Purely client-side —
    // ready_at is fixed once Torn sets it, so no re-fetch is needed. Guarded
    // by an idempotency flag so re-renders don't stack intervals.
    function setupFlyerDelayTick() {
        if (window.__ocFlyerDelayTick) return;
        window.__ocFlyerDelayTick = setInterval(() => {
            const nodes = document.querySelectorAll('.oc-flyer-delay');
            if (!nodes.length) return;
            const nowMs = Date.now();
            const nowSec = Math.floor(nowMs / 1000);
            for (const el of nodes) {
                // v3.1.51: prefer per-member (base-sec + elapsed-since-render).
                // Fall back to crime-level (now - readyAt) only if base-sec
                // isn't stamped (old renders / members without pending data).
                const baseSec = Number(el.dataset.baseSec);
                const baseTs  = Number(el.dataset.baseTs);
                let s;
                if (Number.isFinite(baseSec) && baseSec >= 0 && Number.isFinite(baseTs) && baseTs > 0) {
                    s = Math.max(0, baseSec + Math.floor((nowMs - baseTs) / 1000));
                } else {
                    const ra = Number(el.dataset.readyAt) || 0;
                    if (!ra) continue;
                    s = Math.max(0, nowSec - ra);
                }
                const mins = Math.floor(s / 60), hrs = Math.floor(mins / 60);
                let txt;
                if (s <= 0) txt = 'ready now';
                else if (hrs > 0) txt = `delayed ${hrs}h${(mins % 60).toString().padStart(2,'0')}m`;
                else if (mins > 0) txt = `delayed ${mins}m`;
                else txt = `delayed ${s}s`;
                if (el.textContent !== txt) el.textContent = txt;
            }
        }, 1000);
    }

    function renderBody(recs, eligible, skipped, scopeProjection, viewer, availableCrimes, weights, engines, members, cprCache, pendingDelays) {
        const total = eligible.length + skipped.length;
        const eli   = eligible.length;
        const free  = eligible.filter(m => !m.inOC).length;
        const soon  = eligible.filter(m => m.inOC).length;

        // Banner: only show levels where action = spawn or spawn_partial
        const spawnLvls = recs.filter(r => r.action === 'spawn' || r.action === 'spawn_partial').map(r => `Lvl ${r.level}`);
        const banner = spawnLvls.length
            ? `<div class="oc-spawn-banner">Spawn needed: ${spawnLvls.map(l => `<span class="oc-lvl-chip">${l}</span>`).join('')}</div>`
            : `<div class="oc-spawn-banner oc-banner-ok">✓ No additional spawns needed.</div>`;

        const skippedHtml = skipped.length > 0
            ? `<details style="margin-top:6px;"><summary style="cursor:pointer;color:#6b7280;font-size:11px;font-family:inherit;">${skipped.length} members skipped</summary>
                <table class="oc-table" style="margin-top:4px;">
                    <thead><tr><th>Member</th><th>Reason</th></tr></thead>
                    <tbody>${skipped.map(m => `<tr><td><span class="oc-member-name">${m.name}</span> <span class="oc-member-id">[${m.id}]</span></td><td style="color:#6b7280">${m.skipReason}</td></tr>`).join('')}</tbody>
                </table></details>` : '';

        // Profile tab — viewer card only
        document.getElementById('oc-tab-profile').innerHTML =
            renderViewerCard(viewer, eligible, skipped, availableCrimes, weights, engines) ||
            '<p style="color:#6b7280;font-size:11px;">No personal OC data yet — refresh to load.</p>';

        // Admin tab — everything else
        const travelAlert = buildTravelingAlert(availableCrimes, members, pendingDelays || {});
        setupFlyerDelayTick();
        document.getElementById('oc-tab-admin').innerHTML = `
            ${travelAlert}
            <div class="oc-stats-strip">
                <span class="oc-stat-chip"><b>${total}</b> members</span>
                <span class="oc-stat-chip"><b>${eli}</b> eligible</span>
                <span class="oc-stat-chip"><b>${free}</b> free now</span>
                <span class="oc-stat-chip"><b>${soon}</b> soon</span>
            </div>
            ${renderScopeStrip(scopeProjection)}
            ${banner}
            <h3>Spawn Recommendations — High Priority First</h3>
            ${renderRecommendations(recs, scopeProjection)}
            <h3>Eligible Members</h3>
            ${renderEligibleMembers(eligible, availableCrimes, weights)}
            ${skippedHtml}
            <p style="color:#374151;font-size:10px;margin-top:10px;">
                Active=${CONFIG.ACTIVE_DAYS}d · Forecast=${CONFIG.FORECAST_HOURS}h · MinCPR=${CONFIG.MINCPR}% · Boost=${CONFIG.CPR_BOOST}%
                &nbsp;·&nbsp; Updated: ${new Date().toLocaleTimeString()}
                &nbsp;·&nbsp; <span style="color:#253525">CPR cached 6h server-side</span>
            </p>
            ${renderOutcomeEvEngineShell(availableCrimes, 'Recruiting', 'Recruiting OCs')}`;

        // v3.1.33: kick off /api/oc/outcome fetches for Recruiting OCs so
        // the admin tab's EV table fills in asynchronously.
        scheduleOutcomeEvFetches(availableCrimes, cprCache, 'Recruiting');
    }

    // ─────────────────────────────────────────────────────────────────────
    //  OUTCOME EV (Engines tab; replaces Slot Optimizer)
    // ─────────────────────────────────────────────────────────────────────
    // Renders per-OC outcome probability table in the Engines tab, for OCs
    // in Planning status (fully filled, waiting to launch or already
    // running). Every slot has a real placed member, so no CPR-50 fallback
    // noise — numbers reflect the actual slate.
    //
    // Columns:
    //   Pass %    — scenario successChance (full slate clears all checkpoints)
    //   Top end % — top-tier payout probability (goodEnding1 in the upstream API)
    //   Q score   — weighted good-ending sum: gE1×1.0 + gE2×0.7 + gE3×0.4
    //               + all remaining good endings ×0.2. Single number for
    //               comparing expected reward quality across OCs.
    // v3.1.52: last-10 completed crimes with ✓/✗ top-tier flag. Uses the
    // same hitRates threshold the server uses for the Hit % column, so
    // admins can cross-reference recent actual outcomes against the
    // predicted Top end % + faction historical Hit % at a glance.
    function renderRecentCompletions(completions) {
        if (!Array.isArray(completions) || completions.length === 0) return '';
        const fmtShort = (n) => {
            if (n >= 1e9) return '$' + (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
            if (n >= 1e6) return '$' + (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
            if (n >= 1e3) return '$' + (n / 1e3).toFixed(1).replace(/\.?0+$/, '') + 'k';
            return '$' + Math.round(n);
        };
        const fmtAgo = (ms) => {
            if (!ms) return '—';
            const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
            const m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
            if (d > 0) return `${d}d`;
            if (h > 0) return `${h}h${m % 60}m`;
            if (m > 0) return `${m}m`;
            return `${s}s`;
        };
        let html = `<div style="margin:12px 0;border:1px solid #2d6a4f;border-radius:8px;padding:10px;background:#0a1f14;">`;
        html += `<div style="font-size:12px;font-weight:700;color:#4ade80;margin-bottom:6px;">\u{1F4CA} Recent Completions <span style="font-size:10px;font-weight:400;color:#9ca3af;margin-left:4px;">last ${completions.length}</span></div>`;
        html += `<div style="overflow-x:auto;max-width:100%;"><table class="oc-table" style="width:100%;"><thead><tr>`;
        html += `<th>OC</th><th>Lvl</th><th>Payout</th><th>Top-tier</th><th>Done</th>`;
        html += `</tr></thead><tbody>`;
        for (const c of completions) {
            const isFail = c.status && c.status !== 'Successful';
            const top = c.topTier === true ? '<span style="color:#4ade80;font-weight:700;">\u2713</span>'
                      : c.topTier === false ? '<span style="color:#ef4444;font-weight:700;">\u2717</span>'
                      : isFail ? '<span style="color:#ef4444;" title="failed OC">\u2717</span>'
                      : '<span style="color:#6b7280;" title="not enough samples for this scenario yet">\u2014</span>';
            const payoutTxt = c.payout > 0 ? fmtShort(c.payout) : '—';
            const payoutColor = c.payout > 0 ? '#f3f4f6' : '#6b7280';
            const nameColor = isFail ? '#ef4444' : '#74c69d';
            html += `<tr>`;
            html += `<td><b style="color:${nameColor};">${c.crimeName || '?'}</b></td>`;
            html += `<td>${c.difficulty || '?'}</td>`;
            html += `<td style="color:${payoutColor};">${payoutTxt}</td>`;
            html += `<td style="text-align:center;">${top}</td>`;
            html += `<td style="color:#9ca3af;">${fmtAgo(c.completedAt)} ago</td>`;
            html += `</tr>`;
        }
        html += `</tbody></table></div></div>`;
        return html;
    }

    function renderOutcomeEvEngineShell(availableCrimes, status = 'Planning', label = 'Planning OCs') {
        const matching = normArr(availableCrimes).filter(c => c.status === status);
        let html = `<div style="margin:12px 0;border:1px solid #2d6a4f;border-radius:8px;padding:10px;background:#0a1f14;">`;
        html += `<div style="font-size:12px;font-weight:700;color:#4ade80;margin-bottom:6px;">\u{1F3AF} Outcome EV <span style="font-size:10px;font-weight:400;color:#9ca3af;margin-left:4px;">${label}</span></div>`;
        if (!matching.length) {
            const hint = status === 'Recruiting'
                ? 'No Recruiting OCs right now.'
                : 'No Planning OCs right now — fill an OC to see its outcome distribution.';
            html += `<div style="color:#6b7280;font-size:11px;">${hint}</div></div>`;
            return html;
        }
        // Click-to-toggle tooltips on column headers explain each metric.
        const ttPass = 'Probability the full slate clears every checkpoint and the OC succeeds. Derived by tornprobability.com from the per-slot CPR array.';
        const ttTop  = 'Probability of hitting the top-tier payout — the highest-reward outcome. A successful OC still forks into multiple reward tiers; this is the chance of landing on the best one. The $ value (when shown) is your faction\'s average top-tier payout for this scenario, computed from the top quartile of historical completions.';
        const ttQ    = 'Weighted quality score (roughly 0–1). Top-tier payout counts 1.0, 2nd-tier 0.7, 3rd-tier 0.4, every other successful tier 0.2. Single number for comparing expected reward across OCs.';
        const ttHit  = 'Historical top-tier hit rate for this scenario: % of the faction\'s successful completions whose money payout landed in the top quartile for this OC type. Used as a proxy for top-tier hits since Torn doesn\'t label outcome tiers directly. Needs at least 4 successful completions of this scenario to show; otherwise displays as —.';
        const ttYours = 'Your faction\'s observed whole-crime success rate for this OC (a crime succeeds only if every checkpoint passes). From your own checkpoint history; needs at least 4 completions, else shows —.';
        const ttLocal = 'Locally-computed flowchart success prediction (Crimehub model), shown beside the tornprobability Pass %. A large gap flags a discrepancy. Computed on warboard — independent of the tornprobability server.';
        // v3.1.40: wrap the table in overflow-x:auto so a wide OC name
        // or the six-column layout can't push past the container border
        // on narrower panels (mobile, side-docked tabs). Scrolls
        // horizontally only when the content actually overflows.
        html += `<div style="overflow-x:auto;max-width:100%;">`;
        // v3.1.35: click-to-sort on the numeric columns. Default sort is
        // Top end % descending, applied once the async fetches populate
        // the cells. Click a header again to flip direction.
        html += `<table class="oc-table oc-ev-table" data-sort-col="top" data-sort-dir="desc" style="width:100%;"><thead><tr>`;
        html += `<th>OC</th><th>Lvl</th>`;
        html += `<th class="oc-ev-sort" data-col="pass" style="cursor:pointer;">Pass % <span class="oc-ev-sort-ind"></span> <span class="oc-ev-info" data-tt-title="Pass %" data-tt="${ttPass}">?</span></th>`;
        html += `<th class="oc-ev-sort" data-col="local" style="cursor:pointer;">Local % <span class="oc-ev-sort-ind"></span> <span class="oc-ev-info" data-tt-title="Local %" data-tt="${ttLocal}">?</span></th>`;
        html += `<th class="oc-ev-sort" data-col="yours" style="cursor:pointer;">Yours % <span class="oc-ev-sort-ind"></span> <span class="oc-ev-info" data-tt-title="Yours %" data-tt="${ttYours}">?</span></th>`;
        html += `<th class="oc-ev-sort" data-col="top"  style="cursor:pointer;">Top end % <span class="oc-ev-sort-ind">▼</span> <span class="oc-ev-info" data-tt-title="Top end %" data-tt="${ttTop}">?</span></th>`;
        html += `<th class="oc-ev-sort" data-col="hit"  style="cursor:pointer;">Hit % <span class="oc-ev-sort-ind"></span> <span class="oc-ev-info" data-tt-title="Hit %" data-tt="${ttHit}">?</span></th>`;
        html += `<th class="oc-ev-sort" data-col="q"    style="cursor:pointer;">Q score <span class="oc-ev-sort-ind"></span> <span class="oc-ev-info" data-tt-title="Q score" data-tt="${ttQ}">?</span></th>`;
        html += `</tr></thead><tbody>`;
        for (const c of matching) {
            // v3.1.36: OC name is a deep link into Torn's faction crimes
            // page at the specific crime id, so admins can jump straight
            // from "this row has the best Top end %" to "join this exact
            // OC" without having to scroll through the Recruiting list.
            // Fill chip (e.g. 3/4) added so multiple same-named OCs at
            // the same level are distinguishable before clicking through.
            const slotCount = Array.isArray(c.slots) ? c.slots.length : 0;
            const filled = (c.slots || []).filter(s => (s.user_id ?? s.user?.id) != null).length;
            const fillChip = slotCount
                ? ` <span style="color:#6b7280;font-weight:400;font-size:10px;">(${filled}/${slotCount})</span>`
                : '';
            const href = `https://www.torn.com/factions.php?step=your#/tab=crimes&crimeId=${c.id}`;
            // v3.1.38: empirical top-tier hit rate for this scenario,
            // sourced from server's hitRates payload (top-quartile payout
            // across the faction's historical completions). Unlike the
            // predicted columns, this populates synchronously — no fetch.
            const hr = _lastHitRates?.[c.name];
            let hitCell;
            if (hr && hr.rate !== null && hr.count >= 4) {
                const hitPct = hr.rate * 100;
                const hitColour = hitPct >= 30 ? '#4ade80' : hitPct >= 20 ? '#e5b567' : '#ef4444';
                hitCell = `<td class="oc-outcome-hit" style="color:${hitColour};" data-val="${hitPct}" title="${hr.topCount}/${hr.count} completions in top payout quartile">${hitPct.toFixed(1)}%</td>`;
            } else if (hr && hr.count > 0) {
                hitCell = `<td class="oc-outcome-hit" style="color:#6b7280;" title="Only ${hr.count} completion${hr.count === 1 ? '' : 's'}; need at least 4 for a reliable rate">—<span style="font-size:9px;"> (${hr.count})</span></td>`;
            } else {
                hitCell = `<td class="oc-outcome-hit" style="color:#6b7280;" title="No completed OCs of this scenario in history yet">—</td>`;
            }
            html += `<tr data-oc-outcome-id="${c.id}">`;
            html += `<td><a href="${href}" target="_blank" style="color:#74c69d;font-weight:700;text-decoration:none;" title="Open OC ${c.id} on the Torn crimes page">${c.name}${fillChip}</a></td>`;
            html += `<td>${c.difficulty}</td>`;
            html += `<td class="oc-outcome-pass" style="color:#6b7280">…</td>`;
            html += `<td class="oc-outcome-local" style="color:#6b7280">…</td>`;
            html += `<td class="oc-outcome-yours" style="color:#6b7280">…</td>`;
            html += `<td class="oc-outcome-top"  style="color:#6b7280">…</td>`;
            html += hitCell;
            html += `<td class="oc-outcome-q"    style="color:#6b7280">…</td>`;
            html += `</tr>`;
        }
        html += `</tbody></table>`;
        html += `</div>`; // close overflow-x wrapper
        if (status === 'Recruiting') {
            html += `<div style="color:#6b7280;font-size:10px;margin-top:6px;">Empty slots use your faction's avg CPR at each OC's level — numbers firm up as real members fill the slots.</div>`;
        }
        html += `</div>`; // close outer bordered box
        return html;
    }

    // v3.1.37: compute the faction's avg CPR per level from cprCache so
    // empty slots in Recruiting OCs use a *realistic* placeholder instead
    // of the old flat CPR-50. Averages across every member whose joinable
    // (or highestLevel) reaches that level. Falls back to 50 only if no
    // members qualify for the level yet.
    function computeLevelBenchmarks(cprCache) {
        const byLevel = {};
        for (const uid in (cprCache || {})) {
            const cc = cprCache[uid];
            if (!cc || typeof cc.cpr !== 'number') continue;
            const top = cc.joinable || cc.highestLevel || 0;
            for (let lvl = 1; lvl <= top; lvl++) {
                if (!byLevel[lvl]) byLevel[lvl] = { sum: 0, count: 0 };
                byLevel[lvl].sum += cc.cpr;
                byLevel[lvl].count += 1;
            }
        }
        const avg = {};
        for (const lvl in byLevel) {
            avg[lvl] = byLevel[lvl].count ? byLevel[lvl].sum / byLevel[lvl].count : 50;
        }
        return avg;
    }

    async function scheduleOutcomeEvFetches(availableCrimes, cprCache, status = 'Planning') {
        const matching = normArr(availableCrimes).filter(c => c.status === status);
        if (!matching.length) return;
        const apiKey = getApiKey();
        if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') return;

        const benchmarks = computeLevelBenchmarks(cprCache);

        let _observed = {};
        try {
            const ro = await gmRequest(`${SERVER}/api/oc/observed-odds?key=${encodeURIComponent(apiKey)}`);
            if (ro.ok && ro.data && ro.data.byName) _observed = ro.data.byName;
        } catch (_) {}

        for (const c of matching) {
            // Empty-slot placeholder: faction's avg CPR at this OC's level.
            // Realistic "what-if-an-average-member-filled-it" estimate.
            const emptyFallback = benchmarks[c.difficulty] ?? 50;
            const slots = Array.isArray(c.slots) ? c.slots : [];
            const cprs = slots.map(s => {
                const uid = s.user_id ?? s.user?.id;
                if (!uid) return emptyFallback;
                const cc = cprCache?.[String(uid)];
                if (!cc) return emptyFallback;
                const exactKey = `${c.name}::${s.position}`;
                const pd = cc.byPosition?.[exactKey];
                if (pd && typeof pd.cpr === 'number') return pd.cpr;
                if (typeof cc.cpr === 'number') return cc.cpr;
                return emptyFallback;
            });
            if (!cprs.length) continue;

            const url = `${SERVER}/api/oc/outcome`
                + `?key=${encodeURIComponent(apiKey)}`
                + `&scenario=${encodeURIComponent(c.name)}`
                + `&cprs=${cprs.join(',')}`;
            try {
                const r = await gmRequest(url);
                if (!r.ok || !r.data || r.data.error) continue;
                const d = r.data;
                const passPct = (d.successChance ?? 0) * 100;
                const topPct  = (d.goodEnding1 ?? 0) * 100;
                const qScore  = (d.goodEnding1 ?? 0) * 1.0
                              + (d.goodEnding2 ?? 0) * 0.7
                              + (d.goodEnding3 ?? 0) * 0.4
                              + Object.keys(d)
                                  .filter(k => /^goodEnding([4-9]|1[0-9]|[34][05])$/.test(k))
                                  .reduce((a, k) => a + (d[k] ?? 0) * 0.2, 0);
                const row = document.querySelector(`tr[data-oc-outcome-id="${c.id}"]`);
                if (!row) continue;
                const colour = (v) => v >= 70 ? '#4ade80' : v >= 45 ? '#e5b567' : '#ef4444';
                const pass = row.querySelector('.oc-outcome-pass');
                const top  = row.querySelector('.oc-outcome-top');
                const q    = row.querySelector('.oc-outcome-q');
                if (pass) { pass.style.color = colour(passPct); pass.textContent = passPct.toFixed(1) + '%'; pass.dataset.val = passPct; }
                const yoursCell = row.querySelector('.oc-outcome-yours');
                if (yoursCell) {
                    const f = _observed[c.name]?.faction;
                    if (f && f.total >= 4) {
                        const yp = f.rate * 100;
                        yoursCell.style.color = colour(yp); yoursCell.textContent = yp.toFixed(1) + '%'; yoursCell.dataset.val = yp;
                        yoursCell.title = `${f.success}/${f.total} completions succeeded`;
                    } else {
                        yoursCell.textContent = f && f.total > 0 ? `— (${f.total})` : '—';
                    }
                }
                const localCell = row.querySelector('.oc-outcome-local');
                if (localCell) {
                    if (typeof d.localSuccessChance === 'number') {
                        const lp = d.localSuccessChance * 100;
                        localCell.style.color = colour(lp); localCell.textContent = lp.toFixed(1) + '%'; localCell.dataset.val = lp;
                        if (typeof d.delta === 'number' && Math.abs(d.delta) >= 0.05) localCell.title = `Δ vs Pass%: ${(d.delta * 100).toFixed(1)}pp`;
                    } else { localCell.textContent = '—'; }
                }
                if (top) {
                    top.style.color  = colour(topPct * 2);
                    top.dataset.val = topPct;
                    // v3.1.41: append $ avg top-tier payout (when we have
                    // historical data for this scenario) so admins can
                    // see the probability AND the actual dollar amount
                    // on a top-tier hit.
                    const hrForTop = _lastHitRates?.[c.name];
                    const avgTop = hrForTop?.topAvgPayout;
                    // Compact money: $1.2M / $950k / $500
                    const fmtShort = (n) => {
                        if (n >= 1e9) return '$' + (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
                        if (n >= 1e6) return '$' + (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
                        if (n >= 1e3) return '$' + (n / 1e3).toFixed(1).replace(/\.?0+$/, '') + 'k';
                        return '$' + Math.round(n);
                    };
                    const dollarSuffix = (Number.isFinite(avgTop) && avgTop > 0)
                        ? ` <span style="color:#9ca3af;font-size:9px;font-weight:400;">${fmtShort(avgTop)}</span>`
                        : '';
                    top.innerHTML = topPct.toFixed(1) + '%' + dollarSuffix;
                }
                if (q)    { q.style.color    = colour(qScore * 100); q.textContent  = qScore.toFixed(3); q.dataset.val = qScore; }
                // Re-apply whichever sort is currently active on this
                // specific table, so rankings update as data arrives.
                sortOutcomeEvTable(row.closest('.oc-ev-table'));
            } catch (_) { /* swallow; row stays as '…' */ }
        }
    }

    // v3.1.35: sort helper for the Outcome EV tables. Reads current sort
    // state from the table's data-sort-col / data-sort-dir attributes,
    // pulls each row's value from the matching <td data-val="..."> on
    // the target column, sorts, and re-appends. Rows still in the '…'
    // placeholder state are treated as -Infinity so they bubble to the
    // bottom of a descending sort (where "no data" is least useful).
    function sortOutcomeEvTable(table) {
        if (!table) return;
        const col = table.dataset.sortCol || 'top';
        const dir = table.dataset.sortDir === 'asc' ? 'asc' : 'desc';
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        const cls = col === 'pass'  ? '.oc-outcome-pass'
                  : col === 'local' ? '.oc-outcome-local'
                  : col === 'yours' ? '.oc-outcome-yours'
                  : col === 'q'     ? '.oc-outcome-q'
                  : col === 'hit'   ? '.oc-outcome-hit'
                  :                   '.oc-outcome-top';
        const rows = Array.from(tbody.querySelectorAll('tr'));
        rows.sort((a, b) => {
            const ta = a.querySelector(cls);
            const tb = b.querySelector(cls);
            const va = ta && ta.dataset.val !== undefined ? Number(ta.dataset.val) : -Infinity;
            const vb = tb && tb.dataset.val !== undefined ? Number(tb.dataset.val) : -Infinity;
            return dir === 'asc' ? (va - vb) : (vb - va);
        });
        for (const r of rows) tbody.appendChild(r);
        // Update header indicators
        for (const th of table.querySelectorAll('.oc-ev-sort')) {
            const ind = th.querySelector('.oc-ev-sort-ind');
            if (!ind) continue;
            if (th.dataset.col === col) ind.textContent = dir === 'asc' ? '▲' : '▼';
            else ind.textContent = '';
        }
    }

    // Click delegation for sortable Outcome EV column headers. Ignores
    // clicks on the nested info-icon (that has its own handler).
    document.addEventListener('click', (e) => {
        const th = e.target.closest && e.target.closest('.oc-ev-sort');
        if (!th) return;
        if (e.target.closest('.oc-ev-info')) return;  // info icon owns its own click
        const table = th.closest('.oc-ev-table');
        if (!table) return;
        const col = th.dataset.col;
        if (!col) return;
        const curCol = table.dataset.sortCol || 'top';
        const curDir = table.dataset.sortDir === 'asc' ? 'asc' : 'desc';
        if (curCol === col) {
            table.dataset.sortDir = curDir === 'asc' ? 'desc' : 'asc';
        } else {
            table.dataset.sortCol = col;
            table.dataset.sortDir = 'desc';
        }
        sortOutcomeEvTable(table);
    });

    // ═══════════════════════════════════════════════════════════════════════
    //  MAIN
    // ═══════════════════════════════════════════════════════════════════════
    // Dev always gets full access regardless of role
    function isDev(viewer) {
        return viewer && String(viewer.playerId) === '137558';
    }
    // Admin tab: dev OR has faction API access
    function canViewAdmin(viewer) {
        if (!viewer) return false;
        if (isDev(viewer)) return true;
        return viewer.hasFactionAccess === true;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  OC MANAGER TAB  — Missing / Unused / Payouts sub-tabs
    // ═══════════════════════════════════════════════════════════════════════
    //  COACHING TAB  — surfaces the per-checkpoint heatmap data as
    //  actionable "who needs help where" rows. Sortable list of
    //  (member, OC, role, checkpoint) tuples ranked by gap-to-faction-
    //  average. Min-sample filter (≥3 attempts at the checkpoint AND
    //  ≥3 attempts faction-wide) keeps the list from being noise.
    //
    //  Data source: cprCache[uid].byCheckpoint that getOcSpawnData
    //  populates from oc-checkpoint-history.aggregateByMember(). Cold-
    //  start gap means an empty Coaching tab until at least one admin
    //  has opened the Completed tab on faction.php a few times.
    // ═══════════════════════════════════════════════════════════════════════
    const COACHING_MIN_SAMPLES = 3;
    let _coachingSort = { col: 'gap', dir: 'desc' };

    function _computeFactionCheckpointAvgs(cprCache) {
        // Roll up faction-wide pass rate per (OC::role::Cn) so we can
        // compute per-member gap-to-average. Sum pass+fail counts across
        // every member, then compute rate.
        const sums = {}; // key → { pass, fail }
        for (const uid in cprCache) {
            const cps = cprCache[uid]?.byCheckpoint;
            if (!cps) continue;
            for (const k in cps) {
                if (!sums[k]) sums[k] = { pass: 0, fail: 0 };
                sums[k].pass += cps[k].pass || 0;
                sums[k].fail += cps[k].fail || 0;
            }
        }
        const avgs = {};
        for (const k in sums) {
            const total = sums[k].pass + sums[k].fail;
            avgs[k] = {
                rate: total > 0 ? Math.round((sums[k].pass / total) * 1000) / 10 : 0,
                samples: total,
            };
        }
        return avgs;
    }

    /**
     * Pattern-based "likely cause" classifier — Phase 3, no new data
     * sources. Uses only what's already in cprCache to characterize
     * WHY a member underperforms at a checkpoint. Returns one of:
     *
     *   - oc-difficult     — faction-wide rate at this checkpoint is
     *                        also low (< 60%); not really a member
     *                        problem, the OC mechanic is hard
     *   - level-overreach  — member's highestLevel is well below this
     *                        OC's required difficulty (we don't have
     *                        diff per scenario stored, but their
     *                        cpr.highestLevel hints this)
     *   - role-specific    — member's overall CPR is solid (≥ MINCPR)
     *                        but they fail this specific checkpoint;
     *                        likely a stat / item / role-fit gap
     *   - general          — member's overall CPR is also low; they
     *                        need general OC practice, not coaching
     *                        on this specific checkpoint
     *   - small-sample     — only 3-4 attempts; not enough signal to
     *                        diagnose; flagged so admin doesn't act
     *                        on noise
     */
    function _classifyCause(memberCpr, ocName, memberHighestLevel, memberSamples, factionAvgRate, factionAvgSamples) {
        if (memberSamples < 5) return { code: 'small-sample', icon: '⚠️', label: 'Small sample', detail: `Only ${memberSamples} attempts — let more crimes pile up before coaching on this.` };
        if (factionAvgRate < 60 && factionAvgSamples >= 5) {
            return { code: 'oc-difficult', icon: '⚙️', label: 'OC mechanic', detail: `Faction-wide pass rate at this checkpoint is ${factionAvgRate}% — the OC itself is hard, not just this member.` };
        }
        if (memberCpr >= 70) {
            return { code: 'role-specific', icon: '🎯', label: 'Role-specific', detail: `Member's overall CPR is ${memberCpr}% (solid) but they fail this checkpoint specifically — likely stat / gear / role-fit mismatch at this stage.` };
        }
        if (memberCpr < 50) {
            return { code: 'general', icon: '📈', label: 'General weakness', detail: `Member's overall CPR is ${memberCpr}% (low) across all OCs — they need general practice, not stage-specific coaching.` };
        }
        return { code: 'mixed', icon: '🔄', label: 'Mixed signal', detail: `Member's overall CPR is ${memberCpr}% — somewhere between general weakness and role-specific. Compare with their other checkpoints in this OC.` };
    }

    function _buildCoachingRows(snapshot) {
        const cprCache = snapshot?.cprCache || {};
        const members = snapshot?.members || [];
        const memberById = new Map();
        for (const m of members) memberById.set(String(m.id), m);
        // v3.2.8: faction-average baseline still consumes ALL uids in
        // cprCache (ex-members included — their history makes the
        // average more accurate). Displayed rows skip ex-members
        // because we can't coach them anymore; only current roster
        // members are actionable.
        const factionAvgs = _computeFactionCheckpointAvgs(cprCache);
        const rows = [];
        for (const uid in cprCache) {
            // v3.2.8: skip ex-members entirely — no row, no "Player <id>"
            // placeholder. Per user request: "don't include members that
            // aren't in the faction anymore".
            const memberRecord = memberById.get(uid);
            if (!memberRecord) continue;
            const member = cprCache[uid];
            const cps = member?.byCheckpoint;
            if (!cps) continue;
            const memberName = memberRecord.name || `Player ${uid}`;
            const memberCpr = Number(member.cpr) || 0;
            const memberHighestLevel = Number(member.highestLevel) || 0;
            for (const k in cps) {
                const e = cps[k];
                const total = (e.pass || 0) + (e.fail || 0);
                if (total < COACHING_MIN_SAMPLES) continue;
                const fAvg = factionAvgs[k];
                if (!fAvg || fAvg.samples < COACHING_MIN_SAMPLES) continue;
                const gap = fAvg.rate - e.rate;
                if (gap <= 0) continue; // member is at or above faction avg — no coaching needed
                const parts = k.split('::');
                const cause = _classifyCause(
                    memberCpr,
                    parts[0] || '?',
                    memberHighestLevel,
                    total,
                    fAvg.rate,
                    fAvg.samples,
                );
                rows.push({
                    uid, memberName,
                    oc: parts[0] || '?',
                    role: parts[1] || '?',
                    checkpoint: parts[2] || '?',
                    rate: e.rate,
                    factionRate: fAvg.rate,
                    gap: Math.round(gap * 10) / 10,
                    samples: total,
                    factionSamples: fAvg.samples,
                    cause,
                });
            }
        }
        return rows;
    }

    function _sortCoachingRows(rows) {
        const { col, dir } = _coachingSort;
        const mul = dir === 'asc' ? 1 : -1;
        rows.sort((a, b) => {
            let va, vb;
            switch (col) {
                case 'member':  va = a.memberName.toLowerCase(); vb = b.memberName.toLowerCase(); break;
                case 'oc':      va = a.oc;         vb = b.oc;         break;
                case 'role':    va = a.role;       vb = b.role;       break;
                case 'cp':      va = a.checkpoint; vb = b.checkpoint; break;
                case 'rate':    va = a.rate;       vb = b.rate;       break;
                case 'samples': va = a.samples;    vb = b.samples;    break;
                case 'gap':
                default:        va = a.gap;        vb = b.gap;        break;
            }
            if (va < vb) return -1 * mul;
            if (va > vb) return  1 * mul;
            return 0;
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PAYOUTS TAB — v3.2.9
    //
    //  Pulls all ranked-war attacks for a chosen ended war, classifies +
    //  weights them, splits a configurable loot total proportionally
    //  across attackers. Admin-gated. Server endpoints:
    //    GET /api/war/payouts/list        → eligible wars (ended, ours)
    //    GET /api/war/:warId/payouts      → computed payouts
    //  Mode toggle (Dynamic FF / Static Tier) and loot override propagate
    //  to the server endpoint via query params. The "Send" buttons reuse
    //  the existing vault-payout flow: copy amount to clipboard + open
    //  Torn's Controls tab so the user can paste into give-to-user.
    // ═══════════════════════════════════════════════════════════════════════
    let _payoutsState = {
        wars: null,        // cached wars list
        selectedWarId: null,
        mode: 'dynamic',
        lootOverride: '',
        lastResult: null,
    };

    async function loadPayoutsTab() {
        const container = document.getElementById('oc-tab-payouts');
        if (!container) return;
        const apiKey = getApiKey();
        if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
            container.innerHTML = '<div style="padding:24px;color:#9ca3af;font-size:13px;text-align:center;">API key required — open Settings ⚙ and re-enter.</div>';
            return;
        }

        // First load: fetch eligible wars list.
        if (!_payoutsState.wars) {
            container.innerHTML = '<div style="padding:24px;color:#9ca3af;font-size:13px;text-align:center;">Loading war list…</div>';
            try {
                const r = await gmRequest(`${SERVER}/api/war/payouts/list?key=${encodeURIComponent(apiKey)}`);
                _payoutsState.wars = Array.isArray(r?.wars) ? r.wars : [];
                if (_payoutsState.wars.length > 0 && !_payoutsState.selectedWarId) {
                    _payoutsState.selectedWarId = _payoutsState.wars[0].warId;
                }
            } catch (e) {
                container.innerHTML = `<div style="padding:24px;color:#ef4444;font-size:13px;text-align:center;">Failed to load wars: ${met_escapeHtml(e.message)}</div>`;
                return;
            }
        }

        if (_payoutsState.wars.length === 0) {
            container.innerHTML = '<div style="padding:24px;color:#9ca3af;font-size:13px;text-align:center;">No ended wars available for payout calc yet.</div>';
            return;
        }

        renderPayoutsShell(container);
        renderPayoutsBody();
    }

    function renderPayoutsShell(container) {
        const wars = _payoutsState.wars || [];
        const selectedWarId = _payoutsState.selectedWarId;
        const mode = _payoutsState.mode;
        const warOptions = wars.map(w => {
            const when = w.warEndedAt ? new Date(w.warEndedAt).toISOString().slice(0, 10) : '?';
            const result = w.warResult === 'victory' ? '✓ Win'
                : w.warResult === 'defeat' ? '✗ Loss'
                : w.warResult === 'draw' ? '= Draw' : '?';
            const sel = String(w.warId) === String(selectedWarId) ? ' selected' : '';
            return `<option value="${met_escapeHtml(w.warId)}"${sel}>vs ${met_escapeHtml(w.enemyFactionName)} · ${when} · ${result}</option>`;
        }).join('');
        container.innerHTML = `
            <div style="padding:14px 16px;border-bottom:1px solid #1a2e20;">
                <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:end;">
                    <label style="flex:1;min-width:220px;">
                        <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:3px;">War</div>
                        <select id="payouts-war-sel" style="width:100%;padding:5px 7px;background:#0f1a14;color:#d1d5db;border:1px solid #2d4a3e;border-radius:4px;font-size:12px;">${warOptions}</select>
                    </label>
                    <label>
                        <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:3px;">Mode</div>
                        <select id="payouts-mode-sel" style="padding:5px 7px;background:#0f1a14;color:#d1d5db;border:1px solid #2d4a3e;border-radius:4px;font-size:12px;">
                            <option value="dynamic"${mode === 'dynamic' ? ' selected' : ''}>Dynamic FF</option>
                            <option value="static"${mode === 'static' ? ' selected' : ''}>Static Tiered</option>
                        </select>
                    </label>
                    <label>
                        <div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:3px;">Loot total ($)</div>
                        <input type="text" id="payouts-loot" placeholder="auto-detect" value="${met_escapeHtml(_payoutsState.lootOverride)}" style="width:140px;padding:5px 7px;background:#0f1a14;color:#d1d5db;border:1px solid #2d4a3e;border-radius:4px;font-size:12px;">
                    </label>
                    <button id="payouts-recalc" style="background:#2d6a4f;color:white;border:0;border-radius:4px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;">Recalculate</button>
                </div>
                <div style="font-size:10px;color:#6b7280;margin-top:8px;line-height:1.4;">
                    Dynamic FF: war hit = exact FF × 1.0, retal × 1.25, overseas × 1.5, assist 0.75, chain 0.6.
                    Static Tier: war hit = 1 pt flat (rest same as dynamic).
                    Loot blank = auto-detect from war report (winning side only). Override with any number.
                </div>
            </div>
            <div id="payouts-body" style="padding:8px 0;"></div>
        `;
        // Event wiring
        document.getElementById('payouts-war-sel').addEventListener('change', e => {
            _payoutsState.selectedWarId = e.target.value;
            _payoutsState.lastResult = null;
            renderPayoutsBody();
        });
        document.getElementById('payouts-mode-sel').addEventListener('change', e => {
            _payoutsState.mode = e.target.value;
            _payoutsState.lastResult = null;
            renderPayoutsBody();
        });
        document.getElementById('payouts-loot').addEventListener('change', e => {
            _payoutsState.lootOverride = (e.target.value || '').trim();
            _payoutsState.lastResult = null;
            renderPayoutsBody();
        });
        document.getElementById('payouts-recalc').addEventListener('click', () => {
            _payoutsState.lastResult = null;
            renderPayoutsBody({ forceFresh: true });
        });
    }

    async function renderPayoutsBody(opts = {}) {
        const body = document.getElementById('payouts-body');
        if (!body) return;
        body.innerHTML = '<div style="padding:24px;color:#9ca3af;font-size:13px;text-align:center;">Calculating payouts (this can take a few seconds for large wars)…</div>';
        const apiKey = getApiKey();
        const warId = _payoutsState.selectedWarId;
        if (!warId) {
            body.innerHTML = '<div style="padding:24px;color:#9ca3af;font-size:13px;text-align:center;">Pick a war above to see payouts.</div>';
            return;
        }
        const params = new URLSearchParams({ key: apiKey, mode: _payoutsState.mode });
        const lootStr = (_payoutsState.lootOverride || '').replace(/[^0-9]/g, '');
        if (lootStr) params.set('loot', lootStr);
        if (opts.forceFresh) params.set('fresh', '1');
        try {
            const result = await gmRequest(`${SERVER}/api/war/${encodeURIComponent(warId)}/payouts?${params.toString()}`);
            _payoutsState.lastResult = result;
            renderPayoutsTable(body, result);
        } catch (e) {
            body.innerHTML = `<div style="padding:24px;color:#ef4444;font-size:13px;text-align:center;">Payout calc failed: ${met_escapeHtml(e.message)}</div>`;
        }
    }

    function renderPayoutsTable(container, result) {
        const members = Array.isArray(result.members) ? result.members : [];
        const fmt$ = n => '$' + (n || 0).toLocaleString();
        const lootLabel = result.lootAutoDetected
            ? `${fmt$(result.lootTotal)} (auto-detected from war report)`
            : (result.lootTotal > 0 ? fmt$(result.lootTotal) : 'not set');
        let html = `
            <div style="padding:8px 16px;background:rgba(255,255,255,0.03);border-bottom:1px solid #1a2e20;font-size:11px;color:#9ca3af;display:flex;flex-wrap:wrap;gap:14px;">
                <span><b style="color:#d1d5db;">${result.attackCount.toLocaleString()}</b> war attacks</span>
                <span><b style="color:#d1d5db;">${members.length}</b> attackers</span>
                <span>Total score: <b style="color:#d1d5db;">${result.totalScore}</b></span>
                <span>Loot: <b style="color:#d1d5db;">${lootLabel}</b></span>
                <span style="margin-left:auto;color:#6b7280;">${result.cached ? 'cached' : 'fresh'} · ${new Date(result.generatedAt).toLocaleTimeString()}</span>
            </div>
            <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:11px;">
                <thead>
                    <tr style="background:rgba(255,255,255,0.04);color:#9ca3af;text-transform:uppercase;letter-spacing:0.4px;font-size:9.5px;">
                        <th style="padding:6px 8px;text-align:left;">Member</th>
                        <th style="padding:6px 8px;text-align:right;">Score</th>
                        <th style="padding:6px 8px;text-align:right;">Share %</th>
                        <th style="padding:6px 8px;text-align:right;">Payout</th>
                        <th style="padding:6px 8px;text-align:left;">Breakdown</th>
                        <th style="padding:6px 8px;text-align:center;"></th>
                    </tr>
                </thead>
                <tbody>`;
        for (const m of members) {
            const bdParts = [];
            const bd = m.breakdown || {};
            const order = ['war_hit', 'retal', 'overseas_war', 'assist', 'chain_hit', 'os_chain'];
            const labels = {
                war_hit: 'war', retal: 'retal', overseas_war: 'os',
                assist: 'assist', chain_hit: 'chain', os_chain: 'os-chain',
            };
            for (const k of order) {
                if (bd[k]) bdParts.push(`${labels[k]}:${bd[k]}`);
            }
            const breakdownStr = bdParts.join(' · ') || '—';
            html += `<tr style="border-bottom:1px solid #1a2e20;">
                <td style="padding:5px 8px;">
                    <a href="/profiles.php?XID=${met_escapeHtml(m.playerId)}" target="_blank" rel="noopener" style="color:#d1d5db;text-decoration:none;">${met_escapeHtml(m.name)}</a>
                    <span style="color:#6b7280;font-size:10px;">[${m.playerId}]</span>
                </td>
                <td style="padding:5px 8px;text-align:right;color:#d1d5db;">${m.score}</td>
                <td style="padding:5px 8px;text-align:right;color:#9ca3af;">${m.sharePct}%</td>
                <td style="padding:5px 8px;text-align:right;color:#74c69d;font-weight:600;">${fmt$(m.dollarPayout)}</td>
                <td style="padding:5px 8px;color:#9ca3af;font-size:10px;">${met_escapeHtml(breakdownStr)}</td>
                <td style="padding:5px 8px;text-align:center;">
                    <a href="/factions.php?step=your&type=1#/tab=controls"
                       target="_blank" rel="noopener"
                       class="payouts-send-btn"
                       data-amount="${m.dollarPayout}"
                       data-name="${met_escapeHtml(m.name)}"
                       data-id="${met_escapeHtml(m.playerId)}"
                       style="background:#2d6a4f;color:white;border:0;border-radius:3px;padding:3px 9px;font-size:10px;text-decoration:none;cursor:pointer;${m.dollarPayout <= 0 ? 'opacity:0.4;pointer-events:none;' : ''}">
                        Send
                    </a>
                </td>
            </tr>`;
        }
        html += '</tbody></table></div>';
        container.innerHTML = html;
        // Wire Send buttons → copy amount to clipboard, then let the
        // <a> default navigate to the Controls tab.
        container.querySelectorAll('.payouts-send-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const amt = btn.dataset.amount || '0';
                try { navigator.clipboard.writeText(amt); } catch (_) {}
                // Tiny inline ack so user knows the copy happened.
                const orig = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(() => { btn.textContent = orig; }, 1200);
            });
        });
    }

    function loadCoachingTab() {
        const container = document.getElementById('oc-tab-coaching');
        if (!_coachingSnapshot) {
            container.innerHTML = '<div class="mgr-loading">Refresh OC Spawn first to populate.</div>';
            return;
        }
        const rows = _buildCoachingRows(_coachingSnapshot);
        if (rows.length === 0) {
            container.innerHTML = `
                <div style="padding:14px;color:#9ca3af;font-size:11px;line-height:1.6;">
                    <div style="font-size:13px;color:#f3f4f6;font-weight:600;margin-bottom:6px;">No coaching data yet</div>
                    Per-checkpoint attribution requires the userscript to capture at least one
                    completed-crime page response with parseable <code>[C\\d+-P/F]</code> dialogue
                    markers. To populate:
                    <ol style="margin-top:6px;padding-left:18px;">
                        <li>Open Torn → faction.php → click <b>Completed</b> tab</li>
                        <li>Wait a moment for the userscript to upload parsed scenarios</li>
                        <li>Refresh OC Spawn</li>
                    </ol>
                    Filter requires ≥${COACHING_MIN_SAMPLES} attempts per (member, OC, role,
                    checkpoint) AND ≥${COACHING_MIN_SAMPLES} faction-wide attempts at that
                    checkpoint to count as actionable signal.
                </div>`;
            return;
        }
        _sortCoachingRows(rows);
        const indicator = (col) => _coachingSort.col === col ? (_coachingSort.dir === 'asc' ? '▲' : '▼') : '';
        let html = `
            <div style="padding:8px 12px;color:#9ca3af;font-size:10px;border-bottom:1px solid #1a2e20;">
                ${rows.length} coaching opportunit${rows.length === 1 ? 'y' : 'ies'} found.
                Each row = a (member, OC, role, checkpoint) where the member's pass rate is
                meaningfully below the faction's average at that same checkpoint.
            </div>
            <div style="overflow-x:auto;">
            <table class="oc-table oc-coach-table" style="width:100%;font-size:11px;">
                <thead><tr>
                    <th class="oc-coach-sort" data-col="member"  style="cursor:pointer;">Member ${indicator('member')}</th>
                    <th class="oc-coach-sort" data-col="oc"      style="cursor:pointer;">OC ${indicator('oc')}</th>
                    <th class="oc-coach-sort" data-col="role"    style="cursor:pointer;">Role ${indicator('role')}</th>
                    <th class="oc-coach-sort" data-col="cp"      style="cursor:pointer;text-align:center;">CP ${indicator('cp')}</th>
                    <th class="oc-coach-sort" data-col="rate"    style="cursor:pointer;text-align:right;">Their % ${indicator('rate')}</th>
                    <th style="text-align:right;">Faction %</th>
                    <th class="oc-coach-sort" data-col="gap"     style="cursor:pointer;text-align:right;">Gap ${indicator('gap')}</th>
                    <th class="oc-coach-sort" data-col="samples" style="cursor:pointer;text-align:right;">Samples ${indicator('samples')}</th>
                    <th>Likely cause</th>
                </tr></thead>
                <tbody>`;
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const rateColor = r.rate >= 80 ? '#74c69d' : r.rate >= 60 ? '#f4a261' : '#ef4444';
            const gapColor  = r.gap >= 30 ? '#ef4444' : r.gap >= 15 ? '#f4a261' : '#9ca3af';
            html += `<tr class="oc-coach-row" data-row-idx="${i}" style="cursor:pointer;">
                <td><span class="oc-member-name">${met_escapeHtml(r.memberName)}</span> <span class="oc-member-id">[${met_escapeHtml(r.uid)}]</span></td>
                <td>${met_escapeHtml(r.oc)}</td>
                <td style="color:#9ca3af;">${met_escapeHtml(r.role)}</td>
                <td style="text-align:center;color:#d1d5db;">${met_escapeHtml(r.checkpoint)}</td>
                <td style="text-align:right;color:${rateColor};font-weight:600;">${r.rate}%</td>
                <td style="text-align:right;color:#9ca3af;">${r.factionRate}%</td>
                <td style="text-align:right;color:${gapColor};font-weight:700;">−${r.gap}%</td>
                <td style="text-align:right;color:#6b7280;font-size:10px;">${r.samples}/${r.factionSamples}</td>
                <td style="white-space:nowrap;"><span style="font-size:11px;">${r.cause.icon}</span> <span style="color:#d1d5db;">${met_escapeHtml(r.cause.label)}</span></td>
            </tr>
            <tr class="oc-coach-detail" data-detail-idx="${i}" style="display:none;">
                <td colspan="9" style="padding:6px 12px;background:rgba(255,255,255,0.02);color:#9ca3af;font-size:11px;line-height:1.5;border-bottom:1px solid #1a2e20;">
                    <b style="color:#d1d5db;">${r.cause.icon} ${met_escapeHtml(r.cause.label)}:</b> ${met_escapeHtml(r.cause.detail)}
                </td>
            </tr>`;
        }
        html += '</tbody></table></div>';
        html += `<div style="padding:8px 12px;color:#6b7280;font-size:10px;line-height:1.5;border-top:1px solid #1a2e20;">
            Color: ≥30% gap = red (priority), 15–29% = amber, &lt;15% = grey.
            Samples shows (member's count / faction-wide count). Min ${COACHING_MIN_SAMPLES} of each.
            Tap any row to expand the "likely cause" detail.
            <br>Causes: 🎯 role-specific · 📈 general weakness · ⚙️ OC mechanic (faction also struggles)
            · ⛰️ level overreach · 🔄 mixed signal · ⚠️ small sample.
            <br>Data populates as members open the Completed tab — see the CPR tooltip heatmap on the
            Admin tab for per-member detail.
        </div>`;
        container.innerHTML = html;

        container.querySelectorAll('.oc-coach-sort').forEach(th => {
            th.addEventListener('click', () => {
                const c = th.dataset.col;
                if (_coachingSort.col === c) {
                    _coachingSort.dir = _coachingSort.dir === 'asc' ? 'desc' : 'asc';
                } else {
                    _coachingSort.col = c;
                    _coachingSort.dir = (c === 'rate' || c === 'samples') ? 'asc' : 'desc';
                }
                loadCoachingTab(); // re-render with new sort
            });
        });
        // Tap-to-expand for the "likely cause" detail row. Mobile-friendly
        // (click also fires on tap); each row toggles independently.
        container.querySelectorAll('.oc-coach-row').forEach(tr => {
            tr.addEventListener('click', (e) => {
                if (e.target.closest('a')) return;
                const idx = tr.dataset.rowIdx;
                const detail = container.querySelector(`tr.oc-coach-detail[data-detail-idx="${idx}"]`);
                if (detail) detail.style.display = (detail.style.display === 'none' || !detail.style.display) ? 'table-row' : 'none';
            });
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  OC MANAGER TAB  — Missing / Unused / Payouts sub-tabs
    // ═══════════════════════════════════════════════════════════════════════
    let mgr_currentSubTab = 'missing';

    function loadManagerTab() {
        const container = document.getElementById('oc-tab-manager');
        // Only render sub-tab bar once; preserve if already there
        if (!container.querySelector('.mgr-sub-tab-bar')) {
            container.innerHTML = `
                <div class="mgr-sub-tab-bar">
                    <button class="mgr-sub-tab mgr-sub-tab-active" data-mgr-tab="missing">Missing</button>
                    <button class="mgr-sub-tab" data-mgr-tab="unused">Unused</button>
                    <button class="mgr-sub-tab" data-mgr-tab="payouts">Payouts</button>
                    <button class="mgr-sub-tab" data-mgr-tab="delays">Delays</button>
                </div>
                <div id="mgr-sub-content" class="mgr-sub-content"></div>
            `;
            container.querySelectorAll('.mgr-sub-tab').forEach(btn => {
                btn.addEventListener('click', () => {
                    mgr_currentSubTab = btn.dataset.mgrTab;
                    container.querySelectorAll('.mgr-sub-tab').forEach(t => t.classList.toggle('mgr-sub-tab-active', t.dataset.mgrTab === mgr_currentSubTab));
                    loadManagerSubTab(mgr_currentSubTab);
                });
            });
        }
        loadManagerSubTab(mgr_currentSubTab);
    }

    function loadManagerSubTab(tab) {
        if (tab === 'missing') mgr_loadMissingTab();
        else if (tab === 'unused') mgr_loadUnusedTab();
        else if (tab === 'payouts') mgr_loadPayoutsTab();
        else if (tab === 'delays') mgr_loadDelaysTab();
    }

    // ──────────────────────────────────────────────────────────────────
    //  DELAYS SUB-TAB — who's been flying while OCs sit ready
    // ──────────────────────────────────────────────────────────────────
    async function mgr_loadDelaysTab() {
        const content = document.getElementById('mgr-sub-content');
        content.innerHTML = '<div class="mgr-loading">Loading delay history…</div>';
        const apiKey = getApiKey();
        if (!apiKey) {
            content.innerHTML = '<div class="mgr-ok">Set your API key to see delay stats.</div>';
            return;
        }
        const days = 30;
        let resp;
        try {
            const r = await gmRequest(`${SERVER}/api/oc/delays?key=${encodeURIComponent(apiKey)}&days=${days}`);
            if (!r.ok) {
                const msg = r.data?.error || `HTTP ${r.status}`;
                content.innerHTML = `<div class="oc-error">Failed to load delays: ${msg}</div>`;
                return;
            }
            resp = r.data;
        } catch (e) {
            content.innerHTML = `<div class="oc-error">Failed to load delays: ${e.message || e}</div>`;
            return;
        }
        const members = Array.isArray(resp?.members) ? resp.members : [];
        if (members.length === 0) {
            content.innerHTML = `<div class="mgr-ok">No delays recorded in the last ${days}d. Either nobody's flown during a ready OC, or data is still being collected — delays only start logging when someone on the script opens the crimes tab while a flyer is in play.</div>`;
            return;
        }
        const fmtDur = (s) => {
            s = Math.floor(Number(s) || 0);
            if (s < 60) return `${s}s`;
            const m = Math.floor(s / 60), h = Math.floor(m / 60);
            if (h > 0) return `${h}h${(m % 60).toString().padStart(2,'0')}m`;
            return `${m}m`;
        };
        const fmtWhen = (ms) => {
            if (!ms) return '';
            try { return new Date(ms).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
            catch (_) { return ''; }
        };
        const escHtml = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        let html = `<div style="color:#9ca3af;font-size:10px;margin-bottom:6px;">Last ${days} days · ${members.length} member${members.length === 1 ? '' : 's'} flagged · ordered by total time held</div>`;
        html += `<table class="oc-table oc-table-tight"><thead><tr>
            <th>Member</th><th style="text-align:right;">Inc</th><th style="text-align:right;">Total</th><th>Recent</th>
        </tr></thead><tbody>`;
        for (const m of members) {
            const sorted = (m.crimes || [])
                .slice()
                .sort((a, b) => (b.completedAt || Date.now()) - (a.completedAt || Date.now()));
            const mr = sorted[0];
            const mrName = mr ? `${escHtml(mr.crimeName || 'Crime')}${mr.pending ? '*' : ''}` : '—';
            const mrWhen = mr ? (mr.pending ? 'in-flight' : escHtml(fmtWhen(mr.completedAt))) : '';
            const listText = sorted
                .map(c => `${c.crimeName || 'Crime'} · ${c.pending ? 'in-flight' : fmtWhen(c.completedAt)} · ${fmtDur(c.delayedSec)}`)
                .join('\n');
            html += `<tr>
                <td><a href="/profiles.php?XID=${escHtml(m.memberId)}" class="mgr-player-link">${escHtml(m.name)}</a> <span class="oc-member-id">[${escHtml(m.memberId)}]</span></td>
                <td style="text-align:right;"><b>${m.count}</b></td>
                <td style="text-align:right;"><span class="oc-total-click" data-list="${escHtml(listText)}" title="Show delayed OCs">${fmtDur(m.totalSec)}</span></td>
                <td><div class="oc-recent-1">${mrName}</div><div class="oc-recent-when">${mrWhen}</div></td>
            </tr>`;
        }
        html += `</tbody></table>`;
        content.innerHTML = html;
        content.querySelectorAll('.oc-total-click').forEach((el) => {
            el.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); mgr_showDelayCrimes(el); });
        });
    }

    function mgr_showDelayCrimes(el) {
        document.querySelectorAll('.oc-recent-pop').forEach(p => p.remove());
        const pop = document.createElement('div');
        pop.className = 'oc-recent-pop';
        pop.textContent = el.getAttribute('data-list') || '';
        document.body.appendChild(pop);
        const r = el.getBoundingClientRect();
        const left = Math.min(r.left, window.innerWidth - pop.offsetWidth - 8);
        pop.style.left = Math.max(8, left) + 'px';
        pop.style.top = (r.bottom + 4) + 'px';
        const close = (ev) => {
            if (ev.target !== el && !pop.contains(ev.target)) {
                pop.remove();
                document.removeEventListener('click', close, true);
            }
        };
        setTimeout(() => document.addEventListener('click', close, true), 0);
    }

    // v3.1.89: server-side mirror for the local mgr_haveItOverride map.
    // Records a (userID, itemID) override on the warboard server so it
    // outlasts page navigation AND syncs to other admins in the faction.
    // Idempotent — re-POSTing the same pair just refreshes the TTL.
    async function mgr_postMissingOverride(userID, itemID, crimeExpiresAtMs = null) {
        const apiKey = getApiKey();
        if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') return;
        const sessionKey = `${userID}:${itemID}`;
        if (mgr_haveItPosted.has(sessionKey)) return;   // already posted this session
        mgr_haveItPosted.add(sessionKey);
        try {
            await new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: `${SERVER}/api/oc/missing-override?key=${encodeURIComponent(apiKey)}`,
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({
                        key: apiKey,
                        userID: String(userID),
                        itemID: Number(itemID),
                        // v3.1.91: pass the crime's scheduled execution
                        // time so the server caps the 3-day TTL to that.
                        crimeExpiresAtMs: crimeExpiresAtMs || null,
                    }),
                    onload: () => resolve(),
                    onerror: () => resolve(),
                });
            });
        } catch (_) { /* non-fatal */ }
    }

    /** Fetch active server-side overrides and merge into the local
     *  mgr_haveItOverride map. Called on every Missing tab load so a
     *  fresh page sees overrides recorded earlier or by other admins. */
    async function mgr_fetchMissingOverrides() {
        const apiKey = getApiKey();
        if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') return;
        try {
            const r = await gmRequest(`${SERVER}/api/oc/missing-overrides?key=${encodeURIComponent(apiKey)}`);
            if (!r.ok) return;
            const list = Array.isArray(r.data?.overrides) ? r.data.overrides : [];
            for (const o of list) {
                const uid = String(o.userID);
                const iid = Number(o.itemID);
                if (!uid || !iid) continue;
                if (!mgr_haveItOverride.has(uid)) mgr_haveItOverride.set(uid, new Set());
                mgr_haveItOverride.get(uid).add(iid);
                // Don't bother re-POSTing entries we got from the server
                mgr_haveItPosted.add(`${uid}:${iid}`);
            }
        } catch (_) { /* non-fatal */ }
    }

    async function mgr_loadMissingTab() {
        const content = document.getElementById('mgr-sub-content');
        content.innerHTML = '<div class="mgr-loading">Loading OC data…</div>';
        try {
            await mgr_loadMembers();
            // v3.1.89: pull server-side overrides BEFORE the missing
            // list loads so they're already in mgr_haveItOverride by
            // the time we filter. Persists across navigation; shared
            // across admins.
            await mgr_fetchMissingOverrides();
            // v3.1.80: scrape Torn's React state / page DOM for actual
            // "user has the item bound" indicators. If a (user, item)
            // pair turns up here, override the API's is_available=false
            // automatically (no manual ✓ Has it click needed).
            const domBound = mgr_scrapeBoundItems();
            // v3.1.85 reverted: Success Chance shown in the DOM is the
            // member's CPR for that position, NOT a "slot is satisfied"
            // signal. CPR is independent of item state — a member with
            // 80% CPR shows 80% even when the item isn't bound.
            //
            // v3.1.87: real auto-detect via Torn's "no item" SVG icon
            // (fill="#ff794c"). Build two sets:
            //   1. domSlots — every slot currently rendered, keyed
            //      "userID:position(lowercase)". Tells us if we can
            //      see the slot at all in this scope.
            //   2. domMissingFlagged — slots whose icon shows the
            //      orange no-item SVG. Genuinely missing.
            // The Missing-list filter then drops any API entry where
            // the slot IS rendered AND ISN'T flagged — that's the
            // false-positive we've been chasing. Slots not in domSlots
            // (different scope) stay because we can't verify them
            // either way; default to API truth.
            const slotStates = mgr_scrapeSlotIconStates();
            const domSlots = new Set(
                slotStates
                    .filter(s => s.userID && s.position)
                    .map(s => `${s.userID}:${s.position.toLowerCase()}`)
            );
            const domMissingFlagged = mgr_scrapeSlotMissingIndicators();
            // Fail-safe: only trust the DOM "no-item icon" cross-check to
            // override the API when the scrape actually found at least one
            // missing indicator. If it found none (e.g. Torn changed the icon
            // colour/markup), treating absence-of-icon as "user has it" would
            // hide every genuinely-missing item — so fall back to API truth.
            const domScrapeWorking = domMissingFlagged.size > 0;

            let domFilteredCount = 0;
            const missing = (await mgr_getMissingOCItems()).filter(m => {
                // Hide rows we just loaned (avoids re-showing during the
                // few seconds before Torn's API reflects the loan).
                if (mgr_recentlyLoaned.get(String(m.userID))?.has(m.itemID)) return false;
                const posKey = `${m.userID}:${String(m.position||'').toLowerCase()}`;
                // v3.2.56: the live orange "no-item" icon is authoritative. If
                // Torn renders it for this slot RIGHT NOW, the member genuinely
                // lacks the item — never hide it behind a (possibly stale) "has
                // it" override or bound-scrape. Fixes a stuck override silently
                // hiding a real missing item.
                if (domMissingFlagged.has(posKey)) return true;
                // No live missing-icon → trust the "has it" signals.
                if (mgr_haveItOverride.get(String(m.userID))?.has(m.itemID)) return false;
                if (domBound.has(`${m.userID}:${m.itemID}`)) return false;
                // v3.1.87: slot rendered with no missing-icon = API false
                // positive (user has it, API lagging). Suppress for the session
                // only — do NOT post a sticky server override; a transient
                // scrape miss must not persist a wrong "has it" for 3 days
                // (that was the bug that hid a genuinely-missing item).
                if (domScrapeWorking && domSlots.has(posKey)) {
                    domFilteredCount++;
                    if (!mgr_haveItOverride.has(String(m.userID))) mgr_haveItOverride.set(String(m.userID), new Set());
                    mgr_haveItOverride.get(String(m.userID)).add(m.itemID);
                    return false;
                }
                return true;
            });
            if (domFilteredCount > 0) {
                console.log(`[OC Mgr] DOM auto-filter: hid ${domFilteredCount} false-positive Missing entries`);
            }
            try {
                const _raw = await mgr_getMissingOCItems();
                const _hv = (uid, iid) => !!(mgr_haveItOverride.get(String(uid)) && mgr_haveItOverride.get(String(uid)).has(iid));
                const _rl = (uid, iid) => !!(mgr_recentlyLoaned.get(String(uid)) && mgr_recentlyLoaned.get(String(uid)).has(iid));
                GM_xmlhttpRequest({
                    method: 'POST', url: 'https://tornwar.com/api/debug/client-log',
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({ tag: 'oc-missing-diag', data: {
                        v: SCRIPT_VERSION, rawCount: _raw.length, finalCount: missing.length,
                        domBoundSize: domBound.size, domSlotsSize: domSlots.size,
                        domMissingFlaggedSize: domMissingFlagged.size, domScrapeWorking,
                        raw: _raw.map(m => ({ u: m.userID, i: m.itemID, c: m.crimeName, p: m.position,
                            bound: domBound.has(`${m.userID}:${m.itemID}`),
                            slotRendered: domSlots.has(`${m.userID}:${String(m.position || '').toLowerCase()}`),
                            iconFlagged: domMissingFlagged.has(`${m.userID}:${String(m.position || '').toLowerCase()}`),
                            haveIt: _hv(m.userID, m.itemID), loaned: _rl(m.userID, m.itemID) }))
                    } })
                });
            } catch (_) {}
            if (!missing.length) { content.innerHTML = '<div class="mgr-ok">✓ All OC items allocated</div>'; return; }
            await mgr_resolveItemNames(missing.map(m => m.itemID));
            let html = '';
            for (const m of missing) {
                const itemName = mgr_getItemName(m.itemID) || `Item #${m.itemID}`;
                html += `
                    <div class="mgr-card">
                        <button class="mgr-haveit-x mgr-haveit-btn" data-itemid="${m.itemID}" data-userid="${mgr_esc(m.userID)}" data-crime-expires="${m.crimeExpiresAtMs || ''}" title="Already has it — hide this row" aria-label="Already has it">✓</button>
                        <div class="mgr-card-header"><span class="mgr-crime-name">${mgr_esc(m.crimeName)}</span><span class="mgr-pos-tag" style="margin-right:24px;">${mgr_esc(m.position)}</span></div>
                        <div class="mgr-card-body">
                            <div class="mgr-item-row"><span class="mgr-label">Item</span><span class="mgr-value" style="font-weight:600;">${mgr_esc(itemName)}</span></div>
                            <div class="mgr-player-row"><span class="mgr-label">Player</span><a href="/profiles.php?XID=${mgr_esc(m.userID)}" class="mgr-player-link">${mgr_esc(m.userName)}</a></div>
                        </div>
                        <button class="mgr-action-btn mgr-btn-loan mgr-loan-btn" data-itemid="${m.itemID}" data-userid="${mgr_esc(m.userID)}" data-username="${mgr_esc(m.userName)}">${(location.hash.includes('tab=armoury') || location.hash.includes('tab=armory')) ? 'Loan Item' : 'Go to Armoury'}</button>
                    </div>
                `;
            }
            content.innerHTML = html;
            content.querySelectorAll('.mgr-loan-btn').forEach(btn => {
                btn.onclick = async () => {
                    if (btn.dataset.loaning === 'true' || btn.disabled) return;
                    const onArmory = location.hash.includes('tab=armoury') || location.hash.includes('tab=armory');
                    if (!onArmory) {
                        // Step 1: navigate to armory tab first
                        location.hash = '#/tab=armoury';
                        content.querySelectorAll('.mgr-loan-btn').forEach(b => { b.textContent = 'Loan Item'; });
                        return;
                    }
                    // Step 2: on armory tab, perform loan
                    btn.dataset.loaning = 'true'; btn.disabled = true; btn.textContent = 'Refreshing…';
                    const itemID = parseInt(btn.dataset.itemid, 10);
                    const userID = parseInt(btn.dataset.userid, 10);
                    const userName = btn.dataset.username;
                    let loanSucceeded = false;
                    try {
                        const armoryID = await mgr_prepareArmouryForItem(itemID);
                        if (!armoryID) {
                            btn.textContent = 'No stock'; btn.classList.add('mgr-btn-warning');
                            return;
                        }
                        btn.textContent = 'Loaning…'; await mgr_loanPreparedItem({ userID, userName });
                        btn.textContent = '✓ Loaned'; btn.classList.add('mgr-btn-success');
                        loanSucceeded = true;
                        // Fade the card out and remove from the DOM so the
                        // Missing list reflects the change immediately. Prior
                        // behaviour left the card visible until the next full
                        // refresh, making it look like the loan hadn't landed
                        // for up to ~60s (API cache + manual refresh lag).
                        const card = btn.closest('.mgr-card');
                        if (card) {
                            card.style.transition = 'opacity 0.6s ease-out, max-height 0.6s ease-out, margin 0.6s ease-out, padding 0.6s ease-out';
                            setTimeout(() => {
                                card.style.opacity = '0';
                                card.style.maxHeight = card.offsetHeight + 'px';
                                // Collapse the space it occupied after fade.
                                requestAnimationFrame(() => {
                                    card.style.maxHeight = '0';
                                    card.style.marginTop = '0';
                                    card.style.marginBottom = '0';
                                    card.style.paddingTop = '0';
                                    card.style.paddingBottom = '0';
                                });
                                setTimeout(() => {
                                    card.remove();
                                    // If that was the last card, show the
                                    // "all allocated" message without waiting
                                    // for a full refresh.
                                    const remaining = content.querySelectorAll('.mgr-card').length;
                                    if (remaining === 0) {
                                        content.innerHTML = '<div class="mgr-ok">✓ All OC items allocated</div>';
                                    }
                                }, 650);
                            }, 800);
                        }
                    } catch (e) {
                        btn.textContent = '? Check'; btn.classList.add('mgr-btn-warning');
                        console.error('[OC Mgr] Loan error:', e);
                    } finally {
                        // Success state stays locked (paired with mgr_recentlyLoaned tracking).
                        // Every other outcome (no stock / error) resets so the user can retry.
                        if (!loanSucceeded) {
                            setTimeout(() => {
                                btn.dataset.loaning = 'false'; btn.disabled = false;
                                btn.textContent = 'Go to Armoury';
                                btn.classList.remove('mgr-btn-warning');
                            }, 3000);
                        }
                    }
                };
            });
            // v3.1.79: "✓ Has it" override. Stamps the (user, item) pair
            // into mgr_haveItOverride so subsequent renders skip the row,
            // then fades + collapses the card the same way a successful
            // loan does.
            content.querySelectorAll('.mgr-haveit-btn').forEach(btn => {
                btn.onclick = () => {
                    const itemID = Number(btn.dataset.itemid);
                    const userID = String(btn.dataset.userid);
                    const crimeExpires = Number(btn.dataset.crimeExpires) || null;
                    if (!mgr_haveItOverride.has(userID)) mgr_haveItOverride.set(userID, new Set());
                    mgr_haveItOverride.get(userID).add(itemID);
                    // v3.1.89: persist this manual override server-side.
                    // v3.1.91: pass the crime's expires_at so the
                    // 3-day TTL caps to crime execution time.
                    mgr_postMissingOverride(userID, itemID, crimeExpires);
                    btn.disabled = true;
                    btn.textContent = '✓ Hidden';
                    const card = btn.closest('.mgr-card');
                    if (card) {
                        card.style.transition = 'opacity 0.4s ease-out, max-height 0.4s ease-out, margin 0.4s ease-out, padding 0.4s ease-out';
                        setTimeout(() => {
                            card.style.opacity = '0';
                            card.style.maxHeight = card.offsetHeight + 'px';
                            requestAnimationFrame(() => {
                                card.style.maxHeight = '0';
                                card.style.marginTop = '0';
                                card.style.marginBottom = '0';
                                card.style.paddingTop = '0';
                                card.style.paddingBottom = '0';
                            });
                            setTimeout(() => {
                                card.remove();
                                const remaining = content.querySelectorAll('.mgr-card').length;
                                if (remaining === 0) {
                                    content.innerHTML = '<div class="mgr-ok">✓ All OC items allocated</div>';
                                }
                            }, 450);
                        }, 200);
                    }
                };
            });
        } catch (e) { content.innerHTML = `<div class="mgr-error">${e.message}</div>`; }
    }

    async function mgr_loadUnusedTab() {
        const content = document.getElementById('mgr-sub-content');
        content.innerHTML = '<div class="mgr-loading">Scanning armory…</div>';
        try {
            await mgr_loadMembers();
            const [armoryItems, neededByUser] = await Promise.all([mgr_fetchAllArmoryItemsAPI(), mgr_getAllOCItemRequirements()]);
            // Merge recently loaned items to avoid showing them as unused due to API lag
            mgr_recentlyLoaned.forEach((items, uid) => {
                if (!neededByUser.has(uid)) neededByUser.set(uid, new Set());
                items.forEach(iid => neededByUser.get(uid).add(iid));
            });
            // Build set of ALL item IDs used in any OC (so we only show OC-relevant items)
            const allOcItemIDs = new Set();
            neededByUser.forEach(items => items.forEach(iid => allOcItemIDs.add(iid)));

            const unused = [];
            for (const entry of armoryItems) {
                if (entry.armoryCategory === 'temporary') continue;
                // Only show items that are actually used in OCs
                if (!allOcItemIDs.has(entry.itemID)) continue;
                // API returns loaned_to as comma-separated user IDs
                if (!entry.loaned_to) continue;
                const loanedUsers = String(entry.loaned_to).split(',').map(s => s.trim()).filter(Boolean);
                for (const uid of loanedUsers) {
                    const needed = neededByUser.get(uid);
                    if (!needed || !needed.has(entry.itemID)) {
                        unused.push({
                            itemID: entry.itemID, itemName: entry.name || mgr_getItemName(entry.itemID) || `Item #${entry.itemID}`,
                            armoryCategory: entry.armoryCategory || 'utilities',
                            userID: uid, userName: mgr_memberNameMap.get(uid) || `Unknown [${uid}]`
                        });
                    }
                }
            }
            if (!unused.length) { content.innerHTML = '<div class="mgr-ok">✓ No unused loaned items</div>'; return; }
            let html = '<div style="margin-bottom:10px;font-size:11px;color:#6b7280;text-align:center;">Loaned but not needed for any OC:</div>';
            for (const u of unused) {
                html += `
                    <div class="mgr-card">
                        <div class="mgr-card-body">
                            <div class="mgr-item-row"><span class="mgr-label">Item</span><span class="mgr-value" style="font-weight:600;">${mgr_esc(u.itemName)}</span></div>
                            <div class="mgr-player-row"><span class="mgr-label">Player</span><a href="/profiles.php?XID=${mgr_esc(u.userID)}" class="mgr-player-link">${mgr_esc(u.userName)}</a></div>
                        </div>
                        <button class="mgr-action-btn mgr-btn-retrieve mgr-retrieve-btn" data-itemid="${u.itemID}" data-userid="${mgr_esc(u.userID)}" data-username="${mgr_esc(u.userName)}" data-category="${mgr_esc(u.armoryCategory)}">${(location.hash.includes('tab=armoury') || location.hash.includes('tab=armory')) ? 'Retrieve Item' : 'Go to Armoury'}</button>
                    </div>
                `;
            }
            content.innerHTML = html;
            content.querySelectorAll('.mgr-retrieve-btn').forEach(btn => {
                btn.onclick = async () => {
                    if (btn.dataset.retrieving === 'true' || btn.disabled) return;
                    const onArmory = location.hash.includes('tab=armoury') || location.hash.includes('tab=armory');
                    if (!onArmory) {
                        // Step 1: navigate to armory tab first
                        location.hash = '#/tab=armoury';
                        content.querySelectorAll('.mgr-retrieve-btn').forEach(b => { b.textContent = 'Retrieve Item'; });
                        return;
                    }
                    // Step 2: on armory tab, perform retrieve
                    btn.dataset.retrieving = 'true'; btn.disabled = true; btn.textContent = 'Finding item…';
                    try {
                        const hintCat = btn.dataset.category || 'utilities';
                        const itemID = parseInt(btn.dataset.itemid, 10);
                        const userID = parseInt(btn.dataset.userid, 10);
                        // Sweep order: try the cached hint first (fast),
                        // then every other loanable bucket. Torn's
                        // /v2/faction selection name (utilities / armor /
                        // …) doesn't always match the page-AJAX `type`,
                        // and after Torn's auth refactor (changelog
                        // 21–28 Apr) loaned-entry user keys flip between
                        // user.userID and user.id, so a tight single-cat
                        // search now misses items it used to find.
                        const sweep = ['utilities','weapons','armor','armour','medical','boosters','drugs','clothing'];
                        const categoriesToTry = Array.from(new Set([hintCat, ...(hintCat === 'armor' ? ['armour'] : []), ...sweep]));
                        let armoryID = null;
                        let resolvedCat = hintCat;
                        const reasons = [];
                        for (const c of categoriesToTry) {
                            const rfcv = mgr_getRfcvToken();
                            if (!rfcv) throw new Error('Missing RFCV cookie — refresh the page and try again.');
                            let start = 0;
                            let pages = 0;
                            let httpFail = '';
                            while (start < 1000 && !armoryID) {
                                const body = new URLSearchParams({ step: 'armouryTabContent', type: c, start: String(start), ajax: 'true' });
                                const res = await fetch(`https://www.torn.com/factions.php?rfcv=${rfcv}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest' }, body, credentials: 'same-origin' });
                                if (!res.ok) { httpFail = `http-${res.status}`; break; }
                                let data;
                                try { data = await res.json(); }
                                catch { httpFail = 'parse-fail'; break; }
                                if (!data?.items) { httpFail = 'no-items-key'; break; }
                                const itemsArr = Array.isArray(data.items) ? data.items : Object.values(data.items);
                                if (itemsArr.length === 0) break;
                                pages += 1;
                                for (const entry of itemsArr) {
                                    if (Number(entry.itemID) !== itemID) continue;
                                    // Accept either user.userID OR user.id —
                                    // Torn ships both shapes after this
                                    // week's auth refactor.
                                    const uid = entry.user && (entry.user.userID ?? entry.user.id);
                                    if (uid !== undefined && String(uid) === String(userID) && entry.armoryID) {
                                        armoryID = entry.armoryID;
                                        resolvedCat = c;
                                        break;
                                    }
                                }
                                if (itemsArr.length < 50) break;
                                start += 50;
                            }
                            if (armoryID) break;
                            reasons.push(`${c}:${httpFail || (pages === 0 ? 'empty-bucket' : `no-match-on-${pages}pg`)}`);
                        }
                        if (!armoryID) {
                            console.warn('[OC Mgr] Retrieve miss for itemID', itemID, 'user', userID, 'hint', hintCat, '— bucket reasons:', reasons.join(', '));
                            throw new Error(`Not in armoury [${reasons.slice(0, 3).join(', ')}]`);
                        }
                        btn.textContent = 'Retrieving…';
                        const postType = ARMORY_TAB_TO_POST_TYPE[resolvedCat] || 'Tool';
                        await mgr_retrieveItem({ armoryID, itemID, userID, userName: btn.dataset.username, postType });
                        btn.textContent = '✓ Retrieved'; btn.classList.add('mgr-btn-success');
                    } catch (e) {
                        // Surface the actual reason instead of just "Error"
                        // — the silent catch was the reason every retrieve
                        // failure read identically. Tooltip exposes the
                        // full message; console.warn keeps the stack.
                        console.warn('[OC Mgr] Retrieve failed:', e);
                        btn.textContent = (e?.message || 'Error').slice(0, 28);
                        btn.title = e?.message || String(e);
                        btn.classList.add('mgr-btn-warning');
                        btn.disabled = false; btn.dataset.retrieving = 'false';
                    }
                };
            });
        } catch (e) { content.innerHTML = `<div class="mgr-error">Error: ${e.message}</div>`; }
    }

    async function mgr_loadPayoutsTab() {
        const content = document.getElementById('mgr-sub-content');
        content.innerHTML = '<div class="mgr-loading">Checking completions…</div>';
        try {
            const unpaid = await mgr_getUnpaidCompletedCrimes();
            if (!unpaid.length) { content.innerHTML = '<div class="mgr-ok">✓ All OCs paid out</div>'; return; }
            let totalMoney = 0, items = 0;
            unpaid.forEach(c => { totalMoney += c.money; if (c.hasItems) items++; });
            let html = `
                <div class="mgr-summary-box">
                    <div class="mgr-summary-label">Summary</div>
                    ${totalMoney > 0 ? `<div class="mgr-summary-amount">$${mgr_formatNumber(totalMoney)}</div>` : ''}
                    <div class="mgr-summary-detail">${unpaid.length} Unpaid OCs${items > 0 ? ` • ${items} with Items` : ''}</div>
                    <a href="https://www.torn.com/factions.php?step=your#/tab=crimes&subTab=completed" target="_blank" class="mgr-payout-link">Open Payouts Page</a>
                </div>
            `;
            for (const c of unpaid) {
                const ageSec = Math.floor(Date.now() / 1000) - c.executedAt;
                const ageDays = Math.floor(ageSec / 86400);
                const ageColor = ageDays >= 7 ? '#f87171' : (ageDays >= 3 ? '#f4a261' : '#6b7280');
                html += `
                    <a href="https://www.torn.com/factions.php?step=your#/tab=crimes&subTab=completed" target="_blank" class="mgr-payout-card">
                        <div class="mgr-card" style="padding:8px 10px;">
                            <div class="mgr-card-header"><span class="mgr-crime-name" style="font-size:11px;">${c.name}</span><span style="font-size:10px;font-weight:700;color:${ageColor};">${ageDays > 0 ? ageDays + 'd' : Math.floor(ageSec / 3600) + 'h'}</span></div>
                            <div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-size:12px;color:#74c69d;font-weight:700;">${c.money > 0 ? '$' + mgr_formatNumber(c.money) : ''}</span><span style="font-size:10px;color:#6b7280;">${c.hasItems ? '<span style="color:#74c69d;">Items</span>' : ''}${c.payoutPct ? ` ${c.payoutPct}%` : ''}</span></div>
                        </div>
                    </a>
                `;
            }
            content.innerHTML = html;
        } catch (e) { content.innerHTML = `<div class="mgr-error">Error: ${e.message}</div>`; }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  MAIN
    // ═══════════════════════════════════════════════════════════════════════
    async function runAnalysis() {
        const apiKey = getApiKey();
        if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
            document.getElementById('oc-settings-panel').style.display = 'block';
            populateSettings();
            document.getElementById('oc-tab-profile').innerHTML = `<p class="oc-error">⚠ Enter your Torn API key in Settings above.</p>`;
            setStatus('API key not configured.');
            return;
        }

        const refreshBtn = document.getElementById('oc-spawn-refresh');
        refreshBtn.disabled = true;
        document.getElementById('oc-tab-profile').innerHTML = '';
        document.getElementById('oc-tab-admin').innerHTML   = '';

        // Force a fresh scope read at the start of every analysis so the
        // strip never shows stale data just because the user hasn't visited
        // the crimes tab in a while. Response lands asynchronously via the
        // AJAX interceptor and updates CONFIG.SCOPE + _scopeUpdatedAt.
        refreshScopeFromTorn();

        try {
            // Fetch faction-wide settings
            setStatus('Loading settings…');
            const srvSettings = await fetchFactionSettings(apiKey);
            if (srvSettings) {
                CONFIG.ACTIVE_DAYS             = srvSettings.active_days;
                CONFIG.FORECAST_HOURS          = srvSettings.forecast_hours;
                CONFIG.MINCPR                  = srvSettings.mincpr;
                CONFIG.CPR_BOOST               = srvSettings.cpr_boost;
                CONFIG.CPR_LOOKBACK_DAYS       = srvSettings.lookback_days;
                CONFIG.HIGH_WEIGHT_THRESHOLD   = srvSettings.high_weight_pct      ?? CONFIG.HIGH_WEIGHT_THRESHOLD;
                CONFIG.HIGH_WEIGHT_MIN_CPR     = srvSettings.high_weight_mincpr   ?? CONFIG.HIGH_WEIGHT_MIN_CPR;
                // v3.1.48: presence flag + last4 only — full FFS key stays server-side.
                CONFIG._FFS_KEY_SET   = !!srvSettings.ffs_key_set;
                CONFIG._FFS_KEY_LAST4 = String(srvSettings.ffs_key_last4 || '');
                // Only apply server-side scope if we don't have a fresher
                // auto-detected value from the DOM reader. Otherwise every
                // refresh would overwrite a fresh Recruiting-tab read (e.g.
                // 14) with the last-saved stored value (e.g. 11).
                if (!CONFIG._scopeAutoDetected) {
                    CONFIG.SCOPE               = srvSettings.scope;
                }

                // Engine toggles
                // v3.1.10: Respect server setting instead of force-false, so
                // the Engines tab checkbox actually persists after a reload.
                // Still defaults off everywhere (local GM_getValue default = false),
                // must be consciously enabled per user.
                CONFIG.ENGINE_SLOT_OPTIMIZER   = srvSettings.engine_slot_optimizer   ?? CONFIG.ENGINE_SLOT_OPTIMIZER;
                CONFIG.ENGINE_CPR_FORECASTER   = srvSettings.engine_cpr_forecaster   ?? CONFIG.ENGINE_CPR_FORECASTER;
                CONFIG.ENGINE_FAILURE_RISK     = srvSettings.engine_failure_risk     ?? CONFIG.ENGINE_FAILURE_RISK;

                CONFIG.ENGINE_MEMBER_RELIABILITY = srvSettings.engine_member_reliability ?? CONFIG.ENGINE_MEMBER_RELIABILITY;

                CONFIG.ENGINE_MEMBER_PROJECTOR = srvSettings.engine_member_projector ?? CONFIG.ENGINE_MEMBER_PROJECTOR;
                CONFIG.ENGINE_AUTO_DISPATCHER  = srvSettings.engine_auto_dispatcher  ?? CONFIG.ENGINE_AUTO_DISPATCHER;

                // Sync local storage with server values
                GM_setValue('cfg_active_days',         CONFIG.ACTIVE_DAYS);
                GM_setValue('cfg_forecast_hours',      CONFIG.FORECAST_HOURS);
                GM_setValue('cfg_mincpr',              CONFIG.MINCPR);
                GM_setValue('cfg_cpr_boost',           CONFIG.CPR_BOOST);
                GM_setValue('cfg_lookback_days',       CONFIG.CPR_LOOKBACK_DAYS);
                GM_setValue('cfg_high_weight_pct',     CONFIG.HIGH_WEIGHT_THRESHOLD);
                GM_setValue('cfg_high_weight_mincpr',  CONFIG.HIGH_WEIGHT_MIN_CPR);
                GM_setValue('cfg_scope',               CONFIG.SCOPE);
                GM_setValue('eng_slot_optimizer',       CONFIG.ENGINE_SLOT_OPTIMIZER);
                        GM_setValue('eng_cpr_forecaster',       CONFIG.ENGINE_CPR_FORECASTER);
                GM_setValue('eng_failure_risk',         CONFIG.ENGINE_FAILURE_RISK);
                GM_setValue('eng_member_reliability',   CONFIG.ENGINE_MEMBER_RELIABILITY);
                GM_setValue('eng_member_projector',     CONFIG.ENGINE_MEMBER_PROJECTOR);
                GM_setValue('eng_auto_dispatcher',      CONFIG.ENGINE_AUTO_DISPATCHER);

                populateSettings();
                settingsReady = true;
                const saveBtn = document.getElementById('oc-spawn-cfg-save');
                if (saveBtn) saveBtn.disabled = false;
            }

            // Fetch OC data from server (with auto-retry on transient errors)
            setStatus('Fetching OC data…');
            let members, availableCrimes, rawCprCache, viewer, weights, serverResp, engines;
            const MAX_RETRIES = 3;
            const RETRY_DELAYS = [1000, 2000, 3000]; // 1s, 2s, 3s (reduced from 5s, 10s, 20s for faster responsiveness)
            let fetchSuccess = false;
            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                try {
                    if (attempt > 0) {
                        setStatus(`Retrying… (${attempt}/${MAX_RETRIES})`);
                        _injectDispatcherStatus('🔄', `Retrying… (${attempt}/${MAX_RETRIES})`, '#f59e0b');
                    }
                    serverResp = await fetchServerOcData(apiKey);
                    ({ members, availableCrimes, cprCache: rawCprCache, viewer, weights, engines } = serverResp);
                    // v3.2.13: stash for live-success poller — needs the
                    // crime list (with IDs + slot assignments) to resolve
                    // each scraped slot to its parent crime ID.
                    _lastAvailableCrimes = Array.isArray(availableCrimes) ? availableCrimes : Object.values(availableCrimes || {});
                    // v3.1.38: stash hitRates so render functions can use them.
                    _lastHitRates = serverResp.hitRates || {};
                    // v3.1.49: stash per-member pending delays for the admin banner.
                    _lastPendingDelays = serverResp.pendingDelays || {};
                    _lastRecentCompletions = Array.isArray(serverResp.recentCompletions)
                        ? serverResp.recentCompletions : [];
                    engines = engines || {};
                    fetchSuccess = true;
                    break;
                } catch (err) {
                    if (err.status === 403) {
                        document.getElementById('oc-tab-profile').innerHTML =
                            `<p class="oc-error">⛔ ${err.message}</p>`;
                        setStatus('Access denied.');
                        _injectDispatcherSubscribePrompt(err.message);
                        return;
                    }
                    if (err.status === 429 || attempt >= MAX_RETRIES) throw err;
                    // Transient error — wait and retry. 503 is Torn-side
                    // (gateway timeout, backend slow); show a friendlier
                    // hint than the generic "Retrying" so the user knows
                    // it's not their key / their faction.
                    const delay = RETRY_DELAYS[attempt] || 20000;
                    if (err.status === 503 || err.transient) {
                        setStatus(`⏳ Torn API is slow — retrying… (${attempt + 1}/${MAX_RETRIES})`);
                        _injectDispatcherStatus('⏳', 'Torn slow', '#f59e0b');
                    }
                    console.warn(`[OC Spawn] Fetch attempt ${attempt + 1} failed: ${err.message}. Retrying in ${delay/1000}s…`);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
            if (!fetchSuccess) throw new Error('Torn API is having issues right now — please refresh in a minute.');

            // No faction key cached yet — show actionable message based on Torn's error reason
            if (serverResp.pendingFactionData) {
                const reason = (serverResp.errorReason || '').toLowerCase();
                let icon = '\u23f3';
                let title = 'Waiting for faction data';
                let body = 'Your API key doesn\'t have faction access.<br>OC data will appear once a member with faction API access loads the panel.';
                if (reason.includes('id-entity')) {
                    icon = '\u26a0\ufe0f';
                    title = 'Key doesn\'t match this faction';
                    body = 'The Torn API says the key\'s player isn\'t in this faction.<br>If you recently left or rejoined, generate a fresh <b>Limited</b> key at <a href="https://www.torn.com/preferences.php#tab=api" target="_blank" style="color:#74c69d;">preferences \u2192 API</a> and paste it into Settings.';
                } else if (reason.includes('access level')) {
                    icon = '\ud83d\udd10';
                    title = 'API key access level too low';
                    body = 'You\'re using a <b>Public</b> key. OC data needs at least <b>Limited Access</b>.<br>Generate a new key at <a href="https://www.torn.com/preferences.php#tab=api" target="_blank" style="color:#74c69d;">preferences \u2192 API</a> with Limited Access (or higher) and re-enter it in Settings.';
                } else if (serverResp.errorReason) {
                    icon = '\u26a0\ufe0f';
                    title = 'Faction data unavailable';
                    body = `Torn API said: <code style="color:#f4a261;">${serverResp.errorReason.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</code><br>OC data will appear once a member with a working key loads the panel.`;
                }
                document.getElementById('oc-tab-profile').innerHTML =
                    `<div style="text-align:center;padding:24px 16px;color:#9ca3af;">`
                    + `<div style="font-size:18px;margin-bottom:8px;">${icon}</div>`
                    + `<div style="font-size:12px;font-weight:600;color:#f3f4f6;margin-bottom:4px;">${title}</div>`
                    + `<div style="font-size:11px;line-height:1.5;">${body}</div>`
                    + `</div>`;
                setStatus(serverResp.errorReason ? 'API key issue — see Profile tab.' : 'Waiting for faction data.');
                return;
            }

            // Re-apply user's MINCPR/CPR_BOOST to joinable
            const cprCache = {};
            for (const [uid, d] of Object.entries(rawCprCache || {})) {
                // Per-level CPR: find highest level where member actually performs well
                const levelCprs = {};
                for (const e of (d.entries || [])) {
                    if (!levelCprs[e.diff]) levelCprs[e.diff] = { sum: 0, count: 0 };
                    levelCprs[e.diff].sum += e.rate;
                    levelCprs[e.diff].count += 1;
                }
                let effectiveTop = d.highestLevel || 0;
                for (let lvl = effectiveTop; lvl >= 1; lvl--) {
                    const lc = levelCprs[lvl];
                    if (!lc) continue;
                    if ((lc.sum / lc.count) >= CONFIG.MINCPR) { effectiveTop = lvl; break; }
                }
                cprCache[uid] = {
                    ...d,
                    effectiveTop,
                    joinable: d.cpr >= CONFIG.MINCPR + CONFIG.CPR_BOOST
                        ? Math.min(effectiveTop + 1, 10) : effectiveTop,
                };
            }

            setStatus('Analysing…');
            const slotMap               = countOpenSlots(availableCrimes);
            const { eligible, skipped } = processMembers(members, availableCrimes, cprCache);
            const scopeProjection        = projectScope(CONFIG.SCOPE, eligible);
            lastScopeProjection         = scopeProjection; // cache for tooltip
            const recs                  = buildRecommendations(eligible, slotMap, scopeProjection);

            // Vault data: balance for everyone (form needs it), but the
            // pending-request list only for admins (they're the only ones
            // who can see it in the UI).
            const isViewerAdmin = viewer?.hasFactionAccess === true || String(viewer?.playerId) === '137558';
            [S.vaultRequests, S.vaultBalance] = await Promise.all([
                isViewerAdmin ? fetchVaultRequests(apiKey) : Promise.resolve([]),
                fetchVaultBalance(apiKey),
            ]);

            renderBody(recs, eligible, skipped, scopeProjection, viewer, availableCrimes, weights, engines, members, cprCache, _lastPendingDelays);
            bindVaultRequestHandlers(apiKey, viewer);

            // Tab visibility: Admin/Manager/Metrics/Engines are gated together
            // on canViewAdmin (dev OR viewer's faction position is in the
            // admin-roles list). Non-admins see only the My OC tab — no stale
            // "requires API access" message, just hidden tabs entirely.
            const tabBar      = document.getElementById('oc-tab-bar');
            const adminTab    = document.getElementById('oc-admin-tab');
            const managerTab  = document.getElementById('oc-manager-tab');
            const coachingTab = document.getElementById('oc-coaching-tab');
            const metricsTab  = document.getElementById('oc-metrics-tab');
            const enginesTab  = document.getElementById('oc-engines-tab');
            const canAdmin    = canViewAdmin(viewer);
            tabBar.style.display = 'flex';
            adminTab.style.display    = canAdmin ? '' : 'none';
            managerTab.style.display  = canAdmin ? '' : 'none';
            // v3.2.21: Coaching tab UI hidden per user request — the
            // CPR-tooltip per-checkpoint heatmap (which uses the same
            // byCheckpoint data) is what admins actually use; the tab
            // itself was redundant. Completed-tab XHR/fetch scraping
            // (line ~1054 onwards) keeps populating the data so the
            // tooltip + failure-risk's checkpoint-history branch still
            // work end-to-end.
            if (coachingTab) coachingTab.style.display = 'none';
            if (metricsTab)  metricsTab.style.display  = canAdmin ? '' : 'none';
            if (enginesTab)  enginesTab.style.display  = canAdmin ? '' : 'none';

            // Stash data needed by the Coaching tab (rendered on demand
            // when the user clicks the tab — not on every refresh — so
            // the cached snapshot must be kept here).
            _coachingSnapshot = { cprCache, members };

            // Render Engines tab content
            document.getElementById('oc-tab-engines').innerHTML = renderEnginesTab(engines, viewer, availableCrimes, cprCache);
            // v3.1.32: if Outcome EV engine is on (uses legacy slot-optimizer
            // flag), kick off per-OC probability fetches against our
            // server proxy. Rows fill in as /api/oc/outcome responses land.
            if (engines && engines.slotOptimizer) {
                scheduleOutcomeEvFetches(availableCrimes, cprCache);
            }

            // Render Auto-Dispatcher banner (personalized, above all tabs)
            if (engines && engines.autoDispatcher) {
                renderDispatcherBanner(engines.autoDispatcher);
            } else {
                const _dispApiKey = getApiKey();
                if (CONFIG.ENGINE_AUTO_DISPATCHER && _dispApiKey && _dispApiKey !== "YOUR_API_KEY_HERE") {
                    // Engine is on but no data came back -- show waiting state
                    renderDispatcherBanner(null);
                } else {
                    const dBanner = document.getElementById('oc-dispatcher-banner');
                    if (dBanner) dBanner.style.display = 'none';
                    const tornBanner = document.getElementById('oc-dispatcher-torn-banner');
                    if (tornBanner) tornBanner.remove();
                }
            }

            // Lock admin tab content if viewer can't admin
            const settingsGear = document.getElementById('oc-spawn-settings');
            // Gear always visible to dev; visible to others only if they can view admin
            if (settingsGear) settingsGear.style.display = ''; // always show — API key field is accessible to everyone
            // Show config section only for admins (prevents non-admins from pushing default settings)
            const cfgSection = document.getElementById('oc-cfg-section');
            if (cfgSection) cfgSection.style.display = (isDev(viewer) || canViewAdmin(viewer)) ? '' : 'none';
            if (canAdmin) {
                let lastTab = GM_getValue('oc_last_tab', 'admin');
                // v3.2.21: 'coaching' removed from valid tabs since the
                // tab UI is hidden. Anyone whose saved tab was coaching
                // gets bumped to admin instead.
                const validTabs = ['profile', 'admin', 'manager', 'metrics', 'engines'];
                if (lastTab === 'coaching') lastTab = 'admin';
                switchTab(validTabs.includes(lastTab) ? lastTab : 'admin');
            } else {
                switchTab('profile');
            }

            setStatus(`Last updated: ${new Date().toLocaleTimeString()} · ${normArr(members).length} members`);
            updateSubTimer(viewer);

        } catch (err) {
            const hint = /504|503|502|timeout/i.test(err.message)
                ? 'Torn API timed out — try refreshing in a moment.'
                : /forbidden|faction api/i.test(err.message)
                ? ''
                : 'Something went wrong — try refreshing.';
            document.getElementById('oc-tab-profile').innerHTML =
                `<p class="oc-error">Error: ${err.message}</p>
                 <p style="color:#6b7280;font-size:11px;">${hint}</p>`;
            setStatus(`Error: ${err.message}`);
            // Update dispatcher banner so it doesn't stay stuck on loading
            _injectDispatcherStatus('⚠️', 'Error loading — click Refresh to retry', '#ef4444');
            console.error('[OC Spawn]', err);
        } finally {
            // Refresh button re-enables via cooldown timer (startRefreshCooldown)
        }
    }

    // Start ASAP interception
    setupAjaxInterceptor();

    // Inject dispatcher loading banner early (before data arrives)
    // Retry a few times since Torn's DOM may not be ready yet
    const _dispApiKey = getApiKey();
    if (CONFIG.ENGINE_AUTO_DISPATCHER && _dispApiKey && _dispApiKey !== "YOUR_API_KEY_HERE") {
        let _dispLoadTries = 0;
        const _tryInjectLoading = () => {
            if (document.getElementById('oc-dispatcher-torn-banner')) return; // already replaced by real data
            injectDispatcherLoading();
            if (!document.getElementById('oc-dispatcher-torn-banner') && _dispLoadTries++ < 10) {
                setTimeout(_tryInjectLoading, 500);
            }
        };
        setTimeout(_tryInjectLoading, 300);
    }

    if (window.location.href.includes('tab=crimes') || window.location.hash.includes('crimes')) {
        // Only auto-open if the user hasn't explicitly closed the panel
        if (!GM_getValue('oc_panel_closed', false)) {
            panelVisible = true; panel.style.display = 'block';
        }
        if (getApiKey()) {
            _lastRefresh = Date.now();
            startRefreshCooldown();
            setTimeout(runAnalysis, 500);
        }
        // v3.2.11: feed Torn's per-slot Success Chance to the server so
        // the failure-risk engine can use it instead of CPR estimation.
        startLiveSuccessPoller();
    }

    // Hide/show dispatcher banner on tab navigation
    window.addEventListener('hashchange', () => {
        if (!isOnCrimesTab()) {
            const b = document.getElementById('oc-dispatcher-torn-banner');
            if (b) b.remove();
        } else if (CONFIG.ENGINE_AUTO_DISPATCHER && !document.getElementById('oc-dispatcher-torn-banner')) {
            // Re-inject banner and re-fetch when navigating back to crimes tab
            setTimeout(() => {
                if (!document.getElementById('oc-dispatcher-torn-banner') && isOnCrimesTab()) {
                    // Show cached data immediately if available, then refresh
                    if (_lastDispatcherData !== undefined) {
                        renderDispatcherBanner(_lastDispatcherData);
                    } else {
                        injectDispatcherLoading();
                    }
                    // Trigger a fresh data fetch
                    runAnalysis();
                }
            }, 300);
        }
    });

    // Start DOM scope reader (runs whenever recruiting tab is visible)
    setupScopeDomReader();


})();

// ── OC reward item worth: rewrite Torn's native "worth $0" on OC reward items
//    (paintings/weapons the item catalog prices at $0) with the live item-market
//    lowest listing from tornwar.com. Self-contained; shares this script's
//    @match / @grant / @connect. Built-in diag (tag oc-item-worth) to verify.
(function () {
  "use strict";
  const NAMES_URL  = "https://tornwar.com/api/oc/item-values"; // {byName} — for tooltip $0 rewrite
  const VALUE_URL  = "https://tornwar.com/api/oc/value";        // ?ids= → {values:{id:price}} — for per-OC total
  const CACHE_KEY  = "ocw_item_values_v1";
  const TTL_MS     = 10 * 60 * 1000;
  const DIAG_URL   = "https://tornwar.com/api/debug/client-log";
  let _byName = {};      // item name(lower) -> value  (the $0-catalog items)
  let _byId   = {};      // item id(str)     -> value  (catalog || item-market; filled on demand)
  let _idName = {};
  let _fetching = false;
  let _diagCount = 0, _diagDone = false;
  const VER = (typeof GM_info !== "undefined" && GM_info && GM_info.script && GM_info.script.version) || "?";
  function diag(payload) {
    if (_diagCount >= 6) return; _diagCount++;
    try { GM_xmlhttpRequest({ method: "POST", url: DIAG_URL, headers: { "Content-Type": "application/json" }, data: JSON.stringify({ tag: "oc-item-worth", data: Object.assign({ ver: VER }, payload) }) }); } catch (_) {}
  }
  const fmt = (n) => "$" + Number(n).toLocaleString("en-US");
  function isVisible(el) {
    return !!(el && el.getClientRects && el.getClientRects().length > 0);
  }

  // ── pass 1: correct the hover tooltip's "worth $N" to the live market value ──
  //   Torn shows the bulk catalog market_price, which is $0 for some collectibles
  //   and stale for others (e.g. Priceless Painting catalog $65M, listed at $85M).
  //   For any tracked item we have a live value for, rewrite the shown amount.
  const WORTH_RE = /worth\s*\$?\s*([\d,]+)/i;
  function rewriteWorth() {
    for (const [id, nm] of Object.entries(_idName)) { const v = _byId[id]; if (nm && v > 0) _byName[nm.toLowerCase()] = v; }
    if (!_byName || !Object.keys(_byName).length) return;
    const w1 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const hits = []; let n;
    while ((n = w1.nextNode())) { if (WORTH_RE.test(n.nodeValue || "") && isVisible(n.parentElement)) hits.push(n); }
    for (const tn of hits) {
      const txt = tn.nodeValue;
      let name = null, qty = 1;
      const m = txt.match(/(\d+)\s*x?\s+(.+?)\s+worth\s*\$?\s*[\d,]+/i);
      if (m) { qty = parseInt(m[1], 10) || 1; name = m[2].trim(); }
      else {
        const ancText = (tn.parentElement && tn.parentElement.textContent || "").toLowerCase();
        for (const k of Object.keys(_byName)) { if (ancText.includes(k)) { name = k; const qm = ancText.match(/(\d+)\s*x/); if (qm) qty = parseInt(qm[1], 10) || 1; break; } }
      }
      if (!name) continue;
      const unit = _byName[name.toLowerCase()];
      if (!(unit > 0)) continue;
      const want = unit * qty;
      const shown = parseInt((txt.match(WORTH_RE)[1] || "0").replace(/,/g, ""), 10);
      if (shown === want) continue;
      tn.nodeValue = txt.replace(WORTH_RE, () => "worth " + fmt(want));
    }
  }

  // ── pass 2: persistent per-OC Total, summed from the reward ICONS ───────────
  //   Each reward item is  <div class="container___" aria-label="<Name>">
  //     <span><img class="torn-item" src="/images/items/<id>/medium.png"></span>
  //     <div class="quantityContainer___">N</div></div>
  //   The "$ worth" only exists in transient hover tooltips, so we read id+qty
  //   off the icons and value them ourselves (/api/oc/value, catalog ⊎ market).
  // Group reward icons by their OC reward list (<ul class="reward___…">). Each OC
  // card has exactly one, so this gives ONE total per OC — not one per item (the
  // per-<li> bug) and not one giant sum across every OC on the page (the global
  // over-count). Icons outside any reward ul (member weapons, avatars, other UI)
  // are ignored. DOM (confirmed via diag):
  //   img.torn-item ▸ span.item-plate ▸ div.container___[aria-label] ▸ li ▸ ul.reward___
  function scanRewardLists() {
    const lists = new Map(); // reward <ul> -> Map(id -> qty)
    const imgs = document.querySelectorAll('img.torn-item, img[src*="/images/items/"]');
    for (const img of imgs) {
      if (!isVisible(img)) continue;
      const m = (img.getAttribute("src") || img.src || "").match(/\/items\/(\d+)\b/);
      if (!m) continue;
      const ul = img.closest('[class*="reward___"]');
      if (!ul) continue; // not an OC reward icon
      const id = m[1];
      const container = img.closest('[class*="container___"]') || img.parentElement;
      const nm = (container && container.getAttribute && container.getAttribute("aria-label")) || img.getAttribute("alt") || "";
      if (nm) _idName[id] = nm;
      const qEl = container && container.querySelector('[class*="quantityContainer"]');
      let qty = 1;
      if (qEl) { const q = parseInt((qEl.textContent || "").replace(/[^\d]/g, ""), 10); if (q > 0) qty = q; }
      let g = lists.get(ul); if (!g) { g = new Map(); lists.set(ul, g); }
      if (!g.has(id) || qty > g.get(id)) g.set(id, qty);
    }
    return lists;
  }
  function ensureValues(ids, done) {
    const missing = ids.filter((id) => !(id in _byId));
    if (!missing.length || _fetching) { done(); return; }
    _fetching = true;
    // re-run after the fetch so any ids that changed while it was in flight get picked up
    const finish = () => { _fetching = false; done(); schedule(); };
    try {
      GM_xmlhttpRequest({ method: "GET", url: VALUE_URL + "?ids=" + missing.slice(0, 30).join(","), timeout: 20000,
        onload: (resp) => {
          try { const b = JSON.parse(resp.responseText); if (b && b.values) for (const [k, v] of Object.entries(b.values)) _byId[k] = Number(v) || 0; } catch (_) {}
          finish();
        },
        onerror: finish,
        ontimeout: finish,
      });
    } catch (_) { finish(); }
  }
  function injectTotals() {
    // drop totals whose reward ul was re-rendered away (avoids dupes/orphans)
    document.querySelectorAll(".ocw-oc-total").forEach((el) => {
      const prev = el.previousElementSibling;
      if (!(prev && prev.matches && prev.matches('[class*="reward___"]'))) el.remove();
    });
    const lists = scanRewardLists();
    let ocs = 0, firstSum = 0;
    for (const [ul, byId] of lists) {
      if (!document.contains(ul)) continue;
      let sum = 0, missing = 0;
      for (const [id, qty] of byId) { const v = _byId[id]; if (v > 0) sum += v * qty; else if (!(id in _byId)) missing++; }
      if (!(sum > 0)) continue; // wait until values are in — no "$0 …" flash
      let el = ul.nextElementSibling;
      if (!(el && el.classList && el.classList.contains("ocw-oc-total"))) {
        el = document.createElement("div");
        el.className = "ocw-oc-total";
        el.style.cssText = "margin:5px 2px 3px;font-size:12px;font-weight:700;color:#46d369;letter-spacing:.2px;font-family:inherit;";
        ul.insertAdjacentElement("afterend", el);
      }
      const label = "💰 Items total: " + fmt(sum) + (missing ? " …" : "");
      if (el.textContent !== label) el.textContent = label;
      ocs++; if (!firstSum) firstSum = sum;
    }
    if (ocs && !_diagDone) { _diagDone = true; diag({ total_v3: true, ocs, firstSum }); }
  }
  function pass2() {
    const lists = scanRewardLists();
    const ids = new Set();
    for (const byId of lists.values()) for (const id of byId.keys()) ids.add(id);
    if (!ids.size) { injectTotals(); return; } // still run to clean stale totals
    ensureValues(Array.from(ids), injectTotals);
    injectTotals(); // paint immediately with whatever's already cached
  }

  function applyOverrides() { rewriteWorth(); pass2(); }

  function loadNames(cb) {
    try { const raw = GM_getValue(CACHE_KEY, ""); if (raw) { const o = JSON.parse(raw); if (o && o.byName) { _byName = o.byName; if (o.ts && Date.now() - o.ts < TTL_MS) { cb(); return; } } } } catch (_) {}
    try {
      GM_xmlhttpRequest({ method: "GET", url: NAMES_URL, timeout: 10000,
        onload: (resp) => {
          if (resp.status >= 200 && resp.status < 300) { try { const body = JSON.parse(resp.responseText); if (body && body.byName) { _byName = body.byName; try { GM_setValue(CACHE_KEY, JSON.stringify({ ts: Date.now(), byName: _byName })); } catch (_) {} } } catch (_) {} }
          cb();
        },
        onerror: () => cb(),
      });
    } catch (_) { cb(); }
  }
  let _pending = null;
  function schedule() { if (_pending) return; _pending = setTimeout(() => { _pending = null; try { applyOverrides(); } catch (_) {} }, 300); }
  loadNames(() => { applyOverrides(); try { new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true }); } catch (_) {} });
})();

