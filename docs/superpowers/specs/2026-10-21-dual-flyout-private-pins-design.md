# Torn Dual Flyout Private: pinned links (design)

**Status:** approved by the owner on 2026-10-20 (EDT). Rounds 1 and 2 were answered "do the recommended", then "build".
**Script:** `server/public/scripts/torn-dual-flyout-private.user.js` and `.meta.js`, version 1.6.0.

## Why

A player asked for a "both option": "Have the ones I use the most at the top (e.g crimes, targets, gym) and then the side bar for what I don't use very often (forums, properties). I like quick links at the top but sometimes sliding the top bar can be finicky." Without it, they will switch back to Torn's top bar. The owner wants this as part of Torn Dual Flyout, shipped as a private script for testing.

## Decisions

| # | Decision |
|---|---|
| Q1 | A private copy, set up like `factionops-private`: `torn-dual-flyout-private.user.js` plus `.meta.js` on tornwar. @name "Torn Dual Flyout Private", its own @namespace, All Rights Reserved, not on Greasy Fork, updates from its own URL. It is 1.5.16 with the pins added, numbered 1.6.0. The public script (1.5.16, GF #585201) is not touched. Run one or the other. It shares the public script's saved settings and adds one new key, `tdf_pins`. |
| Q2 | The owner tests it first, then gives the player the link. |
| Q3 | The pins get their own full-width row under Torn's header, directly above the energy/nerve strip. |
| Q4 | Links are picked from a checklist in the cog panel. Every top-level menu link can be pinned: Messages, Events, Awards, every area row and every list row. |
| Q5 | Pinned links stay in the menu as well. |
| Q6 | Names under the icons follow the existing Icons only switch: shown when it is off, hidden when it is on. |
| Q7 | Pins that don't fit wrap onto another line. The row never scrolls sideways. |
| Q8 | Pins appear in the order they were ticked. |
| Q9 | Pins follow the menu live: unread counts, and Torn's blue "attention" highlight. |

## Design

### Build and coexistence

The private file is the public 1.5.16 body plus one new section, the pins.
- `window.__tdfVer = "1.6.0"`, matching @version.
- The settings panel title says "Torn Dual Flyout Private", so a tester can see which build is running.

The public script starts with `if (window.__tornMenuRight) return;`, and the private build keeps that flag. Behaviour depends on which copy loads first:
- **Private first.** It sets the flag, and the public copy returns at its first line. Only the private build runs, and nothing clashes.
- **Public first.** The private build finds the flag set. It installs nothing: no styles, no listeners, no row. It shows a one-line, dismissible note at the top of the page: "Torn Dual Flyout Private is off because the public Torn Dual Flyout is also on. Turn the public one off to test this build." The note is plain ASCII, because PDA breaks curly quotes.

### Where the row goes

- **Position:** `#tdf-pins` is inserted directly before `#sidebar [class*="userInformationMobile___"]`, the 60px name/bars strip under the header. TornTools' "Custom Links" uses the same insertion point on phones, in both 9.1.1.1 and upstream as of 2026-10-18.
- **No strip means no row.** Without the strip there is no phone layout, so there is no row. That covers desktop and Torn's top-bar mode.

### Reading the menu

Each source is read inside `#fly-out-panel`. Torn's sidebar build `app.4af34ba3e31baa7e.js`:

| Source | Selector | Name | Count |
|---|---|---|---|
| Account icons | `[class*="accountLinks___"] a[href]` (`#nav-messages`, `#nav-events`, `#nav-awards`) | its `aria-label` minus ", N new" | `[class*="amount___"]` |
| Area and list rows | `[id^="nav-"] > [class*="areaRow___"] > a[href]` | `[class*="linkName___"]` | `[class*="amount___"]` |

- **Matching:** `[class*="amount___"]` is case-sensitive, so it does not match a list row's `listAmount___` member count. That count is left out on purpose: it is a list size, not news.
- **What is skipped:** members a list row expands to show sit outside `areaRow___ > a` and are not matched.
- **Pin key:** the link's `href` with any scheme and host removed, for example `/gym.php` or `/page.php?sid=list&type=targets`.
- **Attention:** the row has `attention___` in its class (`styleStatus` "blue").

### Rendering

- **Pin structure:** each pin is a plain `<a href>` (class `tdf-pin`) with `aria-label` set to the name. It holds:
  - a span with a clone of the menu icon's `<svg>`;
  - a name span (`tdf-pin-name`);
  - a badge span (`tdf-pin-badge`) when the menu link has a count.
  Tapping a pin is an ordinary navigation. Nothing is clicked for the player.
- **Icon fill:** Torn colours its icons with descendant selectors scoped to the menu, for example `.mobile___hMyTx .wrap___ .messages___ svg`. Each clone is therefore given the menu icon's computed `fill` inline. The gradient it points to (`#sidebar_svg_gradient_*`) is defined once in `#sidebarroot`, so the reference still resolves.
- **Attention:** a pin whose row has `attention___` gets the class `tdf-pin-attn`, a light blue tint.
- **Row CSS:**
  - `#tdf-pins` is `display:flex; flex-wrap:wrap`, with no horizontal overflow scrolling.
  - It uses Torn's panel background and text colours through CSS variables (`--default-bg-panel-color`, `--default-color`), so it works in light and dark mode.
  - Pins carry `-webkit-touch-callout:none`, like Torn's own mobile links.
  - `html.tdf-iconsonly #tdf-pins .tdf-pin-name{display:none}`.
- **Order and visibility:** pins render in `tdf_pins` order. A stored key whose link is not in the menu is kept but not drawn. With no drawable pins, the row and the spacer are removed.

### Checklist

The cog panel gains a "Pinned links" section below Icons only and Sticky.
- **Rebuilt each open:** every time the panel opens, the section is rebuilt from the menu. Each line has a tick box, the icon clone and the name. The list is capped at about half the screen height and scrolls vertically.
- **Ticking:** ticking adds the key to the end of `tdf_pins`; unticking removes it. The row redraws immediately.
- **Empty menu:** if the menu has no links yet, the section says "No menu links found yet. Open the menu once, then reopen this panel."

### Live updates and re-insertion

- **Watching the menu:** a MutationObserver watches `#fly-out-panel` (subtree, childList, characterData, attributes `class` and `aria-label`). Each change schedules one redraw 60ms later. The row lives outside the panel, so redrawing it never feeds back into the observer.
- **Skipping unchanged redraws:** each redraw builds a signature from key, name, count, attention and fill, and skips the work when nothing changed.
- **Re-insertion:** the existing 800ms tick, which already re-anchors the cog, also calls the redraw. If React re-renders `#sidebar` and drops the row, the row comes back within a tick.

### Spacer

On phones, TornTools also prepends a `margin-top:17px` div to `.content-wrapper[role="main"]`, equal to its strip's height. That suggests the page content does not move down when something is added to `#sidebar`. This could not be confirmed without the live page.

So the private build measures instead of assuming. After each redraw and each tick:

```
need = clamp(sidebar.bottom - content.top, 0, row.offsetHeight)
```

`#tdf-pins-spacer` gets that `height` (a height, not a margin, so it cannot collapse through its parent). It is the first child of `.content-wrapper[role="main"]`, which keeps `content.top` independent of the spacer.
- **Content that flows down by itself:** the result is 0.
- **Content that stays put:** the result is the row's height.

Measurements are skipped when `getBoundingClientRect` is missing.

### Out of scope

- Hiding pinned links from the menu (Q5: possibly a later toggle).
- Reordering pins any other way than unticking and re-ticking.
- Changing the public script or the GF listing.
- Moving the pins into the public build.

## Testing

`server/torn-dual-flyout-private.test.mjs` (node:test with linkedom) runs the real private script against Torn's menu markup. Set `TDFP_SRC` to test a working copy.
- **Identity:** the header fields; @version matches `__tdfVer`; `.meta.js` matches the `.user.js` header; no curly quotes.
- **Coexistence:** both scripts load in one page, in both orders.
  - Public first: the private build installs nothing and shows the note.
  - Private first: the public copy adds no second stylesheet and no second set of touch listeners.
- **No pins:** no row, no spacer.
- **Pins:**
  - drawn before the bars strip, in tick order;
  - each with the right href, name and inline icon fill;
  - the CSS wraps and never scrolls.
- **Checklist:** it lists every top-level link and no list members. Ticking writes in tick order, unticking removes, and the row follows each change.
- **Icons only:** names are hidden by the CSS rule when the switch is on.
- **Live:** a count or attention change in the menu reaches the row. A row dropped by a re-render is put back by the tick.
- **Spacer:** zero when the content flows below the sidebar; the row's height when the content would sit under it.
- **Old behaviour intact:** the existing `torn-dual-flyout-edge` and `-icons` tests run against the private file with `TDF_SRC`.

Then the owner tries it on their phone, with the public copy switched off and remote inspect on to check the layout, and then the player does.

## Rollout

1. Install the private file at the served path (warboard:warboard, mode 644). No server restart is needed.
2. Send the owner the install link: `https://tornwar.com/scripts/torn-dual-flyout-private.user.js?v=1.6.0`, opened in the app's address bar.
3. The owner checks the row on their phone: where it sits, whether the spacer is right, a tap, wrapping, counts.
4. The owner then gives the player the link.
