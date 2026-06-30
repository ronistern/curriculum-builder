import { useCallback, useEffect, useState } from 'react';
import type { Program } from './types';
import { sampleProgram } from './sampleData';
import {
  ensurePermission,
  fileAccessSupported,
  type FileHandleLike,
  parseProgram,
  pickOpen,
  pickSave,
  recallHandle,
  rememberHandle,
  writeHandle,
} from './fileStore';

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
    localStorage.setItem(CACHE_KEY, JSON.stringify(program));
  } catch {
    // storage may be full or unavailable; non-fatal
  }
}

type Updater = Program | ((prev: Program) => Program);

export interface ProgramStore {
  program: Program;
  /** Apply an edit to the current curriculum and mark it as unsaved. */
  setProgram: (updater: Updater) => void;
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
  const [program, setProgramState] = useState<Program>(loadCache);
  const [handle, setHandle] = useState<FileHandleLike | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const canUseFiles = fileAccessSupported();

  // Reconnect to the last-opened file so "Save" can target it again. The data
  // shown still comes from the cache; this only restores the binding + name.
  useEffect(() => {
    let cancelled = false;
    recallHandle()
      .then((h) => {
        if (!cancelled && h) {
          setHandle(h);
          setFileName(h.name);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Mirror every change to the working-copy cache.
  useEffect(() => {
    saveCache(program);
  }, [program]);

  const setProgram = useCallback((updater: Updater) => {
    setProgramState((prev) =>
      typeof updater === 'function'
        ? (updater as (p: Program) => Program)(prev)
        : updater,
    );
    setDirty(true);
  }, []);

  const bind = useCallback((h: FileHandleLike) => {
    setHandle(h);
    setFileName(h.name);
    setDirty(false);
    rememberHandle(h).catch(() => {});
  }, []);

  const saveAs = useCallback(async () => {
    const h = await pickSave(program);
    if (h) bind(h);
  }, [program, bind]);

  const save = useCallback(async () => {
    if (!handle || !(await ensurePermission(handle))) {
      await saveAs();
      return;
    }
    await writeHandle(handle, program);
    setDirty(false);
  }, [handle, program, saveAs]);

  const open = useCallback(async () => {
    const result = await pickOpen();
    if (!result) return;
    setProgramState(result.program);
    bind(result.handle);
  }, [bind]);

  const reset = useCallback((seed: Program) => {
    setProgramState(seed);
    setHandle(null);
    setFileName(null);
    setDirty(true);
    rememberHandle(null).catch(() => {});
  }, []);

  return {
    program,
    setProgram,
    fileName,
    dirty,
    canUseFiles,
    open,
    save,
    saveAs,
    reset,
  };
}
