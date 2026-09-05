/// Storage + IO for the daily PM task checklist (see pm-checklist.js for the pure
/// rules and the flow). Reads the weekly Appy schedule image by vision into a
/// per-weekday closer map (then deletes the image), and fills the day's checklist.

import cron from "node-cron";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { claudeExtractImage, extractJsonArray } from "./circular-pipeline.js";
import { scheduleFor,
  closersForDay, assignAlternating, dayKeyForDate, fillChecklistXml, buildScheduleVisionPrompt,
  resolveTaskTexts, parseSharedStrings, excelSerial,
} from "./pm-checklist.js";

const DATA_DIR = process.env.TASKS_DIR || "/opt/warboard/server/data/tasks";
const TEMPLATE = process.env.TASKS_TEMPLATE || "/opt/warboard/server/data/tasks-template.xlsx";
// Written into the warboard-owned data dir (not public/, which the server user
// can't create files in); GET /tasks reads and serves it from here.
const OUT_LATEST = process.env.TASKS_LATEST || join(DATA_DIR, "tasks-latest.xlsx");
const SCHED_JSON = join(DATA_DIR, "schedule.json");
const SCHED_PREV_JSON = join(DATA_DIR, "schedule-prev.json");
const XLSX_TOOL = "/opt/warboard/server/bin/xlsx-tool.py";
const TASK_ROWS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];   // Appy sheet task rows (r16 = "Check out")
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ensureDir() { mkdirSync(DATA_DIR, { recursive: true }); }
export function readSchedule() { try { return JSON.parse(readFileSync(SCHED_JSON, "utf8")); } catch { return null; } }

/// The schedule that was current before the newest upload.
///
/// Next week's schedule normally arrives mid-week, and it used to REPLACE the
/// running one — so from that moment until the new week began, every remaining
/// day of the current week produced a blank checklist. The stale guard was
/// right to refuse next week's crew; the mistake was throwing away the week
/// people were still working.
export function readPrevSchedule() {
  try { return JSON.parse(readFileSync(SCHED_PREV_JSON, "utf8")); } catch { return null; }
}

function writeSchedule(obj) {
  ensureDir();
  // Demote the outgoing schedule instead of dropping it, but only when it is a
  // DIFFERENT week -- re-uploading the same week must not push the real
  // previous week out of reach.
  try {
    const cur = readSchedule();
    if (cur && cur.weekStart && obj && obj.weekStart && cur.weekStart !== obj.weekStart) {
      writeFileSync(SCHED_PREV_JSON, JSON.stringify(cur, null, 1));
    }
  } catch { /* first upload, or unreadable — nothing to keep */ }
  writeFileSync(SCHED_JSON, JSON.stringify(obj, null, 1));
}

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
  // Privacy: the raw schedule image and its resized copy are ALWAYS deleted —
  // whether the parse succeeds or the vision call fails (e.g. rate-limited) — so
  // a failed upload never leaves an employee schedule sitting on disk.
  try {
    execFileSync("convert", [imagePath, "-resize", "1500x", png]);
    const raw = await vision([readFileSync(png).toString("base64")], buildScheduleVisionPrompt());
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
    const result = {
      weekStart: isoByDay.Sun || null, isoByDay, byDay,
      parsedAt: now.toISOString(), employeeCount: employees.length,
    };
    writeSchedule(result);
    return result;
  } finally {
    for (const p of [imagePath, png]) { try { if (existsSync(p)) unlinkSync(p); } catch {} }
  }
}

// Fill and publish the checklist for `date` (a Date). Uses the stored schedule's
// per-weekday closers when `date` falls inside the parsed week. Returns a summary.
export function generateTasks(date, opts = {}) {
  const template = opts.template || TEMPLATE;
  const outLatest = opts.outLatest || OUT_LATEST;
  const sched = readSchedule();
  const dayKey = dayKeyForDate(date);
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  // Whichever stored schedule covers THIS date — the current one, or the week
  // it displaced. A schedule is only used when its own ISO date for this
  // weekday equals today's, so next week's crew can never land on today.
  const covering = opts.schedule !== undefined ? opts.schedule
                 : scheduleFor(dayKey, iso, [sched, readPrevSchedule()]);
  const stale = !covering;
  const closers = covering ? (covering.byDay[dayKey] || []) : [];

  const sheet = execFileSync("python3", [XLSX_TOOL, "extract", template, "xl/worksheets/sheet1.xml"]).toString();
  const ss = execFileSync("python3", [XLSX_TOOL, "extract", template, "xl/sharedStrings.xml"]).toString();
  const tasks = resolveTaskTexts(sheet, parseSharedStrings(ss), TASK_ROWS);   // {row, text} for exclusion matching
  const assignments = assignAlternating(tasks, closers);
  const filled = fillChecklistXml(sheet, assignments, excelSerial(date));
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
