import type { Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/theme";
import { goBackSafely } from "@/lib/routing";

type HeaderProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  backTo?: Href;
};

export function Header({ title, subtitle, showBack, backTo = "/(app)/home" }: HeaderProps) {
  return (
    <View style={styles.wrap}>
      {showBack ? (
        <Pressable onPress={() => goBackSafely(backTo)} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 20, gap: 4 },
  back: { marginBottom: 8 },
  backText: { color: colors.primary, fontSize: 16, fontWeight: "600" },
  title: { fontSize: 28, fontWeight: "700", color: colors.primaryDarker },
  subtitle: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
});
