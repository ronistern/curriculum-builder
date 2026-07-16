import type { Program } from '../types';
import { COURSE_TYPES } from '../types';
import { creditsByType, electiveProgress } from '../stats';
import {
  effectiveCatalog,
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
}

export function AdvisePanel({ plan, catalog, onChange }: Props) {
  const { t } = useI18n();
  const credits = planCredits(plan, catalog);
  // The student's effective course set (excluded dropped, extras added), viewed
  // as a program so the same credit breakdowns as program-design mode apply.
  const effective = effectiveCatalog(catalog, plan);
  const byType = creditsByType(effective);
  const electives = electiveProgress(effective);

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
        <h3>{t('advise.hintTitle')}</h3>
        <p className="muted">{t('advise.hint')}</p>
        <p className="muted">{t('advise.addHint')}</p>
      </div>
    </aside>
  );
}
