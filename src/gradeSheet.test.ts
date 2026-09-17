import { describe, expect, it } from 'vitest';
import { parseGradeSheet, type TextRow } from './gradeSheet';

/**
 * Rows in the shape the extractor produces, at the x positions of the real
 * report: the table is right-to-left and right-aligned, so each cell is given
 * as `[text, rightEdge]` and its left edge is estimated from the text length.
 */
function row(y: number, cells: [string, number][]): TextRow {
  return {
    y,
    items: cells
      .map(([str, right]) => ({ str, x: right - str.length * 4.5, right }))
      .sort((a, b) => a.x - b.x),
  };
}

const HEADER = row(452, [
  ['הערה', 105],
  ['ציון מ.מ.', 148],
  ['ציון מ.מ.', 196],
  ['ציון מ.ב.', 245],
  ['ציון מ.א.', 290],
  ['שעות', 319],
  ['נקודות', 359],
  ['א. הוראה', 397],
  ['מרצה', 490],
  ['סוג מקצוע', 540],
  ["קב'", 570],
  ['שם קורס', 683],
  ['מוסד', 711],
  ['קורס', 762],
]);

const term = (y: number, year: string, semester: string): TextRow =>
  row(y, [
    ['שנת', 755],
    [year, 730],
    ['סמסטר', 670],
    [semester, 635],
    ['2025', 590],
  ]);

/** A course row: the columns a transcript line fills in. */
function course(
  y: number,
  opts: {
    code: string;
    name: string;
    credits?: string;
    hours?: string;
    kind?: string;
    group?: string;
    moedA?: string;
    moedB?: string;
    note?: string;
  },
): TextRow {
  const cells: [string, number][] = [
    [opts.code, 751],
    ['0', 702],
    [opts.name, 683],
  ];
  if (opts.group) cells.push([opts.group, 565]);
  if (opts.kind) cells.push([opts.kind, 537]);
  cells.push(['שת', 397]);
  cells.push([opts.credits ?? '5.00', 353]);
  cells.push([opts.hours ?? '6.00', 317]);
  if (opts.moedA) cells.push([opts.moedA, 281]);
  if (opts.moedB) cells.push([opts.moedB, 236]);
  if (opts.note) cells.push([opts.note, 122]);
  return row(y, cells);
}

describe('parseGradeSheet', () => {
  it('reads a course row into its columns', () => {
    const sheet = parseGradeSheet([
      HEADER,
      term(430, 'תשפ"ה', "א'"),
      course(400, {
        code: '202.1.1011',
        name: 'מבוא למדעי המחשב',
        kind: 'חובה',
        group: '1',
        moedA: '85.00',
      }),
    ]);
    expect(sheet.courses).toHaveLength(1);
    const [c] = sheet.courses;
    expect(c.code).toBe('202-1-1011');
    // The weekly hours, group and institution sit either side of these columns
    // and must not bleed into them.
    expect(c.name).toBe('מבוא למדעי המחשב');
    expect(c.credits).toBe(5);
    expect(c.kind).toBe('חובה');
    expect(c.final.grade).toBe('85');
    expect(c.final.year).toBe('תשפ"ה');
    expect(c.final.semester).toBe("א'");
  });

  it('takes the later sitting as the grade that counts', () => {
    const sheet = parseGradeSheet([
      HEADER,
      term(430, 'תשפ"ה', "א'"),
      course(400, {
        code: '361.1.3131',
        name: 'מערכות ספרתיות',
        moedA: '50.00',
        moedB: '68.00',
      }),
    ]);
    expect(sheet.courses[0].final.grade).toBe('68');
    expect(sheet.courses[0].history.map((h) => h.grade)).toEqual(['50']);
  });

  it('joins a course name that wraps onto the next line', () => {
    const sheet = parseGradeSheet([
      HEADER,
      term(430, 'תשפ"ה', "א'"),
      course(400, {
        code: '201.1.0201',
        name: 'מבוא ללוגיקה ולתורת הקבוצות',
        moedA: '69.00',
        note: 'כשלון2, לא לשקלול',
      }),
      row(388, [
        ['למדעי המחשב והנדסת תכנה', 683],
        ['קיים קורס מאוחר', 113],
      ]),
    ]);
    expect(sheet.courses[0].name).toBe(
      'מבוא ללוגיקה ולתורת הקבוצות למדעי המחשב והנדסת תכנה',
    );
    expect(sheet.courses[0].final.note).toContain('קיים קורס מאוחר');
  });

  it('carries the term across semester blocks', () => {
    const sheet = parseGradeSheet([
      HEADER,
      term(430, 'תשפ"ה', "ב'"),
      course(400, { code: '202.1.1031', name: 'מבני נתונים', moedA: '31.00' }),
      HEADER,
      term(300, 'תשפ"ו', "א'"),
      course(280, { code: '202.1.1031', name: 'מבני נתונים', moedA: '80.00' }),
    ]);
    expect(sheet.courses).toHaveLength(1);
    expect(sheet.courses[0].final.grade).toBe('80');
    expect(sheet.courses[0].final.year).toBe('תשפ"ו');
    expect(sheet.courses[0].history.map((h) => h.grade)).toEqual(['31']);
  });

  it('does not mistake the totals under a block for a wrapped name', () => {
    const sheet = parseGradeSheet([
      HEADER,
      term(430, 'תשפ"ה', "א'"),
      course(400, { code: '202.1.1011', name: 'מבוא למדעי המחשב', moedA: '85.00' }),
      row(380, [
        ['סך הכל', 430],
        ['5.00', 380],
        ['6.00', 330],
      ]),
      // The degree-requirements table prints free text in the name column.
      row(360, [['מסמכים קבילים - הגשה עד תום הסמסטר הראשון', 683]]),
    ]);
    expect(sheet.courses[0].name).toBe('מבוא למדעי המחשב');
  });

  it('ignores a Hebrew year that is not a semester heading', () => {
    // The requirements table lists a target term without the word "סמסטר".
    const sheet = parseGradeSheet([
      HEADER,
      term(430, 'תשפ"ה', "א'"),
      course(400, { code: '202.1.1011', name: 'מבוא למדעי המחשב', moedA: '85.00' }),
      row(360, [
        ['תשפ"ו', 470],
        ["ב'", 510],
      ]),
      course(340, { code: '202.1.1021', name: 'יישומים מתמטיים', moedA: '77.00' }),
    ]);
    expect(sheet.courses.map((c) => c.final.year)).toEqual(['תשפ"ה', 'תשפ"ה']);
  });

  it('reads the student, the date and the running totals off the report', () => {
    const sheet = parseGradeSheet([
      row(554, [['מר ישראל ישראלי )123456789(', 700]]),
      row(507, [
        ['תדפיס לימודים לועדת הוראה נכון ליום', 420],
        ['17.09.2026', 240],
      ]),
      HEADER,
      term(430, 'תשפ"ה', "א'"),
      course(400, { code: '202.1.1011', name: 'מבוא למדעי המחשב', moedA: '85.00' }),
      row(250, [
        ['נקודות זכות מצטבר', 540],
        ['19.5', 460],
        ['ממוצע מצטבר', 380],
        ['70.77', 280],
      ]),
      row(171, [
        ['נקודות זכות מצטבר', 540],
        ['36.50', 460],
        ['ממוצע מצטבר', 380],
        ['76.16', 280],
      ]),
    ]);
    expect(sheet.student).toEqual({ name: 'ישראל ישראלי', id: '123456789' });
    expect(sheet.asOf).toBe('17.09.2026');
    // The last block's totals win — they are the ones current at the end.
    expect(sheet.cumulativeAverage).toBe(76.16);
    expect(sheet.cumulativeCredits).toBe(36.5);
  });

  it('returns nothing for a PDF that is not a transcript', () => {
    const sheet = parseGradeSheet([row(500, [['Some other document', 400]])]);
    expect(sheet.courses).toEqual([]);
  });
});
