import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import type { AppLocale } from "@/lib/i18n";

type LanguageSwitcherProps = {
  variant?: "card" | "inline";
};

const OPTIONS: { locale: AppLocale; labelKey: string }[] = [
  { locale: "en", labelKey: "common.english" },
  { locale: "am", labelKey: "common.amharic" },
];

export function LanguageSwitcher({ variant = "card" }: LanguageSwitcherProps) {
  const { t, locale, setLocale } = useI18n();

  if (variant === "inline") {
    return (
      <View style={styles.inlineRow}>
        {OPTIONS.map((option) => {
          const active = locale === option.locale;
          return (
            <Pressable
              key={option.locale}
              onPress={() => void setLocale(option.locale)}
              style={[styles.inlineBtn, active && styles.inlineBtnActive]}
            >
              <Text style={[styles.inlineText, active && styles.inlineTextActive]}>
                {t(option.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{t("common.language")}</Text>
      <View style={styles.row}>
        {OPTIONS.map((option) => {
          const active = locale === option.locale;
          return (
            <Pressable
              key={option.locale}
              onPress={() => void setLocale(option.locale)}
              style={[styles.btn, active && styles.btnActive]}
            >
              <Text style={[styles.btnText, active && styles.btnTextActive]}>
                {t(option.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: "stretch",
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  btn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.screenBg,
  },
  btnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  btnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  btnTextActive: {
    color: colors.white,
  },
  inlineRow: {
    flexDirection: "row",
    gap: 8,
  },
  inlineBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.white,
  },
  inlineBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  inlineText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  inlineTextActive: {
    color: colors.primaryDark,
  },
});
