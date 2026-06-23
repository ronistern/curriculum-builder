export type CourseType =
  | 'mandatory'
  | 'elective'
  | 'seminar'
  | 'project'
  | 'general';

export const COURSE_TYPES: { value: CourseType; label: string }[] = [
  { value: 'mandatory', label: 'Mandatory' },
  { value: 'elective', label: 'Elective' },
  { value: 'seminar', label: 'Seminar' },
  { value: 'project', label: 'Project' },
  { value: 'general', label: 'General studies' },
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
}
