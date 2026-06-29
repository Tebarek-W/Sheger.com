import type { BookingPaymentStatus } from "@/lib/types/database";

export const CHAPA_ONLINE_METHODS = ["telebirr", "cbe_birr", "card"] as const;

export type ChapaOnlineMethod = (typeof CHAPA_ONLINE_METHODS)[number];

export function isChapaOnlineMethod(method: string): method is ChapaOnlineMethod {
  return (CHAPA_ONLINE_METHODS as readonly string[]).includes(method);
}

export function bookingPaymentStatusForMethod(method: string): BookingPaymentStatus {
  return isChapaOnlineMethod(method) ? "awaiting_payment" : "not_required";
}
