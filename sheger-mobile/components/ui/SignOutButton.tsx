import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors, radius } from "@/constants/theme";

type SignOutButtonProps = {
  onPress: () => void;
  variant?: "light" | "default";
};

export function SignOutButton({ onPress, variant = "default" }: SignOutButtonProps) {
  const isLight = variant === "light";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isLight ? styles.buttonLight : styles.buttonDefault,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Sign out"
    >
      <Ionicons
        name="log-out-outline"
        size={17}
        color={isLight ? colors.white : colors.primary}
      />
      <Text style={[styles.label, isLight ? styles.labelLight : styles.labelDefault]}>
        Sign out
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  buttonDefault: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    shadowColor: colors.primaryDarker,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonLight: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.28)",
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
  },
  labelDefault: {
    color: colors.primary,
  },
  labelLight: {
    color: colors.white,
  },
});
