import { useEffect, useRef } from 'react';
import type { Course } from '../types';
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
  onSelect?: () => void;
  /** Open the course detail view (triggered by double-click when editable). */
  onOpen?: () => void;
}

export function CourseCard({
  course,
  prereqLabels,
  hasIssue,
  editable,
  highlight,
  onSelect,
  onOpen,
}: Props) {
  const { t } = useI18n();
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
      }`}
      onClick={handleClick}
      onDoubleClick={editable ? handleDoubleClick : undefined}
      title={course.description || undefined}
    >
      <div className="course-card-top">
        {course.code && <span className="course-code">{course.code}</span>}
        <span className="course-credits">
          {t('common.credits', { n: course.credits })}
        </span>
      </div>
      <div className="course-name">{course.name}</div>
      <div className="course-meta">
        <span className={`type-badge type-${course.type}`}>
          {t(`courseType.${course.type}`)}
        </span>
        {course.category && <span className="course-cat">{course.category}</span>}
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
