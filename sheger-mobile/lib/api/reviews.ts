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
    .order("created_at", { ascending: false });

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
    .eq("business_id", businessId);

  if (error) throw error;
  const ratings = data ?? [];
  if (!ratings.length) return { average: null as number | null, count: 0 };

  const sum = ratings.reduce((acc, row) => acc + row.rating, 0);
  return { average: sum / ratings.length, count: ratings.length };
}

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
