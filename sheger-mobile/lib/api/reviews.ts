import { supabase } from "@/lib/supabase";
import type { Booking, Review } from "@/lib/types/database";

export type ReviewWithCustomer = Review & {
  profiles: { full_name: string | null } | null;
};

export type ReviewableBooking = Pick<Booking, "id" | "scheduled_at"> & {
  services: { name: string } | null;
};

export async function fetchBusinessReviews(businessId: string) {
  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  if (!reviews?.length) return [] as ReviewWithCustomer[];

  const customerIds = [...new Set(reviews.map((r) => r.customer_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", customerIds);

  if (profilesError) throw profilesError;

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return reviews.map((review) => ({
    ...review,
    profiles: { full_name: nameById.get(review.customer_id) ?? null },
  })) as ReviewWithCustomer[];
}

export async function fetchBusinessReviewSummary(businessId: string) {
  const { data, error } = await supabase
    .from("reviews")
    .select("rating")
    .eq("business_id", businessId)
    .eq("is_hidden", false);

  if (error) throw error;
  const ratings = data ?? [];
  if (!ratings.length) return { average: null as number | null, count: 0 };

  const sum = ratings.reduce((acc, row) => acc + row.rating, 0);
  return { average: sum / ratings.length, count: ratings.length };
}

export type RatingSummary = { average: number | null; count: number };
export type RatingMap = Record<string, RatingSummary>;

export async function fetchReviewableBookings(
  customerId: string,
  businessId: string,
) {
  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("id, scheduled_at, services(name)")
    .eq("customer_id", customerId)
    .eq("business_id", businessId)
    .eq("status", "completed")
    .order("scheduled_at", { ascending: false });

  if (bookingsError) throw bookingsError;

  const { data: reviews, error: reviewsError } = await supabase
    .from("reviews")
    .select("booking_id")
    .eq("customer_id", customerId)
    .eq("business_id", businessId);

  if (reviewsError) throw reviewsError;

  const reviewed = new Set((reviews ?? []).map((r) => r.booking_id));
  return ((bookings ?? []) as ReviewableBooking[]).filter((b) => !reviewed.has(b.id));
}

export async function fetchReviewedBookingIds(customerId: string) {
  const { data, error } = await supabase
    .from("reviews")
    .select("booking_id")
    .eq("customer_id", customerId);

  if (error) throw error;
  return new Set((data ?? []).map((r) => r.booking_id));
}

export type CreateReviewInput = {
  bookingId: string;
  businessId: string;
  customerId: string;
  rating: number;
  comment?: string;
};

export async function createReview(input: CreateReviewInput) {
  const { data, error } = await supabase
    .from("reviews")
    .insert({
      booking_id: input.bookingId,
      business_id: input.businessId,
      customer_id: input.customerId,
      rating: input.rating,
      comment: input.comment?.trim() || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as Review;
}

export const REVIEW_REPORT_REASONS = [
  "spam",
  "offensive",
  "misleading",
  "other",
] as const;

export type ReviewReportReason = (typeof REVIEW_REPORT_REASONS)[number];

export async function reportReview(input: {
  reviewId: string;
  reason: ReviewReportReason;
  details?: string;
}) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Sign in required");

  const reasonLabel = input.details?.trim()
    ? `${input.reason}: ${input.details.trim()}`
    : input.reason;

  const { data, error } = await supabase
    .from("review_reports")
    .insert({
      review_id: input.reviewId,
      reporter_id: user.id,
      reason: reasonLabel.slice(0, 500),
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("ALREADY_REPORTED");
    }
    throw error;
  }
  return data;
}
