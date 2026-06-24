import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { BookingHeader } from "@/components/ui/BookingHeader";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import { getErrorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import type { UserRole } from "@/lib/types/database";

export default function SignupScreen() {
  const { t } = useI18n();
  const [accountType, setAccountType] = useState<"customer" | "business_owner">("customer");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSignup = async () => {
    if (!fullName || !email || !password) {
      Alert.alert(t("auth.missingFields"), t("auth.fillNameEmailPassword"));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          role: accountType satisfies UserRole,
        },
      },
    });
    setLoading(false);
    if (error) {
      Alert.alert(t("auth.signUpFailed"), getErrorMessage(error));
      return;
    }
    const message =
      accountType === "business_owner"
        ? t("auth.signInToRegister")
        : t("auth.canSignInNow");
    Alert.alert(t("auth.accountCreated"), message, [
      { text: t("common.ok"), onPress: () => router.replace("/(auth)/login") },
    ]);
  };

  return (
    <Screen scroll backgroundColor={colors.screenBg}>
      <View style={styles.header}>
        <Text style={styles.brand}>sheger</Text>
        <Text style={styles.title}>{t("auth.createAccountTitle")}</Text>
        <Text style={styles.subtitle}>
          {accountType === "business_owner"
            ? t("auth.listBusiness")
            : t("auth.joinCustomer")}
        </Text>
      </View>

      <View style={styles.card}>
        <BookingHeader title={t("common.signUp")} backTo="/" />

        <Text style={styles.typeLabel}>{t("auth.iAmA")}</Text>
        <View style={styles.typeRow}>
          <Pressable
            onPress={() => setAccountType("customer")}
            style={[styles.typeBtn, accountType === "customer" && styles.typeBtnActive]}
          >
            <Text style={[styles.typeText, accountType === "customer" && styles.typeTextActive]}>
              {t("common.customer")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setAccountType("business_owner")}
            style={[styles.typeBtn, accountType === "business_owner" && styles.typeBtnActive]}
          >
            <Text
              style={[styles.typeText, accountType === "business_owner" && styles.typeTextActive]}
            >
              {t("common.businessOwner")}
            </Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          <Input
            label={t("auth.fullName")}
            value={fullName}
            onChangeText={setFullName}
            placeholder={t("auth.namePlaceholder")}
          />
          <Input
            label={t("auth.phone")}
            value={phone}
            onChangeText={setPhone}
            placeholder={t("auth.phonePlaceholder")}
            keyboardType="phone-pad"
          />
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
            placeholder={t("auth.passwordPlaceholder")}
          />
          <Button
            title={
              accountType === "business_owner"
                ? t("auth.createBusinessAccount")
                : t("common.createAccount")
            }
            onPress={onSignup}
            loading={loading}
          />
          <Pressable onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.link}>{t("auth.hasAccount")}</Text>
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
  typeLabel: { fontSize: 13, fontWeight: "500", color: colors.textSecondary, marginTop: 8, marginBottom: 8 },
  typeRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  typeBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.screenBg,
  },
  typeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeText: { fontWeight: "500", color: colors.text, fontSize: 14 },
  typeTextActive: { color: colors.white },
  form: { gap: 16 },
  link: { textAlign: "center", color: colors.primary, fontWeight: "500", marginTop: 8 },
});
