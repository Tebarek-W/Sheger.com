import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/env";
import { appFetch } from "@/lib/network-fetch";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/lib/types/database";

type CategoryRow = Pick<Category, "id" | "name" | "slug">;

async function fetchCategoriesViaClient(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("sort_order");

  if (error) {
    throw error;
  }

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

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Supabase HTTP ${response.status}: ${body}`);
    }

    return (await response.json()) as CategoryRow[];
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
