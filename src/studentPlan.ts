import type { Course, Program, Semester } from './types';
import {
  activeSemesters,
  courseWeights,
  timeIndex,
  weightedCreditOf,
  weightedCredits,
} from './stats';
import { normalizeProgram } from './fileStore';
import { serializeJson } from './util';

/**
 * Per-course status in a student's plan. A course with no entry is still to be
 * planned — the auto-scheduler will place it (see {@link generatePlan}).
 */
export type CourseStatus = 'completed' | 'in-progress';

/** A point on the study timeline. */
export interface TermSlot {
  year: number;
  semester: Semester;
}

/**
 * An advisor's plan for one student against a snapshot of a curriculum. This is
 * a self-contained document (it embeds the {@link Program}) saved to its own
 * `.plan.json` file, so the master curriculum stays clean and reusable.
 */
export interface StudentPlan {
  /** File discriminator; distinguishes a plan file from a bare curriculum. */
  kind: 'student-plan';
  version: 1;
  student: { name: string; id?: string };
  /** Snapshot of the curriculum this plan is built against. */
  curriculum: Program;
  /** courseId -> status. Absent means "still to plan". */
  status: Record<string, CourseStatus>;
  /** The term the student is resuming from; the schedule starts here. */
  current: TermSlot;
  maxCreditsPerSemester: number;
  /** courseId -> assigned slot, produced by {@link generatePlan}. */
  schedule: Record<string, TermSlot>;
}

export const DEFAULT_MAX_CREDITS = 20;

/** Where a plan starts scheduling from when none is specified. */
export const DEFAULT_START_TERM: TermSlot = { year: 1, semester: 'A' };

/** A fresh plan seeded from a curriculum, before any scheduling. */
export function newStudentPlan(curriculum: Program): StudentPlan {
  return {
    kind: 'student-plan',
    version: 1,
    student: { name: '' },
    curriculum,
    status: {},
    current: { ...DEFAULT_START_TERM },
    maxCreditsPerSemester: DEFAULT_MAX_CREDITS,
    schedule: {},
  };
}

/* ----------------------------------------------------------------------------
 * Scheduler
 * ------------------------------------------------------------------------- */

/** The ordered list of future terms starting at `from`, `count` terms long. */
export function futureTerms(program: Program, from: TermSlot, count: number): TermSlot[] {
  const sems = activeSemesters(program);
  const startSem = Math.max(0, sems.indexOf(from.semester));
  const slots: TermSlot[] = [];
  let year = from.year;
  let s = startSem;
  for (let i = 0; i < count; i++) {
    slots.push({ year, semester: sems[s] });
    s += 1;
    if (s >= sems.length) {
      s = 0;
      year += 1;
    }
  }
  return slots;
}

export interface PlanResult {
  schedule: Record<string, TermSlot>;
  /** Courses that could not be placed (see {@link UnschedulableReason}). */
  unschedulable: { course: Course; reason: UnschedulableReason }[];
}

export type UnschedulableReason =
  | 'prereqs' // a prerequisite is never satisfied within the horizon
  | 'capacity'; // its term is offered but always over the credit cap

/** Extra terms beyond the nominal program length, so a solvable plan always fits. */
const SCHEDULE_HORIZON_HEADROOM = 8;

const termKey = (t: TermSlot) => `${t.year}-${t.semester}`;

/** Ids of courses that already satisfy prerequisites (completed or in-progress). */
function initialSatisfied(plan: StudentPlan): Set<string> {
  return new Set(
    Object.entries(plan.status)
      .filter(([, s]) => s === 'completed' || s === 'in-progress')
      .map(([id]) => id),
  );
}

/** Per-term credit load pre-seeded with in-progress courses pinned at `current`. */
function seedLoad(
  plan: StudentPlan,
  creditOf: (c: Course) => number,
): Map<string, number> {
  const load = new Map<string, number>();
  const k = termKey(plan.current);
  for (const c of plan.curriculum.courses) {
    if (plan.status[c.id] === 'in-progress') {
      load.set(k, (load.get(k) ?? 0) + creditOf(c));
    }
  }
  return load;
}

/** Classify the courses that never got placed: unmet prereqs vs. no room. */
function classifyUnschedulable(
  toPlan: Course[],
  placed: Set<string>,
  satisfied: Set<string>,
): PlanResult['unschedulable'] {
  return toPlan
    .filter((c) => !placed.has(c.id))
    .map((c) => ({
      course: c,
      reason: c.prerequisites.every((p) => satisfied.has(p))
        ? ('capacity' as const)
        : ('prereqs' as const),
    }));
}

/**
 * Greedy term-by-term placement of the still-to-plan courses. Respects, in
 * order: prerequisites (a course may only be placed once all its prereqs are
 * satisfied by a strictly earlier term), the term the course is offered in
 * (A/B/Summer), and the per-semester weighted-credit cap. Completed and
 * in-progress courses are treated as already satisfying prerequisites;
 * in-progress ones pre-occupy the `current` term's load.
 */
export function generatePlan(plan: StudentPlan): PlanResult {
  const program = plan.curriculum;
  const weights = courseWeights(program);
  const creditOf = (c: Course) => weightedCreditOf(c, weights);

  const satisfied = initialSatisfied(plan);

  const toPlan = program.courses
    .filter((c) => !plan.status[c.id])
    .sort((a, b) => timeIndex(a) - timeIndex(b) || b.credits - a.credits);

  // Horizon: enough terms that a solvable plan always fits, plus headroom.
  const termCount =
    Math.max(program.years, 1) * activeSemesters(program).length +
    SCHEDULE_HORIZON_HEADROOM;
  const terms = futureTerms(program, plan.current, termCount);

  const schedule: Record<string, TermSlot> = {};
  const placed = new Set<string>();
  const load = seedLoad(plan, creditOf);

  for (const term of terms) {
    const k = termKey(term);
    const newlyPlaced: string[] = [];
    for (const course of toPlan) {
      if (placed.has(course.id)) continue;
      if (course.semester !== term.semester) continue;
      if (!course.prerequisites.every((p) => satisfied.has(p))) continue;
      const credits = creditOf(course);
      if ((load.get(k) ?? 0) + credits > plan.maxCreditsPerSemester) continue;
      schedule[course.id] = { year: term.year, semester: term.semester };
      load.set(k, (load.get(k) ?? 0) + credits);
      placed.add(course.id);
      newlyPlaced.push(course.id);
    }
    // Courses unlock their dependents only from the following term onward.
    for (const id of newlyPlaced) satisfied.add(id);
  }

  return { schedule, unschedulable: classifyUnschedulable(toPlan, placed, satisfied) };
}

/* ----------------------------------------------------------------------------
 * Plan-level stats
 * ------------------------------------------------------------------------- */

export interface PlanCredits {
  earned: number; // completed
  inProgress: number;
  planned: number; // still-to-plan
  required: number;
}

/** Weighted credit totals by status, plus the curriculum requirement. */
export function planCredits(plan: StudentPlan): PlanCredits {
  const program = plan.curriculum;
  const byStatus = (want: CourseStatus | null) =>
    weightedCredits(
      program,
      program.courses.filter((c) =>
        want ? plan.status[c.id] === want : !plan.status[c.id],
      ),
    );
  return {
    earned: byStatus('completed'),
    inProgress: byStatus('in-progress'),
    planned: byStatus(null),
    required: program.requiredCredits,
  };
}

/* ----------------------------------------------------------------------------
 * Serialization / parsing
 * ------------------------------------------------------------------------- */

export function isStudentPlan(value: unknown): value is StudentPlan {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { kind?: unknown }).kind === 'student-plan'
  );
}

export function serializeStudentPlan(plan: StudentPlan): string {
  return serializeJson(plan);
}

/** Parse and lightly validate a student plan from raw JSON text. */
export function parseStudentPlan(text: string): StudentPlan {
  const parsed = JSON.parse(text) as StudentPlan;
  if (!isStudentPlan(parsed) || !parsed.curriculum || !Array.isArray(parsed.curriculum.courses)) {
    throw new Error('File does not look like a student plan.');
  }
  parsed.status ??= {};
  parsed.schedule ??= {};
  parsed.current ??= { ...DEFAULT_START_TERM };
  parsed.maxCreditsPerSemester ??= DEFAULT_MAX_CREDITS;
  normalizeProgram(parsed.curriculum);
  return parsed;
}

/* ----------------------------------------------------------------------------
 * Grid projection
 * ------------------------------------------------------------------------- */

/**
 * Project a plan onto a curriculum for the advise-mode grid: still-to-plan
 * courses move to their scheduled slot; completed / in-progress courses stay at
 * their curriculum slot. The year count grows to cover the schedule's reach.
 */
export function advisedProgram(plan: StudentPlan): Program {
  const { curriculum, schedule, status, current } = plan;
  return {
    ...curriculum,
    years: Math.max(
      curriculum.years,
      current.year,
      ...Object.values(schedule).map((s) => s.year),
    ),
    courses: curriculum.courses.map((c) => {
      const slot = !status[c.id] ? schedule[c.id] : undefined;
      return slot ? { ...c, year: slot.year, semester: slot.semester } : c;
    }),
  };
}
