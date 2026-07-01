// agent-relay-client.js
import { readFileSync } from "node:fs";

const DEFAULT_TOKEN_FILE = process.env.INSPECT_TOKEN_FILE || "/opt/warboard/server/data/.inspect-token";
export function defaultToken() { return readFileSync(DEFAULT_TOKEN_FILE, "utf8").trim(); }

// Enqueue a command: POST /api/inspect/cmd with the operator token (routes.js:401).
async function enqueue(fetchImpl, base, token, cmd) {
  const r = await fetchImpl(base + "/api/inspect/cmd", {
    method: "POST",
    headers: { "x-inspect-token": token, "content-type": "application/json" },
    body: JSON.stringify(cmd),
  });
  return r.json();
}
// Drain results: GET /api/inspect/result with the operator token (routes.js:425).
async function drainResults(fetchImpl, base, token) {
  const r = await fetchImpl(base + "/api/inspect/result", {
    method: "GET",
    headers: { "x-inspect-token": token },
  });
  return r.json();
}

export async function runJsOnDevice(js, opts = {}) {
  const { base = "http://localhost:3000", token = defaultToken(), timeoutMs = 15000,
          fetchImpl = fetch, sleepImpl = (ms) => new Promise((s) => setTimeout(s, ms)) } = opts;
  const q = await enqueue(fetchImpl, base, token, { js });
  const id = q && q.id;
  if (!id) return { error: "relay did not accept command" };
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await drainResults(fetchImpl, base, token);
    const hit = (r.results || []).find((x) => x.id === id);
    if (hit) return hit.error ? { error: String(hit.error) } : { value: hit.result != null ? String(hit.result) : "null" };
    await sleepImpl(700);
  }
  return { error: "timeout waiting for device (is the Warboard app foregrounded with inspect armed?)" };
}

export async function screenshotDevice(opts = {}) {
  const { base = "http://localhost:3000", token = defaultToken(), fetchImpl = fetch } = opts;
  const q = await enqueue(fetchImpl, base, token, { action: "screenshot" });
  return q && q.id ? { ref: q.id } : { error: "screenshot request rejected" };
}
