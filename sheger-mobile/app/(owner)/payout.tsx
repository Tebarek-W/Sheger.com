import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";

import { BankPicker } from "@/components/owner/BankPicker";
import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import { useOwnerBusiness } from "@/hooks/useOwnerBusiness";
import {
  fetchBusinessCommissionRate,
  fetchBusinessPayoutAccount,
  fetchChapaBanks,
  formatCommissionRate,
  maskAccountNumber,
  saveBusinessPayoutAccount,
} from "@/lib/api/payout";
import { getErrorMessage } from "@/lib/errors";
import { goBackSafely } from "@/lib/routing";

export default function OwnerPayoutScreen() {
  const { t } = useI18n();
  const { business } = useOwnerBusiness();
  const queryClient = useQueryClient();
  const [bankCode, setBankCode] = useState<number | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const {
    data: banks = [],
    isLoading: banksLoading,
    isError: banksError,
    error: banksLoadError,
    refetch: refetchBanks,
  } = useQuery({
    queryKey: ["chapa-banks"],
    queryFn: fetchChapaBanks,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  const { data: payoutAccount, isLoading: payoutLoading } = useQuery({
    queryKey: ["business-payout", business?.id],
    queryFn: () => fetchBusinessPayoutAccount(business!.id),
    enabled: Boolean(business?.id),
  });

  const { data: commissionRate } = useQuery({
    queryKey: ["business-commission-rate", business?.id],
    queryFn: () => fetchBusinessCommissionRate(business!.id),
    enabled: Boolean(business?.id),
  });

  useEffect(() => {
    if (!payoutAccount) return;
    setBankCode(payoutAccount.bank_code);
    setAccountNumber(payoutAccount.account_number);
    setAccountName(payoutAccount.account_name);
  }, [payoutAccount]);

  const selectedBank = useMemo(
    () => banks.find((bank) => bank.id === bankCode) ?? null,
    [banks, bankCode],
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      saveBusinessPayoutAccount({
        businessId: business!.id,
        bankCode: bankCode!,
        accountNumber,
        accountName,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-payout", business?.id] });
      Alert.alert(t("owner.payout.savedTitle"), t("owner.payout.savedText"), [
        { text: "OK", onPress: () => goBackSafely("/(owner)/dashboard") },
      ]);
    },
    onError: (error) => Alert.alert("Error", getErrorMessage(error)),
  });

  const onSave = () => {
    if (banks.length === 0) {
      Alert.alert("Error", t("owner.payout.banksLoadError"));
      return;
    }
    if (!bankCode) {
      Alert.alert("Error", t("owner.payout.bankRequired"));
      return;
    }
    if (!accountNumber.trim() || !accountName.trim()) {
      Alert.alert("Error", t("owner.payout.detailsRequired"));
      return;
    }
    saveMutation.mutate();
  };

  if (!business) {
    return (
      <Screen>
        <Header title={t("owner.payout.title")} showBack />
        <Text style={styles.muted}>{t("owner.registerText")}</Text>
      </Screen>
    );
  }

  if (business.status !== "approved") {
    return (
      <Screen>
        <Header title={t("owner.payout.title")} showBack />
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{t("owner.payout.approvalRequired")}</Text>
        </View>
      </Screen>
    );
  }

  const loading = banksLoading || payoutLoading;
  const canSave = banks.length > 0 && Boolean(bankCode) && !saveMutation.isPending;

  return (
    <Screen scroll>
      <Header title={t("owner.payout.title")} subtitle={t("owner.payout.subtitle")} showBack />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("owner.payout.howItWorksTitle")}</Text>
        <Text style={styles.cardText}>{t("owner.payout.howItWorksText")}</Text>
        {commissionRate != null ? (
          <Text style={styles.commission}>
            {t("owner.payout.commissionRate", {
              rate: formatCommissionRate(commissionRate),
            })}
          </Text>
        ) : null}
      </View>

      {payoutAccount ? (
        <View style={styles.activeCard}>
          <Text style={styles.activeTitle}>{t("owner.payout.activeTitle")}</Text>
          <Text style={styles.activeText}>
            {selectedBank?.name ?? `Bank #${payoutAccount.bank_code}`} ·{" "}
            {maskAccountNumber(payoutAccount.account_number)}
          </Text>
          <Text style={styles.activeMeta}>{payoutAccount.account_name}</Text>
        </View>
      ) : (
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>{t("owner.payout.missingTitle")}</Text>
          <Text style={styles.warningText}>{t("owner.payout.missingText")}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      ) : banksError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>{t("owner.payout.banksLoadError")}</Text>
          <Text style={styles.errorText}>{getErrorMessage(banksLoadError)}</Text>
          <Button title={t("common.tryAgain")} onPress={() => refetchBanks()} />
        </View>
      ) : (
        <View style={styles.form}>
          <BankPicker
            banks={banks}
            value={bankCode}
            onChange={setBankCode}
            label={t("owner.payout.bankLabel")}
            placeholder={t("owner.payout.bankPlaceholder")}
            searchPlaceholder={t("owner.payout.bankSearchPlaceholder")}
          />

          <Input
            label={t("owner.payout.accountNameLabel")}
            value={accountName}
            onChangeText={setAccountName}
            autoCapitalize="words"
          />
          <Input
            label={t("owner.payout.accountNumberLabel")}
            value={accountNumber}
            onChangeText={setAccountNumber}
            keyboardType="number-pad"
          />

          <Button
            title={
              payoutAccount ? t("owner.payout.updateButton") : t("owner.payout.saveButton")
            }
            onPress={onSave}
            loading={saveMutation.isPending}
            disabled={!canSave}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, marginTop: 16 },
  notice: {
    marginTop: 16,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: 16,
  },
  noticeText: { color: colors.primaryDarker, lineHeight: 22 },
  card: {
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.primaryDarker },
  cardText: { fontSize: 14, color: colors.textMuted, lineHeight: 21 },
  commission: { fontSize: 14, fontWeight: "600", color: colors.primary },
  activeCard: {
    marginTop: 12,
    backgroundColor: "#e8f6ee",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#b9e3cb",
    padding: 16,
    gap: 4,
  },
  activeTitle: { fontSize: 15, fontWeight: "700", color: "#1f6b43" },
  activeText: { fontSize: 14, color: "#2d5a40" },
  activeMeta: { fontSize: 13, color: "#4b6f57" },
  warningCard: {
    marginTop: 12,
    backgroundColor: "#fff4e8",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#f0d2a8",
    padding: 16,
    gap: 6,
  },
  warningTitle: { fontSize: 15, fontWeight: "700", color: "#8a4b12" },
  warningText: { fontSize: 14, color: "#7a5a33", lineHeight: 21 },
  errorCard: {
    marginTop: 16,
    backgroundColor: colors.errorBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 16,
    gap: 10,
  },
  errorTitle: { fontSize: 15, fontWeight: "700", color: colors.error },
  errorText: { fontSize: 14, color: "#991b1b", lineHeight: 20 },
  loader: { marginTop: 24 },
  form: { marginTop: 16, gap: 12 },
});
