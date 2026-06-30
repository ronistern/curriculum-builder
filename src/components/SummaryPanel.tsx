import type { Program } from '../types';
import { COURSE_TYPES } from '../types';
import {
  creditsByType,
  creditsByYear,
  findPrereqIssues,
  totalCredits,
} from '../stats';
import { useI18n } from '../i18n/useI18n';

export function SummaryPanel({ program }: { program: Program }) {
  const { t } = useI18n();
  const total = totalCredits(program);
  const byType = creditsByType(program);
  const byYear = creditsByYear(program);
  const issues = findPrereqIssues(program);
  const pct = program.requiredCredits
    ? Math.min(100, Math.round((total / program.requiredCredits) * 100))
    : 0;

  return (
    <aside className="summary">
      <h2>{t('summary.title')}</h2>

      <div className="summary-block">
        <div className="big-number">
          {total}
          <span className="of"> / {program.requiredCredits}</span>
        </div>
        <div className="muted">{t('summary.creditsPlanned')}</div>
        <div className="progress">
          <div
            className={`progress-bar ${total > program.requiredCredits ? 'over' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="summary-block">
        <h3>{t('summary.byYear')}</h3>
        {byYear.map((credits, i) => (
          <div className="summary-row" key={i}>
            <span>{t('grid.year', { n: i + 1 })}</span>
            <span>{t('common.credits', { n: credits })}</span>
          </div>
        ))}
      </div>

      <div className="summary-block">
        <h3>{t('summary.byType')}</h3>
        {COURSE_TYPES.map((ct) =>
          byType[ct.value] ? (
            <div className="summary-row" key={ct.value}>
              <span className={`type-badge type-${ct.value}`}>
                {t(`courseType.${ct.value}`)}
              </span>
              <span>{t('common.credits', { n: byType[ct.value] })}</span>
            </div>
          ) : null,
        )}
        {program.courses.length === 0 && (
          <p className="muted">{t('summary.noCourses')}</p>
        )}
      </div>

      <div className="summary-block">
        <h3>{t('summary.prereqChecks')}</h3>
        {issues.length === 0 ? (
          <p className="ok">{t('summary.allGood')}</p>
        ) : (
          <ul className="issue-list">
            {issues.map((iss, i) => (
              <li key={i}>
                {t('summary.issue', {
                  course: iss.course.name,
                  prereq: iss.prereq.name,
                  year: iss.prereq.year,
                  semester: t(`semester.${iss.prereq.semester}`),
                })}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
