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
  /** Recommended year of study (1-based) for this course in the program. */
  year: number;
  /** The semester the course is offered / taught in. */
  semester: Semester;
  /** ids of courses that must be completed before this one. */
  prerequisites: string[];
  description?: string;
  /** Id of the {@link Bundle} this course is an option of, if any. */
  bundleId?: string;
  /**
   * Id of the {@link ElectiveGroup} this course counts toward, if any. Such a
   * course is an elective "placeholder" the advisor distributes across the grid
   * to fill a group's credit target.
   */
  electiveGroupId?: string;
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

/**
 * A credit-target group of electives, e.g. "CS electives: 10 pts". The advisor
 * places elective courses (via `Course.electiveGroupId`) whose credits should
 * sum to `requiredCredits`. Unlike a {@link Bundle}, members are not weighted —
 * each placed course counts its full credits, and the group is a target the
 * placed credits should meet (see `electiveProgress` in stats).
 */
export interface ElectiveGroup {
  id: string;
  /** Display label, e.g. "CS electives". */
  name: string;
  /** Credit points the placed elective courses should sum to. */
  requiredCredits: number;
}

export interface Program {
  /** Stable catalog identity, referenced by a {@link ../studentPlan.StudentPlan}. */
  id: string;
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
  /** Elective credit-target groups referenced by `Course.electiveGroupId`. */
  electiveGroups: ElectiveGroup[];
}
