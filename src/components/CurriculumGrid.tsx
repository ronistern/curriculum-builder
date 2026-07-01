import { useState } from 'react';
import type { Bundle, Course, Program, Semester } from '../types';
import {
  activeSemesters,
  coursesAt,
  findPrereqIssues,
  weightedCredits,
} from '../stats';
import { CourseCard, type Highlight } from './CourseCard';
import { useI18n } from '../i18n/useI18n';

interface Props {
  program: Program;
  editable: boolean;
  onEdit: (course: Course) => void;
  onAdd: (year: number, semester: Semester) => void;
}

export function CurriculumGrid({ program, editable, onEdit, onAdd }: Props) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const semesters = activeSemesters(program);
  const byId = new Map(program.courses.map((c) => [c.id, c]));
  const issueCourseIds = new Set(
    findPrereqIssues(program).map((i) => i.course.id),
  );

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

  const years = Array.from({ length: program.years }, (_, i) => i + 1);
  const bundleById = new Map(program.bundles.map((b) => [b.id, b]));

  const renderCard = (c: Course) => (
    <CourseCard
      key={c.id}
      course={c}
      editable={editable}
      hasIssue={issueCourseIds.has(c.id)}
      highlight={highlightOf(c.id)}
      prereqLabels={c.prerequisites
        .map((id) => byId.get(id)?.code || byId.get(id)?.name)
        .filter((x): x is string => Boolean(x))}
      onSelect={() => setSelectedId((cur) => (cur === c.id ? null : c.id))}
      onOpen={() => onEdit(c)}
    />
  );

  /**
   * Render a cell's courses, drawing each bundle's same-cell members inside a
   * single "choose one" box at the position of the bundle's first member.
   */
  const renderCell = (courses: Course[]) => {
    const drawnBundles = new Set<string>();
    return courses.map((c) => {
      const bundle: Bundle | undefined = c.bundleId
        ? bundleById.get(c.bundleId)
        : undefined;
      if (!bundle) return renderCard(c);
      if (drawnBundles.has(bundle.id)) return null;
      drawnBundles.add(bundle.id);
      const members = courses.filter((m) => m.bundleId === bundle.id);
      return (
        <div className="bundle-box" key={`bundle-${bundle.id}`}>
          <div className="bundle-head">
            <span className="bundle-name">{bundle.name}</span>
            <span className="bundle-choose">
              {t('grid.bundleChoose', { n: bundle.choose, total: members.length })}
            </span>
          </div>
          {members.map(renderCard)}
        </div>
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
                      onClick={() => onAdd(year, sem)}
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
