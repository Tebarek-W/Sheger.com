import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/env";
import type { Database } from "@/lib/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    getSupabaseUrl()!,
    getSupabasePublishableKey()!,
  );
}
