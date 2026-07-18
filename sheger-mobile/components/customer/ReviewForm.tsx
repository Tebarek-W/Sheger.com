import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";

import { StarRating } from "@/components/customer/StarRating";
import { Button } from "@/components/ui/Button";
import { colors, radius } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import { createReview } from "@/lib/api/reviews";
import { getErrorMessage } from "@/lib/errors";

type ReviewFormProps = {
  businessId: string;
  customerId: string;
  bookingId: string;
  serviceLabel?: string;
  onSuccess?: () => void;
};

export function ReviewForm({
  businessId,
  customerId,
  bookingId,
  serviceLabel,
  onSuccess,
}: ReviewFormProps) {
  const { t } = useI18n();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      createReview({
        bookingId,
        businessId,
        customerId,
        rating,
        comment,
      }),
    onSuccess: () => {
      Alert.alert(
        t("customer.reviewForm.thankYouTitle"),
        t("customer.reviewForm.thankYouMessage"),
      );
      onSuccess?.();
    },
    onError: (error) =>
      Alert.alert(t("customer.reviewForm.postFailedTitle"), getErrorMessage(error)),
  });

  const submit = () => {
    if (rating < 1) {
      Alert.alert(
        t("customer.reviewForm.ratingRequiredTitle"),
        t("customer.reviewForm.ratingRequiredMessage"),
      );
      return;
    }
    mutation.mutate();
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("customer.reviewForm.title")}</Text>
      {serviceLabel ? <Text style={styles.subtitle}>{serviceLabel}</Text> : null}
      <Text style={styles.label}>{t("customer.reviewForm.yourRating")}</Text>
      <StarRating value={rating} onChange={setRating} size={28} />
      <Text style={styles.label}>{t("customer.reviewForm.commentOptional")}</Text>
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder={t("customer.reviewForm.commentPlaceholder")}
        placeholderTextColor={colors.textTertiary}
        multiline
        style={styles.input}
      />
      <Button
        title={t("customer.reviewForm.submit")}
        onPress={submit}
        loading={mutation.isPending}
        disabled={rating < 1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.screenBg,
    borderRadius: radius.lg,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  title: { fontSize: 15, fontWeight: "600", color: colors.text },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: -4 },
  label: { fontSize: 12, fontWeight: "500", color: colors.textSecondary },
  input: {
    minHeight: 88,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: "top",
  },
});
