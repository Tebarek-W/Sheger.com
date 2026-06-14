import type { BusinessWithDetails } from "@/lib/api/businesses";
import type { RatingMap, RatingSummary } from "@/lib/api/reviews";
import { distanceKm, type Coordinates } from "@/lib/location";

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

export type RankedBusiness = {
  business: BusinessWithDetails;
  km: number | null;
  rating: RatingSummary;
  fromPrice: number | null;
};

const EMPTY_RATING: RatingSummary = { average: null, count: 0 };

function servicePrices(business: BusinessWithDetails): number[] {
  return (business.services ?? [])
    .map((service) => Number(service.price))
    .filter((value) => Number.isFinite(value));
}

function fromPrice(business: BusinessWithDetails): number | null {
  const prices = servicePrices(business);
  return prices.length ? Math.min(...prices) : null;
}

function matchesPrice(business: BusinessWithDetails, range: PriceRange): boolean {
  if (range.min == null && range.max == null) return true;
  const prices = servicePrices(business);
  if (!prices.length) return false;
  return prices.some(
    (price) =>
      (range.min == null || price >= range.min) &&
      (range.max == null || price <= range.max),
  );
}

function matchesQuery(business: BusinessWithDetails, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    business.name.toLowerCase().includes(q) ||
    (business.description?.toLowerCase().includes(q) ?? false) ||
    (business.city?.toLowerCase().includes(q) ?? false) ||
    (business.address?.toLowerCase().includes(q) ?? false) ||
    (business.categories?.name.toLowerCase().includes(q) ?? false) ||
    (business.services ?? []).some((s) => s.name.toLowerCase().includes(q))
  );
}

export function getPriceRange(id: string): PriceRange {
  return PRICE_RANGES.find((range) => range.id === id) ?? PRICE_RANGES[0];
}

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

function compare(a: RankedBusiness, b: RankedBusiness, sort: SortKey): number {
  switch (sort) {
    case "nearest":
      return (a.km ?? Infinity) - (b.km ?? Infinity);
    case "rating": {
      const ratingDiff = (b.rating.average ?? -1) - (a.rating.average ?? -1);
      if (ratingDiff !== 0) return ratingDiff;
      return b.rating.count - a.rating.count;
    }
    case "price_low":
      return (a.fromPrice ?? Infinity) - (b.fromPrice ?? Infinity);
    case "price_high":
      return (b.fromPrice ?? -Infinity) - (a.fromPrice ?? -Infinity);
    default:
      return 0;
  }
}

/**
 * Pure, synchronous filter + sort over the already-fetched business list.
 * Keeping it pure means the UI can recompute instantly on every keystroke or
 * filter change without refetching (dynamic updates, combinable filters).
 */
export function applyDiscovery(
  businesses: BusinessWithDetails[],
  ratings: RatingMap,
  center: Coordinates | null,
  filters: DiscoveryFilters,
): RankedBusiness[] {
  const range = getPriceRange(filters.priceRangeId);

  const ranked: RankedBusiness[] = businesses.map((business) => {
    const hasCoords = business.latitude != null && business.longitude != null;
    const km =
      center && hasCoords
        ? distanceKm(center, {
            latitude: business.latitude as number,
            longitude: business.longitude as number,
          })
        : null;
    return {
      business,
      km,
      rating: ratings[business.id] ?? EMPTY_RATING,
      fromPrice: fromPrice(business),
    };
  });

  const filtered = ranked.filter((item) => {
    if (!matchesQuery(item.business, filters.query)) return false;
    if (filters.categoryId && item.business.category_id !== filters.categoryId) return false;
    if (!matchesPrice(item.business, range)) return false;
    if (filters.minRating != null) {
      if (item.rating.average == null || item.rating.average < filters.minRating) return false;
    }
    if (filters.radiusKm != null) {
      if (item.km == null || item.km > filters.radiusKm) return false;
    }
    return true;
  });

  const sort = filters.sort === "nearest" && !center ? "relevance" : filters.sort;
  if (sort !== "relevance") {
    filtered.sort((a, b) => compare(a, b, sort));
  } else if (center) {
    // With a location set but no explicit sort, nearest-first is the most useful default.
    filtered.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
  }

  return filtered;
}
