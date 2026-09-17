/**
 * Reading a grade-sheet PDF in the browser.
 *
 * pdf.js gives us the page's text as positioned fragments; this module turns
 * those into the rows `gradeSheet.ts` parses, and nothing more. The split keeps
 * the layout logic testable without a PDF or a worker.
 */

import * as pdfjs from 'pdfjs-dist';
import type { TextItem as PdfTextItem } from 'pdfjs-dist/types/src/display/api';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { parseGradeSheet, type TextItem, type TextRow } from './gradeSheet';
import type { GradeSheet } from './grades';

// Vite resolves the worker to a real URL at build time; pdf.js refuses to run
// without one.
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

/** Fragments within this many points of each other share a baseline. */
const ROW_TOLERANCE = 3;

/**
 * Text fragments of one page, grouped into rows (top to bottom) with each row's
 * items ordered left to right.
 *
 * pdf.js reports a fragment's width but not its right edge; for a rare font it
 * can come back as 0, so the width is estimated from the font size in that case
 * rather than collapsing the fragment onto its left edge — the parser matches
 * columns by right edge and would otherwise put the value in the wrong column.
 */
function rowsOfPage(items: PdfTextItem[]): TextRow[] {
  const rows: TextRow[] = [];

  for (const item of items) {
    const str = item.str;
    if (!str.trim()) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    const fontSize = Math.abs(item.transform[0]) || 10;
    const width = item.width > 0 ? item.width : str.length * fontSize * 0.5;
    const text: TextItem = { str, x, right: x + width };

    const row = rows.find((r) => Math.abs(r.y - y) <= ROW_TOLERANCE);
    if (row) row.items.push(text);
    else rows.push({ y, items: [text] });
  }

  rows.sort((a, b) => b.y - a.y);
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  return rows;
}

/** Every row of the document, in reading order: page by page, top to bottom. */
export async function extractRows(data: ArrayBuffer): Promise<TextRow[]> {
  const task = pdfjs.getDocument({ data });
  try {
    const doc = await task.promise;
    const rows: TextRow[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const items = content.items.filter((i): i is PdfTextItem => 'str' in i);
      rows.push(...rowsOfPage(items));
      page.cleanup();
    }
    return rows;
  } finally {
    // Tears down the worker with the document, so opening one sheet after
    // another doesn't leave workers behind.
    await task.destroy();
  }
}

/**
 * Read a student's grade sheet from a PDF. Throws when the file isn't a PDF, or
 * when it parses but holds no course rows — which means it isn't a transcript
 * (or is a scan, with no text layer to read).
 */
export async function readGradeSheet(file: File): Promise<GradeSheet> {
  const sheet = parseGradeSheet(await extractRows(await file.arrayBuffer()));
  if (!sheet.courses.length) {
    throw new Error('No courses found — is this a BGU transcript PDF?');
  }
  return sheet;
}
