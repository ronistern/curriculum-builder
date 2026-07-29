import type { Course } from '../types';
import { syllabusUrl } from '../syllabus';
import { useI18n } from '../i18n/useI18n';

/**
 * A link to a course's official BGU catalog / syllabus page, opening in a new
 * tab. Renders nothing when the course's code isn't a BGU number. Clicks are
 * kept from bubbling so the link never triggers the enclosing course card's
 * select / cycle / open handlers.
 */
export function SyllabusLink({ course }: { course: Course }) {
  const { t } = useI18n();
  const url = syllabusUrl(course);
  if (!url) return null;
  return (
    <a
      className="syllabus-link"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={t('course.syllabusHint')}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {t('course.syllabus')} ↗
    </a>
  );
}
