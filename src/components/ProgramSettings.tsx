import type { ElectiveGroup, Program } from '../types';
import { newId } from '../util';
import { Modal } from './Modal';
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

  const groups = program.electiveGroups ?? [];

  const updateGroup = (id: string, patch: Partial<ElectiveGroup>) =>
    set(
      'electiveGroups',
      groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    );

  const addGroup = () =>
    set('electiveGroups', [
      ...groups,
      { id: newId('g-'), name: '', requiredCredits: 0 },
    ]);

  // Remove the group and detach its placeholder courses (they stay as plain
  // elective courses rather than being silently deleted).
  const removeGroup = (id: string) =>
    onChange({
      ...program,
      electiveGroups: groups.filter((g) => g.id !== id),
      courses: program.courses.map((c) =>
        c.electiveGroupId === id ? { ...c, electiveGroupId: undefined } : c,
      ),
    });

  return (
    <Modal onClose={onClose}>
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

        <fieldset className="elective-groups">
          <legend>{t('settings.electiveGroups')}</legend>
          <p className="muted bundle-hint">{t('settings.electiveGroupsHint')}</p>
          {groups.length === 0 ? (
            <p className="muted">{t('settings.noElectives')}</p>
          ) : (
            <ul className="elective-group-list">
              {groups.map((g) => (
                <li key={g.id} className="elective-group-row">
                  <label className="grow">
                    <span className="muted">{t('settings.electiveName')}</span>
                    <input
                      value={g.name}
                      onChange={(e) => updateGroup(g.id, { name: e.target.value })}
                      placeholder={t('settings.electiveNamePlaceholder')}
                    />
                  </label>
                  <label className="credits-field">
                    <span className="muted">{t('settings.electiveCredits')}</span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={g.requiredCredits}
                      onChange={(e) =>
                        updateGroup(g.id, {
                          requiredCredits: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="danger-ghost"
                    aria-label={t('settings.removeElective')}
                    title={t('settings.removeElective')}
                    onClick={() => removeGroup(g.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="add-course" onClick={addGroup}>
            {t('settings.addElective')}
          </button>
        </fieldset>

        <div className="modal-actions">
          <span className="spacer" />
          <button className="primary" onClick={onClose}>
            {t('settings.done')}
          </button>
        </div>
    </Modal>
  );
}
