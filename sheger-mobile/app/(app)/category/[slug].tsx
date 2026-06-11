import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { fetchBusinessesByCategory, fetchCategoryBySlug } from "@/lib/api/businesses";

export default function BusinessListScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const { data: category } = useQuery({
    queryKey: ["category", slug],
    queryFn: () => fetchCategoryBySlug(slug!),
    enabled: Boolean(slug),
  });

  const { data: businesses, isLoading } = useQuery({
    queryKey: ["businesses", category?.id],
    queryFn: () => fetchBusinessesByCategory(category!.id),
    enabled: Boolean(category?.id),
  });

  return (
    <Screen scroll>
      <Header title={category?.name ?? "Businesses"} subtitle="Choose a place near you" showBack />

      {isLoading ? (
        <ActivityIndicator color={colors.primary} size="large" />
      ) : businesses?.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No businesses yet</Text>
          <Text style={styles.emptyText}>
            Approved businesses will appear here. Ask your provider to join Sheger.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {businesses?.map((biz) => (
            <Pressable
              key={biz.id}
              style={styles.card}
              onPress={() => router.push(`/(app)/business/${biz.id}`)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{biz.name.charAt(0)}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{biz.name}</Text>
                <Text style={styles.meta}>{biz.address ?? biz.city ?? "Addis Ababa"}</Text>
                {biz.phone ? <Text style={styles.meta}>{biz.phone}</Text> : null}
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 20, fontWeight: "700", color: colors.primaryDarker },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: "700", color: colors.primaryDarker },
  meta: { fontSize: 13, color: colors.textMuted },
  chevron: { fontSize: 24, color: colors.primary },
  empty: {
    backgroundColor: colors.surface,
    padding: 24,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.primaryDarker },
  emptyText: { color: colors.textMuted, lineHeight: 22 },
});
