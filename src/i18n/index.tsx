import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { en, es, type MessageKey } from './messages';

export type Lang = 'es' | 'en';

const dictionaries: Record<Lang, Record<MessageKey, string>> = { es, en };

export type TFunction = (key: MessageKey, params?: Record<string, string | number>) => string;

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFunction;
  locale: string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  // Idioma por defecto fijo (español): los buscadores renderizan con navigator.language = en-US y
  // deben ver lo mismo que el HTML estático. La elección manual ES/EN se recuerda.
  const [lang, setLang] = usePersistentState<Lang>('lang', 'es', (raw) =>
    raw === 'en' ? 'en' : 'es',
  );

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback<TFunction>(
    (key, params) => {
      let text = dictionaries[lang][key] ?? dictionaries.es[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) text = text.split(`{${k}}`).join(String(v));
      }
      return text;
    },
    [lang],
  );

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t, locale: lang === 'en' ? 'en-GB' : 'es-ES' }),
    [lang, setLang, t],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n debe usarse dentro de <I18nProvider>');
  return ctx;
}
