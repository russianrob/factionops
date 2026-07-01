// agent-service.js
import { spawn } from "node:child_process";

const CLAUDE = process.env.CLAUDE_BIN || "/root/.local/bin/claude";
const WORKDIR = process.env.AGENT_WORKDIR || "/opt/warboard/server/data/agent-workdir";
const MCP_CONFIG = process.env.AGENT_MCP_CONFIG || "/opt/warboard/server/data/agent-mcp.json";
const DISALLOWED = ["Bash","Edit","Write","Read","NotebookEdit","WebFetch","WebSearch","Task","Glob","Grep"];
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

export function runAgentTurn({ text, sessionId, onEvent, signal }) {
  return new Promise((resolve) => {
    const args = ["--print", String(text),
      "--output-format", "stream-json", "--verbose", "--include-partial-messages",
      "--mcp-config", MCP_CONFIG, "--strict-mcp-config",
      "--permission-mode", "bypassPermissions",
      "--disallowed-tools", ...DISALLOWED];
    if (sessionId) args.push("--resume", sessionId);
    const child = spawn(CLAUDE, args, { cwd: WORKDIR, env: { ...process.env, IS_SANDBOX: process.env.IS_SANDBOX || "1" }, stdio: ["ignore", "pipe", "pipe"] });
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
