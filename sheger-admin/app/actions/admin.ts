"use server";

import { revalidatePath } from "next/cache";

import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server Actions run as POST endpoints and use the service-role client, which
 * bypasses RLS. Authorization must therefore be enforced here in every action
 * rather than relying on middleware alone.
 */
async function requireAdmin() {
  const { isAdmin } = await getSessionProfile();
  if (!isAdmin) {
    throw new Error("Forbidden: admin access required");
  }
}

export async function updateBusinessStatus(
  businessId: string,
  status: "approved" | "rejected" | "suspended" | "pending",
) {
  await requireAdmin();
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
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", bookingId);

  if (error) throw error;
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
}
