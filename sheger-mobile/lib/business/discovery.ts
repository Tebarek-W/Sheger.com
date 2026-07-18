export type SortKey = "relevance" | "nearest" | "rating" | "price_low" | "price_high";

export const SORT_OPTIONS: { key: SortKey; label: string; needsLocation?: boolean }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "nearest", label: "Nearest", needsLocation: true },
  { key: "rating", label: "Top rated" },
  { key: "price_low", label: "Price: low to high" },
  { key: "price_high", label: "Price: high to low" },
];

export type PriceRange = {
  id: string;
  label: string;
  min: number | null;
  max: number | null;
};

// Preset price brackets in ETB. `null` bounds mean open-ended.
export const PRICE_RANGES: PriceRange[] = [
  { id: "any", label: "Any price", min: null, max: null },
  { id: "lt200", label: "Under 200", min: null, max: 200 },
  { id: "200-500", label: "200 – 500", min: 200, max: 500 },
  { id: "500-1000", label: "500 – 1,000", min: 500, max: 1000 },
  { id: "gt1000", label: "1,000+", min: 1000, max: null },
];

export const RATING_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Any" },
  { value: 3, label: "3.0+" },
  { value: 4, label: "4.0+" },
  { value: 4.5, label: "4.5+" },
];

export const DISTANCE_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Any" },
  { value: 2, label: "2 km" },
  { value: 5, label: "5 km" },
  { value: 10, label: "10 km" },
  { value: 25, label: "25 km" },
];

export type DiscoveryFilters = {
  query: string;
  categoryId: string | null;
  priceRangeId: string;
  minRating: number | null;
  radiusKm: number | null;
  sort: SortKey;
};

export const DEFAULT_FILTERS: DiscoveryFilters = {
  query: "",
  categoryId: null,
  priceRangeId: "any",
  minRating: null,
  radiusKm: null,
  sort: "relevance",
};

/** Count of filters that differ from the defaults (drives the "Filters · N" badge). */
export function activeFilterCount(filters: DiscoveryFilters): number {
  let count = 0;
  if (filters.categoryId) count += 1;
  if (filters.priceRangeId !== "any") count += 1;
  if (filters.minRating != null) count += 1;
  if (filters.radiusKm != null) count += 1;
  if (filters.sort !== "relevance") count += 1;
  return count;
}

/** Featured businesses sort before non-featured within any list. */
export function compareFeaturedFirst(
  a: { featured_in_search?: boolean },
  b: { featured_in_search?: boolean },
): number {
  const af = a.featured_in_search ? 1 : 0;
  const bf = b.featured_in_search ? 1 : 0;
  return bf - af;
}
