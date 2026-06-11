"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";

export async function updateBusinessStatus(
  businessId: string,
  status: "approved" | "rejected" | "suspended" | "pending",
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("businesses")
    .update({ status })
    .eq("id", businessId);

  if (error) throw error;
  revalidatePath("/dashboard/businesses");
  revalidatePath("/dashboard");
}

export async function updateBookingStatus(
  bookingId: string,
  status: "pending" | "confirmed" | "cancelled" | "completed",
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", bookingId);

  if (error) throw error;
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
}

export async function updateUserRole(
  userId: string,
  role: "customer" | "business_owner" | "admin",
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (error) throw error;
  revalidatePath("/dashboard/users");
}
