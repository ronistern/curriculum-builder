import type { Program } from './types';
import { serializeJson, slugify, triggerDownload } from './util';

/**
 * Low-level persistence primitives for curriculum files. No React here — these
 * are plain async functions used by the `useProgram` store in `storage.ts`.
 *
 * Source of truth is a `.json` file on disk, accessed via the File System
 * Access API where available. Browsers without it (Firefox, Safari) fall back
 * to download/upload through {@link downloadProgram} / {@link readProgramFile}.
 */

/* ----------------------------------------------------------------------------
 * Minimal File System Access API types.
 *
 * These are intentionally declared locally (rather than relying on lib.dom)
 * because the API is still non-standard and its typings vary across TS
 * versions. We only model the surface we actually use.
 * ------------------------------------------------------------------------- */

type PermissionMode = { mode?: 'read' | 'readwrite' };

interface WritableLike {
  write: (data: string) => Promise<void>;
  close: () => Promise<void>;
}

/** A handle to a single file on the user's disk. */
export interface FileHandleLike {
  readonly name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<WritableLike>;
  queryPermission?: (descriptor?: PermissionMode) => Promise<PermissionState>;
  requestPermission?: (descriptor?: PermissionMode) => Promise<PermissionState>;
}

interface FilePickerAccept {
  description?: string;
  accept: Record<string, string[]>;
}

interface FsPickerWindow {
  showOpenFilePicker?: (opts?: {
    multiple?: boolean;
    types?: FilePickerAccept[];
  }) => Promise<FileHandleLike[]>;
  showSaveFilePicker?: (opts?: {
    suggestedName?: string;
    types?: FilePickerAccept[];
  }) => Promise<FileHandleLike>;
}

const JSON_TYPE: FilePickerAccept = {
  description: 'Curriculum',
  accept: { 'application/json': ['.json'] },
};

const PLAN_TYPE: FilePickerAccept = {
  description: 'Student plan',
  accept: { 'application/json': ['.plan.json', '.json'] },
};

/** Whether the browser supports reading/writing files in place. */
export function fileAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

/**
 * Backfill fields added after the initial format so older files load cleanly.
 * Mutates and returns `program`. Shared by {@link parseProgram} and the student
 * plan parser (which embeds a program snapshot).
 */
export function normalizeProgram(program: Program): Program {
  // `bundles` was added later; older files omit it.
  if (!Array.isArray(program.bundles)) program.bundles = [];
  // `electiveGroups` was added later still.
  if (!Array.isArray(program.electiveGroups)) program.electiveGroups = [];
  return program;
}

/** Parse and validate a curriculum from raw JSON text. Throws on bad input. */
export function parseProgram(text: string): Program {
  const parsed = JSON.parse(text) as Program;
  if (!parsed || !Array.isArray(parsed.courses)) {
    throw new Error('File does not look like a curriculum.');
  }
  return normalizeProgram(parsed);
}

/** A filesystem-safe default file name derived from the program name. */
export function suggestedFileName(program: Program): string {
  return `${slugify(program.name, 'curriculum')}.json`;
}

function serialize(program: Program): string {
  return serializeJson(program);
}

/* ----------------------------------------------------------------------------
 * File System Access API operations
 * ------------------------------------------------------------------------- */

/** Read the raw text behind a handle. */
export async function readHandleText(handle: FileHandleLike): Promise<string> {
  const file = await handle.getFile();
  return file.text();
}

/** Write raw text to an existing handle. */
export async function writeHandleText(
  handle: FileHandleLike,
  text: string,
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

/** Read and parse the curriculum behind a handle. */
export async function readHandle(handle: FileHandleLike): Promise<Program> {
  return parseProgram(await readHandleText(handle));
}

/** Write a curriculum to an existing handle. */
export async function writeHandle(
  handle: FileHandleLike,
  program: Program,
): Promise<void> {
  await writeHandleText(handle, serialize(program));
}

/**
 * Ensure we still hold read/write permission for a previously-stored handle.
 * Must be called from a user gesture for the prompt to appear. Returns false
 * if permission is denied; true when the API doesn't expose permission checks.
 */
export async function ensurePermission(
  handle: FileHandleLike,
  mode: 'read' | 'readwrite' = 'readwrite',
): Promise<boolean> {
  if (!handle.queryPermission || !handle.requestPermission) return true;
  if ((await handle.queryPermission({ mode })) === 'granted') return true;
  return (await handle.requestPermission({ mode })) === 'granted';
}

/**
 * Show the native open-file picker, returning the first chosen handle, or null
 * if the API is unavailable or the user dismisses it. Centralizes the
 * non-standard window cast and cancellation handling.
 */
async function showOpenPicker(
  type: FilePickerAccept,
): Promise<FileHandleLike | null> {
  const w = window as unknown as FsPickerWindow;
  if (!w.showOpenFilePicker) return null;
  try {
    const [handle] = await w.showOpenFilePicker({ multiple: false, types: [type] });
    return handle ?? null;
  } catch {
    return null; // user dismissed the picker
  }
}

/**
 * Show the native save-file picker, returning the chosen handle, or null if the
 * API is unavailable or the user dismisses it.
 */
async function showSavePicker(
  suggestedName: string,
  type: FilePickerAccept,
): Promise<FileHandleLike | null> {
  const w = window as unknown as FsPickerWindow;
  if (!w.showSaveFilePicker) return null;
  try {
    return await w.showSaveFilePicker({ suggestedName, types: [type] });
  } catch {
    return null; // user dismissed the picker
  }
}

/**
 * Prompt the user to open a curriculum file. Returns null if they cancel.
 * Throws if the chosen file is not a valid curriculum.
 */
export async function pickOpen(): Promise<{
  handle: FileHandleLike;
  program: Program;
} | null> {
  const handle = await showOpenPicker(JSON_TYPE);
  if (!handle) return null;
  return { handle, program: await readHandle(handle) };
}

/**
 * Prompt the user for a save location, write the program there, and return the
 * new handle. Returns null if they cancel.
 */
export async function pickSave(
  program: Program,
): Promise<FileHandleLike | null> {
  const handle = await showSavePicker(suggestedFileName(program), JSON_TYPE);
  if (!handle) return null;
  await writeHandle(handle, program);
  return handle;
}

/**
 * Prompt the user to open a student-plan file. Returns the handle and its raw
 * text (caller parses), or null if they cancel.
 */
export async function pickOpenPlan(): Promise<{
  handle: FileHandleLike;
  text: string;
} | null> {
  const handle = await showOpenPicker(PLAN_TYPE);
  if (!handle) return null;
  return { handle, text: await readHandleText(handle) };
}

/**
 * Prompt for a save location for a student plan, write `text` there, and return
 * the new handle. Returns null if the user cancels.
 */
export async function pickSavePlan(
  suggestedName: string,
  text: string,
): Promise<FileHandleLike | null> {
  const handle = await showSavePicker(suggestedName, PLAN_TYPE);
  if (!handle) return null;
  await writeHandleText(handle, text);
  return handle;
}

/** Download raw text as a file (fallback for browsers without File System Access). */
export function downloadText(text: string, fileName: string): void {
  triggerDownload(new Blob([text], { type: 'application/json' }), fileName);
}

/* ----------------------------------------------------------------------------
 * Download / upload fallback (browsers without File System Access)
 * ------------------------------------------------------------------------- */

/** Download the program as a `.json` file. */
export function downloadProgram(program: Program): void {
  downloadText(serialize(program), suggestedFileName(program));
}

/** Read and parse a curriculum from an uploaded File. */
export function readProgramFile(file: File): Promise<Program> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(parseProgram(String(reader.result)));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/* ----------------------------------------------------------------------------
 * Remembering the active file handle across reloads (IndexedDB)
 *
 * File handles are structured-cloneable, so we persist the one currently open.
 * On the next visit, "Save" can target the same file again (re-prompting for
 * permission via the user's click). The actual curriculum data is cached
 * separately in localStorage, so nothing is lost even if permission lapses.
 * ------------------------------------------------------------------------- */

const DB_NAME = 'curriculum-builder';
const STORE = 'handles';
const HANDLE_KEY = 'active-file';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function rememberHandle(
  handle: FileHandleLike | null,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    if (handle) store.put(handle, HANDLE_KEY);
    else store.delete(HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function recallHandle(): Promise<FileHandleLike | null> {
  const db = await openDb();
  const handle = await new Promise<FileHandleLike | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(HANDLE_KEY);
    req.onsuccess = () => resolve((req.result as FileHandleLike) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return handle;
}
