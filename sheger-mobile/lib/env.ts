import Constants from "expo-constants";

function trimEnv(value: string | undefined): string | undefined {
  let trimmed = value?.trim();
  if (!trimmed) return undefined;

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  return trimmed || undefined;
}

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  return (
    value.includes("your-project") ||
    value.includes("your-anon") ||
    value === "sb_publishable_..." ||
    value.startsWith("eyJ...")
  );
}

type SupabaseExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const extra = Constants.expoConfig?.extra as SupabaseExtra | undefined;

function pickEnv(
  inlined: string | undefined,
  fromExtra: string | undefined,
): string | undefined {
  const inlinedValue = trimEnv(inlined);
  const extraValue = trimEnv(fromExtra);

  if (inlinedValue && !isPlaceholder(inlinedValue)) {
    return inlinedValue;
  }

  if (extraValue && !isPlaceholder(extraValue)) {
    return extraValue;
  }

  return inlinedValue ?? extraValue;
}

/** Prefer Metro-inlined process.env over app.config extra (avoids stale placeholders). */
export function getSupabaseUrl(): string | undefined {
  return pickEnv(process.env.EXPO_PUBLIC_SUPABASE_URL, extra?.supabaseUrl);
}

export function getSupabasePublishableKey(): string | undefined {
  return pickEnv(
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    extra?.supabaseAnonKey,
  );
}

export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  return Boolean(url && key && !isPlaceholder(url) && !isPlaceholder(key));
}
