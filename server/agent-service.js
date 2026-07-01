// agent-service.js
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { runJsOnDevice } from "./agent-relay-client.js";

// Runs as the non-root `warboard` server user, so no root guard / IS_SANDBOX is
// needed. CLAUDE is the world-executable copy (warboard can't read /root). HOME
// points at warboard's isolated agent home holding its own long-lived token.
const CLAUDE = process.env.CLAUDE_BIN || "/usr/local/bin/claude";
const WORKDIR = process.env.AGENT_WORKDIR || "/opt/warboard/server/data/agent-workdir";
const AGENT_HOME = process.env.AGENT_HOME || "/opt/warboard/server/data/agent-home";
// warboard's own long-lived Claude token (setup-token), read per-turn so rotation is picked up.
const TOKEN_FILE = process.env.AGENT_CLAUDE_TOKEN_FILE || "/opt/warboard/server/data/.agent-claude-token";
function agentToken() { try { return readFileSync(TOKEN_FILE, "utf8").trim(); } catch { return ""; } }
// Page access is via SNAPSHOT INJECTION (not MCP): headless -p fires the model
// turn before a per-invocation stdio MCP server finishes connecting, so live MCP
// tools don't reliably reach the turn. Instead we grab the page state via the
// relay and prepend it to the prompt; the agent has NO tools.
const SNAPSHOT_JS = 'var o={url:location.href,title:document.title};try{o.text=((document.body&&document.body.innerText)||"").replace(/\\s+/g," ").trim().slice(0,4000)}catch(e){o.text=""}try{var p=document.getElementById("fly-out-panel");if(p)o.flyoutOpen=/visible___/.test(p.className)}catch(e){}return JSON.stringify(o);';
const SYSTEM_PROMPT = process.env.AGENT_SYSTEM_PROMPT || "You are an assistant embedded in the Warboard iOS app, helping the owner (a Torn player and userscript developer) with the Torn game and their userscripts. You have NO tools: you cannot run code, read or write files, browse the web, or take any action. Each message is prefixed with a SNAPSHOT of the user's CURRENT Torn page (URL, title, visible text). Use that snapshot plus your knowledge of Torn and web/userscript development to answer. If you need information not in the snapshot, say what you'd want to see rather than inventing it. Never claim to have run a tool, executed code, or taken an action.";
// SECURITY: deny EVERY built-in tool so the agent has NO tools at all. Validated
// live: with this list the agent's tool set is empty. An allow-list does NOT
// restrict under default mode; only this complete --disallowed-tools under
// bypassPermissions blocks. init tools[] isn't exhaustive — deny Glob/Grep too.
const DISALLOWED = ["Task","Bash","CronCreate","CronDelete","CronList","DesignSync","Edit","EnterWorktree","ExitWorktree","Monitor","NotebookEdit","PushNotification","Read","RemoteTrigger","ReportFindings","ScheduleWakeup","SendMessage","Skill","TaskCreate","TaskGet","TaskList","TaskOutput","TaskStop","TaskUpdate","ToolSearch","WebFetch","WebSearch","Workflow","Write","Glob","Grep"];
const TURN_TIMEOUT_MS = Number(process.env.AGENT_TURN_TIMEOUT_MS || 180000);

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
  const prompt = "=== CURRENT TORN PAGE SNAPSHOT ===\n" + snap + "\n\n=== USER MESSAGE ===\n" + String(text);
  return new Promise((resolve) => {
    const args = ["--print", prompt,
      "--output-format", "stream-json", "--verbose", "--include-partial-messages",
      "--append-system-prompt", SYSTEM_PROMPT,
      "--permission-mode", "bypassPermissions",
      "--disallowed-tools", ...DISALLOWED];
    if (sessionId) args.push("--resume", sessionId);
    const child = spawn(CLAUDE, args, { cwd: WORKDIR, env: { ...process.env, HOME: AGENT_HOME, CLAUDE_CODE_OAUTH_TOKEN: agentToken() }, stdio: ["ignore", "pipe", "pipe"] });
    let resolvedSession = sessionId || null;
    let buf = "";
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
        if (ev) { if (ev.t === "session") resolvedSession = ev.id; onEvent(ev); }
      }
    });
    child.stderr.on("data", (d) => onEvent({ t: "stderr", text: d.toString().slice(0, 500) }));
    child.on("close", () => { clearTimeout(killTimer); resolve({ sessionId: resolvedSession }); });
    child.on("error", (e) => { clearTimeout(killTimer); onEvent({ t: "error", message: String(e) }); resolve({ sessionId: resolvedSession }); });
  });
}
