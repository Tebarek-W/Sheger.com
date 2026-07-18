import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { BusinessCard } from "@/components/customer/BusinessCard";
import { CustomerTabTitleHeader } from "@/components/navigation/CustomerTabHeader";
import { ListPagination } from "@/components/ui/ListPagination";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Screen } from "@/components/ui/Screen";
import { colors, radius, shadows, typography } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import {
  fetchMarketplaceBusinessesPage,
  type MarketplaceCursor,
} from "@/lib/api/businesses";
import { fetchCategories } from "@/lib/api/categories";
import { distanceKm, formatDistance, useUserLocation } from "@/lib/location";
import { compareFeaturedFirst } from "@/lib/business/discovery";
import { useDiscoveryStore } from "@/stores/discoveryStore";

type Business = Awaited<ReturnType<typeof fetchMarketplaceBusinessesPage>>["rows"][number];

const PAGE_SIZE = 20;
const RADIUS_OPTION_VALUES = [null, 5, 10, 25] as const;

export default function NearbyScreen() {
  const { t } = useI18n();
  const { coords, granted, loading: locationLoading, refresh } = useUserLocation();
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const categoryId = useDiscoveryStore((s) => s.categoryId);
  const setCategoryId = useDiscoveryStore((s) => s.setCategoryId);

  const [page, setPage] = useState(1);
  const [pageCursors, setPageCursors] = useState<(MarketplaceCursor | null)[]>([null]);

  useEffect(() => {
    setPage(1);
    setPageCursors([null]);
  }, [categoryId, radiusKm, coords?.latitude, coords?.longitude]);

  const currentCursor = pageCursors[page - 1] ?? null;

  const { data, isLoading, isFetching, refetch, isRefetching } = useQuery({
    queryKey: [
      "nearby-businesses",
      categoryId,
      coords?.latitude,
      coords?.longitude,
      radiusKm,
      page,
      currentCursor?.id ?? null,
    ],
    queryFn: () =>
      fetchMarketplaceBusinessesPage({
        limit: PAGE_SIZE,
        categoryId,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        radiusKm,
        cursor: currentCursor,
      }),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const selectedCategory = categories?.find((c) => c.id === categoryId);
  const categoryBusinesses = useMemo(() => data?.rows ?? [], [data?.rows]);
  const hasNext = Boolean(data?.next_cursor);

  const { located, missingLocation } = useMemo(() => {
    const withCoords = categoryBusinesses.filter((b) => b.latitude != null && b.longitude != null);
    const without = categoryBusinesses.filter((b) => b.latitude == null || b.longitude == null);

    let ranked = withCoords.map((business) => ({
      business,
      km:
        coords != null
          ? distanceKm(coords, {
              latitude: business.latitude!,
              longitude: business.longitude!,
            })
          : null,
    }));

    if (coords) {
      ranked = ranked
        .filter((item) => radiusKm == null || (item.km != null && item.km <= radiusKm))
        .sort((a, b) => {
          const featuredDiff = compareFeaturedFirst(a.business, b.business);
          if (featuredDiff !== 0) return featuredDiff;
          return (a.km ?? Infinity) - (b.km ?? Infinity);
        });
    } else {
      ranked = [...ranked].sort((a, b) => compareFeaturedFirst(a.business, b.business));
    }

    const sortedMissing = [...without].sort(compareFeaturedFirst);

    return { located: ranked, missingLocation: sortedMissing };
  }, [categoryBusinesses, coords, radiusKm]);

  const loading = (isLoading || locationLoading) && page === 1;
  const categoryLabel = selectedCategory?.name;

  const radiusOptions = RADIUS_OPTION_VALUES.map((value) => ({
    value,
    label: value == null ? t("nearby.radiusAll") : t("nearby.radiusKm", { count: value }),
  }));

  const resetAndRefetch = useCallback(() => {
    setPage(1);
    setPageCursors([null]);
    void refetch();
  }, [refetch]);

  const onRefresh = useCallback(() => {
    if (page !== 1) {
      setPage(1);
      setPageCursors([null]);
      return;
    }
    void refetch();
  }, [page, refetch]);

  const onPrevious = () => {
    if (page <= 1) return;
    setPage((current) => current - 1);
  };

  const onNext = () => {
    if (!data?.next_cursor) return;
    const nextCursor = data.next_cursor;
    setPageCursors((prev) => {
      const next = [...prev];
      next[page] = nextCursor;
      return next;
    });
    setPage((current) => current + 1);
  };

  const onChangeRadius = (value: number | null) => {
    setRadiusKm(value);
  };

  const onClearCategory = () => {
    setCategoryId(null);
  };

  return (
    <Screen
      scroll
      padded={false}
      backgroundColor={colors.screenBg}
      onRefresh={onRefresh}
      refreshing={isRefetching && page === 1}
    >
      <CustomerTabTitleHeader
        title={t("nearby.title")}
        subtitle={
          categoryLabel
            ? coords
              ? `${categoryLabel} — ${t("nearby.subtitle")}`
              : `${categoryLabel} — ${t("nearby.enableLocationSort")}`
            : coords
              ? t("nearby.subtitle")
              : t("nearby.enableLocationSort")
        }
      />

      <View style={styles.body}>
        {categoryLabel ? (
          <View style={styles.categoryRow}>
            <View style={styles.categoryChip}>
              <Text style={styles.categoryChipText}>{categoryLabel}</Text>
            </View>
            <Pressable onPress={onClearCategory} hitSlop={8}>
              <Text style={styles.clearCategory}>{t("search.reset")}</Text>
            </Pressable>
          </View>
        ) : null}
        {granted === false ? (
          <View style={styles.banner}>
            <Ionicons name="location-outline" size={20} color={colors.primaryDark} style={{ marginBottom: 4 }} />
            <Text style={styles.bannerText}>{t("nearby.enableLocationText")}</Text>
            <Pressable onPress={refresh} style={styles.bannerBtn}>
              <Text style={styles.bannerBtnText}>{t("nearby.enableLocation")}</Text>
            </Pressable>
          </View>
        ) : null}

        {coords ? (
          <View style={styles.radiusRow}>
            {radiusOptions.map((option) => {
              const active = radiusKm === option.value;
              return (
                <Pressable
                  key={option.label}
                  onPress={() => onChangeRadius(option.value)}
                  style={[styles.radiusChip, active && styles.radiusChipActive]}
                >
                  <Text style={[styles.radiusText, active && styles.radiusTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <SectionHeader
          title={coords ? t("nearby.closest") : categoryLabel ? categoryLabel : t("nearby.businesses")}
          actionLabel={isRefetching ? t("common.updating") : t("common.refresh")}
          onAction={resetAndRefetch}
        />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>{t("nearby.loading")}</Text>
          </View>
        ) : located.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {categoryLabel
                ? radiusKm
                  ? t("nearby.emptyCategoryWithin", {
                      category: categoryLabel.toLowerCase(),
                      km: radiusKm,
                    })
                  : t("nearby.emptyCategory", { category: categoryLabel.toLowerCase() })
                : radiusKm
                  ? t("nearby.emptyWithin", { km: radiusKm })
                  : t("nearby.emptyDefault")}
            </Text>
            <Text style={styles.emptyText}>
              {categoryLabel
                ? radiusKm
                  ? t("nearby.hintWidenOrCategory")
                  : t("nearby.hintOtherCategory")
                : radiusKm
                  ? t("nearby.hintWiden")
                  : t("nearby.hintSoon")}
            </Text>
          </View>
        ) : (
          <>
            {isFetching && !loading ? (
              <View style={styles.pageLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null}
            {located.map(({ business, km }, index) => (
              <BusinessCard
                key={business.id}
                business={business}
                themeIndex={index}
                rating={{ average: business.rating_average, count: business.rating_count }}
                fromPrice={business.from_price}
                distanceLabel={km != null ? formatDistance(km) : undefined}
                onPress={() => router.push(`/(app)/business/${business.id}`)}
              />
            ))}
            <ListPagination
              page={page}
              hasNext={hasNext}
              loading={isFetching}
              previousLabel={t("common.previous")}
              nextLabel={t("common.next")}
              pageLabel={t("common.page", { page })}
              onPrevious={onPrevious}
              onNext={onNext}
            />
          </>
        )}

        {missingLocation.length > 0 && !radiusKm && page === 1 ? (
          <View style={styles.otherSection}>
            <SectionHeader title={t("nearby.otherBusinesses")} />
            <Text style={styles.otherHint}>{t("nearby.otherLocationHint")}</Text>
            {missingLocation.map((business: Business, index: number) => (
              <BusinessCard
                key={business.id}
                business={business}
                themeIndex={index}
                rating={{ average: business.rating_average, count: business.rating_count }}
                fromPrice={business.from_price}
                onPress={() => router.push(`/(app)/business/${business.id}`)}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 24 },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  categoryChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    ...shadows.sm,
  },
  categoryChipText: { ...typography.label, color: colors.primaryDark },
  clearCategory: { ...typography.label, color: colors.primary },
  banner: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 16,
    gap: 10,
    ...shadows.sm,
  },
  bannerText: { fontSize: 13, color: colors.primaryDark, lineHeight: 19 },
  bannerBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 9,
    ...shadows.sm,
  },
  bannerBtnText: { color: colors.white, fontWeight: "600", fontSize: 13 },
  radiusRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  radiusChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  radiusChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadows.sm,
  },
  radiusText: { fontSize: 13, fontWeight: "500", color: colors.text },
  radiusTextActive: { color: colors.white },
  center: { alignItems: "center", paddingVertical: 48, gap: 12 },
  pageLoading: { alignItems: "center", paddingBottom: 8 },
  loadingText: { color: colors.textMuted, fontSize: 14 },
  empty: { alignItems: "center", paddingVertical: 56, gap: 10 },
  emptyTitle: { ...typography.h3, color: colors.text },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  otherSection: { marginTop: 28 },
  otherHint: { ...typography.small, color: colors.textSecondary, marginTop: -4, marginBottom: 12 },
});
