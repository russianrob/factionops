# Torn Icon Hider (design)

**Status:** approved by the owner on 2026-10-24 at 21:12 EDT: "approved, write the plan". The owner asked at 20:06 EDT, with a screenshot of the phone header: "can we create a script that shows which icons we want to show and which we want to hide". They answered "our own script" (20:10 EDT) and "do recommended" (20:14 EDT) to the questions below. Research into Torn's row after that turned up the rows marked **New** in the Decisions table, which the owner approved with the rest. Plan: `docs/superpowers/plans/2026-10-24-torn-icon-hider.md`.
**Script:** `server/public/scripts/torn-icon-hider.user.js` and `.meta.js`, version 1.0.0. Tests: `server/torn-icon-hider.test.mjs`.

## Why

Torn's row of status icons (under your name in the sidebar; on a phone, the strip at the top beside your money and points) shows every icon Torn has for you. On the owner's phone that is the blood bag (the Blood Bag Reminder's), then Male, a star, a heart, a fist, a book and a %, with a map icon cut off at the right edge. This script lets you choose which of Torn's icons show. The rest stay hidden until you bring them back.

TornTools has a "Hide Icons" setting, but the owner chose a script of their own, which works without TornTools, in the warboard app, Torn PDA and Tampermonkey.

## Decisions

| # | Decision |
|---|---|
| Q1 | A new script of the owner's: "Torn Icon Hider", file `torn-icon-hider.user.js`. RussianRob, All Rights Reserved, served on tornwar and ready to paste to Greasy Fork. It works with or without TornTools. The owner: "our own script". |
| Q2 | Every icon shows until you hide it. A kind of icon the script hasn't seen before shows. |
| Q3 | The settings box lists the icons that have been in your row: the ones there now, and every one seen since the script was installed, remembered. One switch per kind of icon: the levels of a cooldown (drug, booster, medical), of addiction, radiation and upkeep share one switch. |
| Q4 | Two ways to open the box: "Icon Hider: Settings" in the script menu, and a long press (500 ms) on any of Torn's icons in the row. The Xanax and Blood Bag icons keep their own long press. |
| Q5 | A hidden icon is gone from the row, with no "+N" in its place. The box still lists it, so it can be brought back. |
| Q6 | The script's own icons (the Xanax Reminder's and the Blood Bag Reminder's) are not in the list and are never hidden. |
| Q7 | The name is "Torn Icon Hider". |
| Said | Already said to the owner: each device keeps its own choices (GM storage belongs to each install); the script shows or hides icons and never reorders them; the box looks like the Xanax Reminder's settings. |
| New 1 | **The phone's own long-press menu on Torn's icons goes away** (open in a new tab, copy the link, the iPhone's link preview). Q4's long press needs it held back on every icon in the row, all the time, because the phone decides when the finger lands. A tap still does what it did. |
| New 2 | **In Torn PDA, one of Torn's icons always stays showing.** PDA shows no script menu, so a long press on an icon is the only way back to the box; with every icon hidden there would be no way back short of PDA's developer tools. So in PDA, Save won't hide the last icon showing in the row, and says why. Elsewhere (Tampermonkey, the warboard app) everything can be hidden, and the menu brings the box back. |
| New 3 | A hidden kind whose picture changes (a new level or state has a new picture number) can show for up to 2 seconds the first time that number appears, and stays hidden after that. The levels of the cooldowns, addiction, radiation and upkeep are known in advance and never show. |

## What it does

- **Hides** the icons you switch off, in Torn's row of status icons, on every page with Torn's sidebar. Nothing else changes: icons elsewhere on a page (profiles, faction member lists) stay as they are.
- **Learns** each kind of icon as it appears in your row, and remembers it.
- **The settings box** lists every kind it has learned, each with a switch.

## Kinds of icon

- **Torn's sidebar data** is in `sessionStorage`, under `sidebarData<your user id>`, as the Xanax and Blood Bag Reminders read it. Torn saves it again every time the sidebar changes. Its `statusIcons.icons` has one entry per icon in the row, in the row's order: both of Torn's sidebars draw the row from it, one icon per entry.
- **A kind** is an entry's key there, such as `drug_cooldown`, `faction` or `married`. Each entry carries `iconID`, a string such as `"icon52"`, and `title`, such as "Drug Cooldown". The script reads the picture number from `iconID` with `/^icon(\d+)$/`. An entry without such an `iconID` is skipped, as the script couldn't hide it.
- **Picture numbers change.** Each level of a cooldown or an addiction, and each faction role, has its own picture number (the drug cooldown runs 49 to 53). The key stays the same, and on some kinds the title changes too ("Minor Drug Addiction"). So for each kind the script keeps:
  - the latest title, as the icon's label reads it (Torn's label drops any HTML in the title);
  - every picture number seen with it;
  - nothing else. The details after the title (a timer, your spouse's name) are never stored.
- **A picture number belongs to the kind it was last seen with.** If Torn ever renames a key, the number moves to the new kind, which shows until you hide it (Q2). A kind left with no picture numbers is dropped from the list. A kind that is switched on is never hidden by another kind's numbers.
- **Known levels:** when a kind is hidden and one of its numbers is in one of these ranges, the whole range is hidden, so a new level never shows: booster cooldown 39-43, medical cooldown 44-48, drug cooldown 49-53, drug addiction 57-61, radiation 63-67, upkeep 78-80 (from TornTools' list of Torn's icons). Any other new number for a hidden kind shows until the next check learns it: at most 2 seconds, once per number (New 3).
- **The script's own icons** are not in Torn's data, so they are never learned, listed or hidden (Q6).
- **With no sidebar data** (some pages have none), the icons already hidden stay hidden. The script learns nothing new until the data is back.

## Hiding

- **One stylesheet, nothing else.** The script never changes, moves or removes Torn's icons. React draws Torn's sidebar; it breaks when its nodes are removed, and it wipes classes added to them. The script adds one `<style>`, `tm-icon-hider-styles`, with a rule per hidden picture number:
  `#sidebar ul[class*="status-icons"] > li[class*="icon52___"], #sidebar ul[class*="statusIcons___"] > li[class*="icon52___"] { display: none !important; }`
  - The two row names are Torn's old sidebar and the Fly-out sidebar, as in the Xanax Reminder.
  - `#sidebar` keeps the rules off `iconN___` icons on other parts of a page (faction member lists use them too).
  - The `___` after the number keeps `icon5` from matching `icon52`. Some of Torn's class names have four underscores (`icon52____l66f`); they still match.
- **Hidden icons stay in the page.** Other scripts that read the row still find them; Gym Coach reads the book you're reading from its icon's label.
- **From the first moment:** the script runs at `document-start`, before Torn draws anything. It builds the stylesheet from storage, learning first from the sidebar data the last page left, and puts it in the page at once (in `<html>`, as there is no `<head>` yet). So a hidden icon doesn't flash on a page load. A host that starts scripts later shows hidden icons for a moment, nothing worse.
- **Every check** (every 2 seconds, as the Xanax Reminder) reads Torn's data and storage again, learns what is new, and rewrites the stylesheet only when the hidden numbers change. That is also how a save in another tab reaches this one. If the stylesheet has gone from the page, the check puts it back.

## Room

- **Desktop:** Torn's row is a 152 px box that clips what doesn't fit, with 6 icons a line, 10 px apart: every icon has a 10 px right margin except every 6th (`li:nth-child(6n)`). A hidden icon still counts in that 6th, so lines would come out uneven: two icons touching, or a line of 5 and then one of 6. On the desktop row only (the row without Torn's `mobile___` class), and only while something is hidden, the script spaces the icons showing 6 a line, 10 px apart, as Torn does.
  - How is worked out in the plan and proved in headless Chromium against Torn's own stylesheets, with the Xanax and Blood Bag icons in the row (their pictures spill past their slots). The candidate is flex with a 10 px column gap and no margins.
  - Moving hidden icons to the end of the row, as TornTools does, is out: Torn's old sidebar reuses its icons by position, so a moved one could end up showing another icon.
- **Phone:** the strip scrolls sideways and closes up by itself. Torn's fade at its right edge (meaning "more to scroll") is worked out only on load, on a resize and on a scroll, so it would stay after icons are hidden. After the stylesheet changes, the script sends the strip a `scroll` event; both sidebars listen for it on the strip (`onScroll`) and work the fade out again. If the live check shows the fade stays, a `resize` on the window is the fallback.
- **Known behaviour, not a bug:** with few icons left, the strip no longer scrolls, Torn sits the icons at its right edge, and a sideways swipe across it opens the Fly-out panel. Torn behaves the same for anyone with few icons.

## The long press

- **Where:** any of Torn's icons in the row: an `li` with an `iconN___` class in the row the stylesheet targets. The Xanax and Blood Bag icons have no such class and keep their own long press.
- **How:** 500 ms with a finger or the main mouse button, as the Xanax Reminder. The listeners are on the document, in the capture phase, so they keep working when Torn redraws or replaces the row. A finger moving, the mouse leaving the icon, or letting go early cancels the press. A right-click keeps its menu.
- **The tap that ends it** does nothing else. Otherwise Torn would select the icon (opening its tooltip), follow its link, or reload the page when the link is the page you're on.
  - Touch: the long press's `touchend` is cancelled (`preventDefault`, with a listener that isn't passive), which stops the click it would make, as the Xanax Reminder's long press does. The live check confirms it on the owner's phone.
  - Mouse: the click after a long press is stopped in the capture phase with both `stopPropagation` (before Torn's React sees it) and `preventDefault` (before the link opens). Either alone is not enough.
- **The phone's own menu:** the stylesheet gives the row's icon links `-webkit-touch-callout: none` and no text selection, and a `contextmenu` during a press is cancelled (New 1).
- **A short press** is untouched: Torn does what it always does.

## The settings box

- **Opening it:** a long press on one of Torn's icons, or "Icon Hider: Settings" in the script menu where the host has one. The entry is named for the script because some menus list every script's entries together. The box opens over everything, Torn's tooltips included.
- **Its look** is the Xanax Reminder's settings box:
  - a dark panel 450 px wide (at most 90% of the screen) on a dark overlay;
  - a header with the title "Icon Hider Settings" and an "x";
  - grey help text, a grey Cancel and a green Save;
  - 16 px text, or an iPhone zooms in when a switch is tapped;
  - nothing focused when it opens.
- **The list:** one line per kind: a native checkbox (ticked means shown), Torn's picture and Torn's title. The whole line is a `<label>`, so a tap anywhere on it flips the switch.
  - "In your row now": the kinds in Torn's data now, in the row's order. Hidden ones are listed in their place, unticked.
  - "Seen before": the rest, by title.
  - The list scrolls inside the box when it is taller than the screen.
  - With nothing learned yet: "No icons seen yet."
  - Titles are put in as text, never as HTML.
- **Pictures:** Torn's own, from its icon sprite `https://www.torn.com/images/v2/svg_icons/sprites/user_status_icons_sprite.svg`, drawn 17 x 17 at `-(N-1)*18px 0` for the kind's latest picture number N. It is the same site, with nothing hosted elsewhere. If Torn changes the sprite, a picture can be wrong; the title beside it is still right.
- **Help text:** "Untick an icon to hide it. Hidden icons stay in this list, so you can bring them back. A long press on any icon in the row opens these settings." In PDA it adds: "Torn PDA has no script menu, so one icon always stays showing."
- **Each time it opens,** the switches show what is saved. Nothing changes in the row until Save.
- **Buttons:** Cancel and Save.
  - A save counts only when storage gives the value back. Then the box says "Saved.", the row changes at once, and the box closes a second later.
  - If storage doesn't give the value back, the box says "Couldn't save, try again." and stays open, and what was saved before is kept.
  - In PDA, a Save that would leave none of Torn's icons in the row showing changes nothing and says "Keep one icon showing: in Torn PDA, a long press on an icon is the only way back here." (New 2). If the icon kept showing later leaves the row (a cooldown ends), the row can be empty until an icon of a shown kind comes back. That is accepted.
  - Escape, Cancel, the "x" or a tap on the dark area around the box closes it without a change.

## Stored

In GM storage, as strings of JSON, because PDA hands stored values back as strings:

- `tih-kinds`: what the script has learned, `{ "<key>": { "title": "...", "ids": [52, 53] } }`. Written only when something new is learned (a kind, a picture number or a title), merged with what is stored then, since another tab may have learned something too.
- `tih-hidden`: the keys of the hidden kinds, such as `["maleGender", "subscriber"]`. Written only by Save.
- Two values, so a tab learning a new icon can't undo a save made in another tab.
- A value that won't parse reads as empty: nothing hidden, nothing learned. The icons show; nothing is lost from the page.

## Where it runs

- `@match https://www.torn.com/*` and `https://torn.com/*`, `@run-at document-start`.
- **Hosts:** Tampermonkey (desktop and phone), Torn PDA and the warboard app.
  - Every `GM_*` call is guarded with `typeof`, because PDA has crashed on `GM_registerMenuCommand` before. PDA can also define it and still show no menu, which is why New 2 checks for PDA itself.
  - PDA is told apart as FactionOps does it: `window.flutter_inappwebview` without the warboard app's `window.webkit.messageHandlers.gmBridge`, or PDA's user agent (`TornPDA`, `com.manuito`).
  - The source is plain ASCII, because PDA turns curly quotes into a syntax error.
  - No API key and no network calls of its own, so `###PDA-APIKEY###` doesn't appear.
- **Loaded twice on the same page,** it runs once: the first copy marks the page (`data-tm-icon-hider` on `<html>`), and a second copy stops.
- **Errors** are caught inside each check and each handler, so a bad value never reaches Torn's page.
- **With TornTools' Hide Icons also on,** both work: an icon either of them hides stays hidden.

## Files

- `server/public/scripts/torn-icon-hider.user.js` and `.meta.js`, owned `warboard:warboard`.
- **Header:**
  - @name "Torn Icon Hider", @namespace and @author RussianRob, @license All Rights Reserved, @version 1.0.0, a CHANGELOG block. The in-file `VERSION` matches @version, and the console line on start carries it.
  - @downloadURL and @updateURL: `https://tornwar.com/scripts/torn-icon-hider.user.js` and `.meta.js`.
  - @grant: GM_getValue, GM_setValue, GM_registerMenuCommand. No @connect.
- The served file and the repo are the same file (`server/public/scripts` is served), committed and pushed together.

## Testing

Tests come first, with node:test and linkedom, in `server/torn-icon-hider.test.mjs`. `TIH_SRC` points the tests at another copy of the script, for mutants.

- **Fixtures:**
  - Torn's four rows: Fly-out phone (`.userInformationMobile___ > div.swiperWrapper___ > ul`), Fly-out desktop (`#sidebar.desktop___ > div.userInformation___ > div > ul`), and the old sidebar's desktop and phone rows.
  - Real class names from Torn's saved pages (such as `icon6___R1xkN` and `icon52____l66f`), not made-up ones.
  - Each page also has Torn's header list and an `iconN___` tray outside the sidebar, so a rule that is too wide fails.
  - Sidebar data with real keys and `"iconNN"` ids.
- **Hiding** (linkedom doesn't lay out pages, so the tests run each rule's selector against the page):
  - A hidden kind's rule matches its icon in the row in all four layouts and nothing else: not the header, not the tray, not `icon52` for `icon5`, not the Xanax or Blood Bag icons.
  - The stylesheet is in the page before the row is (`document-start`, no `<head>`), and is rewritten only when the hidden numbers change.
  - A known level range is hidden whole; another new number is learned at the next check.
  - A number moves to the kind it was last seen with, and a kind switched on is never hidden.
  - A save in another "tab" (shared storage) reaches this one at its next check.
  - With no sidebar data, hidden icons stay hidden.
  - Stored values that come back as strings, or won't parse, still work.
  - Only titles are stored, never the details after them.
- **Room:**
  - The desktop spacing rule is there only while something is hidden, and only for the desktop row.
  - After the stylesheet changes, the phone strip gets a `scroll` event.
- **The long press:**
  - 500 ms on a Torn icon opens the box. A short press doesn't, and its click reaches Torn untouched.
  - The click after a long press is stopped: a listener standing in for Torn's React root never sees it, and its default is prevented. With touch, the long press's `touchend` is cancelled.
  - A finger moving, or the mouse leaving, cancels the press. A right-click doesn't start one.
  - A long press on the Xanax or Blood Bag icon doesn't open this box.
  - It works on a row Torn has replaced.
- **The box:**
  - It lists the row's kinds in the row's order, then the rest by title, and says "No icons seen yet." when there are none.
  - Ticked means shown, as stored. Save, Cancel, Escape, the "x" and the overlay do what this spec says. A save that storage refuses or drops says so and keeps the old choice.
  - In PDA, Save won't hide the last icon showing; elsewhere it will.
  - Titles are text, never HTML.
- **The source:**
  - The header fields match this spec, and the meta file matches the header.
  - Plain ASCII; every `GM_*` guarded; no `###PDA-APIKEY###`; no `type="password"`.
  - The repo's tests across all scripts (such as every menu entry naming its script) pass.
- **Mutants:** a few, such as a rule without `#sidebar`, a match without the `___`, a long press without `stopPropagation`, and a missing level range. Each must fail a test.
- **Layout proof, outside the repo:** the desktop spacing is proved once in headless Chromium against Torn's own stylesheets, and the result goes in the plan's notes. Torn's stylesheets can't go in the public repo.

## Live check (owner, after release)

- Phone, Fly-out on: a long press on one of Torn's icons opens "Icon Hider Settings", and Torn neither opens the icon's tooltip nor follows its link. The list shows your row's icons in order, with Torn's pictures and titles.
- Untick two icons and Save: "Saved.", the box closes, and the two icons are gone with no gap. If the strip stops scrolling, the fade at its right edge goes too.
- Reload: they stay hidden, with no flash.
- A hidden drug cooldown stays hidden as its level changes.
- "Icon Hider: Settings" in the menu opens the box (warboard app, Tampermonkey).
- The Xanax and Blood Bag icons' long presses still open their own settings.
- Desktop, if handy: the row keeps 6 a line, evenly spaced.
- PDA, if handy: the long press opens the box, and Save won't hide the last icon.

## Not in this version

- Reordering icons, or a "+N" for hidden ones (Q5).
- Hiding the script's own icons (Q6), or the money, points and bars.
- The same choices on every device.
- Torn's own setting that shows or hides the whole row.
- A button to forget the icons seen before.
- Hiding icons anywhere but your sidebar row (profiles, member lists).
- A sibling left alone here: the Xanax and Blood Bag tests' fixtures use made-up class names and call icon6 "Company" (it is Male).
