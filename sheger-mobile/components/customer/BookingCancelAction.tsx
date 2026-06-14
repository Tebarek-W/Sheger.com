import { useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { colors, radius } from "@/constants/theme";
import { cancelCustomerBooking } from "@/lib/api/bookings";
import {
  DEFAULT_CANCELLATION_HOURS,
  getCancellationConfirmMessage,
  getCancellationEligibility,
  getCancellationPolicyText,
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
  const eligibility = useMemo(
    () => getCancellationEligibility(scheduledAt, cancellationHours),
    [scheduledAt, cancellationHours],
  );

  const mutation = useMutation({
    mutationFn: () => cancelCustomerBooking(bookingId),
    onSuccess: () => {
      Alert.alert("Booking cancelled", "Your appointment has been cancelled.");
      onCancelled();
    },
    onError: (error) => Alert.alert("Could not cancel", parseCancellationApiError(error)),
  });

  if (!CANCELLABLE.includes(status)) return null;

  const showBlockedInfo = () => {
    Alert.alert(
      "Cancellation not available",
      eligibility.reason ?? getCancellationPolicyText(cancellationHours),
    );
  };

  const confirmCancel = () => {
    Alert.alert(
      "Cancel this booking?",
      getCancellationConfirmMessage(businessName, cancellationHours),
      [
        { text: "Keep booking", style: "cancel" },
        {
          text: "Yes, cancel booking",
          style: "destructive",
          onPress: () => mutation.mutate(),
        },
      ],
    );
  };

  if (!eligibility.allowed) {
    return (
      <Pressable onPress={showBlockedInfo} style={styles.blockedWrap}>
        <Text style={styles.blockedTitle}>Cancellation not available</Text>
        <Text style={styles.blockedText}>{eligibility.reason}</Text>
        <Text style={styles.blockedLink}>Tap for policy details</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.policyHint}>{getCancellationPolicyText(cancellationHours)}</Text>
      <Button
        title="Cancel booking"
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
