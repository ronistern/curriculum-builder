import type { Course, Program } from './types';
import { totalCredits } from './stats';

/**
 * Structural diff between two curriculums. Pure logic — no React, no i18n.
 * Courses are matched by their stable `id`; the same id present in both
 * programs is treated as the same course and compared field-by-field.
 */

export type CourseField =
  | 'code'
  | 'name'
  | 'credits'
  | 'type'
  | 'category'
  | 'year'
  | 'semester'
  | 'description'
  | 'prerequisites';

export type ProgramField =
  | 'name'
  | 'degree'
  | 'institution'
  | 'years'
  | 'requiredCredits'
  | 'showSummer';

/** A single field whose value differs between the two versions. */
export interface FieldChange<F> {
  field: F;
  /** Display-ready value in the base (left) program. '' when absent. */
  before: string;
  /** Display-ready value in the other (right) program. '' when absent. */
  after: string;
}

export interface ModifiedCourse {
  before: Course;
  after: Course;
  changes: FieldChange<CourseField>[];
}

export interface CurriculumDiff {
  /** Program-level metadata changes (name, degree, required credits, …). */
  meta: FieldChange<ProgramField>[];
  /** Courses present in `other` but not `base`. */
  added: Course[];
  /** Courses present in `base` but not `other`. */
  removed: Course[];
  /** Courses present in both whose fields differ. */
  modified: ModifiedCourse[];
  /** totalCredits(other) − totalCredits(base). */
  creditDelta: number;
  /** True when anything at all differs. */
  hasChanges: boolean;
}

const COURSE_FIELDS: CourseField[] = [
  'code',
  'name',
  'credits',
  'type',
  'category',
  'year',
  'semester',
  'description',
  'prerequisites',
];

const PROGRAM_FIELDS: ProgramField[] = [
  'name',
  'degree',
  'institution',
  'years',
  'requiredCredits',
  'showSummer',
];

/** Resolve prerequisite ids to a stable, comma-joined list of course names. */
function prereqNames(ids: string[], byId: Map<string, Course>): string {
  return ids
    .map((id) => byId.get(id)?.name ?? id)
    .sort((a, b) => a.localeCompare(b))
    .join(', ');
}

/**
 * A field's value rendered two ways: `key` is what we compare for equality,
 * `display` is what we show. They differ for prerequisites — we compare the
 * stored ids (so renaming a *referenced* course doesn't flag this one as
 * changed) but display the resolved course names.
 */
function courseValue(
  course: Course,
  field: CourseField,
  byId: Map<string, Course>,
): { key: string; display: string } {
  if (field === 'prerequisites') {
    return {
      key: [...course.prerequisites].sort((a, b) => a.localeCompare(b)).join(','),
      display: prereqNames(course.prerequisites, byId),
    };
  }
  const v = course[field];
  const s = v === undefined || v === null ? '' : String(v);
  return { key: s, display: s };
}

const byCode = (a: Course, b: Course) => a.code.localeCompare(b.code);

export function diffPrograms(base: Program, other: Program): CurriculumDiff {
  const baseById = new Map(base.courses.map((c) => [c.id, c]));
  const otherById = new Map(other.courses.map((c) => [c.id, c]));

  const meta: FieldChange<ProgramField>[] = [];
  for (const field of PROGRAM_FIELDS) {
    const before = String(base[field]);
    const after = String(other[field]);
    if (before !== after) meta.push({ field, before, after });
  }

  const added = other.courses
    .filter((c) => !baseById.has(c.id))
    .sort(byCode);
  const removed = base.courses
    .filter((c) => !otherById.has(c.id))
    .sort(byCode);

  const modified: ModifiedCourse[] = [];
  for (const before of base.courses) {
    const after = otherById.get(before.id);
    if (!after) continue;
    const changes: FieldChange<CourseField>[] = [];
    for (const field of COURSE_FIELDS) {
      const b = courseValue(before, field, baseById);
      const a = courseValue(after, field, otherById);
      if (b.key !== a.key) {
        changes.push({ field, before: b.display, after: a.display });
      }
    }
    if (changes.length) modified.push({ before, after, changes });
  }
  modified.sort((a, b) => byCode(a.after, b.after));

  const creditDelta = totalCredits(other) - totalCredits(base);

  return {
    meta,
    added,
    removed,
    modified,
    creditDelta,
    hasChanges:
      meta.length > 0 ||
      added.length > 0 ||
      removed.length > 0 ||
      modified.length > 0,
  };
}
