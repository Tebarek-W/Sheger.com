import { supabase } from "@/lib/supabase";

export type ChapaBookingEligibility = {
  eligible: boolean;
  code?: "payout_not_configured" | "split_not_viable_for_plan";
  auto_split_viable?: boolean;
  min_amount_for_auto_split_etb?: number;
};

export async function checkChapaBookingEligibility(
  businessId: string,
  amountEtb?: number | null,
): Promise<ChapaBookingEligibility> {
  const { data, error } = await supabase.rpc("check_chapa_booking_eligibility", {
    p_business_id: businessId,
    ...(amountEtb != null && amountEtb > 0 ? { p_amount: amountEtb } : {}),
  });

  if (error) throw error;
  if (!data || typeof data !== "object") {
    return { eligible: false, code: "payout_not_configured" };
  }

  return data as ChapaBookingEligibility;
}
