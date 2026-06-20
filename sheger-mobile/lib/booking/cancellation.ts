import { getErrorMessage } from "@/lib/errors";

/** Matches `businesses.cancellation_hours` default in the database. */
export const DEFAULT_CANCELLATION_HOURS = 2;

export type CancellationEligibility = {
  allowed: boolean;
  hoursRequired: number;
  hoursRemaining: number | null;
  reason?: string;
};

export function getCancellationPolicyText(hours: number = DEFAULT_CANCELLATION_HOURS): string {
  return `While your booking is still pending, you may cancel up to ${hours} hour${hours === 1 ? "" : "s"} before your appointment. Once the business confirms it, cancellation through the app is no longer available.`;
}

export function getCancellationEligibility(
  scheduledAt: string,
  cancellationHours: number = DEFAULT_CANCELLATION_HOURS,
  now: Date = new Date(),
): CancellationEligibility {
  const start = new Date(scheduledAt);
  const msUntil = start.getTime() - now.getTime();
  const hoursUntil = msUntil / (1000 * 60 * 60);
  // Matches the database (COALESCE(cancellation_hours, 2)); 0 means "anytime".
  const hoursRequired = Math.max(0, cancellationHours);

  if (hoursUntil <= 0) {
    return {
      allowed: false,
      hoursRequired,
      hoursRemaining: 0,
      reason: "This appointment has already started or passed, so it cannot be cancelled.",
    };
  }

  if (hoursUntil < hoursRequired) {
    const hoursLeft = Math.max(0, Math.floor(hoursUntil * 10) / 10);
    return {
      allowed: false,
      hoursRequired,
      hoursRemaining: hoursLeft,
      reason: `Cancellation must be at least ${hoursRequired} hours before your appointment. Only ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"} remain.`,
    };
  }

  return {
    allowed: true,
    hoursRequired,
    hoursRemaining: Math.floor(hoursUntil * 10) / 10,
  };
}

export function getCancellationConfirmMessage(
  businessName: string,
  cancellationHours: number = DEFAULT_CANCELLATION_HOURS,
): string {
  return `${getCancellationPolicyText(cancellationHours)}\n\nThis will permanently cancel your appointment at ${businessName}. This action cannot be undone.`;
}

export function parseCancellationApiError(error: unknown): string {
  const raw = getErrorMessage(error);

  if (raw.includes("Cancellations must be made at least")) {
    const match = raw.match(/at least (\d+) hours/i);
    const hours = match ? Number(match[1]) : DEFAULT_CANCELLATION_HOURS;
    return `Cancellations must be made at least ${hours} hours before your appointment. Less than ${hours} hours remain, so this booking can no longer be cancelled online.`;
  }

  if (raw.includes("Customers can only cancel")) {
    return "Only pending bookings can be cancelled. Once a business confirms your appointment, contact them directly if you need to change plans.";
  }

  return raw;
}
