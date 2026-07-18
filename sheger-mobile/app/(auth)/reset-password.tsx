import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { BookingHeader } from "@/components/ui/BookingHeader";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { colors } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { updatePassword } from "@/lib/api/auth";
import { getErrorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordScreen() {
  const { t } = useI18n();
  const { session, loading: authLoading, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    setReady(true);
  }, [authLoading]);

  const onSubmit = async () => {
    if (!session) {
      Alert.alert(t("auth.resetFailed"), t("auth.resetLinkExpired"));
      router.replace("/(auth)/forgot-password");
      return;
    }

    if (!password || !confirmPassword) {
      Alert.alert(t("auth.missingFields"), t("auth.fillNewPassword"));
      return;
    }

    if (password.trim().length < 6) {
      Alert.alert(t("auth.resetFailed"), t("auth.passwordTooShort"));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t("auth.resetFailed"), t("auth.passwordMismatch"));
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      await signOut();
      Alert.alert(t("auth.passwordUpdatedTitle"), t("auth.passwordUpdatedMessage"), [
        { text: t("common.ok"), onPress: () => router.replace("/(auth)/login") },
      ]);
    } catch (error) {
      const message = getErrorMessage(error);
      if (message === "PASSWORD_TOO_SHORT") {
        Alert.alert(t("auth.resetFailed"), t("auth.passwordTooShort"));
      } else {
        Alert.alert(t("auth.resetFailed"), message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <Screen backgroundColor={colors.screenBg}>
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen scroll backgroundColor={colors.screenBg}>
        <View style={styles.header}>
          <Text style={styles.brand}>sheger</Text>
          <Text style={styles.title}>{t("auth.resetPasswordTitle")}</Text>
          <Text style={styles.subtitle}>{t("auth.resetLinkExpired")}</Text>
        </View>
        <View style={styles.card}>
          <BookingHeader title={t("auth.resetPasswordTitle")} backTo="/(auth)/login" />
          <View style={styles.form}>
            <Button
              title={t("auth.forgotPassword")}
              onPress={() => router.replace("/(auth)/forgot-password")}
            />
            <Pressable onPress={() => router.replace("/(auth)/login")}>
              <Text style={styles.link}>{t("auth.backToSignIn")}</Text>
            </Pressable>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll backgroundColor={colors.screenBg}>
      <View style={styles.header}>
        <Text style={styles.brand}>sheger</Text>
        <Text style={styles.title}>{t("auth.resetPasswordTitle")}</Text>
        <Text style={styles.subtitle}>{t("auth.resetPasswordSubtitle")}</Text>
      </View>

      <View style={styles.card}>
        <BookingHeader title={t("auth.resetPasswordTitle")} backTo="/(auth)/login" />
        <View style={styles.form}>
          <Input
            label={t("auth.newPassword")}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder={t("auth.passwordPlaceholder")}
          />
          <Input
            label={t("auth.confirmPassword")}
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t("auth.passwordPlaceholder")}
          />
          <Button
            title={t("auth.saveNewPassword")}
            onPress={onSubmit}
            loading={loading}
          />
          <Pressable
            onPress={async () => {
              await supabase.auth.signOut();
              router.replace("/(auth)/login");
            }}
          >
            <Text style={styles.link}>{t("auth.backToSignIn")}</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
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
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  form: { gap: 16, marginTop: 8 },
  link: { textAlign: "center", color: colors.primary, fontWeight: "500", marginTop: 8 },
});
