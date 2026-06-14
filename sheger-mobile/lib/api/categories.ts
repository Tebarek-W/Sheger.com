import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/env";
import { appFetch } from "@/lib/network-fetch";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/lib/types/database";

type CategoryRow = Pick<Category, "id" | "name" | "slug">;

function isMissingActiveColumn(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST204" ||
    (error.message?.includes("is_active") ?? false)
  );
}

async function fetchCategoriesViaClient(): Promise<CategoryRow[]> {
  const activeQuery = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("sort_order");

  if (!activeQuery.error) {
    return activeQuery.data ?? [];
  }

  if (!isMissingActiveColumn(activeQuery.error)) {
    throw activeQuery.error;
  }

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("sort_order");

  if (error) throw error;
  return data ?? [];
}

async function fetchCategoriesViaRest(): Promise<CategoryRow[]> {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();

  if (!url || !key) {
    throw new Error("Supabase env vars are missing in .env");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await appFetch(
      `${url}/rest/v1/categories?select=id,name,slug&is_active=eq.true&order=sort_order.asc`,
      {
        signal: controller.signal,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
      },
    );

    if (response.ok) {
      return (await response.json()) as CategoryRow[];
    }

    const body = await response.text();
    if (response.status === 400 && body.includes("is_active")) {
      const fallback = await appFetch(
        `${url}/rest/v1/categories?select=id,name,slug&order=sort_order.asc`,
        {
          signal: controller.signal,
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            Accept: "application/json",
          },
        },
      );
      if (!fallback.ok) {
        throw new Error(`Supabase HTTP ${fallback.status}: ${await fallback.text()}`);
      }
      return (await fallback.json()) as CategoryRow[];
    }

    throw new Error(`Supabase HTTP ${response.status}: ${body}`);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Supabase request timed out after 15 seconds");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchCategories(): Promise<CategoryRow[]> {
  try {
    return await fetchCategoriesViaClient();
  } catch (clientError) {
    try {
      return await fetchCategoriesViaRest();
    } catch (restError) {
      const clientMessage =
        clientError instanceof Error
          ? clientError.message
          : String(clientError);
      const restMessage =
        restError instanceof Error ? restError.message : String(restError);

      throw new Error(
        `Client: ${clientMessage} | REST: ${restMessage}`,
      );
    }
  }
}
