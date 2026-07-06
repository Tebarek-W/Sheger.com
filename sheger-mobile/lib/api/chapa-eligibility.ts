import { supabase } from "@/lib/supabase";

export type ChapaBookingEligibility = {
  eligible: boolean;
  code?: "payout_not_configured";
};

export async function checkChapaBookingEligibility(
  businessId: string,
): Promise<ChapaBookingEligibility> {
  const { data, error } = await supabase.rpc("check_chapa_booking_eligibility", {
    p_business_id: businessId,
  });

  if (error) throw error;
  if (!data || typeof data !== "object") {
    return { eligible: false, code: "payout_not_configured" };
  }

  return data as ChapaBookingEligibility;
}
