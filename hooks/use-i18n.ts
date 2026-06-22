import { useMemo } from 'react';
import { LANGUAGE_OPTIONS, translate, type AppLanguage } from '../i18n';
import { useLanguageStore } from '../stores/language-store';

export function useI18n() {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  const api = useMemo(() => ({
    language,
    setLanguage,
    languages: LANGUAGE_OPTIONS,
    t: (message: string, params?: Record<string, string | number | null | undefined>) => translate(message, params),
  }), [language, setLanguage]);

  return api as {
    language: AppLanguage;
    setLanguage: (language: AppLanguage) => Promise<void>;
    languages: typeof LANGUAGE_OPTIONS;
    t: (message: string, params?: Record<string, string | number | null | undefined>) => string;
  };
}
