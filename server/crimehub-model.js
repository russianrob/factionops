// Ported Crimehub OC flowchart success engine. Pure propagation over the
// vendored per-crime graphs (server/crimehub-graphs.json). Reproduces
// Crimehub's client-side simulator: seed each check node's pass rate, walk
// the graph propagating occurrence along P/F edges, sum the "Good" endings.
// Attribution: model + graph data derived from crimeshub-2b4b0.web.app.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
let _graphs = null;
function graphs() {
  return _graphs ||= JSON.parse(readFileSync(join(__dirname, "crimehub-graphs.json"), "utf8"));
}
const _norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s*\(v\d+\)\s*$/, "").trim();
export function graphForScenario(name) {
  const g = graphs();
  const target = _norm(name);
  let bestSlug = null;
  for (const slug in g) {
    if (_norm(g[slug].name) !== target) continue;
    if (!bestSlug || slug > bestSlug) bestSlug = slug; // prefer the latest version (v2 > v1)
  }
  return bestSlug ? g[bestSlug] : null;
}

const idSort = (a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true });

function setMap(graph) {
  const map = {};
  for (const n of [...graph.checks, ...graph.endings].sort(idSort)) {
    if (n.type === "check") map[n.id] = { id: n.id, sources: [], roles: n.data.roles, occurrenceRate: 1 };
    else map[n.id] = { id: n.id, sources: [], text: n.data.text, money: n.data.money, occurrenceRate: 1 };
  }
  for (const e of graph.edges) if (map[e.target]) map[e.target].sources.push(e.id);
  return map;
}

// nodeSuccessRates: { checkId -> 0..1 }. Each check's roles average to its rate.
export function seedFromRoles(graph, passRatesByRole) {
  const rates = {};
  for (const c of graph.checks) {
    const r = c.data.roles || [];
    const vals = r.map((k) => Number(passRatesByRole[k]) || 0);
    rates[c.id] = vals.length ? vals.reduce((a, b) => a + b, 0) / (vals.length * 100) : 0;
  }
  return rates;
}

export function propagate(graph, nodeSuccessRates) {
  const map = setMap(graph);
  const ordered = Object.values(map).sort(idSort);
  for (const a of ordered) if (a.roles) {
    a.successRate = Number(nodeSuccessRates[a.id]) || 0;
    a.failureRate = 1 - a.successRate;
  }
  for (const a of ordered) {
    if (a.id === "A1-C1") continue; // first checkpoint always occurs
    a.occurrenceRate = a.sources.reduce((sum, c) => {
      const b = map[c.slice(0, -1)];
      if (!b) return sum;
      return sum + (c.endsWith("P") ? b.successRate * b.occurrenceRate : b.failureRate * b.occurrenceRate);
    }, 0);
  }
  let successChance = 0, avgReward = 0;
  for (const a of ordered) if (a.text != null) {
    if (a.text[0] === "G") successChance += a.occurrenceRate;
    if (a.money != null) avgReward += a.occurrenceRate * a.money;
  }
  return { successChance, avgReward, expectedReward: successChance ? avgReward / successChance : 0 };
}

export function calculateLocalOutcome(scenarioName, passRatesByRole) {
  const g = graphForScenario(scenarioName);
  if (!g) return { successChance: null, avgReward: null, expectedReward: null, missing: true };
  return propagate(g, seedFromRoles(g, passRatesByRole));
}

// Map slot-order CPRs (as /api/oc/outcome receives them) to {roleKey -> passRate}
// using the crime's vendored roleOrder.
export function slotsToRoles(scenarioName, cprs) {
  const g = graphForScenario(scenarioName);
  if (!g || !Array.isArray(g.roleOrder)) return {};
  const out = {};
  g.roleOrder.forEach((role, i) => { out[role] = Number(cprs[i]); });
  return out;
}
