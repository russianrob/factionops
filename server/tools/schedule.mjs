#!/usr/bin/env node
// Correct a parsed weekly schedule.
//
// The schedule is read off a photo by vision, so a name can come back wrong.
// This edits the stored week in place and regenerates the checklist when the
// day being corrected is today — otherwise the 7am fill picks it up.
//
//   node tools/schedule.mjs show
//   node tools/schedule.mjs set Sat TAHJ SHARAHON
//
// Order is not cosmetic: assignAlternating hands tasks out in sequence, so the
// first name takes the first task, the second the next, and so on.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
// Imported lazily, inside the one branch that needs it: loading the store
// pulls in enough of the server to keep the event loop alive, so a top-level
// import left `show` hanging after it had already printed.

const SCHED = join("/opt/warboard/server/data/tasks", "schedule.json");
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const argv = process.argv.slice(2);
const cmd = (argv[0] || "show").toLowerCase();

const sched = JSON.parse(readFileSync(SCHED, "utf8"));

function show() {
  console.log(`week starting ${sched.weekStart}  (parsed ${sched.parsedAt}, ${sched.employeeCount} employees)`);
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  for (const d of DAYS) {
    const mark = sched.isoByDay[d] === iso ? "  <- today" : "";
    console.log(`  ${d}  ${sched.isoByDay[d]}  ${(sched.byDay[d] || []).join(", ") || "(nobody)"}${mark}`);
  }
}

if (cmd === "show") {
  show();
} else if (cmd === "set") {
  const day = String(argv[1] || "");
  const key = DAYS.find((d) => d.toLowerCase() === day.toLowerCase().slice(0, 3));
  if (!key) { console.log(`usage: node tools/schedule.mjs set <${DAYS.join("|")}> NAME [NAME...]`); process.exit(1); }
  const names = argv.slice(2).map((s) => s.toUpperCase().trim()).filter(Boolean);
  if (!names.length) { console.log("give at least one name (or NOBODY to clear)"); process.exit(1); }
  const next = (names.length === 1 && names[0] === "NOBODY") ? [] : names;

  const before = sched.byDay[key] || [];
  sched.byDay[key] = next;
  sched.editedAt = new Date().toISOString();
  // Note the hand edit so a later "why doesn't this match the photo" has an
  // answer in the file itself rather than only in somebody's memory.
  sched.edits = (sched.edits || []).concat([{ day: key, from: before, to: next, at: sched.editedAt }]);
  writeFileSync(SCHED, JSON.stringify(sched, null, 1));
  console.log(`${key} ${sched.isoByDay[key]}: ${before.join(", ") || "(nobody)"}  ->  ${next.join(", ") || "(nobody)"}`);

  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (sched.isoByDay[key] === iso) {
    const { generateTasks } = await import("../pm-checklist-store.js");
    const out = generateTasks(today);
    console.log(`today — checklist regenerated: ${JSON.stringify(out)}`);
  } else {
    console.log(`not today (${iso}); the 7am fill will use this on ${sched.isoByDay[key]}`);
  }
} else {
  console.log("usage: node tools/schedule.mjs [show | set <Day> NAME [NAME...]]");
  process.exit(1);
}

// Explicit: even the lazy import can leave a handle open, and a CLI that does
// not return is a CLI nobody runs twice.
process.exit(0);
