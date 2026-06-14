import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BusinessCard } from "@/components/customer/BusinessCard";
import { CategoryGrid } from "@/components/customer/CategoryGrid";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Screen } from "@/components/ui/Screen";
import { colors, getTimeGreeting, radius } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { fetchApprovedBusinessesWithDetails } from "@/lib/api/businesses";
import { fetchCategories } from "@/lib/api/categories";
import { fetchAllBusinessRatings } from "@/lib/api/reviews";

export default function HomeScreen() {
  const { session, profile } = useAuth();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const { data: businesses, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ["home-businesses"],
    queryFn: fetchApprovedBusinessesWithDetails,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const { data: ratings } = useQuery({
    queryKey: ["business-ratings"],
    queryFn: fetchAllBusinessRatings,
  });

  const filtered = useMemo(() => {
    let list = businesses ?? [];
    if (categoryFilter) {
      list = list.filter((b) => b.category_id === categoryFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.description?.toLowerCase().includes(q) ||
          b.city?.toLowerCase().includes(q) ||
          b.categories?.name.toLowerCase().includes(q),
      );
    }
    return list;
  }, [businesses, categoryFilter, search]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";
  const displayName = session ? `${firstName} 👋` : "Guest 👋";

  return (
    <Screen scroll padded={false} backgroundColor={colors.screenBg}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>{getTimeGreeting()}</Text>
            <Text style={styles.name}>{displayName}</Text>
          </View>
          <Pressable style={styles.notif} onPress={() => router.push("/(app)/(tabs)/bookings")}>
            <Text style={styles.notifIcon}>🔔</Text>
            <View style={styles.notifDot} />
          </Pressable>
        </View>

        <Pressable
          style={styles.searchBar}
          onPress={() => router.push("/(app)/(tabs)/search")}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Search salons, clinics, gyms…</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <SectionHeader title="Categories" />
        {categories ? (
          <CategoryGrid
            categories={categories}
            selectedId={categoryFilter}
            onSelect={setCategoryFilter}
          />
        ) : null}

        <SectionHeader
          title="Near you in Addis"
          actionLabel={isRefetching ? "Updating…" : "Refresh"}
          onAction={() => refetch()}
        />

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading businesses…</Text>
          </View>
        ) : error ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Could not load businesses</Text>
            <Text style={styles.emptyText}>Check your connection and try again.</Text>
            <Pressable onPress={() => refetch()} style={styles.retryBtn}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🏪</Text>
            <Text style={styles.emptyTitle}>No businesses found</Text>
            <Text style={styles.emptyText}>
              {search || categoryFilter
                ? "Try a different search or category."
                : "Approved businesses will appear here soon."}
            </Text>
          </View>
        ) : (
          filtered.map((business, index) => (
            <BusinessCard
              key={business.id}
              business={business}
              themeIndex={index}
              rating={ratings?.[business.id]}
              onPress={() => router.push(`/(app)/business/${business.id}`)}
            />
          ))
        )}
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
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  greeting: { fontSize: 12, color: "rgba(255,255,255,0.7)" },
  name: { fontSize: 16, fontWeight: "500", color: colors.white, marginTop: 2 },
  notif: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  notifIcon: { fontSize: 16 },
  notifDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 7,
    height: 7,
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
    paddingVertical: 12,
    gap: 8,
  },
  searchIcon: { fontSize: 16, opacity: 0.7 },
  searchPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  center: { alignItems: "center", paddingVertical: 48, gap: 12 },
  loadingText: { color: colors.textMuted, fontSize: 14 },
  empty: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "500", color: colors.text },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 21 },
  retryBtn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryText: { color: colors.white, fontWeight: "600" },
});
