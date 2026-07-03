import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { setActiveLanguage, type AppLanguage } from '../i18n';

const STORAGE_KEY = 'lineagetree-language-preference';

type LanguageState = {
  language: AppLanguage;
  hydrated: boolean;
  setLanguage: (language: AppLanguage) => Promise<void>;
  hydrate: () => Promise<void>;
};

let hydrationPromise: Promise<void> | null = null;

function isAppLanguage(value: string | null): value is AppLanguage {
  return value === 'en'
    || value === 'af'
    || value === 'zu'
    || value === 'xh'
    || value === 'nso'
    || value === 'st'
    || value === 'tn'
    || value === 'ts'
    || value === 'ss'
    || value === 've'
    || value === 'nr'
    || value === 'it'
    || value === 'es'
    || value === 'fr'
    || value === 'de'
    || value === 'pt';
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  language: 'en',
  hydrated: false,
  setLanguage: async (language) => {
    setActiveLanguage(language);
    set({ language });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Ignore storage failures so switching still works in-memory.
    }
  },
  hydrate: async () => {
    if (get().hydrated) {
      return;
    }

    if (!hydrationPromise) {
      hydrationPromise = (async () => {
        try {
          const storedLanguage = await AsyncStorage.getItem(STORAGE_KEY);
          if (isAppLanguage(storedLanguage)) {
            setActiveLanguage(storedLanguage);
            set({ language: storedLanguage });
          } else {
            setActiveLanguage('en');
          }
        } finally {
          set({ hydrated: true });
          hydrationPromise = null;
        }
      })();
    }

    await hydrationPromise;
  },
}));
