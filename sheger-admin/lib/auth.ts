import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";

export async function getSessionProfile(): Promise<{
  profile: Profile | null;
  isAdmin: boolean;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { profile: null, isAdmin: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return {
    profile: profile as Profile | null,
    isAdmin: profile?.role === "admin",
  };
}
