import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { BookingHeader } from "@/components/ui/BookingHeader";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { colors } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import { getPendingBookingRoute } from "@/lib/auth-booking";
import { getErrorMessage } from "@/lib/errors";
import { getHomeRouteForRole } from "@/lib/routing";
import { supabase } from "@/lib/supabase";
import type { UserRole } from "@/lib/types/database";

export default function LoginScreen() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!email || !password) {
      Alert.alert(t("auth.missingFields"), t("auth.enterEmailPassword"));
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert(t("auth.loginFailed"), getErrorMessage(error));
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    const role = profile?.role as UserRole | undefined;
    if (role === "admin") {
      await supabase.auth.signOut();
      router.replace("/(auth)/admin-blocked");
      return;
    }
    const pendingBook = getPendingBookingRoute();
    if (pendingBook && role === "customer") {
      router.replace(pendingBook);
    } else {
      router.replace(getHomeRouteForRole(role));
    }
  };

  return (
    <Screen scroll backgroundColor={colors.screenBg}>
      <View style={styles.header}>
        <Text style={styles.brand}>sheger</Text>
        <Text style={styles.title}>{t("auth.welcomeBack")}</Text>
        <Text style={styles.subtitle}>{t("auth.signInSubtitle")}</Text>
      </View>

      <View style={styles.card}>
        <BookingHeader title={t("auth.signInTitle")} backTo="/" />
        <View style={styles.form}>
          <Input
            label={t("auth.email")}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder={t("auth.emailPlaceholder")}
          />
          <Input
            label={t("auth.password")}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
          />
          <Button title={t("common.signIn")} onPress={onLogin} loading={loading} />
          <Pressable onPress={() => router.push("/(auth)/signup")}>
            <Text style={styles.link}>{t("auth.noAccount")}</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  brand: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.primary,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: { fontSize: 24, fontWeight: "500", color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4, lineHeight: 20 },
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  form: { gap: 16, marginTop: 8 },
  link: { textAlign: "center", color: colors.primary, fontWeight: "500", marginTop: 8 },
});
