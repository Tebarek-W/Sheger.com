import { getErrorMessage } from "@/lib/errors";
import type { TranslateFn } from "@/lib/services/pricing";

/** Matches `businesses.cancellation_hours` default in the database. */
export const DEFAULT_CANCELLATION_HOURS = 2;

export type CancellationEligibility = {
  allowed: boolean;
  hoursRequired: number;
  hoursRemaining: number | null;
  reason?: string;
};

export function getCancellationPolicyText(
  hours: number = DEFAULT_CANCELLATION_HOURS,
  t: TranslateFn,
): string {
  return hours === 1
    ? t("payment.cancellationPolicyTextOne", { hours })
    : t("payment.cancellationPolicyText", { hours });
}

export function getCancellationEligibility(
  scheduledAt: string,
  cancellationHours: number = DEFAULT_CANCELLATION_HOURS,
  now: Date = new Date(),
): CancellationEligibility {
  const start = new Date(scheduledAt);
  const msUntil = start.getTime() - now.getTime();
  const hoursUntil = msUntil / (1000 * 60 * 60);
  const hoursRequired = Math.max(0, cancellationHours);

  if (hoursUntil <= 0) {
    return {
      allowed: false,
      hoursRequired,
      hoursRemaining: 0,
    };
  }

  if (hoursUntil < hoursRequired) {
    const hoursLeft = Math.max(0, Math.floor(hoursUntil * 10) / 10);
    return {
      allowed: false,
      hoursRequired,
      hoursRemaining: hoursLeft,
    };
  }

  return {
    allowed: true,
    hoursRequired,
    hoursRemaining: Math.floor(hoursUntil * 10) / 10,
  };
}

export function parseCancellationApiError(error: unknown): string {
  return getErrorMessage(error);
}
