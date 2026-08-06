/// Daily PM (2nd-shift) task checklist — assign the tasks to whoever's on the
/// Appy schedule until 9pm or later that day.
///
/// Flow (mirrors the circular): once a week the owner uploads the Appy schedule
/// image; the server reads it by vision into a per-date list of closers, then
/// DELETES the image (keeps only first names + dates). Every day at 7am — the
/// operational rollover — it fills the checklist's assignment column with that
/// day's closers, alternating the tasks between them, and posts it to /tasks.
///
/// Rules (owner-set): assign only to people whose shift ends at 9:00P OR LATER;
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

// The 9pm-or-later closers for one day column. `employees` is the parsed schedule
// [{name, job, days:{Sun:"3:00P-9:00P",…}}]; `dayKey` is "Sun".."Sat". Returns
// ALL-CAPS first names, in schedule order, de-duplicated.
export function closersForDay(employees, dayKey) {
  const out = [], seen = new Set();
  for (const e of employees || []) {
    const end = shiftEndHour(e.days ? e.days[dayKey] : "");
    if (end == null || end < 21) continue;   // 21:00 = 9:00P; ">= 9pm" per owner
    const fn = firstNameUpper(e.name);
    if (fn && !seen.has(fn)) { seen.add(fn); out.push(fn); }
  }
  return out;
}

// Alternate the task rows among the closers: row i → closers[i % n]. Returns a
// { rowNumber: NAME } map. No closers → empty (nothing assigned).
export function assignAlternating(taskRows, closers) {
  const out = {};
  if (!closers || !closers.length) return out;
  taskRows.forEach((row, i) => { out[row] = closers[i % closers.length]; });
  return out;
}

// The three-letter day key for a Date (used to map a calendar date onto the
// schedule's day columns).
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function dayKeyForDate(d) { return DOW[d.getDay()]; }

// Fill the checklist sheet1.xml: put each assigned name into the E cell of its
// task row (inline string, preserving the cell style). The date cell is a
// =TODAY() formula, so it self-updates — left alone. Pure over the XML string.
export function fillChecklistXml(sheetXml, assignments) {
  let xml = sheetXml;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const styleOf = (ref) => { const m = xml.match(new RegExp(`<c r="${ref}"([^>]*)>`)); const s = m && m[1].match(/s="(\d+)"/); return s ? ` s="${s[1]}"` : ""; };
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
