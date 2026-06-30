import type { Course } from '../types';
import { useI18n } from '../i18n/useI18n';

interface Props {
  course: Course;
  prereqLabels: string[];
  hasIssue: boolean;
  editable: boolean;
  onClick?: () => void;
}

export function CourseCard({
  course,
  prereqLabels,
  hasIssue,
  editable,
  onClick,
}: Props) {
  const { t } = useI18n();
  return (
    <div
      className={`course-card type-${course.type} ${editable ? 'editable' : ''}`}
      onClick={editable ? onClick : undefined}
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
