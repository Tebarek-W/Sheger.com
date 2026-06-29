import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { BusinessCard } from "@/components/customer/BusinessCard";
import { BusinessMap, type MapBusiness } from "@/components/customer/BusinessMap";
import { DiscoveryFilterSheet } from "@/components/customer/DiscoveryFilterSheet";
import { LocationSearchBar, type LocationCenter } from "@/components/customer/LocationSearchBar";
import { formatRating } from "@/components/customer/StarRating";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import {
  fetchMarketplaceBusinessesPage,
  type MarketplaceBusiness,
} from "@/lib/api/businesses";
import { fetchCategories } from "@/lib/api/categories";
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  type DiscoveryFilters,
} from "@/lib/business/discovery";
import { formatDistance } from "@/lib/location";

type ViewMode = "list" | "map";

function sortResults(rows: MarketplaceBusiness[], sort: DiscoveryFilters["sort"]) {
  const list = [...rows];
  switch (sort) {
    case "nearest":
      return list.sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity));
    case "rating":
      return list.sort(
        (a, b) =>
          (b.rating_average ?? -1) - (a.rating_average ?? -1) ||
          b.rating_count - a.rating_count,
      );
    case "price_low":
      return list.sort((a, b) => (a.from_price ?? Infinity) - (b.from_price ?? Infinity));
    case "price_high":
      return list.sort((a, b) => (b.from_price ?? -1) - (a.from_price ?? -1));
    default:
      return list;
  }
}

export default function SearchScreen() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<DiscoveryFilters>(DEFAULT_FILTERS);
  const [center, setCenter] = useState<LocationCenter | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [view, setView] = useState<ViewMode>("list");

  const { data: businesses, isLoading } = useQuery({
    queryKey: [
      "search-businesses",
      query,
      filters.categoryId,
      filters.priceRangeId,
      filters.minRating,
      filters.radiusKm,
      filters.sort,
      center?.coords.latitude,
      center?.coords.longitude,
    ],
    queryFn: async () => {
      const priceRange =
        filters.priceRangeId === "any"
          ? null
          : {
              lt200: { min: null, max: 200 },
              "200-500": { min: 200, max: 500 },
              "500-1000": { min: 500, max: 1000 },
              gt1000: { min: 1000, max: null },
            }[filters.priceRangeId] ?? null;

      const page = await fetchMarketplaceBusinessesPage({
        limit: 40,
        categoryId: filters.categoryId,
        query,
        minRating: filters.minRating,
        priceMin: priceRange?.min ?? null,
        priceMax: priceRange?.max ?? null,
        latitude: center?.coords.latitude ?? null,
        longitude: center?.coords.longitude ?? null,
        radiusKm: filters.radiusKm,
      });
      return sortResults(page.rows, center ? filters.sort : filters.sort === "nearest" ? "relevance" : filters.sort);
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const effectiveFilters = useMemo<DiscoveryFilters>(
    () => ({ ...filters, query }),
    [filters, query],
  );

  const results = useMemo(() => businesses ?? [], [businesses]);

  const mapBusinesses = useMemo<MapBusiness[]>(
    () =>
      results
        .filter((business) => business.latitude != null && business.longitude != null)
        .map((business) => ({
          id: business.id,
          name: business.name,
          latitude: business.latitude as number,
          longitude: business.longitude as number,
          ratingLabel: business.rating_count
            ? `★ ${formatRating(business.rating_average, business.rating_count)}`
            : undefined,
          distanceLabel:
            business.distance_km != null ? formatDistance(business.distance_km) : undefined,
        })),
    [results],
  );

  const filterCount = activeFilterCount(effectiveFilters) + (center ? 1 : 0);
  const hasActiveFilters = filterCount > 0 || query.trim().length > 0;
  const openBusiness = (id: string) => router.push(`/(app)/business/${id}`);

  const resetAll = () => {
    setFilters(DEFAULT_FILTERS);
    setQuery("");
    setCenter(null);
  };

  return (
    <Screen scroll padded={false} backgroundColor={colors.screenBg}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("search.discover")}</Text>

        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("search.placeholder")}
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Text style={styles.clear}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        <LocationSearchBar center={center} onChange={setCenter} />
      </View>

      <View style={styles.controls}>
        <Pressable style={styles.filterBtn} onPress={() => setFilterOpen(true)}>
          <Text style={styles.filterBtnText}>{t("search.filters")}</Text>
          {filterCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{filterCount}</Text>
            </View>
          ) : null}
        </Pressable>

        <View style={styles.toggle}>
          <Pressable
            onPress={() => setView("list")}
            style={[styles.toggleItem, view === "list" && styles.toggleItemActive]}
          >
            <Text style={[styles.toggleText, view === "list" && styles.toggleTextActive]}>
              {t("search.list")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setView("map")}
            style={[styles.toggleItem, view === "map" && styles.toggleItemActive]}
          >
            <Text style={[styles.toggleText, view === "map" && styles.toggleTextActive]}>
              {t("search.map")}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        <SectionHeader
          title={t(results.length === 1 ? "search.result" : "search.results", {
            count: results.length,
          })}
          actionLabel={hasActiveFilters ? t("search.reset") : undefined}
          onAction={hasActiveFilters ? resetAll : undefined}
        />

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : results.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.emptyText}>
              Try a different search, area, or loosen your filters.
            </Text>
            {hasActiveFilters ? (
              <Pressable onPress={resetAll} style={styles.resetBtn}>
                <Text style={styles.resetBtnText}>Reset filters</Text>
              </Pressable>
            ) : null}
          </View>
        ) : view === "map" ? (
          mapBusinesses.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No mapped businesses</Text>
              <Text style={styles.emptyText}>
                These results haven&apos;t set a precise location yet. Switch to list view.
              </Text>
            </View>
          ) : (
            <BusinessMap
              businesses={mapBusinesses}
              center={center?.coords ?? null}
              onSelect={openBusiness}
            />
          )
        ) : (
          results.map((business, index) => (
            <BusinessCard
              key={business.id}
              business={business}
              themeIndex={index}
              rating={{ average: business.rating_average, count: business.rating_count }}
              fromPrice={business.from_price}
              distanceLabel={
                business.distance_km != null ? formatDistance(business.distance_km) : undefined
              }
              onPress={() => openBusiness(business.id)}
            />
          ))
        )}
      </View>

      <DiscoveryFilterSheet
        visible={filterOpen}
        filters={effectiveFilters}
        categories={categories ?? []}
        hasLocation={center != null}
        resultCount={results.length}
        onChange={(next) => setFilters({ ...next, query })}
        onReset={() => {
          setFilters(DEFAULT_FILTERS);
          setCenter(null);
        }}
        onClose={() => setFilterOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.brandDark,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: "500", color: colors.white },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  searchIcon: { fontSize: 16, color: colors.textMuted },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 2 },
  clear: { fontSize: 14, color: colors.textMuted, padding: 4 },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  filterBtnText: { fontSize: 14, fontWeight: "600", color: colors.text },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  toggle: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    padding: 3,
  },
  toggleItem: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  toggleItemActive: { backgroundColor: colors.primary },
  toggleText: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  toggleTextActive: { color: colors.white },
  body: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  center: { alignItems: "center", paddingVertical: 48 },
  empty: { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "500", color: colors.text },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  resetBtn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  resetBtnText: { color: colors.white, fontWeight: "600", fontSize: 13 },
});
