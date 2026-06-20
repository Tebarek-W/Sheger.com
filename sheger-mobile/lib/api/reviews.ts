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
    .eq("business_id", businessId);

  if (error) throw error;
  const ratings = data ?? [];
  if (!ratings.length) return { average: null as number | null, count: 0 };

  const sum = ratings.reduce((acc, row) => acc + row.rating, 0);
  return { average: sum / ratings.length, count: ratings.length };
}

export type RatingSummary = { average: number | null; count: number };
export type RatingMap = Record<string, RatingSummary>;

/**
 * Rating summaries for every business, keyed by business id. Used by discovery
 * (search / nearby / home) so we don't fire one request per card. Aggregation
 * runs in the database via RPC; if the RPC isn't deployed yet we fall back to
 * client-side aggregation so the app keeps working.
 */
export async function fetchAllBusinessRatings(): Promise<RatingMap> {
  // RPC isn't in the generated schema types, so call it untyped and validate.
  const rpc = (await (
    supabase.rpc as unknown as (
      fn: string,
    ) => Promise<{
      data: { business_id: string; average: number | null; review_count: number }[] | null;
      error: unknown;
    }>
  )("get_business_rating_summaries"));

  if (!rpc.error && rpc.data) {
    const map: RatingMap = {};
    for (const row of rpc.data) {
      map[row.business_id] = {
        average: row.average != null ? Number(row.average) : null,
        count: Number(row.review_count),
      };
    }
    return map;
  }

  const { data, error } = await supabase
    .from("reviews")
    .select("business_id, rating");

  if (error) throw error;

  const totals = new Map<string, { sum: number; count: number }>();
  for (const row of data ?? []) {
    const current = totals.get(row.business_id) ?? { sum: 0, count: 0 };
    current.sum += row.rating;
    current.count += 1;
    totals.set(row.business_id, current);
  }

  const map: RatingMap = {};
  for (const [businessId, { sum, count }] of totals) {
    map[businessId] = { average: count ? sum / count : null, count };
  }
  return map;
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
