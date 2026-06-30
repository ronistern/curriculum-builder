import { useState } from 'react';
import type { Course, Program, Semester } from '../types';
import { COURSE_TYPES, SEMESTERS } from '../types';
import { activeSemesters } from '../stats';
import { useI18n } from '../i18n/useI18n';

interface Props {
  program: Program;
  /** The course being edited, or a partial seed for a new course. */
  initial: Partial<Course>;
  onSave: (course: Course) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

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
  const semesters = activeSemesters(program);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    onSave(draft);
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h2>{initial.id ? t('editor.editTitle') : t('editor.addTitle')}</h2>

        <div className="grid-2">
          <label>
            {t('editor.code')}
            <input
              value={draft.code}
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
              onChange={(e) => set('credits', Number(e.target.value))}
            />
          </label>
        </div>

        <label>
          {t('editor.name')}
          <input
            value={draft.name}
            autoFocus
            onChange={(e) => set('name', e.target.value)}
            placeholder={t('editor.namePlaceholder')}
          />
        </label>

        <div className="grid-2">
          <label>
            {t('editor.type')}
            <select
              value={draft.type}
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
            onChange={(e) => set('description', e.target.value)}
          />
        </label>

        <fieldset className="prereqs">
          <legend>{t('editor.prerequisites')}</legend>
          {otherCourses.length === 0 && (
            <p className="muted">{t('editor.noOtherCourses')}</p>
          )}
          <div className="prereq-list">
            {otherCourses.map((c) => (
              <label key={c.id} className="prereq-item">
                <input
                  type="checkbox"
                  checked={draft.prerequisites.includes(c.id)}
                  onChange={() => togglePrereq(c.id)}
                />
                <span>
                  {c.code ? `${c.code} · ` : ''}
                  {c.name}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="modal-actions">
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
        </div>
      </form>
    </div>
  );
}
