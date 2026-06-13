import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from "react-native";

import { colors, radius } from "@/constants/theme";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "accent";

type ButtonProps = PressableProps & {
  title: string;
  variant?: Variant;
  loading?: boolean;
};

export function Button({
  title,
  variant = "primary",
  loading,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={(state) => {
        const resolved = typeof style === "function" ? style(state) : style;
        return [
          styles.base,
          styles[variant],
          state.pressed && !isDisabled && styles.pressed,
          isDisabled && styles.disabled,
          resolved,
        ];
      }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "accent" ? colors.brandDark : variant === "primary" ? colors.white : colors.primary}
        />
      ) : (
        <Text style={[styles.text, styles[`${variant}Text` as const]]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.primaryLight },
  outline: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghost: { backgroundColor: "transparent" },
  accent: { backgroundColor: colors.accentLime },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.5 },
  text: { fontSize: 15, fontWeight: "500" },
  primaryText: { color: colors.white },
  secondaryText: { color: colors.primaryDark },
  outlineText: { color: colors.primary },
  ghostText: { color: colors.primary },
  accentText: { color: colors.brandDark },
});
