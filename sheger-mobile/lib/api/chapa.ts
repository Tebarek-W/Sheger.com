import {
  formatUnknownError,
  readSupabaseFunctionError,
  readSupabaseFunctionResponseBody,
} from "@/lib/errors";
import { supabase } from "@/lib/supabase";

type ChapaInitializeResponse = {
  checkout_url: string;
  tx_ref: string;
  return_url?: string;
  reused?: boolean;
  hold_expires_at?: string | null;
  hold_ttl_seconds?: number;
  error?: string;
};

type ChapaVerifyResponse = {
  ok: boolean;
  purpose?: "booking" | "subscription";
  booking_id?: string;
  business_id?: string | null;
  payment_status?: string;
  status?: string;
  chapa_status?: string;
  chapa_reference?: string | null;
  chapa_payment_method?: string | null;
  already_finalized?: boolean;
  code?: string;
  error?: string;
};

type ChapaCancelResponse = {
  ok: boolean;
  cancelled?: boolean;
  paid?: boolean;
  chapa_checkout_expired?: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
};

function coerceChapaStatus(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim().toLowerCase();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).toLowerCase();
  }
  return null;
}

function throwVerifyPaymentFailure(data: ChapaVerifyResponse | null | undefined): never {
  if (data?.code === "slot_unavailable") {
    throw new Error("SLOT_UNAVAILABLE");
  }

  const status =
    coerceChapaStatus(data?.chapa_status) ?? coerceChapaStatus(data?.status);

  if (status === "pending") {
    throw new Error("Payment is still processing. Try again in a moment.");
  }
  if (status === "cancelled") {
    throw new Error("This payment was cancelled.");
  }
  if (status === "failed") {
    throw new Error(
      "Payment not completed. Finish paying on Chapa or open checkout again.",
    );
  }

  if (data?.error) {
    const formatted = formatUnknownError(data.error, "");
    if (formatted && formatted !== "[object Object]") {
      throw new Error(formatted);
    }
  }

  throw new Error(
    status
      ? `Payment ${status}`
      : "Payment not completed. Finish paying on Chapa or open checkout again.",
  );
}

function asVerifyResponse(value: unknown): ChapaVerifyResponse | null {
  if (!value || typeof value !== "object" || !("ok" in value)) {
    return null;
  }
  return value as ChapaVerifyResponse;
}

async function resolveVerifyResponse(
  data: ChapaVerifyResponse | null,
  error: unknown,
): Promise<ChapaVerifyResponse | null> {
  const fromData = asVerifyResponse(data);
  if (fromData) return fromData;

  if (!error) return null;

  const body = await readSupabaseFunctionResponseBody(error);
  return asVerifyResponse(body);
}

export type ChapaBookingDraft = {
  businessId: string;
  serviceId: string;
  employeeId?: string | null;
  scheduledAt: string;
};

/**
 * Starts a Chapa checkout for a booking that has NOT been created yet.
 * Server creates a 2-minute soft slot hold so others cannot take the seat
 * while this customer pays. The booking row is inserted only after verify.
 */
export async function initializeChapaBookingPayment(draft: ChapaBookingDraft) {
  const { data, error } = await supabase.functions.invoke<ChapaInitializeResponse>(
    "chapa-initialize",
    { body: { draft } },
  );

  if (error || !data?.checkout_url || !data.tx_ref) {
    await readSupabaseFunctionError(data, error);
  }

  return data!;
}

export async function verifyChapaPayment(txRef: string) {
  const { data, error } = await supabase.functions.invoke<ChapaVerifyResponse>(
    "chapa-verify",
    { body: { txRef } },
  );

  const response = await resolveVerifyResponse(data, error);

  if (response?.ok) {
    return response;
  }

  if (response) {
    throwVerifyPaymentFailure(response);
  }

  if (error) {
    await readSupabaseFunctionError(data, error);
  }

  throwVerifyPaymentFailure(data);
}

export async function cancelChapaPayment(input: { txRef?: string; bookingId?: string }) {
  const { data, error } = await supabase.functions.invoke<ChapaCancelResponse>(
    "chapa-cancel",
    { body: input },
  );

  if (error) {
    await readSupabaseFunctionError(data, error);
  }

  return data;
}

export function parseTxRefFromUrl(url: string): string | null {
  if (!url || url.trimStart().startsWith("<!DOCTYPE") || url.trimStart().startsWith("<html")) {
    return null;
  }

  try {
    const normalized = url.includes("://") ? url : `sheger://${url.replace(/^\//, "")}`;
    const parsed = new URL(normalized);
    return parsed.searchParams.get("tx_ref") ?? parsed.searchParams.get("trx_ref");
  } catch {
    const match = url.match(/[?&](?:tx_ref|trx_ref)=([^&]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }
}
