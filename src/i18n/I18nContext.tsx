import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  DEFAULT_LANG,
  LANGUAGES,
  translations,
  type Dict,
  type Lang,
} from './translations';
import { I18nContext, type I18nValue, type TKey, type TParams } from './useI18n';

const STORAGE_KEY = 'curriculum-builder:lang';

function resolve(dict: Dict, key: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = dict;
  for (const part of key.split('.')) {
    node = node?.[part];
    if (node == null) break;
  }
  return typeof node === 'string' ? node : key;
}

function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    name in params ? String(params[name]) : whole,
  );
}

function loadLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (stored && stored in translations) return stored;
  } catch {
    // ignore and use the default
  }
  return DEFAULT_LANG;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(loadLang);

  const dir = useMemo(
    () => LANGUAGES.find((l) => l.code === lang)?.dir ?? 'ltr',
    [lang],
  );

  // Reflect the active language on <html> for RTL layout and accessibility.
  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = dir;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // non-fatal if storage is unavailable
    }
  }, [lang, dir]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);

  const t = useCallback(
    (key: TKey, params?: TParams) =>
      interpolate(resolve(translations[lang], key), params),
    [lang],
  );

  const value = useMemo<I18nValue>(
    () => ({ lang, dir, setLang, t }),
    [lang, dir, setLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
