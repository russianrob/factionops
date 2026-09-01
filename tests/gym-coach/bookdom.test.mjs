// Reading which stat book you are on, off the page.
//
// Nothing about a stat book reaches the perks payload -- verified live, with an
// empty perks.book array while one was actively being read -- because the four
// stat books award a one-off stat gain rather than an active multiplier. So
// parsePerks structurally cannot see them, and 0.9.44 made it a manual tap.
//
// The status-icon strip under the Life bar does carry it, and carries it ONLY
// in aria-label: not title, not src, not text. Exactly the trap that made the
// first three scans of that area come back empty.
import fs from "fs";
import assert from "assert";
const src = fs.readFileSync("gym-coach-beta.user.js", "utf8");
function grab(n) {
  const i = src.indexOf("function " + n + "(");
  assert.ok(i !== -1, "function " + n + "() is not defined in the script");
  let d = 0;
  for (let k = src.indexOf("{", i); k < src.length; k++) {
    if (src[k] === "{") d++;
    else if (src[k] === "}") { d--; if (!d) return src.slice(i, k + 1); }
  }
}
// Pulled from source, never restated: a sandbox that defines the book names
// shadows production and lets every mutation of them survive.
const BOOKS_SRC = [
  /var STAT_BOOKS = \{[\s\S]*?\n  \};/,
  // The label prefix and the dash set are the parse, so restating either here
  // would shadow production and let every mutation of them survive.
  /var BOOK_LABEL_RE = [^\n]+;/,
  /var BOOK_DASH_RE = [^\n]+;/,
].map(re => { const m = re.exec(src); assert.ok(m, "missing " + re); return m[0]; }).join("\n");

// A minimal stand-in for the strip. `labels` are aria-label values; passing
// null for the row means the strip is not on this page at all.
function domStub(labels) {
  if (labels === null) return { querySelectorAll: () => [], __noStrip: true };
  return { querySelectorAll: (sel) => {
    // The production selector asks for anchors carrying an aria-label inside
    // the status-icon row. Anything else must find nothing.
    if (!/status-icons/.test(sel)) return [];
    return labels.map(l => ({ getAttribute: (a) => (a === "aria-label" ? l : null) }));
  } };
}
const read = (labels, stripPresent = true) => new Function("var R;" + BOOKS_SRC + `
  var DOC = ${JSON.stringify(labels)};
  var STRIP = ${stripPresent};
  var root = {
    querySelectorAll: function (sel) {
      if (/status-icons/.test(sel) && !/aria-label/.test(sel)) return STRIP ? [{}] : [];
      if (!/status-icons/.test(sel)) return [];
      return (DOC || []).map(function (l) {
        return { getAttribute: function (a) { return a === "aria-label" ? l : null; } };
      });
    }
  };
  ${grab("readBookFromDom")}
  R = readBookFromDom(root);
  return R;`)();

let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; console.log("ok   " + n); } catch (e) { fail++; console.log("FAIL " + n + " :: " + e.message); } };

const REAL = "Reading Book: Time Is In The Mind — Increase speed by 5% up to 10m after 31 days";

t("the book being read is identified, with its stat", () => {
  const r = read([REAL]);
  assert.strictEqual(r.found, true);
  assert.strictEqual(r.name, "Time Is In The Mind");
  assert.strictEqual(r.k, "spe");
});

t("all four stat books resolve to their own stat", () => {
  assert.strictEqual(read(["Reading Book: Brawn Over Brains — x"]).k, "str");
  assert.strictEqual(read(["Reading Book: Keeping Your Face Handsome — x"]).k, "def");
  assert.strictEqual(read(["Reading Book: Time Is In The Mind — x"]).k, "spe");
  assert.strictEqual(read(["Reading Book: A Job For Your Hands — x"]).k, "dex");
});

t("the icon is found among a strip full of other effects", () => {
  const r = read([
    "Drug cooldown: 2 hours 14 minutes remaining",
    "Booster cooldown: 43 hours",
    REAL,
    "Donator: you are a donator"
  ]);
  assert.strictEqual(r.k, "spe");
});

t("a book with no effect text after it still gives its name", () => {
  const r = read(["Reading Book: Brawn Over Brains"]);
  assert.strictEqual(r.name, "Brawn Over Brains");
  assert.strictEqual(r.k, "str");
});

t("the name is matched even with NO separator before the effect text", () => {
  // The reported failure. The first sighting of this label was written out as
  // "Reading Book: <name> — <effect>", but the DOM note that followed it read
  // "Reading Book: <name><effect text>" -- no separator at all. Splitting on a
  // dash then hands back the whole sentence, which matches no book, and the
  // feature silently detects nothing.
  //
  // So the name is not PARSED out any more, it is MATCHED: the four names are
  // known, and a label that starts with one is that book whatever follows it.
  const r = read(["Reading Book: Time Is In The MindIncrease speed by 5% up to 10m after 31 days"]);
  assert.strictEqual(r.k, "spe", "no-separator label was not recognised");
  assert.strictEqual(r.name, "Time Is In The Mind", "the name should come back clean, not glued to the effect");
});

t("a label with the effect run straight on still resolves for every book", () => {
  assert.strictEqual(read(["Reading Book: Brawn Over BrainsIncrease strength by 5%"]).k, "str");
  assert.strictEqual(read(["Reading Book: Keeping Your Face HandsomeIncrease defense by 5%"]).k, "def");
  assert.strictEqual(read(["Reading Book: A Job For Your HandsIncrease dexterity by 5%"]).k, "dex");
});

t("every dash Torn might use separates the name from the effect", () => {
  ["—", "–", "-"].forEach(dash => {
    const r = read(["Reading Book: Brawn Over Brains " + dash + " Increase strength by 5%"]);
    assert.strictEqual(r.name, "Brawn Over Brains", "failed on " + JSON.stringify(dash));
    assert.strictEqual(r.k, "str");
  });
});

t("and the dash still does the work for a book that is NOT one of the four", () => {
  // The four stat books are matched by name and need no separator at all. The
  // dash is only load-bearing for everything else, where there is no known name
  // to match and the effect has to be trimmed off some other way.
  ["—", "–", "-"].forEach(dash => {
    const r = read(["Reading Book: Get Hard Or Go Home " + dash + " Increase gym gains by 20%"]);
    assert.strictEqual(r.name, "Get Hard Or Go Home", "failed on " + JSON.stringify(dash));
    assert.strictEqual(r.k, null);
  });
});

t("a book name buried mid-label is not a match", () => {
  // The name has to START the label. Matching it anywhere would let a title
  // that merely mentions one of the four be read as that book.
  const r = read(["Reading Book: Notes On Time Is In The Mind — a commentary"]);
  assert.strictEqual(r.k, null, "a name found mid-label was taken as the book");
  assert.strictEqual(r.found, true);
});

t("the prefix is matched whatever its casing", () => {
  assert.strictEqual(read(["READING BOOK: Brawn Over Brains"]).k, "str");
  assert.strictEqual(read(["reading book: Brawn Over Brains"]).k, "str");
});

t("a NON-stat book is reported by name but claims no stat", () => {
  // "Get Hard Or Go Home" is +20% gym gains for 31 days, not a stat award.
  // Crediting a stat for it would forecast a gain that is never coming.
  const r = read(["Reading Book: Get Hard Or Go Home — Increase gym gains by 20%"]);
  assert.strictEqual(r.found, true);
  assert.strictEqual(r.name, "Get Hard Or Go Home");
  assert.strictEqual(r.k, null);
});

t("a strip with no book says so -- which is NOT the same as no strip", () => {
  // The distinction the whole thing turns on. "There is no book" may clear a
  // stored one; "I could not see the strip" must never touch it.
  const r = read(["Drug cooldown: 2 hours", "Donator: yes"]);
  assert.strictEqual(r.found, false);
  assert.notStrictEqual(r, null);
});

t("no strip at all reads as unknown, not as no book", () => {
  assert.strictEqual(read([], false), null);
  assert.strictEqual(read(null, false), null);
});

t("an anchor with no aria-label is skipped rather than throwing", () => {
  const r = read([null, REAL]);
  assert.strictEqual(r.k, "spe");
});

t("a lookalike label is not mistaken for a book", () => {
  assert.strictEqual(read(["Book club: nothing to see"]).found, false);
  assert.strictEqual(read(["Reading: a newspaper"]).found, false);
});

t("surrounding whitespace does not defeat the name match", () => {
  assert.strictEqual(read(["  Reading Book:   Brawn Over Brains   — x  "]).k, "str");
});

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
