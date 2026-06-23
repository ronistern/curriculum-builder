import type { Course, CourseType, Program } from './types';
import { SEMESTERS } from './types';

/** Numeric order of a semester within a year, used for prerequisite checks. */
const SEMESTER_ORDER: Record<string, number> = { A: 0, B: 1, Summer: 2 };

export function timeIndex(course: Course): number {
  return course.year * 10 + (SEMESTER_ORDER[course.semester] ?? 0);
}

export interface PrereqIssue {
  course: Course;
  prereq: Course;
  reason: 'not-before' | 'missing';
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

export function totalCredits(program: Program): number {
  return program.courses.reduce((sum, c) => sum + (c.credits || 0), 0);
}

export function creditsByType(program: Program): Record<CourseType, number> {
  const out = {} as Record<CourseType, number>;
  for (const c of program.courses) {
    out[c.type] = (out[c.type] ?? 0) + (c.credits || 0);
  }
  return out;
}

export function creditsByYear(program: Program): number[] {
  const out = Array.from({ length: program.years }, () => 0);
  for (const c of program.courses) {
    if (c.year >= 1 && c.year <= program.years) {
      out[c.year - 1] += c.credits || 0;
    }
  }
  return out;
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
