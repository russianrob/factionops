# Torn Xanax Reminder (design)

**Status:** approved by the owner on 2026-10-22 (EDT), with one change to the war window: "change it to tap to select items for armoury or items then write it" (see Q6, Q7).
**Script:** `server/public/scripts/torn-xanax-reminder.user.js` and `.meta.js`, version 1.0.1. Tests: `server/torn-xanax-reminder.test.mjs`.

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
| Q6, Q7 | In the 24 hours before your faction's next ranked war starts, tapping the icon shows two buttons, **Armoury** and **Items**, and you pick. At any other time it opens your items. The owner first said "armoury as a choice for 24h before a war starts" and chose 7a (switch automatically). On reviewing this spec they changed it to the choice: "change it to tap to select items for armoury or items". There is no settings menu for where it goes. |
| Q8 | The war's start time comes from Torn's API, using your key. A Public-level key is enough. You enter it once, and PDA fills it in by itself. Without a key, the tap always opens your items. |
| Assumed | These went to the owner as assumptions and were not corrected: only ranked wars count, not raids or territory wars; the window ends when the war starts; the script asks Torn about the war at most once every 30 minutes, shared across tabs. |

## What it shows

One icon in Torn's row of status icons, the row under your name in the sidebar (on a phone, the strip you swipe at the top).

- **Picture:** Torn's Xanax item picture, `https://www.torn.com/images/items/206/large.png` (same site, nothing hosted elsewhere). It is 100 x 50, so it is drawn at 17 x 17 with `object-fit: contain`, which leaves a 17 x 8.5 pill. The edge is `filter: drop-shadow(0 0 .6px rgba(0,0,0,.85))`.
- **Pulse:** one 900 ms pulse when the icon is added, as the blood bag does. It doesn't repeat.
- **Label:** hovering over the icon with a mouse, or focusing it from the keyboard, shows a tooltip styled like Torn's own. Its lines:
  - first, in bold: "Drug cooldown over: Xanax ready";
  - in the war window: "War starts in 5h 12m: tap to pick the armoury or your items";
  - when the last war check failed: "Couldn't check the war time: <Torn's message>".
  - The link's `aria-label` is the same lines joined with ". ".
  - Times read "5h 12m", or "45m" under an hour. Minutes round up, so it never says "0m".
  - A touch doesn't open the tooltip. On an iPhone, a page that changes when a finger "hovers" turns the first tap into a hover, and the tap goes nowhere. A tap also focuses the link, so focus opens the tooltip only from the keyboard (where the browser can tell).
- **Its own ids:** `tm-xanax-reminder` for the icon and `tm-xanax-reminder-styles` for its stylesheet, so it can never be mistaken for the blood bag's.

## Where it goes

- **The row:** the first `ul[class*="status-icons"]` or `ul[class*="statusIcons___"]` inside `#sidebar`. The first name is Torn's old sidebar, the second the Fly-out sidebar (Torn renamed the row on 2026-10-20). Both builds put the row inside `div#sidebar`, and limiting the search to it keeps the script off any other list on the page (the Blood Bag review found Torn's header menu is the first `ul` on every page).
- **Position:** first in the row. When `#tm-full-life-bloodbag` (the blood bag icon) is in the row, the Xanax goes right after it. When the blood bag is added later, its script puts it first, so the order stays the same.
- **Room:** on desktop the row is a 152px grid with `overflow: hidden`, and one more icon can need another line. So the script lets the row grow (`height: auto; overflow: visible`), as the blood bag does, with the rule limited to `#sidebar`.
- **Torn redraws the row:** the script builds the icon once and keeps it. Each check finds the row afresh, and if the icon is no longer in it, puts it back (first, or after the blood bag). A check never adds a second icon.

## When it shows

The script checks every 2 seconds, as the blood bag does. No reload is needed for the icon to come or go. Unlike the blood bag, it doesn't also watch the page for changes, so nothing it writes can set off another check.

1. **Torn's sidebar data** is in `sessionStorage`, under `sidebarData<your user id>`. Torn saves it again every time the sidebar changes: in both builds, the sidebar store's `subscribe` callback writes it. So the data is as fresh as the sidebar on screen.
2. **The drug cooldown** is one of the entries under `statusIcons.icons`. Timed entries carry `title`, `subtitle`, `timerExpiresAt` (Unix seconds), `serverTimestamp` and `factionUpgrade`. The medical cooldown's key is `medical_cooldown` (the blood bag and TornTools read it there). The drug cooldown is expected under `drug_cooldown`, and the API calls it "Drug Cooldown" (icon 53 on 2026-10-22; the number changes with the cooldown's length, so the script never uses it). An entry counts as the drug cooldown when its key is `drug_cooldown` or its title starts with "Drug Cooldown" (any letter case). The live check confirms the key.
3. **Over** means the sidebar data is there and either has no drug cooldown entry, or the entry's `timerExpiresAt` is now or earlier.
4. **Never a false "ready":**
   - With no sidebar data, data that won't parse, or data without a `statusIcons.icons` object, there is no icon. Some pages have no sidebar, and "no data" is not "no cooldown".
   - A drug cooldown entry without a readable `timerExpiresAt` counts as still running. A number in a string is read as the number.
5. **Taking a Xanax:** Torn's sidebar shows its Drug Cooldown icon again and saves the data. The next check removes the Xanax icon.

## The tap

The script never clicks anything itself. Every way out of the icon is a plain link that you tap.

- **The two links:**
  - Items: `https://www.torn.com/item.php#drugs-items` (the same `#<kind>-items` form the blood bag's `#medical-items` uses).
  - Armoury: `https://www.torn.com/factions.php?step=your&type=1#/tab=armoury&start=0&sub=drugs` (the blood bag's armoury link with `sub=medical` swapped for `sub=drugs`). The live check confirms that `sub=drugs` opens the Drugs tab.
- **Normally,** the icon is a link to your items. A tap goes straight there.
- **In the war window,** a tap opens a small box under the icon instead. It holds:
  - the line "War starts in 5h 12m";
  - two buttons, **Armoury** and **Items**, which are the two links above.
- **How the box works:**
  - It is styled like Torn's tooltip.
  - It closes when you tap anywhere that is neither the box nor the icon, press Escape, scroll (it would float away from the icon), tap the icon again, or tap one of its links (which still opens). It also closes when the icon goes, or when the war starts.
  - The tap that opens it never also closes it.
  - There is never more than one box.
  - The icon's own link still points at your items, so if anything in the box fails, a tap still gets you somewhere useful.
- **The war window** runs from 24 hours before the start to the start: `start - 86400 <= now < start`, with `start` taken from the last answer Torn gave. A war that has started, or has an end time, is outside it.
- **Every check works out the window again,** so the tap switches between "straight to items" and "pick one" at the start of the window and at the war's start, without a reload.
- **A long press** (500 ms, as the blood bag) opens the key box (see The key). The tap that ends a long press doesn't open the choice box or follow the link. The phone's own long-press menu for links is held back on the icon. A right-click keeps its menu.

## The war's start time

- **The call:** `https://api.torn.com/v2/faction/wars?key=<key>&comment=xanax-reminder`. Torn's documentation says "Get your faction's wars & pacts details. Requires public access key." The answer's `wars.ranked` is `{ war_id, start, end, target, winner, factions }`, or null when no ranked war is set. On 2026-10-22 it read `start: 1792681200` (15:00 UTC) and `end: null` for Dead Fragment's war that day.
- **The request:** `GM_xmlhttpRequest` with `@connect api.torn.com` and `anonymous: true` (no cookies, as in Gym Coach's helper), falling back to `fetch` where the host has no `GM_xmlhttpRequest`.
- **How often:**
  - It asks only while the icon is showing. That is the only time the answer matters.
  - At most once every 30 minutes, across all tabs. The time of the last call is kept in GM storage, which tabs share (in PDA, GM storage is the page's `localStorage`, which tabs also share). A tab writes that time before it calls, so two tabs don't both call.
  - At most 2 calls an hour, and none while you're on cooldown.
- **What is kept:** the war's `start` and `end` (0 for "no ranked war"), when it was checked, and the last error, in GM storage. Everything is stored as a string, because PDA hands stored values back as strings; numbers are read back with `Number()`, and a stored check time in the future (the clock moved back) means ask now.
- **With no key** there is no call and no extra line in the tooltip. The tap opens your items, even with a war time saved from an earlier key.
- **When a call fails** (a Torn error such as code 2 "Incorrect key", or no answer):
  - The tap uses the last start time Torn gave. If there is none, it opens your items.
  - It waits the same 30 minutes before trying again.
  - The tooltip adds "Couldn't check the war time: <Torn's message>", so a bad key is visible. With no answer at all, the message is "no answer from Torn".
  - The key itself never appears in the tooltip, the console or anywhere outside the request.

## The key

- **PDA:** the source carries `###PDA-APIKEY###` once and only once. PDA swaps it for your key. A second copy, or one split across strings, breaks PDA's substitution.
- **Everywhere else:** you enter it once, in a small box:
  - It opens from the script's menu ("Xanax Reminder: Set API key", named for the script because some menus list every script's entries together), where the userscript manager has a menu.
  - It also opens on a long press of the Xanax icon, as the blood bag's settings do. That reaches it in any app, even one with no menu.
  - The box says a Public-level key is enough, and has Save, Clear and Cancel.
  - The saved key is never shown. The field starts empty, and the box says whether a key is saved (or PDA's is in use).
  - Save with an empty field changes nothing; only Clear removes a key. Saving a key, or clearing it, forgets what Torn said with the old key, so the next check (while the icon shows) asks at once.
  - Escape, Cancel, or a tap on the dark area around the box closes it without a change.
  - The input is a plain text field, never `type="password"`, which sets off password managers.
- **Stored:** in GM storage. A saved key beats the PDA one. An empty key means no key.

## Where it runs

- `@match https://www.torn.com/*` and `https://torn.com/*`, `@run-at document-idle`. That's every page with Torn's sidebar.
- **Hosts:** Tampermonkey (desktop and phone), Torn PDA and the warboard app.
  - Every `GM_*` call is guarded with `typeof`, because PDA has crashed on `GM_registerMenuCommand` before.
  - The source is plain ASCII, because PDA turns curly quotes into a syntax error.
- **Loaded twice on the same page,** it runs once. The first copy marks the page (`data-tm-xanax-reminder` on `<html>`), which every copy can see, and a second copy stops.
- **Errors** are caught inside each check, so a bad value never reaches Torn's page.

## Files

- `server/public/scripts/torn-xanax-reminder.user.js` and `.meta.js`, owned `warboard:warboard`.
- **Header:**
  - @name "Torn Xanax Reminder", @namespace and @author RussianRob, @license All Rights Reserved, @version 1.0.1, a CHANGELOG block. The in-file `VERSION` matches @version, and the console line on start carries it.
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
  - No sidebar data, data that won't parse, or data without status icons gives no icon.
  - A drug cooldown with no end time gives no icon; one whose end time is a number in a string is read as the number.
  - Other cooldowns (medical) don't hide the icon.
  - An entry is matched by its title when the key is different.
  - When the cooldown comes back, the icon goes.
- **Place:**
  - The icon is first in the row in all three layouts.
  - It sits after the blood bag when that is there.
  - Repeated checks still leave exactly one icon.
  - When Torn replaces the row, the icon moves into the new one.
  - The header list never gets an icon or the grow rule.
- **The tap,** with a fixed clock and a stubbed API:
  - Outside the window, a tap follows the link to your items, and no box opens.
  - From 24h before the start, a tap opens the box with exactly two links, Armoury and Items, pointing where this spec says. From the start onward, a tap goes straight to your items again.
  - With no key, or an API error and nothing cached, a tap goes straight to your items.
  - An API error after a good answer keeps that answer.
  - Tapping outside the box, pressing Escape, scrolling, a second tap on the icon, or a tap on one of its links closes it. The tap that opens it doesn't close it. Two taps never give two boxes. The box goes when the icon goes.
  - A long press opens the key box, and opens no choice box. A short press is a tap.
  - A mouse hover or focus shows the tooltip; a touch, `mouseenter` or `mouseover` doesn't.
  - The key box: a plain text field that starts empty; Save, Clear and Cancel do what this spec says.
- **API use:**
  - No call while the icon is hidden, and no call without a key.
  - At most one call per 30 minutes, even with two "tabs" sharing storage.
  - The key never shows up in the tooltip, `aria-label` or console output.
  - Stored values that come back as strings, or as objects, still work. A stored check time in the future means ask now.
- **The source:**
  - The header fields match this spec, and the meta file matches the header.
  - The source is plain ASCII.
  - `###PDA-APIKEY###` appears exactly once.
  - There is no `type="password"`.
- **Mutants:** a few, such as a bare `ul` selector, an inverted window test, and a check that adds a second icon. Each must fail a test.

## Live check (owner, after release)

- With Fly-out on: the icon appears once the drug cooldown is over, and goes after you take a Xanax.
- The tap opens your items on the Drugs tab. In the 24 hours before a ranked war, it shows the two buttons, and Armoury opens the armoury's Drugs tab.
- A long press opens the key box.
- Through remote inspect: the drug cooldown's key in Torn's sidebar data, and that `sub=drugs` is the armoury's Drugs tab.

## Not in this version

- Checking that you actually have a Xanax. That needs your inventory.
- War stack or any Gym Coach advice ("train first, then take the Xanax").
- Sounds or notifications.
- The booster cooldown.
- A different tap during the war itself.
