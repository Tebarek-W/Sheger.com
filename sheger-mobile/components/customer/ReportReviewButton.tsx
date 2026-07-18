import { Alert, Pressable, StyleSheet, Text } from "react-native";

import { useI18n } from "@/hooks/useI18n";
import { reportReview, type ReviewReportReason } from "@/lib/api/reviews";
import { getErrorMessage } from "@/lib/errors";
import { colors } from "@/constants/theme";

type ReportReviewButtonProps = {
  reviewId: string;
  /** Hide when this is the current user's own review. */
  isOwnReview?: boolean;
  signedIn: boolean;
};

const REASONS: ReviewReportReason[] = ["spam", "offensive", "misleading", "other"];

export function ReportReviewButton({
  reviewId,
  isOwnReview = false,
  signedIn,
}: ReportReviewButtonProps) {
  const { t } = useI18n();

  if (!signedIn || isOwnReview) return null;

  const submit = async (reason: ReviewReportReason) => {
    try {
      await reportReview({ reviewId, reason });
      Alert.alert(t("customer.reviews.report.thanksTitle"), t("customer.reviews.report.thanksMessage"));
    } catch (error) {
      const message = getErrorMessage(error);
      if (message === "ALREADY_REPORTED" || message.includes("duplicate")) {
        Alert.alert(
          t("customer.reviews.report.alreadyTitle"),
          t("customer.reviews.report.alreadyMessage"),
        );
        return;
      }
      Alert.alert(t("customer.reviews.report.failedTitle"), message);
    }
  };

  const onPress = () => {
    Alert.alert(t("customer.reviews.report.title"), t("customer.reviews.report.message"), [
      { text: t("common.cancel"), style: "cancel" },
      ...REASONS.map((reason) => ({
        text: t(`customer.reviews.report.reasons.${reason}`),
        onPress: () => {
          void submit(reason);
        },
      })),
    ]);
  };

  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
      <Text style={styles.link}>{t("customer.reviews.report.action")}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textTertiary,
    marginTop: 4,
  },
});
