import type { Course, Program, Semester } from '../types';
import { activeSemesters, coursesAt, findPrereqIssues } from '../stats';
import { CourseCard } from './CourseCard';
import { useI18n } from '../i18n/useI18n';

interface Props {
  program: Program;
  editable: boolean;
  onEdit: (course: Course) => void;
  onAdd: (year: number, semester: Semester) => void;
}

export function CurriculumGrid({ program, editable, onEdit, onAdd }: Props) {
  const { t } = useI18n();
  const semesters = activeSemesters(program);
  const byId = new Map(program.courses.map((c) => [c.id, c]));
  const issueCourseIds = new Set(
    findPrereqIssues(program).map((i) => i.course.id),
  );

  const years = Array.from({ length: program.years }, (_, i) => i + 1);

  return (
    <div className="grid-wrap">
      {years.map((year) => (
        <section className="year-block" key={year}>
          <h2 className="year-title">{t('grid.year', { n: year })}</h2>
          <div
            className="semester-row"
            style={{ gridTemplateColumns: `repeat(${semesters.length}, 1fr)` }}
          >
            {semesters.map((sem) => {
              const courses = coursesAt(program, year, sem);
              const credits = courses.reduce((s, c) => s + (c.credits || 0), 0);
              return (
                <div className="semester-col" key={sem}>
                  <div className="semester-head">
                    <span>{t(`semester.${sem}`)}</span>
                    <span className="muted">
                      {t('common.credits', { n: credits })}
                    </span>
                  </div>
                  {courses.map((c) => (
                    <CourseCard
                      key={c.id}
                      course={c}
                      editable={editable}
                      hasIssue={issueCourseIds.has(c.id)}
                      prereqLabels={c.prerequisites
                        .map((id) => byId.get(id)?.code || byId.get(id)?.name)
                        .filter((x): x is string => Boolean(x))}
                      onClick={() => onEdit(c)}
                    />
                  ))}
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
