import { useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import type { Course, Program } from '../types';
import {
  isFailing,
  normalizeCourseCode,
  termLabel,
  type CourseGrades,
  type GradeAttempt,
  type GradeSheet,
} from '../grades';
import { allCatalogs } from '../catalogLibrary';
import { syllabusUrl } from '../syllabus';
import { HiddenFileInput } from './HiddenFileInput';
import { useI18n } from '../i18n/useI18n';

interface Props {
  /** The program the courses are matched against by default. */
  program: Program;
  sheet: GradeSheet | null;
  onSheet: (sheet: GradeSheet | null) => void;
  onClose: () => void;
}

/** The catalog courses a transcript row can match, keyed by normalized code. */
function courseIndex(program: Program | undefined): Map<string, Course> {
  const index = new Map<string, Course>();
  for (const course of program?.courses ?? []) {
    const code = normalizeCourseCode(course.code ?? '');
    if (code) index.set(code, course);
  }
  return index;
}

/**
 * The catalog course a transcript entry is, if any. A course that was renumbered
 * is looked up under its earlier codes too, so a catalog still listing the old
 * number is matched.
 */
function matchOf(
  index: Map<string, Course>,
  entry: CourseGrades,
): Course | undefined {
  for (const code of [entry.code, ...entry.priorCodes]) {
    const course = index.get(code);
    if (course) return course;
  }
  return undefined;
}

/**
 * The course number, linking to the official BGU catalog entry when the code is
 * a BGU one. A course that was renumbered is marked with an asterisk carrying
 * the codes it was listed under before.
 */
function CodeCell({ code, priorCodes }: { code: string; priorCodes: string[] }) {
  const { t } = useI18n();
  const url = syllabusUrl({ code });
  const renamed = priorCodes.length > 0;
  const title = renamed
    ? t('grades.priorCodes', { codes: priorCodes.join(', ') })
    : t('course.syllabusHint');

  return (
    <>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" title={title}>
          {code}
        </a>
      ) : (
        <span title={renamed ? title : undefined}>{code}</span>
      )}
      {renamed && <sup title={title}>*</sup>}
    </>
  );
}

/**
 * A student's transcript: every course they took, the grade that counts, and the
 * earlier attempts on the same line.
 *
 * The table is deliberately dense — one line per course, no wrapping — so a
 * whole degree fits on screen without scrolling. The parsed sheet is held by the
 * caller so leaving and coming back doesn't mean opening the file again; it is
 * never written to disk or to local storage, since it is someone's personal
 * record.
 */
export function GradesView({ program, sheet, onSheet, onClose }: Props) {
  const { t } = useI18n();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [catalogId, setCatalogId] = useState(program.id);

  // Every catalog the app knows, with the open program first — it is the one an
  // advisor is most likely comparing against.
  const catalogs = useMemo(() => {
    const rest = allCatalogs().filter((c) => c.id !== program.id);
    return [program, ...rest];
  }, [program]);
  const catalog = catalogs.find((c) => c.id === catalogId) ?? program;
  const index = useMemo(() => courseIndex(catalog), [catalog]);

  const matched = sheet
    ? sheet.courses.filter((c) => matchOf(index, c)).length
    : 0;

  const open = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      // pdf.js is a megabyte of parser; load it the first time a sheet is
      // actually opened rather than in everyone's initial bundle.
      const { readGradeSheet } = await import('../gradesPdf');
      onSheet(await readGradeSheet(file));
    } catch (err) {
      onSheet(null);
      setError(t('grades.error') + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void open(e.dataTransfer.files?.[0]);
  };

  const attemptTitle = (a: GradeAttempt) =>
    t('grades.attempt', {
      grade: a.grade,
      term: termLabel(a.year, a.semester),
      moed: t(`grades.moed.${a.moed}`),
    });

  return (
    <div
      className={`grades-view${dragging ? ' dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <header className="grades-bar">
        <div className="grades-who">
          <h1>{sheet?.student.name || t('grades.title')}</h1>
          {sheet && (
            <div className="subtitle">
              {[
                sheet.student.id,
                sheet.asOf && t('grades.asOf', { date: sheet.asOf }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
        </div>

        {sheet && (
          <div className="grades-stats">
            <span className="grades-chip">
              {t('grades.courses', { n: sheet.courses.length })}
            </span>
            {sheet.cumulativeCredits !== null && (
              <span className="grades-chip">
                {t('grades.credits', { n: sheet.cumulativeCredits })}
              </span>
            )}
            {sheet.cumulativeAverage !== null && (
              <span className="grades-chip strong">
                {t('grades.average', { n: sheet.cumulativeAverage })}
              </span>
            )}
            <span className="grades-chip">
              {t('grades.matched', { n: matched, total: sheet.courses.length })}
            </span>
          </div>
        )}

        <div className="grades-actions">
          {sheet && catalogs.length > 1 && (
            <label className="grades-catalog">
              {t('grades.against')}
              <select
                value={catalogId}
                onChange={(e) => setCatalogId(e.target.value)}
              >
                {catalogs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button onClick={() => fileInput.current?.click()} disabled={busy}>
            {busy ? t('grades.reading') : t(sheet ? 'grades.replace' : 'grades.upload')}
          </button>
          <button className="danger-ghost" onClick={onClose}>
            {t('grades.back')}
          </button>
          <HiddenFileInput
            ref={fileInput}
            accept="application/pdf"
            onFile={(file) => void open(file)}
          />
        </div>
      </header>

      {error && <div className="grades-error">{error}</div>}

      {!sheet ? (
        <div className="grades-empty">
          <p>{t('grades.empty')}</p>
          <p className="grades-drop">
            {t('grades.drop')}{' '}
            <button className="primary" onClick={() => fileInput.current?.click()}>
              {t('grades.upload')}
            </button>
          </p>
          <p className="grades-privacy">{t('grades.privacy')}</p>
        </div>
      ) : (
        <div className="grades-table-wrap">
          <table className="grades-table">
            <thead>
              <tr>
                <th className="col-code">{t('grades.col.code')}</th>
                <th className="col-name">{t('grades.col.name')}</th>
                <th className="col-num">{t('grades.col.credits')}</th>
                <th className="col-kind">{t('grades.col.kind')}</th>
                <th className="col-term">{t('grades.col.term')}</th>
                <th className="col-num">{t('grades.col.grade')}</th>
                <th className="col-history">{t('grades.col.history')}</th>
                <th className="col-program">{t('grades.col.program')}</th>
              </tr>
            </thead>
            <tbody>
              {sheet.courses.map((c) => {
                const match = matchOf(index, c);
                return (
                  <tr key={c.code + c.name}>
                    <td className="col-code">
                      <CodeCell code={c.code} priorCodes={c.priorCodes} />
                    </td>
                    <td className="col-name" title={c.name}>
                      {c.name}
                    </td>
                    <td className="col-num">{c.credits ?? ''}</td>
                    <td className="col-kind">{c.kind}</td>
                    <td className="col-term">
                      {termLabel(c.final.year, c.final.semester)}
                    </td>
                    <td className="col-num">
                      <span
                        className={`grade${isFailing(c.final) ? ' fail' : ''}`}
                        title={attemptTitle(c.final)}
                      >
                        {c.final.grade}
                      </span>
                    </td>
                    <td className="col-history">
                      {c.history.map((a, i) => (
                        <span
                          key={i}
                          className={`attempt${isFailing(a) ? ' fail' : ''}`}
                          title={attemptTitle(a)}
                        >
                          {a.grade}
                        </span>
                      ))}
                    </td>
                    <td className="col-program">
                      {match ? (
                        <span className="in-program" title={match.name}>
                          ✓
                        </span>
                      ) : (
                        <span className="not-in-program" title={t('grades.notInProgram')}>
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
