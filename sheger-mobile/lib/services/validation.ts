import type { CreateServiceInput } from "@/lib/api/owner";

export function validateCreateServiceInput(input: CreateServiceInput): string | null {
  if (!input.name.trim()) return "Enter a service name.";

  if (input.pricingModel === "fixed" || input.pricingModel === "starting_from") {
    if (input.price == null || Number.isNaN(input.price) || input.price < 0) {
      return "Enter a valid price.";
    }
  }

  if (input.pricingModel === "range") {
    if (
      input.priceMin == null ||
      input.priceMax == null ||
      Number.isNaN(input.priceMin) ||
      Number.isNaN(input.priceMax) ||
      input.priceMin < 0 ||
      input.priceMax < input.priceMin
    ) {
      return "Enter a valid price range (min must be <= max).";
    }
  }

  if (input.pricingModel === "variable" && input.priceMin != null) {
    if (Number.isNaN(input.priceMin) || input.priceMin < 0) {
      return "Guide price must be zero or greater.";
    }
  }

  if (input.durationModel === "fixed") {
    if (!input.durationMinutes || input.durationMinutes <= 0) {
      return "Enter a valid duration.";
    }
  }

  if (input.durationModel === "estimated") {
    if (!input.durationMinutes || input.durationMinutes <= 0) {
      return "Enter a typical duration.";
    }
    if (!input.schedulingBlockMinutes || input.schedulingBlockMinutes <= 0) {
      return "Enter a calendar block duration.";
    }
  }

  if (input.durationModel === "flexible") {
    if (!input.schedulingBlockMinutes || input.schedulingBlockMinutes <= 0) {
      return "Enter a calendar block duration.";
    }
  }

  return null;
}

export function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}
