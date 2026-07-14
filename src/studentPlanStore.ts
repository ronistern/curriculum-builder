import { useMemo, useState } from 'react';
import type { Program } from './types';
import {
  pickOpenPlan,
  pickSavePlan,
  writeHandleText,
} from './fileStore';
import {
  newStudentPlan,
  parseStudentPlan,
  serializeStudentPlan,
  type StudentPlan,
} from './studentPlan';
import { getCatalog, upsertCatalog } from './catalogLibrary';
import { slugify, triggerDownload } from './util';
import { useFileBackedDoc } from './useFileBackedDoc';

/**
 * Working-copy cache for the active student plan. Mirrors the approach in
 * `storage.ts`: the source of truth is the `.plan.json` file, but we keep a copy
 * in localStorage so a refresh mid-advising never loses unsaved work. A null
 * value means no plan is open (the app is in curriculum, not advise, mode).
 */
const CACHE_KEY = 'curriculum-builder:student-plan';

function loadCache(): StudentPlan | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return parseStudentPlan(raw);
  } catch {
    // ignore corrupt cache
  }
  return null;
}

function saveCache(plan: StudentPlan | null): void {
  try {
    if (plan) localStorage.setItem(CACHE_KEY, serializeStudentPlan(plan));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    // storage may be full or unavailable; non-fatal
  }
}

/** A filesystem-safe default name for a plan file. */
function suggestedName(plan: StudentPlan): string {
  const parts = [plan.student.name, plan.catalogName]
    .map((s) => slugify(s, ''))
    .filter(Boolean);
  return `${parts.join('-') || 'student'}.plan.json`;
}

export interface StudentPlanStore {
  plan: StudentPlan | null;
  setPlan: (updater: StudentPlan | ((prev: StudentPlan) => StudentPlan)) => void;
  /** The catalog the active plan references, resolved from the library. Null
   * when no plan is open or the referenced catalog can't be found. */
  catalog: Program | null;
  /** Supply the referenced catalog (e.g. after opening its file) so it resolves. */
  provideCatalog: (catalog: Program) => void;
  fileName: string | null;
  dirty: boolean;
  canUseFiles: boolean;
  /** Revert the last edit to the plan. */
  undo: () => void;
  /** Re-apply the last undone edit to the plan. */
  redo: () => void;
  /** Whether there is an edit to undo. */
  canUndo: boolean;
  /** Whether there is an undone edit to redo. */
  canRedo: boolean;
  /** Begin a fresh plan against a catalog (enters advise mode). */
  start: (catalog: Program) => void;
  /** Open an existing `.plan.json`. */
  open: () => Promise<void>;
  /** Read a plan from an uploaded file (fallback path). */
  importFile: (file: File) => Promise<void>;
  save: () => Promise<void>;
  saveAs: () => Promise<void>;
  /** Download the plan as a file (fallback path). */
  download: () => void;
  /** Discard the active plan and leave advise mode. */
  close: () => void;
}

export function useStudentPlan(): StudentPlanStore {
  const store = useFileBackedDoc<StudentPlan | null>({
    load: loadCache,
    persist: saveCache,
    pickOpen: async () => {
      const result = await pickOpenPlan();
      return result && {
        handle: result.handle,
        value: parseStudentPlan(result.text),
      };
    },
    pickSave: (plan) =>
      plan
        ? pickSavePlan(suggestedName(plan), serializeStudentPlan(plan))
        : Promise.resolve(null),
    write: (handle, plan) =>
      plan ? writeHandleText(handle, serializeStudentPlan(plan)) : Promise.resolve(),
  });

  // Resolve the referenced catalog: an explicitly-provided one (opened from a
  // file for a plan whose catalog isn't in the library) takes precedence,
  // otherwise look it up in the library by the plan's `catalogId`.
  const plan = store.doc;
  const [provided, setProvided] = useState<Program | null>(null);
  const catalog = useMemo(() => {
    if (!plan) return null;
    if (provided && provided.id === plan.catalogId) return provided;
    return getCatalog(plan.catalogId);
    // Only the referenced id (not every plan edit) should re-resolve the catalog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.catalogId, provided]);

  const provideCatalog = (c: Program) => {
    upsertCatalog(c);
    setProvided(c);
  };

  return {
    plan: store.doc,
    catalog,
    provideCatalog,
    // The generic hook types updates over `StudentPlan | null`, but the public
    // API only ever mutates an existing plan (advise mode); the null-guard in
    // the hook makes a no-op if somehow called with no plan.
    setPlan: store.setDoc as StudentPlanStore['setPlan'],
    fileName: store.fileName,
    dirty: store.dirty,
    canUseFiles: store.canUseFiles,
    undo: store.undo,
    redo: store.redo,
    canUndo: store.canUndo,
    canRedo: store.canRedo,
    start: (catalog) => {
      upsertCatalog(catalog);
      setProvided(catalog);
      store.replace(newStudentPlan(catalog), { dirty: true });
    },
    open: store.open,
    importFile: async (file) =>
      store.replace(parseStudentPlan(await file.text()), {
        dirty: false,
        fileName: file.name,
      }),
    save: store.save,
    saveAs: store.saveAs,
    download: () => {
      if (store.doc) {
        triggerDownload(
          new Blob([serializeStudentPlan(store.doc)], { type: 'application/json' }),
          suggestedName(store.doc),
        );
      }
    },
    close: () => store.replace(null, { dirty: false }),
  };
}
