/**
 * Presentational primitives for the diff's clipboard export. Kept out of the
 * React component so the colors and HTML builders are a single source of truth
 * and unit-testable. The on-screen diff uses CSS classes instead; these inline
 * styles exist because clipboard HTML must be self-contained.
 */

export const DIFF_COLORS = {
  removed: '#c92a2a',
  added: '#2f9e44',
  muted: '#6b7585',
  text: '#1f2530',
} as const;

/** HTML-escape a value for inclusion in the clipboard markup. */
export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** A `label: before → after` line with strike-through/coloured values. */
export function diffFieldHtml(label: string, before: string, after: string): string {
  return (
    `<div style="font-size:13px;margin:2px 0;"><b>${escHtml(label)}:</b> ` +
    `<span style="color:${DIFF_COLORS.removed};text-decoration:line-through;">${escHtml(before)}</span> → ` +
    `<span style="color:${DIFF_COLORS.added};">${escHtml(after)}</span></div>`
  );
}

/** A muted section heading. */
export function diffHeading(text: string): string {
  return `<div style="font-weight:600;color:${DIFF_COLORS.muted};font-size:13px;margin:14px 0 4px;">${escHtml(text)}</div>`;
}
