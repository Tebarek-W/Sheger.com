import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { colors, radius } from "@/constants/theme";
import type { BusinessWithDetails } from "@/lib/api/businesses";
import type { Service } from "@/lib/types/database";

const CATEGORY_ICONS: Record<string, string> = {
  barbershops: "✂️",
  "hair-salons": "💇",
  "nail-services": "💅",
  dentists: "🦷",
  clinics: "🏥",
  "massage-spa": "🧖",
  photographers: "📷",
  "gyms-trainers": "💪",
};

type BusinessCardProps = {
  business: BusinessWithDetails;
  onBook: (service: Service) => void;
  onViewDetails: () => void;
};

export function BusinessCard({ business, onBook, onViewDetails }: BusinessCardProps) {
  const slug = business.categories?.slug ?? "";
  const icon = CATEGORY_ICONS[slug] ?? "📍";
  const startingPrice = business.services.length
    ? Math.min(...business.services.map((s) => Number(s.price)))
    : null;

  return (
    <View style={styles.card}>
      <View style={styles.accent} />

      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>{icon}</Text>
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.name}>{business.name}</Text>
            {business.categories?.name ? (
              <Text style={styles.category}>{business.categories.name}</Text>
            ) : null}
          </View>
          {startingPrice !== null ? (
            <View style={styles.priceBadge}>
              <Text style={styles.priceFrom}>from</Text>
              <Text style={styles.priceValue}>{startingPrice.toFixed(0)}</Text>
              <Text style={styles.priceCurrency}>ETB</Text>
            </View>
          ) : null}
        </View>

        {business.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {business.description}
          </Text>
        ) : null}

        <View style={styles.meta}>
          {business.address || business.city ? (
            <Text style={styles.metaItem}>
              📍 {business.address ?? business.city}
            </Text>
          ) : null}
          {business.phone ? (
            <Text style={styles.metaItem}>📞 {business.phone}</Text>
          ) : null}
        </View>

        {business.services.length > 0 ? (
          <View style={styles.services}>
            <Text style={styles.servicesTitle}>Popular services</Text>
            {business.services.slice(0, 3).map((service) => (
              <View key={service.id} style={styles.serviceRow}>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{service.name}</Text>
                  <Text style={styles.serviceMeta}>
                    {service.duration_minutes} min · {Number(service.price).toFixed(0)} ETB
                  </Text>
                </View>
                <Pressable onPress={() => onBook(service)} style={styles.bookChip}>
                  <Text style={styles.bookChipText}>Book</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noServices}>Services coming soon</Text>
        )}

        <Button title="View full profile" variant="outline" onPress={onViewDetails} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: colors.primaryDarker,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  accent: {
    width: 5,
    backgroundColor: colors.primary,
  },
  body: {
    flex: 1,
    padding: 18,
    gap: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: { fontSize: 22 },
  titleBlock: { flex: 1, gap: 2 },
  name: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.primaryDarker,
    letterSpacing: -0.3,
  },
  category: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  priceBadge: {
    alignItems: "flex-end",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priceFrom: { fontSize: 10, color: colors.textMuted, fontWeight: "600" },
  priceValue: { fontSize: 18, fontWeight: "800", color: colors.primaryDarker },
  priceCurrency: { fontSize: 10, color: colors.textMuted, fontWeight: "600" },
  description: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  meta: { gap: 4 },
  metaItem: { fontSize: 13, color: colors.primaryDarker, fontWeight: "500" },
  services: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  servicesTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryDarker,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  serviceInfo: { flex: 1, gap: 2 },
  serviceName: { fontSize: 14, fontWeight: "700", color: colors.primaryDarker },
  serviceMeta: { fontSize: 12, color: colors.primary, fontWeight: "600" },
  bookChip: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bookChipText: { color: colors.white, fontWeight: "700", fontSize: 13 },
  noServices: { fontSize: 13, color: colors.textMuted, fontStyle: "italic" },
});
