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
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchApprovedBusinessesWithDetails,
  type BusinessWithDetails,
} from "@/lib/api/businesses";
import { fetchCategories } from "@/lib/api/categories";
import { promptLoginToBook, setBookingDraft } from "@/lib/auth-booking";
import type { Service } from "@/lib/types/database";

export default function HomeScreen() {
  const { session, profile, signOut } = useAuth();
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

  const handleBook = (business: BusinessWithDetails, service: Service) => {
    if (!session) {
      promptLoginToBook(business, service);
      return;
    }
    setBookingDraft(business, service);
    router.push("/(app)/book");
  };

  const handleViewDetails = (businessId: string) => {
    router.push(`/(app)/business/${businessId}`);
  };

  const greeting = session
    ? `Hello, ${profile?.full_name?.split(" ")[0] || "there"}`
    : "Discover Sheger";

  return (
    <Screen scroll padded={false}>
      <View style={styles.hero}>
        <View style={styles.heroDecor} />
        <View style={styles.heroContent}>
          <View style={styles.heroTop}>
            <View style={styles.heroTitleBlock}>
              <Text style={styles.brand}>Sheger</Text>
              <Text style={styles.greeting}>{greeting}</Text>
            </View>
            {session ? (
              <Pressable onPress={signOut} style={styles.authPill}>
                <Text style={styles.authPillText}>Sign out</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.heroSubtitle}>
            Book trusted salons, barbers, spas & clinics across Ethiopia
          </Text>

          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search businesses, areas, services..."
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
            />
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.filterHeader}>
          <Text style={styles.sectionTitle}>Featured businesses</Text>
          <Pressable onPress={() => refetch()} disabled={isRefetching}>
            <Text style={styles.refresh}>
              {isRefetching ? "Updating..." : "Refresh"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.chips}>
          <Pressable
            onPress={() => setCategoryFilter(null)}
            style={[styles.chip, !categoryFilter && styles.chipActive]}
          >
            <Text style={[styles.chipText, !categoryFilter && styles.chipTextActive]}>
              All
            </Text>
          </Pressable>
          {categories?.map((cat) => {
            const active = categoryFilter === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setCategoryFilter(active ? null : cat.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading businesses...</Text>
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
          filtered.map((business) => (
            <BusinessCard
              key={business.id}
              business={business}
              onBook={(service) => handleBook(business, service)}
              onViewDetails={() => handleViewDetails(business.id)}
            />
          ))
        )}

        {!session ? (
          <View style={styles.bottomAuth}>
            <Button title="Get Started" onPress={() => router.push("/(auth)/signup")} />
            <Button
              title="Login"
              variant="outline"
              onPress={() => router.push("/(auth)/login")}
            />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primary,
    paddingBottom: 28,
    overflow: "hidden",
  },
  heroDecor: {
    position: "absolute",
    right: -40,
    top: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 14,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroTitleBlock: { flex: 1 },
  brand: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  greeting: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.white,
    marginTop: 2,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255,255,255,0.9)",
    maxWidth: 300,
  },
  authPill: {
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  authPillText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    gap: 10,
    minHeight: 52,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.primaryDarker,
    paddingVertical: 12,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.primaryDarker,
  },
  refresh: { color: colors.primary, fontWeight: "600", fontSize: 14 },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.primaryDarker },
  chipTextActive: { color: colors.white },
  center: { alignItems: "center", paddingVertical: 48, gap: 12 },
  loadingText: { color: colors.textMuted, fontSize: 14 },
  empty: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.primaryDarker },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 21 },
  retryBtn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryText: { color: colors.white, fontWeight: "700" },
  bottomAuth: {
    marginTop: 8,
    gap: 12,
    paddingTop: 8,
  },
});
