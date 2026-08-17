import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BusinessPhotosTab } from "@/components/customer/BusinessPhotosTab";
import { BusinessReviewsTab } from "@/components/customer/BusinessReviewsTab";
import { BusinessStaffTab } from "@/components/customer/BusinessStaffTab";
import { ServiceCard } from "@/components/customer/ServiceCard";
import { formatRating, StarRating } from "@/components/customer/StarRating";
import { getCategoryIcon, getCategoryThemeBySlug } from "@/constants/categories";
import { colors, radius } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { fetchWorkingHours } from "@/lib/api/bookings";
import { fetchBusinessById, fetchBusinessServices } from "@/lib/api/businesses";
import { fetchBusinessReviewSummary } from "@/lib/api/reviews";
import { promptLoginToBook, setBookingDraft } from "@/lib/auth-booking";
import { addisToday, dayOfWeekInAddis, isOpenNow } from "@/lib/calendar/timezone";
import { CUSTOMER_HOME, goBackSafely } from "@/lib/routing";

const TAB_KEYS = ["services", "staff", "reviews", "photos"] as const;
type TabKey = (typeof TAB_KEYS)[number];

export default function BusinessProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabKey>("services");
  const [heroAspect, setHeroAspect] = useState(4 / 3);

  const tabLabels = useMemo(
    () =>
      Object.fromEntries(
        TAB_KEYS.map((key) => [key, t(`business.tabs.${key}`)]),
      ) as Record<TabKey, string>,
    [t],
  );

  const { data: business, isLoading } = useQuery({
    queryKey: ["business", id],
    queryFn: () => fetchBusinessById(id!),
    enabled: Boolean(id),
  });

  const coverImageUrl = business?.cover_image_url ?? null;

  useEffect(() => {
    if (!coverImageUrl) {
      setHeroAspect(4 / 3);
      return;
    }

    Image.getSize(
      coverImageUrl,
      (width, height) => {
        if (width > 0 && height > 0) {
          setHeroAspect(width / height);
        }
      },
      () => setHeroAspect(4 / 3),
    );
  }, [coverImageUrl]);

  const { data: services } = useQuery({
    queryKey: ["services", id],
    queryFn: () => fetchBusinessServices(id!),
    enabled: Boolean(id),
  });

  const { data: reviewSummary } = useQuery({
    queryKey: ["business-review-summary", id],
    queryFn: () => fetchBusinessReviewSummary(id!),
    enabled: Boolean(id),
  });

  const today = addisToday();
  const { data: hours, isLoading: hoursLoading } = useQuery({
    queryKey: ["working-hours", id, dayOfWeekInAddis(today)],
    queryFn: () => fetchWorkingHours(id!, dayOfWeekInAddis(today)),
    enabled: Boolean(id),
  });

  const onBook = (serviceId: string) => {
    const service = services?.find((s) => s.id === serviceId);
    if (!business || !service) return;
    if (!session) {
      promptLoginToBook(business, service, t);
      return;
    }
    setBookingDraft(business, service);
    router.push("/(app)/book");
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (!business) {
    return (
      <SafeAreaView style={styles.loader}>
        <Pressable onPress={() => goBackSafely(CUSTOMER_HOME)} style={styles.backFab}>
          <Text style={styles.backFabText}>←</Text>
        </Pressable>
        <Text style={styles.muted}>{t("business.unavailable")}</Text>
      </SafeAreaView>
    );
  }

  const slug = business.categories?.slug;
  const icon = getCategoryIcon(slug);
  const theme = getCategoryThemeBySlug(slug);
  const ratingLabel = formatRating(reviewSummary?.average ?? null, reviewSummary?.count ?? 0, t);
  const openState = isOpenNow(hours ?? null);
  const hoursLabel = hoursLoading
    ? null
    : hours?.is_closed
      ? t("business.closedToday")
      : openState === true
        ? t("business.openToday")
        : openState === false
          ? t("business.closedNow")
          : t("business.hoursUnknown");
  const hoursOpen = openState === true && !hours?.is_closed;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, coverImageUrl ? styles.heroWithPhoto : styles.heroFallback]}>
          {coverImageUrl ? (
            <Image
              source={{ uri: coverImageUrl }}
              style={[styles.heroImage, { aspectRatio: heroAspect }]}
              resizeMode="contain"
            />
          ) : (
            <Text style={[styles.heroIcon, { color: theme.icon }]}>{icon}</Text>
          )}
          <Pressable onPress={() => goBackSafely(CUSTOMER_HOME)} style={[styles.heroBtn, styles.heroBtnLeft]}>
            <Text style={styles.heroBtnText}>←</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.name}>{business.name}</Text>
          <View style={styles.stats}>
            <View style={styles.ratingRow}>
              {reviewSummary?.count ? (
                <StarRating value={Math.round(reviewSummary.average ?? 0)} size={14} />
              ) : null}
              <Text style={styles.stat}>★ {ratingLabel}</Text>
            </View>
            <Text style={styles.stat}>
              📍 {business.address ?? business.city ?? t("business.defaultCity")}
            </Text>
            {hoursLabel ? (
              <View style={[styles.openBadge, !hoursOpen && styles.closedBadge]}>
                <Text style={[styles.openText, !hoursOpen && styles.closedText]}>{hoursLabel}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.tabs}>
            {TAB_KEYS.map((tab) => {
              const active = activeTab === tab;
              return (
                <Pressable key={tab} onPress={() => setActiveTab(tab)} style={styles.tab}>
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{tabLabels[tab]}</Text>
                  {active ? <View style={styles.tabLine} /> : null}
                </Pressable>
              );
            })}
          </View>

          {activeTab === "services" ? (
            <View style={styles.serviceList}>
              {services?.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  onPress={() => onBook(service.id)}
                />
              ))}
              {!services?.length ? <Text style={styles.muted}>{t("business.noServices")}</Text> : null}
            </View>
          ) : null}

          {activeTab === "staff" ? <BusinessStaffTab businessId={business.id} /> : null}
          {activeTab === "reviews" ? <BusinessReviewsTab businessId={business.id} /> : null}
          {activeTab === "photos" ? <BusinessPhotosTab business={business} /> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.screenBg },
  scroll: { flexGrow: 1 },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.screenBg,
    padding: 20,
  },
  hero: {
    backgroundColor: colors.brandDark,
    position: "relative",
  },
  heroWithPhoto: {
    width: "100%",
  },
  heroFallback: {
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
    backgroundColor: colors.brandDark,
  },
  heroIcon: { fontSize: 60, opacity: 0.25 },
  heroBtn: {
    position: "absolute",
    top: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  heroBtnLeft: { left: 12 },
  heroBtnText: { color: colors.white, fontSize: 16 },
  backFab: {
    position: "absolute",
    top: 16,
    left: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  backFabText: { fontSize: 16, color: colors.primary },
  card: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    marginTop: -24,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 32,
    minHeight: 420,
  },
  name: { fontSize: 18, fontWeight: "500", color: colors.text, marginBottom: 6 },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  stat: { fontSize: 12, color: colors.textSecondary },
  openBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  openText: { fontSize: 11, fontWeight: "500", color: colors.primaryDark },
  closedBadge: {
    backgroundColor: colors.errorBg,
  },
  closedText: { color: colors.error },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: 16,
  },
  tab: { marginRight: 20, paddingBottom: 8 },
  tabText: { fontSize: 13, color: colors.textSecondary },
  tabTextActive: { color: colors.primary, fontWeight: "500" },
  tabLine: {
    position: "absolute",
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primary,
  },
  serviceList: { gap: 9 },
  muted: { color: colors.textMuted, fontSize: 14 },
});
