# Torn User List Filter (design)

**Status:** written for the owner's review. The owner asked on 2026-10-25 at 21:04 EDT, with a link to Torn's Advanced Search (`page.php?sid=UserList`, level 75 and up, active in the last 7 days, not in federal jail): "can we create a filter for that page to filter out people abroad and in hospital?" The decisions below come from two rounds of questions, answered at 21:23, 21:25 and 21:39 EDT.
**Script:** `server/public/scripts/torn-userlist-filter.user.js` and `.meta.js`, version 1.0.0. Tests: `server/torn-userlist-filter.test.mjs`.

## Why

The owner searches Torn's user list for people to hit. Many of the results can't be attacked at that moment: they are in hospital, in jail, in the air or in another country. Today the owner scrolls past them by eye. The script hides those rows, so a page of results shows only people who can be attacked from Torn City.

TornTools has a user-list filter that can do this. The owner chose a script of their own, which works the same in Tampermonkey, Torn PDA and the warboard apps.

## Decisions

| # | Decision |
|---|---|
| Page | Every search on `page.php?sid=UserList`, not only the owner's link. The owner: "https://www.torn.com/page.php?sid=UserList thats tye oage filter should be on". |
| Q1 | A new script of the owner's, not TornTools' filter. The owner: "build our own". |
| Q2 | "Abroad" means both: in flight, and landed in another country. The owner: "both". |
| Q3 | People in jail are hidden too, with a switch of their own. The owner: "yes jail too". |
| Q4 | A hidden row is gone, not dimmed. A slim bar above the list holds the three switches and the count, such as "12 of 50 hidden on this page". When every row on a page is hidden, the bar says so. You click Next yourself: the script never loads a page, clicks anything or calls the API. The owner: "yes to all, do recommended". |
| Q5 | All three switches start on, and each device remembers its own. |
| Q6 | The name is "Torn User List Filter", file `torn-userlist-filter.user.js`, served on tornwar. RussianRob, All Rights Reserved, ready for the owner to upload to Greasy Fork. |

## What it does

On `page.php?sid=UserList`, the script looks at each row of results. A row that shows Torn's hospital, jail or travel icon is hidden while that kind's switch is on. The bar above the list says how many rows on this page are hidden. Whenever Torn puts new rows in the list (the next page, a new search, a new sort order), the script checks them too.

It only reads and hides what Torn has already put on the page. It sends no requests of its own, uses no API key and clicks nothing.

## Telling who is where

Each row of results is an `li` in Torn's list `ul.user-info-list-wrap`, the same list TornTools, FF Scouter and our BUSTR read. Each row carries Torn's small status icons, each an `li` whose id starts with `icon` and a number, such as `icon15___` and a hash. The script reads the number with `^icon(\d+)(?:_|$)`, so `icon1` is never read as `icon15`. It reads every icon in the row, whether Torn shows it or not.

| Kind | Torn's icon numbers | Notes |
|---|---|---|
| Hospital | 15 (Hospital), 91 (Hospital, radiation poisoning) | 82 (early discharge) does not count on its own; the live check below settles it. |
| Jail | 16 (Jail) | Federal jail (70) is never hidden: the owner's search already leaves fedded people out, and it was not asked for. |
| Abroad | 71 (Traveling) | Torn's list of status icons (87 kinds, as TornTools lists them) has no separate abroad icon, so the plane should cover people landed abroad as well as those in flight. The live check confirms it before release. |

The numbers come from TornTools' table of Torn's icons. A number in that table is decided by its number alone, so 70 and 82 stay as the table above says whatever their labels are. An icon whose number is not in the table (say Torn renumbers one) counts by its label (`aria-label` or `title`): one starting with "Hospital", "Jail", "Traveling" or "Abroad" counts as that kind. The number comes first, the label second, as in our other Torn scripts.

## The bar

- **Where:** right before the list's title bar (`.users-list-title`), where TornTools puts its own filter box; with both installed they sit one above the other. With no title bar, it goes right before the list.
- **What it says:** `Hide: [x] Hospital  [x] Abroad  [x] Jail   12 of 50 hidden on this page`. When nothing on the page is hidden: `0 of 50 hidden on this page`. When every row is hidden: `All 50 on this page are hidden.`
- **What counts:** a row is an `li` straight under the list with a name link in it (`.user.name`, as TornTools reads it), so Torn's loading placeholder and a "no results" line are not counted. Rows hidden by other scripts are not counted either.
- **A switch** takes effect at once on the rows already on the page, and is saved.
- **Look:** small, in Torn's own font and colours, so it fits light and dark mode. All text in the bar is the script's own; nothing from the page is put in as HTML.

## Checking again

- Torn loads each page of results into the list without reloading the page (a `page.php` request with `sid=UserListAjax`, with `.ajax-placeholder` in the list while it loads). So the script watches for rows being added or removed under the list's wrapper (`.userlist-wrapper`, or the list's parent), and checks again once the rows settle. It waits for the wrapper if it isn't on the page yet.
- It watches only for rows being added and removed, never for attribute changes. It hides a row by adding its own class, which its own stylesheet hides. Changes inside its own bar are ignored, and the bar's text is written only when it differs. So the script's own changes never set off another check.
- If Torn replaces the whole list, the new list is checked the same way.

## Stored

In GM storage, as a string of JSON, because PDA hands stored values back as strings:

- `tulf-switches`: `{"hospital":true,"abroad":true,"jail":true}`.
- Nothing stored, or a value that won't parse: all three on.
- A save that storage refuses (PDA keeps GM values in localStorage, which can be full) still takes effect on this page. The next page load starts from what was stored before.

## Where it runs

- `@match https://www.torn.com/page.php*`, gated in the code on `sid=UserList` in the address (any letter case). This is how our travel-page scripts do it, because hosts treat a `?` in `@match` differently.
- **Hosts:** Tampermonkey (desktop and phone), Torn PDA and the warboard apps. The apps install it from its link.
  - Every `GM_*` call is guarded with `typeof`.
  - The source is plain ASCII, because PDA turns curly quotes into a syntax error.
  - No API key and no network calls, so `###PDA-APIKEY###` doesn't appear.
- **Loaded twice on the same page,** it runs once: the first copy marks `<html>` with `data-tulf`, and a second copy stops.
- **Errors** are caught inside each check, so a surprise in Torn's page never breaks the page.
- **With TornTools' user-list filter also on,** both work: a row either one hides stays hidden.

## Files

- `server/public/scripts/torn-userlist-filter.user.js` and `.meta.js`, owned `warboard:warboard`.
- **Header:**
  - @name "Torn User List Filter", @namespace and @author RussianRob, @license All Rights Reserved, @version 1.0.0, a CHANGELOG block. The in-file `VERSION` matches @version, and the console line on start carries it.
  - @description: hides people in hospital, in jail or abroad (in flight or landed) from Torn's user list search, with a switch for each above the list.
  - @downloadURL and @updateURL: `https://tornwar.com/scripts/torn-userlist-filter.user.js` and `.meta.js`.
  - @grant: GM_getValue, GM_setValue. No @connect, and no menu entry: the bar is the settings.
- The served file and the repo are the same file (`server/public/scripts` is served), committed and pushed together.

## Testing

Tests come first, with node:test and linkedom, in `server/torn-userlist-filter.test.mjs`. `TULF_SRC` points the tests at another copy of the script, for mutants.

- **Telling who is where:** rows with icons 15, 91, 16 and 71 count as their kinds; 70 and 82 alone don't, whatever their labels; `icon1` and `icon150` are not 15; an unknown number counts by its label; a row can be two kinds at once.
- **The page:** a fixture of the user list (wrapper, title bar, a list of rows, a loading placeholder):
  - The rows of each switched-on kind are hidden and the others show.
  - The bar sits right before the title bar, or right before the list when there is no title bar.
  - The count and the all-hidden wording are right, and the placeholder isn't counted.
  - A switch changes the rows at once and is stored.
  - Rows replaced by a new page are checked, and so is a replaced list.
  - The script's own changes don't set off more checks (the test counts them).
- **Stored:** values that come back as strings, values that won't parse, and a storage that throws.
- **The source:** the header matches this spec and the meta file matches the header; plain ASCII; every `GM_*` guarded; no `###PDA-APIKEY###`; no `type="password"`. The repo's tests across all scripts pass.
- **Mutants:** a few, such as reading the number without the `_` boundary, counting 70 as jail, watching attributes, and putting the bar after the list. Each must fail a test.

## Live check before release (a gate)

Read-only on a live results page; nothing on Torn is clicked or loaded for it. It can be done through the warboard app's remote inspect (the owner turns it on and opens the page), the Mac browser link, or a page the owner saves.

1. Someone landed abroad shows the plane icon (71). If not, the design goes back to the owner, because abroad needs another way in.
2. Rows in hospital show 15. Note whether 82 or 91 appear, and with what.
3. Rows in jail show 16.
4. The title bar `.users-list-title` and the wrapper `.userlist-wrapper` are there.
5. Whether the icons carry labels, and what they say.

## Live check (owner, after release)

- The owner's own search: the bar is above the list, and the count adds up with what is left showing.
- Each switch brings its rows back and hides them again at once.
- Next page: the new rows are filtered and the count changes to match.
- Reload: the switches stay as set.
- PDA, if handy: the same.

## Not in this version

- Other lists: faction member lists, the hospital list, bounties, people abroad on the travel page.
- Dimming instead of hiding, or a "leaving hospital soon" exception.
- A federal jail switch.
- Loading more pages to make up for hidden rows (Torn's rules: one click, one page).
- The same switches on every device.
- Counting rows other scripts hide.
