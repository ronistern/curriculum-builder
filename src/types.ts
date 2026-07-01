export type CourseType =
  | 'mandatory'
  | 'elective'
  | 'seminar'
  | 'project'
  | 'general';

/**
 * Canonical ordering of course types. Display labels are resolved per-language
 * via the i18n dictionary (see `courseType.*` keys).
 */
export const COURSE_TYPES: { value: CourseType }[] = [
  { value: 'mandatory' },
  { value: 'elective' },
  { value: 'seminar' },
  { value: 'project' },
  { value: 'general' },
];

export type Semester = 'A' | 'B' | 'Summer';

export const SEMESTERS: Semester[] = ['A', 'B', 'Summer'];

export interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  type: CourseType;
  /** Free-form grouping, e.g. "Core CS", "Mathematics". */
  category: string;
  year: number; // 1-based
  semester: Semester;
  /** ids of courses that must be completed before this one. */
  prerequisites: string[];
  description?: string;
  /** Id of the {@link Bundle} this course is an option of, if any. */
  bundleId?: string;
}

/**
 * A "choose-from" group: the student must take `choose` of the courses tagged
 * with this bundle's id (usually one). Members are not summed individually for
 * credit totals — the group counts as `choose` of its courses (see
 * `courseWeights` in stats).
 */
export interface Bundle {
  id: string;
  /** Display label, e.g. "Choose one elective". */
  name: string;
  /** How many member courses the student picks. Usually 1. */
  choose: number;
}

export interface Program {
  name: string;
  degree: string;
  institution: string;
  years: number;
  requiredCredits: number;
  /** Whether the Summer semester column is shown. */
  showSummer: boolean;
  courses: Course[];
  /** Choose-one (or choose-N) groups referenced by `Course.bundleId`. */
  bundles: Bundle[];
}
