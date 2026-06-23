import { useState } from 'react';
import type { Course, Program, Semester } from '../types';
import { COURSE_TYPES, SEMESTERS } from '../types';
import { activeSemesters } from '../stats';

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
        <h2>{initial.id ? 'Edit course' : 'Add course'}</h2>

        <div className="grid-2">
          <label>
            Code
            <input
              value={draft.code}
              onChange={(e) => set('code', e.target.value)}
              placeholder="CS101"
            />
          </label>
          <label>
            Credits
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
          Name
          <input
            value={draft.name}
            autoFocus
            onChange={(e) => set('name', e.target.value)}
            placeholder="Introduction to Computer Science"
          />
        </label>

        <div className="grid-2">
          <label>
            Type
            <select
              value={draft.type}
              onChange={(e) => set('type', e.target.value as Course['type'])}
            >
              {COURSE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <input
              value={draft.category}
              onChange={(e) => set('category', e.target.value)}
              placeholder="Core CS"
            />
          </label>
        </div>

        <div className="grid-2">
          <label>
            Year
            <select
              value={draft.year}
              onChange={(e) => set('year', Number(e.target.value))}
            >
              {Array.from({ length: program.years }, (_, i) => i + 1).map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>
          </label>
          <label>
            Semester
            <select
              value={draft.semester}
              onChange={(e) => set('semester', e.target.value as Semester)}
            >
              {SEMESTERS.filter((s) => semesters.includes(s)).map((s) => (
                <option key={s} value={s}>
                  {s === 'Summer' ? 'Summer' : `Semester ${s}`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Description
          <textarea
            rows={2}
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </label>

        <fieldset className="prereqs">
          <legend>Prerequisites</legend>
          {otherCourses.length === 0 && (
            <p className="muted">No other courses yet.</p>
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
              Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
