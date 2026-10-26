# Torn Ancient Ones (design)

**Status:** written on 2026-10-26 for the owner's review. The owner asked at 06:48 EDT: "can younmake a script that tells me where the halloween like maol creatures are?", then "and when theyll be availabke theyre npcs but loot ranger doesnt pick them up". At 07:10 EDT, with a screenshot of Torn's summoning popup, they added: "they spawn in torn city too i think or they move there randomly". The decisions below come from one round of questions, answered at 07:14 EDT: "yes to all, do recommended".
**Script:** `server/public/scripts/torn-ancient-ones.user.js` and `.meta.js`, version 1.0.0. Tests: `server/torn-ancient-ones.test.mjs`.

## Why

At Halloween, a player who has collected 9,999 treats can summon the Ancient Ones: M'aol and his five praetorians. They are NPCs, but Loot Rangers doesn't list them; its feed lists only the five regular NPCs, with attacks paused for "Halloweek". So the owner can't see where they are, which ones can be hit, or when. The script shows that in a small box on Torn pages, from Torn's own API.

## What Torn does (checked 2026-10-26)

- **Who:** M'aol (NPC 23) and his praetorians, all NPCs, the same ids as in 2024 and 2025:

  | Praetorian | NPC |
  |---|---|
  | Dyno'salam | 100 |
  | Nol'dasaym | 101 |
  | Asmol'yand | 102 |
  | Sylo'nadam | 103 |
  | Ladso'myna | 104 |
- **The summoning:** a player spends 9,999 treats.
  - Torn's patch notes (#408, 11/11/2025): "spawnable from 10:00 on the 26th October until 23:59:59 on the 31st of October, and is spawnable again 48 hours after his previous death".
  - The 2025 newspaper said 24 hours, so the box says what its time is based on.
- **Where they are:**
  - Each praetorian awakens in a random country abroad and stays there.
  - M'aol can't be attacked until all five are defeated.
  - After that, TornStats says he moves about every 15 minutes through his praetorians' countries, in the order they were defeated.
  - No record shows any of them in Torn City. While his praetorians stand, Torn's API puts M'aol there: state "Awoken", no country, where the praetorians read "Abroad".
- **Beaten:** at 0 life an Ancient One goes "Dormant". There is no hospital and there are no loot levels. One not defeated within a week of the summoning goes dormant too, with life left. Loot is a lottery, and each damaging hit is a ticket.
- **Torn's API:** v2 `user/{id}/profile`, read on the owner's key at 07:12, 07:19 and 07:25 EDT, gives these shapes:

  | Who | status.state | status.description | life |
  |---|---|---|---|
  | A standing praetorian | Abroad | Awoken in Cayman Islands | above 0 |
  | A beaten praetorian | Abroad | Dormant in Mexico | 0 |
  | M'aol, shielded | Awoken | Awoken | full |

  - `details` and `until` are null for all six.
  - All six carry `last_action.timestamp` 10:00:00 TCT on 26 October, which 1.0.0 doesn't use.
  - M'aol's answer once he can be hit, has moved or has died hasn't been seen yet.
- **Torn's rules:** a script may read the API on a timer, at most 100 calls a minute per user. Torn caches answers for up to 30 s. Reading all six is six calls.

## Decisions

| # | Decision |
|---|---|
| Q1 | The script's own floating box on Torn pages, styled like the Loot Rangers panel but separate from it, so it can go after Halloween without touching that panel. One line per Ancient One: country, life left, standing or beaten, and an attack link you tap. Its colour is orange where Loot Rangers' is blue, so the two boxes can't be mixed up (the owner can change this). |
| Q2 | The script asks Torn's API itself, with the user's key: one sweep of six calls a minute at most, shared by all tabs. No server change. |
| Q3 | A change is highlighted in the box. No sound, no notifications. |
| Q4 | The box says when each one can be hit: <br>- a standing praetorian shows its life left; <br>- a beaten one shows when the script saw it fall; <br>- M'aol shows how many praetorians still shield him, then where he is and that he moves about every 15 minutes; <br>- after his death, the box shows the earliest time a new summoning is possible. <br>M'aol's next country isn't predicted, because the API says where he is. |
| Q5 | Named "Torn Ancient Ones" (`torn-ancient-ones.user.js`), served on tornwar. RussianRob, All Rights Reserved, ready for Greasy Fork if the owner wants it there. |

## The box

- **Where:**
  - It starts at the bottom left, 20 px from the edges; the Loot Rangers box starts at the bottom right.
  - Drag it by its title bar and it stays where you leave it.
  - On load and on resize, a saved place is pulled back inside the window, so a place saved on a wide screen can't leave the box off a phone's screen.
  - A drag never changes the page's own styles; the title bar has `touch-action: none` instead. So a drag that is cut off can't lock the page's scrolling, which was the bug Loot Rangers 3.2.1 fixed.
- **Title bar:** "Ancient Ones", with a one-line summary under it. It has two buttons:
  - fold the box down to its title bar (remembered);
  - close it until the page reloads.
  A closed box makes no more calls. A folded one still does, and its summary still says what matters.
- **The summary**, from what was last read:
  - no key: "Needs an API key."; nothing read yet: "Reading Torn...";
  - while any praetorian stands: "3 of 5 praetorians up. M'aol shielded.";
  - once all five are down and M'aol stands: "M'aol can be hit: in Mexico.";
  - when all six are down:
    - in the summoning window, with M'aol's death seen: "All asleep. Next summoning possible from Oct 28 10:41 TCT (48 h after M'aol's death)."
    - in the window, death not seen: "All asleep. Next summoning possible 48 h after M'aol's death."
    - before the window: "All asleep. Summoning opens Oct 26 10:00 TCT."
    - after it, or when 48 h after the death falls after it: "All asleep. No more summonings this Halloween."
- **Lines:**
  - M'aol comes first. The praetorians follow, nearest country first, in Torn's flight order: Mexico, Cayman Islands, Canada, Hawaii, United Kingdom, Argentina, Switzerland, Japan, China, UAE, South Africa. One with no known country goes last. The order stays the same for the whole summoning.

  | Situation | The line |
  |---|---|
  | A standing praetorian | `Dyno'salam  Cayman Islands  47%  Attack` |
  | A beaten praetorian (dimmed) | `Nol'dasaym  Mexico  beaten 10:24 TCT` |
  | Dormant with life left (its week ran out) | "dormant" instead of "beaten" |
  | M'aol, shielded (no link) | `M'aol  Torn City  100%  shielded, 3 praetorians up` |
  | M'aol, can be hit | `M'aol  Mexico  92%  Attack`, then `moves about every 15 min, here since 11:02 TCT` |
  | M'aol, beaten | `M'aol  Mexico  beaten 12:41 TCT` |
  | Torn's words don't fit any of these | the name, then Torn's description as it came, as text |
- **Links:**
  - A name links to the NPC's profile (`profiles.php?XID=<id>`).
  - "Attack" links to `loader.php?sid=attack&user2ID=<id>`, shown only for one that can be hit now.
  - Both are plain links that open in the same tab, never a new one: the warboard app's web view handles new tabs badly.
  - A praetorian can only be attacked in its own country. Its link shows anyway, and Torn says so if you aren't there.
- **Footer:** how long ago Torn last answered ("updated 40 s ago"), or why the last call failed, and a Key button.
- **Highlight:**
  - A line whose Ancient One changed is highlighted for 5 minutes after the script saw the change, and so is the title bar.
  - The changes are: summoned (asleep, then standing), beaten, gone dormant, M'aol moved (a new country while he stands), and M'aol now able to be hit.
  - Every tab shows the same highlight, because the change is stored with the reading.
- **Look:** the Loot Rangers box's: dark background, 12 px Verdana, at most 320 px wide, with orange in place of blue. All text is the script's own, or Torn's API words put in as text, never as HTML.

## Times

- **Clock:** times are in TCT, Torn's clock (UTC), as `HH:MM TCT`, with the date added when it isn't today: `Oct 28 10:41 TCT`.
- **What a time means:** a "beaten", "moved" or "since" time is the time of the reading that first showed the change. It is shown only when the reading before it was at most 3 minutes older. If that gap is longer, the change happened while no tab was reading (a phone asleep, say), so the line shows no time but is still highlighted.
- **Next summoning:** 48 h after a seen death of M'aol, but never past the window's end. The window runs from 10:00 TCT on Oct 26 to 23:59:59 TCT on Oct 31 of the current year, by patch #408's rule.

## Reading Torn's answer

For each of the six, from its v2 profile:

1. **Standing or beaten:**
   - The first word of `status.description` decides: "Awoken" is standing, "Dormant" is beaten.
   - If neither word is there, `status.state` decides the same way.
   - Life at 0 is beaten, whatever the words say.
   - Dormant with life above 0 shows as "dormant".
2. **Country:**
   - The words after "in" (as in `Awoken in Cayman Islands`) count when they are one of Torn's eleven countries abroad, listed above.
   - With no country, and a state that is neither "Abroad" nor "Traveling", it is Torn City.
   - Anything else shows Torn's words as they came.
3. **Life:** `life.current` over `life.maximum`, as a whole percent, rounded down, but at least 1% while any life is left.
4. **When M'aol can be hit:** when he isn't beaten and all five praetorians are beaten or dormant. This is worked out from the praetorians, not from M'aol's own words, which haven't been seen for that phase.

## Asking Torn

- **A sweep:**
  - It reads the six profiles one after another, not all at once: PDA merges identical requests in flight, and going one at a time lets the first error stop the sweep.
  - The URL is `https://api.torn.com/v2/user/<id>/profile?striptags=true&key=<key>&comment=ancient-ones`, as the Xanax Reminder does it.
  - It uses GM_xmlhttpRequest where the host has it, and fetch where it doesn't.
- **How often:**
  - At most one sweep a minute, across all tabs. When a sweep starts, its time is stored first, and a tab sweeps only once that stored time is a minute old.
  - Each tab checks every 5 seconds whether a sweep is due. Each check also redraws the box from the stored reading, so ages and highlights stay current and a sweep made by another tab shows within 5 seconds.
  - A tab sweeps only while its page is visible, except in Torn PDA, whose web view misreports that. A page that becomes visible sweeps at once if a sweep is due.
  - PDA is `window.flutter_inappwebview` without the warboard app's `gmBridge` handler, as in FactionOps: the app answers PDA's bridge too.
- **Shared:** the six readings are stored together, with what changed and when, so every tab draws the same box.
- **Errors:** Torn's error, or no answer, stops the sweep, and the last good reading stays on screen with its age.

  | Torn's code | What the script does |
  |---|---|
  | 2 (wrong key), 10 (key owner in federal jail), 13 (key off for inactivity), 18 (key paused) | no more sweeps until a key is saved, because Torn blocks an IP that keeps sending a bad key |
  | 5 (too many requests), 8 (IP blocked), 9 (API off) | the next sweep waits 5 minutes |
  | anything else, or no answer | try again in a minute |

  The footer shows Torn's message, with the key cut out.

## The API key

- **Where it comes from:**
  - Torn PDA puts its key in place of `###PDA-APIKEY###`, which appears once in the file. A key saved in the box beats PDA's.
  - Elsewhere (Tampermonkey, and the warboard apps, which don't fill PDA's placeholder), the box asks for a key once.
- **The key row:** a plain text field (not a password field, which sets off password managers), a Save button, and what the key is for.
  - With no key, the box shows the key row in place of the lines. The Key button opens it at any time.
  - Saving an empty field removes the saved key; PDA's is used again, if there is one.
  - The field's grey hint shows the key in use as `************` and its last 4, never more.
  - Saving a key clears the last error and sweeps at once.
- **Where the key goes:** only into the request to Torn, never into the page, the console or an error message.
- **Torn's API terms**, in the key row and at the top of the script:

  | Torn's term | This script |
  |---|---|
  | Data Storage | Only on this device: the six NPCs' last reading, the box's place, your key. |
  | Data Sharing | None. |
  | Purpose of Use | Show where the Ancient Ones are and which can be attacked. |
  | Key Storage & Sharing | Stored on this device in the script's storage; sent only to Torn's API. |
  | Key Access Level | Public. |

## Stored

GM storage, as strings of JSON, because PDA hands stored values back as strings:

- `torn-ancient-ones-key`: the key, or `''` for none.
- `torn-ancient-ones-reading`: the last sweep. It holds when the sweep started, when Torn last answered, and the error if there was one. For each Ancient One, it holds what was read, what last changed, when (the reading's time), and the time of the reading before it.
- `torn-ancient-ones-box`: the box's place, and whether it's folded.

**Edge cases:**
- Nothing stored, or a value that won't parse: no reading yet, the default place, not folded.
- A save that storage refuses (PDA keeps GM values in localStorage, which can be full): the tab keeps its own copy for this page.

## Where it runs

- **Pages:** `@match https://www.torn.com/*`, like the Loot Rangers panel.
- **Hosts:** Tampermonkey (desktop and phone), Torn PDA and the warboard apps.
  - Every `GM_*` call is guarded with `typeof`.
  - The source is plain ASCII, because PDA turns curly quotes into a syntax error.
- **Loaded twice on one page:** it runs once. The first copy marks `<html>` with `data-torn-ancient-ones`.
- **Errors:** caught inside each check, so a surprise never breaks the page.

## Files

- `server/public/scripts/torn-ancient-ones.user.js` and `.meta.js`, owned `warboard:warboard`.
- **Header:**
  - @name "Torn Ancient Ones", @namespace and @author RussianRob, @license All Rights Reserved, @version 1.0.0, and a CHANGELOG block. The in-file `VERSION` matches @version, and the console line on start carries it.
  - @description: where Torn's Halloween Ancient Ones are (M'aol and his five praetorians), in a small box on Torn pages: country, life left, standing or beaten, an attack link, and when M'aol can be hit. It needs a Public API key; Torn PDA gives its own. Torn's API terms table follows the description, in the header comment.
  - @downloadURL and @updateURL: `https://tornwar.com/scripts/torn-ancient-ones.user.js` and `.meta.js`.
  - @grant GM_getValue, GM_setValue, GM_xmlhttpRequest; @connect api.torn.com; @run-at document-idle. No menu entry: the Key button is in the box.
- The served file and the repo are the same file (`server/public/scripts` is served), committed and pushed together.

## Testing

Tests come first, with node:test and linkedom, in `server/torn-ancient-ones.test.mjs`. `TAO_SRC` points the tests at another copy of the script, for mutants. The fixtures are the six profiles read on 2026-10-26, NPC fields only.

- **Reading Torn's answer:**
  - the three real shapes;
  - life 0 under "Awoken" reads as beaten;
  - "Dormant" with life left reads as dormant;
  - each of the eleven countries is read;
  - an unknown country, or an unknown description, comes through as Torn's words;
  - no country under state "Awoken" is Torn City;
  - M'aol can be hit only when all five are down, whatever his own words say.
- **The box:**
  - the order of the lines, and each line's wording;
  - the summary in each phase, including either side of the window's edges;
  - links: "Attack" only for one that can be hit now, every link in the same tab;
  - the highlight shows at 4 minutes and is gone at 6;
  - Torn's words with `<b>` in them show as text.
- **Times:** the 3-minute rule; next summoning at death + 48 h, and none after the window.
- **Asking Torn:**
  - two copies sharing storage make one sweep a minute;
  - a hidden page doesn't sweep, but PDA does, and the warboard app counts as not PDA;
  - a page that becomes visible sweeps once a sweep is due;
  - a closed box stops sweeping, and a folded one doesn't;
  - calls go one after another, and an error stops the rest;
  - code 2 stops sweeps until a key is saved, code 5 waits 5 minutes, and no answer tries again in a minute;
  - the URL is right;
  - the key is never in the page, the console or the footer.
- **The key:** PDA's key when swapped in; a saved key beats it; the hint shows only the last 4.
- **Dragging:** a drag leaves the page's styles alone; a saved place is pulled back into the window on load and on resize; the fold is saved.
- **Stored:** values that come back as strings, values that won't parse, and storage that throws.
- **The source:** the header matches this spec and the meta file matches the header; plain ASCII; every `GM_*` guarded; `###PDA-APIKEY###` exactly once; no `type="password"`; no `target="_blank"`. The repo's tests across all scripts pass.
- **Mutants:** a set, such as:
  - M'aol hittable from his own words;
  - the 3-minute rule dropped;
  - a sweep per tab;
  - sweeping while hidden;
  - code 2 retried;
  - calls sent all at once;
  - Torn's words put in as HTML;
  - the drag locking the body.
  
  Each must fail a test.

## Live check before release (a gate)

The box reads no Torn page, so the gate is Torn's answers. All of it is read-only.

1. The six profiles saved on 2026-10-26 go through the script's own reading code and give the table above (a test).
2. Just before release, one sweep on the owner's key from this box (six calls). The script's reading code on the live answers must agree with TornStats' `/maol` page on each one's country and whether it stands.
3. If by then M'aol can be hit, has moved or has died, his new answer is saved as a fixture and tested before release. If not, Torn's words as they came cover him.

## Live check (owner, after release)

- Install from the link. Tampermonkey and the warboard apps ask for the key once; PDA doesn't.
- The box agrees with Torn's summoning popup and the countries you see.
- In a praetorian's country, Attack opens the fight.
- Drag, fold, close, reload: the place and the fold stay.
- On a phone (PDA or the app): the same.

## Not in this version

- Sound, notifications, phone pushes, a server-side watcher.
- Predicting M'aol's next country or when he arrives.
- Flight times, or where you are yourself.
- Who summoned, or treat counts.
- The regular Loot Rangers NPCs.
- `last_action` as the summoning time.
