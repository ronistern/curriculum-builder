import type { Course, CourseType, ElectiveGroup, Program } from './types';
import { SEMESTERS } from './types';

/** Numeric order of a semester within a year, derived from {@link SEMESTERS}. */
const SEMESTER_ORDER: Record<string, number> = Object.fromEntries(
  SEMESTERS.map((s, i) => [s, i]),
);

/** Year stride in {@link timeIndex}; larger than any semester index. */
const YEAR_STRIDE = 10;

export function timeIndex(course: Course): number {
  return course.year * YEAR_STRIDE + (SEMESTER_ORDER[course.semester] ?? 0);
}

export interface PrereqIssue {
  course: Course;
  prereq: Course;
  reason: 'not-before' | 'missing';
}

/**
 * Resolve a course's prerequisite ids to display labels (code, falling back to
 * name), dropping any that no longer resolve. Used by the grid and Word export.
 */
export function prereqLabels(
  course: Course,
  byId: Map<string, Course>,
): string[] {
  return course.prerequisites
    .map((id) => {
      const c = byId.get(id);
      return c?.code || c?.name;
    })
    .filter((x): x is string => Boolean(x));
}

/** Prerequisites that are missing, or scheduled at/after the course itself. */
export function findPrereqIssues(program: Program): PrereqIssue[] {
  const byId = new Map(program.courses.map((c) => [c.id, c]));
  const issues: PrereqIssue[] = [];
  for (const course of program.courses) {
    for (const preId of course.prerequisites) {
      const prereq = byId.get(preId);
      if (!prereq) continue; // dangling ref, skip silently
      if (timeIndex(prereq) >= timeIndex(course)) {
        issues.push({ course, prereq, reason: 'not-before' });
      }
    }
  }
  return issues;
}

/**
 * Per-course credit-counting weight, accounting for bundles. A bundle's members
 * collectively count as `choose` of its courses, so each of the `m` members is
 * weighted `choose / m` (with equal-credit members this counts one course's
 * worth per pick). Standalone courses weigh 1. A `bundleId` that points at no
 * known bundle, or a bundle that ended up with no members, falls back to 1.
 */
export function courseWeights(program: Program): Map<string, number> {
  const memberCount = new Map<string, number>();
  for (const c of program.courses) {
    if (c.bundleId) {
      memberCount.set(c.bundleId, (memberCount.get(c.bundleId) ?? 0) + 1);
    }
  }
  const chooseById = new Map((program.bundles ?? []).map((b) => [b.id, b.choose]));
  const weights = new Map<string, number>();
  for (const c of program.courses) {
    const count = c.bundleId ? memberCount.get(c.bundleId) ?? 0 : 0;
    if (c.bundleId && count > 0 && chooseById.has(c.bundleId)) {
      weights.set(c.id, (chooseById.get(c.bundleId) ?? 1) / count);
    } else {
      weights.set(c.id, 1);
    }
  }
  return weights;
}

/** Round away floating-point noise from fractional bundle weights (2 dp). */
const tidy = (n: number): number => Math.round(n * 100) / 100;

/** One course's credits scaled by its bundle weight (standalone courses weigh 1). */
export function weightedCreditOf(
  course: Course,
  weights: Map<string, number>,
): number {
  return (course.credits || 0) * (weights.get(course.id) ?? 1);
}

/**
 * Sum credits over a list of courses, applying each course's bundle weight.
 * Pass the program so weights can be resolved; used for both program totals and
 * per-cell sums in the grid so the figures agree.
 */
export function weightedCredits(program: Program, courses: Course[]): number {
  const w = courseWeights(program);
  return tidy(courses.reduce((sum, c) => sum + weightedCreditOf(c, w), 0));
}

export function totalCredits(program: Program): number {
  return weightedCredits(program, program.courses);
}

export function creditsByType(program: Program): Record<CourseType, number> {
  const w = courseWeights(program);
  const out = {} as Record<CourseType, number>;
  for (const c of program.courses) {
    out[c.type] = (out[c.type] ?? 0) + weightedCreditOf(c, w);
  }
  for (const k of Object.keys(out) as CourseType[]) out[k] = tidy(out[k]);
  return out;
}

export function creditsByYear(program: Program): number[] {
  const w = courseWeights(program);
  const out = Array.from({ length: program.years }, () => 0);
  for (const c of program.courses) {
    if (c.year >= 1 && c.year <= program.years) {
      out[c.year - 1] += weightedCreditOf(c, w);
    }
  }
  return out.map(tidy);
}

export function coursesAt(
  program: Program,
  year: number,
  semester: string,
): Course[] {
  return program.courses
    .filter((c) => c.year === year && c.semester === semester)
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function activeSemesters(program: Program) {
  return program.showSummer ? SEMESTERS : SEMESTERS.filter((s) => s !== 'Summer');
}

export interface ElectiveProgress {
  group: ElectiveGroup;
  /** Credits of the placed elective courses tagged to this group. */
  placed: number;
  /** The group's credit target. */
  required: number;
  /** Whether the placed credits exactly meet the target. */
  met: boolean;
}

/**
 * For each elective group, sum the credits of the courses placed into it and
 * compare against its target. Members count their full credits (they are not
 * weighted like bundle members).
 */
export function electiveProgress(program: Program): ElectiveProgress[] {
  const placedById = new Map<string, number>();
  for (const c of program.courses) {
    if (c.electiveGroupId) {
      placedById.set(
        c.electiveGroupId,
        (placedById.get(c.electiveGroupId) ?? 0) + (c.credits || 0),
      );
    }
  }
  return (program.electiveGroups ?? []).map((group) => {
    const placed = tidy(placedById.get(group.id) ?? 0);
    return {
      group,
      placed,
      required: group.requiredCredits,
      // Tolerant compare: `placed` is 2dp-rounded, the target may not be.
      met: Math.abs(placed - group.requiredCredits) < 0.005,
    };
  });
}
