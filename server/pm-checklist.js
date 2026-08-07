/// Daily PM (2nd-shift) task checklist — assign the tasks to whoever's on the
/// Appy schedule until 8pm or later that day.
///
/// Flow (mirrors the circular): once a week the owner uploads the Appy schedule
/// image; the server reads it by vision into a per-date list of closers, then
/// DELETES the image (keeps only first names + dates). Every day at 7am — the
/// operational rollover — it fills the checklist's assignment column with that
/// day's closers, alternating the tasks between them, and posts it to /tasks.
///
/// Rules (owner-set): assign only to people whose shift ends at 8:00P OR LATER;
/// first names only, ALL-CAPS (matching the sheet); split tasks even/alternating
/// among the closers.
///
/// Everything here is pure and unit-tested; the vision call + IO live in
/// pm-checklist-store.js.

// "Coleman, Latisha N" / "De gerolamo, Rita" → "LATISHA" / "RITA". The schedule
// prints "Last, First [M]"; the first name is the first word after the comma.
export function firstNameUpper(name) {
  const m = String(name).match(/,\s*([A-Za-z][A-Za-z'’-]*)/);
  return m ? m[1].toUpperCase() : null;
}

// End time of a shift string as a 24h decimal hour. "3:00P-9:00P" → 21,
// "6:00A-2:30P" → 14.5. Blank / "Vacation" / unparseable → null.
export function shiftEndHour(shift) {
  const m = String(shift).match(/-\s*(\d{1,2}):(\d{2})\s*([AaPp])/);
  if (!m) return null;
  let h = (+m[1]) % 12;
  if (/p/i.test(m[3])) h += 12;
  return h + (+m[2]) / 60;
}

// The 8pm-or-later closers for one day column. `employees` is the parsed schedule
// [{name, job, days:{Sun:"3:00P-9:00P",…}}]; `dayKey` is "Sun".."Sat". Returns
// ALL-CAPS first names, in schedule order, de-duplicated.
export function closersForDay(employees, dayKey) {
  const out = [], seen = new Set();
  for (const e of employees || []) {
    const end = shiftEndHour(e.days ? e.days[dayKey] : "");
    if (end == null || end < 20) continue;   // 20:00 = 8:00P; ">= 8pm" per owner
    const fn = firstNameUpper(e.name);
    if (fn && !seen.has(fn)) { seen.add(fn); out.push(fn); }
  }
  return out;
}

// Per-task exclusions — some tasks are too physical for certain people, so they
// never get assigned those even when closing. Matched on the task's text.
export const TASK_EXCLUSIONS = [
  { match: /block/i, exclude: ["RITA", "CARMELA"] },                       // blocking pack-out cases
  { match: /pre-?slice|boar'?s?\s*head/i, exclude: ["RITA", "CARMELA"] },  // pre-slice, incl. Boar's Head
  { match: /cleaning\s*log/i, exclude: ["RITA", "CARMELA"] },              // the 5:30pm cleaning log
  { match: /cheese\s*table/i, exclude: ["CARMELA"] },                      // bringing cheese tables in
];
export function excludedForTask(text) {
  const s = new Set();
  for (const r of TASK_EXCLUSIONS) if (r.match.test(String(text))) r.exclude.forEach(n => s.add(n));
  return s;
}

// Assign the tasks to the closers by the owner's rule: give each task the
// person's-can't-do ones to whoever CAN, then fill the doable tasks with the
// others so the load ends up even. Concretely — process MOST-CONSTRAINED tasks
// first (fewest eligible closers): a task Rita & Carmela are both barred from has
// only one eligible closer, so it's placed before the free tasks and lands on
// that closer; the free tasks (anyone) then go to whoever currently holds the
// fewest, which fills Rita & Carmela instead of piling a stray free task onto the
// sink. Ties (same eligible-count) keep the original row order; ties on the count
// break by closer order. With no exclusions this is a plain even round-robin.
// `tasks` is [{row, text}] (a bare row number is treated as text-less). Returns a
// { rowNumber: NAME } map; a task with no eligible closer is left unassigned.
export function assignAlternating(tasks, closers) {
  const out = {};
  if (!closers || !closers.length) return out;
  const T = tasks.map(t => (typeof t === "object" ? t : { row: t, text: "" }));
  const counts = new Map(closers.map(c => [c, 0]));
  // Eligible closers per task (in closers order), then most-constrained first.
  const items = T.map((t, idx) => {
    const excl = excludedForTask(t.text || "");
    return { t, idx, eligible: closers.filter(c => !excl.has(c)) };
  });
  items.sort((a, b) => (a.eligible.length - b.eligible.length) || (a.idx - b.idx));
  for (const it of items) {
    let best = null;
    for (const c of it.eligible) {             // eligible keeps closers order = stable tie-break
      if (best === null || counts.get(c) < counts.get(best)) best = c;
    }
    if (best === null) continue;               // no eligible closer → unassigned
    out[it.t.row] = best;
    counts.set(best, counts.get(best) + 1);
  }
  return out;
}

// Resolve the ss table + each task row's column-A text (for exclusion matching).
export function parseSharedStrings(xml) {
  return String(xml).split("<si>").slice(1).map(b => {
    const inner = b.split("</si>")[0];
    return [...inner.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map(m => m[1]).join("");
  });
}
export function resolveTaskTexts(sheetXml, sharedStrings, rows) {
  return rows.map(row => {
    const cell = String(sheetXml).match(new RegExp(`<c r="A${row}"([^>]*)>([\\s\\S]*?)</c>`));
    let text = "";
    if (cell) {
      const isShared = /t="s"/.test(cell[1]);
      const inlineM = cell[2].match(/<t[^>]*>([^<]*)<\/t>/);
      const vM = cell[2].match(/<v>(\d+)<\/v>/);
      if (isShared && vM) text = sharedStrings[+vM[1]] || "";
      else if (inlineM) text = inlineM[1];
    }
    return { row, text };
  });
}

// The three-letter day key for a Date (used to map a calendar date onto the
// schedule's day columns).
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function dayKeyForDate(d) { return DOW[d.getDay()]; }

// Excel date serial (days since 1899-12-30) for a Date — for the checklist's
// date cell.
export function excelSerial(date) {
  return Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(1899, 11, 30)) / 86400000);
}

// Fill the checklist sheet1.xml: put each assigned name into the E cell of its
// task row (inline string, preserving the cell style), and set the date cell (D1)
// to `dateSerial` as a FIXED value — the template's =TODAY() formula would show
// whenever the file is opened, not the day the list is FOR. Pure over the XML.
export function fillChecklistXml(sheetXml, assignments, dateSerial) {
  let xml = sheetXml;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const styleOf = (ref) => { const m = xml.match(new RegExp(`<c r="${ref}"([^>]*)>`)); const s = m && m[1].match(/s="(\d+)"/); return s ? ` s="${s[1]}"` : ""; };
  if (dateSerial != null) {
    const s = styleOf("D1");
    xml = xml.replace(/<c r="D1"[^>]*>[\s\S]*?<\/c>/, `<c r="D1"${s} t="n"><v>${dateSerial}</v></c>`);
  }
  for (const [row, name] of Object.entries(assignments)) {
    const ref = `E${row}`, s = styleOf(ref);
    const cell = `<c r="${ref}"${s} t="inlineStr"><is><t>${esc(name)}</t></is></c>`;
    if (new RegExp(`<c r="${ref}"[^>]*>.*?</c>`).test(xml)) xml = xml.replace(new RegExp(`<c r="${ref}"[^>]*>.*?</c>`), cell);
    else if (new RegExp(`<c r="${ref}"[^>]*/>`).test(xml)) xml = xml.replace(new RegExp(`<c r="${ref}"[^>]*/>`), cell);
  }
  return xml;
}

// The schedule-image vision prompt.
export function buildScheduleVisionPrompt() {
  return `This is a weekly employee schedule grid for a supermarket deli/Appy department. Columns: Employee (printed "Last, First M"), Job, then 7 day columns each headed with a weekday and date (Sun … Sat). Each day cell holds a shift like "3:00P - 9:00P", or "Vacation", or is blank (day off).

Return ONLY a JSON object:
{"weekDates": {"Sun":"M/D","Mon":"M/D","Tue":"M/D","Wed":"M/D","Thu":"M/D","Fri":"M/D","Sat":"M/D"},
 "employees": [{"name":"Coleman, Latisha N","job":"Clerk","days":{"Sun":"3:00P-9:00P","Mon":"3:00P-9:00P","Tue":"","Wed":"","Thu":"3:00P-9:00P","Fri":"3:00P-9:00P","Sat":""}}]}

Read every employee row. Align each shift to the CORRECT day column — the rows are tall and the cells can look offset, so check carefully. Keep the exact end time and AM/PM (the A/P after the time). Use "" for blank days and "Vacation" where written. weekDates are the M/D printed under each weekday header.`;
}
