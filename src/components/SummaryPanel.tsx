import type { Program } from '../types';
import { COURSE_TYPES } from '../types';
import {
  creditsByType,
  creditsByYear,
  electiveProgress,
  findPrereqIssues,
  totalCredits,
} from '../stats';
import { useI18n } from '../i18n/useI18n';
import { CreditProgress } from './CreditProgress';

export function SummaryPanel({ program }: { program: Program }) {
  const { t } = useI18n();
  const total = totalCredits(program);
  const byType = creditsByType(program);
  const byYear = creditsByYear(program);
  const electives = electiveProgress(program);
  const issues = findPrereqIssues(program);

  return (
    <aside className="summary">
      <h2>{t('summary.title')}</h2>

      <div className="summary-block">
        <CreditProgress
          value={total}
          total={program.requiredCredits}
          label={t('summary.creditsPlanned')}
          over={total > program.requiredCredits}
        />
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

      {electives.length > 0 && (
        <div className="summary-block">
          <h3>{t('summary.electives')}</h3>
          {electives.map((p) => (
            <div className="summary-row" key={p.group.id}>
              <span>{p.group.name || t('summary.electiveUnnamed')}</span>
              <span className={p.met ? 'ok' : 'warn'}>
                {t('grid.electiveProgress', {
                  placed: p.placed,
                  required: p.required,
                })}
              </span>
            </div>
          ))}
        </div>
      )}

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
