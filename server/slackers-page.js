// The slackers page is plain HTML on disk rather than a template literal in a
// route, for two reasons: its own client-side JS is full of backticks and
// ${...}, which a literal would turn into an escaping minefield, and the markup
// is easier to work on as markup.
//
// It lives in server/pages/ and NOT in server/public/ — public is served
// statically, and this page is admin-only. The page itself carries no member
// data (it fetches /api/admin/slackers, which has its own gate), but serving it
// only behind the cookie keeps the two halves consistent.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(__dirname, "pages", "slackers.html");

let cached = null;
let cachedMtime = 0;

export function renderSlackersPage() {
  // Re-read when the file changes so an edit shows up without a restart, but
  // stay off the disk on every request.
  const mtime = fs.statSync(PAGE).mtimeMs;
  if (!cached || mtime !== cachedMtime) {
    cached = fs.readFileSync(PAGE, "utf8");
    cachedMtime = mtime;
  }
  return cached;
}
