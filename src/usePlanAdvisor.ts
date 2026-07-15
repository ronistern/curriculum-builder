import { useMemo } from 'react';
import type { Course, Program } from './types';
import type { StudentPlanStore } from './studentPlanStore';
import {
  advisedProgram,
  generatePlan,
  planCourses,
  type CourseStatus,
  type TermSlot,
} from './studentPlan';
import { allCatalogs } from './catalogLibrary';
import type { PickerGroup } from './components/CoursePicker';

/**
 * The advise-mode behaviours: the derived program views the grid renders plus
 * the plan mutations the grid and picker trigger. Extracted from `App` so the
 * component stays a thin composition layer and this logic lives next to the
 * plan model it operates on. All mutations go through `plan.setPlan`; nothing
 * here touches component UI state (the picker's open/closed state, etc.).
 */
export interface PlanAdvisor {
  /** Cycle a course's plan status: to-plan → completed → in-progress → to-plan. */
  cycleStatus: (id: string) => void;
  /** Remove a course from the plan (excluding a base course, dropping an extra). */
  removeCourse: (id: string) => void;
  /** Place a catalog course into a specific cell, pinning it over the scheduler. */
  addCourseAt: (course: Course, slot: TermSlot) => void;
  /** Apply the auto-scheduler's result to the plan's stored schedule. */
  generate: () => void;
  /** Adopt an opened program as the plan's referenced catalog. */
  adoptCatalog: (opened: Program) => void;
  /**
   * The plan projected onto its catalog for the grid (scheduled / placed slots
   * applied), or null when no plan is open or its catalog can't be resolved.
   */
  advised: Program | null;
  /** Courses selectable in the per-cell picker, grouped by source program. */
  pickerGroups: PickerGroup[];
  /** Ids already in the plan, so the picker can flag them. */
  pickerInPlan: Set<string>;
}

export function usePlanAdvisor(plan: StudentPlanStore): PlanAdvisor {
  const { plan: current, catalog, setPlan } = plan;

  // Cycle a course's plan status: to-plan → completed → in-progress → to-plan.
  const cycleStatus = (id: string) =>
    setPlan((p) => {
      const next: Record<string, CourseStatus> = { ...p.status };
      const cur = next[id];
      if (!cur) next[id] = 'completed';
      else if (cur === 'completed') next[id] = 'in-progress';
      else delete next[id];
      return { ...p, status: next };
    });

  // Remove a course from this student's plan (also clearing any status / slot /
  // manual placement). A base catalog course goes onto `excluded`; an added
  // course is dropped from `extraCourses`. Either way it's re-addable via the
  // grid's per-cell "+".
  const removeCourse = (id: string) =>
    setPlan((p) => {
      const status = { ...p.status };
      const schedule = { ...p.schedule };
      const placements = { ...p.placements };
      delete status[id];
      delete schedule[id];
      delete placements[id];
      const isBase = !!catalog?.courses.some((c) => c.id === id);
      return {
        ...p,
        status,
        schedule,
        placements,
        excluded:
          isBase && !p.excluded.includes(id) ? [...p.excluded, id] : p.excluded,
        extraCourses: isBase
          ? p.extraCourses
          : p.extraCourses.filter((c) => c.id !== id),
      };
    });

  // Add a catalog course into a specific cell (year+semester). A base course is
  // un-excluded and pinned there; a course from another program is snapshotted
  // into `extraCourses`. Either way its placement overrides the auto-scheduler.
  const addCourseAt = (course: Course, slot: TermSlot) =>
    setPlan((p) => {
      const isBase = !!catalog?.courses.some((c) => c.id === course.id);
      const placements = { ...p.placements, [course.id]: slot };
      return isBase
        ? { ...p, placements, excluded: p.excluded.filter((x) => x !== course.id) }
        : {
            ...p,
            placements,
            extraCourses: p.extraCourses.some((c) => c.id === course.id)
              ? p.extraCourses
              : [...p.extraCourses, course],
          };
    });

  const generate = () =>
    catalog &&
    setPlan((p) => ({ ...p, schedule: generatePlan(p, catalog).schedule }));

  // Resolve the referenced catalog from an opened file when it isn't in the
  // library (e.g. a plan saved on another device), adopting its id.
  const adoptCatalog = (opened: Program) => {
    plan.provideCatalog(opened);
    setPlan((p) => ({ ...p, catalogId: opened.id, catalogName: opened.name }));
  };

  // Courses selectable in the per-cell picker: every course across all catalogs
  // in the library (deduped by id). Courses already in this plan are included
  // too — picking one re-places it into the chosen cell — and flagged via
  // `pickerInPlan` so the picker can mark them.
  const pickerInPlan = useMemo(
    () =>
      current && catalog
        ? new Set(planCourses(catalog, current).map((c) => c.id))
        : new Set<string>(),
    [current, catalog],
  );
  const pickerGroups = useMemo(() => {
    if (!current || !catalog) return [];
    const seen = new Set<string>();
    return allCatalogs()
      .map((prog) => ({
        program: `${prog.degree} ${prog.name}`.trim(),
        courses: prog.courses.filter((c) => {
          if (seen.has(c.id)) return false;
          seen.add(c.id);
          return true;
        }),
      }))
      .filter((g) => g.courses.length > 0);
  }, [current, catalog]);

  // The schedule grid places to-plan courses (scheduled) + in-progress courses
  // (at the current term); completed courses are listed in the AdvisePanel.
  const advised = useMemo(
    () => (current && catalog ? advisedProgram(current, catalog) : null),
    [current, catalog],
  );

  return {
    cycleStatus,
    removeCourse,
    addCourseAt,
    generate,
    adoptCatalog,
    advised,
    pickerGroups,
    pickerInPlan,
  };
}
