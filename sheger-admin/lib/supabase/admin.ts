import { createClient } from "@supabase/supabase-js";

import { getSupabaseSecretKey, getSupabaseUrl } from "@/lib/env";
import type { Database } from "@/lib/types/database";

export function createAdminClient() {
  const secretKey = getSupabaseSecretKey();

  if (!secretKey || secretKey.includes("your_actual_secret_key")) {
    throw new Error(
      "SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is not set. Add it to .env.local for admin operations.",
    );
  }

  return createClient<Database>(
    getSupabaseUrl()!,
    secretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
