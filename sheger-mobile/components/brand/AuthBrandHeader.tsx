import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";

import { BrandLogo } from "@/components/brand/BrandLogo";
import { APP_NAME } from "@/constants/brand";
import { colors } from "@/constants/theme";

type AuthBrandHeaderProps = {
  title: string;
  subtitle?: string;
  style?: ViewStyle;
  /** Larger logo on the welcome screen. */
  variant?: "auth" | "welcome";
  wordmarkStyle?: TextStyle;
};

export function AuthBrandHeader({
  title,
  subtitle,
  style,
  variant = "auth",
  wordmarkStyle,
}: AuthBrandHeaderProps) {
  const logoSize = variant === "welcome" ? 120 : 80;

  return (
    <View style={[variant === "auth" ? styles.authHeader : styles.welcomeHeader, style]}>
      <BrandLogo size={logoSize} framed={variant === "welcome"} />
      <Text style={[variant === "welcome" ? styles.welcomeWordmark : styles.authWordmark, wordmarkStyle]}>
        {APP_NAME}
      </Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  authHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    alignItems: "center",
  },
  welcomeHeader: {
    alignItems: "center",
  },
  authWordmark: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
    textAlign: "center",
  },
  welcomeWordmark: {
    fontSize: 42,
    fontWeight: "700",
    color: colors.white,
    letterSpacing: -1,
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: "500",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 20,
    textAlign: "center",
  },
});
