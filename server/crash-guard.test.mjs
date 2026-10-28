// The crash guard: the last resort for an error nothing else caught. It logs
// the error, saves what a normal shutdown saves, and exits with 1 so pm2
// starts the server again; it never carries on. First on a stand-in process,
// then on a real one in a child process, then how server.js arms it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { installCrashGuard } from "./crash-guard.js";

// The guard on a stand-in process; `calls` is everything it did, in order.
function arm({ save = () => {} } = {}) {
  const proc = new EventEmitter();
  const calls = [];
  installCrashGuard({
    proc,
    log: (m) => calls.push(["log", m]),
    save: () => { calls.push(["save"]); save(); },
    exit: (code) => calls.push(["exit", code]),
  });
  return { proc, calls };
}

test("arming says so", () => {
  assert.deepEqual(arm().calls, [["log", "[crash] guard armed"]]);
});

test("an uncaught exception is logged, saved, then exits with 1", () => {
  const { proc, calls } = arm();
  proc.emit("uncaughtException", new Error("boom"));
  assert.deepEqual(calls.slice(1).map((c) => c[0]), ["log", "save", "exit"]);
  assert.ok(calls[1][1].startsWith("[crash] uncaught exception: Error: boom"), calls[1][1]);
  assert.deepEqual(calls.at(-1), ["exit", 1]);
});

test("an unhandled rejection does the same", () => {
  const { proc, calls } = arm();
  proc.emit("unhandledRejection", new Error("lost"), Promise.resolve());
  assert.deepEqual(calls.slice(1).map((c) => c[0]), ["log", "save", "exit"]);
  assert.ok(calls[1][1].startsWith("[crash] unhandled rejection: Error: lost"), calls[1][1]);
  assert.deepEqual(calls.at(-1), ["exit", 1]);
});

test("a save that fails still exits", () => {
  const { proc, calls } = arm({ save: () => { throw new Error("disk full"); } });
  proc.emit("uncaughtException", new Error("boom"));
  assert.deepEqual(calls.slice(-2), [["log", "[crash] save failed: disk full"], ["exit", 1]]);
});

test("a second error while leaving does not save again", () => {
  const { proc, calls } = arm();
  proc.emit("uncaughtException", new Error("boom"));
  proc.emit("unhandledRejection", new Error("lost"), Promise.resolve());
  assert.equal(calls.filter((c) => c[0] === "save").length, 1);
  assert.deepEqual(calls.filter((c) => c[0] === "exit"), [["exit", 1], ["exit", 1]]);
});

// A real process with the guard armed; its save writes a marker file.
function crashChild(body) {
  const dir = mkdtempSync(path.join(tmpdir(), "crash-guard-"));
  const marker = path.join(dir, "saved");
  const script = path.join(dir, "child.mjs");
  writeFileSync(script, [
    `import { writeFileSync } from "node:fs";`,
    `import { installCrashGuard } from ${JSON.stringify(new URL("./crash-guard.js", import.meta.url).href)};`,
    `installCrashGuard({ save: () => writeFileSync(${JSON.stringify(marker)}, "saved") });`,
    body,
  ].join("\n"));
  const run = spawnSync(process.execPath, [script], { encoding: "utf8", timeout: 10000 });
  const saved = existsSync(marker);
  rmSync(dir, { recursive: true, force: true });
  return { status: run.status, stderr: run.stderr, saved };
}

test("a throw in a timer ends the process with 1, after saving", () => {
  const r = crashChild(`setTimeout(() => { throw new Error("late"); }, 10);`);
  assert.equal(r.status, 1, r.stderr);
  assert.equal(r.saved, true);
  assert.match(r.stderr, /\[crash\] uncaught exception: Error: late/);
});

test("a promise nobody handles ends the process with 1, after saving", () => {
  const r = crashChild(`Promise.reject(new Error("lost"));`);
  assert.equal(r.status, 1, r.stderr);
  assert.equal(r.saved, true);
  assert.match(r.stderr, /\[crash\] unhandled rejection: Error: lost/);
});

// How server.js arms it: read from its source, since importing server.js
// would start the whole server.
// SERVER_SRC points these at another copy.
const SERVER = readFileSync(new URL(process.env.SERVER_SRC || "./server.js", import.meta.url), "utf8");
const body = (name) => {
  const i = SERVER.indexOf(`function ${name}(`);
  assert.ok(i > 0, `${name} not found`);
  let depth = 0;
  for (let j = SERVER.indexOf("{", i); j < SERVER.length; j++) {
    if (SERVER[j] === "{") depth++;
    else if (SERVER[j] === "}" && --depth === 0) return SERVER.slice(SERVER.indexOf("{", i) + 1, j);
  }
  throw new Error(`${name} never closes`);
};

test("server.js arms the guard only once the state has loaded", () => {
  const at = (text) => {
    const i = SERVER.indexOf(text);
    assert.ok(i > 0, `${text} not found`);
    return i;
  };
  // Declared before the load block, which sets it (a let used before its
  // line would throw at startup).
  assert.ok(at("let stateLoaded = false;") < at("store.loadState();"));
  assert.ok(at("stateLoaded = true;") > at("store.loadMemberBars();"));
  assert.ok(at("stateLoaded = true;") > at("warHistory.backfillPayouts()"));
  assert.ok(at("installCrashGuard({ save: saveAll });") > at("stateLoaded = true;"));
});

test("saving waits for the state, and shutdown saves the same way", () => {
  assert.ok(body("saveAll").trim().startsWith("if (!stateLoaded) return;"), body("saveAll"));
  assert.match(body("saveAll"), /store\.saveState\(\);[\s\S]*store\.saveMemberBars\(\);[\s\S]*warHistory\.flushAll\(\)/);
  assert.match(body("shutdown"), /\bsaveAll\(\);/);
  assert.doesNotMatch(body("shutdown"), /store\.saveState\(\)/);
});
