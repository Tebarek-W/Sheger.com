import { getSupabaseUrl } from "@/lib/env";

/** HTTPS return URL prefix — Chapa requires https; used with WebBrowser.openAuthSessionAsync. */
export function getChapaHttpsReturnUrlPrefix(): string {
  const base = getSupabaseUrl();
  if (!base) {
    throw new Error("Supabase URL is not configured");
  }
  return `${base.replace(/\/$/, "")}/functions/v1/chapa-return`;
}
