import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { type AppLocale, detectDeviceLocale } from "@/lib/i18n";

const STORAGE_KEY = "sheger:locale";

type LocaleState = {
  locale: AppLocale;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLocale: (locale: AppLocale) => Promise<void>;
};

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: "en",
  hydrated: false,
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "am") {
        set({ locale: stored, hydrated: true });
        return;
      }
      set({ locale: detectDeviceLocale(), hydrated: true });
    } catch {
      set({ locale: detectDeviceLocale(), hydrated: true });
    }
  },
  setLocale: async (locale) => {
    await AsyncStorage.setItem(STORAGE_KEY, locale);
    set({ locale });
  },
}));
