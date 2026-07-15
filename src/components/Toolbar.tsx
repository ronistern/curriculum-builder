import { useI18n } from '../i18n/useI18n';

/** File name + unsaved indicator shown under the title. */
export function FileStatus({ name, dirty }: { name: string | null; dirty: boolean }) {
  const { t } = useI18n();
  return (
    <div className="file-status">
      {name ?? t('app.untitled')}
      {dirty && (
        <span className="unsaved" title={t('app.unsaved')}>
          {' •'}
        </span>
      )}
    </div>
  );
}

/** The Save / Save As button pair, shared by curriculum and plan toolbars. */
export function SaveButtons({
  dirty,
  onSave,
  onSaveAs,
}: {
  dirty: boolean;
  onSave: () => void;
  onSaveAs: () => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <button onClick={onSave}>
        {t('app.save')}
        {dirty ? ' •' : ''}
      </button>
      <button onClick={onSaveAs}>{t('app.saveAs')}</button>
    </>
  );
}

/** Undo / Redo button pair, shared by the curriculum and plan toolbars. */
export function UndoRedo({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <button onClick={onUndo} disabled={!canUndo} title={t('app.undo')}>
        ↶ {t('app.undo')}
      </button>
      <button onClick={onRedo} disabled={!canRedo} title={t('app.redo')}>
        ↷ {t('app.redo')}
      </button>
    </>
  );
}
