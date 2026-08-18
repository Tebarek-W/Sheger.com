import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { AuthBrandHeader } from "@/components/brand/AuthBrandHeader";
import { Button } from "@/components/ui/Button";
import { BookingHeader } from "@/components/ui/BookingHeader";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { colors } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import { redirectAfterAuth } from "@/lib/auth-booking";
import { getErrorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { isValidEmail, normalizeEmail } from "@/lib/validation/contact";

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

    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      Alert.alert(t("auth.loginFailed"), t("auth.invalidEmailMessage"));
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    setLoading(false);
    if (error) {
      Alert.alert(t("auth.loginFailed"), getErrorMessage(error));
      return;
    }
    await redirectAfterAuth(data.user.id);
  };

  return (
    <Screen scroll backgroundColor={colors.screenBg}>
      <AuthBrandHeader title={t("auth.welcomeBack")} subtitle={t("auth.signInSubtitle")} />

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
          <Pressable onPress={() => router.push("/(auth)/forgot-password")} style={styles.forgotWrap}>
            <Text style={styles.forgot}>{t("auth.forgotPassword")}</Text>
          </Pressable>
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
  card: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  form: { gap: 16, marginTop: 8 },
  forgotWrap: { alignSelf: "flex-end", marginTop: -8 },
  forgot: { color: colors.primary, fontWeight: "500", fontSize: 13 },
  link: { textAlign: "center", color: colors.primary, fontWeight: "500", marginTop: 8 },
});
