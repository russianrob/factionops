// agent-service.js
import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join as pathJoin, basename as pathBasename } from "node:path";
import { runJsOnDevice } from "./agent-relay-client.js";

// Where the deployable userscripts live (SERVED verbatim by the static mount).
const SCRIPTS_DIR = process.env.AGENT_SCRIPTS_DIR || "/opt/warboard/server/public/scripts";

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
const SNAPSHOT_JS = 'var o={url:location.href,title:document.title};try{o.text=((document.body&&document.body.innerText)||"").replace(/\\s+/g," ").trim().slice(0,4000)}catch(e){o.text=""}try{var p=document.getElementById("fly-out-panel");if(p)o.flyoutOpen=/visible___/.test(p.className)}catch(e){}return JSON.stringify(o);';
const SYSTEM_PROMPT = process.env.AGENT_SYSTEM_PROMPT || "You are an assistant embedded in the Warboard iOS app, helping the owner (a Torn player and userscript developer) with the Torn game and their userscripts. You have NO tools: you cannot run code, read or write files, browse the web, or take any action. Each message is prefixed with a SNAPSHOT of the user's CURRENT Torn page (URL, title, visible text), then a USERSCRIPTS section listing the owner's installed userscripts (and the full source of any the owner named). Use that context plus your knowledge of Torn and web/userscript development to answer. If you need information not in the context, say what you'd want to see rather than inventing it. Never claim to have run a tool, executed code, or taken an action.\n\nEDITING USERSCRIPTS: You may help the owner edit a userscript, but you only PROPOSE changes — the owner reviews and deploys them. When you propose a change to a script, output the COMPLETE new file (not a diff, not a snippet). Immediately precede it with a line that is EXACTLY `===FILE: <filename>===` (the bare basename, e.g. `===FILE: torn-green-nav.user.js===`), then a fenced code block containing the whole file. Keep the existing `==UserScript==` header intact and BUMP the `@version` (increment the patch number). Only include ONE such proposal per reply, as the last thing in your message.";
// SECURITY: deny EVERY built-in tool so the agent has NO tools at all. Validated
// live: with this list the agent's tool set is empty. An allow-list does NOT
// restrict under default mode; only this complete --disallowed-tools under
// bypassPermissions blocks. init tools[] isn't exhaustive — deny Glob/Grep too.
const DISALLOWED = ["Task","Bash","CronCreate","CronDelete","CronList","DesignSync","Edit","EnterWorktree","ExitWorktree","Monitor","NotebookEdit","PushNotification","Read","RemoteTrigger","ReportFindings","ScheduleWakeup","SendMessage","Skill","TaskCreate","TaskGet","TaskList","TaskOutput","TaskStop","TaskUpdate","ToolSearch","WebFetch","WebSearch","Workflow","Write","Glob","Grep"];
const TURN_TIMEOUT_MS = Number(process.env.AGENT_TURN_TIMEOUT_MS || 180000);
// Pin Opus (the OAuth token defaults to Sonnet). --bare (added to args) strips
// hooks/auto-memory/CLAUDE.md discovery so /opt/warboard's CLAUDE.md+AGENTS.md and
// the SessionStart memory dump don't bloat every turn's context (pure quota waste).
const MODEL = process.env.AGENT_MODEL || "claude-opus-4-8";

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
export function userscriptContext(userText, dir = SCRIPTS_DIR) {
  const text = String(userText || "");
  let files;
  try { files = readdirSync(dir).filter((f) => f.endsWith(".user.js")).sort(); }
  catch (e) { return "(userscript list unavailable: " + String(e && e.message || e) + ")"; }
  if (!files.length) return "(no userscripts found)";
  const lines = ["Installed userscripts (" + files.length + "):"];
  const named = [];
  for (const f of files) {
    let content = "";
    try { content = readFileSync(pathJoin(dir, f), "utf8"); } catch {}
    const name = headerField(content, "name") || "(no @name)";
    const version = headerField(content, "version") || "?";
    lines.push("- " + f + " — " + name + " (v" + version + ")");
    const base = f.replace(/\.user\.js$/, "");
    if (mentioned(text, f) || mentioned(text, base)) named.push({ f, content });
  }
  for (const { f, content } of named) {
    lines.push("", "=== FULL SOURCE: " + f + " ===", content);
  }
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

// Deploy path-jail: a deployable userscript name is a bare basename ending in
// `.user.js` with no path separators / `..` traversal. Exported for the deploy
// route + tests.
export function isValidUserscriptName(name) {
  return typeof name === "string" && /^[a-zA-Z0-9._-]+\.user\.js$/.test(name);
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

export async function runAgentTurn({ text, sessionId, onEvent, signal }) {
  let snap;
  try {
    const r = await runJsOnDevice(SNAPSHOT_JS, { timeoutMs: 8000 });
    snap = r.error ? ("(page snapshot unavailable: " + r.error + ")") : (r.value || "(empty)");
  } catch (e) { snap = "(page snapshot error: " + String(e) + ")"; }
  if (onEvent) onEvent({ t: "snapshot", ok: !/unavailable|error/.test(snap) });
  const prompt = "=== CURRENT TORN PAGE SNAPSHOT ===\n" + snap +
    "\n\n=== USERSCRIPTS ===\n" + userscriptContext(text) +
    "\n\n=== USER MESSAGE ===\n" + String(text);
  return new Promise((resolve) => {
    const args = ["--print", prompt,
      "--model", MODEL,
      "--output-format", "stream-json", "--verbose", "--include-partial-messages",
      "--append-system-prompt", SYSTEM_PROMPT,
      "--permission-mode", "bypassPermissions",
      "--disallowed-tools", ...DISALLOWED];
    if (sessionId) args.push("--resume", sessionId);
    const child = spawn(CLAUDE, args, { cwd: WORKDIR, env: childEnv(), stdio: ["ignore", "pipe", "pipe"] });
    let resolvedSession = sessionId || null;
    let buf = "";
    let assistantText = "";
    const killTimer = setTimeout(() => { onEvent({ t: "error", message: "agent turn timed out" }); child.kill("SIGKILL"); }, TURN_TIMEOUT_MS);
    if (signal) signal.addEventListener("abort", () => child.kill("SIGKILL"), { once: true });
    child.stdout.on("data", (d) => {
      buf += d.toString();
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line) continue;
        let obj; try { obj = JSON.parse(line); } catch { continue; }
        const ev = normalizeStreamLine(obj);
        if (ev) {
          if (ev.t === "session") resolvedSession = ev.id;
          if (ev.t === "delta") assistantText += ev.text || "";
          if (ev.t === "done") {
            const full = assistantText || ev.result || "";
            const prop = parseProposal(full);
            if (prop) onEvent({ t: "proposal", filename: prop.filename, content: prop.content });
          }
          onEvent(ev);
        }
      }
    });
    child.stderr.on("data", (d) => onEvent({ t: "stderr", text: d.toString().slice(0, 500) }));
    child.on("close", () => { clearTimeout(killTimer); resolve({ sessionId: resolvedSession }); });
    child.on("error", (e) => { clearTimeout(killTimer); onEvent({ t: "error", message: String(e) }); resolve({ sessionId: resolvedSession }); });
  });
}
