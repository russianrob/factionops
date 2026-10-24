# Faction blood-bag board: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dead Fragment members open `https://tornwar.com/bloodbags`, sign in with their Torn key, and see who keeps the faction's blood supply topped up and who takes more than they give.

**Architecture:**
- `server/blood-bags-model.js` is the arithmetic and nothing else. It reads an armoury news line into a record, and turns stored records, today's roster and the ranked-war list into the board for one timeframe and blood type. No I/O and no clock of its own.
- `server/blood-bags.js` is the collector and the route's handler.
  - Every hour it reads two categories of Torn's v2 faction news on the owner's faction key and keeps only the blood-bag lines, in `data/blood-bags/42055.json`.
  - A one-off backfill walks a year back at 10 calls a minute and waits out live ranked wars.
  - `createBloodBagsApi` answers `GET /api/bloodbags` for members and the owner.
- `server/pages/bloodbags.html` is the page: plain HTML and an ES5 script that signs in through `POST /api/auth` and draws what `/api/bloodbags` returns. `server/blood-bags-page.js` serves it, as `slackers-page.js` serves /slackers.
- `server/routes.js` adds the two routes and lets `/bloodbags` past the site gate. `server/server.js` starts the collector.

**Tech Stack:** Node 20 ES modules in the existing Express server; `node:test`, `node:assert/strict` and `node:vm` for the tests; Torn API v2 (`/faction/news`, `/faction/{id}/rankedwars`) and v1 faction basic (through the existing `fetchFactionBasic`); Python 3 for the exact text edits.

**Spec:** `docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md` (commit 3daa3897). The owner approved the design on 2026-10-23 at about 21:05 EDT ("yes write the spec") and the spec at about 21:36 EDT ("write the plan"). This plan's commit also corrects the spec in four places: the file list, the test list, the live check of Torn's `to`, and what happens to the key at sign-in.

## Global Constraints

Repo paths are relative to `/opt/warboard`.

**From the spec**
- Faction 42055, Dead Fragment. The owner is player 137558 and always gets in.
- The board is `https://tornwar.com/bloodbags`. Its numbers come from `GET /api/bloodbags?window=24h|7d|30d|90d|all&type=all|A+|A-|B+|B-|AB+|AB-|O+|O-`.
  - The defaults are `window=7d` and `type=all`. Anything else is a 400.
  - Anyone but a member or the owner gets a 403 reading, word for word, `This board is for Dead Fragment members.` No token is a 401, from `requireAuth`.
- **Given** is fills of the faction's Empty Blood Bags (1 a line) plus filled bags deposited (N). **Used** is uses plus hand-outs received, less returns and retrievals. **Used during wars** is the part of used inside a ranked war's start and end; a live war runs to now. **Net** is given less used outside wars.
- Empty Blood Bags, irradiated bags and Box of Medical Supplies openings count for nothing. A line with no blood type counts under All types only.
- The lists show current members only, 10 at most, ties by name. The Wall of Shame holds only net below zero, lowest first, and is never padded. The overview counts everyone, former members too.
- Collecting is hourly, on `store.getFactionApiKey("42055")` and never a pooled key: `cat=armoryAction` and `cat=armoryDeposit`, `limit=100`, newest first. A line's own id decides what is a repeat.
- The backfill runs once, back to 365 days before the UTC day the store starts. It makes no more than 10 calls a minute (one every 6,000 ms), never runs while a ranked war is live, and resumes from its saved place after a restart.
- War windows come from `/v2/faction/42055/rankedwars`, read daily, and hourly while the backfill has work.
- The store is `data/blood-bags/42055.json`, written to a temporary file and renamed, by the server process only.
- The page shows "Latest update: N minutes ago (HH:MM TCT)". TCT is UTC.

**Torn's API, checked live on 2026-10-24**
- v2 `/faction/news`: `from` includes its own second and `to` leaves its own second out.
  - By default (`stripTags=false`) a member is a profile link: `<a href = "http://www.torn.com/profiles.php?XID=N">Name</a>`, with spaces around `=`. Older lines leave out the quotes.
  - The reply is `{ news: [{ id, text, timestamp }], _metadata }`.
  - During war 51418, 100 action lines covered about 6.5 hours.
- v2 `/faction/42055/rankedwars` returns the newest 100 wars. A live war has `end: 0`. War 51418 began 2026-10-22 at 15:00 UTC and was still live at about 03:42 UTC on 2026-10-24.
- Torn reports errors in the body, usually with HTTP 200: `{ error: { code, error } }`.
- Every collector call sends the key as `Authorization: ApiKey <key>`, never in the URL, and adds `comment=wb-bloodbags`.
- Cloudflare in front of Torn turns away Python's default User-Agent with error 1010, so Task 9's Python check sends its own.

**Code rules**
- Server code: ES modules, 2-space indent, double quotes, present-tense `//` comments, no version numbers in comments. Match the files around it.
- The page script is ES5 (`var`, `function`) and the whole page is ASCII. The key field is `type="text"`, not `type="password"`, so password managers stay out of it.
- Tests never touch the live data folder. Each test file that imports `blood-bags.js` sets `process.env.DATA_DIR` to a fresh `mkdtemp` folder first.
- Test fixtures use made-up members. The owner's own id and name may appear, as they do across the repo.

**Where the work happens**
- `server/` is the live tree. pm2 runs `/opt/warboard/server/server.js` from it and doesn't watch for changes. The new files do nothing until Task 8 wires them in, and nothing is live until Task 9's reload.
- The work happens in an overlay, `$WS/ov`. The new files are real there. The server files they import are symlinks: `node_modules`, `auth.js`, `key-usage-log.js`, `store.js`, `torn-api.js`, `routes.js` and `server.js`.
  - Each test goes red and then green in the overlay. Only then are its files installed into `server/` and committed.
  - So `server/` only ever holds passing tests. That matters because another session's `deploy.sh` runs the whole suite and refuses to deploy on any failure.
- `$WS` is `/opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board`, the git-ignored workspace that `sdd-workspace` prints for this plan. Shell state doesn't carry from one command to the next, so each block sets `WS` itself.
- Task 8 edits `server/routes.js` and `server/server.js` where they are, with exact-once replacements. Never copy those two files out and back: other sessions edit them.
- Install with `install -o root -g root -m 644`, like every server file and page.
- Never create `server/data/blood-bags/` by hand or as root. The server process creates it on its first save; a root-owned folder would make every save fail with EACCES.
- Work is on `main`, one commit per task. `main` is ahead of `origin/main` by the spec commit 3daa3897 and this plan's commit, and everything goes out with the push in Task 9.

**Repo and box**
- The repo (factionops.git) is public. Commit no secrets, no key endings, no member data and no Torn CSS or bundles.
- Stage only this plan's paths: `git add` the new files, then `git commit -- <paths>`. Leave other sessions' changes alone, among them `server/data/rwp-prices.json`, `server/public/river9-watch.txt` and the files under `server/public/s/`.
- Never print git remotes or git config in `/opt/warboard`, because the remote URL holds a token. Mask push output with `sed -E 's#//[^@]*@#//***@#g'`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- The owner's key is `OWNER_API_KEY` in `server/.env`. Read it inline: `KEY=$(grep '^OWNER_API_KEY=' /opt/warboard/server/.env | cut -d= -f2-)`. Send it only as `Authorization: ApiKey $KEY`, and never print it or any token. Torn allows 100 calls a minute per key; Task 9 makes a handful.
- The box is shared and live, and a load of about 8 is normal.
  - Run one heavy thing at a time, and check `uptime` first.
  - `rm` on a variable path is blocked, and `grep` is ugrep.
  - Run Python with `-I`.
  - Subagents use `model: "opus"`.
  - Foreground `sleep` loops are blocked; wait on a condition with Monitor or a background command.
- Times for the owner are in EDT. The box's clock is CEST, 6 hours ahead.

## Review Focus

The spec's own tests don't reach these five. Each is among the inputs most likely to bite a member, and a test in the owning task pins it.

1. **A token that outlives membership, and a member newer than the roster.** Tokens last 90 days, so someone who has left still holds one naming 42055. Someone who joined in the last hour is missing from the cached roster. The first is refused and the second let in, each after at most one fresh look at the roster. Task 6 tests: "a token that names Dead Fragment but whose holder has left…" and "a member who joined since the roster was fetched gets in".
2. **The shape of Torn's roster.** `fetchFactionBasic` returns v1 faction basic, where `members` is a map keyed by player id (`routes.js:5367`; /slackers reads it the same way at `routes.js:12853`). Read any other way, every member would be refused. Task 6 test: "the roster is read from Torn's faction basic, whose members are keyed by player id".
3. **A viewer outside UTC.** TCT is UTC, so "Latest update" must show the same clock in New York as in London. Task 7 test: "the update time is in Torn City Time, whatever the viewer's zone", run with `TZ=America/New_York`.
4. **No faction key, or a quarantined one.** The poll makes no call and logs once rather than every hour, and the age in "Latest update" shows the board is stale. Task 4 test: "with no key on file the poll makes no call and says so once". Task 7's update-time test covers ages in hours and days.
5. **A Torn error partway through the backfill**, such as code 5 (too many requests). It keeps its place, is never marked done, and carries on from there at the next hourly tick or after a restart. Task 5 tests: "a Torn error mid-backfill keeps its place…" and "after a restart the backfill carries on from its saved place…".

## Files

| File | Task | What it is |
|---|---|---|
| `server/blood-bags-model.js` | 1–3 | New. Line reader, timeframes, war spans, per-member sums, the board. Pure. |
| `server/blood-bags-model.test.js` | 1–3 | New. 30 tests. |
| `server/blood-bags.js` | 4–6 | New. The collector (store, page walk, poll, backfill, war list, schedule) and the `/api/bloodbags` handler. |
| `server/blood-bags.test.js` | 4–5 | New. 18 tests against a fake Torn, a fake clock and a temporary folder. |
| `server/blood-bags-route.test.js` | 6, 8 | New. 14 handler tests, then 3 wiring tests. |
| `server/pages/bloodbags.html` | 7 | New. The page: ES5, ASCII, dark only. |
| `server/blood-bags-page.js` | 7 | New. Serves the page, re-read when the file changes, like `slackers-page.js`. |
| `server/blood-bags-page.test.js` | 7 | New. 11 tests of the page's functions in `vm`. |
| `server/routes.js` | 8 | Changed. Two imports, the site-gate exemption, two routes. |
| `server/server.js` | 8 | Changed. Starts the collector after the chain-hits collector. |

## Rulings made at plan time

The spec leaves these open, or the code needed a choice the spec doesn't make. Each is in the code below and goes to the owner at the handoff.

1. **A return never creates net.** Use is summed in two parts, outside wars and during wars, and each part stops at zero: net = given − max(0, used outside wars). Without the floor, bags lent before the window and returned inside it, or lent during a war and returned after it, would come out as net given.
2. **A token must match today's roster as well as name 42055.** A viewer missing from the roster gets one fresh roster fetch, if the cached one is over 5 minutes old, before a 403. The owner gets in either way.
3. **`/bloodbags` is let past the site gate**, as `/war`, `/payouts` and `/hof` are. The page holds no member data, and `/api/bloodbags` checks membership.
4. **The hourly poll stops after 10 pages**, about three days of news, and hands the rest to the backfill as a gap. Gaps are general `[from, to)` ranges, filled newest first.
5. **A use line with no type** ("used one of the faction's Blood Bag items") is a use under All types only, like a fill with no type.
6. **`gave` reads like `loaned`**, with or without " from the faction armory". No real `gave` blood line has been seen yet, so a blood line in any wording the reader doesn't know is logged, once per line id.
7. **`type=A ` reads as A+.** A "+" typed into an address bar arrives as a space. The page itself sends `A%2B`.
8. **The page is dark only**, in the /slackers dark colours, like the board it was modelled on.
9. **The sign-in card says the key is kept**: "Torn checks it, this browser keeps only a sign-in token, and warboard keeps the key the way it does for FactionOps."
10. **A store that won't read is set aside** as `42055.json.unreadable-<ms>`, never written over, and the board starts again from the news.
11. **Before the first poll** the API answers 200 with `updatedAt: null`, and the page says there is no data yet.
12. **The roster comes from `fetchFactionBasic`**, the call /slackers makes. It is Torn v1, with the key in its query string, as it is for /slackers. `rosterFromBasic` maps the reply, and a test pins the shape.
13. **Four new source files, not three.** The page's markup is `server/pages/bloodbags.html`, served by `server/blood-bags-page.js`, as /slackers is.

---

### Task 1: Reading an armoury line

**Files:**
- Create: `$WS/ov/blood-bags-model.js` and `$WS/ov/blood-bags-model.test.js`. Step 6 installs them as `server/blood-bags-model.js` and `server/blood-bags-model.test.js`.
- Step 1 makes the workspace and the overlay.

**Interfaces:**
- Consumes: nothing.
- Produces, from `blood-bags-model.js`:
  - `TYPES`: `["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]`.
  - `parseLine(text)` returns `{ kind, playerId, name, type, qty, toId, toName }`, or null for a line the board doesn't count.
    - `kind` is `"fill"`, `"deposit"`, `"use"`, `"gave"`, `"loaned"`, `"returned"` or `"retrieved"`.
    - Ids are strings. `type` is one of `TYPES`, or null. `qty` is at least 1.
    - `toId` and `toName` are set for `gave`, `loaned` and `retrieved`, and null otherwise.
  - `chargedTo(line)` returns the id the line counts for: `toId` for `gave`, `loaned` and `retrieved`, `playerId` otherwise.
  - `isUnreadBloodLine(text)` is true for a line that mentions a blood bag but that `parseLine` can't read. Empty bags, irradiated bags and medical boxes don't count as unread.

- [ ] **Step 1: Make the workspace and the overlay**

The executing-plans setup runs `sdd-workspace` for this plan, which must print `/opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board`. Then:

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board
mkdir -p $WS/ov/pages $WS/tools
for f in node_modules auth.js key-usage-log.js store.js torn-api.js routes.js server.js; do ln -s /opt/warboard/server/$f $WS/ov/$f; done
ls -l $WS/ov | cut -c1-160; git -C /opt/warboard check-ignore -q $WS/ov && echo ignored
```

Expected: seven symlinks into `/opt/warboard/server/`, an empty `pages`, and `ignored`.

- [ ] **Step 2: Write the failing tests**

Create `$WS/ov/blood-bags-model.test.js`:

```js
// The numbers behind /bloodbags: what each armoury line counts as, who it counts
// for, and how the board ranks members. Synthetic lines only, written the way
// Torn writes them. Spec: docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md
import { test } from "node:test";
import assert from "node:assert/strict";
import * as model from "./blood-bags-model.js";

// Torn's profile link, as the armoury news writes it: spaces around "=", plain http.
const who = (id, name) => `<a href = "http://www.torn.com/profiles.php?XID=${id}">${name}</a>`;
const line = (over) => ({ kind: "fill", playerId: "1", name: "P1", type: null, qty: 1, toId: null, toName: null, ...over });

// ── reading a line ──────────────────────────────────────────────────────────
test("a typed fill is one bag given, of that type", () => {
  assert.deepEqual(
    model.parseLine(`${who(1001, "Ash")} filled one of the faction's Empty Blood Bags to create a Blood Bag : O+`),
    line({ kind: "fill", playerId: "1001", name: "Ash", type: "O+" }));
});

test("an older fill has no type, with or without the closing full stop", () => {
  const want = line({ kind: "fill", playerId: "2", name: "Old", type: null });
  assert.deepEqual(model.parseLine(`${who(2, "Old")} filled one of the faction's Empty Blood Bag items`), want);
  assert.deepEqual(model.parseLine(`${who(2, "Old")} filled one of the faction's Empty Blood Bag items.`), want);
});

test("a deposit of filled bags is N given, written Nx or N x", () => {
  assert.deepEqual(model.parseLine(`${who(1002, "Birch")} deposited 6x Blood Bag : O+`),
    line({ kind: "deposit", playerId: "1002", name: "Birch", type: "O+", qty: 6 }));
  assert.deepEqual(model.parseLine(`${who(1003, "0xCedar")} deposited 139 x Blood Bag : AB+`),
    line({ kind: "deposit", playerId: "1003", name: "0xCedar", type: "AB+", qty: 139 }));
});

test("a use is one bag used, with or without the closing full stop", () => {
  const want = line({ kind: "use", playerId: "1004", name: "D4isy", type: "O+" });
  assert.deepEqual(model.parseLine(`${who(1004, "D4isy")} used one of the faction's Blood Bag : O+ items`), want);
  assert.deepEqual(model.parseLine(`${who(1004, "D4isy")} used one of the faction's Blood Bag : O+ items.`), want);
});

test("a use with no type is one bag used, counted under all types only", () => {
  assert.deepEqual(model.parseLine(`${who(5, "P5")} used one of the faction's Blood Bag items`),
    line({ kind: "use", playerId: "5", name: "P5", type: null }));
});

test("AB types are read whole, never as A or B", () => {
  assert.equal(model.parseLine(`${who(1, "P1")} used one of the faction's Blood Bag : AB- items`).type, "AB-");
  assert.equal(model.parseLine(`${who(1, "P1")} deposited 2x Blood Bag : AB+`).type, "AB+");
});

test("a hand-out counts for whoever got the bags, named or themselves, with Torn's suffix or without", () => {
  assert.deepEqual(
    model.parseLine(`${who(1016, "Quill")} gave 2x Blood Bag : A+ to ${who(1005, "Elm")} from the faction armory`),
    line({ kind: "gave", playerId: "1016", name: "Quill", type: "A+", qty: 2, toId: "1005", toName: "Elm" }));
  assert.deepEqual(
    model.parseLine(`${who(1006, "Fern_")} loaned 3x Blood Bag : B- to themselves from the faction armory`),
    line({ kind: "loaned", playerId: "1006", name: "Fern_", type: "B-", qty: 3, toId: "1006", toName: "Fern_" }));
  assert.deepEqual(
    model.parseLine(`${who(9, "Lead")} gave 1x Blood Bag : O- to ${who(8, "Mem")}`),
    line({ kind: "gave", playerId: "9", name: "Lead", type: "O-", qty: 1, toId: "8", toName: "Mem" }));
});

test("a return cancels use for the member returning; a retrieval for the member it was taken from", () => {
  assert.deepEqual(model.parseLine(`${who(1007, "Gale_j")} returned 7x Blood Bag : B-`),
    line({ kind: "returned", playerId: "1007", name: "Gale_j", type: "B-", qty: 7 }));
  assert.deepEqual(model.parseLine(`${who(1008, "Hazel")} retrieved 1x Blood Bag : A+ from ${who(1009, "Iris")}`),
    line({ kind: "retrieved", playerId: "1008", name: "Hazel", type: "A+", qty: 1, toId: "1009", toName: "Iris" }));
});

test("an older profile link without quotes still reads", () => {
  assert.equal(model.parseLine(`<a href = http://www.torn.com/profiles.php?XID=1010>Juniper69</a> deposited 1x Blood Bag : A-`).playerId, "1010");
});

test("empty bags, irradiated bags, medical boxes and other items count for nothing", () => {
  for (const text of [
    `${who(1011, "Kestrel")} deposited 1672x Empty Blood Bag`,
    `${who(1012, "Larch")} deposited 42 x Empty Blood Bag`,
    `${who(1013, "Maple")} opened a Box of Medical Supplies and gained 20x Empty Blood Bag which has been placed in the armory`,
    `${who(1014, "Nettle")} deposited 1 x Blood Bag : Irradiated`,
    `${who(1, "P1")} used one of the faction's Blood Bag : Irradiated items`,
    `${who(1015, "Oak")} used one of the faction's Xanax items`,
    `${who(1002, "Birch")} deposited 5x Spray Paint : Red`,
    `${who(1, "P1")} deposited 0x Blood Bag : O+`,
    "",
  ]) assert.equal(model.parseLine(text), null, text);
});

test("each kind counts for the right member", () => {
  assert.equal(model.chargedTo(line({ kind: "use", playerId: "1" })), "1");
  assert.equal(model.chargedTo(line({ kind: "returned", playerId: "1" })), "1");
  assert.equal(model.chargedTo(line({ kind: "gave", playerId: "1", toId: "2" })), "2");
  assert.equal(model.chargedTo(line({ kind: "loaned", playerId: "1", toId: "2" })), "2");
  assert.equal(model.chargedTo(line({ kind: "retrieved", playerId: "1", toId: "2" })), "2");
});

test("a blood line in a wording the reader has not met is flagged; known ones are not", () => {
  assert.equal(model.isUnreadBloodLine(`${who(1, "P1")} donated 2x Blood Bag : O+ to the hospital`), true);
  assert.equal(model.isUnreadBloodLine(`${who(1, "P1")} used one of the faction's Blood Bag : O+ items`), false);
  assert.equal(model.isUnreadBloodLine(`${who(1, "P1")} deposited 4x Empty Blood Bag`), false);
  assert.equal(model.isUnreadBloodLine(`${who(1, "P1")} deposited 1 x Blood Bag : Irradiated`), false);
  assert.equal(model.isUnreadBloodLine(`${who(1, "P1")} used one of the faction's Xanax items`), false);
});
```

- [ ] **Step 3: Watch them fail**

```bash
cd /opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board/ov && node --test blood-bags-model.test.js 2>&1 | grep -E 'ERR_|^# (tests|pass|fail)'
```

Expected: `# tests 1` and `# fail 1`, from `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/ov/blood-bags-model.js' imported from …/ov/blood-bags-model.test.js`.

- [ ] **Step 4: Write the reader**

Create `$WS/ov/blood-bags-model.js`:

```js
// The arithmetic behind /bloodbags: who keeps the faction's blood supply topped
// up and who takes more than they give. Pure: no I/O and no clock of its own,
// every input passed in, so the numbers a member reads about themselves can be
// checked here rather than inferred from a page.
// Spec: docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md

// The eight blood types, in the order the filter lists them. Anything else Torn
// writes after "Blood Bag : " (Irradiated, for one) is not a bag this counts.
export const TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// ── Reading a line ─────────────────────────────────────────────────────────
// Torn writes each member as a profile link, and not always the same way:
// `<a href = "http://www.torn.com/profiles.php?XID=1">Name</a>`, with spaces
// around the "=", and in older lines without the quotes. So the reader asks
// only for an anchor with an XID in it.
const LINK = String.raw`<a[^>]*?XID=(\d+)[^>]*>([^<]*)<\/a>`;
const TYPE = String.raw`(AB\+|AB-|A\+|A-|B\+|B-|O\+|O-)`;
const APOS = String.raw`(?:'|&#0?39;)`;
const QTY = String.raw`(\d+)\s*x\s+`;
const END = String.raw`\s*\.?\s*$`;

const FILL_TYPED = new RegExp(String.raw`^${LINK}\s+filled one of the faction${APOS}s Empty Blood Bags to create a Blood Bag : ${TYPE}${END}`);
const FILL_PLAIN = new RegExp(String.raw`^${LINK}\s+filled one of the faction${APOS}s Empty Blood Bag items${END}`);
const USE_TYPED = new RegExp(String.raw`^${LINK}\s+used one of the faction${APOS}s Blood Bag : ${TYPE} items${END}`);
const USE_PLAIN = new RegExp(String.raw`^${LINK}\s+used one of the faction${APOS}s Blood Bag items${END}`);
const DEPOSIT = new RegExp(String.raw`^${LINK}\s+deposited ${QTY}Blood Bag : ${TYPE}${END}`);
// "to themselves" or to a second profile link, and Torn adds "from the faction
// armory" to these.
const HAND_OUT = new RegExp(String.raw`^${LINK}\s+(gave|loaned) ${QTY}Blood Bag : ${TYPE} to (?:(themselves)|${LINK})(?: from the faction armou?ry)?${END}`);
const RETURNED = new RegExp(String.raw`^${LINK}\s+returned ${QTY}Blood Bag : ${TYPE}${END}`);
const RETRIEVED = new RegExp(String.raw`^${LINK}\s+retrieved ${QTY}Blood Bag : ${TYPE} from ${LINK}${END}`);

function rec(kind, m, type, qty, toId = null, toName = null) {
  return { kind, playerId: m[1], name: m[2].trim() || m[1], type, qty, toId, toName };
}
function count(s) {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

/**
 * One armoury news line, as { kind, playerId, name, type, qty, toId, toName },
 * or null when it is not a blood-bag line this board counts.
 *   fill, deposit         given
 *   use, gave, loaned     used (a hand-out by whoever got the bags: toId)
 *   returned, retrieved   used cancelled (a retrieval for toId, the member it
 *                         was taken back from)
 * type is null on fills from before Torn named the type, about April 2026.
 */
export function parseLine(text) {
  const s = String(text || "").trim();
  let m;
  if ((m = s.match(FILL_TYPED))) return rec("fill", m, m[3], 1);
  if ((m = s.match(FILL_PLAIN))) return rec("fill", m, null, 1);
  if ((m = s.match(USE_TYPED))) return rec("use", m, m[3], 1);
  if ((m = s.match(USE_PLAIN))) return rec("use", m, null, 1);
  if ((m = s.match(DEPOSIT))) { const n = count(m[3]); return n && rec("deposit", m, m[4], n); }
  if ((m = s.match(HAND_OUT))) {
    const n = count(m[4]);
    if (!n) return null;
    return m[6] ? rec(m[3], m, m[5], n, m[1], m[2].trim() || m[1]) : rec(m[3], m, m[5], n, m[7], m[8].trim() || m[7]);
  }
  if ((m = s.match(RETURNED))) { const n = count(m[3]); return n && rec("returned", m, m[4], n); }
  if ((m = s.match(RETRIEVED))) { const n = count(m[3]); return n && rec("retrieved", m, m[4], n, m[5], m[6].trim() || m[5]); }
  return null;
}

/** The member a line counts for: whoever got the bags, for a hand-out or a retrieval. */
export function chargedTo(line) {
  return line.kind === "gave" || line.kind === "loaned" || line.kind === "retrieved" ? line.toId : line.playerId;
}

/**
 * A line that mentions a blood bag but that parseLine does not read. Empty
 * bags, irradiated bags and Box of Medical Supplies openings are left out on
 * purpose; anything else is a wording this reader has not met yet, which the
 * collector logs so it can be added.
 */
export function isUnreadBloodLine(text) {
  const s = String(text || "");
  return /Blood Bag/.test(s) && !/Empty Blood Bag|Irradiated|Box of Medical Supplies/.test(s) && parseLine(s) === null;
}
```

- [ ] **Step 5: Watch them pass**

```bash
cd /opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board/ov && node --test blood-bags-model.test.js 2>&1 | grep -E '^(not ok|# (tests|pass|fail))'
```

Expected: `# tests 12`, `# pass 12`, `# fail 0`.

- [ ] **Step 6: Install, run in place, and commit**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board
install -o root -g root -m 644 $WS/ov/blood-bags-model.js $WS/ov/blood-bags-model.test.js /opt/warboard/server/
cd /opt/warboard/server && node --test blood-bags-model.test.js 2>&1 | grep -E '^(not ok|# (tests|pass|fail))'
```

Expected: `# tests 12`, `# pass 12`, `# fail 0`. Then:

```bash
cd /opt/warboard && git add server/blood-bags-model.js server/blood-bags-model.test.js && git commit -q -F - -- server/blood-bags-model.js server/blood-bags-model.test.js <<'MSG'
Blood-bag board: read the armoury's blood-bag lines

parseLine reads one armoury news line into what it counts as: a fill or
a deposit (given), a use or a hand-out (used, by whoever got the bags),
or a return or retrieval (use cancelled). Empty and irradiated bags and
medical boxes count for nothing. isUnreadBloodLine flags a blood line in
a wording the reader has not met, so the collector can log it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
git log --oneline -1
```

### Task 2: Timeframes, wars and each member's sums

**Files:**
- Modify: `$WS/ov/blood-bags-model.test.js` and `$WS/ov/blood-bags-model.js` (both appended to). Step 5 installs them.

**Interfaces:**
- Consumes: Task 1's `TYPES` and `chargedTo`.
- Produces, from `blood-bags-model.js`:
  - `WINDOWS`: `{ "24h": 1, "7d": 7, "30d": 30, "90d": 90, all: null }`, in days. `DEFAULT_WINDOW`: `"7d"`.
  - `parseWindow(raw)` returns a key of `WINDOWS`: `"7d"` when missing or empty, null for anything unknown.
  - `parseType(raw)` returns `"all"` or one of `TYPES`: `"all"` when missing or empty, null for anything unknown. A space reads as "+".
  - `windowRange(window, nowSec, reachSec)` returns `{ fromSec, toSec }`, both ends included. `all` starts at `reachSec`.
  - `warSpans(wars, nowSec)` turns `[{ id, start, end }]` into `[{ start, end }]`. `end: 0` runs to `nowSec`; a war not started yet is left out.
  - `liveWar(wars, nowSec)` returns `{ id, start }` or null.
  - `tally(lines, { fromSec, toSec, type, warSpans })` returns a `Map` from member id (a string) to `{ given, used, usedInWars, net }`. `lines` are stored records, `{ ts, kind, type, qty, playerId, toId }`.

- [ ] **Step 1: Write the failing tests**

Append this to the end of `$WS/ov/blood-bags-model.test.js`, after a blank line:

```js
// ── timeframes, types and wars ──────────────────────────────────────────────
const DAY = 86400;
const NOW = 1792800000;                       // 2026-10-24 00:00 UTC, in seconds
const at = (daysAgo) => NOW - Math.round(daysAgo * DAY);

test("a timeframe is one of five, 7 days when missing; anything else is refused", () => {
  assert.equal(model.parseWindow(undefined), "7d");
  assert.equal(model.parseWindow(""), "7d");
  for (const w of ["24h", "7d", "30d", "90d", "all"]) assert.equal(model.parseWindow(w), w);
  assert.equal(model.parseWindow("30D"), "30d");
  for (const bad of ["1y", "7", "__proto__", "toString"]) assert.equal(model.parseWindow(bad), null, bad);
});

test("a blood type is all or one of eight, and a + typed into a link still reads", () => {
  assert.equal(model.parseType(undefined), "all");
  assert.equal(model.parseType("ALL"), "all");
  assert.equal(model.parseType("A+"), "A+");
  assert.equal(model.parseType("A "), "A+", "a literal + in a query string arrives as a space");
  assert.equal(model.parseType("ab "), "AB+");
  assert.equal(model.parseType("o-"), "O-");
  for (const bad of ["C+", " A", "A", "Irradiated"]) assert.equal(model.parseType(bad), null, bad);
});

test("a war runs from its start to its end; a live one to now; one not started yet is no war", () => {
  const wars = [
    { id: 1, start: at(10), end: at(9) },
    { id: 2, start: at(1), end: 0 },
    { id: 3, start: NOW + DAY, end: 0 },
  ];
  assert.deepEqual(model.warSpans(wars, NOW), [{ start: at(10), end: at(9) }, { start: at(1), end: NOW }]);
  assert.deepEqual(model.liveWar(wars, NOW), { id: 2, start: at(1) });
  assert.equal(model.liveWar([{ id: 1, start: at(10), end: at(9) }], NOW), null);
});

test("a timeframe covers its days up to now; all time starts where the history reaches", () => {
  assert.deepEqual(model.windowRange("7d", NOW, at(300)), { fromSec: NOW - 7 * DAY, toSec: NOW });
  assert.deepEqual(model.windowRange("24h", NOW, at(300)), { fromSec: NOW - DAY, toSec: NOW });
  assert.deepEqual(model.windowRange("all", NOW, at(300)), { fromSec: at(300), toSec: NOW });
});

// ── per member ──────────────────────────────────────────────────────────────
const L = (kind, playerId, daysAgo, over = {}) => ({ ts: at(daysAgo), kind, playerId: String(playerId), type: "O+", qty: 1, toId: null, ...over });
const sevenDays = (over = {}) => ({ fromSec: NOW - 7 * DAY, toSec: NOW, type: "all", warSpans: [], ...over });

test("given is fills plus deposits; used is uses plus hand-outs received, less returns; net is the difference", () => {
  const out = model.tally([
    L("fill", 1, 1), L("fill", 1, 2), L("deposit", 1, 3, { qty: 5 }),
    L("use", 1, 1), L("gave", 9, 2, { qty: 3, toId: "1" }), L("returned", 1, 2, { qty: 1 }),
  ], sevenDays());
  assert.deepEqual(out.get("1"), { given: 7, used: 3, usedInWars: 0, net: 4 });
  assert.equal(out.get("9"), undefined, "handing bags out counts nothing for the leader");
});

test("three fills by one member in the same second are three bags", () => {
  const out = model.tally([L("fill", 1, 1), L("fill", 1, 1), L("fill", 1, 1)], sevenDays());
  assert.equal(out.get("1").given, 3);
});

test("a timeframe includes both its ends and nothing outside them", () => {
  const out = model.tally([
    L("fill", 1, 7), L("fill", 1, 0), L("fill", 1, 7.01), { ...L("fill", 1, 0), ts: NOW + 1 },
  ], sevenDays());
  assert.equal(out.get("1").given, 2);
});

test("the type filter keeps one type, and fills with no type count under all types only", () => {
  const lines = [L("fill", 1, 1, { type: "A+" }), L("fill", 1, 1, { type: null }), L("use", 1, 1, { type: "O+" })];
  assert.deepEqual(model.tally(lines, sevenDays()).get("1"), { given: 2, used: 1, usedInWars: 0, net: 1 });
  assert.deepEqual(model.tally(lines, sevenDays({ type: "A+" })).get("1"), { given: 1, used: 0, usedInWars: 0, net: 1 });
  assert.deepEqual(model.tally(lines, sevenDays({ type: "O+" })).get("1"), { given: 0, used: 1, usedInWars: 0, net: -1 });
});

test("use during a war counts as used but not against net, a live war's up to now", () => {
  const spans = model.warSpans([{ id: 1, start: at(5), end: at(4) }, { id: 2, start: at(1), end: 0 }], NOW);
  const out = model.tally([
    L("use", 1, 4.5), L("use", 1, 0.5), L("use", 1, 3), L("fill", 1, 3),
  ], sevenDays({ warSpans: spans }));
  assert.deepEqual(out.get("1"), { given: 1, used: 3, usedInWars: 2, net: 0 });
});

test("a hand-out to themselves counts against the leader; a retrieval cancels it for the member it came from", () => {
  const out = model.tally([
    L("loaned", 9, 1, { qty: 2, toId: "9" }),
    L("gave", 9, 1, { qty: 4, toId: "2" }), L("retrieved", 9, 0.5, { qty: 1, toId: "2" }),
  ], sevenDays());
  assert.equal(out.get("9").used, 2);
  assert.equal(out.get("2").used, 3);
});

test("returning bags cancels use but never adds to net", () => {
  const spans = model.warSpans([{ id: 1, start: at(3), end: at(2) }], NOW);
  // Lent before the window and returned inside it.
  const before = model.tally([L("loaned", 9, 20, { qty: 7, toId: "1" }), L("returned", 1, 1, { qty: 7 })], sevenDays());
  assert.deepEqual(before.get("1"), { given: 0, used: 0, usedInWars: 0, net: 0 });
  // Lent during a war and returned after it.
  const acrossWar = model.tally([L("loaned", 9, 2.5, { qty: 4, toId: "1" }), L("returned", 1, 1, { qty: 4 })], sevenDays({ warSpans: spans }));
  assert.deepEqual(acrossWar.get("1"), { given: 0, used: 4, usedInWars: 4, net: 0 });
});
```

- [ ] **Step 2: Watch them fail**

```bash
cd /opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board/ov && node --test blood-bags-model.test.js 2>&1 | grep -E "^(not ok|# (tests|pass|fail))|error: '"
```

Expected: `# tests 23`, `# pass 12`, `# fail 11`. Each new test fails with a TypeError: `model.parseWindow is not a function`, `model.parseType is not a function`, `model.windowRange is not a function`, `model.warSpans is not a function` (3 tests) and `model.tally is not a function` (5 tests).

- [ ] **Step 3: Write the timeframes, war spans and sums**

Append this to the end of `$WS/ov/blood-bags-model.js`, after a blank line:

```js
// ── Timeframes and types ───────────────────────────────────────────────────
// Days per timeframe; "all" runs from wherever the stored history reaches.
export const WINDOWS = { "24h": 1, "7d": 7, "30d": 30, "90d": 90, all: null };
export const DEFAULT_WINDOW = "7d";
const DAY = 86400;

/** The timeframe a request asked for: 7 days when missing, null when unknown. */
export function parseWindow(raw) {
  if (raw == null || raw === "") return DEFAULT_WINDOW;
  const w = String(raw).toLowerCase();
  return Object.prototype.hasOwnProperty.call(WINDOWS, w) ? w : null;
}

/** The blood type a request asked for: "all" when missing, null when unknown. */
export function parseType(raw) {
  if (raw == null || raw === "") return "all";
  // A "+" typed into an address bar arrives as a space, so "A+" reads "A ".
  const t = String(raw).replace(/ /g, "+").toUpperCase();
  if (t === "ALL") return "all";
  return TYPES.includes(t) ? t : null;
}

/** The seconds a timeframe covers, both ends included. */
export function windowRange(window, nowSec, reachSec) {
  const days = WINDOWS[window];
  return { fromSec: days == null ? Number(reachSec) || 0 : nowSec - days * DAY, toSec: nowSec };
}

// ── Ranked wars ────────────────────────────────────────────────────────────
// A war runs from its start to its end. Torn writes end: 0 for a war still
// going, so its span runs to now; a war that has not started yet has no span.
export function warSpans(wars, nowSec) {
  const out = [];
  for (const w of wars || []) {
    const start = Number(w && w.start) || 0;
    if (!start || start > nowSec) continue;
    out.push({ start, end: Number(w.end) > 0 ? Number(w.end) : nowSec });
  }
  return out;
}

/** The ranked war going on at nowSec, as { id, start }, or null. */
export function liveWar(wars, nowSec) {
  for (const w of wars || []) {
    const start = Number(w && w.start) || 0;
    if (start && start <= nowSec && !(Number(w.end) > 0 && Number(w.end) <= nowSec)) return { id: w.id, start };
  }
  return null;
}

// ── Per member ─────────────────────────────────────────────────────────────
/**
 * { given, used, usedInWars, net } per member id, over the lines whose time is
 * in [fromSec, toSec] and whose type passes the filter. Lines with no type
 * count under "all" only. warSpans comes from warSpans().
 *
 * Use is split into outside wars and during wars, and each part stops at zero.
 * A return cancels use but is not a gift: bags lent before the window, or lent
 * during a war and returned after it, would otherwise come out as net given.
 */
export function tally(lines, { fromSec, toSec, type = "all", warSpans: spans = [] } = {}) {
  const sums = new Map();
  for (const l of lines || []) {
    if (!(l.ts >= fromSec && l.ts <= toSec)) continue;
    if (type !== "all" && l.type !== type) continue;
    const id = String(chargedTo(l));
    let s = sums.get(id);
    if (!s) sums.set(id, (s = { given: 0, out: 0, war: 0 }));
    if (l.kind === "fill" || l.kind === "deposit") { s.given += l.qty; continue; }
    const n = l.kind === "returned" || l.kind === "retrieved" ? -l.qty : l.qty;
    if (spans.some((w) => l.ts >= w.start && l.ts <= w.end)) s.war += n;
    else s.out += n;
  }
  const out = new Map();
  for (const [id, s] of sums) {
    const usedOutside = Math.max(0, s.out);
    const usedInWars = Math.max(0, s.war);
    out.set(id, { given: s.given, used: usedOutside + usedInWars, usedInWars, net: s.given - usedOutside });
  }
  return out;
}
```

- [ ] **Step 4: Watch them pass**

```bash
cd /opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board/ov && node --test blood-bags-model.test.js 2>&1 | grep -E '^(not ok|# (tests|pass|fail))'
```

Expected: `# tests 23`, `# pass 23`, `# fail 0`.

- [ ] **Step 5: Install, run in place, and commit**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board
install -o root -g root -m 644 $WS/ov/blood-bags-model.js $WS/ov/blood-bags-model.test.js /opt/warboard/server/
cd /opt/warboard/server && node --test blood-bags-model.test.js 2>&1 | grep -E '^(not ok|# (tests|pass|fail))'
```

Expected: `# tests 23`, `# pass 23`, `# fail 0`. Then:

```bash
cd /opt/warboard && git commit -q -F - -- server/blood-bags-model.js server/blood-bags-model.test.js <<'MSG'
Blood-bag board: timeframes, war windows and each member's sums

tally sums given, used and used-during-wars per member over a timeframe
and blood type. A ranked war runs from its start to its end, a live one
to now. Use outside wars and use during wars each stop at zero, so a
return cancels use but never counts as a gift.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
git log --oneline -1
```

### Task 3: The board

**Files:**
- Modify: `$WS/ov/blood-bags-model.test.js` and `$WS/ov/blood-bags-model.js` (both appended to). Step 5 installs them.

**Interfaces:**
- Consumes: Task 2's `windowRange`, `warSpans` and `tally`.
- Produces, from `blood-bags-model.js`:
  - `buildBoard({ lines, roster, wars, nowSec, window, type, viewerId, reachSec })` returns `{ window, type, fromSec, toSec, overview, topGiven, topNet, wall, you }`.
    - `roster` is today's members, `[{ playerId, name }]`. `wars` is Torn's list, `[{ id, start, end }]`.
    - `overview` is `{ given, used, usedInWars, net, members }`, over every player, and `members` is the roster's size.
    - Each list row is `{ rank, playerId, name, value }`: `value` is given in `topGiven` and net in `topNet` and `wall`.
    - `you` is `{ rank, of, given, used, usedInWars, net }`. `rank` is the viewer's place by net among the whole roster, or null when they are not on it. `you` is null when the viewer gave and used nothing in the window.

- [ ] **Step 1: Write the failing tests**

Append this to the end of `$WS/ov/blood-bags-model.test.js`, after a blank line:

```js
// ── the board ───────────────────────────────────────────────────────────────
const member = (id, name) => ({ playerId: String(id), name });
const board = (over = {}) => model.buildBoard({
  lines: [], roster: [], wars: [], nowSec: NOW, window: "7d", type: "all", viewerId: "0", reachSec: at(300), ...over,
});
// n fills, or n uses, by one member a day ago.
const fills = (id, n) => Array.from({ length: n }, () => L("fill", id, 1));
const uses = (id, n) => Array.from({ length: n }, () => L("use", id, 1));

test("the lists hold current members only; the overview counts everyone, former members too", () => {
  const b = board({
    roster: [member(1, "Ann")],
    lines: [...fills(1, 2), ...fills(77, 5), ...uses(77, 1)],
  });
  assert.deepEqual(b.topGiven.map((r) => r.playerId), ["1"]);
  assert.deepEqual(b.overview, { given: 7, used: 1, usedInWars: 0, net: 6, members: 1 });
});

test("top contributors: most given first, ties by name whatever the case, ten at most", () => {
  const roster = Array.from({ length: 12 }, (_, i) => member(i + 1, "m" + String(i + 1).padStart(2, "0")));
  roster[2].name = "Bea"; roster[3].name = "alf";
  const lines = [...fills(3, 20), ...fills(4, 20)];
  for (let i = 5; i <= 12; i++) lines.push(...fills(i, i));
  const b = board({ roster, lines });
  assert.equal(b.topGiven.length, 10);
  assert.deepEqual(b.topGiven.slice(0, 3), [
    { rank: 1, playerId: "4", name: "alf", value: 20 },
    { rank: 2, playerId: "3", name: "Bea", value: 20 },
    { rank: 3, playerId: "12", name: "m12", value: 12 },
  ]);
  assert.ok(!b.topGiven.some((r) => r.playerId === "1" || r.playerId === "2"), "nobody with nothing given");
});

test("top net lists only net above zero; the Wall of Shame only below it, lowest first, never padded", () => {
  const b = board({
    roster: [member(1, "Ann"), member(2, "Bob"), member(3, "Cat"), member(4, "Dan"), member(5, "Eve")],
    lines: [...fills(1, 5), ...uses(1, 1), ...uses(2, 3), ...uses(3, 1), ...fills(4, 1), ...uses(4, 1), ...uses(5, 3)],
  });
  assert.deepEqual(b.topNet, [{ rank: 1, playerId: "1", name: "Ann", value: 4 }]);
  assert.deepEqual(b.wall, [
    { rank: 1, playerId: "2", name: "Bob", value: -3 },
    { rank: 2, playerId: "5", name: "Eve", value: -3 },
    { rank: 3, playerId: "3", name: "Cat", value: -1 },
  ]);
});

test("a member who only used bags during wars is on no list, and the overview still shows the use", () => {
  const b = board({
    roster: [member(1, "Ann")],
    wars: [{ id: 1, start: at(2), end: at(1) }],
    lines: [L("use", 1, 1.5), L("use", 1, 1.5)],
  });
  assert.deepEqual([b.topGiven, b.topNet, b.wall], [[], [], []]);
  assert.deepEqual(b.overview, { given: 0, used: 2, usedInWars: 2, net: 0, members: 1 });
});

test("the viewer's line ranks them by net among the whole roster, even outside the top ten", () => {
  const roster = Array.from({ length: 15 }, (_, i) => member(i + 1, "m" + String(i + 1).padStart(2, "0")));
  const lines = [];
  for (let i = 1; i <= 13; i++) lines.push(...fills(i, 20 - i));
  lines.push(...fills(14, 1), ...uses(14, 2), L("use", 14, 1, { ts: at(1.5) }));
  const b = board({ roster, lines, viewerId: "14", wars: [{ id: 1, start: at(2), end: at(1.2) }] });
  assert.deepEqual(b.you, { rank: 15, of: 15, given: 1, used: 3, usedInWars: 1, net: -1 });
  assert.equal(board({ roster, lines, viewerId: "15" }).you, null, "nothing given or used in the window");
});

test("a viewer who is not on today's roster still sees their figures, unranked", () => {
  const b = board({ roster: [member(1, "Ann")], lines: fills(99, 2), viewerId: "99" });
  assert.deepEqual(b.you, { rank: null, of: 1, given: 2, used: 0, usedInWars: 0, net: 2 });
});

test("all time starts where the history reaches; the type filter reaches the lists", () => {
  const roster = [member(1, "Ann")];
  const lines = [L("fill", 1, 200, { type: "A+" }), L("fill", 1, 400, { type: "A+" }), L("fill", 1, 1, { type: "O+" })];
  assert.equal(board({ roster, lines, window: "all" }).topGiven[0].value, 2);
  assert.equal(board({ roster, lines, window: "all", type: "A+" }).topGiven[0].value, 1);
  assert.deepEqual(board({ roster, lines, window: "all", type: "B-" }).topGiven, []);
});
```

- [ ] **Step 2: Watch them fail**

```bash
cd /opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board/ov && node --test blood-bags-model.test.js 2>&1 | grep -E "^(not ok|# (tests|pass|fail))|error: '"
```

Expected: `# tests 30`, `# pass 23`, `# fail 7`. Each new test fails with `model.buildBoard is not a function`.

- [ ] **Step 3: Write the board**

Append this to the end of `$WS/ov/blood-bags-model.js`, after a blank line:

```js
// ── The board ──────────────────────────────────────────────────────────────
const LIST_SIZE = 10;
const ZERO = Object.freeze({ given: 0, used: 0, usedInWars: 0, net: 0 });

// Ties go by name, ignoring case, then by id, so a tie always reads the same.
function byName(a, b) {
  const x = a.name.toLowerCase(), y = b.name.toLowerCase();
  if (x !== y) return x < y ? -1 : 1;
  return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
}
function ranked(rows, key) {
  return rows.slice(0, LIST_SIZE).map((r, i) => ({ rank: i + 1, playerId: r.playerId, name: r.name, value: r[key] }));
}

/**
 * Everything the page shows for one timeframe and blood type:
 *   { window, type, fromSec, toSec, overview, topGiven, topNet, wall, you }
 * lines are stored blood lines ({ ts, kind, type, qty, playerId, toId }),
 * roster today's members ([{ playerId, name }]) and wars Torn's ranked-war list
 * ([{ id, start, end }]). The lists hold current members only; the overview
 * counts everyone, former members too, so its totals match the armoury.
 */
export function buildBoard({ lines, roster, wars, nowSec, window, type, viewerId, reachSec }) {
  const { fromSec, toSec } = windowRange(window, nowSec, reachSec);
  const per = tally(lines, { fromSec, toSec, type, warSpans: warSpans(wars, nowSec) });

  const overview = { given: 0, used: 0, usedInWars: 0, net: 0, members: (roster || []).length };
  for (const r of per.values()) {
    overview.given += r.given;
    overview.used += r.used;
    overview.usedInWars += r.usedInWars;
    overview.net += r.net;
  }

  const members = (roster || []).map((m) => {
    const id = String(m.playerId);
    return { playerId: id, name: String(m.name || id), ...(per.get(id) || ZERO) };
  });
  const topGiven = members.filter((m) => m.given > 0).sort((a, b) => b.given - a.given || byName(a, b));
  const topNet = members.filter((m) => m.net > 0).sort((a, b) => b.net - a.net || byName(a, b));
  const wall = members.filter((m) => m.net < 0).sort((a, b) => a.net - b.net || byName(a, b));

  // The viewer's own line, even outside the top ten: their place among the
  // whole roster by net. Someone not on today's roster gets no place.
  let you = null;
  const mine = per.get(String(viewerId));
  if (mine && (mine.given || mine.used)) {
    const order = members.slice().sort((a, b) => b.net - a.net || byName(a, b));
    const at = order.findIndex((m) => m.playerId === String(viewerId));
    you = { rank: at >= 0 ? at + 1 : null, of: members.length, ...mine };
  }

  return {
    window, type, fromSec, toSec, overview,
    topGiven: ranked(topGiven, "given"),
    topNet: ranked(topNet, "net"),
    wall: ranked(wall, "net"),
    you,
  };
}
```

- [ ] **Step 4: Watch them pass**

```bash
cd /opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board/ov && node --test blood-bags-model.test.js 2>&1 | grep -E '^(not ok|# (tests|pass|fail))'
```

Expected: `# tests 30`, `# pass 30`, `# fail 0`.

- [ ] **Step 5: Install, run in place, and commit**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board
install -o root -g root -m 644 $WS/ov/blood-bags-model.js $WS/ov/blood-bags-model.test.js /opt/warboard/server/
cd /opt/warboard/server && node --test blood-bags-model.test.js 2>&1 | grep -E '^(not ok|# (tests|pass|fail))'
```

Expected: `# tests 30`, `# pass 30`, `# fail 0`. Then:

```bash
cd /opt/warboard && git commit -q -F - -- server/blood-bags-model.js server/blood-bags-model.test.js <<'MSG'
Blood-bag board: the lists, the overview and the viewer's own line

buildBoard turns stored lines, today's roster and the ranked-war list
into what the page shows for one timeframe and blood type: the overview
over everyone, former members too; Top 10 Contributors, Top 10 Net
Contributors and the Wall of Shame, current members only, ties by name;
and the viewer's place by net among the whole roster.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
git log --oneline -1
```

### Task 4: The collector's store and the hourly poll

**Files:**
- Create: `$WS/ov/blood-bags.js` and `$WS/ov/blood-bags.test.js`. Step 5 installs them.

**Interfaces:**
- Consumes: Task 1's `parseLine` and `isUnreadBloodLine`; `store.getFactionApiKey(factionId)`, which returns the key or null (null too while the key is quarantined); `logCall(key, url, source, status)` from `key-usage-log.js`, an in-memory log of Torn calls.
- Produces, from `blood-bags.js`:
  - `FACTION = "42055"`, `CATS = ["armoryAction", "armoryDeposit"]`, `GAP_MS = 6000`, `HEAD_MAX_PAGES = 10`, and `defaultDataDir()`, which is `$DATA_DIR/blood-bags`, or `server/data/blood-bags` when `DATA_DIR` is unset, worked out when called.
  - `createBloodBagCollector(opts)`. Every option is optional: `{ dataDir, fetchImpl, nowFn() → ms, sleepFn(ms), keyFn() → key or null, log(msg) }`. Nothing is read, written or scheduled until a method is called. It returns `{ load, save, pollOnce, snapshot }`.
    - `pollOnce()` resolves to true when both categories succeeded.
    - `snapshot()` returns `{ lines, wars, lastPollAt, reachSec, backfillDone, cutoffSec, cats }`. `lines` are stored records, `{ ts, kind, playerId, name, type, qty, toId, toName }`. `lastPollAt` is in ms, or null. `reachSec` is null before the first poll.
  - The store file: `{ version: 1, factionId, cutoffSec, lines: { [id]: record }, cats: { [cat]: { headTs, gaps: [{ from, to }] } }, wars, warsAt, lastPollAt }`.

- [ ] **Step 1: Write the failing tests**

Create `$WS/ov/blood-bags.test.js`:

```js
// The blood-bag collector against a fake Torn, a fake clock and a temporary
// folder. The fake serves news the way Torn does, checked live on 2026-10-24:
// newest first, 100 a page, `from` includes its own second and `to` leaves its
// own second out. Spec: docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// No blood-bags module may ever touch the live data folder from a test.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "blood-bags-test-"));
const { createBloodBagCollector, GAP_MS, HEAD_MAX_PAGES } = await import("./blood-bags.js");

const T0 = 1792800000;                      // now, in seconds: 2026-10-24 00:00 UTC
const DAY = 86400;
const CUTOFF = Math.floor(T0 / DAY) * DAY - 365 * DAY;
const who = (id, name) => `<a href = "http://www.torn.com/profiles.php?XID=${id}">${name}</a>`;
const FILL = (id) => `${who(id, "P" + id)} filled one of the faction's Empty Blood Bags to create a Blood Bag : O+`;
const USE = (id) => `${who(id, "P" + id)} used one of the faction's Blood Bag : A- items`;
const XANAX = (id) => `${who(id, "P" + id)} used one of the faction's Xanax items`;

let lastId = 5000000;
const entry = (timestamp, text) => ({ id: String(++lastId), timestamp, text });
// n action lines, one every `step` seconds going back from `newest`; every
// other one is a blood bag.
function actions(n, newest, step = 600) {
  return Array.from({ length: n }, (_, i) => entry(newest - i * step, i % 2 ? XANAX(i) : (i % 4 ? USE(i) : FILL(i))));
}

const reply = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) });
function fakeTorn({ action = [], deposit = [], wars = [] } = {}) {
  const t = { news: { armoryAction: action, armoryDeposit: deposit }, wars, calls: [], fail: null };
  t.fetchImpl = async (url, init) => {
    const u = new URL(url);
    const call = { url: u, auth: init && init.headers && init.headers.Authorization, at: t.clock ? t.clock.now : 0 };
    t.calls.push(call);
    const failed = t.fail && t.fail(u, t.calls.length);
    if (failed) return failed;
    if (u.pathname === "/v2/faction/news") {
      const q = u.searchParams;
      const from = q.has("from") ? Number(q.get("from")) : -Infinity;
      const to = q.has("to") ? Number(q.get("to")) : Infinity;
      const news = t.news[q.get("cat")]
        .filter((e) => e.timestamp >= from && e.timestamp < to)
        .sort((a, b) => b.timestamp - a.timestamp || Number(b.id) - Number(a.id))
        .slice(0, Number(q.get("limit")));
      return reply({ news, _metadata: { links: { prev: null, next: null } } });
    }
    if (u.pathname === "/v2/faction/42055/rankedwars") return reply({ rankedwars: t.wars });
    return reply({ error: { code: 0, error: "Unknown path" } });
  };
  return t;
}
const newsCalls = (t, cat) => t.calls.filter((c) => c.url.pathname === "/v2/faction/news" && (!cat || c.url.searchParams.get("cat") === cat));

function setup({ torn = fakeTorn(), key = "test-key-bb", dataDir } = {}) {
  const clock = { now: T0 * 1000, slept: [] };
  torn.clock = clock;
  const logs = [];
  const dir = dataDir || mkdtempSync(join(tmpdir(), "blood-bags-"));
  const make = () => createBloodBagCollector({
    dataDir: dir, fetchImpl: torn.fetchImpl, nowFn: () => clock.now,
    sleepFn: async (ms) => { clock.slept.push(ms); clock.now += ms; },
    keyFn: () => key, log: (m) => logs.push(m),
  });
  return { c: make(), make, torn, clock, logs, dir };
}

// ── the poll ────────────────────────────────────────────────────────────────
test("the first poll takes one page of each category and leaves the year below to the backfill", async () => {
  const torn = fakeTorn({
    action: actions(250, T0 - 60),
    deposit: [
      entry(T0 - 3600, `${who(7, "P7")} deposited 6x Blood Bag : O+`),
      entry(T0 - 7200, `${who(8, "P8")} deposited 40x Empty Blood Bag`),
      entry(T0 - 9000, `${who(9, "P9")} deposited 1 x Blood Bag : Irradiated`),
    ],
  });
  const { c, clock } = setup({ torn });
  assert.equal(await c.pollOnce(), true);

  const calls = newsCalls(torn);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    const q = call.url.searchParams;
    assert.deepEqual([q.get("limit"), q.get("sort"), q.get("stripTags"), q.get("comment")], ["100", "DESC", "false", "wb-bloodbags"]);
    assert.equal(q.has("from") || q.has("to") || q.has("key"), false);
    assert.equal(call.auth, "ApiKey test-key-bb");
  }

  const snap = c.snapshot();
  assert.equal(snap.lines.length, 50 + 1, "the blood lines among the newest 100 actions, and one deposit");
  assert.equal(snap.lastPollAt, clock.now);
  const oldestOnPage = T0 - 60 - 99 * 600;
  assert.deepEqual(snap.cats.armoryAction, { headTs: T0 - 60, gaps: [{ from: CUTOFF, to: oldestOnPage + 1 }] });
  assert.deepEqual(snap.cats.armoryDeposit, { headTs: T0 - 3600, gaps: [] });
  assert.equal(snap.reachSec, oldestOnPage + 1);
  assert.equal(snap.backfillDone, false);
});

test("the next poll asks only from the newest second it has, and stops there", async () => {
  const torn = fakeTorn({ action: actions(120, T0 - 3600), deposit: [] });
  const { c } = setup({ torn });
  await c.pollOnce();
  torn.news.armoryAction.push(entry(T0 - 10, FILL(1)), entry(T0 - 20, USE(2)), entry(T0 - 30, XANAX(3)));
  const before = c.snapshot().lines.length;
  torn.calls.length = 0;
  await c.pollOnce();
  const calls = newsCalls(torn, "armoryAction");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.searchParams.get("from"), String(T0 - 3600));
  assert.equal(c.snapshot().lines.length, before + 2);
  assert.equal(c.snapshot().cats.armoryAction.headTs, T0 - 10);
});

test("a page edge inside one second loses nothing and repeats nothing", async () => {
  const torn = fakeTorn({ action: [entry(T0 - 9000, FILL(1))], deposit: [] });
  const { c } = setup({ torn });
  await c.pollOnce();
  // 98 newer lines, then 5 fills sharing one second: the first page ends on two of them.
  const S = T0 - 5000;
  const fresh = [...actions(98, T0 - 10, 30), ...Array.from({ length: 5 }, (_, i) => entry(S, FILL(100 + i)))];
  torn.news.armoryAction.push(...fresh);
  torn.calls.length = 0;
  await c.pollOnce();
  const calls = newsCalls(torn, "armoryAction");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url.searchParams.get("to"), String(S + 1), "the next page keeps the rest of that second");
  const ids = c.snapshot().lines.map((l) => l.playerId).filter((p) => Number(p) >= 100);
  assert.deepEqual(ids.sort(), ["100", "101", "102", "103", "104"]);
});

test("a full page inside one second steps past that second and says so", async () => {
  const torn = fakeTorn({ action: [entry(T0 - 9000, FILL(1))], deposit: [] });
  const { c, logs } = setup({ torn });
  await c.pollOnce();
  const S = T0 - 100;
  torn.news.armoryAction.push(...Array.from({ length: 150 }, (_, i) => entry(S, FILL(200 + i))));
  torn.calls.length = 0;
  assert.equal(await c.pollOnce(), true);
  assert.equal(newsCalls(torn, "armoryAction").length, 3);
  assert.equal(newsCalls(torn, "armoryAction")[2].url.searchParams.get("to"), String(S));
  assert.equal(c.snapshot().lines.length, 1 + 100);
  assert.ok(logs.some((m) => m.includes(`a full page at second ${S}`)), logs.join("\n"));
});

test("a long outage: the poll stops after ten pages and hands the rest to the backfill", async () => {
  const torn = fakeTorn({ action: [entry(T0 - 30 * DAY, FILL(1))], deposit: [] });
  const { c, logs } = setup({ torn });
  await c.pollOnce();
  torn.news.armoryAction.push(...actions(1500, T0 - 60, 60));
  torn.calls.length = 0;
  await c.pollOnce();
  assert.equal(newsCalls(torn, "armoryAction").length, HEAD_MAX_PAGES);
  const cat = c.snapshot().cats.armoryAction;
  assert.equal(cat.headTs, T0 - 60);
  // Each page after the first repeats the oldest second of the one before (that
  // is what keeps lines sharing a second), so ten pages reach the 991st new
  // line, and the gap starts just above it.
  assert.deepEqual(cat.gaps, [{ from: T0 - 30 * DAY, to: T0 - 60 - 990 * 60 + 1 }]);
  assert.ok(logs.some((m) => m.includes("stopped after 10 pages")));
});

test("Torn's error in a 200 reply keeps the data, is logged, and leaves the update time alone", async () => {
  const torn = fakeTorn({ action: actions(10, T0 - 60), deposit: [] });
  const { c, clock, logs } = setup({ torn });
  await c.pollOnce();
  const { lastPollAt, lines } = c.snapshot();
  torn.fail = () => reply({ error: { code: 5, error: "Too many requests" } });
  clock.now += 3600 * 1000;
  assert.equal(await c.pollOnce(), false);
  assert.equal(c.snapshot().lastPollAt, lastPollAt);
  assert.equal(c.snapshot().lines.length, lines.length);
  assert.ok(logs.some((m) => m.includes("Too many requests (code 5)")));
});

test("with no key on file the poll makes no call and says so once", async () => {
  const { c, torn, logs } = setup({ key: null });
  assert.equal(await c.pollOnce(), false);
  assert.equal(await c.pollOnce(), false);
  assert.equal(torn.calls.length, 0);
  assert.equal(logs.filter((m) => m.includes("no faction key")).length, 1);
});

test("lines older than the year are not kept", async () => {
  const torn = fakeTorn({ action: [], deposit: [
    entry(T0 - 10 * DAY, `${who(7, "P7")} deposited 2x Blood Bag : O+`),
    entry(T0 - 400 * DAY, `${who(7, "P7")} deposited 9x Blood Bag : O+`),
  ] });
  const { c } = setup({ torn });
  await c.pollOnce();
  assert.deepEqual(c.snapshot().lines.map((l) => l.qty), [2]);
});

test("a blood line in a wording the reader has not met is logged once", async () => {
  const odd = `${who(5, "P5")} donated 2x Blood Bag : O+ to the hospital`;
  const torn = fakeTorn({ action: [entry(T0 - 60, odd), entry(T0 - 120, FILL(6))], deposit: [] });
  const { c, logs } = setup({ torn });
  await c.pollOnce();
  await c.pollOnce();
  assert.equal(logs.filter((m) => m.includes("donated 2x Blood Bag")).length, 1);
});

test("a restart reads back what was stored, and no temporary file is left behind", async () => {
  const torn = fakeTorn({ action: actions(150, T0 - 60), deposit: [] });
  const { c, make, dir } = setup({ torn });
  await c.pollOnce();
  const again = make().snapshot();
  assert.equal(again.lines.length, c.snapshot().lines.length);
  assert.deepEqual(again.cats, c.snapshot().cats);
  assert.deepEqual(readdirSync(dir), ["42055.json"]);
});

test("a store that will not read is set aside, not written over", async () => {
  const dir = mkdtempSync(join(tmpdir(), "blood-bags-"));
  writeFileSync(join(dir, "42055.json"), "{ not json");
  const { c, logs } = setup({ dataDir: dir });
  assert.equal(c.snapshot().lines.length, 0);
  const files = readdirSync(dir);
  assert.equal(files.length, 1);
  assert.match(files[0], /^42055\.json\.unreadable-\d+$/);
  assert.equal(readFileSync(join(dir, files[0]), "utf8"), "{ not json");
  assert.ok(logs.some((m) => m.includes("store unreadable")));
});
```

- [ ] **Step 2: Watch them fail**

```bash
cd /opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board/ov && node --test blood-bags.test.js 2>&1 | grep -E 'ERR_|^# (tests|pass|fail)'
```

Expected: `# tests 1` and `# fail 1`, from `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/ov/blood-bags.js' imported from …/ov/blood-bags.test.js`.

- [ ] **Step 3: Write the collector**

Create `$WS/ov/blood-bags.js`:

```js
// Blood-bag lines from the faction's armoury news, for /bloodbags.
//
// Torn keeps years of armoury news but hands it out 100 lines at a time, newest
// first, so this keeps its own copy of just the blood-bag lines. An hourly poll
// picks up what is new. A one-off backfill walks a year back, at no more than
// 10 calls a minute and never while a ranked war is live, so the war pollers
// keep the key's budget. Both write one store, and a line's own id decides what
// is a repeat. Spec: docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md
//
// Every Torn call sends the key in the Authorization header, never in the URL,
// is tagged comment=wb-bloodbags in Torn's own log, and is recorded in
// warboard's key-usage log. The key is the owner's faction key, never a pooled
// member key, as /slackers does.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as store from "./store.js";
import { logCall } from "./key-usage-log.js";
import { parseLine, isUnreadBloodLine } from "./blood-bags-model.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const FACTION = "42055";
// Fills, uses and hand-outs are armoryAction; deposits are armoryDeposit.
export const CATS = ["armoryAction", "armoryDeposit"];
const PAGE = 100;
// Every call this module makes waits its turn behind the one before, at least
// this far apart: 10 a minute for the poll and the backfill together.
export const GAP_MS = 6000;
// An hour of news fits in one page. Ten pages is about three days of it, so the
// cap only bites after a long outage, and what it leaves goes to the backfill.
export const HEAD_MAX_PAGES = 10;
const BACKFILL_DAYS = 365;
const DAY = 86400;

// Worked out at call time, so a test that sets DATA_DIR first never touches the
// live folder. The store sits in its own folder, as chain-hits and gym-energy do.
export const defaultDataDir = () => join(process.env.DATA_DIR || join(__dirname, "data"), "blood-bags");

/**
 * The collector. Everything it touches comes in through opts, so a test can run
 * it against a fake Torn, a fake clock and a temporary folder:
 *   dataDir, fetchImpl, nowFn() -> ms, sleepFn(ms), keyFn() -> key or null, log(msg)
 * Nothing is read, written or scheduled until a method is called.
 *
 * The store, data/blood-bags/42055.json:
 *   lines       { [line id]: { ts, kind, type, qty, playerId, name, toId, toName } }
 *   cats        per category: headTs, the newest second the poll has reached, and
 *               gaps, the [from, to) ranges still to fetch (the backfill's work)
 *   cutoffSec   365 days before the UTC day the store was started
 *   wars        Torn's ranked-war list, as [{ id, start, end }], and warsAt
 *   lastPollAt  when the last poll of both categories succeeded (ms)
 */
export function createBloodBagCollector(opts = {}) {
  const dir = () => opts.dataDir || defaultDataDir();
  const fetchImpl = opts.fetchImpl || ((url, init) => fetch(url, init));
  const nowFn = opts.nowFn || (() => Date.now());
  const sleepFn = opts.sleepFn || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const keyFn = opts.keyFn || (() => store.getFactionApiKey(FACTION));
  const log = opts.log || ((msg) => console.log(msg));
  const nowSec = () => Math.floor(nowFn() / 1000);
  const file = () => join(dir(), `${FACTION}.json`);

  let data = null;
  let lineList = null;
  let lastCallAt = -Infinity;
  let queue = Promise.resolve();
  let keyMissingLogged = false;
  const unreadLogged = new Set();

  function fresh() {
    const today = Math.floor(nowSec() / DAY) * DAY;
    return {
      version: 1, factionId: FACTION, cutoffSec: today - BACKFILL_DAYS * DAY,
      lines: {}, cats: Object.fromEntries(CATS.map((c) => [c, { headTs: null, gaps: [] }])),
      wars: [], warsAt: 0, lastPollAt: null,
    };
  }

  function load() {
    if (data) return data;
    try {
      const raw = JSON.parse(readFileSync(file(), "utf8"));
      if (!raw || raw.version !== 1 || !raw.lines || !raw.cats) throw new Error("not a blood-bag store");
      data = raw;
      for (const c of CATS) data.cats[c] = data.cats[c] || { headTs: null, gaps: [] };
    } catch (err) {
      if (err.code !== "ENOENT") {
        // Set aside rather than written over, so it can be looked at; the board
        // starts again from the news.
        log(`[blood-bags] store unreadable (${err.message}); starting afresh`);
        try { renameSync(file(), `${file()}.unreadable-${nowFn()}`); } catch (_) { /* already gone */ }
      }
      data = fresh();
    }
    return data;
  }

  // A temporary file and a rename, so a restart mid-write never leaves half a store.
  function save() {
    if (!data) return;
    mkdirSync(dir(), { recursive: true });
    const tmp = `${file()}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, file());
  }

  function pace() {
    const turn = queue.then(async () => {
      const wait = lastCallAt + GAP_MS - nowFn();
      if (wait > 0) await sleepFn(wait);
      lastCallAt = nowFn();
    });
    queue = turn.catch(() => {});
    return turn;
  }

  // One Torn v2 call. Throws on any failure, with err.code set to Torn's error
  // code, or "no-key" when there is no usable key.
  async function tornGet(path, params) {
    const key = keyFn();
    if (!key) {
      const err = new Error("no faction key on file, or it is quarantined");
      err.code = "no-key";
      throw err;
    }
    const url = `https://api.torn.com/v2${path}?${new URLSearchParams({ ...params, comment: "wb-bloodbags" })}`;
    await pace();
    let res, text;
    try {
      res = await fetchImpl(url, { headers: { Authorization: `ApiKey ${key}` }, signal: AbortSignal.timeout(30000) });
      text = await res.text();
    } catch (e) {
      logCall(key, url, "blood-bags", "network");
      throw new Error(`network: ${e.message}`);
    }
    let body = null;
    try { body = JSON.parse(text); } catch (_) { /* judged by the status below */ }
    // Torn reports errors in the body, usually with HTTP 200.
    if (body && body.error) {
      logCall(key, url, "blood-bags", body.error.code);
      const err = new Error(`Torn API error: ${body.error.error} (code ${body.error.code})`);
      err.code = body.error.code;
      throw err;
    }
    logCall(key, url, "blood-bags", res.status);
    if (!res.ok || !body) throw new Error(`HTTP ${res.status}`);
    keyMissingLogged = false;
    return body;
  }

  function fail(what, err) {
    if (err.code === "no-key") {
      if (!keyMissingLogged) log(`[blood-bags] no faction key for ${FACTION}; trying again next hour`);
      keyMissingLogged = true;
      return;
    }
    log(`[blood-bags] ${what} failed: ${err.message}`);
  }

  // Keeps a news entry if it is a blood line not already stored and inside the year.
  function keep(e) {
    const id = String(e.id);
    const ts = Number(e.timestamp) || 0;
    if (data.lines[id] || ts < data.cutoffSec) return;
    const rec = parseLine(e.text);
    if (!rec) {
      if (isUnreadBloodLine(e.text) && !unreadLogged.has(id)) {
        unreadLogged.add(id);
        log(`[blood-bags] unread blood line ${id}: ${e.text}`);
      }
      return;
    }
    data.lines[id] = { ts, ...rec };
    lineList = null;
  }

  /**
   * Walks [from, to) newest first, at most maxPages pages, keeping blood lines.
   * Torn's `from` includes its own second and `to` leaves its own second out
   * (checked live on 2026-10-24); null leaves that end open. Returns
   * { done, to, newest }: done when it reached `from` or the end of the news,
   * otherwise `to` is where to carry on; newest is the first page's newest second.
   */
  async function walk(cat, from, to, maxPages) {
    let newest = null;
    for (let page = 0; page < maxPages; page++) {
      const params = { cat, limit: String(PAGE), sort: "DESC", stripTags: "false" };
      if (from != null) params.from = String(from);
      if (to != null) params.to = String(to);
      const body = await tornGet("/faction/news", params);
      const news = Array.isArray(body.news) ? body.news : [];
      for (const e of news) keep(e);
      const stamps = news.map((e) => Number(e.timestamp) || 0);
      if (page === 0 && stamps.length) newest = Math.max(...stamps);
      if (news.length < PAGE) return { done: true, to, newest };
      const oldest = Math.min(...stamps);
      if (from != null && oldest < from) return { done: true, to, newest };
      // oldest + 1 keeps the rest of the oldest second for the next page, and
      // lines already stored are dropped by id. If that is where this page
      // started, the whole page is one second: step past it.
      let next = oldest + 1;
      if (to != null && next >= to) {
        log(`[blood-bags] ${cat}: a full page at second ${oldest}; stepping past it, so lines beyond the page may be missing`);
        next = oldest;
      }
      to = next;
    }
    return { done: false, to, newest };
  }

  /**
   * The hourly poll: each category from its newest line down to the newest
   * second already stored. The first ever poll takes one page and leaves the
   * year below it to the backfill. Returns true when both categories succeeded.
   */
  async function pollOnce() {
    load();
    let ok = true;
    for (const cat of CATS) {
      const c = data.cats[cat];
      try {
        if (c.headTs == null) {
          const r = await walk(cat, null, null, 1);
          c.headTs = r.newest ?? nowSec();
          if (!r.done && r.to > data.cutoffSec) c.gaps.push({ from: data.cutoffSec, to: r.to });
        } else {
          const r = await walk(cat, c.headTs, null, HEAD_MAX_PAGES);
          if (!r.done) {
            log(`[blood-bags] ${cat}: the poll stopped after ${HEAD_MAX_PAGES} pages; the backfill takes the rest`);
            c.gaps.push({ from: c.headTs, to: r.to });
          }
          if (r.newest != null) c.headTs = Math.max(c.headTs, r.newest);
        }
      } catch (err) {
        ok = false;
        fail(`${cat} poll`, err);
      }
    }
    if (ok) data.lastPollAt = nowFn();
    save();
    return ok;
  }

  /**
   * What the route reads: { lines, wars, lastPollAt, reachSec, backfillDone,
   * cutoffSec, cats }. reachSec is how far back the history is complete: the
   * year's floor once the backfill is done, the top of the newest gap until
   * then, null before the first poll.
   */
  function snapshot() {
    load();
    if (!lineList) lineList = Object.values(data.lines);
    const reachOf = (c) => (c.headTs == null ? null : c.gaps.length ? Math.max(...c.gaps.map((g) => g.to)) : data.cutoffSec);
    const reaches = CATS.map((cat) => reachOf(data.cats[cat]));
    const started = reaches.every((r) => r != null);
    return {
      lines: lineList,
      wars: data.wars,
      lastPollAt: data.lastPollAt,
      reachSec: started ? Math.max(...reaches) : null,
      backfillDone: started && CATS.every((cat) => data.cats[cat].gaps.length === 0),
      cutoffSec: data.cutoffSec,
      cats: JSON.parse(JSON.stringify(data.cats)),
    };
  }

  return { load, save, pollOnce, snapshot };
}
```

- [ ] **Step 4: Watch them pass**

```bash
cd /opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board/ov && node --test blood-bags.test.js 2>&1 | grep -E '^(not ok|# (tests|pass|fail))'
```

Expected: `# tests 11`, `# pass 11`, `# fail 0`.

- [ ] **Step 5: Install, run in place, and commit**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board
install -o root -g root -m 644 $WS/ov/blood-bags.js $WS/ov/blood-bags.test.js /opt/warboard/server/
cd /opt/warboard/server && node --test blood-bags.test.js 2>&1 | grep -E '^(not ok|# (tests|pass|fail))'; ls /opt/warboard/server/data/blood-bags 2>&1 | head -1
```

Expected: `# tests 11`, `# pass 11`, `# fail 0`, then `No such file or directory`: the tests never touched the live data folder. Then:

```bash
cd /opt/warboard && git add server/blood-bags.js server/blood-bags.test.js && git commit -q -F - -- server/blood-bags.js server/blood-bags.test.js <<'MSG'
Blood-bag board: collect the armoury's blood lines every hour

The collector keeps its own copy of just the blood-bag lines from the
faction's armoury news, in data/blood-bags/42055.json. A poll walks each
category from the newest line down to the newest second it already has,
100 lines a page, on the owner's faction key sent in the Authorization
header. A page edge inside one second loses nothing, a line's own id
decides what is a repeat, and Torn's errors in a 200 reply are caught.
A store that will not read is set aside, not written over.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
git log --oneline -1
```

### Task 5: The backfill, the war list and the hourly schedule

**Files:**
- Modify: `$WS/ov/blood-bags.test.js` (appended to) and `$WS/ov/blood-bags.js`. Step 5 installs them.

**Interfaces:**
- Consumes: Task 2's `liveWar`; Task 4's collector and its inner `walk`, `tornGet`, `fail`, `load`, `save` and `data`.
- Produces, from `blood-bags.js`:
  - `POLL_MS = 3600000`.
  - The collector gains `refreshWars()`, which resolves to true or false, plus `runBackfill()`, `tick()`, `start()` and `stop()`.
    - `runBackfill()` returns the run in progress, and only one runs at a time.
    - `start()` runs one tick now and then one an hour. A second `start()` does nothing.
  - Two new options: `setIntervalFn(fn, ms)` and `clearIntervalFn(timer)`.
  - `bloodBagCollector`, the instance the server runs, and `start()`, which starts it.

- [ ] **Step 1: Write the failing tests**

Append this to the end of `$WS/ov/blood-bags.test.js`, after a blank line:

```js
// ── the backfill, the war list and the schedule ─────────────────────────────
const HOUR_MS = 3600 * 1000;
const bloodIn = (torn, fromSec) => torn.news.armoryAction.concat(torn.news.armoryDeposit)
  .filter((e) => e.timestamp >= fromSec && /Blood Bag :/.test(e.text) && !/Irradiated/.test(e.text)).length;

test("the backfill fills the year below the first page, a call every 6 seconds, down to the year's floor", async () => {
  const torn = fakeTorn({
    action: actions(1000, T0 - 60, Math.round(0.4 * DAY)),
    deposit: [entry(T0 - 5 * DAY, `${who(7, "P7")} deposited 3x Blood Bag : B+`), entry(T0 - 380 * DAY, `${who(7, "P7")} deposited 9x Blood Bag : B+`)],
  });
  const { c } = setup({ torn });
  await c.pollOnce();
  await c.runBackfill();

  const backfill = newsCalls(torn).slice(2);
  assert.ok(backfill.length >= 6);
  for (const call of backfill) assert.equal(call.url.searchParams.get("from"), String(CUTOFF));
  const times = torn.calls.map((call) => call.at);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= GAP_MS, `call ${i} came ${times[i] - times[i - 1]} ms after the one before`);
  const snap = c.snapshot();
  assert.equal(snap.backfillDone, true);
  assert.equal(snap.reachSec, CUTOFF);
  assert.equal(snap.lines.length, bloodIn(torn, CUTOFF));
  assert.ok(snap.lines.every((l) => l.ts >= CUTOFF));
});

test("the backfill waits while a ranked war is live and carries on after it", async () => {
  const torn = fakeTorn({ action: actions(300, T0 - 60, 3600), deposit: [], wars: [{ id: 51418, start: T0 - DAY, end: 0 }] });
  const { c, clock, logs } = setup({ torn });
  await c.tick();
  await c.runBackfill();
  assert.equal(newsCalls(torn).length, 2, "the poll still runs; the backfill makes no call");
  assert.ok(logs.some((m) => m.includes("ranked war 51418 is live")));
  assert.equal(c.snapshot().backfillDone, false);

  torn.wars[0].end = T0 + 600;
  clock.now += HOUR_MS;
  await c.tick();
  await c.runBackfill();
  assert.equal(c.snapshot().backfillDone, true);
  assert.equal(c.snapshot().lines.length, bloodIn(torn, CUTOFF));
});

test("a Torn error mid-backfill keeps its place and never marks the backfill done", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [] });
  const { c, logs } = setup({ torn });
  await c.pollOnce();
  torn.fail = (u, n) => (n > 5 ? reply({ error: { code: 5, error: "Too many requests" } }) : null);
  await c.runBackfill();
  const snap = c.snapshot();
  assert.equal(snap.backfillDone, false);
  const lastGood = newsCalls(torn)[4];
  const pageOldest = Math.min(...torn.news.armoryAction
    .filter((e) => e.timestamp >= CUTOFF && e.timestamp < Number(lastGood.url.searchParams.get("to")))
    .sort((a, b) => b.timestamp - a.timestamp).slice(0, 100).map((e) => e.timestamp));
  assert.deepEqual(snap.cats.armoryAction.gaps, [{ from: CUTOFF, to: pageOldest + 1 }]);
  assert.ok(logs.some((m) => m.includes("backfill failed: Torn API error: Too many requests (code 5)")));
});

test("after a restart the backfill carries on from its saved place, with no repeats and no gap", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [] });
  const { c, make } = setup({ torn });
  await c.pollOnce();
  torn.fail = (u, n) => (n > 5 ? reply({ error: { code: 5, error: "Too many requests" } }) : null);
  await c.runBackfill();
  const saved = c.snapshot().cats.armoryAction.gaps[0].to;

  torn.fail = null;
  torn.calls.length = 0;
  const after = make();
  await after.runBackfill();
  assert.equal(newsCalls(torn)[0].url.searchParams.get("to"), String(saved), "it starts where the last one stopped");
  const snap = after.snapshot();
  assert.equal(snap.backfillDone, true);
  assert.equal(snap.lines.length, bloodIn(torn, CUTOFF));
});

test("the poll and the backfill share one pace", async () => {
  const torn = fakeTorn({ action: actions(1000, T0 - 60, Math.round(0.3 * DAY)), deposit: [] });
  const { c } = setup({ torn });
  await c.pollOnce();
  const running = c.runBackfill();
  await c.pollOnce();
  await running;
  const times = torn.calls.map((call) => call.at);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= GAP_MS);
  assert.equal(c.snapshot().backfillDone, true);
});

test("the war list is fetched hourly while the backfill has work, and daily once it is done", async () => {
  const torn = fakeTorn({ action: actions(300, T0 - 60, 3600), deposit: [], wars: [{ id: 7, start: T0 - DAY, end: 0 }] });
  const { c, clock } = setup({ torn });
  const warCalls = () => torn.calls.filter((call) => call.url.pathname.endsWith("/rankedwars")).length;
  await c.tick(); await c.runBackfill();
  assert.equal(warCalls(), 1);
  clock.now += HOUR_MS;
  await c.tick(); await c.runBackfill();
  assert.equal(warCalls(), 2, "hourly, so it sees the war end");

  torn.wars[0].end = T0;
  clock.now += HOUR_MS;
  await c.tick(); await c.runBackfill();
  assert.equal(warCalls(), 3);
  assert.equal(c.snapshot().backfillDone, true);
  clock.now += HOUR_MS;
  await c.tick();
  assert.equal(warCalls(), 3, "daily once the backfill is done");
  clock.now += 23 * HOUR_MS;
  await c.tick();
  assert.equal(warCalls(), 4);
});

test("start runs one tick at once and then every hour; stop ends it", async () => {
  const torn = fakeTorn({ action: actions(10, T0 - 60), deposit: [] });
  const timers = [];
  const clock = { now: T0 * 1000 };
  torn.clock = clock;
  const c = createBloodBagCollector({
    dataDir: mkdtempSync(join(tmpdir(), "blood-bags-")), fetchImpl: torn.fetchImpl, nowFn: () => clock.now,
    sleepFn: async (ms) => { clock.now += ms; }, keyFn: () => "k", log: () => {},
    setIntervalFn: (fn, ms) => { const t = { fn, ms, cleared: false }; timers.push(t); return t; },
    clearIntervalFn: (t) => { t.cleared = true; },
  });
  await c.start();
  await c.start();
  assert.equal(timers.length, 1, "a second start does nothing");
  assert.equal(timers[0].ms, HOUR_MS);
  assert.equal(newsCalls(torn).length, 2);
  c.stop();
  assert.equal(timers[0].cleared, true);
});
```

- [ ] **Step 2: Watch them fail**

```bash
cd /opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board/ov && node --test blood-bags.test.js 2>&1 | grep -E "^(not ok|# (tests|pass|fail))|error: '"
```

Expected: `# tests 18`, `# pass 11`, `# fail 7`. The 7 new tests fail with `c.runBackfill is not a function` (4 tests), `c.tick is not a function` (2) and `c.start is not a function` (1).

- [ ] **Step 3: Add the backfill, the war list and the schedule**

The edits are exact-once replacements. The script stops at the first old text that isn't found exactly once.

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board
python3 -I - $WS/ov/blood-bags.js <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
def rep(old, new):
    global s
    assert s.count(old) == 1, ("not exactly once", old[:60])
    s = s.replace(old, new)

rep('''import { parseLine, isUnreadBloodLine } from "./blood-bags-model.js";''',
    '''import { parseLine, isUnreadBloodLine, liveWar } from "./blood-bags-model.js";''')

rep('''const BACKFILL_DAYS = 365;
const DAY = 86400;
''', '''const BACKFILL_DAYS = 365;
const DAY = 86400;
export const POLL_MS = 60 * 60 * 1000;
// The war list is wanted daily, and hourly while the backfill has work, so the
// backfill sees a war start and end.
const WARS_DAILY_MS = 24 * 60 * 60 * 1000;
// The backfill saves every this many pages; a restart repeats at most these.
const SAVE_EVERY = 10;
''')

rep('''  const log = opts.log || ((msg) => console.log(msg));
''', '''  const log = opts.log || ((msg) => console.log(msg));
  const setIntervalFn = opts.setIntervalFn || ((fn, ms) => setInterval(fn, ms));
  const clearIntervalFn = opts.clearIntervalFn || ((t) => clearInterval(t));
''')

rep('''  let keyMissingLogged = false;
  const unreadLogged = new Set();
''', '''  let keyMissingLogged = false;
  const unreadLogged = new Set();
  let backfilling = null;
  let ticking = false;
  let timer = null;
''')

rep('''  return { load, save, pollOnce, snapshot };
}
''', '''  /** Torn's public ranked-war list for the faction; one call reaches back two years. */
  async function refreshWars() {
    load();
    try {
      const body = await tornGet(`/faction/${FACTION}/rankedwars`, {});
      const list = Array.isArray(body.rankedwars) ? body.rankedwars : [];
      data.wars = list.map((w) => ({ id: w.id, start: Number(w.start) || 0, end: Number(w.end) || 0 }));
      data.warsAt = nowFn();
      save();
      return true;
    } catch (err) {
      fail("war list", err);
      return false;
    }
  }

  const hasGaps = () => CATS.some((cat) => data.cats[cat].gaps.length > 0);

  // The newest gap first, so the history fills in from the present backwards.
  function nextGap() {
    let best = null;
    for (const cat of CATS) {
      for (const gap of data.cats[cat].gaps) if (!best || gap.to > best.gap.to) best = { cat, gap };
    }
    return best;
  }

  async function backfill() {
    load();
    let pages = 0;
    try {
      for (;;) {
        const next = nextGap();
        if (!next) break;
        const war = liveWar(data.wars, nowSec());
        if (war) {
          log(`[blood-bags] backfill waiting: ranked war ${war.id} is live`);
          break;
        }
        const r = await walk(next.cat, next.gap.from, next.gap.to, 1);
        if (r.done) data.cats[next.cat].gaps.splice(data.cats[next.cat].gaps.indexOf(next.gap), 1);
        else next.gap.to = r.to;
        if (++pages % SAVE_EVERY === 0) save();
      }
      if (pages && !hasGaps()) log(`[blood-bags] backfill done: history reaches ${new Date(data.cutoffSec * 1000).toISOString().slice(0, 10)}`);
    } catch (err) {
      // Its place is kept; the next hourly tick starts it again from there.
      fail("backfill", err);
    } finally {
      save();
    }
  }

  /**
   * The backfill: fills every gap, newest first, a page per call, GAP_MS apart.
   * It stops while a ranked war is live, and on any error, and the next hourly
   * tick starts it again from where it stopped. Returns the run in progress.
   */
  function runBackfill() {
    if (!backfilling) backfilling = backfill().finally(() => { backfilling = null; });
    return backfilling;
  }

  /** Every hour: the war list when it is due, the poll, then the backfill if there is work. */
  async function tick() {
    if (ticking) return;
    ticking = true;
    try {
      load();
      const every = hasGaps() ? POLL_MS : WARS_DAILY_MS;
      if (nowFn() - data.warsAt >= every - 60 * 1000) await refreshWars();
      await pollOnce();
      if (hasGaps()) runBackfill();
    } finally {
      ticking = false;
    }
  }

  /** One tick now, then one an hour. Starting twice does nothing. */
  function start() {
    if (timer) return Promise.resolve();
    timer = setIntervalFn(() => { tick().catch((e) => log(`[blood-bags] tick failed: ${e.message}`)); }, POLL_MS);
    return tick().catch((e) => log(`[blood-bags] tick failed: ${e.message}`));
  }

  function stop() {
    if (timer) clearIntervalFn(timer);
    timer = null;
  }

  return { load, save, pollOnce, snapshot, refreshWars, runBackfill, tick, start, stop };
}

// The one the server runs; routes.js reads it through createBloodBagsApi.
export const bloodBagCollector = createBloodBagCollector();

/** server.js starts the hourly poll and the backfill with this. */
export function start() {
  return bloodBagCollector.start();
}
''')
open(p, "w").write(s)
print("ok")
PY
```

Expected: `ok`.

- [ ] **Step 4: Watch them pass**

```bash
cd /opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board/ov && node --test blood-bags.test.js 2>&1 | grep -E '^(not ok|# (tests|pass|fail))'
```

Expected: `# tests 18`, `# pass 18`, `# fail 0`.

- [ ] **Step 5: Install, run in place, and commit**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board
install -o root -g root -m 644 $WS/ov/blood-bags.js $WS/ov/blood-bags.test.js /opt/warboard/server/
cd /opt/warboard/server && node --test blood-bags.test.js 2>&1 | grep -E '^(not ok|# (tests|pass|fail))'
```

Expected: `# tests 18`, `# pass 18`, `# fail 0`. Then:

```bash
cd /opt/warboard && git commit -q -F - -- server/blood-bags.js server/blood-bags.test.js <<'MSG'
Blood-bag board: a year of history, the war list and the hourly tick

The backfill fills the year below the first poll, newest gap first, a
page every 6 seconds alongside the poll, and saves its place as it goes.
It stops while a ranked war is live, and on any error, and the next
hourly tick carries on from where it stopped. Torn's ranked-war list is
read daily, and hourly while the backfill has work, so it sees a war
start and end. start() runs one tick now and one every hour.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
git log --oneline -1
```

### Task 6: `/api/bloodbags`

**Files:**
- Create: `$WS/ov/blood-bags-route.test.js`.
- Modify: `$WS/ov/blood-bags.js`. Step 6 installs both.

**Interfaces:**
- Consumes:
  - Task 2's `TYPES`, `WINDOWS`, `parseWindow`, `parseType` and `liveWar`; Task 3's `buildBoard`; Task 5's `bloodBagCollector`.
  - `fetchFactionBasic(factionId, key)` from `torn-api.js`, which returns Torn v1 faction basic, and `store.getFactionApiKey`.
  - `requireAuth` from `auth.js`. It answers 401 itself, and otherwise sets `req.user` to the token's claims (`auth.js:177`): `playerId`, `factionId` (a number, from Torn), `playerName` and `factionPosition`.
- Produces, from `blood-bags.js`:
  - `OWNER_ID = "137558"` and `NOT_A_MEMBER = "This board is for Dead Fragment members."`.
  - `rosterFromBasic(basic)` returns `[{ playerId, name }]`.
  - `createBloodBagsApi(opts)` returns `{ handle(req, res) }`. Every option is optional: `{ collector, rosterFn() → Promise of [{ playerId, name }], nowFn() → ms, log(msg) }`. `handle` always sets `Cache-Control: no-store` and answers:
    - 200: the board, plus `updatedAt`, `reachSec`, `backfillDone`, `liveWar`, `windows`, `types` and `rosterStale`;
    - 400: `{ error: "Unknown timeframe." }` or `{ error: "Unknown blood type." }`;
    - 403: `{ error: NOT_A_MEMBER }`;
    - 502: `{ error: "The member list is unavailable right now." }`;
    - 500: `{ error: "internal error" }`.

- [ ] **Step 1: Write the failing tests**

Create `$WS/ov/blood-bags-route.test.js`. Its `readFileSync` and `vm` imports are for Task 8's wiring tests.

```js
// /api/bloodbags: who may read the board, what a request may ask for, and what
// it answers. A stub collector and roster, so no Torn and no data folder.
// Spec: docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "blood-bags-route-test-"));
const { createBloodBagsApi, NOT_A_MEMBER, rosterFromBasic } = await import("./blood-bags.js");
const { requireAuth } = await import("./auth.js");

const NOW = 1792800000;
const MIN_MS = 60 * 1000;
const MEMBERS = [{ playerId: "1", name: "Ann" }, { playerId: "2", name: "Bob" }, { playerId: "137558", name: "RussianRob" }];
const LINES = [
  { ts: NOW - 3600, kind: "fill", type: "O+", qty: 1, playerId: "1", toId: null },
  { ts: NOW - 1800, kind: "use", type: "A-", qty: 1, playerId: "2", toId: null },
];

function setup({ roster = MEMBERS, snapshot } = {}) {
  const clock = { now: NOW * 1000 };
  const state = { roster, fail: false, calls: 0 };
  const collector = {
    snapshot: snapshot || (() => ({
      lines: LINES, wars: [], lastPollAt: NOW * 1000 - 10 * MIN_MS,
      reachSec: NOW - 30 * 86400, backfillDone: false, cutoffSec: NOW - 365 * 86400,
    })),
  };
  const api = createBloodBagsApi({
    collector, nowFn: () => clock.now, log: () => {},
    rosterFn: async () => {
      state.calls++;
      if (state.fail) throw new Error("Torn is down");
      return state.roster;
    },
  });
  return { api, clock, state };
}
function stubRes() {
  return {
    statusCode: 200, headers: {}, body: undefined,
    set(k, v) { this.headers[k] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}
async function get(api, user, query = {}) {
  const res = stubRes();
  await api.handle({ user, query }, res);
  return res;
}
// What POST /api/auth puts in the token; Torn's faction id arrives as a number.
const token = (playerId, factionId = 42055) => ({ playerId, playerName: "P" + playerId, factionId, factionPosition: "Member" });

test("a Dead Fragment member gets the board, never cached", async () => {
  const { api } = setup();
  const res = await get(api, token(1));
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["Cache-Control"], "no-store");
  assert.deepEqual(res.body.topGiven, [{ rank: 1, playerId: "1", name: "Ann", value: 1 }]);
  assert.deepEqual(res.body.wall, [{ rank: 1, playerId: "2", name: "Bob", value: -1 }]);
});

test("a member of another faction is refused", async () => {
  const { api, state } = setup();
  const res = await get(api, token(9, 12345));
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { error: "This board is for Dead Fragment members." });
  assert.equal(NOT_A_MEMBER, "This board is for Dead Fragment members.");
  assert.equal(state.calls, 0, "refused before any roster call");
});

test("the owner gets the board whatever faction the token names", async () => {
  const { api } = setup();
  assert.equal((await get(api, token(137558, 999))).statusCode, 200);
  assert.equal((await get(api, token("137558", "999"))).statusCode, 200);
});

test("with no token requireAuth answers 401 before the board is reached", () => {
  const res = stubRes();
  let reached = false;
  requireAuth({ headers: {} }, res, () => { reached = true; });
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Missing Authorization header" });
  assert.equal(reached, false);
});

test("an unknown timeframe or blood type is a 400; a + that arrived as a space still reads", async () => {
  const { api } = setup();
  assert.deepEqual([(await get(api, token(1), { window: "1y" })).statusCode, (await get(api, token(1), { window: "1y" })).body],
    [400, { error: "Unknown timeframe." }]);
  assert.deepEqual((await get(api, token(1), { type: "C+" })).body, { error: "Unknown blood type." });
  const plus = await get(api, token(1), { window: "24h", type: "A " });
  assert.equal(plus.statusCode, 200);
  assert.deepEqual([plus.body.window, plus.body.type], ["24h", "A+"]);
});

test("a token that names Dead Fragment but whose holder has left is refused, after a fresh look at the roster", async () => {
  const { api, clock, state } = setup();
  assert.equal((await get(api, token(5))).statusCode, 403);
  assert.equal(state.calls, 1, "the roster was fetched just now, so no second look");
  clock.now += 6 * MIN_MS;
  assert.equal((await get(api, token(5))).statusCode, 403);
  assert.equal(state.calls, 2, "older than 5 minutes: looked at again before refusing");
});

test("a member who joined since the roster was fetched gets in", async () => {
  const { api, clock, state } = setup();
  await get(api, token(1));
  state.roster = [...MEMBERS, { playerId: "5", name: "Newbie" }];
  clock.now += 6 * MIN_MS;
  const res = await get(api, token(5));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.overview.members, 4);
});

test("the roster is cached for an hour", async () => {
  const { api, clock, state } = setup();
  await get(api, token(1));
  clock.now += 30 * MIN_MS;
  await get(api, token(1));
  assert.equal(state.calls, 1);
  clock.now += 31 * MIN_MS;
  await get(api, token(1));
  assert.equal(state.calls, 2);
});

test("a failed roster refresh keeps the last list, marked stale, and waits 5 minutes to try again", async () => {
  const { api, clock, state } = setup();
  await get(api, token(1));
  state.fail = true;
  clock.now += 61 * MIN_MS;
  const res = await get(api, token(1));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.rosterStale, true);
  clock.now += 2 * MIN_MS;
  await get(api, token(1));
  assert.equal(state.calls, 2);
});

test("with no roster at all the board says so", async () => {
  const { api, state } = setup();
  state.fail = true;
  const res = await get(api, token(1));
  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.body, { error: "The member list is unavailable right now." });
});

test("the answer carries everything the page reads", async () => {
  const { api } = setup({ snapshot: () => ({
    lines: LINES, wars: [{ id: 51418, start: NOW - 86400, end: 0 }], lastPollAt: NOW * 1000 - 10 * MIN_MS,
    reachSec: NOW - 30 * 86400, backfillDone: false, cutoffSec: NOW - 365 * 86400,
  }) });
  const { body } = await get(api, token(2), { window: "all" });
  assert.deepEqual(Object.keys(body).sort(), [
    "backfillDone", "fromSec", "liveWar", "overview", "reachSec", "rosterStale", "toSec", "topGiven", "topNet",
    "type", "types", "updatedAt", "wall", "window", "windows", "you",
  ]);
  assert.deepEqual(body.windows, ["24h", "7d", "30d", "90d", "all"]);
  assert.deepEqual(body.types, ["all", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);
  assert.deepEqual(body.liveWar, { id: 51418, start: NOW - 86400 });
  assert.equal(body.fromSec, NOW - 30 * 86400, "all time starts where the history reaches");
  assert.equal(body.updatedAt, NOW * 1000 - 10 * MIN_MS);
  assert.deepEqual(body.overview, { given: 1, used: 1, usedInWars: 1, net: 1, members: 3 });
  // Bob's one use fell inside the live war: used, but not against his net. He ties
  // RussianRob on 0, and the tie goes by name.
  assert.deepEqual(body.you, { rank: 2, of: 3, given: 0, used: 1, usedInWars: 1, net: 0 });
});

test("before the first poll the board answers with no data rather than an error", async () => {
  const { api } = setup({ snapshot: () => ({ lines: [], wars: [], lastPollAt: null, reachSec: null, backfillDone: false, cutoffSec: NOW - 365 * 86400 }) });
  const res = await get(api, token(1), { window: "all" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.updatedAt, null);
  assert.equal(res.body.reachSec, null);
  assert.deepEqual(res.body.overview, { given: 0, used: 0, usedInWars: 0, net: 0, members: 3 });
});

test("an error inside becomes a 500 in JSON, never a rejection", async () => {
  const { api } = setup({ snapshot: () => { throw new Error("boom"); } });
  const res = await get(api, token(1));
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: "internal error" });
});

test("the roster is read from Torn's faction basic, whose members are keyed by player id", () => {
  // The shape fetchFactionBasic returns (Torn v1), which the /slackers roster reads too.
  const basic = { ID: 42055, name: "Dead Fragment", members: {
    "1": { name: "Ann", level: 50, days_in_faction: 10, position: "Member" },
    "137558": { name: "RussianRob", level: 80, days_in_faction: 900, position: "Leader" },
    "7": { level: 1 },
  } };
  assert.deepEqual(rosterFromBasic(basic), [
    { playerId: "1", name: "Ann" }, { playerId: "7", name: "7" }, { playerId: "137558", name: "RussianRob" },
  ]);
  assert.deepEqual(rosterFromBasic({ ID: 42055 }), []);
  assert.deepEqual(rosterFromBasic(null), []);
});
```

- [ ] **Step 2: Watch them fail**

```bash
cd /opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board/ov && node --test blood-bags-route.test.js 2>&1 | grep -E "^(not ok|# (tests|pass|fail))|error: '"
```

Expected: `# tests 14`, `# pass 1`, `# fail 13`. Twelve fail with `createBloodBagsApi is not a function` and one with `rosterFromBasic is not a function`. The one that passes, "with no token requireAuth answers 401 before the board is reached", pins `requireAuth`'s existing behaviour.

- [ ] **Step 3: Add the handler**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board
python3 -I - $WS/ov/blood-bags.js <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
def rep(old, new):
    global s
    assert s.count(old) == 1, ("not exactly once", old[:60])
    s = s.replace(old, new)

rep('''import { logCall } from "./key-usage-log.js";
import { parseLine, isUnreadBloodLine, liveWar } from "./blood-bags-model.js";''',
'''import { logCall } from "./key-usage-log.js";
import { fetchFactionBasic } from "./torn-api.js";
import {
  TYPES, WINDOWS, parseLine, isUnreadBloodLine, liveWar, parseWindow, parseType, buildBoard,
} from "./blood-bags-model.js";''')

s = s.rstrip("\n") + '''

// ── /api/bloodbags ──────────────────────────────────────────────────────────
export const OWNER_ID = "137558";
export const NOT_A_MEMBER = "This board is for Dead Fragment members.";
// The roster moves slowly, so it is kept for an hour, as /slackers does.
const ROSTER_TTL_MS = 60 * 60 * 1000;
// A viewer missing from the roster gets it fetched again before being turned
// away, but never more often than this; so does a failed refresh.
const ROSTER_RECHECK_MS = 5 * 60 * 1000;

/**
 * Today's members, as [{ playerId, name }], from what fetchFactionBasic returns:
 * Torn's v1 faction basic, whose `members` is a map keyed by player id (the
 * /slackers roster reads it the same way).
 */
export function rosterFromBasic(basic) {
  return Object.entries((basic && basic.members) || {}).map(([id, m]) => ({ playerId: String(id), name: String((m && m.name) || id) }));
}

/**
 * The route's handler, as { handle(req, res) }. requireAuth has already checked
 * the token and put its claims on req.user. opts, for tests: collector (has
 * snapshot()), rosterFn() -> [{ playerId, name }], nowFn() -> ms, log(msg).
 */
export function createBloodBagsApi(opts = {}) {
  const collector = opts.collector || bloodBagCollector;
  const nowFn = opts.nowFn || (() => Date.now());
  const log = opts.log || ((msg) => console.error(msg));
  // The owner's own key, the same call /slackers makes for its roster.
  const rosterFn = opts.rosterFn || (async () => {
    const key = store.getFactionApiKey(FACTION);
    if (!key) throw new Error("no faction key on file");
    return rosterFromBasic(await fetchFactionBasic(FACTION, key));
  });

  let roster = { at: 0, members: [], stale: false };
  let failedAt = -Infinity;
  let inflight = null;

  // Today's members, fetched again once older than maxAgeMs. A failed fetch
  // keeps the last list, marked stale, rather than blanking the board.
  function getRoster(maxAgeMs) {
    const now = nowFn();
    if (now - roster.at < maxAgeMs || now - failedAt < ROSTER_RECHECK_MS) return Promise.resolve(roster);
    if (!inflight) {
      inflight = (async () => {
        try {
          roster = { at: nowFn(), members: await rosterFn(), stale: false };
        } catch (err) {
          failedAt = nowFn();
          roster = { ...roster, stale: roster.members.length > 0 };
          log(`[blood-bags] roster refresh failed: ${err.message}`);
        }
        return roster;
      })().finally(() => { inflight = null; });
    }
    return inflight;
  }

  async function handle(req, res) {
    res.set("Cache-Control", "no-store");
    try {
      const viewerId = String((req.user && req.user.playerId) ?? "");
      const isOwner = viewerId === OWNER_ID;
      if (!isOwner && String((req.user && req.user.factionId) ?? "") !== FACTION) {
        return res.status(403).json({ error: NOT_A_MEMBER });
      }
      const query = req.query || {};
      const window = parseWindow(query.window);
      if (!window) return res.status(400).json({ error: "Unknown timeframe." });
      const type = parseType(query.type);
      if (!type) return res.status(400).json({ error: "Unknown blood type." });

      // A token lasts 90 days and outlives membership, so the faction it names is
      // checked against today's roster too. Someone who joined since the roster
      // was fetched gets a fresh look before being turned away.
      let r = await getRoster(ROSTER_TTL_MS);
      const listed = () => r.members.some((m) => String(m.playerId) === viewerId);
      if (!isOwner && r.members.length && !listed()) {
        r = await getRoster(ROSTER_RECHECK_MS);
        if (!listed()) return res.status(403).json({ error: NOT_A_MEMBER });
      }
      if (!r.members.length) return res.status(502).json({ error: "The member list is unavailable right now." });

      const snap = collector.snapshot();
      const nowSec = Math.floor(nowFn() / 1000);
      const board = buildBoard({
        lines: snap.lines, roster: r.members, wars: snap.wars, nowSec, window, type, viewerId,
        reachSec: snap.reachSec ?? nowSec,
      });
      return res.json({
        ...board,
        updatedAt: snap.lastPollAt,
        reachSec: snap.reachSec,
        backfillDone: snap.backfillDone,
        liveWar: liveWar(snap.wars, nowSec),
        windows: Object.keys(WINDOWS),
        types: ["all", ...TYPES],
        rosterStale: r.stale,
      });
    } catch (err) {
      log(`[blood-bags] /api/bloodbags failed: ${err.message}`);
      return res.status(500).json({ error: "internal error" });
    }
  }

  return { handle };
}
'''
open(p, "w").write(s)
print("ok")
PY
```

Expected: `ok`.

- [ ] **Step 4: Watch them pass**

```bash
cd /opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board/ov && node --test blood-bags-route.test.js 2>&1 | grep -E '^(not ok|# (tests|pass|fail))'
```

Expected: `# tests 14`, `# pass 14`, `# fail 0`.

- [ ] **Step 5: The collector's tests still pass**

```bash
cd /opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board/ov && node --test blood-bags.test.js blood-bags-route.test.js 2>&1 | grep -E '^(not ok|# (tests|pass|fail))'
```

Expected: `# tests 32`, `# pass 32`, `# fail 0`.

- [ ] **Step 6: Install, run in place, and commit**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board
install -o root -g root -m 644 $WS/ov/blood-bags.js $WS/ov/blood-bags-route.test.js /opt/warboard/server/
cd /opt/warboard/server && node --test blood-bags.test.js blood-bags-route.test.js 2>&1 | grep -E '^(not ok|# (tests|pass|fail))'
```

Expected: `# tests 32`, `# pass 32`, `# fail 0`. Then:

```bash
cd /opt/warboard && git add server/blood-bags-route.test.js && git commit -q -F - -- server/blood-bags.js server/blood-bags-route.test.js <<'MSG'
Blood-bag board: /api/bloodbags for Dead Fragment members

createBloodBagsApi answers members of faction 42055 and the owner, and
refuses anyone else with "This board is for Dead Fragment members." A
token lasts 90 days and outlives membership, so the viewer must also be
on today's roster, fetched on the owner's key and kept for an hour;
someone who joined since gets a fresh look before being turned away.
An unknown timeframe or blood type is a 400, and the answer is never
cached.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
git log --oneline -1
```

### Task 7: The page

**Files:**
- Create: `$WS/ov/blood-bags-page.test.js`, `$WS/ov/blood-bags-page.js` and `$WS/ov/pages/bloodbags.html`. Step 5 installs them.

**Interfaces:**
- Consumes:
  - Task 6's JSON, as listed there.
  - `POST /api/auth` with `{ apiKey, scriptName: "bloodbags" }`, which answers 200 with `{ token, … }`.
    - It answers 403 with `{ error: "Access denied. FactionOps is currently restricted to faction 42055." }` to a key from another faction.
    - A `scriptName` other than `factionops` or `commandcenter` skips its version gate.
    - Like every sign-in there, it stores the key (`store.storeApiKey`) and, for an eligible key, sets the default pool opt-in (`store.ensureDefaultPoolOpt`).
- Produces: `renderBloodBagsPage()` from `blood-bags-page.js`, which returns the page's HTML.

The layout was checked at plan time in headless Chromium, against a stubbed `/api/bloodbags`. At 390 px and at 1280 px nothing scrolls sideways (`scrollWidth` equals the viewport) and the console shows no errors. The three lists stack on a phone and sit side by side on a wide screen.

- [ ] **Step 1: Write the failing tests**

Create `$WS/ov/blood-bags-page.test.js`:

```js
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
    "History so far reaches back to 20 Oct; the rest of the year is still being filled in once the ranked war ends.");
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
```

- [ ] **Step 2: Watch them fail**

```bash
cd /opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board/ov && node --test blood-bags-page.test.js 2>&1 | grep -E 'ENOENT|^# (tests|pass|fail)'
```

Expected: `# tests 1` and `# fail 1`, from `Error: ENOENT: no such file or directory, open '…/ov/pages/bloodbags.html'`.

- [ ] **Step 3: Write the page and the module that serves it**

Create `$WS/ov/blood-bags-page.js`:

```js
// The /bloodbags page is plain HTML on disk rather than a template literal in a
// route, as /slackers is: its own script is full of quotes and braces, and the
// markup is easier to work on as markup. It lives in server/pages/, not
// server/public/, and holds no member data: every number arrives from
// /api/bloodbags, which is where the membership check is.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(__dirname, "pages", "bloodbags.html");

let cached = null;
let cachedMtime = 0;

export function renderBloodBagsPage() {
  // Read again when the file changes, so an edit shows without a restart, but
  // stay off the disk on every request.
  const mtime = fs.statSync(PAGE).mtimeMs;
  if (!cached || mtime !== cachedMtime) {
    cached = fs.readFileSync(PAGE, "utf8");
    cachedMtime = mtime;
  }
  return cached;
}
```

Create `$WS/ov/pages/bloodbags.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="dark">
<title>Blood Bag Contributions</title>
<style>
/* Always dark, like the board it was modelled on, in the /slackers dark tokens.
   The tile colours and the Wall of Shame red are this page's own. */
:root{
  --bg:#10141a; --panel:#171d25; --sunk:#131920;
  --ink:#e6ebf2; --muted:#94a1b1; --faint:#6a7683;
  --line:#242c36; --line2:#1c232c;
  --link:#6aa6dd; --warn:#f0a93a;
  --give:#34d399; --give-wash:rgba(52,211,153,.09);
  --use:#22d3ee; --use-wash:rgba(34,211,238,.09);
  --net:#60a5fa; --net-wash:rgba(96,165,250,.09);
  --members:#c084fc; --members-wash:rgba(192,132,252,.09);
  --shame:#f87171; --shame-line:rgba(248,113,113,.35); --shame-wash:rgba(248,113,113,.07);
  --shadow:0 1px 2px rgba(0,0,0,.35),0 10px 30px rgba(0,0,0,.4);
}
*{box-sizing:border-box}
html,body{margin:0}
body{
  background:var(--bg); color:var(--ink); min-height:100vh;
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  font-variant-numeric:tabular-nums; line-height:1.45; -webkit-font-smoothing:antialiased;
  padding:clamp(16px,3.5vw,40px);
}
.inner{max-width:1120px;margin:0 auto}
.eyebrow{font-size:11.5px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:0 0 6px}
h1{font-size:clamp(24px,4vw,32px);font-weight:800;color:var(--give);margin:0 0 6px;letter-spacing:-.01em}
.lede{color:var(--muted);margin:0 0 18px;max-width:70ch}
h2{font-size:17px;font-weight:700;margin:0 0 12px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 16px;box-shadow:var(--shadow)}
.hidden{display:none}
form{display:flex;gap:10px;flex-wrap:wrap}
input,select{background:var(--sunk);color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:10px 12px;font:inherit;font-size:15px;min-width:0}
input{flex:1 1 220px}
button{border:0;border-radius:8px;padding:10px 16px;font:inherit;font-weight:700;cursor:pointer}
button.primary{background:var(--give);color:#06281d}
button.ghost{background:transparent;color:var(--muted);border:1px solid var(--line)}
button:disabled{opacity:.6;cursor:default}
.sub{color:var(--muted);font-size:13.5px;margin:0 0 12px}
.msg{color:var(--warn);font-size:13.5px;margin:10px 0 0}
.msg:empty{display:none}
.filters{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end}
.filters label{display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--muted);flex:1 1 200px}
.note{color:var(--warn);font-size:14px;margin:0 0 16px}
.note:empty{display:none}
.tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.tile{border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.tile .label{font-size:13px;color:var(--muted)}
.tile .value{font-size:26px;font-weight:800;line-height:1.2}
.tile .sub{margin:2px 0 0;font-size:12.5px}
.tile.give{background:var(--give-wash)} .tile.give .value{color:var(--give)}
.tile.use{background:var(--use-wash)} .tile.use .value{color:var(--use)}
.tile.net{background:var(--net-wash)} .tile.net .value{color:var(--net)}
.tile.members{background:var(--members-wash)} .tile.members .value{color:var(--members)}
.updated{color:var(--faint);font-size:13px;margin:12px 0 0}
.you{background:var(--sunk);border:1px solid var(--line);border-radius:10px;padding:12px 16px;margin:0 0 16px;font-weight:600}
.lists{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.list ol{list-style:none;margin:0;padding:0}
.list li{display:flex;align-items:baseline;gap:10px;padding:9px 0;border-top:1px solid var(--line2)}
.list li:first-child{border-top:0}
.rank{color:var(--faint);font-size:12px;width:2.6em;flex:none}
.name{color:var(--ink);text-decoration:none;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.name:hover{color:var(--link);text-decoration:underline}
.val{font-weight:700;color:var(--give)}
.list.shame{border-color:var(--shame-line);background:linear-gradient(var(--shame-wash),var(--shame-wash)),var(--panel)}
.list.shame h2,.list.shame .name,.list.shame .val{color:var(--shame)}
.empty{color:var(--faint);font-size:13.5px}
.foot{color:var(--faint);font-size:12.5px;margin:6px 0 0;max-width:80ch}
@media (max-width:860px){.lists{grid-template-columns:1fr}}
@media (max-width:640px){.tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style>
</head>
<body>
<div class="inner">
  <p class="eyebrow">Faction 42055 &middot; Dead Fragment</p>
  <h1>Blood Bag Contributions</h1>
  <p class="lede" id="lede">Loading&hellip;</p>

  <div class="card signin hidden" id="signin">
    <h2>Sign in</h2>
    <p class="sub">Sign in with your Torn API key. Torn checks it, this browser keeps only a sign-in token, and warboard keeps the key the way it does for FactionOps.</p>
    <form id="keyform" autocomplete="off">
      <input id="key" type="text" inputmode="latin" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Torn API key" aria-label="Torn API key">
      <button class="primary" type="submit" id="go">Open board</button>
    </form>
    <p class="msg" id="signin-msg"></p>
  </div>

  <div id="board" class="hidden">
    <div class="card filters">
      <label>Timeframe <select id="win"></select></label>
      <label>Blood type <select id="type"></select></label>
      <button type="button" class="ghost" id="signout">Sign out</button>
    </div>
    <p class="note" id="note"></p>
    <div class="card">
      <h2>Overview</h2>
      <div class="tiles" id="tiles"></div>
      <p class="updated" id="updated"></p>
    </div>
    <p class="you" id="you"></p>
    <div class="lists">
      <div class="card list"><h2>Top 10 Contributors</h2><ol id="top-given"></ol></div>
      <div class="card list"><h2>Top 10 Net Contributors</h2><ol id="top-net"></ol></div>
      <div class="card list shame"><h2>Wall of Shame</h2><ol id="wall"></ol></div>
    </div>
    <p class="foot">Given: bags filled from the faction's empty bags, plus filled bags deposited. Used: bags used from the armoury, and bags a leader gives or loans you, less any returned. Bags used during a ranked war count as used but not against you. Net is given minus used outside wars. Empty and irradiated bags count for nothing.</p>
  </div>
</div>

<script>
// Every number on this page comes from /api/bloodbags, which checks that the
// viewer is a Dead Fragment member; the page itself holds no member data.
var TOKEN_KEY = "bloodbags_token";
var WINDOW_LABELS = { "24h": "Past 24 hours", "7d": "Past 7 days", "30d": "Past 30 days", "90d": "Past 90 days", "all": "All time" };
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var STATE = { data: null, win: "7d", type: "all" };

function $(id) { return document.getElementById(id); }
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function sep(n) {
  return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function signed(n) {
  n = Math.round(Number(n) || 0);
  return n > 0 ? "+" + sep(n) : sep(n);
}
function pad2(n) { return (n < 10 ? "0" : "") + n; }
function monthYear(sec) { var d = new Date(sec * 1000); return MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
function dayMonth(sec) { var d = new Date(sec * 1000); return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()]; }
function windowLabel(w, reachSec) {
  if (w === "all" && reachSec) return "All time (since " + monthYear(reachSec) + ")";
  return WINDOW_LABELS[w] || w;
}
function typeLabel(t) { return t === "all" ? "All types" : t; }
function apiPath(win, type) {
  // encodeURIComponent turns "A+" into "A%2B"; a bare "+" would arrive as a space.
  return "/api/bloodbags?window=" + encodeURIComponent(win) + "&type=" + encodeURIComponent(type);
}
// Torn City Time is UTC, so the clock is read in UTC whatever the viewer's zone.
function tct(ms) { var d = new Date(ms); return pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes()) + " TCT"; }
function ago(ms, nowMs) {
  var m = Math.max(0, Math.floor((nowMs - ms) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return m + (m === 1 ? " minute ago" : " minutes ago");
  var h = Math.floor(m / 60);
  if (h < 48) return h + (h === 1 ? " hour ago" : " hours ago");
  return Math.floor(h / 24) + " days ago";
}
function updatedLine(updatedAt, nowMs) {
  if (!updatedAt) return "No update yet.";
  return "Latest update: " + ago(updatedAt, nowMs) + " (" + tct(updatedAt) + ")";
}
function noteText(d) {
  if (!d.updatedAt) return "No data yet: the first update runs within the hour.";
  if (!d.backfillDone && d.reachSec) {
    return "History so far reaches back to " + dayMonth(d.reachSec) + "; the rest of the year is still being filled in" +
      (d.liveWar ? " once the ranked war ends." : ".");
  }
  return "";
}
function youLine(you) {
  if (!you) return "You: no blood bags given or used in this window";
  return "You: " + (you.rank ? "#" + you.rank + " of " + you.of + " - " : "") +
    sep(you.given) + " given, " + sep(you.used) + " used (" + sep(you.usedInWars) + " during wars), net " + signed(you.net);
}
function tile(kind, label, value, sub) {
  return '<div class="tile ' + kind + '"><div class="label">' + label + '</div><div class="value">' + value + "</div>" +
    (sub ? '<p class="sub">' + sub + "</p>" : "") + "</div>";
}
function overviewHtml(o) {
  return tile("give", "Given", sep(o.given), "") +
    tile("use", "Used", sep(o.used), sep(o.usedInWars) + " during wars") +
    tile("net", "Net", signed(o.net), "given less used outside wars") +
    tile("members", "Members", sep(o.members), "");
}
function listHtml(rows, kind) {
  if (!rows || !rows.length) {
    return '<li class="empty">' + (kind === "wall" ? "Nobody is below zero." : "Nobody yet.") + "</li>";
  }
  return rows.map(function (r) {
    return '<li><span class="rank">#' + r.rank + "</span>" +
      '<a class="name" href="https://www.torn.com/profiles.php?XID=' + encodeURIComponent(r.playerId) + '" target="_blank" rel="noopener">' +
      esc(r.name) + '</a><span class="val">' + (kind === "given" ? sep(r.value) : signed(r.value)) + "</span></li>";
  }).join("");
}
function options(values, selected, label) {
  return values.map(function (v) {
    return '<option value="' + esc(v) + '"' + (v === selected ? " selected" : "") + ">" + esc(label(v)) + "</option>";
  }).join("");
}
function render() {
  var d = STATE.data;
  $("win").innerHTML = options(d.windows, STATE.win, function (w) { return windowLabel(w, d.reachSec); });
  $("type").innerHTML = options(d.types, STATE.type, typeLabel);
  $("note").textContent = noteText(d);
  $("tiles").innerHTML = overviewHtml(d.overview);
  $("updated").textContent = updatedLine(d.updatedAt, Date.now());
  $("you").textContent = youLine(d.you);
  $("top-given").innerHTML = listHtml(d.topGiven, "given");
  $("top-net").innerHTML = listHtml(d.topNet, "net");
  $("wall").innerHTML = listHtml(d.wall, "wall");
}

// The API key is swapped once for a sign-in token and is not kept in this
// browser; the token is what lives in localStorage.
function token() { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } }
function setToken(t) { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (e) {} }
function showSignin(msg) {
  $("signin").className = "card signin";
  $("board").className = "hidden";
  $("lede").textContent = "Who keeps the faction's blood supply topped up, and who takes more than they give. For Dead Fragment members.";
  $("signin-msg").textContent = msg || "";
}
function showBoard() {
  $("signin").className = "card signin hidden";
  $("board").className = "";
  $("lede").textContent = "Who keeps the faction's blood supply topped up, and who takes more than they give.";
}
function load() {
  var t = token();
  if (!t) { showSignin(""); return; }
  fetch(apiPath(STATE.win, STATE.type), { headers: { Authorization: "Bearer " + t } })
    .then(function (r) {
      return r.json().then(function (d) { return { status: r.status, d: d }; }, function () { return { status: r.status, d: {} }; });
    })
    .then(function (res) {
      if (res.status === 401) { setToken(""); showSignin("That session has expired. Sign in again."); return; }
      if (res.status === 403) { setToken(""); showSignin(res.d.error || "This board is for Dead Fragment members."); return; }
      if (res.status !== 200) { $("lede").textContent = "Could not load the board: " + (res.d.error || "HTTP " + res.status); return; }
      STATE.data = res.d;
      showBoard();
      render();
    })
    .catch(function (err) { $("lede").textContent = "Could not reach warboard: " + err.message; });
}
function signIn(e) {
  e.preventDefault();
  var key = $("key").value.trim();
  if (!key) return;
  $("go").disabled = true;
  $("signin-msg").textContent = "Checking with Torn...";
  fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: key, scriptName: "bloodbags" })
  })
    .then(function (r) {
      return r.json().then(function (d) { return { status: r.status, d: d }; }, function () { return { status: r.status, d: {} }; });
    })
    .then(function (res) {
      $("go").disabled = false;
      // /api/auth's own refusal talks about FactionOps; this board says who it is for.
      if (res.status === 403) { showSignin("This board is for Dead Fragment members."); return; }
      if (res.status !== 200 || !res.d.token) { showSignin(res.d.error || "Torn would not accept that key."); return; }
      $("key").value = "";
      setToken(res.d.token);
      load();
    })
    .catch(function (err) { $("go").disabled = false; showSignin("Could not reach warboard: " + err.message); });
}
function boot() {
  $("keyform").addEventListener("submit", signIn);
  $("win").addEventListener("change", function (e) { STATE.win = e.target.value; load(); });
  $("type").addEventListener("change", function (e) { STATE.type = e.target.value; load(); });
  $("signout").addEventListener("click", function () { setToken(""); STATE.data = null; showSignin("Signed out."); });
  // ?signout in the address clears the token first: a way back to the sign-in card.
  if (location.search.indexOf("signout") !== -1) setToken("");
  load();
}
if (typeof document !== "undefined" && document.getElementById("keyform")) boot();
</script>
</body>
</html>
```

- [ ] **Step 4: Watch them pass**

```bash
cd /opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board/ov && node --test blood-bags-page.test.js 2>&1 | grep -E '^(not ok|# (tests|pass|fail))'
```

Expected: `# tests 11`, `# pass 11`, `# fail 0`.

- [ ] **Step 5: Install, run in place, and commit**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board
install -o root -g root -m 644 $WS/ov/blood-bags-page.js $WS/ov/blood-bags-page.test.js /opt/warboard/server/
install -o root -g root -m 644 $WS/ov/pages/bloodbags.html /opt/warboard/server/pages/bloodbags.html
cd /opt/warboard/server && node --test blood-bags-page.test.js 2>&1 | grep -E '^(not ok|# (tests|pass|fail))'
```

Expected: `# tests 11`, `# pass 11`, `# fail 0`. Then:

```bash
cd /opt/warboard && git add server/blood-bags-page.js server/blood-bags-page.test.js server/pages/bloodbags.html && git commit -q -F - -- server/blood-bags-page.js server/blood-bags-page.test.js server/pages/bloodbags.html <<'MSG'
Blood-bag board: the page

Plain HTML in server/pages, served by blood-bags-page.js as /slackers
is. Members sign in with their Torn key through /api/auth; the browser
keeps only the token. The page draws the overview, the three lists and
the viewer's own line from /api/bloodbags, with timeframe and blood
type filters, and shows the update time in Torn City Time. It is ES5
and ASCII, dark only, and stacks on a phone.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
git log --oneline -1
```

### Task 8: Wiring

**Files:**
- Modify, where they are: `server/routes.js` and `server/server.js`.
  - In `routes.js`: two imports after `import { renderSlackersPage } from "./slackers-page.js";`, the gate exemption after the `/hof` line in `gateMiddleware`, and the two routes after the `/slackers` page route.
  - In `server.js`: the start line after the chain-hits collector's.
- Modify: `$WS/ov/blood-bags-route.test.js` (appended to). Step 6 installs it.

**Interfaces:**
- Consumes: Task 5's `start()`; Task 6's `createBloodBagsApi`; Task 7's `renderBloodBagsPage`; `requireAuth`, which `routes.js` already imports; `gateMiddleware` in `routes.js`.
- Produces: `GET /api/bloodbags` behind `requireAuth`, `GET /bloodbags`, and the collector starting with the server.

- [ ] **Step 1: Write the failing tests**

Append this to the end of `$WS/ov/blood-bags-route.test.js`, after a blank line. In the overlay, `routes.js` and `server.js` are symlinks to the live files.

```js
// ── wiring in routes.js and server.js ───────────────────────────────────────
const ROUTES = readFileSync(new URL("./routes.js", import.meta.url), "utf8");
const SERVER = readFileSync(new URL("./server.js", import.meta.url), "utf8");
function routesFn(name) {
  const i = ROUTES.indexOf("function " + name + "(");
  assert.ok(i >= 0, "not in routes.js: " + name);
  let k = ROUTES.indexOf("(", i), depth = 0;
  for (; k < ROUTES.length; k++) {
    if (ROUTES[k] === "(") depth++;
    else if (ROUTES[k] === ")" && --depth === 0) break;
  }
  const o = ROUTES.indexOf("{", k);
  let d = 0;
  for (let j = o; j < ROUTES.length; j++) {
    if (ROUTES[j] === "{") d++;
    else if (ROUTES[j] === "}" && --d === 0) return ROUTES.slice(i, j + 1);
  }
  throw new Error("unbalanced braces in " + name);
}
// The site gate as it runs with the gate switched on and no gate cookie.
function gateFor(path) {
  const box = { process: { env: {} }, parseCookie: () => null, verifyToken: () => { throw new Error("no token"); } };
  vm.createContext(box);
  vm.runInContext(routesFn("gateMiddleware") + "\nglobalThis.gate = gateMiddleware;", box);
  const seen = { next: false, redirect: null };
  box.gate({ path, headers: {} }, { redirect: (to) => { seen.redirect = to; } }, () => { seen.next = true; });
  return seen;
}

test("routes.js serves /api/bloodbags behind requireAuth, and /bloodbags uncached from blood-bags-page.js", () => {
  assert.match(ROUTES, /^import \{ createBloodBagsApi \} from "\.\/blood-bags\.js";$/m);
  assert.match(ROUTES, /^import \{ renderBloodBagsPage \} from "\.\/blood-bags-page\.js";$/m);
  assert.match(ROUTES, /router\.get\("\/api\/bloodbags", requireAuth, \(req, res\) => bloodBagsApi\.handle\(req, res\)\);/);
  assert.match(ROUTES, /router\.get\("\/bloodbags",[\s\S]{0,200}"Cache-Control", "no-store"[\s\S]{0,80}renderBloodBagsPage\(\)/);
});

test("the site gate lets /bloodbags through, as it does /hof, and still gates other pages", () => {
  assert.deepEqual(gateFor("/bloodbags"), { next: true, redirect: null });
  assert.deepEqual(gateFor("/api/bloodbags"), { next: true, redirect: null });
  assert.deepEqual(gateFor("/slackers"), { next: false, redirect: "/gate.html" });
});

test("server.js starts the collector", () => {
  assert.match(SERVER, /import\('\.\/blood-bags\.js'\)\.then\(m => m\.start\(\)\)/);
});
```

- [ ] **Step 2: Watch them fail**

```bash
cd /opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board/ov && node --test blood-bags-route.test.js 2>&1 | grep -E '^(not ok|# (tests|pass|fail))|did not match|strictly deep-equal'
```

Expected: `# tests 17`, `# pass 14`, `# fail 3`. The routes.js and server.js tests fail with `The input did not match the regular expression`. The gate test fails with `Expected values to be strictly deep-equal`, because the gate still sends `/bloodbags` to `{ next: false, redirect: '/gate.html' }`.

- [ ] **Step 3: Check nobody else has changes waiting in the two files**

```bash
git -C /opt/warboard diff --quiet -- server/routes.js server/server.js && echo clean
```

Expected: `clean`. If not, another session has uncommitted work in them, and this task's commit would sweep it in. Stop and ask the owner.

- [ ] **Step 4: Wire the routes and the start line**

```bash
python3 -I - /opt/warboard/server/routes.js /opt/warboard/server/server.js <<'PY'
import sys
routes, server = sys.argv[1], sys.argv[2]

def edit(path, pairs):
    s = open(path).read()
    for old, new in pairs:
        assert s.count(old) == 1, ("not exactly once in " + path, old[:70])
        s = s.replace(old, new)
    open(path, "w").write(s)

edit(routes, [
('''import { renderSlackersPage } from "./slackers-page.js";
''', '''import { renderSlackersPage } from "./slackers-page.js";
import { createBloodBagsApi } from "./blood-bags.js";
import { renderBloodBagsPage } from "./blood-bags-page.js";
'''),
('''    req.path === "/hof" || req.path.startsWith("/hof/") ||
''', '''    req.path === "/hof" || req.path.startsWith("/hof/") ||
    // The blood-bag board brings its own Torn-key sign-in, as /war and /payouts
    // do, and its markup holds no member data: every number comes from
    // /api/bloodbags, which checks membership.
    req.path === "/bloodbags" || req.path.startsWith("/bloodbags/") ||
'''),
('''router.get("/slackers", (_req, res) => {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store");
  return res.send(renderSlackersPage());
});
''', '''router.get("/slackers", (_req, res) => {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store");
  return res.send(renderSlackersPage());
});

// Blood-bag board (docs/superpowers/specs/2026-10-24-faction-blood-bag-board-design.md).
// Dead Fragment members only: the JSON checks membership, and the page is markup.
const bloodBagsApi = createBloodBagsApi();
router.get("/api/bloodbags", requireAuth, (req, res) => bloodBagsApi.handle(req, res));
router.get("/bloodbags", (_req, res) => {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-store");
  return res.send(renderBloodBagsPage());
});
'''),
])

edit(server, [
('''import('./chain-hits.js').then(m => m.start()).catch(e => {
  console.error('[chain-hits] failed to start collector:', e.message);
});
''', '''import('./chain-hits.js').then(m => m.start()).catch(e => {
  console.error('[chain-hits] failed to start collector:', e.message);
});

// The blood-bag board's collector: an hourly armoury-news poll, about 2 calls an
// hour, and a one-off year of history at 10 calls a minute that waits out live
// ranked wars.
import('./blood-bags.js').then(m => m.start()).catch(e => {
  console.error('[blood-bags] failed to start collector:', e.message);
});
'''),
])
print("ok")
PY
```

Expected: `ok`.

- [ ] **Step 5: Watch them pass**

```bash
cd /opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board/ov && node --test blood-bags-route.test.js 2>&1 | grep -E '^(not ok|# (tests|pass|fail))'
```

Expected: `# tests 17`, `# pass 17`, `# fail 0`.

- [ ] **Step 6: Install, run the new files and the whole suite in place, and commit**

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board
install -o root -g root -m 644 $WS/ov/blood-bags-route.test.js /opt/warboard/server/
cd /opt/warboard/server && node --test blood-bags-model.test.js blood-bags.test.js blood-bags-route.test.js blood-bags-page.test.js 2>&1 | grep -E '^(not ok|# (tests|pass|fail))'
```

Expected: `# tests 76`, `# pass 76`, `# fail 0`. Then the whole suite, after `uptime`:

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board; uptime
cd /opt/warboard/server && node --test > $WS/suite.txt 2>&1; echo "exit $?"; grep -E '^(not ok|# (tests|pass|fail|skipped))' $WS/suite.txt
```

Expected: `exit 0`, `# fail 0` and `# skipped 2` (both already skipped before this plan). There is no fixed total, because other work adds tests. Then:

```bash
cd /opt/warboard && git commit -q -F - -- server/routes.js server/server.js server/blood-bags-route.test.js <<'MSG'
Blood-bag board: wire the routes and start the collector

GET /api/bloodbags sits behind requireAuth and checks membership;
GET /bloodbags serves the markup, uncached. The site gate lets
/bloodbags through, as it does /war, /payouts and /hof, because the
page brings its own Torn-key sign-in and holds no member data.
server.js starts the collector after the chain-hits one.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
MSG
git log --oneline -1
```

### Task 9: Final review, release and report

**Files:**
- Create: `$WS/tools/board-all.mjs` and `$WS/tools/count-torn.py`, the release check. They stay in the workspace and are never committed.
- `server/data/blood-bags/42055.json` appears when the server first saves, owned by the server's user.

**Interfaces:**
- Consumes: everything above, live after the reload.
- Produces: the board at `https://tornwar.com/bloodbags`.

- [ ] **Step 1: The final review**

This is the executing-plans final review. Run `review-package` over this plan's commits, from this plan's own commit to `HEAD`. A fresh reviewer on Opus (`model: "opus"`) reviews the package, with the plan, the spec, this plan's Review Focus section and the ledger's `Ruling:` lines.

Critical and Important findings get one fix pass. Each fix is test-first: the test fails, then passes, then the whole suite passes. Each fix is installed and committed the way the tasks are. Minor findings go to the report, unfixed.

- [ ] **Step 2: Deploy**

`deploy.sh` runs the whole suite, reloads warboard under pm2 as root, and asks `/api/health` whether it came back.

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board; uptime
/opt/warboard/server/deploy.sh > $WS/deploy.txt 2>&1; echo "exit $?"; grep -E '^(not ok|# (fail|skipped))' $WS/deploy.txt; tail -3 $WS/deploy.txt
```

Expected: `exit 0`, `# fail 0`, `# skipped 2`, and a last line of `deploy ok`, under the health reply with `"status":"ok"`.

- [ ] **Step 3: Check the new process**

```bash
PID=$(pm2 pid warboard); echo "pid $PID, up $(ps -o etimes= -p $PID | tr -d ' ') s, as $(ps -o user= -p $PID)"
```

Expected: up for under a couple of minutes, as `warboard`.

- [ ] **Step 4: Wait for the first poll**

The first tick reads the war list and then polls both categories, 6 seconds apart. Run this with Monitor or in the background, with a 3-minute cap:

```bash
until node -e 'process.exit(JSON.parse(require("fs").readFileSync("/opt/warboard/server/data/blood-bags/42055.json", "utf8")).lastPollAt ? 0 : 1)' 2>/dev/null; do sleep 3; done; echo polled
```

Expected: `polled`. If it never comes, the logs in Step 8 say why.

- [ ] **Step 5: The store belongs to the server**

```bash
stat -c '%U:%G %a %n' /opt/warboard/server/data/blood-bags /opt/warboard/server/data/blood-bags/42055.json
```

Expected: `warboard:warboard` on both.

- [ ] **Step 6: The page, and the 401s with no token or a bad one**

```bash
curl -sS -o /dev/null -w '%{http_code} %{content_type}\n' https://tornwar.com/bloodbags
curl -sS https://tornwar.com/bloodbags | grep -c '<title>Blood Bag Contributions</title>'
curl -sS -w ' %{http_code}\n' https://tornwar.com/api/bloodbags
curl -sS -w ' %{http_code}\n' -H 'Authorization: Bearer not-a-token' https://tornwar.com/api/bloodbags
```

Expected, line by line:
- `200 text/html; charset=utf-8`
- `1`
- `{"error":"Missing Authorization header"} 401`
- `{"error":"Invalid or expired token"} 401`

None of this signs in: that would need a member's token, and this plan never makes one. The owner's own first sign-in, in Step 10, is the signed-in check.

- [ ] **Step 7: Check the numbers against Torn**

Two small scripts compare the same stretch of time: from where the history is complete (`reachSec`) to the last poll.
- `board-all.mjs` prints the board's "All time" overview from the live store, through the model, and the store's count of each kind of line.
- `count-torn.py` counts the same seconds straight from Torn's news, with its own simple matching on the plain text (`stripTags=true`). It then compares the two.

While war 51418 is live the backfill waits, so at release the stretch is about the last 6.5 hours.

Create `$WS/tools/board-all.mjs`:

```js
// The board's "All time" figures straight from the live store, through the
// model, plus the store's own count of each kind of line over the same seconds:
// from where the history is complete (reachSec) to the last poll.
import { readFileSync } from "node:fs";

const { buildBoard } = await import(process.env.BB_MODEL || "/opt/warboard/server/blood-bags-model.js");

const file = process.argv[2] || "/opt/warboard/server/data/blood-bags/42055.json";
const s = JSON.parse(readFileSync(file, "utf8"));
if (!s.lastPollAt) throw new Error("no poll has finished yet");
const reachOf = (c) => (c.headTs == null ? null : c.gaps.length ? Math.max(...c.gaps.map((g) => g.to)) : s.cutoffSec);
const reachSec = Math.max(...Object.values(s.cats).map(reachOf));
const pollSec = Math.floor(s.lastPollAt / 1000);
const lines = Object.values(s.lines);
const board = buildBoard({ lines, roster: [], wars: s.wars, nowSec: pollSec, window: "all", type: "all", viewerId: "0", reachSec });
const kinds = { fills: 0, deposited: 0, uses: 0, handedOut: 0, returned: 0 };
for (const l of lines) {
  if (l.ts < reachSec || l.ts > pollSec) continue;
  if (l.kind === "fill") kinds.fills += 1;
  else if (l.kind === "deposit") kinds.deposited += l.qty;
  else if (l.kind === "use") kinds.uses += 1;
  else if (l.kind === "gave" || l.kind === "loaned") kinds.handedOut += l.qty;
  else kinds.returned += l.qty;
}
console.log(JSON.stringify({ reachSec, pollSec, overview: board.overview, kinds }));
```

Create `$WS/tools/count-torn.py`:

```python
# Counts the same seconds as board-all.mjs straight from Torn's news, with its
# own simple matching on the plain text (stripTags=true), and compares.
# Reads board-all.mjs's JSON on stdin; the key comes in through $KEY and goes
# only into the Authorization header.
import json, os, re, sys, time, urllib.request

KEY = os.environ["KEY"]
board = json.load(sys.stdin)
frm, to = board["reachSec"], board["pollSec"] + 1

def page(cat, upto):
    q = f"cat={cat}&from={frm}&to={upto}&limit=100&sort=DESC&stripTags=true&comment=wb-bloodbags-check"
    # Cloudflare turns away Python's own User-Agent (error 1010), so it names itself.
    req = urllib.request.Request(f"https://api.torn.com/v2/faction/news?{q}",
                                 headers={"Authorization": f"ApiKey {KEY}", "User-Agent": "warboard-bloodbags-check/1.0"})
    body = json.load(urllib.request.urlopen(req, timeout=30))
    if body.get("error"):
        sys.exit(f"Torn error: {body['error']}")
    return body.get("news") or []

def walk(cat):
    seen, upto, calls = {}, to, 0
    while True:
        news = page(cat, upto)
        calls += 1
        for e in news:
            seen[str(e["id"])] = e
        if len(news) < 100:
            return list(seen.values()), calls
        oldest = min(int(e["timestamp"]) for e in news)
        upto = oldest + 1 if oldest + 1 < upto else oldest
        time.sleep(1)

T = r"(?:AB|A|B|O)[+-]"
AP = r"(?:'|&#0?39;)"
FILL = re.compile(rf"filled one of the faction{AP}s Empty Blood Bag")
DEP = re.compile(rf"deposited (\d+)\s*x Blood Bag : {T}\s*\.?\s*$")
USE = re.compile(rf"used one of the faction{AP}s Blood Bag(?: : {T})? items")
HAND = re.compile(rf"(?:gave|loaned) (\d+)\s*x Blood Bag : {T} to ")
BACK = re.compile(rf"(?:returned|retrieved) (\d+)\s*x Blood Bag : {T}")

torn = {"fills": 0, "deposited": 0, "uses": 0, "handedOut": 0, "returned": 0}
total_calls = 0
for cat in ("armoryAction", "armoryDeposit"):
    entries, calls = walk(cat)
    total_calls += calls
    for e in entries:
        t = str(e.get("text", ""))
        if FILL.search(t): torn["fills"] += 1
        elif (m := DEP.search(t)): torn["deposited"] += int(m.group(1))
        elif USE.search(t): torn["uses"] += 1
        elif (m := HAND.search(t)): torn["handedOut"] += int(m.group(1))
        elif (m := BACK.search(t)): torn["returned"] += int(m.group(1))

ov, kinds = board["overview"], board["kinds"]
print(f"window {frm}..{to - 1} ({(to - frm) / 3600:.1f} h), {total_calls} Torn calls")
print("torn ", torn)
print("store", kinds)
ok = torn == kinds
given = torn["fills"] + torn["deposited"]
used = torn["uses"] + torn["handedOut"] - torn["returned"]
note = "" if ov["used"] == used else " (higher: a member returned more than they used here; ruling 1)" if ov["used"] > used else " (LOWER: wrong)"
print(f"board given {ov['given']} / torn {given}; board used {ov['used']} / torn {used}{note}")
ok = ok and ov["given"] == given and ov["used"] >= used
print("MATCH" if ok else "MISMATCH")
sys.exit(0 if ok else 1)
```

Run them:

```bash
WS=/opt/warboard/.superpowers/sdd/2026-10-24-faction-blood-bag-board
node $WS/tools/board-all.mjs | KEY=$(grep '^OWNER_API_KEY=' /opt/warboard/server/.env | cut -d= -f2-) python3 -I $WS/tools/count-torn.py; echo "exit $?"
```

Expected: a `window` line with the stretch and the number of Torn calls (a handful), the `torn` and `store` counts kind by kind and equal, the board's given equal to Torn's, the board's used equal to Torn's (or higher, with the note from ruling 1), then `MATCH` and `exit 0`.

If it says `MISMATCH`, don't push. A difference in one kind points at the reader (Task 1) or the walk (Task 4). Use superpowers:systematic-debugging, fix it test-first, and deploy again.

- [ ] **Step 8: Read the logs**

```bash
pm2 logs warboard --lines 500 --nostream 2>/dev/null | grep -F '[blood-bags]' | tail -20
```

Expected:
- no `failed to start collector`, `store unreadable` or `tick failed`;
- while war 51418 is live, `backfill waiting: ranked war 51418 is live`.

An `unread blood line` is a wording to add to the reader. It goes in the report and doesn't block the release.

- [ ] **Step 9: Push**

```bash
cd /opt/warboard && git status -sb | head -1 && git push origin main 2>&1 | sed -E 's#//[^@]*@#//***@#g' && git status -sb | head -1
```

Expected: first `## main...origin/main [ahead N]`, where N is 10 (the spec, this plan and the eight task commits) plus any fix commits. Then the push, and `## main...origin/main`.

- [ ] **Step 10: Report**

Save a project memory for the board (its URL, the store's path and how far the backfill has got) and add its line to `MEMORY.md`. Then tell the owner:
- the board is live at `https://tornwar.com/bloodbags`, and what was checked, with the numbers;
- their own first sign-in on the page is the signed-in check. After it, `pm2 logs` should show no `[blood-bags] /api/bloodbags failed` line;
- signing in stores the member's key and turns the key pool on for an eligible key by default, as every FactionOps sign-in does, and the sign-in card says the key is kept;
- while war 51418 is live the backfill waits, so even 24 hours fills in only as the hourly polls add to it, and "All time" stays short until the war ends;
- every ruling above, and every ruling and deferred minor from the ledger.
