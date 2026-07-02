import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/constants/theme";
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
      <Text style={styles.icon}>{icon}</Text>
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
    gap: ownerLayout.cardPadding - 2,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: ownerLayout.cardPadding,
  },
  pressed: { backgroundColor: colors.surface },
  icon: { fontSize: 24 },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: "700", color: colors.primaryDarker },
  subtitle: { fontSize: 13, color: colors.textMuted },
  chevron: { fontSize: 22, color: colors.primary, fontWeight: "600" },
});
