import { useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
} from "react-native";

import { colors, radius, shadows } from "@/constants/theme";

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
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scale]);

  const onPressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  }, [scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        disabled={isDisabled}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={(state) => {
          const resolved = typeof style === "function" ? style(state) : style;
          return [
            styles.base,
            styles[variant],
            variant === "primary" && shadows.sm,
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
    </Animated.View>
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
  disabled: { opacity: 0.5 },
  text: { fontSize: 15, fontWeight: "500" },
  primaryText: { color: colors.white },
  secondaryText: { color: colors.primaryDark },
  outlineText: { color: colors.primary },
  ghostText: { color: colors.primary },
  accentText: { color: colors.brandDark },
});
