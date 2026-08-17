import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { AuthBrandHeader } from "@/components/brand/AuthBrandHeader";
import { Button } from "@/components/ui/Button";
import { BookingHeader } from "@/components/ui/BookingHeader";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import { redirectAfterAuth } from "@/lib/auth-booking";
import { getErrorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import type { UserRole } from "@/lib/types/database";
import {
  isValidEmail,
  isValidEthiopianMobile,
  normalizeEmail,
  normalizeEthiopianMobile,
} from "@/lib/validation/contact";

export default function SignupScreen() {
  const { t } = useI18n();
  const [accountType, setAccountType] = useState<"customer" | "business_owner">("customer");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToLegal, setAgreedToLegal] = useState(false);
  const [loading, setLoading] = useState(false);

  const onChangePhone = (value: string) => {
    const sanitized = value.replace(/[^\d+]/g, "");
    const clamped = sanitized.startsWith("+") ? sanitized.slice(0, 13) : sanitized.slice(0, 10);
    setPhone(clamped);
  };

  const onSignup = async () => {
    if (!fullName || !email || !password) {
      Alert.alert(t("auth.missingFields"), t("auth.fillNameEmailPassword"));
      return;
    }

    if (!agreedToLegal) {
      Alert.alert(t("auth.missingFields"), t("legal.mustAgree"));
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizeEthiopianMobile(phone);

    if (!isValidEmail(normalizedEmail)) {
      Alert.alert(t("auth.signUpFailed"), t("auth.invalidEmailMessage"));
      return;
    }

    if (phone.trim() && !isValidEthiopianMobile(phone)) {
      Alert.alert(t("auth.signUpFailed"), t("auth.invalidPhoneMessage"));
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          phone: normalizedPhone,
          role: accountType satisfies UserRole,
        },
      },
    });
    setLoading(false);
    if (error) {
      Alert.alert(t("auth.signUpFailed"), getErrorMessage(error));
      return;
    }
    if (data.session?.user.id) {
      await redirectAfterAuth(data.session.user.id);
      return;
    }
    const message =
      accountType === "business_owner"
        ? t("auth.signInToRegister")
        : t("auth.confirmEmailToSignIn");
    Alert.alert(t("auth.accountCreated"), message, [
      { text: t("common.ok"), onPress: () => router.replace("/(auth)/login") },
    ]);
  };

  return (
    <Screen scroll backgroundColor={colors.screenBg}>
      <AuthBrandHeader
        title={t("auth.createAccountTitle")}
        subtitle={
          accountType === "business_owner"
            ? t("auth.listBusiness")
            : t("auth.joinCustomer")
        }
      />

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
            onChangeText={onChangePhone}
            placeholder={t("auth.phonePlaceholder")}
            keyboardType="phone-pad"
            maxLength={13}
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

          <Pressable
            style={styles.agreeRow}
            onPress={() => setAgreedToLegal((value) => !value)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreedToLegal }}
          >
            <View style={[styles.checkbox, agreedToLegal && styles.checkboxOn]}>
              {agreedToLegal ? <Text style={styles.checkboxMark}>✓</Text> : null}
            </View>
            <Text style={styles.agreeText}>
              {t("legal.agreePrefix")}{" "}
              <Text style={styles.agreeLink} onPress={() => router.push("/legal/terms")}>
                {t("profile.terms")}
              </Text>{" "}
              {t("common.and")}{" "}
              <Text style={styles.agreeLink} onPress={() => router.push("/legal/privacy")}>
                {t("profile.privacy")}
              </Text>
              .
            </Text>
          </Pressable>

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
  card: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  typeLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: 8,
  },
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
  agreeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.screenBg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxMark: { color: colors.white, fontSize: 13, fontWeight: "700" },
  agreeText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  agreeLink: {
    color: colors.primary,
    fontWeight: "600",
  },
  link: { textAlign: "center", color: colors.primary, fontWeight: "500", marginTop: 8 },
});
