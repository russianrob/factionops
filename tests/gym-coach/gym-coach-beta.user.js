// ==UserScript==
// @name         Gym Coach Beta
// @namespace    RussianRob
// @version      0.9.56
// @description  Beta lane for Gym Coach — verdict-first overlay, three tabs, cooldown rail. Runs alongside the stable script. Fork of AaronPMC [4431836]'s Gym Coach, which this builds on.
// @author       RussianRob
// @license      MIT
// @match        https://www.torn.com/*
// @match        https://*.torn.com/*
// @match        https://www.torn.com/gym.php*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.xmlHttpRequest
// @connect      api.torn.com
// @connect      weav3r.dev
// @connect      www.torn.com
// @connect      torn.com
// @run-at       document-end
// @downloadURL  https://tornwar.com/scripts/gym-coach-beta.user.js
// @updateURL    https://tornwar.com/scripts/gym-coach-beta.user.js
// ==/UserScript==

/*
 * Gym Coach — free for everyone (MIT)
 * Built for rcexyz [2598755] by AaronPMC [4431836]
 *
 * CHANGELOG
* 0.9.56 - The item log names a book by ID, so match it by ID.
 *
 *         The diagnostic added in 0.9.54 did its job on the first try. Log 2050
 *         reads:
 *
 *           data {"item":745,"faction":0}
 *
 *         An item id. The lookup searched the row for the book's NAME, which
 *         can never match, so it found nothing every time -- and said so
 *         honestly instead of quietly dating the book from the sighting.
 *
 *         Now matched on the id, read from the `data.item` FIELD rather than
 *         from the serialised row: "faction":745 and a colour code of "745"
 *         would both satisfy a blind string search of the JSON, and one of
 *         those is in every single row.
 *
 *         The ids come from /v2/torn/items?cat=Book, which answers a public key
 *         and never changes, so it is asked once and kept. Resolved rather than
 *         hardcoded, because only one of the four has ever been seen -- 745,
 *         "Time Is In The Mind" -- and a guessed id fails exactly the way this
 *         bug did: no match, no start, back to the sighting.
 *
 *         The name match stays as a fallback for the window before the
 *         catalogue answers.
 *
* 0.9.55 - "Bar full 91m" on a bar that filled four minutes ago.
 *
 *         Reported with the bar reading 148/150 barely four minutes before the
 *         banner claimed ninety-one.
 *
 *         capSince was right: the moment the bar flipped to full was recorded
 *         correctly. What overrode it was the estimate. fillFromLastSpend dates
 *         a fill from the last spend Torn knows about, and the rule around it
 *         says it is "only ever used to reach FURTHER back than what we have,
 *         so a real observation is never overridden by an estimate" -- but
 *         reaching further back IS overriding, when what it reaches past is a
 *         direct sighting. A spend hours ago put the fill hours ago, and the
 *         148/150 reading in between was not consulted at all.
 *
 *         A bar cannot have been full before the last moment it was seen NOT
 *         full, so that moment is now recorded and the estimate is clamped to
 *         it. This does not touch the case the estimate exists for: a bar that
 *         filled while the app was closed was last seen below the cap BEFORE it
 *         filled, so the clamp is older than the estimate and changes nothing.
 *         Both directions are pinned, because a clamp applied unconditionally
 *         would throw away exactly the long streak this is meant to preserve.
 *
 *         Same family as the 0.9.43 fix, one layer further in. That one stopped
 *         the estimate being used on an incomplete timeline; this one stops it
 *         being used against a complete observation.
 *
* 0.9.54 - Say what the item-log lookup actually found.
 *
 *         0.9.53 asks Torn's log 2050 for when a book was started, and the card
 *         still read "Torn does not say when you started" -- which could mean
 *         the call never ran, ran and matched nothing, or was refused. Three
 *         very different problems behind one sentence.
 *
 *         It now prints which, in Torn's own terms: how many rows came back and
 *         that none named the book, or the error verbatim, or the date it
 *         found. That payload has never actually been seen -- the probe ran out
 *         of rate limit before reaching 2050 -- and guessing at an unseen shape
 *         is what cost two rounds on the aria-label.
 *
 *         Also fixes the retry window. The clock was stamped before the request
 *         and success is gated elsewhere, so the six-hour wait only ever applied
 *         to FAILURES: one rate-limited call locked the countdown out for six
 *         hours. Now a minute, three times, then the long wait -- because a book
 *         with no log row at all fails every time, and polling that for ever is
 *         the pressure the wait exists to prevent.
 *
* 0.9.53 - The book countdown is the real one, and the card shows one book.
 *
 *         0.9.52 found the book and then guessed its age. Reported as "31d
 *         left" by someone with about 28 HOURS left -- they were thirty days
 *         in when the coach first looked, and a sighting can only ever be
 *         dated from now.
 *
 *         Torn's log index names the row that knows: 2050, "Item use book",
 *         written when you start one. One call, asked the moment a book is
 *         recognised and not again for six hours, because a start date does
 *         not move while you are reading. The countdown is then exact and the
 *         card says so instead of carrying the "latest it can be" caveat.
 *
 *         The whole log row is searched for the book name rather than one
 *         field of it. Which key carries the item is undocumented and the
 *         probe ran out of rate limit before it could read one -- and a wrong
 *         key would find no start at all, silently falling back to dating from
 *         now, which is precisely the bug being fixed. Searching the row
 *         cannot fail that way.
 *
 *         Full keys only, since the log is. A Limited key keeps the sighting
 *         date and the caveat that goes with it.
 *
 *         The card also stops listing four books when you are reading one.
 *         Three rows saying "reading?" around the one that matters is three
 *         lines of noise; they fold behind a single line, and a tap is still
 *         how you record a book the page cannot show. And once a book is
 *         inside two days it counts down in HOURS -- "1d left" for something
 *         finishing this evening is the least useful way to say it.
 *
* 0.9.52 - Book detection actually detects the book.
 *
 *         Reported as not working within minutes of 0.9.51 shipping, and it
 *         was not.
 *
 *         The first sighting of the label was written out as "Reading Book:
 *         <name> - <effect>", so the name was taken as everything up to the
 *         dash. The DOM note that followed it had the two run straight
 *         together with no separator at all -- "Reading Book: <name><effect>"
 *         -- and against that the split hands back the whole sentence, which
 *         matches none of the four books. Detection then found nothing, said
 *         nothing, and looked perfectly healthy doing it.
 *
 *         The names are known, so there was never anything to parse. A label
 *         that begins with one of the four IS that book, whatever punctuation
 *         follows. Matched now, not parsed, and both label shapes are pinned
 *         in the tests.
 *
 *         The Stat books card also prints what the strip actually said, in
 *         Torn's own words -- or says the strip was not on the page at all.
 *         Guessing at that wording is what caused this, and the next time it
 *         changes the fix should start from a screenshot rather than a guess.
 *
 *         Also moves a back-compat guard added in 0.9.50 that sat 58 lines
 *         before the value it guards is restored, so it could never fire.
 *         Harmless -- calibration already handles the absence -- but a check
 *         that cannot run reads as protection and is not.
 *
* 0.9.51 - The coach works out which stat book you are reading.
 *
 *         Asked for after 0.9.44 shipped it as a manual tap. The tap stays --
 *         it is still the way to correct a date -- but it is no longer the only
 *         way the coach can know.
 *
 *         Nothing about a stat book reaches the perks payload. Confirmed live
 *         rather than assumed this time: perks.book came back an EMPTY ARRAY
 *         while a book was actively being read, because the four stat books
 *         award a one-off stat gain rather than an active multiplier, so
 *         parsePerks structurally cannot see them.
 *
 *         The status-icon strip under the Life bar does carry it -- and carries
 *         it ONLY in aria-label. Not title, not src, not text. Three separate
 *         scans of that area came back empty before anyone read the attribute,
 *         which is the same lesson as the Torn DOM keeps teaching: literal
 *         classes first, aria-label second, text last.
 *
 *         Detection gives WHICH book and never when it started, so a newly seen
 *         book is dated from the first moment this device saw it. That is a
 *         floor, not the real start, and the card says so instead of presenting
 *         the estimate as a fact -- a book noticed on day 20 of 31 would
 *         otherwise promise its award eleven days late.
 *
 *         Three answers, and the difference between the last two is the whole
 *         design: a book is being read / the strip is here and carries no book /
 *         there is no strip on this page. Only the middle one clears anything,
 *         and it only ever clears a date this device set ITSELF. A date you
 *         tapped in is never touched, because you know when you started it and
 *         this does not. Plenty of Torn pages have no sidebar, and treating
 *         that as "no book" would clear the countdown on every one of them.
 *
 *         Where the strip does show the book, the page wins: tapping it off
 *         gets overruled on the next paint, because Torn saying you are reading
 *         it beats a tap saying you are not.
 *
 *         Also fixes a real bug in 0.9.49, found while chasing something else.
 *         fetchTrainLog rebuilds state.trainLog as a fresh object literal, and
 *         sinceAt was not in it -- so the stamp was discarded on every
 *         successful round, and carriedSince's expiry could never fire after
 *         the first one. That is the entire drift fix 0.9.49 shipped, silently
 *         disabled by the round that was meant to feed it. Its own comment
 *         warned about exactly this: "a since without a sinceAt can never
 *         expire". The unit tests were 18/18 green throughout, because they
 *         exercised the two halves in isolation and never drove the round that
 *         rebuilds the object they live on. There is now a test that does.
 *
* 0.9.50 - Calibration counts days where you trained more than one stat.
 *
 *         Reported by someone sitting at 1 of 7 after a week of alternating
 *         defense and speed, which is a perfectly ordinary way to train.
 *
 *         The rule was: exactly one stat may move that day, or the day is
 *         discarded -- "the day's energy was split in a ratio nothing
 *         recorded". The reasoning was right and the premise was wrong.
 *         Something did record it. The gym log is fetched once PER STAT, so
 *         the per-stat energy was already in hand on every round;
 *         trainLogByDay was summing it and throwing the stat away.
 *
 *         So a mixed day is now measured: each stat's own energy against each
 *         stat's own gain. For anyone who rotates stats that roughly halves
 *         the time to a working correction.
 *
 *         It can only ever turn a discarded day into a measured one, never a
 *         measured day into a wrong one. The split is refused unless the log
 *         accounts for exactly the stats that moved and for the energy the
 *         ledger recorded -- and any stat whose gain cannot be forecast at all
 *         disqualifies the whole day rather than being quietly left out of a
 *         total it should be in. Every one of those falls back to the old
 *         one-stat rule.
 *
 *         Which stat a log row is about is read from Torn's own wording for
 *         that row, never from the order the four ids were requested in. The
 *         browser test deliberately serves the wrong title under each id, so
 *         anything keying off request order fails there rather than in the
 *         wild.
 *
 *         Limited keys keep the one-stat rule, because the gym log is
 *         Full-only, and the card now says which of the two applies to you.
 *
* 0.9.49 - "Spent today" crept upward on a page that was only being reloaded.
 *
 *         Reported: 340 energy actually trained, the card reading 367 and
 *         ticking up by one without a train. The tell was in the number itself
 *         -- that gym costs 10 energy a train, and no multiple of 10 ends in a
 *         7, so 367 could not be a gym total at all.
 *
 *         Two defects, and the second is why it never corrected itself.
 *
 *         On gym.php every observed bar drop was booked as training. Off gym.php
 *         the same code already discards anything that is not a whole 25-energy
 *         attack, with a comment explaining that the remainder is API/DOM skew
 *         -- but on the gym page there was no such guard, so a point or two of
 *         disagreement between the API bar and the DOM bar became a point or
 *         two of training, on every reload. Now counted in whole trains, at the
 *         cost the gym actually charges.
 *
 *         And the local count was carried against Torn's log FOREVER. The carry
 *         exists so a train from four seconds ago still shows while the log is
 *         two minutes stale, but it could not tell "the log is behind" from
 *         "the local count is wrong", and it resolved every disagreement in
 *         favour of the local one. So each point of skew survived every log
 *         round and accumulated all day. The log is the authority now: an
 *         excess it has not confirmed within seven minutes is dropped.
 *
* 0.9.48 — Board hardening, after an adversarial read of the whole feature.
 *
 *         Twelve findings, all real, none of them cosmetic:
 *
 *         A request that never SETTLES wedged the tab for good. httpGet has no
 *         timeout, and PDA's HTTP layer collapses two identical in-flight GETs
 *         and orphans the second callback -- so boardBusy stayed true, every
 *         button went dead, and only a reload recovered it. Board requests are
 *         now raced against a 20s clock. A rejected promise is recoverable; an
 *         unsettled one is not.
 *
 *         Anchoring is atomic. Baselines were committed per stat as each landed,
 *         so a round that died half-way anchored energy at Monday and trains at
 *         whenever the next attempt succeeded -- and a split normalised across
 *         differently-anchored stats looks entirely plausible while being wrong
 *         for the rest of the week. Anchors now go to a draft and commit
 *         together or not at all.
 *
 *         A half-read board says so, and a rollover no longer throws away a
 *         good board when the fetch that follows it fails.
 *
 *         Refresh and the natural pass can no longer run at once, doubling the
 *         request rate the 700ms spacing exists to hold down. The natural pass
 *         gained a two-minute cooldown, the key guard fetchBoard already had,
 *         and it reports the members it could not read instead of counting them
 *         as done. Stale Nat figures are cleared rather than carried.
 *
 *         The pasted card printed "0% natural" beside members the table showed
 *         nothing for -- the two used different guards. One guard now.
 *
 *         Past weeks archived every member's full row to render one name each.
 *         Top three now: storeSet swallows a quota error, and this origin's
 *         localStorage is shared with Torn's own chat.
 *
 *         Boot sieves a stored board to finite numbers. A string in a stat map
 *         threw; a NaN week rolled on every read and dated a week to 1970.
 *
 *         Copy reported success it had not got -- writeText is a promise and
 *         its rejection was dropped, so a denied clipboard said "Copied" and
 *         never reached the fallback.
 *
 *         Also: the board now knows BEFORE asking whether your key has faction
 *         API access, from the /key/info call it already makes, and says so
 *         instead of spending six refused requests to find out. It is a faction
 *         POSITION ability, not a key property, so a Full key does not grant it
 *         -- and only codes 16 and 7 get that explanation now. Anything else is
 *         transient and no longer sends you off changing permissions.
 *
* 0.9.47 — Trains on the board, beside the energy.
 *
 *         Asked for: see trains, not only energy. gymtrains is in the same
 *         enum, so it is one more request and it lands on the second line of
 *         each row -- "1,932 trains - str 60% - def 40%" -- rather than taking
 *         a fifth column, because five columns do not fit a phone and the tab
 *         bar wrapping when Board was added was the same mistake one element
 *         earlier.
 *
 *         Read as its own counter and never divided out of the energy. Energy
 *         per train runs from 5 in a starter gym to 25 in a specialist one, so
 *         a derived count would be fiction dressed up as a measurement -- and
 *         reading the two side by side is exactly what tells you which gym
 *         somebody is actually using.
 *
 *         Both cards carry it too.
 *
* 0.9.46 — The board's stat column was energy, not gains.
 *
 *         Reported within the hour: "i used 340 but why does it say 340 str?"
 *         -- and that is exactly what it was. gymstrength, gymdefense,
 *         gymspeed and gymdexterity are ENERGY SPENT on that stat, not points
 *         gained; gymenergy is simply their sum. 0.9.45 rendered the number as
 *         "+340 str", which reads as 340 strength points and is off by six
 *         orders of magnitude for anyone with real stats.
 *
 *         Torn does not document this and the endpoint's own summary calls
 *         them challenge contributions, so it was flagged as unverified when
 *         the board shipped. One glance at a real faction settled it, which is
 *         why it was flagged rather than assumed.
 *
 *         Now the column is a SPLIT -- "all str", or "str 60% - def 40%" --
 *         which cannot be misread as a stat gain and is the more useful figure
 *         anyway, since the energy column already carries the total. Header
 *         renamed from Gained to Trained. The card says the same thing.
 *
 *         Also: the Discord card's columns did not line up, because "100% nat"
 *         is wider than "37% nat" and an unknown one is blank. Every cell is
 *         padded to a fixed width now, in the one format whose entire reason
 *         for existing is that it lines up.
 *
* 0.9.45 — A faction gym board, with no server behind it.
 *
 *         Asked for: a leaderboard or hall of fame per faction -- who used the
 *         most natural regen this week -- without standing a backend up for it.
 *
 *         /v2/faction/contributors turns out to hand ONE caller every member's
 *         cumulative gym numbers, from a Limited key with faction API access.
 *         Nobody else installs anything, hands over a key or opts in, and no
 *         backend ever holds faction data. Energy spent and all four stat
 *         gains are in the same enum, so the board carries battle stats beside
 *         the energy rather than only the energy.
 *
 *         What that endpoint does not have is history -- its `timestamp` is a
 *         cache-buster, not a query -- so a WEEKLY figure is a delta against a
 *         baseline frozen at Monday 00:00 TCT. That baseline lives on this
 *         device, and the board still agrees across devices, because the
 *         numbers being subtracted are the FACTION's rather than this one's.
 *         Two clients anchored at the same Monday compute the same board
 *         without ever talking to each other. The shared clock is the sync.
 *
 *         The natural-regen column needs no baseline at all.
 *         /user/<id>/personalstats answers refills, xanax and energy drinks on
 *         a PUBLIC key -- the same figures Torn prints on a profile -- and with
 *         a timestamp answers them HISTORICALLY, so Monday's counts are simply
 *         asked for. A past week's answer never changes, so it is fetched once
 *         and kept. Natural energy is what is left after a refill, a pill and
 *         a can are taken out of the week.
 *
 *         Contributors takes one stat per call, so the board is five requests.
 *         They go out one at a time behind a gap, only when the tab is opened,
 *         behind a five-minute TTL -- never on the poll tick. The natural
 *         column is one more request per member and is a button, not automatic.
 *
 *         Copy for chat gives you the top twelve as plain text to paste into
 *         faction chat; Copy for Discord gives the same board fenced, where
 *         monospace columns survive. Nothing is uploaded -- the card is built
 *         on the device and goes to the clipboard.
 *
 *         A key whose faction position does not grant faction API access gets
 *         Torn's own refusal and what actually fixes it, rather than a spinner.
 *
* 0.9.44 — Stat books count toward the plan.
 *
 *         Four books each award +5% of a stat, capped at 10,000,000, after 31
 *         days of reading:
 *
 *           Strength   Brawn Over Brains
 *           Defense    Keeping Your Face Handsome
 *           Speed      Time Is In The Mind
 *           Dexterity  A Job For Your Hands
 *
 *         They are not perks. Nothing reaches book_perks and no multiplier
 *         changes, so parsePerks can never see them -- which is why the coach
 *         forecast months ahead while ignoring a known, dated gain already in
 *         the post. A new card on Plan: tap the book you are reading and every
 *         date below accounts for it, with the countdown on screen so the
 *         assumption is visible rather than buried in an ETA.
 *
 *         It stops counting the moment the book lands, because by then the
 *         stat itself carries the award and counting it again would take it
 *         twice.
 *
 *         Every name checked against the wiki one at a time, because two of
 *         them are traps: "Get Hard Or Go Home" reads like the Defense book
 *         and is actually +20% gym gains for 31 days, and "Weaseling Out Of
 *         Trouble" is a passive Dexterity bonus rather than an award. Guessing
 *         from the names would have wired up the wrong book twice.
 *
* 0.9.43 — The full-bar estimate is only used when the timeline is complete.
 *
 *         Reported: "Bar full 240m" when it had not been. 0.9.40 dates a bar
 *         nobody watched fill from the last spend the API knows about, and
 *         argued that was a floor -- assuming the spend emptied the bar can
 *         only date the fill LATER than reality, so it under-reports.
 *
 *         That argument holds only if every spend is VISIBLE. On a Limited key
 *         the gym log is refused, so training is invisible and the last attack
 *         becomes the last known spend: an attack nine hours ago dates the bar
 *         to four hours full when it was emptied by training one hour ago. An
 *         incomplete timeline is not a floor, it is a fiction, and it put a
 *         number on screen that was simply untrue.
 *
 *         The estimate now runs only where the gym log answers. Everything
 *         observed directly is untouched, so a Limited key keeps exactly what
 *         it had before 0.9.40 -- silence about a bar it never watched fill,
 *         which was the honest answer for that key all along.
 *
* 0.9.42 — Stop asking a Limited key for the gym log it can never have.
 *
 *         The key log made it plain: on a Limited key, selection `log` is
 *         refused every single time, four calls a round, forever. A REFUSED
 *         call still counts against Torn's 100 a minute, so the script was
 *         spending roughly 2/min purely to be told no.
 *
 *         Code 16 is Torn stating a fact about the key, so it is remembered
 *         and the asking stops. Anything else is not: a rate limit means the
 *         key CAN read the log and was merely busy, and writing the feature
 *         off over a transient error is how it quietly dies for someone whose
 *         key is fine. That distinction is the one this session got wrong
 *         three times in the probe before it was pinned, so it is pinned here
 *         too, by a test and by a mutant in each direction.
 *
* 0.9.41 — Training no longer empties your API budget.
 *
 *         Measured on a live account: 103 requests in 183 seconds, 88 of them
 *         inside one rolling minute, and 77 of those the gym log firing at
 *         0-1ms spacing. Torn allows 100 a minute per key, so an ordinary
 *         training session was enough to rate-limit everything -- which is
 *         what the red "Too many requests" in the header was, and what made a
 *         lost session permanent two versions ago.
 *
 *         Two faults, both mine. refresh("train") passed FORCE to the log
 *         fetch, and the gym-page click handler fires refresh("train") twice
 *         per press -- so every click bypassed the TTL and asked all four log
 *         endpoints again. Eight calls a click. The live `since` figure added
 *         in 0.9.39 already keeps "Spent today" moving without asking Torn at
 *         all, which is what makes forcing unnecessary rather than merely
 *         expensive.
 *
 *         And a failed round stamped no time, so `at` stayed old and every
 *         later call started a fresh round of four -- on a key that was
 *         failing BECAUSE it was rate limited. The limit fed itself. The
 *         attempt is stamped now, so failures back off like anything else.
 *
* 0.9.40 — A full bar the script never watched fill is now dated, instead of
 *         being passed over in silence.
 *
 *         Reported twice: 150/150 on opening the app, no banner. The threshold
 *         was not the problem -- the CLOCK never started. The banner counts
 *         from the moment the bar filled, and that moment is only known if the
 *         app was open while it was climbing. Close it on a low bar overnight
 *         and there was no armed prediction, so the coach had no idea how long
 *         the bar had been sitting and said nothing. That was the right call
 *         when the ledger was all it had.
 *
 *         It is not all it has now. The train log and the attack log both
 *         carry timestamps, so the last time energy LEFT the bar is known, and
 *         the bar cannot have filled before it refilled from there. A session
 *         at 09:51 PM on a 150 bar dates the fill to five hours later, which
 *         is a banner rather than a shrug.
 *
 *         The estimate assumes that spend emptied the bar -- the same reading
 *         ledgerDelta already takes, and deliberately the generous one: spend
 *         less and the bar filled sooner, so the estimate can only ever date
 *         the fill LATER than reality and under-report the streak. It is used
 *         only where it reaches further back than what was actually observed,
 *         and never shortens a streak already known.
 *
* 0.9.39 — A training session no longer falls down the gap while Torn's log
 *         catches up.
 *
 *         Reported: 400e trained at 09:51 PM, and "Spent today" still read 0e
 *         three quarters of an hour later -- with the Train Log card showing
 *         the session plainly the whole time, which is what proved the script
 *         had seen it.
 *
 *         `since` is the live figure carrying a session from the moment the
 *         bar drops on the gym page to the moment Torn's log admits it
 *         happened. Every successful fetch cleared it outright, assuming the
 *         round it just did includes the session. Torn's log lags, so that
 *         assumption is wrong about once per session -- and the header said
 *         "Too many requests", so the rounds that would have corrected it
 *         never arrived. The figure was gone for good.
 *
 *         It now compares instead of assuming: whatever the fresh log has
 *         caught up with is dropped, whatever it has not is kept. Self
 *         correcting in both directions, including a log that knows MORE than
 *         this device does because you trained on another one.
 *
 *         The log is also asked every two minutes rather than every one. It is
 *         four endpoints a round, the live figure now covers the wait, and
 *         rate limits are precisely what made the lost session permanent.
 *
* 0.9.38 — The verdict now starts folded.
 *
 *         0.9.36 shipped the fold switched off, on the grounds that a stored
 *         preference is one thing and reshaping everyone's panel unasked is
 *         another. Asked for as the default after using it, so it is the
 *         default: the panel opens compact and the full verdict is one tap on
 *         the bar.
 *
 *         A stored choice still wins. Anyone who has deliberately expanded it
 *         keeps it expanded -- the default only decides for panels that have
 *         never been told either way, and a test pins that so the change
 *         cannot reach across and re-fold a panel someone opened on purpose.
 *
* 0.9.37 — A percentage build no longer trains a stat that is OVER its share.
 *
 *         Reported: "why is it telling me to train dex if my ratio is over?"
 *         Correct question, and there were two faults behind it.
 *
 *         The increment ladder caps every stat at the same ABSOLUTE rung,
 *         which walks them toward equal VALUES. For four typed goals that is
 *         exactly right -- it is what "stats rise together" means. For a
 *         50/30/20 build it is the wrong shape to climb: it pulls the account
 *         toward 33/33/33 and only bends back at the very end, which is how
 *         Dexterity got scheduled while sitting 21 points over. Each rung is
 *         now scaled by the stat's own share, so every stat climbs to its own
 *         fraction, they arrive together, and an over-share stat simply has no
 *         room at its rung and waits.
 *
 *         And the card marked "next" from the share picker even when a total
 *         goal meant the PLANNER was choosing the leg -- so it could say
 *         "Strength next" while the verdict trained Speed. The marker follows
 *         the planner now; only maintain mode, which has no planner, asks the
 *         share picker directly.
 *
 *         Without a build nothing changes: flat rungs, lowest stat first.
 *
* 0.9.36 — The verdict can be folded to one line on the Now tab.
 *
 *         Requested: have that top section minimised, with the option to
 *         expand it by clicking. Off the Now tab the verdict already collapses
 *         to a single tappable line, so this makes that same compact form
 *         available ON Now -- the tabs and the cards start higher up the
 *         screen without losing the answer, and the line still carries both
 *         the verdict and your energy.
 *
 *         Tap the tag to fold, tap the folded bar to open it again, and the
 *         choice is remembered. Folded on Now the bar EXPANDS rather than
 *         navigating, since you are already on the tab it would take you to;
 *         off Now it still returns you to Now exactly as before.
 *
 *         Off by default. A stored preference is one thing; silently
 *         reshaping the panel of everyone who never asked is another.
 *
* 0.9.35 — On a percentage build, the gym bonus picks between the stats that
 *         are under -- it no longer loses to a slightly bigger gap.
 *
 *         Reported on Str 50 / Spe 30 / Dex 20 / Def 0: Speed was 14.9 points
 *         under and Strength 12.1, so 0.9.34 sent every session to Speed at
 *         +10% while Strength sat at +13%. Both were under and both had to be
 *         trained anyway, so taking the worse multiplier first is simply less
 *         stat for the same energy -- and maintain mode has no deadline, so
 *         the ORDER costs nothing while the multiplier costs 3% of every
 *         session.
 *
 *         Being under your share is now what makes a stat a candidate, and the
 *         bonus chooses among the candidates. It still converges: train the
 *         high-bonus stat and its share climbs until it is no longer under,
 *         at which point it drops out and the next takes over. The shape is
 *         held by the filter, not by the ranking. A stat that is OVER never
 *         wins however good its bonus.
 *
 *         The card marks which row is actually next, because rows are ordered
 *         by deficit and the deepest deficit is no longer the pick -- without
 *         the marker the top row reads as next and contradicts the verdict.
 *         The bonus is shown per row only when the four differ, since four
 *         identical numbers decide nothing.
 *
* 0.9.34 — Set a build as percentages instead of four fixed numbers.
 *
 *         Asked for by someone running a custom Euphoria build: a fixed goal
 *         says nothing about SHAPE. "Strength 1b" has to be retyped every time
 *         it lands and says nothing about the other three, so anyone following
 *         a published build redoes the arithmetic by hand forever.
 *
 *         Percentages of your total, which is how builds are actually quoted
 *         and already what torn-gym-stat-percentages paints on gym.php. Any
 *         scale works: 40/30/20/10 and 4/3/2/1 are the same build, and what
 *         you typed stays in the box rather than being rewritten under your
 *         cursor. A share of 0 means never train that stat, which several
 *         published builds want for Defense.
 *
 *         Two modes off one input. With a total stat goal the shares become
 *         the four targets the planner already reads, so dates, increments,
 *         Steadfast ordering and "Worth it?" pricing all work untouched. Leave
 *         the total blank for maintain mode: no end date, and each session
 *         goes to whichever stat is furthest under its share.
 *
 *         Deficit beats Steadfast, which only breaks ties -- holding the shape
 *         is the point of asking for a build. And a stat that is OVER is
 *         reported as over rather than quietly retargeted: you cannot train a
 *         stat down, so it comes back on build only as the others grow. Fixed
 *         goals hid that entirely.
 *
* 0.9.33 — The API poll drops from eight seconds to a minute.
 *
 *         Eight seconds is 7.5 calls a minute of a key capped at 100, spent
 *         re-reading cooldowns and perks that do not move that fast. It is
 *         also why there was no headroom left: running the ledger probe
 *         alongside it had Torn answering "code 5: Too many requests" to
 *         everything, which read as an access denial and nearly sent a whole
 *         feature down the wrong path.
 *
 *         Nothing on screen slows down. The bar is read from the page DOM once
 *         a second and the cooldowns tick down locally between polls, so the
 *         API round was never what made the panel feel live -- it carries
 *         cooldowns, perks, stats and gym, none of which change in eight
 *         seconds.
 *
 *         Off-gym goes the same way. It was 20s, which had every other Torn
 *         page polling three times harder than the gym itself.
 *
 *         Steady-state worst case is now about 10 calls a minute against the
 *         cap, counting the inventory walk, the four stat logs, refills,
 *         stocks, attacks and the key check. A test does that arithmetic from
 *         the constants rather than trusting this paragraph.
 *
* 0.9.32 — The key box requires a Full key and refuses anything less.
 *
 *         Owner's decision. The gym training log is Full-only, and without it
 *         "Spent today" falls back to the bar and an unwatched gap cannot be
 *         reconstructed at all -- so a Limited key can never give a figure two
 *         devices agree on. The key is checked BEFORE it is stored, so a
 *         refused one never becomes the saved one, and the refusal says which
 *         level it was and where to make a Full one.
 *
 *         One deliberate exception: if the CHECK cannot run, the key is saved
 *         anyway. Torn caps a key at 100 calls a minute and the coach is
 *         already polling, so a check can fail for reasons that have nothing
 *         to do with the key -- refusing then would turn a busy moment into a
 *         lockout on a perfectly good key. It saves, and says the level could
 *         not be confirmed rather than claiming it was.
 *
 *         An invalid key is refused rather than waved through: Torn's code 2
 *         is a definite answer, not an inconclusive one, so it does not get
 *         the benefit of the doubt that a failed check does. httpGet rejects
 *         with the code on the Error and no payload, so the save path rebuilds
 *         the shape -- without that an unrecognised key scored "unknown" and
 *         was stored.
 *
* 0.9.31 — A key you type in now beats the one Torn PDA injected.
 *
 *         The order was the other way round, which made a deliberately entered
 *         key unreachable on a phone. PDA substitutes its own key at install,
 *         that key is usually Limited, and the gym log is Full-only -- so
 *         pasting a Full key into Settings did nothing at all, and missed
 *         energy stayed "observed only" with no way to improve it. Injection
 *         is a default; typing one is intent, and intent wins. A PDA user who
 *         has never entered a key is unaffected.
 *
 *         Settings now says what the key in use can actually do, read from
 *         /v2/key/info -- which answers ANY key, so the check can never be the
 *         thing that fails and mislabel a good one. "Could not tell" is kept
 *         distinct from "not Full", because a rate-limited check must not nag
 *         someone whose key is fine.
 *
 *         The copy asked for a Limited key throughout, which is no longer the
 *         right advice: a Full key is what the training log needs. It says so,
 *         and says plainly what still works without one -- attacks, refills,
 *         cans, plans and notifications all do.
 *
* 0.9.30 — Missed energy stops guessing about time the script did not watch.
 *
 *         Time the script DID watch was always right: the ledger ticks every
 *         second and sees every drop. Only the gaps were guessed, and the
 *         guess was "the bar must have sat at the cap the whole time". On one
 *         device that is fair. On two it is simply false -- the PC bills six
 *         quiet hours at the cap while the PDA emptied the bar twice inside
 *         them, and neither can know the other exists.
 *
 *         A gap is now reconstructed instead: walk it, let the bar climb at
 *         the known rate, apply each training session and attack at its own
 *         timestamp, and count only the time the bar genuinely sat full. Both
 *         devices read the same API, so both reach the same number -- which is
 *         the property the old model could never have.
 *
 *         The gym log needs a FULL key. On a Limited key the timeline is
 *         missing every training session, so simulating anyway would show the
 *         bar full straight through them: a confident wrong figure. Those gaps
 *         are declined instead -- booked as nothing, and the day marked
 *         "observed only" so the figure admits what it is. Under-reporting is
 *         recoverable; inventing is not.
 *
 *         Declining is only ever about gaps. A Limited key keeps its ordinary
 *         per-second accounting for time it was actually watching, because
 *         watching a bar needs no log.
 *
* 0.9.29 — Energy spent attacking comes from Torn's attack log, not the bar.
 *
 *         Reported by a faction member running the coach on PC and PDA at the
 *         same time: both devices showed impossible figures. The cause is not
 *         arithmetic, it is the model. Each device only ever saw its OWN bar
 *         readings, so one that had been closed a while assumed the bar sat at
 *         the cap for the whole gap and booked the catch-up -- including the
 *         hours the other device was training and attacking. Both did it,
 *         neither could know the other existed.
 *
 *         The attack log has no such problem: both devices ask Torn the same
 *         question and get the same answer. /v2/user/attacks needs only a
 *         LIMITED key, takes a `from`, and returns rows with timestamps, so
 *         today's hits can be counted exactly instead of inferred from drops.
 *
 *         Zero attacks is now a REAL answer rather than a reason to fall back
 *         to the bar; only an unreadable one falls back, and says so. The line
 *         carries the hit count, so a figure that disagrees with what you did
 *         can be checked at a glance.
 *
 *         The day window is enforced where the counting happens, not only in
 *         the request -- requesting it alone means any change to that
 *         parameter silently swallows the previous day. Paging walks `to` back
 *         through the day because v2's next-link is unreliable, and stops at
 *         six pages: past 600 hits in a day the figure is academic and the
 *         requests are not.
 *
 *         `basic` joins the main selection list for player_id, which is what
 *         lets the log tell your hits from hits on you. It is PUBLIC access,
 *         so it cannot fail a call the rest of which already works.
 *
* 0.9.28 — An unused refill says so next to the Gym title, not just in the
 *         panel.
 *
 *         DO THIS already carried the line, but the panel is tucked behind a
 *         pill and the moment that matters is arriving at gym.php on an empty
 *         bar with the day's refill unspent -- when you are looking at the
 *         gym, not at the coach.
 *
 *         Anchored on h4#skip-to-content, whose id is unhashed and stable
 *         where every generated class around it is not. That title row is
 *         float-based rather than flex, so the strip floats left to share the
 *         line instead of dropping beneath it; the harness gained those two
 *         CSS rules, because without them a "same line" test passes against a
 *         layout Torn does not have. Losing the anchor costs the strip its
 *         position and never its existence -- it falls back to floating.
 *
 *         It is a link to points.php, since the useful thing to do about an
 *         unused refill is go and spend it, and it wears .gc-btn's green,
 *         weight and corner so it reads as part of the coach.
 *
 *         The refill flag is re-read every three minutes rather than every
 *         ten. Ten was defensible on request count, but it also decided how
 *         long the strip kept advertising a refill you had already spent.
 *
* 0.9.27 — The full-bar banner reads the clock the panel already prints.
 *
 *         Reported: it took far too long to appear, and on a freshly opened
 *         app it did not appear at all -- while the panel four inches away
 *         said "Bar has been full for 19m".
 *
 *         Both were the same mistake. The banner kept its OWN clock, started
 *         the first time a live tick happened to SEE a full bar, so reopening
 *         the app reset it to zero and cost another ten minutes. capStreak()
 *         has been there the whole time and is strictly better: it works from
 *         the moment the bar was predicted to fill, so a bar that filled while
 *         the app was closed counts from when it actually filled. Two clocks
 *         for one fact was the bug; there is one now, and a test pins the
 *         banner and the panel to the same number.
 *
 *         "Got it" now buys two minutes rather than ten. By the time you are
 *         dismissing it you have been told, so a short leash is worth more
 *         than a long silence.
 *
 *         Slimmer, too: one line at 33px instead of a three-row block that
 *         sat on top of Torn's nav and news ticker.
 *
 *         Mc Smoogle is offered on a FULL bar as well. It was only wired into
 *         the waiting-for-energy verdicts, which is exactly where you are not
 *         standing when the bar is full -- and since Torn banks energy above
 *         the cap, a full bar is a fine moment to claim it.
 *
* 0.9.26 — Tells you when the weekly Mc Smoogle energy is waiting.
 *
 *         The plan has budgeted this for a while and DO THIS never mentioned
 *         it. Torn does expose it: /v2/user/stocks gives every holding a
 *         `bonus` object, and `available` is exactly the readiness flag.
 *
 *         The stock id is pinned to 29 rather than discovered, and that is the
 *         careful choice, not the lazy one. Matching the benefit description
 *         looks tidier until you read the catalogue: MUN (24) says
 *         "1x Six-Pack of Energy Drink" and MCS (29) says "100 energy", so
 *         anything grepping for "energy" matches both and would report a
 *         crate of cans as your energy claim. A pinned id can only fail
 *         silent. Keyed on the id alone for the same reason -- the account
 *         this was probed on also held IIL with a claim ready, and any looser
 *         test would have called that Mc Smoogle every time it came due.
 *
 *         Not gated on having room, unlike the point refill: Torn banks energy
 *         above the cap rather than discarding it, the way a xanax does, so
 *         claiming on a full bar loses nothing -- and a full bar is exactly
 *         when you are most likely to be reading it.
 *
 *         Its own request, because /user/stocks needs a limited key and Torn
 *         fails a combined call as a whole.
 *
* 0.9.25 — Says something when the bar is sitting full, wherever you are.
 *
 *         Reported: "I have lost a lot of energy getting distracted by chat or
 *         reading a guide in the forums, not realizing I never trained." The
 *         coach had the data the whole time -- the poller runs on every Torn
 *         page -- but ensureUi strips the panel everywhere except the gym, so
 *         there was nothing anywhere to notice.
 *
 *         A banner now appears on any Torn page once the bar has been at the
 *         cap for ten minutes. "Got it" is a snooze rather than a dismissal:
 *         it buys ten quiet minutes and comes back, and only energy actually
 *         leaving the bar ends it. The clock is persisted, because it is
 *         measured across page loads and a fresh tab would otherwise restart
 *         it and never reach ten minutes.
 *
 *         Quiet during a war stack, where holding the bar is the plan the
 *         coach itself gave you, and quiet above the cap, where Torn pauses
 *         regen so nothing is bleeding. It drops below FactionOps' own top
 *         bar rather than fighting it for the spot.
 *
 *         Also: the daily point refill is now offered in DO THIS, but only
 *         when the bar is low enough for it to be worth spending -- a refill
 *         sets you to max, so suggesting one at 125/150 buys 25e and burns
 *         the day. Read from its own request, so a key that cannot see the
 *         flag leaves the reminder quiet instead of taking the panel down.
 *
* 0.9.24 — Finds the notification bridge under warboard's own name.
 *
 *         warboard-iOS answers Torn PDA's bridge protocol, and the first cut of
 *         that exposed it as `window.flutter_inappwebview` so PDA-written
 *         scripts would work unchanged. That object's PRESENCE is how every
 *         userscript detects PDA, so every script inside warboard took the PDA
 *         branch — FactionOps turned SSE off and showed "network error". It is
 *         `window.__WB_BRIDGE__` now, and this looks for both.
 *
 *         Settings names the host honestly as a result: "warboard" rather than
 *         "Torn PDA" or "Browser", since it is neither. And the pings line asks
 *         whether a ping can actually reach you rather than whether you are in
 *         PDA — warboard can deliver them, a plain browser still cannot.
* 0.9.23 — "Spent attacking 6e" on a day with no attacks. A Torn attack costs
 *         exactly 25e, so 6 was never one — it is API/DOM skew on the energy
 *         reading, which used to disappear among real training and only became
 *         visible once off-gym spend had its own line in 0.9.20. The line was
 *         new; the leak was not.
 *
 *         Off-gym spend is counted in WHOLE ATTACKS now: floor(drop / 25) × 25.
 *         Anything under one attack is discarded, and so is the remainder
 *         riding along with a real one, so 31e reads as a single attack rather
 *         than 31. That also removes the need to ask Torn: the flat 25e cost is
 *         what makes an off-gym drop identifiable without an API call at all.
* 0.9.22 — Settings claimed "Host: Torn PDA" in a desktop browser. The row was
 *         a hardcoded string with no check behind it, and so were two others:
 *         instructions to leave the PDA API-key placeholder alone, and a note
 *         that pings use PDA notifications. Three assertions about the
 *         platform, none of them checked.
 *
 *         isPda() now decides. Only Torn PDA substitutes the key placeholder
 *         and only Torn PDA exposes the flutter bridge, so both are real
 *         evidence; the user agent is the last resort. It is a function rather
 *         than a constant because the bridge can arrive after this file runs.
 *
 *         The pings line is the one that mattered. Notifications go through
 *         PDA's bridge, which a browser does not have, so a desktop user was
 *         being promised something that could never arrive — and had no way to
 *         know why it never did. It now says so outright.
* 0.9.21 — "Spent today" now comes from Torn's own gym logs rather than being
 *         inferred from the bar. Torn writes one line per session with the
 *         exact energy, stamped to the second, so it is a record where the bar
 *         was only ever a reconstruction — and it counts a session the script
 *         was not running for, which the bar cannot.
 *
 *         Log for truth, bar for immediacy: the figure is the log total plus
 *         whatever the bar has watched leave the gym page since, and it snaps
 *         to the log when the next round lands. A number that only moved when
 *         an API call landed would read as broken in the seconds after a
 *         train. Four calls, one per stat (5300-5303), on their own 60s TTL
 *         and forced right after a detected session — not on every 8s poll.
 *
 *         A failed round leaves the bar's figure standing and labels it "from
 *         the bar", because a failed call is no news rather than zero
 *         training. An EMPTY log is different: that is Torn saying you trained
 *         nothing, and it is reported as nothing.
* 0.9.20 — This is a gym coach, so energy spent attacking is not "spent" — it
 *         never reached the gym, which from here is the same kind of loss as a
 *         bar sitting full. It now has its own line instead of being counted
 *         as training.
 *
 *         The page the drop happened on says where the energy went: only
 *         gym.php trains, and cdTimer already polls the bar once a second on
 *         EVERY Torn page, so the attacks were always being watched — they
 *         were just filed wrong. No logs and no extra API calls.
 *
 *         It was worse than a mislabel. finaliseTrain discards a small
 *         observed drop with no stat gain as API skew, but the threshold is
 *         `spent < 25` and a Torn attack costs exactly 25 and grants no stats
 *         — so every attack sailed past and was written into the train log as
 *         a session. A training session is only opened on the gym page now.
 *
 *         Attacking also counts against the usage figure, alongside cap waste,
 *         because a gym ETA built as though that energy had reached the gym is
 *         optimistic on precisely the days you warred hardest.
* 0.9.19 — Steadfast now decides which stat a rotation leg goes to. It is the
 *         faction branch granting gym gains PER STAT — "+ 14% defense gym
 *         gains" against "+ 10% strength" — so the same energy is worth
 *         measurably more in one stat than another. parsePerks already folded
 *         it into state.perks and trainsTo already used it, so the ETAs were
 *         always right; nothing let it choose the ORDER. Now the rotation
 *         leads with the best bonus, ties fall back to shortest-first as
 *         before, and raising a goal by hand still wins — that is a deliberate
 *         act and a perk should not quietly undo it.
 *
 *         The Plan tab gains a "Gym gain bonus" card listing the per-stat
 *         figures with the best marked, because a plan that silently reorders
 *         itself reads as a bug rather than a decision.
* 0.9.18 — Reported: "Spent today 26e, I didn't spend any energy training
 *         today." Correct — nothing had been spent. The bar reports WHOLE
 *         points while the absorbed-regen figure accrues smoothly, so between
 *         two ticks nowE === prevE and `prevE + absorbed - nowE` came out a
 *         fraction above zero and was booked as spend. Every poll, for as long
 *         as the bar climbed, and the tick never cancelled it.
 *
 *         The tell was that the figure depended on how often the panel looked:
 *         19e at 60s polls against 37e at 1s. A real spend does not care.
 *         Invisible on a training day (26e beside 1,500e), glaring on a day
 *         with none — and it inflated the `used` that calibration().usage is
 *         built from, so every ETA was quietly optimistic.
 *
 *         Absorbed regen is now floored, for the same reason missed energy
 *         already was: a third of a point has not arrived yet. Two old tests
 *         asserted the fractional readings (123.33e, 50.33e); they encoded the
 *         behaviour this bug came from, and now expect whole points.
 *
 *         Also: a stack is spotted from the bar itself. A day whose energy
 *         peaked more than 300 above your own cap was holding more than one
 *         Xanax could give it, which only happens deliberately — so cap time
 *         stops counting for that day whether or not the war-stack switch was
 *         ever flipped, and the Missed energy card marks those days and offers
 *         to clear just them. The line sits above one Xanax on a full bar
 *         (max + 250), which is the coach's own daily advice and must not read
 *         as a stack.
* 0.9.17 — Settings gets a "Missed energy" card: the days inside the
 *         calibration window that recorded missed energy, each with a Clear.
 *         Asked for after 0.9.15, which stopped BOOKING war-stack waste but
 *         could do nothing about the days already recorded — those keep
 *         dragging every ETA down until they age out of the window.
 *
 *         Picked by hand, because the ledger stores {day, used, wasted} and has
 *         never recorded WHY a bar sat full, so a war-stack day cannot be told
 *         from a lazy one after the fact.
 *
 *         Reversible on purpose. This is real training history, so a cleared
 *         day keeps its original figure and offers Put back; a second clear
 *         will not overwrite that original with the zero it just wrote. Spend
 *         is never touched — it really did leave the bar, and it is what the
 *         model half of the calibration is measured from. The card shows what
 *         the usage figure would become before anything is removed, and Clear
 *         all reaches only the days listed on screen.
 *
 *         The click router resolves through a closest() whitelist, so the two
 *         new attributes had to be added to it — without that the handlers are
 *         unreachable dead code. Caught by the browser test; every unit test
 *         over them stayed green.
* 0.9.16 — Reported: "I keep getting a notification that my energy is full,
 *         train Strength. My gym plan/goal is Speed." Nothing to change at
 *         the user's end — the notification really was naming the wrong stat.
 *
 *         applyGoalFocus() is what turns a goal into state.focus, and it lived
 *         inside renderPanelInner(), BEHIND its early return on a closed panel.
 *         Notifications are exactly the thing you want while the panel is shut
 *         — tucked away, or on any non-gym page, where ensureUi() closes it —
 *         so on that path the sync never ran and armNotifications() built its
 *         text from the stored focus, which defaults to "str". Panel open, the
 *         ping said Speed; panel tucked, the same account got Strength.
 *
 *         Two fixes, because there were two faults. The sync now runs inside
 *         armNotifications(), where the text is actually built. And the derived
 *         focus is persisted rather than only held in memory — without that,
 *         storage kept saying "str" forever and every cold read started wrong
 *         again. Both are pinned by mutation tests, and by an invariant test
 *         that the ping may never name a stat the plan is not on.
* 0.9.15 — War stack contradicted itself twice, and both cost real energy.
 *
 *         It said "Do not take a Xanax". That is backwards: a stack is built BY
 *         taking them. Each banks 250e above the cap, and above the cap Torn
 *         pauses regen, so a stacked bar bleeds nothing while it waits. Sitting
 *         AT the cap is the only state that does bleed — so the old advice held
 *         you in the one place that loses energy. The verdict now says to take
 *         one when the drug cooldown is clear, you have one, and it will not
 *         spill past the 1,000e ceiling; otherwise it says hold and why. The
 *         Stock tab's Xanax row reads USE while stacking instead of BUY.
 *
 *         And it billed you for obeying. Time at the cap was booked as missed
 *         energy even while the coach was telling you to leave the bar alone.
 *         That waste feeds calibration().usage, which goalPlan() multiplies
 *         into every ETA, so one war dragged the whole plan toward the 0.3
 *         floor and held it there for the fourteen days AFTER the war ended.
 *         Waste is no longer booked while stacking, and the live card reframes
 *         the streak — it still shows how long the bar has been held, which is
 *         the number that matters during a war, just not as a loss.
 *
 *         What did NOT change: the cap time is still subtracted from absorbed
 *         regen when working out what you spent. That regen genuinely never
 *         landed whatever it is called, and handing it back as spend would make
 *         a held-then-dumped bar read as more energy trained than ever left it.
 *         A test pins the spend figure identical with stacking on and off.
* 0.9.14 — A full segment said "Torn should hand it over on your next train".
 *         It will not: once the gym exp is earned the gym is gated on the FEE,
 *         not on more training — the wiki is explicit that you Activate it and
 *         buy the membership. The old line sent you to spend energy on nothing.
* 0.9.13 — "How much energy until the next gym?" Torn has always tracked this
 *         and paints it as a whole-number percentage on gym.php — on the gym
 *         button marked inProgress___, which is easy to miss because it is not
 *         a progress bar, a progressbar role, or any text on the page. Reading
 *         it turns the question into arithmetic, so nothing has to be summed
 *         out of the training logs.
 *
 *         The segment lengths come from the wiki's "Estimate E for next gym"
 *         column. They are PER-SEGMENT — energy trained while AT a gym, not a
 *         lifetime running total. Two things prove it: read cumulatively, the
 *         18,000 -> 18,100 pair would be a 100-energy segment (about ten
 *         trains) between segments of 5,580 and 6,040; and the segments sum to
 *         551,255 energy for George's, about a year at a heavy 1,470e/day,
 *         which is the grind players describe. The cumulative reading puts
 *         George's at ten weeks.
 *
 *         The Music Store's "Well Tuned" perk (+30% gym experience) is applied,
 *         read as a number off the perk line rather than hardcoded. It is kept
 *         strictly apart from the stat multipliers: gym EXP changes when the
 *         next gym arrives and nothing about what a train is worth, and a test
 *         pins that it never leaks into the gain model.
 *
 *         Shown as a range, because a whole-number percent cannot say more than
 *         that. Silent rather than wrong where it has to be: a reading left
 *         over from a gym you have since bought, and the specialist gyms, which
 *         are gated on stat ratios and have no energy answer at all.
* 0.9.12 — 0.9.11 argued with itself: "Bar full. Train Strength at Force
 *         Training" one line above "George\u2019s trains Strength 14% faster
 *         \u2014 switch before you spend this bar". Both true, together
 *         useless. The gym advice was bolted on as a sibling step instead of
 *         changing the advice it contradicted.
 *
 *         One gym per verdict now. When a better gym is available the training
 *         steps name THAT gym, and the switch is the first thing on the card
 *         rather than a footnote under an instruction to stay put. There is a
 *         test for the invariant itself \u2014 the steps card may never mention
 *         two different gyms \u2014 because that is the property that was
 *         broken, and it is cheaper to pin than any particular wording.
* 0.9.11 — The coach reads which gym you are in and has always taken it as
 *         given. It will now tell you when a gym you ALREADY OWN trains your
 *         stat faster for the same energy: Anabolic Anomalies and George\u2019s
 *         are both 10e a train, and George\u2019s returns 46% more. That is not
 *         a trade-off, it is a third of every bar thrown away, and the coach was
 *         cheerfully telling you to spend it.
 *
 *         Same energy per train or cheaper, only. A gym with more dots that also
 *         costs more energy is a real trade \u2014 more per train against fewer
 *         trains \u2014 and the coach does not get to make that call. Balboas
 *         beats George\u2019s on Defense dots and costs 25e against 10e, so it
 *         is never pushed.
 *
 *         Which gyms you own is not in the API \u2014 `user?selections=gym`
 *         returns active_gym and nothing else \u2014 so it is read off gym.php,
 *         the page you are already standing on, at no API cost. Button order is
 *         1:1 with the gym table by index, because Torn spells a few names
 *         differently. Gyms unlock OUT of order, so the actual set is stored
 *         rather than a highest-unlocked mark. A half-rendered list is ignored:
 *         five buttons is React mid-render, not a player who owns five gyms.
 *
 *         And a gym that cannot train the stat at all now names one that can,
 *         instead of leaving you to work it out.
* 0.9.10 — Xanax capped at 3 a day, not 4. 0.9.9 derived four from a nominal
 *         ~6h cooldown; in practice a fourth does not fit, reported from
 *         actually taking them. Three is now both the default and the ceiling.
* 0.9.9 — Three corrections to "Worth it?", all of them things it was stating
 *         confidently and wrongly.
 *
 *         It said "until Strength is done" while quoting a figure that was the
 *         WHOLE schedule \u2014 every goal, not that one. Mine, from 0.9.0,
 *         when the ranking moved to the whole plan and the sentence did not
 *         follow. It names one goal only when there is one, and says "every
 *         goal" otherwise. "over the run" now reads "over the whole plan",
 *         since the old word left it genuinely ambiguous whether a day or the
 *         whole thing was meant.
 *
 *         Xanax was capped at 6 a day. The drug cooldown is about 6h, so four
 *         is the ceiling and the card was pricing a fifth and sixth that no
 *         amount of money can buy \u2014 taking one early is an overdose, not
 *         a faster plan.
 *
 *         And cans were ranked by money, which put a Can of Goose Juice ABOVE a
 *         Red Cow: 8e for $433k is cheaper per energy than 38e for $2.39m. It
 *         is also a quarter of the energy in an identical 2h booster slot, and
 *         once the booster is high that slot is the scarcer currency. Cans now
 *         rank strongest first with money only breaking ties between equals,
 *         they sit as a block below the things that cost money alone, and each
 *         one shows what its slot is worth in energy per booster-hour.
* 0.9.8 — Every can is listed, not only the ones in your bag. Holding one weak
 *         can hid the other eight, and with them the comparison that actually
 *         decides what to buy: a can costs the same 2h of booster cooldown
 *         whatever its strength, so a Damp Valley and a Taurine Elite take the
 *         IDENTICAL slot for 15e against 45e. Twelve slots a day is 180e or
 *         540e depending only on which can fills them, and you could not notice
 *         that about a can you could not see.
 *
 *         Held cans lead the list, then the strongest of the rest, and each row
 *         says which it is. Unheld cans are tickable on purpose \u2014 planning
 *         a purchase is a real use \u2014 and they count toward the projection,
 *         because a tick that did nothing would be a lie in the other
 *         direction. What stops that going quiet is a line under the group
 *         naming the energy your plan is claiming from cans you do not hold.
 *
 *         "Worth it?" picks all nine up as purchase candidates and prices them,
 *         so a can three times the strength for one and a half times the money
 *         climbs the ranking on its own.
 *
 *         This REVERSES 0.7.1, which hid unheld cans so a configured can could
 *         not inflate a projection silently. That risk is real and has not been
 *         waved away \u2014 the safeguard moved from hiding the row to naming
 *         the consequence.
* 0.9.7 — "Train 150e into Strength at Balboas Gym" \u2014 which trains Defense
 *         and Dexterity only. The advice never once looked at whether the gym
 *         you are standing in can train the stat it is telling you to spend a
 *         bar on. Nine of the 31 cannot train something: Balboas has no
 *         Strength or Speed, Legs Bums and Tums no Strength, Beach Bods no
 *         Dexterity, Davies Den no Speed, and the four specialist gyms train
 *         exactly one stat each.
 *
 *         The verdict now says so before any branch that could send you to the
 *         machine, happy jump included, and names what the gym DOES train so
 *         the next move is obvious: move gyms, or switch to one of those.
 *
 *         The projections always knew \u2014 gainOne has returned 0 for a
 *         zero-dot stat since the beginning, and the goal schedule refuses to
 *         build a leg it cannot finish. Only the sentence at the top was
 *         guessing.
* 0.9.6 — Buy a can you owned none of and it stayed invisible until Torn\u2019s
 *         inventory cache expired, minutes later. 0.7.0 added the item-page
 *         scrape for exactly this, and it was already capturing the new can \u2014
 *         nothing read it. freshQty can only CORRECT a row that already exists,
 *         and a can you owned none of has no API row to correct, so the scraped
 *         count had nowhere to land.
 *
 *         The scrape can now ADD a can outright, not just adjust one. Only cans:
 *         it covers the whole item page, and a Xanax count has no business in
 *         the drink list. Still only while the scrape is newer than the API
 *         reading, so Torn takes back over the moment it catches up.
 *
 *         The scrape runs on item.php, so a can bought and never looked at is
 *         still unknown until the API refreshes \u2014 open your items once and
 *         it is picked up immediately.
* 0.9.5 — A bar full for 39 minutes while the app was closed reported "full for
 *         44s" and 0e missed. The script cannot watch a bar it is not running
 *         beside, so the time has to be reconstructed on the way back in — and
 *         three things stopped that working.
 *
 *         It already KNEW when the bar would fill: that instant is what the
 *         "energy full" notification is scheduled from. It was computed, armed
 *         and thrown away. It is kept now, and a bar found full on reopen is
 *         dated from it rather than from the moment the panel happened to look.
 *         Only where the bar demonstrably got there — it ended at the cap, or
 *         ended lower than it started so a spend could have followed — because
 *         a prediction on a bar that merely rose and stopped short was wrong,
 *         and trusting it books waste that never happened.
 *
 *         The regen rate was not persisted. A full bar reports fulltime 0, so a
 *         cold start that opens ON a full bar could never derive the rate and
 *         fell back to Torn\u2019s non-donator base of 180s a point. At a
 *         donator\u2019s 120s that is every inferred fill half again too long,
 *         and it read 13e where the honest answer was 19e.
 *
 *         And a zero-length streak rendered as "Bar has been full for READY",
 *         fmtCd(0) meeting a sentence it was never written for. No streak, no
 *         line.
* 0.9.4 — Spent energy was measured as the drop between two readings, which
 *         loses every point that refilled behind a session. Train the bar away,
 *         come back an hour later, and the hour of regen made the session read
 *         an hour smaller than it was: 150e spent showed as 100e.
 *
 *         It is an energy balance now. Regen that did not land in the bar is
 *         the waste 0.9.2 started counting, so what remains is what the bar
 *         absorbed, and the rest of the balance is what left it. Above the cap
 *         Torn pauses regen entirely, so nothing is absorbed there and banking
 *         keeps the plain reading it always had.
 *
 *         Two consequences worth knowing. A window that ends HIGHER than it
 *         started can still book spending — twenty points arrive, ten are still
 *         in the bar, so ten were spent, where the old rule saw a rise and
 *         recorded nothing. And a can drunk below the cap has to be clamped:
 *         the balance reads it as negative spending, which would quietly
 *         subtract a hundred from the day.
* 0.9.3 — The verdict never mentioned the cans you had already budgeted. At
 *         25/150 with four a day in the plan it said "Nothing. Bar isn\u2019t
 *         full. Xan isn\u2019t ready." and left you waiting four hours for
 *         energy you had decided to buy.
 *
 *         Both waiting branches now lead with the cans instead: what to drink,
 *         what it adds, and how many more trains that is. It counts only cans
 *         you actually hold, and stops at the booster ceiling.
 *
 *         How many is the interesting part. Not the whole day\u2019s budget —
 *         twelve cans at 25/150 would bank most of it above the cap, where
 *         natural regen is paused. It suggests just enough to FILL the bar,
 *         which splits a big budget across the day on its own: twelve a day
 *         comes out as three sessions of four without needing to model a
 *         session at all. The line says which, so "5 of the 12 a day you
 *         budget \u2014 the rest keep for later sessions".
 *
 *         A full bar gets no can advice at all; the answer there is to train.
 *         Holding none of what you budget says exactly that rather than
 *         suggesting a drink you cannot take.
* 0.9.2 — Missed energy read 0 after a full bar had sat for hours. Waste was
 *         only booked when the window ENDED at the cap, so the commonest case
 *         there is went uncounted: the bar sits full, you train, and by the
 *         time the panel looks again it has started refilling \u2014 the
 *         reading is below the cap and every one of those hours was discarded.
 *         Three hours capped then a session read 0 missed; it now reads 310.
 *
 *         The window is accounted as time instead of as a snapshot of where it
 *         ended: climbing to the cap and climbing back after a spend are both
 *         absorbed, and whatever is left over is the bar sitting full with
 *         nowhere to put the regen. The refill leg assumes the spend emptied
 *         the bar \u2014 the most generous reading available \u2014 so the
 *         figure is a floor, never more waste than really happened.
 *
 *         Banking is untouched: above the cap regen is paused on purpose, and
 *         all eight of those cases still book nothing.
* 0.9.1 — The settings wheel had become where the script kept its actual
 *         features. Seven cards behind an icon that reads as "preferences",
 *         and while you were in there no tab was lit, so it did not even look
 *         like a place you could be.
 *
 *         It is split by what the thing IS. Goals, energy sources and playstyle
 *         are what you DECIDE, and they move every projection in the script, so
 *         they are a visible Plan tab now, alongside Calibration and Worth it?.
 *         An API key and a raw perk dump are what you configure once; only
 *         those stay behind the cog.
 *
 *         A tab still needs a reason to be tapped, so the Now page carries one
 *         line saying what the plan is \u2014 "Defense \u2192 150,000,000 \u00b7
 *         switch in 5 days \u00b7 all goals 9.7 months" \u2014 which taps
 *         through to it. With nothing set it reads "No goals set \u2014 tap to
 *         plan your route", so the feature announces itself instead of waiting
 *         to be found.
 *
 *         The tab bar was a hardcoded three-column grid; a fourth tab wrapped
 *         into a clipped second row rather than fitting. It is four columns now
 *         and holds one row down to 360px.
* 0.9.0 — Goals rotate, and you can say what comes first.
 *
 *         Setting a goal used to take the choice away: the plan ran one whole
 *         stat at a time, shortest first, and the manual pickers disappeared.
 *         With three 1b goals that means one stat climbing for six months while
 *         the other two sit still. Now an increment can be set \u2014 50m, 100m,
 *         250m or 500m \u2014 and each stat climbs to the next milestone in
 *         turn, so they rise together. A stat that is behind catches up on its
 *         own first: at 105m against 150m it takes one leg by itself, then all
 *         three rotate.
 *
 *         Rotation is free. A stat\u2019s gains depend only on its own value,
 *         so interleaving cannot change any stat\u2019s total training time \u2014
 *         you are choosing what stays balanced along the way, not paying for
 *         it. Making that true in the code meant counting TRAINS and dividing
 *         once at the end. The old maths walked whole days and rounded up at
 *         the end of every goal; with three goals that was invisible, but at
 *         50m increments it is 52 legs, and it would have reported 24 days of
 *         cost against a true cost of about 0.1.
 *
 *         The \u25b2 on each goal moves that stat earlier in the order, and the
 *         list is drawn in the order it will be trained so the move is visible.
 *         Untouched, the order is still shortest-first. The Trend chart draws
 *         the same schedule as a staircase, and "Worth it?" ranks purchases
 *         against the whole schedule rather than whichever leg is in progress
 *         \u2014 pricing cans against a ten-day milestone read as nonsense.
* 0.8.1 — 149/150 read "capped \u00b7 regen paused, spend it", drew a full red
 *         bar, and told you to train immediately. None of that was true: regen
 *         was still running, and at 10e a train 149e is fourteen trains where
 *         150e is fifteen \u2014 so the advice was to throw a train away for
 *         the sake of thirty seconds. The cause was two points of slack in the
 *         definition of "full", inherited from the stable script and never
 *         explained, copied into six places. There is now one definition: full
 *         means at or above YOUR maximum. Below it you get "full in 30s" and
 *         are told to wait; the energy-full ping is armed again for the last
 *         two points, where it used to be silently skipped.
* 0.8.0 — Projections correct themselves against what actually happened, and a
 *         "Worth it?" card ranks money against time.
 *
 *         Calibration keeps two figures apart rather than blending them. The
 *         GAIN MODEL is what you really gained divided by what the model
 *         predicted for the energy you really spent \u2014 does the arithmetic
 *         hold? USAGE is the energy that reached the gym as a share of the
 *         energy that passed through your bar \u2014 do you actually spend it?
 *         Goal ETAs multiply by both, so a bar left sitting full now shows up
 *         as days added to the goal instead of a number with no consequence.
 *         Measured over the last 14 complete days, using only days where a
 *         single stat moved; below seven such days it stays out of the way and
 *         says so. Usage is measured against energy you HAD, never against the
 *         size of your plan \u2014 measuring against the plan would drop usage
 *         by exactly the amount any new source added, so every "what if I
 *         bought this" answer came back as no change at all.
 *
 *         Worth it? asks what one more a day would buy you, for the goal you
 *         are training now. Prices are the cheapest live bazaar or item-market
 *         listing, so the ranking is by cost per day saved rather than by
 *         sticker price. A source too small to matter one at a time is quoted
 *         at the smallest count that does move the date, rather than silently
 *         vanishing. Refills are bought with points and Mc Smoogle is capital
 *         you keep, so neither is ranked as spend; Mc Smoogle gets its own line
 *         and its own smallest-number-of-increments answer.
 *
 *         Prices come from weav3r.dev, which mirrors both halves of the item
 *         market in one unauthenticated call, so this costs nothing from the
 *         100-a-minute key budget. What leaves the browser is an item ID. If
 *         that host is unreachable, Torn\u2019s own item market is tried next
 *         \u2014 one API call, and the bazaar half is lost.
* 0.7.2 — The booster meter said "room for 0 more cans" at 46h 42m of a 48h
 *         cap. Torn only requires you to be UNDER the cap to drink, so a can
 *         can carry you past it \u2014 the headroom is rounded up now, not down.
 * 0.7.1 — The can list under Energy sources shows only cans you actually hold,
 *         read from your inventory rather than a fixed set of staples. A can
 *         you have already configured stays listed even at zero, so a setting
 *         cannot disappear and quietly change the projection.
 * 0.7.0 — Reads item counts from the item page instead of waiting on the API,
 *         which Torn caches for minutes \u2014 drink a can and the old number
 *         lingered. Visiting the item page now records what is actually there,
 *         and those counts are used while they are newer than the API reading,
 *         which takes over again once Torn catches up.
 * 0.6.1 — Sessions logged the energy spent but no stat gain. Energy moves the
 *         instant you train, while Torn caches battle stats for up to about
 *         thirty seconds \u2014 and the entry was written two seconds later, so
 *         the stats had not moved yet and every gain read as nothing. It now
 *         waits for the stats to actually change before writing, and records
 *         the session without a gain rather than losing it if they never do.
 * 0.6.0 — Whole training sessions were missing from the log. It was driven by
 *         comparing energy between API polls, but the page updates energy live
 *         every second, so the drop was absorbed before a payload arrived and
 *         nothing was recorded \u2014 which is why "Spent today" was right while
 *         the log stayed empty. The log is now driven by the same observation
 *         the ledger uses, so it catches training started any way at all, not
 *         only a click the script recognises. An observed drop still has to be
 *         backed by a real stat gain before it becomes an entry.
 * 0.5.6 — Mc Smoogle Corp added as an energy source: 100 energy every 7 days
 *         per increment, so about 14 a day each. Counted in increments rather
 *         than shares, because the share threshold moves with the price. Torn
 *         does not expose stock benefits through the perks API, so this cannot
 *         be detected \u2014 tick it and set how many increments you hold. The
 *         daily total also sums whatever sources exist now rather than a fixed
 *         list, which had silently excluded anything added later.
 * 0.5.5 — Phantom "Trained 5e" entries. There are two train loggers and 0.3.3
 *         only fixed one: a second, poll-driven logger compared energy between
 *         API readings, but energy is updated live from the page while the API
 *         lags, so a stale poll a few points lower looked like a small session.
 *         It now requires the stat to have actually gone up \u2014 a real train
 *         always raises the stat, a stale reading does not \u2014 stands down
 *         while a click-driven train is being measured, and attributes the gain
 *         to the stat that moved instead of the total of all four, which is
 *         where "+1,685,994,823" for a 250e session came from.
 * 0.5.4 — Restores WAIT_FULL_MAX, a constant an earlier edit deleted. Four
 *         places used it, so the panel threw and drew nothing as soon as the
 *         coach reached a "wait for a full bar" branch. node --check cannot see
 *         a missing variable, so the build now scans for identifiers that are
 *         used but never declared.
 * 0.5.3 — A failure while drawing the panel used to leave an empty box: the
 *         element exists and is styled, so it looks like the script is fine and
 *         has nothing to say. The draw is wrapped now, and a failure shows the
 *         message and stack in the panel itself, with a retry button.
 * 0.5.2 — Set gains a "Perks Torn sent" card listing every perk line from all
 *         nine sources, ticking the ones the script is actually using. A perk
 *         it ignores can then be named rather than guessed at \u2014 which is
 *         what it took to work out that education perks omit the word "gym".
 * 0.5.1 — Off the Now tab, the verdict and energy meter collapse into a single
 *         tappable line, giving Stock and Trend roughly a third more room. The
 *         line still carries the verdict and your energy, and tapping it goes
 *         back to Now.
 * 0.5.0 — Goals. Set a target on any stat — type a number or shorthand like
 *         150m — and the coach works out how long each takes at your energy,
 *         gym, happy and perks, then trains them one at a time. Shortest goal
 *         first: the total is the same whatever the order, so this finishes
 *         something soonest. The Trend chart becomes the schedule, each stat
 *         climbing only in its own window and flattening at its target before
 *         the next one starts. The manual priority and second-skill pickers are
 *         still there, and take over whenever no goal is set.
 * 0.4.0 — The projection chart showed all four stats climbing, including ones
 *         you never train. It was drawing four separate "what if all your
 *         energy went here" lines, which reads as a forecast. Only the stat you
 *         train grows now; the rest stay flat. Gym perks from education,
 *         property, merit, stock and enhancers were also being dropped whenever
 *         the perk text did not contain the word "gym" — education perks
 *         usually read "+ 1%% strength gain" — so the filter is widened,
 *         with drink, happy, nerve and crime perks explicitly excluded. The
 *         perks card now lists every source that contributed and the exact line
 *         it counted, so a multiplier that looks wrong can be traced.
 * 0.3.10 — Missed energy is floored rather than rounded. Regen arrives in whole
 *          points, so half a point at the cap has cost you nothing yet, and
 *          rounding meant ninety seconds at a full bar reported "1 missed" \u2014
 *          which reads as a mistake you did not make. The fraction is still
 *          accumulated, it is just not claimed until a whole point is gone.
 * 0.3.9 — Banking energy above the cap is no longer counted as missed. Regen
 *         does pause above the cap, and the old rule counted that as waste \u2014
 *         so drinking ten cans past 150 booked the whole stockpiling session,
 *         and every hour spent working through banked energy, as energy you had
 *         let slip. Missed now means only what it should: the bar sat AT the
 *         cap and regen fell on the floor.
 * 0.3.8 — The booster cooldown has left the 12-hour rail and has its own meter.
 *         A 28h cooldown filled a 12h rail completely and read as "maxed" when
 *         it was little over half of a 48h ceiling. The rail is a time window,
 *         and the booster is not a wait but a budget with a cap, so it now
 *         shows how much of the ceiling is used and how many more cans fit
 *         under it. Also ports the Caffeine Consumption event from the Drink
 *         Gains script: while it runs, every can is worth double, read from
 *         Torn\u2019s calendar and cached for 12 hours.
 * 0.3.7 — Every can now has its real value, taken from the Drink Gains script
 *         (torn-can-energy 1.2.2) rather than guessed: Goose Juice 5, Damp
 *         Valley 10, Crocozade 15, Munster and Santa Shooters 20, Red Cow and
 *         Rockstar Rudolph 25, Taurine Elite and X-MASS 30 — matched on
 *         item id first, since names drift with events. Values are also
 *         perk-adjusted: books and faction, job or company perks that raise
 *         energy-drink or consumable gain are read from your perks and applied,
 *         so what is shown is what YOU get, and the projections follow. The
 *         source filters now list the cans you actually hold, so a seasonal can
 *         can be ticked instead of being unrepresentable.
 * 0.3.6 — Energy drinks are their own section rather than a sub-list tucked
 *         under an unrelated row, and the rows finally have styles: five CSS
 *         blocks added in earlier versions never actually landed (the string
 *         they anchored to did not exist, and only the markup edit beside them
 *         was asserted), so the drink rows and the Set-pane tick boxes were
 *         rendering unstyled. The tick box also shared a class name with the
 *         energy bar's 1px tick marks and was being styled as one.
 * 0.3.5 — The energy-drink line expands into the cans you actually hold, each
 *         with its own USE button, strongest first. Munster, Red Cow and
 *         Taurine show their energy; anything else is listed by name and count
 *         rather than assigned a figure that would be a guess. Also: the
 *         booster ceiling is no longer hardcoded to 24h. The faction perk
 *         raises it to 48h, detected from your perks and also inferred from
 *         the bar itself \u2014 a cooldown above 24h cannot exist without the
 *         perk, so seeing one proves it. Before this the coach told you to
 *         hold cans you could still use.
 * 0.3.4 — "Spent today" was losing nearly everything. The ledger only wrote
 *         itself to storage after 20 credited events, but a whole training
 *         session credits exactly ONCE — so every session was discarded when
 *         the page navigated, and the figure was whatever single window
 *         happened to survive. Spending is now written through immediately,
 *         the rest flushes on a 15-second clock instead of a counter, and the
 *         ledger is saved on pagehide and when the tab is hidden.
 * 0.3.3 — The train log reported the wrong number. It printed state.energy at
 *         the moment of the click — your remaining balance — labelled as if it
 *         were what the session cost, so a 150e session showed "150e" only by
 *         coincidence and a click on an empty bar logged "0e". It now records
 *         the energy actually spent and the stat actually gained, measured
 *         after the refresh, and a click that trained nothing writes no line.
 * 0.3.2 — War stack and the 10-star bonus switched themselves ON at every
 *         reload: Torn PDA returns stored values as STRINGS, and !!"false" is
 *         true. Booleans are now parsed rather than coerced, which also fixes
 *         the panel ignoring whether you had tucked it away. The 10-star Adult
 *         Novelties switch is gone \u2014 it is read from your perks and listed
 *         with the faction and company lines under Gym perks. Energy sources
 *         became tick boxes, with each can listed separately because Munster,
 *         Red Cow and Taurine are +20, +25 and +30. And a plain-English pass
 *         over the coach: no more "CD pops" or "dump Strength" \u2014 it says
 *         "cooldown reaches 0" and "train Strength".
 * 0.3.1 — Fixes waking up to a full bar and being told it had been full for a
 *         second. At boot state.energy is 0 meaning "not read yet", not "empty",
 *         but the ledger tick ran anyway: it cleared the overnight cap streak
 *         and booked a phantom spend of the whole bar. The ledger now waits for
 *         a real reading from the API or the page. The streak also falls back to
 *         the last stored reading when it was already full, so an upgrade or a
 *         cold start still reports the hours rather than starting from zero.
 * 0.3.0 — Two changes. The floating badge is gone: it duplicated the in-gym
 *         "GYM COACH" button and sat over Torn's chrome, so the panel now
 *         opens from the gym page only. And the script keeps an energy ledger
 *         \u2014 what you spent against what your bar dropped while already full.
 *         Waste is worked out by comparing two observations rather than by
 *         running a timer, so eight hours asleep on a full bar is counted, not
 *         missed. The Now tab shows the live figure ("full for 2h 04m, that is
 *         41e you did not get"); the Trend tab charts spent vs missed per day.
 * 0.2.5 — Badge is circular, and the three tab blocks became one segmented
 *         control: a single bordered track with the selected tab as an amber
 *         pill inside it. Reads as one switch rather than three buttons
 *         competing for attention, and gives the amber back to the verdict.
 * 0.2.4 — THE FIX for the script never running under Torn PDA. Line 903 held
 *         a curly apostrophe inside a SINGLE-quoted string:
 *         return \'<span class="chip bad">DON\u2019T</span>\';
 *         GMforPDA normalises typographic quotes to straight ASCII when it
 *         processes the source, which closed the string at DON\' and left T as
 *         a stray token: "SyntaxError: Unexpected identifier \'T\'. Expected a
 *         \';\' following a return statement." The file never parsed, so nothing
 *         ran at all — no button, no error anywhere visible. Only PDA rewrites
 *         the source, hence it worked in Safari and Tampermonkey. All curly
 *         quotes in code are now \\u escapes, so no quote character exists in
 *         the source to normalise. Caught by gym-diag, which registered an
 *         error handler and reported the exception off the device.
 * 0.2.3 — Reverts the @grant unsafeWindow added in the previous version. It was
 *         a guess, and bisection probes carrying it stopped running under PDA
 *         entirely, while the same header without it runs. The body references
 *         unsafeWindow only behind typeof guards, so the grant bought nothing.
 * 0.2.2 — REVERTED in the next version: declared @grant unsafeWindow. The body references unsafeWindow five
 *         times (guarded PDA-detection fallbacks) but the header never granted
 *         it. Torn PDA would not run the file at all in that state — no button,
 *         no error, dead before the first statement — while Safari and
 *         Tampermonkey ran it fine. FactionOps uses unsafeWindow and grants it,
 *         and works under PDA; that was the difference.
 * 0.2.1 — Fixes the script never running under Torn PDA at all. The file
 *         carried the API-key placeholder TWICE: the real one, and a decoy
 *         split across two string literals on the line above, used to detect
 *         whether PDA had substituted a key. PDA rewrites that placeholder by
 *         matching the source text before it injects, and a greedy match spans
 *         from the decoy to the real one, deleting the code between and leaving
 *         an unbalanced bracket. The file then fails to parse, so nothing runs:
 *         no button, no error, nothing in the console. Only PDA rewrites the
 *         source, which is why it worked in Safari and Tampermonkey. There is
 *         now exactly one placeholder, single-quoted, as in the scripts known
 *         to work under PDA; substitution is detected from the value itself.
 * 0.2.0 — Badge code rewritten. It is a real <button> styled by one
 *         setAttribute call instead of a <div> with twenty-one
 *         style.setProperty calls — a rejected value used to leave it
 *         half-styled with no error. Taps go through the browser's own click
 *         handling, so the touchend dedupe that could swallow the first tap is
 *         gone. Mounting now re-checks for ~20 seconds instead of stopping at
 *         the first success, so a late gym render still gets a badge.
 * 0.1.10 — Removed the diagnostic beacon and its @connect entry. It reported
 *          version and mount state to tornwar.com to work out why the script
 *          was not running; the script makes no request anywhere but the Torn
 *          API now.
 * 0.1.9 — @updateURL pointed at the .meta.js, which is 950 bytes of pure
 *         comments. A runtime that installs whatever @updateURL returns as the
 *         script body — Torn PDA behaves this way, and warboard-iOS did the
 *         same until 0.11.223 — ends up with an inert script that still lists
 *         the right version. No badge, no error, nothing. It now points at the
 *         .user.js, which is what the upstream PDA build always did.
 * 0.1.8 — Temporary boot beacon, to tell "not installed" apart from "installed
 *         but old" apart from "running and invisible" \u2014 they look the same
 *         from outside. Reports version, path and capability flags only.
 * 0.1.7 — The beta was invisible on PDA whenever the stable script was also
 *         installed, in two ways. The badge on PDA next to the stable script. Both
 *         pin themselves with !important to the same corner at the same size in
 *         the same green reading "GYM", so they overlapped exactly and only the
 *         top one could be tapped. The beta badge now sits a badge-height above,
 *         is amber, and reads BETA; the in-gym dock button is likewise labelled
 *         and coloured apart. Both panels also claim the maximum z-index, so
 *         the beta now re-appends itself when opened, which is the only way to
 *         come in front of a panel that cannot be outranked.
 * 0.1.6 — Centred the owner line.
 * 0.1.5 — Owner line is just the name and ID now; the licence sentence and the
 *         built-for credit live in the script header, which is where anyone
 *         checking provenance looks anyway.
 * 0.1.4 — Dropped the footer. Its Tuck Away button duplicated the header\u2019s
 *         minimise and its timestamp duplicated the header\u2019s, so it was ~57px
 *         of the scrolling area spent on nothing. The header timestamp now
 *         carries the .gc-ago hook so the once-a-second ticker keeps it live.
 * 0.1.3 — Energy read wrong once you banked past the cap. The meter clamped
 *         to the maximum, so a real 194/150 showed as 150/150 and the train
 *         count lost four goes; it now shows the true figure with the overflow
 *         drawn past a cap marker. "Full in" was also stale: the API's fulltime
 *         is measured at the energy it was polled at and never ticked down, so
 *         after a xanax it counted toward a level already passed. It is now a
 *         per-point rate derived from that same payload, applied to live energy,
 *         and it reads zero at or above the cap.
 * 0.1.2 — The tab buttons sat on a dark plate: the stable stylesheet paints
 *         .tabs itself, and the beta override only replaced its layout. Reset
 *         its background, radius and margin. The scrolling area was also being
 *         starved by the pinned header — the 12-hour rail moved into the Now
 *         tab (it is Now information, and it cost ~90px on tabs it says nothing
 *         about), the verdict and meters tightened, and the panel grew to 92dvh.
 *         The content area went from about an eighth of the panel to nearly half.
 * 0.1.1 — Seeds history and coach settings from the stable script on first
 *         run, so Trend is not blank beside a stable copy holding weeks of it.
 *         Renamed the in-gym dock button and the DOM-observer flag, which both
 *         scripts were still fighting over.
 * 0.1.0 — First beta of the redesigned overlay, forked from stable 0.10.7.
 *         The verdict is a header, not a tab: what to do next, why, and the
 *         energy and cooldown state behind it are all above the tab bar. Six
 *         tabs became three — Now (steps, live stats, perks), Stock (items),
 *         Trend (chart, projection, log) — with settings behind the cog. Adds
 *         an energy bar ticked per train and a 12-hour cooldown rail. Reads
 *         the stable script's saved API key but never writes to its settings.
 */

(function () {
  "use strict";

  var PILL_ID = "gcb-pill";
  var PANEL_ID = "gcb-panel";
  var STYLE_ID = "gcb-style";

  // The floating badge is gone (0.3.0). It duplicated the in-gym "GYM COACH"
  // button, and a circle pinned over Torn's own chrome is in the way far more
  // often than it is wanted. The panel opens from the gym page button only.
  // These are kept as no-ops so the call sites that re-pin a badge do nothing
  // rather than throw.
  function pinFab() {}
  function mountFabNow() { return true; }

  var OWNER_TAG = "rcexyz [2598755]";
  var OWNER_ASCII =
    "█▀█ █▀▀ █▀▀ ▀▄▀ █ █ ▀▀█\n" +
    "█▀▄ █   █▀▀  █  ▀▄▀  █ \n" +
    "█ █ █▄▄ █▄▄ ▄▀▄  █  █▄▄";

  var OWNER_NOTICE =
    "Free for everyone. Built for rcexyz [2598755] by AaronPMC [4431836].";

  // The stable script opens with ASCII art roughly 150px tall. In a layout
  // whose whole point is that the verdict is the first thing you see, that is
  // the most expensive space on the panel. The credit stays; the art goes.
  function ownerBannerHtml() {
    return '<div class="gcb-own">' + OWNER_TAG + "</div>";
  }

  var NS = "gcb_v1";
  var STABLE_NS = "gc_v1"; // read-only fallback so the beta inherits the saved key
  var GC_VERSION = "0.9.44";
  var COMMENT = "GymCoach-AaronPMC";

  // Exactly ONE occurrence of the placeholder in this file, single-quoted, the
  // way the scripts that work under Torn PDA write it. The previous version
  // built a decoy by joining two halves of the token on the line above, to
  // detect whether PDA had substituted a key. That gave the file a second,
  // split occurrence — and PDA rewrites the placeholder by matching the
  // source text, so a greedy match runs from the decoy's opening to the real
  // one's close and deletes everything between, leaving unbalanced brackets.
  // The file then fails to parse and the script never runs at all: no button,
  // no error. Detect substitution from the value itself instead.
  var PDA_INJECTED_KEY = '###PDA-APIKEY###';
  var HAS_PDA_KEY = PDA_INJECTED_KEY.indexOf("##") === -1 && PDA_INJECTED_KEY.length > 8;

  var GYMS = [
    { Gym: "Premier Fitness", Energy: 5, Str: 2, Spe: 2, Def: 2, Dex: 2 },
    { Gym: "Average Joes", Energy: 5, Str: 2.4, Spe: 2.4, Def: 2.8, Dex: 2.4 },
    { Gym: "Woody's Workout", Energy: 5, Str: 2.8, Spe: 3.2, Def: 3, Dex: 2.8 },
    { Gym: "Beach Bods", Energy: 5, Str: 3.2, Spe: 3.2, Def: 3.2, Dex: 0 },
    { Gym: "Silver Gym", Energy: 5, Str: 3.4, Spe: 3.6, Def: 3.4, Dex: 3.2 },
    { Gym: "Pour Femme", Energy: 5, Str: 3.4, Spe: 3.6, Def: 3.6, Dex: 3.8 },
    { Gym: "Davies Den", Energy: 5, Str: 3.7, Spe: 0, Def: 3.7, Dex: 3.7 },
    { Gym: "Global Gym", Energy: 5, Str: 4, Spe: 4, Def: 4, Dex: 4 },
    { Gym: "Knuckle Heads", Energy: 10, Str: 4.8, Spe: 4.4, Def: 4, Dex: 4.2 },
    { Gym: "Pioneer Fitness", Energy: 10, Str: 4.4, Spe: 4.6, Def: 4.8, Dex: 4.4 },
    { Gym: "Anabolic Anomalies", Energy: 10, Str: 5, Spe: 4.6, Def: 5.2, Dex: 4.6 },
    { Gym: "Core", Energy: 10, Str: 5, Spe: 5.2, Def: 5, Dex: 5 },
    { Gym: "Racing Fitness", Energy: 10, Str: 5, Spe: 5.4, Def: 4.8, Dex: 5.2 },
    { Gym: "Complete Cardio", Energy: 10, Str: 5.5, Spe: 5.8, Def: 5.5, Dex: 5.2 },
    { Gym: "Legs Bums and Tums", Energy: 10, Str: 0, Spe: 5.6, Def: 5.6, Dex: 5.8 },
    { Gym: "Deep Burn", Energy: 10, Str: 6, Spe: 6, Def: 6, Dex: 6 },
    { Gym: "Apollo Gym", Energy: 10, Str: 6, Spe: 6.2, Def: 6.4, Dex: 6.2 },
    { Gym: "Gun Shop", Energy: 10, Str: 6.6, Spe: 6.4, Def: 6.2, Dex: 6.2 },
    { Gym: "Force Training", Energy: 10, Str: 6.4, Spe: 6.6, Def: 6.4, Dex: 6.8 },
    { Gym: "Cha Cha's", Energy: 10, Str: 6.4, Spe: 6.4, Def: 6.8, Dex: 7 },
    { Gym: "Atlas", Energy: 10, Str: 7, Spe: 6.4, Def: 6.4, Dex: 6.6 },
    { Gym: "Last Round", Energy: 10, Str: 6.8, Spe: 6.6, Def: 7, Dex: 6.6 },
    { Gym: "The Edge", Energy: 10, Str: 6.8, Spe: 7, Def: 7, Dex: 6.8 },
    { Gym: "George's", Energy: 10, Str: 7.3, Spe: 7.3, Def: 7.3, Dex: 7.3 },
    { Gym: "Balboas Gym", Energy: 25, Str: 0, Spe: 0, Def: 7.5, Dex: 7.5 },
    { Gym: "Frontline Fitness", Energy: 25, Str: 7.5, Spe: 7.5, Def: 0, Dex: 0 },
    { Gym: "Gym 3000", Energy: 50, Str: 8, Spe: 0, Def: 0, Dex: 0 },
    { Gym: "Mr. Isoyamas", Energy: 50, Str: 0, Spe: 0, Def: 8, Dex: 0 },
    { Gym: "Total Rebound", Energy: 50, Str: 0, Spe: 8, Def: 0, Dex: 0 },
    { Gym: "Elites", Energy: 50, Str: 0, Spe: 0, Def: 0, Dex: 8 },
    { Gym: "Sports Science Lab", Energy: 25, Str: 9, Spe: 9, Def: 9, Dex: 9 },
  ];

  // Energy trained WHILE AT a gym before the next one unlocks. Index i is the
  // segment that ends by unlocking Torn gym i+2, so the segment leading to gym
  // G is GYM_SEGMENT_E[G - 2] — there is no segment leading to gym 1, and the
  // specialist gyms (25+) are not on this ladder at all.
  //
  // These are PER-SEGMENT, not a cumulative running total. Two things say so.
  // Read cumulatively, 18,000 -> 18,100 would be a 100-energy segment (about
  // ten trains) sitting between segments of 5,580 and 6,040. And the segments
  // sum to 551,255 energy to reach George's — roughly a year at a heavy
  // 1,470e/day, which is the grind players actually describe; the cumulative
  // reading would make it 106,305, about ten weeks.
  //
  // Source: wiki.torn.com/wiki/Gym, column "Estimate E for next gym". The same
  // 23 values ship in TornTools (gym-progress) and in Qaim [2370947]'s
  // Torn Gym Energy Calculator (MIT).
  var GYM_SEGMENT_E = [
    200, 500, 1000, 2000, 2750, 3000, 3500, 4000, 6000, 7000, 8000, 11000,
    12420, 18000, 18100, 24140, 31260, 36610, 46640, 56520, 67775, 84535,
    106305,
  ];

  var ITEM_MAP = [
    { key: "xanax", test: /xanax/i, cat: "Drug" },
    { key: "lsd", test: /^lsd$/i, cat: "Drug" },
    { key: "ecstasy", test: /ecstasy/i, cat: "Drug" },
    { key: "vicodin", test: /vicodin/i, cat: "Drug" },
    { key: "munster", test: /munster/i, cat: "Energy Drink" },
    { key: "redcow", test: /red cow/i, cat: "Energy Drink" },
    { key: "tourine", test: /tourine|taurine elite/i, cat: "Energy Drink" },
    { key: "cans", test: /can of |bottle of pumpkin|bottle of kandy|bottle of christmas|santa shooters|rockstar rudolph|x-mass/i, cat: "Energy Drink" },
    { key: "fhc", test: /feathery hotel/i },
    { key: "edvd", test: /erotic dvd/i },
    { key: "nandrolone", test: /nandrolone/i },
  ];
  var HAPPY_CANDY =
    /lollipop|bon\s?bon|chocolate|cupcake|pixie|jawbreaker|cotton candy|revels|mints|sweets|toffee|caramel|gingerbread|stollen|easter egg|chocolate egg|honeycomb|doughnut|donut|cookie|brownie|fudge|marshmallow|ice cream|candy apple|candy corn|truffle|praline|macaron|birthday cake|wedding cake|pumpkin pie|humbug|sherbet|tootsie|kisses|sweet hearts|reindeer dropping|bloody eyeball|gobstopper|nougat|liquorice|licorice|wine gum|cola bottle|bubblegum|popcorn|popsicle|sundae|muffin|waffle|pancake|parfait|cheesecake|candy cane|candy/i;
  // Lifted from the Drink Gains script (torn-can-energy 1.2.2), which already
  // carries a verified table by item id and name. Matching on the id first
  // because names drift with events; the pattern is the fallback.
  var CAN_TYPES = [
    { k: "goose",   ids: [985], test: /goose juice/i,          label: "Can of Goose Juice",      e: 5 },
    { k: "damp",    ids: [986], test: /damp valley/i,          label: "Can of Damp Valley",      e: 10 },
    { k: "croco",   ids: [987], test: /crocozade/i,            label: "Can of Crocozade",        e: 15 },
    { k: "munster", ids: [530], test: /munster/i,              label: "Can of Munster",          e: 20 },
    { k: "santa",   ids: [553], test: /santa shooters/i,       label: "Can of Santa Shooters",   e: 20 },
    { k: "redcow",  ids: [532], test: /red cow/i,              label: "Can of Red Cow",          e: 25 },
    { k: "rudolph", ids: [554], test: /rockstar rudolph/i,     label: "Can of Rockstar Rudolph", e: 25 },
    { k: "tourine", ids: [533], test: /taurine elite|tourine/i, label: "Can of Taurine Elite",   e: 30 },
    { k: "xmass",   ids: [555], test: /x-?mass/i,              label: "Can of X-MASS",           e: 30 }
  ];
  var CLASSIC_CANS = { munster: 1, redcow: 1, tourine: 1 };

  function canType(name, id) {
    var n = String(name || "");
    for (var i = 0; i < CAN_TYPES.length; i++) {
      if (id && CAN_TYPES[i].ids.indexOf(Number(id)) !== -1) return CAN_TYPES[i];
    }
    for (var j = 0; j < CAN_TYPES.length; j++) {
      if (CAN_TYPES[j].test.test(n)) return CAN_TYPES[j];
    }
    return null;
  }

  // Caffeine Consumption doubles every can for its duration. Ported from the
  // Drink Gains script, window and all: Torn's calendar gives whole-day
  // boundaries, so a day of slack either side matches how the event actually
  // runs rather than cutting out at midnight UTC.
  var CAL_TTL = 12 * 3600 * 1000;

  function eventActive(events, matcher, now) {
    var ev = null;
    (events || []).forEach(function (e) { if (!ev && matcher(e)) ev = e; });
    if (!ev) return false;
    var start = ev.start * 1000 - 86400000;
    var end = ev.end * 1000 + 86400000;
    return now > start && now < end;
  }

  function caffeineOn() {
    return eventActive(state.calEvents, function (e) {
      return /^caffeinecon/i.test(String((e && e.title) || "").trim());
    }, Date.now());
  }

  // Perk-adjusted and event-adjusted, so what is shown is what YOU get now.
  function canEnergy(t) {
    if (!t || !t.e) return 0;
    var mult = state.canMult > 0 ? state.canMult : 1;
    return Math.round(t.e * mult) * (caffeineOn() ? 2 : 1);
  }

  function refreshCalendar() {
    var key = resolveKey();
    if (!key) return;
    if (Date.now() - (state.calAt || 0) < CAL_TTL) return;
    state.calAt = Date.now();
    storeSet("calAt", state.calAt);
    httpGet("https://api.torn.com/v2/torn?selections=calendar&key=" + encodeURIComponent(key))
      .then(function (d) {
        if (!d || d.error) return;
        var cal = d.calendar;
        var events = cal && Array.isArray(cal.events) ? cal.events : [];
        state.calEvents = events;
        storeSet("calEvents", events);
        renderPanel();
      })
      ["catch"](function () {});
  }

  function drinkEnergy(name, id) {
    var t = canType(name, id);
    return t ? canEnergy(t) : 0; // still unknown: show the name, claim nothing
  }

  var FALLBACK_IDS = { xanax: 206, ecstasy: 197, edvd: 366, lsd: 199, munster: 530, redcow: 532, tourine: 533, fhc: 367, vicodin: 205 };
  var H = 3600;
  var M = 60;
  var BOOSTER_CAP = 24 * H;
  // Ceiling a war stack is built up to; Xanax past it spills.
  // What one attack takes off the bar. Torn charges this flat, which is what
  // makes an off-gym drop identifiable without asking the API anything.
  var ATTACK_ENERGY = 25;

  var STACK_CAP = 1000;
  // How far above your own cap a day has to peak before it reads as a stack
  // rather than the ordinary Xanax loop. One Xanax on a full bar reaches
  // max + 250 -- which is the coach's own daily advice -- and a few cans on
  // top drift it a little further, so the line sits above both. Past it you
  // were holding more than a single Xanax could give you, which only happens
  // deliberately.
  var STACK_PEAK_OVER = 300;

  // How long the bar may sit at the cap before the banner first interrupts
  // you: ten minutes is roughly a forum thread, and at the cap that is
  // 200-odd energy already gone.
  var FULLBAR_NAG_MS = 600000;
  // What "Got it" buys. Deliberately much shorter than the first wait -- by
  // the time you are dismissing it you have already been told, so the useful
  // behaviour is a short leash rather than a long silence. Set by the user,
  // who wanted it back every two minutes until the bar is actually spent.
  var FULLBAR_SNOOZE_MS = 120000;

  // A point refill sets the bar to MAX, so its value is the room you have
  // free. Suggesting one at 125/150 buys 25e and burns the day's refill, so
  // the reminder waits until most of a bar is actually going spare.
  var REFILL_WORTH_PCT = 0.25;

  // Mc Smoogle Corp, probed live 2026-08-30: stock id 29, benefit "100 energy",
  // 350,000 shares an increment, claimable every 7 days.
  //
  // The id is pinned rather than discovered. Discovery would mean matching the
  // benefit description, and that is genuinely ambiguous: MUN (24) reads
  // "1x Six-Pack of Energy Drink", which also says energy but pays an ITEM.
  // Picking the wrong one would report someone else's stock as your energy.
  // A pinned id can only ever fail silent, which is the safe direction.
  var MCS_STOCK_ID = 29;
  var MCS_ENERGY = 100;

  var BOOSTER_CAP_PERK = 48 * H;

  // The faction perk lifts the booster ceiling from 24h to 48h, and the script
  // was capping everyone at 24 — telling you to hold cans you could still use.
  // Detected two ways, because neither alone is reliable: from the perk text,
  // and from the bar itself. A cooldown above 24h cannot exist without the
  // perk, so observing one proves it, whatever the perk happens to be called.
  function boosterCap() {
    return state.boosterPerk ? BOOSTER_CAP_PERK : BOOSTER_CAP;
  }

  function noteBoosterPerk() {
    if (state.boosterPerk) return;
    if ((state.boosterCd || 0) > BOOSTER_CAP) {
      state.boosterPerk = true;
      storeSet("boosterPerk", true);
    }
  }
  var CANDY_FX = {
    35: { happy: 25, boost: 30 * M },
    36: { happy: 35, boost: 30 * M },
    310: { happy: 25, boost: 30 * M },
    366: { happy: 2500, boost: 6 * H },
  };
  function rollDrugCd() {
    return 6 * H + Math.floor(Math.random() * (2 * H + 1));
  }
  function boosterOpen(cd) {
    return (Number(cd) || 0) < boosterCap();
  }
  function candyFx(id) {
    return CANDY_FX[Number(id)] || { happy: 25, boost: 30 * M };
  }
  function happyFxText(h) {
    if (!h) return "";
    if (h.kind === "edvd") {
      return "+" + (state.adultNov ? "5,000" : "2,500") + " happy · +6h booster";
    }
    if (h.kind === "drug") return "Doubles current happy · 6–8h drug cooldown";
    var fx = candyFx(h.id);
    return "+" + fx.happy + " happy · +" + Math.round(fx.boost / 60) + "m booster";
  }
  function itemFxShort(key) {
    var map = {
      xanax: "+250e cap 1,000 · +75 happy · 6–8h drug cooldown",
      cans: "Munster +20e / Red Cow +25e / Taurine +30e · +2h booster each",
      fhc: "Refills energy · +500 happy · +6h booster",
      nandrolone: "Not part of your gym routine",
      edvd: "+2,500 happy (+5,000 w/ 10★ AN) · +6h booster",
      candy: "Typical +25 happy · +30m booster (Big Box +35)",
      ecstasy: "Doubles happy · 6–8h drug cooldown",
      lsd: "+50e · +5 nerve · +200–500 happy · 6–8h drug cooldown",
      vicodin: "+75 happy · +25% battle stats · 6–8h drug cooldown",
    };
    return map[key] || "";
  }

  var state = {
    tab: "now",
    open: false,
    warStack: false,
    // When you last acknowledged the full-bar banner. The clock itself comes
    // from capStreak(), which the panel already prints.
    fullAckAt: 0,
    // null until the refills selection answers: unknown is NOT "unused".
    refillUsed: null,
    // null until /user/stocks answers; { available, increment } after.
    mcs: null,
    // null until the attack log answers; { n, energy } after. Distinct from
    // { n: 0 }, which is a real "you have not attacked today".
    attacks: null,
    // The faction board. `board` is the weekly baseline plus the archived
    // weeks; `boardBy` is this run's per-stat deltas, which are cheap to
    // recompute and deliberately not persisted. natBase caches each member's
    // consumable counts AS OF the week start -- a historical answer that never
    // changes, so it is kept rather than re-fetched.
    board: { week: null, at: 0, stats: {}, rows: [], hist: [] },
    boardBy: {},
    boardFaction: "",
    boardAt: 0,
    boardError: null,
    boardBusy: false,
    natUse: {},
    natBase: {},
    natBusy: false,
    // How many stats made it through when a round died part-way, and how many
    // members the natural pass could not read. Both are zero on a clean run and
    // are what stops a half-read board from looking like a whole one.
    boardPartial: 0,
    natMissed: 0,
    natDone: 0,
    natTotal: 0,
    natError: null,
    attackEvents: null,
    playerId: null,
    // Whether the gym log answers this key. Full only -- on a Limited key an
    // unobserved gap cannot be reconstructed, and is left uncounted rather
    // than guessed.
    logReadable: null,
    // { level, type, full } once /key/info answers; null while unknown, which
    // is NOT the same as "not full".
    keyLevel: null,
    focus: "str",
    focus2: "none",
    goals: { str: 0, def: 0, spe: 0, dex: 0 },
    // A percentage build. Null unless you have set one. With shareTotal it
    // derives `goals` and the existing planner does the rest; without, it is
    // maintain mode and has no endpoint by design.
    // When each stat book was started, keyed by stat. 0 = not reading.
    books: { str: 0, def: 0, spe: 0, dex: 0 },
    // Which book dates this device worked out for itself, rather than being
    // told. Only these are ever cleared automatically.
    booksAuto: {},
    // Which dates came from Torn's own item log rather than from a sighting.
    // Those are exact; the rest are floors and say so.
    booksExact: {},
    bookStartAt: 0,
    bookStartBusy: false,
    bookStartTries: 0,
    // Torn's item id for each stat book, resolved from the item catalogue.
    bookIds: {},
    bookIdsAt: 0,
    bookIdsBusy: false,
    // What the item-log lookup said last time, verbatim.
    bookLogDiag: "",
    bookSeen: "",
    // What the status-icon strip said last time it was read, verbatim.
    bookDiag: "",
    // Verdict folded to one line on the Now tab. Boot overwrites this from
    // storage, so the real default lives in that storeBool call, not here.
    verdictFold: true,
    shares: null,
    // What was actually typed, so the boxes keep 4:3:2:1 instead of being
    // rewritten to 40/30/20/10 under the cursor.
    sharesRaw: null,
    shareTotal: 0,
    mode: "xan",
    adultNov: false,
    status: "boot",
    statusText: "Starting…",
    lastFetch: 0,
    lastTrain: 0,
    flash: "",
    energy: 0,
    energyMax: 150,
    energyFulltime: 0,
    energySecPerE: 0,
    lastSeen: null,
    energyKnown: false,
    ledger: [],
    prices: {},
    gymsOwned: [],
    unlock: null,
    gymExpMult: 1,
    goalOrder: [],
    goalStep: 5e7,
    mcsCost: 0,
    src: { xan: 3, refill: 0, fhc: 0, munster: 0, redcow: 0, tourine: 0 },
    happy: 0,
    happyMax: 0,
    drugCd: 0,
    boosterCd: 0,
    boosterPerk: false,
    canMult: 1,
    calEvents: [],
    calAt: 0,
    gymName: "Gym",
    gymEnergy: 25,
    dots: { str: 2, def: 2, spe: 2, dex: 2 },
    stats: { str: 0, def: 0, spe: 0, dex: 0 },
    perks: { str: 1, def: 1, spe: 1, dex: 1, all: 1 },
    perkHits: {},
    perkRaw: {},
    items: { xanax: 0, lsd: 0, ecstasy: 0, vicodin: 0, munster: 0, redcow: 0, tourine: 0, cans: 0, fhc: 0, edvd: 0, candy: 0, nandrolone: 0 },
    itemIds: {},
    happyList: [],
    drinkList: [],
    invDom: null,
    log: [],
    invDiag: null,
    invUnavailable: "",
    invTally: null,
    energyDom: "",
    pendingUse: null,
    rawQty: null,
    rawHappy: null,
    invAt: 0,
    toast: null,
    invCatErr: "",
    // Compact daily stat history. One entry per day: {d: days-since-epoch,
    // v: [str, def, spe, dex]}. Arrays rather than named keys because
    // storeSet mirrors into localStorage, which Torn shares across every
    // script on the page — a year of named-key objects is several times
    // the size for no benefit.
    hist: [],
    histRange: 30,
    fetchInFlight: false,
  };

  var lastTickSig = "";
  var pollTimer = null;
  var cdTimer = null;
  var observers = [];
  var clickHandler = null;
  var draftKey = "";
  var keyBoxFocused = false;

  function pdaGlobal(name) {
    try {
      if (name === "PDA_httpGet" && typeof PDA_httpGet === "function") return PDA_httpGet;
      if (name === "PDA_httpPost" && typeof PDA_httpPost === "function") return PDA_httpPost;
    } catch (_) {}
    try {
      if (typeof window !== "undefined" && typeof window[name] === "function") return window[name];
    } catch (_) {}
    try {
      if (typeof unsafeWindow !== "undefined" && unsafeWindow && typeof unsafeWindow[name] === "function") {
        return unsafeWindow[name].bind(unsafeWindow);
      }
    } catch (_) {}
    return null;
  }

  function pdaReady() {
    try {
      if (window.__PDA_platformReadyPromise) return window.__PDA_platformReadyPromise;
    } catch (_) {}
    try {
      if (typeof unsafeWindow !== "undefined" && unsafeWindow && unsafeWindow.__PDA_platformReadyPromise) {
        return unsafeWindow.__PDA_platformReadyPromise;
      }
    } catch (_) {}
    return Promise.resolve();
  }

  function waitMs(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function pdaText(res) {
    if (res == null) return "";
    if (typeof res === "string") return res;
    if (typeof res !== "object") return String(res);
    if (typeof res.responseText === "string") return res.responseText;
    if (typeof res.data === "string") return res.data;
    if (res.data != null && typeof res.data === "object") {
      try {
        return JSON.stringify(res.data);
      } catch (_) {}
    }
    return "";
  }

  function pdaStatus(res) {
    if (res && typeof res === "object" && isFinite(res.status)) return Number(res.status);
    return 200;
  }

  function gmXhr(opts) {
    try {
      if (typeof GM_xmlhttpRequest === "function") {
        GM_xmlhttpRequest(opts);
        return true;
      }
    } catch (_) {}
    try {
      if (typeof GM !== "undefined" && GM && typeof GM.xmlHttpRequest === "function") {
        GM.xmlHttpRequest(opts);
        return true;
      }
    } catch (_) {}
    return false;
  }

  function httpGet(url) {
    return new Promise(function (resolve, reject) {
      function finish(text, next) {
        var data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          if (next) return next();
          return reject(new Error("Bad JSON"));
        }
        if (data && data.error) {
          var err = new Error(data.error.error || "API error");
          err.code = data.error.code;
          return reject(err);
        }
        resolve(data);
      }

      function viaGm() {
        if (
          gmXhr({
            method: "GET",
            url: url,
            anonymous: true,
            onload: function (res) {
              finish(res && res.responseText != null ? String(res.responseText) : "", null);
            },
            onerror: function () {
              reject(new Error("API request failed"));
            },
          })
        )
          return;
        reject(new Error("API request failed"));
      }

      function viaPda() {
        var get = pdaGlobal("PDA_httpGet");
        if (!get) return viaGm();
        var done = false;
        function onRes(res) {
          if (done) return;
          done = true;
          var text = pdaText(res);
          if (!text) return viaGm();
          finish(text, viaGm);
        }
        try {
          var ret = get(url);
          if (ret && typeof ret.then === "function") {
            ret.then(onRes, function () {
              try {
                get(url, onRes);
              } catch (_) {
                viaGm();
              }
            });
            return;
          }
          if (ret != null && ret !== "") {
            onRes(ret);
            return;
          }
        } catch (_) {}
        try {
          get(url, onRes);
        } catch (_) {
          viaGm();
        }
      }

      fetch(url)
        .then(function (r) {
          return r.text();
        })
        .then(function (t) {
          if (!t) return viaPda();
          finish(t, viaPda);
        })
        .catch(function () {
          viaPda();
        });
    });
  }

  function pdaRequest(kind, url, headers, body) {
    var fn = kind === "POST" ? pdaGlobal("PDA_httpPost") : pdaGlobal("PDA_httpGet");
    if (!fn) return Promise.reject(new Error("no PDA http"));
    function once() {
      var ret;
      try {
        ret = kind === "POST" ? fn(url, headers || {}, body || "") : fn(url);
      } catch (e) {
        return Promise.reject(e);
      }
      if (ret && typeof ret.then === "function") return ret;
      return Promise.resolve(ret);
    }
    return once().then(function (res) {
      if (res == null || res === "") return waitMs(2100).then(once);
      return res;
    });
  }

  function storeGet(key, fallback) {
    var k = NS + "_" + key;
    try {
      if (typeof GM_getValue === "function") {
        var v = GM_getValue(k, fallback);
        if (v !== undefined && v !== null) return v;
      }
    } catch (_) {}
    try {
      if (typeof GM !== "undefined" && GM && typeof GM.getValue === "function") {
        var gv = GM.getValue(k, fallback);
        if (gv && typeof gv.then === "function") {
          /* async GM 4 — localStorage is the sync source of truth */
        } else if (gv !== undefined && gv !== null) return gv;
      }
    } catch (_) {}
    try {
      var raw = localStorage.getItem(k);
      if (raw == null) return fallback;
      try {
        return JSON.parse(raw);
      } catch (e) {
        return raw;
      }
    } catch (_) {}
    return fallback;
  }

  function storeSet(key, value) {
    var k = NS + "_" + key;
    try {
      if (typeof GM_setValue === "function") GM_setValue(k, value);
    } catch (_) {}
    try {
      if (typeof GM !== "undefined" && GM && typeof GM.setValue === "function") GM.setValue(k, value);
    } catch (_) {}
    try {
      localStorage.setItem(k, typeof value === "string" ? value : JSON.stringify(value));
    } catch (_) {}
  }

  // Read a value out of the stable script's namespace. The beta never writes
  // there — a beta that corrupts the settings of the copy you rely on is worse
  // than one that asks you to paste a key.
  function stableGet(key, fallback) {
    var k = STABLE_NS + "_" + key;
    try {
      if (typeof GM_getValue === "function") {
        var v = GM_getValue(k, undefined);
        if (v !== undefined && v !== null) return v;
      }
    } catch (_) {}
    try {
      var raw = localStorage.getItem(k);
      if (raw == null) return fallback;
      try { return JSON.parse(raw); } catch (e) { return raw; }
    } catch (_) {}
    return fallback;
  }

  // Torn PDA hands stored values back as STRINGS, so !!"false" is true and
  // every reload silently switched War stack and the 10-star bonus on. Parse
  // the value instead of coercing it.
  function storeBool(key, def) {
    var v = storeGet(key, def);
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") {
      var t = v.trim().toLowerCase();
      if (t === "true" || t === "1" || t === "yes" || t === "on") return true;
      if (t === "false" || t === "0" || t === "no" || t === "off" || t === "") return false;
    }
    return !!def;
  }

  // A key you TYPED wins over the one Torn PDA substituted at install.
  //
  // The order used to be the other way round, which made a deliberately
  // entered key unreachable on a phone: PDA injects its own key, that key is
  // usually Limited, and the gym log is Full-only -- so pasting a Full key
  // into Settings silently did nothing and missed energy stayed
  // "observed only" with no way to improve it. Injection is an install-time
  // default; typing one is an act of intent, and intent should win.
  //
  // A PDA user who has never entered a key is unaffected: `own` is empty and
  // the injected key is still what comes back.
  function resolveKey() {
    var own = String(storeGet("api_key", "") || "").trim();
    if (own) return own;
    var injected = String(PDA_INJECTED_KEY || "").trim();
    if (injected && injected.indexOf("###") === -1 && injected.length > 8) return injected;
    return String(stableGet("api_key", "") || "").trim();
  }

  // Torn's own word on what a key may do. Reads /v2/key/info, which is
  // available to ANY key -- including the Public ones, so the check itself can
  // never be the thing that fails.
  //
  // null means "could not tell", deliberately distinct from "not full": a
  // rate-limited check must not nag someone whose key is perfectly good.
  function readKeyLevel(d) {
    var a = d && d.info && d.info.access;
    if (!a || typeof a.level !== "number") return null;
    // The numeric level decides it. The type string is shown to you because it
    // is what Torn's own key page calls it, but it is wording and could change.
    // "Faction API Access" is a POSITION ability, a separate axis from the
    // key's access level -- a Full key held by a member whose position lacks it
    // still cannot read contributors. /key/info answers any key and the coach
    // already calls it, so knowing this costs nothing and saves firing six
    // requests Torn will refuse; a refused call still spends the rate limit.
    //
    // null, NOT false, when the field is absent: Torn does not document it, and
    // "I could not tell" must never hide the tab from somebody whose board
    // works perfectly.
    return { level: a.level, type: String(a.type || ""), full: a.level >= 4,
             faction: typeof a.faction === "boolean" ? a.faction : null };
  }

  // Are we actually inside Torn PDA? Three PDA-specific lines in Settings used
  // to be hardcoded strings with no check at all, so a desktop browser was told
  // it was running under PDA, given PDA key instructions, and promised
  // notifications it can never deliver.
  //
  // Checked, not assumed: only PDA substitutes the API-key placeholder, and
  // only PDA exposes the flutter bridge. A function rather than a constant
  // because the bridge can arrive after this file runs.
  // The host's own name, when it gives one. warboard answers PDA's protocol
  // without being PDA, so it is neither "Torn PDA" nor a plain browser.
  function nativeHost() {
    try { return String(window.__WB_NATIVE_HOST__ || ""); } catch (_) { return ""; }
  }

  // Can a scheduled ping actually reach you here? True for Torn PDA and for any
  // host answering the same bridge; false in an ordinary browser, which has no
  // way to hold one.
  function canPing() {
    return isPda() || nativeHost() !== "";
  }

  function isPda() {
    if (HAS_PDA_KEY) return true;
    try { if (window.flutter_inappwebview) return true; } catch (_) {}
    try {
      if (typeof unsafeWindow !== "undefined" && unsafeWindow && unsafeWindow.flutter_inappwebview) return true;
    } catch (_) {}
    try { return /torn ?pda/i.test((navigator && navigator.userAgent) || ""); } catch (_) {}
    return false;
  }

  function keySource() {
    if (HAS_PDA_KEY && resolveKey()) return "Torn PDA";
    if (String(storeGet("api_key", "") || "").trim()) return "saved key";
    if (resolveKey()) return "stable script";
    return "none";
  }

  function fmt(n) {
    if (!isFinite(n)) return "—";
    return Math.round(n).toLocaleString("en-US");
  }

  function fmtCd(s) {
    s = Math.max(0, Math.floor(s));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    if (!s) return "READY";
    if (h && m) return h + "h " + m + "m";
    if (h) return h + "h";
    if (m) return m + "m";
    return s + "s";
  }

  function ROUND(num, places) {
    return +(Math.round(num + "e+" + places) + "e-" + places);
  }

  function httpPost(url, body) {
    var headers = {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
    };
    return new Promise(function (resolve, reject) {
      function finish(ok, text) {
        var data = {};
        try {
          data = JSON.parse(text || "{}");
        } catch (_) {
          data = { text: text };
        }
        if (!ok && !data.success && !data.items) return reject(new Error("Use failed"));
        resolve(data);
      }

      fetch(url, { method: "POST", credentials: "include", headers: headers, body: body })
        .then(function (r) {
          return r.text().then(function (t) {
            finish(r.ok, t);
          });
        })
        .catch(function () {
          pdaRequest("POST", url, headers, body)
            .then(function (res) {
              var text = pdaText(res);
              var status = pdaStatus(res);
              finish(status >= 200 && status < 300, text);
            })
            .catch(function () {
              if (
                gmXhr({
                  method: "POST",
                  url: url,
                  headers: headers,
                  data: body,
                  onload: function (res) {
                    var status = res && isFinite(res.status) ? Number(res.status) : 0;
                    finish(status >= 200 && status < 300, (res && res.responseText) || "");
                  },
                  onerror: function () {
                    finish(false, "");
                  },
                })
              )
                return;
              finish(false, "");
            });
        });
    });
  }

  var toastTimer = null;
  function showToast(title, body, ms) {
    state.toast = { title: title, body: body, until: Date.now() + (ms || 2600) };
    var panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    var el = panel.querySelector(".gc-toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "gc-toast";
      panel.appendChild(el);
    }
    el.innerHTML = "<b>" + title + "</b><span>" + body + "</span>";
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      state.toast = null;
      var p2 = document.getElementById(PANEL_ID);
      var e2 = p2 && p2.querySelector(".gc-toast");
      if (e2) e2.classList.remove("show");
    }, ms || 2600);
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function idForKey(key) {
    var ids = state.itemIds || {};
    if (key === "cans") return ids.munster || ids.redcow || ids.tourine || ids.cans || FALLBACK_IDS.munster;
    if (key === "candy") {
      var hit = (state.happyList || []).filter(function (h) {
        return h.kind === "candy" && h.id;
      })[0];
      return (hit && hit.id) || ids.candy;
    }
    return ids[key] || FALLBACK_IDS[key] || 0;
  }

  function itemTip(key) {
    var tick = nextTickSec();
    var drugLeft = fmtCd(state.drugCd);
    var boostLeft = fmtCd(state.boosterCd);
    var map = {
      xanax: [
        "Xanax",
        "+250 energy (caps at 1,000) and +75 happy. Starts a shared drug cooldown of 6–8 hours (random). Side effects while it lasts, including a battle-stat penalty. Overdose can wipe energy, nerve, and happy. Cooldown now: " + drugLeft + ".",
      ],
      cans: [
        "Energy drinks",
        "Munster +20e, Red Cow +25e, Taurine Elite +30e. Each adds 2 hours to booster cooldown (keep using until that bar passes your cap \u2014 24h, or 48h with the faction perk). No drug cooldown. Live booster: " + boostLeft + ".",
      ],
      lsd: [
        "Skip LSD",
        "+50 energy, +5 nerve, +200–500 happy. Same 6–8h drug cooldown as Xanax — it would block your Xanax. Leave it.",
      ],
      fhc: [
        "Don\u2019t use FHC",
        "Feathery Hotel Coupon refills your energy bar, +500 happy, and adds 6 hours booster cooldown. That\u2019s a travel / refill coupon, not your gym routine.",
      ],
      nandrolone: [
        "Optional",
        "Not part of the xan + gym or happy-jump loop. Leave it.",
      ],
      edvd: [
        "Erotic DVDs",
        state.mode !== "jump"
          ? "Happy jump is off. An e-dvd is +2,500 happy (+5,000 with 10★ Adult Novelties) and +6h booster cooldown."
          : "Each e-dvd: +2,500 happy (+5,000 with 10★ Adult Novelties) and +6h booster. Use on the :00/:15/:30/:45 tick with candy, before ecstasy. Booster " + boostLeft + ". Next tick " + fmtCd(tick) + ".",
      ],
      candy: [
        "Happy candy",
        state.mode !== "jump"
          ? "Happy jump is off. Typical candy is +25 happy and +30 min booster (Big Box of Chocolate Bars is +35 / 30 min). The booster cooldown stacks, so you can keep using them until it is over 24h."
          : "Typical candy: +25 happy and +30 min booster (Big Box +35). Stacks on the booster bar, up to your cap. After the tick (" + fmtCd(tick) + "), candy then e-dvds, ecstasy last.",
      ],
      ecstasy: [
        "Ecstasy last",
        "Doubles current happiness. Starts the same 6–8h drug cooldown as Xanax — take it last, after the other happy items. Drug cooldown now: " + drugLeft + ".",
      ],
      vicodin: [
        "Skip vicodin",
        "+75 happy and +25% all battle stats (temporary). Starts a 6–8h drug cooldown, so it would block Xanax and ecstasy. Don\u2019t mix it into your gym routine.",
      ],
    };
    return map[key] || ["Hold", "Not now."];
  }

  function useTornItem(itemId) {
    var body = "step=useItem&id=" + encodeURIComponent(itemId) + "&itemID=" + encodeURIComponent(itemId);
    return httpPost("https://www.torn.com/item.php?rfcv=" + Date.now(), body).then(function (data) {
      if (data && (data.success || data.items || data.text)) return data;
      return httpPost(
        "https://www.torn.com/page.php?sid=itemsUse&rfcv=" + Date.now(),
        "step=useItem&itemID=" + encodeURIComponent(itemId) + "&id=" + encodeURIComponent(itemId)
      );
    });
  }

  // Torn caches the API for ~30s, so re-fetching right after a use returns the
  // PRE-use count and the number appears frozen. We know exactly what we just
  // consumed, so drop it locally and let the next real fetch reconcile. Only
  // ever applied after Torn accepts the use.
  // Decrementing the display is not enough on its own: the refresh that follows
  // a use reads Torn's ~30s cache, which still holds the PRE-use count, and
  // overwrites it — the number drops then springs back. So the use is recorded
  // as PENDING and re-applied to every fetch until the API actually catches up.
  function decrementItemLocal(id) {
    id = Number(id) || 0;
    if (!id) return "";
    var hit = "";
    var ids = state.itemIds || {};
    for (var k in ids) {
      if (Number(ids[k]) === id) {
        hit = k;
        break;
      }
    }
    if (!hit) return "";
    if (!state.rawQty) {
      state.rawQty = {};
      for (var bk in state.items) state.rawQty[bk] = state.items[bk];
    }
    var pend = state.pendingUse || (state.pendingUse = {});
    var cur = pend[id] || { key: hit, n: 0, at: 0 };
    cur.key = hit;
    cur.n += 1;
    cur.at = Date.now();
    pend[id] = cur;
    applyPendingUses();
    return hit;
  }

  // Subtracts still-unconfirmed uses from the counts the API handed us.
  // IDEMPOTENT ON PURPOSE: it always recomputes from the raw API baseline
  // rather than from the current display, because it runs on every use AND on
  // every fetch. Subtracting from the already-adjusted value double-counted —
  // two uses in a row read 44 instead of 45.
  function applyPendingUses() {
    var pend = state.pendingUse;
    if (!pend || !state.rawQty) return;
    var now = Date.now();
    var byKey = {};
    var byId = {};
    for (var id in pend) {
      var p = pend[id];
      // Give up after two minutes. If the API still disagrees by then the use
      // did not land, and holding the adjustment forever would lie the other way.
      if (now - p.at > 1800000) {
        delete pend[id];
        continue;
      }
      byKey[p.key] = (byKey[p.key] || 0) + p.n;
      byId[id] = (byId[id] || 0) + p.n;
    }
    for (var k in byKey) {
      var base = state.rawQty[k];
      if (base === undefined) continue;
      state.items[k] = Math.max(0, Number(base) - byKey[k]);
    }
    var list = state.happyList || [];
    for (var i = 0; i < list.length; i++) {
      var raw = state.rawHappy ? state.rawHappy[list[i].id] : undefined;
      if (raw === undefined) continue;
      var n = byId[list[i].id] || 0;
      list[i].qty = Math.max(0, Number(raw) - n);
    }
  }

  function useItemId(id) {
    id = Number(id) || 0;
    if (!id) {
      showToast("Can\u2019t use", "No item id yet. Refresh, then try again.");
      return;
    }
    if (state.usingItem) return;
    state.usingItem = true;
    useTornItem(id)
      .then(function () {
        decrementItemLocal(id);
        showToast("Used", "Took one. Refreshing bars.");
        state.flash = "USED";
        if (state.open) renderPanel();
        setTimeout(function () {
          state.flash = "";
          if (state.open) renderPanel();
        }, 1200);
        return refresh("stock");
      })
      .catch(function () {
        showToast("Didn\u2019t use", "Torn didn\u2019t accept it. Open items and use it there, then refresh.");
      })
      .then(function () {
        state.usingItem = false;
      });
  }

  function useItemKey(key) {
    useItemId(idForKey(key));
  }

  function itemChip(row) {
    var rec = String(row.rec || "");
    if (rec === "USE") return '<button type="button" class="chip use" data-use="' + row.key + '">USE</button>';
    if (/DON/.test(rec)) return '<span class="chip bad">DON\u2019T</span>';
    return '<button type="button" class="chip ' + (row.cls || "muted") + '" data-tip="' + row.key + '">' + rec + "</button>";
  }

  function happyItemChip(h) {
    var jumpGo = state.mode === "jump" && nextTickSec() <= 90;
    var key = h.kind === "edvd" ? "edvd" : h.kind === "drug" ? "ecstasy" : "candy";
    var canBoost = boosterOpen(state.boosterCd);
    if (h.kind === "drug") {
      if (state.mode !== "jump") return itemChip({ key: key, rec: "OFF", cls: "muted" });
      if (jumpGo && state.drugCd <= 0 && h.id) {
        return '<button type="button" class="chip use" data-use-id="' + h.id + '">USE</button>';
      }
      return itemChip({ key: key, rec: "LAST", cls: "warn" });
    }
    if (state.mode !== "jump") return itemChip({ key: key, rec: "OFF", cls: "muted" });
    var canUse = jumpGo && h.id && canBoost;
    if (canUse) return '<button type="button" class="chip use" data-use-id="' + h.id + '">USE</button>';
    return itemChip({ key: key, rec: "HOLD", cls: "muted" });
  }

  function happyKitText() {
    var list = (state.happyList || []).filter(function (h) {
      return h.kind !== "drug";
    });
    if (!list.length) {
      return "every Candy-type item you have (chocolates, lollipops, bags of sweets, cupcakes, eggs, …) plus e-dvds, then ecstasy last";
    }
    return (
      list
        .map(function (h) {
          return h.qty + "× " + h.name;
        })
        .join(", ") + ", then ecstasy last"
    );
  }

  function apiUrl(selections) {
    return (
      "https://api.torn.com/user/?selections=" +
      selections +
      "&key=" +
      encodeURIComponent(resolveKey()) +
      "&comment=" +
      encodeURIComponent(COMMENT)
    );
  }

  // Whether today's point refill is still unspent.
  //
  // Deliberately its OWN request rather than another selection on the main
  // one. Torn fails a multi-selection call as a whole when the key cannot
  // reach one of them, so appending `refills` to the call that carries bars
  // and cooldowns would trade a working coach for a reminder. Kept apart, a
  // key without the access simply leaves refillUsed null and the reminder
  // stays quiet.
  // Mc Smoogle's weekly claim, out of /v2/user/stocks.
  //
  // Keyed on the stock id and nothing else. The probed account also held IIL
  // with available:true, so anything looser -- "some holding is ready", or the
  // first entry with a 7-day frequency -- would have announced Mc Smoogle
  // energy every time an unrelated stock came due.
  //
  // null means unreadable (no holding, wrong key level, error payload) and is
  // deliberately distinct from { available: false }, which means "held, not
  // ready yet".
  function readMcsBonus(d) {
    var list = d && d.stocks;
    if (!list) return null;
    var rows = Array.isArray(list) ? list : Object.keys(list).map(function (k) { return list[k]; });
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].id) !== String(MCS_STOCK_ID)) continue;
      var b = rows[i].bonus || {};
      if (typeof b.available !== "boolean") return null;
      return { available: b.available, increment: Number(b.increment) || 1 };
    }
    return null;
  }

  // One step for the verdict when the weekly energy is sitting there unclaimed.
  //
  // Unlike the point refill this is NOT gated on having room. Torn banks energy
  // above the cap rather than discarding it -- that is exactly what a xanax
  // does -- so claiming at a full bar loses nothing, and a full bar is the
  // moment you are most likely to be reading this.
  function mcsStep() {
    var m = state.mcs;
    if (!m || m.available !== true) return null;
    var e = MCS_ENERGY * (m.increment || 1);
    return {
      t: "MC SMOOGLE",
      text: "Your weekly Mc Smoogle energy is waiting \u2014 claim it on the stock " +
        "market for +" + fmt(e) + "e. Next week's does not start counting until " +
        "you take this one."
    };
  }

  var ATTACKS_TTL = 120000;
  function fetchAttacksToday(force) {
    if (!force && Date.now() - (state.attacksAt || 0) < ATTACKS_TTL) return;
    state.attacksAt = Date.now();
    // The ledger's day is a UTC day, so this one has to be too, or the two
    // halves of the same card would disagree about when "today" started.
    var dayStart = Math.floor(dayKey(Date.now()) * 86400000 / 1000);
    var rows = [], pages = 0;
    // v2 caps a page at 100 and its next-link is unreliable, so page by
    // timestamp: walk `to` back to the oldest row seen and ask again.
    function page(to) {
      var url = "https://api.torn.com/v2/user/attacks?filters=outgoing&sort=DESC&limit=100" +
        "&from=" + dayStart + (to ? "&to=" + to : "") +
        "&key=" + encodeURIComponent(resolveKey()) + "&comment=" + encodeURIComponent(COMMENT);
      return httpGet(url).then(function (d) {
        if (!d || !Array.isArray(d.attacks)) throw new Error("no attacks array");
        rows = rows.concat(d.attacks);
        pages += 1;
        // A full page means there may be more. Six pages is 600 attacks in a
        // day, past which the figure is academic and the requests are not.
        if (d.attacks.length < 100 || pages >= 6) return rows;
        var oldest = d.attacks.reduce(function (m, a) {
          var t = Number(a.started || a.ended) || 0;
          return m === 0 || (t && t < m) ? t : m;
        }, 0);
        if (!oldest || oldest <= dayStart) return rows;
        return page(oldest - 1);
      });
    }
    page(0)
      .then(function (all) {
        state.attacks = readAttacksToday({ attacks: all }, state.playerId || null, dayStart);
        state.attackEvents = attackEvents({ attacks: all }, state.playerId || null);
      })
      .catch(function () { state.attacks = null; });
  }

  var STOCKS_TTL = 1800000; // a weekly benefit; half an hour is plenty
  function fetchStocks(force) {
    if (!force && Date.now() - (state.stocksAt || 0) < STOCKS_TTL) return;
    state.stocksAt = Date.now();
    // Its own request, like the refills one: /user/stocks needs a LIMITED key,
    // and Torn fails a combined multi-selection call as a whole.
    httpGet("https://api.torn.com/v2/user/stocks?key=" +
            encodeURIComponent(resolveKey()) + "&comment=" + encodeURIComponent(COMMENT))
      .then(function (d) { state.mcs = readMcsBonus(d); })
      .catch(function () { state.mcs = null; });
  }

  // Reads BOTH spellings on purpose. v1 answers `energy_refill_used`; v2's
  // published schema renames the whole block to `energy` / `nerve` / `token` /
  // `special_count`, which lines up field-for-field and type-for-type with v1's
  // `*_refill_used` / `special_refills_available` -- so `energy` carries the
  // same "already used" sense. Accepting either means a v2 move cannot quietly
  // turn this into a reminder that never fires.
  //
  // Anything else is null, NOT false: "I could not tell" must never be read as
  // "you still have it".
  function readRefillUsed(d) {
    var r = d && d.refills;
    if (!r) return null;
    if (typeof r.energy_refill_used === "boolean") return r.energy_refill_used;
    if (typeof r.energy === "boolean") return r.energy;
    return null;
  }

  // Three minutes, not ten. It only changes once a day, so ten was defensible
  // on request count -- but it also decides how long the gym-page strip keeps
  // telling you to spend a refill you have already spent, and being wrong in
  // that direction is worse than one request every three minutes.
  var REFILL_TTL = 180000;
  function fetchRefills(force) {
    if (!force && Date.now() - (state.refillAt || 0) < REFILL_TTL) return;
    state.refillAt = Date.now();
    httpGet(apiUrl("refills"))
      .then(function (d) { state.refillUsed = readRefillUsed(d); })
      .catch(function () { state.refillUsed = null; });
  }

  var INV_PAGE = 250; // spec maximum; the default of 20 would silently truncate

  // `cat` is REQUIRED in practice. Torn's own OpenAPI spec marks it optional
  // for /user/inventory, but omitting it answers "Incorrect category" — the
  // runtime and the published spec disagree, and the runtime wins. So walk the
  // categories this coach actually reads. Anything outside these (weapons,
  // armour, plushies) is irrelevant here and not worth the requests.
  var INV_CATS = ["Drug", "Energy Drink", "Candy", "Alcohol", "Booster", "Supply Pack", "Enhancer"];

  function invUrlV2(cat, offset) {
    return (
      "https://api.torn.com/v2/user/inventory?cat=" +
      encodeURIComponent(cat) +
      "&limit=" +
      INV_PAGE +
      "&offset=" +
      (offset || 0) +
      "&key=" +
      encodeURIComponent(resolveKey()) +
      "&comment=" +
      encodeURIComponent(COMMENT)
    );
  }

  function fetchInvCat(cat, offset, acc) {
    offset = offset || 0;
    acc = acc || [];
    return httpGet(invUrlV2(cat, offset)).then(function (data) {
      var block = data && data.inventory;
      var rows = block && Array.isArray(block.items) ? block.items : Array.isArray(block) ? block : [];
      for (var ri = 0; ri < rows.length; ri++) {
        if (rows[ri] && typeof rows[ri] === "object") rows[ri]._cat = cat;
      }
      acc = acc.concat(rows);
      if (rows.length === INV_PAGE && acc.length < 2000) return fetchInvCat(cat, offset + INV_PAGE, acc);
      return acc;
    });
  }

  // One category failing must not lose the others, so each resolves to [] on
  // error and the per-category tally is reported for diagnosis.
  function fetchInventoryV2() {
    var tally = {};
    var seq = INV_CATS.reduce(function (chain, cat) {
      return chain.then(function (all) {
        return fetchInvCat(cat, 0, []).then(
          function (rows) {
            tally[cat] = rows.length;
            return all.concat(rows);
          },
          function (err) {
            tally[cat] = "err";
            state.invCatErr = (err && err.message) || "failed";
            return all;
          }
        );
      });
    }, Promise.resolve([]));
    return seq.then(function (all) {
      state.invTally = tally;
      return all;
    });
  }

  // Torn's API caches user bars server-side for ~30s, so no poll rate can make
  // energy current — the API is behind Torn's own page. The header bar is live,
  // so read that and let the API keep supplying everything else. Several
  // selector shapes are tried because Torn's bar markup has changed across
  // versions and the hashed React classes are not stable; whichever hits is
  // reported so a future rebuild is one screenshot away.
  function readEnergyFromDom() {
    var pat = /(\d[\d,]*)\s*\/\s*(\d[\d,]*)/;
    function parse(el, how) {
      if (!el) return null;
      var m = String(el.textContent || "").replace(/\s+/g, " ").match(pat);
      if (!m) return null;
      var cur = Number(String(m[1]).replace(/,/g, ""));
      var max = Number(String(m[2]).replace(/,/g, ""));
      if (!max || max > 5000 || cur > 20000) return null;
      return { cur: cur, max: max, how: how };
    }
    try {
      var byId = document.getElementById("barEnergy");
      var hit = parse(byId, "#barEnergy");
      if (hit) return hit;
      var pre = document.querySelector('[id^="barEnergy"]');
      hit = parse(pre, "[id^=barEnergy]");
      if (hit) return hit;
      // Last resort: the icon/label carries the word energy somewhere above the
      // number, so walk likely containers rather than the whole document.
      var nodes = document.querySelectorAll('[class*="bar"],[id*="energy"],[class*="energy"]');
      for (var i = 0; i < nodes.length && i < 60; i++) {
        var n = nodes[i];
        var txt = String(n.textContent || "");
        if (txt.length > 60) continue;
        if (!/energy/i.test(String(n.className) + " " + String(n.id))) continue;
        hit = parse(n, "scan");
        if (hit) return hit;
      }
    } catch (_) {}
    return null;
  }

  // Adopt the live bar whenever it disagrees with the cached API value.
  function syncEnergyFromDom() {
    var d = readEnergyFromDom();
    if (!d) {
      state.energyDom = "";
      return false;
    }
    state.energyDom = d.how + " " + d.cur + "/" + d.max;
    state.energyKnown = true;
    var changed = false;
    if (d.cur !== state.energy) {
      state.energy = d.cur;
      state.energyKnown = true;
      changed = true;
    }
    if (d.max && d.max !== state.energyMax) {
      state.energyMax = d.max;
      changed = true;
    }
    return changed;
  }

  // --- item page scan --------------------------------------------------------
  // Torn caches the inventory API for minutes, so a can you just drank still
  // shows in the old count. The item page is the truth and you are already
  // standing on it when you use things, so read the counts from there and
  // prefer them whenever they are newer than the API's.
  function rowQty(row) {
    try {
      var el = row.querySelector('[class*="qty"], [class*="Qty"], [class*="amount"]');
      var m = el && /(\d[\d,]*)/.exec(String(el.textContent || ""));
      if (m) return Number(String(m[1]).replace(/,/g, ""));
      // Falls back to the "xN" Torn prints beside the name.
      var m2 = /\bx\s?(\d[\d,]*)\b/i.exec(String(row.textContent || ""));
      if (m2) return Number(String(m2[1]).replace(/,/g, ""));
    } catch (_) {}
    return null;
  }

  function scanItemPage() {
    if (!/item\.php/i.test(location.href)) return false;
    var rows;
    try {
      rows = document.querySelectorAll(
        "ul.items-cont > li[data-item], ul.items-list > li[data-item], li.show-item-info[data-item], li[data-item]"
      );
    } catch (_) { return false; }
    if (!rows || !rows.length) return false;
    var out = {}, n = 0;
    for (var i = 0; i < rows.length; i++) {
      var id = Number(rows[i].getAttribute("data-item")) || 0;
      if (!id) continue;
      var q = rowQty(rows[i]);
      if (q == null) continue;
      out[id] = q;
      n += 1;
    }
    if (!n) return false;
    state.invDom = { at: Date.now(), qty: out, n: n };
    storeSet("invDom", state.invDom);
    return true;
  }

  // Cans the item page saw that the API has not caught up with at all.
  //
  // freshQty can only CORRECT a row that already exists, and a can you owned
  // none of has no API row to correct — so buying a new type stayed invisible
  // until Torn's inventory cache expired, minutes later. The scrape already
  // captured it; nothing read it. Only cans are adopted: the scrape covers the
  // whole item page, and a Xanax count has no business in the drink list.
  function adoptScrapedCans(drinks) {
    if (!domFresher()) return drinks;
    var qty = state.invDom.qty;
    CAN_TYPES.forEach(function (t) {
      var already = drinks.some(function (d) {
        return t.ids.indexOf(Number(d.id)) !== -1;
      });
      if (already) return;
      for (var i = 0; i < t.ids.length; i++) {
        var id = t.ids[i];
        var q = qty[id];
        if (typeof q === "number" && q > 0) {
          drinks.push({ id: id, name: t.label, qty: q, e: drinkEnergy(t.label, id) });
          break;
        }
      }
    });
    return drinks;
  }

  // The scraped count wins only while it is newer than the API reading, so a
  // fresh API fetch still takes over once Torn catches up.
  function domFresher() {
    var d = state.invDom;
    return !!(d && d.qty && d.at && d.at > (state.invAt || 0));
  }

  function freshQty(id, apiQty) {
    if (!id || !domFresher()) return apiQty;
    var v = state.invDom.qty[id];
    return typeof v === "number" ? v : apiQty;
  }

  function countItems(inv) {
    var out = { xanax: 0, lsd: 0, ecstasy: 0, vicodin: 0, munster: 0, redcow: 0, tourine: 0, cans: 0, fhc: 0, edvd: 0, candy: 0, nandrolone: 0 };
    var ids = {};
    var happy = [];
    var drinks = [];
    if (!inv) return { qty: out, ids: ids, happy: happy, drinks: drinks };
    var list = Array.isArray(inv)
      ? inv
      : Object.keys(inv).map(function (k) {
          return inv[k];
        });
    list.forEach(function (it) {
      if (!it) return;
      var name = String(it.name || "");
      var qty = Number(it.amount != null ? it.amount : it.quantity != null ? it.quantity : it.qty || 0) || 0;
      if (!qty) return;
      var id = Number(it.ID != null ? it.ID : it.id || 0) || 0;
      var type = String(it.type || "").toLowerCase();
      var isCandy = type === "candy" || type.indexOf("candy") !== -1 || HAPPY_CANDY.test(name);
      var key = "";
      var rowCat = it._cat || "";
      ITEM_MAP.forEach(function (m) {
        // When we know the row's real category, a pattern tied to a different
        // one cannot claim it. Falls back to name-only when the category is
        // unknown (a v1-shaped payload).
        if (m.cat && rowCat && m.cat !== rowCat) return;
        if (m.test.test(name)) key = m.key;
      });
      if (!key && isCandy) key = "candy";
      if (key) {
        // Show every row feeding the drink total with its category: either we
        // are adding rows we should not, or the API is reporting a stale amount
        // for the one row that is a real drink. Opposite fixes, identical total.
        out[key] = (out[key] || 0) + qty;
        if (id && !ids[key]) ids[key] = id;
      }
      // Category says drink, name says otherwise -> trust the name. Matched on
      // the name ALONE here: a row tagged with the wrong category has its
      // normal match suppressed, so it would otherwise arrive with no key at
      // all and be admitted by the tag it should have been rejected for.
      var nameKey = "";
      ITEM_MAP.forEach(function (m) { if (m.test.test(name)) nameKey = m.key; });
      var drinkByName = nameKey === "munster" || nameKey === "redcow" ||
                        nameKey === "tourine" || nameKey === "cans";
      var notDrink = nameKey && !drinkByName;
      if (drinkByName || (rowCat === "Energy Drink" && !notDrink)) {
        drinks.push({ id: id, name: name, qty: qty, e: drinkEnergy(name, id) });
      }
      if (key === "edvd" || key === "candy" || key === "ecstasy" || isCandy) {
        var kind = key === "edvd" ? "edvd" : key === "ecstasy" ? "drug" : "candy";
        happy.push({ id: id, name: name, qty: qty, kind: kind });
      }
    });
    return { qty: out, ids: ids, happy: happy, drinks: drinks };
  }

  function applyCountedItems(parsed) {
    if (!parsed) return;
    var raw = parsed.qty;
    // A pending use is CONFIRMED once the API's own number falls below what it
    // last reported — that is the cache expiring, not our guess. Clear it then,
    // or the subtraction would be applied twice.
    var pend = state.pendingUse;
    if (pend) {
      // Retire pending uses by how much the API has ACTUALLY come down. Clearing
      // on the first sign of any drop was wrong: three pending uses all vanished
      // the moment the API acknowledged one, and the count sprang back up by two.
      var dropped = {};
      for (var dk in raw) {
        var was = state.rawQty ? state.rawQty[dk] : undefined;
        if (was !== undefined && Number(raw[dk]) < Number(was)) dropped[dk] = Number(was) - Number(raw[dk]);
      }
      for (var id in pend) {
        var k = pend[id].key;
        var credit = dropped[k] || 0;
        if (!credit) continue;
        var take = Math.min(credit, pend[id].n);
        pend[id].n -= take;
        dropped[k] = credit - take;
        if (pend[id].n <= 0) delete pend[id];
      }
    }
    state.rawQty = {};
    for (var rk in raw) state.rawQty[rk] = raw[rk];
    state.items = raw;
    state.itemIds = parsed.ids || {};
    state.happyList = parsed.happy || [];
    (parsed.drinks || []).forEach(function (d) { d.qty = freshQty(d.id, d.qty); });
    adoptScrapedCans(parsed.drinks || []);
    state.drinkList = (parsed.drinks || []).filter(function (d) { return d.qty > 0; }).sort(function (a, b) {
      return (b.e || 0) - (a.e || 0) || b.qty - a.qty;   // strongest first
    });
    state.rawHappy = {};
    for (var hi = 0; hi < state.happyList.length; hi++) {
      state.rawHappy[state.happyList[hi].id] = state.happyList[hi].qty;
    }
    applyPendingUses();
    // The candidate list is built from the cans you actually hold, so it is not
    // final until the inventory has landed. Asking for prices before this point
    // fetches the placeholder staples and never the cans in your bag.
    refreshPrices();
  }

  function extractPercentMult(string) {
    var s = String(string);
    var m = s.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
    if (m) return parseFloat(m[1]) / 100 + 1;
    m = s.toLowerCase().match(/gym\s+gains[^\d]*(\d+(?:\.\d+)?)/) || s.toLowerCase().match(/(\d+(?:\.\d+)?)[^\d]*gym\s+gains/);
    if (m) return parseFloat(m[1]) / 100 + 1;
    return null;
  }

  function isGymPerkLine(s) {
    var lower = String(s || "").toLowerCase();
    // Perks that raise a different bar entirely, and must never be mistaken
    // for a gym multiplier.
    if (/energy drink|consumable|happy|nerve|crime|drug|medical|booster|life|awareness/.test(lower)) return false;
    if (lower.indexOf("gym") !== -1) return lower.indexOf("gain") !== -1 || /gym\s+train/.test(lower);
    // Education and company perks often read "+ 1% strength gain" with no
    // mention of a gym at all, and were being dropped on the floor.
    return /\b(strength|defen[cs]e|speed|dexterity|all stats?|battle stats?)\b/.test(lower) &&
      /gain|train/.test(lower);
  }

  function parsePerks(data) {
    var mods = { all: 1, str: 1, spe: 1, def: 1, dex: 1 };
    var hits = {};   // source -> the lines actually counted, for display
    var adultNov = false;
    var boosterPerk = false;
    // Books and faction/job perks raise what a can is worth. Scanned from the
    // raw perk arrays rather than the gym-perk filter, because these lines are
    // not stat perks and the filter would drop them.
    var canMult = 1;
    [data.faction_perks, data.job_perks, data.book_perks, data.company_perks].forEach(function (arr) {
      (arr || []).forEach(function (line) {
        var txt = String(line || "");
        if (!/energy drinks?/i.test(txt) && !/consumable gain/i.test(txt)) return;
        var n = parseInt(txt.replace(/\D+/g, ""), 10);
        if (!isNaN(n) && n > 0 && n < 500) canMult *= 1 + n / 100;
      });
    });
    function apply(list, source) {
      if (!list || !list.length) return;
      for (var i = 0; i < list.length; i++) {
        var s = String(list[i] || "");
        var lower = s.toLowerCase();
        // Checked before the gym-perk filter: the Adult Novelties line is not a
        // stat perk, so the filter would drop it before we ever saw it.
        if (lower.indexOf("adult novelt") !== -1) adultNov = true;
        // The faction perk that lifts the booster ceiling to 48h. Torn's exact
        // wording is not something to bet on, so this is deliberately broad —
        // and it is only ever a shortcut, because noteBoosterPerk() proves the
        // same thing from a cooldown above 24h no matter what the line says.
        if ((lower.indexOf("booster") !== -1 || lower.indexOf("energy drink") !== -1) &&
            /\b(24|48)\b|cooldown|cap|maximum/.test(lower)) boosterPerk = true;
        if (!isGymPerkLine(s)) continue;
        var n = extractPercentMult(s);
        if (!n) continue;
        if (lower.indexOf("strength") !== -1) mods.str *= n;
        else if (lower.indexOf("speed") !== -1) mods.spe *= n;
        else if (lower.indexOf("defense") !== -1 || lower.indexOf("defence") !== -1) mods.def *= n;
        else if (lower.indexOf("dexterity") !== -1) mods.dex *= n;
        else mods.all *= n;
        (hits[source] = hits[source] || []).push(s);
      }
    }
    apply(data.job_perks, "job");
    apply(data.property_perks, "property");
    apply(data.education_perks, "education");
    apply(data.merit_perks, "merit");
    apply(data.faction_perks, "faction");
    apply(data.company_perks, "company");
    apply(data.stock_perks, "stock");
    apply(data.book_perks, "book");
    apply(data.enhancer_perks, "enhancer");
    return {
      str: mods.str * mods.all,
      def: mods.def * mods.all,
      spe: mods.spe * mods.all,
      dex: mods.dex * mods.all,
      all: mods.all,
      hits: hits,
      raw: {
        faction: data.faction_perks || [], company: data.company_perks || [],
        job: data.job_perks || [], education: data.education_perks || [],
        property: data.property_perks || [], merit: data.merit_perks || [],
        stock: data.stock_perks || [], book: data.book_perks || [],
        enhancer: data.enhancer_perks || []
      },
      adultNov: adultNov,
      boosterPerk: boosterPerk,
      canMult: canMult,
    };
  }

  // One line per source, showing the exact perk text that was counted — so a
  // multiplier that looks wrong can be traced to the line that caused it.
  function perkSourceLine(source, label) {
    var lines = (state.perkHits || {})[source];
    return lines && lines.length ? label + ": " + lines.join(" \u00b7 ") : "";
  }

  function perkPct(mult) {
    var pct = Math.round(((Number(mult) || 1) - 1) * 1000) / 10;
    if (!pct) return "0%";
    return (pct > 0 ? "+" : "") + pct + "%";
  }

  function gainOne(stat, happy, dots, energyP, perk, typ) {
    var S = stat;
    if (S > 5e7) S = 5e7 + (S - 5e7) / (8.77635 * Math.log(S));
    var H = happy || 1;
    var coeffs = { str: [1600, 1700, 700], spe: [1600, 2000, 1350], dex: [1800, 1500, 1000], def: [2100, -600, 1500] }[typ];
    var A = coeffs[0];
    var B = coeffs[1];
    return (
      (S * ROUND(1 + 0.07 * ROUND(Math.log(1 + H / 250), 4), 4) +
        8 * Math.pow(H, 1.05) +
        (1 - Math.pow(H / 99999, 2)) * A +
        B) *
      (1 / 200000) *
      dots *
      energyP *
      perk
    );
  }

  function projectDays(days, energyPerDay, typ) {
    var stat = state.stats[typ] || 0;
    if (!stat) return 0;
    var gym = GYMS.filter(function (g) {
      return g.Gym === state.gymName;
    })[0] || GYMS[GYMS.length - 1];
    var energyP = gym.Energy || 25;
    var dots = Number(gym[{ str: "Str", def: "Def", spe: "Spe", dex: "Dex" }[typ]]) || 0;
    if (!dots) return 0;
    var trains = Math.floor(energyPerDay / energyP) * days;
    var total = 0;
    var happy = state.happyMax || state.happy || 5000;
    for (var i = 0; i < trains; i++) {
      total += gainOne(stat + total, happy, dots, energyP, state.perks[typ] || 1, typ);
    }
    return total;
  }

  // What a day's energy actually looks like for YOU. Previously this was a flat
  // 720 with refills and cans contributing nothing, so every projection was the
  // same number regardless of how you play. Natural regen now comes from Torn's
  // own rate, and the rest is whatever sources you have switched on.
  // Each source is a tick box plus a count. Cans are listed individually
  // because they are not interchangeable: Munster is +20, Red Cow +25,
  // Taurine +30, and which one you actually drink changes the projection.
  var XAN_E = 250;
  var SRC_BASE = [
    // THREE, not six, and not four either. The drug cooldown a xanax leaves is
    // long enough that a fourth does not fit in a day — reported from actually
    // taking them, which beats arithmetic off a nominal cooldown. The old cap
    // of 6 had "Worth it?" pricing a fifth and sixth that no amount of money
    // can buy; taking one early is an overdose, not a faster plan.
    { k: "xan",     label: "Xanax",         e: 250, unit: "+250e",     def: 3, max: 3,  grp: "" },
    { k: "refill",  label: "Energy refill", e: 0,   unit: "+full bar", def: 1, max: 4,  grp: "" },
    { k: "fhc",     label: "Hotel coupon",  e: 0,   unit: "+full bar", def: 1, max: 4,  grp: "" },
    // Mc Smoogle Corp pays 100 energy every 7 days per increment, so the daily
    // figure is 100/7. Counted in increments rather than shares because the
    // share threshold moves with the price.
    { k: "mcs",     label: "Mc Smoogle Corp", e: 100 / 7, unit: "+100e / 7 days", def: 1, max: 5, grp: "" },
  ];

  // Cans you hold, plus the three staples so the list is never empty. Anything
  // seasonal only appears once it is actually in your inventory.
  function srcRows() {
    var held = {};
    (state.drinkList || []).forEach(function (d) {
      var t = canType(d.name, d.id);
      if (t) held[t.k] = (held[t.k] || 0) + (Number(d.qty) || 0);
    });
    // EVERY can, not just the ones in your bag. Listing only what you hold hid
    // the comparison that matters: each can costs the same 2h of booster
    // cooldown whatever its strength, so a Damp Valley and a Taurine Elite take
    // the identical slot for 15e against 45e. You cannot notice that about a
    // can you cannot see. Held cans lead, then the strongest of the rest, and
    // `held` rides on the row so the UI can mark a plan built on a cupboard you
    // do not own.
    var list = CAN_TYPES.slice().sort(function (a, b) {
      var ha = (held[a.k] || 0) > 0, hb = (held[b.k] || 0) > 0;
      if (ha !== hb) return ha ? -1 : 1;
      return canEnergy(b) - canEnergy(a);
    });
    return SRC_BASE.concat(
      list.map(function (t) {
        var e = canEnergy(t);
        return { k: t.k, label: t.label, e: e, unit: "+" + e + "e", def: 4, max: 24,
                 grp: "cans", held: held[t.k] || 0 };
      })
    );
  }

  function srcRow(k) {
    var rows = srcRows();
    for (var i = 0; i < rows.length; i++) if (rows[i].k === k) return rows[i];
    return null;
  }

  function srcCount(k) {
    var v = state.src && state.src[k];
    var row = srcRow(k);
    var lim = row ? row.max : 24;
    return typeof v === "number" && v > 0 ? Math.min(v, lim) : 0;
  }

  // Refills and coupons are worth a full bar, so their value follows YOUR max.
  function srcEnergy(k) {
    var row = srcRow(k);
    if (!row) return 0;
    var per = row.e || (state.energyMax || 150);
    return srcCount(k) * per;
  }

  // --- goals -----------------------------------------------------------------
  // You name a target per stat; the plan works out how long each takes at your
  // current energy, gym, happy and perks, and trains them one at a time. Order
  // does not change the total (training one stat does not speed up another), so
  // the shortest goal goes first — that way something is finished soonest.
  var goalCache = { key: "", val: null };

  function parseGoal(txt) {
    var t = String(txt == null ? "" : txt).trim().toLowerCase().replace(/,/g, "").replace(/\s+/g, "");
    if (!t) return 0;
    var m = /^([0-9]*\.?[0-9]+)([kmb])?$/.exec(t);
    if (!m) return NaN;
    var n = parseFloat(m[1]);
    if (!isFinite(n) || n < 0) return NaN;
    var mult = m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : m[2] === "b" ? 1e9 : 1;
    return Math.round(n * mult);
  }

  function fmtDays(d) {
    if (!isFinite(d)) return "not at this rate";
    if (d <= 0) return "done";
    // Days come from trains divided by trains-a-day, so they arrive fractional.
    // Under a rotation that is dozens of legs, each one of them a fraction.
    if (d < 1) {
      var hrs = Math.round(d * 24);
      return hrs <= 1 ? "under an hour" : hrs + " hours";
    }
    if (d < 60) {
      var n = Math.round(d);
      return n + " day" + (n === 1 ? "" : "s");
    }
    if (d < 730) return (d / 30.44).toFixed(1).replace(/\.0$/, "") + " months";
    return (d / 365.25).toFixed(1).replace(/\.0$/, "") + " years";
  }

  // --- calibration ----------------------------------------------------------
  // The gain model is a model. It assumes a happy value, a perk multiplier and
  // a gym you may not have been in, and it assumes you spend every point of
  // energy the plan says you have. Both assumptions are checkable after the
  // fact: the stat history says what you really gained, the ledger says what
  // you really spent. Two separate corrections come out of that, kept apart on
  // purpose — one number blending them tells you nothing you can act on.
  //
  //   model factor  actual gain / gain predicted for the energy REALLY spent
  //                 -> is the gain arithmetic right?
  //   usage factor  energy really spent / energy that passed through the bar
  //                 -> do you actually spend it? this is where missed energy lands
  //
  // Usage deliberately measures against energy you HAD, not energy the plan
  // assumes. Measuring against the plan looked equivalent and was not: adding a
  // can to the plan would drop usage by exactly the amount the can added, so
  // every "what if I bought this" answer came back as no change at all.
  //
  // ETAs multiply by both. Caveat worth knowing: the ledger counts every point
  // that leaves the bar, so attacks and other spending land in the usage factor
  // as though they were training.
  var CAL_WINDOW = 14;    // complete days examined (today is partial, so excluded)
  var CAL_MIN_DAYS = 7;   // usable days before the correction is applied at all
  var CAL_MODEL_LO = 0.5, CAL_MODEL_HI = 1.5;
  var CAL_USAGE_LO = 0.3, CAL_USAGE_HI = 1.5;

  function calClamp(v, lo, hi) {
    if (!isFinite(v) || !(v > 0)) return 1;
    return v < lo ? lo : v > hi ? hi : v;
  }

  // What the model says one day of `energy` into `k` yields starting from
  // `startStat`. projectDays() always starts from the CURRENT stat, which is
  // wrong when replaying history: a day two weeks ago started lower, and gains
  // shrink as the stat grows, so reusing today's figure understates the past.
  function predictDay(startStat, energy, k, gymName) {
    var gym = GYMS.filter(function (g) { return g.Gym === gymName; })[0] || GYMS[GYMS.length - 1];
    var energyP = gym.Energy || 25;
    var dots = Number(gym[{ str: "Str", def: "Def", spe: "Spe", dex: "Dex" }[k]]) || 0;
    if (!dots || !(startStat > 0)) return 0;
    var trains = Math.floor((energy || 0) / energyP);
    var happy = state.happyMax || state.happy || 5000;
    var perk = (state.perks && state.perks[k]) || 1;
    var tot = 0;
    for (var i = 0; i < trains; i++) tot += gainOne(startStat + tot, happy, dots, energyP, perk, k);
    return tot;
  }

  function calibration() {
    var out = { ok: false, days: 0, looked: 0, model: 1, usage: 1,
                actual: 0, predicted: 0, used: 0, wasted: 0, off: 0, uDays: 0,
                // How many of the measured days needed the log's per-stat
                // split. Shown, because a day measured that way rests on one
                // more record than a single-stat day does.
                mixedDays: 0, reason: "" };
    var today = dayKey(Date.now());
    var first = today - CAL_WINDOW, last = today - 1;

    var byDay = {};
    (state.ledger || []).forEach(function (e) {
      if (e && typeof e.d === "number") byDay[e.d] = e;
    });
    // Per-stat energy, where the gym log could supply it. Empty on a Limited
    // key -- the log is Full-only -- and every day then falls back to the
    // one-stat rule, which is what those keys already do.
    var byStat = (state.trainLog && state.trainLog.byDayStat) || {};
    var vAt = {};
    (state.hist || []).forEach(function (h) {
      if (h && typeof h.d === "number" && h.v) vAt[h.d] = h.v;
    });

    var IDX = { str: 0, def: 1, spe: 2, dex: 3 };
    var d, k;
    for (d = first; d <= last; d++) {
      var cur = vAt[d], prev = vAt[d - 1];
      if (!cur || !prev) continue;   // a gap: this delta is not one day's work
      out.looked += 1;
      var moved = [];
      for (k in IDX) {
        var g = (cur[IDX[k]] || 0) - (prev[IDX[k]] || 0);
        if (g > 0) moved.push({ k: k, g: g, from: prev[IDX[k]] || 0 });
      }
      if (!moved.length) continue;
      var e = byDay[d] && byDay[d].used;
      if (!(e > 0)) continue;

      // One stat moved: the day's whole energy bought that one gain, and no
      // split is needed.
      if (moved.length === 1) {
        var p1 = predictDay(moved[0].from, e, moved[0].k, state.gymName);
        if (!(p1 > 0)) continue;
        out.actual += moved[0].g;
        out.predicted += p1;
        out.days += 1;
        continue;
      }

      // More than one stat moved. This used to be discarded outright -- "the
      // day's energy was split in a ratio nothing recorded" -- which cost a day
      // to anyone who alternates stats, and left people at 1 of 7 after a full
      // week of perfectly normal training.
      //
      // Something did record the ratio. Torn's gym log is fetched once per
      // stat, so the per-stat energy is already in hand; it was only ever being
      // summed away. mixedDayEnergy hands it back when it is safe to use, and
      // null when anything about it fails to add up -- in which case the day is
      // skipped exactly as before. This can only ever turn a discarded day into
      // a measured one, never a measured day into a wrong one.
      var split = mixedDayEnergy(byStat[d], moved.map(function (m) { return m.k; }), e);
      if (!split) continue;
      var pSum = 0, gSum = 0, bad = false;
      moved.forEach(function (m) {
        var pm = predictDay(m.from, split[m.k], m.k, state.gymName);
        if (!(pm > 0)) { bad = true; return; }
        pSum += pm;
        gSum += m.g;
      });
      if (bad || !(pSum > 0)) continue;
      out.actual += gSum;
      out.predicted += pSum;
      out.days += 1;
      out.mixedDays += 1;
    }

    // Usage spans every complete day the ledger actually covers — not just the
    // usable ones. A day you banked a full bar and never trained is precisely
    // the day that should drag this down. Days with no bucket at all are days
    // the script never ran; those are unmeasured, not zero.
    for (d = first; d <= last; d++) {
      if (!byDay[d]) continue;
      out.uDays += 1;
      out.used += byDay[d].used || 0;
      out.wasted += byDay[d].wasted || 0;
      out.off += byDay[d].off || 0;
    }

    if (out.days < CAL_MIN_DAYS) {
      out.reason = out.days + " of " + CAL_MIN_DAYS + " days measured";
      return out;
    }
    if (!(out.predicted > 0) || !(out.used + out.wasted + out.off > 0)) {
      out.reason = "not enough recorded energy yet";
      return out;
    }
    out.model = calClamp(out.actual / out.predicted, CAL_MODEL_LO, CAL_MODEL_HI);
    // Energy spent attacking counts against you here exactly like a full bar:
    // it is energy that did not reach the gym, and a gym ETA built as though it
    // had is optimistic on precisely the days you warred hardest.
    out.usage = calClamp(out.used / (out.used + out.wasted + out.off), CAL_USAGE_LO, CAL_USAGE_HI);
    out.ok = true;
    return out;
  }

  // --- schedule --------------------------------------------------------------
  // Goals used to run one whole stat at a time, shortest first. That finishes
  // something soonest but leaves everything else untouched for months. With an
  // increment set, each stat climbs to the next milestone in turn, so they rise
  // together and a stat that is behind catches up on its own before the
  // rotation settles.
  //
  // Everything below counts TRAINS, not days, and divides once at the end.
  // A leg does not consume the rest of your day when it ends, so rounding each
  // leg up would invent a cost rotation does not have: at 50m increments that
  // is 52 legs and 24 imaginary days against a true cost of about 0.1.
  //
  // Counting trains has a second benefit. The trains needed to reach a target
  // do not depend on how much energy you have a day — only on the gym. So
  // "what if I had more energy" is a division, not another walk.
  var GOAL_STEPS = [0, 5e7, 1e8, 2.5e8, 5e8];
  var GOAL_STEP_DEFAULT = 5e7;
  var GOAL_MAX_TRAINS = 4e6; // backstop against an unreachable target

  function gymFor() {
    return GYMS.filter(function (g) { return g.Gym === state.gymName; })[0] || GYMS[GYMS.length - 1];
  }

  function dotsFor(k, gym) {
    return Number((gym || gymFor())[{ str: "Str", def: "Def", spe: "Spe", dex: "Dex" }[k]]) || 0;
  }

  // Trains to take a stat from one value to another, and where it lands.
  function trainsTo(k, from, to, mf) {
    var gym = gymFor();
    var dots = dotsFor(k, gym);
    if (!dots || !(to > from)) return null;
    var energyP = gym.Energy || 25;
    var happy = state.happyMax || state.happy || 5000;
    var perk = (state.perks && state.perks[k]) || 1;
    var f = mf > 0 ? mf : 1;
    var s = from, t = 0;
    while (s < to && t < GOAL_MAX_TRAINS) {
      s += gainOne(s, happy, dots, energyP, perk, k) * f;
      t += 1;
    }
    // Ran out of backstop without arriving. Reporting the backstop as a real
    // leg would put four million trains of work into the schedule and read as a
    // finish date; the goal is simply not reachable, and rows say so.
    if (s < to) return null;
    return { trains: t, end: Math.min(s, to) };
  }

  function trainsPerDay(energyPerDay) {
    var gym = gymFor();
    return Math.floor((energyPerDay || 0) / (gym.Energy || 25));
  }

  // Milestones: multiples of the increment, plus every target in its own right
  // so a smaller goal is not dragged past itself waiting for the next multiple.
  function goalLevels(step, targets) {
    var maxT = 0, k;
    for (k in targets) if (targets[k] > maxT) maxT = targets[k];
    var out = [];
    if (step > 0) for (var L = step; L < maxT; L += step) out.push(L);
    for (k in targets) out.push(targets[k]);
    out.sort(function (a, b) { return a - b; });
    return out.filter(function (v, i) { return i === 0 || v !== out[i - 1]; });
  }

  // Stats still to train, in the order they will be trained. A hand-set order
  // wins; anything it does not mention falls back to shortest-first, which is
  // what the plan did before ordering existed.
  function orderedGoalKeys(mf) {
    var g = state.goals || {};
    var have = HIST_KEYS.filter(function (k) {
      return (Number(g[k]) || 0) > (state.stats[k] || 0);
    });
    var saved = Array.isArray(state.goalOrder) ? state.goalOrder : [];
    var out = [];
    saved.forEach(function (k) {
      if (have.indexOf(k) !== -1 && out.indexOf(k) === -1) out.push(k);
    });
    var rest = have.filter(function (k) { return out.indexOf(k) === -1; });
    var solo = {};
    rest.forEach(function (k) {
      var r = trainsTo(k, state.stats[k] || 0, Number(g[k]) || 0, mf);
      solo[k] = r ? r.trains : Infinity;
    });
    // Best gym-gain bonus first. Steadfast is the faction branch that grants
    // these PER STAT -- "+ 14% defense gym gains" against "+ 10% strength" --
    // so the same energy is worth measurably more in one stat than another.
    // parsePerks already folded it into state.perks and trainsTo already used
    // it, so the ETAs were right; what nothing did was let it choose WHICH
    // stat a rotation leg goes to. Now it does.
    //
    // Ties fall back to shortest-first, which is what the plan did before
    // ordering existed, so equal bonuses leave the old behaviour intact.
    var perk = function (k) { return (state.perks && state.perks[k]) || 1; };
    if (state.shares) {
      // On a percentage build the rotation follows the BUILD, not the nearest
      // finish line. Ordering by shortest-first schedules whichever stat is
      // closest to its target, which on a real account meant Dexterity going
      // first while sitting 21 points OVER its share -- the ratio got worse
      // for months and only came right at the very end. Reported as "why is it
      // telling me to train dex if my ratio is over?", which is the correct
      // question.
      //
      // Same priority maintain mode uses, so both modes answer alike: stats
      // that are UNDER lead, best gym bonus first among them; the ones already
      // over follow, least-over first, since they still have a target to reach.
      var st = {};
      shareState(state.shares, state.stats).forEach(function (r) { st[r.k] = r; });
      rest.sort(function (a, b) {
        var da = st[a] ? st[a].delta : 0, db = st[b] ? st[b].delta : 0;
        var ua = da > 0, ub = db > 0;
        if (ua !== ub) return ua ? -1 : 1;
        if (ua) {
          if (perk(b) !== perk(a)) return perk(b) - perk(a);
          return db - da;
        }
        return db - da;
      });
      return out.concat(rest);
    }
    rest.sort(function (a, b) {
      if (perk(b) !== perk(a)) return perk(b) - perk(a);
      return solo[a] - solo[b];
    });
    return out.concat(rest);
  }

  // Why the rotation is in the order it is. Steadfast grants gym gains PER
  // STAT, so leaving that invisible makes a reordered plan look broken.
  function steadfastHtml() {
    if (!hasGoals()) return "";
    var g = state.goals || {};
    var rows = HIST_KEYS.filter(function (k) {
      return (Number(g[k]) || 0) > (state.stats[k] || 0);
    }).map(function (k) {
      return { k: k, mult: (state.perks && state.perks[k]) || 1 };
    });
    if (rows.length < 2) return "";
    rows.sort(function (a, b) { return b.mult - a.mult; });
    // Every stat on the same bonus means the perk decides nothing, and a card
    // saying so is just noise.
    if (rows[0].mult === rows[rows.length - 1].mult) return "";
    var pinned = (state.goalOrder || []).length > 0;
    return '<div class="gc-card"><h3>Gym gain bonus</h3>' +
      rows.map(function (r, i) {
        return '<div class="row"><span>' + STAT_LABEL[r.k] + "</span><b class=\"" +
          (i === 0 ? "ok" : "muted") + '">' + perkPct(r.mult) +
          (i === 0 ? " \u00b7 best" : "") + "</b></div>";
      }).join("") +
      '<p class="muted" style="margin:8px 0 0">Faction Steadfast grants these per stat, ' +
      'so the same energy is worth more in ' + STAT_LABEL[rows[0].k] + '. Rotation legs ' +
      'go to the best bonus first' +
      (pinned ? ", except where you have raised a goal by hand." : ".") + "</p></div>";
  }

  // How high a stat may climb at rung L.
  //
  // Without a build every stat shares the same rung, which walks them toward
  // equal VALUES: the ladder trains whichever stat is numerically smallest,
  // and that is exactly what "stats rise together" should mean for four typed
  // goals.
  //
  // With a percentage build it is the wrong shape to climb. Equal rungs pull a
  // 50/30/20 account toward 33/33/33 and only bend back to the build at the
  // very end -- which is how Dexterity, 21 points OVER its share, got
  // scheduled ahead of Strength and Speed. Reported as "why is it telling me
  // to train dex if my ratio is over?".
  //
  // Scaling each rung by the stat's share fixes the shape rather than patching
  // the symptom: every stat climbs to its OWN fraction of the rung, so they
  // arrive at their targets together and the ratio holds the whole way up. An
  // over-share stat simply has no room at its rung and waits.
  function shareCap(k, L, target, shares, maxShare) {
    if (!shares || !(maxShare > 0)) return Math.min(L, target);
    return Math.min(L * (shares[k] || 0) / maxShare, target);
  }

  // What a book still being read will add to a stat. Zero once it lands,
  // because by then the stat itself carries it.
  function pendingBookAward(k) {
    var p = bookPending(k, (state.books || {})[k], Date.now());
    return p ? bookAward(k, state.stats) : 0;
  }

  function goalSegments(mf) {
    var keys = orderedGoalKeys(mf);
    if (!keys.length) return [];
    var g = state.goals || {};
    var targets = {}, cur = {};
    keys.forEach(function (k) {
      targets[k] = Number(g[k]) || 0;
      // A book still being read is a known gain with a date on it. Books take
      // 31 days and these plans run months, so counting it is the honest
      // reading -- and the Plan card shows the countdown, so the assumption is
      // on screen rather than buried inside an ETA.
      cur[k] = (state.stats[k] || 0) + pendingBookAward(k);
    });
    var step = Number(state.goalStep) || 0;
    var levels = goalLevels(step, targets);
    var shares = state.shares || null;
    var maxShare = 0;
    if (shares) HIST_KEYS.forEach(function (k) { if (shares[k] > maxShare) maxShare = shares[k]; });
    var segs = [], at = 0;
    levels.forEach(function (L) {
      keys.forEach(function (k) {
        var cap = shareCap(k, L, targets[k], shares, maxShare);
        if (cur[k] >= cap) return;
        var r = trainsTo(k, cur[k], cap, mf);
        if (!r || !r.trains) return;
        segs.push({ k: k, from: cur[k], to: r.end, cap: cap, target: targets[k],
                    trains: r.trains, at: at });
        at += r.trains;
        cur[k] = r.end;
      });
    });
    return segs;
  }

  // "How much energy until the next gym?" — Torn tracks this itself and paints
  // it as a whole-number percentage on gym.php; all this does is turn that
  // percentage back into energy and put a date on it.
  //
  // Deliberately silent rather than wrong in three cases: nothing scanned yet,
  // a reading left over from a gym you have since unlocked, and the specialist
  // gyms, which are gated on stat ratios and have no energy answer at all.
  function unlockHtml() {
    if (state.tab !== "trend") return "";
    var owned = state.gymsOwned || [];
    if (!owned.length) return "";
    var haveAll = true;
    for (var i = 0; i < 24; i++) if (owned.indexOf(i) === -1) { haveAll = false; break; }
    if (haveAll) {
      return '<div class="gc-card"><h3>Next gym unlock</h3>' +
        '<div class="muted">Every standard gym is unlocked, and George\'s is the end of the ' +
        'ladder — no more gym exp is earned past it. The specialist gyms are gated on stat ' +
        'ratios rather than energy, so there is no figure to give.</div></div>';
    }
    var u = state.unlock;
    if (!u) return "";
    // A gym you have since bought: the stored percentage belongs to a segment
    // that is over. Better to show nothing than to count down to something you
    // already own.
    if (owned.indexOf(u.gymId - 1) !== -1) return "";
    var est = unlockEstimate(u.gymId, u.pct, state.gymExpMult);
    if (!est || !est.gym) return "";

    var cal = calibration();
    var eff = dailyEnergy().total * (cal.ok ? cal.usage : 1);
    var days = eff > 0 ? Math.ceil(est.remainMax / eff) : 0;
    var perk = state.gymExpMult > 1
      ? ' · ' + perkPct(state.gymExpMult) + ' gym exp applied'
      : "";
    return '<div class="gc-card"><h3>Next gym unlock</h3>' +
      '<div class="muted" style="margin-bottom:8px">' + est.gym.Gym +
      " · " + fmt(est.req) + "e segment" + perk + "</div>" +
      '<div class="proj"><span>' + est.pct + '%</span><div class="bar"><i style="width:' +
      Math.max(2, Math.min(100, est.pct)) + '%"></i></div><b>' + fmt(est.remainMax) + "e</b></div>" +
      '<div class="muted" style="margin-top:8px">' +
      (est.remainMax <= 0
        ? "Segment done — the gym is earned. It opens when you Activate it and buy the membership, not by training more."
        : fmt(est.remainMin) + "–" + fmt(est.remainMax) + "e still to train" +
          (days > 0 ? ", about " + days + " day" + (days === 1 ? "" : "s") +
            " at " + fmt(Math.round(eff)) + "e a day" : "")) +
      // Torn shows whole percents only, so the truth sits inside that percent.
      // Quoting one number here would be false precision.
      "</div></div>";
  }

  function goalPlan() {
    var cal = calibration();
    var e = dailyEnergy().total;
    // The plan's energy is what you INTEND to spend. The usage factor turns it
    // into what you have actually been spending, which is what an honest ETA
    // has to be built on.
    var eff = cal.ok ? e * cal.usage : e;
    var st = state.stats || {};
    var g = state.goals || {};
    // Perks and shares BELONG in this key. Both decide the rotation order, and
    // both arrive after the first render -- perks from the API, shares from
    // storage -- so a key without them froze whichever plan happened to be
    // computed first and never recomputed it. That is what made the card say
    // "Strength next" while the verdict trained Speed: the card asked the live
    // share picker and the verdict read a plan cached before the Steadfast
    // bonuses existed.
    var pk = state.perks || {};
    var sh = state.shares || {};
    var bkk = state.books || {};
    var key = [e, state.gymName, state.happyMax, st.str, st.def, st.spe, st.dex,
               g.str, g.def, g.spe, g.dex, state.goalStep,
               (state.goalOrder || []).join(","),
               pk.str, pk.def, pk.spe, pk.dex,
               // Ticking a book changes every ETA, so it belongs in the key --
               // the same omission that froze a stale plan for perks.
               bkk.str, bkk.def, bkk.spe, bkk.dex,
               sh.str, sh.def, sh.spe, sh.dex, state.shareTotal,
               cal.ok ? cal.model.toFixed(4) + "/" + cal.usage.toFixed(4) : "raw"].join("|");
    if (goalCache.key === key && goalCache.val) return goalCache.val;

    var mf = cal.ok ? cal.model : 1;
    var segs = goalSegments(mf);
    var perDay = trainsPerDay(eff);
    // Trains only become days here, once, at the end.
    var toDays = function (t) { return perDay > 0 ? t / perDay : Infinity; };

    var byStat = {};
    var totalTrains = 0;
    segs.forEach(function (sg) {
      var r = byStat[sg.k];
      if (!r) {
        r = byStat[sg.k] = { k: sg.k, target: sg.target, cur: st[sg.k] || 0,
                             done: false, trains: 0, startTrains: sg.at, endTrains: 0 };
      }
      r.trains += sg.trains;
      r.endTrains = sg.at + sg.trains;
      totalTrains += sg.trains;
    });

    var rows = [];
    HIST_KEYS.forEach(function (k) {
      var target = Number(g[k]) || 0;
      if (!target) return;
      var cur = st[k] || 0;
      var r = byStat[k];
      if (r) {
        r.days = toDays(r.trains);
        r.startsIn = toDays(r.startTrains);
        r.doneIn = toDays(r.endTrains);
        rows.push(r);
      } else {
        // Either already reached, or no dots for it at this gym.
        rows.push({ k: k, target: target, cur: cur, done: cur >= target,
                    trains: 0, days: cur >= target ? 0 : Infinity,
                    startsIn: 0, doneIn: cur >= target ? 0 : Infinity });
      }
    });
    // Finished goals sink to the bottom; the rest keep the order they are
    // actually trained in, which is the schedule's order, not a re-sort.
    rows.sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return (a.startsIn || 0) - (b.startsIn || 0);
    });

    var out = {
      rows: rows, segments: segs, cal: cal, energy: eff,
      perDay: perDay, totalTrains: totalTrains,
      total: toDays(totalTrains),
      now: segs.length ? segs[0] : null,
      next: null,
      step: Number(state.goalStep) || 0
    };
    for (var i = 0; i < rows.length; i++) if (!rows[i].done) { out.next = rows[i]; break; }
    goalCache.key = key;
    goalCache.val = out;
    return out;
  }

  // What the whole schedule costs in days at some other daily energy. Trains
  // are fixed by the gym, so this is a division rather than another walk — and
  // it is exact, where re-walking each leg would re-round every one of them.
  function scheduleDays(totalTrains, energyPerDay) {
    var per = trainsPerDay(energyPerDay);
    return per > 0 ? totalTrains / per : Infinity;
  }

  // --- prices and value ------------------------------------------------------
  // Ranking money against time needs a price, and the price that matters is the
  // cheapest one you can actually buy at. weav3r.dev mirrors both halves of the
  // item market in one unauthenticated call — the market price AND live bazaar
  // listings — so this costs nothing from Torn's 100-a-minute budget. Torn's own
  // item market is the fallback if that host is unreachable: one API call, and
  // the bazaar half is lost.
  var PRICE_TTL = 6 * 3600 * 1000;
  var PRICE_HOST = "https://weav3r.dev/api/marketplace/";
  var XAN_ID = 206, FHC_ID = 367;

  function canIdFor(k) {
    for (var i = 0; i < CAN_TYPES.length; i++) {
      if (CAN_TYPES[i].k === k) return CAN_TYPES[i].ids[0];
    }
    return 0;
  }

  function srcItemId(k) {
    if (k === "xan") return XAN_ID;
    if (k === "fhc") return FHC_ID;
    return canIdFor(k);
  }

  function priceOf(id) {
    var p = state.prices[String(id)];
    return p && p.p > 0 ? p.p : 0;
  }

  function priceStale(id) {
    var p = state.prices[String(id)];
    return !p || !(p.at > Date.now() - PRICE_TTL);
  }

  // Cheapest of every live bazaar listing and the item-market price. A zero or a
  // missing array means "no price known", never "free" — item pages with no
  // listings answer exactly that way.
  function parseWeav3r(d) {
    if (!d || typeof d !== "object") return 0;
    var best = 0;
    if (Array.isArray(d.listings)) {
      d.listings.forEach(function (l) {
        var v = Number(l && l.price) || 0;
        if (v > 0 && (!best || v < best)) best = v;
      });
    }
    var mk = Number(d.market_price) || 0;
    if (mk > 0 && (!best || mk < best)) best = mk;
    return best;
  }

  // Torn has answered item-market listings in more than one shape across v1 and
  // v2, so walk for the cheapest cost/price rather than pinning one layout.
  function parseTornMarket(d) {
    var best = 0;
    function walk(n, depth) {
      if (!n || depth > 4 || typeof n !== "object") return;
      if (Array.isArray(n)) { n.forEach(function (x) { walk(x, depth + 1); }); return; }
      var v = Number(n.cost || n.price) || 0;
      if (v > 0 && (!best || v < best)) best = v;
      for (var k in n) if (n[k] && typeof n[k] === "object") walk(n[k], depth + 1);
    }
    walk(d && (d.itemmarket || d), 0);
    return best;
  }

  function setPrice(id, p, src) {
    if (!(p > 0)) return false;
    state.prices[String(id)] = { p: p, at: Date.now(), src: src };
    storeSet("prices", state.prices);
    return true;
  }

  var pricesInFlight = 0;

  function fetchPrice(id) {
    return httpGet(PRICE_HOST + id + "?limit=5").then(function (d) {
      var p = parseWeav3r(d);
      if (p > 0) return setPrice(id, p, "bazaar");
      throw new Error("no listing");
    }).catch(function () {
      // weav3r unreachable or silent: fall back to Torn's own item market. Costs
      // one call from the key budget, which is why it is not the first choice.
      var key = resolveKey();
      if (!key) return false;
      return httpGet("https://api.torn.com/market/" + id + "?selections=itemmarket&key=" +
                     encodeURIComponent(key) + "&comment=" + encodeURIComponent(COMMENT))
        .then(function (d2) { return setPrice(id, parseTornMarket(d2), "market"); })
        .catch(function () { return false; });
    });
  }

  function refreshPrices() {
    if (pricesInFlight) return;
    // Nothing on screen needs a price until there is a goal to shorten, so no
    // goal means no outbound request at all.
    if (!hasGoals()) return;
    var want = [];
    valueCandidates().forEach(function (c) {
      if (priceStale(c.id) && want.indexOf(c.id) === -1) want.push(c.id);
    });
    if (!want.length) return;
    pricesInFlight = want.length;
    var got = 0;
    want.forEach(function (id) {
      fetchPrice(id).then(function (ok) { if (ok) got += 1; }).catch(function () {})
        .then(function () {
          pricesInFlight -= 1;
          if (!pricesInFlight && got) renderPanel();
        });
    });
  }

  // One more of each thing, every day, for as long as the goal takes. Refills
  // are bought with points rather than money and Mc Smoogle is capital you keep
  // rather than money you spend, so neither belongs in a per-day cost ranking.
  function valueCandidates() {
    var out = [];
    srcRows().forEach(function (r) {
      if (r.k === "refill" || r.k === "mcs") return;
      var id = srcItemId(r.k);
      if (!id) return;
      out.push({ k: r.k, label: r.label, id: id, e: r.e || (state.energyMax || 150),
                 grp: r.grp || "" });
    });
    return out;
  }

  // One more a day is the natural question, but against a 2,000e plan one more
  // can is a rounding error and the row would simply vanish — which reads as
  // "cans do nothing" rather than "one is not enough". So step up to the
  // smallest daily count that actually moves the finish date, and say which.
  var VALUE_STEPS = [1, 2, 3, 5, 10, 15, 20, 24];
  var MCS_MAX_EXTRA = 4;  // the block tops out at five increments
  var VALUE_STEP_MAX_DAYS = 400; // past this, one a day always shows a change

  var valueCache = { key: "", val: null };

  function valuePlan() {
    var plan = hasGoals() ? goalPlan() : null;
    if (!plan || !(plan.totalTrains > 0)) return null;
    var cal = plan.cal;
    // Against the WHOLE schedule, not the leg you happen to be on. With an
    // increment set, "until Strength is done" is a ten-day milestone, and
    // pricing a can against that reads as an absurd cost per day saved.
    var base = plan.total;
    if (!isFinite(base)) return null;

    var sig = [plan.totalTrains, base, plan.energy, plan.step,
               cal && cal.ok ? cal.model.toFixed(4) + "/" + cal.usage.toFixed(4) : "raw",
               state.mcsCost].join("|");
    valueCandidates().forEach(function (c) { sig += "|" + c.id + ":" + priceOf(c.id); });
    if (valueCache.key === sig && valueCache.val) return valueCache.val;

    var rows = [];
    valueCandidates().forEach(function (c) {
      // The added energy goes through the same usage factor the baseline did,
      // or the two ETAs are not measured the same way and the diff is fiction.
      var per = c.e * (cal && cal.ok ? cal.usage : 1);
      var steps = base <= VALUE_STEP_MAX_DAYS ? VALUE_STEPS : [1];
      var n = 0, days = base;
      for (var i = 0; i < steps.length; i++) {
        var d = scheduleDays(plan.totalTrains, (plan.energy || 0) + per * steps[i]);
        if (!isFinite(d)) continue;
        if (d < base) { n = steps[i]; days = d; break; }
      }
      if (!n) return;   // not even 24 a day changes the finish date
      var saved = base - days;
      var price = priceOf(c.id);
      var spend = price * n;   // per day, at the count this row is quoting
      rows.push({
        k: c.k, label: c.label, id: c.id, e: c.e, n: n, price: price, grp: c.grp || "",
        src: (state.prices[String(c.id)] || {}).src || "",
        days: days, saved: saved,
        total: price > 0 ? spend * days : 0,
        each: price > 0 ? (spend * days) / saved : 0
      });
    });
    // Two different scarcities, so two different orderings.
    //
    // A xanax or a coupon costs money and nothing else, so cheapest-per-day-
    // saved is the whole answer. A CAN also costs a booster slot — every can is
    // 2h on the cooldown whatever its strength, and a 48h ceiling refilling at
    // 24h a day is about twelve slots, full stop. Ranking cans by money put a
    // Goose Juice above a Red Cow because 8e for $433k is cheaper PER ENERGY
    // than 38e for $2.39m; it is also a quarter of the energy in an identical
    // slot, which is the cost that actually binds once the booster is high.
    //
    // So cans sort by energy — with the slot fixed, energy per booster-hour is
    // just e/2 and ranking by it is ranking by strength — and money only breaks
    // ties between equals. Everything else keeps the money ranking.
    rows.sort(function (a, b) {
      if ((a.price > 0) !== (b.price > 0)) return a.price > 0 ? -1 : 1;
      var ac = a.grp === "cans", bc = b.grp === "cans";
      if (ac !== bc) return ac ? 1 : -1;          // cans as a block, after the rest
      if (ac && bc) {
        if (b.e !== a.e) return b.e - a.e;        // the slot is fixed: take the most energy
        if (a.price > 0 && b.price > 0) return a.price - b.price;
        return 0;
      }
      if (a.price > 0) return a.each - b.each;
      return b.saved - a.saved;
    });
    // Mc Smoogle is bought in whole increments and each pays 100e a week, so it
    // gets the same smallest-count-that-matters treatment as the consumables —
    // but it is capital you keep, not money you spend, so it is not ranked
    // alongside them.
    var mcsPer = (100 / 7) * (cal && cal.ok ? cal.usage : 1);
    var mcs = { n: 0, days: base, saved: 0 };
    for (var mi = 1; mi <= MCS_MAX_EXTRA; mi++) {
      var md = scheduleDays(plan.totalTrains, (plan.energy || 0) + mcsPer * mi);
      if (isFinite(md) && md < base) { mcs = { n: mi, days: md, saved: base - md }; break; }
    }

    var out = { goal: plan.next, base: base, rows: rows, mcs: mcs, cal: cal,
                everything: plan.rows.filter(function (r) { return !r.done; }).length > 1 };
    valueCache.key = sig;
    valueCache.val = out;
    return out;
  }

  // Three caches hold a shape derived from the schedule. Anything that changes
  // the schedule has to clear all three, so they are cleared together rather
  // than remembered separately at each call site.
  function resetPlanCaches() {
    goalCache.key = "";
    histProjCache.key = "";
    valueCache.key = "";
  }

  // Move a stat one place earlier in the training order. The stored order is
  // seeded from the current running order the first time it is touched, so a
  // single tap does not scramble everything else into some default.
  function raiseGoal(k) {
    var plan = hasGoals() ? goalPlan() : null;
    if (!plan) return;
    var cur = plan.rows.filter(function (r) { return !r.done; }).map(function (r) { return r.k; });
    var i = cur.indexOf(k);
    if (i <= 0) return;
    cur.splice(i, 1);
    cur.splice(i - 1, 0, k);
    state.goalOrder = cur;
    storeSet("goalOrder", cur);
    resetPlanCaches();
    applyGoalFocus();
    renderPanel();
  }

  function hasGoals() {
    var g = state.goals || {};
    return !!(g.str || g.def || g.spe || g.dex);
  }

  // --- percentage builds ----------------------------------------------------
  // A fixed goal says nothing about SHAPE. "Strength 1b" has to be retyped
  // every time it lands and says nothing about the other three, so anyone
  // following a published build re-does the arithmetic by hand forever.
  // Shares are how builds are actually quoted -- and they are already on
  // screen, since torn-gym-stat-percentages draws these very numbers on
  // gym.php.

  // What was typed, as percentages of the total.
  //
  // Normalised rather than validated, so 4:3:2:1 and 40/30/20/10 mean the same
  // build and nobody has to do the division. A zero survives it and means
  // NEVER TRAIN THIS -- plenty of builds ignore Defense outright, and that is
  // not the same as a goal of zero.
  function normalizeShares(raw) {
    if (!raw) return null;
    var out = {}, sum = 0;
    HIST_KEYS.forEach(function (k) {
      var v = Number(raw[k]);
      // Anything unreadable or negative is zero, not a value that poisons the
      // sum and silently rescales every other stat.
      out[k] = isFinite(v) && v > 0 ? v : 0;
      sum += out[k];
    });
    if (sum <= 0) return null;
    HIST_KEYS.forEach(function (k) { out[k] = out[k] / sum * 100; });
    return out;
  }

  // Shares plus a total goal become the four absolute targets the existing
  // planner already reads, so segments, ETAs, Steadfast ordering and the
  // "Worth it?" pricing all keep working untouched.
  //
  // No total is not a total of zero: it is maintain mode, which has no
  // endpoint by design.
  function shareTargets(shares, totalGoal) {
    var tot = Number(totalGoal) || 0;
    if (!shares || tot <= 0) return null;
    var out = {};
    HIST_KEYS.forEach(function (k) { out[k] = Math.round(tot * (shares[k] || 0) / 100); });
    return out;
  }

  // Where you actually are against the build, worst deficit first.
  function shareState(shares, stats) {
    if (!shares) return [];
    var st = stats || {};
    var tot = 0;
    HIST_KEYS.forEach(function (k) { tot += Number(st[k]) || 0; });
    return HIST_KEYS.map(function (k) {
      var have = tot > 0 ? (Number(st[k]) || 0) / tot * 100 : 0;
      return { k: k, want: shares[k] || 0, have: have, delta: (shares[k] || 0) - have };
    }).sort(function (a, b) { return b.delta - a.delta; });
  }

  // Which stat the next leg goes to.
  //
  // Being UNDER your share makes a stat a candidate; among the candidates the
  // best gym bonus wins. Not the other way round, and the reported case is
  // why: on Str 50 / Spe 30 / Dex 20 / Def 0, Speed was 14.9 points under and
  // Strength 12.1, so ranking by deficit sent every session to Speed at +10%
  // while Strength sat at +13%. Both were under and both had to be trained
  // eventually, so taking the worse multiplier first is simply less stat for
  // the same energy -- and maintain mode has no deadline, so the ORDER costs
  // nothing while the multiplier costs 3% of every session.
  //
  // It still converges: train the high-bonus stat and its share climbs until
  // it is no longer under, at which point it drops out of the running and the
  // next one takes over. The shape is held by the FILTER, not by the ranking.
  //
  // A stat that is OVER never wins however good its bonus -- training it moves
  // the build away from its shape, which is the one thing the shape is for.
  function shareNextStat(shares, stats, perks) {
    if (!shares) return "";
    // A zero share is excluded outright: you asked for none of it, so however
    // much of it you have is not a deficit.
    var rows = shareState(shares, stats).filter(function (r) { return r.want > 0; });
    if (!rows.length) return "";
    var p = perks || {};
    var under = rows.filter(function (r) { return r.delta > 0; });
    if (!under.length) {
      // Nothing is under, so there is nothing for the bonus to rank between:
      // the stat closest to needing training is next. shareState is already
      // sorted by deficit, so that is the head.
      return rows[0].k;
    }
    var best = under[0];
    under.forEach(function (r) {
      // Deficit already ordered `under`, so a strict ">" keeps the bigger gap
      // when two stats share a bonus.
      if ((p[r.k] || 1) > (p[best.k] || 1)) best = r;
    });
    return best.k;
  }

  // Goals drive the focus. Everything downstream — the verdict, the steps, the
  // projection — already keys off state.focus, so this is the only wiring the
  // rest of the script needs.
  function applyGoalFocus() {
    // A percentage build fills the same four numbers a typed goal does, so
    // everything downstream -- segments, ETAs, Steadfast ordering, the
    // "Worth it?" pricing -- runs unchanged on top of it.
    if (state.shares) {
      var derived = shareTargets(state.shares, state.shareTotal);
      if (derived) {
        state.goals = derived;
      } else {
        // Maintain mode: no endpoint, so there are no targets to plan toward.
        // The leg goes to whichever stat is furthest below its share, which is
        // the point of asking for a build rather than a number.
        var sk = shareNextStat(state.shares, state.stats, state.perks);
        if (sk && sk !== state.focus) {
          state.focus = sk;
          storeSet("focus", sk);
        }
        return;
      }
    }
    if (!hasGoals()) return;
    var plan = goalPlan();
    // The leg being trained right now, which under rotation is not the same as
    // the stat whose goal finishes first.
    var k = plan.now ? plan.now.k : plan.next ? plan.next.k : "";
    if (k && k !== state.focus) {
      state.focus = k;
      // Persisted, not just held in memory. Without this the stored focus keeps
      // whatever was last picked by hand — "str" for anyone who never picked —
      // and every cold start reads that back before any render has had the
      // chance to derive the real one.
      storeSet("focus", k);
    }
  }

  function dailyEnergy() {
    var natural = Math.round(86400 / energyRate());
    var out = { natural: natural, xan: 0, refill: 0, fhc: 0, cans: 0, mcs: 0, total: 0 };
    var extra = 0;
    srcRows().forEach(function (r) {
      // War stacking means the xans are being banked, not spent on the gym.
      if (r.k === "xan" && state.warStack) return;
      var v = srcEnergy(r.k);
      extra += v;
      if (r.grp === "cans") out.cans += v;
      else out[r.k] = (out[r.k] || 0) + v;
    });
    // Sum what was actually counted. Naming each bucket meant a source added
    // later was shown in the list and silently left out of the total.
    out.total = natural + extra;
    return out;
  }

  var SRC_PRESETS = [
    { id: "xan",       label: "Xan",         set: { xan: 3, refill: 0, fhc: 0, munster: 0, redcow: 0, tourine: 0 } },
    { id: "xanref",    label: "Xan + refill", set: { xan: 3, refill: 1, fhc: 0, munster: 0, redcow: 0, tourine: 0 } },
    { id: "xanrefcan", label: "+ cans",      set: { xan: 3, refill: 1, fhc: 0, munster: 0, redcow: 4, tourine: 0 } },
    { id: "all",       label: "Everything",  set: { xan: 4, refill: 1, fhc: 1, munster: 0, redcow: 0, tourine: 8 } }
  ];

  function srcPresetId() {
    for (var i = 0; i < SRC_PRESETS.length; i++) {
      var p = SRC_PRESETS[i], hit = true;
      for (var k in p.set) if (srcCount(k) !== p.set[k]) { hit = false; break; }
      if (hit) return p.id;
    }
    return "";
  }

  // The manual pickers. Only shown when no goals are set — with goals, the
  // coach chooses the stat and a picker beside it would just contradict it.
  function pickerCards() {
    return (
      '<div class="gc-card"><h3>Priority skill</h3><p class="muted">Everything the coach says — training, happy jumps, projections — applies to this stat first.</p><div class="pick">' +
      [
        ["str", "Strength"],
        ["def", "Defense"],
        ["spe", "Speed"],
        ["dex", "Dexterity"],
      ]
        .map(function (p) {
          return pickBtn("focus", p[0], p[1], state.focus === p[0]);
        })
        .join("") +
      "</div></div>" +
      '<div class="gc-card"><h3>Second skill</h3><p class="muted">Optional. After the main training session, leftover energy can go here. Leave none if you only train one stat.</p><div class="pick">' +
      [["none", "None"]]
        .concat([
          ["str", "Strength"],
          ["def", "Defense"],
          ["spe", "Speed"],
          ["dex", "Dexterity"],
        ])
        .map(function (p) {
          return pickBtn("focus2", p[0], p[1], (state.focus2 || "none") === p[0]);
        })
        .join("") +
      "</div></div>"
    );
  }

  var STAT_LABEL = { str: "Strength", def: "Defense", spe: "Speed", dex: "Dexterity" };

  function stepLabel(v) {
    if (!v) return "Off";
    return v >= 1e9 ? v / 1e9 + "b" : Math.round(v / 1e6) + "m";
  }

  // The build, as shares of your total.
  //
  // Deliberately the same numbers torn-gym-stat-percentages already paints on
  // gym.php, because that is the vocabulary people quote builds in and the one
  // already on screen.
  // The four stat books, and what finishing one is worth.
  function booksHtml() {
    var now = Date.now();
    function bookRow(k) {
      var p = bookPending(k, (state.books || {})[k], now);
      var award = bookAward(k, state.stats);
      var exact = (state.booksExact || {})[k];
      // Hours once it is close. "1d left" for something finishing this evening
      // is the least useful way to say it.
      var left = !p ? "" :
        p.finishesAt - now < 172800000
          ? Math.max(1, Math.round((p.finishesAt - now) / 3600000)) + "h left"
          : p.daysLeft + "d left";
      return '<div class="row"><span>' + STAT_LABEL[k] +
        '<span class="muted"> \u00b7 ' + esc(STAT_BOOKS[k].name) + "</span></span>" +
        '<button type="button" class="gc-btn secondary" data-book="' + k + '" ' +
        'style="width:auto;min-height:0;padding:5px 11px;font-size:12px' +
        (p ? ";background:#2ecc71;color:#08131c" : "") + '">' +
        (p ? left + " \u00b7 +" + fmt(award) : "reading?") + "</button>" +
        (p && !exact && (state.booksAuto || {})[k]
          ? '<span class="muted" style="flex:1 1 100%;font-size:11px">spotted on the page, but Torn does not say when you started \u2014 counted from when this device first saw it, so this is the LATEST it can finish</span>'
          : p && exact
          ? '<span class="muted" style="flex:1 1 100%;font-size:11px">dated from your item log, so this is exact</span>'
          : "") + "</div>";
    }

    // Only the book you are actually on.
    //
    // Four rows, three of them saying "reading?", is three lines of noise
    // around the one that matters. The others stay reachable -- a tap is still
    // how you record a book the page cannot show -- but they fold away behind
    // one line until then.
    var live = HIST_KEYS.filter(function (k) { return !!bookPending(k, (state.books || {})[k], now); });
    var rest = HIST_KEYS.filter(function (k) { return live.indexOf(k) === -1; });
    var rows = live.length
      ? live.map(bookRow).join("") +
        '<div class="row"><span class="muted" style="font-size:11px">Reading a different one?</span>' +
        rest.map(function (k) {
          return '<button type="button" class="gc-btn secondary" data-book="' + k + '" ' +
            'style="width:auto;min-height:0;padding:4px 9px;font-size:11px;margin-left:6px">' +
            esc(STAT_LABEL[k]) + "</button>";
        }).join("") + "</div>"
      : HIST_KEYS.map(bookRow).join("");
    // What the page actually said, in Torn's words. Present whether or not a
    // book was recognised, because "recognised nothing" and "saw nothing" are
    // different failures and the wording is what tells them apart.
    var diag = '<p class="muted" style="margin:8px 0 0;font-size:11px;overflow-wrap:anywhere">' +
      (state.bookDiag ? esc(state.bookDiag) : "no status-icon strip on this page, so nothing was read") +
      (state.bookLogDiag ? "<br>" + esc(state.bookLogDiag) : "") +
      "</p>";
    var counted = HIST_KEYS.filter(function (k) { return pendingBookAward(k) > 0; });
    return '<div class="gc-card"><h3>Stat books</h3>' + rows + diag +
      '<p class="muted" style="margin:8px 0 0">Each awards +' + Math.round(BOOK_PCT * 100) +
      "% of the stat, capped at " + fmt(BOOK_CAP) + ", after " + BOOK_DAYS +
      " days. Tap when you start reading one and the plan below counts it \u2014 " +
      "it is a known gain with a date, and the dates were being drawn as if it " +
      "were not coming. It stops counting the moment it lands, because by then " +
      "the stat itself carries it." +
      (counted.length ? " Counting: " + counted.map(function (k) { return STAT_LABEL[k]; }).join(", ") + "." : "") +
      "</p></div>";
  }

  function sharesHtml() {
    var raw = state.sharesRaw || {};
    var rows = state.shares ? shareState(state.shares, state.stats) : [];
    var maintaining = state.shares && !shareTargets(state.shares, state.shareTotal);

    var inputs = HIST_KEYS.map(function (k) {
      return '<div class="row"><span>' + STAT_LABEL[k] + "</span>" +
        '<input class="gc-in gcb-gin" data-share="' + k + '" type="text" inputmode="decimal" ' +
        'style="width:72px;text-align:right" placeholder="0" value="' +
        esc(raw[k] ? String(raw[k]) : "") + '"></div>';
    }).join("");

    // Which one is actually next. The rows are ordered by deficit, but the
    // deepest deficit is NOT the pick -- the gym bonus decides among the stats
    // that are under -- so without this the top row reads as "next" and
    // quietly contradicts the verdict.
    // With a total goal the PLANNER decides the leg, so the marker follows
    // state.focus -- otherwise the card can say "Strength next" while the
    // verdict trains Speed, which is exactly what it did. Only maintain mode,
    // where there is no planner, asks the share picker directly.
    var nextK = !state.shares ? ""
      : shareTargets(state.shares, state.shareTotal) ? (state.focus || "")
      : shareNextStat(state.shares, state.stats, state.perks);
    // Only worth showing when the bonuses actually differ. Every stat on the
    // same multiplier means Steadfast decides nothing, and printing "+3%" four
    // times is noise -- the same reasoning the Gym gain bonus card already
    // applies before it draws itself at all.
    var pk = state.perks || {};
    var mults = HIST_KEYS.map(function (k) { return pk[k] || 1; });
    var showBonus = Math.max.apply(null, mults) !== Math.min.apply(null, mults);
    var table = rows.length
      ? rows.map(function (r) {
          var over = r.delta < -0.005;
          var bonus = (state.perks && state.perks[r.k]) || 1;
          return '<div class="row"><span>' + STAT_LABEL[r.k] +
            '<span class="muted"> \u00b7 want ' + r.want.toFixed(0) + "%" +
            (showBonus ? " \u00b7 " + perkPct(bonus) : "") + "</span>" +
            (r.k === nextK ? '<b class="ok"> \u00b7 next</b>' : "") + "</span>" +
            '<b class="' + (r.want <= 0 ? "muted" : over ? "" : "bad") + '">' +
            r.have.toFixed(1) + "%" +
            (r.want <= 0 ? " \u00b7 not trained"
              : over ? " \u00b7 " + Math.abs(r.delta).toFixed(1) + " over"
              : " \u00b7 " + r.delta.toFixed(1) + " under") + "</b></div>";
        }).join("")
      : '<p class="muted">Enter a share for each stat. Any scale works \u2014 40/30/20/10 and 4/3/2/1 are the same build. Leave one at 0 to never train it.</p>';

    return '<div class="gc-card"><h3>Build by percentage</h3>' +
      inputs +
      '<div class="row"><span>Total stat goal<span class="muted"> \u00b7 optional</span></span>' +
        '<input class="gc-in gcb-gin" data-sharetotal="1" type="text" inputmode="decimal" ' +
        'style="width:110px;text-align:right" placeholder="maintain" value="' +
        esc(state.shareTotal ? fmt(state.shareTotal) : "") + '"></div>' +
      (rows.length ? '<div style="height:8px"></div>' + table : table) +
      '<p class="muted" style="margin:8px 0 0">' +
      (maintaining
        ? "Maintain mode: no end date. Being under your share puts a stat in the running; among those the best Steadfast bonus goes first, since the same energy is worth more there and both have to be trained anyway. A stat that is OVER cannot be trained down \u2014 it comes back on build as the others grow."
        : state.shares
          ? "Shares of a " + fmt(state.shareTotal) + " total become the four goals below, so the dates and the rest of the plan work exactly as they do for typed goals."
          : "Set a total as well and these become dated goals. Leave it blank and the coach just holds you on build as you grow.") +
      "</p></div>";
  }

  function goalsHtml() {
    var plan = hasGoals() ? goalPlan() : null;
    var nowK = plan && plan.now ? plan.now.k : plan && plan.next ? plan.next.k : "";
    var order = plan ? plan.rows.filter(function (r) { return !r.done; }).map(function (r) { return r.k; }) : [];

    // In the order they will be trained, so the arrow visibly does something.
    // Rendering in a fixed stat order meant reordering changed only a line of
    // small print and read as having done nothing at all.
    var listed = plan ? plan.rows.map(function (r) { return r.k; }) : [];
    HIST_KEYS.forEach(function (k) { if (listed.indexOf(k) === -1) listed.push(k); });

    var rows = listed.map(function (k) {
      var target = Number((state.goals || {})[k]) || 0;
      var cur = state.stats[k] || 0;
      var row = null;
      if (plan) plan.rows.forEach(function (r) { if (r.k === k) row = r; });
      var note = "";
      if (row) {
        if (row.done) note = "reached";
        else if (!isFinite(row.days)) note = "not reachable at this rate";
        else note = fmtDays(row.days) + " of training" +
          (row.startsIn > 0 ? ", starting in " + fmtDays(row.startsIn) : "") +
          " \u00b7 done in " + fmtDays(row.doneIn);
      }
      // The arrow only appears where it can do something: on a goal that is not
      // finished and is not already first in the running order.
      var pos = order.indexOf(k);
      var canRaise = pos > 0;
      return (
        '<div class="gcb-goal' + (row && row.done ? " done" : "") + (k === nowK ? " now" : "") + '">' +
        '<div class="gcb-gtop"><span class="gcb-gname">' +
        (canRaise
          ? '<button class="gcb-up" data-raise="' + k + '" title="Train this sooner" aria-label="Move ' +
            STAT_LABEL[k] + ' earlier">\u25b2</button>'
          : '<span class="gcb-up ghost" aria-hidden="true">\u25b2</span>') +
        STAT_LABEL[k] + "</span>" +
        '<span class="gcb-gcur">' + fmt(cur) + "</span></div>" +
        '<input class="gc-in gcb-gin" data-goal="' + k + '" type="text" inputmode="decimal" ' +
        'autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" ' +
        'placeholder="no goal" value="' + (target ? esc(fmt(target)) : "") + '">' +
        (note ? '<div class="gcb-gnote">' + note + "</div>" : "") +
        "</div>"
      );
    }).join("");

    var step = Number(state.goalStep) || 0;
    var picker =
      '<div class="row" style="margin-top:10px"><span>Rotate every</span></div>' +
      '<div class="pick">' +
      GOAL_STEPS.map(function (v) {
        return pickBtn("goalstep", String(v), stepLabel(v), step === v);
      }).join("") +
      "</div>";

    var summary;
    if (!plan || !plan.rows.length) {
      summary = '<p class="muted" style="margin:8px 0 0">Set a target on any stat and the coach trains toward it. Type a number, or shorthand like 150m or 1.2b.</p>';
    } else if (!plan.next) {
      summary = '<p class="ok" style="margin:8px 0 0">Every goal reached.</p>';
    } else {
      var legs = plan.segments.length;
      var nowSeg = plan.now;
      summary =
        '<div class="row" style="margin-top:8px"><span>Training now</span><b class="ok">' +
        (nowSeg ? STAT_LABEL[nowSeg.k] : STAT_LABEL[plan.next.k]) + "</b></div>" +
        (nowSeg && step > 0
          ? '<div class="row"><span>Until</span><b>' + fmt(Math.round(nowSeg.cap)) + "</b></div>" +
            '<div class="row"><span>Then switch in</span><b>' +
            fmtDays(nowSeg.trains / (plan.perDay || 1)) + "</b></div>"
          : "") +
        '<div class="row"><span>All goals done in</span><b>' + fmtDays(plan.total) + "</b></div>" +
        '<p class="muted" style="margin:8px 0 0">' +
        (step > 0
          ? "Every stat climbs to the next " + stepLabel(step) +
            " in turn, so they rise together instead of one finishing months before the next starts \u2014 " +
            legs + " legs in all. Interleaving is free: a stat\u2019s gains depend only on its own value, " +
            "so the total is the same either way."
          : "One stat at a time, in the order below. Set a rotation above to keep them level instead.") +
        " At " + fmt(Math.round(plan.energy || dailyEnergy().total)) + "e a day at " +
        (state.gymName || "your gym") +
        (plan.cal && plan.cal.ok ? ", from what you have really been spending" : "") +
        ". The \u25b2 moves a stat earlier in the order.</p>";
    }
    return '<div class="gc-card"><h3>Goals</h3><div class="gcb-goals">' + rows + "</div>" +
      picker + summary + "</div>" +
      calibrationHtml(plan) + valueHtml();
  }

  // How far off the model reads, in words rather than a bare ratio.
  // Money, short enough to sit in a row on a phone.
  function fmtMoney(n) {
    n = Math.round(Number(n) || 0);
    if (n <= 0) return "\u2014";
    if (n >= 1e9) return "$" + (n / 1e9).toFixed(n >= 1e10 ? 0 : 2) + "b";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + "m";
    if (n >= 1e3) return "$" + Math.round(n / 1e3) + "k";
    return "$" + n;
  }

  function valueHtml() {
    var vp = valuePlan();
    if (!vp) return "";
    var priced = 0;
    vp.rows.forEach(function (r) { if (r.price > 0) priced += 1; });

    var mcs = vp.mcs || { n: 0, saved: 0 };
    var mcsCost = state.mcsCost > 0 ? state.mcsCost * mcs.n : 0;

    var rows = vp.rows.map(function (r) {
      var right = r.price > 0
        ? fmtMoney(r.price * r.n) + (r.n > 1 ? " a day" : " each")
        : '<span class="muted">no price yet</span>';
      var note = fmtDays(r.saved) + " sooner" +
        (r.price > 0
          ? " \u00b7 " + fmtMoney(r.total) + " over the whole plan \u00b7 " +
            fmtMoney(r.each) + " a day saved"
          : "") +
        // The figure that decides between cans. Every can is 2h of booster
        // whatever it holds, so this is what the slot is actually worth.
        (r.grp === "cans" ? " \u00b7 " + fmt(Math.round(r.e / 2)) + "e per booster-hour" : "");
      return (
        '<div class="gcb-val">' +
        '<div class="gcb-gtop"><span class="gcb-gname">' + esc(r.label) +
        (r.n > 1 ? " \u00d7" + r.n + " a day, +" + fmt(r.e * r.n) + "e"
                 : " +" + fmt(r.e) + "e a day") + "</span>" +
        "<span class=\"gcb-gcur\">" + right + "</span></div>" +
        '<div class="gcb-gnote">' + note + "</div></div>"
      );
    }).join("");

    return (
      '<div class="gc-card"><h3>Worth it?</h3>' +
      // `base` is the WHOLE schedule — plan.total — so naming one stat here was
      // simply wrong once there was more than one goal. Name the single goal
      // when there is only one, and say "every goal" when there are several.
      '<p class="muted" style="margin:0 0 8px">One more a day, every day, until ' +
      (vp.everything ? "every goal is done"
                     : STAT_LABEL[vp.goal.k] + " is done") +
      " \u2014 " + fmtDays(vp.base) + " as things stand." +
      "</p>" +
      '<div class="gcb-goals">' + rows + "</div>" +
      (vp.rows.some(function (r) { return r.grp === "cans"; })
        ? '<p class="muted" style="margin:8px 0 0">Cans are listed strongest first, not cheapest: ' +
          "each one is 2h of booster cooldown whatever it holds, and a 48h ceiling refilling at 24h " +
          "a day is about twelve slots. Once the booster is high the slot costs more than the can does."
          + "</p>"
        : "") +
      '<div class="gcb-val" style="margin-top:8px">' +
      '<div class="gcb-gtop"><span class="gcb-gname">Mc Smoogle, ' +
      (mcs.n > 1 ? mcs.n + " more increments" : "one more increment") + "</span>" +
      '<span class="gcb-gcur">' + (mcsCost > 0 ? fmtMoney(mcsCost) : "\u2014") + "</span></div>" +
      '<div class="gcb-gnote">' +
      (mcs.saved > 0
        ? fmtDays(mcs.saved) + " sooner" +
          (mcsCost > 0 ? " \u00b7 " + fmtMoney(mcsCost / mcs.saved) + " a day saved" : "")
        : "even " + MCS_MAX_EXTRA + " more increments would not move this goal") +
      " \u00b7 capital you keep, not money you spend</div>" +
      '<input class="gc-in gcb-gin" data-mcscost="1" type="text" inputmode="decimal" ' +
      'autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" ' +
      'placeholder="cost of the next increment" value="' +
      (state.mcsCost ? esc(fmt(state.mcsCost)) : "") + '"></div>' +
      '<p class="muted" style="margin:8px 0 0">' +
      (priced
        ? "Cheapest live bazaar or item-market listing, refreshed every few hours. Prices move; treat these as a ranking, not a quote."
        : "Fetching prices\u2026 if they do not appear, the price host is unreachable and Torn\u2019s own item market is tried next.") +
      "</p></div>"
    );
  }

  function calModelWords(m) {
    var off = Math.round(Math.abs(m - 1) * 100);
    if (off < 2) return "spot on";
    return off + "% " + (m < 1 ? "optimistic" : "pessimistic");
  }

  // What the missed energy is actually costing, in days on the goal you are
  // training right now. A percentage nobody can act on; a number of days they can.
  // What the energy you never spent costs across the whole schedule, in days.
  // Per-goal would understate it under rotation, where one goal is only ever a
  // slice of what you are actually working towards.
  function calCostDays(plan) {
    if (!plan || !plan.cal || !plan.cal.ok || !(plan.totalTrains > 0)) return 0;
    if (plan.cal.usage >= 0.999) return 0;
    var full = scheduleDays(plan.totalTrains, dailyEnergy().total);
    if (!isFinite(full) || !isFinite(plan.total)) return 0;
    return Math.max(0, plan.total - full);
  }

  function calibrationHtml(plan) {
    var cal = (plan && plan.cal) || calibration();
    if (!cal.ok) {
      return (
        '<div class="gc-card"><h3>Calibration</h3>' +
        '<p class="muted" style="margin:0">Still learning \u2014 ' + esc(cal.reason) +
        ". Once a week is on record, projections are corrected against what you actually " +
        "gained and actually spent. Until then they use the raw model." +
        (state.logReadable === false
          ? " A day only counts if <b>one stat</b> moved: splitting the day's energy between two " +
            "needs the gym log, which a Limited key cannot read."
          : " A day where you trained two stats counts too \u2014 the gym log records how the " +
            "energy split, so it does not have to be guessed.") +
        "</p></div>"
      );
    }
    // Named, because a day measured through the log's split rests on one more
    // record than a single-stat day does, and that is worth being able to see.
    var mixedNote = cal.mixedDays > 0
      ? '<p class="muted" style="margin:8px 0 0">' + cal.mixedDays + " of those day" +
        (cal.mixedDays === 1 ? " was" : "s were") + " split across more than one stat, measured from the gym log.</p>"
      : "";
    var perDay = cal.days > 0 ? cal.actual / cal.days : 0;
    var predDay = cal.days > 0 ? cal.predicted / cal.days : 0;
    var usePct = Math.round(cal.usage * 100);
    var cost = calCostDays(plan);
    var spentDay = cal.uDays > 0 ? cal.used / cal.uDays : 0;
    var lostDay = cal.uDays > 0 ? cal.wasted / cal.uDays : 0;
    return (
      '<div class="gc-card"><h3>Calibration</h3>' +
      '<div class="row"><span>Gain model</span><b class="' + (Math.abs(cal.model - 1) < 0.05 ? "ok" : "warn") + '">' +
        calModelWords(cal.model) + "</b></div>" +
      '<div class="row"><span>You gained</span><b>' + fmt(Math.round(perDay)) + " a day</b></div>" +
      '<div class="row"><span>It predicted</span><b>' + fmt(Math.round(predDay)) + " a day</b></div>" +
      mixedNote +
      '<div class="row" style="margin-top:6px"><span>Energy used</span><b class="' + (usePct >= 90 ? "ok" : "warn") + '">' +
        usePct + "% of what you had</b></div>" +
      '<div class="row"><span>Reached the gym</span><b>' + fmt(Math.round(spentDay)) + "e a day</b></div>" +
      '<div class="row"><span>Evaporated at a full bar</span><b class="' + (lostDay >= 1 ? "warn" : "ok") + '">' +
        fmt(Math.round(lostDay)) + "e a day</b></div>" +
      (cost >= 1 && plan && plan.next
        ? '<p class="warn" style="margin:8px 0 0">Energy you never spent is adding about ' +
          fmtDays(cost) + " to " + STAT_LABEL[plan.next.k] + "."
          + "</p>"
        : "") +
      '<p class="muted" style="margin:8px 0 0">Projections are scaled by both figures, measured over ' +
      cal.days + " day" + (cal.days === 1 ? "" : "s") + " of the last " + CAL_WINDOW +
      ". Every point that leaves your bar counts as spent, so attacks land here too." +
      "</p></div>"
    );
  }

  // Everything Torn sends, not just the lines that matched a gym rule. A perk
  // the script is ignoring shows up here in its own words, which beats guessing
  // at what a stock or property benefit is called.
  function rawPerksHtml() {
    var raw = state.perkRaw || {};
    var order = [
      ["faction", "Faction"], ["company", "Company"], ["job", "Job"],
      ["education", "Education"], ["property", "Property"], ["merit", "Merit"],
      ["stock", "Stock"], ["book", "Book"], ["enhancer", "Enhancer"]
    ];
    var used = {};
    Object.keys(state.perkHits || {}).forEach(function (k) {
      (state.perkHits[k] || []).forEach(function (line) { used[k + "|" + line] = true; });
    });
    var body = order.map(function (pair) {
      var lines = raw[pair[0]] || [];
      if (!lines.length) return "";
      return '<div class="gcb-grp">' + pair[1] + "</div>" +
        lines.map(function (line) {
          var on = used[pair[0] + "|" + line];
          return '<div class="gcb-rawp' + (on ? " on" : "") + '">' +
            (on ? "\u2713 " : "\u00b7 ") + esc(String(line)) + "</div>";
        }).join("");
    }).join("");
    if (!body) return "";
    return '<div class="gc-card"><h3>Perks Torn sent</h3>' +
      '<p class="muted" style="margin:0 0 6px">A tick means the script is using it. Everything else is listed so a benefit it is ignoring can be named.</p>' +
      body + "</div>";
  }

  // Cans the plan counts on that are not in your inventory. Ticking one is
  // allowed on purpose — planning a purchase is a real use — but the projection
  // is then describing a bag you have to go and buy, and it should say so.
  function wishlistNote() {
    var want = srcRows().filter(function (r) {
      return r.grp === "cans" && srcCount(r.k) > 0 && !(r.held > 0);
    });
    if (!want.length) return "";
    var e = 0;
    want.forEach(function (r) { e += srcEnergy(r.k); });
    return '<div class="gcb-wish">Your plan counts ' + fmt(e) + "e a day from " +
      want.map(function (r) { return esc(r.label); }).join(", ") +
      ", which you are not holding. Buy them or untick them \u2014 until then the " +
      "projections are describing a cupboard you do not have.</div>";
  }

  function srcHtml() {
    var e = dailyEnergy();
    var now = srcPresetId();
    function rowHtml(r) {
      var n = srcCount(r.k);
      var on = n > 0;
      var val = srcEnergy(r.k);
      return (
        '<div class="gcb-src' + (on ? " on" : "") + '">' +
        '<button class="gcb-chk" data-tick="' + r.k + '" aria-pressed="' + (on ? "true" : "false") +
        '" aria-label="' + esc(r.label) + '">' + (on ? "\u2713" : "") + "</button>" +
        '<span class="gcb-nm">' + r.label + "<i>" + r.unit +
        (on && val ? " \u00b7 " + fmt(val) + "e" : "") +
        // A can can be ticked before you own one — you may be planning a
        // purchase — so the row has to say which are cupboard and which are
        // wishlist, or the projection quietly describes a bag you do not have.
        (r.grp === "cans"
          ? (r.held > 0 ? " \u00b7 " + fmt(r.held) + " held"
                        : on ? " \u00b7 none held" : " \u00b7 not held")
          : "") +
        "</i></span>" +
        '<span class="gcb-step">' +
        '<button data-src="' + r.k + '" data-delta="-1"' + (n <= 0 ? " disabled" : "") + ">\u2212</button>" +
        "<b>" + n + "</b>" +
        '<button data-src="' + r.k + '" data-delta="1"' + (n >= r.max ? " disabled" : "") + ">+</button>" +
        "</span></div>"
      );
    }
    return (
      '<div class="gc-card"><h3>Energy sources</h3>' +
      '<p class="muted" style="margin:0 0 8px">Tick what you actually use. Everything here feeds the projections \u2014 the Trend chart and the 7/30/90 day figures move with it.</p>' +
      '<div class="pick">' +
      SRC_PRESETS.map(function (p) {
        return '<button data-preset="' + p.id + '" class="' + (now === p.id ? "on" : "") + '">' + p.label + "</button>";
      }).join("") +
      "</div>" +
      '<div class="gcb-srcs">' +
      srcRows().filter(function (r) { return r.grp !== "cans"; }).map(rowHtml).join("") +
      '<div class="gcb-grp">Energy cans</div>' +
      srcRows().filter(function (r) { return r.grp === "cans"; }).map(rowHtml).join("") +
      wishlistNote() +
      "</div>" +
      '<div class="row"><span>Natural regen</span><b>' + fmt(e.natural) + "e</b></div>" +
      (e.xan ? '<div class="row"><span>Xanax</span><b>' + fmt(e.xan) + "e</b></div>" : "") +
      (e.refill ? '<div class="row"><span>Refills</span><b>' + fmt(e.refill) + "e</b></div>" : "") +
      (e.fhc ? '<div class="row"><span>Coupons</span><b>' + fmt(e.fhc) + "e</b></div>" : "") +
      (e.mcs ? '<div class="row"><span>Mc Smoogle Corp</span><b>' + fmt(e.mcs) + "e</b></div>" : "") +
      (e.cans ? '<div class="row"><span>Cans</span><b>' + fmt(e.cans) + "e</b></div>" : "") +
      '<div class="row"><span>Total per day</span><b class="ok">' + fmt(e.total) + "e</b></div>" +
      (state.warStack ? '<p class="muted" style="margin:8px 0 0">War stack is on, so Xanax is banked rather than spent \u2014 it is left out of the total.</p>' : "") +
      "</div>"
    );
  }

  // --- energy ledger -------------------------------------------------------
  // What your bar produced versus what you actually spent. Waste is regen the
  // bar dropped because it was already full: sit at 150/150 for two hours and
  // that is two hours of regen you never received.
  //
  // Deliberately computed by COMPARING TWO OBSERVATIONS rather than by running
  // a timer. A timer only counts while a Torn page is open, which is exactly
  // when you are least likely to be wasting energy. Comparing observations
  // catches the overnight case: last seen full eight hours ago, still full now,
  // therefore eight hours of regen went in the bin.
  var LEDGER_DAYS = 90;

  function energyRate() {
    // Torn's base is 5 energy per 15 minutes. The real figure is derived from
    // the API on the first poll; this is only the value before that lands.
    return state.energySecPerE || 180;
  }

  // Pure, so it can be tested: one window between two observations.
  // `stacking` is war stack: the coach itself is telling you to hold the bar
  // ("Leave energy alone. Don't train."), so time at cap is stored energy
  // rather than energy you let slip, and booking it as waste penalised you
  // for following your own plan. It changes only what the cap time is CALLED
  // -- see the absorbed maths below, which still has to subtract it.
  function ledgerDelta(prevE, prevT, nowE, nowT, max, secPerE, fullAt, stacking) {
    var out = { used: 0, wasted: 0 };
    // A drop is a drop: spending is instantaneous, so record it whether or not
    // a measurable window has passed. Waste is a rate over time and does need
    // a valid window, so it stays behind the guard below.
    if (nowE < prevE) out.used = prevE - nowE;
    var elapsed = (nowT - prevT) / 1000;
    if (!(elapsed > 0) || !(secPerE > 0)) return out;
    if (elapsed > 48 * 3600) elapsed = 48 * 3600; // clock changes, long sleeps
    // Waste means regen you did not receive because the bar was already full and
    // you left it there. Being ABOVE the cap is a different thing entirely:
    // that is energy you put there on purpose with cans or a xanax, and the
    // paused regen is the known price of stockpiling, not something you let
    // slip. Counting it made a ten-can session read as waste while you were
    // actively banking. So a window only counts while the bar is AT the cap,
    // and neither end of it is above.
    var overNow = nowE > max;
    var overPrev = prevE > max;
    if (!overNow && !overPrev) {
      // Account for the window as time, not as a snapshot of where it ended.
      // Requiring it to END at the cap threw away the commonest case there is:
      // the bar sits full for hours, you train, and by the time the panel looks
      // again the bar has already started refilling — so the reading is below
      // the cap and every one of those hours was discarded.
      //
      //   fill    climbing to the cap at the start; absorbed, not wasted
      //   refill  climbing back after a spend; also absorbed, not wasted
      //   rest    the bar sat full with nowhere to put the regen
      //
      // The refill leg assumes the spend emptied the bar, which is the most
      // generous reading available and makes this a floor: never more waste
      // than actually happened.
      var fill = prevE >= max ? 0 : (max - prevE) * secPerE;
      // When the bar filled is not a guess: it is the instant the "energy full"
      // notification was scheduled for, back when the rate was known and the
      // bar was still climbing. Prefer it over re-deriving the fill from a rate
      // that may since have gone stale.
      // Only where the bar demonstrably got there: it ended at the cap, or it
      // ended lower than it started so a spend could have followed the fill. A
      // prediction on a bar that merely rose and stopped short was wrong, and
      // trusting it books waste that never happened.
      var reached = nowE >= max || nowE < prevE;
      if (reached && fullAt && fullAt > prevT && fullAt <= nowT) fill = (fullAt - prevT) / 1000;
      var refill = nowE < prevE ? nowE * secPerE : 0;
      var atCap = elapsed - fill - refill;
      var capped = atCap > 0 ? atCap / secPerE : 0;
      out.wasted = stacking ? 0 : capped;

      // Spend is the drop PLUS whatever regenerated back in behind it. The drop
      // alone loses every point that refilled after a session: train the bar
      // away, come back an hour later, and the hour of regen makes the session
      // read an hour smaller than it was. Regen that did not land in the bar is
      // exactly the waste above, so what remains is what the bar absorbed, and
      // the rest of the balance is what left it.
      //
      // Only valid while the bar is at or below the cap. Above it Torn pauses
      // regen entirely, so nothing is absorbed and the raw drop is already the
      // whole story — which is why banking keeps the simple reading below.
      // `capped`, not out.wasted: the regen genuinely never landed, whatever we
      // call it. Using out.wasted here would hand that regen back as spend the
      // moment war stack suppressed it, and a held-then-dumped bar would read
      // as more energy trained than ever left it.
      // FLOORED, because the bar reports whole points while this accrues
      // smoothly. Between two ticks nowE === prevE, so an unfloored figure
      // makes `prevE + absorbed - nowE` a small positive number and books it
      // as spend -- every poll, for as long as the bar climbs. The tick never
      // cancels it, so a bar doing nothing but regenerating reported 26e
      // "spent today", and how much depended on the poll interval (19e at 60s
      // against 37e at 1s), which is the tell that it was an artefact.
      // Flooring costs nothing real: energy only ever moves in whole points.
      var absorbed = Math.floor(Math.max(0, elapsed / secPerE - capped));
      out.used = Math.max(0, prevE + absorbed - nowE);
    }
    return out;
  }

  // --- editing missed energy out of the ledger --------------------------------
  // The ledger records {day, used, wasted} and has never recorded WHY a bar sat
  // full, so a war-stack day cannot be told from a lazy one after the fact.
  // That makes this a manual pick, and a destructive edit to real training
  // history -- so a cleared day keeps its original figure under `w0` and can be
  // put back. Only `wasted` is ever touched: spend really did leave the bar,
  // and it is what the model half of the calibration is measured from.
  //
  // Scoped to the calibration window, because a day older than that feeds no
  // ETA and clearing it would be theatre.
  // Reads a stack off the bar itself: no logs, no API, and nothing to remember
  // to switch on. Returns false when the day has no recorded peak -- entries
  // written before peaks were tracked are unknown, not innocent.
  function dayLooksStacked(e) {
    if (!e || typeof e.peak !== "number") return false;
    var max = state.energyMax || 150;
    return e.peak > max + STACK_PEAK_OVER;
  }

  function ledgerWasteDays() {
    var today = dayKey(Date.now());
    var first = today - CAL_WINDOW;
    var out = [];
    (state.ledger || []).forEach(function (e) {
      if (!e || typeof e.d !== "number" || e.d < first || e.d > today) return;
      var cleared = typeof e.w0 === "number";
      var w = cleared ? e.w0 : (e.wasted || 0);
      if (!(w > 0)) return;
      out.push({ d: e.d, used: e.used || 0, wasted: w, cleared: cleared,
                 stacked: dayLooksStacked(e), known: typeof e.peak === "number" });
    });
    return out.sort(function (a, b) { return b.d - a.d; });
  }

  function clearLedgerDay(d) {
    var hit = null;
    (state.ledger || []).forEach(function (e) { if (e && e.d === d) hit = e; });
    if (!hit) return false;
    // Only on the first clear. A second one would read the already-zeroed
    // figure and overwrite the original with it, turning a reversible edit
    // into a permanent one.
    if (typeof hit.w0 !== "number") hit.w0 = hit.wasted || 0;
    hit.wasted = 0;
    storeSet("ledger", state.ledger);
    resetPlanCaches();
    return true;
  }

  function restoreLedgerDay(d) {
    var hit = null;
    (state.ledger || []).forEach(function (e) { if (e && e.d === d) hit = e; });
    if (!hit || typeof hit.w0 !== "number") return false;
    hit.wasted = hit.w0;
    delete hit.w0;
    storeSet("ledger", state.ledger);
    resetPlanCaches();
    return true;
  }

  // The Settings card for the above. Shows what each day is contributing before
  // anything is removed, and what the usage figure would become without them --
  // clearing history blind is how you end up trusting a number you broke.
  function ledgerEditHtml() {
    var rows = ledgerWasteDays();
    if (!rows.length) return "";
    var live = 0, used = 0, all = 0, stackedE = 0, stackedN = 0;
    rows.forEach(function (r) {
      used += r.used;
      all += r.wasted;
      if (!r.cleared) live += r.wasted;
      if (r.stacked && !r.cleared) { stackedE += r.wasted; stackedN += 1; }
    });
    var cal = calibration();
    var pctNow = cal.used + cal.wasted > 0
      ? Math.round((cal.used / (cal.used + cal.wasted)) * 100) : null;
    var after = cal.used + (cal.wasted - live) > 0
      ? Math.round((cal.used / (cal.used + (cal.wasted - live))) * 100) : 100;

    return '<div class="gc-card"><h3>Missed energy</h3>' +
      '<p class="muted" style="margin:0 0 8px">These days feed the usage figure behind every ETA. ' +
      'Clear a day you held energy on purpose. A day whose bar peaked above one ' +
      'Xanax\u2019s reach is marked as a stack for you. Spend is never touched, ' +
      'and anything cleared can be put back.</p>' +
      (pctNow === null ? "" :
        '<div class="row"><span>Bar actually used</span><b>' + pctNow + "%" +
        (live > 0 && after !== pctNow ? ' \u2192 ' + after + "% if you clear the " +
          fmt(live) + "e below" : "") + "</b></div>") +
      rows.map(function (r) {
        return '<div class="row"><span>' + fmtDay(r.d) +
          (r.stacked ? " \u00b7 held a stack" : " \u00b7 spent " + fmt(r.used) + "e") + "</span>" +
          '<b class="' + (r.cleared ? "muted" : "bad") + '">' +
          (r.cleared ? "cleared " : "") + fmt(missed(r.wasted)) + "e</b>" +
          '<button class="gc-btn secondary" style="margin-left:8px;padding:2px 8px" data-' +
          (r.cleared ? "restoreday" : "clearday") + '="' + r.d + '">' +
          (r.cleared ? "Put back" : "Clear") + "</button></div>";
      }).join("") +
      (stackedE > 0
        ? '<div class="actions"><button class="gc-btn" data-act="clearstacked">Clear the ' +
          stackedN + " day" + (stackedN === 1 ? "" : "s") + " you held a stack (" +
          fmt(stackedE) + "e)</button></div>"
        : "") +
      (live > 0
        ? '<div class="actions"><button class="gc-btn secondary" data-act="clearallwaste">Clear all ' +
          fmt(live) + "e shown</button></div>"
        : "") +
      "</div>";
  }

  // --- what Torn says you trained ---------------------------------------------
  // The bar is an inference; this is the record. Torn writes one line per
  // session with the exact energy, so a session the script was not running for
  // still counts, and nothing has to be reconstructed from a whole-point bar.
  //
  // Split across four types, one per stat. 100 entries a page, which at a heavy
  // ~4.6 sessions a day covers about three weeks — comfortably past the
  // fourteen the calibration window needs.
  var TRAINLOG_IDS = [5300, 5301, 5302, 5303];

  // The same log trainLogByDay reads, kept as individual events instead of a
  // daily total. A gap does not need to know how much was trained today; it
  // needs to know WHEN the bar was emptied, so it can tell an hour at the cap
  // from an hour spent refilling.
  function trainLogEvents(responses) {
    var out = [];
    (responses || []).forEach(function (r) {
      var rows = (r && r.log) || {};
      for (var k in rows) {
        var e = rows[k];
        if (!e || !e.data) continue;
        var used = Number(e.data.energy_used);
        var ts = Number(e.timestamp);
        // Same rule as the daily total: a line with no energy figure is not a
        // free session, it is a line we cannot read.
        if (!(used > 0) || !(ts > 0)) continue;
        out.push({ t: ts * 1000, delta: -used });
      }
    });
    return out.sort(function (a, b) { return a.t - b.t; });
  }

  // Attacks as events rather than a count, for the same reason.
  function attackEvents(d, meId) {
    if (!d || !Array.isArray(d.attacks)) return [];
    var seen = {}, out = [];
    for (var i = 0; i < d.attacks.length; i++) {
      var a = d.attacks[i] || {};
      var ts = Number(a.started || a.ended) || 0;
      if (!ts) continue;
      var atk = a.attacker && a.attacker.id != null ? String(a.attacker.id) : null;
      var def = a.defender && a.defender.id != null ? String(a.defender.id) : null;
      if (meId != null && (atk !== null ? atk !== String(meId) : def === String(meId))) continue;
      var key = a.id != null ? String(a.id) : "t" + ts + ":" + def;
      if (seen[key]) continue;
      seen[key] = 1;
      out.push({ t: ts * 1000, delta: -ATTACK_ENERGY });
    }
    return out.sort(function (a, b) { return a.t - b.t; });
  }

  // Which stat a gym-log row is about.
  //
  // Read from Torn's own words for that row rather than from the order the four
  // log ids were requested in. The script has never needed an id-to-stat table
  // and inventing one would be an assumption sitting under a measurement; the
  // title is self-describing and Torn writes it.
  //
  // null when the wording does not resolve -- never a guess. A wrong stat is
  // worse than no stat: it would attribute a day's energy to something that
  // never moved and calibrate the model against fiction. Null simply leaves the
  // day to the one-stat rule, which is the behaviour that already exists.
  function trainStatFromLogRow(e) {
    var t = String((e && e.title) || "").toLowerCase();
    if (t.indexOf("strength") !== -1) return "str";
    // Torn has used both spellings over the years and neither costs anything.
    if (t.indexOf("defense") !== -1 || t.indexOf("defence") !== -1) return "def";
    if (t.indexOf("speed") !== -1) return "spe";
    if (t.indexOf("dexterity") !== -1) return "dex";
    return null;
  }

  // Energy per stat per day, out of the same four responses trainLogByDay
  // already receives.
  //
  // The log is fetched once PER STAT, so this costs no extra request -- the
  // breakdown was there all along and was being summed away. It is what lets a
  // day with two stats on it be calibrated instead of discarded.
  function trainLogByDayStat(responses) {
    var out = {};
    (responses || []).forEach(function (r) {
      var rows = (r && r.log) || {};
      for (var k in rows) {
        var e = rows[k];
        if (!e || !e.data) continue;
        var used = Number(e.data.energy_used);
        var ts = Number(e.timestamp);
        if (!(used > 0) || !(ts > 0)) continue;
        var stat = trainStatFromLogRow(e);
        // Unreadable wording leaves the row out entirely rather than filing it
        // under a guess -- see trainStatFromLogRow.
        if (!stat) continue;
        var d = dayKey(ts * 1000);
        if (!out[d]) out[d] = {};
        out[d][stat] = (out[d][stat] || 0) + used;
      }
    });
    return out;
  }

  // How far apart the log and the ledger may be about one day before the day
  // stops being evidence. They round differently and the bar is sampled, so
  // demanding an exact match would throw away almost every real day.
  var MIXED_SLACK = 25;

  // The per-stat energy for a day, but only when it is safe to calibrate from.
  //
  // Returns null -- meaning "leave this day to the one-stat rule" -- unless the
  // log accounts for exactly the stats that moved and roughly the energy the
  // ledger recorded. Every one of those conditions is a way the split could be
  // wrong, and a wrong split is a worse answer than no answer: it would teach
  // the model a correction built on invented numbers.
  function mixedDayEnergy(split, moved, used) {
    if (!split || !moved || !moved.length) return null;
    var keys = Object.keys(split);
    if (!keys.length) return null;
    var total = 0, i;
    for (i = 0; i < keys.length; i++) {
      // Energy against a stat that did not move: the gain it bought was under a
      // whole point, and the energy behind it cannot be separated from the rest.
      if (moved.indexOf(keys[i]) === -1) return null;
      total += split[keys[i]];
    }
    // A stat that moved with nothing logged against it gained from somewhere
    // the log cannot see, so any split would be invented.
    for (i = 0; i < moved.length; i++) {
      if (!(split[moved[i]] > 0)) return null;
    }
    if (Math.abs(total - (Number(used) || 0)) > MIXED_SLACK) return null;
    return split;
  }

  function trainLogByDay(responses) {
    var out = {};
    (responses || []).forEach(function (r) {
      var rows = (r && r.log) || {};
      for (var k in rows) {
        var e = rows[k];
        if (!e || !e.data) continue;
        var used = Number(e.data.energy_used);
        var ts = Number(e.timestamp);
        // A line with no energy figure is not a free session — it is a line we
        // do not understand, and counting it as zero would under-report.
        if (!(used > 0) || !(ts > 0)) continue;
        var d = dayKey(ts * 1000);
        out[d] = (out[d] || 0) + used;
      }
    });
    return out;
  }

  // Live figure for the Now tab. The log is the truth and the bar is the
  // immediacy: a number that only moved when an API call landed would read as
  // broken in the seconds right after you train. `since` is what the bar has
  // watched leave on the gym page since the last fetch, and is cleared when the
  // next one lands, so the figure converges on Torn's own record.
  //
  // null means "no answer yet" -- the caller falls back to the bar. That is a
  // different statement from 0, which claims you trained nothing.
  // One call per stat. Never partially applied: if any of the four fail the
  // whole round is discarded, because a byDay built from two logs out of four
  // would under-report and look exactly like a quiet day.
  // How much of what we already knew the fresh log has NOT yet accounted for.
  //
  // `since` carries a session from the moment the bar drops on the gym page to
  // the moment Torn's log admits it happened. Clearing it outright on every
  // successful fetch assumes the fetch that just returned includes the
  // session -- and when Torn's log lags by even one round, that assumption
  // throws the session away. Reported as 400e trained at 09:51 PM still
  // reading "Spent today 0e" three quarters of an hour later, with the local
  // Train Log card showing it plainly the whole time. Later rounds were
  // failing on "Too many requests", so nothing ever put it back.
  //
  // Comparing instead of assuming is self-correcting in both directions: what
  // the log has caught up with is dropped, what it has not is kept, and a log
  // that knows MORE than we do (training on another device) simply leaves
  // nothing to carry.
  // How much of an observed bar drop on gym.php was actually training.
  //
  // Counted in WHOLE TRAINS, exactly as off-gym spend is counted in whole
  // attacks, and for exactly the same reason. A train costs a known fixed
  // amount, so a drop that is not a multiple of it did not come out of the gym
  // -- it is skew between the API bar and the DOM bar. That skew was being
  // booked as training, and then carried, so "Spent today" crept upward on a
  // page that was only being reloaded. Reported as 367e against 340e actually
  // trained, on a gym that costs 10 a train: no gym total ends in a 7.
  //
  // An unknown gym cost falls back to counting the whole drop. Over-counting
  // is a wrong number; counting nothing would silently stop recording training
  // altogether for anyone whose gym the script has not identified yet.
  function gymSpend(used, perTrain) {
    var u = Number(used) || 0;
    if (u <= 0) return 0;
    var per = Number(perTrain) || 0;
    if (per <= 0) return u;
    return Math.floor(u / per) * per;
  }

  // Records a locally-observed train against the log's running count.
  //
  // Both fields together, always. A `since` written without a `sinceAt` can
  // never expire, which is precisely the behaviour being fixed -- so the two
  // writes live in one place rather than at a call site where one of them can
  // quietly go missing.
  function noteGymSpend(tl, trained, now) {
    if (!tl || !(Number(trained) > 0)) return tl;
    tl.since = (tl.since || 0) + Number(trained);
    tl.sinceAt = Number(now) || 0;
    return tl;
  }

  // What one train costs at the gym you are actually in, or 0 when that is not
  // known yet.
  //
  // Deliberately NOT gymFor(), which falls back to the last row of the table --
  // the most expensive gym in the game. Using 25 as the filter width for
  // somebody whose gym has not been identified would silently discard up to 24
  // energy of real training per observation. An unknown cost has to mean "do
  // not filter", not "assume the widest one".
  function perTrainEnergy() {
    var g = GYMS.filter(function (x) { return x.Gym === state.gymName; })[0];
    return g ? Number(g.Energy) || 0 : 0;
  }

  // How long a locally-counted train is carried before Torn's log overrules it.
  //
  // Two full log rounds and then some. Shorter than the fetch interval and the
  // figure would dip between rounds on every device, which is worse than the
  // drift being fixed.
  var SINCE_GRACE_MS = 420000;

  function carriedSince(prev, freshByDay, dayK, now) {
    if (!prev) return 0;
    var known = ((prev.byDay && prev.byDay[dayK]) || 0) + (prev.since || 0);
    var fresh = (freshByDay && freshByDay[dayK]) || 0;
    var excess = Math.max(0, known - fresh);
    if (!excess) return 0;
    // The log is the authority. An excess only ever means "Torn has not caught
    // up with a train from a few seconds ago", so it is carried for one grace
    // window and then dropped. Carrying it indefinitely is what let a single
    // point of skew survive every log round and accumulate all day: the local
    // count stayed above the log, so the difference was preserved forever as
    // though the log were permanently behind.
    var at = Number(prev.sinceAt) || 0;
    // An unstamped counter predates this and is trusted once, so a device
    // upgrading mid-session does not lose a train it really did do.
    if (at && (Number(now) || 0) - at > SINCE_GRACE_MS) return 0;
    return excess;
  }

  // Two minutes, not one. The live `since` figure now covers the wait, so
  // asking four log endpoints every 60s bought nothing but rate-limit
  // pressure -- and rate limits are what made the lost session permanent.
  var TRAINLOG_TTL = 120000;
  function fetchTrainLog(force) {
    if (!resolveKey()) return Promise.resolve(null);
    // A Limited key cannot read the gym log at all -- selection `log` is
    // Full-only -- and a REFUSED call still counts against the 100-a-minute
    // cap. Asking on a loop spends budget to be told "no": measured at 2/min
    // doing nothing else. Once Torn has said the access is not there, stop.
    //
    // Only for a refusal. A rate limit means the key CAN read it and was
    // merely busy, and writing the feature off over a transient error is how
    // it quietly dies for someone whose key is fine.
    if (state.logReadable === false) return Promise.resolve(state.trainLog || null);
    var tl = state.trainLog;
    // The last ATTEMPT, not the last success. A failed round used to stamp
    // nothing, so `at` stayed old and every later call started a fresh round
    // of four -- on a key that was failing because it was already rate
    // limited. The limit fed itself. Measured at 77 log calls in one minute at
    // 0-1ms spacing.
    var last = Math.max((tl && tl.at) || 0, state.trainLogTriedAt || 0);
    if (!force && Date.now() - last < TRAINLOG_TTL) return Promise.resolve(tl);
    if (state.trainLogInFlight) return Promise.resolve(tl);
    state.trainLogInFlight = true;
    state.trainLogTriedAt = Date.now();
    return Promise.all(TRAINLOG_IDS.map(function (id) {
      return httpGet(apiUrl("log&log=" + id));
    })).then(function (rs) {
      state.trainLogInFlight = false;
      // No partial-round check: httpGet rejects on data.error, so Promise.all
      // rejects as a whole and lands in the handler below. A byDay built from
      // two logs out of four would under-report and look like a quiet day, and
      // this shape makes that unreachable rather than merely guarded against.
      // events as well as the daily total: a gap needs to know WHEN the bar was
      // emptied, which the total cannot say. Trimmed to the last three days --
      // a gap is clamped to 48h, so nothing older can ever be inside one.
      var cut = Date.now() - 3 * 86400000;
      var fresh = trainLogByDay(rs);
      state.trainLog = { byDay: fresh, at: Date.now(),
                         since: carriedSince(state.trainLog, fresh, dayKey(Date.now()), Date.now()),
                         // Carried, not dropped. This literal replaces the whole
                         // object, so leaving sinceAt out discarded the stamp on
                         // every successful round -- and carriedSince's expiry
                         // reads that stamp, so after round one it could never
                         // fire. 0.9.49 shipped the expiry and this quietly
                         // disabled it: exactly the "a since without a sinceAt
                         // can never expire" case its own comment warns about.
                         sinceAt: (state.trainLog && state.trainLog.sinceAt) || 0,
                         // Same four responses, kept split by stat instead of
                         // summed away. Costs no extra request and is what lets
                         // a day with two stats on it be calibrated at all.
                         byDayStat: trainLogByDayStat(rs),
                         events: trainLogEvents(rs).filter(function (e) { return e.t >= cut; }) };
      state.logReadable = true;
      storeSet("trainLog", state.trainLog);
      resetPlanCaches();
      return state.trainLog;
    }, function (err) {
      state.trainLogInFlight = false;
      // Code 16 is Torn saying this key may not read the log -- a fact about
      // the key, so remember it and stop asking. Anything else (a rate limit,
      // a network blip) says nothing about access and must not disable the
      // feature: `logReadable` stays null so the next round tries again.
      if (err && err.code === 16) state.logReadable = false;
      // Keep whatever we had either way: a failed round is no news, not zero
      // training.
      return state.trainLog || null;
    });
  }

  function trainedToday() {
    var tl = state.trainLog;
    if (!tl || !tl.byDay) return null;
    return (tl.byDay[dayKey(Date.now())] || 0) + (tl.since || 0);
  }

  // How much regen a window actually threw away, reconstructed from WHEN the
  // spending happened rather than guessed from the two ends of the window.
  //
  // The guess is what breaks across two devices. Asking "was the bar full when
  // I last looked, and is it full now?" bills the whole gap between -- so a PC
  // that was closed for six hours bills six hours at the cap, even though the
  // PDA emptied the bar twice inside them. Both devices do it and neither can
  // know the other exists.
  //
  // Given the spend timeline this needs no guessing: walk the window, let the
  // bar climb at the known rate, apply each event when it happened, and total
  // only the time the bar was genuinely sitting at the cap. Both devices read
  // the same timeline, so both reach the same number.
  //
  // `events` are { t: ms, delta: energy } -- negative for a spend, positive for
  // a xanax, can or refill. Returns { wasted, atCapSec } or null if the inputs
  // cannot describe a window.
  function simulateWaste(startE, startT, endT, max, secPerE, events) {
    if (!(secPerE > 0) || !(max > 0) || !(endT > startT)) return null;
    var e = Number(startE) || 0, t = startT, atCap = 0;
    var evs = (events || [])
      .filter(function (v) { return v && typeof v.t === "number" && v.t > startT && v.t <= endT; })
      .sort(function (a, b) { return a.t - b.t; });

    function advance(to) {
      var dt = (to - t) / 1000;
      t = to;
      if (dt <= 0) return;
      // ABOVE the cap Torn pauses regen, so nothing accrues and nothing is
      // lost -- that energy was banked on purpose. Only sitting exactly AT the
      // cap throws regen away.
      if (e > max) return;
      if (e >= max) { atCap += dt; return; }
      var need = (max - e) * secPerE;   // seconds left to fill
      if (dt <= need) { e += dt / secPerE; return; }
      e = max;
      atCap += dt - need;
    }

    for (var i = 0; i < evs.length; i++) {
      advance(evs[i].t);
      e += Number(evs[i].delta) || 0;
      if (e < 0) e = 0;   // the bar cannot go below empty
    }
    advance(endT);
    return { wasted: atCap / secPerE, atCapSec: atCap };
  }

  // Energy spent attacking, straight from Torn's attack log.
  //
  // The bar-derived figure this replaces could not survive two devices. Each
  // one only saw its own readings, so a device that had been closed a while
  // assumed the bar sat at the cap throughout and booked the catch-up --
  // including the hours the OTHER device was training and attacking. Both
  // devices did it, neither could know the other existed, and the totals came
  // out impossible. Torn's log has no such problem: both devices ask the same
  // question and get the same answer.
  //
  // Returns { n, energy } or null. null means "could not tell" and is
  // deliberately distinct from { n: 0 }, which means "you have not attacked
  // today" -- a real answer that must not be replaced by a bar guess.
  function readAttacksToday(d, meId, dayStartSec) {
    if (!d || !Array.isArray(d.attacks)) return null;
    var seen = {}, n = 0;
    for (var i = 0; i < d.attacks.length; i++) {
      var a = d.attacks[i] || {};
      var ts = Number(a.started || a.ended) || 0;
      if (ts < dayStartSec) continue;
      // Incoming attacks cost you nothing; counting them would invent spend.
      // A stealth attack hides the attacker entirely, so an absent attacker on
      // a row that is not against you is still yours -- dropping those would
      // under-count exactly the hits a war player makes most of.
      var atk = a.attacker && a.attacker.id != null ? String(a.attacker.id) : null;
      var def = a.defender && a.defender.id != null ? String(a.defender.id) : null;
      // The request asks for filters=outgoing, so every row is already yours.
      // This is the belt to that pair of braces -- and it only applies when
      // the id is actually known, because dropping every row while waiting for
      // it would report 0e on a day full of attacks.
      if (meId != null && (atk !== null ? atk !== String(meId) : def === String(meId))) continue;
      // Pagination overlaps at the boundary, so the id is what keeps a row
      // from being counted twice.
      var key = a.id != null ? String(a.id) : "t" + ts + ":" + def;
      if (seen[key]) continue;
      seen[key] = 1;
      n += 1;
    }
    return { n: n, energy: n * ATTACK_ENERGY };
  }

  function ledgerBucket() {
    var d = dayKey(Date.now());
    var last = state.ledger[state.ledger.length - 1];
    if (!last || last.d !== d) {
      last = { d: d, used: 0, wasted: 0 };
      state.ledger.push(last);
      if (state.ledger.length > LEDGER_DAYS) state.ledger = state.ledger.slice(-LEDGER_DAYS);
    }
    return last;
  }

  // Longer than this and the script was not running: a normal tick is one
  // second and the slowest poll is twenty, so two minutes means nobody was
  // watching. Observed time is already accurate and is left alone.
  var GAP_MS = 120000;

  // What an unwatched gap actually cost, reconstructed from the API timeline.
  //
  // Returns the wasted energy, or NULL meaning "cannot say" -- which is not
  // zero and must never be booked as such. On a Limited key the gym log is
  // unreadable, so the timeline is missing every training session in the gap;
  // simulating anyway would show the bar sitting at the cap straight through
  // them and report a confident, wrong figure. Declining under-reports, which
  // is recoverable in a way that inventing is not.
  function gapWaste(prevE, prevT, now, max, secPerE, stacking) {
    // Suppression does not need the log, so this is answerable either way.
    if (stacking) return 0;
    if (state.logReadable !== true) return null;
    var evs = ((state.trainLog && state.trainLog.events) || [])
      .concat(state.attackEvents || []);
    var sim = simulateWaste(prevE, prevT, now, max, secPerE, evs);
    return sim ? sim.wasted : null;
  }

  var ledgerDirty = 0;
  var ledgerFlushAt = 0;
  function ledgerObserve(force) {
    // Until a real reading lands, state.energy is 0 — which is not "the bar is
    // empty", it is "we do not know yet". Observing then wiped the overnight
    // cap streak and booked a phantom spend of the whole bar. Wait for a
    // reading from the API or the page before touching the ledger.
    if (!state.energyKnown) return;
    var max = state.energyMax || 150;
    var now = Date.now();
    var prev = state.lastSeen;
    // Record the day's high-water mark BEFORE the delta is worked out, so a bar
    // sitting above its cap right now marks the day immediately rather than on
    // the next poll. A bar can only get above its cap by banking, which is what
    // makes this a measurement rather than a guess.
    var todayBucket = ledgerBucket();
    if (state.energy > (todayBucket.peak || 0)) {
      todayBucket.peak = state.energy;
      ledgerDirty += 1;
    }
    // Either the switch, or the bar saying so on its own. The switch only ever
    // helped people who remembered to flip it.
    var holding = !!state.warStack || dayLooksStacked(todayBucket);
    if (prev && typeof prev.e === "number" && prev.t && now >= prev.t) {
      var d = ledgerDelta(prev.e, prev.t, state.energy, now, max, energyRate(),
                          prev.fullAt, holding);
      // Observed time is already right -- the ledger ticks every second and
      // sees every drop. Only a GAP was ever guessed, and the guess ("it must
      // have sat at the cap") is what two devices cannot both be right about.
      if (now - prev.t > GAP_MS) {
        var g = gapWaste(prev.e, prev.t, now, max, energyRate(), holding);
        // null is "cannot reconstruct", not "nothing was wasted". Booking
        // nothing under-reports; booking the old guess invents.
        d.wasted = g === null ? 0 : g;
        if (g === null) {
          todayBucket.partial = 1;
          ledgerDirty += 1;
        }
      }
      // The train log used to be driven by comparing energy between API polls —
      // but the page updates state.energy live every second, so the drop was
      // already absorbed before a payload arrived and a whole session logged
      // nothing. The ledger sees every drop, which is why "Spent today" was
      // right while the log was empty, so drive the log from here instead. It
      // catches training started any way at all, not just a click we recognise.
      // Only the gym page trains. A 25e attack drop used to sail past the
      // `spent < 25` skew guard in finaliseTrain -- it is exactly 25 and gains
      // no stats -- and got written into the train log as a session.
      if (d.used >= 5 && !pendingTrain && onGymPage()) {
        pendingTrain = {
          skill: "", observed: true, at: Date.now(), preE: prev.e, gym: state.gymName,
          preStats: prev.stats || { str: state.stats.str, def: state.stats.def,
                                    spe: state.stats.spe, dex: state.stats.dex }
        };
        refresh("train").then(function () { finaliseTrain(); }, function () { finaliseTrain(); });
        setTimeout(function () { finaliseTrain(true); }, GAIN_WAIT_MS + 4000);
      }
      if (d.used > 0 || d.wasted > 0) {
        var b = ledgerBucket();
        // Energy only reaches the gym on gym.php. Anything that leaves the bar
        // anywhere else -- 25e an attack, and the script polls every page once
        // a second, so it sees them -- never had a chance of becoming a stat.
        // For a GYM coach that is a loss, not a spend: counting it as spent
        // inflated "Spent today" and the `used` behind calibration().usage,
        // making every ETA optimistic on the days you warred hardest.
        if (d.used > 0) {
          if (onGymPage()) {
            // Whole trains only. See gymSpend: on gym.php every bar wobble used
            // to be booked as training, including the point or two of API/DOM
            // skew that a page reload produces.
            var trained = gymSpend(d.used, perTrainEnergy());
            if (trained > 0) {
              b.used += trained;
              // Keeps the Now tab moving in the seconds before the next log
              // round lands; overruled by the log once it catches up.
              noteGymSpend(state.trainLog, trained, Date.now());
            }
          }
          // Counted in WHOLE ATTACKS. A Torn attack costs exactly 25e, so a
          // smaller off-gym drop cannot be one -- it is API/DOM skew, and the
          // remainder riding along with a real attack is the same noise. This
          // used to disappear among real training; once off-gym spend had its
          // own line it showed up as "Spent attacking 6e" on a day with no
          // attacks. Whole attacks discard both.
          else {
            var hits = Math.floor(d.used / ATTACK_ENERGY);
            if (hits > 0) b.off = (b.off || 0) + hits * ATTACK_ENERGY;
          }
        }
        b.wasted += d.wasted;
        ledgerDirty += 1;
        // Spending is rare and irreplaceable: a whole training session credits
        // exactly ONCE, so batching it behind a counter meant every session was
        // lost the moment the page navigated. Waste credits every second while
        // the bar is full, so that one can wait for the timer below.
        if (d.used > 0) force = true;
      }
    }
    var capSince = state.lastSeen && state.lastSeen.capSince;
    // While the bar is climbing, remember when it is due to fill — the same
    // instant the notification is armed for. Once it IS full that stored value
    // is the moment it filled, which is the only way to know how long a bar has
    // been sitting full while the app was closed.
    var fullAt = state.lastSeen && state.lastSeen.fullAt;
    // The last moment the bar was SEEN below the cap. Carried forward across
    // full readings, because it is the one thing that can contradict an
    // estimate -- see capStreak.
    var belowAt = (state.lastSeen && state.lastSeen.belowAt) || 0;
    if (state.energy >= max) {
      if (!capSince) capSince = fullAt && fullAt <= now ? fullAt : now;
    } else {
      capSince = 0;
      fullAt = now + timeToFull() * 1000;
      belowAt = now;
    }
    state.lastSeen = {
      e: state.energy, t: now, capSince: capSince, fullAt: fullAt, belowAt: belowAt,
      // Kept so an observed drop can be checked against a real stat gain later.
      stats: { str: state.stats.str, def: state.stats.def, spe: state.stats.spe, dex: state.stats.dex }
    };
    // Flush on a clock rather than a count. A count assumes many small credits;
    // spending arrives as one big one, so a counter could sit unflushed for the
    // entire visit.
    if (force || (ledgerDirty > 0 && now - ledgerFlushAt > 15000)) {
      ledgerDirty = 0;
      ledgerFlushAt = now;
      storeSet("ledger", state.ledger);
      storeSet("lastSeen", state.lastSeen);
    }
  }

  // How long the bar has been full right now, and what that has cost.
  // When a bar the script never watched must have filled.
  //
  // The armed prediction is the good answer, but it only exists if the app was
  // open while the bar was climbing. Close it on a low bar overnight and there
  // is nothing -- which is why opening to a full bar showed no banner at all,
  // reported twice.
  //
  // The spend timeline answers it instead: the bar cannot have filled before
  // it refilled from the last time energy left it. Assuming that spend emptied
  // the bar is deliberately the most generous reading, exactly as ledgerDelta
  // does for the same reason -- spend less and it filled sooner, so this is a
  // floor on the streak rather than an invention.
  //
  // Returns 0 when the bar cannot have refilled yet, or when there is no
  // timeline to read: silence is still better than a guess.
  function fillFromLastSpend(events, max, secPerE, now) {
    if (!events || !events.length || !(max > 0) || !(secPerE > 0)) return 0;
    var last = 0;
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      // Gains do not date a full bar: a xanax says nothing about when the bar
      // last reached the cap on its own.
      if (!e || !(e.delta < 0) || !(e.t > 0)) continue;
      if (e.t > last) last = e.t;
    }
    if (!last) return 0;
    var filled = last + max * secPerE * 1000;
    return filled <= now ? filled : 0;
  }

  function capStreak() {
    var max = state.energyMax || 150;
    if (!state.energyKnown || state.energy < max) return null;
    var prev = state.lastSeen;
    var since = prev && prev.capSince;
    // If capSince was never written but the last stored reading was already
    // full, the streak is at least that old. Covers upgrades from a build that
    // did not track it, and any run where the first observation is the full bar.
    if (!since && prev && typeof prev.e === "number" && prev.e >= max && prev.t) since = prev.t;
    // Filled while the app was closed: the prediction is older than anything an
    // observation could know, and it is the honest answer.
    if (prev && prev.fullAt && prev.fullAt <= Date.now() && (!since || prev.fullAt < since)) {
      since = prev.fullAt;
    }
    // Nothing observed and nothing predicted: date it from the last spend the
    // API knows about. Only ever used to reach FURTHER back than what we have,
    // so a real observation is never overridden by an estimate.
    //
    // ONLY with a complete timeline. The floor argument -- that assuming the
    // spend emptied the bar can only date the fill LATER than reality -- holds
    // only if every spend is visible. On a Limited key the gym log is refused,
    // training is invisible, and the last ATTACK becomes the last known spend:
    // an attack nine hours ago dates the bar to four hours full when it was
    // emptied by training one hour ago. 0.9.40 shipped exactly that and put
    // "Bar full 240m" on screen. An incomplete timeline is not a floor, it is
    // a fiction, so it is not used at all.
    if (state.logReadable === true) {
      var est = fillFromLastSpend(
        ((state.trainLog && state.trainLog.events) || []).concat(state.attackEvents || []),
        max, energyRate(), Date.now());
      if (est && (!since || est < since)) since = est;
    }
    // A bar cannot have been full before the last moment it was seen NOT full.
    //
    // The estimate is documented as only ever reaching further back than what
    // is known, on the argument that a real observation is never overridden --
    // but reaching further back IS overriding when what it reaches past is a
    // direct sighting. Reported as "Bar full 91m" on a bar that had read
    // 148/150 four minutes earlier: capSince was set correctly the moment it
    // flipped, and the estimate then dated the fill from a spend hours before.
    //
    // This does not touch the case the estimate exists for. A bar that filled
    // while the app was closed was last seen below the cap BEFORE it filled, so
    // the clamp is older than the estimate and changes nothing.
    if (since && prev && prev.belowAt && since < prev.belowAt) since = prev.belowAt;
    if (!since) return null;
    var sec = Math.max(0, (Date.now() - since) / 1000);
    return { sec: sec, lost: sec / energyRate() };
  }

  // Missed energy is FLOORED, never rounded. Regen arrives in whole points, so
  // half a point at the cap has not cost you anything yet — rounding it up made
  // ninety seconds at a full bar report "1 missed", which reads as a mistake
  // you did not make. The fraction is still accumulated; it just is not claimed
  // until a whole point is genuinely gone.
  function missed(n) {
    return Math.floor(Math.max(0, n || 0));
  }

  function ledgerWindow(days) {
    var cut = dayKey(Date.now()) - days + 1;
    var used = 0, wasted = 0, off = 0, partial = 0;
    state.ledger.forEach(function (e) {
      if (e.d >= cut) {
        used += e.used || 0; wasted += e.wasted || 0; off += e.off || 0;
        if (e.partial) partial = 1;
      }
    });
    return { used: used, wasted: wasted, off: off, partial: partial };
  }

  // How long a "wait for a full bar first" suggestion may ask you to wait.
  // Lost when an earlier edit sliced this region out; the four places that use
  // it then threw ReferenceError on the one code path that reaches them.
  var WAIT_FULL_MAX = 45 * 60;

  // Full means at or above the cap — the point where regen genuinely stops.
  // This allowed two points of slack, inherited from the stable script and
  // never explained, which made 149/150 report "capped, regen paused" while
  // regen was still running. Worse, it drove the advice: at 149e and 10e a
  // train that is 14 trains, and thirty seconds of waiting makes it 15, so the
  // coach was recommending you throw a train away.
  function barFull(e) {
    var v = e === undefined ? state.energy || 0 : e;
    return v >= (state.energyMax || 150);
  }

  function timeToFull() {
    var max = state.energyMax || 150;
    var e = state.energy || 0;
    if (e >= max) return 0; // already full, or banked above the cap
    return Math.max(0, Math.round((max - e) * energyRate()));
  }

  function nextTickSec() {
    var d = new Date();
    var left = (15 - (d.getMinutes() % 15)) * 60 - d.getSeconds();
    if (left <= 0) left += 15 * 60;
    return left;
  }

  // Energy as a bar you can read at a glance, with a tick per train so "how
  // many goes have I got" is a count rather than a division.
  function energyMeterHtml() {
    var max = state.energyMax || 150;
    var e = Math.max(0, state.energy || 0); // NOT clamped — xanax banks energy above the cap
    var cost = state.gymEnergy || 25;
    var over = Math.max(0, e - max);
    var trains = Math.floor(e / cost);
    // When you are over the cap the bar has to be able to draw past it, so the
    // scale is whichever is larger and the cap becomes a marker on the track.
    var scale = Math.max(e, max) || 1;
    var capX = (max / scale) * 100;
    var ticks = "";
    var n = Math.floor(max / cost);
    if (n > 1 && n <= 12) {
      for (var i = 1; i < n; i++) {
        ticks += '<span class="gcb-tick" style="left:' + ((i * cost * 100) / scale).toFixed(2) + '%"></span>';
      }
    }
    var note;
    if (over > 0) note = over + " over the " + max + " cap \u00b7 regen paused, spend it";
    else if (e >= max) note = "capped \u00b7 regen paused, spend it";
    else note = "full in " + fmtCd(timeToFull());
    return (
      '<div class="gcb-mtop"><span class="gcb-mlab">Energy ' +
      (state.energyDom ? "live" : "api") +
      '</span><span class="gcb-mval' + (over > 0 ? " over" : "") + '">' + e + " / " + max + "</span></div>" +
      '<div class="gcb-track">' +
      '<span class="gcb-fill' + (over > 0 ? "" : e >= max ? " full" : "") +
      '" style="width:' + ((Math.min(e, max) / scale) * 100).toFixed(2) + '%"></span>' +
      (over > 0
        ? '<span class="gcb-over" style="left:' + capX.toFixed(2) + '%;width:' + (100 - capX).toFixed(2) + '%"></span>' +
          '<span class="gcb-capmark" style="left:' + capX.toFixed(2) + '%"></span>'
        : "") +
      ticks + "</div>" +
      '<span class="gcb-note">' + trains + " train" + (trains === 1 ? "" : "s") + " at " + cost + "e \u00b7 " + note + "</span>"
    );
  }

  // The next twelve hours as one picture: how long each cooldown still blocks
  // you, and when energy tops out. Twelve because that is the outer edge of a
  // xanax cooldown, so the longest thing you wait on always fits.
  // One line on the front page saying what the plan is and where to change it.
  // Everything it names lived behind a settings icon, so someone who never
  // tapped a cog never learned there was a plan to make at all.
  function planStripHtml() {
    if (!hasGoals()) {
      return (
        '<button type="button" class="gcb-strip" data-tab="plan">' +
        '<span class="gcb-striplab">Plan</span>' +
        '<span class="gcb-striptxt">No goals set \u2014 tap to plan your route</span>' +
        '<span class="gcb-stripgo">\u203a</span></button>'
      );
    }
    var plan = goalPlan();
    var bits = [];
    if (plan.now) {
      bits.push(STAT_LABEL[plan.now.k] + " \u2192 " + fmt(Math.round(plan.now.cap)));
      if (plan.step > 0 && plan.perDay > 0) {
        bits.push("switch in " + fmtDays(plan.now.trains / plan.perDay));
      }
    } else if (plan.next) {
      bits.push(STAT_LABEL[plan.next.k]);
    }
    if (isFinite(plan.total)) bits.push("all goals " + fmtDays(plan.total));
    if (!bits.length) return "";
    return (
      '<button type="button" class="gcb-strip" data-tab="plan">' +
      '<span class="gcb-striplab">Plan</span>' +
      '<span class="gcb-striptxt">' + esc(bits.join(" \u00b7 ")) + "</span>" +
      '<span class="gcb-stripgo">\u203a</span></button>'
    );
  }

  function railHtml() {
    var SPAN = 12 * 3600;
    var pct = function (sec) { return Math.max(0, Math.min(100, (sec / SPAN) * 100)); };
    // Only things that genuinely happen inside the next 12 hours belong on a
    // 12-hour rail. The booster cooldown is not a wait, it is a budget with a
    // ceiling, and at 28h it filled the rail and read as "maxed" when it was
    // barely half of a 48h cap. It has its own meter below now.
    var bands = "";
    if (state.drugCd > 0) bands += '<span class="gcb-band" style="left:0;width:' + pct(state.drugCd).toFixed(2) + '%;background:#f2a03d"></span>';
    var full = timeToFull();
    var mark = full > 0 && full < SPAN ? '<span class="gcb-mark" style="left:' + pct(full).toFixed(2) + '%"></span>' : "";
    var key = [];
    if (state.drugCd > 0) key.push('<span><i style="background:#f2a03d"></i>drug ' + fmtCd(state.drugCd) + "</span>");
    else key.push('<span><i style="background:#3fbf7f"></i>drug ready</span>');
    if (full > 0) key.push('<span><i style="background:#e8edf2"></i>energy full ' + fmtCd(full) + "</span>");
    return (
      '<div class="gcb-mtop"><span class="gcb-mlab">Next 12 hours</span>' +
      '<span class="gcb-mval" style="color:#8895a5;font-size:11px">tick ' + fmtCd(nextTickSec()) + "</span></div>" +
      '<div class="gcb-rail">' + bands + mark + "</div>" +
      '<div class="gcb-ticks"><span>now</span><span>+3h</span><span>+6h</span><span>+9h</span><span>+12h</span></div>' +
      '<div class="gcb-key">' + key.join("") + "</div>" +
      boosterMeterHtml()
    );
  }

  // How much of the booster ceiling is used, and how many more cans fit under
  // it — which is the question the number is actually there to answer.
  function boosterMeterHtml() {
    var cap = boosterCap();
    var cd = Math.max(0, state.boosterCd || 0);
    var headroom = Math.max(0, cap - cd);
    // Torn checks only that you are UNDER the cap when you drink, so a can can
    // carry you past it — at 46h42m you can still take one and land at 48h42m.
    // Flooring the headroom said "room for 0 more" when there was room for one.
    var fits = Math.ceil(headroom / (2 * 3600));
    var used = cap > 0 ? Math.min(100, (cd / cap) * 100) : 0;
    var tight = used >= 90;
    return (
      '<div class="gcb-mtop" style="margin-top:11px"><span class="gcb-mlab">Booster</span>' +
      '<span class="gcb-mval' + (tight ? " over" : "") + '">' + fmtCd(cd) + " / " + Math.round(cap / 3600) + "h</span></div>" +
      '<div class="gcb-track"><span class="gcb-fill' + (tight ? " full" : "") +
      '" style="width:' + used.toFixed(2) + '%"></span></div>' +
      '<span class="gcb-note">' +
      (headroom <= 0
        ? "At the ceiling \u2014 no more cans until it drops."
        : fmtCd(headroom) + " of headroom \u00b7 room for " + fits + " more can" + (fits === 1 ? "" : "s")) +
      (state.boosterPerk ? " \u00b7 48h cap from your faction perk" : "") +
      "</span>"
    );
  }

  function stepsHtml(steps) {
    if (!steps || !steps.length) return "";
    // Steps are allowed to be conditional — gymStep returns null when you are
    // already in the best gym you own — so drop the empties here rather than
    // making every branch write `|| {}`.
    steps = steps.filter(Boolean);
    if (!steps.length) return "";
    return (
      '<ol class="steps">' +
      steps
        .map(function (s) {
          return '<li><span class="when">' + s.t + "</span><span>" + s.text + "</span></li>";
        })
        .join("") +
      "</ol>"
    );
  }

  function pickBtn(attr, id, label, on) {
    return (
      '<button class="gc-btn' +
      (on ? "" : " secondary") +
      '" data-' +
      attr +
      '="' +
      id +
      '">' +
      label +
      "</button>"
    );
  }

  // Cans your plan budgets, against what you actually hold and what the booster
  // ceiling still allows. The verdict used to say "Nothing. Bar isn't full."
  // while four cans a day sat in the plan and the bar took four hours to refill
  // — advice to wait for energy you had already decided to buy.
  function cansOnHand() {
    var maxE = state.energyMax || 150;
    var have = Math.max(0, state.energy || 0);
    // A full bar does not need a can. The verdict already says train.
    if (have >= maxE) return null;

    var held = {};
    (state.drinkList || []).forEach(function (d) {
      var t = canType(d.name, d.id);
      if (t) held[t.k] = (held[t.k] || 0) + (d.qty || 0);
    });
    var known = (state.invAt || 0) > 0;
    var list = [], perDay = 0;
    srcRows().forEach(function (r) {
      if (r.grp !== "cans") return;
      var want = srcCount(r.k);
      if (want <= 0) return;
      perDay += want;
      // A can you hold none of is a plan, not a drink. But drinkList starts as
      // an empty array, so "none held" and "not read yet" look identical from
      // the list alone — invAt is the only thing that separates them, and
      // reading it wrong means either silence on a cold start or advice to
      // drink cans you do not own.
      var n = known ? Math.min(want, held[r.k] || 0) : want;
      if (n > 0 && r.e > 0) list.push({ k: r.k, label: r.label, n: n, e: r.e });
    });
    if (!perDay) return null;

    var headroom = Math.max(0, boosterCap() - Math.max(0, state.boosterCd || 0));
    // Torn only checks that you are UNDER the ceiling when you drink, so the
    // last one may carry you past it.
    var fits = Math.ceil(headroom / (2 * 3600));
    if (!list.length) return { n: 0, e: 0, fits: fits, perDay: perDay, blocked: false, dry: true };
    if (fits <= 0) return { n: 0, e: 0, fits: 0, perDay: perDay, blocked: true, dry: false };

    // Enough to fill the bar and no more. Drinking the whole day's budget at
    // once would bank most of it above the cap, where natural regen pauses —
    // and a budget of twelve is three sessions of four, not one of twelve.
    // Stopping at the cap splits them across the day without needing to model
    // a session at all.
    list.sort(function (x, y) { return y.e - x.e; }); // strongest first
    var count = {}, order = [], n = 0, e = 0;
    for (var i = 0; i < list.length && n < fits; i++) {
      for (var j = 0; j < list[i].n && n < fits; j++) {
        if (have + e >= maxE) break;
        if (count[list[i].label] === undefined) { count[list[i].label] = 0; order.push(list[i].label); }
        count[list[i].label] += 1;
        e += list[i].e;
        n += 1;
      }
    }
    if (!n) return null;
    var label = order.map(function (l) { return count[l] + " \u00d7 " + l; }).join(", ");
    return { n: n, e: e, fits: fits, perDay: perDay, blocked: false, dry: false,
             label: label, capped: n >= fits && have + e < maxE };
  }

  // A better gym you already own, as one line for the verdict.
  function gymStep(k) {
    var b = betterGym(k);
    if (!b) return null;
    var cur = GYMS.filter(function (g) { return g.Gym === state.gymName; })[0];
    var e = cur ? Number(cur.Energy) || 25 : 25;
    return {
      t: "SWITCH",
      text: b.pct === null
        ? "Change gym to " + b.gym.Gym + " first \u2014 " + state.gymName + " cannot train " +
          STAT_LABEL[k] + " at all, and you have " + b.gym.Gym + " unlocked."
        : "Change gym to " + b.gym.Gym + " first \u2014 it trains " + STAT_LABEL[k] + " " +
          b.pct + "% faster for the same " + fmt(e) + "e a train, and you have it unlocked."
    };
  }

  // One step for the verdict, or null when there is nothing worth saying.
  function canStep(waitText) {
    var c = cansOnHand();
    if (!c) return null;
    if (c.blocked) {
      return { t: "CANS", text: "Your booster cooldown is at the ceiling, so no cans until it drops." };
    }
    if (c.dry) {
      return { t: "CANS", text: "Your plan budgets " + c.perDay + " can" + (c.perDay === 1 ? "" : "s") +
        " a day but you are holding none." };
    }
    var cost = state.gymEnergy || 25;
    var trains = Math.floor(c.e / cost);
    return {
      t: "CANS",
      text: "Drink " + c.label + " (+" + fmt(c.e) + "e" +
        (trains > 0 ? ", " + trains + " more train" + (trains === 1 ? "" : "s") : "") + ")" +
        (waitText ? " instead of waiting " + waitText + " for the bar" : "") + "." +
        (c.perDay > c.n
          ? " That is " + c.n + " of the " + c.perDay + " a day you budget — enough to fill the bar; the rest keep for later sessions."
          : "") +
        (c.capped ? " Only " + c.fits + " fit before the booster ceiling." : "")
    };
  }

  // --- the bar sitting full -------------------------------------------------
  // A gym coach that only speaks on the gym page cannot catch the one mistake
  // that costs the most: wandering off with a full bar. The poller already runs
  // on every Torn page, so the data is here -- what was missing was anywhere to
  // say it.

  // capStreak() owns the clock; this owns only the acknowledgement. It is
  // cleared the moment energy leaves the bar, or a "Got it" from this bar
  // would silence the first ten minutes of the NEXT one.
  function trackFullBar() {
    if (state.energyKnown && state.energy >= state.energyMax) return;
    if (state.fullAckAt) {
      state.fullAckAt = 0;
      storeSet("fullack", 0);
    }
  }

  // Should the banner be up? Pure, so the timing rules can be tested without
  // a browser. `streakSec` is capStreak().sec. Returns { minutes } or null.
  //
  // It reads capStreak() rather than keeping its own clock, and that is the
  // whole point. The first cut tracked a separate `fullSince` set the first
  // time a live tick SAW a full bar -- so reopening the app restarted it, and
  // the panel could say "Bar has been full for 19m" while the banner, five
  // pixels away, believed the bar had just filled and stayed silent. capStreak
  // already handles the cases that clock could not: a bar that filled while
  // the app was closed (it uses the predicted fill time), and an upgrade from
  // a build that never recorded the moment at all.
  function fullBarNag(now, streakSec, ackAt, stacking, energy, max) {
    // Holding the bar is the entire point of a war stack, so nagging about it
    // would be telling you off for following the plan the coach gave you.
    if (stacking) return null;
    // Above the cap Torn pauses regen, so nothing is bleeding up there.
    if (max && energy > max) return null;
    // null is capStreak saying the bar is not at the cap, or that it has no
    // honest answer yet. isFinite as well as the type check, because
    // `typeof NaN` is "number" and NaN loses every comparison below -- it
    // would sail past the threshold and render "Bar full NaNm".
    if (typeof streakSec !== "number" || !isFinite(streakSec)) return null;
    if (streakSec * 1000 < FULLBAR_NAG_MS) return null;
    // "Got it" is a snooze, not a silence: acknowledging buys quiet, and the
    // banner comes back while the bar is still full. Only training ends it.
    if (ackAt && now - ackAt < FULLBAR_SNOOZE_MS) return null;
    return { minutes: Math.floor(streakSec / 60) };
  }

  // One step for the verdict when today's point refill is still unspent and
  // there is enough room in the bar for it to be worth spending.
  function refillStep() {
    // null means the key could not read the flag. A reminder built on a guess
    // is worse than none: it would fire every day whether or not you had
    // already used it.
    if (state.refillUsed !== false) return null;
    var max = state.energyMax || 0;
    if (!max) return null;
    var room = max - state.energy;
    if (room < max * (1 - REFILL_WORTH_PCT)) return null;
    return {
      t: "REFILL",
      text: "Your daily point refill is still unused, and the bar is down " +
        fmt(room) + "e. Refilling now takes you straight back to " + fmt(max) + "."
    };
  }


  // --- how far off the next gym is ------------------------------------------
  // Torn already tracks this and paints it: the gym you are working toward
  // carries inProgress___ and a whole-number percentage. That percentage is the
  // share of the segment already trained, so the rest of the answer is just the
  // segment length. Nothing needs summing out of the training logs.
  //
  // Returns the 1-based Torn gym id being unlocked and the percentage, or null
  // when there is nothing to report — every standard gym already unlocked, or a
  // button caught half-rendered. Guessing from a partial button is worse than
  // staying quiet, which is why both halves have to be present.
  function unlockScan(nodes) {
    if (!nodes) return null;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n || !/inProgress/.test(String(n.className || ""))) continue;
      if (typeof n.querySelector !== "function") continue;
      // The icon child carries the id: "gymIcon___xx gym-24___yy". Position in
      // the list would work too, but only while Torn keeps three rows of eight.
      var icon = n.querySelector('[class*="gym-"]');
      var m = icon && String(icon.className || "").match(/gym-(\d+)/);
      var pctEl = n.querySelector('[class*="percentage"]');
      var pm = pctEl && String(pctEl.textContent || "").match(/(\d+(?:\.\d+)?)\s*%/);
      if (!m || !pm) continue;
      return { gymId: parseInt(m[1], 10), pct: parseFloat(pm[1]) };
    }
    return null;
  }

  // The Music Store's "Well Tuned" perk reads "30% gym experience" and makes
  // every gym unlock 30% sooner. It is NOT a stat multiplier — isGymPerkLine()
  // drops it on purpose, and must keep doing so or every projection in the
  // script inflates by 30%. The number is read from the line rather than
  // hardcoded, so a reworded or retuned perk still lands correctly.
  function gymExpMult(data) {
    var mult = 1;
    [(data || {}).job_perks, (data || {}).company_perks].forEach(function (arr) {
      (arr || []).forEach(function (line) {
        var s = String(line || "");
        if (!/gym\s+experience/i.test(s)) return;
        var n = extractPercentMult(s);
        if (n && n > 1 && n < 6) mult *= n;
      });
    });
    return mult;
  }

  // gymId is the gym being unlocked, pct how much of its segment is done.
  function unlockEstimate(gymId, pct, expMult) {
    var req = GYM_SEGMENT_E[gymId - 2];
    if (!req) return null;              // gym 1, or a specialist — stat-gated
    if (expMult && expMult > 1) req = Math.round(req / expMult);
    // Torn shows a whole number, so the truth sits somewhere inside that
    // percent. Reporting a range is honest; reporting a single figure is not.
    var p = Math.max(0, Math.min(100, Number(pct) || 0));
    var remainMax = Math.round(req * (100 - p) / 100);
    var remainMin = Math.max(0, Math.round(req * (100 - Math.min(100, p + 1)) / 100));
    return {
      gymId: gymId, pct: p, req: req,
      remainMin: remainMin, remainMax: remainMax,
      gym: GYMS[gymId - 1] || null,
    };
  }

  // --- which gyms you actually own ------------------------------------------
  // Torn's API does not expose it: `user?selections=gym` returns active_gym and
  // nothing else. gym.php renders all 32 buttons though, and a locked one says
  // so in its class — so the page you are already standing on is the only
  // source, and it is free.
  //
  // Button order is 1:1 with GYMS by INDEX, not by name (Torn spells a few
  // differently: "Woody's Workout Club" against "Woodys Workout"). The 32nd
  // button is a jail placeholder with no GYMS entry, so the walk stops at the
  // end of the table rather than at the end of the list.
  function gymsUnlocked(nodes) {
    var out = [];
    if (!nodes) return out;
    var n = Math.min(nodes.length, GYMS.length);
    for (var i = 0; i < n; i++) {
      // `locked___` and `lockedPurchased___` both mean unusable; one regex
      // catches both. The active gym also carries `active___`, which is not a
      // lock and must not read as one.
      if (/locked/i.test(String((nodes[i] && nodes[i].className) || ""))) continue;
      out.push(i);
    }
    return out;
  }

  function scanGymList() {
    if (!/gym\.php/i.test(location.href)) return false;
    var btns;
    try { btns = document.querySelectorAll('button[class*="gymButton"]'); } catch (_) { return false; }
    // The React list renders late; a handful of buttons means a half-built page,
    // and half a page would read as "most gyms locked" and hide real upgrades.
    if (!btns || btns.length < 20) return false;
    var owned = gymsUnlocked(btns);
    if (!owned.length) return false;
    state.gymsOwned = owned;
    storeSet("gymsOwned", owned);
    // gym.php is the only place the unlock percentage exists, so it is read
    // here and kept — the Trend tab has to answer while you are somewhere else.
    // A null reading is never persisted over a real one: once every standard
    // gym is yours Torn simply stops painting the bar, and that case is decided
    // by the owned set rather than by the absence of a percentage.
    var u = unlockScan(btns);
    if (u) {
      u.t = Date.now();
      state.unlock = u;
      storeSet("unlock", u);
    }
    return true;
  }

  // The best gym you OWN for this stat, or null when you are already in it.
  //
  // Same energy per train or cheaper, only. A gym with more dots that also costs
  // more energy is a genuine trade — more per train against fewer trains — and
  // the coach does not get to make that call for you. What it will not stay
  // quiet about is the case with no trade in it at all: Anabolic Anomalies and
  // George's are both 10e a train, and George's returns 46% more.
  function betterGym(k) {
    var owned = state.gymsOwned;
    if (!owned || !owned.length) return null;   // never scanned: say nothing
    var cur = GYMS.filter(function (g) { return g.Gym === state.gymName; })[0];
    if (!cur) return null;
    var DOT = { str: "Str", def: "Def", spe: "Spe", dex: "Dex" }[k];
    if (!DOT) return null;
    var curDots = Number(cur[DOT]) || 0;
    var curE = Number(cur.Energy) || 25;
    var best = null;
    owned.forEach(function (i) {
      var g = GYMS[i];
      if (!g || g.Gym === cur.Gym) return;
      var d = Number(g[DOT]) || 0;
      var e = Number(g.Energy) || 25;
      if (e > curE || d <= curDots) return;
      if (!best) { best = g; return; }
      var bd = Number(best[DOT]) || 0;
      if (d > bd || (d === bd && e < (Number(best.Energy) || 25))) best = g;
    });
    if (!best) return null;
    return {
      gym: best,
      // A percentage against zero dots is not a number anyone can act on — from
      // a gym that cannot train the stat at all, the answer is "this one can".
      pct: curDots > 0 ? Math.round((Number(best[DOT]) / curDots - 1) * 100) : null
    };
  }

  // Nine of the 31 gyms cannot train some stat at all: Balboas is Defense and
  // Dexterity only, Legs Bums and Tums has no Strength, and the four specialist
  // gyms train exactly one stat each. The advice never looked, so it cheerfully
  // said "Train 150e into Strength at Balboas Gym" — a bar you cannot spend.
  function gymDots(k) {
    return Number((state.dots || {})[k]) || 0;
  }

  // Whether the dot table has actually been read. All-zero means "no gym data
  // yet", not "this gym trains nothing" — firing the block on a cold start
  // would accuse every gym of being untrainable before the first poll lands.
  function dotsKnown() {
    return HIST_KEYS.some(function (k) { return gymDots(k) > 0; });
  }

  // The verdict for a stat this gym cannot train, or null when it can.
  function gymBlockedFor(k) {
    if (!k || !dotsKnown() || gymDots(k) > 0) return null;
    var gym = state.gymName || "This gym";
    var can = HIST_KEYS.filter(function (x) { return gymDots(x) > 0; })
                       .map(function (x) { return STAT_LABEL[x]; });
    var list = can.length > 1
      ? can.slice(0, -1).join(", ") + " and " + can[can.length - 1]
      : can[0] || "nothing";
    return {
      kind: "wait",
      move: gym + " cannot train " + STAT_LABEL[k] + ".",
      why: gym + " trains " + list + " only, so a bar spent here does nothing for " +
           STAT_LABEL[k] + ".",
      steps: [
        { t: "NOW", text: "Do not train here. The energy would go into a stat you are not working on." },
        gymStep(k) ||
          { t: "PICK", text: "Either move to a gym that trains " + STAT_LABEL[k] +
                             ", or change the stat you are training to " + list + "." },
        { t: "THEN", text: "Come back and the coach picks up where it left off." }
      ]
    };
  }

  function coach() {
    // Before any branch that could tell you to spend a bar.
    var blocked = gymBlockedFor(state.focus);
    if (blocked) return blocked;

    var focus = focusLabel();
    // Where you SHOULD train, which is not always where you are. Naming the
    // current gym while a SWITCH step sits underneath saying to leave it is a
    // card arguing with itself — "Train Strength at Force Training" one line
    // above "George's trains Strength 14% faster". One gym per verdict.
    var upgrade = betterGym(state.focus);
    var gym = (upgrade ? upgrade.gym.Gym : state.gymName) || "your gym";
    var toFull = timeToFull();
    var full = barFull();
    var xans = state.items.xanax || 0;
    var afterXan = Math.min(STACK_CAP, state.energy + 250);
    var cans =
      (state.items.munster || 0) +
      (state.items.redcow || 0) +
      (state.items.tourine || 0) +
      (state.items.cans || 0);

    if (state.warStack) {
      // This used to read "Do not take a Xanax", which contradicts the mechanic
      // it is advising: a stack is built BY taking them. Each banks 250e above
      // the cap, and above the cap Torn pauses regen, so a stacked bar loses
      // nothing while it waits. Sitting AT the cap instead is the only state
      // that bleeds. What stays true is not TRAINING it away.
      var stackRoom = STACK_CAP - state.energy;
      var takeXan = state.drugCd <= 0 && xans > 0 && stackRoom >= 250;
      var nowText = takeXan
        ? "Take a Xanax. " + state.energy + " \u2192 " + afterXan + "e banked."
        : state.drugCd > 0
          ? "Hold. Next Xanax in " + fmtCd(state.drugCd) + " \u2014 " + state.energy +
            "/" + fmt(STACK_CAP) + " banked."
          : xans <= 0
            ? "Hold. No Xanax in your inventory to stack with."
            : "Hold at " + state.energy + "e. Another Xanax would spill past the " +
              fmt(STACK_CAP) + "e ceiling.";
      return {
        kind: "stack",
        move: "War stack. " + (takeXan ? "Take a Xanax." : "Hold energy."),
        why: "Xanax is how the stack grows \u2014 each banks 250e above the cap, where " +
             "regen is paused and nothing bleeds. Don\u2019t train it away. Coach only " +
             "pings if you hit " + fmt(STACK_CAP) + "e.",
        steps: [
          { t: "NOW", text: nowText },
          { t: "AFTER", text: "When the chain is over, turn stack off and go back to your gym loop." },
        ],
      };
    }

    if (state.mode === "jump") return jumpCoach();

    if (!resolveKey() && state.status !== "live") {
      return {
        kind: "wait",
        move: "Connect a key so this can run live.",
        why: "Torn PDA injects your Limited API key. If Set still asks, paste one there.",
        steps: [{ t: "SET", text: "Open Set. If the key isn\u2019t injected, paste a Limited API key." }],
      };
    }

    if (state.drugCd <= 0 && xans <= 0) {
      return {
        kind: "wait",
        move: "Buy some Xanax. Your drug cooldown is clear and your bar is empty.",
        why: "Your routine is Xanax + train " + focus + ". No xans means you\u2019re only on natural energy.",
        steps: [
          { t: "NOW", text: "Buy at least 3 xanax." },
          {
            t: "THEN",
            text: full
              ? "Bar is full — train " + focus + " so you don\u2019t overflow while shopping."
              : "Wait " + fmtCd(toFull) + " for a full bar, then xan.",
          },
        ],
      };
    }

    if (state.drugCd <= 0) {
      var waitFull = !full && toFull > 0 && toFull <= WAIT_FULL_MAX;
      if (waitFull) {
        var fat = (state.energyMax || 150) + 250;
        return {
          kind: "wait",
          move: "Wait " + fmtCd(toFull) + " for a full bar, then take a xan.",
          why:
            "Xan is ready but you\u2019re at " +
            state.energy +
            "/" +
            state.energyMax +
            ". Waiting lets you train " +
            fat +
            "e into " +
            focus +
            " instead of " +
            afterXan +
            "e.",
          steps: [
            { t: "NOW", text: "Do not take a Xanax. Do not train. Let energy fill. " + fmtCd(toFull) + " left." },
            { t: "+" + fmtCd(toFull), text: "Bar hits " + state.energyMax + ". Take 1 Xanax (" + xans + " left)." },
            { t: "THEN", text: "Train " + fat + "e into " + focus + " at " + gym + ". One session. Don\u2019t split stats." },
            {
              t: "WAIT",
              text: "The drug cooldown starts (about 6–8h). While it counts down, spend your natural energy whenever the bar fills. Never overflow.",
            },
            {
              t: "NEXT",
              text: "cooldown reaches 0 → wait for a full bar if it is under ~45m → take a Xanax → train " + focus + " again.",
            },
          ],
          waste: "If you take a Xanax now you would only train " + afterXan + "e. Waiting picks up the rest of the bar.",
        };
      }
      var trainNow = full ? Math.min(1000, state.energy + 250) : afterXan;
      var canAdd = boosterOpen(state.boosterCd) && cans > 0;
      return {
        kind: "go",
        move: full
          ? "Take a Xanax now, then train " + trainNow + "e " + focus + "."
          : "Take a xan now (" + state.energy + "e → " + afterXan + "e), then train " + focus + ".",
        why: full
          ? "Bar is full and your drug cooldown is clear. Take the Xanax first, so this session is " + trainNow + "e, not " + state.energy + "e."
          : "Your drug cooldown is clear. Waiting for a full bar would take " +
            fmtCd(toFull) +
            " and delay your next Xanax. Take it, then train " +
            focus +
            ", the cooldown starts.",
        steps: [
          {
            t: "NOW",
            text:
              "Take 1 Xanax. You have " +
              xans +
              "." +
              (canAdd ? " Booster is under 24h — cans after the xan if you want a bigger training session." : ""),
          },
          { t: "THEN", text: "Go to " + gym + ". Spend ALL your energy on " + focus + "." + leftoverNote() },
          { t: "WAIT", text: "Drug cooldown is about 6–8h. Do not take a Xanax until this says READY." },
          {
            t: "BETWEEN",
            text: "When energy fills, train " + focus + " again. Never leave the bar sitting full while the cooldown is still running.",
          },
          {
            t: "REPEAT",
            text: "cooldown reaches 0 → wait for full bar if under ~45m → take a Xanax → train " + focus + ".",
          },
        ],
      };
    }

    if (full) {
      return {
        kind: "go",
        move: "Train " + focus + " now. Don\u2019t sit on a full bar.",
        why: "Xan is on cooldown " + fmtCd(state.drugCd) + ". Overflowing energy is stats you never get back.",
        steps: [
          gymStep(state.focus),
          mcsStep(),
          { t: "NOW", text: "Train " + state.energy + "e into " + focus + " at " + gym + "." },
          { t: "WAIT", text: "Drug cooldown: " + fmtCd(state.drugCd) + ". Let the bar fill again while it ticks." },
          {
            t: "GOAL",
            text: "Be at a full bar when xan comes off cooldown, then take a Xanax and train " + focus + " in one go.",
          },
        ],
      };
    }

    if (toFull > 0 && state.drugCd < toFull) {
      var extra = toFull - state.drugCd;
      return {
        kind: "wait",
        move: "Wait " + fmtCd(state.drugCd) + " for xan, then train " + focus + ".",
        why:
          "Energy is " +
          state.energy +
          "/" +
          state.energyMax +
          " (full in " +
          fmtCd(toFull) +
          "). Your drug cooldown reaches 0 first. Don\u2019t train this bar away unless you\u2019re about to overflow.",
        steps: [
          refillStep(),
          mcsStep(),
          canStep(fmtCd(toFull)) ||
            { t: "NOW", text: "Nothing. Bar isn\u2019t full. Xan isn\u2019t ready." },
          {
            t: "+" + fmtCd(state.drugCd),
            text:
              extra <= WAIT_FULL_MAX
                ? "Xanax cooldown reaches 0. Wait the extra " + fmtCd(extra) + " for a full bar, then take a xan."
                : "Xanax cooldown reaches 0. Take a xan now, then train " + focus + ".",
          },
          { t: "THEN", text: "Train " + focus + " at " + gym + "." },
          { t: "LOOP", text: "Wait the next drug cooldown. Train whenever energy fills so you never overflow." },
        ],
      };
    }

    return {
      kind: "wait",
      move: "Wait " + fmtCd(toFull) + " for full energy, then train " + focus + ".",
      why:
        "Xan still has " +
        fmtCd(state.drugCd) +
        " left on its cooldown. Fill the bar, spend it, do not let it overflow. Xanax after that.",
      steps: [
        gymStep(state.focus),
        refillStep(),
        mcsStep(),
        canStep(fmtCd(toFull)) || {
          t: "NOW",
          text: "Let energy fill. " + state.energy + "/" + state.energyMax + " · " + fmtCd(toFull) + " left.",
        },
        {
          t: "+" + fmtCd(toFull),
          text: "Bar full. Train " + focus + " at " + gym + ". Don\u2019t wait — overflow is wasted.",
        },
        {
          t: "+" + fmtCd(state.drugCd),
          text: "Xan ready. Prefer a full bar, then take a Xanax and train " + focus + " again.",
        },
      ],
    };
  }

  function jumpCoach() {
    var tick = nextTickSec();
    var focus = focusLabel();
    var xtc = state.items.ecstasy || 0;
    var stacked = state.energy >= 750;
    var edvdHappy = state.adultNov ? 5000 : 2500;

    if (state.drugCd > 0 && state.energy < 1000 && !stacked) {
      return {
        kind: "wait",
        move: "Jump prep. Wait " + fmtCd(state.drugCd) + " then xan to stack energy.",
        why:
          "Happy jump wants a fat energy pool first. You\u2019re at " +
          state.energy +
          "e. Stack xans to ~750–1000e, CDs clear, then hit the :00 / :15 / :30 / :45 tick.",
        steps: [
          { t: "NOW", text: "Don\u2019t train this energy. You\u2019re banking for a jump." },
          { t: "+" + fmtCd(state.drugCd), text: "Take 1 Xanax. Repeat until you\u2019re near 1,000e (usually 3–4 xans)." },
          { t: "THEN", text: "Let drug AND booster cooldowns hit zero." },
          { t: "TICK", text: "Wait for xx:00 / :15 / :30 / :45. Next tick in " + fmtCd(tick) + "." },
          {
            t: "JUMP",
            text:
              "Happy items (" +
              happyKitText() +
              "). E-dvds +" +
              edvdHappy +
              " each. Then spend ALL your energy on " +
              focus +
              ", refill if you want a second training session before the next tick.",
          },
        ],
      };
    }

    if (!stacked && state.drugCd <= 0) {
      return {
        kind: "go",
        move: "Xan to stack. Don\u2019t train yet.",
        why: "Jump mode is on. Bank energy to ~1,000 before you touch happy items.",
        steps: [
          { t: "NOW", text: "Take 1 Xanax. Energy " + state.energy + " → " + Math.min(1000, state.energy + 250) + "." },
          { t: "REPEAT", text: "Each time the drug cooldown clears, take another Xanax until 750–1000e." },
          { t: "STOP", text: "Do not gym until the jump window." },
        ],
      };
    }

    if (state.drugCd > 0 || state.boosterCd > 30 * 60) {
      return {
        kind: "wait",
        move: "Energy is stacked. Wait CDs, then jump on the tick.",
        why: "Don\u2019t train. Overcap happy dies every 15 minutes. You need CDs clear so you can pop items + ecstasy.",
        steps: [
          { t: "NOW", text: state.energy + "e banked. Hold it." },
          { t: "TIMERS", text: "Drug " + fmtCd(state.drugCd) + " · booster " + fmtCd(state.boosterCd) },
          { t: "TICK", text: "Next happy tick in " + fmtCd(tick) + "." },
          {
            t: "GO",
            text: happyKitText() + ". Train " + focus + " immediately.",
          },
        ],
      };
    }

    if (tick > 90) {
      return {
        kind: "wait",
        move: "Jump window in " + fmtCd(tick) + ". Don\u2019t use items yet.",
        why:
          "Overcap happy wipes at the quarter hour. Use items right after the tick, ecstasy last, then train " +
          focus +
          " before the next one.",
        steps: [
          { t: "NOW", text: "Hands off. " + state.energy + "e ready." },
          { t: "+" + fmtCd(tick), text: "Tick. " + happyKitText() + "." },
          { t: "THEN", text: "Ecstasy LAST — it doubles current happy. You have " + xtc + "." },
          {
            t: "DUMP",
            text: "All energy into " + focus + " as fast as you can. Optional points refill + second training session before the next tick.",
          },
        ],
      };
    }

    return {
      kind: "go",
      move: "TICK. Happy items, ecstasy last, then train " + focus + " now.",
      why: "This is the jump. Items → ecstasy → gym → refill if you can before the next wipe.",
      steps: [
        {
          t: "1",
          text: happyKitText() + ". E-dvds +" + edvdHappy + " each. Don\u2019t overcap the booster bar.",
        },
        { t: "2", text: "Ecstasy. Always last. " + xtc + " in inventory." },
        { t: "3", text: "Spend every point of energy on " + focus + "." },
        { t: "4", text: "Use a points refill if you have one, then train again before the next :15 reset." },
      ],
    };
  }

  function leftoverNote() {
    if (!state.focus2 || state.focus2 === "none" || state.focus2 === state.focus) return "";
    var labels = { str: "Strength", def: "Defense", spe: "Speed", dex: "Dexterity" };
    return " Leftover energy can go to " + (labels[state.focus2] || "the second skill") + ".";
  }

  function focusLabel() {
    return { str: "Strength", def: "Defense", spe: "Speed", dex: "Dexterity" }[state.focus] || "Strength";
  }

  // Declared here, above BOTH users. They were 1,700 lines below the poll-driven
  // logger that reads them and worked only by var hoisting — the same ordering
  // fragility that lost WAIT_FULL_MAX.
  // Was a poll-observed energy drop really a training session? Extracted so it
  // can be tested directly — the first version of these tests reimplemented the
  // rule inside the test, so mutating the real code changed nothing and every
  // mutation passed.
  function pollTrainEntry(prevE, nowE, prevStats, nowStats, gymName, busy) {
    var skill = inferTrainSkillFromDelta(prevStats, nowStats);
    var gkey = STAT_KEY[skill];
    var gained = gkey ? Math.max(0, (nowStats[gkey] || 0) - (prevStats[gkey] || 0)) : 0;
    // energy is updated live from the page while the API lags, so a stale poll
    // a few points lower is not a session. A real train always raises the stat.
    if (!prevE || nowE >= prevE - 4) return "";
    if (gained <= 0) return "";
    if (busy) return "";   // the click handler is already measuring this one
    return "Trained" + (skill ? " " + skill : "") +
      " \u00b7 " + fmt(prevE - nowE) + "e spent" +
      " \u00b7 +" + fmt(gained) +
      " @ " + (gymName || "gym");
  }

  var pendingTrain = null;
  var STAT_KEY = { Strength: "str", Defense: "def", Speed: "spe", Dexterity: "dex" };

  function applyUserPayload(data, withInv) {
    var e = data.energy || {};
    var h = data.happy || {};
    var cd = data.cooldowns || {};
    var prevE = state.energy;
    var prevStats = {
      str: state.stats.str,
      def: state.stats.def,
      spe: state.stats.spe,
      dex: state.stats.dex,
    };

    state.energy = Number(e.current) || 0;
    state.energyKnown = true;
    state.energyMax = Number(e.maximum) || 150;
    state.energyFulltime = Number(e.fulltime) || 0;
    // fulltime answers "how long from THIS energy", so it is only usable while
    // the energy it was measured at is still current — and the DOM updates
    // energy between polls. Convert it to a per-point rate, which stays true as
    // energy moves. Keep the last good rate if this payload cannot supply one.
    var eGap = (Number(e.maximum) || 150) - (Number(e.current) || 0);
    if (eGap > 0 && state.energyFulltime > 0) {
      state.energySecPerE = state.energyFulltime / eGap;
      // Persist it. A full bar reports fulltime 0, so a cold start that opens
      // ON a full bar can never derive the rate and fell back to Torn's base of
      // 180s a point. For a perked bar nearer 30s that makes every inferred
      // fill six times too long, which silently zeroed the waste.
      storeSet("energySecPerE", state.energySecPerE);
    }
    state.happy = Number(h.current) || 0;
    state.happyMax = Number(h.maximum) || 0;
    state.drugCd = Number(cd.drug) || 0;
    state.boosterCd = Number(cd.booster) || 0;
    state.stats = {
      str: Number(data.strength) || 0,
      def: Number(data.defense) || 0,
      spe: Number(data.speed) || 0,
      dex: Number(data.dexterity) || 0,
    };
    if (data.active_gym) {
      var gym = GYMS[data.active_gym - 1] || GYMS[0];
      state.gymName = gym.Gym;
      state.gymEnergy = gym.Energy;
      state.dots = { str: Number(gym.Str) || 0, def: Number(gym.Def) || 0, spe: Number(gym.Spe) || 0, dex: Number(gym.Dex) || 0 };
    }
    var parsed = parsePerks(data);
    state.perks = parsed;
    state.perkHits = parsed.hits || {};
    state.perkRaw = parsed.raw || {};
    // Read from your perks rather than a switch you had to remember to set.
    state.adultNov = !!parsed.adultNov;
    state.canMult = parsed.canMult > 0 ? parsed.canMult : 1;
    // Kept apart from the stat multipliers on purpose: gym EXP changes how fast
    // the NEXT GYM arrives and nothing about what a train is worth.
    state.gymExpMult = gymExpMult(data);
    // Sticky: the perk is a faction benefit, so once seen keep it until a perk
    // payload positively says otherwise.
    if (parsed.boosterPerk && !state.boosterPerk) { state.boosterPerk = true; storeSet("boosterPerk", true); }
    noteBoosterPerk();
    if (withInv) {
      var invRaw = data.inventory;
      var invRows = !invRaw ? 0 : Array.isArray(invRaw) ? invRaw.length : Object.keys(invRaw).length;
      if (typeof invRaw === "string") {
        // Torn sent a STRING where the item list should be. Object.keys() on a
        // string yields character indices, so countItems was walking it letter
        // by letter — every "row" one char with no name and no quantity, which
        // is why 46 rows matched nothing. Keep the last good counts rather than
        // overwrite them with a fabricated zero.
        state.invUnavailable = invRaw;
        state.invDiag = { at: Date.now(), present: false, rows: 0, matched: 0 };
      } else if (invRaw) {
        state.invUnavailable = "";
        var counted = countItems(invRaw);
        applyCountedItems(counted);
        var matched = 0;
        for (var ck in counted.qty) if (counted.qty[ck]) matched++;
        // Every row came back ?name/?qty, so the field names are not what this
        // parser assumes. Train the first row verbatim rather than guess which
        // renaming happened.
        var sample = [];
        try {
          var isArr = Array.isArray(invRaw);
          var keys0 = isArr ? null : Object.keys(invRaw).slice(0, 3);
          var rowsArr = isArr ? invRaw : Object.keys(invRaw).map(function (k) { return invRaw[k]; });
          var first = rowsArr[0];
          sample.push((isArr ? "array" : "object keyed " + JSON.stringify(keys0)) + ", row0 is " + typeof first);
          try {
            sample.push(String(JSON.stringify(first)).slice(0, 160));
          } catch (_) {
            sample.push("row0 not serialisable");
          }
        } catch (e) {
          sample.push("diag threw: " + (e && e.message));
        }
        state.invDiag = { at: Date.now(), present: true, rows: invRows, matched: matched, sample: sample };
      } else {
        // Payload came back without an inventory block at all — that is an API
        // or key-scope answer, not a counting bug, and the two look identical
        // from the Items tab.
        state.invDiag = { at: Date.now(), present: false, rows: 0, matched: 0 };
      }
    }
    state.lastFetch = Date.now();
    state.status = "live";
    state.statusText = "Live";
    recordHistory();

    var newTot = state.stats.str + state.stats.def + state.stats.spe + state.stats.dex;
    var prevTot = prevStats.str + prevStats.def + prevStats.spe + prevStats.dex;
    // A second, poll-driven train logger, for training the click handler did not
    // see. It compared energy between readings — but state.energy is updated
    // live from the page while the API lags, so a stale poll reading a few
    // points lower looked exactly like a small session and logged a train that
    // never happened. A real train ALWAYS raises the stat, so require that as
    // corroboration, and attribute the gain to the stat that actually moved
    // rather than to the total of all four.
    // Superseded by the ledger-driven path: this compared energy between
    // payloads, which the live page update had already absorbed.
    if (false) {
      state.flash = "TRAINED";
      state.lastTrain = Date.now();
      setTimeout(function () {
        state.flash = "";
        renderPanel();
      }, 1800);
    }
  }

  function inferTrainSkillFromDelta(prev, next) {
    var keys = ["str", "def", "spe", "dex"];
    var labels = { str: "Strength", def: "Defense", spe: "Speed", dex: "Dexterity" };
    var best = "";
    var bestD = 0;
    keys.forEach(function (k) {
      var d = (next[k] || 0) - (prev[k] || 0);
      if (d > bestD) {
        bestD = d;
        best = labels[k];
      }
    });
    return best;
  }

  var DAY_MS = 86400000;
  var HIST_CAP = 400; // ~13 months; the chart's longest range is 365d

  function dayKey(ms) {
    return Math.floor(ms / DAY_MS);
  }

  // Upsert TODAY's stat snapshot. Last write of a day wins, so a day ends up
  // holding the stats as of its final refresh — which is what a daily
  // progression line wants. Cheap enough to call on every successful fetch.
  function recordHistory() {
    var st = state.stats;
    if (!st) return;
    var v = [st.str | 0, st.def | 0, st.spe | 0, st.dex | 0];
    if (!(v[0] || v[1] || v[2] || v[3])) return; // never record a failed read as a real zero
    var d = dayKey(Date.now());
    var last = state.hist.length ? state.hist[state.hist.length - 1] : null;
    if (last && last.d === d) {
      if (last.v[0] === v[0] && last.v[1] === v[1] && last.v[2] === v[2] && last.v[3] === v[3]) return;
      last.v = v;
    } else if (last && last.d > d) {
      return; // clock went backwards; leave the series alone rather than corrupt it
    } else {
      state.hist.push({ d: d, v: v });
      if (state.hist.length > HIST_CAP) state.hist = state.hist.slice(state.hist.length - HIST_CAP);
    }
    storeSet("hist", state.hist);
  }

  // ── Progression chart ──────────────────────────────────────────────────
  // Inline SVG on purpose: no library (Torn's CSP blocks external script) and
  // no canvas (retina scaling plus PDA's webview is more trouble than paths).
  var HIST_KEYS = ["str", "def", "spe", "dex"];

  // The four stat books. Each awards +5% of the stat, capped at 10,000,000,
  // after 31 days of reading.
  //
  // NOT perks: nothing appears in book_perks and no multiplier changes, so
  // parsePerks can never see them. That is why the coach could forecast months
  // ahead while ignoring a known, dated gain already in the post.
  //
  // Names verified against the wiki one at a time rather than inferred, and
  // two of them would have been got wrong by guessing: "Get Hard Or Go Home"
  // sounds like the Defense book but is +20% gym gains for 31 days, and
  // "Weaseling Out Of Trouble" is a passive Dexterity bonus, not an award.
  var STAT_BOOKS = {
    str: { name: "Brawn Over Brains" },
    def: { name: "Keeping Your Face Handsome" },
    spe: { name: "Time Is In The Mind" },
    dex: { name: "A Job For Your Hands" }
  };
  var BOOK_PCT = 0.05;
  var BOOK_CAP = 10000000;
  var BOOK_DAYS = 31;

  // What finishing the book is worth. The cap binds for anyone past 200m in a
  // stat, which is most people who care about a projection at all.
  // Which stat book you are reading, off the page.
  //
  // Nothing about a stat book reaches the perks payload -- confirmed live, with
  // an empty perks.book array while one was actively being read -- because the
  // four award a one-off stat gain rather than an active multiplier, so
  // parsePerks structurally cannot see them. That is why 0.9.44 made this a tap.
  //
  // The status-icon strip under the Life bar does carry it, and carries it ONLY
  // in aria-label: not title, not src, not text. Three separate scans of that
  // area came back empty for exactly that reason before anyone read the
  // attribute.
  //
  // Class hashes are build-volatile, so every selector here is a prefix match.
  // The icon's own numeric class (icon68 at time of writing) is NOT trusted --
  // those numbers shift, and the label prefix is the thing that means something.
  //
  // Three distinct answers, and the difference between the last two is the
  // whole point:
  //   { found: true, name, k }  a book is being read; k is null if it is not
  //                             one of the four stat books
  //   { found: false }          the strip is on this page and carries no book
  //   null                      no strip here at all -- which is NOT the same
  //                             as "no book", and must never clear a stored one
  var BOOK_LABEL_RE = /^\s*reading\s+book\s*:\s*/i;
  // Whatever dash Torn separates the name from the effect with today.
  var BOOK_DASH_RE = /\s[\u2014\u2013-]\s/;
  function readBookFromDom(root) {
    var doc = root || (typeof document !== "undefined" ? document : null);
    if (!doc || typeof doc.querySelectorAll !== "function") return null;
    var strip;
    try { strip = doc.querySelectorAll('ul[class*="status-icons"]'); } catch (_) { return null; }
    if (!strip || !strip.length) return null;
    var nodes;
    try { nodes = doc.querySelectorAll('ul[class*="status-icons"] a[aria-label]'); } catch (_) { return null; }
    for (var i = 0; i < (nodes ? nodes.length : 0); i++) {
      var n = nodes[i];
      var label = n && typeof n.getAttribute === "function" ? n.getAttribute("aria-label") : null;
      if (!label || !BOOK_LABEL_RE.test(label)) continue;
      var rest = String(label).replace(BOOK_LABEL_RE, "").trim();
      if (!rest) continue;
      // MATCHED, not parsed.
      //
      // The first sighting of this label was written out with an em dash
      // between the name and the effect; the DOM note that followed had them
      // run straight together with no separator at all. Splitting on a dash
      // handed back the whole sentence, which matches no book, and the whole
      // feature detected nothing while looking perfectly healthy.
      //
      // The four names are known, so there is nothing to parse: a label that
      // begins with one IS that book, whatever punctuation follows it.
      var low = rest.toLowerCase(), k = null, key;
      for (key in STAT_BOOKS) {
        if (low.indexOf(STAT_BOOKS[key].name.toLowerCase()) === 0) { k = key; break; }
      }
      // A book that is not one of the four still gets reported by name, so the
      // "no stat book is being read" branch is not confused with "no book".
      // Only here is the dash needed, and only as a best effort.
      var name = k ? STAT_BOOKS[k].name : rest.split(BOOK_DASH_RE)[0].trim();
      // The raw label travels with the answer. Getting this format wrong once
      // already cost a silent non-detection, and the fix for the next one
      // should be a screenshot rather than another guess.
      return { found: true, name: name, k: k, raw: String(label) };
    }
    return { found: false, icons: nodes ? nodes.length : 0 };
  }

  // Fold what the page says into the book state.
  //
  // Detection gives WHICH book and never when it started, so a newly seen book
  // is dated from the first moment this device saw it. That is a FLOOR, not the
  // real start: a book noticed on day 20 of 31 forecasts its award eleven days
  // late. The card says so rather than presenting the estimate as a fact, and
  // tapping the button still sets the date by hand.
  function syncBookFromDom() {
    var r = readBookFromDom(null);
    // null means the strip is not on this page. That says nothing at all, and
    // must never be read as "no book" -- it would clear a live countdown every
    // time you opened a page without the sidebar.
    if (!r) return false;
    if (!state.booksAuto) state.booksAuto = {};
    var auto = state.booksAuto, changed = false, k;

    state.bookDiag = r.found
      ? "page says: " + r.raw
      : "strip found (" + r.icons + " icons), no book on it";
    if (r.found && r.k) {
      state.bookSeen = r.name;
      // Never overwrite a date already on record. One you tapped in is better
      // information than this is, and an auto date already set is EARLIER than
      // now, which is the better floor of the two.
      if (!state.books[r.k]) {
        state.books[r.k] = Date.now();
        auto[r.k] = true;
        changed = true;
      }
      // The page cannot say when you started, and the log can. Asked once.
      if (!(state.booksExact || {})[r.k]) {
        // The ids first: without one the log lookup has only the name to go on,
        // and the log does not carry names.
        fetchBookIds();
        fetchBookStart(r.k, r.name);
      }
    } else {
      // The strip is here and no stat book is on it -- including the case where
      // some OTHER book is, since only one can be read at a time. Anything this
      // device set itself is finished or was wrong, so it goes. Anything you
      // tapped in is left alone: you know when you started it and this does not.
      state.bookSeen = r.found ? r.name : "";
      for (k in auto) {
        if (auto[k] && state.books[k]) { state.books[k] = 0; auto[k] = false; changed = true; }
      }
    }
    if (changed) {
      storeSet("books", state.books);
      storeSet("booksAuto", auto);
      resetPlanCaches();
    }
    return changed;
  }

  // Torn's "Item use book" log. Named by its own index (/torn/logtypes, public
  // key), not guessed: 2050 is the row written when you START a book, and 2051
  // through 2055 are the finishes.
  var BOOK_USE_LOG = 2050;
  var BOOK_LOG_TTL = 21600000;   // give up for this long once it is clearly not there
  var BOOK_RETRY_MS = 60000;     // but a failed call is retried within the minute
  var BOOK_MAX_TRIES = 3;

  // How long to wait before asking again after a lookup that did not answer.
  //
  // Success never comes back here -- booksExact short-circuits the call
  // entirely -- so this window only ever applies to FAILURES. It was six hours,
  // which meant one rate-limited call locked the countdown out for six hours.
  // Short retries a few times, then give up until the long window, because a
  // book with no log row at all fails every time and polling that for ever is
  // exactly the rate-limit pressure the wait exists to prevent.
  function bookStartWait(tries) {
    return (Number(tries) || 0) >= BOOK_MAX_TRIES ? BOOK_LOG_TTL : BOOK_RETRY_MS;
  }

  // When the book you are on was actually started.
  //
  // Detection off the page says WHICH book and nothing about when, so a
  // sighting gets dated from now -- reported as "31d left" by someone with
  // about 28 hours left, because they were thirty days in when the coach first
  // looked. This is the row that knows.
  //
  // The whole row is searched for the name rather than one field of it. Which
  // key carries the item is undocumented, the probe ran out of rate limit
  // before it could read one, and a wrong key would return no start at all --
  // silently falling back to dating from now, which is the exact bug being
  // fixed. Searching the row cannot fail that way.
  function bookStartFromLog(responses, name, itemId) {
    var want = String(name || "").toLowerCase();
    var wantId = Number(itemId) || 0;
    if (!want && !wantId) return 0;
    var best = 0;
    (responses || []).forEach(function (r) {
      var rows = (r && r.log) || {};
      for (var k in rows) {
        var e = rows[k];
        if (!e) continue;
        var ts = Number(e.timestamp);
        if (!(ts > 0)) continue;
        var hit = false;
        // The row identifies the book by ITEM ID, not by name:
        //   data {"item":745,"faction":0}
        // Searching the row for the name can never match, which is why the
        // first version of this found nothing. The FIELD is read rather than
        // the serialised row, because "faction":745 and a colour code of "745"
        // would both satisfy a blind string search.
        if (wantId) hit = Number((e.data || {}).item) === wantId;
        if (!hit && want) {
          // Until the item catalogue answers there is no id to match on, so a
          // row that happens to carry the name is better than nothing.
          var blob = "";
          try { blob = JSON.stringify(e).toLowerCase(); } catch (_) { continue; }
          hit = blob.indexOf(want) !== -1;
        }
        if (!hit) continue;
        // The most recent reading of that book: you can read one more than once
        // over a career, and the countdown is for the one you are on.
        if (ts > best) best = ts;
      }
    });
    return best * 1000;
  }

  // The four stat books, as Torn's own item ids.
  //
  // /v2/torn/items?cat=Book answers a PUBLIC key and the ids never change, so
  // this is asked once and kept. Resolved rather than hardcoded: only one of
  // the four ids has ever been seen (745, "Time Is In The Mind"), and guessing
  // the other three would fail silently -- no match, no start, back to dating
  // from the sighting.
  function readBookIds(d) {
    var list = d && d.items;
    if (!list) return {};
    var rows = Array.isArray(list) ? list : Object.keys(list).map(function (k) { return list[k]; });
    var out = {}, byName = {}, k;
    for (k in STAT_BOOKS) byName[STAT_BOOKS[k].name.toLowerCase()] = k;
    rows.forEach(function (it) {
      if (!it || !it.name || !(Number(it.id) > 0)) return;
      var key = byName[String(it.name).toLowerCase()];
      if (key) out[key] = Number(it.id);
    });
    return out;
  }

  var BOOK_IDS_TTL = 604800000;   // item ids do not change
  function fetchBookIds() {
    if (state.bookIdsAt && Date.now() - state.bookIdsAt < BOOK_IDS_TTL) return;
    if (state.bookIdsBusy || !resolveKey()) return;
    state.bookIdsBusy = true;
    state.bookIdsAt = Date.now();
    httpGet("https://api.torn.com/v2/torn/items?cat=Book&key=" +
            encodeURIComponent(resolveKey()) + "&comment=" + encodeURIComponent(COMMENT))
      .then(function (d) {
        var m = readBookIds(d);
        if (Object.keys(m).length) {
          state.bookIds = m;
          storeSet("bookIds", m);
          // The id is the thing the log lookup was missing, so let it try again
          // now rather than waiting out its retry window.
          state.bookStartAt = 0;
          state.bookStartTries = 0;
        }
      })
      .catch(function () { /* the name fallback still stands */ })
      .then(function () { state.bookIdsBusy = false; });
  }

  // Asked once per book sighting, never on the poll tick. The log is Full-only,
  // so a Limited key keeps the sighting date and the caveat that goes with it.
  function fetchBookStart(k, name) {
    if (!k || !name) return;
    if (!resolveKey()) { state.bookLogDiag = "item log: no API key saved"; return; }
    if (state.logReadable === false) {
      state.bookLogDiag = "item log: needs a FULL access key (this one cannot read logs)";
      return;
    }
    if (state.bookStartAt && Date.now() - state.bookStartAt < bookStartWait(state.bookStartTries)) return;
    if (state.bookStartBusy) return;
    state.bookStartBusy = true;
    state.bookStartAt = Date.now();
    state.bookStartTries = (state.bookStartTries || 0) + 1;
    state.bookLogDiag = "item log: asking Torn\u2026";
    httpGet(apiUrl("log&log=" + BOOK_USE_LOG))
      .then(function (d) {
        var when = bookStartFromLog([d], name, (state.bookIds || {})[k]);
        // Say what came back either way. Guessing at a payload shape is what
        // cost two rounds on the aria-label, and this one has never been seen.
        var rows = (d && d.log) || {};
        var n = 0, kk;
        for (kk in rows) n += 1;
        var wantId = (state.bookIds || {})[k] || 0;
        state.bookLogDiag = when > 0
          ? "item log: started " + new Date(when).toISOString().slice(0, 16).replace("T", " ")
          : "item log: " + n + " rows in log " + BOOK_USE_LOG + ", none for item " +
            (wantId ? wantId : "(id not resolved yet)");
        if (when > 0 && when !== state.books[k]) {
          state.books[k] = when;
          if (!state.booksExact) state.booksExact = {};
          state.booksExact[k] = true;
          storeSet("books", state.books);
          storeSet("booksExact", state.booksExact);
          resetPlanCaches();
          renderPanel();
        }
      })
      .catch(function (e) {
        // The sighting date and its caveat still stand; say why it is standing.
        state.bookLogDiag = "item log: unreadable \u2014 " + ((e && e.message) || "no answer") +
          (e && e.code ? " (code " + e.code + ")" : "");
      })
      .then(function () { state.bookStartBusy = false; renderPanel(); });
  }

  function bookAward(k, stats) {
    if (!STAT_BOOKS[k]) return 0;
    var cur = Number((stats || {})[k]) || 0;
    if (cur <= 0) return 0;
    return Math.min(Math.round(cur * BOOK_PCT), BOOK_CAP);
  }

  // A book still being read, or null.
  //
  // Null once it completes, deliberately: the award lands in battlestats the
  // moment it finishes, so continuing to treat it as pending would count it
  // twice -- once in the stat and once again in the plan.
  function bookPending(k, startedAt, now) {
    if (!STAT_BOOKS[k]) return null;
    var start = Number(startedAt) || 0;
    // Belt to the braces below rather than load-bearing: an unset start dates
    // the finish to 1970, which the `now >= finishesAt` check already rejects.
    // Kept because the intent should not depend on noticing that.
    if (!start) return null;
    var finishesAt = start + BOOK_DAYS * 86400000;
    if (now >= finishesAt) return null;
    return { k: k, name: STAT_BOOKS[k].name, finishesAt: finishesAt,
             daysLeft: Math.ceil((finishesAt - now) / 86400000) };
  }


  // ---- Faction gym board ---------------------------------------------------
  //
  // A leaderboard with no server behind it.
  //
  // /v2/faction/contributors hands ONE caller every member's cumulative gym
  // numbers -- energy spent and stat points gained -- from a Limited key with
  // faction API access. Nobody else installs anything, hands over a key, or
  // opts in, and no backend ever holds faction data.
  //
  // What the endpoint does NOT have is history. Its `timestamp` parameter is a
  // cache-buster, not a query, so a WEEKLY figure has to be a delta against a
  // baseline frozen at the week boundary. That baseline lives on this device
  // -- but the board still agrees across devices, because the numbers being
  // subtracted are the FACTION's and not this device's. Two clients that
  // anchored at the same Monday compute the same board without ever talking to
  // each other. The shared clock is the sync.
  var BOARD_STATS = ["gymenergy", "gymtrains", "gymstrength", "gymdefense", "gymspeed", "gymdexterity"];
  var BOARD_LABEL = {
    gymenergy: "Energy",
    gymtrains: "Trains",
    gymstrength: "Strength",
    gymdefense: "Defense",
    gymspeed: "Speed",
    gymdexterity: "Dexterity"
  };
  // Five stats is five requests -- contributors takes one stat per call --
  // which is why this sits behind a long TTL and a tab you have to open,
  // rather than on the poll tick.
  var BOARD_TTL = 300000;
  var BOARD_WEEKS = 8;         // past weeks kept, for the hall of fame
  var BOARD_NATURAL_TOP = 12;  // how far down the natural column is worked out
  var BOARD_CARD_ROWS = 12;    // rows a pasted card carries
  // Energy each assist is worth, for the natural-regen column. The owner's own
  // row uses their real bar maximum and can strength; everyone else's is an
  // estimate, and the card says so.
  var XAN_ENERGY = 250;
  var REFILL_ENERGY = 150;
  var CAN_ENERGY = 25;
  // Monday 00:00 TCT. Epoch day 0 was a Thursday, so day 4 was the first
  // Monday and the week index counts from there. TCT is UTC, so this is
  // computed from dayKey and never from a local-time getter -- a local reading
  // starts the week hours late and the two halves of a board disagree.
  var WEEK_EPOCH_DAY = 4;

  function weekKey(ms) {
    return Math.floor((dayKey(ms) - WEEK_EPOCH_DAY) / 7);
  }

  function weekStartMs(wk) {
    return (wk * 7 + WEEK_EPOCH_DAY) * DAY_MS;
  }

  // A device that was closed on Monday -- or installed on a Thursday -- anchors
  // its baseline mid-week, and the board then covers less than it says. Ten
  // minutes of slack for the first poll after the boundary; past that, the
  // window is stated rather than claimed.
  var BOARD_PARTIAL_MS = 600000;
  function boardSince(board) {
    if (!board || board.week == null) return null;
    var start = weekStartMs(board.week);
    var at = Number(board.at) || start;
    return { at: at, start: start, partial: at - start > BOARD_PARTIAL_MS };
  }

  // getUTC*, because the week boundary is TCT.
  function boardSinceLabel(ms) {
    var d = new Date(ms);
    var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    return DAYS[d.getUTCDay()] + " " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + " TCT";
  }

  // Freeze the first reading of the week, and hand back the map that deltas
  // measure against. Mutates the baseline on purpose: anchoring is a side
  // effect that must survive the render that triggered it.
  function boardSnap(base, stat, rows) {
    if (!base.stats) base.stats = {};
    var map = base.stats[stat] || (base.stats[stat] = {});
    for (var i = 0; i < rows.length; i++) {
      var id = String(rows[i].id), v = Number(rows[i].value) || 0;
      // Never seen before -- the board's first run, or a member who joined
      // mid-week. Anchor them here so their week counts from when the board
      // first saw them, rather than ranking a lifetime total as a week's work.
      if (!(id in map)) map[id] = v;
      // The counter went DOWN. `gymenergy` is titled a CHALLENGE contributor,
      // so a completed challenge may reset it, and leaving and rejoining
      // certainly does. Re-anchor: a negative leaderboard entry is never the
      // right answer, and a stuck baseline would suppress the rest of the week.
      else if (v < map[id]) map[id] = v;
    }
    return map;
  }

  // A copy of the baseline that anchoring can be tried against without
  // committing to it.
  //
  // DEEP, and that is the whole point. Copying the per-stat maps by reference
  // left boardSnap writing straight into the live baseline: the draft protected
  // the SAVED copy and nothing else, so a round that died half-way still left
  // the in-memory anchors half-moved and the next successful round measured the
  // week against them. The bug outlived a browser test that only checked what
  // reached storage.
  function boardDraft(base) {
    var out = { week: base ? base.week : null, at: (base && base.at) || 0, stats: {} };
    var src = (base && base.stats) || {}, k, q;
    for (k in src) {
      out.stats[k] = {};
      for (q in src[k]) out.stats[k][q] = src[k][q];
    }
    return out;
  }

  function boardDeltas(base, stat, rows) {
    var map = boardSnap(base, stat, rows), out = {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], id = String(r.id), v = Number(r.value) || 0;
      out[id] = { id: r.id, name: r.username, value: v, delta: v - (map[id] || 0) };
    }
    return out;
  }

  // Roll the baseline when the week turns over, keeping the week that just
  // ended so there is something to look back at. Returns the board rather than
  // mutating it, so the caller decides when to persist.
  function boardRoll(board, now) {
    var wk = weekKey(now);
    var hist = (board && board.hist) || [];
    if (board && board.week === wk) return { base: board, hist: hist, rolled: false };
    if (board && board.stats && Object.keys(board.stats).length) {
      // The podium, not the roster. "Past weeks" renders one name per week, and
      // archiving every member's full row for a hundred-member faction is ~800
      // stored objects to show eight -- into a localStorage that storeSet
      // writes inside a swallowed try/catch, so hitting quota loses the save
      // silently. This origin's quota is shared with Torn's own chat.
      hist = hist.concat([{ week: board.week, at: board.at || weekStartMs(board.week),
                            endAt: weekStartMs(board.week + 1),
                            rows: (board.rows || []).slice(0, 3) }]);
      // Bounded, or eight months of dead baselines end up in storage.
      if (hist.length > BOARD_WEEKS) hist = hist.slice(hist.length - BOARD_WEEKS);
    }
    return { base: { week: wk, at: now, stats: {}, hist: hist }, hist: hist, rolled: true };
  }

  // Energy that did not come out of a pill, a can or a refill.
  //
  // The three consumable counts are HISTORICAL -- /user/<id>/personalstats
  // answers them as of the week boundary on a public key -- so this half needs
  // no stored baseline of its own and cannot drift between devices.
  function naturalEnergy(dEnergy, use, own) {
    var u = use || {};
    var refillE = (own && own.energyMax) || REFILL_ENERGY;
    var canE = (own && own.canEnergy) || CAN_ENERGY;
    var assisted = XAN_ENERGY * (Number(u.xantaken) || 0) +
                   refillE * (Number(u.refills) || 0) +
                   canE * (Number(u.energydrinkused) || 0);
    return Math.max(0, (Number(dEnergy) || 0) - assisted);
  }

  // Fold the five per-stat delta maps into one row per member, ranked on the
  // energy they spent. `used` carries consumable deltas keyed by member id for
  // however far down the board they were worked out; `own` is the owner's real
  // bar and can, used for their row only.
  function boardBuild(byStat, used, own) {
    var energy = (byStat && byStat.gymenergy) || {};
    var ids = {}, k;
    for (k in energy) ids[k] = true;
    var rows = Object.keys(ids).map(function (id) {
      var e = energy[id] || {};
      function d(stat) {
        var m = (byStat && byStat[stat]) || {};
        return (m[id] && m[id].delta) || 0;
      }
      var use = used && used[id];
      return {
        id: e.id, name: e.name, energy: e.delta || 0,
        // Its own counter, never energy divided by anything: energy per train
        // runs from 5 in a starter gym to 25 in a specialist one, so a derived
        // figure would be fiction dressed up as a count.
        trains: d("gymtrains"),
        // null, NOT zero: "not worked out yet" and "every point of it was
        // bought" are different claims about a person.
        natural: use ? naturalEnergy(e.delta || 0, use, own && String(own.id) === String(e.id) ? own : null) : null,
        str: d("gymstrength"), def: d("gymdefense"),
        spe: d("gymspeed"), dex: d("gymdexterity")
      };
    });
    rows.sort(function (a, b) { return b.energy - a.energy || String(a.name).localeCompare(String(b.name)); });
    rows.forEach(function (r, i) { r.rank = i + 1; });
    return rows;
  }

  // What somebody trained, as shares of their week.
  //
  // gymstrength and its three siblings are ENERGY SPENT on that stat -- NOT
  // points gained. gymenergy is simply their sum. Confirmed live 2026-09-01: a
  // 340-energy strength session came back as gymenergy 340 and gymstrength 340
  // together. 0.9.45 rendered that as "+340 str", which reads as 340 strength
  // points and is off by six orders of magnitude for anyone with real stats.
  //
  // So this reports the split and never a bare number: a percentage cannot be
  // mistaken for a stat gain, and it is the more useful figure anyway -- what
  // the energy column already gives you is the total.
  function boardSplit(r) {
    var parts = [["str", r.str], ["def", r.def], ["spe", r.spe], ["dex", r.dex]]
      .filter(function (p) { return (Number(p[1]) || 0) > 0; })
      .sort(function (a, b) { return b[1] - a[1]; });
    if (!parts.length) return "";
    var total = parts.reduce(function (n, p) { return n + p[1]; }, 0);
    // Against the sum of the four rather than against the energy column, so
    // the shares always add to a hundred even if the two ever disagree.
    var shown = parts.map(function (p) {
      return { k: p[0], pct: Math.round((p[1] / total) * 100) };
    }).filter(function (p) { return p.pct >= 1; });
    // One stat carrying the whole week does not need a "100%" beside it, and a
    // rounding crumb from a second stat is noise rather than information.
    if (shown.length <= 1) return "all " + parts[0][0];
    return shown.map(function (p) { return p.k + " " + p.pct + "%"; }).join(" \u00b7 ");
  }

  function boardWeekLabel(ms) {
    var d = new Date(ms);
    // getUTC*, because the week boundary is TCT. Local getters read the label
    // a day early west of Greenwich and the card disagrees with the board.
    var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return MON[d.getUTCMonth()] + " " + d.getUTCDate();
  }

  // The pasteable card.
  //
  // "chat" is for Torn's faction chat, which renders in a proportional font --
  // so nothing here relies on column alignment, and backticks are left out
  // because Torn shows them literally. "discord" is the same board fenced as
  // monospace, where alignment does survive.
  function boardCardText(rows, opts) {
    var o = opts || {};
    var head = "Gym week of " + boardWeekLabel(o.week) + " — " + (o.faction || "faction") +
      // A card that anchored mid-week has to say so, or it lands in chat as a
      // full week's standings when it is not one.
      (o.since && o.since.partial ? " (counting from " + boardSinceLabel(o.since.at) + ")" : "");
    var shown = rows.slice(0, BOARD_CARD_ROWS);
    var more = rows.length - shown.length;
    var lines;
    // padStart is ES2017 and the rest of this script is written for whatever
    // webview Torn PDA is running this week; a four-line helper is cheaper
    // than finding out.
    function pad(t, n, left) {
      var out = String(t);
      while (out.length < n) out = left ? " " + out : out + " ";
      return out;
    }
    if (o.fmt === "discord") {
      var w = 0;
      shown.forEach(function (r) { w = Math.max(w, String(r.name).length); });
      lines = shown.map(function (r) {
        var name = String(r.name);
        while (name.length < w) name += " ";
        // Fixed width, including when it is absent. "100% nat" is a
        // character wider than "37% nat", and an unknown one is blank -- so a
        // ragged cell here is what knocks the split column out of line, in the
        // one format whose whole reason for existing is that it lines up.
        // Through the same guard the table uses. Math.max(1, energy) turns a
        // zero-energy member into 0/1 = "0% nat", which reads as "every point
        // they trained was bought" about somebody who trained nothing -- and it
        // went into faction chat while the table beside it said nothing at all.
        var np = boardNatPct(r);
        var nat = pad(np === null ? "" : np + "% nat", 8, true);
        var split = boardSplit(r);
        return pad(String(r.rank), 2, true) + ". " + name + "  " +
               pad(String(fmt(r.energy)) + "e", 10, true) + "  " +
               pad(r.trains > 0 ? fmt(r.trains) + "t" : "", 8, true) + "  " + nat +
               (split ? "  " + split : "");
      });
      return "```\n" + head + "\n" + lines.join("\n") +
             (more > 0 ? "\n+ " + more + " more" : "") + "\n```";
    }
    lines = shown.map(function (r) {
      var np = boardNatPct(r);
      var nat = np === null ? "" : " (" + np + "% natural)";
      var split = boardSplit(r);
      var trains = r.trains > 0 ? " / " + fmt(r.trains) + " train" + (r.trains === 1 ? "" : "s") : "";
      return r.rank + ". " + r.name + " — " + fmt(r.energy) + "e" + trains + nat + (split ? " — " + split : "");
    });
    return head + "\n" + lines.join("\n") + (more > 0 ? "\n+ " + more + " more" : "");
  }


  // ---- reading the faction -------------------------------------------------

  function boardUrl(stat) {
    return "https://api.torn.com/v2/faction/contributors?stat=" + encodeURIComponent(stat) +
      "&cat=current&key=" + encodeURIComponent(resolveKey()) +
      "&comment=" + encodeURIComponent(COMMENT);
  }

  // Rows out of a contributors payload, tolerating the object-keyed shape as
  // well as the documented array.
  function boardRowsOf(d) {
    var c = d && d.contributors;
    if (!c) return null;
    var rows = Array.isArray(c) ? c : Object.keys(c).map(function (k) {
      var v = c[k]; return { id: v.id != null ? v.id : k, username: v.username, value: v.value, in_faction: v.in_faction };
    });
    // cat=current should already do this, but a board that quietly lists people
    // who left is worse than one that asks for them twice.
    return rows.filter(function (r) { return r.in_faction !== false; });
  }

  var BOARD_NAME_TTL = 86400000;
  function fetchFactionName(force) {
    if (!force && Date.now() - (state.boardNameAt || 0) < BOARD_NAME_TTL && state.boardFaction) return;
    state.boardNameAt = Date.now();
    httpGet("https://api.torn.com/v2/faction/basic?key=" + encodeURIComponent(resolveKey()) +
            "&comment=" + encodeURIComponent(COMMENT))
      .then(function (d) {
        var b = (d && (d.basic || d)) || {};
        if (b.name) { state.boardFaction = b.name; storeSet("boardFaction", b.name); }
      })
      .catch(function () { /* the board's own error line already covers this */ });
  }

  // Five stats is five requests -- contributors takes one stat per call -- so
  // they go out one at a time behind a gap, never as a burst. The whole thing
  // sits behind a five-minute TTL and a tab you have to open, because this
  // shares a hundred-calls-a-minute budget with everything else the coach does.
  var BOARD_GAP_MS = 700;
  // Every board request is raced against a clock.
  //
  // httpGet has no timeout of its own, and PDA's Dart HTTP layer collapses two
  // identical in-flight GETs and orphans the second callback -- so a request
  // CAN simply never settle. When that happens the terminal .then never runs,
  // boardBusy stays true forever, and every button on the tab is dead until the
  // page is reloaded. A rejected promise is recoverable; an unsettled one is not.
  var BOARD_REQ_MS = 20000;
  function boardGet(url) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error("timed out"));
      }, BOARD_REQ_MS);
      httpGet(url).then(function (d) {
        if (done) return;
        done = true; clearTimeout(timer); resolve(d);
      }, function (e) {
        if (done) return;
        done = true; clearTimeout(timer); reject(e);
      });
    });
  }
  // A forced refresh still cannot be spammed. The TTL is what stops idle
  // re-reads; this is what stops a finger on the Try again button, which is
  // exactly the button people press hardest when every call is being refused.
  var BOARD_FORCE_MS = 15000;

  function fetchBoard(force) {
    // natBusy as well as boardBusy. The natural pass is up to 24 requests and
    // the Refresh button sits in a card that stays on screen throughout it, so
    // without this the two chains interleave and the 700ms spacing that exists
    // to protect the rate limit ends up spacing two streams instead of one.
    if (state.boardBusy || state.natBusy) return;
    var last = Math.max(state.boardAt || 0, state.boardTriedAt || 0);
    if (!force && Date.now() - last < BOARD_TTL) return;
    if (force && Date.now() - (state.boardTriedAt || 0) < BOARD_FORCE_MS) return;
    if (!resolveKey()) return;
    // The key already told us Torn will refuse this, so do not spend six
    // refused requests confirming it -- a refused call still costs rate limit.
    // Only on the automatic path: `force` is the user pressing through, which
    // has to work in case the undocumented flag is ever wrong.
    if (!force && state.keyLevel && state.keyLevel.faction === false) return;
    state.boardBusy = true;
    state.boardTriedAt = Date.now();
    state.boardError = null;
    state.boardPartial = 0;
    fetchFactionName(false);

    var now = Date.now();
    // The roll is decided now but APPLIED only once gymenergy has landed.
    // Rolling first and then failing every request replaces a board that was
    // correct a second ago with "Nothing read yet", and the TTL then blocks a
    // retry for five minutes.
    var rolled = boardRoll(state.board, now);
    var applied = false;
    var base = rolled.base;
    // Anchoring is a side effect on the baseline, so it happens on a COPY until
    // every stat has landed. Committing per stat means a fetch that dies
    // half-way anchors energy at Monday and trains at whenever the next attempt
    // succeeded -- and a split normalised across differently-anchored stats
    // looks perfectly plausible while being wrong for the rest of the week.
    var draft = boardDraft(base);
    var pending = {}, got = 0;

    function step(i) {
      if (i >= BOARD_STATS.length) return Promise.resolve();
      var stat = BOARD_STATS[i];
      return boardGet(boardUrl(stat))
        .then(function (d) {
          var rows = boardRowsOf(d);
          if (!rows) throw new Error("no contributors array");
          // Anchors go to the draft; only the rendered deltas go live, so the
          // tab can paint progressively without the baseline being committed.
          var before = {};
          for (var q in (draft.stats[stat] || {})) before[q] = draft.stats[stat][q];
          pending[stat] = boardDeltas(draft, stat, rows);
          if (stat === BOARD_STATS[0] && rolled.rolled && !applied) {
            // gymenergy answered, so the week really has turned over and the
            // roll is safe to keep.
            applied = true;
          }
          got += 1;
          state.boardBy[stat] = pending[stat];
          // Paint as each stat lands. gymenergy comes first, so names and the
          // ranking appear at once and the rest fills in, rather than the tab
          // sitting empty for five seconds and looking stuck.
          if (state.tab === "board") renderPanel();
        })
        .catch(function (e) {
          // Torn refuses the whole call when the key lacks faction API access.
          // Recorded verbatim and shown as-is: a made-up explanation of
          // somebody else's permissions is worse than Torn's own words.
          state.boardError = { msg: e.message || "unreadable", code: e.code || null };
          throw e;
        })
        .then(function () {
          return new Promise(function (r) { setTimeout(r, BOARD_GAP_MS); });
        })
        .then(function () { return step(i + 1); });
    }

    step(0)
      .then(function () {
        // Every stat landed: commit the anchors as one, together.
        if (applied) {
          state.board = rolled.base;
          state.board.hist = rolled.hist;
          // Deltas and consumable counts belong to the week they were measured
          // in. Left standing across a rollover they would be read against the
          // NEW baseline.
          state.natUse = {};
        }
        state.board.stats = draft.stats;
        state.board.week = draft.week;
        state.boardBy = pending;
        state.boardAt = Date.now();
        state.board.rows = boardCurrent();
        saveBoard();
      })
      .catch(function () {
        // A half-read board is shown -- it is better than nothing -- but it is
        // NOT anchored and NOT saved, and it says so. Silently rendering the
        // stats that made it through is how a wrong split looks confident.
        state.boardPartial = got;
        if (got) state.boardAt = Date.now();
      })
      .then(function () {
        state.boardBusy = false;
        if (state.tab === "board") renderPanel();
      });
  }

  // ---- the natural-regen column -------------------------------------------

  // Consumable counts for one member as of a moment.
  //
  // /user/<id>/personalstats answers these on a PUBLIC key -- they are the same
  // figures Torn prints on a profile -- and, with a timestamp, answers them
  // HISTORICALLY. So the week-start side needs no stored baseline of its own,
  // cannot drift between devices, and once fetched can be cached forever: a
  // past week's answer never changes.
  var PS_STATS = "refills,xantaken,energydrinkused";
  function psUrl(id, atSec) {
    return "https://api.torn.com/v2/user/" + encodeURIComponent(id) + "/personalstats?stat=" + PS_STATS +
      (atSec ? "&timestamp=" + atSec : "") +
      "&key=" + encodeURIComponent(resolveKey()) + "&comment=" + encodeURIComponent(COMMENT);
  }

  // Historic form is an array of { name, value }; the live form is a flat
  // object. Reading both means a shape change cannot silently zero the column.
  function readPs(d) {
    var p = d && d.personalstats;
    if (!p) return null;
    var out = {};
    if (Array.isArray(p)) {
      p.forEach(function (row) { if (row && row.name) out[row.name] = Number(row.value) || 0; });
    } else {
      ["refills", "xantaken", "energydrinkused"].forEach(function (k) {
        if (p[k] != null) out[k] = Number(p[k]) || 0;
      });
      // The nested v2 spellings, in case `stat=` is ignored and a full payload
      // comes back instead.
      if (p.other && p.other.refills && p.other.refills.energy != null) out.refills = Number(p.other.refills.energy) || 0;
      if (p.drugs && p.drugs.xanax != null) out.xantaken = Number(p.drugs.xanax) || 0;
      if (p.items && p.items.used && p.items.used.energy_drinks != null) out.energydrinkused = Number(p.items.used.energy_drinks) || 0;
    }
    return Object.keys(out).length ? out : null;
  }

  function psDelta(now, then) {
    if (!now || !then) return null;
    return {
      refills: Math.max(0, (now.refills || 0) - (then.refills || 0)),
      xantaken: Math.max(0, (now.xantaken || 0) - (then.xantaken || 0)),
      energydrinkused: Math.max(0, (now.energydrinkused || 0) - (then.energydrinkused || 0))
    };
  }

  // Worked out on request, never on the poll tick: this is one call per member
  // for the live side plus one for the week start, and the week-start half is
  // only ever paid once.
  // The pass is up to 24 requests. natBusy only blocks it DURING a pass, so
  // without a cooldown a finger on "Refresh natural" sustains ~85 requests a
  // minute from this feature alone, against a budget of 100 that a refused call
  // still spends.
  var NAT_TTL = 120000;
  function fetchBoardNatural(force) {
    if (state.boardBusy || state.natBusy) return;
    if (!force && Date.now() - (state.natAt || 0) < NAT_TTL) return;
    // fetchBoard checks this and this one did not: with a cleared key but a
    // populated board still in memory, the button fired twelve calls that Torn
    // was guaranteed to refuse.
    if (!resolveKey()) return;
    var rows = boardCurrent();
    if (!rows.length) return;
    var wk = state.board && state.board.week;
    // No week yet means the board has never been read, and weekStartMs(null)
    // is NaN -- which would go out on the wire as timestamp=NaN.
    if (wk == null) return;
    var startSec = Math.floor(weekStartMs(wk) / 1000);
    var picked = rows.slice(0, BOARD_NATURAL_TOP);
    state.natBusy = true;
    // Cleared, not merged. boardBuild applies a natUse entry to ANY id that has
    // one, but a pass only refreshes the twelve currently on top -- so somebody
    // who dropped out of the top twelve kept a frozen numerator over a growing
    // denominator, and their Nat % drifted down as though they had started
    // buying energy.
    state.natUse = {};
    state.natDone = 0;
    state.natTotal = picked.length;
    state.natError = null;
    state.natMissed = 0;
    if (!state.natBase[wk]) state.natBase[wk] = {};

    function one(i) {
      if (i >= picked.length) return Promise.resolve();
      var id = String(picked[i].id);
      var haveBase = state.natBase[wk][id];
      // Thunks, not promises. httpGet fires the instant it is called, so an
      // array of already-started requests would put both of a member's calls
      // on the wire together and the gap below would only space the HANDLING.
      // The rate limit counts requests, not callbacks.
      var jobs = [function () { return boardGet(psUrl(id, 0)).then(readPs); }];
      // The week-start reading never changes, so it is fetched once and kept.
      if (!haveBase) jobs.push(function () { return boardGet(psUrl(id, startSec)).then(readPs); });
      return jobs.reduce(function (p, job) {
        return p.then(function (acc) {
          return job().then(function (v) { acc.push(v); return acc; })
            .then(function (a) { return new Promise(function (r) { setTimeout(function () { r(a); }, BOARD_GAP_MS); }); });
        });
      }, Promise.resolve([]))
        .then(function (res) {
          var live = res[0];
          if (!haveBase && res[1]) { state.natBase[wk][id] = res[1]; haveBase = res[1]; }
          var d = psDelta(live, haveBase);
          if (d) state.natUse[id] = d;
          // readPs returns null for a reshaped or empty payload and nothing
          // throws, so without this the pass reported "12 of 12" with holes in
          // it and every hole rendered as an em dash indistinguishable from
          // "not asked for".
          else state.natMissed = (state.natMissed || 0) + 1;
        })
        .catch(function (e) { state.natError = e.message || "unreadable"; })
        .then(function () {
          state.natDone = i + 1;
          if (state.tab === "board") renderPanel();
          return one(i + 1);
        });
    }

    one(0).then(function () {
      state.natBusy = false;
      state.natAt = Date.now();
      state.natTotal = picked.length;
      saveBoard();
      if (state.tab === "board") renderPanel();
    });
  }

  function saveBoard() {
    try {
      storeSet("board", { week: state.board.week, at: state.board.at, stats: state.board.stats,
                          rows: state.board.rows || [], hist: state.board.hist || [] });
      // Pruned to the same window as the baselines, so a cache that is only
      // ever added to cannot outgrow storage.
      var keep = {}, wks = Object.keys(state.natBase).sort(function (a, b) { return a - b; });
      wks.slice(-BOARD_WEEKS).forEach(function (w) { keep[w] = state.natBase[w]; });
      state.natBase = keep;
      storeSet("natBase", keep);
    } catch (_) {}
  }

  // The board as it stands right now, from whatever has been fetched.
  function boardCurrent() {
    // Only the energy maximum, because the coach really does know that one.
    // Which can somebody drank on a given day is not knowable for anyone --
    // including the owner -- so that coefficient stays the shared estimate.
    var own = state.playerId
      ? { id: state.playerId, energyMax: state.energyMax || REFILL_ENERGY }
      : null;
    var use = Object.keys(state.natUse).length ? state.natUse : null;
    return boardBuild(state.boardBy, use, own);
  }

  // ---- the Board tab -------------------------------------------------------

  // Torn has no dedicated "missing faction permission" error. 16 is
  // "access level of this key is not high enough" and 7 is "incorrect
  // ID-entity relation", which is what a private-to-you faction selection
  // returns -- both mean the same thing here. Anything else is transient, and
  // telling somebody to go change their faction position because Torn was
  // rate-limiting them would send them off fixing the wrong thing.
  function boardPermissionError(err) {
    if (!err) return false;
    var c = Number(err.code);
    return c === 7 || c === 16;
  }

  function boardNatPct(r) {
    if (r.natural === null || r.energy <= 0) return null;
    return Math.round((r.natural / r.energy) * 100);
  }

  function boardLine(r, meId) {
    var pct = boardNatPct(r);
    var split = boardSplit(r);
    // Trains lead the second line rather than taking a column of their own:
    // five columns do not fit a phone, and the tab bar wrapping onto two rows
    // when Board was added is the same mistake one element further in.
    var sub = (r.trains > 0 ? '<b>' + fmt(r.trains) + "</b> train" + (r.trains === 1 ? "" : "s") : "") +
      (r.trains > 0 && split ? " \u00b7 " : "") + esc(split || "");
    return '<div class="gcb-brow' + (String(r.id) === String(meId) ? " me" : "") + '">' +
      '<span class="gcb-brank">' + r.rank + "</span>" +
      '<span class="gcb-bname">' + esc(String(r.name || r.id)) + "</span>" +
      '<span class="gcb-benergy">' + fmt(r.energy) + "e</span>" +
      (pct === null ? '<span class="gcb-bnat muted" title="Not worked out yet">—</span>'
                    : '<span class="gcb-bnat ' + (pct >= 80 ? "ok" : pct >= 50 ? "" : "bad") + '">' + pct + "%</span>") +
      '<span class="gcb-bgain muted">' + (sub || "—") + "</span>" +
      "</div>";
  }

  // Said in one place, because it is said in three.
  var FAA_WHY = "The board reads <b>faction contributors</b>, which needs <b>faction API access</b>. " +
    "That is a faction <b>position</b> ability rather than a property of the key, so a Full key does not grant it \u2014 " +
    "only your leader or co-leader can turn it on, under Faction \u2192 Controls \u2192 Positions. " +
    "Anyone who has it can post the board to chat with the copy buttons, so the faction only needs one.";

  function boardHtml() {
    var rows = boardCurrent();
    var wk = state.board && state.board.week;
    var startMs = wk == null ? Date.now() : weekStartMs(wk);
    var since = boardSince(state.board);
    var meId = state.playerId;
    var natKnown = rows.filter(function (r) { return r.natural !== null; }).length;

    // A key that cannot read the faction gets Torn's own refusal and the one
    // thing that actually fixes it, rather than a spinner that never resolves.
    if (state.boardError && !rows.length) {
      return '<div class="gc-card"><h3>Faction board</h3>' +
        '<p class="bad" style="margin:0 0 6px">Torn refused the request: ' + esc(state.boardError.msg) +
        (state.boardError.code ? " (code " + esc(String(state.boardError.code)) + ")" : "") + "</p>" +
        (boardPermissionError(state.boardError)
          ? '<p class="muted" style="margin:0">' + FAA_WHY + "</p>"
          : '<p class="muted" style="margin:0">That one usually passes on its own \u2014 it is not a permissions problem.</p>') +
        '<button type="button" class="gcb-btn" data-board="refresh" style="margin-top:9px">Try again</button></div>';
    }

    // Known in advance, from the key itself, so six refused requests are never
    // sent in the first place. Offered rather than enforced: Torn does not
    // document the flag, so if the reading is ever wrong it must cost a tap,
    // not the whole feature.
    if (!rows.length && !state.boardBusy && state.keyLevel && state.keyLevel.faction === false) {
      return '<div class="gc-card"><h3>Faction board</h3>' +
        '<p class="muted" style="margin:0 0 8px">Your key does not have <b>faction API access</b>, so Torn will refuse this. ' + FAA_WHY + "</p>" +
        '<button type="button" class="gcb-btn" data-board="anyway">Load it anyway</button></div>';
    }

    if (!rows.length) {
      return '<div class="gc-card"><h3>Faction board</h3>' +
        '<p class="muted" style="margin:0">' + (state.boardBusy ? "Reading the faction…" : "Nothing read yet.") + "</p>" +
        (state.boardBusy ? "" : '<button type="button" class="gcb-btn" data-board="refresh" style="margin-top:9px">Load the board</button>') +
        "</div>";
    }

    var fresh = rows.length && state.boardAt;

    var head =
      '<div class="gc-card"><h3>Faction board · week of ' + esc(boardWeekLabel(startMs)) + "</h3>" +
      '<p class="muted" style="margin:0 0 9px">' +
      esc(state.boardFaction || "Your faction") + " — energy spent in the gym " +
      (since && since.partial
        ? "since this device first read the faction, <b>" + esc(boardSinceLabel(since.at)) + "</b>"
        : "since <b>Monday 00:00 TCT</b>") +
      ", how many trains that was, and which stats it went into. " +
      'Read from Torn\u2019s own faction contributors, so it is the same board on every device and nothing is stored anywhere but here.</p>' +
      // The button that fills the Nat column used to live BELOW the whole
      // table. On a twenty-member faction that is a long scroll away from the
      // column of dashes it explains, and the first question asked about this
      // screen was "why nat empty". The prompt belongs next to the column.
      (natKnown || state.natBusy || state.boardBusy ? "" :
        '<div class="gcb-natprompt">' +
        '<span class="muted">The <b>Nat</b> column is empty until it is worked out \u2014 it is a request per member, so it is not automatic.</span>' +
        '<button type="button" class="gcb-btn" data-board="natural">Fill it in (top ' + BOARD_NATURAL_TOP + ')</button>' +
        "</div>") +
      '<div class="gcb-brow head"><span class="gcb-brank">#</span><span class="gcb-bname">Member</span>' +
      '<span class="gcb-benergy">Energy</span><span class="gcb-bnat">Nat</span><span class="gcb-bgain">Trains · split</span></div>' +
      rows.map(function (r) { return boardLine(r, meId); }).join("") +
      '<div class="gcb-brow foot"><span class="muted" style="grid-column:1/-1">' +
      (fresh ? "Read " + Math.max(0, Math.round((Date.now() - state.boardAt) / 1000)) + "s ago" : "Not read yet") +
      (state.boardBusy ? " · reading…" : "") + "</span></div>" +
      // Once gymenergy has landed the board has rows, and the error card above
      // never shows again -- so a stat that failed after it used to vanish
      // entirely and leave a confident board with a wrong split on it.
      (!state.boardBusy && state.boardPartial
        ? '<p class="bad" style="margin:8px 0 0">Only ' + state.boardPartial + " of " + BOARD_STATS.length +
          " parts were read" + (state.boardError ? " (" + esc(state.boardError.msg) + ")" : "") +
          ". The split and the train count may be short, and nothing was saved. Refresh to try again.</p>"
        : "") +
      "</div>";

    var natCard =
      '<div class="gc-card"><h3>Natural regen</h3>' +
      (state.natBusy
        ? '<p class="muted" style="margin:0">Working it out — ' + state.natDone + " of " + state.natTotal + "…</p>"
        : natKnown
        ? '<p class="muted" style="margin:0 0 8px">Worked out for the top ' + natKnown + '. The <b>Nat</b> column is the share of the week\u2019s energy that did not come from a refill, a xanax or a can — the part you earned by just being there.</p>'
        : '<p class="muted" style="margin:0 0 8px">The <b>Nat</b> column ranks who used the most energy they simply regenerated, rather than bought. Torn answers each member\u2019s refill, xanax and can counts — including what they were at Monday 00:00 — so this needs no stored history, but it is one request per member.</p>') +
      (state.natError ? '<p class="bad" style="margin:0 0 8px">' + esc(state.natError) + "</p>" : "") +
      (!state.natBusy && state.natMissed
        ? '<p class="bad" style="margin:0 0 8px">' + state.natMissed + " member" + (state.natMissed === 1 ? "" : "s") +
          " could not be read, so their Nat is still blank rather than zero.</p>"
        : "") +
      (state.natBusy ? "" :
        '<button type="button" class="gcb-btn" data-board="natural">' +
        (natKnown ? "Refresh natural (top " + BOARD_NATURAL_TOP + ")" : "Work out natural (top " + BOARD_NATURAL_TOP + ")") +
        "</button>") +
      (natKnown ? '<p class="muted" style="margin:8px 0 0">A refill is counted as ' + REFILL_ENERGY + 'e and a can as ' + CAN_ENERGY +
        'e for everyone but you — Torn does not publish another player\u2019s bar size or which can they drank. Your own row uses your real bar.</p>' : "") +
      "</div>";

    var shareCard =
      '<div class="gc-card"><h3>Share it</h3>' +
      '<p class="muted" style="margin:0 0 9px">Copies the top ' + BOARD_CARD_ROWS + ' as text you can paste straight into faction chat. Nothing is uploaded — the card is built here and goes to your clipboard.</p>' +
      '<div class="gcb-brow btns">' +
      '<button type="button" class="gcb-btn" data-board="copy-chat">Copy for chat</button>' +
      '<button type="button" class="gcb-btn" data-board="copy-discord">Copy for Discord</button>' +
      (state.natBusy || state.boardBusy ? ""
        : '<button type="button" class="gcb-btn ghost" data-board="refresh">Refresh</button>') +
      "</div>" +
      '<pre class="gcb-card-preview">' + esc(boardCardText(rows, {
        faction: state.boardFaction, week: startMs, fmt: "chat", since: since
      })) + "</pre></div>";

    var hist = (state.board && state.board.hist) || [];
    var hofCard = !hist.length ? "" :
      '<div class="gc-card"><h3>Past weeks</h3>' +
      hist.slice().reverse().map(function (h) {
        var top = (h.rows || [])[0];
        return '<div class="row"><span>week of ' + esc(boardWeekLabel(h.at)) + "</span><b>" +
          (top ? esc(String(top.name)) + " · " + fmt(top.energy) + "e" : "—") + "</b></div>";
      }).join("") + "</div>";

    return head + natCard + shareCard + hofCard;
  }


  // Every write here is SYNCHRONOUS inside the tap. Torn PDA only grants the
  // clipboard for the duration of the gesture, so anything awaited first --
  // even a resolved promise -- lands after the permission has lapsed and the
  // copy silently does nothing.
  function copyText(text) {
    try {
      if (typeof GM_setClipboard === "function") { GM_setClipboard(text); return true; }
    } catch (_) {}
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        // writeText is a PROMISE. Returning true on the call alone reported a
        // copy that a denied permission or a non-secure context had rejected --
        // "Copied" on screen, empty clipboard, and the textarea fallback below
        // never reached. The rejection re-runs the fallback and corrects the
        // toast rather than going unhandled.
        navigator.clipboard.writeText(text).then(null, function () {
          if (execCopy(text)) showToast("Copied", "Paste it wherever you like.");
          else showToast("Copy blocked", "Select the card below and copy it by hand.");
        });
        return true;
      }
    } catch (_) {}
    return execCopy(text);
  }

  // The last resort, factored out because the clipboard promise above needs it
  // too when it rejects after the fact.
  function execCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      ta.remove();
      return !!ok;
    } catch (_) {}
    return false;
  }

  function onBoardClick(what) {
    if (what === "refresh" || what === "anyway") {
      fetchBoard(true);
      renderPanel();
      return;
    }
    if (what === "natural") {
      // fetchBoardNatural refuses while the board itself is still coming in,
      // because it works from the rows. Refusing in silence looks like a dead
      // button, which is worse than waiting.
      if (state.boardBusy) { showToast("Still reading", "The board is loading. Try again in a moment."); return; }
      fetchBoardNatural();
      renderPanel();
      return;
    }
    if (what === "copy-chat" || what === "copy-discord") {
      var rows = boardCurrent();
      if (!rows.length) { showToast("Nothing to share", "Load the board first."); return; }
      var wk = state.board && state.board.week;
      var text = boardCardText(rows, {
        faction: state.boardFaction,
        week: wk == null ? Date.now() : weekStartMs(wk),
        fmt: what === "copy-discord" ? "discord" : "chat",
        since: boardSince(state.board)
      });
      var ok = copyText(text);
      showToast(ok ? "Copied" : "Copy blocked",
                ok ? "Paste it into " + (what === "copy-discord" ? "Discord." : "faction chat.")
                   : "Select the card below and copy it by hand.");
      return;
    }
  }

  var HIST_COLOURS = { str: "#e8a33d", def: "#3d9ae8", spe: "#e85f8a", dex: "#2ecc71" };

  function histWindow(days) {
    var cut = dayKey(Date.now()) - days;
    return state.hist.filter(function (e) {
      return e.d >= cut;
    });
  }

  // Forward projection reuses the script's own gain model, sampled rather than
  // stepped per-day: projectDays already loops every train internally, so a
  // per-day loop over a year would be tens of thousands of gainOne calls on a
  // phone. Eight samples is smooth enough at this size.
  var histProjCache = { key: "", val: null };

  function histProjection(days) {
    var e = dailyEnergy();
    // Measured: 381,176 gainOne calls for the 365d view, and renderPanel runs on
    // the poll timer — so without this the Prog tab recomputes a third of a
    // million gain steps every few seconds and stutters while you scroll it.
    // The curve only moves when the stats, the gym, the energy budget or the
    // range move, so key on exactly those.
    var st = state.stats || {};
    var g = state.goals || {};
    var key = [days, e.total, state.gymName, state.focus, st.str, st.def, st.spe, st.dex,
               g.str, g.def, g.spe, g.dex, state.goalStep,
               (state.goalOrder || []).join(",")].join("|");
    if (histProjCache.key === key && histProjCache.val) return histProjCache.val;
    var out = {};
    // With goals set, the chart IS the schedule: each stat climbs only during
    // its own window and flattens at its target, then the next one starts. With
    // no goals it falls back to the single stat you picked. Either way it never
    // draws a stat you are not training — it used to project all four at once,
    // as four separate hypotheticals, which reads as a forecast.
    var plan = hasGoals() ? goalPlan() : null;
    // A stat can now hold several windows rather than one — with an increment
    // set it climbs, waits its turn, and climbs again. Its gains depend only on
    // its own value, so what matters at any date is how many days of training
    // it has HAD by then, whether that came in one block or six.
    var windows = {};
    if (plan && plan.perDay > 0) {
      plan.segments.forEach(function (sg) {
        (windows[sg.k] || (windows[sg.k] = [])).push({
          from: sg.at / plan.perDay,
          len: sg.trains / plan.perDay,
          cap: sg.cap
        });
      });
    }
    HIST_KEYS.forEach(function (k) {
      var ws = windows[k];
      var trained = plan ? !!(ws && ws.length) : k === state.focus;
      var target = plan && ws ? ws[ws.length - 1].cap : 0;
      var pts = [];
      for (var i = 0; i <= 8; i++) {
        var d = Math.round((days * i) / 8);
        var add = 0;
        if (trained && d) {
          var span = 0;
          if (ws) {
            ws.forEach(function (w) { span += Math.max(0, Math.min(d - w.from, w.len)); });
          } else {
            span = d;
          }
          if (span > 0) add = projectDays(span, e.total, k);
        }
        var v = (state.stats[k] || 0) + add;
        if (target && v > target) v = target;   // it stops at the goal, not past it
        pts.push({ d: d, v: v });
      }
      out[k] = pts;
    });
    histProjCache.key = key;
    histProjCache.val = out;
    return out;
  }

  // Compact axis label: 1.2b / 340m / 12.4k / 850. The gutter is ~34px wide in
  // a 360-unit viewBox, so full comma numbers do not fit on a phone — the delta
  // cards under the chart carry the exact figures.
  function fmtAxis(n) {
    if (!isFinite(n)) return "";
    var a = Math.abs(n);
    var s;
    if (a >= 1e9) s = (n / 1e9).toFixed(a >= 1e10 ? 0 : 1) + "b";
    else if (a >= 1e6) s = (n / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "m";
    else if (a >= 1e3) s = (n / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "k";
    else return String(Math.round(n));
    return s.replace(".0", "");
  }

  // "Aug 22" from an absolute day index (the dayKey integer). Past 90 days the
  // day of the month tells you nothing and two labels a season apart can share
  // it, so long ranges switch to month + year: "Aug '27".
  function fmtDay(d, byYear) {
    var dt = new Date(d * DAY_MS);
    // dayKey counts UTC days, so the label has to be read back in UTC. Reading
    // it with local getters puts everyone west of UTC a day behind their own
    // calendar — UTC midnight of Aug 22 is Aug 21, 8pm in New York.
    var mon = dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
    if (byYear) return mon + " '" + String(dt.getUTCFullYear()).slice(-2);
    return mon + " " + dt.getUTCDate();
  }

  // Round the axis step to something a person reads without decoding: 1, 2,
  // 2.5 or 5 times a power of ten. Dividing the raw max into four gives
  // gridlines like 433k and 865k, which are numbers nobody asked for.
  function niceStep(raw) {
    if (!(raw > 0)) return 1;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  }

  function histChart(days) {
    var win = histWindow(days);
    var proj = histProjection(days);
    var W = 360, H = 176, PADR = 8, PADT = 12, PADB = 30;
    var today = dayKey(Date.now());
    var firstRec = win.length ? win[0].d : today;
    var pastSpan = Math.max(1, today - firstRec); // days of history actually held

    // Every value that will be drawn, per stat, so the scale decision sees the
    // projection too — otherwise the dashed half runs off the top.
    var vals = {};
    HIST_KEYS.forEach(function (k, i) {
      vals[k] = win.map(function (e) { return e.v[i]; }).concat(proj[k].map(function (p) { return p.v; }));
    });

    // One shared axis, anchored at zero. Anchoring there is what makes it safe:
    // a stat that is a thousandth of the biggest draws as a flat line along the
    // floor, which is the truth about it, and its real numbers are in the legend
    // and the cards. Scaling each line to its own range instead would put four
    // unrelated y axes on one picture and there would be no number to print.
    var lo = 0, hi = -Infinity;
    HIST_KEYS.forEach(function (k) {
      vals[k].forEach(function (v) { if (v < lo) lo = v; if (v > hi) hi = v; });
    });
    if (!isFinite(hi)) return { svg: "", empty: true, legend: "" };

    var PADL = 36; // gutter for the value labels
    var SPLIT = PADL + (W - PADL - PADR) * 0.42; // "now" sits here, always
    var sx = function (d) {
      if (d <= today) {
        // Recorded side: map [firstRec .. today] across the left share.
        var t = pastSpan ? (d - firstRec) / pastSpan : 1;
        if (t < 0) t = 0;
        return PADL + t * (SPLIT - PADL);
      }
      // Projected side: map [today .. today+days] across the right share.
      return SPLIT + ((d - today) / days) * (W - PADR - SPLIT);
    };

    // Extend the top to a whole number of steps so every gridline is round.
    var axLo = lo, axHi = hi;
    if (axHi - axLo < 1) axHi = axLo + 1;
    // niceStep rounds up, so step lands between a quarter and a half of the
    // range, which pins the line count to 4 or 5 — no clamp needed, and the top
    // gridline never floats a whole empty step above the data.
    var step = niceStep((axHi - axLo) / 4);
    var GRID = Math.ceil((axHi - axLo) / step);
    axHi = axLo + step * GRID;
    var sy = function (k, v) {
      return PADT + (1 - (v - axLo) / (axHi - axLo)) * (H - PADT - PADB);
    };

    // --- x axis: dates the labels can actually be told apart at ---
    var cand = [];
    var byYear = days > 90;
    if (win.length > 1) cand.push({ x: PADL, t: fmtDay(firstRec, byYear), a: "start" });
    cand.push({ x: SPLIT, t: "now", a: "middle" });
    var steps = days <= 7 ? 1 : days <= 90 ? 2 : 3;
    for (var s = 1; s <= steps; s++) {
      var dd = Math.round((days * s) / steps);
      cand.push({ x: sx(today + dd), t: fmtDay(today + dd, byYear), a: s === steps ? "end" : "middle" });
    }
    // The step counts above are chosen so the labels never crowd: the recorded
    // side is a fixed 42% share and the projected side is cut into at most
    // three, which leaves >=60 units between labels at every range.
    var xl = cand;

    var parts = [];

    // --- grid ---
    for (var g = 0; g <= GRID; g++) {
      var gy = (PADT + (g / GRID) * (H - PADT - PADB)).toFixed(1);
      parts.push('<line x1="' + PADL + '" y1="' + gy + '" x2="' + (W - PADR) + '" y2="' + gy +
        '" stroke="#2a313a" stroke-width="1"/>');
      var gv = axHi - (g / GRID) * (axHi - axLo);
      parts.push('<text x="' + (PADL - 5) + '" y="' + (Number(gy) + 3).toFixed(1) +
        '" fill="#8a93a0" font-size="9" text-anchor="end">' + esc(fmtAxis(gv)) + "</text>");
    }
    xl.forEach(function (c) {
      parts.push('<line x1="' + c.x.toFixed(1) + '" y1="' + PADT + '" x2="' + c.x.toFixed(1) +
        '" y2="' + (H - PADB) + '" stroke="#2a313a" stroke-width="1"/>');
      parts.push('<text x="' + c.x.toFixed(1) + '" y="' + (H - PADB + 13) +
        '" fill="#8a93a0" font-size="9" text-anchor="' + c.a + '">' + esc(c.t) + "</text>");
    });

    // --- the "now" divider, drawn over the grid so it reads as the split ---
    var nowX = sx(today).toFixed(1);
    parts.push('<line x1="' + nowX + '" y1="' + (PADT - 4) + '" x2="' + nowX + '" y2="' + (H - PADB) +
      '" stroke="#9aa3b0" stroke-width="1" stroke-dasharray="3 3"/>');
    parts.push('<text x="' + nowX + '" y="' + (PADT - 6) +
      '" fill="#9aa3b0" font-size="9" text-anchor="middle">now</text>');

    HIST_KEYS.forEach(function (k, i) {
      var c = HIST_COLOURS[k];
      if (win.length > 1) {
        var solid = win.map(function (e, n) {
          return (n ? "L" : "M") + sx(e.d).toFixed(1) + " " + sy(k, e.v[i]).toFixed(1);
        }).join(" ");
        parts.push('<path d="' + solid + '" fill="none" stroke="' + c + '" stroke-width="1.6"/>');
      }
      var dash = proj[k].map(function (p, n) {
        return (n ? "L" : "M") + sx(today + p.d).toFixed(1) + " " + sy(k, p.v).toFixed(1);
      }).join(" ");
      parts.push('<path d="' + dash + '" fill="none" stroke="' + c + '" stroke-width="1.4" stroke-dasharray="4 3" opacity="0.85"/>');
      // A dot on the last projected point so the end of each line is findable
      // even where two of them run together.
      var lastP = proj[k][proj[k].length - 1];
      parts.push('<circle cx="' + sx(today + lastP.d).toFixed(1) + '" cy="' + sy(k, lastP.v).toFixed(1) +
        '" r="2.4" fill="' + c + '"/>');
    });

    // A number per stat, at the end of the projection — the y axis can only be
    // read to the nearest gridline, and a stat sitting on the floor needs its
    // real figure somewhere.
    var legend =
      '<div class="gc-legend">' +
      HIST_KEYS.map(function (k) {
        var pts = proj[k];
        return '<span><i style="background:' + HIST_COLOURS[k] + '"></i>' + k.toUpperCase() +
          " <b>" + esc(fmtAxis(pts[pts.length - 1].v)) + "</b></span>";
      }).join("") +
      '<span class="gc-lkey">solid recorded · dashed projected</span></div>';

    return {
      svg: '<svg class="gc-chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Stat progression, recorded and projected">' + parts.join("") + "</svg>",
      empty: win.length < 2,
      points: win.length,
      legend: legend,
    };
  }

  // Spent vs missed, one stacked bar a day. Same drawing rules as the
  // progression chart: zero-anchored, round gridlines, dated axis.
  var WASTE_USED = "#5a9bd8";
  var WASTE_LOST = "#e5484d";

  function wasteChart(days) {
    var span = Math.min(days, 21); // more bars than this is a smear on a phone
    var today = dayKey(Date.now());
    var byDay = {};
    state.ledger.forEach(function (e) { byDay[e.d] = e; });
    var rows = [];
    for (var i = span - 1; i >= 0; i--) {
      var d = today - i;
      var e = byDay[d] || { used: 0, wasted: 0 };
      rows.push({ d: d, used: e.used || 0, wasted: e.wasted || 0 });
    }
    var hi = 0;
    rows.forEach(function (r) { if (r.used + r.wasted > hi) hi = r.used + r.wasted; });
    if (hi <= 0) return { svg: "", empty: true, legend: "" };

    var W = 360, H = 150, PADL = 36, PADR = 8, PADT = 12, PADB = 26;
    var step = niceStep(hi / 4);
    var GRID = Math.ceil(hi / step);
    var axHi = step * GRID;
    var plotW = W - PADL - PADR;
    var slot = plotW / rows.length;
    var barW = Math.max(3, Math.min(26, slot * 0.68));
    var sy = function (v) { return PADT + (1 - v / axHi) * (H - PADT - PADB); };

    var parts = [];
    for (var g = 0; g <= GRID; g++) {
      var gy = (PADT + (g / GRID) * (H - PADT - PADB)).toFixed(1);
      parts.push('<line x1="' + PADL + '" y1="' + gy + '" x2="' + (W - PADR) + '" y2="' + gy + '" stroke="#2a313a"/>');
      parts.push('<text x="' + (PADL - 5) + '" y="' + (Number(gy) + 3).toFixed(1) +
        '" fill="#8a93a0" font-size="9" text-anchor="end">' + esc(fmtAxis(axHi - (g / GRID) * axHi)) + "</text>");
    }
    rows.forEach(function (r, n) {
      var cx = PADL + slot * n + slot / 2;
      var x = (cx - barW / 2).toFixed(1);
      var yUsed = sy(r.used), y0 = sy(0);
      if (r.used > 0) {
        parts.push('<rect x="' + x + '" y="' + yUsed.toFixed(1) + '" width="' + barW.toFixed(1) +
          '" height="' + Math.max(0, y0 - yUsed).toFixed(1) + '" fill="' + WASTE_USED + '" rx="1.5"/>');
      }
      if (r.wasted > 0) {
        var yTop = sy(r.used + r.wasted);
        parts.push('<rect x="' + x + '" y="' + yTop.toFixed(1) + '" width="' + barW.toFixed(1) +
          '" height="' + Math.max(0, yUsed - yTop).toFixed(1) + '" fill="' + WASTE_LOST + '" rx="1.5"/>');
      }
    });
    // Label the ends and the middle only; a label per bar is unreadable here.
    [0, Math.floor(rows.length / 2), rows.length - 1].forEach(function (n, k) {
      if (n < 0 || n >= rows.length) return;
      if (k === 1 && rows.length < 5) return;
      var cx = PADL + slot * n + slot / 2;
      parts.push('<text x="' + cx.toFixed(1) + '" y="' + (H - PADB + 13) +
        '" fill="#8a93a0" font-size="9" text-anchor="' +
        (k === 0 ? "start" : k === 2 ? "end" : "middle") + '">' + esc(fmtDay(rows[n].d, false)) + "</text>");
    });

    var tot = ledgerWindow(span);
    var pct = tot.used + tot.wasted > 0 ? Math.round((tot.used / (tot.used + tot.wasted)) * 100) : 0;
    var legend =
      '<div class="gc-legend"><span><i style="background:' + WASTE_USED + '"></i>SPENT <b>' +
      esc(fmtAxis(tot.used)) + "</b></span>" +
      '<span><i style="background:' + WASTE_LOST + '"></i>MISSED <b>' + esc(fmtAxis(missed(tot.wasted))) + "</b></span>" +
      '<span class="gc-lkey">' + pct + "% of your bar used</span></div>";

    return {
      svg: '<svg class="gc-chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Energy spent versus missed, by day">' + parts.join("") + "</svg>",
      empty: false,
      legend: legend,
      days: span
    };
  }

  // The live one: what sitting on a full bar is costing you right now.
  function wasteCard() {
    var streak = capStreak();
    var t = ledgerWindow(1);
    // Torn's log where it answers, the bar only as a fallback. The bar figure
    // cannot survive two devices: each sees only its own readings, so one that
    // has been closed a while books the gap as though the bar sat full through
    // it -- including the hours the other device was spending.
    var apiOff = state.attacks && typeof state.attacks.energy === "number";
    var off = apiOff ? state.attacks.energy : (t.off || 0);
    var logged = trainedToday();
    var pct = t.used + t.wasted + off > 0
      ? Math.round((t.used / (t.used + t.wasted + off)) * 100) : null;
    // Two readings of the same full bar. Off stack it is regen you let slip. On
    // stack the coach itself said "Leave energy alone. Don't train", so billing
    // you for obeying is the same contradiction 0.9.12 fixed in the gym advice.
    // The duration still shows -- during a war, how long the stack has been
    // held is the most useful number on the screen.
    var head = !(streak && streak.sec >= 1) ? ""
      : state.warStack
        ? '<div class="gcb-waste" style="margin:0 0 9px">Bar has been full for ' + fmtCd(streak.sec) +
          " \u2014 held for the stack, so it is not counted as missed.</div>"
        : '<div class="gcb-waste" style="margin:0 0 9px">Bar has been full for ' + fmtCd(streak.sec) +
          " \u2014 that is <b>" + fmt(missed(streak.lost)) + "e</b> of regen you did not get.</div>";
    return (
      '<div class="gc-card"><h3>Energy used vs missed</h3>' + head +
      // Torn's own record where we have it. The bar can only ever infer, and it
      // cannot see a session the script was not running for.
      '<div class="row"><span>Spent today</span><b>' + fmt(Math.round(logged === null ? t.used : logged)) +
        "e</b>" + (logged === null ? '<span class="muted"> \u00b7 from the bar</span>' : "") + "</div>" +
      '<div class="row"><span>Missed today</span><b class="' + (t.wasted >= 25 ? "bad" : "muted") + '">' + fmt(missed(t.wasted)) + "e</b>" +
        // A figure that is knowingly short says so. The alternative was the
        // old guess, which filled the gap with a number rather than a caveat.
        (t.partial ? '<span class="muted"> \u00b7 observed only</span>' : "") + "</div>" +
      (off > 0
        ? '<div class="row"><span>Spent attacking</span><b class="bad">' + fmt(Math.round(off)) + "e</b>" +
          (apiOff
            ? '<span class="muted"> \u00b7 ' + state.attacks.n + " hit" + (state.attacks.n === 1 ? "" : "s") + "</span>"
            : '<span class="muted"> \u00b7 from the bar</span>') + "</div>"
        : "") +
      (pct === null ? "" : '<div class="row"><span>Bar actually used</span><b class="' + (pct >= 90 ? "ok" : pct >= 70 ? "" : "bad") + '">' + pct + "%</b></div>") +
      '<p class="muted" style="margin:8px 0 0">Missed energy is regen your bar dropped because it was already full. Counted from when the script last saw your bar, so time with Torn closed still counts. Energy spent attacking is listed apart \u2014 it left the bar, but it never reached the gym, so it counts against your bar-used figure rather than toward it.</p>' +
      "</div>"
    );
  }

  function histDeltaCards(days) {
    var win = histWindow(days);
    return HIST_KEYS.map(function (k, i) {
      var d = null;
      if (win.length > 1) d = win[win.length - 1].v[i] - win[0].v[i];
      return (
        '<div class="gc-dcard"><span style="color:' + HIST_COLOURS[k] + '">' + k.toUpperCase() + "</span>" +
        "<b>" + (d === null ? "—" : (d >= 0 ? "+" : "") + fmt(d)) + "</b>" +
        '<i class="muted">' + fmt(state.stats[k] || 0) + "</i></div>"
      );
    }).join("");
  }

  function pushLog(text) {
    var entry = {
      t: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      ts: Date.now(),
      text: text,
    };
    state.log.unshift(entry);
    state.log = state.log.slice(0, 80);
    storeSet("log", state.log);
  }

  function refresh(kind) {
    var key = resolveKey();
    if (!key) {
      state.status = "needkey";
      state.statusText = HAS_PDA_KEY ? "Waiting on Torn PDA key" : "Add a Limited API key in Set";
      renderPanel();
      return Promise.resolve();
    }
    if (state.fetchInFlight) return Promise.resolve();
    state.fetchInFlight = true;
    var INV_TTL = 90000; // 7 requests a go — at most one round every 90s
    var invAge = Date.now() - (state.invAt || 0);
    var invForce = kind === "boot" || kind === "manual" || !state.lastFetch;
    var wantInv = invForce || ((kind === "open" || kind === "stock" || kind === "train" || state.tab === "stock") && invAge > INV_TTL);
    // `basic` is PUBLIC access, so appending it cannot fail a call the rest of
    // which already works -- and it carries player_id, which is what lets the
    // attack log tell your hits from hits on you.
    var sel = "bars,cooldowns,battlestats,gym,perks,timestamp,basic";
    return httpGet(apiUrl(sel))
      .then(function (data) {
        applyUserPayload(data, false);
        if (data && data.player_id != null) state.playerId = String(data.player_id);
        // Torn's own record of what was trained. Refreshed on its own TTL, and
        // forced right after a detected session so the figure settles quickly.
        // NOT on "train". The gym-page click handler fires refresh("train")
        // twice per press, so forcing here cost eight log calls per click and
        // was most of a 100-a-minute budget during an ordinary session. The
        // live `since` figure already keeps "Spent today" moving without
        // asking Torn at all, which is what makes this safe to drop.
        fetchTrainLog(kind === "boot" || kind === "manual");
        fetchRefills(kind === "boot" || kind === "manual");
        fetchStocks(kind === "boot" || kind === "manual");
        fetchAttacksToday(kind === "boot" || kind === "manual" || kind === "train");
        fetchKeyLevel(kind === "boot" || kind === "manual");
        if (!wantInv) return null;
        return fetchInventoryV2().then(
          function (rows) {
            var tal0 = state.invTally || {};
            var failed = Object.keys(tal0).filter(function (c) { return tal0[c] === "err"; });
            if (failed.length) {
              // A partial round would publish a total that silently omits whole
              // categories — worse than showing the previous, complete numbers.
              state.invUnavailable = "partial (" + failed.join(", ") + ") — kept last good counts";
              state.invDiag = { at: Date.now(), present: false, rows: rows.length, matched: 0,
                sample: [Object.keys(tal0).map(function (c) { return c + ":" + tal0[c]; }).join(" ")] };
              state.invAt = Date.now();
              return null;
            }
            var counted = countItems(rows);
            applyCountedItems(counted);
            var matched = 0;
            for (var ck in counted.qty) if (counted.qty[ck]) matched++;
            state.invUnavailable = "";
            state.invAt = Date.now();
            var tal = state.invTally || {};
            var talStr = Object.keys(tal).map(function (c) { return c + ":" + tal[c]; }).join(" ");
            state.invDiag = { at: Date.now(), present: true, rows: rows.length, matched: matched, sample: talStr ? [talStr] : [] };
            return null;
          },
          function (err) {
            // Non-fatal by design: bars, cooldowns and stats already landed.
            state.invUnavailable = (err && err.message) || "inventory request failed";
            state.invDiag = { at: Date.now(), present: false, rows: 0, matched: 0 };
            // Back off rather than hammer: pretend we just fetched so the TTL
            // holds us off, and keep whatever counts we already had.
            state.invAt = Date.now();
            return null;
          }
        );
      })
      .then(function () {
        armNotifications();
        renderPanel();
      })
      .catch(function (err) {
        state.status = "error";
        state.statusText = err && err.message ? err.message : "API failed";
        renderPanel();
      })
      .then(function () {
        state.fetchInFlight = false;
      });
  }

  var PING_XAN = 2101;
  var PING_ENERGY = 2102;
  var PING_XAN_FULL = 2103;
  var PING_TICK = 2104;

  function flutterHandler() {
    try {
      // warboard exposes the same protocol under its OWN name. It deliberately
      // does NOT define flutter_inappwebview: that object's presence is how
      // every userscript detects Torn PDA, and defining it made FactionOps
      // disable SSE inside warboard and show "network error".
      if (window.__WB_BRIDGE__ && typeof window.__WB_BRIDGE__.callHandler === "function") {
        return window.__WB_BRIDGE__;
      }
      if (window.flutter_inappwebview && typeof window.flutter_inappwebview.callHandler === "function") {
        return window.flutter_inappwebview;
      }
    } catch (_) {}
    try {
      if (typeof unsafeWindow !== "undefined" && unsafeWindow.flutter_inappwebview) return unsafeWindow.flutter_inappwebview;
    } catch (_) {}
    return null;
  }

  function pdaCall(name, payload) {
    pdaReady()
      .then(function () {
        var fl = flutterHandler();
        if (!fl || typeof fl.callHandler !== "function") return;
        return fl.callHandler(name, payload);
      })
      .catch(function () {});
  }

  function cancelPing(id) {
    pdaCall("cancelNotification", { id: id });
  }

  function pingAt(id, subtitle, whenMs) {
    if (!whenMs || whenMs <= Date.now() + 4000) return;
    pdaCall("scheduleNotification", {
      title: "Gym Coach",
      subtitle: subtitle,
      id: id,
      timestamp: whenMs,
      overwriteID: true,
      launchNativeToast: false,
      urlCallback: "https://www.torn.com/gym.php",
    });
  }

  function armNotifications() {
    // Notifications are the one thing that has to be right while the panel is
    // SHUT — tucked away, or on any non-gym page, where ensureUi() closes it.
    // applyGoalFocus() used to run only inside renderPanelInner(), behind its
    // early return on a closed panel, so a tucked panel armed "train Strength"
    // against a Speed goal. Sync here, where the text is actually built.
    applyGoalFocus();
    if (state.warStack) {
      cancelPing(PING_XAN);
      cancelPing(PING_ENERGY);
      cancelPing(PING_XAN_FULL);
      cancelPing(PING_TICK);
      return;
    }
    var now = Date.now();
    var toFull = timeToFull();
    // Same cap rule as the meter. With two points of slack here, a bar sitting
    // at 149 scheduled no "energy full" ping at all — the last two points were
    // treated as already arrived.
    var fullSoon = toFull > 5 && !barFull();
    if (fullSoon) pingAt(PING_ENERGY, "Energy full — train " + focusLabel(), now + toFull * 1000);
    else cancelPing(PING_ENERGY);

    if (state.mode === "jump") {
      pingAt(PING_TICK, "Happy tick — jump window", now + nextTickSec() * 1000);
    } else {
      cancelPing(PING_TICK);
    }

    if (state.drugCd > 5) {
      var xanAt = now + state.drugCd * 1000;
      if (toFull > state.drugCd && toFull - state.drugCd <= WAIT_FULL_MAX) {
        pingAt(PING_XAN, "Xan is up. Wait for a full bar, then take it.", xanAt);
        pingAt(PING_XAN_FULL, "Bar full. Take a xan, then train " + focusLabel() + ".", now + toFull * 1000);
      } else {
        pingAt(PING_XAN, "Xan is up. Open gym.", xanAt);
        cancelPing(PING_XAN_FULL);
      }
    } else if (state.drugCd <= 0 && state.items.xanax > 0 && fullSoon && toFull <= WAIT_FULL_MAX) {
      cancelPing(PING_XAN);
      pingAt(PING_XAN_FULL, "Bar full. Take a xan, then train " + focusLabel() + ".", now + toFull * 1000);
    } else {
      cancelPing(PING_XAN);
      cancelPing(PING_XAN_FULL);
    }
  }

  function css() {
    return (
      "bottom:calc(184px + env(safe-area-inset-bottom,0px)) !important;" +
      "display:flex !important;visibility:visible !important;opacity:1 !important;align-items:center;justify-content:center;width:52px !important;height:52px !important;padding:0;margin:0;" +
      "border:2px solid #f2a03d !important;border-radius:14px !important;background:#121418 !important;color:#f2a03d !important;" +
      "font:800 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:.08em;" +
      "box-shadow:0 8px 24px rgba(0,0,0,.45);-webkit-appearance:none;appearance:none;cursor:pointer;" +
      "-webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none;pointer-events:auto}" +
      "#gcb-gym-dock{display:block !important;width:100%;box-sizing:border-box;margin:8px 0;min-height:48px;" +
      "border:2px solid #f2a03d;border-radius:10px;background:#121418;color:#f2a03d;" +
      "font:800 16px/1 -apple-system,sans-serif;letter-spacing:.08em;-webkit-appearance:none;appearance:none;" +
      "touch-action:manipulation}" +
      "#" + PANEL_ID + "{position:fixed;z-index:2147483647;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom,0px));top:auto;" +
      "width:auto;max-width:calc(100vw - 16px);height:80vh;height:min(80dvh,calc(100dvh - 64px));max-height:calc(100vh - 24px);min-height:0;background:#1a1d23;color:#f2f4f7;" +
      "display:none;flex-direction:column;font:15px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" +
      "border:1px solid #2ecc71;border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.55);overflow:hidden;-webkit-overflow-scrolling:touch}" +
      "#" + PANEL_ID + ".open{display:flex}" +
      "#" + PANEL_ID + " *{box-sizing:border-box}" +
      "#" + PANEL_ID + " .gc-owner{flex:0 0 auto;max-height:88px;overflow:hidden;padding:8px 12px 8px;background:#121418;border-bottom:1px solid #2e333c;min-width:0}" +
      "#" + PANEL_ID + " .gc-ascii{margin:0;max-width:100%;color:#2ecc71;font:800 11px/1.15 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre;overflow:visible;text-align:center;letter-spacing:.04em}" +
      "#" + PANEL_ID + " .gc-tag{margin:6px 0 0;color:#2ecc71;font:800 13px/1.2 -apple-system,sans-serif;letter-spacing:.06em;text-align:center}" +
      "#" + PANEL_ID + " .gc-own{display:none}" +
      "#" + PANEL_ID + " .gc-head{flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #2e333c;min-width:0;cursor:grab;touch-action:none;user-select:none}" +
      "#" + PANEL_ID + " .gc-owner{cursor:grab;touch-action:none;user-select:none}" +
      "#" + PANEL_ID + " .gc-head>div{min-width:0;flex:1}" +
      "#" + PANEL_ID + " h2{margin:0;font-size:16px;letter-spacing:.08em;font-weight:800}" +
      "#" + PANEL_ID + " .sub{margin:3px 0 0;font-size:11px;color:#94a3b8}" +
      "#" + PANEL_ID + " .live{display:inline-flex;align-items:center;gap:6px;color:#2ecc71;font-size:11px;font-weight:700}" +
      "#" + PANEL_ID + " .dot{width:8px;height:8px;border-radius:50%;background:#2ecc71;box-shadow:0 0 0 4px rgba(46,204,113,.18)}" +
      "#" + PANEL_ID + " .dot.off{background:#e74c3c;box-shadow:none}" +
      "#" + PANEL_ID + " .gc-tuck{border:0;background:#23272f;color:#f2f4f7;border-radius:10px;min-height:40px;padding:0 12px;flex:0 0 auto;font:800 12px -apple-system,sans-serif;letter-spacing:.06em;text-transform:uppercase;-webkit-tap-highlight-color:transparent;touch-action:manipulation;cursor:pointer}" +
      "#" + PANEL_ID + " .gc-body{flex:1 1 0%;height:0;min-width:0;min-height:0;overflow-x:hidden;overflow-y:auto;padding:10px 12px;padding-bottom:16px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y}" +
      "#" + PANEL_ID + " .gc-foot{flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 12px calc(8px + env(safe-area-inset-bottom,0px));border-top:1px solid #2e333c;font-size:11px;color:#94a3b8;min-width:0}" +
      "#" + PANEL_ID + " .gc-foot b{color:#2ecc71;font-weight:600}" +
      "#" + PANEL_ID + " .gc-ago{font-weight:inherit;color:inherit}" +
      "#" + PANEL_ID + " .gc-card{margin:0 0 10px;padding:12px;border-radius:12px;background:#23272f;border:1px solid #2e333c;max-width:100%;min-width:0}" +
      "#" + PANEL_ID + " .gc-card h3{margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;font-weight:700}" +
      // Faction board. A five-column grid rather than a table so the name can
      // shrink and the numbers cannot -- a long username must not push the
      // energy figure off a phone.
      "#" + PANEL_ID + " .gcb-brow{display:grid;grid-template-columns:20px minmax(0,1fr) auto 34px;grid-template-areas:'r n e p' '. g g g';gap:2px 8px;align-items:baseline;padding:7px 0;border-top:1px solid #2e333c;font-size:13px}" +
      "#" + PANEL_ID + " .gcb-brow:first-of-type{border-top:0}" +
      "#" + PANEL_ID + " .gcb-brow.head{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;font-weight:700;border-top:0}" +
      "#" + PANEL_ID + " .gcb-brow.head .gcb-bgain{display:none}" +
      "#" + PANEL_ID + " .gcb-brow.foot{border-top:1px solid #2e333c;font-size:11px}" +
      "#" + PANEL_ID + " .gcb-brow.btns{display:flex;flex-wrap:wrap;gap:8px;border:0;padding:0}" +
      "#" + PANEL_ID + " .gcb-brow.me{background:#1d232b;border-radius:8px;padding-left:6px;padding-right:6px;margin:0 -6px}" +
      "#" + PANEL_ID + " .gcb-brank{grid-area:r;color:#94a3b8;font-size:11px;font-weight:700}" +
      "#" + PANEL_ID + " .gcb-bname{grid-area:n;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}" +
      "#" + PANEL_ID + " .gcb-benergy{grid-area:e;font-weight:800;font-variant-numeric:tabular-nums}" +
      "#" + PANEL_ID + " .gcb-bnat{grid-area:p;text-align:right;font-variant-numeric:tabular-nums;font-size:12px}" +
      "#" + PANEL_ID + " .gcb-bgain{grid-area:g;font-size:11px;overflow-wrap:anywhere}" +
      "#" + PANEL_ID + " .gcb-natprompt{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin:0 0 4px;padding:9px 10px;border-radius:9px;background:#1a1d23;border:1px solid #2e333c;font-size:12px;line-height:1.4}" +
      "#" + PANEL_ID + " .gcb-natprompt span{flex:1 1 150px;min-width:0}" +
      "#" + PANEL_ID + " .gcb-btn{border:1px solid #2e333c;background:#1a1d23;color:#e6edf3;border-radius:9px;padding:9px 12px;font-size:13px;font-weight:700;cursor:pointer;-webkit-appearance:none;appearance:none}" +
      "#" + PANEL_ID + " .gcb-btn.ghost{color:#94a3b8;font-weight:600}" +
      "#" + PANEL_ID + " .gcb-card-preview{margin:10px 0 0;padding:10px;border-radius:9px;background:#1a1d23;border:1px solid #2e333c;color:#94a3b8;font:11px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap;overflow-wrap:anywhere;max-height:190px;overflow:auto;user-select:text}" +
      "#" + PANEL_ID + " .next{border:1px solid #2ecc71;background:#1a1d23;text-align:center}" +
      "#" + PANEL_ID + " .next .move{font-size:18px;line-height:1.25;color:#2ecc71;margin:0 0 8px;font-weight:800;overflow-wrap:anywhere}" +
      "#" + PANEL_ID + " .next p{margin:0;color:#94a3b8;font-size:14px;text-align:center}" +
      "#" + PANEL_ID + " .steps{list-style:none;margin:12px 0 0;padding:0;text-align:left}" +
      "#" + PANEL_ID + " .steps li{display:grid;grid-template-columns:64px minmax(0,1fr);gap:8px;padding:10px 0;border-top:1px solid #2e333c}" +
      "#" + PANEL_ID + " .steps .when{color:#2ecc71;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;overflow-wrap:anywhere}" +
      "#" + PANEL_ID + " .waste{margin:10px 0 0;color:#e74c3c;font-size:13px;text-align:left;line-height:1.35}" +
      "#" + PANEL_ID + " .pick{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;max-width:100%}" +
      "#" + PANEL_ID + " .pick .gc-btn{flex:1 1 calc(50% - 8px);min-width:0;max-width:100%;padding:0 8px;font-size:13px}" +
      "#" + PANEL_ID + " .next.stack{border-color:#e74c3c}" +
      "#" + PANEL_ID + " .next.stack .move{color:#e74c3c}" +
      "#" + PANEL_ID + " .flash{margin:0 0 10px;padding:10px;border-radius:10px;background:#2ecc71;color:#fff;text-align:center;font-weight:800;letter-spacing:.12em}" +
      "#" + PANEL_ID + " .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;min-width:0}" +
      "#" + PANEL_ID + " .grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}" +
      "#" + PANEL_ID + " .stat{min-width:0}" +
      "#" + PANEL_ID + " .stat label{display:block;font-size:10px;color:#94a3b8;margin-bottom:2px;text-transform:uppercase;letter-spacing:.06em}" +
      "#" + PANEL_ID + " .stat b{font-size:15px;overflow-wrap:anywhere}" +
      "#" + PANEL_ID + " .ok{color:#2ecc71}" +
      "#" + PANEL_ID + " .bad{color:#e74c3c}" +
      "#" + PANEL_ID + " .warn{color:#e67e22}" +
      "#" + PANEL_ID + " .muted{color:#94a3b8}" +
      "#" + PANEL_ID + " .row{display:flex;justify-content:space-between;gap:8px;align-items:baseline;padding:12px 0;border-bottom:1px solid #2e333c;min-width:0}" +
      "#" + PANEL_ID + " .row:last-child{border-bottom:0}" +
      "#" + PANEL_ID + " .row>div,#" + PANEL_ID + " .row>span:first-child{min-width:0;overflow-wrap:anywhere}" +
      "#" + PANEL_ID + " .chip{flex:0 0 auto;max-width:46%;text-align:right;overflow-wrap:anywhere;font-size:12px;font-weight:800;color:#2ecc71;border:0;background:transparent;padding:0;font-family:inherit;-webkit-tap-highlight-color:transparent}" +
      "#" + PANEL_ID + " .chip.use,#" + PANEL_ID + " .chip[data-tip]{cursor:pointer}" +
      "#" + PANEL_ID + " .chip.use{background:#2ecc71;color:#fff;border-radius:8px;min-height:36px;padding:0 12px;max-width:100%}" +
      "#" + PANEL_ID + " .chip.bad{color:#e74c3c}" +
      "#" + PANEL_ID + " .chip.warn{color:#e67e22}" +
      "#" + PANEL_ID + " .chip.muted{color:#94a3b8}" +
      "#" + PANEL_ID + " .gc-toast{position:absolute;left:12px;right:12px;bottom:calc(56px + env(safe-area-inset-bottom,0px));z-index:8;background:#23272f;border:1px solid #2ecc71;border-radius:12px;padding:10px 12px;opacity:0;pointer-events:none;transform:translateY(8px);transition:opacity .2s,transform .2s}" +
      "#" + PANEL_ID + " .gc-toast.show{opacity:1;transform:translateY(0)}" +
      "#" + PANEL_ID + " .gc-toast b{display:block;color:#2ecc71;font-size:13px;margin-bottom:4px}" +
      "#" + PANEL_ID + " .gc-toast span{display:block;color:#f2f4f7;font-size:13px;line-height:1.35}" +
      "#" + PANEL_ID + " .gc-btn{border:0;border-radius:10px;min-height:44px;padding:0 16px;background:#2ecc71;color:#fff;font-weight:800;font-size:14px;font-family:inherit;max-width:100%;-webkit-tap-highlight-color:transparent}" +
      "#" + PANEL_ID + " .gc-btn.secondary{background:#23272f;color:#f2f4f7;border:1px solid #2e333c}" +
      "#" + PANEL_ID + " .gc-btn{transition:transform .08s ease,filter .08s ease}" +
      "#" + PANEL_ID + " .gc-btn:active{transform:scale(.96);filter:brightness(.88)}" +
      "#" + PANEL_ID + " .chip:active,#" + PANEL_ID + " .gc-tuck:active{transform:scale(.96);filter:brightness(.88)}" +
      "#" + PANEL_ID + " .chip,#" + PANEL_ID + " .gc-tuck{transition:transform .08s ease,filter .08s ease}" +
      "#" + PANEL_ID + " .actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;justify-content:center;max-width:100%}" +
      "#" + PANEL_ID + " .actions .gc-btn{flex:1 1 120px;min-width:0}" +
      "#" + PANEL_ID + " .toggle{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0}" +
      "#" + PANEL_ID + " .toggle>div:first-child{min-width:0;flex:1}" +
      "#" + PANEL_ID + " .sw{flex:0 0 52px;width:52px;height:32px;border-radius:99px;background:#2a3038;position:relative;border:1px solid #2e333c;-webkit-tap-highlight-color:transparent}" +
      "#" + PANEL_ID + " .sw i{position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#94a3b8}" +
      "#" + PANEL_ID + " .sw.on{background:#2ecc71;border-color:transparent}" +
      "#" + PANEL_ID + " .sw.on i{left:25px;background:#fff}" +
      "#" + PANEL_ID + " .tabs{display:flex;flex:0 0 auto;width:auto;max-width:100%;min-width:0;gap:0;margin:8px 12px 0;background:#121418;border-radius:10px;overflow:hidden}" +
      "#" + PANEL_ID + " .tabs button{flex:1 1 0;min-width:0;min-height:44px;border:0;background:transparent;color:#94a3b8;padding:0 2px;font:800 10px -apple-system,sans-serif;letter-spacing:.02em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;-webkit-tap-highlight-color:transparent}" +
      "#" + PANEL_ID + " .tabs button.on{background:#2ecc71;color:#fff}" +
      "#" + PANEL_ID + " input.gc-in{width:100%;min-height:44px;padding:10px 12px;border-radius:10px;border:1px solid #2e333c;background:#121418;color:#fff;font-size:16px}" +
      "#" + PANEL_ID + " .timeline{list-style:none;margin:0;padding:0}" +
      "#" + PANEL_ID + " .timeline li{display:grid;grid-template-columns:64px minmax(0,1fr);gap:8px;margin:0 0 10px}" +
      "#" + PANEL_ID + " .timeline time{color:#2ecc71;font-size:12px;font-weight:800}" +
      "#" + PANEL_ID + " .proj{display:grid;grid-template-columns:36px minmax(0,1fr) auto;gap:8px;align-items:center;margin:10px 0;min-width:0}" +
      "#" + PANEL_ID + " .proj b{color:#2ecc71;max-width:42vw;overflow-wrap:anywhere}" +
      "#" + PANEL_ID + " .bar{height:6px;background:#2a3038;border-radius:99px;overflow:hidden}" +
      "#" + PANEL_ID + " .bar i{display:block;height:100%;background:#2ecc71}" +
      "#" + PANEL_ID + " .gc-chart{width:100%;height:auto;aspect-ratio:360/176;display:block;margin:10px 0 4px;background:#12161b;border-radius:8px}"+
      "#" + PANEL_ID + " .gc-legend{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;margin:2px 0 2px;font-size:10px;color:#8a93a0}"+
      "#" + PANEL_ID + " .gc-legend span{display:inline-flex;align-items:center;gap:4px}"+
      "#" + PANEL_ID + " .gc-legend i{width:9px;height:3px;border-radius:2px;display:inline-block}"+
      "#" + PANEL_ID + " .gc-legend b{color:#e6e9ee;font-size:10px}"+
      "#" + PANEL_ID + " .gc-lkey{opacity:.8}" +
      "#" + PANEL_ID + " .gcb-rawp{font:400 11px/1.5 ui-monospace,Menlo,monospace;color:#6f7885;" +
      "overflow-wrap:anywhere}" +
      "#" + PANEL_ID + " .gcb-rawp.on{color:#3fbf7f}" +
      "#" + PANEL_ID + " .gcb-goals{display:grid;gap:8px;margin:8px 0 4px}" +
      "#" + PANEL_ID + " .gcb-goal{background:#161b22;border:1px solid #262e39;border-radius:10px;padding:8px 9px}" +
      "#" + PANEL_ID + " .gcb-goal.now{border-color:#f2a03d}" +
      "#" + PANEL_ID + " .gcb-goal.done{opacity:.6}" +
      "#" + PANEL_ID + " .gcb-val{background:#161b22;border:1px solid #262e39;border-radius:10px;padding:8px 9px}" +
      "#" + PANEL_ID + " .gcb-up{background:none;border:0;color:#8b98a5;font-size:11px;line-height:1;padding:2px 6px 2px 0;cursor:pointer}" +
      "#" + PANEL_ID + " .gcb-up:hover{color:#f2a03d}" +
      "#" + PANEL_ID + " .gcb-up.ghost{visibility:hidden}" +
      "#" + PANEL_ID + " .gcb-wish{margin:8px 0 0;padding:8px 9px;border:1px solid #6b4a1f;border-radius:8px;background:#1d1608;color:#f2a03d;font-size:11px;line-height:1.5}" +
      "#" + PANEL_ID + " .gcb-strip{display:flex;align-items:center;gap:8px;width:calc(100% - 24px);margin:8px 12px 0;min-height:44px;padding:8px 10px;border:1px solid #262e39;border-radius:10px;background:#161b22;color:#c9d1d9;text-align:left;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}" +
      "#" + PANEL_ID + " .gcb-strip:hover{border-color:#f2a03d}" +
      "#" + PANEL_ID + " .gcb-striplab{flex:0 0 auto;font:800 9px -apple-system,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8b98a5}" +
      "#" + PANEL_ID + " .gcb-striptxt{flex:1 1 auto;min-width:0;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      "#" + PANEL_ID + " .gcb-stripgo{flex:0 0 auto;color:#8b98a5;font-size:16px;line-height:1}" +
      "#" + PANEL_ID + " .gcb-gtop{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:5px}" +
      "#" + PANEL_ID + " .gcb-gname{font:700 12.5px/1 -apple-system,sans-serif}" +
      "#" + PANEL_ID + " .gcb-gcur{font:400 11px/1 ui-monospace,Menlo,monospace;color:#8895a5}" +
      "#" + PANEL_ID + " .gcb-gin{width:100%;margin:0}" +
      "#" + PANEL_ID + " .gcb-gnote{margin-top:5px;font:400 10.5px/1.4 ui-monospace,Menlo,monospace;color:#8895a5}" +
      "#" + PANEL_ID + " .gcb-goal.now .gcb-gnote{color:#f2a03d}" +
      "#" + PANEL_ID + " .gcb-srcs{margin:10px 0 6px}" +
      "#" + PANEL_ID + " .gcb-src{display:flex;align-items:center;gap:9px;padding:7px 0;border-bottom:1px solid #262e39}" +
      "#" + PANEL_ID + " .gcb-src:last-child{border-bottom:0}" +
      "#" + PANEL_ID + " .gcb-nm{flex:1;min-width:0;font-size:13px}" +
      "#" + PANEL_ID + " .gcb-src.on .gcb-nm{color:#fff}" +
      "#" + PANEL_ID + " .gcb-nm i{display:block;font-style:normal;font-size:10.5px;color:#8895a5}" +
      "#" + PANEL_ID + " .gcb-chk{flex:0 0 auto;width:26px;height:26px;border-radius:7px;border:1.5px solid #3a4351;" +
      "background:#12161b;color:#12161b;font:800 14px/1 -apple-system,sans-serif;padding:0;" +
      "display:flex;align-items:center;justify-content:center}" +
      "#" + PANEL_ID + " .gcb-src.on .gcb-chk{background:#f2a03d;border-color:#f2a03d;color:#12161b}" +
      "#" + PANEL_ID + " .gcb-grp{margin:12px 0 2px;font:800 10px/1 ui-monospace,Menlo,monospace;" +
      "letter-spacing:.12em;text-transform:uppercase;color:#8895a5}" +
      "#" + PANEL_ID + " .gcb-step{display:inline-flex;align-items:center;gap:2px;flex:0 0 auto}" +
      "#" + PANEL_ID + " .gcb-step button{width:34px;height:34px;border-radius:9px;border:1px solid #262e39;" +
      "background:#1d242e;color:#e6e9ee;font:700 16px/1 -apple-system,sans-serif;padding:0}" +
      "#" + PANEL_ID + " .gcb-step button[disabled]{opacity:.35}" +
      "#" + PANEL_ID + " .gcb-step b{min-width:26px;text-align:center;font:700 14px/1 ui-monospace,Menlo,monospace}" +
      "#" + PANEL_ID + " .gc-ranges{display:flex;gap:6px;flex-wrap:wrap}" +
      "#" + PANEL_ID + " .gc-ranges button{flex:1 1 0;min-width:0;padding:6px 0;border-radius:8px;border:1px solid #2a3038;background:#1b2027;color:#c7cdd6;font-weight:700;font-size:12px}" +
      "#" + PANEL_ID + " .gc-ranges button.on{background:#2ecc71;border-color:#2ecc71;color:#0d1117}" +
      "#" + PANEL_ID + " .gc-dhead{font-size:10px;margin-top:6px}" +
      "#" + PANEL_ID + " .gc-dcards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:6px}" +
      "#" + PANEL_ID + " .gc-dcard{background:#1b2027;border-radius:8px;padding:6px 4px;text-align:center;min-width:0}" +
      "#" + PANEL_ID + " .gc-dcard span{display:block;font-size:10px;font-weight:800;letter-spacing:.04em}" +
      "#" + PANEL_ID + " .gc-dcard b{display:block;font-size:12px;overflow-wrap:anywhere}" +
      "#" + PANEL_ID + " .gc-dcard i{display:block;font-size:9px;font-style:normal;overflow-wrap:anywhere}" +
      "#" + PANEL_ID + " .gc-cap{margin-top:8px;line-height:1.45}" +

      /* ---- beta shell: verdict first, amber for "act now", green for "go" ---- */
      "#" + PANEL_ID + "{border-color:#2c3a2e;height:92vh;height:min(92dvh,calc(100dvh - 28px))}" +
      "#" + PANEL_ID + " .gcb-bar{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px;" +
      "padding:10px 13px;background:#161b22;border-bottom:1px solid #262e39}" +
      "#" + PANEL_ID + " .gcb-brand{display:flex;align-items:center;gap:9px;min-width:0}" +
      "#" + PANEL_ID + " .gcb-brand b{font:800 13px/1 -apple-system,sans-serif;letter-spacing:.05em}" +
      "#" + PANEL_ID + " .gcb-brand span{font:400 11px/1 ui-monospace,Menlo,monospace;color:#8895a5;white-space:nowrap;" +
      "overflow:hidden;text-overflow:ellipsis}" +
      "#" + PANEL_ID + " .gcb-dot{width:8px;height:8px;border-radius:50%;background:#3fbf7f;flex:0 0 auto;box-shadow:0 0 0 3px rgba(63,191,127,.16)}" +
      "#" + PANEL_ID + " .gcb-dot.off{background:#e5484d;box-shadow:0 0 0 3px rgba(229,72,77,.16)}" +
      "#" + PANEL_ID + " .gcb-icons{display:flex;gap:6px;flex:0 0 auto}" +
      "#" + PANEL_ID + " .gcb-icon{width:30px;height:30px;border-radius:8px;border:1px solid #262e39;background:#1d242e;" +
      "color:#8895a5;display:flex;align-items:center;justify-content:center;font-size:14px;padding:0;" +
      "-webkit-appearance:none;appearance:none;cursor:pointer;touch-action:manipulation}" +
      "#" + PANEL_ID + " .gcb-icon.on{background:#f2a03d;border-color:#f2a03d;color:#12161b}" +
      "#" + PANEL_ID + " .gcb-icon:active{transform:scale(.94)}" +

      "#" + PANEL_ID + " .gcb-verdict{flex:0 0 auto;padding:11px 13px 9px;" +
      "background:radial-gradient(120% 100% at 0% 0%,rgba(242,160,61,.10),transparent 60%)}" +
      "#" + PANEL_ID + " .gcb-verdict.go{background:radial-gradient(120% 100% at 0% 0%,rgba(63,191,127,.12),transparent 60%)}" +
      "#" + PANEL_ID + " .gcb-tag{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:999px;" +
      "font:800 10px/1.6 ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;" +
      "background:rgba(242,160,61,.14);color:#f2a03d;border:1px solid rgba(242,160,61,.3)}" +
      "#" + PANEL_ID + " .gcb-verdict.go .gcb-tag{background:rgba(63,191,127,.14);color:#3fbf7f;border-color:rgba(63,191,127,.3)}" +
      "#" + PANEL_ID + " .gcb-move{margin:7px 0 3px;font:800 19px/1.16 -apple-system,sans-serif;letter-spacing:-.01em}" +
      "#" + PANEL_ID + " .gcb-why{margin:0;color:#8895a5;font-size:12.5px;line-height:1.4}" +
      "#" + PANEL_ID + " .gcb-waste{margin-top:9px;padding:8px 10px;border-radius:9px;background:#241c14;color:#f2a03d;font-size:12.5px}" +

      "#" + PANEL_ID + " .gcb-meters{flex:0 0 auto;padding:0 13px 9px}" +
      "#" + PANEL_ID + " .gcb-mini{flex:0 0 auto;display:flex;align-items:center;gap:9px;width:auto;" +
      "margin:0 13px 9px;padding:8px 10px;border:1px solid #262e39;border-radius:11px;" +
      "background:radial-gradient(140% 100% at 0% 0%,rgba(242,160,61,.10),transparent 60%),#161b22;" +
      "color:#e6e9ee;text-align:left;-webkit-appearance:none;appearance:none;" +
      "touch-action:manipulation;cursor:pointer}" +
      "#" + PANEL_ID + " .gcb-mini.go{background:radial-gradient(140% 100% at 0% 0%,rgba(63,191,127,.12),transparent 60%),#161b22}" +
      "#" + PANEL_ID + " .gcb-mini .gcb-tag{flex:0 0 auto;padding:2px 7px;font-size:9px}" +
      "#" + PANEL_ID + " .gcb-miniline{flex:1;min-width:0;font:600 12.5px/1.3 -apple-system,sans-serif;" +
      "white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      "#" + PANEL_ID + " .gcb-minie{flex:0 0 auto;font:700 12px/1 ui-monospace,Menlo,monospace;color:#8895a5}" +
      "#" + PANEL_ID + " .gcb-mini:active{transform:scale(.99)}" +
      "#" + PANEL_ID + " .gcb-mtop{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:5px}" +
      "#" + PANEL_ID + " .gcb-mlab{font:800 10px/1 ui-monospace,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:#8895a5}" +
      "#" + PANEL_ID + " .gcb-mval{font:700 13px/1 ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums}" +
      "#" + PANEL_ID + " .gcb-track{position:relative;height:9px;border-radius:99px;background:#1d242e}" +
      "#" + PANEL_ID + " .gcb-fill{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:#5a9bd8}" +
      "#" + PANEL_ID + " .gcb-fill.full{background:#e5484d}" +
      "#" + PANEL_ID + " .gcb-over{position:absolute;top:0;bottom:0;background:#f2a03d;border-radius:0 99px 99px 0}" +
      "#" + PANEL_ID + " .gcb-capmark{position:absolute;top:-3px;bottom:-3px;width:2px;background:#e8edf2;opacity:.85;border-radius:2px}" +
      "#" + PANEL_ID + " .gcb-mval.over{color:#f2a03d}" +
      "#" + PANEL_ID + " .gcb-tick{position:absolute;top:-2px;bottom:-2px;width:1px;background:#0e1116;opacity:.85}" +
      "#" + PANEL_ID + " .gcb-note{display:block;margin-top:5px;font:400 10px/1.4 ui-monospace,Menlo,monospace;color:#8895a5}" +

      "#" + PANEL_ID + " .gcb-rail{position:relative;height:30px;border-radius:10px;background:#161b22;border:1px solid #262e39;overflow:hidden}" +
      "#" + PANEL_ID + " .gcb-band{position:absolute;top:5px;height:9px;border-radius:99px;opacity:.9}" +
      "#" + PANEL_ID + " .gcb-band.b2{top:16px}" +
      "#" + PANEL_ID + " .gcb-mark{position:absolute;top:0;bottom:0;width:2px;background:#e8edf2;opacity:.5}" +
      "#" + PANEL_ID + " .gcb-ticks{display:flex;justify-content:space-between;margin-top:6px;font:400 9.5px/1 ui-monospace,Menlo,monospace;color:#8895a5}" +
      "#" + PANEL_ID + " .gcb-key{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:6px;font:400 10px/1 ui-monospace,Menlo,monospace;color:#8895a5}" +
      "#" + PANEL_ID + " .gcb-key span{display:inline-flex;align-items:center;gap:5px}" +
      "#" + PANEL_ID + " .gcb-key i{width:9px;height:3px;border-radius:2px;display:inline-block}" +

      // grid-auto-flow rather than a hardcoded repeat(N): a fixed column count
      // wraps the whole bar onto two rows the moment a tab is added, which is
      // exactly what adding Board did.
      "#" + PANEL_ID + " .tabs{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:0;"+
      "margin:0 13px 9px;padding:3px;background:#1d242e;border:1px solid #262e39;"+
      "border-radius:11px;flex:0 0 auto;overflow:hidden}" +
      "#" + PANEL_ID + " .tabs button{width:100%;border:0;background:transparent;color:#8895a5;"+
      "border-radius:8px;min-height:38px;padding:0 1px;margin:0;font:800 11px/1 ui-monospace,Menlo,monospace;"+
      "letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      "#" + PANEL_ID + " .tabs button.on{background:#f2a03d;color:#12161b}" +
      "#" + PANEL_ID + " .gc-btn{background:#f2a03d;color:#12161b}" +
      "#" + PANEL_ID + " .gc-ranges button.on{background:#f2a03d;border-color:#f2a03d;color:#12161b}" +
      "#" + PANEL_ID + " .gcb-own{flex:0 0 auto;padding:6px 13px;background:#0e1116;border-bottom:1px solid #262e39;" +
      "font:400 10px/1.4 ui-monospace,Menlo,monospace;color:#5f6a78;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}"
    );
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = css();
    document.documentElement.appendChild(s);
  }

  function ago() {
    if (!state.lastFetch) return "not yet";
    var s = Math.round((Date.now() - state.lastFetch) / 1000);
    if (s < 5) return "just now";
    return s + "s ago";
  }

  function normalizeKey(raw) {
    return String(raw || "").replace(/[^a-zA-Z0-9]/g, "");
  }

  // Whether a pasted key may be saved. Owner's decision: Gym Coach requires a
  // Full key, because the gym training log is Full-only and without it two
  // devices cannot be reconciled.
  //
  // "unknown" ACCEPTS on purpose. Torn caps a key at 100 calls a minute and the
  // coach is already polling, so a check can fail for reasons that have nothing
  // to do with the key. Refusing then would turn a busy moment into a lockout
  // and leave someone unable to save a perfectly good key -- the same mistake
  // that made the probe report a rate limit as an access denial.
  function keySaveVerdict(d) {
    // Code 2 is Torn saying the key is not real. That is a definite answer, so
    // it does not get the benefit of the doubt that a failed check does.
    if (d && d.error && d.error.code === 2) return "invalid";
    var lvl = readKeyLevel(d);
    if (!lvl) return "unknown";
    return lvl.full ? "full" : "limited";
  }

  // How often the API is asked for bars/cooldowns/perks. It used to be eight
  // seconds on the gym page, which is 7.5 calls a minute of a 100-a-minute key
  // spent re-reading things that do not move that fast -- and it is what left
  // no headroom when anything else asked a question. The bar is read from the
  // page DOM once a second regardless, so nothing on screen got slower.
  var POLL_GYM_MS = 60000;
  // Off-gym was 20s, which made every other Torn page poll three times harder
  // than the gym itself. Same rate now.
  var POLL_OFF_MS = 60000;

  var KEYLEVEL_TTL = 3600000; // it only changes when you make a new key
  function fetchKeyLevel(force) {
    var key = resolveKey();
    if (!key) { state.keyLevel = null; return; }
    if (!force && Date.now() - (state.keyLevelAt || 0) < KEYLEVEL_TTL) return;
    state.keyLevelAt = Date.now();
    // /v2/key/info answers ANY key, Public included, so the check itself can
    // never be the thing that fails and mislabels a good key.
    httpGet("https://api.torn.com/v2/key/info?key=" + encodeURIComponent(key) +
            "&comment=" + encodeURIComponent(COMMENT))
      .then(function (d) { state.keyLevel = readKeyLevel(d); })
      .catch(function () { state.keyLevel = null; });
  }

  function trySaveKey(raw) {
    var k = normalizeKey(raw);
    if (k.length < 16) return false;
    k = k.slice(0, 16);
    // Checked BEFORE storing, so a refused key never becomes the saved one.
    httpGet("https://api.torn.com/v2/key/info?key=" + encodeURIComponent(k) +
            "&comment=" + encodeURIComponent(COMMENT))
      // httpGet REJECTS on an API error, carrying the code on the Error but not
      // the payload -- so rebuild the shape the verdict reads. Without this an
      // invalid key came back as null, scored "unknown", and was saved.
      .then(function (d) { return d; },
            function (e) { return e && e.code ? { error: { code: e.code, error: e.message } } : null; })
      .then(function (d) {
        var v = keySaveVerdict(d);
        if (v === "limited") {
          var lvl = readKeyLevel(d);
          showToast("That key is " + ((lvl && lvl.type) || "not Full") + " \u2014 not saved",
            "Gym Coach needs a Full key: the gym training log is Full-only. Make one at " +
            "Settings \u2192 API Keys on torn.com and paste that instead.", 7000);
          return;
        }
        if (v === "invalid") {
          showToast("Torn does not recognise that key", "Check it for a missing or extra character.", 5000);
          return;
        }
        commitKey(k);
        if (v === "unknown") {
          // Saved, but say so: the check did not run, so this is not a claim
          // that the key is Full.
          showToast("Key saved", "Could not verify its access level just now \u2014 the API was busy. " +
            "Settings will show it once the check goes through.", 4000);
        } else {
          showToast("Key saved", "Full access confirmed. Loading your data now.", 2600);
        }
      });
    return true;
  }

  function commitKey(k) {
    storeSet("api_key", k);
    state.keyLevel = null;
    fetchKeyLevel(true);
    draftKey = "";
    keyBoxFocused = false;
    try {
      var el = document.getElementById("gcKey");
      if (el) el.blur();
    } catch (_) {}
    refresh("boot");
    return true;
  }

  function keyBoxBusy() {
    try {
      if (keyBoxFocused) return true;
      var ae = document.activeElement;
      if (ae && ae.id === "gcKey") return true;
      // Any input inside the panel — the goal fields included.
      if (ae && ae.tagName === "INPUT" && ae.closest && ae.closest("#" + PANEL_ID)) return true;
    } catch (_) {}
    return false;
  }

  var lastRenderTab = null;

  // A throw anywhere in the draw used to leave the panel an empty box with no
  // explanation — the element exists and is styled, so it looks like the script
  // is fine and simply has nothing to say. Show the failure instead.
  function renderPanel() {
    try {
      renderPanelInner();
    } catch (err) {
      try {
        var panel = document.getElementById(PANEL_ID);
        if (!panel) return;
        panel.innerHTML =
          '<div class="gcb-bar"><div class="gcb-brand"><i class="gcb-dot off"></i>' +
          "<b>GYM COACH</b><span>error</span></div>" +
          '<div class="gcb-icons"><button class="gcb-icon" data-act="refresh" aria-label="Retry">\u21bb</button>' +
          '<button class="gcb-icon" data-act="close" aria-label="Tuck away">\u2013</button></div></div>' +
          '<div class="gcb-verdict"><span class="gcb-tag">Error</span>' +
          '<div class="gcb-move">The panel could not draw.</div>' +
          '<p class="gcb-why">' + esc(String((err && err.message) || err)) + "</p>" +
          '<div class="gcb-waste" style="white-space:pre-wrap;font:400 10px/1.4 ui-monospace,Menlo,monospace">' +
          esc(String((err && err.stack) || "").slice(0, 400)) + "</div></div>";
      } catch (_) {}
    }
  }

  function renderPanelInner() {
    syncEnergyFromDom();
    // The strip is on the same page the panel is drawn over, so this costs one
    // querySelectorAll per paint and needs no request at all.
    syncBookFromDom();
    var panel = document.getElementById(PANEL_ID);
    var pill = document.getElementById(PILL_ID);
    if (pill) pinFab(pill);
    if (!panel || !state.open) return;
    if (keyBoxBusy()) return;

    var bodyEl = panel.querySelector(".gc-body");
    var keepScroll = lastRenderTab === state.tab;
    var bodyY = keepScroll && bodyEl ? bodyEl.scrollTop : 0;
    var keyInp = panel.querySelector("#gcKey");
    var keyVal = keyInp ? keyInp.value : "";
    var keyFocus = !!(keyInp && document.activeElement === keyInp);
    var keyStart = keyInp ? keyInp.selectionStart : 0;
    var keyEnd = keyInp ? keyInp.selectionEnd : 0;
    lastRenderTab = state.tab;

    applyGoalFocus();
    var c = coach();
    var e = dailyEnergy();
    var g7 = projectDays(7, e.total, state.focus);
    var g30 = projectDays(30, e.total, state.focus);
    var g90 = projectDays(90, e.total, state.focus);
    var tot = state.stats.str + state.stats.def + state.stats.spe + state.stats.dex;
    var live = state.status === "live";
    // Not gated on war stack any more: stacking is exactly when you want to be
    // using them.
    var xanOk = state.drugCd <= 0 && state.items.xanax > 0;
    var cans = state.items.munster + state.items.redcow + state.items.tourine + state.items.cans;

    var coachHtml =
      (state.flash ? '<div class="flash">' + state.flash + "</div>" : "") +
      '<div class="gc-card">' + railHtml() + "</div>" +
      wasteCard() +
      (c.steps && c.steps.length
        ? '<div class="gc-card"><h3>Do this</h3>' + stepsHtml(c.steps) + "</div>"
        : "") +
      '<div class="gc-card"><h3>Live</h3><div class="grid three">' +
      '<div class="stat"><label>Energy' +
      (state.energyDom ? ' <span style="opacity:.6;font-weight:400">live</span>' : ' <span style="opacity:.6;font-weight:400">api</span>') +
      '</label><b class="' + (barFull() ? "bad" : "ok") + '">' + state.energy + " / " + state.energyMax + "</b></div>" +
      '<div class="stat"><label>Happy</label><b>' + fmt(state.happy) + "</b></div>" +
      '<div class="stat"><label>Drug cooldown</label><b class="' + (state.drugCd ? "muted" : "ok") + '">' + fmtCd(state.drugCd) + "</b></div>" +
      '<div class="stat"><label>Booster</label><b>' + fmtCd(state.boosterCd) + "</b></div>" +
      '<div class="stat"><label>Gym</label><b>' + (state.gymName || "—") + "</b></div>" +
      '<div class="stat"><label>Focus</label><b>' + focusLabel() + "</b></div></div></div>" +
      '<div class="gc-card"><h3>Gym perks</h3><div class="grid">' +
      '<div class="stat"><label>Str</label><b class="ok">' + perkPct(state.perks.str) + "</b></div>" +
      '<div class="stat"><label>Def</label><b class="ok">' + perkPct(state.perks.def) + "</b></div>" +
      '<div class="stat"><label>Spe</label><b class="ok">' + perkPct(state.perks.spe) + "</b></div>" +
      '<div class="stat"><label>Dex</label><b class="' + ((state.perks.dex || 1) < 1 ? "bad" : "ok") + '">' + perkPct(state.perks.dex) + "</b></div></div>" +
      '<p class="muted" style="margin:8px 0 0">' +
      ([
        perkSourceLine("faction", "Faction"),
        perkSourceLine("company", "Company"),
        perkSourceLine("job", "Job"),
        perkSourceLine("education", "Education"),
        perkSourceLine("property", "Property"),
        perkSourceLine("merit", "Merit"),
        perkSourceLine("book", "Book"),
        perkSourceLine("stock", "Stock"),
        perkSourceLine("enhancer", "Enhancer"),
        state.adultNov ? "Adult Novelties: e-dvds give +5,000 happy instead of +2,500" : "",
        state.canMult > 1 ? "Energy drinks: +" + Math.round((state.canMult - 1) * 100) + "% from books and perks" : "",
        caffeineOn() ? "Caffeine Consumption: energy drinks doubled" : "",
      ]
        .filter(Boolean)
        .join("<br>") || "No gym perks found in what Torn sent.") +
      "</p></div>" +
      '<div class="gc-card toggle"><div><h3 style="margin:0">War stack</h3><div class="muted">Hold energy. Mute training and Xanax pings.</div></div>' +
      '<div class="sw' + (state.warStack ? " on" : "") + '" id="stackSw"><i></i></div></div>';

    var boostOk = boosterOpen(state.boosterCd);
    var jumpGo = state.mode === "jump" && nextTickSec() <= 90;
    var invD = state.invDiag;
    // Only speak up when the counts cannot be trusted; a healthy tab is silent.
    var invNote = invD && !invD.present && state.invUnavailable
      ? "Counts may be behind: " + String(state.invUnavailable).slice(0, 90)
      : "";
    var itemsHtml =
      '<div class="gc-card"><h3>Inventory · live</h3>' +
      (invNote ? '<div class="muted" style="margin:-4px 0 8px">' + invNote + "</div>" : "") +
      [
        { key: "xanax", n: "Xanax", v: state.items.xanax, rec: xanOk ? "USE" : state.drugCd ? "WAIT " + fmtCd(state.drugCd) : "BUY", cls: xanOk ? "ok" : "warn" },
        { key: "fhc", n: "FHC", v: state.items.fhc, rec: "DON\u2019T", cls: "bad" },
        { key: "nandrolone", n: "Nandrolone", v: state.items.nandrolone, rec: "OPTIONAL", cls: "warn" },
        state.mode !== "jump" ? null : { key: "edvd", n: "Erotic DVDs", v: state.items.edvd, rec: state.mode !== "jump" ? "OFF" : !state.items.edvd ? "NEED" : jumpGo && boostOk ? "USE" : "HOLD", cls: state.mode === "jump" ? "ok" : "muted" },
        state.mode !== "jump" ? null : { key: "candy", n: "Happy candy (all types)", v: state.items.candy, rec: state.mode !== "jump" ? "OFF" : !state.items.candy ? "NEED" : jumpGo && boostOk ? "USE" : "HOLD", cls: state.mode === "jump" ? "ok" : "muted" },
        state.mode !== "jump" ? null : { key: "ecstasy", n: "Ecstasy", v: state.items.ecstasy, rec: state.mode !== "jump" ? "OFF" : jumpGo && state.drugCd <= 0 ? "USE" : "LAST", cls: state.mode === "jump" ? "warn" : "muted" },
        { key: "lsd", n: "LSD", v: state.items.lsd, rec: "SKIP", cls: "muted" },
        { key: "vicodin", n: "Vicodin", v: state.items.vicodin, rec: "SKIP", cls: "muted" },
      ]
        .filter(Boolean)
        .map(function (r) {
          return '<div class="row"><div><b>' + r.n + " \u00d7" + (r.v || 0) + '</b><div class="muted">' +
            itemFxShort(r.key) + "</div></div>" + itemChip(r) + "</div>";
        })
        .join("") +
      "</div>" +
      // Its own section: the drinks are a shortlist you pick from, not one line
      // in a list of unrelated items.
      (function () {
        var list = state.drinkList || [];
        // Total the rows actually shown. Taking it from the API count instead
        // meant the header said 21 while the only row under it said 18.
        var total = list.length
          ? list.reduce(function (a, d) { return a + (d.qty || 0); }, 0)
          : cans;
        var head = '<div class="gc-card"><h3>Energy drinks \u00d7' + fmt(total) + "</h3>";
        var foot = '<p class="muted" style="margin:8px 0 0">' +
          (caffeineOn() ? "Caffeine Consumption is on \u2014 every can is doubled. " : "") +
          (state.canMult > 1 ? "Values include your +" + Math.round((state.canMult - 1) * 100) + "% drink bonus. " : "") +
          'Each adds 2h to the booster cooldown. Keep using while that bar is under ' +
          (boosterCap() / 3600) + "h" + (state.boosterPerk ? " (faction perk)" : "") +
          " \u2014 it is at " + fmtCd(state.boosterCd) + ".</p></div>";
        if (!total) return head + '<p class="muted" style="margin:0">None in your inventory.</p></div>';
        if (!list.length) {
          return head + '<div class="row"><div><b>' + fmt(cans) + ' in stock</b><div class="muted">' +
            itemFxShort("cans") + "</div></div>" + itemChip({ key: "cans", rec: boostOk ? "USE" : "HOLD", cls: boostOk ? "ok" : "muted" }) + "</div>" + foot;
        }
        return head + list.map(function (d) {
          return '<div class="row"><div><b>' + esc(d.name) + " \u00d7" + fmt(d.qty) + "</b>" +
            '<div class="muted">' + (d.e ? "+" + d.e + "e \u00b7 +2h booster" : "+2h booster") + "</div></div>" +
            (d.id && boostOk
              ? '<button type="button" class="chip use" data-use-id="' + d.id + '">USE</button>'
              : '<span class="chip' + (boostOk ? "" : " wait") + '">' + (boostOk ? "\u2014" : "HOLD") + "</span>") +
            "</div>";
        }).join("") + foot;
      })() +
      (state.mode === "jump" && (state.happyList || []).length
        ? '<div class="gc-card"><h3>Happy items on hand</h3>' +
          state.happyList
            .map(function (h) {
              return (
                '<div class="row"><div><b>' +
                esc(h.name) +
                " ×" +
                h.qty +
                '</b><div class="muted">' +
                happyFxText(h) +
                "</div></div>" +
                happyItemChip(h) +
                "</div>"
              );
            })
            .join("") +
          '<p class="muted" style="margin:8px 0 0">Jump uses every Candy-type item Torn lists, plus e-dvds. Ecstasy last. USE takes one.</p></div>'
        : "");

    var trackHtml =
      '<div class="gc-card"><h3>Battle stats · live</h3>' +
      '<div class="row"><span>Strength</span><b>' + fmt(state.stats.str) + "</b></div>" +
      '<div class="row"><span>Defense</span><b>' + fmt(state.stats.def) + "</b></div>" +
      '<div class="row"><span>Speed</span><b>' + fmt(state.stats.spe) + "</b></div>" +
      '<div class="row"><span>Dexterity</span><b>' + fmt(state.stats.dex) + "</b></div>" +
      '<div class="row"><span>Total</span><b class="ok">' + fmt(tot) + "</b></div></div>" +
      '<div class="gc-card"><h3>Train log</h3>' +
      (state.log.length
        ? state.log
            .slice(0, 24)
            .map(function (l) {
              return '<div class="row"><div><b>' + l.text + '</b><div class="muted">' + l.t + "</div></div></div>";
            })
            .join("")
        : '<div class="muted">Train in the gym. Every session is stored on this phone.</div>') +
      "</div>";

    var maxP = g90 || 1;
    var projHtml =
      '<div class="gc-card"><h3>Projected ' +
      focusLabel() +
      " · " +
      (state.mode === "jump" ? "jump" : "xan + gym") +
      "</h3>" +
      '<div class="muted" style="margin-bottom:8px">' +
      state.gymName +
      " · perks " +
      perkPct(state.perks[state.focus] || 1) +
      " on " +
      focusLabel() +
      (Object.keys(state.perkHits || {}).length ? " · perks applied" : "") +
      "</div>" +
      '<div class="proj"><span>7d</span><div class="bar"><i style="width:' + Math.min(100, (g7 / maxP) * 100) + '%"></i></div><b>+' + fmt(g7) + "</b></div>" +
      '<div class="proj"><span>30d</span><div class="bar"><i style="width:' + Math.min(100, (g30 / maxP) * 100) + '%"></i></div><b>+' + fmt(g30) + "</b></div>" +
      '<div class="proj"><span>90d</span><div class="bar"><i style="width:100%"></i></div><b>+' + fmt(g90) + "</b></div>" +
      '<div class="muted" style="margin-top:8px">Now ' + fmt(tot) + "</div></div>";

    var progRange = state.histRange || 30;
    // Only built for the visible tab. histChart -> histProjection runs the gain
    // model thousands of times, renderPanel fires on the poll timer, and paying
    // that on every tab is what made scrolling stutter.
    var chart = state.tab === "trend" ? histChart(progRange) : { svg: "", empty: true, legend: "" };
    var progHtml = state.tab !== "trend" ? "" :
      '<div class="gc-card"><h3>Progression</h3>' +
      '<div class="gc-ranges">' +
      [1, 7, 30, 90, 365].map(function (r) {
        return '<button data-hrange="' + r + '" class="' + (progRange === r ? "on" : "") + '">' + r + "d</button>";
      }).join("") +
      "</div>" +
      chart.svg +
      (chart.legend || "") +
      '<div class="muted gc-dhead">Recorded change over the last ' + progRange + 'd</div>' +
      '<div class="gc-dcards">' + histDeltaCards(progRange) + "</div>" +
      '<div class="muted gc-cap">' +
      (chart.empty
        ? "Solid lines start once there are two days of history. Training is recorded from now on \u2014 the dashed half already works."
        : "Solid = " + chart.points + " day" + (chart.points === 1 ? "" : "s") + " recorded. Dashed = " + focusLabel() + " at " + fmt(dailyEnergy().total) + "e/day. The others stay flat because you are not training them.") +
      " All four share one axis anchored at zero, so heights are comparable \u2014 a stat far below the others really is that small." +
      "</div></div>" +
      (function () {
        if (state.tab !== "trend") return "";
        var w = wasteChart(progRange);
        if (w.empty) {
          return '<div class="gc-card"><h3>Energy used vs missed</h3><p class="muted">Nothing logged yet. This fills in as the script watches your bar \u2014 a day is enough to see the shape.</p></div>';
        }
        return '<div class="gc-card"><h3>Energy used vs missed</h3>' + w.svg + w.legend +
          '<div class="muted gc-cap">Last ' + w.days + ' days. Blue is energy you spent; red is regen your bar dropped while already full. Counted from when the script last saw your bar, so time with Torn closed still counts.</div></div>';
      })();

    // The cog used to hold both halves of this, which is why nobody found the
    // half that matters. Goals, sources and playstyle are what you DECIDE and
    // they move every projection in the script; a key and a perk dump are what
    // you configure once. Only the second half stays behind an icon.
    var planHtml =
      booksHtml() +
      sharesHtml() +
      goalsHtml() +
      steadfastHtml() +
      srcHtml() +
      '<div class="gc-card"><h3>Playstyle</h3><div class="pick">' +
      pickBtn("mode", "xan", "Xan + gym", state.mode !== "jump") +
      pickBtn("mode", "jump", "Happy jump", state.mode === "jump") +
      '</div><p class="muted" style="margin:8px 0 0">Xan + gym is your default. Happy jump uses every Candy-type item in inventory — chocolates, lollipops, bags of sweets, cupcakes, eggs, and the rest — plus e-dvds on the :00/:15/:30/:45 tick, ecstasy last.</p></div>' +
      (hasGoals() ? "" : pickerCards()) +
      "";

    var setHtml =
      '<div class="gc-card"><h3>API</h3>' +
      // A key you paste now WINS over PDA's injected one, so this box is worth
      // offering even on PDA -- it used to be the one place a Full key could
      // not reach.
      '<p class="muted">A <b>Full</b> key is recommended: the gym training log is Full-only, ' +
        "and without it \u201cSpent today\u201d falls back to the bar and missed energy for " +
        "time the script was closed reads \u201cobserved only\u201d. Everything else \u2014 " +
        "attacks, refills, cans, plans, notifications \u2014 works on a Limited key.</p>" +
      (HAS_PDA_KEY
        ? '<p class="ok">Torn PDA injected its key. Paste your own below to override it \u2014 PDA\u2019s is usually Limited.</p>'
        : "") +
          '<input class="gc-in" id="gcKey" type="text" inputmode="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Full API key" value="' +
          esc(draftKey) +
          '">' +
          '<div class="actions"><button class="gc-btn secondary" data-act="pastekey">Paste from clipboard</button><button class="gc-btn" data-act="savekey">Save key</button></div>' +
      // Torn's own word on the key in use, so a wrong one shows up here rather
      // than being inferred from a figure looking odd three tabs away.
      (state.keyLevel
        ? '<div class="row"><span>Key access</span><b class="' + (state.keyLevel.full ? "ok" : "bad") + '">' +
          esc(state.keyLevel.type || ("level " + state.keyLevel.level)) +
          (state.keyLevel.full ? "" : " \u00b7 gym log unavailable") + "</b></div>"
        : "") +
      '<p class="muted" style="margin:8px 0 0">Beta lane. It reads the stable script\u2019s saved key but never writes to its settings. Run one at a time \u2014 both open means both polling, and the key is capped at 100 calls a minute.</p>' +
      '<div class="row"><span>Host</span><b>' +
        (isPda() ? "Torn PDA" : nativeHost() || "Browser") + "</b></div>" +
      '<div class="row"><span>Source</span><b>' + keySource() + "</b></div>" +
      '<div class="row"><span>Status</span><b class="' + (live ? "ok" : "bad") + '">' + state.statusText + "</b></div>" +
      '<p class="muted" style="margin:8px 0 0">' + (canPing()
        ? "Pings are scheduled on the device and open the gym when they fire."
        : "Pings need Torn PDA or the warboard app \u2014 they go through a native notification bridge, which a browser does not have, so none will arrive here however long you wait.") +
      "</p>" +
      "</div>" +
      ledgerEditHtml() +
      rawPerksHtml() +
      '<p class="muted" style="margin:8px 12px 0">Goals, energy sources and playstyle moved to the Plan tab.</p>';

    var tab = state.tab;
    // The verdict is one line at the top and never a tab, so the question the
    // panel exists to answer is readable before anything is tapped.
    var TAG = { go: "Do it now", wait: "Hold", stack: "War stack" };
    panel.innerHTML =
      ownerBannerHtml() +
      '<div class="gcb-bar"><div class="gcb-brand"><i class="gcb-dot' + (live ? "" : " off") + '"></i>' +
      "<b>GYM COACH</b><span>" +
      (live ? 'beta · <span class="gc-ago">' + ago() + "</span>" : esc(state.statusText)) +
      "</span></div>" +
      '<div class="gcb-icons">' +
      '<button class="gcb-icon" data-act="refresh" aria-label="Refresh now">↻</button>' +
      '<button class="gcb-icon' + (tab === "set" ? " on" : "") + '" data-tab="set" aria-label="Settings">⚙</button>' +
      '<button class="gcb-icon" data-act="close" aria-label="Tuck away">–</button>' +
      "</div></div>" +
      // The verdict and the energy meter are what the Now tab is FOR, but on
      // Stock and Trend they are six lines of chrome above the thing you opened
      // the tab to look at. Off Now they collapse to one tappable line that
      // still carries the verdict and your energy, and takes you back.
      // On Now the verdict can be folded to the SAME one-line form the other
      // tabs already use, so the tabs and the cards start higher up the screen
      // without losing the answer. Asked for; kept off by default, because a
      // stored preference is one thing and silently reshaping every existing
      // user's panel is another.
      (tab === "now" && !state.verdictFold
        ? '<div class="gcb-verdict' + (c.kind === "go" ? " go" : "") + '">' +
          '<button type="button" class="gcb-tag" data-act="verdict" ' +
            'aria-label="Minimise the verdict" style="border:0;cursor:pointer">' +
            (TAG[c.kind] || "Next") + " \u25b4</button>" +
          '<div class="gcb-move">' + c.move + "</div>" +
          '<p class="gcb-why">' + c.why + "</p>" +
          (c.waste ? '<div class="gcb-waste">' + c.waste + "</div>" : "") +
          "</div>" +
          '<div class="gcb-meters">' + energyMeterHtml() + "</div>" +
          planStripHtml()
        : tab === "now"
        // Folded, on Now: the same compact bar, but it expands rather than
        // navigating -- you are already on the tab it would take you to.
        ? '<button type="button" class="gcb-mini' + (c.kind === "go" ? " go" : "") + '" data-act="verdict">' +
          '<span class="gcb-tag">' + (TAG[c.kind] || "Next") + " \u25be</span>" +
          '<span class="gcb-miniline">' + c.move + "</span>" +
          '<span class="gcb-minie">' + Math.max(0, state.energy || 0) + " / " + (state.energyMax || 150) + "</span>" +
          "</button>"
        : '<button type="button" class="gcb-mini' + (c.kind === "go" ? " go" : "") + '" data-tab="now">' +
          '<span class="gcb-tag">' + (TAG[c.kind] || "Next") + "</span>" +
          '<span class="gcb-miniline">' + c.move + "</span>" +
          '<span class="gcb-minie">' + Math.max(0, state.energy || 0) + " / " + (state.energyMax || 150) + "</span>" +
          "</button>") +
      '<div class="tabs">' +
      ["now", "plan", "stock", "trend", "board"]
        .map(function (id) {
          var labels = { now: "Now", plan: "Plan", stock: "Stock", trend: "Trend", board: "Board" };
          return '<button data-tab="' + id + '" class="' + (tab === id ? "on" : "") + '">' + labels[id] + "</button>";
        })
        .join("") +
      "</div>" +
      '<div class="gc-body">' +
      (tab === "set" ? setHtml : tab === "plan" ? planHtml : tab === "stock" ? itemsHtml : tab === "board" ? boardHtml() : tab === "trend" ? unlockHtml() + progHtml + projHtml + trackHtml : coachHtml) +
      "</div>" +
      (state.toast && state.toast.until > Date.now()
        ? '<div class="gc-toast show"><b>' + state.toast.title + "</b><span>" + state.toast.body + "</span></div>"
        : '<div class="gc-toast"></div>');
    restorePanelView(panel, keepScroll, bodyY, keyVal, keyFocus, keyStart, keyEnd);
  }

  function restorePanelView(panel, keepScroll, bodyY, keyVal, keyFocus, keyStart, keyEnd) {
    if (!panel) return;
    if (keepScroll) {
      var body2 = panel.querySelector(".gc-body");
      if (body2) body2.scrollTop = bodyY;
    }
    var key2 = panel.querySelector("#gcKey");
    if (key2) {
      key2.value = keyVal || draftKey || "";
      if (keyFocus) {
        key2.focus();
        try {
          key2.setSelectionRange(keyStart, keyEnd);
        } catch (_) {}
      }
    }
  }

  function setOpen(v) {
    state.open = v;
    var panel = document.getElementById(PANEL_ID);
    var pill = document.getElementById(PILL_ID);
    if (panel) panel.classList.toggle("open", v);
    if (pill) pinFab(pill);
    if (v) {
      // Both scripts pin their panel at 2147483647 — the maximum — so the beta
      // cannot outrank the stable one by z-index, and DOM order is what decides
      // which is visible. Re-appending on open puts the panel you just asked
      // for in front of the other script's.
      try {
        var host = pageHost();
        if (panel && host && panel.parentNode === host && host.lastElementChild !== panel) host.appendChild(panel);
      } catch (_) {}
      renderPanel();
      refresh("open");
      refreshPrices();
    }
  }

  function pageHost() {
    return document.body || document.documentElement;
  }

  function paintPill(pill) {
    pinFab(pill);
  }

  function onGymPage() {
    return /gym\.php/i.test(location.href);
  }

  var REFILL_STRIP_ID = "gcb-refill-strip";

  // The same sentence DO THIS carries, put where you are actually standing.
  //
  // The panel says it too, but the panel is tucked behind a pill, and the
  // moment that matters is arriving at gym.php on an empty bar with the day's
  // refill still unspent -- which is exactly when you are looking at the gym
  // and not at the coach.
  //
  // Inline rather than floating, anchored above the stat tiles. Torn renames
  // its generated classes, so losing the anchor costs the strip its POSITION,
  // never its existence: it falls back to the same fixed spot the full-bar
  // banner uses.
  function renderRefillStrip() {
    if (!onGymPage()) {
      var off = document.getElementById(REFILL_STRIP_ID);
      if (off && off.parentNode) off.parentNode.removeChild(off);
      return;
    }
    var step = refillStep();
    var el = document.getElementById(REFILL_STRIP_ID);
    if (!step) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      return;
    }
    if (!document.body) return;
    // h4#skip-to-content is the page title ("Gym"). That id is unhashed and
    // stable where every generated class around it is not, so the anchor is
    // the heading rather than its container. The title row is float-based
    // rather than flex, so float:left is what keeps the strip on that line
    // instead of dropping it underneath.
    var head = document.querySelector("h4#skip-to-content");
    if (!el) {
      // An anchor, not a div: the useful thing to do about an unused refill is
      // go and spend it, and points.php is where that lives. A link the user
      // taps is fine where a programmatic click would not be.
      el = document.createElement("a");
      el.id = REFILL_STRIP_ID;
      el.href = "https://www.torn.com/points.php";
      el.title = "Open the Points page to use your energy refill";
      if (head) head.insertAdjacentElement("afterend", el);
      else document.body.appendChild(el);
    } else if (head && el.previousElementSibling !== head) {
      // React repaints the gym page and can move or drop what it finds there;
      // the id lookup above is what keeps that from becoming a second strip
      // rather than a moved one.
      head.insertAdjacentElement("afterend", el);
    }
    var inline = !!head;
    // The coach's own button, shrunk to share a line with the page title:
    // same green, same weight, same corner as .gc-btn, minus the 44px height
    // that makes sense for a thumb target and not for a heading row.
    el.style.cssText =
      (inline ? "float:left;margin:1px 0 0 12px;" :
        "position:fixed;top:52px;left:50%;transform:translateX(-50%);z-index:2147483645;max-width:94vw;") +
      "display:inline-flex;align-items:center;gap:6px;" +
      "background:#2ecc71;color:#fff;border-radius:10px;border:0;" +
      "font:800 12px/1 Arial,sans-serif;padding:7px 12px;" +
      "text-decoration:none;white-space:nowrap;cursor:pointer;" +
      "-webkit-tap-highlight-color:transparent;";
    // Short, because it is sharing a line with the page title.
    el.innerHTML =
      '<span style="flex:none">\u26a1</span><span>Refill available \u00b7 ' +
      fmt(state.energy) + "/" + fmt(state.energyMax) + "</span>";
  }

  var NAG_ID = "gcb-fullbar-nag";

  // The banner lives OUTSIDE ensureUi's gym-page gate on purpose. That gate
  // exists because a gym coach's panel has no business floating over the item
  // market -- but this is the one thing that does, because being somewhere
  // else is precisely the mistake it is catching.
  function renderNag() {
    var st = capStreak();
    var live = fullBarNag(Date.now(), st ? st.sec : null, state.fullAckAt,
                          state.warStack, state.energy, state.energyMax);
    var el = document.getElementById(NAG_ID);
    if (!live) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      return;
    }
    if (!document.body) return;
    if (!el) {
      el = document.createElement("div");
      el.id = NAG_ID;
      // FactionOps parks its own fixed bar at the top centre (10px, or 52px
      // when its chain bar is up) at z-index 1000001. Two scripts that both
      // claim that spot look like one broken one, so drop below whatever it
      // has mounted rather than stacking on top of it.
      var fo = document.getElementById("fo-call-toast-container") ||
               document.querySelector('[id^="fo-chain"]');
      el.style.cssText =
        "position:fixed;top:" + (fo ? "96px" : "10px") + ";left:50%;" +
        "transform:translateX(-50%);z-index:2147483646;" +
        "display:flex;align-items:center;gap:10px;" +
        "background:#b3261e;color:#fff;font:600 12px/1.3 Arial,sans-serif;" +
        "padding:7px 8px 7px 13px;border-radius:7px;white-space:nowrap;" +
        "box-shadow:0 3px 12px rgba(0,0,0,.4);max-width:94vw;";
      document.body.appendChild(el);
    }
    var mins = live.minutes;
    // One line, sized like a toast rather than a dialog. The first cut was a
    // three-row block that sat on top of Torn's nav and news ticker -- loud
    // enough, but it buried the page it was trying to send you back to. The
    // gym name is dropped for width; the panel already carries it, and this
    // only has to be noticed, not read twice.
    el.innerHTML =
      '<span style="overflow:hidden;text-overflow:ellipsis">Bar full ' + mins + "m" +
      '<span style="opacity:.75;font-weight:400"> \u00b7 ' + fmt(state.energy) + "/" +
      fmt(state.energyMax) + " \u00b7 train " + focusLabel() + "</span></span>" +
      '<button type="button" id="' + NAG_ID + '-ok" style="flex:none;' +
      "background:rgba(255,255,255,.92);color:#b3261e;border:0;border-radius:5px;" +
      'padding:4px 10px;font:700 11px/1 Arial,sans-serif;cursor:pointer">Got it</button>';
    var btn = document.getElementById(NAG_ID + "-ok");
    if (btn && !btn.__gcbBound) {
      btn.__gcbBound = 1;
      btn.addEventListener("click", function () {
        // A snooze, not a dismissal. The clock keeps running and the banner
        // returns in another ten minutes -- only training clears it for good.
        state.fullAckAt = Date.now();
        storeSet("fullack", state.fullAckAt);
        renderNag();
      });
    }
  }

  function ensureUi() {
    // The badge used to mount on every page: @match is torn.com/*, and
    // mountFabNow never looked at the URL. It is a gym coach, so it belongs on
    // the gym page only. The gate lives HERE rather than in mountFabNow
    // because a MutationObserver re-calls ensureUi on every DOM change while
    // the pill is absent — off-gym that is most of the time — so this path has
    // to be cheap, and it has to return true or the boot retry loop spins 80
    // times over.
    if (!onGymPage()) {
      var stray = document.getElementById(PILL_ID);
      if (stray && stray.parentNode) stray.parentNode.removeChild(stray);
      // A fixed-position panel left open would float over every other page for
      // the same reason, so close it too. state.open is cleared with it, so
      // returning to the gym starts tucked rather than half-open.
      var strayPanel = document.getElementById(PANEL_ID);
      if (strayPanel && strayPanel.classList.contains("open")) {
        state.open = false;
        strayPanel.classList.remove("open");
      }
      return true;
    }
    var host = pageHost();
    if (!host) return false;
    ensureStyles();
    mountFabNow();
    if (!document.getElementById(PANEL_ID)) {
      var panel = document.createElement("aside");
      panel.id = PANEL_ID;
      host.appendChild(panel);
      applySavedPos(panel, "panel_x", "panel_y");
      bindDrag(panel, {
        xKey: "panel_x",
        yKey: "panel_y",
        handle: function (t) {
          if (!t || !t.closest) return false;
          if (t.closest(".gc-tuck,button,input,.tabs,.gc-body,.gc-foot,.sw,.chip,.gc-btn")) return false;
          return !!t.closest(".gc-head,.gc-owner");
        },
      });
      panel.addEventListener("click", onPanelClick);
      panel.addEventListener("change", onGoalChange);
      bindKeyFieldGuards(panel);
      bindKeyInputPasteShield();
    }
    dockInGym();
    return true;
  }

  function dockInGym() {
    var root = document.getElementById("gymroot");
    if (!root) return;
    var b = document.getElementById("gcb-gym-dock");
    if (b && b.parentNode === root) return;
    if (!b) {
      b = document.createElement("button");
      b.id = "gcb-gym-dock";
      b.type = "button";
      b.textContent = "GYM COACH · BETA";
      b.setAttribute(
        "style",
        "display:block;width:100%;box-sizing:border-box;margin:8px 0;min-height:48px;border:2px solid #f2a03d;border-radius:10px;background:#121418;color:#f2a03d;font:800 16px/1 -apple-system,sans-serif;letter-spacing:.08em;-webkit-appearance:none;appearance:none;touch-action:manipulation;"
      );
      var lastDockTouch = 0;
      function openDock(e) {
        var now = Date.now();
        if (e && e.type === "touchend") {
          lastDockTouch = now;
          if (e.preventDefault) e.preventDefault();
        } else if (now - lastDockTouch < 700) {
          return;
        }
        setOpen(true);
      }
      b.addEventListener("click", openDock);
      b.addEventListener("touchend", openDock, { passive: false });
    }
    root.appendChild(b);
  }

  // The panel is sized in dvh, which SHRINKS when iOS opens the keyboard — so
  // typing a key collapsed the box to 80% of the sliver above it and cut the
  // text off. While the field is focused, take the whole available strip
  // instead of 80% of it, and keep the input in view.
  function fitPanelToKeyboard(on) {
    var panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    if (!on) {
      panel.style.height = "";
      panel.style.maxHeight = "";
      return;
    }
    var vv = window.visualViewport;
    var h = vv && vv.height ? vv.height : window.innerHeight;
    var target = Math.max(240, Math.round(h - 16));
    panel.style.height = target + "px";
    panel.style.maxHeight = target + "px";
    try {
      var inp = document.getElementById("gcKey");
      if (inp && inp.scrollIntoView) inp.scrollIntoView({ block: "center" });
    } catch (_) {}
  }

  function bindKeyFieldGuards(panel) {
    if (!panel || panel._gcKeyGuards) return;
    panel._gcKeyGuards = true;
    function isKey(el) {
      return el && el.id === "gcKey";
    }
    try {
      if (window.visualViewport && !window._gcVV) {
        window._gcVV = true;
        // The keyboard animates in, so the first measurement is wrong; react to
        // the viewport settling rather than guessing a delay.
        window.visualViewport.addEventListener("resize", function () {
          if (keyBoxFocused) fitPanelToKeyboard(true);
        });
      }
    } catch (_) {}
    panel.addEventListener(
      "focusin",
      function (e) {
        if (isKey(e.target)) {
          keyBoxFocused = true;
          fitPanelToKeyboard(true);
          setTimeout(function () {
            if (keyBoxFocused) fitPanelToKeyboard(true);
          }, 300);
        }
      },
      true
    );
    panel.addEventListener(
      "focusout",
      function (e) {
        if (!isKey(e.target)) return;
        draftKey = String(e.target.value || "");
        keyBoxFocused = false;
        fitPanelToKeyboard(false);
      },
      true
    );
    panel.addEventListener(
      "input",
      function (e) {
        if (!isKey(e.target)) return;
        draftKey = String(e.target.value || "");
        trySaveKey(draftKey);
      },
      true
    );
    panel.addEventListener(
      "paste",
      function (e) {
        if (!isKey(e.target)) return;
        setTimeout(function () {
          var el = document.getElementById("gcKey");
          if (!el) return;
          draftKey = String(el.value || "");
          trySaveKey(draftKey);
        }, 0);
      },
      true
    );
    panel.addEventListener(
      "keydown",
      function (e) {
        if (!isKey(e.target)) return;
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          trySaveKey(e.target.value);
        }
      },
      true
    );
    panel.addEventListener(
      "pointerdown",
      function (e) {
        if (isKey(e.target)) e.stopPropagation();
      },
      true
    );
  }

  function bindKeyInputPasteShield() {
    if (window.__GC_PASTE_SHIELD__) return;
    window.__GC_PASTE_SHIELD__ = true;
    function allowInsideCoachField(e) {
      var t = e.target;
      if (!t) return;
      var id = t.id || "";
      var inCoach =
        id === "gcKey" ||
        (t.classList && t.classList.contains("gc-in") && t.closest && t.closest("#" + PANEL_ID));
      if (!inCoach) return;
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
    }
    ["paste", "copy", "cut"].forEach(function (type) {
      document.addEventListener(type, allowInsideCoachField, true);
    });
  }

  function applyApiKeyText(text, opts) {
    opts = opts || {};
    var inp = document.getElementById("gcKey");
    var k = String(text || "")
      .replace(/^\s+|\s+$/g, "")
      .replace(/^["']|["']$/g, "");
    if (!k) {
      showToast("Clipboard empty", "Copy your Limited API key, then try again.");
      return false;
    }
    if (inp) inp.value = k;
    draftKey = k;
    if (trySaveKey(k)) {
      showToast(opts.savedTitle || "Key saved", opts.savedBody || "Refreshing…");
      return true;
    }
    showToast("Key too short", "Pasted text doesn\u2019t look like a full API key.");
    return false;
  }

  function pasteKeyFromClipboard() {
    function fail(msg) {
      showToast("Clipboard blocked", msg || "Allow clipboard access, or type the key.");
    }
    try {
      if (navigator.clipboard && typeof navigator.clipboard.readText === "function") {
        navigator.clipboard
          .readText()
          .then(function (text) {
            applyApiKeyText(text);
          })
          .catch(function () {
            fail("Browser denied clipboard read. Allow it for torn.com.");
          });
        return;
      }
    } catch (_) {}
    try {
      var ta = document.createElement("textarea");
      ta.setAttribute("readonly", "readonly");
      ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
      document.body.appendChild(ta);
      ta.focus();
      var ok = false;
      try {
        ok = document.execCommand("paste");
      } catch (_) {}
      var text = ta.value;
      document.body.removeChild(ta);
      if (ok && text) {
        applyApiKeyText(text);
        return;
      }
    } catch (_) {}
    fail("This browser has no clipboard API.");
  }

  function startUi() {
    ensureUi();
    // Torn re-renders the gym page after load and PDA can navigate without a
    // fresh document, so keep re-checking for ~20s rather than stopping at the
    // first success. ensureUi is cheap and idempotent.
    var n = 0;
    var t = setInterval(function () {
      n += 1;
      ensureUi();
      if (n > 100) clearInterval(t);
    }, 200);
  }

  // Goal fields commit on change (blur or enter) rather than on every keystroke,
  // so a re-render cannot land mid-word. keyBoxBusy() holds the render back
  // while one is focused.
  function onGoalChange(e) {
    var el = e && e.target;
    if (el && el.dataset && el.dataset.mcscost) {
      var m = parseGoal(el.value);
      if (isNaN(m)) {
        showToast("Not a number", "Type what Torn asks for the next increment, e.g. 587m.");
        el.value = state.mcsCost ? fmt(state.mcsCost) : "";
        return;
      }
      state.mcsCost = m;
      storeSet("mcsCost", m);
      renderPanel();
      return;
    }
    if (el && el.dataset && el.dataset.share !== undefined) {
      var sk = el.dataset.share;
      var sv = Number(String(el.value).replace(/[^0-9.]/g, ""));
      if (!isFinite(sv) || sv < 0) sv = 0;
      var raw = {};
      HIST_KEYS.forEach(function (kk) {
        raw[kk] = kk === sk ? sv : ((state.sharesRaw && state.sharesRaw[kk]) || 0);
      });
      // The raw entry is kept as typed so 4:3:2:1 stays 4:3:2:1 in the boxes.
      // Only the derived copy is normalised -- rewriting what someone typed
      // into 40/30/20/10 under their cursor is its own kind of wrong.
      state.sharesRaw = raw;
      state.shares = normalizeShares(raw);
      storeSet("shares", raw);
      resetPlanCaches();
      applyGoalFocus();
      renderPanel();
      return;
    }
    if (el && el.dataset && el.dataset.sharetotal !== undefined) {
      var tv = parseGoal(el.value);
      state.shareTotal = isNaN(tv) || tv < 0 ? 0 : tv;
      storeSet("shareTotal", state.shareTotal);
      resetPlanCaches();
      applyGoalFocus();
      renderPanel();
      return;
    }
    if (!el || !el.dataset || !el.dataset.goal) return;
    var k = el.dataset.goal;
    var n = parseGoal(el.value);
    if (isNaN(n)) {
      showToast("Not a number", "Try 150000000, or shorthand like 150m or 1.2b.");
      el.value = (state.goals && state.goals[k]) ? fmt(state.goals[k]) : "";
      return;
    }
    if (!state.goals) state.goals = { str: 0, def: 0, spe: 0, dex: 0 };
    state.goals[k] = n;
    storeSet("goals", state.goals);
    resetPlanCaches();
    applyGoalFocus();
    renderPanel();
  }

  function onPanelClick(e) {
    var t = e.target;
    if (!t) return;
    if (t.nodeType !== 1) t = t.parentElement;
    if (!t || typeof t.closest !== "function") return;
    // Every clickable attribute has to be listed here or the handler below it is
    // dead code -- closest() returns null and this returns before reaching it.
    t = t.closest("[data-tab],[data-act],[data-focus],[data-focus2],[data-mode],[data-use],[data-use-id],[data-tip],[data-hrange],[data-src],[data-tick],[data-preset],[data-goalstep],[data-raise],[data-clearday],[data-restoreday],[data-book],[data-board],#stackSw,#novSw");
    if (!t) return;
    if (t.dataset.board) {
      onBoardClick(t.dataset.board);
      return;
    }
    if (t.dataset.goalstep !== undefined) {
      var gs = Number(t.dataset.goalstep);
      state.goalStep = GOAL_STEPS.indexOf(gs) !== -1 ? gs : 0;
      storeSet("goalStep", state.goalStep);
      resetPlanCaches();
      renderPanel();
      return;
    }
    if (t.dataset.raise) {
      raiseGoal(t.dataset.raise);
      return;
    }
    if (t.dataset.preset) {
      var pre = null;
      SRC_PRESETS.forEach(function (p) { if (p.id === t.dataset.preset) pre = p; });
      if (pre) {
        state.src = { xan: pre.set.xan, refill: pre.set.refill, cans: pre.set.cans, fhc: pre.set.fhc };
        storeSet("src", state.src);
        renderPanel();
      }
      return;
    }
    if (t.dataset.tick) {
      var tk = t.dataset.tick, trow = srcRow(tk);
      if (!state.src) state.src = {};
      state.src[tk] = srcCount(tk) > 0 ? 0 : (trow ? trow.def : 1);
      storeSet("src", state.src);
      renderPanel();
      return;
    }
    if (t.dataset.src) {
      var key = t.dataset.src;
      var row = srcRow(key);
      var lim = row ? row.max : 24;
      var next = srcCount(key) + (Number(t.dataset.delta) || 0);
      if (next < 0) next = 0;
      if (next > lim) next = lim;
      if (!state.src) state.src = {};
      state.src[key] = next;
      storeSet("src", state.src);
      renderPanel();
      return;
    }
    if (t.dataset.hrange) {
      state.histRange = Number(t.dataset.hrange) || 30;
      storeSet("histRange", state.histRange);
      renderPanel();
      return;
    }
    if (t.dataset.useId) {
      useItemId(t.dataset.useId);
      return;
    }
    if (t.dataset.use) {
      useItemKey(t.dataset.use);
      return;
    }
    if (t.dataset.tip) {
      var tip = itemTip(t.dataset.tip);
      showToast(tip[0], tip[1]);
      return;
    }
    if (t.id === "stackSw") {
      state.warStack = !state.warStack;
      storeSet("warStack", state.warStack);
      renderPanel();
      armNotifications();
      return;
    }
    if (t.dataset.tab) {
      state.tab = t.dataset.tab;
      // The board is five requests, so it loads when you open the tab and
      // never on the poll tick. fetchBoard's own TTL keeps re-opening cheap.
      if (state.tab === "board") fetchBoard(false);
      renderPanel();
      return;
    }
    if (t.dataset.mode) {
      state.mode = t.dataset.mode;
      storeSet("mode", state.mode);
      renderPanel();
      return;
    }
    if (t.dataset.focus2) {
      state.focus2 = t.dataset.focus2;
      storeSet("focus2", state.focus2);
      renderPanel();
      return;
    }
    if (t.dataset.focus) {
      state.focus = t.dataset.focus;
      storeSet("focus", state.focus);
      renderPanel();
      return;
    }
    if (t.dataset.act === "close") {
      storeSet("user_tucked", true);
      setOpen(false);
    }
    if (t.dataset.book !== undefined) {
      var bkey = t.dataset.book;
      if (!STAT_BOOKS[bkey]) return;
      // Tapping toggles. Starting stamps now, which is what the 31-day
      // countdown is measured from; stopping clears it outright.
      var reading = !!bookPending(bkey, (state.books || {})[bkey], Date.now());
      state.books[bkey] = reading ? 0 : Date.now();
      // Tapping makes the date yours, so the auto-detector stops managing it --
      // otherwise a strip without the book would clear what you just set.
      if (state.booksAuto) { state.booksAuto[bkey] = false; storeSet("booksAuto", state.booksAuto); }
      if (state.booksExact) { state.booksExact[bkey] = false; storeSet("booksExact", state.booksExact); }
      storeSet("books", state.books);
      resetPlanCaches();
      applyGoalFocus();
      renderPanel();
      return;
    }
    if (t.dataset.act === "verdict") {
      state.verdictFold = !state.verdictFold;
      storeSet("verdictFold", state.verdictFold ? 1 : 0);
      renderPanel();
      return;
    }
    if (t.dataset.act === "refresh") {
      showToast("Refreshing", "Pulling fresh numbers from Torn.", 1600);
      refresh("manual");
    }
    if (t.dataset.clearday) {
      clearLedgerDay(Number(t.dataset.clearday));
      renderPanel();
      return;
    }
    if (t.dataset.restoreday) {
      restoreLedgerDay(Number(t.dataset.restoreday));
      renderPanel();
      return;
    }
    if (t.dataset.act === "clearstacked") {
      ledgerWasteDays().forEach(function (r) { if (r.stacked && !r.cleared) clearLedgerDay(r.d); });
      renderPanel();
      return;
    }
    if (t.dataset.act === "clearallwaste") {
      // Only what is on screen, and only what is not already cleared -- so the
      // button can never reach further back than the list the user just read.
      ledgerWasteDays().forEach(function (r) { if (!r.cleared) clearLedgerDay(r.d); });
      renderPanel();
      return;
    }
    if (t.dataset.act === "savekey") {
      var inp = document.getElementById("gcKey");
      var raw = (inp && inp.value) || draftKey;
      var n = normalizeKey(raw).length;
      if (trySaveKey(raw)) showToast("Key saved", "Loading your data now.", 2600);
      else showToast("Not saved", n ? "That key is " + n + " characters; Torn keys are 16." : "Paste your 16-character Torn API key first.", 3200);
    }
    if (t.dataset.act === "pastekey") {
      pasteKeyFromClipboard();
      return;
    }
  }

  function clampPos(el, x, y) {
    var w = el.offsetWidth || 42;
    var h = el.offsetHeight || 42;
    var maxX = Math.max(8, window.innerWidth - w - 8);
    var maxY = Math.max(8, window.innerHeight - h - 8);
    return {
      x: Math.max(8, Math.min(maxX, x)),
      y: Math.max(8, Math.min(maxY, y)),
    };
  }

  function placeEl(el, x, y) {
    var p = clampPos(el, x, y);
    el.style.left = p.x + "px";
    el.style.top = p.y + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
    return p;
  }

  function applySavedPos(el, xKey, yKey) {
    if (el && el.id === PILL_ID) return;
    var savedX = Number(storeGet(xKey, NaN));
    var savedY = Number(storeGet(yKey, NaN));
    if (isNaN(savedX) || isNaN(savedY)) return;
    var w = el.offsetWidth || 42;
    var h = el.offsetHeight || 42;
    if (savedX > window.innerWidth - 16 || savedY > window.innerHeight - 100 || savedX < -w + 24 || savedY < -h + 24) return;
    placeEl(el, savedX, savedY);
  }

  function bindDrag(el, opts) {
    opts = opts || {};
    var xKey = opts.xKey || "pill_x";
    var yKey = opts.yKey || "pill_y";
    var sx, sy, ox, oy, moving = false, pid = null, lastTap = 0;

    function handleFromEvent(e) {
      var t = e.target;
      if (t && t.nodeType !== 1) t = t.parentElement;
      return t;
    }

    function tap() {
      if (!opts.onTap) return;
      var now = Date.now();
      if (now - lastTap < 400) return;
      lastTap = now;
      opts.onTap();
    }

    el.addEventListener("pointerdown", function (e) {
      if (opts.handle && !opts.handle(handleFromEvent(e))) return;
      if (e.button) return;
      moving = true;
      pid = e.pointerId;
      try {
        el.setPointerCapture(e.pointerId);
      } catch (_) {}
      var r = el.getBoundingClientRect();
      sx = e.clientX;
      sy = e.clientY;
      ox = r.left;
      oy = r.top;
      el.style.width = r.width + "px";
      el.style.height = r.height + "px";
      placeEl(el, r.left, r.top);
      el._dragged = false;
    });
    el.addEventListener("pointermove", function (e) {
      if (!moving) return;
      var dx = e.clientX - sx;
      var dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 12) el._dragged = true;
      var p = placeEl(el, ox + dx, oy + dy);
      if (el._dragged) {
        storeSet(xKey, p.x);
        storeSet(yKey, p.y);
      }
    });
    function endPointer(e) {
      if (!moving) return;
      moving = false;
      try {
        if (pid != null) el.releasePointerCapture(pid);
      } catch (_) {}
      pid = null;
      if (el._dragged) return;
      if (e && e.preventDefault) e.preventDefault();
      tap();
    }
    el.addEventListener("pointerup", endPointer);
    el.addEventListener("pointercancel", function () {
      moving = false;
      pid = null;
    });
    el.addEventListener("click", function (e) {
      if (el._dragged) {
        el._dragged = false;
        return;
      }
      if (opts.onTap) {
        e.preventDefault();
        tap();
      }
    });
    el.addEventListener(
      "touchend",
      function (e) {
        if (el._dragged) return;
        if (!opts.onTap) return;
        e.preventDefault();
        tap();
      },
      false
    );
  }

  function trainStatFromEl(el) {
    if (!el || el.nodeType !== 1) return "";
    var n = el.closest ? el.closest("button,[role='button'],input") || el : el;
    var blob = (
      (n.getAttribute && (n.getAttribute("aria-label") || n.getAttribute("data-stat") || n.getAttribute("title") || "")) +
      " " +
      String(n.textContent || "").slice(0, 80) +
      " " +
      (n.className || "")
    ).toLowerCase();
    var hits = [];
    if (blob.indexOf("strength") !== -1) hits.push("Strength");
    if (blob.indexOf("defense") !== -1 || blob.indexOf("defence") !== -1) hits.push("Defense");
    if (blob.indexOf("speed") !== -1) hits.push("Speed");
    if (blob.indexOf("dexterity") !== -1) hits.push("Dexterity");
    return hits.length === 1 ? hits[0] : "";
  }

  function looksLikeTrain(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest && el.closest("#" + PANEL_ID + ",#" + PILL_ID)) return false;
    if (trainStatFromEl(el)) return true;
    var btn = el.closest ? el.closest("button,[role='button'],input[type='button'],input[type='submit']") : null;
    if (!btn) return false;
    var t = ((btn.textContent || "") + " " + (btn.className || "") + " " + (btn.getAttribute("aria-label") || "")).toLowerCase();
    return /train|strength|defense|defence|speed|dexterity/.test(t);
  }

  // A click can only see your CURRENT balance, not what the train is about to
  // cost — so logging state.energy as "Trained 150e" was reporting your bar,
  // not the spend, and a click with an empty bar logged "0e". Capture the
  // before-state on the click and write the entry once the refresh lands and
  // the difference is measurable.

  var GAIN_WAIT_MS = 50000;

  function finaliseTrain(force) {
    var t = pendingTrain;
    if (!t) return;
    var spent = Math.max(0, t.preE - (state.energy || 0));
    var skill = t.skill || inferTrainSkillFromDelta(t.preStats, state.stats);
    var k = STAT_KEY[skill];
    var gained = k ? Math.max(0, (state.stats[k] || 0) - (t.preStats[k] || 0)) : 0;

    // Torn caches battle stats for up to about thirty seconds, but energy moves
    // the moment you train — so finalising a couple of seconds later reports a
    // real session with no gain at all. Keep asking until the stats catch up,
    // then give up and record the session without one rather than lose it.
    if (gained <= 0 && !force && Date.now() - (t.at || 0) < GAIN_WAIT_MS) {
      setTimeout(function () {
        refresh("train").then(function () { finaliseTrain(); }, function () { finaliseTrain(); });
      }, 9000);
      return;
    }
    pendingTrain = null;
    // A click that trained nothing — no energy, or Torn refused — should not
    // leave a line behind. And a drop we merely OBSERVED needs the stat to have
    // actually moved, or a stale reading becomes a phantom session.
    if (spent <= 0 && gained <= 0) return;
    // A SMALL observed drop could be nothing but API skew, so it needs a stat
    // gain to corroborate it. A large one could not plausibly be anything other
    // than a session, and discarding it because Torn was slow to update the
    // stats loses real training.
    if (t.observed && gained <= 0 && spent < 25) return;
    pushLog(
      "Trained" + (skill ? " " + skill : "") +
        " \u00b7 " + fmt(spent) + "e spent" +
        (gained > 0 ? " \u00b7 +" + fmt(gained) : "") +
        " @ " + (t.gym || "gym")
    );
    if (state.open) renderPanel();
  }

  function startWatch() {
    stopWatch();
    clickHandler = function (e) {
      if (!/gym\.php/i.test(location.href)) return;
      var el = e.target && e.target.nodeType === 1 ? e.target : e.target && e.target.parentElement;
      if (!el) return;
      if (el.closest && el.closest("#" + PANEL_ID + ",#" + PILL_ID)) return;
      if (!looksLikeTrain(el)) return;
      var skill = trainStatFromEl(el);
      if (Date.now() - state.lastTrain > 1200) {
        pendingTrain = {
          skill: skill,
          at: Date.now(),
          preE: state.energy,
          preStats: {
            str: state.stats.str, def: state.stats.def,
            spe: state.stats.spe, dex: state.stats.dex
          },
          gym: state.gymName || "gym"
        };
        state.lastTrain = Date.now();
        state.flash = "TRAINED";
        if (state.open) renderPanel();
      }
      setTimeout(function () {
        refresh("train");
      }, 600);
      setTimeout(function () {
        refresh("train").then(function () { finaliseTrain(); }, function () { finaliseTrain(); });
      }, 2200);
      // refresh() is a no-op while another fetch is in flight, in which case the
      // line above never resolves with fresh numbers. This is the backstop.
      // Final backstop: record it even if the stats never moved.
      setTimeout(function () { finaliseTrain(true); }, GAIN_WAIT_MS + 4000);
    };
    document.addEventListener("click", clickHandler, true);

    var roots = [];
    var gymRoot = document.getElementById("gymroot");
    if (gymRoot) roots.push(gymRoot);
    var energy = document.querySelector('[class*="energy"], #barEnergy, [class*="bar-energy"]');
    if (energy) roots.push(energy);
    roots.forEach(function (root) {
      var obs = new MutationObserver(function () {
        if (!/gym\.php/i.test(location.href)) return;
        clearTimeout(obs._t);
        obs._t = setTimeout(function () {
          refresh("energy");
        }, 500);
      });
      obs.observe(root, { childList: true, subtree: true, characterData: true, attributes: true });
      observers.push(obs);
    });
  }

  function stopWatch() {
    observers.forEach(function (o) {
      try {
        o.disconnect();
      } catch (_) {}
    });
    observers = [];
    if (clickHandler) {
      document.removeEventListener("click", clickHandler, true);
      clickHandler = null;
    }
  }

  function boot() {
    try {
      state.warStack = storeBool("warStack", false);
      // Only the acknowledgement is restored; capStreak() reconstructs the
      // clock itself from the readings it already keeps.
      state.fullAckAt = Number(storeGet("fullack", 0)) || 0;
      state.focus = storeGet("focus", "str") || "str";
      state.focus2 = storeGet("focus2", "none") || "none";
      var gv = storeGet("goals", null);
      if (typeof gv === "string") { try { gv = JSON.parse(gv); } catch (_) { gv = null; } }
      if (gv && typeof gv === "object") {
        state.goals = { str: Number(gv.str) || 0, def: Number(gv.def) || 0,
                        spe: Number(gv.spe) || 0, dex: Number(gv.dex) || 0 };
      }
      // Folded by default. A stored choice still wins, so anyone who has
      // deliberately expanded it keeps it expanded -- the default only decides
      // for panels that have never been told either way.
      var bk = storeGet("books", null);
      if (typeof bk === "string") { try { bk = JSON.parse(bk); } catch (_) { bk = null; } }
      if (bk && typeof bk === "object") {
        HIST_KEYS.forEach(function (k) { state.books[k] = Number(bk[k]) || 0; });
      }
      var ba = storeGet("booksAuto", null);
      if (typeof ba === "string") { try { ba = JSON.parse(ba); } catch (_) { ba = null; } }
      state.booksAuto = (ba && typeof ba === "object") ? ba : {};
      var bx = storeGet("booksExact", null);
      if (typeof bx === "string") { try { bx = JSON.parse(bx); } catch (_) { bx = null; } }
      state.booksExact = (bx && typeof bx === "object") ? bx : {};
      var bi = storeGet("bookIds", null);
      if (typeof bi === "string") { try { bi = JSON.parse(bi); } catch (_) { bi = null; } }
      state.bookIds = (bi && typeof bi === "object") ? bi : {};
      state.verdictFold = storeBool("verdictFold", true);
      var sh = storeGet("shares", null);
      if (typeof sh === "string") { try { sh = JSON.parse(sh); } catch (_) { sh = null; } }
      state.sharesRaw = (sh && typeof sh === "object") ? sh : null;
      state.shares = normalizeShares(sh);
      state.shareTotal = Number(storeGet("shareTotal", 0)) || 0;
      state.mode = storeGet("mode", "xan") || "xan";
      state.log = storeGet("log", []) || [];
      if (!Array.isArray(state.log)) state.log = [];
      state.hist = storeGet("hist", []) || [];
      // PDA's storage hands back strings, so a bad read must not take the
      // panel down with it.
      if (typeof state.hist === "string") { try { state.hist = JSON.parse(state.hist); } catch (_) { state.hist = []; } }
      if (!Array.isArray(state.hist)) state.hist = [];
      state.hist = state.hist.filter(function (e) { return e && typeof e.d === "number" && Array.isArray(e.v) && e.v.length === 4; });
      // Trend is the centrepiece of this layout, and a fresh beta namespace
      // means it opens blank next to a stable script holding weeks of history.
      // Copy that history in once, through the same guards; stable is never
      // written to, so uninstalling the beta costs nothing.
      if (!state.hist.length) {
        var seed = stableGet("hist", []);
        if (typeof seed === "string") { try { seed = JSON.parse(seed); } catch (_) { seed = []; } }
        if (Array.isArray(seed)) {
          seed = seed.filter(function (e) { return e && typeof e.d === "number" && Array.isArray(e.v) && e.v.length === 4; });
          if (seed.length) { state.hist = seed; storeSet("hist", seed); }
        }
      }
      // Same idea for the settings that decide what the coach says, so the
      // beta's first verdict matches the one you are used to.
      if (storeGet("focus", "") === "") {
        ["focus", "focus2", "mode", "warStack", "histRange"].forEach(function (k) {
          var v = stableGet(k, undefined);
          if (v !== undefined && v !== null && v !== "") storeSet(k, v);
        });
        state.warStack = storeBool("warStack", false);
        state.focus = storeGet("focus", "str") || "str";
        state.focus2 = storeGet("focus2", "none") || "none";
        state.mode = storeGet("mode", "xan") || "xan";
        }
      state.histRange = Number(storeGet("histRange", 30)) || 30;
      // The faction board. PDA hands storage back as strings, so every read
      // goes through the same parse-or-drop guard the rest of boot uses -- a
      // corrupt baseline must cost the board, not the panel.
      var bd = storeGet("board", null);
      if (typeof bd === "string") { try { bd = JSON.parse(bd); } catch (_) { bd = null; } }
      if (bd && typeof bd === "object" && bd.stats && typeof bd.stats === "object" &&
          isFinite(Number(bd.week))) {
        // Values sieved to finite numbers. A string in a stat map made
        // boardSnap's `id in map` throw, and a NaN week rolled on every read
        // and archived a week dated 1970 for ever.
        var clean = {};
        Object.keys(bd.stats).forEach(function (st) {
          var m = bd.stats[st];
          if (!m || typeof m !== "object") return;
          var out = {};
          Object.keys(m).forEach(function (id) {
            var v = Number(m[id]);
            if (isFinite(v)) out[id] = v;
          });
          clean[st] = out;
        });
        state.board = { week: Number(bd.week), at: Number(bd.at) || 0, stats: clean,
                        rows: Array.isArray(bd.rows) ? bd.rows : [],
                        hist: Array.isArray(bd.hist) ? bd.hist : [] };
      }
      var nb = storeGet("natBase", null);
      if (typeof nb === "string") { try { nb = JSON.parse(nb); } catch (_) { nb = null; } }
      if (nb && typeof nb === "object") state.natBase = nb;
      state.boardFaction = String(storeGet("boardFaction", "") || "");
      state.unlock = storeGet("unlock", null) || null;
      if (typeof state.unlock === "string") { try { state.unlock = JSON.parse(state.unlock); } catch (_) { state.unlock = null; } }
      if (state.unlock && typeof state.unlock.gymId !== "number") state.unlock = null;
      state.trainLog = storeGet("trainLog", null) || null;
      if (typeof state.trainLog === "string") { try { state.trainLog = JSON.parse(state.trainLog); } catch (_) { state.trainLog = null; } }
      if (state.trainLog && !state.trainLog.byDay) state.trainLog = null;
      // A stored train log written before byDayStat existed has none, and an
      // absent map simply leaves every day to the one-stat rule until the next
      // log round fills it in. Placed AFTER the restore above: it originally sat
      // 58 lines earlier, where state.trainLog is still undefined and the guard
      // could never fire -- protection in appearance only.
      if (state.trainLog && typeof state.trainLog.byDayStat !== "object") state.trainLog.byDayStat = {};
      state.gymsOwned = storeGet("gymsOwned", []) || [];
      if (typeof state.gymsOwned === "string") { try { state.gymsOwned = JSON.parse(state.gymsOwned); } catch (_) { state.gymsOwned = []; } }
      if (!Array.isArray(state.gymsOwned)) state.gymsOwned = [];
      state.gymsOwned = state.gymsOwned.filter(function (i) { return typeof i === "number" && i >= 0 && i < GYMS.length; });
      state.goalOrder = storeGet("goalOrder", []) || [];
      if (typeof state.goalOrder === "string") { try { state.goalOrder = JSON.parse(state.goalOrder); } catch (_) { state.goalOrder = []; } }
      if (!Array.isArray(state.goalOrder)) state.goalOrder = [];
      state.goalOrder = state.goalOrder.filter(function (k) { return HIST_KEYS.indexOf(k) !== -1; });
      var stepSaved = Number(storeGet("goalStep", GOAL_STEP_DEFAULT));
      state.goalStep = GOAL_STEPS.indexOf(stepSaved) !== -1 ? stepSaved : GOAL_STEP_DEFAULT;
      state.prices = storeGet("prices", {}) || {};
      if (typeof state.prices === "string") { try { state.prices = JSON.parse(state.prices); } catch (_) { state.prices = {}; } }
      if (!state.prices || typeof state.prices !== "object") state.prices = {};
      state.mcsCost = Number(storeGet("mcsCost", 0)) || 0;
      state.ledger = storeGet("ledger", []) || [];
      if (typeof state.ledger === "string") { try { state.ledger = JSON.parse(state.ledger); } catch (_) { state.ledger = []; } }
      if (!Array.isArray(state.ledger)) state.ledger = [];
      state.ledger = state.ledger.filter(function (e) { return e && typeof e.d === "number"; });
      var sv = storeGet("src", null);
      if (typeof sv === "string") { try { sv = JSON.parse(sv); } catch (_) { sv = null; } }
      if (sv && typeof sv === "object") {
        // Copy whatever was saved rather than a fixed list of keys. The fixed
        // list silently dropped any source added later — Mc Smoogle Corp was
        // saved, restored as nothing, and showed 0 every time.
        var next = {};
        Object.keys(sv).forEach(function (sk) {
          var n = Number(sv[sk]);
          if (isFinite(n) && n > 0) next[sk] = n;
        });
        // A saved generic "cans" count predates the per-can tick boxes. Red Cow
        // is the 25e middle it used to assume, so that is where it lands.
        if (next.cans && !next.redcow) next.redcow = next.cans;
        delete next.cans;
        state.src = next;
      }
      state.boosterPerk = storeBool("boosterPerk", false);
      var cev = storeGet("calEvents", []);
      if (typeof cev === "string") { try { cev = JSON.parse(cev); } catch (_) { cev = []; } }
      state.calEvents = Array.isArray(cev) ? cev : [];
      state.calAt = Number(storeGet("calAt", 0)) || 0;
      var idv = storeGet("invDom", null);
      if (typeof idv === "string") { try { idv = JSON.parse(idv); } catch (_) { idv = null; } }
      state.invDom = idv && idv.qty ? idv : null;
      state.energySecPerE = Number(storeGet("energySecPerE", 0)) || 0;
      state.lastSeen = storeGet("lastSeen", null) || null;
      if (typeof state.lastSeen === "string") { try { state.lastSeen = JSON.parse(state.lastSeen); } catch (_) { state.lastSeen = null; } }
      startUi();
      if (/gym\.php/i.test(location.href) && !storeBool("user_tucked", false)) {
        setOpen(true);
      }
      var gymTries = 0;
      var gymWait = setInterval(function () {
        gymTries += 1;
        dockInGym();
        if (document.getElementById("gcb-gym-dock") || gymTries > 80) clearInterval(gymWait);
      }, 300);
      try {
        if (!window._gcbDomWatch) {
          window._gcbDomWatch = new MutationObserver(function () {
            if (!document.getElementById(PANEL_ID)) ensureUi();
          });
          window._gcbDomWatch.observe(document.documentElement, { childList: true });
          if (document.body) window._gcbDomWatch.observe(document.body, { childList: true });
        }
      } catch (_) {}
      setInterval(function () {
        if (!document.body) return;
        if (!document.getElementById(PANEL_ID) || !document.getElementById(STYLE_ID)) {
          ensureUi();
          if (state.open) renderPanel();
        }
        dockInGym();
      }, 1500);
      // The item page fills its rows in after load, so keep looking for a while.
      if (/item\.php/i.test(location.href)) {
        var scanTries = 0;
        var scanTimer = setInterval(function () {
          scanTries += 1;
          if (scanItemPage() || scanTries > 40) clearInterval(scanTimer);
        }, 700);
      }
      renderPanel();
      refresh("boot");
      // The gym list renders late and is the only source for which gyms you own
      // — Torn's API returns active_gym and nothing else. Poll for it the same
      // way the item page is polled.
      if (/gym\.php/i.test(location.href)) {
        var gymTries = 0;
        var gymTimer = setInterval(function () {
          gymTries += 1;
          if (scanGymList() || gymTries > 40) clearInterval(gymTimer);
        }, 700);
      }
      refreshCalendar();
      startWatch();
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(function () {
        if (document.visibilityState !== "visible") return;
        refresh(/gym\.php/i.test(location.href) ? "gym" : "idle");
      }, /gym\.php/i.test(location.href) ? POLL_GYM_MS : POLL_OFF_MS);
      if (cdTimer) clearInterval(cdTimer);
      cdTimer = setInterval(function () {
        if (state.drugCd > 0) state.drugCd -= 1;
        if (state.boosterCd > 0) state.boosterCd -= 1;
        syncEnergyFromDom();
        ledgerObserve(false);
        // Every Torn page, not just the gym. PDA is exempted from the
        // visibility check because it reports hidden:true while plainly in
        // front of you, and a banner you never see is worse than none.
        if (isPda() || document.visibilityState === "visible") {
          trackFullBar();
          try { renderNag(); } catch (_) {}
          try { renderRefillStrip(); } catch (_) {}
        }
        if (!state.open) return;
        if (syncEnergyFromDom()) lastTickSig = "";
        var sig = fmtCd(state.drugCd) + "|" + fmtCd(state.boosterCd) + "|" + state.tab + "|" + state.energy;
        if (sig !== lastTickSig) {
          lastTickSig = sig;
          renderPanel();
          return;
        }
        var panel = document.getElementById(PANEL_ID);
        if (!panel) return;
        var txt = ago();
        var labels = panel.querySelectorAll(".gc-ago");
        for (var i = 0; i < labels.length; i++) {
          if (labels[i].textContent !== txt) labels[i].textContent = txt;
        }
      }, 1000);
      // Torn navigations tear the script down; write through before that.
      try {
        window.addEventListener("pagehide", function () { ledgerObserve(true); });
        window.addEventListener("beforeunload", function () { ledgerObserve(true); });
      } catch (_) {}
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") ledgerObserve(true);
      });
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") {
          ensureUi();
          refresh("visible");
        }
      });
    } catch (err) {
      try {
        console.log("[Gym Coach] boot failed", err);
      } catch (_) {}
      startUi();
    }
  }

  startUi();
  bindKeyInputPasteShield();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
