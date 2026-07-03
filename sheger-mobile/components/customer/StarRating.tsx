import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/theme";

type StarRatingProps = {
  value: number;
  onChange?: (rating: number) => void;
  size?: number;
};

export function StarRating({ value, onChange, size = 22 }: StarRatingProps) {
  const interactive = Boolean(onChange);

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        const Star = (
          <Text
            style={[
              styles.star,
              { fontSize: size },
              filled ? styles.starFilled : styles.starEmpty,
            ]}
          >
            ★
          </Text>
        );

        if (!interactive) return <View key={star}>{Star}</View>;

        return (
          <Pressable key={star} onPress={() => onChange?.(star)} hitSlop={6}>
            {Star}
          </Pressable>
        );
      })}
    </View>
  );
}

export function formatRating(
  average: number | null,
  count: number,
  t?: (key: string, params?: Record<string, string | number>) => string,
) {
  if (!count || average == null) {
    return t ? t("customer.starRating.new") : "New";
  }
  const formatted = average.toFixed(1);
  return t
    ? t("customer.starRating.formatted", { average: formatted, count })
    : `${formatted} (${count})`;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 4 },
  star: { lineHeight: 24 },
  starFilled: { color: colors.star },
  starEmpty: { color: colors.border },
});
