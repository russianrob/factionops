/// Storage + IO for the daily PM task checklist (see pm-checklist.js for the pure
/// rules and the flow). Reads the weekly Appy schedule image by vision into a
/// per-weekday closer map (then deletes the image), and fills the day's checklist.

import cron from "node-cron";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { claudeExtractImage, extractJsonArray } from "./circular-pipeline.js";
import {
  closersForDay, assignAlternating, dayKeyForDate, fillChecklistXml, buildScheduleVisionPrompt,
} from "./pm-checklist.js";

const DATA_DIR = process.env.TASKS_DIR || "/opt/warboard/server/data/tasks";
const TEMPLATE = process.env.TASKS_TEMPLATE || "/opt/warboard/server/data/tasks-template.xlsx";
// Written into the warboard-owned data dir (not public/, which the server user
// can't create files in); GET /tasks reads and serves it from here.
const OUT_LATEST = process.env.TASKS_LATEST || join(DATA_DIR, "tasks-latest.xlsx");
const SCHED_JSON = join(DATA_DIR, "schedule.json");
const XLSX_TOOL = "/opt/warboard/server/bin/xlsx-tool.py";
const TASK_ROWS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];   // Appy sheet task rows (r16 = "Check out")
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ensureDir() { mkdirSync(DATA_DIR, { recursive: true }); }
export function readSchedule() { try { return JSON.parse(readFileSync(SCHED_JSON, "utf8")); } catch { return null; } }
function writeSchedule(obj) { ensureDir(); writeFileSync(SCHED_JSON, JSON.stringify(obj, null, 1)); }

// "8/2" + a reference Date → ISO date, choosing the year that puts it nearest the
// reference (handles a Dec/Jan schedule without a year printed).
function mdToISO(md, ref) {
  const m = String(md).match(/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  const mo = +m[1], d = +m[2], y = ref.getFullYear();
  const cand = [y - 1, y, y + 1].map(yy => new Date(yy, mo - 1, d));
  cand.sort((a, b) => Math.abs(a - ref) - Math.abs(b - ref));
  const p = cand[0];
  return `${p.getFullYear()}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Parse the uploaded schedule image into a stored closer map, then DELETE the
// image (we keep only first names + dates, never the raw schedule). `now` is
// injectable for tests; production passes a real Date.
export async function parseSchedule(imagePath, opts = {}) {
  const vision = opts.visionExtractor || ((imgs, prompt) => claudeExtractImage(imgs, prompt));
  const now = opts.now || new Date();
  // resize for a lean vision payload
  const png = join(DATA_DIR, "sched-resized.png");
  execFileSync("convert", [imagePath, "-resize", "1500x", png]);
  const raw = await vision([readFileSync(png).toString("base64")], buildScheduleVisionPrompt());
  // vision returns a JSON OBJECT here, not an array
  let parsed;
  try { const a = raw.indexOf("{"), b = raw.lastIndexOf("}"); parsed = JSON.parse(raw.slice(a, b + 1)); }
  catch { throw new Error("schedule vision returned unparseable JSON"); }
  const employees = parsed.employees || [];
  const weekDates = parsed.weekDates || {};
  const byDay = {}, isoByDay = {};
  for (const day of DOW) {
    byDay[day] = closersForDay(employees, day);
    if (weekDates[day]) isoByDay[day] = mdToISO(weekDates[day], now);
  }
  const weekStart = isoByDay.Sun || null;
  const result = {
    weekStart, isoByDay, byDay,
    parsedAt: now.toISOString(), employeeCount: employees.length,
  };
  writeSchedule(result);
  // privacy: drop the raw image + the resized copy
  for (const p of [imagePath, png]) { try { if (existsSync(p)) unlinkSync(p); } catch {} }
  return result;
}

// Fill and publish the checklist for `date` (a Date). Uses the stored schedule's
// per-weekday closers when `date` falls inside the parsed week. Returns a summary.
export function generateTasks(date, opts = {}) {
  const template = opts.template || TEMPLATE;
  const outLatest = opts.outLatest || OUT_LATEST;
  const sched = readSchedule();
  const dayKey = dayKeyForDate(date);
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  let closers = [], stale = false;
  if (sched && sched.byDay) {
    // Only use the schedule if `date` is within its week (else it's last week's).
    const dayIso = sched.isoByDay ? sched.isoByDay[dayKey] : null;
    stale = dayIso ? dayIso !== iso : false;
    closers = stale ? [] : (sched.byDay[dayKey] || []);
  } else {
    stale = true;
  }

  const assignments = assignAlternating(TASK_ROWS, closers);
  const sheet = execFileSync("python3", [XLSX_TOOL, "extract", template, "xl/worksheets/sheet1.xml"]).toString();
  const filled = fillChecklistXml(sheet, assignments);
  const tmpXml = join(DATA_DIR, "sheet1-filled.xml");
  writeFileSync(tmpXml, filled);
  execFileSync("python3", [XLSX_TOOL, "replace", template, "xl/worksheets/sheet1.xml", tmpXml, outLatest]);
  return { date: iso, dayKey, closers, stale, assigned: Object.keys(assignments).length };
}

// A Date whose local Y/M/D matches "today" in America/New_York (the store's TZ),
// regardless of the server's own timezone.
function nyDate() {
  const [y, m, d] = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }).split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

// The operational day rolls at 7:00am ET — regenerate the checklist then. A stale
// schedule (week ended, none re-uploaded) yields a blank checklist, prompting a
// new upload rather than repeating last week's names.
cron.schedule("0 7 * * *", () => {
  try { console.log("[tasks] 7am fill", JSON.stringify(generateTasks(nyDate()))); }
  catch (e) { console.error("[tasks] 7am fill failed:", String((e && e.message) || e)); }
}, { timezone: "America/New_York" });

export { DATA_DIR, OUT_LATEST, TASK_ROWS, nyDate };
