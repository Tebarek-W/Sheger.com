import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/constants/theme";

type ServiceCardProps = {
  name: string;
  description?: string | null;
  price: number;
  durationMinutes: number;
  onPress: () => void;
};

export function ServiceCard({
  name,
  description,
  price,
  durationMinutes,
  onPress,
}: ServiceCardProps) {
  const hasDescription = Boolean(description?.trim());

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Book ${name}`}
    >
      <View style={styles.topRow}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.price}>{Number(price).toFixed(0)} ETB</Text>
      </View>

      {hasDescription ? (
        <Text style={styles.description} numberOfLines={1}>
          {description!.trim()}
        </Text>
      ) : null}

      <View style={styles.bottomRow}>
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{durationMinutes} min</Text>
        </View>
        <View style={styles.bookRow}>
          <Text style={styles.bookText}>Book</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
    shadowColor: colors.primaryDarker,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  pressed: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    lineHeight: 20,
  },
  price: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
  },
  description: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  durationBadge: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  durationText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  bookText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  chevron: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.primary,
    marginTop: -1,
  },
});
