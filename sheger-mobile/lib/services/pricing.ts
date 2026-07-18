import type {
  Booking,
  Service,
  ServiceDurationModel,
  ServicePricingModel,
} from "@/lib/types/database";

export type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export type ServiceDisplayFields = Pick<
  Service,
  | "pricing_model"
  | "price"
  | "price_min"
  | "price_max"
  | "duration_model"
  | "duration_minutes"
  | "scheduling_block_minutes"
>;

export type BookingPriceFields = Pick<
  Booking,
  | "pricing_model"
  | "duration_model"
  | "listed_price"
  | "listed_price_min"
  | "listed_price_max"
  | "final_price"
>;

function formatEtb(amount: number, t: TranslateFn): string {
  return t("common.currencyEtb", { amount: Number(amount).toFixed(0) });
}

export function getDiscoveryPrice(service: ServiceDisplayFields): number | null {
  if (service.pricing_model === "range" && service.price_min != null) {
    return Number(service.price_min);
  }
  if (service.pricing_model === "variable") {
    return service.price_min != null ? Number(service.price_min) : null;
  }
  if (service.price != null) {
    return Number(service.price);
  }
  return null;
}

export function formatServicePrice(service: ServiceDisplayFields, t: TranslateFn): string {
  switch (service.pricing_model) {
    case "starting_from":
      return service.price != null
        ? t("pricing.fromAmount", { amount: formatEtb(service.price, t) })
        : t("pricing.onRequest");
    case "range":
      if (service.price_min != null && service.price_max != null) {
        return t("pricing.range", {
          min: formatEtb(service.price_min, t),
          max: formatEtb(service.price_max, t),
        });
      }
      return t("pricing.rangeOnRequest");
    case "variable":
      return service.price_min != null
        ? t("pricing.fromAmountAtVisit", { amount: formatEtb(service.price_min, t) })
        : t("pricing.atVisit");
    case "fixed":
    default:
      return service.price != null ? formatEtb(service.price, t) : "—";
  }
}

export function formatServiceDuration(service: ServiceDisplayFields, t: TranslateFn): string {
  switch (service.duration_model) {
    case "estimated":
      return t("pricing.durationEstimated", { minutes: service.duration_minutes });
    case "flexible": {
      const block = service.scheduling_block_minutes ?? service.duration_minutes;
      return block
        ? t("pricing.durationFlexibleBlock", { minutes: block })
        : t("pricing.durationVaries");
    }
    case "fixed":
    default:
      return t("pricing.durationFixed", { minutes: service.duration_minutes });
  }
}

export function requiresBookingFinalization(booking: BookingPriceFields): boolean {
  return (
    booking.pricing_model === "variable" ||
    booking.pricing_model === "range" ||
    booking.pricing_model === "starting_from" ||
    booking.duration_model === "flexible" ||
    booking.duration_model === "estimated"
  );
}

export function formatBookingPrice(booking: BookingPriceFields, t: TranslateFn): string {
  if (booking.final_price != null) {
    return formatEtb(booking.final_price, t);
  }
  switch (booking.pricing_model) {
    case "starting_from":
      return booking.listed_price != null
        ? t("pricing.fromAmount", { amount: formatEtb(booking.listed_price, t) })
        : t("pricing.fromOnFile");
    case "range":
      if (booking.listed_price_min != null && booking.listed_price_max != null) {
        return t("pricing.range", {
          min: formatEtb(booking.listed_price_min, t),
          max: formatEtb(booking.listed_price_max, t),
        });
      }
      return t("pricing.priceRange");
    case "variable":
      return booking.listed_price_min != null
        ? t("pricing.fromAmountFinalVisit", { amount: formatEtb(booking.listed_price_min, t) })
        : t("pricing.atVisit");
    case "fixed":
    default:
      return booking.listed_price != null ? formatEtb(booking.listed_price, t) : "—";
  }
}

export function getBookingRevenueAmount(
  booking: BookingPriceFields & { services?: { price: number } | null },
): number {
  if (booking.final_price != null) return Number(booking.final_price);
  if (booking.listed_price != null) return Number(booking.listed_price);
  if (booking.listed_price_min != null) return Number(booking.listed_price_min);
  return Number(booking.services?.price ?? 0);
}

export function getOnlineChargeableAmount(service: ServiceDisplayFields): number | null {
  switch (service.pricing_model) {
    case "fixed":
      return service.price != null && Number(service.price) > 0 ? Number(service.price) : null;
    case "starting_from":
      return service.price != null && Number(service.price) > 0 ? Number(service.price) : null;
    case "range":
    case "variable":
      return service.price_min != null && Number(service.price_min) > 0
        ? Number(service.price_min)
        : null;
    default:
      return null;
  }
}

export function isOnlineDepositCharge(service: ServiceDisplayFields): boolean {
  if (service.pricing_model === "fixed") return false;
  return getOnlineChargeableAmount(service) != null;
}

export function getCheckoutPriceLabel(
  service: ServiceDisplayFields,
  t: TranslateFn,
): {
  primary: string;
  secondary?: string;
  showExactTotal: boolean;
  dueNowAmount: number | null;
  isDeposit: boolean;
} {
  const dueNowAmount = getOnlineChargeableAmount(service);
  const isDeposit = isOnlineDepositCharge(service);

  switch (service.pricing_model) {
    case "starting_from":
      return {
        primary:
          service.price != null
            ? t("pricing.fromAmount", { amount: formatEtb(service.price, t) })
            : t("pricing.fromOnRequest"),
        secondary: dueNowAmount
          ? t("pricing.payNowMayBeHigher", { amount: formatEtb(dueNowAmount, t) })
          : t("pricing.finalMayVary"),
        showExactTotal: false,
        dueNowAmount,
        isDeposit,
      };
    case "range":
      return {
        primary: formatServicePrice(service, t),
        secondary: dueNowAmount
          ? t("pricing.payNowMinimum", { amount: formatEtb(dueNowAmount, t) })
          : t("pricing.finalAfterVisit"),
        showExactTotal: false,
        dueNowAmount,
        isDeposit,
      };
    case "variable":
      return {
        primary: dueNowAmount
          ? t("pricing.fromAmount", { amount: formatEtb(dueNowAmount, t) })
          : t("pricing.atVisit"),
        secondary: dueNowAmount
          ? t("pricing.payNowBalanceAtBusiness", { amount: formatEtb(dueNowAmount, t) })
          : t("pricing.payAfterVisit"),
        showExactTotal: false,
        dueNowAmount,
        isDeposit,
      };
    case "fixed":
    default:
      return {
        primary: service.price != null ? formatEtb(service.price, t) : "—",
        showExactTotal: true,
        dueNowAmount,
        isDeposit: false,
      };
  }
}

export const PRICING_MODEL_OPTIONS: { value: ServicePricingModel }[] = [
  { value: "fixed" },
  { value: "starting_from" },
  { value: "range" },
  { value: "variable" },
];

export const DURATION_MODEL_OPTIONS: { value: ServiceDurationModel }[] = [
  { value: "fixed" },
  { value: "estimated" },
  { value: "flexible" },
];
