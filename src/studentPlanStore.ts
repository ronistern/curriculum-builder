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
  const parts = [plan.student.name, plan.curriculum.name]
    .map((s) => slugify(s, ''))
    .filter(Boolean);
  return `${parts.join('-') || 'student'}.plan.json`;
}

export interface StudentPlanStore {
  plan: StudentPlan | null;
  setPlan: (updater: StudentPlan | ((prev: StudentPlan) => StudentPlan)) => void;
  fileName: string | null;
  dirty: boolean;
  canUseFiles: boolean;
  /** Begin a fresh plan against a curriculum snapshot (enters advise mode). */
  start: (curriculum: Program) => void;
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

  return {
    plan: store.doc,
    // The generic hook types updates over `StudentPlan | null`, but the public
    // API only ever mutates an existing plan (advise mode); the null-guard in
    // the hook makes a no-op if somehow called with no plan.
    setPlan: store.setDoc as StudentPlanStore['setPlan'],
    fileName: store.fileName,
    dirty: store.dirty,
    canUseFiles: store.canUseFiles,
    start: (curriculum) =>
      store.replace(newStudentPlan(curriculum), { dirty: true }),
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
