// The socket tests' server and client. Run as a script, this file is a
// Socket.IO server in a child process, so a message that takes the server down
// shows up as the child exiting instead of ending the test run.
// startHarness() starts one; connect() opens a raw Socket.IO connection to it.
//
// The server needs DATA_DIR (the store writes there; startHarness gives it a
// temp dir). It prints "PORT <n>" once listening and "ONJOIN <warId>" each
// time onJoin runs. A connection's handshake auth.user becomes socket.user:
// the real sign-in is not under test. Faction 2000's war_2000 exists from the
// start, with no enemy.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const SELF = fileURLToPath(import.meta.url);

if (process.argv[1] === SELF) await serve();

async function serve() {
  if (!process.env.DATA_DIR) {
    console.error("DATA_DIR must be set");
    process.exit(2);
  }
  const http = await import("node:http");
  const { Server } = await import("socket.io");
  const store = await import("./store.js");
  const { registerSocketHandlers } = await import("./socket-handlers.js");
  const { guardSocket } = await import("./socket-guard.js");

  store.getOrCreateWar("war_2000", "2000", null);
  const httpServer = http.createServer();
  const io = new Server(httpServer);
  io.use((socket, next) => {
    socket.user = socket.handshake.auth?.user || {};
    next();
  });
  io.on("connection", (socket) => {
    guardSocket(socket);
    registerSocketHandlers(io, socket, { onJoin: (warId) => console.log(`ONJOIN ${warId}`) });
  });
  httpServer.listen(0, "127.0.0.1", () => console.log(`PORT ${httpServer.address().port}`));
}

// Starts a harness server in its own temp dir and resolves once it listens:
// { port, lines (its stdout so far), exited() (exit code or signal, null while
// running), exit (a promise of the same), stderr(), stop() }.
export function startHarness() {
  const dir = mkdtempSync(path.join(tmpdir(), "socket-harness-"));
  const child = spawn(process.execPath, [SELF], {
    cwd: dir,
    env: { ...process.env, DATA_DIR: path.join(dir, "data") },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const lines = [];
  let partial = "";
  let err = "";
  let code = null;
  child.stdout.on("data", (d) => {
    partial += d;
    let i;
    while ((i = partial.indexOf("\n")) >= 0) {
      lines.push(partial.slice(0, i));
      partial = partial.slice(i + 1);
    }
  });
  child.stderr.on("data", (d) => { err += d; });
  const exit = new Promise((resolve) => child.on("exit", (c, signal) => { code = c ?? signal; resolve(code); }));
  const stop = async () => {
    if (code === null) child.kill();
    await exit;
    rmSync(dir, { recursive: true, force: true });
  };
  return new Promise((resolve, reject) => {
    const poll = setInterval(() => {
      const line = lines.find((l) => l.startsWith("PORT "));
      if (line) {
        clearInterval(poll);
        resolve({ port: Number(line.slice(5)), lines, exited: () => code, exit, stderr: () => err, stop });
      } else if (code !== null) {
        clearInterval(poll);
        rmSync(dir, { recursive: true, force: true });
        reject(new Error(`harness exited (${code}): ${err}`));
      }
    }, 10);
  });
}

// A raw Socket.IO connection (engine.io 4 over a WebSocket) signed in as
// `user`. send(frame) writes one frame as it is ('42["join_war"]'); emit(name,
// ...args) writes an event; events holds every [name, ...args] the server
// sent; waitFor(name) resolves with the first event of that name.
export function connect(port, user) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`);
  const events = [];
  const waiters = [];
  const api = {
    send: (frame) => ws.send(frame),
    emit: (name, ...args) => ws.send("42" + JSON.stringify([name, ...args])),
    events,
    waitFor(name, ms = 5000) {
      const seen = events.find((e) => e[0] === name);
      if (seen) return Promise.resolve(seen);
      return new Promise((resolve, reject) => {
        waiters.push({ name, resolve });
        setTimeout(() => reject(new Error(`no ${name} within ${ms} ms`)), ms).unref();
      });
    },
    close: () => ws.close(),
  };
  ws.on("error", () => {});
  return new Promise((resolve, reject) => {
    ws.on("close", () => reject(new Error("connection closed before it was open")));
    ws.on("message", (data) => {
      const m = String(data);
      if (m.startsWith("0{")) ws.send("40" + JSON.stringify({ user }));
      else if (m.startsWith("40")) resolve(api);
      else if (m === "2") ws.send("3");
      else if (m.startsWith("42")) {
        const event = JSON.parse(m.slice(2));
        events.push(event);
        for (const w of waiters) if (w.name === event[0]) w.resolve(event);
      }
    });
  });
}
