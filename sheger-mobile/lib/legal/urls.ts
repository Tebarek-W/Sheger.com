import Constants from "expo-constants";

import type { LegalDocId } from "@/lib/legal/documents";

type LegalExtra = {
  legalBaseUrl?: string;
};

function trim(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v || undefined;
}

/**
 * Public base URL of the hosted legal pages (sheger-admin), e.g.
 * https://admin.sheger.com — no trailing slash.
 */
export function getLegalBaseUrl(): string | null {
  const extra = Constants.expoConfig?.extra as LegalExtra | undefined;
  const base =
    trim(process.env.EXPO_PUBLIC_LEGAL_BASE_URL) ?? trim(extra?.legalBaseUrl);
  if (!base) return null;
  return base.replace(/\/+$/, "");
}

export function getLegalDocUrl(doc: LegalDocId): string | null {
  const base = getLegalBaseUrl();
  if (!base) return null;
  return `${base}/legal/${doc}`;
}

/** Privacy Policy URL for store listings (also /privacy alias on admin). */
export function getPrivacyPolicyUrl(): string | null {
  const base = getLegalBaseUrl();
  if (!base) return null;
  return `${base}/privacy`;
}
