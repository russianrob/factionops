// Publishes the arson recipe database to a public GitHub repo so the
// bang-for-buck userscript can read it from raw.githubusercontent.com instead of
// hitting tornwar.com. Mirrors restock-tracker.js's publish path: GitHub REST
// Contents API PUT with the PAT at data/.ghtoken, committed under a BOT author
// email that is NOT on the account — so these automated pushes never touch the
// human contribution graph. Debounced so a burst of recipe edits = one commit.

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RECIPES_FILE = join(__dirname, "data", "arson-recipes.json");
const TOKEN_FILE = join(__dirname, "data", ".ghtoken");
const REPO = "russianrob/torn-arson-recipes";
const FILE_PATH = "arson-recipes.json";
const GH_API = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;

function ghToken() {
  try { return readFileSync(TOKEN_FILE, "utf-8").trim(); }
  catch (e) { return ""; }
}
function ghHeaders(token) {
  return {
    "Authorization": "Bearer " + token,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "warboard-arson-recipes"
  };
}
async function ghCurrentSha(token) {
  try {
    const r = await fetch(GH_API, { headers: ghHeaders(token) });
    if (!r.ok) return "";
    const j = await r.json();
    return (j && j.sha) || "";
  } catch (e) { return ""; }
}

let _publishing = false;
export async function publishArsonRecipes() {
  if (_publishing) return;
  _publishing = true;
  try {
    const token = ghToken();
    if (!token) { console.error("[arson-gh] publish skipped: no token file"); return; }
    let content;
    try { content = readFileSync(RECIPES_FILE, "utf-8"); }
    catch (e) { console.error("[arson-gh] read recipes failed:", e.message); return; }
    let n = 0;
    try { n = Object.keys((JSON.parse(content).recipes) || {}).length; } catch (e) {}
    const body = {
      message: `update arson recipes (${new Date().toISOString().slice(0, 16)}Z, ${n} recipes)`,
      content: Buffer.from(content).toString("base64"),
      // Bot identity (email NOT on the russianrob account) → GitHub can't attribute
      // these automated pushes to the user, so they never hit the contribution graph.
      author: { name: "arson bot", email: "arson-bot@arson.local" },
      committer: { name: "arson bot", email: "arson-bot@arson.local" }
    };
    const sha = await ghCurrentSha(token);
    if (sha) body.sha = sha;
    const r = await fetch(GH_API, { method: "PUT", headers: ghHeaders(token), body: JSON.stringify(body) });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      console.error("[arson-gh] publish failed:", r.status, t.slice(0, 200));
    } else {
      console.log("[arson-gh] published", n, "recipes to", REPO);
    }
  } catch (e) { console.error("[arson-gh] publish error:", e.message); }
  finally { _publishing = false; }
}

// Debounce: coalesce a burst of edits into a single GitHub commit (~15s after
// the last change). Mirrors the file-save debounce but longer, so the on-disk
// file (1s debounce) is already current when we read + push it.
let _pubTimer = null;
export function scheduleArsonPublish() {
  if (_pubTimer) return;
  _pubTimer = setTimeout(() => {
    _pubTimer = null;
    publishArsonRecipes().catch(() => {});
  }, 15_000);
}
