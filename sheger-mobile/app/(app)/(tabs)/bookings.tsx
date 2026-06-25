import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { ReviewForm } from "@/components/customer/ReviewForm";
import { BookingCancelAction } from "@/components/customer/BookingCancelAction";
import { Button } from "@/components/ui/Button";
import { DualDateTime } from "@/components/ui/DualDateTime";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { fetchCustomerBookings } from "@/lib/api/bookings";
import { DEFAULT_CANCELLATION_HOURS } from "@/lib/booking/cancellation";
import { fetchReviewedBookingIds } from "@/lib/api/reviews";
import { formatBookingPrice } from "@/lib/services/pricing";
import type { BookingStatus } from "@/lib/types/database";

const STATUS_STYLES: Record<BookingStatus, { bg: string; text: string }> = {
  pending: { bg: "#faeeda", text: "#854f0b" },
  confirmed: { bg: colors.primaryLight, text: colors.primaryDark },
  cancelled: { bg: colors.errorBg, text: colors.error },
  completed: { bg: "#e6f1fb", text: "#185fa5" },
};

const PASSED_STATUS_STYLE = { bg: "#f3f4f6", text: "#6b7280" };

function isPassedPendingBooking(booking: { status: BookingStatus; scheduled_at: string }) {
  return booking.status === "pending" && new Date(booking.scheduled_at).getTime() < Date.now();
}

export default function BookingsScreen() {
  const { session, user } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);

  const { data: bookings, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["customer-bookings", user?.id],
    queryFn: () => fetchCustomerBookings(user!.id),
    enabled: Boolean(user?.id),
  });

  const { data: reviewedIds } = useQuery({
    queryKey: ["reviewed-booking-ids", user?.id],
    queryFn: () => fetchReviewedBookingIds(user!.id),
    enabled: Boolean(user?.id),
  });

  if (!session) {
    return (
      <Screen backgroundColor={colors.screenBg}>
        <View style={styles.guest}>
          <Text style={styles.guestEmoji}>📅</Text>
          <Text style={styles.guestTitle}>{t("bookings.guestTitle")}</Text>
          <Text style={styles.guestText}>{t("bookings.guestText")}</Text>
          <Button title={t("common.signIn")} onPress={() => router.push("/(auth)/login")} />
          <Button
            title={t("common.createAccount")}
            variant="outline"
            onPress={() => router.push("/(auth)/signup")}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll padded={false} backgroundColor={colors.screenBg}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("bookings.title")}</Text>
        <Text style={styles.subtitle}>{t("bookings.subtitle")}</Text>
      </View>

      <View style={styles.body}>
        <SectionHeader
          title={t("bookings.allAppointments")}
          actionLabel={isRefetching ? t("common.updating") : t("common.refresh")}
          onAction={() => refetch()}
        />

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : !bookings?.length ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>{t("bookings.emptyTitle")}</Text>
            <Text style={styles.emptyText}>{t("bookings.emptyText")}</Text>
            <Button title={t("bookings.exploreServices")} onPress={() => router.push("/(app)/(tabs)")} />
          </View>
        ) : (
          bookings.map((booking) => {
            const isPassed = isPassedPendingBooking(booking);
            const statusStyle = isPassed ? PASSED_STATUS_STYLE : STATUS_STYLES[booking.status];
            const canReview =
              booking.status === "completed" && !reviewedIds?.has(booking.id);
            const showingReview = reviewBookingId === booking.id;

            return (
              <View key={booking.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.serviceName}>
                    {booking.services?.name ?? "Service"}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.badgeText, { color: statusStyle.text }]}>
                      {isPassed ? t("bookings.status.passed") : t(`bookings.status.${booking.status}`)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.businessName}>
                  {booking.businesses?.name ?? "Business"}
                </Text>
                <DualDateTime iso={booking.scheduled_at} compact />
                {booking.businesses?.address || booking.businesses?.city ? (
                  <Text style={styles.meta}>
                    📍 {booking.businesses.address ?? booking.businesses.city}
                  </Text>
                ) : null}
                <Text style={styles.price}>{formatBookingPrice(booking)}</Text>

                {canReview && showingReview && user ? (
                  <ReviewForm
                    businessId={booking.business_id}
                    customerId={user.id}
                    bookingId={booking.id}
                    serviceLabel={booking.services?.name ?? undefined}
                    onSuccess={() => {
                      setReviewBookingId(null);
                      queryClient.invalidateQueries({ queryKey: ["reviewed-booking-ids"] });
                      queryClient.invalidateQueries({ queryKey: ["business-reviews"] });
                      queryClient.invalidateQueries({ queryKey: ["business-review-summary"] });
                      refetch();
                    }}
                  />
                ) : null}

                {canReview && !showingReview ? (
                  <Button
                    title={t("bookings.leaveReview")}
                    variant="outline"
                    onPress={() => setReviewBookingId(booking.id)}
                    style={styles.reviewBtn}
                  />
                ) : null}

                <BookingCancelAction
                  bookingId={booking.id}
                  scheduledAt={booking.scheduled_at}
                  status={booking.status}
                  businessName={booking.businesses?.name ?? "Business"}
                  cancellationHours={
                    booking.businesses?.cancellation_hours ?? DEFAULT_CANCELLATION_HOURS
                  }
                  onCancelled={() => {
                    queryClient.invalidateQueries({ queryKey: ["customer-bookings"] });
                    queryClient.invalidateQueries({ queryKey: ["available-slots"] });
                    refetch();
                  }}
                />
              </View>
            );
          })
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.brandDark,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  title: { fontSize: 22, fontWeight: "500", color: colors.white },
  subtitle: { fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 4 },
  body: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 },
  guest: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  guestEmoji: { fontSize: 48, marginBottom: 8 },
  guestTitle: { fontSize: 22, fontWeight: "500", color: colors.text },
  guestText: { fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 21 },
  center: { alignItems: "center", paddingVertical: 48 },
  empty: { alignItems: "center", paddingVertical: 48, gap: 10, paddingHorizontal: 16 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "500", color: colors.text },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 21 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
    gap: 4,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  serviceName: { fontSize: 15, fontWeight: "500", color: colors.text, flex: 1 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: { fontSize: 10, fontWeight: "600", textTransform: "capitalize" },
  businessName: { fontSize: 13, color: colors.primary, fontWeight: "500" },
  meta: { fontSize: 12, color: colors.textSecondary },
  price: { fontSize: 14, fontWeight: "500", color: colors.text, marginTop: 4 },
  reviewBtn: { marginTop: 10 },
});
