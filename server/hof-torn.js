// One Torn API v2 request for /hof and its daily job.
//
// The key travels in the Authorization header, never in the URL, so it can't
// end up in a logged URL. Every call is tagged comment=wb-hof in Torn's own API
// log and recorded in warboard's key-usage log. It never throws: every failure
// comes back as { ok: false, code, message }, and callers do their own retries.
import { logCall } from "./key-usage-log.js";

export async function tornGet(path, params = {}, { key, fetchImpl = fetch, source = "hof", timeoutMs = 30000 } = {}) {
  const url = `https://api.torn.com/v2${path}?${new URLSearchParams({ ...params, comment: "wb-hof" })}`;
  try {
    const res = await fetchImpl(url, {
      headers: { Authorization: `ApiKey ${key}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    const err = tornError(text);
    logCall(key, url, source, err ? err.code : res.status);
    if (err) return { ok: false, code: err.code, message: err.message };
    if (!res.ok) return { ok: false, code: `http_${res.status}`, message: text.slice(0, 200) };
    return { ok: true, status: res.status, text };
  } catch (e) {
    const code = e && (e.name === "TimeoutError" || e.name === "AbortError") ? "timeout" : "network";
    logCall(key, url, source, code);
    return { ok: false, code, message: String((e && e.message) || e) };
  }
}

// Torn reports errors as {"error":{"code":N,"error":"..."}}, usually with HTTP 200.
function tornError(text) {
  if (!text || text.trimStart()[0] !== "{") return null;
  try {
    const j = JSON.parse(text);
    return j && j.error && typeof j.error === "object" ? { code: j.error.code, message: String(j.error.error || "") } : null;
  } catch {
    return null;
  }
}
