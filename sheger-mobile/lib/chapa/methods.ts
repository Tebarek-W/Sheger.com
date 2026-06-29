export {
  PAYMENT_METHOD_CHAPA,
  PAYMENT_METHOD_CASH,
  ONLINE_PAYMENT_METHODS,
  bookingPaymentStatusForMethod,
  isCashPaymentMethod,
  isChapaOnlineMethod,
  paymentMethodLabel,
  type OnlinePaymentMethod,
} from "@/lib/payment/methods";

/** @deprecated Use ONLINE_PAYMENT_METHODS */
export const CHAPA_ONLINE_METHODS = ["chapa", "telebirr", "cbe_birr", "card"] as const;
