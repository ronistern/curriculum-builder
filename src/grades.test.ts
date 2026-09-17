import { describe, expect, it } from 'vitest';
import {
  aggregateGrades,
  earnedCredits,
  hebrewYearToNumber,
  normalizeCourseCode,
  weightedAverage,
  type CourseInstance,
  type Moed,
} from './grades';

/** A course row as the transcript would list it. */
const row = (
  code: string,
  year: string,
  semester: string,
  sittings: [Moed, string][],
  extra: Partial<CourseInstance> = {},
): CourseInstance => ({
  code,
  name: 'Data Structures',
  credits: 5,
  kind: 'חובה',
  year,
  semester,
  sittings: sittings.map(([moed, grade]) => ({ moed, grade })),
  note: '',
  ...extra,
});

describe('normalizeCourseCode', () => {
  it('rewrites the transcript spelling into the catalog one', () => {
    expect(normalizeCourseCode('202.1.1031')).toBe('202-1-1031');
    expect(normalizeCourseCode('202-1-1031')).toBe('202-1-1031');
    expect(normalizeCourseCode('20211031')).toBe('202-1-1031');
  });

  it('leaves anything that is not a BGU course number alone', () => {
    expect(normalizeCourseCode(' CS101 ')).toBe('CS101');
    expect(normalizeCourseCode('')).toBe('');
  });
});

describe('hebrewYearToNumber', () => {
  it('reads the short form the sheet prints', () => {
    expect(hebrewYearToNumber('תשפ"ה')).toBe(5785);
    expect(hebrewYearToNumber('תשפ"ו')).toBe(5786);
  });

  it('orders consecutive years', () => {
    const years = ['תשפ"ג', 'תשפ"ד', 'תשפ"ה', 'תשפ"ו'].map(hebrewYearToNumber);
    expect(years).toEqual([...years].sort((a, b) => a! - b!));
  });

  it('returns null for anything that is not Hebrew letters', () => {
    expect(hebrewYearToNumber('2025')).toBeNull();
    expect(hebrewYearToNumber('')).toBeNull();
  });
});

describe('aggregateGrades', () => {
  it('takes the last sitting, not the best one', () => {
    // מ.ב. replaces מ.א. at BGU even when it is lower.
    const [course] = aggregateGrades([
      row('202-1-1031', 'תשפ"ה', 'א', [
        ['A', '90.00'],
        ['B', '65.00'],
      ]),
    ]);
    expect(course.final.grade).toBe('65');
    expect(course.history.map((h) => h.grade)).toEqual(['90']);
  });

  it('puts a course retaken in a later semester on one line, newest first', () => {
    const [course] = aggregateGrades([
      row('202-1-1031', 'תשפ"ה', 'ב', [
        ['A', '31.00'],
        ['B', '41.00'],
      ]),
      row('202-1-1031', 'תשפ"ו', 'א', [['A', '80.00']]),
    ]);
    expect(course.final.grade).toBe('80');
    expect(course.final.year).toBe('תשפ"ו');
    expect(course.history.map((h) => h.grade)).toEqual(['41', '31']);
  });

  it('follows a course through a department renumber', () => {
    // 201.1.7011 became 212.1.7011 between the two attempts.
    const courses = aggregateGrades([
      row('201-1-7011', 'תשפ"ה', 'א', [['A', '39.00']], { name: 'Algebra 1' }),
      row('212-1-7011', 'תשפ"ו', 'א', [['A', '94.00']], { name: 'Algebra 1' }),
    ]);
    expect(courses).toHaveLength(1);
    expect(courses[0].code).toBe('212-1-7011');
    expect(courses[0].priorCodes).toEqual(['201-1-7011']);
    expect(courses[0].final.grade).toBe('94');
  });

  it('keeps different courses apart even when renumbered alike', () => {
    const courses = aggregateGrades([
      row('201-1-7011', 'תשפ"ה', 'א', [['A', '39.00']], { name: 'Algebra 1' }),
      row('212-1-7011', 'תשפ"ו', 'א', [['A', '94.00']], { name: 'Logic' }),
    ]);
    expect(courses).toHaveLength(2);
  });

  it('orders sittings across semesters chronologically', () => {
    const [course] = aggregateGrades([
      row('201-1-7011', 'תשפ"ו', 'א', [
        ['A', '37.00'],
        ['B', '94.00'],
      ]),
      row('201-1-7011', 'תשפ"ה', 'א', [
        ['A', '39.00'],
        ['B', '30.00'],
      ]),
    ]);
    expect(course.final.grade).toBe('94');
    expect(course.history.map((h) => h.grade)).toEqual(['37', '30', '39']);
  });

  it('keeps a textual grade, and gives it no score', () => {
    const [course] = aggregateGrades([
      row('299-1-1121', 'תשפ"ה', 'א', [['A', 'עובר']], { credits: 0 }),
    ]);
    expect(course.final.grade).toBe('עובר');
    expect(course.final.score).toBeNull();
  });

  it('falls back to a filled-in name and credits from an earlier attempt', () => {
    const [course] = aggregateGrades([
      row('202-1-1031', 'תשפ"ה', 'ב', [['A', '31.00']], { name: 'Data Structures' }),
      row('202-1-1031', 'תשפ"ו', 'א', [['A', '80.00']], { name: '', credits: null }),
    ]);
    expect(course.name).toBe('Data Structures');
    expect(course.credits).toBe(5);
  });

  it('sorts the courses by their most recent attempt', () => {
    const courses = aggregateGrades([
      row('111-1-1111', 'תשפ"ה', 'א', [['A', '80.00']]),
      row('222-1-2222', 'תשפ"ו', 'א', [['A', '80.00']]),
      row('333-1-3333', 'תשפ"ה', 'ק', [['A', '80.00']]),
    ]);
    expect(courses.map((c) => c.code)).toEqual([
      '222-1-2222',
      '333-1-3333',
      '111-1-1111',
    ]);
  });

  it('ignores a row with no grades at all', () => {
    expect(aggregateGrades([row('202-1-1031', 'תשפ"ה', 'א', [])])).toEqual([]);
  });
});

describe('weightedAverage', () => {
  it('weights the counting grades by their credits', () => {
    const courses = aggregateGrades([
      row('111-1-1111', 'תשפ"ה', 'א', [['A', '69.00']], { credits: 5 }),
      row('222-1-2222', 'תשפ"ה', 'א', [
        ['A', '31.00'],
        ['B', '59.00'],
      ], { credits: 5 }),
      row('333-1-3333', 'תשפ"ה', 'א', [['A', '77.00']], { credits: 1 }),
    ]);
    // The figure this sheet prints for the same three courses.
    expect(weightedAverage(courses)).toBeCloseTo(65.18, 2);
  });

  it('leaves out an exemption, which carries no score', () => {
    const courses = aggregateGrades([
      row('111-1-1111', 'תשפ"ה', 'א', [['A', '80.00']], { credits: 5 }),
      row('222-1-2222', 'תשפ"ה', 'א', [['A', 'עובר']], { credits: 3 }),
    ]);
    expect(weightedAverage(courses)).toBe(80);
  });

  it('is null when nothing carries a grade', () => {
    expect(weightedAverage([])).toBeNull();
  });
});

describe('earnedCredits', () => {
  it('counts a pass and skips a failure', () => {
    const courses = aggregateGrades([
      row('111-1-1111', 'תשפ"ה', 'א', [['A', '80.00']], { credits: 5 }),
      row('222-1-2222', 'תשפ"ה', 'א', [['A', '41.00']], { credits: 3 }),
      row('333-1-3333', 'תשפ"ה', 'א', [['A', 'עובר']], { credits: 2 }),
    ]);
    expect(earnedCredits(courses)).toBe(7);
  });
});
