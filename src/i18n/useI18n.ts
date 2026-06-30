import { createContext, useContext } from 'react';
import type { Dict, Lang } from './translations';

/** Dot-separated paths into the translation dictionary, e.g. "editor.save". */
type Join<K, P> = K extends string
  ? P extends string
    ? `${K}.${P}`
    : never
  : never;

type Leaves<T> = T extends string
  ? ''
  : {
      [K in keyof T]-?: T[K] extends string
        ? `${K & string}`
        : Join<K & string, Leaves<T[K]>>;
    }[keyof T];

export type TKey = Leaves<Dict>;

export type TParams = Record<string, string | number>;

export interface I18nValue {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  setLang: (lang: Lang) => void;
  t: (key: TKey, params?: TParams) => string;
}

export const I18nContext = createContext<I18nValue | null>(null);

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider');
  return ctx;
}
