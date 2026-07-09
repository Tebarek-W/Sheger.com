import type {
  Booking,
  Service,
  ServiceDurationModel,
  ServicePricingModel,
} from "@/lib/types/database";

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

function formatEtb(amount: number): string {
  return `${Number(amount).toFixed(0)} ETB`;
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

export function formatServicePrice(service: ServiceDisplayFields): string {
  switch (service.pricing_model) {
    case "starting_from":
      return service.price != null ? `From ${formatEtb(service.price)}` : "Price on request";
    case "range":
      if (service.price_min != null && service.price_max != null) {
        return `${formatEtb(service.price_min)} – ${formatEtb(service.price_max)}`;
      }
      return "Price range on request";
    case "variable":
      return service.price_min != null
        ? `From ${formatEtb(service.price_min)} · price at visit`
        : "Price determined at visit";
    case "fixed":
    default:
      return service.price != null ? formatEtb(service.price) : "—";
  }
}

export function formatServiceDuration(service: ServiceDisplayFields): string {
  switch (service.duration_model) {
    case "estimated":
      return `~${service.duration_minutes} min`;
    case "flexible": {
      const block = service.scheduling_block_minutes ?? service.duration_minutes;
      return block ? `${block} min block · time varies` : "Time varies";
    }
    case "fixed":
    default:
      return `${service.duration_minutes} min`;
  }
}

export function requiresBookingFinalization(booking: BookingPriceFields): boolean {
  return booking.pricing_model === "variable"
    || booking.pricing_model === "range"
    || booking.pricing_model === "starting_from"
    || booking.duration_model === "flexible"
    || booking.duration_model === "estimated";
}

export function formatBookingPrice(booking: BookingPriceFields): string {
  if (booking.final_price != null) {
    return formatEtb(booking.final_price);
  }
  switch (booking.pricing_model) {
    case "starting_from":
      return booking.listed_price != null
        ? `From ${formatEtb(booking.listed_price)}`
        : "From price on file";
    case "range":
      if (booking.listed_price_min != null && booking.listed_price_max != null) {
        return `${formatEtb(booking.listed_price_min)} – ${formatEtb(booking.listed_price_max)}`;
      }
      return "Price range";
    case "variable":
      return booking.listed_price_min != null
        ? `From ${formatEtb(booking.listed_price_min)} · final at visit`
        : "Price at visit";
    case "fixed":
    default:
      return booking.listed_price != null ? formatEtb(booking.listed_price) : "—";
  }
}

export function getBookingRevenueAmount(booking: BookingPriceFields & { services?: { price: number } | null }): number {
  if (booking.final_price != null) return Number(booking.final_price);
  if (booking.listed_price != null) return Number(booking.listed_price);
  if (booking.listed_price_min != null) return Number(booking.listed_price_min);
  return Number(booking.services?.price ?? 0);
}

/**
 * Amount charged on Chapa at booking time.
 * - fixed: full price
 * - starting_from / range / variable (with min): the "from" / minimum as a deposit
 * - variable with no min: null (pay at visit only)
 */
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

/** True when Chapa charge is a minimum/deposit, not the final bill. */
export function isOnlineDepositCharge(service: ServiceDisplayFields): boolean {
  if (service.pricing_model === "fixed") return false;
  return getOnlineChargeableAmount(service) != null;
}

export function getCheckoutPriceLabel(service: ServiceDisplayFields): {
  primary: string;
  secondary?: string;
  showExactTotal: boolean;
  /** Amount due now on Chapa when online payment applies. */
  dueNowAmount: number | null;
  isDeposit: boolean;
} {
  const dueNowAmount = getOnlineChargeableAmount(service);
  const isDeposit = isOnlineDepositCharge(service);

  switch (service.pricing_model) {
    case "starting_from":
      return {
        primary: service.price != null ? `From ${formatEtb(service.price)}` : "From price on request",
        secondary: dueNowAmount
          ? `Pay ${formatEtb(dueNowAmount)} now. Final cost may be higher at your visit.`
          : "Final cost may vary based on the service provided.",
        showExactTotal: false,
        dueNowAmount,
        isDeposit,
      };
    case "range":
      return {
        primary: formatServicePrice(service),
        secondary: dueNowAmount
          ? `Pay ${formatEtb(dueNowAmount)} now (minimum). Final price confirmed at your visit.`
          : "Final price will be confirmed after your visit.",
        showExactTotal: false,
        dueNowAmount,
        isDeposit,
      };
    case "variable":
      return {
        primary: dueNowAmount
          ? `From ${formatEtb(dueNowAmount)}`
          : "Price determined at visit",
        secondary: dueNowAmount
          ? `Pay ${formatEtb(dueNowAmount)} now. Any remaining balance is paid at the business.`
          : "You will pay after your consultation or treatment.",
        showExactTotal: false,
        dueNowAmount,
        isDeposit,
      };
    case "fixed":
    default:
      return {
        primary: service.price != null ? formatEtb(service.price) : "—",
        showExactTotal: true,
        dueNowAmount,
        isDeposit: false,
      };
  }
}

export const PRICING_MODEL_OPTIONS: { value: ServicePricingModel; label: string; hint: string }[] = [
  { value: "fixed", label: "Fixed price", hint: "Exact price shown to customers" },
  { value: "starting_from", label: "Starting from", hint: "Minimum price; final may be higher" },
  { value: "range", label: "Price range", hint: "Show min–max estimate" },
  { value: "variable", label: "Variable", hint: "Price confirmed after visit" },
];

export const DURATION_MODEL_OPTIONS: { value: ServiceDurationModel; label: string; hint: string }[] = [
  { value: "fixed", label: "Fixed duration", hint: "Exact appointment length" },
  { value: "estimated", label: "Estimated", hint: "Typical time with calendar block" },
  { value: "flexible", label: "Flexible", hint: "Time varies; block reserves calendar" },
];
