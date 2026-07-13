import { useState } from 'react';
import type { Bundle, Course, Program, Semester } from '../types';
import { COURSE_TYPES, SEMESTERS } from '../types';
import { activeSemesters } from '../stats';
import { newId } from '../util';
import { Modal } from './Modal';
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
    id: initial.id ?? newId('c-'),
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
  // edit never creates an orphan bundle. `sel` is '' (none), an existing bundle
  // id, or NEW_BUNDLE; `name`/`choose` are the edited bundle's fields.
  const initialBundle = program.bundles.find((b) => b.id === initial.bundleId);
  const [bundle, setBundle] = useState({
    sel: initialBundle?.id ?? '',
    name: initialBundle?.name ?? '',
    choose: initialBundle?.choose ?? 1,
  });

  // Elective-requirement membership. A course tagged to a group is a filler
  // toward that group's credit target; its name is optional (the grid falls
  // back to the group's name). Mutually exclusive with a choose-one bundle.
  const electiveGroups = program.electiveGroups ?? [];
  const [electiveSel, setElectiveSel] = useState<string>(
    initial.electiveGroupId ?? '',
  );

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
    // Elective placeholders may be unnamed; everything else needs a name.
    if (!editing || (!electiveSel && !draft.name.trim())) return;
    if (electiveSel) {
      onSave({
        ...draft,
        type: 'elective',
        bundleId: undefined,
        electiveGroupId: electiveSel,
      });
      return;
    }
    if (!bundle.sel) {
      onSave({ ...draft, bundleId: undefined, electiveGroupId: undefined });
      return;
    }
    const id = bundle.sel === NEW_BUNDLE ? newId('c-') : bundle.sel;
    const saved: Bundle = {
      id,
      name: bundle.name.trim() || t('editor.bundleDefaultName'),
      choose: Math.max(1, Math.round(bundle.choose) || 1),
    };
    onSave({ ...draft, bundleId: id, electiveGroupId: undefined }, saved);
  };

  return (
    <Modal onClose={onCancel} onSubmit={submit}>
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
            placeholder={
              electiveSel
                ? t('editor.electiveNamePlaceholder')
                : t('editor.namePlaceholder')
            }
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

        {electiveGroups.length > 0 && (
          <fieldset className="bundle-field">
            <legend>{t('editor.elective')}</legend>
            <p className="muted bundle-hint">{t('editor.electiveHint')}</p>
            <select
              value={electiveSel}
              disabled={!editing}
              onChange={(e) => {
                const v = e.target.value;
                setElectiveSel(v);
                if (v) {
                  setBundle((b) => ({ ...b, sel: '' }));
                  set('type', 'elective');
                }
              }}
            >
              <option value="">{t('editor.electiveNone')}</option>
              {electiveGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name || t('summary.electiveUnnamed')}
                </option>
              ))}
            </select>
          </fieldset>
        )}

        {!electiveSel && (
        <fieldset className="bundle-field">
          <legend>{t('editor.bundle')}</legend>
          <p className="muted bundle-hint">{t('editor.bundleHint')}</p>
          <select
            value={bundle.sel}
            disabled={!editing}
            onChange={(e) => {
              const v = e.target.value;
              if (v === NEW_BUNDLE) {
                setBundle({ sel: v, name: '', choose: 1 });
              } else if (v) {
                const b = program.bundles.find((x) => x.id === v);
                setBundle({ sel: v, name: b?.name ?? '', choose: b?.choose ?? 1 });
              } else {
                setBundle((b) => ({ ...b, sel: '' }));
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
          {bundle.sel && (
            <div className="grid-2 bundle-detail">
              <label>
                {t('editor.bundleName')}
                <input
                  value={bundle.name}
                  disabled={!editing}
                  onChange={(e) =>
                    setBundle((b) => ({ ...b, name: e.target.value }))
                  }
                  placeholder={t('editor.bundleNamePlaceholder')}
                />
              </label>
              <label>
                {t('editor.bundleChoose')}
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={bundle.choose}
                  disabled={!editing}
                  onChange={(e) =>
                    setBundle((b) => ({ ...b, choose: Number(e.target.value) }))
                  }
                />
              </label>
            </div>
          )}
        </fieldset>
        )}

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
    </Modal>
  );
}
