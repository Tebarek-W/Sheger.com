import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { CUSTOMER_HOME } from "@/lib/routing";

/** Shown when a blocked customer or business owner signs in on mobile. */
export default function AccountBlockedScreen() {
  const { profile, signOut } = useAuth();
  const { t } = useI18n();

  const onSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  const onBrowseGuest = async () => {
    await signOut();
    router.replace(CUSTOMER_HOME);
  };

  const name = profile?.full_name?.trim();
  const subtitle = name
    ? t("auth.accountBlocked.subtitleNamed", { name })
    : t("auth.accountBlocked.subtitleGeneric");

  return (
    <Screen scroll backgroundColor={colors.screenBg}>
      <View style={styles.wrap}>
        <View style={styles.iconRing}>
          <Text style={styles.icon}>🚫</Text>
        </View>
        <Text style={styles.title}>{t("auth.accountBlocked.title")}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("auth.accountBlocked.cardTitle")}</Text>
          <Text style={styles.cardText}>{t("auth.accountBlocked.cardText")}</Text>
        </View>

        <Button title={t("common.signOut")} onPress={onSignOut} />
        <Button title={t("welcome.browseGuest")} variant="outline" onPress={onBrowseGuest} />
        <Text style={styles.footer}>{t("auth.accountBlocked.footer")}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 32,
    gap: 14,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 8,
  },
  icon: { fontSize: 32 },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
    marginVertical: 8,
  },
  cardTitle: { fontSize: 14, fontWeight: "600", color: colors.primaryDark },
  cardText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  footer: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 8,
  },
});
