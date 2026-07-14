import type { Program } from './types';
import { normalizeProgram } from './fileStore';
import { serializeJson } from './util';

/**
 * A local registry of course catalogs (programs) keyed by {@link Program.id}.
 *
 * The app has no backend, so the "live shared catalog" a student plan references
 * lives here, in localStorage. Every program the user opens, edits, or saves is
 * upserted (see `useProgram` in `storage.ts` and `defaultPrograms.ts`); a plan
 * resolves its `catalogId` against this registry when opened. Because plans hold
 * only a reference — not a frozen copy — edits to a catalog flow through to the
 * plans that reference it.
 */
const KEY = 'curriculum-builder:catalogs';

type Library = Record<string, Program>;

function readLibrary(): Library {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Library;
  } catch {
    // ignore corrupt registry
  }
  return {};
}

function writeLibrary(lib: Library): void {
  try {
    localStorage.setItem(KEY, serializeJson(lib));
  } catch {
    // storage may be full or unavailable; non-fatal
  }
}

/** Store (or replace) a catalog under its id. No-op for an id-less program. */
export function upsertCatalog(program: Program): void {
  if (!program.id) return;
  const lib = readLibrary();
  lib[program.id] = program;
  writeLibrary(lib);
}

/** Resolve a catalog by id, or null if it isn't in the registry. */
export function getCatalog(id: string): Program | null {
  const program = readLibrary()[id];
  return program ? normalizeProgram(program) : null;
}

/** Every catalog currently known to the registry. */
export function allCatalogs(): Program[] {
  return Object.values(readLibrary()).map(normalizeProgram);
}
