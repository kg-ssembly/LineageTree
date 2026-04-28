import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { ThemePreference } from '../constants/theme';

const STORAGE_KEY = 'lineagetree-theme-preference';

interface ThemeState {
  preference: ThemePreference;
  hydrated: boolean;
  setPreference: (preference: ThemePreference) => Promise<void>;
  hydrate: () => Promise<void>;
}

let hydrationPromise: Promise<void> | null = null;

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: 'system',
  hydrated: false,
  setPreference: async (preference) => {
    set({ preference });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Ignore storage write failures so theme switching still works in-memory.
    }
  },
  hydrate: async () => {
    if (get().hydrated) {
      return;
    }

    if (!hydrationPromise) {
      hydrationPromise = (async () => {
        try {
          const storedPreference = await AsyncStorage.getItem(STORAGE_KEY);
          if (isThemePreference(storedPreference)) {
            set({ preference: storedPreference });
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
