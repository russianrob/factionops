# Gym unlock progress — feasibility findings (2026-08-26)

Source: wiki.torn.com/wiki/Gym (via Wayback snapshot 2025-03-29) -- authoritative.
github.com/qaimali7-web (MIT) carries an identical 23-value table, but identical
values INCLUDING the odd 18,100 means it was copied from the wiki: that is
lineage, not independent corroboration. Treat this as ONE source.

## Mechanic (official wiki, verbatim)
"You'll slowly gain gym EXP which will allow you to access new and better gyms.
The next gym will be available for you once you have the required gym EXP to join."
"** After unlocking George's, you will no longer gain any gym exp."

## The table — PER-SEGMENT energy, not cumulative
Wiki column header is "Estimate E for next gym", one value per gym row: the energy
you train WHILE AT that gym before the next unlocks.

gym(1-based) name                 E for next gym
 1 Premier Fitness                    200
 2 Average Joes                       500
 3 Woody's Workout                  1,000
 4 Beach Bods                       2,000
 5 Silver Gym                       2,750
 6 Pour Femme                       3,000
 7 Davies Den                       3,500
 8 Global Gym                       4,000
 9 Knuckle Heads                    6,000
10 Pioneer Fitness                  7,000
11 Anabolic Anomalies               8,000
12 Core                            11,000
13 Racing Fitness                  12,420
14 Complete Cardio                 18,000
15 Legs, Bums and Tums             18,100
16 Deep Burn                       24,140
17 Apollo Gym                      31,260
18 Gun Shop                        36,610
19 Force Training                  46,640
20 Cha Cha's                       56,520
21 Atlas                           67,775
22 Last Round                      84,535
23 The Edge                       106,305
24 George's                           N/A  (no further gym exp is earned)

### Why per-segment, not cumulative
Read as cumulative, the step from Complete Cardio (18,000) to Legs/Bums/Tums
(18,100) is 100 energy -- ~10 trains -- wedged between steps of 5,580 and 6,040.
Read as per-segment the same numbers are smooth and monotonic. The anomaly only
exists under the cumulative reading, so per-segment is the correct one.
Second, independent confirmation -- the total. Summed as per-segment, unlocking
George's takes 551,255 lifetime energy = ~375 days at a heavy 1,470 e/day (288
with Music Store). That matches the community's "George's is a year-plus grind".
Read as cumulative it would be 106,305 = ~72 days, which contradicts it flatly.
Qaim's own label "Spent in Gym" also reads as segment-relative, so his maths was
never inconsistent -- only under-documented.

This ALSO means no log summing is needed: only progress at the current gym matters.

## Why "Estimate"
The threshold is in gym EXP, which is fixed; the ENERGY needed varies per player.
Music Store job perk = +30% gym EXP per train, so that player needs req/1.3 energy.
Other company perks may also apply. This is why measuring the player's own
energy-per-percent beats trusting the table.

## Where the progress lives in the DOM
  [class*="percentage"] containing '%'   -- integer, so answers are a 1% range
  .closest('button') -> [class*="gym-<N>"]  gives the 1-based Torn gym id
Torn gym id = (gym-coach GYMS array index) + 1. Verified 3 ways from train logs:
  gym:24 @10e/train = George's (idx 23); gym:2 @5e = Average Joes; gym:9 @10e = Knuckle Heads.
Inferred (NOT yet observed): the % sits on the NEXT LOCKED gym's button, so the
requirement is GYM_ENERGIES[gymId-2]. Supporting evidence: that reading handles
both boundaries correctly (a new player at Premier Fitness, and George's having
no next gym), whereas "% on the current gym" breaks at both ends.

## Logs (from probe v1.1.0) -- verification tool, not needed by the feature
5300/5301/5302/5303 = gym train str/def/spe/dex. Each entry carries
  {trains, energy_used, <stat>_before/_after/_increased, happy_used, gym}
5320 = Gym purchase {gym, cost}.  5321 = Gym activate.  5310 = Gym train addict.
Max 100 entries per request. personalstats has NO cumulative energy-trained field
(217 keys checked; only items.used.energy=drinks and other.refills.energy matched).

## Specialist gyms are stat-ratio gated, not energy gated
Balboas        $50m  25e  Cha Cha's unlocked; Def+Dex 25% higher than Str+Spe
Frontline      $50m  25e  Cha Cha's unlocked; Str+Spe 25% higher than Dex+Def
Gym 3000      $100m  50e  George's unlocked; Str 25% higher than 2nd highest
Mr. Isoyamas  $100m  50e  George's unlocked; Def 25% higher than 2nd highest
Total Rebound $100m  50e  George's unlocked; Spe 25% higher than 2nd highest
Elites        $100m  50e  George's unlocked; Dex 25% higher than 2nd highest
Sports Sci Lab$500m  25e  Last Round unlocked; <150 Xanax+Ecstasy combined EVER
Fight Club    $2.1b  10e  invite only
TornTools already implements these (its /1.25 "missing stat" maths).
