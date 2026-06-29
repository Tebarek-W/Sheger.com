import { getSupabaseUrl } from "@/lib/env";

export function getChapaReturnUrlPrefix(): string {
  const base = getSupabaseUrl();
  if (!base) {
    throw new Error("Supabase URL is not configured");
  }
  return `${base.replace(/\/$/, "")}/functions/v1/chapa-return`;
}
