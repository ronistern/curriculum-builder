import type { Program } from '../types';

interface Props {
  program: Program;
  onChange: (program: Program) => void;
  onClose: () => void;
}

export function ProgramSettings({ program, onChange, onClose }: Props) {
  const set = <K extends keyof Program>(key: K, value: Program[K]) =>
    onChange({ ...program, [key]: value });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Program details</h2>

        <label>
          Program name
          <input
            value={program.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </label>

        <div className="grid-2">
          <label>
            Degree
            <input
              value={program.degree}
              onChange={(e) => set('degree', e.target.value)}
              placeholder="B.Sc."
            />
          </label>
          <label>
            Institution
            <input
              value={program.institution}
              onChange={(e) => set('institution', e.target.value)}
            />
          </label>
        </div>

        <div className="grid-2">
          <label>
            Number of years
            <input
              type="number"
              min={1}
              max={8}
              value={program.years}
              onChange={(e) =>
                set('years', Math.max(1, Number(e.target.value) || 1))
              }
            />
          </label>
          <label>
            Required credits
            <input
              type="number"
              min={0}
              value={program.requiredCredits}
              onChange={(e) => set('requiredCredits', Number(e.target.value))}
            />
          </label>
        </div>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={program.showSummer}
            onChange={(e) => set('showSummer', e.target.checked)}
          />
          Show Summer semester column
        </label>

        <div className="modal-actions">
          <span className="spacer" />
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
