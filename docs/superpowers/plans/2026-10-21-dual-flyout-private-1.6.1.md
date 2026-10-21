# Torn Dual Flyout Private 1.6.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Torn Dual Flyout Private 1.6.1 with four changes:
- a link pinned to the row leaves the fly-out menu;
- the row looks exactly like Torn's own phone top bar;
- the fixes from the 1.6.0 final review;
- the version bump and install.

**Architecture:** Everything is in the one private userscript.
- **Hiding:** a generated `<style id="tdf-pins-hide">` uses `:has()` rules keyed by the pin hrefs the row is drawing. It never touches Torn's elements, and it is in place before Torn draws the menu.
- **Look:** the row copies the CSS and nesting of Torn's legacy phone top bar, from `builds/sidebar-old/app.9a66bbb3a58d33b3.css` and `app.e271f0bc1a478601.js`, read off the owner's phone on 2026-10-21. It uses its own copies of Torn's gradients, and Torn's short names.

**Tech Stack:** ES5 userscript (`@grant none`, `@run-at document-start`); node:test with linkedom for tests; css-what in the tests for a small cascade resolver.

**Spec:**
- `docs/superpowers/specs/2026-10-21-dual-flyout-private-pins-design.md` is the 1.6.0 design. 1.6.1 reverses its Q5 ("pinned links stay in the menu") and replaces its Rendering section.
- The 1.6.1 design was approved in chat on 2026-10-21 at 04:39 CEST ("use recommended answers"). It is copied in the next section.

## The 1.6.1 design (as approved)

**Pinned links leave the menu.** This always applies; there is no setting.
- A pinned link's row disappears from the fly-out, and so do pinned Messages, Events and Awards icons.
- A stylesheet is added before Torn draws the menu, so the links never appear and then vanish.
- They are only hidden while the row is actually showing them. If the row can't be drawn, everything shows in the menu again.
- The checklist still lists every link, so unpinning brings one straight back.
- **Q1:** the empty icon bar hides when every icon in it is pinned. It holds nothing else (`accountLinksWrap___ > accountLinks___ > 3 wraps`, from the fly-out bundle).

**Torn's top-bar look**, copied from Torn's CSS:
- **Bar:** Torn's dark bar with its thin highlight lines, recoloured in jail, in hospital and abroad.
- **Q2:** each link takes a ninth of the width, starting from the left. Lines wrap rather than slide.
- **Icon colours:** grey icons; blue, with Torn's dot, for a highlighted link; white for the page you're on.
- **Q3, labels:** Torn's short names, taken in this order:
  1. Torn's saved sidebar data (`sessionStorage["sidebarData" + uid]`, field `shortName`);
  2. the list copied from the owner's top bar;
  3. the menu name.
- Icons only still hides the names.
- **Counts:** Torn's blue count at the top right of the icon.

**Review fixes** (final review of 42864b84..ac9a19e8):
- Checklist and row icons get their own layer (`translateZ(0)`).
- The spacer is measured at any scroll position.
- A failed save un-ticks the box and says so.
- Pins can't have their text selected.
- Nothing is read while nothing is pinned.
- The aria-label reads "Events, 4 new".
- A pin with no icon keeps its name under Icons only.
- Two test gaps are closed: the observer's options, and the checklist's half-screen cap.

## Global Constraints

- Change only `server/public/scripts/torn-dual-flyout-private.user.js`, `server/public/scripts/torn-dual-flyout-private.meta.js` and `server/torn-dual-flyout-private.test.mjs`.
  - The public `server/public/scripts/torn-dual-flyout.user.js` (1.5.16) must stay byte-identical.
- **Versions:** @version `1.6.1` and `window.__tdfVer = "1.6.1"`. The `.meta.js` header must be identical to the script's.
- **Code style:**
  - ES5 and ASCII only. No curly quotes anywhere, because PDA straightens them and the script stops parsing.
  - `@grant none`.
  - Explanatory `//` comments in the file's existing voice.
- **Behaviour limits:**
  - Nothing is clicked on Torn's behalf; pins are plain `<a href>` links.
  - No network requests. Torn's saved data is read from sessionStorage only.
- **Work in a scratchpad copy:** `/tmp/claude-0/-root/47c424fc-f532-4851-8c7f-7c18d084306c/scratchpad/pins/wc/`. Run the tests with `TDFP_SRC=<that>/torn-dual-flyout-private.user.js`.
  - The served path is live, so install there only in Task 4, as warboard:warboard mode 644.
  - Commits happen in Task 4 for the same reason: committed state = served state.
- Run every test from `/opt/warboard/server`: `node --test torn-dual-flyout-private.test.mjs`.

## Review Focus

1. **Torn's saved sidebar data is missing, unparsable, or shaped differently** (lists as an array, no `shortName`): labels fall back to the built-in names and nothing throws. Test in Task 3.
2. **Ten or more pins:** nine to a line, and the tenth starts a second line. The row never scrolls sideways. Test in Task 3.
3. **Unpinning one of three pinned account icons:** the icon bar comes back, holding that icon. Test in Task 2.
4. **A stored pin value with quotes, braces or backslashes:** it hides nothing but its own link. Test in Task 2.
5. **The player's status changes while the page is open** (for example, out of jail): the bar's colours follow within one redraw. Test in Task 3.

---

### Task 1: Review fixes

**Files:**
- Modify: `wc/torn-dual-flyout-private.user.js`: the pins CSS, `savePins`, `fillPinList`, `pinEl`, `syncSpacer`, `renderPins`
- Test: `server/torn-dual-flyout-private.test.mjs`

**Interfaces:**
- Produces:
  - `savePins(list) -> boolean`: true when written.
  - a `tdf-pin-noicon` class on a pin without an svg.
  - a `.tdf-pins-err` note in `.tdf-pins-list`.
  - the harness options `failSave` and `session`, and observer recording (`observers[i].target` / `.opts`).

- [ ] **Step 1: Harness and failing tests.** Make these changes in the test file:
  - The MO stub records `observe(target, opts)`.
  - `load()` gains `failSave` (setItem throws for `tdf_pins`), `session` (sessionStorage contents) and `strip` (default true), and passes `sessionStorage` into the script.
  - `page()` gains `strip`, `body` and `panelClass` options.

  Then add these tests:

```js
test('the cog panel\'s pin list gives each icon a layer of its own, as the menu does', () => {
  // The list scrolls, and WebKit leaves shadowed icons blank when they scroll into
  // view without one: the same paint bug 1.5.16 fixed in the menu.
  const p = load({ stored: ['/gym.php'] });
  const settings = p.openCog();
  const icons = [...settings.querySelectorAll('.tdf-pins-list .tdf-pin-icon svg')];
  assert.equal(icons.length, 7);
  for (const svg of icons) assert.match(cascade(p.document, svg, 'transform') || '', /translateZ\(0\)/);
  assert.match(cascade(p.document, p.pins()[0].querySelector('svg'), 'transform') || '', /translateZ\(0\)/);
});

test('the spacer is measured part-way down the page too: a row that grows while scrolled gets more room', () => {
  // Torn's header and sidebar scroll with the page (its menu only fixes itself to the
  // screen once the header has gone), so the gap reads the same at any scroll.
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  layout(p, { sidebarBottom: 136, contentTop: 96, rowHeight: 40 });
  p.tick();
  p.win.scrollY = 300;
  layout(p, { sidebarBottom: -124, contentTop: -200, rowHeight: 76 });   // a second line of pins
  p.tick();
  assert.match(spacer(p).getAttribute('style'), /^height:\s*76px;?$/);
});

test('a page that opens already scrolled down still gets its spacer', () => {
  const p = load({ stored: ['/gym.php'] });
  p.win.scrollY = 500;
  p.tick();
  layout(p, { sidebarBottom: -364, contentTop: -404, rowHeight: 40 });
  p.tick();
  assert.match(spacer(p).getAttribute('style'), /^height:\s*40px;?$/);
});

test('a pin that could not be saved is not left looking ticked, and the list says why', () => {
  const p = load({ failSave: true });
  const settings = p.openCog();
  p.tickBox('/gym.php', true);
  assert.equal(settings.querySelector('input[data-key="/gym.php"]').checked, false);
  assert.equal(p.document.getElementById('tdf-pins'), null);
  assert.match(settings.querySelector('.tdf-pins-err').textContent, /Could not save/);
});

test('with nothing pinned, the timer does not even read the menu', () => {
  const p = load();
  let reads = 0;
  const qsa = p.panel.querySelectorAll;
  p.panel.querySelectorAll = function (...a) { reads++; return qsa.apply(this, a); };
  p.tick(); p.mutate();
  assert.equal(reads, 0);
});

test('the row follows every change in the menu: the observer watches the panel, its subtree, text, classes and labels', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  const o = p.observers.find((x) => x.target === p.panel);
  assert.ok(o, 'an observer on #fly-out-panel');
  assert.equal(o.opts.subtree, true);
  assert.equal(o.opts.childList, true);
  assert.equal(o.opts.characterData, true);
  assert.deepEqual([...o.opts.attributeFilter].sort(), ['aria-label', 'class']);
});

test('the cog panel\'s pin list scrolls inside half the screen', () => {
  const p = load();
  const list = p.openCog().querySelector('.tdf-pins-list');
  const css = styledBy(p.document, list);
  assert.equal(css['max-height'], '50vh');
  assert.equal(css['overflow-y'], 'auto');
});

test('a pin reads the way Torn\'s own link does: "Events, 4 new"', () => {
  const p = load({ stored: ['/events.php', '/gym.php'] });
  p.tick();
  assert.deepEqual(p.pins().map((a) => a.getAttribute('aria-label')), ['Events, 4 new', 'Gym']);
});

test('a pin with no icon keeps its name with Icons only on, so it is never an empty box', () => {
  const menu = MENU.replace(/<svg id="forums-icon"[\s\S]*?<\/svg>/, '');
  const p = load({ stored: ['/forums.php', '/gym.php'], iconsOnly: true, menu });
  p.tick();
  const [forums, gym] = p.pins();
  assert.match(forums.className, /tdf-pin-noicon/);
  assert.notEqual(cascade(p.document, forums.querySelector('.tdf-pin-name'), 'display'), 'none');
  assert.equal(cascade(p.document, gym.querySelector('.tdf-pin-name'), 'display'), 'none');
});

test('a long press on a pin does not select its name', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  assert.equal(cascade(p.document, p.pins()[0], 'user-select'), 'none');
  assert.equal(cascade(p.document, p.pins()[0], '-webkit-user-select'), 'none');
});
```

Replace `the spacer is measured at the top of the page only: part-way down, the last answer stands` with the two spacer tests above.

Add the cascade helpers below `styledBy`:

```js
import { parse as parseSelector, stringify as stringifySelector } from 'css-what';
// [ids, classes, types] for one parsed selector, counted the way the cascade counts
// them: :not(), :is() and :has() weigh as much as their weightiest argument.
const cmp = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
function specificity(tokens) {
  const s = [0, 0, 0];
  for (const t of tokens) {
    if (t.type === 'attribute') s[t.name === 'id' && t.ignoreCase === 'quirks' ? 0 : 1]++;
    else if (t.type === 'pseudo' && Array.isArray(t.data)) {
      const best = t.data.map(specificity).reduce((a, b) => (cmp(a, b) >= 0 ? a : b), [0, 0, 0]);
      for (let i = 0; i < 3; i++) s[i] += best[i];
    } else if (t.type === 'pseudo') s[1]++;
    else if (t.type === 'tag' || t.type === 'pseudo-element') s[2]++;
  }
  return s;
}
// The value a browser's cascade gives el for prop from every stylesheet on the page:
// !important first, then specificity, then the later rule. linkedom matches
// selectors but has no cascade. pseudo: 'after' reads the ::after box instead.
function cascade(document, el, prop, pseudo = null) {
  let best = null, order = 0;
  for (const sheet of document.querySelectorAll('style')) {
    for (const [, selectors, body] of sheet.textContent.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      order++;
      const decls = body.split(';').map((d) => d.trim()).filter(Boolean)
        .map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()])
        .filter(([name]) => name === prop);
      if (!decls.length) continue;
      let parsed;
      try { parsed = parseSelector(selectors); } catch { continue; }
      for (const tokens of parsed) {
        const last = tokens[tokens.length - 1];
        const isPseudo = !!last && last.type === 'pseudo-element';
        if (pseudo ? !(isPseudo && last.name === pseudo) : isPseudo) continue;
        let hit = false;
        try { hit = el.matches(stringifySelector([isPseudo ? tokens.slice(0, -1) : tokens])); } catch { hit = false; }
        if (!hit) continue;
        for (const [, raw] of decls) {
          const key = [/!important\s*$/.test(raw) ? 1 : 0, ...specificity(tokens), order];
          if (!best || cmp(key, best.key) >= 0) best = { key, value: raw.replace(/\s*!important\s*$/, '') };
        }
      }
    }
  }
  return best ? best.value : undefined;
}
```

- [ ] **Step 2: Watch them fail.** Run `TDFP_SRC=$WC node --test torn-dual-flyout-private.test.mjs`. Expected:
  - the 8 tests for the fixes fail;
  - the observer test and the half-screen cap test pass straight away. They pin behaviour that already exists, so a mutation check proves them in Task 4 instead.

- [ ] **Step 3: Implement.**
  - In the pins CSS:
    - `.tdf-pin-icon svg` gains `transform:translateZ(0);`;
    - `#tdf-pins .tdf-pin` gains `-webkit-user-select:none;user-select:none;`;
    - the Icons only rule becomes `html.tdf-iconsonly #tdf-pins .tdf-pin:not(.tdf-pin-noicon) .tdf-pin-name{display:none;}`;
    - add `'#tdf-settings .tdf-pins-err{color:#fca5a5;padding:4px 0;}'`.
  - The code:

```js
  function savePins(list) { try { localStorage.setItem(PINS_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }
```

```js
      cb.addEventListener("change", function () {
        setPinned(l.key, cb.checked);
        // Show what was saved, not what was tapped: a full localStorage refuses the write.
        var saved = loadPins().indexOf(l.key) !== -1;
        if (saved !== cb.checked) { cb.checked = saved; saveError(box); }
      });
```

```js
  function saveError(box) {
    if (box.querySelector(".tdf-pins-err")) return;
    var err = document.createElement("div");
    err.className = "tdf-pins-err";
    err.textContent = "Could not save: this browser's storage for Torn is full.";
    box.insertBefore(err, box.firstChild);
  }
```

`pinEl`: add `(link.svg ? "" : " tdf-pin-noicon")` to the class name, and set `aria-label` to `link.count ? link.name + ", " + link.count + " new" : link.name`.

`syncSpacer`: drop the `!(window.scrollY > 0) &&` condition and replace its comment:

```js
    // Torn's header and sidebar scroll with the page (its menu only fixes itself to the
    // screen once the header has scrolled off), so the gap reads the same at any scroll.
    else if (typeof sb.getBoundingClientRect === "function" && typeof content.getBoundingClientRect === "function") {
```

`renderPins`: put a first line after `var row`:

```js
    var keys = loadPins();
    // Nothing pinned: nothing to draw or measure, so the menu is not even read.
    if (!keys.length) { if (row) row.remove(); syncSpacer(null); return; }
```

Then use `keys` where `loadPins()` was.

- [ ] **Step 4: Watch them pass.** Run the file. Expected: 42/42.

### Task 2: Pinned links leave the menu

**Files:**
- Modify: `wc/torn-dual-flyout-private.user.js`: new functions after `syncSpacer`; `renderPins`
- Test: `server/torn-dual-flyout-private.test.mjs`

**Interfaces:**
- Consumes: `loadPins()`, `menuLinks()` and `panel()`.
- Produces:
  - `cssStr(v) -> string`;
  - `hideCss(keys) -> string`;
  - `setHidden(keys)`, which keeps `<style id="tdf-pins-hide">` in step;
  - `dropRow(row)`.

- [ ] **Step 1: Failing tests:**

```js
const hidden = (p, el) => cascade(p.document, el, 'display') === 'none';
const wrapOf = (p, id) => p.document.getElementById(id).parentNode;   // the account icon's own box

test('a pinned link leaves the menu: its row is hidden, the others stay', () => {
  const p = load({ stored: ['/gym.php', TARGETS] });
  p.tick();
  assert.ok(hidden(p, p.document.getElementById('nav-gym')));
  assert.ok(hidden(p, p.document.getElementById('nav-targets_list')));
  for (const id of ['nav-crimes', 'nav-forums']) assert.ok(!hidden(p, p.document.getElementById(id)), id);
  assert.ok(!hidden(p, p.panel));
});

test('pinned Messages / Events / Awards icons leave the menu\'s icon bar one by one', () => {
  const p = load({ stored: ['/messages.php'] });
  p.tick();
  assert.ok(hidden(p, wrapOf(p, 'nav-messages')));
  assert.ok(!hidden(p, wrapOf(p, 'nav-events')));
  assert.ok(!hidden(p, p.document.querySelector('[class*="accountLinksWrap___"]')));
});

test('with all three icons pinned the empty icon bar goes too, even with Icons only on; unpin one and it is back', () => {
  for (const iconsOnly of [false, true]) {
    const p = load({ stored: ['/messages.php', '/events.php', '/awards.php'], iconsOnly });
    p.tick();
    const bar = p.document.querySelector('[class*="accountLinksWrap___"]');
    assert.ok(hidden(p, bar), `icons only ${iconsOnly}`);
    p.openCog();
    p.tickBox('/events.php', false);
    assert.ok(!hidden(p, bar), `bar back, icons only ${iconsOnly}`);
    assert.ok(!hidden(p, wrapOf(p, 'nav-events')));
    assert.ok(hidden(p, wrapOf(p, 'nav-messages')));
  }
});

test('unpinning brings the link straight back to the menu', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  p.openCog();
  p.tickBox('/gym.php', false);
  assert.ok(!hidden(p, p.document.getElementById('nav-gym')));
});

test('pinned links are hidden before Torn draws the menu, so they never flash up in it', () => {
  const p = load({ stored: ['/gym.php'], menu: '' });
  p.tick();
  p.panel.innerHTML = MENU;   // Torn draws the menu; no tick or observer has run yet
  assert.ok(hidden(p, p.document.getElementById('nav-gym')));
  assert.ok(!hidden(p, p.document.getElementById('nav-crimes')));
});

test('without the row (no bars strip on this page), the menu keeps every link', () => {
  const p = load({ stored: ['/gym.php', '/messages.php'], strip: false });
  p.tick();
  assert.equal(p.document.getElementById('tdf-pins'), null);
  assert.ok(!hidden(p, p.document.getElementById('nav-gym')));
  assert.ok(!hidden(p, wrapOf(p, 'nav-messages')));
});

test('a stored value with quotes or braces hides nothing but its own link', () => {
  const p = load({ stored: ['/x"]{}#fly-out-panel *{display:none}\\', '/gym.php'], menu: '' });
  p.tick();
  p.panel.innerHTML = MENU;
  assert.ok(hidden(p, p.document.getElementById('nav-gym')));
  for (const el of p.panel.querySelectorAll('*')) {
    if (el.closest('#nav-gym')) continue;
    assert.ok(!hidden(p, el), el.id || el.className);
  }
});
```

- [ ] **Step 2: Watch them fail.** Expected: the 7 new tests fail.

- [ ] **Step 3: Implement.** Put this after `syncSpacer`:

```js
  // ---- Pinned links leave the menu ----------------------------------------------
  // A link the row is showing is hidden in the menu, so each link lives in one place:
  // its row, its icon among Messages / Events / Awards, and that icon bar itself once
  // every icon in it is pinned. Only while the row shows them: with no row the menu
  // keeps everything. A stylesheet rather than touching Torn's elements, so it is in
  // place before Torn draws the menu (no flash of pinned links) and its re-renders
  // cannot undo it.
  var HIDE_ID = "tdf-pins-hide";
  // A value as a CSS string. Quotes, backslashes, braces and control characters are
  // escaped, so no stored value can end the string or the rule early.
  function cssStr(v) {
    return '"' + String(v).replace(/["\\{}\x00-\x1f\x7f]/g, function (c) { return "\\" + c.charCodeAt(0).toString(16) + " "; }) + '"';
  }
  // The link to key k, written relative ("/gym.php") or absolute (".../torn.com/gym.php").
  function linkTo(k, pre) { return pre + "a[href=" + cssStr(k) + "]," + pre + "a[href$=" + cssStr("torn.com" + k) + "]"; }
  function hideCss(keys) {
    if (!keys.length) return "";
    var P = "html #fly-out-panel ", rules = [], pinned = [], others = "";
    keys.forEach(function (k) {
      rules.push(P + '[id^="nav-"]:has(' + linkTo(k, '> [class*="areaRow___"] > ') + ")");
      rules.push(P + '[class*="accountLinks___"] > :has(' + linkTo(k, "> ") + ")");
      pinned.push(linkTo(k, ""));
      others += ":not([href=" + cssStr(k) + "]):not([href$=" + cssStr("torn.com" + k) + "])";
    });
    // The icon bar: it holds a pinned link and no link that isn't pinned. Weighty
    // enough to beat Icons only's display:block on the same bar.
    rules.push(P + '[class*="accountLinksWrap___"]:has(' + pinned.join(",") + "):not(:has(a[href]" + others + "))");
    return rules.map(function (r) { return r + "{display:none!important;}"; }).join("");
  }
  function setHidden(keys) {
    var css = hideCss(keys), s = document.getElementById(HIDE_ID);
    if (!css) { if (s) s.remove(); return; }
    if (!s) {
      s = document.createElement("style");
      s.id = HIDE_ID;
      (document.head || document.documentElement).appendChild(s);
    }
    if (s.textContent !== css) s.textContent = css;
  }
  function dropRow(row) { if (row) row.remove(); syncSpacer(null); }
```

Then `renderPins` becomes:

```js
  function renderPins() {
    var row = document.getElementById("tdf-pins");
    var keys = loadPins();
    // Nothing pinned: nothing to draw, hide or measure, so the menu is not even read.
    if (!keys.length) { dropRow(row); setHidden([]); return; }
    var links = menuLinks();
    // Torn has not drawn the menu's links yet (the page is still loading): keep the
    // pinned ones hidden, ready for when it does, so they never flash up in it.
    if (!links.length) { dropRow(row); setHidden(keys); return; }
    var strip = document.querySelector('#sidebar [class*="userInformationMobile___"]');
    var byKey = Object.create(null), shown = [];
    links.forEach(function (l) { byKey[l.key] = l; });
    // A pin whose link has left the menu stays remembered, just not drawn.
    keys.forEach(function (k) { if (byKey[k]) shown.push(byKey[k]); });
    // No strip means this is not the phone layout: no row, and then the menu keeps
    // every link, so a pinned link is never missing from both places.
    if (!strip || !shown.length) { dropRow(row); setHidden([]); return; }
    // ...the existing row creation, insertion and signature redraw, unchanged...
    setHidden(shown.map(function (l) { return l.key; }));
    syncSpacer(row);
  }
```

- [ ] **Step 4: Watch them pass.** Expected: 49/49.

### Task 3: Torn's top-bar look

**Files:**
- Modify: `wc/torn-dual-flyout-private.user.js`:
  - the pins CSS block;
  - `menuLinks` (adds `navId` and `on`);
  - `iconClone` and `pinEl`;
  - the end of `renderPins`.
  - Delete `paintOf` and `localUrl`.
  - New: `GRADIENTS`, `ensureDefs`, `SHORT_NAMES`, `tornShortNames`, `shortName` and `userStatus`.
- Test: `server/torn-dual-flyout-private.test.mjs`

**Interfaces:**
- Consumes: `menuLinks()` and `panel()`.
- Produces:
  - **Link fields:** `link.navId` (string, the `nav-` id without the prefix) and `link.on` (boolean).
  - **Functions:** `shortName(link) -> string`, `userStatus() -> "" | "jail" | "hospital" | "travel"`, `ensureDefs()`, and `pinEl(link, label, status)`.
  - **Classes:**
    - on the row: `tdf-pins-<status>`;
    - on a pin: `tdf-pin-on` and `tdf-pin-<status>`;
    - inside a pin: `tdf-pin-row`, `tdf-pin-link` and `tdf-pin-glyph`.
  - **Gradient ids:** `tdf-g-{regular,regular-on,blue,blue-on,jail,hospital,travel,white}`.

- [ ] **Step 1: Failing tests.**
  - Delete `an icon fill the browser reports as a full address ...` and the `FILL`/`SHADOW` constants. Keep the `getComputedStyle` stub (swipes still use it) and drop its `fill` option.
  - Replace `each pin carries its menu icon, coloured the way the menu colours it` with the first test below.
  - Extend the wrap test into the nine-per-line test.
  - Add:

```js
test('each pin carries its menu icon, in Torn\'s top-bar grey with Torn\'s shadow', () => {
  const p = load({ stored: ['/gym.php', '/messages.php'] });
  p.tick();
  for (const a of p.pins()) {
    const svg = a.querySelector('.tdf-pin-icon svg');
    assert.ok(svg, `${a.getAttribute('href')} has an icon`);
    assert.equal(a.querySelector('[id]'), null);   // the copy brings no duplicate ids
    assert.equal(cascade(p.document, svg, 'fill'), 'url(#tdf-g-regular)');
    assert.equal(cascade(p.document, svg, 'filter'), 'drop-shadow(0 0 1.3px #000)');
  }
});

test('the icon colours are Torn\'s own top-bar gradients, defined once in the page', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick(); p.tick(); p.mutate();
  assert.equal(p.document.querySelectorAll('#tdf-pins-defs').length, 1);
  const stops = (id) => [...p.document.querySelectorAll(`#tdf-g-${id} stop`)].map((s) => s.getAttribute('stop-color'));
  assert.deepEqual(stops('regular'), ['#888888', '#666666']);
  assert.deepEqual(stops('regular-on'), ['#DDDDDD', '#AAAAAA']);
  assert.deepEqual(stops('blue'), ['#74C0FC', '#1C7ED6']);
  assert.deepEqual(stops('blue-on'), ['#E7F5FF', '#74C0FC']);
  assert.deepEqual(stops('jail'), ['#BDBCAF', '#8A8973']);
  assert.deepEqual(stops('hospital'), ['#DDDDDD', '#AAAAAA']);
  assert.deepEqual(stops('travel'), ['#8FA6BC', '#5F7F9F']);
  assert.deepEqual(stops('white'), ['#FFFFFF', '#FFFFFF']);
});

test('the row is Torn\'s phone top bar: its dark bar, black edges and highlight lines', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  const row = p.document.getElementById('tdf-pins');
  assert.equal(cascade(p.document, row, 'background'), '#333');
  assert.equal(cascade(p.document, row, 'border-top'), '1px solid #000');
  assert.equal(cascade(p.document, row, 'border-bottom'), '1px solid #000');
  assert.equal(cascade(p.document, row, 'box-shadow'), 'inset 0 1px rgba(255,255,255,.1),0 1px rgba(255,255,255,.1)');
});

test('nine pins to a line from the left, the rest wrap onto the next line, and nothing scrolls sideways', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  const row = p.document.getElementById('tdf-pins'), pin = p.pins()[0];
  assert.equal(cascade(p.document, row, 'display'), 'flex');
  assert.equal(cascade(p.document, row, 'flex-wrap'), 'wrap');
  assert.equal(cascade(p.document, row, 'justify-content'), 'flex-start');
  for (const prop of ['overflow', 'overflow-x']) assert.doesNotMatch(cascade(p.document, row, prop) || '', /auto|scroll/);
  for (const prop of ['flex', 'width', 'max-width']) assert.match(cascade(p.document, pin, prop), /calc\(100% \/ 9\)/);
});

test('each pin is built like Torn\'s link: 2px sides, a 40px row, a 34 x 23 icon box and a 6px capital name', () => {
  const p = load({ stored: ['/gym.php'] });
  p.tick();
  const a = p.pins()[0], c = (el, prop) => cascade(p.document, el, prop);
  assert.equal(c(a, 'padding'), '0 2px');
  assert.equal(c(a, 'font-size'), '6px');
  assert.equal(c(a, 'font-weight'), '700');
  assert.equal(c(a, 'text-transform'), 'uppercase');
  assert.equal(c(a, 'color'), '#999');
  assert.equal(c(a.querySelector('.tdf-pin-row'), 'max-width'), '40px');
  assert.equal(c(a.querySelector('.tdf-pin-link'), 'margin'), '4px 0');
  assert.equal(c(a.querySelector('.tdf-pin-icon'), 'width'), '34px');
  assert.equal(c(a.querySelector('.tdf-pin-icon'), 'height'), '23px');
  assert.equal(c(a.querySelector('.tdf-pin-name'), 'line-height'), '7px');
  assert.equal(c(a.querySelector('.tdf-pin-name'), 'white-space'), 'nowrap');
});

test('pins carry Torn\'s short names: Torn\'s own copy first, then the built-in list, then the menu name', () => {
  const extra = areaRow('hall_of_fame', '/page.php?sid=hof', 'Hall of Fame') + areaRow('education', '/page.php?sid=education', 'Education') +
    areaRow('recruit_citizens', '/recruit.php', 'Recruit Citizens');
  const menu = MENU.replace(areaRow('forums', '/forums.php', 'Forums'), areaRow('forums', '/forums.php', 'Forums') + extra);
  const stored = ['/page.php?sid=hof', '/page.php?sid=education', '/recruit.php', '/gym.php'];
  const builtIn = load({ stored, menu });
  builtIn.tick();
  assert.deepEqual(builtIn.pins().map((a) => a.querySelector('.tdf-pin-name').textContent), ['HOF', 'edu', 'Recruit Citizens', 'Gym']);
  const torn = load({ stored, menu, session: { sidebarData137558: JSON.stringify({ areas: { gym: { name: 'Gym', shortName: 'Gym!' }, recruit_citizens: { shortName: 'recruit' } } }) } });
  torn.tick();
  assert.deepEqual(torn.pins().map((a) => a.querySelector('.tdf-pin-name').textContent), ['HOF', 'edu', 'recruit', 'Gym!']);
});

test('Torn\'s saved data in a shape we do not expect just falls back to the built-in names', () => {
  for (const raw of ['{oops', '[]', 'null', JSON.stringify({ areas: [{ shortName: 'X' }], lists: 5 }), JSON.stringify({ areas: { gym: { shortName: 7 } } })]) {
    const p = load({ stored: ['/gym.php', '/page.php?sid=list&type=targets'], session: { sidebarData1: raw } });
    p.tick();
    assert.deepEqual(p.pins().map((a) => a.querySelector('.tdf-pin-name').textContent), ['Gym', 'Targets'], raw);
  }
});

test('a highlighted link is Torn\'s blue: name, icon and dot', () => {
  const p = load({ stored: ['/gym.php'] });
  p.document.getElementById('nav-gym').classList.add('attention___DT8nN');
  p.tick();
  const a = p.pins()[0];
  assert.equal(cascade(p.document, a, 'color'), '#74c0fc');
  assert.equal(cascade(p.document, a.querySelector('svg'), 'fill'), 'url(#tdf-g-blue)');
  assert.equal(cascade(p.document, a, 'background', 'after'), 'linear-gradient(#74c0fc,#1c7ed6)');
  assert.equal(cascade(p.document, a, 'top', 'after'), '2px');
  assert.equal(cascade(p.document, a, 'right', 'after'), '4px');
});

test('the page you are on is white', () => {
  const p = load({ stored: ['/gym.php', '/forums.php'] });
  p.document.getElementById('nav-gym').classList.add('active___xlAlO');
  p.tick();
  const [gym, forums] = p.pins();
  assert.match(gym.className, /tdf-pin-on/);
  assert.equal(cascade(p.document, gym, 'color'), '#fff');
  assert.equal(cascade(p.document, gym.querySelector('svg'), 'fill'), 'url(#tdf-g-regular-on)');
  assert.doesNotMatch(forums.className, /tdf-pin-on/);
});

test('counts are Torn\'s blue numbers at the top right of the icon', () => {
  const p = load({ stored: ['/events.php'] });
  p.tick();
  const badge = p.pins()[0].querySelector('.tdf-pin-badge'), c = (prop) => cascade(p.document, badge, prop);
  assert.equal(badge.parentNode.className, 'tdf-pin-row');
  assert.equal(c('color'), '#74c0fc');
  assert.equal(c('position'), 'absolute');
  assert.equal(c('top'), '-1px');
  assert.equal(c('right'), '-3px');
  assert.equal(c('font'), '700 10px/8px Arial,Helvetica,sans-serif');
});

test('in jail, in hospital and abroad the bar takes Torn\'s colours', () => {
  const bg = (opts) => { const p = load({ stored: ['/gym.php'], ...opts }); p.tick(); return [p, cascade(p.document, p.document.getElementById('tdf-pins'), 'background')]; };
  let [p, b] = bg({ panelClass: 'inJail___vh7Jg' });
  assert.equal(b, '#353526');
  assert.equal(cascade(p.document, p.pins()[0], 'color'), '#bdbdae');
  assert.equal(cascade(p.document, p.pins()[0].querySelector('svg'), 'fill'), 'url(#tdf-g-jail)');
  [, b] = bg({ panelClass: 'inJail___vh7Jg', body: 'class="dark-mode"' });
  assert.equal(b, '#242415');
  [p, b] = bg({ panelClass: 'inHospital___bjnEe' });
  assert.equal(b, '#3b3b3b');
  assert.equal(cascade(p.document, p.pins()[0], 'color'), '#ddd');
  assert.equal(cascade(p.document, p.pins()[0].querySelector('svg'), 'fill'), 'url(#tdf-g-hospital)');
  [, b] = bg({ body: 'data-abroad="true"' });
  assert.equal(b, '#26333f');
  [, b] = bg({ body: 'data-abroad="true"', panelClass: 'inHospital___bjnEe' });
  assert.equal(b, '#3b3b3b');
  const menu = MENU.replace(/defaultIcon___GnL0d mobile___nUzYc/g, 'defaultIcon___GnL0d mobile___nUzYc travel___VRg89');
  [p] = bg({ menu });
  assert.equal(cascade(p.document, p.pins()[0].querySelector('svg'), 'fill'), 'url(#tdf-g-travel)');
});

test('blue wins over the jail tint on the icon, as on Torn\'s bar', () => {
  const p = load({ stored: ['/gym.php'], panelClass: 'inJail___vh7Jg' });
  p.document.getElementById('nav-gym').classList.add('attention___DT8nN');
  p.tick();
  const a = p.pins()[0];
  assert.equal(cascade(p.document, a.querySelector('svg'), 'fill'), 'url(#tdf-g-blue)');
  assert.equal(cascade(p.document, a.querySelector('svg'), 'filter'), 'drop-shadow(0 1px 1.3px #000)');
  assert.equal(cascade(p.document, a, 'color'), '#bdbdae');
});

test('the bar follows the player\'s status live: out of jail, back to Torn\'s grey', () => {
  const p = load({ stored: ['/gym.php'], panelClass: 'inJail___vh7Jg' });
  p.tick();
  assert.match(p.document.getElementById('tdf-pins').className, /tdf-pins-jail/);
  p.panel.classList.remove('inJail___vh7Jg');
  p.mutate();
  const row = p.document.getElementById('tdf-pins');
  assert.doesNotMatch(row.className, /tdf-pins-jail/);
  assert.equal(cascade(p.document, row, 'background'), '#333');
  assert.doesNotMatch(p.pins()[0].className, /tdf-pin-jail/);
});
```

- [ ] **Step 2: Watch them fail.** Expected: the 14 new or changed tests fail.

- [ ] **Step 3: Implement.** Replace the whole pins CSS block, from the `// Pinned links:` comment to just before `// The cog panel's pin list scrolls`, with this:

```js
    // Pinned links: a row under Torn's phone header, drawn the way Torn's own phone top
    // bar draws its links (its sidebar-old stylesheet, read off the owner's phone on
    // 2026-10-21): the same dark bar, nine links to a screen width, Torn's short names,
    // counts and colours. It wraps onto another line rather than ever sliding
    // sideways: the sliding is what the player found finicky about Torn's bar.
    '#tdf-pins{display:flex;flex-wrap:wrap;justify-content:flex-start;align-items:center;box-sizing:border-box;width:100%;margin:0;padding:0;' +
    'position:relative;z-index:100;background:#333;border-top:1px solid #000;border-bottom:1px solid #000;' +
    'box-shadow:inset 0 1px rgba(255,255,255,.1),0 1px rgba(255,255,255,.1);font-family:Arial,Helvetica,sans-serif;' +
    '-webkit-user-select:none;user-select:none;}' +
    '#tdf-pins.tdf-pins-jail{background:#353526;}' +
    'body.dark-mode #tdf-pins.tdf-pins-jail{background:#242415;}' +
    '#tdf-pins.tdf-pins-hospital{background:#3b3b3b;}' +
    'body[data-abroad="true"] #tdf-pins:not(.tdf-pins-jail):not(.tdf-pins-hospital){background:#26333f;}' +
    // A pin is one of Torn's slides (a ninth of the width, 2px either side) holding the
    // same nesting as Torn's link: a 40px row, then the link with its icon and name.
    '#tdf-pins .tdf-pin{position:relative;display:block;box-sizing:border-box;flex:0 0 calc(100% / 9);width:calc(100% / 9);' +
    'max-width:calc(100% / 9);padding:0 2px;text-align:center;color:#999;font-size:6px;font-weight:700;text-transform:uppercase;' +
    'text-decoration:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;}' +
    '#tdf-pins .tdf-pin-row{display:block;position:relative;max-width:40px;margin:0 auto;}' +
    '#tdf-pins .tdf-pin-link{display:flex;flex-direction:column;align-items:center;margin:4px 0;padding:0;}' +
    '.tdf-pin-icon{display:flex;flex-direction:row;justify-content:center;align-items:center;width:34px;height:23px;}' +
    '.tdf-pin-glyph,#tdf-pins .tdf-pin-name{display:block;white-space:nowrap;line-height:7px;}' +
    '#tdf-pins .tdf-pin-name{max-width:100%;overflow:hidden;text-overflow:ellipsis;}' +
    '#tdf-pins .tdf-pin-badge{position:absolute;top:-1px;right:-3px;width:14px;text-align:center;letter-spacing:-1px;color:#74c0fc;' +
    'font:700 10px/8px Arial,Helvetica,sans-serif;}' +
    // Names, in the order Torn's own rules run: the page you are on is white, Torn's
    // blue "something here" is blue, and jail and hospital have tints of their own.
    '#tdf-pins .tdf-pin.tdf-pin-on{color:#fff;}' +
    '#tdf-pins .tdf-pin.tdf-pin-attn{color:#74c0fc;}' +
    '#tdf-pins .tdf-pin.tdf-pin-attn.tdf-pin-on{color:#d0ebff;}' +
    '#tdf-pins .tdf-pin.tdf-pin-jail{color:#bdbdae;}' +
    '#tdf-pins .tdf-pin.tdf-pin-hospital{color:#ddd;}' +
    '#tdf-pins .tdf-pin.tdf-pin-hospital.tdf-pin-on{color:#fff;}' +
    // Torn's blue dot on a highlighted link.
    '#tdf-pins .tdf-pin.tdf-pin-attn::after{content:"";display:block;position:absolute;top:2px;right:4px;width:6px;height:6px;' +
    'border-radius:100%;background:linear-gradient(#74c0fc,#1c7ed6);box-shadow:0 1px rgba(0,0,0,.25);}' +
    '#tdf-pins .tdf-pin.tdf-pin-attn.tdf-pin-on::after{background:linear-gradient(#e7f5ff,#74c0fc);}' +
    // Icons: Torn's top-bar gradients (copies, see ensureDefs) and shadows, rule for rule
    // in Torn's order. Each icon also gets a layer of its own, as the menu's do (above):
    // the cog panel's pin list scrolls, and WebKit leaves shadowed icons blank when they
    // scroll into view without one.
    '.tdf-pin-icon svg{max-width:34px;max-height:34px;overflow:visible;fill:url(#tdf-g-regular);filter:drop-shadow(0 0 1.3px #000);transform:translateZ(0);}' +
    '#tdf-pins .tdf-pin.tdf-pin-on .tdf-pin-icon svg{fill:url(#tdf-g-regular-on);filter:drop-shadow(0 0 1px rgba(255,255,255,.5));}' +
    '#tdf-pins .tdf-pin.tdf-pin-attn .tdf-pin-icon svg,#tdf-pins .tdf-pin.tdf-pin-hospital.tdf-pin-attn .tdf-pin-icon svg,' +
    '#tdf-pins .tdf-pin.tdf-pin-jail.tdf-pin-attn .tdf-pin-icon svg,#tdf-pins .tdf-pin.tdf-pin-travel.tdf-pin-attn .tdf-pin-icon svg{fill:url(#tdf-g-blue);}' +
    '#tdf-pins .tdf-pin.tdf-pin-attn.tdf-pin-on .tdf-pin-icon svg,#tdf-pins .tdf-pin.tdf-pin-hospital.tdf-pin-attn.tdf-pin-on .tdf-pin-icon svg,' +
    '#tdf-pins .tdf-pin.tdf-pin-jail.tdf-pin-attn.tdf-pin-on .tdf-pin-icon svg,#tdf-pins .tdf-pin.tdf-pin-travel.tdf-pin-attn.tdf-pin-on .tdf-pin-icon svg{fill:url(#tdf-g-blue-on);}' +
    '#tdf-pins .tdf-pin.tdf-pin-attn.tdf-pin-on .tdf-pin-icon svg,#tdf-pins .tdf-pin.tdf-pin-jail.tdf-pin-attn.tdf-pin-on .tdf-pin-icon svg{filter:none;}' +
    '#tdf-pins .tdf-pin.tdf-pin-jail .tdf-pin-icon svg{fill:url(#tdf-g-jail);filter:drop-shadow(0 1px 1.3px #000);}' +
    '#tdf-pins .tdf-pin.tdf-pin-jail.tdf-pin-on .tdf-pin-icon svg{fill:url(#tdf-g-white);filter:drop-shadow(0 1px 1.3px #fff);}' +
    '#tdf-pins .tdf-pin.tdf-pin-hospital .tdf-pin-icon svg{fill:url(#tdf-g-hospital);filter:drop-shadow(0 1px 1.3px #000);}' +
    '#tdf-pins .tdf-pin.tdf-pin-hospital.tdf-pin-on .tdf-pin-icon svg,#tdf-pins .tdf-pin.tdf-pin-travel.tdf-pin-on .tdf-pin-icon svg{fill:url(#tdf-g-white);filter:none;}' +
    '#tdf-pins .tdf-pin.tdf-pin-travel .tdf-pin-icon svg{fill:url(#tdf-g-travel);filter:drop-shadow(0 1px 1.3px #000);}' +
    '#tdf-settings .tdf-pin-icon svg{max-height:23px;}' +
    // Icons only hides the names, as it does in the menu; a pin with no icon keeps its
    // name, so it is never an empty box.
    'html.tdf-iconsonly #tdf-pins .tdf-pin:not(.tdf-pin-noicon) .tdf-pin-name{display:none;}' +
```

Then the code:

```js
  // Torn's own short names for its phone top bar, by menu id, as that bar printed them
  // on the owner's phone (2026-10-21). Torn's own copy, when the page has it, comes
  // first (tornShortNames); a link in neither keeps its menu name.
  var SHORT_NAMES = {
    messages: "Messages", events: "Events", awards: "Awards", faction_armory: "Armory", faction_controls: "Controls",
    home: "home", items: "Items", gym: "Gym", property_vault: "Vault", crimes: "Crimes", city: "City", job: "job",
    education: "edu", faction: "faction", missions: "Missions", newspaper: "News", jail: "Jail", hospital: "Hospital",
    casino: "Casino", hall_of_fame: "HOF", forums: "Forums", properties: "property", calendar: "calendar",
    enemies_list: "Enemies", friends_list: "Friends", targets_list: "Targets", poker: "Poker"
  };
  // Torn keeps its sidebar data for the tab in sessionStorage ("sidebarData" plus the
  // player id), short names included. Parsed again only when Torn has rewritten it.
  var shortRaw = null, shortTorn = Object.create(null);
  function tornShortNames() {
    var raw = null, m, i, k;
    try {
      m = /(?:^|;\s*)uid=(\d+)/.exec(document.cookie || "");
      if (m) raw = sessionStorage.getItem("sidebarData" + m[1]);
      for (i = 0; !raw && i < sessionStorage.length; i++) {
        k = sessionStorage.key(i);
        if (/^sidebarData\d*$/.test(k)) raw = sessionStorage.getItem(k);
      }
    } catch (e) { raw = null; }
    if (raw === shortRaw) return shortTorn;
    shortRaw = raw;
    shortTorn = Object.create(null);
    try {
      var d = raw ? JSON.parse(raw) : null;
      ["areas", "lists", "account"].forEach(function (g) {
        var grp = d && d[g];
        if (!grp || typeof grp !== "object" || Array.isArray(grp)) return;
        Object.keys(grp).forEach(function (key) {
          var v = grp[key];
          if (v && typeof v.shortName === "string" && v.shortName.trim()) shortTorn[key] = v.shortName.trim();
        });
      });
    } catch (e) {}
    return shortTorn;
  }
  function shortName(link) {
    var t = tornShortNames(), id = link.navId;
    return (id && (t[id] || t[id.replace(/_list$/, "")] || SHORT_NAMES[id])) || link.name;
  }
  // Torn tints its top bar while the player is in jail, in hospital or travelling. The
  // menu says which: the panel's inJail___ / inHospital___ classes, travel___ icons.
  function userStatus() {
    var p = panel();
    if (!p) return "";
    if (/inJail___/.test(p.className)) return "jail";
    if (/inHospital___/.test(p.className)) return "hospital";
    if (p.querySelector('[class*="defaultIcon___"][class*="travel___"]')) return "travel";
    return "";
  }
  // Torn's top-bar gradients, copied stop for stop from its sidebar-old build. Ours, not
  // Torn's: the menu build defines only some of them, and only while it is drawn.
  var GRADIENTS = [["regular", "#888888", "#666666"], ["regular-on", "#DDDDDD", "#AAAAAA"], ["blue", "#74C0FC", "#1C7ED6"],
    ["blue-on", "#E7F5FF", "#74C0FC"], ["jail", "#BDBCAF", "#8A8973"], ["hospital", "#DDDDDD", "#AAAAAA"],
    ["travel", "#8FA6BC", "#5F7F9F"], ["white", "#FFFFFF", "#FFFFFF"]];
  function ensureDefs() {
    if (document.getElementById("tdf-pins-defs") || !document.body) return;
    var d = document.createElement("div");
    d.id = "tdf-pins-defs";
    d.setAttribute("aria-hidden", "true");
    // Out of sight but not display:none, which would stop the gradients painting.
    d.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden;");
    d.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"><defs>' + GRADIENTS.map(function (g) {
      return '<linearGradient id="tdf-g-' + g[0] + '" gradientUnits="objectBoundingBox" gradientTransform="rotate(90)">' +
        '<stop offset="0" stop-color="' + g[1] + '"></stop><stop offset="1" stop-color="' + g[2] + '"></stop></linearGradient>';
    }).join("") + "</defs></svg>";
    document.body.appendChild(d);
  }
```

`menuLinks` gains:

```js
        navId: row ? row.id.slice(4) : "",
        // The page the player is on: Torn marks its row (or icon) active___.
        on: /(^|\s)active___/.test(a.className) || (!!row && /(^|\s)active___/.test(row.className)),
```

`iconClone` drops the paint copy and wraps the svg in a `tdf-pin-glyph` span. `pinEl(link, label, status)` builds `a.tdf-pin > span.tdf-pin-row > [span.tdf-pin-badge] + span.tdf-pin-link > (icon + span.tdf-pin-name)`. Its class name is `tdf-pin` plus:
- `tdf-pin-attn`, `tdf-pin-on`, `tdf-pin-<status>`;
- `tdf-pin-noicon` when there's no svg.

The end of `renderPins` calls `ensureDefs()`. It computes `status = userStatus()` and `labels = shown.map(shortName)`. The signature is `[status, ...[key, label, name, count, attn, on, !!svg]]`. On rebuild it sets `row.className = status ? "tdf-pins-" + status : ""`. `fillPinList` calls `ensureDefs()` before drawing the list.

- [ ] **Step 4: Watch them pass.** Expected: every test in the file passes.

### Task 4: Ship 1.6.1

**Files:**
- Modify: `wc/torn-dual-flyout-private.user.js` (@version, `__tdfVer`), `wc/torn-dual-flyout-private.meta.js`, and the test file (the version asserts).
- Install: `server/public/scripts/torn-dual-flyout-private.user.js` and `.meta.js`.

- [ ] **Step 1:** The header test and the private-first test expect `1.6.1`. Run them and watch them fail.
- [ ] **Step 2:** `curl -s https://tornwar.com/scripts/torn-dual-flyout-private.meta.js` must still say 1.6.0, so 1.6.1 is next. Then bump @version and `__tdfVer`, and regenerate `.meta.js` from the header.
- [ ] **Step 3:** Verify:
  - the private file passes;
  - `TDF_SRC=$WC node --test torn-dual-flyout-edge.test.mjs torn-dual-flyout-icons.test.mjs` passes;
  - `node --test` from `/opt/warboard/server` passes, compared with the 1839-test baseline;
  - `git diff --quiet server/public/scripts/torn-dual-flyout.user.js` shows nothing;
  - `grep -P '[\x{2018}\x{2019}\x{201C}\x{201D}]'` finds nothing.
- [ ] **Step 4:** Mutation checks on copies in `pins/mut/`, each run with `TDFP_SRC`. Each must turn the suite red:
  - drop `transform:translateZ(0)` from `.tdf-pin-icon svg`;
  - put back the scrollY guard;
  - drop `setHidden(keys)` from the "menu not drawn yet" branch;
  - drop `cssStr` escaping;
  - drop the `:not(:has(...))` part of the icon-bar rule;
  - swap the jail rule above the blue rule.
- [ ] **Step 5:** Install with `install -o warboard -g warboard -m 644`. `cmp` against the served bytes (`curl`), and check the served `@version` is 1.6.1.
- [ ] **Step 6:** Commit the plan, script, meta and test with the trailer. Push.
- [ ] **Step 7:** Run a final Opus review of the range (read-only) and act on Critical or Important findings test-first. Give the owner the URL `https://tornwar.com/scripts/torn-dual-flyout-private.user.js?v=1.6.1` and a phone checklist:
  - Torn back in fly-out mode;
  - the row against the top bar;
  - the pinned links gone from the menu;
  - the checklist scrolled to the bottom (icons drawn);
  - light mode, plus jail or hospital if handy;
  - remote-inspect reads of the `#sidebar` position and `sessionStorage` `shortName`.
