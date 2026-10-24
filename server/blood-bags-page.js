// The /bloodbags page is plain HTML on disk rather than a template literal in a
// route, as /slackers is: its own script is full of quotes and braces, and the
// markup is easier to work on as markup. It lives in server/pages/, not
// server/public/, and holds no member data: every number arrives from
// /api/bloodbags, which is where the membership check is.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(__dirname, "pages", "bloodbags.html");

let cached = null;
let cachedMtime = 0;

export function renderBloodBagsPage() {
  // Read again when the file changes, so an edit shows without a restart, but
  // stay off the disk on every request.
  const mtime = fs.statSync(PAGE).mtimeMs;
  if (!cached || mtime !== cachedMtime) {
    cached = fs.readFileSync(PAGE, "utf8");
    cachedMtime = mtime;
  }
  return cached;
}
