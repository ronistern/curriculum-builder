/**
 * A student's grade record: the model, and the aggregation of repeat attempts
 * into "the grade that counts + the history behind it".
 *
 * A BGU transcript records a repeated course in two different ways, and both
 * are attempts here:
 *  - several exam sittings (מועדים) on one row — `ציון מ.א.`, `ציון מ.ב.` and up
 *    to two special sittings — where the *last* sitting is the grade that
 *    counts, higher or lower;
 *  - the whole course taken again in a later semester, which appears as another
 *    row (the superseded one flagged `קיים קורס מאוחר` / `כשלון2, לא לשקלול`).
 *
 * Reading the PDF is `gradeSheet.ts` (layout) and `gradesPdf.ts` (extraction);
 * everything here is pure and testable without a file.
 */

/** An exam sitting. `A`/`B` are the regular ones, `special` is מועד מיוחד. */
export type Moed = 'A' | 'B' | 'special';

/** One course row on the sheet: a single enrolment, with its sittings. */
export interface CourseInstance {
  /** Course code, normalized (see {@link normalizeCourseCode}). */
  code: string;
  name: string;
  credits: number | null;
  /** `סוג מקצוע` as printed (`חובה` / `בחירה`), empty when the sheet omits it. */
  kind: string;
  /** Academic year as printed, e.g. `תשפ"ה`. */
  year: string;
  /** Semester as printed: `א'` / `ב'` / `ק'`. */
  semester: string;
  /** The sittings on this row, earliest first. */
  sittings: { moed: Moed; grade: string }[];
  /** The sheet's remark for this row, e.g. `כשלון2, לא לשקלול`. */
  note: string;
}

/** One sitting, flattened out of its row and made sortable. */
export interface GradeAttempt {
  year: string;
  semester: string;
  moed: Moed;
  /** Grade as printed, tidied: `85.00` → `85`, or a word such as `עובר`. */
  grade: string;
  /** Numeric value of `grade`, or null for a textual one. */
  score: number | null;
  /** Chronological sort key (year, semester, sitting). */
  key: number;
  /** The row's remark, if any. */
  note: string;
}

/** Every attempt at one course, split into the grade that counts and the rest. */
export interface CourseGrades {
  /** The code of the most recent attempt (see {@link aggregateGrades}). */
  code: string;
  /** Any earlier codes the same course was listed under, most recent first. */
  priorCodes: string[];
  name: string;
  credits: number | null;
  kind: string;
  /** The attempt that counts: the most recent sitting of the most recent row. */
  final: GradeAttempt;
  /** The earlier attempts, most recent first. */
  history: GradeAttempt[];
}

/** The transcript as a whole. */
export interface GradeSheet {
  student: { name: string; id: string };
  /** The `נכון ליום` date as printed, e.g. `17.09.2026`. */
  asOf: string;
  /** The sheet's own `ממוצע מצטבר`, which already applies its exclusion rules. */
  cumulativeAverage: number | null;
  /** The sheet's own `נקודות זכות מצטבר`. */
  cumulativeCredits: number | null;
  courses: CourseGrades[];
}

/**
 * The pass mark printed in the sheet's legend (`0-55 נכשל 56 עובר`). Used only
 * to flag a failing grade in the table.
 */
export const PASS_MARK = 56;

/* ----------------------------------------------------------------------------
 * Course codes
 * ------------------------------------------------------------------------- */

/**
 * A BGU course code in canonical `232-1-1011` form. The transcript prints it
 * with dots (`232.1.1011`) while the catalog uses dashes, so matching the two
 * needs one agreed spelling: department (3) - degree level (1) - course (4).
 * Anything that isn't eight digits is returned trimmed and otherwise untouched.
 */
export function normalizeCourseCode(raw: string): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 4)}-${digits.slice(4)}`;
  }
  return (raw ?? '').trim();
}

/** The course segment of a code — the part that survives a department renumber. */
function courseSegment(code: string): string {
  const digits = code.replace(/\D/g, '');
  return digits.length === 8 ? digits.slice(4) : digits;
}

/* ----------------------------------------------------------------------------
 * Terms
 * ------------------------------------------------------------------------- */

const GEMATRIA: Record<string, number> = {
  א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9,
  י: 10, כ: 20, ל: 30, מ: 40, נ: 50, ס: 60, ע: 70, פ: 80, צ: 90,
  ק: 100, ר: 200, ש: 300, ת: 400,
  ך: 20, ם: 40, ן: 50, ף: 80, ץ: 90,
};

/**
 * The Hebrew academic year as a number: `תשפ"ה` → 5785. Letters are summed by
 * gematria and the implicit millennium (ה׳ = 5000) is added back, since the
 * sheet prints the short form. Null for anything that isn't Hebrew letters.
 */
export function hebrewYearToNumber(label: string): number | null {
  const letters = [...(label ?? '').replace(/["'׳״\s]/g, '')];
  if (!letters.length || letters.some((ch) => !(ch in GEMATRIA))) return null;
  const sum = letters.reduce((acc, ch) => acc + GEMATRIA[ch], 0);
  return sum < 1000 ? sum + 5000 : sum;
}

/** Semester letter → order within the academic year (summer last). */
function semesterIndex(label: string): number {
  const s = (label ?? '').replace(/['"׳״\s]/g, '');
  if (/^(א|A)$/i.test(s) || s.includes('סתיו')) return 1;
  if (/^(ב|B)$/i.test(s) || s.includes('אביב')) return 2;
  if (/^(ק|C|S)$/i.test(s) || s.includes('קיץ') || /summer/i.test(s)) return 3;
  return 0;
}

const MOED_ORDER: Record<Moed, number> = { A: 0, B: 1, special: 2 };

/**
 * A chronological sort key for one sitting. Accepts a Hebrew year (`תשפ"ה`) or
 * a numeric one (`2025`); falls back to 0 when the year can't be read, which
 * leaves the attempt ordered by where it appeared on the sheet.
 */
export function attemptKey(year: string, semester: string, moed: Moed): number {
  const trimmed = (year ?? '').trim();
  const numeric = /^\d{4}$/.test(trimmed) ? Number(trimmed) : null;
  const y = numeric ?? hebrewYearToNumber(trimmed) ?? 0;
  return y * 100 + semesterIndex(semester) * 10 + MOED_ORDER[moed];
}

/** The printed term label, e.g. `תשפ"ה א'` — blank parts are dropped. */
export function termLabel(year: string, semester: string): string {
  return [year?.trim(), semester?.trim()].filter(Boolean).join(' ');
}

/* ----------------------------------------------------------------------------
 * Grades
 * ------------------------------------------------------------------------- */

/** `85.00` → `85`, `72.50` → `72.5`; a textual grade is returned trimmed. */
export function tidyGrade(grade: string): string {
  const raw = (grade ?? '').trim();
  return /^\d+(\.\d+)?$/.test(raw) ? String(Number(raw)) : raw;
}

/**
 * The numeric value of a printed grade, or null when it is a word (`עובר`,
 * `פטור`) — those carry no score and must not reach an average.
 */
export function scoreOf(grade: string): number | null {
  const m = /^\s*(\d{1,3}(?:\.\d+)?)\s*$/.exec(grade ?? '');
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 0 && n <= 100 ? n : null;
}

/** Whether a grade is a failing numeric one (textual grades never fail). */
export function isFailing(attempt: GradeAttempt): boolean {
  return attempt.score !== null && attempt.score < PASS_MARK;
}

/* ----------------------------------------------------------------------------
 * Aggregation
 * ------------------------------------------------------------------------- */

/** Flatten a row into one attempt per sitting. */
function attemptsOf(instance: CourseInstance): GradeAttempt[] {
  return instance.sittings
    .filter((s) => s.grade.trim() !== '')
    .map(({ moed, grade }) => ({
      year: instance.year,
      semester: instance.semester,
      moed,
      grade: tidyGrade(grade),
      score: scoreOf(grade),
      key: attemptKey(instance.year, instance.semester, moed),
      note: instance.note,
    }));
}

/** Normalized course name, for recognizing the same course under a new code. */
function nameKey(name: string): string {
  return (name ?? '').replace(/["'׳״\s]+/g, '').trim();
}

/**
 * Group course rows into one entry per course, ordering each course's attempts
 * chronologically so the last one is the grade that counts.
 *
 * Rows are grouped by course code, and two groups are then merged when they
 * share both a course name and the course segment of their code — that is a
 * department renumber (`201.1.7011` → `212.1.7011`), not a different course, so
 * the retake belongs on the same line. The surviving code is the most recent
 * one; the older spellings are kept in `priorCodes`.
 *
 * Courses come back ordered by their most recent attempt, newest first, so the
 * table opens on what the student just did.
 */
export function aggregateGrades(instances: CourseInstance[]): CourseGrades[] {
  // Group by code, keeping sheet order within each group as the tiebreaker.
  const byCode = new Map<string, CourseInstance[]>();
  for (const instance of instances) {
    const group = byCode.get(instance.code);
    if (group) group.push(instance);
    else byCode.set(instance.code, [instance]);
  }

  // Merge the groups that are the same course under a renumbered code.
  const merged = new Map<string, { codes: string[]; rows: CourseInstance[] }>();
  for (const [code, rows] of byCode) {
    const named = rows.find((r) => r.name.trim());
    const key = `${nameKey(named?.name ?? code)}|${courseSegment(code)}`;
    const entry = merged.get(key);
    if (entry) {
      entry.codes.push(code);
      entry.rows.push(...rows);
    } else {
      merged.set(key, { codes: [code], rows: [...rows] });
    }
  }

  const courses: CourseGrades[] = [];
  for (const { rows } of merged.values()) {
    const attempts = rows
      .flatMap((row, i) => attemptsOf(row).map((a) => ({ a, i })))
      .sort((x, y) => x.a.key - y.a.key || x.i - y.i)
      .map(({ a }) => a);
    if (!attempts.length) continue;

    // Rows newest first, so the identity shown is the most recent one the
    // student was enrolled under.
    const newestFirst = rows
      .map((row, i) => ({ row, i }))
      .sort(
        (a, b) =>
          attemptKey(b.row.year, b.row.semester, 'A') -
            attemptKey(a.row.year, a.row.semester, 'A') || b.i - a.i,
      )
      .map(({ row }) => row);
    const [newest, ...older] = newestFirst;

    courses.push({
      code: newest.code,
      priorCodes: [...new Set(older.map((r) => r.code))].filter(
        (c) => c !== newest.code,
      ),
      // A repeat row can leave the name or credits blank; take the first value
      // that is actually filled in so the course stays identifiable.
      name: newestFirst.map((r) => r.name).find((n) => n.trim()) ?? '',
      credits: newestFirst.map((r) => r.credits).find((c) => c !== null) ?? null,
      kind: newestFirst.map((r) => r.kind).find((k) => k.trim()) ?? '',
      final: attempts[attempts.length - 1],
      history: attempts.slice(0, -1).reverse(),
    });
  }

  return courses.sort((a, b) => b.final.key - a.final.key);
}

/**
 * Credit-weighted average over the grades that count. Courses without a numeric
 * final grade or without credits are skipped — an exemption carries no grade and
 * must not drag the average down. Null when nothing qualifies.
 *
 * This is a fallback: when the sheet prints its own `ממוצע מצטבר` prefer that,
 * since the university applies exclusion rules this cannot see.
 */
export function weightedAverage(courses: CourseGrades[]): number | null {
  let points = 0;
  let credits = 0;
  for (const c of courses) {
    if (c.final.score === null || !c.credits) continue;
    points += c.final.score * c.credits;
    credits += c.credits;
  }
  return credits ? points / credits : null;
}

/** Credits actually earned: courses whose counting grade is a pass. */
export function earnedCredits(courses: CourseGrades[]): number {
  return courses.reduce(
    (sum, c) => (c.credits && !isFailing(c.final) ? sum + c.credits : sum),
    0,
  );
}
