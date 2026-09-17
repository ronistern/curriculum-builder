/**
 * Turning the positioned text of a BGU transcript ("תדפיס לימודים לועדת הוראה",
 * produced by Oracle Reports) into a {@link GradeSheet}.
 *
 * The PDF has no table structure — only text at coordinates — so the layout is
 * recovered from the page itself:
 *
 *  - Items are grouped into rows by their baseline (`y`).
 *  - Each page repeats a header row (`קורס`, `שם קורס`, `נקודות`, `ציון מ.א.` …).
 *    Those labels become the column anchors, so the parser follows the report
 *    if it is ever rendered at a different scale rather than hard-coding x
 *    positions.
 *  - The table is right-to-left, and every column is right-aligned, so a value
 *    belongs to the anchor whose *right edge* is nearest its own.
 *  - A course row is one whose code column holds a course number. A long course
 *    name wraps onto following rows that carry nothing but name text, and those
 *    are appended to the course above.
 *
 * Extraction (running pdf.js) lives in `gradesPdf.ts`; this module is pure so it
 * can be tested on hand-written rows.
 */

import {
  aggregateGrades,
  normalizeCourseCode,
  type CourseInstance,
  type GradeSheet,
  type Moed,
} from './grades';

/** One piece of text on the page, with the horizontal span it occupies. */
export interface TextItem {
  str: string;
  /** Left edge, in PDF points. */
  x: number;
  /** Right edge, in PDF points. */
  right: number;
}

/** Text items sharing a baseline, ordered left to right. */
export interface TextRow {
  y: number;
  items: TextItem[];
}

/**
 * The columns of the table. `ignore` marks the ones the app has no use for —
 * they are still anchored, because a column that isn't known catches the values
 * of its neighbours: drop `שעות` and the weekly hours land in the grade beside
 * them.
 */
type ColumnId = 'code' | 'name' | 'credits' | 'kind' | 'note' | 'grade' | 'ignore';

/**
 * Header labels → the column they introduce. `ציון מ.א.` / `ציון מ.ב.` and the
 * two special-sitting columns all map to `grade`; which sitting each one is
 * follows from its position (see {@link columnsFrom}).
 */
const HEADERS: { label: string; id: ColumnId }[] = [
  { label: 'קורס', id: 'code' },
  { label: 'שם קורס', id: 'name' },
  { label: 'נקודות', id: 'credits' },
  { label: 'סוג מקצוע', id: 'kind' },
  { label: 'הערה', id: 'note' },
  { label: 'ציון מ.א.', id: 'grade' },
  { label: 'ציון מ.ב.', id: 'grade' },
  { label: 'ציון מ.מ.', id: 'grade' },
  { label: 'מוסד', id: 'ignore' },
  { label: "קב'", id: 'ignore' },
  { label: 'מרצה', id: 'ignore' },
  { label: 'א. הוראה', id: 'ignore' },
  { label: 'שעות', id: 'ignore' },
];

/** A column of the table, located by the right edge of its header label. */
interface Column {
  id: ColumnId;
  right: number;
  /** For a grade column: which sitting it holds. */
  moed?: Moed;
}

/** A course number as the transcript prints it, e.g. `202.1.1031`. */
const COURSE_CODE = /^\d{2,3}\.\d\.\d{3,4}$/;

/** `תשפ"ה`, `תשפ״ו` — the academic year in Hebrew letters. */
const HEBREW_YEAR = /^תש[א-ת]?["'׳״]?[א-ת]?$/;

/** `א'`, `ב'`, `ק'` — the semester. */
const SEMESTER = /^[אבק]["'׳״]?$/;

const isNumber = (s: string) => /^-?\d+(\.\d+)?$/.test(s);

/* ----------------------------------------------------------------------------
 * Columns
 * ------------------------------------------------------------------------- */

/**
 * The column layout of a page, read off its header row, or null when the row
 * isn't one. Grade columns are numbered right to left — the table is RTL, so
 * `ציון מ.א.` sits rightmost and the special sittings trail off to the left,
 * which is also the order the student sat them in.
 */
export function columnsFrom(row: TextRow): Column[] | null {
  const found: Column[] = [];
  for (const item of row.items) {
    const label = item.str.trim();
    const header = HEADERS.find((h) => h.label === label);
    if (header) found.push({ id: header.id, right: item.right });
  }
  // A header row is the one that introduces the course table; anything less is
  // some other part of the report that happens to reuse a word.
  if (!found.some((c) => c.id === 'code') || !found.some((c) => c.id === 'name')) {
    return null;
  }
  const grades = found
    .filter((c) => c.id === 'grade')
    .sort((a, b) => b.right - a.right);
  grades.forEach((column, i) => {
    column.moed = i === 0 ? 'A' : i === 1 ? 'B' : 'special';
  });
  return found;
}

/** The column a value belongs to: the one whose right edge is nearest its own. */
function columnAt(columns: Column[], item: TextItem): Column | null {
  let best: Column | null = null;
  let bestGap = Infinity;
  for (const column of columns) {
    const gap = Math.abs(column.right - item.right);
    if (gap < bestGap) {
      bestGap = gap;
      best = column;
    }
  }
  // Well beyond every column: part of the report's furniture, not the table.
  return bestGap <= 40 ? best : null;
}

/** Group a row's items by column, joining any that share one. */
function cellsOf(columns: Column[], row: TextRow): Map<Column, string> {
  const cells = new Map<Column, string>();
  for (const item of row.items) {
    const column = columnAt(columns, item);
    if (!column) continue;
    const prior = cells.get(column);
    cells.set(column, prior ? `${prior} ${item.str.trim()}` : item.str.trim());
  }
  return cells;
}

/* ----------------------------------------------------------------------------
 * Rows
 * ------------------------------------------------------------------------- */

/**
 * The term a semester header announces (`שנת תשפ"ה סמסטר א' 2025 / 1`), or null
 * when the row isn't one. The year alone is not enough to tell it apart: the
 * degree-requirements table at the end of the report also prints a Hebrew year
 * next to a semester letter, but never the word `סמסטר`.
 */
function termOf(row: TextRow): { year: string; semester: string } | null {
  const strs = row.items.map((i) => i.str.trim());
  if (!strs.includes('סמסטר')) return null;
  const year = strs.find((s) => HEBREW_YEAR.test(s));
  const semester = strs.find((s) => SEMESTER.test(s));
  return year ? { year, semester: semester ?? '' } : null;
}

/** The course row's own fields, once its cells are known. */
function instanceFrom(
  columns: Column[],
  cells: Map<Column, string>,
  term: { year: string; semester: string },
): CourseInstance {
  const value = (id: ColumnId) => {
    for (const [column, text] of cells) if (column.id === id) return text;
    return '';
  };
  const credits = value('credits');
  const sittings = columns
    .filter((c): c is Column & { moed: Moed } => c.id === 'grade' && !!c.moed)
    .sort((a, b) => b.right - a.right)
    .map((column) => ({ moed: column.moed, grade: cells.get(column) ?? '' }))
    .filter((s) => s.grade !== '');

  return {
    code: normalizeCourseCode(value('code')),
    name: value('name'),
    credits: isNumber(credits) ? Number(credits) : null,
    kind: value('kind'),
    year: term.year,
    semester: term.semester,
    sittings,
    note: value('note'),
  };
}

/* ----------------------------------------------------------------------------
 * The sheet
 * ------------------------------------------------------------------------- */

/** `מר פלוני אלמוני )123456789(` — the RTL parentheses come out reversed. */
const STUDENT_LINE = /^(?:מר|גב'|ד"ר|פרופ')?\s*(.+?)\s*[)(](\d{6,10})[)(]$/;

/** Student name and id, from the page header that repeats on every page. */
function studentFrom(rows: TextRow[]): { name: string; id: string } {
  for (const row of rows) {
    for (const item of row.items) {
      const m = STUDENT_LINE.exec(item.str.trim());
      if (m) return { name: m[1], id: m[2] };
    }
  }
  return { name: '', id: '' };
}

/** The `נכון ליום` date the report was produced for. */
function asOfFrom(rows: TextRow[]): string {
  for (const row of rows) {
    const strs = row.items.map((i) => i.str.trim());
    if (!strs.some((s) => s.includes('נכון ליום'))) continue;
    const date = strs.find((s) => /^\d{2}\.\d{2}\.\d{4}$/.test(s));
    if (date) return date;
  }
  return '';
}

/**
 * The value printed for a summary label such as `ממוצע מצטבר`. The report is
 * RTL, so a label's value is the number immediately to its left; the last such
 * row in the document is the running total after the final semester.
 */
function summaryValue(rows: TextRow[], label: string): number | null {
  let value: number | null = null;
  for (const row of rows) {
    const anchor = row.items.find((i) => i.str.trim() === label);
    if (!anchor) continue;
    const candidates = row.items
      .filter((i) => i.right < anchor.right && isNumber(i.str.trim()))
      .sort((a, b) => b.right - a.right);
    if (candidates.length) value = Number(candidates[0].str.trim());
  }
  return value;
}

/**
 * Parse a transcript from its positioned text, in reading order (page by page,
 * each page's rows top to bottom).
 *
 * Rows are walked with two pieces of state: the column layout, refreshed at
 * every header row, and the semester the block belongs to. A row holding a
 * course number starts a course; a row holding nothing but name text continues
 * the name of the course above it. Anything else — the per-semester totals, the
 * legend, the degree-requirements table — ends the current course, so its text
 * can never be mistaken for a wrapped name.
 */
export function parseGradeSheet(rows: TextRow[]): GradeSheet {
  const instances: CourseInstance[] = [];
  let columns: Column[] | null = null;
  let term: { year: string; semester: string } | null = null;
  let open: CourseInstance | null = null;

  for (const row of rows) {
    const header = columnsFrom(row);
    if (header) {
      columns = header;
      open = null;
      continue;
    }

    const heading = termOf(row);
    if (heading) {
      term = heading;
      open = null;
      continue;
    }

    if (!columns || !term) continue;

    const cells = cellsOf(columns, row);
    const code = [...cells].find(([c]) => c.id === 'code')?.[1] ?? '';
    if (COURSE_CODE.test(code)) {
      open = instanceFrom(columns, cells, term);
      instances.push(open);
      continue;
    }

    // A wrapped course name: name text (optionally alongside a wrapped remark)
    // and nothing else. Any other content means the course table has moved on.
    const wrapped = [...cells].every(([c]) => c.id === 'name' || c.id === 'note');
    const nameTail = [...cells].find(([c]) => c.id === 'name')?.[1];
    if (open && wrapped && nameTail) {
      open.name = `${open.name} ${nameTail}`.trim();
      const noteTail = [...cells].find(([c]) => c.id === 'note')?.[1];
      if (noteTail) open.note = `${open.note} ${noteTail}`.trim();
      continue;
    }

    open = null;
  }

  return {
    student: studentFrom(rows),
    asOf: asOfFrom(rows),
    cumulativeAverage: summaryValue(rows, 'ממוצע מצטבר'),
    cumulativeCredits: summaryValue(rows, 'נקודות זכות מצטבר'),
    courses: aggregateGrades(instances),
  };
}
