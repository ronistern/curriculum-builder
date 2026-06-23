import type { Program } from '../types';
import { COURSE_TYPES } from '../types';
import {
  creditsByType,
  creditsByYear,
  findPrereqIssues,
  totalCredits,
} from '../stats';

export function SummaryPanel({ program }: { program: Program }) {
  const total = totalCredits(program);
  const byType = creditsByType(program);
  const byYear = creditsByYear(program);
  const issues = findPrereqIssues(program);
  const pct = program.requiredCredits
    ? Math.min(100, Math.round((total / program.requiredCredits) * 100))
    : 0;

  return (
    <aside className="summary">
      <h2>Summary</h2>

      <div className="summary-block">
        <div className="big-number">
          {total}
          <span className="of"> / {program.requiredCredits}</span>
        </div>
        <div className="muted">credits planned</div>
        <div className="progress">
          <div
            className={`progress-bar ${total > program.requiredCredits ? 'over' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="summary-block">
        <h3>By year</h3>
        {byYear.map((credits, i) => (
          <div className="summary-row" key={i}>
            <span>Year {i + 1}</span>
            <span>{credits} cr</span>
          </div>
        ))}
      </div>

      <div className="summary-block">
        <h3>By type</h3>
        {COURSE_TYPES.map((t) =>
          byType[t.value] ? (
            <div className="summary-row" key={t.value}>
              <span className={`type-badge type-${t.value}`}>{t.label}</span>
              <span>{byType[t.value]} cr</span>
            </div>
          ) : null,
        )}
        {program.courses.length === 0 && <p className="muted">No courses yet.</p>}
      </div>

      <div className="summary-block">
        <h3>Prerequisite checks</h3>
        {issues.length === 0 ? (
          <p className="ok">✓ All prerequisites are scheduled earlier.</p>
        ) : (
          <ul className="issue-list">
            {issues.map((iss, i) => (
              <li key={i}>
                <strong>{iss.course.name}</strong> needs{' '}
                <strong>{iss.prereq.name}</strong> first, but it is scheduled in
                Year {iss.prereq.year} / {iss.prereq.semester}.
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
