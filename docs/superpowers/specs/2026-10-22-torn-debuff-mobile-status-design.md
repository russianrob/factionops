# Torn Debuff Mobile Status (design)

**Status:** approved by the owner on 2026-10-21 (EDT), after a live mock-up of layout B on their phone: "okay go with B but dont have the sample icons thing".
**Script:** `server/public/scripts/torn-debuff-mobile-status.user.js` and `.meta.js`, version 1.0.0. Tests: `server/torn-debuff-mobile-status.test.mjs`.

## Why

On a phone, Torn's attack page shows one player window at a time. By default it is the enemy's, next to your weapons, and that is where you fight from. Your own +/-% strip and your effect icons are only in your own window. You get that window by tapping your header, and then your weapons are swapped for the enemy's. So in a fight you can't see your own debuffs, such as Smoked (speed reduced to 1/3rd). A member raised this during wars.

The script shows your strip and your effect icons in a row along the top of the enemy's window.

## Decisions

| # | Decision |
|---|---|
| Q1 | Show your five +/-% numbers and your effect icons. |
| Q2 | Show them only while your own window isn't shown. |
| Q3 | Facts come from probes on the owner's phone (remote inspect) and Torn's attack bundle, 2026-10-21. |
| Q4 | Name "Torn Debuff Mobile Status", file `torn-debuff-mobile-status.user.js`. RussianRob, All Rights Reserved, served on tornwar and pasted to Greasy Fork, for PDA and Tampermonkey. |
| Q5 | Layout B: a YOU row across the top of the enemy's window, your numbers first and your icons under them. The owner picked it over a left-hand column after seeing it live. |
| Q6 | No sample icons. With no effects there is no icons line. |
| Q7 | Your boosts show as well as your debuffs, for example a needle you used (the owner asked). The row copies your own window, so whatever Torn shows there shows here. No needle has been seen in the data yet, so the live check uses one. |

## What it shows

The row has two lines: the numbers line and, under it, the icons line.

```
+---------------------------------------+
| [YOU] +35%  +44%  +49%  +11%  +12%    |  green border, see-through dark
|        str   spd   dex   def   dmg    |
| [icon] [icon]                         |  your effects
|  103     45                           |  seconds left
|            (enemy model)    [enemy's  |
|                              icons]   |
| + 0% str  - 66% spd  ...  Torn's strip|
+---------------------------------------+
```

- **Numbers line:** a green YOU tag, then strength, speed, dexterity, defense and damage, labelled str, spd, dex, def and dmg. Each value reads `+N%` or `-N%`. It is green above 0, red below 0 and white at 0. These are the numbers in your own window's strip, from the same field (`attackerUser.statsModifiers`). Temporary effects are already counted in them: the enemy's speed read -66 while they were Smoked.
- **Icons line:** your effects, good and bad (a needle you used as well as the enemy's smoke), drawn with Torn's own icon images. Each sits on a small dark tile whose border is Torn's colour for that effect (red, green, blue or yellow). The seconds left show under the icon and count down every second. Over 300 seconds shows an infinity sign, where Torn shows its eternity icon.
- **Which effects:** the ones Torn puts in the right-hand column of your own window. That means type 1 or 2, more than 0 seconds left, and a render mode of `iconOnly` or `both` (a missing render mode counts as `both`).
- **Icon file:** `/images/v2/attack/effect_icons/<name>.svg`. The name is the effect's class with `_<level>` added when the effect has a level. Every `hardening_*` class uses `kinetokinesis` instead, as Torn does.
- **Look:** as in the approved mock-up. The background is see-through dark with a 1px green border. Text is 11 to 12px. Icons are 26px on 34px tiles. The row sits 4px in from the window's top, left and right edges.

## When it shows

- **Phone layout only.** It shows only when exactly one player window (`[class*="playerWindow___"]`) is on the page. Desktop and wide tablets show both windows, so it never shows there.
- **Only while the enemy's window is up.** That is when the store's `activePlayerLayout.activePlayerLayout` is `"attacker"`, Torn's default. Tapping your own header sets it to `"defender"`, and Torn shows your window. The row goes away then and comes back when you tap back.
- **Before, during and after the fight.** The numbers line shows whenever your data is there (at least one of the five stats has a number), like the strip in your own window. The icons line only appears while you have effects.
- **Never in the way.** It has `pointer-events: none`, so every tap reaches whatever is underneath. There are no tooltips and nothing to tap.

## Where the data comes from

Torn's attack page keeps the fight in a Redux store. Torn updates it from its own `page.php?sid=attackData&mode=json` poll (every `pollDelay`, 4 seconds) and from live updates. The script reads it the way the probes did:

1. It takes `[class*="playersModelWrap___"]` and finds its `__reactFiber$...` key. It walks `.return` (at most 40 steps) to the first fiber whose `memoizedProps.store.getState` is a function.
2. It reads three things:
   - `attack.attackerUser.userID` and `attack.attackerUser.statsModifiers.<stat>.value`. On this page you are always the attacker.
   - `attack.currentTemporaryEffects[<your userID>]`, an array of `{ID, class, level, type, timeLeft, renderMode, iconColor, ...}`. The whole map can be `null`.
   - `activePlayerLayout.activePlayerLayout`.
3. It calls `store.subscribe()`. The callback runs on every dispatch, hits and animations included, so it works out the small view the row needs: the five values, the effect list, the layout and the window count. It repaints in the next animation frame, and only if that view changed. The callback catches its own errors: an error thrown into Redux's dispatch would stop Torn's own listeners.

**Rejected:**
- **Hooking the attackData request.** It would miss the live updates and would have to run at document-start.
- **Copying your own window from the page.** On the phone layout Torn doesn't render it while the enemy's window is up.
- **Torn's API.** It has no in-fight effects.

### Countdown

The store's `timeLeft` changes only when Torn's data refreshes, every 4 seconds. Between refreshes, Torn counts its own icons down by one each second, and the script does the same:
- When the effect list from the store changes, it keeps the list and the time it arrived.
- A one-second timer shows `timeLeft` minus the whole seconds since then, and drops an icon at 0.
- The timer runs only while icons are showing.

## Mounting

- **Parent:** the single window's `[class*="allLayers___"]`, the layer stack that holds Torn's strip and icon columns. If that isn't found, the window itself.
- **Elements:** the row is one `div#tdms-row`, `position: absolute`, with its own stylesheet `#tdms-style`. Every class starts with `tdms-`.
- **Stacking:** above the window's own layers, at z-index 20 as in the approved mock-up. Taps go through the row, so it can't block Torn's fight buttons either way. The live check confirms it doesn't hide the Start fight or end-of-fight buttons.
- **Staying mounted:** Torn re-renders the window when the layout flips. `ensureMounted()` is safe to run any number of times:
  - when the row should show, it appends the row to the current window's layer stack, unless it is already there;
  - otherwise it removes the row.

  It runs on every repaint. A `MutationObserver` on `#attack-root`, the attack app's root (child list, subtree), also catches Torn rebuilding the window without a store change. The observer books at most one repaint per frame, and a repaint changes nothing when the row is already in place. It ignores changes inside the row and the row itself being added or removed, so it can't trigger itself.
- **Start-up:** the attack app renders after the page loads. The script checks every 500 ms for `[class*="playersModelWrap___"]` and its store, then subscribes and stops checking. It keeps checking for as long as the box is missing; a page that shows an error instead of a fight never gets one, and each check is a single selector lookup. If the box is there but no store turns up within 10 seconds, it stops and logs one `console.info` line.
- **One copy:** a `window.__tdmsLoaded` flag stops a second injection of the script from running.
- **If Torn changes its page:** with no store, or none of the fields, nothing is drawn and one `console.info` line says why. The script never throws into Torn's page.

## Script

- **Header:**
  - `@name Torn Debuff Mobile Status`, `@namespace RussianRob`, `@author RussianRob`, `@version 1.0.0`, `@license All Rights Reserved`, no `@copyright`;
  - `@match https://www.torn.com/page.php?sid=attack*` and `https://www.torn.com/loader.php?sid=attack*`;
  - `@run-at document-idle`, `@grant none`;
  - `@downloadURL` is the served `.user.js` and `@updateURL` the served `.meta.js`.
- **Page world:** `@grant none` runs the script in the page world in Tampermonkey, where React's fiber and the store are visible. PDA runs scripts in the page world anyway.
- **Nothing else needed:** no API key, no network requests, no saved settings and no `GM_*` calls.
- **ASCII only:** the source is ASCII, with the infinity sign written as `\u221e`. PDA breaks curly quotes, and ASCII avoids that whole class of bug.
- **Changelog:** a `// ===== CHANGELOG =====` block with the 1.0.0 entry.
- **Distribution:** served at `https://tornwar.com/scripts/torn-debuff-mobile-status.user.js`, with its `.meta.js` beside it. The owner pastes it to Greasy Fork, and posts link to the Greasy Fork page.

## Testing

The tests are `server/torn-debuff-mobile-status.test.mjs`, using node:test and linkedom like the Dual Flyout tests. Each test loads the script into a hand-built attack page: two headers, one `playerWindow___` with an `allLayers___` child, and a fake store reached through a `__reactFiber$` key.

- **Numbers:** five cells in order with their labels, `+N%` or `-N%`, the colour class by sign, and a missing stat counted as 0.
- **Effects:**
  - the type, timeLeft and renderMode filter;
  - `hardening_*` drawn as kinetokinesis, and the level suffix;
  - the border colour, and the infinity sign over 300;
  - no icons line when there are no effects, and never any sample icons.
- **Countdown:** it shows `timeLeft` minus the elapsed seconds, drops an icon at 0, and resets when the store sends new numbers. These tests use fake timers.
- **Visibility:**
  - layout "attacker" with one window shows the row;
  - "defender" hides it, and so do two windows;
  - flipping back mounts it in the new window;
  - repeated repaints never duplicate it.
- **Robustness:** with no store, or no `statsModifiers` (or none of the five stats in it), nothing is drawn. With `currentTemporaryEffects: null` the numbers line shows and there is no icons line. Nothing is ever thrown, and an error never reaches Torn's dispatch.
- **Subscribe:** a dispatch that changes nothing the row uses doesn't repaint.

**Live check** on the owner's phone in a real fight:
- the numbers match Torn's own strip in your window (tap your header to compare);
- the icons and seconds match;
- a needle you use shows its icon and its +%;
- the row hides and returns with the header taps;
- it doesn't hide the fight buttons.

## Out of scope

Settings, tooltips, the desktop layout, anything about the enemy, the distraction counter and logging.

## Torn internals this depends on

- The hashed class prefixes `playersModelWrap___`, `playerWindow___` and `allLayers___`, and the `#attack-root` id.
- The `__reactFiber$` key.
- The store field names above, and the two values of `activePlayerLayout`.

All were seen on 2026-10-21, in attack bundle `app.98ee6ed853a50284.js`. If any of them change, the row disappears, and the page itself keeps working.
