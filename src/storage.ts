import { useEffect, useState } from 'react';
import type { Program } from './types';
import { sampleProgram } from './sampleData';

const STORAGE_KEY = 'curriculum-builder:program';

export function loadProgram(): Program {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Program;
  } catch {
    // ignore corrupt data and fall back to the sample
  }
  return sampleProgram;
}

export function useProgram() {
  const [program, setProgram] = useState<Program>(loadProgram);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(program));
    } catch {
      // storage may be full or unavailable; non-fatal
    }
  }, [program]);

  return [program, setProgram] as const;
}

export function exportProgram(program: Program) {
  const blob = new Blob([JSON.stringify(program, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = program.name.replace(/[^\w-]+/g, '_').toLowerCase();
  a.href = url;
  a.download = `${safeName || 'curriculum'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importProgram(file: File): Promise<Program> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Program;
        if (!parsed.courses || !Array.isArray(parsed.courses)) {
          throw new Error('File does not look like a curriculum.');
        }
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
