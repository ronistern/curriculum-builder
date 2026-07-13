import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ensurePermission,
  fileAccessSupported,
  type FileHandleLike,
} from './fileStore';
import type { Updater } from './util';

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

  const [doc, setDocState] = useState<T>(config.load);
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
    setDocState((prev) =>
      typeof updater === 'function'
        ? prev == null
          ? prev
          : (updater as (p: T) => T)(prev)
        : updater,
    );
    setDirty(true);
  }, []);

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
    setDocState(result.value);
    bind(result.handle);
  }, [bind]);

  const replace = useCallback(
    (value: T, opts: { dirty: boolean; fileName?: string | null }) => {
      setDocState(value);
      setHandle(null);
      setFileName(opts.fileName ?? null);
      setDirty(opts.dirty);
      cfg.current.onBind?.(null);
    },
    [],
  );

  return { doc, setDoc, fileName, dirty, canUseFiles, open, save, saveAs, replace };
}
