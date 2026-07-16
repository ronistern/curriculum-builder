import type { Course, Program, Semester } from './types';
import { weightedCredits } from './stats';
import { normalizeProgram } from './fileStore';
import { upsertCatalog } from './catalogLibrary';
import { serializeJson } from './util';

/**
 * Per-course status in a student's plan. A course with no entry is still to be
 * planned.
 */
export type CourseStatus = 'completed' | 'in-progress';

/** A point on the study timeline. */
export interface TermSlot {
  year: number;
  semester: Semester;
}

/**
 * An advisor's plan for one student. Rather than embedding a curriculum, it
 * *references* a shared catalog by {@link Program.id} (resolved via
 * `catalogLibrary`) and records the subset the student actually takes: every
 * catalog course is included by default, and `excluded` lists the ones removed
 * for this student. Saved to its own `.plan.json` file.
 */
export interface StudentPlan {
  /** File discriminator; distinguishes a plan file from a bare curriculum. */
  kind: 'student-plan';
  version: 2;
  student: { name: string; id?: string };
  /** The catalog this plan is built against (see {@link Program.id}). */
  catalogId: string;
  /** Catalog name, kept for display if the catalog can't be resolved. */
  catalogName: string;
  /** Catalog course ids this student does NOT take. */
  excluded: string[];
  /**
   * Courses added to this student from outside the base catalog (e.g. a course
   * from another program in the library). Stored as snapshots so the plan is
   * self-describing even if that other catalog isn't available.
   */
  extraCourses: Course[];
  /**
   * Manual cell placement (year+semester) for a course the advisor dropped into
   * a specific slot via the grid's per-cell "+". Overrides the course's
   * catalog-recommended term.
   */
  placements: Record<string, TermSlot>;
  /** courseId -> status. Absent means "still to plan". */
  status: Record<string, CourseStatus>;
  /** The term the student is resuming from; the schedule starts here. */
  current: TermSlot;
  maxCreditsPerSemester: number;
  /**
   * courseId -> assigned slot. Retained for backward-compatibility with
   * existing plan files; no longer populated (kept empty on new plans).
   */
  schedule: Record<string, TermSlot>;
}

export const DEFAULT_MAX_CREDITS = 20;

/** Where a plan starts scheduling from when none is specified. */
export const DEFAULT_START_TERM: TermSlot = { year: 1, semester: 'A' };

/** A fresh plan referencing a catalog, with every course included. */
export function newStudentPlan(catalog: Program): StudentPlan {
  return {
    kind: 'student-plan',
    version: 2,
    student: { name: '' },
    catalogId: catalog.id,
    catalogName: catalog.name,
    excluded: [],
    extraCourses: [],
    placements: {},
    status: {},
    current: { ...DEFAULT_START_TERM },
    maxCreditsPerSemester: DEFAULT_MAX_CREDITS,
    schedule: {},
  };
}

/* ----------------------------------------------------------------------------
 * Effective course set
 * ------------------------------------------------------------------------- */

/**
 * Every course in this student's plan: the base catalog minus `excluded`, plus
 * any `extraCourses` added from other programs (deduped by id, base winning).
 */
export function planCourses(catalog: Program, plan: StudentPlan): Course[] {
  const excluded = new Set(plan.excluded);
  const base = catalog.courses.filter((c) => !excluded.has(c.id));
  const baseIds = new Set(base.map((c) => c.id));
  const extras = (plan.extraCourses ?? []).filter((c) => !baseIds.has(c.id));
  return [...base, ...extras];
}

/**
 * The catalog narrowed to the student's subset: excluded courses dropped, and
 * bundles / elective groups pruned to those that still have members. Used
 * wherever a plan needs a program-shaped view of what the student takes.
 */
export function effectiveCatalog(catalog: Program, plan: StudentPlan): Program {
  const courses = planCourses(catalog, plan);
  return {
    ...catalog,
    courses,
    bundles: catalog.bundles.filter((b) => courses.some((c) => c.bundleId === b.id)),
    electiveGroups: (catalog.electiveGroups ?? []).filter((g) =>
      courses.some((c) => c.electiveGroupId === g.id),
    ),
  };
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

/** Weighted credit totals by status, plus the catalog requirement. */
export function planCredits(plan: StudentPlan, catalog: Program): PlanCredits {
  const program = effectiveCatalog(catalog, plan);
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
    required: catalog.requiredCredits,
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

/** The pre-v2 plan shape, which embedded a full curriculum snapshot. */
interface LegacyStudentPlan {
  kind: 'student-plan';
  student?: { name: string; id?: string };
  curriculum: Program;
  status?: Record<string, CourseStatus>;
  current?: TermSlot;
  maxCreditsPerSemester?: number;
  schedule?: Record<string, TermSlot>;
}

/**
 * Parse and lightly validate a student plan from raw JSON text. Migrates the
 * pre-v2 shape (an embedded `curriculum`) to the reference model, registering
 * the embedded catalog into the library so the migrated plan can resolve it.
 */
export function parseStudentPlan(text: string): StudentPlan {
  const parsed = JSON.parse(text) as StudentPlan | LegacyStudentPlan;
  if (!isStudentPlan(parsed)) {
    throw new Error('File does not look like a student plan.');
  }

  // v1 -> v2: lift the embedded curriculum into the catalog library.
  if ('curriculum' in parsed && parsed.curriculum) {
    const legacy = parsed as LegacyStudentPlan;
    const catalog = normalizeProgram(legacy.curriculum);
    upsertCatalog(catalog);
    return {
      kind: 'student-plan',
      version: 2,
      student: legacy.student ?? { name: '' },
      catalogId: catalog.id,
      catalogName: catalog.name,
      excluded: [],
      extraCourses: [],
      placements: {},
      status: legacy.status ?? {},
      current: legacy.current ?? { ...DEFAULT_START_TERM },
      maxCreditsPerSemester: legacy.maxCreditsPerSemester ?? DEFAULT_MAX_CREDITS,
      schedule: legacy.schedule ?? {},
    };
  }

  const plan = parsed as StudentPlan;
  if (!plan.catalogId) {
    throw new Error('File does not look like a student plan.');
  }
  plan.excluded ??= [];
  plan.extraCourses ??= [];
  plan.placements ??= {};
  plan.status ??= {};
  plan.schedule ??= {};
  plan.current ??= { ...DEFAULT_START_TERM };
  plan.maxCreditsPerSemester ??= DEFAULT_MAX_CREDITS;
  plan.catalogName ??= '';
  return plan;
}

/* ----------------------------------------------------------------------------
 * Grid projection
 * ------------------------------------------------------------------------- */

/**
 * Project a plan onto its catalog (narrowed to the student's subset) for the
 * advise-mode grid: a manually-placed course moves to its chosen slot;
 * everything else stays at its catalog slot. The year count grows to cover the
 * placements' reach.
 */
export function advisedProgram(plan: StudentPlan, catalog: Program): Program {
  const program = effectiveCatalog(catalog, plan);
  const { placements, schedule, status } = plan;
  // Placement priority: a manual cell override, else a stored schedule slot
  // (legacy plans only; empty now), else the course's own recommended slot.
  const courses = program.courses.map((c) => {
    const slot = placements?.[c.id] ?? (!status[c.id] ? schedule[c.id] : undefined);
    return slot ? { ...c, year: slot.year, semester: slot.semester } : c;
  });
  const years = Math.max(
    program.years,
    plan.current.year,
    ...courses.map((c) => c.year),
    1,
  );
  return { ...program, years, courses };
}

/* ----------------------------------------------------------------------------
 * Plan vs. recommended program
 * ------------------------------------------------------------------------- */

/** Ids of courses the student has already completed. */
function completedIds(plan: StudentPlan): Set<string> {
  return new Set(
    Object.entries(plan.status)
      .filter(([, s]) => s === 'completed')
      .map(([id]) => id),
  );
}

/**
 * The recommended program and the student's plan as two program-shaped values
 * ready for {@link ../diff.diffPrograms}. `recommended` is the untouched
 * catalog; `planned` is the advised projection — excluded courses dropped,
 * extras added, and every remaining course at its scheduled / manually-placed
 * slot. Courses the student has already completed are removed from BOTH sides,
 * so a finished course never surfaces as a change.
 */
export function planVsProgram(
  plan: StudentPlan,
  catalog: Program,
): { recommended: Program; planned: Program } {
  const done = completedIds(plan);
  const drop = (p: Program): Program => ({
    ...p,
    courses: p.courses.filter((c) => !done.has(c.id)),
  });
  return {
    recommended: drop(catalog),
    planned: drop(advisedProgram(plan, catalog)),
  };
}
