import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { colors } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { updateCustomerProfile } from "@/lib/api/profile";
import { getErrorMessage } from "@/lib/errors";
import { goBackSafely } from "@/lib/routing";

export default function EditProfileScreen() {
  const { profile, user, refreshProfile } = useAuth();
  const { t } = useI18n();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
    setEmail(user?.email ?? "");
  }, [profile?.full_name, profile?.phone, user?.email]);

  const onChangePhone = (value: string) => {
    const sanitized = value.replace(/[^\d+]/g, "");
    const clamped = sanitized.startsWith("+") ? sanitized.slice(0, 13) : sanitized.slice(0, 10);
    setPhone(clamped);
  };

  const mutation = useMutation({
    mutationFn: () =>
      updateCustomerProfile({
        fullName,
        phone,
        email,
      }),
    onSuccess: async (result) => {
      await refreshProfile();
      const message = result.emailConfirmationRequired
        ? t("profile.editEmailConfirm")
        : t("profile.editSaved");
      Alert.alert(t("profile.editTitle"), message, [
        { text: t("common.ok"), onPress: () => goBackSafely("/(app)/(tabs)/profile") },
      ]);
    },
    onError: (error) => {
      Alert.alert(t("profile.editFailed"), getErrorMessage(error));
    },
  });

  return (
    <Screen scroll backgroundColor={colors.screenBg}>
      <Header
        title={t("profile.editTitle")}
        showBack
        backTo="/(app)/(tabs)/profile"
      />

      <View style={styles.form}>
        <Text style={styles.hint}>{t("profile.editHint")}</Text>

        <Input
          label={t("auth.fullName")}
          value={fullName}
          onChangeText={setFullName}
          placeholder={t("auth.namePlaceholder")}
          autoCapitalize="words"
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
          value={email}
          onChangeText={setEmail}
          placeholder={t("auth.emailPlaceholder")}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Button
          title={mutation.isPending ? t("common.updating") : t("profile.saveChanges")}
          onPress={() => mutation.mutate()}
          disabled={mutation.isPending}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  hint: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
