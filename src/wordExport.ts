import type { Course, Program } from './types';
import {
  activeSemesters,
  coursesAt,
  prereqLabels,
  totalCredits,
  weightedCredits,
} from './stats';
import { slugify, triggerDownload } from './util';
import type { TKey, TParams } from './i18n/useI18n';

/**
 * Export a curriculum to a Word document.
 *
 * Rather than depend on a heavyweight `.docx` generator, we emit a self-contained
 * HTML document with real `<table>` markup and save it with a `.doc` extension.
 * Word opens such files natively and renders/edits them as ordinary tables —
 * dependency-free, and the result is fully editable in Word.
 */

type T = (key: TKey, params?: TParams) => string;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** A filesystem-safe `.doc` file name derived from the program name. */
function wordFileName(program: Program): string {
  return `${slugify(program.name, 'curriculum')}.doc`;
}

function tableHead(t: T): string {
  const cols = [
    t('editor.code'),
    t('editor.name'),
    t('editor.credits'),
    t('editor.type'),
    t('editor.category'),
    t('editor.prerequisites'),
  ];
  return `<tr>${cols
    .map((c) => `<th>${escapeHtml(c)}</th>`)
    .join('')}</tr>`;
}

function courseRow(course: Course, byId: Map<string, Course>, t: T): string {
  const prereqs = prereqLabels(course, byId).join(', ');
  const cells = [
    course.code,
    course.name,
    String(course.credits ?? ''),
    t(`courseType.${course.type}`),
    course.category,
    prereqs,
  ];
  return `<tr>${cells
    .map((c) => `<td>${escapeHtml(c)}</td>`)
    .join('')}</tr>`;
}

function buildHtml(program: Program, t: T, dir: 'rtl' | 'ltr'): string {
  const byId = new Map(program.courses.map((c) => [c.id, c]));
  const semesters = activeSemesters(program);
  const years = Array.from({ length: program.years }, (_, i) => i + 1);
  const colCount = 6;

  const sections = years
    .map((year) => {
      const rows: string[] = [];
      for (const sem of semesters) {
        const courses = coursesAt(program, year, sem);
        if (courses.length === 0) continue;
        const credits = weightedCredits(program, courses);
        rows.push(
          `<tr class="sem"><td colspan="${colCount}">${escapeHtml(
            t(`semester.${sem}`),
          )} — ${escapeHtml(t('common.credits', { n: credits }))}</td></tr>`,
        );
        for (const c of courses) rows.push(courseRow(c, byId, t));
      }
      if (rows.length === 0) return '';
      return `<h2>${escapeHtml(t('grid.year', { n: year }))}</h2>
<table>
<thead>${tableHead(t)}</thead>
<tbody>${rows.join('')}</tbody>
</table>`;
    })
    .filter(Boolean)
    .join('\n');

  const title = [program.degree, program.name].filter(Boolean).join(' ');
  const subtitle = program.institution ? escapeHtml(program.institution) : '';
  const totals = escapeHtml(
    `${t('summary.title')}: ${t('common.credits', {
      n: totalCredits(program),
    })}`,
  );

  return `<!DOCTYPE html>
<html dir="${dir}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; }
  h1 { font-size: 18pt; margin: 0 0 4pt; }
  h2 { font-size: 13pt; margin: 14pt 0 4pt; }
  .subtitle { color: #555; margin-bottom: 2pt; }
  .totals { margin: 4pt 0 8pt; font-weight: bold; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 8pt; }
  th, td { border: 1px solid #999; padding: 4pt 6pt; text-align: ${
    dir === 'rtl' ? 'right' : 'left'
  }; vertical-align: top; font-size: 10pt; }
  th { background: #e8e8e8; }
  tr.sem td { background: #f4f4f4; font-weight: bold; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
<div class="totals">${totals}</div>
${sections}
</body>
</html>`;
}

/** Generate the Word document and trigger a download in the browser. */
export function downloadProgramAsWord(
  program: Program,
  t: T,
  dir: 'rtl' | 'ltr',
): void {
  const html = buildHtml(program, t, dir);
  // Leading BOM so Word detects UTF-8.
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  triggerDownload(blob, wordFileName(program));
}
