import { Redirect, router } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ShegerLogoMark } from "@/components/welcome/ShegerLogoMark";
import { WelcomeBackground } from "@/components/welcome/WelcomeBackground";
import { WelcomeDivider } from "@/components/welcome/WelcomeDivider";
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
        <WelcomeBackground />
        <ActivityIndicator size="large" color={colors.accentLime} />
      </View>
    );
  }

  if (session) {
    return <Redirect href={getHomeRouteForRole(profile?.role)} />;
  }

  return (
    <View style={styles.root}>
      <WelcomeBackground />

      <SafeAreaView style={styles.safe}>
        <View style={styles.hero}>
          <ShegerLogoMark />
          <Text style={styles.wordmark}>sheger</Text>
          <View style={styles.taglineRow}>
            <Text style={styles.serviceBooking}>{t("welcome.serviceBooking").toUpperCase()}</Text>
            <Text style={styles.sparkle}> ✦</Text>
          </View>
          <Text style={styles.inEthiopia}>{t("welcome.inEthiopia").toUpperCase()}</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
            onPress={() => router.push("/(auth)/signup")}
          >
            <Text style={styles.ctaText}>{t("welcome.getStarted")}</Text>
            <Text style={styles.ctaArrow}>→</Text>
          </Pressable>

          <WelcomeDivider label={t("welcome.or")} />

          <Pressable
            style={({ pressed }) => [styles.ctaOutline, pressed && styles.pressed]}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={styles.ctaOutlineText}>{t("common.signIn")}</Text>
          </Pressable>

          <Pressable onPress={() => router.replace(CUSTOMER_HOME)} style={styles.guestLink}>
            <Text style={styles.guestText}>{t("welcome.browseGuest")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.brandDark,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandDark,
  },
  safe: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingBottom: 12,
  },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 24,
  },
  wordmark: {
    fontSize: 42,
    fontWeight: "600",
    color: colors.white,
    letterSpacing: -1,
    marginBottom: 10,
  },
  taglineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  serviceBooking: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.82)",
    letterSpacing: 2.4,
  },
  sparkle: {
    fontSize: 12,
    color: colors.gold,
    fontWeight: "700",
  },
  inEthiopia: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.gold,
    letterSpacing: 3,
  },
  actions: {
    width: "100%",
    paddingBottom: 8,
  },
  cta: {
    width: "100%",
    minHeight: 54,
    backgroundColor: colors.accentLime,
    borderRadius: 16,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accentLime,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.brandDark,
  },
  ctaArrow: {
    position: "absolute",
    right: 22,
    fontSize: 20,
    fontWeight: "700",
    color: colors.brandDark,
  },
  ctaOutline: {
    width: "100%",
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.55)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  ctaOutlineText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.white,
  },
  guestLink: {
    marginTop: 22,
    alignItems: "center",
  },
  guestText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
});
