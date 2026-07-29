import { describe, expect, it } from 'vitest';
import type { Course } from './types';
import { syllabusUrl } from './syllabus';

const course = (code: string): Course => ({
  id: 'c1',
  code,
  name: 'Test',
  credits: 3,
  type: 'mandatory',
  category: '',
  year: 1,
  semester: 'A',
  prerequisites: [],
});

describe('syllabusUrl', () => {
  it('derives the BGU catalog URL from a BGU course number', () => {
    const url = syllabusUrl(course('232-1-1011'));
    expect(url).toBe(
      'https://bgu4u.bgu.ac.il/pls/scwp/!sc.AnnualSearchResults' +
        '?on_course_department=232&on_course_degree_level=1&on_course=1011',
    );
  });

  it('preserves a leading zero in the course segment', () => {
    expect(syllabusUrl(course('212-1-0201'))).toContain('on_course=0201');
  });

  it('ignores surrounding whitespace', () => {
    expect(syllabusUrl(course('  232-1-1011  '))).toContain('on_course=1011');
  });

  it('returns null for a non-BGU code', () => {
    expect(syllabusUrl(course('CS101'))).toBeNull();
    expect(syllabusUrl(course(''))).toBeNull();
  });

  it('returns null (no throw) for a missing code', () => {
    const noCode = { ...course('x'), code: undefined as unknown as string };
    expect(syllabusUrl(noCode)).toBeNull();
  });
});
