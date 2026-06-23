import type { Course } from '../types';

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
  return (
    <div
      className={`course-card type-${course.type} ${editable ? 'editable' : ''}`}
      onClick={editable ? onClick : undefined}
      title={course.description || undefined}
    >
      <div className="course-card-top">
        {course.code && <span className="course-code">{course.code}</span>}
        <span className="course-credits">{course.credits} cr</span>
      </div>
      <div className="course-name">{course.name}</div>
      <div className="course-meta">
        <span className={`type-badge type-${course.type}`}>{course.type}</span>
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
