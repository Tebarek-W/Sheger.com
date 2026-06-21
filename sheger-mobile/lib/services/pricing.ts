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

export function requiresServiceFinalization(service: ServiceDisplayFields): boolean {
  return service.pricing_model === "variable" || service.pricing_model === "range"
    || service.duration_model === "flexible" || service.duration_model === "estimated";
}

export function requiresBookingFinalization(booking: BookingPriceFields): boolean {
  return booking.pricing_model === "variable"
    || booking.pricing_model === "range"
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

export function getCheckoutPriceLabel(service: ServiceDisplayFields): {
  primary: string;
  secondary?: string;
  showExactTotal: boolean;
} {
  switch (service.pricing_model) {
    case "starting_from":
      return {
        primary: service.price != null ? `From ${formatEtb(service.price)}` : "From price on request",
        secondary: "Final cost may vary based on the service provided.",
        showExactTotal: false,
      };
    case "range":
      return {
        primary: formatServicePrice(service),
        secondary: "Final price will be confirmed after your visit.",
        showExactTotal: false,
      };
    case "variable":
      return {
        primary: "Price determined at visit",
        secondary: "You will pay after your consultation or treatment.",
        showExactTotal: false,
      };
    case "fixed":
    default:
      return {
        primary: service.price != null ? formatEtb(service.price) : "—",
        showExactTotal: true,
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
