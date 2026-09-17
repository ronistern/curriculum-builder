import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Course, Program } from '../types';
import { aggregateGrades, type CourseInstance, type GradeSheet } from '../grades';
import { GradesView } from './GradesView';
import { I18nContext, type I18nValue } from '../i18n/useI18n';
import { translations } from '../i18n/translations';

/** A minimal English `t`, resolving dotted keys against the real dictionary. */
const t: I18nValue['t'] = (key, params) => {
  let node: unknown = translations.en;
  for (const part of String(key).split('.')) {
    node = (node as Record<string, unknown> | undefined)?.[part];
  }
  const text = typeof node === 'string' ? node : String(key);
  return text.replace(/\{(\w+)\}/g, (m, name) => String(params?.[name] ?? m));
};
const i18n: I18nValue = { lang: 'en', dir: 'ltr', setLang: () => {}, t };

const instance = (
  code: string,
  name: string,
  year: string,
  grades: string[],
): CourseInstance => ({
  code,
  name,
  credits: 5,
  kind: 'חובה',
  year,
  semester: "א'",
  sittings: grades.map((grade, i) => ({
    moed: i === 0 ? ('A' as const) : ('B' as const),
    grade,
  })),
  note: '',
});

const sheet: GradeSheet = {
  student: { name: 'ישראל ישראלי', id: '123456789' },
  asOf: '17.09.2026',
  cumulativeAverage: 76.16,
  cumulativeCredits: 36.5,
  courses: aggregateGrades([
    instance('202-1-1031', 'Data Structures', 'תשפ"ה', ['31.00', '41.00']),
    instance('202-1-1031', 'Data Structures', 'תשפ"ו', ['80.00']),
    instance('151-1-1281', 'Music', 'תשפ"ו', ['85.00']),
  ]),
};

const program: Program = {
  id: 'p1',
  name: 'CS',
  degree: 'B.Sc.',
  institution: 'BGU',
  years: 3,
  requiredCredits: 120,
  showSummer: false,
  courses: [
    {
      id: 'c1',
      code: '202-1-1031',
      name: 'Data Structures',
      credits: 5,
      type: 'mandatory',
      category: '',
      year: 1,
      semester: 'A',
      prerequisites: [],
    } satisfies Course,
  ],
  bundles: [],
  electiveGroups: [],
};

const render = (s: GradeSheet | null) =>
  renderToStaticMarkup(
    <I18nContext.Provider value={i18n}>
      <GradesView program={program} sheet={s} onSheet={() => {}} onClose={() => {}} />
    </I18nContext.Provider>,
  );

describe('GradesView', () => {
  it('asks for a file, and promises not to keep it, when nothing is open', () => {
    const html = render(null);
    expect(html).toContain('Upload transcript');
    expect(html).toContain('nothing is uploaded and nothing is saved');
    expect(html).not.toContain('grades-table');
  });

  it('puts the counting grade and the earlier attempts on one line', () => {
    const html = render(sheet);
    const row = html.slice(html.indexOf('202-1-1031'));
    const line = row.slice(0, row.indexOf('</tr>'));
    // The retake counts, and both earlier attempts trail it on the same row.
    expect(line).toContain('>80<');
    expect(line).toContain('>41<');
    expect(line).toContain('>31<');
    // The failed attempts are marked as such; the passing one is not.
    expect(line).toContain('class="attempt fail"');
    expect(line).not.toContain('class="grade fail"');
  });

  it('shows the term of the attempt that counts, not of an earlier one', () => {
    // The markup escapes the gershayim in תשפ"ו and the geresh in א'.
    expect(render(sheet)).toContain('<td class="col-term">תשפ&quot;ו א&#x27;</td>');
    expect(render(sheet)).not.toContain('<td class="col-term">תשפ&quot;ה א&#x27;</td>');
  });

  it('flags which courses are in the program', () => {
    const html = render(sheet);
    expect(html).toContain('1/2 in program');
    expect(html).toContain('class="in-program"');
    expect(html).toContain('class="not-in-program"');
  });

  it('shows the student and the running totals the sheet printed', () => {
    const html = render(sheet);
    expect(html).toContain('ישראל ישראלי');
    expect(html).toContain('As of 17.09.2026');
    expect(html).toContain('Average 76.16');
    expect(html).toContain('36.5 cr');
  });

  it('links a course code to its BGU catalog entry', () => {
    expect(render(sheet)).toContain('on_course_department=202');
  });
});
