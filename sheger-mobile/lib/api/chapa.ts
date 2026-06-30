import { readSupabaseFunctionError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

type ChapaDirectChargeResponse = {
  ok: boolean;
  tx_ref: string;
  reference: string;
  charge_type: string;
  status: string;
  auth_required?: boolean;
  amount_etb?: number;
  reused?: boolean;
  error?: string;
};

type ChapaAuthorizeResponse = {
  ok: boolean;
  status?: string;
  tx_ref?: string;
  error?: string;
};

type ChapaInitializeResponse = {
  checkout_url: string;
  tx_ref: string;
  return_url?: string;
  reused?: boolean;
  error?: string;
};

type ChapaVerifyResponse = {
  ok: boolean;
  booking_id?: string;
  payment_status?: string;
  status?: string;
  chapa_status?: string;
  chapa_reference?: string | null;
  chapa_payment_method?: string | null;
  already_finalized?: boolean;
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

function throwVerifyPaymentFailure(data: ChapaVerifyResponse | null | undefined): never {
  const status = data?.chapa_status ?? data?.status;
  if (status === "pending") {
    throw new Error("Payment is still processing. Try again in a moment.");
  }
  if (status === "cancelled") {
    throw new Error("This payment was cancelled.");
  }
  if (typeof data?.error === "string" && data.error.trim()) {
    throw new Error(data.error.trim());
  }
  throw new Error(status ? `Payment ${status}` : "Payment not completed");
}

export async function initializeChapaBookingPayment(bookingId: string) {
  const { data, error } = await supabase.functions.invoke<ChapaInitializeResponse>(
    "chapa-initialize",
    { body: { bookingId } },
  );

  if (error || !data?.checkout_url || !data.tx_ref) {
    await readSupabaseFunctionError(data, error);
  }

  return data!;
}

export async function startChapaDirectCharge(input: {
  bookingId: string;
  chargeType: string;
  mobile: string;
}) {
  const { data, error } = await supabase.functions.invoke<ChapaDirectChargeResponse>(
    "chapa-charge",
    { body: input },
  );

  if (error || !data?.ok || !data.tx_ref || !data.reference) {
    await readSupabaseFunctionError(data, error);
  }

  return data!;
}

export async function authorizeChapaDirectCharge(input: {
  txRef: string;
  chargeType: string;
  reference: string;
  client?: string;
}) {
  const { data, error } = await supabase.functions.invoke<ChapaAuthorizeResponse>(
    "chapa-authorize",
    { body: input },
  );

  if (error || !data?.ok) {
    await readSupabaseFunctionError(data, error);
  }

  return data!;
}

export async function verifyChapaPayment(txRef: string) {
  const { data, error } = await supabase.functions.invoke<ChapaVerifyResponse>(
    "chapa-verify",
    { body: { txRef } },
  );

  if (data?.ok) {
    return data;
  }

  // chapa-verify returns 402/202 with payment state in the JSON body.
  if (data && typeof data === "object" && "ok" in data) {
    throwVerifyPaymentFailure(data);
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
