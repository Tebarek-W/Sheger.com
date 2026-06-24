import { useCallback } from "react";

import { translate, type AppLocale } from "@/lib/i18n";
import { useLocaleStore } from "@/stores/localeStore";

export function useI18n() {
  const locale = useLocaleStore((s) => s.locale);
  const hydrated = useLocaleStore((s) => s.hydrated);
  const setLocale = useLocaleStore((s) => s.setLocale);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale],
  );

  return { t, locale, setLocale, hydrated };
}

export function useLocale(): AppLocale {
  return useLocaleStore((s) => s.locale);
}
