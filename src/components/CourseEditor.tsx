import { useState } from 'react';
import type { Bundle, Course, Program, Semester } from '../types';
import { COURSE_TYPES, SEMESTERS } from '../types';
import { activeSemesters } from '../stats';
import { useI18n } from '../i18n/useI18n';

interface Props {
  program: Program;
  /** The course being edited, or a partial seed for a new course. */
  initial: Partial<Course>;
  /** Persist the course; `bundle` is the choose-group to upsert, if any. */
  onSave: (course: Course, bundle?: Bundle) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

/** Sentinel value for the "create a new bundle" option in the select. */
const NEW_BUNDLE = '__new__';

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'c-' + Math.random().toString(36).slice(2);
}

export function CourseEditor({
  program,
  initial,
  onSave,
  onCancel,
  onDelete,
}: Props) {
  const { t } = useI18n();
  // Existing courses open read-only; a new course (no id yet) starts editable.
  const [editing, setEditing] = useState(!initial.id);
  const [draft, setDraft] = useState<Course>({
    id: initial.id ?? newId(),
    code: initial.code ?? '',
    name: initial.name ?? '',
    credits: initial.credits ?? 3,
    type: initial.type ?? 'mandatory',
    category: initial.category ?? '',
    year: initial.year ?? 1,
    semester: initial.semester ?? 'A',
    prerequisites: initial.prerequisites ?? [],
    description: initial.description ?? '',
  });

  // Bundle membership is held separately and committed on save, so a cancelled
  // edit never creates an orphan bundle. `bundleSel` is '' (none), an existing
  // bundle id, or NEW_BUNDLE.
  const initialBundle = program.bundles.find((b) => b.id === initial.bundleId);
  const [bundleSel, setBundleSel] = useState<string>(initialBundle?.id ?? '');
  const [bundleName, setBundleName] = useState(initialBundle?.name ?? '');
  const [bundleChoose, setBundleChoose] = useState(initialBundle?.choose ?? 1);

  const set = <K extends keyof Course>(key: K, value: Course[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const togglePrereq = (id: string) => {
    setDraft((d) => ({
      ...d,
      prerequisites: d.prerequisites.includes(id)
        ? d.prerequisites.filter((p) => p !== id)
        : [...d.prerequisites, id],
    }));
  };

  const otherCourses = program.courses.filter((c) => c.id !== draft.id);
  const prereqCourses = draft.prerequisites
    .map((id) => program.courses.find((c) => c.id === id))
    .filter((c): c is Course => Boolean(c));
  const available = otherCourses.filter(
    (c) => !draft.prerequisites.includes(c.id),
  );
  const courseLabel = (c: Course) => `${c.code ? `${c.code} · ` : ''}${c.name}`;
  const semesters = activeSemesters(program);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !draft.name.trim()) return;
    if (!bundleSel) {
      onSave({ ...draft, bundleId: undefined });
      return;
    }
    const id = bundleSel === NEW_BUNDLE ? newId() : bundleSel;
    const bundle: Bundle = {
      id,
      name: bundleName.trim() || t('editor.bundleDefaultName'),
      choose: Math.max(1, Math.round(bundleChoose) || 1),
    };
    onSave({ ...draft, bundleId: id }, bundle);
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <div className="modal-head">
          <h2>
            {!initial.id
              ? t('editor.addTitle')
              : editing
                ? t('editor.editTitle')
                : t('editor.viewTitle')}
          </h2>
          {initial.id && !editing && (
            <button
              type="button"
              className="modal-edit"
              aria-label={t('editor.startEdit')}
              title={t('editor.startEdit')}
              onClick={() => setEditing(true)}
            >
              ✎
            </button>
          )}
        </div>

        <div className="grid-2">
          <label>
            {t('editor.code')}
            <input
              value={draft.code}
              disabled={!editing}
              onChange={(e) => set('code', e.target.value)}
              placeholder={t('editor.codePlaceholder')}
            />
          </label>
          <label>
            {t('editor.credits')}
            <input
              type="number"
              min={0}
              step={0.5}
              value={draft.credits}
              disabled={!editing}
              onChange={(e) => set('credits', Number(e.target.value))}
            />
          </label>
        </div>

        <label>
          {t('editor.name')}
          <input
            value={draft.name}
            autoFocus={editing}
            disabled={!editing}
            onChange={(e) => set('name', e.target.value)}
            placeholder={t('editor.namePlaceholder')}
          />
        </label>

        <div className="grid-2">
          <label>
            {t('editor.type')}
            <select
              value={draft.type}
              disabled={!editing}
              onChange={(e) => set('type', e.target.value as Course['type'])}
            >
              {COURSE_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>
                  {t(`courseType.${ct.value}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('editor.category')}
            <input
              value={draft.category}
              disabled={!editing}
              onChange={(e) => set('category', e.target.value)}
              placeholder={t('editor.categoryPlaceholder')}
            />
          </label>
        </div>

        <div className="grid-2">
          <label>
            {t('editor.yearLabel')}
            <select
              value={draft.year}
              disabled={!editing}
              onChange={(e) => set('year', Number(e.target.value))}
            >
              {Array.from({ length: program.years }, (_, i) => i + 1).map((y) => (
                <option key={y} value={y}>
                  {t('editor.year', { n: y })}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('editor.semester')}
            <select
              value={draft.semester}
              disabled={!editing}
              onChange={(e) => set('semester', e.target.value as Semester)}
            >
              {SEMESTERS.filter((s) => semesters.includes(s)).map((s) => (
                <option key={s} value={s}>
                  {t(`semester.${s}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          {t('editor.description')}
          <textarea
            rows={2}
            value={draft.description}
            disabled={!editing}
            onChange={(e) => set('description', e.target.value)}
          />
        </label>

        <fieldset className="prereqs">
          <legend>{t('editor.prerequisites')}</legend>
          {prereqCourses.length === 0 ? (
            <p className="muted">
              {editing && otherCourses.length === 0
                ? t('editor.noOtherCourses')
                : t('editor.noPrereqs')}
            </p>
          ) : (
            <ul className="prereq-chips">
              {prereqCourses.map((c) => (
                <li key={c.id} className="prereq-chip">
                  <span>{courseLabel(c)}</span>
                  {editing && (
                    <button
                      type="button"
                      aria-label={t('editor.removePrereq')}
                      title={t('editor.removePrereq')}
                      onClick={() => togglePrereq(c.id)}
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {editing && available.length > 0 && (
            <select
              className="prereq-add"
              value=""
              onChange={(e) => {
                if (e.target.value) togglePrereq(e.target.value);
              }}
            >
              <option value="">{t('editor.addPrereq')}</option>
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {courseLabel(c)}
                </option>
              ))}
            </select>
          )}
        </fieldset>

        <fieldset className="bundle-field">
          <legend>{t('editor.bundle')}</legend>
          <p className="muted bundle-hint">{t('editor.bundleHint')}</p>
          <select
            value={bundleSel}
            disabled={!editing}
            onChange={(e) => {
              const v = e.target.value;
              setBundleSel(v);
              if (v === NEW_BUNDLE) {
                setBundleName('');
                setBundleChoose(1);
              } else if (v) {
                const b = program.bundles.find((x) => x.id === v);
                setBundleName(b?.name ?? '');
                setBundleChoose(b?.choose ?? 1);
              }
            }}
          >
            <option value="">{t('editor.bundleNone')}</option>
            {program.bundles.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
            <option value={NEW_BUNDLE}>{t('editor.bundleNew')}</option>
          </select>
          {bundleSel && (
            <div className="grid-2 bundle-detail">
              <label>
                {t('editor.bundleName')}
                <input
                  value={bundleName}
                  disabled={!editing}
                  onChange={(e) => setBundleName(e.target.value)}
                  placeholder={t('editor.bundleNamePlaceholder')}
                />
              </label>
              <label>
                {t('editor.bundleChoose')}
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={bundleChoose}
                  disabled={!editing}
                  onChange={(e) => setBundleChoose(Number(e.target.value))}
                />
              </label>
            </div>
          )}
        </fieldset>

        <div className="modal-actions">
          {editing ? (
            <>
              {onDelete && (
                <button type="button" className="danger" onClick={onDelete}>
                  {t('editor.delete')}
                </button>
              )}
              <span className="spacer" />
              <button type="button" onClick={onCancel}>
                {t('editor.cancel')}
              </button>
              <button type="submit" className="primary">
                {t('editor.save')}
              </button>
            </>
          ) : (
            <>
              <span className="spacer" />
              <button type="button" className="primary" onClick={onCancel}>
                {t('editor.close')}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
