import { useMutation } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { colors, radius } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import { cancelCustomerBooking } from "@/lib/api/bookings";
import {
  DEFAULT_CANCELLATION_HOURS,
  getCancellationEligibility,
  parseCancellationApiError,
} from "@/lib/booking/cancellation";
import type { BookingStatus } from "@/lib/types/database";

type BookingCancelActionProps = {
  bookingId: string;
  scheduledAt: string;
  status: BookingStatus;
  businessName: string;
  cancellationHours?: number;
  onCancelled: () => void;
};

const CANCELLABLE: BookingStatus[] = ["pending"];

export function BookingCancelAction({
  bookingId,
  scheduledAt,
  status,
  businessName,
  cancellationHours = DEFAULT_CANCELLATION_HOURS,
  onCancelled,
}: BookingCancelActionProps) {
  const { t } = useI18n();

  const getPolicyText = useCallback(
    (hours: number) =>
      hours === 1
        ? t("customer.cancellation.policyOneHour", { hours })
        : t("customer.cancellation.policy", { hours }),
    [t],
  );

  const getReasonText = useCallback(
    (elig: ReturnType<typeof getCancellationEligibility>) => {
      if (!elig.allowed) {
        if (elig.hoursRemaining === 0) {
          return t("customer.cancellation.reasonPassed");
        }
        if (elig.hoursRemaining != null) {
          const remaining = elig.hoursRemaining;
          const required = elig.hoursRequired;
          return remaining === 1
            ? t("customer.cancellation.reasonTooLateOne", { required, remaining })
            : t("customer.cancellation.reasonTooLate", { required, remaining });
        }
      }
      return getPolicyText(cancellationHours);
    },
    [cancellationHours, getPolicyText, t],
  );

  const eligibility = useMemo(
    () => getCancellationEligibility(scheduledAt, cancellationHours),
    [scheduledAt, cancellationHours],
  );

  const parseCancelError = useCallback(
    (error: unknown) => {
      const raw = parseCancellationApiError(error);
      if (raw.includes("Cancellations must be made at least")) {
        const match = raw.match(/at least (\d+) hours/i);
        const hours = match ? Number(match[1]) : DEFAULT_CANCELLATION_HOURS;
        return t("customer.cancellation.apiTooLate", { hours });
      }
      if (raw.includes("Only pending bookings")) {
        return t("customer.cancellation.apiNotPending");
      }
      return raw;
    },
    [t],
  );

  const mutation = useMutation({
    mutationFn: () => cancelCustomerBooking(bookingId),
    onSuccess: () => {
      Alert.alert(
        t("customer.cancellation.cancelledTitle"),
        t("customer.cancellation.cancelledMessage"),
      );
      onCancelled();
    },
    onError: (error) =>
      Alert.alert(t("customer.cancellation.cancelFailedTitle"), parseCancelError(error)),
  });

  if (!CANCELLABLE.includes(status)) return null;

  const policyText = getPolicyText(cancellationHours);
  const reasonText = getReasonText(eligibility);

  const showBlockedInfo = () => {
    Alert.alert(t("customer.cancellation.notAvailableTitle"), reasonText);
  };

  const confirmCancel = () => {
    Alert.alert(
      t("customer.cancellation.confirmTitle"),
      t("customer.cancellation.confirmMessage", { policy: policyText, business: businessName }),
      [
        { text: t("customer.cancellation.keepBooking"), style: "cancel" },
        {
          text: t("customer.cancellation.confirmCancel"),
          style: "destructive",
          onPress: () => mutation.mutate(),
        },
      ],
    );
  };

  if (!eligibility.allowed) {
    return (
      <Pressable onPress={showBlockedInfo} style={styles.blockedWrap}>
        <Text style={styles.blockedTitle}>{t("customer.cancellation.notAvailableTitle")}</Text>
        <Text style={styles.blockedText}>{reasonText}</Text>
        <Text style={styles.blockedLink}>{t("customer.cancellation.tapPolicy")}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.policyHint}>{policyText}</Text>
      <Button
        title={t("customer.cancellation.cancelBooking")}
        variant="outline"
        onPress={confirmCancel}
        loading={mutation.isPending}
        style={styles.cancelBtn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, gap: 8 },
  policyHint: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  cancelBtn: { borderColor: colors.error },
  blockedWrap: {
    marginTop: 10,
    backgroundColor: colors.errorBg,
    borderRadius: radius.md,
    padding: 12,
    gap: 4,
  },
  blockedTitle: { fontSize: 13, fontWeight: "600", color: colors.error },
  blockedText: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  blockedLink: { fontSize: 11, color: colors.primary, fontWeight: "500", marginTop: 2 },
});
