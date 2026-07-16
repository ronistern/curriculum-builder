import type { Course } from './types';

/**
 * BGU course numbers are `department-degreeLevel-course` (e.g. `232-1-1011`).
 * The university's public course-catalog portal takes those three parts as
 * query params, so a code in that shape deep-links straight to the course's
 * official, always-current catalog / syllabus entry.
 */
const BGU_CODE = /^(\d+)-(\d+)-(\d+)$/;

const BGU_SYLLABUS_BASE = 'https://bgu4u.bgu.ac.il/pls/scwp/!sc.AnnualSearchResults';

/**
 * The official BGU catalog/syllabus URL for a course, derived from its code, or
 * null when the code isn't a BGU course number (nothing to link to). The portal
 * blocks cross-origin fetches, so this is meant for opening in a new tab rather
 * than loading inline.
 */
export function syllabusUrl(course: Course): string | null {
  const m = BGU_CODE.exec(course.code.trim());
  if (!m) return null;
  const [, department, degree, number] = m;
  const params = new URLSearchParams({
    on_course_department: department,
    on_course_degree_level: degree,
    on_course: number,
  });
  return `${BGU_SYLLABUS_BASE}?${params}`;
}
