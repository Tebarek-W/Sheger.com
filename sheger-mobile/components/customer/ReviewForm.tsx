import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";

import { StarRating } from "@/components/customer/StarRating";
import { Button } from "@/components/ui/Button";
import { colors, radius } from "@/constants/theme";
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
      Alert.alert("Thank you!", "Your review has been posted.");
      onSuccess?.();
    },
    onError: (error) => Alert.alert("Could not post review", getErrorMessage(error)),
  });

  const submit = () => {
    if (rating < 1) {
      Alert.alert("Rating required", "Please select a star rating.");
      return;
    }
    mutation.mutate();
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Rate your visit</Text>
      {serviceLabel ? <Text style={styles.subtitle}>{serviceLabel}</Text> : null}
      <Text style={styles.label}>Your rating</Text>
      <StarRating value={rating} onChange={setRating} size={28} />
      <Text style={styles.label}>Comment (optional)</Text>
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="Share your experience..."
        placeholderTextColor={colors.textTertiary}
        multiline
        style={styles.input}
      />
      <Button
        title="Submit review"
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
