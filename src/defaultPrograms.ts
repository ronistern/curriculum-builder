import type { Program } from './types';
import { normalizeProgram } from './fileStore';
import { upsertCatalog } from './catalogLibrary';

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
  .map(([path, mod]) => {
    const id = path.split('/').pop()!.replace(/\.json$/, '');
    const program = normalizeProgram(mod.default);
    // The file name is the built-in's stable, unique id — authoritative over any
    // id baked into the JSON (several shipped files share a copy-pasted id, which
    // would otherwise collide in the catalog library and drop programs).
    program.id = id;
    upsertCatalog(program);
    return { id, program };
  })
  .sort((a, b) => a.program.name.localeCompare(b.program.name));
