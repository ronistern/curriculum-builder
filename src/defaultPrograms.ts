import type { Program } from './types';
import { normalizeProgram } from './fileStore';

/**
 * Built-in starter curricula, bundled at build time from every `*.json` file in
 * `./defaultPrograms/`. Drop a curriculum JSON (as produced by Export / Save)
 * into that folder and it appears automatically in the Open dialog — no code
 * change needed.
 */
export interface DefaultProgram {
  /** Stable id derived from the file name, used as a React key. */
  id: string;
  program: Program;
}

const modules = import.meta.glob<{ default: Program }>(
  './defaultPrograms/*.json',
  { eager: true },
);

export const defaultPrograms: DefaultProgram[] = Object.entries(modules)
  .map(([path, mod]) => ({
    id: path.split('/').pop()!.replace(/\.json$/, ''),
    program: normalizeProgram(mod.default),
  }))
  .sort((a, b) => a.program.name.localeCompare(b.program.name));
