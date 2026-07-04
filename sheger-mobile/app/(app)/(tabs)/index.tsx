import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BusinessCard } from "@/components/customer/BusinessCard";
import { CategoryGrid } from "@/components/customer/CategoryGrid";
import {
  customerTabHeaderContainerStyle,
  HEADER_GRADIENT_COLORS,
} from "@/components/navigation/CustomerTabHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Screen } from "@/components/ui/Screen";
import { colors, radius, shadows, typography } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { fetchMarketplaceBusinessesPage } from "@/lib/api/businesses";
import { fetchCategories } from "@/lib/api/categories";
import { compareFeaturedFirst } from "@/lib/business/discovery";
import { getTimeGreetingKey } from "@/lib/i18n";
import { useDiscoveryStore } from "@/stores/discoveryStore";

export default function HomeScreen() {
  const { session, profile } = useAuth();
  const { t } = useI18n();
  const categoryFilter = useDiscoveryStore((s) => s.categoryId);
  const setCategoryFilter = useDiscoveryStore((s) => s.setCategoryId);

  const { data: businesses, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["home-businesses", categoryFilter],
    queryFn: async () =>
      (await fetchMarketplaceBusinessesPage({ limit: 20, categoryId: categoryFilter })).rows,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const filtered = useMemo(() => {
    return [...(businesses ?? [])].sort(compareFeaturedFirst);
  }, [businesses]);

  const { data: unreadCount = 0 } = useUnreadNotifications(session?.user.id);

  const firstName = profile?.full_name?.split(" ")[0] ?? t("common.there");
  const displayName = session ? `${firstName} 👋` : `${t("common.guest")} 👋`;

  const handleRefresh = useCallback(() => { refetch(); }, [refetch]);

  return (
    <Screen
      scroll
      padded={false}
      backgroundColor={colors.screenBg}
      onRefresh={handleRefresh}
      refreshing={isRefetching}
    >
      <LinearGradient
        colors={HEADER_GRADIENT_COLORS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{t(getTimeGreetingKey())}</Text>
            <Text style={styles.name}>{displayName}</Text>
          </View>
          <Pressable
            style={styles.notif}
            onPress={() => router.push(session ? "/(app)/notifications" : "/(auth)/login")}
          >
            <Text style={styles.notifIcon}>🔔</Text>
            {unreadCount > 0 ? <View style={styles.notifDot} /> : null}
          </Pressable>
        </View>

        <Pressable
          style={styles.searchBar}
          onPress={() => router.push("/(app)/(tabs)/search")}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>{t("home.searchPlaceholder")}</Text>
        </Pressable>
      </LinearGradient>

      <View style={styles.body}>
        <SectionHeader title={t("home.categories")} />
        {categories ? (
          <CategoryGrid
            categories={categories}
            selectedId={categoryFilter}
            onSelect={setCategoryFilter}
          />
        ) : null}

        <SectionHeader
          title={t("home.nearAddis")}
          actionLabel={isRefetching ? t("common.updating") : t("common.refresh")}
          onAction={() => refetch()}
        />

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>{t("home.loadingBusinesses")}</Text>
          </View>
        ) : error ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t("home.loadErrorTitle")}</Text>
            <Text style={styles.emptyText}>{t("home.loadErrorText")}</Text>
            <Pressable onPress={() => refetch()} style={styles.retryBtn}>
              <Text style={styles.retryText}>{t("common.tryAgain")}</Text>
            </Pressable>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🏪</Text>
            <Text style={styles.emptyTitle}>{t("home.noBusinessesTitle")}</Text>
            <Text style={styles.emptyText}>
              {categoryFilter
                ? t("home.noBusinessesFilter")
                : t("home.noBusinessesEmpty")}
            </Text>
          </View>
        ) : (
          filtered.map((business, index) => (
            <BusinessCard
              key={business.id}
              business={business}
              themeIndex={index}
              rating={{ average: business.rating_average, count: business.rating_count }}
              fromPrice={business.from_price}
              onPress={() => router.push(`/(app)/business/${business.id}`)}
            />
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: customerTabHeaderContainerStyle,
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  greeting: { fontSize: 13, color: "rgba(255,255,255,0.75)", letterSpacing: 0.2 },
  name: { ...typography.h3, color: colors.white, marginTop: 3 },
  notif: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  notifIcon: { fontSize: 18 },
  notifDot: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentLime,
    borderWidth: 1.5,
    borderColor: colors.brandDark,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  searchIcon: { fontSize: 16, opacity: 0.8 },
  searchPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: "rgba(255,255,255,0.55)",
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 24,
  },
  center: { alignItems: "center", paddingVertical: 48, gap: 12 },
  loadingText: { color: colors.textMuted, fontSize: 14 },
  empty: {
    alignItems: "center",
    paddingVertical: 56,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { ...typography.h3, color: colors.text },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: "center", lineHeight: 21 },
  retryBtn: {
    marginTop: 14,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 24,
    paddingVertical: 13,
    ...shadows.sm,
  },
  retryText: { color: colors.white, fontWeight: "600", fontSize: 14 },
});
