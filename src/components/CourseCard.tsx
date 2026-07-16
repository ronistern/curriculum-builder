import { useEffect, useRef } from 'react';
import type { Course } from '../types';
import type { CourseStatus } from '../studentPlan';
import { syllabusUrl } from '../syllabus';
import { useI18n } from '../i18n/useI18n';

/** Delay before a single click acts, so a double-click can cancel it. */
const CLICK_DELAY_MS = 200;

export type Highlight = 'selected' | 'prereq' | 'dependent';

interface Props {
  course: Course;
  prereqLabels: string[];
  hasIssue: boolean;
  editable: boolean;
  highlight?: Highlight;
  /** Student-plan status (advise mode only). Absent = still to plan. */
  status?: CourseStatus;
  /** When true, a click cycles the plan status instead of selecting. */
  advise?: boolean;
  onSelect?: () => void;
  /** Advance the plan status (advise mode click). */
  onCycle?: () => void;
  /** Open the course detail view (triggered by double-click when editable). */
  onOpen?: () => void;
  /** Advise mode: remove this course from the student's plan. */
  onRemove?: () => void;
}

/** Marker glyph shown for a course's plan status. */
const STATUS_GLYPH: Record<CourseStatus, string> = {
  completed: '✓',
  'in-progress': '⋯',
};

export function CourseCard({
  course,
  prereqLabels,
  hasIssue,
  editable,
  highlight,
  status,
  advise,
  onSelect,
  onCycle,
  onOpen,
  onRemove,
}: Props) {
  const { t } = useI18n();
  // Deep-link to the official BGU catalog page, when the code is a BGU number.
  const syllabus = syllabusUrl(course);
  // When the card is editable a double-click opens the editor, so a single
  // click is deferred briefly and cancelled if a double-click lands.
  const clickTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (clickTimer.current !== null) clearTimeout(clickTimer.current);
    },
    [],
  );

  const handleClick = () => {
    if (advise) {
      onCycle?.();
      return;
    }
    if (!editable) {
      onSelect?.();
      return;
    }
    if (clickTimer.current !== null) clearTimeout(clickTimer.current);
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null;
      onSelect?.();
    }, CLICK_DELAY_MS);
  };

  const handleDoubleClick = () => {
    if (clickTimer.current !== null) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    onOpen?.();
  };

  return (
    <div
      className={`course-card type-${course.type}${
        highlight ? ` hl-${highlight}` : ''
      }${status ? ` is-${status}` : ''}${advise ? ' advise' : ''}`}
      onClick={handleClick}
      onDoubleClick={editable ? handleDoubleClick : undefined}
      title={course.description || undefined}
    >
      <div className="course-card-top">
        {course.code && <span className="course-code">{course.code}</span>}
        {status && (
          <span
            className={`status-mark status-${status}`}
            title={t(`advise.status.${status}`)}
          >
            {STATUS_GLYPH[status]}
          </span>
        )}
        <span className="course-credits">
          {t('common.credits', { n: course.credits })}
        </span>
        {onRemove && (
          <button
            type="button"
            className="course-remove"
            aria-label={t('grid.removeFromPlan')}
            title={t('grid.removeFromPlan')}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            ×
          </button>
        )}
      </div>
      <div className="course-name">{course.name}</div>
      <div className="course-meta">
        <span className={`type-badge type-${course.type}`}>
          {t(`courseType.${course.type}`)}
        </span>
        {course.category && <span className="course-cat">{course.category}</span>}
        {syllabus && (
          <a
            className="course-syllabus"
            href={syllabus}
            target="_blank"
            rel="noopener noreferrer"
            title={t('course.syllabusHint')}
            onClick={(e) => e.stopPropagation()}
          >
            {t('course.syllabus')} ↗
          </a>
        )}
      </div>
      {prereqLabels.length > 0 && (
        <div className={`course-prereqs ${hasIssue ? 'issue' : ''}`}>
          {hasIssue ? '⚠ ' : '↳ '}
          {prereqLabels.join(', ')}
        </div>
      )}
    </div>
  );
}
