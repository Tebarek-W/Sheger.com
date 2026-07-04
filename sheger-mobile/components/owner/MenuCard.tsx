import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, shadows, typography } from "@/constants/theme";
import { ownerLayout } from "@/constants/owner-layout";

type MenuCardProps = {
  title: string;
  subtitle: string;
  icon: string;
  onPress: () => void;
};

export function MenuCard({ title, subtitle, icon, onPress }: MenuCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.iconCircle}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: ownerLayout.cardPadding,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: ownerLayout.cardPadding,
    ...shadows.sm,
  },
  pressed: { transform: [{ scale: 0.98 }] },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 22 },
  text: { flex: 1, gap: 3 },
  title: { ...typography.h3, color: colors.primaryDarker },
  subtitle: { fontSize: 13, color: colors.textMuted },
  chevron: { fontSize: 22, color: colors.primary, fontWeight: "600" },
});
