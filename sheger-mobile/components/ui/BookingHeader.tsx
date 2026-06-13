import type { Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/constants/theme";
import { CUSTOMER_HOME, goBackSafely } from "@/lib/routing";

type BookingHeaderProps = {
  title: string;
  backTo?: Href;
};

export function BookingHeader({ title, backTo = CUSTOMER_HOME }: BookingHeaderProps) {
  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => goBackSafely(backTo)} style={styles.back}>
        <Text style={styles.backIcon}>←</Text>
      </Pressable>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: 4,
  },
  back: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.screenBg,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: { fontSize: 18, color: colors.text, fontWeight: "600" },
  title: { fontSize: 16, fontWeight: "500", color: colors.text },
});
