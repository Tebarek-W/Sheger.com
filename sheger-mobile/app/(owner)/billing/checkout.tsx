import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import { cancelChapaPayment, parseTxRefFromUrl, verifyChapaPayment } from "@/lib/api/chapa";
import { initializeChapaSubscriptionPayment } from "@/lib/api/subscription";
import { buildChapaReceiptUrl } from "@/lib/chapa/receipt";
import { getChapaHttpsReturnUrlPrefix } from "@/lib/chapa/return-url";
import { getErrorMessage } from "@/lib/errors";
import type { BillingInterval } from "@/lib/types/database";

type CheckoutStatus = "preparing" | "browser" | "confirm" | "verifying" | "error" | "done";

function resolveParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value?.trim() || null;
}

function resolveInterval(value: string | string[] | undefined): BillingInterval {
  const raw = resolveParam(value);
  return raw === "yearly" ? "yearly" : "monthly";
}

export default function OwnerBillingCheckoutScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{
    businessId?: string | string[];
    planId?: string | string[];
    interval?: string | string[];
    planName?: string | string[];
  }>();
  const businessId = resolveParam(params.businessId);
  const planId = resolveParam(params.planId);
  const interval = resolveInterval(params.interval);
  const planName = resolveParam(params.planName);

  const queryClient = useQueryClient();

  const [status, setStatus] = useState<CheckoutStatus>("preparing");
  const [message, setMessage] = useState("");
  const [txRef, setTxRef] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    setMessage(t("owner.screens.billingCheckout.preparing"));
  }, [t]);

  const finishSubscription = useCallback(
    async (paymentTxRef: string) => {
      setStatus("verifying");
      setMessage(t("owner.screens.billingCheckout.verifying"));
      const verified = await verifyChapaPayment(paymentTxRef);
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: ["subscription-summary", businessId] });
        queryClient.invalidateQueries({ queryKey: ["subscription-payments", businessId] });
      }
      setStatus("done");
      setMessage(t("owner.screens.billingCheckout.activated"));

      const receiptRef = verified.chapa_reference ?? null;
      const receiptUrl = receiptRef ? buildChapaReceiptUrl(receiptRef) : null;

      Alert.alert(
        t("owner.screens.billingCheckout.activeTitle"),
        t("owner.screens.billingCheckout.activeMessage"),
        [
          ...(receiptUrl
            ? [{
                text: t("owner.screens.billingCheckout.viewReceipt"),
                onPress: () => {
                  void WebBrowser.openBrowserAsync(receiptUrl);
                  router.replace("/(owner)/billing");
                },
              }]
            : []),
          { text: t("common.done"), onPress: () => router.replace("/(owner)/billing") },
        ],
      );
    },
    [businessId, queryClient, t],
  );

  const cancelCheckout = useCallback(() => {
    if (!txRef) {
      router.replace("/(owner)/billing");
      return;
    }

    Alert.alert(
      t("owner.screens.billingCheckout.cancelTitle"),
      t("owner.screens.billingCheckout.cancelMessage"),
      [
        { text: t("owner.screens.billingCheckout.cancelKeep"), style: "cancel" },
        {
          text: t("owner.screens.billingCheckout.cancelConfirm"),
          style: "destructive",
          onPress: async () => {
            try {
              await cancelChapaPayment({ txRef });
            } catch {
              // Checkout may already be expired on Chapa's side.
            }
            router.replace("/(owner)/billing");
          },
        },
      ],
    );
  }, [t, txRef]);

  const confirmPayment = useCallback(async () => {
    if (!txRef) return;
    try {
      await finishSubscription(txRef);
    } catch (error) {
      setStatus("confirm");
      setMessage(getErrorMessage(error));
    }
  }, [finishSubscription, txRef]);

  const openChapaCheckout = useCallback(
    async (url: string, paymentTxRef: string) => {
      const chapaReturnPrefix = getChapaHttpsReturnUrlPrefix();
      setStatus("browser");
      setMessage(t("owner.screens.billingCheckout.browserMessage"));

      const session = await WebBrowser.openAuthSessionAsync(url, chapaReturnPrefix);

      const sessionUrl =
        session.type === "success" && session.url && !session.url.trimStart().startsWith("<!")
          ? session.url
          : null;

      if (session.type === "success" || sessionUrl) {
        const resolvedTxRef = parseTxRefFromUrl(sessionUrl ?? "") ?? paymentTxRef;
        try {
          await finishSubscription(resolvedTxRef);
          return;
        } catch {
          // Payment may still be processing on Chapa's side.
        }
      } else {
        try {
          setStatus("verifying");
          setMessage(t("owner.screens.billingCheckout.verifying"));
          await finishSubscription(paymentTxRef);
          return;
        } catch {
          // Fall through to manual confirm UI.
        }
      }

      setStatus("confirm");
      setMessage(t("owner.screens.billingCheckout.confirmHint"));
    },
    [finishSubscription, t],
  );

  const startHostedCheckout = useCallback(async () => {
    if (!businessId || !planId) return;

    setStatus("preparing");
    setMessage(t("owner.screens.billingCheckout.preparing"));

    try {
      const result = await initializeChapaSubscriptionPayment(businessId, planId, interval);
      setTxRef(result.tx_ref);
      setCheckoutUrl(result.checkout_url);
      await openChapaCheckout(result.checkout_url, result.tx_ref);
    } catch (error) {
      setStatus("error");
      setMessage(getErrorMessage(error));
    }
  }, [businessId, interval, openChapaCheckout, planId, t]);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  useEffect(() => {
    if (!businessId || !planId || startedRef.current) return;
    startedRef.current = true;
    void startHostedCheckout();
  }, [businessId, planId, startHostedCheckout]);

  if (!businessId || !planId) {
    return (
      <Screen>
        <Header title={t("owner.screens.billingCheckout.title")} showBack backTo="/(owner)/billing" />
        <Text style={styles.errorText}>{t("owner.screens.billingCheckout.missingDetails")}</Text>
      </Screen>
    );
  }

  return (
    <Screen padded={false} style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.headerPad}>
          <Header
            title={t("owner.screens.billingCheckout.title")}
            subtitle={planName ? `${planName} · ${interval}` : undefined}
            showBack
            backTo="/(owner)/billing"
          />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{t("owner.screens.billingCheckout.infoTitle")}</Text>
          <Text style={styles.infoText}>{t("owner.screens.billingCheckout.infoText")}</Text>
          <Text style={styles.infoNote}>{t("owner.screens.billingCheckout.testModeNote")}</Text>
        </View>

        <View style={styles.center}>
          {status === "preparing" || status === "browser" || status === "verifying" ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : null}
          <Text style={status === "error" ? styles.errorText : styles.statusText}>{message}</Text>

          {status === "confirm" && checkoutUrl && txRef ? (
            <>
              <Button
                title={t("owner.screens.billingCheckout.openChapa")}
                onPress={() => openChapaCheckout(checkoutUrl, txRef)}
              />
              <Button
                title={t("owner.screens.billingCheckout.confirmPaid")}
                variant="outline"
                onPress={confirmPayment}
              />
            </>
          ) : null}

          {status === "error" ? (
            <Button title={t("owner.screens.billingCheckout.tryAgain")} onPress={startHostedCheckout} />
          ) : null}

          {status === "error" || status === "confirm" ? (
            <Pressable onPress={() => router.replace("/(owner)/billing")}>
              <Text style={styles.cancelLink}>{t("owner.screens.billingCheckout.backToBilling")}</Text>
            </Pressable>
          ) : null}

          {status === "confirm" || status === "browser" ? (
            <Pressable onPress={cancelCheckout}>
              <Text style={styles.cancelLink}>{t("owner.screens.billingCheckout.cancelLink")}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1 },
  headerPad: { paddingHorizontal: 16, paddingTop: 16 },
  infoCard: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  infoTitle: { fontSize: 15, fontWeight: "700", color: colors.primaryDarker },
  infoText: { fontSize: 14, color: colors.textMuted, lineHeight: 21 },
  infoNote: { fontSize: 13, color: colors.textMuted, lineHeight: 20, fontStyle: "italic" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 24,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  errorText: {
    color: colors.text,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  cancelLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "500",
  },
});
