// agent-service.js
import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join as pathJoin, basename as pathBasename } from "node:path";
import { runJsOnDevice } from "./agent-relay-client.js";

// Where the deployable userscripts live (SERVED verbatim by the static mount).
const SCRIPTS_DIR = process.env.AGENT_SCRIPTS_DIR || "/opt/warboard/server/public/scripts";
const INSTRUCTIONS_DIR = process.env.AGENT_INSTRUCTIONS_DIR || "/opt/warboard/server/data/agent-instructions";

// Runs as the non-root `warboard` server user, so no root guard / IS_SANDBOX is
// needed. CLAUDE is the world-executable copy (warboard can't read /root). HOME
// points at warboard's isolated agent home holding its own long-lived token.
const CLAUDE = process.env.CLAUDE_BIN || "/usr/local/bin/claude";
// cwd is deliberately OUTSIDE the /opt/warboard git tree: Claude walks up from
// cwd to the git root loading CLAUDE.md/AGENTS.md, so a repo cwd dragged
// /opt/warboard's CLAUDE.md+AGENTS.md into every turn (~1k tokens). A bare dir
// with no CLAUDE.md ancestors keeps the turn context clean.
const WORKDIR = process.env.AGENT_WORKDIR || "/opt/warboard-agent";
const AGENT_HOME = process.env.AGENT_HOME || "/opt/warboard/server/data/agent-home";
// warboard's own long-lived Claude token (setup-token), read per-turn so rotation is picked up.
const TOKEN_FILE = process.env.AGENT_CLAUDE_TOKEN_FILE || "/opt/warboard/server/data/.agent-claude-token";
function agentToken() { try { return readFileSync(TOKEN_FILE, "utf8").trim(); } catch { return ""; } }
// Give the child a CLEAN, minimal env — do NOT inherit the warboard server's env.
// The server was started from inside a Claude Code session, so its env carries
// CLAUDECODE / CLAUDE_CODE_* (session id, entrypoint, tmpdir, …) plus lots of
// server vars; inheriting any of it makes the spawned agent hang (it thinks it's
// a nested session). Only what claude needs: PATH, HOME (isolated config), the
// OAuth token, locale/tmp.
function childEnv() {
  return {
    PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    HOME: AGENT_HOME,
    USER: "warboard",
    LOGNAME: "warboard",
    LANG: process.env.LANG || "C.UTF-8",
    TMPDIR: "/tmp",
    CLAUDE_CODE_OAUTH_TOKEN: agentToken(),
  };
}
// Page access is via SNAPSHOT INJECTION (not MCP): headless -p fires the model
// turn before a per-invocation stdio MCP server finishes connecting, so live MCP
// tools don't reliably reach the turn. Instead we grab the page state via the
// relay and prepend it to the prompt; the agent has NO tools.
// Runs in the page world via the inspect relay; returns a JSON snapshot. Beyond
// url/title/text it adds a depth-capped DOM skeleton (structure, not full HTML)
// and recent console errors from the owner-only capture hook (window.__wbInspect).
export const SNAPSHOT_JS = `
var o = { url: location.href, title: document.title };
try { o.text = ((document.body && document.body.innerText) || "").replace(/\\s+/g, " ").trim().slice(0, 4000); } catch (e) { o.text = ""; }
try { var p = document.getElementById("fly-out-panel"); if (p) o.flyoutOpen = /visible___/.test(p.className); } catch (e) {}
try {
  var out = [];
  (function walk(el, depth) {
    if (!el || depth > 4 || out.length >= 80) return;
    for (var i = 0; i < el.children.length; i++) {
      if (out.length >= 80) break;
      var c = el.children[i], tag = (c.tagName || "").toLowerCase();
      if (!tag || tag === "script" || tag === "style" || tag === "svg" || tag === "noscript" || tag === "link") continue;
      var id = c.id ? ("#" + c.id) : "";
      var cls = (typeof c.className === "string" && c.className.trim()) ? ("." + c.className.trim().split(/\\s+/).slice(0, 2).join(".")) : "";
      out.push(new Array(depth + 1).join("  ") + tag + id + cls);
      walk(c, depth + 1);
    }
  })(document.body, 0);
  if (out.length) o.skeleton = out.join("\\n");
} catch (e) {}
try { if (window.__wbInspect && window.__wbInspect.console && window.__wbInspect.console.length) o.console = window.__wbInspect.console.slice(-15); } catch (e) {}
return JSON.stringify(o);
`;
const SYSTEM_PROMPT = process.env.AGENT_SYSTEM_PROMPT || "You are an assistant embedded in the Warboard iOS app, helping the owner (a Torn player and userscript developer) with the Torn game and their userscripts. You have NO tools: you cannot run code, read or write files, browse the web, or take any action. Some messages begin with a STANDING INSTRUCTIONS section — persistent directions the owner has saved; treat them as high-priority and ALWAYS follow them. Each message is then prefixed with a SNAPSHOT of the user's CURRENT Torn page (URL, title, visible text, a compact DOM skeleton, and recent console errors/warnings if any), then a USERSCRIPTS section (plus the full source of any script the owner named). Its FIRST line tells you what the list is: when the app sends its installed manifest the list is the owner's ACTUAL installed set (you may reference it and its count); otherwise it is only their server-side collection, which is NOT proof anything is installed. Trust that header line. Use that context plus your knowledge of Torn and web/userscript development to answer. If you need information not in the context, say what you'd want to see rather than inventing it. Never claim to have run a tool, executed code, or taken an action.\n\nINSPECTING THE PAGE: The snapshot is limited. When you need more — an element's full HTML, a computed style, the value of a JS expression, console or network detail — you may request ONE read-only JavaScript query. Output a line that is EXACTLY `===INSPECT===` then a fenced code block whose body is a JS expression or IIFE that RETURNS a value (e.g. `document.querySelector('.rw-timer').outerHTML`, or `(function(){return getComputedStyle(document.querySelector('#x')).width})()`). The owner reviews and approves it before it runs on THEIR page; you then receive the result and continue — answer, or request another query. STRICTLY READ-ONLY: never click, submit, focus, navigate, or mutate the page, storage, or cookies. Keep results small — target a specific element, not the whole document. Put at most ONE `===INSPECT===` block per reply, as the last thing in your message, and never combine it with a `===FILE:===` proposal in the same reply.\n\nREADING SCRIPT SOURCE: The USERSCRIPTS section lists the installed scripts but includes full source only for ones named in the message. To read ANY installed script's current full source, output a line EXACTLY `===SOURCE: <filename>===` (the bare basename from the list, e.g. `===SOURCE: torn-dual-flyout.user.js===`). It is fetched automatically and you continue with the source — no owner approval, since it's the owner's own script. ALWAYS read a script's current source this way BEFORE proposing a `===FILE:===` edit to it, so your edit is based on the real current file.\n\nSAVING STANDING INSTRUCTIONS: When the owner tells you to 'always' do something, to 'remember' a preference, or otherwise gives you a persistent directive that should apply to future chats (e.g. 'always check for bugs we can use for the bug bounty'), SAVE it as a standing-instruction file so it survives across conversations. Propose it exactly like a script edit but with a MARKDOWN filename: a line that is EXACTLY `===FILE: <short-kebab-name>.md===` (a bare `*.md` basename, e.g. `always-check-bug-bounty.md`) immediately followed by a fenced code block containing the instruction written as plain Markdown. Do NOT add a `==UserScript==` header or an `@version` — it is a plain `.md` file, not a script. Precede it with a one-line summary of what you're saving. The owner approves it via the same Apply card; once approved it appears in your STANDING INSTRUCTIONS section at the top of every future turn. To change or remove an instruction, propose the SAME filename again with the full new content. Only ONE proposal per reply, as the last thing in your message.\n\nEDITING USERSCRIPTS: You may help the owner edit a userscript, but you only PROPOSE changes — the owner reviews and deploys them. When you propose a change to a script, output the COMPLETE new file (not a diff, not a snippet). Immediately precede it with a line that is EXACTLY `===FILE: <filename>===` (the bare basename, e.g. `===FILE: torn-green-nav.user.js===`), then a fenced code block containing the whole file. Keep the existing `==UserScript==` header intact and BUMP the `@version` (increment the patch number). The owner does NOT see the raw ===FILE: block in the chat — it is hidden and routed to an Apply card (with an optional file viewer) — so ALWAYS precede it with a clear plain-language summary of WHAT you changed and WHY. The owner approves by tapping 'Approve & install'. In the current Warboard app this INSTALLS the script on-device — it is added to their Scripts manager and runs on the next Torn page load — and also saves a backup copy to their server collection. So you MAY tell the owner that approving will install it and that they should RELOAD the Torn page for it to take effect. You still only PROPOSE; the owner's approval is what installs it, so don't claim it is installed until they've approved. Only include ONE such proposal per reply, as the last thing in your message.";
// SECURITY: deny EVERY built-in tool so the agent has NO tools at all. Validated
// live: with this list the agent's tool set is empty. An allow-list does NOT
// restrict under default mode; only this complete --disallowed-tools under
// bypassPermissions blocks. init tools[] isn't exhaustive — deny Glob/Grep too.
const DISALLOWED = ["Task","Bash","CronCreate","CronDelete","CronList","DesignSync","Edit","EnterWorktree","ExitWorktree","Monitor","NotebookEdit","PushNotification","Read","RemoteTrigger","ReportFindings","ScheduleWakeup","SendMessage","Skill","TaskCreate","TaskGet","TaskList","TaskOutput","TaskStop","TaskUpdate","ToolSearch","WebFetch","WebSearch","Workflow","Write","Glob","Grep"];
const TURN_TIMEOUT_MS = Number(process.env.AGENT_TURN_TIMEOUT_MS || 180000);
// Fast-fail: if the model connects (emits init) but streams no assistant text
// within this window, it's stalled (e.g. Opus overloaded) — trigger a fallback
// to FALLBACK_MODEL instead of hanging to the 180s cap (which iOS drops as
// "network connection lost").
const FIRST_TOKEN_TIMEOUT_MS = Number(process.env.AGENT_FIRST_TOKEN_TIMEOUT_MS || 30000);
// Pin Opus (the OAuth token defaults to Sonnet). --bare (added to args) strips
// hooks/auto-memory/CLAUDE.md discovery so /opt/warboard's CLAUDE.md+AGENTS.md and
// the SessionStart memory dump don't bloat every turn's context (pure quota waste).
const MODEL = process.env.AGENT_MODEL || "claude-opus-4-8";
// Used when MODEL stalls (no first token in FIRST_TOKEN_TIMEOUT_MS) — Opus gets
// overloaded/rate-limited more than Sonnet, so fall back so the agent keeps working.
const FALLBACK_MODEL = process.env.AGENT_FALLBACK_MODEL || "claude-sonnet-4-6";

// Pull a single `// @field  value` line out of a ==UserScript== header.
function headerField(content, field) {
  const m = String(content || "").match(new RegExp("^//\\s*@" + field + "\\s+(.+?)\\s*$", "m"));
  return m ? m[1].trim() : "";
}

// True only when `token` appears in `text` as a standalone identifier (not as a
// substring of a longer script name, e.g. "arson-bang-for-buck" inside
// "arson-bang-for-buck-live"). `-`, `.`, `_`, word chars are treated as part of
// an identifier so the boundaries land at whitespace / punctuation.
function mentioned(text, token) {
  if (!token) return false;
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(?<![\\w.-])" + esc + "(?![\\w.-])").test(text);
}

// Build the `=== USERSCRIPTS ===` context block. Always lists every *.user.js in
// `dir` with its @name/@version; injects the FULL source ONLY for scripts the
// owner NAMED in `userText` (by filename or basename-without-.user.js). `dir` is
// injectable for tests.
export function userscriptContext(userText, arg) {
  const text = String(userText || "");

  // Preferred path: the app-provided installed manifest (the REAL installed set).
  if (Array.isArray(arg) && arg.length) {
    const lines = ["The owner's installed userscripts (" + arg.length + "):"];
    const named = [];
    for (const s of arg) {
      const f = String((s && s.filename) || "").trim();
      if (!f) continue;
      const name = String((s && s.name) || "(no @name)");
      const version = String((s && s.version) || "?");
      const disabled = s && s.enabled === false ? " [disabled]" : "";
      const desc = s && s.description ? " — " + String(s.description).slice(0, 80) : "";
      lines.push("- " + f + " — " + name + " (v" + version + ")" + disabled + desc);
      const base = f.replace(/\.user\.js$/, "");
      if (mentioned(text, f) || mentioned(text, base)) named.push({ f, content: String((s && s.source) || "") });
    }
    for (const { f, content } of named) lines.push("", "=== FULL SOURCE: " + f + " ===", content);
    return lines.join("\n");
  }

  // Fallback: no manifest (older app build) — the owner's served directory.
  const dir = typeof arg === "string" ? arg : SCRIPTS_DIR;
  let files;
  try { files = readdirSync(dir).filter((f) => f.endsWith(".user.js")).sort(); }
  catch (e) { return "(userscript list unavailable: " + String(e && e.message || e) + ")"; }
  if (!files.length) return "(no userscripts found)";
  const lines = ["The owner's userscripts on the Warboard server (" + files.length + ") — the owner's own published collection, NOT the set installed or running in their browser/app:"];
  const named = [];
  for (const f of files) {
    let content = "";
    try { content = readFileSync(pathJoin(dir, f), "utf8"); } catch {}
    const name = headerField(content, "name") || "(no @name)";
    const version = headerField(content, "version") || "?";
    const desc = headerField(content, "description");
    lines.push("- " + f + " — " + name + " (v" + version + ")" + (desc ? " — " + desc.slice(0, 80) : ""));
    const base = f.replace(/\.user\.js$/, "");
    if (mentioned(text, f) || mentioned(text, base)) named.push({ f, content });
  }
  for (const { f, content } of named) lines.push("", "=== FULL SOURCE: " + f + " ===", content);
  return lines.join("\n");
}

// Parse the agent's proposal protocol out of its final assistant text: the LAST
// `===FILE: <name>===` line immediately followed by a fenced ```...``` block.
// Returns { filename (basename only), content } or null.
export function parseProposal(text) {
  const s = String(text || "");
  const re = /===FILE:[ \t]*([^\n=]+?)[ \t]*===[ \t]*\r?\n+```[^\n]*\r?\n([\s\S]*?)\r?\n?```/g;
  let m, last = null;
  while ((m = re.exec(s)) !== null) last = m;
  if (!last) return null;
  const filename = pathBasename(last[1].trim());
  if (!filename) return null;
  return { filename, content: last[2] };
}

// Detect an agent inspect request: a `===INSPECT===` line followed by a fenced
// code block holding a read-only JS query. Returns { js } or null. The owner
// approves it before it runs (routes.js /api/agent/inspect) — this only extracts.
export function parseInspect(text) {
  const s = String(text || "");
  const re = /===INSPECT===[ \t]*\r?\n+```[^\n]*\r?\n([\s\S]*?)\r?\n?```/g;
  let m, last = null;
  while ((m = re.exec(s)) !== null) last = m;
  if (!last) return null;
  const js = last[1].trim();
  if (!js) return null;
  return { js };
}

// Parse an agent request to read a script's full source: `===SOURCE: <name>===`.
// Auto-fulfilled server-side (reading the owner's own installed script is a safe
// read-only file read — no approval, unlike a page inspect). Returns { filename }.
export function parseSource(text) {
  const s = String(text || "");
  const re = /===SOURCE:[ \t]*([^\n=]+?)[ \t]*===/g;
  let m, last = null;
  while ((m = re.exec(s)) !== null) last = m;
  if (!last) return null;
  const filename = pathBasename(last[1].trim());
  if (!filename) return null;
  return { filename };
}

// Read an installed script's source from SCRIPTS_DIR, path-jailed via the bare-
// basename validator (rejects separators / traversal). Returns source or null.
export function readScriptSource(filename) {
  if (!isValidUserscriptName(filename)) return null;
  try { return readFileSync(pathJoin(SCRIPTS_DIR, filename), "utf8"); } catch { return null; }
}

// Resolve a `===SOURCE: <name>===` request. Prefer the app-provided installed
// manifest (matched by basename, so ANY installed script is readable — even one
// installed from Greasy Fork that the server has never seen), then fall back to
// the served directory (agent-created scripts backed up there).
export function resolveScriptSource(filename, installed) {
  if (Array.isArray(installed)) {
    const base = pathBasename(String(filename || ""));
    const hit = installed.find((s) => s && pathBasename(String(s.filename || "")) === base);
    if (hit && typeof hit.source === "string" && hit.source) return hit.source;
  }
  return readScriptSource(filename);
}

// Deploy path-jail: a deployable userscript name is a bare basename ending in
// `.user.js` with no path separators / `..` traversal. Exported for the deploy
// route + tests.
export function isValidUserscriptName(name) {
  return typeof name === "string" && /^[a-zA-Z0-9._-]+\.user\.js$/.test(name);
}

// A deployable standing-instruction file: a bare *.md basename. These are saved
// to INSTRUCTIONS_DIR (not served) and read into every turn by standingInstructions().
export function isValidInstructionsName(name) {
  return typeof name === "string" && /^[a-zA-Z0-9._-]+\.md$/.test(name);
}

// Concatenate all *.md standing-instruction files (owner-approved), capped, for
// injection at the top of every turn's prompt.
export function standingInstructions(dir = INSTRUCTIONS_DIR) {
  let out = "";
  try {
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".md")).sort()) {
      try { out += "## " + f + "\n" + readFileSync(pathJoin(dir, f), "utf8").trim() + "\n\n"; } catch {}
      if (out.length > 8000) break;
    }
  } catch {}
  return out.trim().slice(0, 8000);
}

export function normalizeStreamLine(o) {
  if (!o || typeof o !== "object") return null;
  if (o.type === "system") {
    if (o.subtype === "init") return { t: "session", id: o.session_id };
    return null; // hook_started/hook_response/status/thinking_tokens → ignore
  }
  if (o.type === "stream_event" && o.event) {
    const ev = o.event;
    if (ev.type === "content_block_delta" && ev.delta) {
      if (ev.delta.type === "text_delta") return { t: "delta", text: ev.delta.text || "" };
      if (ev.delta.type === "thinking_delta") return { t: "thinking" };
    }
    return null;
  }
  if (o.type === "assistant" && o.message && Array.isArray(o.message.content)) {
    const tool = o.message.content.find((c) => c.type === "tool_use");
    if (tool) return { t: "tool", name: tool.name, phase: "start" };
    return null;
  }
  if (o.type === "user" && o.message && Array.isArray(o.message.content)) {
    const tr = o.message.content.find((c) => c.type === "tool_result");
    if (tr) return { t: "tool_result", ok: !tr.is_error };
    return null;
  }
  if (o.type === "rate_limit_event") return { t: "rate", status: o.rate_limit_info?.status, resetsAt: o.rate_limit_info?.resetsAt };
  if (o.type === "result") return { t: "done", ok: !o.is_error, result: o.result ?? "" };
  return null;
}

// Assemble the per-turn prompt: standing instructions + page snapshot +
// (optionally) the USERSCRIPTS block built from the app's installed manifest +
// the user message. Pure/injectable so it is unit-testable without spawning.
export function buildTurnPrompt({ snap, text, installed, skipUserscripts }) {
  const instr = standingInstructions();
  return (instr ? "=== STANDING INSTRUCTIONS FROM THE OWNER (persistent — always follow) ===\n" + instr + "\n\n" : "") +
    "=== CURRENT TORN PAGE SNAPSHOT ===\n" + snap +
    (skipUserscripts ? "" : "\n\n=== USERSCRIPTS ===\n" + userscriptContext(text, installed)) +
    "\n\n=== USER MESSAGE ===\n" + String(text);
}

export async function runAgentTurn({ text, sessionId, onEvent, signal, skipUserscripts, installed }) {
  let snap;
  try {
    const r = await runJsOnDevice(SNAPSHOT_JS, { timeoutMs: 8000 });
    snap = r.error ? ("(page snapshot unavailable: " + r.error + ")") : (r.value || "(empty)");
  } catch (e) { snap = "(page snapshot error: " + String(e) + ")"; }
  if (onEvent) onEvent({ t: "snapshot", ok: !/unavailable|error/.test(snap) });
  const prompt = buildTurnPrompt({ snap, text, installed, skipUserscripts });
  const baseArgs = ["--print", prompt,
    "--output-format", "stream-json", "--verbose", "--include-partial-messages",
    "--append-system-prompt", SYSTEM_PROMPT,
    "--permission-mode", "bypassPermissions",
    "--disallowed-tools", ...DISALLOWED];

  // iOS persists the sessionId across launches so the agent remembers past
  // turns (--resume). But a stale id (server session gone) makes claude fail
  // fast: "No conversation found", exit 1, NO init event — which would brick
  // every future turn. So `attempt()` buffers events until the init/`session`
  // event proves the process actually started; if a --resume run dies before
  // init, we discard its output and transparently retry WITHOUT --resume (fresh
  // session). The turn still answers — memory is lost, not the turn.
  let currentChild = null;
  // Seed from the signal's CURRENT state: a signal already aborted before this
  // listener registers (the client disconnected during the snapshot fetch above)
  // never fires "abort", so without the seed both spawns would run to completion
  // for a client that is already gone.
  let aborted = !!(signal && signal.aborted);
  if (signal) signal.addEventListener("abort", () => { aborted = true; if (currentChild) currentChild.kill("SIGKILL"); }, { once: true });

  const attempt = (useResume, model) => new Promise((resolve) => {
    if (aborted) { resolve({ retry: false, resolvedSession: (useResume && sessionId) ? sessionId : null }); return; }
    const args = baseArgs.slice();
    args.push("--model", model);
    if (useResume && sessionId) args.push("--resume", sessionId);
    const child = spawn(CLAUDE, args, { cwd: WORKDIR, env: childEnv(), stdio: ["ignore", "pipe", "pipe"] });
    currentChild = child;
    let resolvedSession = (useResume && sessionId) ? sessionId : null;
    let buf = "";
    let assistantText = "";
    let sawInit = false;
    let stalled = false;
    let pending = [];                                  // held until init proves startup
    const flush = () => { for (const ev of pending) onEvent(ev); pending = []; };
    const forward = (ev) => { if (sawInit) onEvent(ev); else pending.push(ev); };
    const killTimer = setTimeout(() => { forward({ t: "error", message: "agent turn timed out" }); child.kill("SIGKILL"); }, TURN_TIMEOUT_MS);
    // No assistant output within FIRST_TOKEN_TIMEOUT_MS = the model is stalled
    // (Opus overload/limit). Kill so the caller can fall back to another model.
    let firstTokenTimer = setTimeout(() => { stalled = true; child.kill("SIGKILL"); }, FIRST_TOKEN_TIMEOUT_MS);
    const gotOutput = () => { if (firstTokenTimer) { clearTimeout(firstTokenTimer); firstTokenTimer = null; } };
    child.stdout.on("data", (d) => {
      buf += d.toString();
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line) continue;
        let obj; try { obj = JSON.parse(line); } catch { continue; }
        const ev = normalizeStreamLine(obj);
        if (!ev) continue;
        if (ev.t === "session") { sawInit = true; resolvedSession = ev.id; onEvent(ev); flush(); continue; }
        if (ev.t === "delta" || ev.t === "thinking") gotOutput();
        if (ev.t === "delta") assistantText += ev.text || "";
        if (ev.t === "done") {
          const full = assistantText || ev.result || "";
          const src = parseSource(full);
          if (src) forward({ t: "sourceRequest", filename: src.filename });
          const insp = parseInspect(full);
          if (insp) forward({ t: "inspectRequest", js: insp.js });
          const prop = parseProposal(full);
          if (prop) forward({ t: "proposal", filename: prop.filename, content: prop.content });
        }
        forward(ev);
      }
    });
    child.stderr.on("data", (d) => forward({ t: "stderr", text: d.toString().slice(0, 500) }));
    child.on("close", () => {
      clearTimeout(killTimer);
      if (firstTokenTimer) { clearTimeout(firstTokenTimer); firstTokenTimer = null; }
      if (currentChild === child) currentChild = null;
      // Stalled (no first token in the window) → tell the caller to fall back to another model.
      if (stalled && !aborted) { resolve({ stalled: true, resolvedSession: null }); return; }
      // A --resume run that never reached init = stale session → drop its output, signal retry.
      if (!sawInit && useResume && !aborted) { resolve({ retry: true, resolvedSession: null }); return; }
      flush();
      resolve({ retry: false, resolvedSession });
    });
    child.on("error", (e) => {
      clearTimeout(killTimer);
      if (firstTokenTimer) { clearTimeout(firstTokenTimer); firstTokenTimer = null; }
      if (currentChild === child) currentChild = null;
      forward({ t: "error", message: String(e) });
      flush();
      resolve({ retry: false, resolvedSession });
    });
  });

  let r = await attempt(!!sessionId, MODEL);
  if (r.retry && !aborted) r = await attempt(false, MODEL);           // stale --resume → fresh session, same model
  if (r.stalled && !aborted && FALLBACK_MODEL && FALLBACK_MODEL !== MODEL) {
    console.log("[agent] " + MODEL + " stalled (no first token in " + FIRST_TOKEN_TIMEOUT_MS + "ms) — falling back to " + FALLBACK_MODEL);
    r = await attempt(false, FALLBACK_MODEL);                         // Opus stalled → answer on Sonnet
  }
  if (r.stalled && !aborted) onEvent({ t: "error", message: "The agent connected but the model didn't respond — it may be overloaded right now. Please try again in a moment." });
  return { sessionId: r.resolvedSession };
}

// Wraps runAgentTurn with a server-side loop that fulfills the agent's
// `===SOURCE: <name>===` requests: read the script locally and resume (--resume)
// with the source injected — no client round-trip / approval (safe read of the
// owner's own script). Bounded so it can't run away; sourceRequest events are
// consumed here, not streamed. The agent routes call this instead of runAgentTurn.
export async function runAgentTurnResolvingSources({ text, sessionId, onEvent, signal, installed }) {
  let sid = sessionId, msg = text, first = true, guard = 0, requested = null;
  const wrapped = (ev) => {
    if (ev && ev.t === "sourceRequest") { requested = ev.filename; return; }
    onEvent(ev);
  };
  while (true) {
    requested = null;
    const r = await runAgentTurn({ text: msg, sessionId: sid, onEvent: wrapped, signal, skipUserscripts: !first, installed });
    sid = r.sessionId;
    first = false;
    if (!requested || guard++ >= 6 || (signal && signal.aborted)) break;
    const src = resolveScriptSource(requested, installed);
    onEvent({ t: "source", filename: requested, ok: src != null });
    msg = "=== SCRIPT SOURCE: " + requested + " ===\n" +
      (src != null ? src : "(not found — use the exact filename from the USERSCRIPTS list)") +
      "\n\nUse this to continue answering the user, or request another ===SOURCE:=== if you need more.";
  }
  return { sessionId: sid };
}
