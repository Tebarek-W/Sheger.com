import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text } from "react-native";

import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { deleteOwnAccount } from "@/lib/api/account";
import { getErrorMessage } from "@/lib/errors";
import { colors, typography } from "@/constants/theme";

type DeleteAccountButtonProps = {
  /** Extra warning for business owners whose listing will be removed. */
  ownerWarning?: boolean;
};

export function DeleteAccountButton({ ownerWarning = false }: DeleteAccountButtonProps) {
  const { t } = useI18n();
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const runDelete = async () => {
    setLoading(true);
    try {
      await deleteOwnAccount();
      try {
        await signOut();
      } catch {
        // Session may already be invalid after auth user deletion.
      }
      Alert.alert(t("profile.deleteAccount.doneTitle"), t("profile.deleteAccount.doneMessage"));
    } catch (error) {
      Alert.alert(t("profile.deleteAccount.failedTitle"), getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const confirmFinal = () => {
    Alert.alert(
      t("profile.deleteAccount.confirmTitle"),
      ownerWarning
        ? t("profile.deleteAccount.confirmOwnerMessage")
        : t("profile.deleteAccount.confirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("profile.deleteAccount.confirmAction"),
          style: "destructive",
          onPress: () => {
            void runDelete();
          },
        },
      ],
    );
  };

  const onPress = () => {
    if (loading) return;
    Alert.alert(
      t("profile.deleteAccount.title"),
      ownerWarning
        ? t("profile.deleteAccount.ownerWarning")
        : t("profile.deleteAccount.warning"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("profile.deleteAccount.continue"),
          style: "destructive",
          onPress: confirmFinal,
        },
      ],
    );
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed, loading && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={t("profile.deleteAccount.title")}
    >
      <Text style={styles.text}>
        {loading ? t("profile.deleteAccount.deleting") : t("profile.deleteAccount.title")}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  text: {
    ...typography.bodyMedium,
    color: colors.error,
    fontSize: 15,
  },
});
