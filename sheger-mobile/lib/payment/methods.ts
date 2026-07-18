import type { BookingPaymentStatus } from "@/lib/types/database";
import type { TranslateFn } from "@/lib/services/pricing";

/** User-facing online payment option — wallet/card choice happens on Chapa checkout. */
export const PAYMENT_METHOD_CHAPA = "chapa" as const;

/**
 * Flexible-price bookings: book now, final amount confirmed at the visit
 * (Booksy-style Starts at / Varies). Not offered as a customer payment picker option.
 */
export const PAYMENT_METHOD_PAY_AT_VISIT = "pay_at_visit" as const;

/** Legacy booking rows created when cash on arrival was a customer option. */
export const PAYMENT_METHOD_CASH = "cash" as const;

/** Legacy booking rows created before the two-method UI. */
const LEGACY_ONLINE_METHODS = ["telebirr", "cbe_birr", "card"] as const;

const ONLINE_PAYMENT_METHODS = [
  PAYMENT_METHOD_CHAPA,
  ...LEGACY_ONLINE_METHODS,
] as const;

export type OnlinePaymentMethod = (typeof ONLINE_PAYMENT_METHODS)[number];

export function isChapaOnlineMethod(method: string): method is OnlinePaymentMethod {
  return (ONLINE_PAYMENT_METHODS as readonly string[]).includes(method);
}

export function isPayAtVisitMethod(method: string): boolean {
  const id = method.toLowerCase();
  return id === PAYMENT_METHOD_PAY_AT_VISIT || id === PAYMENT_METHOD_CASH;
}

export function bookingPaymentStatusForMethod(method: string): BookingPaymentStatus {
  return isChapaOnlineMethod(method) ? "awaiting_payment" : "not_required";
}

/** Display label for a stored payment_method id. */
export function paymentMethodLabel(
  method: string | null | undefined,
  t: TranslateFn,
): string {
  if (!method) return "—";
  if (isPayAtVisitMethod(method)) return t("payment.methods.payAtVisit");
  if (isChapaOnlineMethod(method)) return t("payment.methods.chapa");
  return method.replaceAll("_", " ");
}
