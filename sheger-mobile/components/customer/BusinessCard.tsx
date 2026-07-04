import { useCallback, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { BusinessThumbnail } from "@/components/business/BusinessThumbnail";
import { formatRating } from "@/components/customer/StarRating";
import { getCategoryTheme } from "@/constants/categories";
import { colors, radius, shadows } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
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
  const { t } = useI18n();
  const slug = business.categories?.slug ?? "";
  const theme = getCategoryTheme(themeIndex);
  const location = business.address ?? business.city ?? t("customer.businessCard.defaultCity");
  const ratingLabel = formatRating(rating?.average ?? null, rating?.count ?? 0, t);
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  }, [scale]);
  const onPressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  }, [scale]);

  return (
    <Animated.View style={[styles.cardWrap, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.card}
      >
        <View style={[styles.accentBar, { backgroundColor: theme.badgeBg }]} />
        <BusinessThumbnail
          name={business.name}
          coverImageUrl={business.cover_image_url}
          categorySlug={slug}
          themeIndex={themeIndex}
          size={84}
        />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {business.name}
            </Text>
            {fromPrice != null ? (
              <Text style={styles.price}>
                {t("customer.businessCard.fromPrice", { price: fromPrice.toFixed(0) })}
              </Text>
            ) : null}
          </View>
          <View style={styles.meta}>
            {business.featured_in_search ? (
              <View style={styles.featuredBadge}>
                <Text style={styles.featuredBadgeText}>{t("customer.businessCard.featured")}</Text>
              </View>
            ) : null}
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    marginBottom: 12,
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  card: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  accentBar: {
    width: 4,
  },
  info: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 14,
    gap: 4,
  },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
  price: { fontSize: 12, fontWeight: "600", color: colors.primary },
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
  featuredBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#faeeda",
  },
  featuredBadgeText: { fontSize: 10, fontWeight: "700", color: "#854f0b" },
  stars: { flexDirection: "row", alignItems: "center", gap: 3 },
  starIcon: { fontSize: 12, color: colors.star },
  starText: { fontSize: 11, color: colors.textSecondary },
  location: { fontSize: 11, color: colors.textTertiary },
});
