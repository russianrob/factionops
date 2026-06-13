// bin/vendor-crimehub-graphs.mjs — run: node bin/vendor-crimehub-graphs.mjs
// One-time vendoring of Crimehub crime graphs (nodes/edges) + setRoles role order.
// Attribution / interop: crimeshub-2b4b0.web.app. Read-only against Crimehub.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "server");
const BASE = "https://crimeshub-2b4b0.web.app/assets/json";
const UA = { headers: { "User-Agent": "warboard-oc/1.0 (+https://tornwar.com; interop with crimeshub-2b4b0.web.app)" } };

// {title, slug, roleOrder} — roleOrder is the KEY order of each crime's setRoles({...})
// call in the bundle main-*.js (object insertion order). slug = title.replace(/\s/g,"").toLowerCase()
// plus an optional v1/v2 suffix (the version arg Crimehub passes to fetchCrimePaths).
// breakthebank & aceinthehole ship as v1/v2 only (no bare slug); their role order differs between versions.
// Guardian Ángels keeps its accented slug (encodeURI -> guardian%C3%A1ngels).
const CRIMES = [
  { title: "Blast From The Past",   slug: "blastfromthepast",   roleOrder: ["Muscle", "Engineer", "Bomber", "Picklock1", "Hacker", "Picklock2"] },
  { title: "Honey Trap",            slug: "honeytrap",          roleOrder: ["Muscle2", "Muscle1", "Enforcer"] },
  { title: "No Reserve",            slug: "noreserve",          roleOrder: ["Techie", "Engineer", "CarThief"] },
  { title: "Bidding War",           slug: "biddingwar",         roleOrder: ["Robber3", "Robber2", "Bomber2", "Driver", "Bomber1", "Robber1"] },
  { title: "Stacking The Deck",     slug: "stackingthedeck",    roleOrder: ["Imitator", "Hacker", "CatBurglar", "Driver"] },
  { title: "Leave No Trace",        slug: "leavenotrace",       roleOrder: ["Imitator", "Negotiator", "Techie"] },
  { title: "Snow Blind",            slug: "snowblind",          roleOrder: ["Hustler", "Imitator", "Muscle1", "Muscle2"] },
  { title: "Market Forces",         slug: "marketforces",       roleOrder: ["Enforcer", "Negotiator", "Muscle", "Lookout", "Arsonist"] },
  { title: "Stage Fright",          slug: "stagefright",        roleOrder: ["Sniper", "Muscle1", "Enforcer", "Muscle3", "Lookout", "Muscle2"] },
  { title: "Smoke And Wing Mirrors", slug: "smokeandwingmirrors", roleOrder: ["CarThief", "Imitator", "Hustler2", "Hustler1"] },
  { title: "Cash Me If You Can",    slug: "cashmeifyoucan",     roleOrder: ["Thief1", "Lookout", "Thief2"] },
  { title: "Mob Mentality",         slug: "mobmentality",       roleOrder: ["Looter1", "Looter2", "Looter4", "Looter3"] },
  { title: "Counter Offer",         slug: "counteroffer",       roleOrder: ["Robber", "Engineer", "Picklock", "Hacker", "Looter"] },
  { title: "Break The Bank",        slug: "breakthebankv1",     roleOrder: ["Muscle3", "Thief2", "Robber", "Muscle1", "Muscle2", "Thief1"] },
  { title: "Break The Bank",        slug: "breakthebankv2",     roleOrder: ["Muscle3", "Thief2", "Muscle1", "Robber", "Muscle2", "Thief1"] },
  { title: "Ace In The Hole",       slug: "aceintheholev1",     roleOrder: ["Hacker", "Driver", "Muscle2", "Muscle1", "Imitator"] },
  { title: "Ace In The Hole",       slug: "aceintheholev2",     roleOrder: ["Hacker", "Imitator", "Muscle2", "Muscle1", "Driver"] },
  { title: "Gaslight The Way",      slug: "gaslighttheway",     roleOrder: ["Imitator3", "Imitator2", "Looter3", "Imitator1", "Looter1", "Looter2"] },
  { title: "Clinical Precision",    slug: "clinicalprecision",  roleOrder: ["Imitator", "Cleaner", "CatBurglar", "Assassin"] },
  { title: "Guardian Ángels",       slug: "guardianángels",     roleOrder: ["Hustler", "Engineer", "Enforcer"] },
  { title: "Sneaky Git Grab",       slug: "sneakygitgrab",      roleOrder: ["Pickpocket", "Imitator", "Techie", "Hacker"] },
  // Crane Reaction, Gone Fission, Manifest Cruelty: graphs not published (SPA returns index.html) — skipped.
];

function trimNodes(arr) {
  return arr.map((n) => n.type === "check"
    ? { id: n.id, type: n.type, data: { roles: n.data?.roles || [] } }
    : n.type === "ending"
      ? { id: n.id, type: n.type, data: { text: n.data?.text, money: n.data?.rewards?.money ?? null } }
      : { id: n.id, type: n.type });
}
const trimEdges = (arr) => arr.map((e) => ({ id: e.id, target: e.target }));

// The web.app SPA returns 200 + index.html for missing assets, so a 200 is not enough —
// require the body to actually be a JSON array.
async function fetchJsonArray(url) {
  const r = await fetch(url, UA);
  if (!r.ok) throw new Error(String(r.status));
  const text = await r.text();
  const trimmed = text.trimStart();
  if (trimmed[0] !== "[") throw new Error("not-json (SPA fallback)");
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("not-array");
  return parsed;
}

const graphs = {}, crosswalk = {};
for (const c of CRIMES) {
  try {
    const slug = encodeURI(c.slug);
    const [checks, paths] = await Promise.all([
      fetchJsonArray(`${BASE}/${slug}_checks.json`),
      fetchJsonArray(`${BASE}/${slug}_paths.json`),
    ]);
    const nodes = trimNodes(checks);
    graphs[c.slug] = {
      name: c.title, roleOrder: c.roleOrder,
      checks: nodes.filter((n) => n.type === "check"),
      endings: nodes.filter((n) => n.type === "ending"),
      edges: trimEdges(paths),
    };
    // crosswalk keyed by title; v1/v2 share a title, last one wins for the bare lookup.
    crosswalk[c.title] = { name: c.title, slug: c.slug, typeid: null };
  } catch (status) {
    console.warn(`skip ${c.slug}: ${status.message || status}`);
  }
}
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "crimehub-graphs.json"), JSON.stringify(graphs));
console.log(`vendored ${Object.keys(graphs).length} crimes`);
