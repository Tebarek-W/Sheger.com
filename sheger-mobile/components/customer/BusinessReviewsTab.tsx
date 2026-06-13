import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { ReviewForm } from "@/components/customer/ReviewForm";
import { StarRating } from "@/components/customer/StarRating";
import { Button } from "@/components/ui/Button";
import { colors, radius } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchBusinessReviews,
  fetchReviewableBookings,
} from "@/lib/api/reviews";
import type { ReviewWithCustomer } from "@/lib/api/reviews";

type BusinessReviewsTabProps = {
  businessId: string;
};

function reviewerName(review: ReviewWithCustomer) {
  const name = review.profiles?.full_name?.trim();
  if (!name) return "Sheger customer";
  return name.split(" ")[0];
}

export function BusinessReviewsTab({ businessId }: BusinessReviewsTabProps) {
  const { session, user } = useAuth();
  const queryClient = useQueryClient();

  const { data: reviews, isLoading, refetch } = useQuery({
    queryKey: ["business-reviews", businessId],
    queryFn: () => fetchBusinessReviews(businessId),
  });

  const { data: reviewable } = useQuery({
    queryKey: ["reviewable-bookings", businessId, user?.id],
    queryFn: () => fetchReviewableBookings(user!.id, businessId),
    enabled: Boolean(session && user?.id),
  });

  const pendingBooking = reviewable?.[0];

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View>
      {session && pendingBooking ? (
        <ReviewForm
          businessId={businessId}
          customerId={user!.id}
          bookingId={pendingBooking.id}
          serviceLabel={pendingBooking.services?.name ?? undefined}
          onSuccess={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ["reviewable-bookings", businessId] });
            queryClient.invalidateQueries({ queryKey: ["business-review-summary", businessId] });
            queryClient.invalidateQueries({ queryKey: ["customer-bookings"] });
            queryClient.invalidateQueries({ queryKey: ["reviewed-booking-ids"] });
          }}
        />
      ) : null}

      {!session ? (
        <View style={styles.authBanner}>
          <Text style={styles.authText}>Sign in to leave a review after your visit.</Text>
          <Button title="Sign in" onPress={() => router.push("/(auth)/login")} />
        </View>
      ) : session && !pendingBooking && reviewable !== undefined ? (
        <Text style={styles.hint}>
          Reviews are available after a completed appointment at this business.
        </Text>
      ) : null}

      {!reviews?.length ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No reviews yet</Text>
          <Text style={styles.emptyText}>Be the first to share your experience.</Text>
        </View>
      ) : (
        reviews.map((review) => (
          <View key={review.id} style={styles.reviewCard}>
            <View style={styles.reviewTop}>
              <Text style={styles.reviewer}>{reviewerName(review)}</Text>
              <Text style={styles.reviewDate}>
                {new Date(review.created_at).toLocaleDateString("en-ET", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </View>
            <StarRating value={review.rating} />
            {review.comment ? (
              <Text style={styles.comment}>{review.comment}</Text>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 32, alignItems: "center" },
  authBanner: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  authText: { fontSize: 13, color: colors.primaryDark, lineHeight: 18 },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 14,
    lineHeight: 17,
  },
  empty: { alignItems: "center", paddingVertical: 32, gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: "500", color: colors.text },
  emptyText: { fontSize: 13, color: colors.textSecondary },
  reviewCard: {
    backgroundColor: colors.screenBg,
    borderRadius: radius.md,
    padding: 14,
    gap: 8,
    marginBottom: 10,
  },
  reviewTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  reviewer: { fontSize: 14, fontWeight: "600", color: colors.text },
  reviewDate: { fontSize: 11, color: colors.textTertiary },
  comment: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
});
