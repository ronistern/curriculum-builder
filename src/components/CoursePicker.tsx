import { useMemo, useState } from 'react';
import type { Course } from '../types';
import { Modal } from './Modal';
import { useI18n } from '../i18n/useI18n';

/** A group of selectable courses, labelled by the program they come from. */
export interface PickerGroup {
  program: string;
  courses: Course[];
}

interface Props {
  /** Courses to choose from, grouped by source program. */
  groups: PickerGroup[];
  /** Ids already in the student's plan; picking one re-places it in the cell. */
  inPlan: Set<string>;
  /** Human-readable target cell, e.g. "Year 2 · Semester A". */
  target: string;
  onSelect: (course: Course) => void;
  onClose: () => void;
}

/**
 * Pick a course from the whole catalog library (every program) to drop into a
 * student's plan at a chosen cell. Used by the advise-mode grid's per-cell "+".
 */
export function CoursePicker({ groups, inPlan, target, onSelect, onClose }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        program: g.program,
        courses: g.courses.filter(
          (c) =>
            c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.courses.length > 0);
  }, [groups, query]);

  const label = (c: Course) => `${c.code ? `${c.code} · ` : ''}${c.name}`;

  return (
    <Modal onClose={onClose} className="open-dialog">
      <h2>{t('picker.title')}</h2>
      <p className="open-hint">{t('picker.target', { cell: target })}</p>

      <input
        className="picker-search"
        autoFocus
        value={query}
        placeholder={t('picker.search')}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length === 0 ? (
        <p className="open-empty">{t('picker.none')}</p>
      ) : (
        <div className="picker-groups">
          {filtered.map((g) => (
            <section key={g.program} className="picker-group">
              <h3 className="picker-group-name">{g.program}</h3>
              <ul className="open-list">
                {g.courses.map((c) => (
                  <li key={`${g.program}:${c.id}`}>
                    <button
                      type="button"
                      className="open-item"
                      onClick={() => onSelect(c)}
                    >
                      <span className="open-item-name">
                        {label(c)}
                        {inPlan.has(c.id) && (
                          <span className="picker-inplan">{t('picker.inPlan')}</span>
                        )}
                      </span>
                      <span className="open-item-sub">
                        {t('common.credits', { n: c.credits })}
                        {c.category ? ` · ${c.category}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="open-actions">
        <button type="button" onClick={onClose}>
          {t('picker.cancel')}
        </button>
      </div>
    </Modal>
  );
}
