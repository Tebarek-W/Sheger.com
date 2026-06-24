import { Redirect, router } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { CUSTOMER_HOME, getHomeRouteForRole } from "@/lib/routing";

export default function Index() {
  const { session, profile, loading } = useAuth();
  const { t } = useI18n();

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.accentLime} />
      </View>
    );
  }

  if (session) {
    return <Redirect href={getHomeRouteForRole(profile?.role)} />;
  }

  return (
    <SafeAreaView style={styles.splash}>
      <View style={styles.content}>
        <View style={styles.logoRing}>
          <Text style={styles.logoIcon}>📅</Text>
        </View>
        <Text style={styles.wordmark}>sheger</Text>
        <Text style={styles.tagline}>{t("welcome.tagline")}</Text>

        <Pressable style={styles.cta} onPress={() => router.push("/(auth)/signup")}>
          <Text style={styles.ctaText}>{t("welcome.getStarted")}</Text>
        </Pressable>

        <Text style={styles.divider}>{t("welcome.or")}</Text>

        <Pressable style={styles.ctaOutline} onPress={() => router.push("/(auth)/login")}>
          <Text style={styles.ctaOutlineText}>{t("common.signIn")}</Text>
        </Pressable>

        <Pressable onPress={() => router.replace(CUSTOMER_HOME)} style={styles.guestLink}>
          <Text style={styles.guestText}>{t("welcome.browseGuest")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandDark,
  },
  splash: {
    flex: 1,
    backgroundColor: colors.brandDark,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logoRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logoIcon: { fontSize: 36 },
  wordmark: {
    fontSize: 36,
    fontWeight: "500",
    color: colors.accentLime,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 48,
  },
  cta: {
    width: "100%",
    backgroundColor: colors.accentLime,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  ctaText: { fontSize: 15, fontWeight: "500", color: colors.brandDark },
  divider: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    marginVertical: 14,
  },
  ctaOutline: {
    width: "100%",
    borderWidth: 1.5,
    borderColor: "rgba(110,232,110,0.4)",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaOutlineText: { fontSize: 15, fontWeight: "500", color: colors.accentLime },
  guestLink: { marginTop: 28 },
  guestText: { fontSize: 13, color: "rgba(255,255,255,0.45)", fontWeight: "500" },
});
