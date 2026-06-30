import type { BookingPaymentStatus } from "@/lib/types/database";

/** User-facing online payment option — wallet/card choice happens on Chapa checkout. */
export const PAYMENT_METHOD_CHAPA = "chapa" as const;

/** Pay at the business location. */
export const PAYMENT_METHOD_CASH = "cash" as const;

/** Legacy booking rows created before the two-method UI. */
const LEGACY_ONLINE_METHODS = ["telebirr", "cbe_birr", "card"] as const;

export const ONLINE_PAYMENT_METHODS = [
  PAYMENT_METHOD_CHAPA,
  ...LEGACY_ONLINE_METHODS,
] as const;

export type OnlinePaymentMethod = (typeof ONLINE_PAYMENT_METHODS)[number];

export type CustomerPaymentMethod =
  | typeof PAYMENT_METHOD_CHAPA
  | typeof PAYMENT_METHOD_CASH;

export function isChapaOnlineMethod(method: string): method is OnlinePaymentMethod {
  return (ONLINE_PAYMENT_METHODS as readonly string[]).includes(method);
}

export function isCashPaymentMethod(method: string): boolean {
  return method.toLowerCase() === PAYMENT_METHOD_CASH;
}

export function bookingPaymentStatusForMethod(method: string): BookingPaymentStatus {
  return isChapaOnlineMethod(method) ? "awaiting_payment" : "not_required";
}

/** Display label for a stored payment_method id. */
export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return "—";
  if (isCashPaymentMethod(method)) return "Cash on arrival";
  if (isChapaOnlineMethod(method)) return "Chapa";
  return method.replaceAll("_", " ");
}
