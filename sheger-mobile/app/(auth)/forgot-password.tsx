import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { BookingHeader } from "@/components/ui/BookingHeader";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { colors } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import { requestPasswordReset } from "@/lib/api/auth";
import { getErrorMessage } from "@/lib/errors";
import { isValidEmail, normalizeEmail } from "@/lib/validation/contact";

export default function ForgotPasswordScreen() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email.trim()) {
      Alert.alert(t("auth.missingFields"), t("auth.forgotPasswordEnterEmail"));
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      Alert.alert(t("auth.resetFailed"), t("auth.invalidEmailMessage"));
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(normalizedEmail);
      Alert.alert(t("auth.resetEmailSentTitle"), t("auth.resetEmailSentMessage"), [
        { text: t("common.ok"), onPress: () => router.replace("/(auth)/login") },
      ]);
    } catch (error) {
      const message = getErrorMessage(error);
      if (message === "INVALID_EMAIL") {
        Alert.alert(t("auth.resetFailed"), t("auth.invalidEmailMessage"));
      } else {
        Alert.alert(t("auth.resetFailed"), message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll backgroundColor={colors.screenBg}>
      <View style={styles.header}>
        <Text style={styles.brand}>sheger</Text>
        <Text style={styles.title}>{t("auth.forgotPasswordTitle")}</Text>
        <Text style={styles.subtitle}>{t("auth.forgotPasswordSubtitle")}</Text>
      </View>

      <View style={styles.card}>
        <BookingHeader title={t("auth.forgotPassword")} backTo="/(auth)/login" />
        <View style={styles.form}>
          <Input
            label={t("auth.email")}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder={t("auth.emailPlaceholder")}
          />
          <Button
            title={t("auth.sendResetLink")}
            onPress={onSubmit}
            loading={loading}
          />
          <Pressable onPress={() => router.replace("/(auth)/login")}>
            <Text style={styles.link}>{t("auth.backToSignIn")}</Text>
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
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  form: { gap: 16, marginTop: 8 },
  link: { textAlign: "center", color: colors.primary, fontWeight: "500", marginTop: 8 },
});
