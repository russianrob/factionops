# Faction blood-bag board (design)

**Status:** approved. Settled with the owner on 2026-10-23 (EDT) over 15 questions; every answer was the recommended one ("go with your recommendations"). The owner approved the design on 2026-10-23 at about 21:05 EDT with "yes write the spec", and this spec at about 21:36 EDT with "write the plan". The plan is `docs/superpowers/plans/2026-10-24-faction-blood-bag-board.md`. Amended on 2026-10-24 (EDT) with the fixes from the final review, and again that day when the owner chose to load history at 2 calls a minute during a ranked war (Q14).
**Where:** `https://tornwar.com/bloodbags`, for Dead Fragment (faction 42055).
**New files:** `server/blood-bags.js` (the collector and the route's handler), `server/blood-bags-model.js` (the numbers), `server/pages/bloodbags.html` (the page) and `server/blood-bags-page.js` (which serves it).
**Changed files:** `server/routes.js` (two routes, and the site gate lets `/bloodbags` through) and a start line in `server/server.js`.
**Tests:** `server/blood-bags-model.test.js`, `server/blood-bags.test.js`, `server/blood-bags-route.test.js` and `server/blood-bags-page.test.js`.

## Why

The owner wants a board like another faction's "Blood Bag Contributions" page (screenshot shared 2026-10-23). It shows who keeps the faction's blood supply topped up and who takes more than they give. Nothing on tornwar shows this today.

## Decisions

| # | Decision |
|---|---|
| Q1 | Any Dead Fragment member can see it, signing in with their Torn key as on /slackers. The owner can too. |
| Q2, Q12 | **Given:** a member fills one of the faction's Empty Blood Bags (1 per line), or deposits filled bags (the number in the line). **Used:** a member uses one of the faction's blood bags. **Net:** given minus used. |
| Q13 | Empty Blood Bags (deposited, or put in the armoury from a Box of Medical Supplies) count for nothing. So do irradiated bags. |
| Q15 | Blood bags a leader gives or loans to someone count as used by the person who gets them. A returned or retrieved loan cancels that. |
| Q3, Q8 | Bags used during a ranked war, from its start to its end, do not count against anyone. |
| Q9 | There is one net, used everywhere: given minus bags used outside ranked wars. The overview still shows total use with the war part split out. |
| Q4 | Timeframes: 24 hours, 7 days (the default), 30 days, 90 days and all time. |
| Q5 | A blood-type filter: All types (the default), then A+, A-, B+, B-, AB+, AB-, O+ and O-. |
| Q6 | The lists show current members only. The overview totals count everyone, so they match the armoury. |
| Q10 | The viewer sees their own row, even outside the top 10. |
| Q11 | Each list holds at most 10. The Wall of Shame lists only members whose net is below zero, and never pads. |
| Q7 | Updated every hour from the faction's armoury news, using the owner's faction key, as /slackers does. The page shows the time of the last update. |
| Q14 | History is filled in once, a year back, at no more than 10 calls a minute, and no more than 2 a minute while a ranked war is live. The owner chose this on 2026-10-24; at first it waited for the war to end. "All time" means since that date. |

## What the page shows

- **Sign-in:** the same Torn-key sign-in as /slackers (`POST /api/auth`, token in localStorage). The browser swaps the key for a token and doesn't keep it; warboard keeps the key the way every `/api/auth` sign-in does.
- **Filters:**
  - Timeframe: Past 24 hours, Past 7 days, Past 30 days, Past 90 days, All time (since the month the backfill reaches back to, for example "since Oct 2025").
  - Blood type: All types, then the eight types.
- **Overview tiles:**
  - **Given.**
  - **Used**, with the part used during wars underneath ("612 during wars").
  - **Net:** given minus used outside wars.
  - **Members:** today's member count.

  Under the tiles: "Latest update: N minutes ago (HH:MM TCT)".
- **Three lists**, each with rank, name (a link to the Torn profile) and figure:
  - **Top 10 Contributors:** most given.
  - **Top 10 Net Contributors:** highest net above zero.
  - **Wall of Shame:** net below zero, lowest first.
- **You:** one line above the lists, for example "You: #14 of 95 - 12 given, 4 used (1 during wars), net +9". The place is the viewer's position in the whole membership ordered by net. A viewer with nothing in the window sees "You: no blood bags given or used in this window".
- **Layout:** dark cards like the screenshot. The three lists sit side by side on a wide screen and stack on a phone.

## Where the numbers come from

### The armoury news lines

These are the lines the faction's armoury news holds. They were sampled on 2026-10-24 across windows back to 2019 (898 lines, 294 about blood).

| Line | Counts as |
|---|---|
| `<player> filled one of the faction's Empty Blood Bags to create a Blood Bag : <type>` | given 1, of that type (Torn writes it this way since about April 2026) |
| `<player> filled one of the faction's Empty Blood Bag items`, with or without a closing "." | given 1, no type (older lines) |
| `<player> deposited Nx Blood Bag : <type>` (older lines write `N x`) | given N, of that type |
| `<player> used one of the faction's Blood Bag : <type> items`, with or without a closing "." | used 1, of that type |
| `<player> gave Nx Blood Bag : <type> to <name>` or `to themselves` | used N by the person it went to |
| `<player> loaned Nx Blood Bag : <type> to <name>` or `to themselves` | used N by the person it went to |
| `<player> returned Nx Blood Bag : <type>` | used minus N for that player |
| `<player> retrieved Nx Blood Bag : <type> from <name>` | used minus N for `<name>` |
| `deposited Nx Empty Blood Bag`, `opened a Box of Medical Supplies and gained Nx Empty Blood Bag ...`, any irradiated bag | nothing |

The sample held no gave, loaned, returned or retrieved lines for blood bags. Their wording comes from the same lines for other items.

**Reading a line:**
- The player is the profile link's XID. Torn writes the link as `href = "http://www.torn.com/profiles.php?XID=N"`, with spaces around `=` and plain http, so the reader must not insist on `href="`.
- The name is stored as it appears, because lines from former members are common in older history.
- One player can log up to three fills in the same second, so each line's own id, not the player and time, decides what is a repeat.

### Collecting

- **When:** every hour, using the owner's faction key (`store.getFactionApiKey("42055")`), never a pooled member key.
- **What:**
  - It reads Torn's v2 faction news twice: `cat=armoryAction` (fills, uses, hand-outs) and `cat=armoryDeposit` (deposits).
  - Each call asks for `limit=100`, newest first.
  - It walks back a page at a time and stops at the first page that reaches lines it has already stored.
- **No line is skipped at a page edge:**
  - The next page asks for lines up to and including the oldest second already seen, and repeats are dropped by line id.
  - Checked live on 2026-10-24: Torn's `to` leaves its own second out and `from` includes its own, so the next page asks for `to` = the oldest second + 1.
  - If a page makes no progress (all of it in one second), the walk steps a second back and logs that.
- **Errors:** Torn reports errors in the body at HTTP 200, so every response's `error` is checked, and a reply without its list counts as an error, not as an empty page. A failed poll keeps the data it has, logs, and tries again the next hour.
- **What is kept:** only blood-bag lines, as the line id, time, player id and name, kind, blood type (or none) and count, and for a hand-out, who received it. Everything else in the news is dropped. A blood-bag line in a wording the reader does not know is kept as written and logged once. Each start reads those lines again, so they count once the reader knows the wording.
- **Where:** `data/blood-bags/42055.json`, in its own folder like `data/chain-hits/` and `data/gym-energy/`. It is written to a temporary file and renamed, by the server process, so the server's own user owns it.
- **Two jobs, one store:** the hourly poll works down from the newest lines and the backfill works down from its saved place. Both write the same store, and repeats are dropped by line id.
- **Cost:** about 3 calls an hour: one page of each category, and the ranked-war list. The armoury logs about 360 action lines and a few deposit lines a day, so an hour's news fits in one page of each.

### The one-year backfill

- It runs once, from the newest line back to 365 days before the day it starts, for both categories.
- No more than 10 calls a minute, and no more than 2 a minute (a page every 30 seconds) while a ranked war is live, so the war pollers keep the key's budget. The hourly poll is not slowed: its calls go out between the backfill's pages.
- It remembers where it is, so a server restart resumes it.
- Once the hourly read of the war list shows the war is over, it goes back to 10 a minute. A war list more than 65 minutes old (an hour's poll plus 5 minutes), or one that could not be read, counts as a war, so a war it cannot see costs no more than one it can. It logs a line when it slows down and when it speeds back up, not for every page.
- It marks itself done. "All time" then means since the date it reached back to, about October 2025.
- **Cost:** about 1,300 calls: a little over 2 hours at 10 a minute, or about 11 hours at the war pace. About 360 action lines a day comes to 3 or 4 calls per day of history; deposits are about 25 calls a year.

### Ranked-war windows

- **Source:** Torn's public ranked-war list for the faction, `/v2/faction/42055/rankedwars`, read every hour with the poll, so a war's start and end are known within the hour. One call reaches back to October 2024.
- **A war's window:** from its `start` to its `end`. A war with no end yet is live, and its window runs to now.
- The server's own war history begins in April 2026, which does not cover the year, so it is not used here.

## The numbers

For the chosen window and blood type, per player:
- **given:** fills plus filled-bag deposits.
- **used:** uses, plus hand-outs received, minus returns, never below zero. A return cancels use wherever it falls, so bags lent outside a war and returned during one cancel out.
- **used during wars:** uses and hand-outs received inside a ranked-war window, minus the returns there, never below zero and never more than used.
- **net** = given − (used − used during wars). So a return never counts as a gift.

No timeframe starts before the history is complete. While the backfill runs, every timeframe starts no earlier than the point both categories have reached. Deposits fill in much sooner than actions, and would otherwise be counted without the fills and uses beside them.

Typeless fills count under All types only.

- **Lists:** only players on today's roster. The roster comes from the faction's basic data on the owner's key and is cached for an hour, as /slackers does it.
- **Overview:** totals over every player, including former members.
- **Top 10 Contributors:** given above zero, highest first. Ties go by name.
- **Top 10 Net Contributors:** net above zero, highest first. Ties go by name.
- **Wall of Shame:** net below zero, lowest first. Ties go by name.
- **Members:** today's roster size.
- **Latest update:** when the last hourly poll succeeded.

## Access

- `GET /api/bloodbags?window=24h|7d|30d|90d|all&type=all|A+|...` sits behind `requireAuth`, the token from `POST /api/auth`.
  - It answers 200 to a member of faction 42055 and to the owner.
  - It answers 403 ("This board is for Dead Fragment members.") to anyone else, and 401 with no token.
  - A window or type it does not know is a 400.
- `GET /bloodbags` serves the markup only. Every number comes from the route above, which is where the gate is.

## Edge cases

- A former member counts in the totals and appears on no list.
- A member who only used bags during wars has a net of zero, so they appear on no list.
- Before the first poll, the page says the board has no data yet. If that poll failed, it says so, and that it tries again every hour.
- While the backfill runs, the page says how far back the data reaches so far, and during a ranked war that the rest is filling in slowly. "All time" means that far, and no shorter timeframe starts before it.
- If the member list could not be refreshed, the board uses the last one it has and says the lists may be out of date.
- If the hourly poll has been failing, "Latest update" shows its age, so a stale board says so.
- A live war's use counts as war use from its start to now.

## Testing

**Model tests (`blood-bags-model.test.js`):**
- Reading every line in the table above: typed and untyped fills, `N x` and `Nx`, the closing ".", the spaced link, hand-outs to a name and to themselves, returns and retrievals.
- Three lines from one player in one second are three bags.
- Windows and the type filter, including untyped fills under All types only.
- War use counts in the overview and not in net.
- Former members: in the totals, on no list.
- Ordering and ties, the Wall's floor of zero, no padding, and the You line.

**Collector tests (`blood-bags.test.js`):**
- With a fake fetch: walking pages, dropping repeats, stopping at stored lines, the no-progress guard and the Torn body error.
- The backfill: its pace, the slower pace while a war is live or the war list is out of date, the poll going on beside it, and resuming from its saved place.

**Route test:** a member gets 200, another faction 403, no token 401, the owner 200.

**After release:** the first poll's counts are checked by hand against the armoury news.

## Release

- **Server code, so:** pm2 reload as root and the health check, under the standing OK. Then commit and push.
- The backfill starts on its own after the reload and runs for about 2 hours, or about 11 at the war pace while a ranked war is live.
- Nothing is installed on anyone's device.

## Not in this version

- Credit for supplying Empty Blood Bags (Q13).
- Per-type figures for fills before about April 2026. Torn did not record the type then.
- The xanax tracker's page walk can skip lines that share a second. That is a separate, older bug, offered to the owner as its own fix.
- Notifications or faction-chat posts.
- A per-member history page.
