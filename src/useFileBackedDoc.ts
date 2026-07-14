import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  ensurePermission,
  fileAccessSupported,
  type FileHandleLike,
} from './fileStore';
import type { Updater } from './util';

/**
 * Undo/redo history for the document. `present` is the live value; `past` and
 * `future` are the states you step back and forward through. Wholesale document
 * swaps (open / import / new / close) clear both stacks — undo never crosses a
 * document boundary.
 */
interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

type HistoryAction<T> =
  | { type: 'set'; updater: Updater<T> }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; value: T };

/** Cap the undo depth so a long editing session can't grow memory unbounded. */
const HISTORY_LIMIT = 100;

function historyReducer<T>(state: History<T>, action: HistoryAction<T>): History<T> {
  switch (action.type) {
    case 'set': {
      const next =
        typeof action.updater === 'function'
          ? state.present == null
            ? state.present
            : (action.updater as (p: T) => T)(state.present)
          : action.updater;
      if (Object.is(next, state.present)) return state;
      const past = [...state.past, state.present];
      return {
        past: past.length > HISTORY_LIMIT ? past.slice(-HISTORY_LIMIT) : past,
        present: next,
        future: [],
      };
    }
    case 'undo': {
      if (state.past.length === 0) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
      };
    }
    case 'redo': {
      if (state.future.length === 0) return state;
      const [present, ...future] = state.future;
      return { past: [...state.past, state.present], present, future };
    }
    case 'reset':
      return { past: [], present: action.value, future: [] };
  }
}

/**
 * The behaviours that distinguish one file-backed document from another. Every
 * function is pure with respect to its arguments (it never closes over the live
 * document), so the hook can capture the config once and keep stable callbacks.
 */
export interface FileBackedConfig<T> {
  /** Initial value, typically read from the working-copy cache. */
  load: () => T;
  /** Mirror the current value to the working-copy cache on every change. */
  persist: (value: T) => void;
  /** Prompt to open a file, returning its handle and parsed value (null = cancelled). */
  pickOpen: () => Promise<{ handle: FileHandleLike; value: T } | null>;
  /** Prompt for a save location and write `value`, returning the new handle (null = cancelled). */
  pickSave: (value: T) => Promise<FileHandleLike | null>;
  /** Write `value` to an already-bound handle. */
  write: (handle: FileHandleLike, value: T) => Promise<void>;
  /** Optional: reconnect to a remembered handle on mount (restores name + binding). */
  recall?: () => Promise<FileHandleLike | null>;
  /** Optional: called whenever the bound handle changes (e.g. to persist it). */
  onBind?: (handle: FileHandleLike | null) => void;
}

export interface FileBackedDoc<T> {
  doc: T;
  setDoc: (updater: Updater<T>) => void;
  fileName: string | null;
  dirty: boolean;
  canUseFiles: boolean;
  /** Step back to the document state before the last edit. No-op when empty. */
  undo: () => void;
  /** Re-apply the last undone edit. No-op when there is nothing to redo. */
  redo: () => void;
  /** Whether there is a prior state to undo to. */
  canUndo: boolean;
  /** Whether there is an undone state to redo. */
  canRedo: boolean;
  open: () => Promise<void>;
  save: () => Promise<void>;
  saveAs: () => Promise<void>;
  /**
   * Replace the document wholesale (new / import / close), detaching any bound
   * file. `dirty` says whether the result counts as unsaved; `fileName` labels
   * it (e.g. an uploaded file's name), defaulting to untitled.
   */
  replace: (value: T, opts: { dirty: boolean; fileName?: string | null }) => void;
}

/**
 * The shared "document backed by a file, mirrored to a cache" state machine used
 * by both {@link useProgram} and {@link useStudentPlan}. It owns the value plus
 * the `handle` / `fileName` / `dirty` trio and the open/save/saveAs flow; the
 * two stores supply the specifics (cache keys, parsers, pickers) via `config`.
 */
export function useFileBackedDoc<T>(config: FileBackedConfig<T>): FileBackedDoc<T> {
  // Config methods are stable by contract; capture in a ref so callbacks stay
  // identity-stable while always seeing the latest closures. The ref is synced
  // in an effect (not during render) and read only from handlers/effects, which
  // run after commit, so they always observe the latest config.
  const cfg = useRef(config);
  useEffect(() => {
    cfg.current = config;
  });

  const [history, dispatch] = useReducer(
    historyReducer<T>,
    config.load,
    (load) => ({ past: [], present: load(), future: [] }),
  );
  const doc = history.present;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const [handle, setHandle] = useState<FileHandleLike | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const canUseFiles = fileAccessSupported();

  // Reconnect to the last-opened file so "Save" can target it again. The data
  // shown still comes from the cache; this only restores the binding + name.
  useEffect(() => {
    if (!cfg.current.recall) return;
    let cancelled = false;
    cfg.current
      .recall()
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
    cfg.current.persist(doc);
  }, [doc]);

  const setDoc = useCallback((updater: Updater<T>) => {
    dispatch({ type: 'set', updater });
    setDirty(true);
  }, []);

  const undo = useCallback(() => {
    if (!canUndo) return;
    dispatch({ type: 'undo' });
    setDirty(true);
  }, [canUndo]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    dispatch({ type: 'redo' });
    setDirty(true);
  }, [canRedo]);

  const bind = useCallback((h: FileHandleLike) => {
    setHandle(h);
    setFileName(h.name);
    setDirty(false);
    cfg.current.onBind?.(h);
  }, []);

  const saveAs = useCallback(async () => {
    if (doc == null) return;
    const h = await cfg.current.pickSave(doc);
    if (h) bind(h);
  }, [doc, bind]);

  const save = useCallback(async () => {
    if (doc == null) return;
    if (!handle || !(await ensurePermission(handle))) {
      await saveAs();
      return;
    }
    await cfg.current.write(handle, doc);
    setDirty(false);
  }, [handle, doc, saveAs]);

  const open = useCallback(async () => {
    const result = await cfg.current.pickOpen();
    if (!result) return;
    dispatch({ type: 'reset', value: result.value });
    bind(result.handle);
  }, [bind]);

  const replace = useCallback(
    (value: T, opts: { dirty: boolean; fileName?: string | null }) => {
      dispatch({ type: 'reset', value });
      setHandle(null);
      setFileName(opts.fileName ?? null);
      setDirty(opts.dirty);
      cfg.current.onBind?.(null);
    },
    [],
  );

  return {
    doc,
    setDoc,
    fileName,
    dirty,
    canUseFiles,
    undo,
    redo,
    canUndo,
    canRedo,
    open,
    save,
    saveAs,
    replace,
  };
}
