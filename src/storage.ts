import type { Program } from './types';
import { sampleProgram } from './sampleData';
import {
  parseProgram,
  pickOpen,
  pickSave,
  recallHandle,
  rememberHandle,
  writeHandle,
} from './fileStore';
import { serializeJson } from './util';
import { upsertCatalog } from './catalogLibrary';
import { useFileBackedDoc } from './useFileBackedDoc';

/**
 * Working-copy cache. The source of truth is the file on disk, but we mirror
 * the in-memory program to localStorage on every change so a refresh — or a
 * lapsed file permission — never loses unsaved edits. This key is also where
 * the previous single-program build stored its data, so existing users' work
 * is picked up automatically as the initial working copy.
 */
const CACHE_KEY = 'curriculum-builder:program';

function loadCache(): Program {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return parseProgram(raw);
  } catch {
    // ignore corrupt cache and fall back to the sample
  }
  return sampleProgram;
}

function saveCache(program: Program): void {
  try {
    localStorage.setItem(CACHE_KEY, serializeJson(program));
    // Keep the catalog library in sync so student plans referencing this
    // program resolve against its latest version.
    upsertCatalog(program);
  } catch {
    // storage may be full or unavailable; non-fatal
  }
}

export interface ProgramStore {
  program: Program;
  /** Apply an edit to the current curriculum and mark it as unsaved. */
  setProgram: (updater: Program | ((prev: Program) => Program)) => void;
  /** Name of the file the curriculum is bound to, or null when untitled. */
  fileName: string | null;
  /** True when there are edits not yet written to the file. */
  dirty: boolean;
  /** Whether this browser can read/write files in place. */
  canUseFiles: boolean;
  /** Open a curriculum file, replacing the current working copy. */
  open: () => Promise<void>;
  /** Write to the bound file, falling back to Save As when there is none. */
  save: () => Promise<void>;
  /** Choose a new file location and write the current curriculum there. */
  saveAs: () => Promise<void>;
  /** Start a fresh, untitled curriculum from the given seed. */
  reset: (seed: Program) => void;
}

export function useProgram(): ProgramStore {
  const store = useFileBackedDoc<Program>({
    load: loadCache,
    persist: saveCache,
    pickOpen: async () => {
      const result = await pickOpen();
      return result && { handle: result.handle, value: result.program };
    },
    pickSave,
    write: writeHandle,
    recall: recallHandle,
    onBind: (handle) => {
      rememberHandle(handle).catch(() => {});
    },
  });

  return {
    program: store.doc,
    setProgram: store.setDoc,
    fileName: store.fileName,
    dirty: store.dirty,
    canUseFiles: store.canUseFiles,
    open: store.open,
    save: store.save,
    saveAs: store.saveAs,
    reset: (seed) => store.replace(seed, { dirty: true }),
  };
}
