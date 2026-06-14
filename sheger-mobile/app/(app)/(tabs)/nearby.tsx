import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { BusinessCard } from "@/components/customer/BusinessCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { fetchApprovedBusinessesWithDetails } from "@/lib/api/businesses";
import { fetchAllBusinessRatings } from "@/lib/api/reviews";
import { distanceKm, formatDistance, useUserLocation } from "@/lib/location";

type Business = Awaited<ReturnType<typeof fetchApprovedBusinessesWithDetails>>[number];

const RADIUS_OPTIONS = [
  { label: "All", value: null },
  { label: "5 km", value: 5 },
  { label: "10 km", value: 10 },
  { label: "25 km", value: 25 },
];

export default function NearbyScreen() {
  const { coords, granted, loading: locationLoading, refresh } = useUserLocation();
  const [radiusKm, setRadiusKm] = useState<number | null>(null);

  const { data: businesses, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["home-businesses"],
    queryFn: fetchApprovedBusinessesWithDetails,
  });

  const { data: ratings } = useQuery({
    queryKey: ["business-ratings"],
    queryFn: fetchAllBusinessRatings,
  });

  const { located, missingLocation } = useMemo(() => {
    const all = businesses ?? [];
    const withCoords = all.filter((b) => b.latitude != null && b.longitude != null);
    const without = all.filter((b) => b.latitude == null || b.longitude == null);

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
        .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
    }

    return { located: ranked, missingLocation: without };
  }, [businesses, coords, radiusKm]);

  const loading = isLoading || locationLoading;

  return (
    <Screen scroll padded={false} backgroundColor={colors.screenBg}>
      <View style={styles.header}>
        <Text style={styles.title}>Nearby</Text>
        <Text style={styles.subtitle}>
          {coords
            ? "Businesses sorted by distance from you"
            : "Enable location to sort by distance"}
        </Text>
      </View>

      <View style={styles.body}>
        {granted === false ? (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              Location access is off. Turn it on to sort businesses by distance.
            </Text>
            <Pressable onPress={refresh} style={styles.bannerBtn}>
              <Text style={styles.bannerBtnText}>Enable location</Text>
            </Pressable>
          </View>
        ) : null}

        {coords ? (
          <View style={styles.radiusRow}>
            {RADIUS_OPTIONS.map((option) => {
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
          title={coords ? "Closest to you" : "Businesses"}
          actionLabel={isRefetching ? "Updating…" : "Refresh"}
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
              {radiusKm ? `Nothing within ${radiusKm} km` : "No businesses nearby"}
            </Text>
            <Text style={styles.emptyText}>
              {radiusKm
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
              rating={ratings?.[business.id]}
              distanceLabel={km != null ? formatDistance(km) : undefined}
              onPress={() => router.push(`/(app)/business/${business.id}`)}
            />
          ))
        )}

        {missingLocation.length > 0 && !radiusKm ? (
          <View style={styles.otherSection}>
            <SectionHeader title="Other businesses" />
            <Text style={styles.otherHint}>These haven&apos;t set a precise location yet.</Text>
            {missingLocation.map((business: Business, index: number) => (
              <BusinessCard
                key={business.id}
                business={business}
                themeIndex={index}
                rating={ratings?.[business.id]}
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
  header: {
    backgroundColor: colors.brandDark,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  title: { fontSize: 22, fontWeight: "500", color: colors.white },
  subtitle: { fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 4, lineHeight: 18 },
  body: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 },
  banner: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  bannerText: { fontSize: 13, color: colors.primaryDark, lineHeight: 18 },
  bannerBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bannerBtnText: { color: colors.white, fontWeight: "600", fontSize: 13 },
  radiusRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  radiusChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  radiusChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  radiusText: { fontSize: 13, fontWeight: "500", color: colors.text },
  radiusTextActive: { color: colors.white },
  center: { alignItems: "center", paddingVertical: 48, gap: 12 },
  loadingText: { color: colors.textMuted, fontSize: 14 },
  empty: { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "500", color: colors.text },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: "center" },
  otherSection: { marginTop: 24 },
  otherHint: { fontSize: 12, color: colors.textSecondary, marginTop: -4, marginBottom: 12 },
});
