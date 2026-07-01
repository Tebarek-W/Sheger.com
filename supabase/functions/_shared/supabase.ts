import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export function adminClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function handleCors(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

export function userClient(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing authorization header");
  }
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
}

export async function requireUser(req: Request) {
  const client = userClient(req);
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Unauthorized");
  return { client, user: data.user };
}

/** PostgREST / Supabase client errors are often plain objects, not Error instances. */
export function formatEdgeError(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof Error) {
    return error.message.trim() || fallback;
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message.trim();
    }
    if (typeof record.error === "string" && record.error.trim()) {
      return record.error.trim();
    }
    if (typeof record.details === "string" && record.details.trim()) {
      return record.details.trim();
    }
    if (record.error && typeof record.error === "object") {
      const nested = formatEdgeError(record.error, "");
      if (nested) return nested;
    }
  }

  return fallback;
}
