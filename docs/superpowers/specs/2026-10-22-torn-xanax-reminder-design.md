# Torn Xanax Reminder (design)

**Status:** approved by the owner on 2026-10-22 (EDT), with one change to the war window: "change it to tap to select items for armoury or items then write it" (see Q6, Q7). Amended on 2026-10-24 (EDT) for 1.0.3, a settings box and a tap setting for the war: the owner asked "or create a settings box like bloodbags that gives us an option if inwant to go to fac armourybdueing war", then approved the design with "yes go with your recommendations" (see Q9).
**Script:** `server/public/scripts/torn-xanax-reminder.user.js` and `.meta.js`, version 1.0.3. Tests: `server/torn-xanax-reminder.test.mjs`.

## Why

The owner asked for "a xanax icon for when drug cooldown is empty", "like the blood bag method but for xanax". The Blood Bag Reminder puts an icon in Torn's row of status icons when it is time to fill blood bags. It reads Torn's own sidebar data, so it needs no API key. This script does the same for Xanax: an icon in that row as soon as your drug cooldown is over.

## Decisions

| # | Decision |
|---|---|
| Q1 | A new script of the owner's: "Torn Xanax Reminder", file `torn-xanax-reminder.user.js`. RussianRob, All Rights Reserved, served on tornwar and ready to paste to Greasy Fork. Not part of the Blood Bag copy, which stays ButtChew's script plus a fix, and not part of Gym Coach. |
| Q2 | The icon shows as soon as the drug cooldown is over. Nothing else gates it. |
| Q3 | Tapping opens your items page on the Drugs tab. |
| Q4 | Torn's own Xanax picture, at the size of the other icons (since 1.0.2, 1.5 times that: see Picture), with a thin dark edge so it shows in light mode. It pulses once when it appears, like the blood bag. Mock-up, with the owner's real icons: https://tornwar.com/s/eb90faa22e66a87f.jpg (a 30-day link). |
| Q5 | First in the row. When the blood bag icon is showing, the Xanax sits right after it. |
| Q6, Q7 | In the 24 hours before your faction's next ranked war starts, tapping the icon shows two buttons, **Armoury** and **Items**, and you pick. At any other time it opens your items. The owner first said "armoury as a choice for 24h before a war starts" and chose 7a (switch automatically). On reviewing this spec they changed it to the choice: "change it to tap to select items for armoury or items". Until 1.0.3 there was no setting for where it goes; since then this choice is the "Ask each time" setting, the default (Q9). |
| Q8 | The war's start time comes from Torn's API, using your key. A Public-level key is enough. You enter it once, in the settings box, and PDA fills it in by itself. Without a key, the tap always opens your items. |
| Q9 | 1.0.3 adds a settings box, laid out like the Blood Bag Reminder's (a long press on the icon, or "Xanax Reminder: Settings" in the menu), with the API key and a list, "During a ranked war": **Ask each time** (the Armoury/Items box, the default), **Faction Armoury (Drugs)** or **Your Items (Drugs)**. The war counts from 24 hours before its start until Torn gives it an end time; while it is on, the box's title says "Ranked war on". Outside a war a tap opens your items, and that is not a setting. Without a key a tap always opens your items. Save says "Saved." and closes a second later, or says "Couldn't save, try again." and stays open. The owner had written: "the xanax icon isnt giving me an option i dont know id its saving my api key when i enter it". |
| Assumed | These went to the owner as assumptions and were not corrected: only ranked wars count, not raids or territory wars; the window ends when the war starts (until 1.0.3; since then the war period lasts until Torn gives the war an end time, Q9); the script asks Torn about the war at most once every 30 minutes, shared across tabs. |

## What it shows

One icon in Torn's row of status icons, the row under your name in the sidebar (on a phone, the strip you swipe at the top).

- **Picture:** Torn's Xanax item picture, `https://www.torn.com/images/items/206/large.png` (same site, nothing hosted elsewhere). It is 100 x 50. Since 1.0.2 it is drawn 1.5 times the 17 px slot: a 26 x 17 box with `object-fit: contain`, which leaves a 26 x 13 pill, centred on the slot by `margin-left: -4.5px` and spilling about 4 px into the gap on each side. The box is the slot's height rather than having a top margin, which would collapse through the link and move it down off its slot. The slot (the `li` and its link) stays 17 x 17, so no other icon moves. Until then it was drawn at 17 x 17, a 17 x 8.5 pill; on 2026-10-22 the owner asked for the pill "bigger and zoomed in" and chose this from a mock-up: https://tornwar.com/s/a04b78a14385d3bd.jpg (a 30-day link). The edge is `filter: drop-shadow(0 0 .6px rgba(0,0,0,.85))`.
- **Pulse:** one 900 ms pulse when the icon is added, as the blood bag does. It doesn't repeat.
- **Label:** hovering over the icon with a mouse, or focusing it from the keyboard, shows a tooltip styled like Torn's own. Its lines:
  - first, in bold: "Drug cooldown over: Xanax ready";
  - in the war period: "War starts in 5h 12m: <the tap>" before the start, and "Ranked war on: <the tap>" from it, where <the tap> is "tap to pick the armoury or your items", "tap to open the armoury" or "tap to open your items", as the setting says;
  - when the last war check failed: "Couldn't check the war time: <Torn's message>".
  - The link's `aria-label` is the same lines joined with ". ".
  - Times read "5h 12m", or "45m" under an hour. Minutes round up, so it never says "0m".
  - A touch doesn't open the tooltip. On an iPhone, a page that changes when a finger "hovers" turns the first tap into a hover, and the tap goes nowhere. A tap also focuses the link, so focus opens the tooltip only from the keyboard (where the browser can tell).
- **Its own ids:** `tm-xanax-reminder` for the icon, `tm-xanax-reminder-styles` for its stylesheet and `tm-xanax-reminder-settings` for the settings box, so it can never be mistaken for the blood bag's.

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
- **In the war period,** a tap does what the settings box says (see The settings box):
  - **Ask each time** (the default): a tap opens a small box under the icon instead. It holds the line "War starts in 5h 12m", or "Ranked war on" from the start, and two buttons, **Armoury** and **Items**, which are the two links above.
  - **Faction Armoury (Drugs):** the icon's link points at the armoury, so a tap goes straight there, with no box.
  - **Your Items (Drugs):** a tap goes straight to your items, with no box.
  - A stored setting the script doesn't know reads as Ask each time.
- **How the box works:**
  - It is styled like Torn's tooltip.
  - It closes when you tap anywhere that is neither the box nor the icon, press Escape, scroll (it would float away from the icon), tap the icon again, or tap one of its links (which still opens). It also closes when the icon goes, when the war period ends, or when the setting stops being Ask each time.
  - The tap that opens it never also closes it.
  - There is never more than one box.
  - The icon's own link still points at your items, so if anything in the box fails, a tap still gets you somewhere useful.
- **The war period** runs from 24 hours before the start until Torn gives the war an end time: `start - 86400 <= now`, with no end time, from the last answer Torn gave. Any end time means the war is over. On 2026-10-24 none of the faction's 99 ended wars had an end time later than when it was read, and the longest ran 108 hours, so the period has no cap. If a war ends while every check fails (a bad key, Torn down), the tap keeps the war behaviour until a check succeeds; the settings box shows how long ago Torn last answered and why the last check failed.
- **Every check works out the period again** and sets the icon's link, so the tap changes at the start of the period, at the war's start and at its end, and when the setting or the key changes, without a reload. A redrawn row gets the same link.
- **A long press** (500 ms, as the blood bag) opens the settings box. The tap that ends a long press doesn't open the choice box or follow the link. The phone's own long-press menu for links is held back on the icon. A right-click keeps its menu.

## The war's start time

- **The call:** `https://api.torn.com/v2/faction/wars?key=<key>&comment=xanax-reminder`. Torn's documentation says "Get your faction's wars & pacts details. Requires public access key." The answer's `wars.ranked` is `{ war_id, start, end, target, winner, factions }`, or null when no ranked war is set. On 2026-10-22 it read `start: 1792681200` (15:00 UTC) and `end: null` for Dead Fragment's war that day.
- **The request:** `GM_xmlhttpRequest` with `@connect api.torn.com` and `anonymous: true` (no cookies, as in Gym Coach's helper), falling back to `fetch` where the host has no `GM_xmlhttpRequest`.
- **How often:**
  - It asks while the icon is showing, when the answer matters, and once when a key is saved in the settings box, even during a cooldown, so the box can say whether the key works.
  - At most once every 30 minutes, across all tabs. The time of the last call is kept in GM storage, which tabs share (in PDA, GM storage is the page's `localStorage`, which tabs also share). A tab writes that time before it calls, so two tabs don't both call.
  - At most 2 calls an hour, and none while you're on cooldown, apart from one each time you save a key.
- **What is kept:** the war's `start` and `end` (0 for "no ranked war"), when a tab last asked (`at`), when Torn last answered (`okAt`), and the last error, in GM storage. Everything is stored as a string, because PDA hands stored values back as strings; numbers are read back with `Number()`, and a stored check time in the future (the clock moved back) means ask now.
- **With no key** there is no call and no extra line in the tooltip. The tap opens your items, even with a war time saved from an earlier key.
- **When a call fails** (a Torn error such as code 2 "Incorrect key", or no answer):
  - The tap uses the last start time Torn gave. If there is none, it opens your items.
  - It waits the same 30 minutes before trying again.
  - The tooltip adds "Couldn't check the war time: <Torn's message>", so a bad key is visible. With no answer at all, the message is "no answer from Torn".
  - The key itself never appears in the tooltip, the console or anywhere outside the request.

## The settings box

- **Opening it:**
  - A long press on the Xanax icon, as the blood bag's settings open. That reaches it in any app, even one with no menu.
  - Or the script's menu, where the userscript manager has one: "Xanax Reminder: Settings". It is named for the script because some menus list every script's entries together.
  - It opens over everything, even while the cooldown runs and there is no icon.
- **Its look** is the Blood Bag Reminder's settings:
  - a dark panel 450 px wide (at most 90% of the screen) on a dark overlay;
  - a header with the title "Xanax Reminder Settings" and an "x";
  - grey help text, a grey Cancel and a green Save.
  - The list and the field use 16 px text, or an iPhone zooms in when they are tapped.
  - Nothing is focused when it opens, so a phone doesn't raise its keyboard over it.
- **During a ranked war:** the list Ask each time, Faction Armoury (Drugs), Your Items (Drugs). It shows the saved choice, or Ask each time when none is saved. A line under it says what the list does and that a long press opens these settings.
- **API key:** a plain text field, never `type="password"`, which sets off password managers. It starts empty: the saved key is never shown.
- **The line under the key** says a Public-level key is enough, whether a key is saved (or PDA's is in use), and what Torn said:
  - "Not checked yet." until Torn answers.
  - "Checked 12m ago: ranked war on." The war part can also be "war starts in 5h 12m", "the ranked war is over" or "no ranked war set". Under a minute it says "just now". For an answer kept without its time (saved by 1.0.2), it says "earlier".
  - After a failed check: "Couldn't check the war time: <Torn's message>.", then "Torn last answered 3h 5m ago: ranked war on." if Torn has answered before.
  - With no key, it says the war choice needs one, and that until then a tap always opens your items.
- **Buttons:** Clear key, Cancel and Save.
  - Save keeps the war choice, and the key when one is typed (trimmed). An empty field keeps the saved key; only Clear key removes it. Enter in the field is Save.
  - Saving a key, or clearing it, forgets what Torn said with the old key and asks Torn at once, even during a cooldown.
  - A save counts only when storage gives the value back. Then:
    - the box says "Saved." (or "Key cleared.");
    - the icon's link and label follow at once;
    - the field empties, so a second Save asks Torn nothing more;
    - the box closes a second later.
  - If storage doesn't give the value back, the box says "Couldn't save, try again." and stays open, and the key saved before is kept.
  - Escape, Cancel, the "x", or a tap on the dark area around the box closes it without a change.
- **PDA:** the source carries `###PDA-APIKEY###` once and only once. PDA swaps it for your key. A second copy, or one split across strings, breaks PDA's substitution.
- **Stored:** in GM storage, as strings: the key, the war choice and the war record. A saved key beats the PDA one. An empty key means no key.

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
  - @name "Torn Xanax Reminder", @namespace and @author RussianRob, @license All Rights Reserved, @version 1.0.3, a CHANGELOG block. The in-file `VERSION` matches @version, and the console line on start carries it.
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
  - Outside the war period, a tap follows the link to your items, and no box opens.
  - From 24h before the start until Torn gives the war an end time, a tap opens the box with exactly two links, Armoury and Items, pointing where this spec says; after that, a tap goes straight to your items again.
  - With the armoury setting, the icon's link points at the armoury in that period. With the items setting, it points at your items, with no box. The link survives a redrawn row, and goes back when the setting or the key goes.
  - With no key, or an API error and nothing cached, a tap goes straight to your items.
  - An API error after a good answer keeps that answer.
  - Tapping outside the box, pressing Escape, scrolling, a second tap on the icon, or a tap on one of its links closes it. The tap that opens it doesn't close it. Two taps never give two boxes. The box goes when the icon goes.
  - A long press opens the settings box, and opens no choice box. A short press is a tap.
  - A mouse hover or focus shows the tooltip; a touch, `mouseenter` or `mouseover` doesn't.
  - The settings box:
    - the war list shows the saved choice;
    - the key field is a plain text field that starts empty;
    - Save, Clear key, Cancel and the "x" do what this spec says;
    - a save that storage refuses, drops or keeps only in part says so;
    - the line under the key says what Torn last said, and how long ago.
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
- A long press opens the settings box.
- 1.0.2: the pill shows whole (not cropped) and centred where the 1.0.1 icon was, and a tap on either end opens the Drugs tab.
- 1.0.3: a long press opens "Xanax Reminder Settings", and the line under the key says "A key is saved." with what Torn last said. Choose Faction Armoury (Drugs) and Save: it says "Saved." and closes. During the war, a tap then opens the armoury on its Drugs tab (`sub=drugs`). Ask each time, back again, gives the box titled "Ranked war on".
- Through remote inspect: the drug cooldown's key in Torn's sidebar data, and that `sub=drugs` is the armoury's Drugs tab.

## Not in this version

- Checking that you actually have a Xanax. That needs your inventory.
- War stack or any Gym Coach advice ("train first, then take the Xanax").
- Sounds or notifications.
- The booster cooldown.
