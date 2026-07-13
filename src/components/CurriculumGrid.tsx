import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Bundle, Course, Program, Semester } from '../types';
import {
  activeSemesters,
  coursesAt,
  electiveProgress,
  findPrereqIssues,
  prereqLabels,
  weightedCredits,
} from '../stats';
import { CourseCard, type Highlight } from './CourseCard';
import type { CourseStatus } from '../studentPlan';
import { useI18n } from '../i18n/useI18n';

interface Props {
  program: Program;
  editable: boolean;
  /** Edit-mode: open a course (double-click). */
  onEdit?: (course: Course) => void;
  /** Edit-mode: add a course to a cell. */
  onAdd?: (year: number, semester: Semester) => void;
  /** True in advise mode (a card click cycles plan status instead of selecting). */
  advise?: boolean;
  /** Advise mode: resolve a course's plan status (undefined = still to plan). */
  statusOf?: (id: string) => CourseStatus | undefined;
  /** Advise mode: advance a course's plan status on click. */
  onCycleStatus?: (id: string) => void;
}

export function CurriculumGrid({
  program,
  editable,
  onEdit,
  onAdd,
  advise = false,
  statusOf,
  onCycleStatus,
}: Props) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // All maps/sets below derive purely from `program`, so recompute them only
  // when it changes — not on every selection re-render.
  const { byId, issueCourseIds, bundleById, electiveById, electiveStatus, semesters, years } =
    useMemo(() => {
      return {
        byId: new Map(program.courses.map((c) => [c.id, c])),
        issueCourseIds: new Set(findPrereqIssues(program).map((i) => i.course.id)),
        bundleById: new Map(program.bundles.map((b) => [b.id, b])),
        electiveById: new Map((program.electiveGroups ?? []).map((g) => [g.id, g])),
        // Program-wide progress per elective group, so each cell's group header
        // can show the overall filled/target figure (placeholders span cells).
        electiveStatus: new Map(electiveProgress(program).map((p) => [p.group.id, p])),
        semesters: activeSemesters(program),
        years: Array.from({ length: program.years }, (_, i) => i + 1),
      };
    }, [program]);

  const selected = selectedId ? byId.get(selectedId) : undefined;
  const prereqIds = new Set(selected?.prerequisites ?? []);
  const dependentIds = new Set(
    selected
      ? program.courses
          .filter((c) => c.prerequisites.includes(selected.id))
          .map((c) => c.id)
      : [],
  );

  const highlightOf = (id: string): Highlight | undefined => {
    if (!selected) return undefined;
    if (id === selected.id) return 'selected';
    if (prereqIds.has(id)) return 'prereq';
    if (dependentIds.has(id)) return 'dependent';
    return undefined;
  };

  const renderCard = (c: Course) => (
    <CourseCard
      key={c.id}
      course={c}
      editable={editable}
      hasIssue={issueCourseIds.has(c.id)}
      highlight={highlightOf(c.id)}
      status={statusOf?.(c.id)}
      advise={advise}
      prereqLabels={prereqLabels(c, byId)}
      onSelect={() => setSelectedId((cur) => (cur === c.id ? null : c.id))}
      onCycle={() => onCycleStatus?.(c.id)}
      onOpen={() => onEdit?.(c)}
    />
  );

  /** A "choose one" / elective credit-target box wrapping its member cards. */
  const groupBox = (
    key: string,
    className: string,
    name: string,
    badge: ReactNode,
    children: ReactNode,
  ) => (
    <div className={className} key={key}>
      <div className="bundle-head">
        <span className="bundle-name">{name}</span>
        {badge}
      </div>
      {children}
    </div>
  );

  /**
   * Render a cell's courses, drawing each bundle's same-cell members inside a
   * single "choose one" box at the position of the bundle's first member.
   */
  const renderCell = (courses: Course[]) => {
    const drawnBundles = new Set<string>();
    const drawnElectives = new Set<string>();
    return courses.map((c) => {
      // Elective placeholders group into a credit-target box (checked first, as
      // an elective course is never also a choose-one bundle member).
      const group = c.electiveGroupId
        ? electiveById.get(c.electiveGroupId)
        : undefined;
      if (group) {
        if (drawnElectives.has(group.id)) return null;
        drawnElectives.add(group.id);
        const members = courses.filter((m) => m.electiveGroupId === group.id);
        const status = electiveStatus.get(group.id);
        return groupBox(
          `elective-${group.id}`,
          'elective-box',
          group.name || t('summary.electiveUnnamed'),
          <span className={`elective-progress${status && !status.met ? ' unmet' : ''}`}>
            {t('grid.electiveProgress', {
              placed: status?.placed ?? 0,
              required: group.requiredCredits,
            })}
          </span>,
          members.map((m) => renderCard({ ...m, name: m.name || group.name })),
        );
      }

      const bundle: Bundle | undefined = c.bundleId
        ? bundleById.get(c.bundleId)
        : undefined;
      if (!bundle) return renderCard(c);
      if (drawnBundles.has(bundle.id)) return null;
      drawnBundles.add(bundle.id);
      const members = courses.filter((m) => m.bundleId === bundle.id);
      return groupBox(
        `bundle-${bundle.id}`,
        'bundle-box',
        bundle.name,
        <span className="bundle-choose">
          {t('grid.bundleChoose', { n: bundle.choose, total: members.length })}
        </span>,
        members.map(renderCard),
      );
    });
  };

  return (
    <div className={`grid-wrap${selected ? ' has-selection' : ''}`}>
      {selected && (
        <div className="selection-legend">
          <span className="sel-name">{selected.code || selected.name}</span>
          <span className="legend-item">
            <span className="swatch prereq" />
            {t('grid.legendPrereqs')}
          </span>
          <span className="legend-item">
            <span className="swatch dependent" />
            {t('grid.legendDependents')}
          </span>
          <button className="clear-sel" onClick={() => setSelectedId(null)}>
            {t('grid.clearSelection')}
          </button>
        </div>
      )}
      {years.map((year) => (
        <section className="year-block" key={year}>
          <h2 className="year-title">{t('grid.year', { n: year })}</h2>
          <div
            className="semester-row"
            style={{ gridTemplateColumns: `repeat(${semesters.length}, 1fr)` }}
          >
            {semesters.map((sem) => {
              const courses = coursesAt(program, year, sem);
              const credits = weightedCredits(program, courses);
              return (
                <div className="semester-col" key={sem}>
                  <div className="semester-head">
                    <span>{t(`semester.${sem}`)}</span>
                    <span className="muted">
                      {t('common.credits', { n: credits })}
                    </span>
                  </div>
                  {renderCell(courses)}
                  {editable && (
                    <button
                      className="add-course"
                      onClick={() => onAdd?.(year, sem)}
                    >
                      {t('grid.addCourse')}
                    </button>
                  )}
                  {!editable && courses.length === 0 && (
                    <p className="muted empty">—</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
