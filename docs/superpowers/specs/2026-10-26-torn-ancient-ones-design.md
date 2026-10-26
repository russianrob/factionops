# Torn Ancient Ones (design)

**Status:** approved by the owner on 2026-10-26 at 07:28 EDT ("approved, write the plan"). The amendments since then, below, go to the owner for review with the plan, `docs/superpowers/plans/2026-10-26-torn-ancient-ones.md`.
- **The ask:** at 06:48 EDT, "can younmake a script that tells me where the halloween like maol creatures are?", then "and when theyll be availabke theyre npcs but loot ranger doesnt pick them up". At 07:10 EDT, with a screenshot of Torn's summoning popup: "they spawn in torn city too i think or they move there randomly". The decisions below come from one round of questions, answered at 07:14 EDT: "yes to all, do recommended".
- **Amendments after approval:**
  - 07:38 EDT: the owner sent a screenshot of a chat in which a player says M'aol flies between the countries in the order his praetorians died, with: "might want to consider this too". That added "M'aol's route" below, which changes Q4's last line.
  - 07:42 and 07:43 EDT: the owner sent "https://tornstats.com/maol im sure this was in your research" and TornStats' line "M'aol will travel to the destinations his Praetorians awoke in in the order they were defeated every 15 minutes.", then chose "Yes, read TornStats (Recommended)" for the order the praetorians fell (Q6).
  - 07:54 EDT: with a screenshot of a chat about where to fly, they asked: "predict where to fly and predict if using bct will get usnthere before its dead", then chose "airstrip and bct" for the flights to check (Q7) and "Yes (Recommended)" for where to fly for M'aol (Q8).
  - 08:15 EDT: a read of Torn's API found M'aol abroad while still shielded, which changed "What Torn does" and M'aol's shielded line.
  - 08:48 EDT: a read with four beaten put him in Canada, where the newest had fallen, and agreed with TornStats on all six. TornStats' time for one fall had moved by a second, which changed "Asking TornStats". Tests for a clock set back were added to "Testing".
  - 09:39 to 09:42 EDT, testing a 0.9.0 build: the owner asked "please have it in order they were beaten please", then "the first four are in order except for the last one", and approved the design with "yes go ahead, do recommended", which also said yes to the footer saying when the box tries again after Torn says to wait. That changed "The box" (the order of the lines), "Asking TornStats" (what a defeat time is used for), "Asking Torn" (the footer) and "Testing".
  - 10:10 EDT, the final review: two of its findings changed "M'aol's route" (a gap of 10 minutes or more in his readings starts his trail again) and "Stored" (a sweep stored ahead of the clock doesn't beat a tab's own copy).
  - 10:53 EDT, using 1.0.0: its Attack link gave Torn's "This endpoint is no longer available. Please use the new endpoints instead (page.php).", and the owner asked "fix the attack link please". Torn's own Attack buttons link to `page.php?sid=attack&user2ID=<id>`, which changed "Links" for 1.0.1.

**Script:** `server/public/scripts/torn-ancient-ones.user.js` and `.meta.js`, version 1.0.1. Tests: `server/torn-ancient-ones.test.mjs`.

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
  - No record shows a praetorian in Torn City. Until the first falls, Torn's API puts M'aol there: state "Awoken", no country, where the praetorians read "Abroad".
  - Once some have fallen, M'aol moves between the beaten ones' countries while still shielded. On 2026-10-26, TornStats still had him in Torn City at 11:44 TCT, with one beaten. Two more fell at 11:52 TCT, TornStats saw him reach Mexico at 12:01 TCT, and at 12:15 TCT Torn's API put him in the Cayman Islands at full life, with two still standing. Asmol'yand fell in Canada at 12:39 TCT, and at 12:48 TCT Torn's API put M'aol in Canada, with one standing.
- **Beaten:** at 0 life an Ancient One goes "Dormant". There is no hospital and there are no loot levels. One not defeated within a week of the summoning goes dormant too, with life left. Loot is a lottery, and each damaging hit is a ticket.
- **Torn's API:** v2 `user/{id}/profile`, read on the owner's key at 07:12, 07:19 and 07:25 EDT, gives these shapes:

  | Who | status.state | status.description | life |
  |---|---|---|---|
  | A standing praetorian | Abroad | Awoken in Cayman Islands | above 0 |
  | A beaten praetorian | Abroad | Dormant in Mexico | 0 |
  | M'aol, shielded | Awoken | Awoken | full |
  | M'aol, shielded, once some have fallen | Abroad | Awoken in Cayman Islands | full |

  - `details` and `until` are null for all six.
  - All six carry `last_action.timestamp` 10:00:00 TCT on 26 October, which 1.0.0 doesn't use.
  - M'aol's answer once he can be hit, or once he has died, hasn't been seen yet.
- **Torn's rules:** a script may read the API on a timer, at most 100 calls a minute per user. Torn caches answers for up to 30 s. Reading all six is six calls.

## Decisions

| # | Decision |
|---|---|
| Q1 | The script's own floating box on Torn pages, styled like the Loot Rangers panel but separate from it, so it can go after Halloween without touching that panel. One line per Ancient One: country, life left, standing or beaten, and an attack link you tap. Its colour is orange where Loot Rangers' is blue, so the two boxes can't be mixed up (the owner can change this). |
| Q2 | The script asks Torn's API itself, with the user's key: one sweep of six calls a minute at most, shared by all tabs. No server change. |
| Q3 | A change is highlighted in the box. No sound, no notifications. |
| Q4 | The box says when each one can be hit: <br>- a standing praetorian shows its life left; <br>- a beaten one shows when the script saw it fall; <br>- M'aol shows how many praetorians still shield him, then where he is and that he moves about every 15 minutes; <br>- after his death, the box shows the earliest time a new summoning is possible. <br>Changed at 07:38 EDT: once M'aol can be hit, the box also shows his route (his praetorians' countries in the order they fell) and his next stop, when the script knows them. See "M'aol's route". |
| Q5 | Named "Torn Ancient Ones" (`torn-ancient-ones.user.js`), served on tornwar. RussianRob, All Rights Reserved, ready for Greasy Fork if the owner wants it there. |
| Q6 | The order the praetorians fell, and M'aol's death time, also come from TornStats' public feed of the six (the one its /maol page reads). The box asks it at most every 5 minutes, and only while a defeat time is missing. It sends TornStats nothing of the user's. See "Asking TornStats". |
| Q7 | Where to fly: for each standing one, the box estimates when it dies, from how fast its life has dropped over the last 10 minutes. It then says whether a flight by airstrip and by BCT lands in time, with the minutes to spare. See "Where to fly". |
| Q8 | Where to fly for M'aol: once he can be hit and his stops are known, the box names the country on his route where each flight (airstrip, BCT) catches him soonest, checked against when he should die. |

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
  - M'aol comes first. The praetorians follow: first those that are down, in the order they fell, then those standing. One down with no defeat time comes before those with one, as most likely it fell before the script was watching. Otherwise, and between falls at the same time, the nearest country comes first, in Torn's flight order: Mexico, Cayman Islands, Canada, Hawaii, United Kingdom, Argentina, Switzerland, Japan, China, UAE, South Africa. One with no known country goes last. A praetorian that falls moves up to join those down.

  | Situation | The line |
  |---|---|
  | A standing praetorian | `Dyno'salam  Cayman Islands  47%  Attack` |
  | A beaten praetorian (dimmed) | `Nol'dasaym  Mexico  beaten 10:24 TCT` |
  | Dormant with life left (its week ran out) | "dormant" instead of "beaten" |
  | M'aol, shielded (no link) | `M'aol  Torn City  100%  shielded, 3 praetorians up`, or the country he is in once some have fallen: `M'aol  Cayman Islands  100%  shielded, 2 praetorians up` |
  | M'aol, can be hit | `M'aol  Mexico  92%  Attack`, then `moves about every 15 min, here since 11:02 TCT`, then, when his route is known, `next Canada about 11:17 TCT` and `route Mexico > Cayman Islands > United Kingdom > Canada > Hawaii` |
  | M'aol, beaten | `M'aol  Mexico  beaten 12:41 TCT` |
  | Torn's words don't fit any of these | the name, then Torn's description as it came, as text |
- **Links:**
  - A name links to the NPC's profile (`profiles.php?XID=<id>`).
  - "Attack" links to `page.php?sid=attack&user2ID=<id>`, as Torn's own Attack buttons do, shown only for one that can be hit now. Torn has retired the old `loader.php?sid=attack`, which now answers only with an error.
  - Both are plain links that open in the same tab, never a new one: the warboard app's web view handles new tabs badly.
  - A praetorian can only be attacked in its own country. Its link shows anyway, and Torn says so if you aren't there.
- **Footer:** how long ago Torn last answered ("updated 40 s ago"), or why the last call failed, and a Key button.
- **Highlight:**
  - A line whose Ancient One changed is highlighted for 5 minutes after the script saw the change, and so is the title bar.
  - The changes are: summoned (asleep, then standing), beaten, gone dormant, M'aol moved (a new country while he stands), and M'aol now able to be hit.
  - Every tab shows the same highlight, because the change is stored with the reading.
- **Look:** the Loot Rangers box's: dark background, 12 px Verdana, at most 320 px wide, with orange in place of blue. All text is the script's own, or Torn's API words put in as text, never as HTML.

## M'aol's route

TornStats says M'aol moves about every 15 minutes through his praetorians' countries, in the order they were defeated, and a player's chat that the owner sent says the same. So once he can be hit, the box says where he goes next, when the script knows his route.

- **The route from his moves:** while he can be hit, each new country he is seen in is added to his trail. Once the trail holds all five of his praetorians' countries, the route is the order he was first seen in each. His moves while shielded don't count: then he goes round only the beaten ones' countries, and the order he was first seen in across that change wouldn't be his route. Nor does an order seen across a gap: two readings of him 10 minutes or more apart (a page out of view, a phone asleep) could hide one of his stops, so his trail starts again from where he is seen next. That also clears the trail of a summoning the script missed from start to end.
- **The route from the falls:** when the script saw all five praetorians fall, each with a time (the 3-minute rule) and each at least 30 seconds after the one before, the route is their countries in the order they fell. Falls seen in the same sweep can't be put in order, so then this route isn't known.
- **Which wins:** the route from his moves, once it is whole, because it is what he did. Until then, the route from the falls.
- **Known only when it is whole:** five different countries. Two praetorians in one country, or a country missing, means no route.
- **Next stop:** the country after his current one on the route, from the last back to the first. The time is 15 minutes after he was seen arriving, shown only when his arrival here had a time. In a country not on the route, such as Torn City, there is no next stop.
- **Shown:** under M'aol's line, after `moves about every 15 min...`: `next Canada about 11:17 TCT` (or `next Canada` without a time), then `route Mexico > Cayman Islands > United Kingdom > Canada > Hawaii`. With no route known, neither shows.
- **A new summoning** empties the trail.

## Asking TornStats

- **The feed:** `https://www.tornstats.com/ajax/status/maol`, a JSON list of the six that TornStats' own `/maol` page reads every minute. For each one, by `torn_id`, the script uses only `hosped_at`, the time TornStats saw it defeated (such as `2026-10-26T10:24:02.000000Z`). Torn's API stays the source for everything else.
- **When:** at most once every 5 minutes, across all tabs, and only while one of the six is beaten and TornStats' time for it isn't known yet. The script's own time is no help there: it is a sweep apart from the next at best, and Torn's 30-second cache can put two close falls in the wrong order. If TornStats never gives a time for one, the ask goes on every 5 minutes until the next summoning. Like a sweep, only while the page is visible, except in PDA. It doesn't need the API key.
- **TornStats' times can tie, or near enough:** on 2026-10-26, Dyno'salam and Ladso'myna fell a second apart, at 11:52:36 and 11:52:37 TCT. An earlier read gave both 11:52:37: TornStats' times can move by a second between reads. Falls under 30 s apart give no route from the falls, whoever timed them. TornStats is asked again only while a fall has no time of its own from it, and each answer's times replace the ones before.
- **How:** by GM_xmlhttpRequest, with `@connect www.tornstats.com`, sending no cookies. The feed doesn't allow pages on torn.com to read it, so where a host has no GM_xmlhttpRequest the read fails quietly. The route then waits for the script's own readings.
- **A defeat time counts** when it is no more than 8 days old, isn't in the future (with a minute's slack for clocks), and is no more than a minute before the script last saw that one standing. So an old time from an earlier summoning isn't used.
- **The defeat time of each one** is TornStats' when it counts, else the script's own (the 3-minute rule). It is used for the beaten line's time, the order of the lines, the order of the falls for M'aol's route, and M'aol's death for the next summoning.
- **Answers that can't be read,** or no answer, change nothing. The next try is 5 minutes later.

## Where to fly

Everything here assumes you fly from Torn City, as Torn makes you do.

- **When it dies:** the script keeps each one's life from each reading over the last 15 minutes. Its rate is the life lost from the oldest reading in the 10 minutes before the newest one, to the newest; the oldest must be at least 2 minutes back. The death estimate is the newest reading's time plus its life left divided by that rate. It counts from the newest reading rather than from now, so a sweep that stalls doesn't push the estimate later. With no loss, or too little history, there is no estimate.
- **Flights:** TornTools' table of standard minutes (as of 21 Oct 2026) for Mexico 24, Cayman Islands 33, Canada 39, Hawaii 127, United Kingdom 151, Argentina 158, Switzerland 166, Japan 213, China 229, UAE 257 and South Africa 282. An airstrip takes 70% of that, and a BCT (business class ticket) 30%, rounded to the minute.
- **For each standing praetorian,** a note under its line: `dies about 12:40 TCT | airstrip 27 min: 8 min to spare | BCT 12 min: 23 min to spare`. A flight that lands less than 2 minutes before the estimate says `too late`. With no estimate, the note gives only the two flight times.
- **For M'aol,** once he can be hit, when his route is known and his arrival in his current country had a time:
  - his stops are 15 minutes each, in route order, starting from his arrival here, round and round;
  - for each flight, the box finds the country on his route where you would catch him soonest: you land at least 2 minutes before he leaves it, on his next visit there;
  - the note reads `airstrip: fly to Canada, he's there 12:32-12:47 TCT` (and the same for BCT), or `airstrip: too late` when he should die less than 2 minutes after you catch him. A stop that runs past midnight shows the date on its end: `23:55-Oct 27 00:10 TCT`;
  - his own death estimate shows above them: `dies about 13:05 TCT`;
  - once the newest reading shows him more than 17 minutes in one country, his 15 minutes don't hold, so the box doesn't say where to fly for him.
- **Rough by nature:** a fight can speed up or stop, Torn's times can be a minute off, and M'aol's 15 minutes come from TornStats. So the box says "about", and gives the minutes to spare rather than a yes.

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

  The footer shows Torn's message, with the key cut out. While Torn has said to wait, it also says when the next try is ("Trying again at 13:41 TCT."); a wait stored more than 5 minutes ahead is from a clock set back and gets no time.

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
  | Data Sharing | None. The script also reads TornStats' public feed of the six, and sends TornStats nothing of yours. |
  | Purpose of Use | Show where the Ancient Ones are and which can be attacked. |
  | Key Storage & Sharing | Stored on this device in the script's storage; sent only to Torn's API. |
  | Key Access Level | Public. |

## Stored

GM storage, as strings of JSON, because PDA hands stored values back as strings:

- `torn-ancient-ones-key`: the key, or `''` for none.
- `torn-ancient-ones-reading`: the last sweep. It holds when the sweep started, when Torn last answered, and the error if there was one. For each Ancient One, it holds what was read, what last changed, when (the reading's time), and the time of the reading before it. It also holds M'aol's trail: the countries he was seen in while he could be hit, in order, at most 20. It holds each one's life history over the last 15 minutes (the time and life of each reading), TornStats' defeat times by id, and when TornStats was last asked.
- `torn-ancient-ones-box`: the box's place, and whether it's folded.

**Edge cases:**
- Nothing stored, or a value that won't parse: no reading yet, the default place, not folded.
- A save that storage refuses (PDA keeps GM values in localStorage, which can be full): the tab keeps its own copy for this page. A sweep stored ahead of the clock (the clock was set back) doesn't count as newer than that copy, so the tab still sweeps once a minute.

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
  - @name "Torn Ancient Ones", @namespace and @author RussianRob, @license All Rights Reserved, @version 1.0.1, and a CHANGELOG block. The in-file `VERSION` matches @version, and the console line on start carries it.
  - @description: where Torn's Halloween Ancient Ones are (M'aol and his five praetorians), in a small box on Torn pages: country, life left, standing or beaten, an attack link, when M'aol can be hit and his route, and where to fly by airstrip or BCT. It needs a Public API key; Torn PDA gives its own. Torn's API terms table follows the description, in the header comment.
  - @downloadURL and @updateURL: `https://tornwar.com/scripts/torn-ancient-ones.user.js` and `.meta.js`.
  - @grant GM_getValue, GM_setValue, GM_xmlhttpRequest; @connect api.torn.com and www.tornstats.com; @run-at document-idle. No menu entry: the Key button is in the box.
- The served file and the repo are the same file (`server/public/scripts` is served), committed and pushed together.

## Testing

Tests come first, with node:test and linkedom, in `server/torn-ancient-ones.test.mjs`. `TAO_SRC` points the tests at another copy of the script, for mutants. The fixtures are the six profiles read on 2026-10-26, NPC fields only.

- **Reading Torn's answer:**
  - the four real shapes, from the reads at 07:25 and 08:15 EDT, M'aol shielded in Torn City and abroad among them;
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
- **M'aol's route:**
  - from his moves, once the trail holds all five countries;
  - from the falls, when each was timed and at least 30 s apart;
  - none when two falls came in one sweep, or with a country missing or twice;
  - his moves beat the falls when they disagree;
  - the next stop wraps from the last to the first, its time is 15 minutes after a timed arrival, and there is none from Torn City;
  - a new summoning empties the trail;
  - his moves while shielded don't count;
  - tied times from TornStats give no route from the falls.
- **Asking TornStats:**
  - a beaten one with no time of its own gets TornStats' time;
  - TornStats is asked only while its own time for a beaten one is missing, even when the script timed that fall; at most every 5 minutes across tabs; never while hidden;
  - the request to TornStats carries no key, and no cookies (`anonymous`);
  - a TornStats request still out doesn't hold up a sweep, and a sweep doesn't hold up TornStats;
  - a time too old, in the future or from before the script last saw it standing is not used;
  - an answer that can't be read changes nothing;
  - an ask stored ahead of the clock (the clock was set back) doesn't stop the asks.
- **Where to fly:**
  - the death estimate from the last 10 minutes, and none with no loss or under 2 minutes of history;
  - airstrip and BCT minutes for a country, the minutes to spare, and "too late" under 2;
  - for M'aol, the country each flight catches him in soonest, wrapping round his route, and "too late" when he should die first;
  - for M'aol, nothing once the newest reading shows him more than 17 minutes in one country, and a stop past midnight shows the date on its end;
  - while an estimate shows, the lines are built again only when what they say changes (about once a minute), not on every 5-second check.
- **Asking Torn:**
  - two copies sharing storage make one sweep a minute;
  - a hidden page doesn't sweep, but PDA does, and the warboard app counts as not PDA;
  - a page that becomes visible sweeps once a sweep is due;
  - a closed box stops sweeping, and a folded one doesn't;
  - calls go one after another, and an error stops the rest;
  - code 2 stops sweeps until a key is saved, code 5 waits 5 minutes and the footer says when it tries again, and no answer tries again in a minute;
  - a sweep time or a wait stored ahead of the clock (the clock was set back) doesn't stop the sweeps;
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

1. The six profiles saved on 2026-10-26, at 07:25 and 08:15 EDT, go through the script's own reading code and give the tables above (a test).
2. Just before release, one sweep on the owner's key from this box (six calls). The script's reading code on the live answers must agree with TornStats' `/maol` page on each one's country and whether it stands.
3. If by then M'aol can be hit or has died, his new answer is saved as a fixture and tested before release. If not, Torn's words as they came cover him.

## Live check (owner, after release)

- Install from the link. Tampermonkey and the warboard apps ask for the key once; PDA doesn't.
- The box agrees with Torn's summoning popup and the countries you see.
- In a praetorian's country, Attack opens the fight.
- Drag, fold, close, reload: the place and the fold stay.
- On a phone (PDA or the app): the same.

## Not in this version

- Sound, notifications, phone pushes, a server-side watcher.
- M'aol's stops after the next one, or a route guessed before the script knows it.
- Where you are yourself, flights from abroad, the private jet and standard flights.
- Who summoned, or treat counts.
- The regular Loot Rangers NPCs.
- `last_action` as the summoning time.
- A summoning that starts and ends while no tab is reading. The box then keeps the earlier summoning's times, and may say a new summoning is possible when it isn't yet.
