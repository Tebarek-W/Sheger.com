import { readSupabaseFunctionError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

export async function deleteOwnAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
    "delete-account",
    { body: {} },
  );

  if (error || data?.error || !data?.ok) {
    await readSupabaseFunctionError(data, error);
  }
}
