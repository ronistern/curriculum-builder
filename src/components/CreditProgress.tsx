import { percentOf } from '../util';

interface Props {
  /** Credits achieved so far. */
  value: number;
  /** Target credits (the denominator). */
  total: number;
  /** Caption under the big number. */
  label: string;
  /** Style the bar as exceeding the target. */
  over?: boolean;
}

/**
 * The "big number / target + progress bar" block shared by the curriculum
 * summary and the advising panel.
 */
export function CreditProgress({ value, total, label, over }: Props) {
  const pct = percentOf(value, total);
  return (
    <>
      <div className="big-number">
        {value}
        <span className="of"> / {total}</span>
      </div>
      <div className="muted">{label}</div>
      <div className="progress">
        <div
          className={`progress-bar${over ? ' over' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </>
  );
}
