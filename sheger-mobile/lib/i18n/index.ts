import { getLocales } from "expo-localization";

import { am } from "./locales/am";
import { en } from "./locales/en";

export type AppLocale = "en" | "am";

export const LOCALES: AppLocale[] = ["en", "am"];

const catalogs = { en, am } as const;

type TranslationParams = Record<string, string | number>;

function resolvePath(tree: Record<string, unknown>, key: string): string | undefined {
  const value = key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, tree);

  return typeof value === "string" ? value : undefined;
}

export function translate(
  locale: AppLocale,
  key: string,
  params?: TranslationParams,
): string {
  const template =
    resolvePath(catalogs[locale] as unknown as Record<string, unknown>, key) ??
    resolvePath(catalogs.en as unknown as Record<string, unknown>, key) ??
    key;

  if (!params) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) => {
    const value = params[token];
    return value == null ? "" : String(value);
  });
}

export function detectDeviceLocale(): AppLocale {
  try {
    const code = getLocales()[0]?.languageCode?.toLowerCase();
    if (code === "am" || code?.startsWith("am")) return "am";
  } catch {
    // ignore
  }
  return "en";
}

export function getTimeGreetingKey(): "home.goodMorning" | "home.goodAfternoon" | "home.goodEvening" {
  const hour = new Date().getHours();
  if (hour < 12) return "home.goodMorning";
  if (hour < 17) return "home.goodAfternoon";
  return "home.goodEvening";
}
