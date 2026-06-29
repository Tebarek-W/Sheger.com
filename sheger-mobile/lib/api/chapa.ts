import { supabase } from "@/lib/supabase";

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

type FunctionErrorBody = {
  error?: string;
};

async function readFunctionError(
  data: unknown,
  error: Error & { context?: Response },
): Promise<never> {
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String((data as FunctionErrorBody).error));
  }

  if (error.context) {
    try {
      const body = (await error.context.clone().json()) as FunctionErrorBody;
      if (body?.error) throw new Error(body.error);
    } catch (parseError) {
      if (parseError instanceof Error && parseError.message !== error.message) {
        throw parseError;
      }
    }
  }

  throw error;
}

export async function initializeChapaBookingPayment(bookingId: string) {
  const { data, error } = await supabase.functions.invoke<ChapaInitializeResponse>(
    "chapa-initialize",
    { body: { bookingId } },
  );

  if (error || !data?.checkout_url || !data.tx_ref) {
    await readFunctionError(data, error as Error & { context?: Response });
  }

  return data!;
}

export async function verifyChapaPayment(txRef: string) {
  const { data, error } = await supabase.functions.invoke<ChapaVerifyResponse>(
    "chapa-verify",
    { body: { txRef } },
  );

  if (error) {
    await readFunctionError(data, error as Error & { context?: Response });
  }

  if (!data?.ok) {
    const status = data?.chapa_status ?? data?.status;
    if (status === "pending") {
      throw new Error("Payment is still processing. Try again in a moment.");
    }
    if (status === "cancelled") {
      throw new Error("This payment was cancelled.");
    }
    throw new Error(status ? `Payment ${status}` : "Payment not completed");
  }

  return data;
}

export async function cancelChapaPayment(input: { txRef?: string; bookingId?: string }) {
  const { data, error } = await supabase.functions.invoke<ChapaCancelResponse>(
    "chapa-cancel",
    { body: input },
  );

  if (error) {
    await readFunctionError(data, error as Error & { context?: Response });
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
