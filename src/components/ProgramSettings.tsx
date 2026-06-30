import type { Program } from '../types';
import { useI18n } from '../i18n/useI18n';

interface Props {
  program: Program;
  onChange: (program: Program) => void;
  onClose: () => void;
}

export function ProgramSettings({ program, onChange, onClose }: Props) {
  const { t } = useI18n();
  const set = <K extends keyof Program>(key: K, value: Program[K]) =>
    onChange({ ...program, [key]: value });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('settings.title')}</h2>

        <label>
          {t('settings.programName')}
          <input
            value={program.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </label>

        <div className="grid-2">
          <label>
            {t('settings.degree')}
            <input
              value={program.degree}
              onChange={(e) => set('degree', e.target.value)}
              placeholder={t('settings.degreePlaceholder')}
            />
          </label>
          <label>
            {t('settings.institution')}
            <input
              value={program.institution}
              onChange={(e) => set('institution', e.target.value)}
            />
          </label>
        </div>

        <div className="grid-2">
          <label>
            {t('settings.years')}
            <input
              type="number"
              min={1}
              max={8}
              value={program.years}
              onChange={(e) =>
                set('years', Math.max(1, Number(e.target.value) || 1))
              }
            />
          </label>
          <label>
            {t('settings.requiredCredits')}
            <input
              type="number"
              min={0}
              value={program.requiredCredits}
              onChange={(e) => set('requiredCredits', Number(e.target.value))}
            />
          </label>
        </div>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={program.showSummer}
            onChange={(e) => set('showSummer', e.target.checked)}
          />
          {t('settings.showSummer')}
        </label>

        <div className="modal-actions">
          <span className="spacer" />
          <button className="primary" onClick={onClose}>
            {t('settings.done')}
          </button>
        </div>
      </div>
    </div>
  );
}
