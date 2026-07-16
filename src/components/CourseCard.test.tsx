import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Course } from '../types';
import { CourseCard } from './CourseCard';
import { I18nContext, type I18nValue } from '../i18n/useI18n';
import { translations } from '../i18n/translations';

/** A minimal English `t`, resolving dotted keys against the real dictionary. */
const t: I18nValue['t'] = (key) => {
  let node: unknown = translations.en;
  for (const part of String(key).split('.')) {
    node = (node as Record<string, unknown> | undefined)?.[part];
  }
  return typeof node === 'string' ? node : String(key);
};
const i18n: I18nValue = { lang: 'en', dir: 'ltr', setLang: () => {}, t };

const course = (code: string): Course => ({
  id: 'c1',
  code,
  name: 'Intro',
  credits: 3,
  type: 'mandatory',
  category: '',
  year: 1,
  semester: 'A',
  prerequisites: [],
});

const render = (c: Course) =>
  renderToStaticMarkup(
    <I18nContext.Provider value={i18n}>
      <CourseCard course={c} prereqLabels={[]} hasIssue={false} editable={false} />
    </I18nContext.Provider>,
  );

describe('CourseCard syllabus link', () => {
  it('renders a syllabus link for a BGU course', () => {
    const html = render(course('232-1-1011'));
    expect(html).toContain('class="syllabus-link"');
    expect(html).toContain(
      'href="https://bgu4u.bgu.ac.il/pls/scwp/!sc.AnnualSearchResults' +
        '?on_course_department=232&amp;on_course_degree_level=1&amp;on_course=1011"',
    );
    expect(html).toContain('Syllabus');
  });

  it('renders no syllabus link for a non-BGU course', () => {
    expect(render(course('CS101'))).not.toContain('syllabus-link');
  });
});
