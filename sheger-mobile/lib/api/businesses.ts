import { supabase } from "@/lib/supabase";
import type { Business, Category, Employee, Service } from "@/lib/types/database";

export type BusinessWithDetails = Business & {
  categories: Pick<Category, "name" | "slug"> | null;
  services: Service[];
};

export type MarketplaceCursor = {
  featured_in_search: boolean;
  name: string;
  id: string;
};

export type MarketplaceBusiness = BusinessWithDetails & {
  from_price: number | null;
  rating_average: number | null;
  rating_count: number;
  distance_km: number | null;
};

export type MarketplacePage = {
  rows: MarketplaceBusiness[];
  next_cursor: MarketplaceCursor | null;
  limit: number;
};

export type MarketplaceFilters = {
  limit?: number;
  cursor?: MarketplaceCursor | null;
  categoryId?: string | null;
  query?: string;
  city?: string | null;
  minRating?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  radiusKm?: number | null;
};

type MarketplaceRow = Omit<MarketplaceBusiness, "services"> & {
  categories: Pick<Category, "name" | "slug"> | null;
};

type MarketplaceRpcResult = {
  rows: MarketplaceRow[];
  next_cursor: MarketplaceCursor | null;
  limit: number;
};

function normalizeMarketplaceRow(row: MarketplaceRow): MarketplaceBusiness {
  return {
    ...row,
    from_price: row.from_price != null ? Number(row.from_price) : null,
    rating_average: row.rating_average != null ? Number(row.rating_average) : null,
    rating_count: Number(row.rating_count ?? 0),
    distance_km: row.distance_km != null ? Number(row.distance_km) : null,
    services: [],
  };
}

async function fetchMarketplaceFallback(
  filters: MarketplaceFilters,
): Promise<MarketplacePage> {
  const limit = filters.limit ?? 20;
  let query = supabase
    .from("businesses")
    .select("*, categories(name, slug)")
    .eq("status", "approved")
    .order("featured_in_search", { ascending: false })
    .order("name")
    .limit(limit);

  if (filters.categoryId) {
    query = query.eq("category_id", filters.categoryId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []).map((row) =>
    normalizeMarketplaceRow({
      ...(row as Business),
      categories: (row as Business & { categories: Pick<Category, "name" | "slug"> | null })
        .categories,
      from_price: null,
      rating_average: null,
      rating_count: 0,
      distance_km: null,
    }),
  );

  return { rows, next_cursor: null, limit };
}

export async function fetchMarketplaceBusinessesPage(
  filters: MarketplaceFilters = {},
): Promise<MarketplacePage> {
  const { data, error } = await (
    supabase.rpc as unknown as (
      fn: "list_marketplace_businesses_page",
      args: {
        p_limit?: number;
        p_cursor_featured?: boolean | null;
        p_cursor_name?: string | null;
        p_cursor_id?: string | null;
        p_category_id?: string | null;
        p_query?: string | null;
        p_city?: string | null;
        p_min_rating?: number | null;
        p_price_min?: number | null;
        p_price_max?: number | null;
        p_latitude?: number | null;
        p_longitude?: number | null;
        p_radius_km?: number | null;
      },
    ) => Promise<{ data: MarketplaceRpcResult | null; error: { message?: string } | null }>
  )("list_marketplace_businesses_page", {
    p_limit: filters.limit ?? 20,
    p_cursor_featured: filters.cursor?.featured_in_search ?? null,
    p_cursor_name: filters.cursor?.name ?? null,
    p_cursor_id: filters.cursor?.id ?? null,
    p_category_id: filters.categoryId ?? null,
    p_query: filters.query?.trim() || null,
    p_city: filters.city?.trim() || null,
    p_min_rating: filters.minRating ?? null,
    p_price_min: filters.priceMin ?? null,
    p_price_max: filters.priceMax ?? null,
    p_latitude: filters.latitude ?? null,
    p_longitude: filters.longitude ?? null,
    p_radius_km: filters.radiusKm ?? null,
  });

  if (error) {
    if (__DEV__) {
      console.warn(
        "[Sheger] list_marketplace_businesses_page failed, using fallback:",
        error.message ?? error,
      );
    }
    return fetchMarketplaceFallback(filters);
  }

  if (!data || !Array.isArray(data.rows)) {
    return fetchMarketplaceFallback(filters);
  }

  return {
    rows: data.rows.map((row) => normalizeMarketplaceRow(row)),
    next_cursor: data.next_cursor ?? null,
    limit: data.limit ?? (filters.limit ?? 20),
  };
}

export async function fetchApprovedBusinessesWithDetails() {
  const page = await fetchMarketplaceBusinessesPage({ limit: 40 });
  return page.rows;
}

export async function fetchBusinessesByCategory(categoryId: string) {
  const page = await fetchMarketplaceBusinessesPage({
    limit: 40,
    categoryId,
  });

  return page.rows as (Business & { categories: Pick<Category, "name" | "slug"> | null })[];
}

export async function fetchBusinessById(id: string) {
  const { data, error } = await supabase
    .from("businesses")
    .select("*, categories(name, slug)")
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle();

  if (error) throw error;
  return data as (Business & { categories: Pick<Category, "name" | "slug"> | null }) | null;
}

export async function fetchBusinessServices(businessId: string) {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("price");

  if (error) throw error;
  return data as Service[];
}

export async function fetchBusinessEmployees(businessId: string) {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("full_name");

  if (error) throw error;
  return data as Employee[];
}

export async function fetchCategoryBySlug(slug: string) {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data as Category | null;
}
