import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { BusinessCard } from "@/components/customer/BusinessCard";
import { CategoryGrid } from "@/components/customer/CategoryGrid";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { fetchApprovedBusinessesWithDetails } from "@/lib/api/businesses";
import { fetchCategories } from "@/lib/api/categories";

export default function SearchScreen() {
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const { data: businesses, isLoading } = useQuery({
    queryKey: ["home-businesses"],
    queryFn: fetchApprovedBusinessesWithDetails,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const results = useMemo(() => {
    let list = businesses ?? [];
    if (categoryFilter) {
      list = list.filter((b) => b.category_id === categoryFilter);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.description?.toLowerCase().includes(q) ||
          b.city?.toLowerCase().includes(q) ||
          b.address?.toLowerCase().includes(q) ||
          b.categories?.name.toLowerCase().includes(q),
      );
    }
    return list;
  }, [businesses, categoryFilter, query]);

  return (
    <Screen scroll padded={false} backgroundColor={colors.screenBg}>
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            ref={inputRef}
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search salons, clinics, gyms…"
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery("")}>
              <Text style={styles.clear}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        {categories ? (
          <>
            <SectionHeader title="Filter by category" />
            <CategoryGrid
              categories={categories}
              selectedId={categoryFilter}
              onSelect={setCategoryFilter}
            />
          </>
        ) : null}

        <SectionHeader
          title={query.trim() ? `Results for "${query.trim()}"` : "All businesses"}
        />

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : results.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.emptyText}>Try another name, area, or category.</Text>
          </View>
        ) : (
          results.map((business, index) => (
            <BusinessCard
              key={business.id}
              business={business}
              themeIndex={index}
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
    gap: 14,
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
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 2,
  },
  clear: { fontSize: 14, color: colors.textMuted, padding: 4 },
  body: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 },
  center: { alignItems: "center", paddingVertical: 48 },
  empty: { alignItems: "center", paddingVertical: 48, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "500", color: colors.text },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: "center" },
});
