import type { Program } from '../types';
import { activeSemesters } from '../stats';
import {
  generatePlan,
  planCredits,
  type StudentPlan,
} from '../studentPlan';
import { useI18n } from '../i18n/useI18n';
import { CreditProgress } from './CreditProgress';

interface Props {
  plan: StudentPlan;
  /** The catalog the plan references (already resolved by the caller). */
  catalog: Program;
  onChange: (updater: (prev: StudentPlan) => StudentPlan) => void;
  onGenerate: () => void;
}

export function AdvisePanel({ plan, catalog, onChange, onGenerate }: Props) {
  const { t } = useI18n();
  const credits = planCredits(plan, catalog);
  // Recomputed from the current statuses/term/cap so warnings always reflect
  // the live inputs (the "Generate" button applies the schedule to the grid).
  const { unschedulable } = generatePlan(plan, catalog);

  const years = Array.from({ length: Math.max(catalog.years, 1) }, (_, i) => i + 1);
  const semesters = activeSemesters(catalog);

  return (
    <aside className="summary">
      <h2>{t('advise.title')}</h2>

      <div className="summary-block">
        <label className="field">
          <span className="muted">{t('advise.studentName')}</span>
          <input
            type="text"
            value={plan.student.name}
            placeholder={t('advise.studentPlaceholder')}
            onChange={(e) =>
              onChange((p) => ({
                ...p,
                student: { ...p.student, name: e.target.value },
              }))
            }
          />
        </label>
      </div>

      <div className="summary-block">
        <CreditProgress
          value={credits.earned}
          total={credits.required}
          label={t('advise.creditsEarned')}
        />
        <div className="summary-row">
          <span>{t('advise.creditsInProgress')}</span>
          <span>{t('common.credits', { n: credits.inProgress })}</span>
        </div>
        <div className="summary-row">
          <span>{t('advise.creditsPlanned')}</span>
          <span>{t('common.credits', { n: credits.planned })}</span>
        </div>
      </div>

      <div className="summary-block">
        <h3>{t('advise.settings')}</h3>
        <div className="field-row">
          <label className="field">
            <span className="muted">{t('advise.currentYear')}</span>
            <select
              value={plan.current.year}
              onChange={(e) =>
                onChange((p) => ({
                  ...p,
                  current: { ...p.current, year: Number(e.target.value) },
                }))
              }
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {t('grid.year', { n: y })}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="muted">{t('advise.currentSemester')}</span>
            <select
              value={plan.current.semester}
              onChange={(e) =>
                onChange((p) => ({
                  ...p,
                  current: {
                    ...p.current,
                    semester: e.target.value as StudentPlan['current']['semester'],
                  },
                }))
              }
            >
              {semesters.map((s) => (
                <option key={s} value={s}>
                  {t(`semester.${s}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span className="muted">{t('advise.maxCredits')}</span>
          <input
            type="number"
            min={1}
            value={plan.maxCreditsPerSemester}
            onChange={(e) =>
              onChange((p) => ({
                ...p,
                maxCreditsPerSemester: Math.max(1, Number(e.target.value) || 1),
              }))
            }
          />
        </label>
        <button className="primary generate" onClick={onGenerate}>
          {t('advise.generate')}
        </button>
      </div>

      <div className="summary-block">
        <h3>{t('advise.hintTitle')}</h3>
        <p className="muted">{t('advise.hint')}</p>
        <p className="muted">{t('advise.addHint')}</p>
      </div>

      <div className="summary-block">
        <h3>{t('advise.unschedulableTitle')}</h3>
        {unschedulable.length === 0 ? (
          <p className="ok">{t('advise.allScheduled')}</p>
        ) : (
          <ul className="issue-list">
            {unschedulable.map(({ course, reason }) => (
              <li key={course.id}>
                {t(`advise.unschedulable.${reason}`, {
                  course: course.name,
                })}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
