// Builds the estimate behind /hof's long paces, once, from a pull of Torn's
// public chain and ranked-war records. Design:
// docs/superpowers/specs/2026-10-22-hof-long-pace-windows-design.md.
//
//   node bin/hof-estimate-build.mjs --replies DIR --factions FILE --own CSV \
//     --from YYYY-MM-DD --fit YYYY-MM-DD --out FILE
//
// DIR holds Torn v2 replies named chains-<id>-p<n>.json, rankedwars-<id>.json
// and report-<warId>.json. FILE lists the factions ({ rule, factions: [{ id }] }).
// CSV is our own faction's series, rebuilt from its own records (day,R_est,...).
// The anchor is the oldest saved day file, and the fit runs to --fit. It
// reads the saved day files and writes only --out.
import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { addDays, dayMs } from "../hof-climb.js";
import { estimateSeries, estimatesFile, missingRecords } from "../hof-estimate.js";

const US = String(process.env.OWNER_FACTION_ID || "42055");
const args = Object.fromEntries(process.argv.slice(2).reduce((out, a, i, all) =>
  (a.startsWith("--") ? [...out, [a.slice(2), all[i + 1]]] : out), []));
for (const k of ["replies", "factions", "own", "from", "fit", "out"]) {
  if (!args[k]) { console.error(`missing --${k}`); process.exit(1); }
}
// The same folder the daily job uses (hof-snapshots.js), without importing it.
const hofDir = join(process.env.DATA_DIR || join(dirname(fileURLToPath(import.meta.url)), "..", "data"), "hof");
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const reply = (name) => (existsSync(join(args.replies, `${name}.json`)) ? readJson(join(args.replies, `${name}.json`)) : null);

const days = readdirSync(join(hofDir, "days")).filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).map((n) => n.slice(0, 10)).sort();
const anchorDay = days[0];
const anchor = readJson(join(hofDir, "days", `${anchorDay}.json`)).respect;
const fit = readJson(join(hofDir, "days", `${args.fit}.json`)).respect;
const fromS = dayMs(args.from) / 1000, fitS = dayMs(args.fit) / 1000;

const list = readJson(args.factions);
const series = {};
for (const { id } of list.factions) {
  if (String(id) === US) continue;
  const chainPages = [];
  for (let p = 1, page; (page = reply(`chains-${id}-p${p}`)); p++) chainPages.push(page.chains || []);
  const wars = reply(`rankedwars-${id}`);
  const warList = wars ? wars.rankedwars || [] : null;
  const rewards = {};
  for (const w of warList || []) {
    const side = ((reply(`report-${w.id}`) || {}).rankedwarreport?.factions || []).find((f) => String(f.id) === String(id));
    if (side) rewards[w.id] = side.rewards.respect;
  }
  const why = missingRecords({ chainPages, warList, rewards, fromS, fitS });
  if (why) { console.log(`${id}: left out: ${why}`); continue; }
  if (!(anchor[id] > 0) || !(fit[id] > 0)) { console.log(`${id}: left out: not in the saved days`); continue; }
  // Each page runs up to the oldest start on the page before, so the chain
  // where two pages meet comes back twice; it counts once.
  const chains = [...new Map(chainPages.flat().map((c) => [c.id, c])).values()];
  const s = estimateSeries({ id, chains, wars: warList, rewards, anchorDay, anchorRespect: anchor[id],
    fitDay: args.fit, fitRespect: fit[id], from: args.from });
  if (!s) { console.log(`${id}: left out: the records can't explain it (they add up to more than it gained, or a day comes out at 0 or below)`); continue; }
  series[id] = s.days;
  console.log(`${id}: u ${Math.round(s.u)}/day, ${chains.length} chains, ${warList.length} wars, ` +
    `${anchorDay} back to ${args.from}: ${s.days[args.from]}`);
}

// Our own faction comes from its own records, which are far tighter. A gap
// would drop a window for that day without a word, so it is refused.
const own = {};
for (const line of readFileSync(args.own, "utf8").trim().split("\n").slice(1)) {
  const [d, r] = line.split(",");
  own[d] = Number(r);
}
series[US] = {};
for (let d = args.from; d < anchorDay; d = addDays(d, 1)) {
  if (!(own[d] > 0)) { console.error(`our own series has no ${d}`); process.exit(1); }
  series[US][d] = Math.round(own[d]);
}

const file = estimatesFile({ series, builtAt: Date.now(), anchorDay, fitDay: args.fit, band: list.rule });
const tmp = `${args.out}.tmp-${process.pid}`;
writeFileSync(tmp, JSON.stringify(file));
renameSync(tmp, args.out);
console.log(`wrote ${args.out}: ${file.factions} factions, ${Object.keys(file.days).length} days`);
