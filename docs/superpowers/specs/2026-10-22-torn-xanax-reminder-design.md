# Torn Xanax Reminder (design)

**Status:** questions answered by the owner on 2026-10-22 (EDT). This spec is waiting for the owner's review.
**Script:** `server/public/scripts/torn-xanax-reminder.user.js` and `.meta.js`, version 1.0.0. Tests: `server/torn-xanax-reminder.test.mjs`.

## Why

The owner asked for "a xanax icon for when drug cooldown is empty", "like the blood bag method but for xanax". The Blood Bag Reminder puts an icon in Torn's row of status icons when it is time to fill blood bags. It reads Torn's own sidebar data, so it needs no API key. This script does the same for Xanax: an icon in that row as soon as your drug cooldown is over.

## Decisions

| # | Decision |
|---|---|
| Q1 | A new script of the owner's: "Torn Xanax Reminder", file `torn-xanax-reminder.user.js`. RussianRob, All Rights Reserved, served on tornwar and ready to paste to Greasy Fork. Not part of the Blood Bag copy, which stays ButtChew's script plus a fix, and not part of Gym Coach. |
| Q2 | The icon shows as soon as the drug cooldown is over. Nothing else gates it. |
| Q3 | Tapping opens your items page on the Drugs tab. |
| Q4 | Torn's own Xanax picture, at the size of the other icons, with a thin dark edge so it shows in light mode. It pulses once when it appears, like the blood bag. Mock-up, with the owner's real icons: https://tornwar.com/s/eb90faa22e66a87f.jpg (a 30-day link). |
| Q5 | First in the row. When the blood bag icon is showing, the Xanax sits right after it. |
| Q6, Q7 | In the 24 hours before your faction's next ranked war starts, tapping opens the faction armoury on its Drugs tab instead. The owner's words: "armoury as a choice for 24h before a war starts", then 7a (switch automatically, no two-button choice). There is no settings menu for where it goes. |
| Q8 | The war's start time comes from Torn's API, using your key. A Public-level key is enough. You enter it once, and PDA fills it in by itself. Without a key, the tap always opens your items. |
| Assumed | These went to the owner as assumptions and were not corrected: only ranked wars count, not raids or territory wars; the window ends when the war starts; the script asks Torn about the war at most once every 30 minutes, shared across tabs. |

## What it shows

One icon in Torn's row of status icons, the row under your name in the sidebar (on a phone, the strip you swipe at the top).

- **Picture:** Torn's Xanax item picture, `https://www.torn.com/images/items/206/large.png` (same site, nothing hosted elsewhere). It is 100 x 50, so it is drawn at 17 x 17 with `object-fit: contain`, which leaves a 17 x 8.5 pill. The edge is `filter: drop-shadow(0 0 .6px rgba(0,0,0,.85))`.
- **Pulse:** one 900 ms pulse when the icon is added, as the blood bag does. It doesn't repeat.
- **Label:** hovering over the icon (or focusing it) shows a tooltip styled like Torn's own, the same way the blood bag does. Its text is "Drug cooldown over: Xanax ready". In the war window it adds a line: "War starts in 5h 12m: this opens the faction armoury". The same text is the link's `aria-label`.
- **Its own ids:** `tm-xanax-reminder` for the icon and `tm-xanax-reminder-styles` for its stylesheet, so it can never be mistaken for the blood bag's.

## Where it goes

- **The row:** the first `ul[class*="status-icons"]` or `ul[class*="statusIcons___"]` inside `#sidebar`. The first name is Torn's old sidebar, the second the Fly-out sidebar (Torn renamed the row on 2026-10-20). Both builds put the row inside `div#sidebar`, and limiting the search to it keeps the script off any other list on the page (the Blood Bag review found Torn's header menu is the first `ul` on every page).
- **Position:** first in the row. When `#tm-full-life-bloodbag` (the blood bag icon) is in the row, the Xanax goes right after it. When the blood bag is added later, its script puts it first, so the order stays the same.
- **Room:** on desktop the row is a 152px grid with `overflow: hidden`, and one more icon can need another line. So the script lets the row grow (`height: auto; overflow: visible`), as the blood bag does, with the rule limited to `#sidebar`.
- **Torn redraws the row:** each check finds the icon by its id. If the icon is gone, or is no longer in the current row, it is added again. A check never adds a second icon.

## When it shows

The script checks every 2 seconds, as the blood bag does. No reload is needed for the icon to come or go.

1. **Torn's sidebar data** is in `sessionStorage`, under `sidebarData<your user id>`. Torn saves it again every time the sidebar changes: in both builds, the sidebar store's `subscribe` callback writes it. So the data is as fresh as the sidebar on screen.
2. **The drug cooldown** is one of the entries under `statusIcons.icons`. Timed entries carry `title`, `subtitle`, `timerExpiresAt` (Unix seconds), `serverTimestamp` and `factionUpgrade`. The medical cooldown's key is `medical_cooldown` (the blood bag and TornTools read it there). The drug cooldown is expected under `drug_cooldown`, and the API calls it "Drug Cooldown" (icon 53 on 2026-10-22; the number changes with the cooldown's length, so the script never uses it). An entry counts as the drug cooldown when its key is `drug_cooldown` or its title starts with "Drug Cooldown" (any letter case). The live check confirms the key.
3. **Over** means the sidebar data is there and either has no drug cooldown entry, or the entry's `timerExpiresAt` is now or earlier.
4. **Never a false "ready":**
   - With no sidebar data, or data that won't parse, there is no icon. Some pages have no sidebar, and "no data" is not "no cooldown".
   - A drug cooldown entry without a readable `timerExpiresAt` counts as still running.
5. **Taking a Xanax:** Torn's sidebar shows its Drug Cooldown icon again and saves the data. The next check removes the Xanax icon.

## The tap

The icon is a plain link that you tap. The script never clicks anything itself.

- **Normally:** `https://www.torn.com/item.php#drugs-items` (the same `#<kind>-items` form the blood bag's `#medical-items` uses).
- **In the war window:** `https://www.torn.com/factions.php?step=your&type=1#/tab=armoury&start=0&sub=drugs` (the blood bag's armoury link with `sub=medical` swapped for `sub=drugs`). The live check confirms that `sub=drugs` opens the Drugs tab.
- **The war window** runs from 24 hours before the start to the start: `start - 86400 <= now < start`, with `start` taken from the last answer Torn gave. A war that has started, or has an end time, is outside it.
- **Every check sets the link again**, so it switches at the start of the window and at the war's start without a reload.

## The war's start time

- **The call:** `https://api.torn.com/v2/faction/wars?key=<key>&comment=xanax-reminder`. Torn's documentation says "Get your faction's wars & pacts details. Requires public access key." The answer's `wars.ranked` is `{ war_id, start, end, target, winner, factions }`, or null when no ranked war is set. On 2026-10-22 it read `start: 1792681200` (15:00 UTC) and `end: null` for Dead Fragment's war that day.
- **It sends the request the way Gym Coach does:** `GM_xmlhttpRequest` with `@connect api.torn.com`, falling back to `fetch` where that isn't available.
- **How often:**
  - It asks only while the icon is showing. That is the only time the answer matters.
  - At most once every 30 minutes, across all tabs. The time of the last call is kept in GM storage, which tabs share (in PDA, GM storage is the page's `localStorage`, which tabs also share). A tab writes that time before it calls, so two tabs don't both call.
  - At most 2 calls an hour, and none while you're on cooldown.
- **What is kept:** the war's `start` (or "no ranked war") and when it was checked, in GM storage.
- **When it fails** (no key, a Torn error such as code 2 "Incorrect key", or no answer):
  - The tap uses the last start time Torn gave. If there is none, it opens your items.
  - It waits the same 30 minutes before trying again.
  - The tooltip adds "Couldn't check the war time: <Torn's message>", so a bad key is visible.
  - The key itself never appears in the tooltip, the console or anywhere outside the request.

## The key

- **PDA:** the source carries `###PDA-APIKEY###` once and only once. PDA swaps it for your key. A second copy, or one split across strings, breaks PDA's substitution.
- **Everywhere else:** you enter it once, in a small box:
  - It opens from the script's menu ("Set API key"), where the userscript manager has a menu.
  - It also opens on a long press of the Xanax icon, as the blood bag's settings do. That reaches it in any app, even one with no menu.
  - The box says a Public-level key is enough, and has Save, Clear and Cancel.
  - The input is a plain text field, never `type="password"`, which sets off password managers.
- **Stored:** in GM storage. A saved key beats the PDA one. An empty key means no key.

## Where it runs

- `@match https://www.torn.com/*` and `https://torn.com/*`, `@run-at document-idle`. That's every page with Torn's sidebar.
- **Hosts:** Tampermonkey (desktop and phone), Torn PDA and the warboard app.
  - Every `GM_*` call is guarded with `typeof`, because PDA has crashed on `GM_registerMenuCommand` before.
  - The source is plain ASCII, because PDA turns curly quotes into a syntax error.
- **Loaded twice on the same page,** it runs once.
- **Errors** are caught inside each check, so a bad value never reaches Torn's page.

## Files

- `server/public/scripts/torn-xanax-reminder.user.js` and `.meta.js`, owned `warboard:warboard`.
- **Header:**
  - @name "Torn Xanax Reminder", @namespace and @author RussianRob, @license All Rights Reserved, @version 1.0.0, a CHANGELOG block.
  - @downloadURL and @updateURL: `https://tornwar.com/scripts/torn-xanax-reminder.user.js` and `.meta.js`.
  - @grant: GM_getValue, GM_setValue, GM_xmlhttpRequest, GM_registerMenuCommand. @connect api.torn.com.
- The served file and the repo are the same file (`server/public/scripts` is served), committed and pushed together.

## Testing

Tests come first, with node:test and linkedom, in `server/torn-xanax-reminder.test.mjs`.

- **Fixtures:**
  - The three sidebar layouts from the Blood Bag test: Fly-out phone, Fly-out desktop, and the old sidebar.
  - The desktop one is nested as the review found: `#sidebar.desktop___ > div.userInformation___ > ul.statusIcons___`, with the "Information" title bar beside it, not around it.
  - Each page also has Torn's header list (`#header-wrapper-top ul.menu-items`) before `#sidebar`, so a selector that is too wide fails.
- **Shows and hides:**
  - A cooldown still running gives no icon. One whose end time has passed gives the icon, and so does no drug cooldown at all.
  - No sidebar data, or data that won't parse, gives no icon.
  - A drug cooldown with no end time gives no icon.
  - An entry is matched by its title when the key is different.
  - When the cooldown comes back, the icon goes.
- **Place:**
  - The icon is first in the row in all three layouts.
  - It sits after the blood bag when that is there.
  - Repeated checks still leave exactly one icon.
  - When Torn replaces the row, the icon moves into the new one.
  - The header list never gets an icon or the grow rule.
- **The tap,** with a fixed clock and a stubbed API:
  - It opens your items normally.
  - It opens the armoury from 24h before the start, and your items again from the start onward.
  - It opens your items with no key, and on an API error with nothing cached.
  - An API error after a good answer keeps that answer.
- **API use:**
  - No call while the icon is hidden, and no call without a key.
  - At most one call per 30 minutes, even with two "tabs" sharing storage.
  - The key never shows up in the tooltip, `aria-label` or console output.
- **The source:**
  - The header fields match this spec, and the meta file matches the header.
  - The source is plain ASCII.
  - `###PDA-APIKEY###` appears exactly once.
  - There is no `type="password"`.
- **Mutants:** a few, such as a bare `ul` selector, an inverted window test, and a check that adds a second icon. Each must fail a test.

## Live check (owner, after release)

- With Fly-out on: the icon appears once the drug cooldown is over, and goes after you take a Xanax.
- The tap opens your items on the Drugs tab. In the 24 hours before a ranked war, it opens the armoury's Drugs tab.
- A long press opens the key box.
- Through remote inspect: the drug cooldown's key in Torn's sidebar data, and that `sub=drugs` is the armoury's Drugs tab.

## Not in this version

- Checking that you actually have a Xanax. That needs your inventory.
- War stack or any Gym Coach advice ("train first, then take the Xanax").
- Sounds or notifications.
- The booster cooldown.
- A different tap during the war itself.
