import { useState } from 'react';
import type { Course, Program } from '../types';
import type { CourseField, ProgramField } from '../diff';
import { diffPrograms } from '../diff';
import {
  DIFF_COLORS,
  diffFieldHtml,
  diffHeading,
  escHtml,
} from '../diffClipboard';
import { Modal } from './Modal';
import { useI18n } from '../i18n/useI18n';
import type { TKey } from '../i18n/useI18n';

interface Props {
  /** Left side — the file loaded to compare against (the "other version"). */
  base: Program;
  /** Right side — the curriculum currently open. */
  other: Program;
  /** Heading; defaults to the curriculum-vs-curriculum title. */
  title?: string;
  /** Sub-heading under the title; defaults to "{base} → {other}". */
  subtitle?: string;
  /** Message shown when nothing differs; defaults to the generic one. */
  identicalText?: string;
  onClose: () => void;
}

const COURSE_FIELD_LABEL: Record<CourseField, TKey> = {
  code: 'editor.code',
  name: 'editor.name',
  credits: 'editor.credits',
  type: 'editor.type',
  category: 'editor.category',
  year: 'editor.yearLabel',
  semester: 'editor.semester',
  description: 'editor.description',
  prerequisites: 'editor.prerequisites',
};

const PROGRAM_FIELD_LABEL: Record<ProgramField, TKey> = {
  name: 'settings.programName',
  degree: 'settings.degree',
  institution: 'settings.institution',
  years: 'settings.years',
  requiredCredits: 'settings.requiredCredits',
  showSummer: 'settings.showSummer',
};

export function DiffView({
  base,
  other,
  title,
  subtitle,
  identicalText,
  onClose,
}: Props) {
  const { t, dir } = useI18n();
  const diff = diffPrograms(base, other);
  const [copied, setCopied] = useState(false);

  const titleText = title ?? t('diff.title');
  const subtitleText =
    subtitle ?? t('diff.against', { base: base.name, other: other.name });
  const identicalMsg = identicalText ?? t('diff.identical');

  // Render a single course value, translating enum-typed fields. Empty values
  // (e.g. an added description) show an em dash.
  const courseVal = (field: CourseField, value: string) => {
    if (value === '') return t('diff.empty');
    if (field === 'type') return t(`courseType.${value}` as TKey);
    if (field === 'semester') return t(`semester.${value}` as TKey);
    return value;
  };

  const programVal = (field: ProgramField, value: string) => {
    if (field === 'showSummer') return t(value === 'true' ? 'common.yes' : 'common.no');
    return value === '' ? t('diff.empty') : value;
  };

  const courseLine = (c: Course) =>
    `${c.code ? c.code + ' · ' : ''}${c.name} (${t('common.credits', { n: c.credits })})`;

  // Where a course sits in the plan, e.g. "Year 3 / Semester A".
  const placement = (c: Course) =>
    `${t('grid.year', { n: c.year })} / ${t(`semester.${c.semester}` as TKey)}`;

  const deltaSign = diff.creditDelta > 0 ? '+' : '';

  const summaryBits = () => {
    const bits = [
      t('diff.addedCount', { n: diff.added.length }),
      t('diff.removedCount', { n: diff.removed.length }),
      t('diff.modifiedCount', { n: diff.modified.length }),
    ];
    if (diff.creditDelta !== 0) {
      bits.push(`${t('diff.creditDelta')}: ${deltaSign}${diff.creditDelta}`);
    }
    return bits;
  };

  /* ---- Build a self-contained representation for the clipboard ---- */

  const esc = escHtml;
  const { removed: RED, added: GREEN, muted: MUTED, text: TEXT } = DIFF_COLORS;
  const fieldHtml = diffFieldHtml;
  const heading = diffHeading;

  const buildHtml = () => {
    const p: string[] = [];
    p.push(`<h2 style="margin:0 0 4px;font-size:18px;">${esc(titleText)}</h2>`);
    p.push(
      `<div style="color:${MUTED};font-size:13px;margin-bottom:10px;">${esc(
        subtitleText,
      )}</div>`,
    );

    if (!diff.hasChanges) {
      p.push(`<p>${esc(identicalMsg)}</p>`);
    } else {
      p.push(
        `<div style="font-size:13px;margin-bottom:6px;">${summaryBits()
          .map(esc)
          .join(' · ')}</div>`,
      );

      if (diff.meta.length) {
        p.push(heading(t('diff.programChanges')));
        for (const c of diff.meta) {
          p.push(
            fieldHtml(
              t(PROGRAM_FIELD_LABEL[c.field]),
              programVal(c.field, c.before),
              programVal(c.field, c.after),
            ),
          );
        }
      }

      if (diff.added.length) {
        p.push(heading(t('diff.added')));
        for (const c of diff.added) {
          p.push(
            `<div style="font-size:13px;color:${GREEN};">+ ${esc(courseLine(c))} ` +
              `<span style="color:${MUTED};">${esc(placement(c))}</span></div>`,
          );
        }
      }

      if (diff.removed.length) {
        p.push(heading(t('diff.removed')));
        for (const c of diff.removed) {
          p.push(
            `<div style="font-size:13px;color:${RED};">− ` +
              `<span style="text-decoration:line-through;">${esc(courseLine(c))}</span> ` +
              `<span style="color:${MUTED};">${esc(placement(c))}</span></div>`,
          );
        }
      }

      if (diff.modified.length) {
        p.push(heading(t('diff.modified')));
        for (const m of diff.modified) {
          p.push(
            `<div style="font-weight:600;font-size:13px;margin-top:6px;">${esc(
              courseLine(m.after),
            )}</div>`,
          );
          for (const c of m.changes) {
            p.push(
              `<div style="margin-inline-start:14px;">${fieldHtml(
                t(COURSE_FIELD_LABEL[c.field]),
                courseVal(c.field, c.before),
                courseVal(c.field, c.after),
              )}</div>`,
            );
          }
        }
      }
    }

    return `<div dir="${dir}" style="font-family:'Segoe UI',Arial,sans-serif;color:${TEXT};line-height:1.4;">${p.join(
      '',
    )}</div>`;
  };

  const buildText = () => {
    const lines: string[] = [titleText, subtitleText];
    if (!diff.hasChanges) {
      lines.push('', identicalMsg);
      return lines.join('\n');
    }
    lines.push('', summaryBits().join(' · '));

    if (diff.meta.length) {
      lines.push('', t('diff.programChanges'));
      for (const c of diff.meta) {
        lines.push(
          `  ${t(PROGRAM_FIELD_LABEL[c.field])}: ${programVal(c.field, c.before)} → ${programVal(c.field, c.after)}`,
        );
      }
    }
    if (diff.added.length) {
      lines.push('', t('diff.added'));
      for (const c of diff.added) lines.push(`  + ${courseLine(c)} (${placement(c)})`);
    }
    if (diff.removed.length) {
      lines.push('', t('diff.removed'));
      for (const c of diff.removed) lines.push(`  − ${courseLine(c)} (${placement(c)})`);
    }
    if (diff.modified.length) {
      lines.push('', t('diff.modified'));
      for (const m of diff.modified) {
        lines.push(`  ${courseLine(m.after)}`);
        for (const c of m.changes) {
          lines.push(
            `      ${t(COURSE_FIELD_LABEL[c.field])}: ${courseVal(c.field, c.before)} → ${courseVal(c.field, c.after)}`,
          );
        }
      }
    }
    return lines.join('\n');
  };

  const onCopy = async () => {
    const html = buildHtml();
    const text = buildText();
    try {
      if (
        typeof ClipboardItem !== 'undefined' &&
        navigator.clipboard?.write
      ) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([text], { type: 'text/plain' }),
          }),
        ]);
      } else {
        // Older browsers: plain text only.
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      alert(t('diff.copyError'));
    }
  };

  return (
    <Modal onClose={onClose} className="modal-wide">
        <h2>{titleText}</h2>
        <div className="diff-subtitle">{subtitleText}</div>

        {!diff.hasChanges ? (
          <p className="ok">{identicalMsg}</p>
        ) : (
          <>
            <div className="diff-summary">
              <span className="diff-chip added">
                {t('diff.addedCount', { n: diff.added.length })}
              </span>
              <span className="diff-chip removed">
                {t('diff.removedCount', { n: diff.removed.length })}
              </span>
              <span className="diff-chip modified">
                {t('diff.modifiedCount', { n: diff.modified.length })}
              </span>
              {diff.creditDelta !== 0 && (
                <span className="diff-chip">
                  {t('diff.creditDelta')}: {deltaSign}
                  {diff.creditDelta}
                </span>
              )}
            </div>

            {diff.meta.length > 0 && (
              <section className="diff-section">
                <h3>{t('diff.programChanges')}</h3>
                {diff.meta.map((change) => (
                  <div className="diff-field" key={change.field}>
                    <span className="diff-field-name">
                      {t(PROGRAM_FIELD_LABEL[change.field])}
                    </span>
                    <span className="diff-before">
                      {programVal(change.field, change.before)}
                    </span>
                    <span className="diff-arrow">→</span>
                    <span className="diff-after">
                      {programVal(change.field, change.after)}
                    </span>
                  </div>
                ))}
              </section>
            )}

            {diff.added.length > 0 && (
              <section className="diff-section">
                <h3>{t('diff.added')}</h3>
                <ul className="diff-course-list">
                  {diff.added.map((c) => (
                    <li className="diff-course added" key={c.id}>
                      {courseLine(c)}
                      <span className="diff-placement">{placement(c)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {diff.removed.length > 0 && (
              <section className="diff-section">
                <h3>{t('diff.removed')}</h3>
                <ul className="diff-course-list">
                  {diff.removed.map((c) => (
                    <li className="diff-course removed" key={c.id}>
                      {courseLine(c)}
                      <span className="diff-placement">{placement(c)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {diff.modified.length > 0 && (
              <section className="diff-section">
                <h3>{t('diff.modified')}</h3>
                {diff.modified.map((m) => (
                  <div className="diff-course-mod" key={m.after.id}>
                    <div className="diff-course-head">{courseLine(m.after)}</div>
                    {m.changes.map((change) => (
                      <div className="diff-field" key={change.field}>
                        <span className="diff-field-name">
                          {t(COURSE_FIELD_LABEL[change.field])}
                        </span>
                        <span className="diff-before">
                          {courseVal(change.field, change.before)}
                        </span>
                        <span className="diff-arrow">→</span>
                        <span className="diff-after">
                          {courseVal(change.field, change.after)}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </section>
            )}
          </>
        )}

        <div className="modal-actions">
          <span className="spacer" />
          {diff.hasChanges && (
            <button onClick={onCopy}>
              {copied ? t('diff.copied') : t('diff.copy')}
            </button>
          )}
          <button className="primary" onClick={onClose}>
            {t('diff.close')}
          </button>
        </div>
    </Modal>
  );
}
