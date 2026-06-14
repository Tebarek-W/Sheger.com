import { Pressable, StyleSheet, Text, View } from "react-native";

import { BusinessThumbnail } from "@/components/business/BusinessThumbnail";
import { formatRating } from "@/components/customer/StarRating";
import { getCategoryTheme } from "@/constants/categories";
import { colors, radius } from "@/constants/theme";
import type { BusinessWithDetails } from "@/lib/api/businesses";
import type { RatingSummary } from "@/lib/api/reviews";

type BusinessCardProps = {
  business: BusinessWithDetails;
  themeIndex?: number;
  distanceLabel?: string;
  rating?: RatingSummary;
  fromPrice?: number | null;
  onPress: () => void;
};

export function BusinessCard({
  business,
  themeIndex = 0,
  distanceLabel,
  rating,
  fromPrice,
  onPress,
}: BusinessCardProps) {
  const slug = business.categories?.slug ?? "";
  const theme = getCategoryTheme(themeIndex);
  const location = business.address ?? business.city ?? "Addis Ababa";
  const ratingLabel = formatRating(rating?.average ?? null, rating?.count ?? 0);

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <BusinessThumbnail
        name={business.name}
        coverImageUrl={business.cover_image_url}
        categorySlug={slug}
        themeIndex={themeIndex}
        size={80}
      />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {business.name}
          </Text>
          {fromPrice != null ? (
            <Text style={styles.price}>from {fromPrice.toFixed(0)} ETB</Text>
          ) : null}
        </View>
        <View style={styles.meta}>
          {business.categories?.name ? (
            <View style={[styles.badge, { backgroundColor: theme.badgeBg }]}>
              <Text style={[styles.badgeText, { color: theme.badgeText }]}>
                {business.categories.name}
              </Text>
            </View>
          ) : null}
          <View style={styles.stars}>
            <Text style={styles.starIcon}>★</Text>
            <Text style={styles.starText}>{ratingLabel}</Text>
          </View>
        </View>
        <Text style={styles.location} numberOfLines={1}>
          📍 {location}
          {distanceLabel ? ` · ${distanceLabel}` : ""}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: 12,
    gap: 0,
  },
  info: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 12,
    gap: 3,
  },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { flex: 1, fontSize: 14, fontWeight: "500", color: colors.text },
  price: { fontSize: 11, fontWeight: "600", color: colors.primary },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: { fontSize: 10, fontWeight: "500" },
  stars: { flexDirection: "row", alignItems: "center", gap: 3 },
  starIcon: { fontSize: 12, color: colors.star },
  starText: { fontSize: 11, color: colors.textSecondary },
  location: { fontSize: 11, color: colors.textTertiary },
});
