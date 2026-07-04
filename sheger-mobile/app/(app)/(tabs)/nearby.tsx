import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { BusinessCard } from "@/components/customer/BusinessCard";
import { CustomerTabTitleHeader } from "@/components/navigation/CustomerTabHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Screen } from "@/components/ui/Screen";
import { colors, radius, shadows, typography } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import { fetchMarketplaceBusinessesPage } from "@/lib/api/businesses";
import { fetchCategories } from "@/lib/api/categories";
import { distanceKm, formatDistance, useUserLocation } from "@/lib/location";
import { compareFeaturedFirst } from "@/lib/business/discovery";
import { useDiscoveryStore } from "@/stores/discoveryStore";

type Business = Awaited<ReturnType<typeof fetchMarketplaceBusinessesPage>>["rows"][number];

const RADIUS_OPTION_VALUES = [null, 5, 10, 25] as const;

export default function NearbyScreen() {
  const { t } = useI18n();
  const { coords, granted, loading: locationLoading, refresh } = useUserLocation();
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const categoryId = useDiscoveryStore((s) => s.categoryId);
  const setCategoryId = useDiscoveryStore((s) => s.setCategoryId);

  const { data: businesses, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["nearby-businesses", categoryId, coords?.latitude, coords?.longitude, radiusKm],
    queryFn: async () =>
      (
        await fetchMarketplaceBusinessesPage({
          limit: 40,
          categoryId,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          radiusKm,
        })
      ).rows,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const selectedCategory = categories?.find((c) => c.id === categoryId);

  const categoryBusinesses = useMemo(() => businesses ?? [], [businesses]);

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

  const loading = isLoading || locationLoading;
  const categoryLabel = selectedCategory?.name;

  const radiusOptions = RADIUS_OPTION_VALUES.map((value) => ({
    value,
    label: value == null ? t("nearby.radiusAll") : `${value} km`,
  }));

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  return (
    <Screen scroll padded={false} backgroundColor={colors.screenBg} onRefresh={onRefresh} refreshing={isRefetching}>
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
            <Pressable onPress={() => setCategoryId(null)} hitSlop={8}>
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
                  onPress={() => setRadiusKm(option.value)}
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
          onAction={() => refetch()}
        />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Finding nearby businesses…</Text>
          </View>
        ) : located.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {categoryLabel
                ? radiusKm
                  ? `No ${categoryLabel.toLowerCase()} within ${radiusKm} km`
                  : `No nearby ${categoryLabel.toLowerCase()}`
                : radiusKm
                  ? `Nothing within ${radiusKm} km`
                  : "No businesses nearby"}
            </Text>
            <Text style={styles.emptyText}>
              {categoryLabel
                ? radiusKm
                  ? "Try widening the distance filter or choose another category."
                  : "Try another category or check back later."
                : radiusKm
                  ? "Try widening the distance filter."
                  : "Approved businesses will appear here soon."}
            </Text>
          </View>
        ) : (
          located.map(({ business, km }, index) => (
            <BusinessCard
              key={business.id}
              business={business}
              themeIndex={index}
              rating={{ average: business.rating_average, count: business.rating_count }}
              fromPrice={business.from_price}
              distanceLabel={km != null ? formatDistance(km) : undefined}
              onPress={() => router.push(`/(app)/business/${business.id}`)}
            />
          ))
        )}

        {missingLocation.length > 0 && !radiusKm ? (
          <View style={styles.otherSection}>
            <SectionHeader title={t("nearby.otherBusinesses")} />
            <Text style={styles.otherHint}>These haven&apos;t set a precise location yet.</Text>
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
  loadingText: { color: colors.textMuted, fontSize: 14 },
  empty: { alignItems: "center", paddingVertical: 56, gap: 10 },
  emptyTitle: { ...typography.h3, color: colors.text },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  otherSection: { marginTop: 28 },
  otherHint: { ...typography.small, color: colors.textSecondary, marginTop: -4, marginBottom: 12 },
});
