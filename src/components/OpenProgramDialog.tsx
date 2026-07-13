import { Modal } from './Modal';
import { defaultPrograms } from '../defaultPrograms';
import { useI18n } from '../i18n/useI18n';
import type { Program } from '../types';

interface Props {
  /** Load one of the built-in programs as a fresh, untitled working copy. */
  onSelect: (program: Program) => void;
  /** Open a curriculum from a file on disk (native picker or upload). */
  onOpenFile: () => void;
  onClose: () => void;
}

/**
 * The "Open" dialog: a list of built-in default programs plus the option to
 * open a curriculum from a file. Built-ins come from {@link defaultPrograms}.
 */
export function OpenProgramDialog({ onSelect, onOpenFile, onClose }: Props) {
  const { t } = useI18n();
  return (
    <Modal onClose={onClose} className="open-dialog">
      <h2>{t('open.title')}</h2>
      <p className="open-hint">{t('open.hint')}</p>

      {defaultPrograms.length > 0 ? (
        <ul className="open-list">
          {defaultPrograms.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                className="open-item"
                onClick={() => onSelect(d.program)}
              >
                <span className="open-item-name">
                  {d.program.degree} {d.program.name}
                </span>
                {d.program.institution && (
                  <span className="open-item-sub">{d.program.institution}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="open-empty">{t('open.none')}</p>
      )}

      <div className="open-actions">
        <button type="button" className="primary" onClick={onOpenFile}>
          {t('open.fromFile')}
        </button>
        <button type="button" onClick={onClose}>
          {t('open.cancel')}
        </button>
      </div>
    </Modal>
  );
}
