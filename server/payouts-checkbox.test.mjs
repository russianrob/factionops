// The Warlord checkbox has to be tickable.
//
// The payouts page styles every input at once:
//
//     input,select{ ... -webkit-appearance:none; appearance:none; }
//     input{width:100%; margin:8px 0;}
//
// appearance:none strips a checkbox's native rendering entirely, so it draws
// as an empty rounded box with no tick and gives no feedback when clicked —
// which is indistinguishable from a control that does not work. The rule was
// written for text and number fields, which are the only inputs this page had
// until now.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SRC = fs.readFileSync(new URL("./routes.js", import.meta.url), "utf8");
const PAGE = (() => {
  const i = SRC.indexOf("const PAYOUTS_HTML = `");
  const start = SRC.indexOf("`", i) + 1;
  let j = start;
  while (j < SRC.length) {
    if (SRC[j] === "\\") { j += 2; continue; }
    if (SRC[j] === "`") break;
    j++;
  }
  return SRC.slice(start, j);
})();

const rule = PAGE.match(/input\[type=checkbox\][^{]*\{[^}]*\}/);

test("checkboxes get their native rendering back", () => {
  assert.ok(rule, "no checkbox rule at all — the blanket appearance:none still applies");
  assert.match(rule[0], /appearance\s*:\s*auto/, "appearance is still suppressed: " + rule[0]);
});

test("and are not stretched to the full width of the panel", () => {
  assert.match(rule[0], /width\s*:\s*auto/, "still inheriting input{width:100%}: " + rule[0]);
});

test("the rule comes after the blanket one, or it loses", () => {
  // Same specificity would be a coin toss; this is a plain ordering question.
  const blanket = PAGE.indexOf("appearance:none");
  assert.ok(blanket >= 0, "the blanket rule should still exist for text fields");
  assert.ok(PAGE.indexOf(rule[0]) > blanket,
    "the checkbox rule is declared before the rule it has to override");
});

test("the checkbox is still in the settings panel and still unticked", () => {
  assert.match(PAGE, /id="s-warlord"/);
  assert.ok(!/id="s-warlord"[^>]*\bchecked\b/.test(PAGE),
    "it must not ship pre-ticked — that would move money by default");
});
