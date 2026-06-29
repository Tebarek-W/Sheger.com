const CHAPA_API = "https://api.chapa.co/v1";

export type ChapaInitializePayload = {
  amount: string;
  currency: string;
  email: string;
  first_name: string;
  last_name: string;
  tx_ref: string;
  phone_number?: string;
  callback_url?: string;
  return_url?: string;
  customization?: { title?: string; description?: string };
  meta?: Record<string, unknown>;
};

export type ChapaInitializeResult = {
  checkout_url: string;
};

export type ChapaVerifyResult = {
  status: string;
  amount: number;
  currency: string;
  tx_ref: string;
  reference?: string;
  payment_method?: string;
  mode?: string;
};

export type ChapaCancelResult = {
  cancelled: boolean;
  skipped?: boolean;
  reason?: string;
};

export function isChapaSuccessfulStatus(status: string): boolean {
  return status.trim().toLowerCase() === "success";
}

export function chapaSecretKey(): string {
  const key = Deno.env.get("CHAPA_SECRET_KEY");
  if (!key) {
    throw new Error("CHAPA_SECRET_KEY is not configured");
  }
  return key;
}

export function chapaWebhookSecret(): string {
  return Deno.env.get("CHAPA_WEBHOOK_SECRET") ?? chapaSecretKey();
}

export function chapaMode(): "test" | "live" {
  const mode = (Deno.env.get("CHAPA_MODE") ?? "test").toLowerCase();
  return mode === "live" ? "live" : "test";
}

export function supabaseFunctionsBaseUrl(): string {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new Error("SUPABASE_URL is not configured");
  return `${url}/functions/v1`;
}

export function buildChapaReturnUrl(
  functionsBase: string,
  txRef: string,
  anonKey?: string,
): string {
  const params = new URLSearchParams({ tx_ref: txRef });
  if (anonKey?.trim()) {
    params.set("apikey", anonKey.trim());
  }
  return `${functionsBase}/chapa-return?${params.toString()}`;
}

export function buildChapaCallbackUrl(functionsBase: string): string {
  return `${functionsBase}/chapa-callback`;
}

export function appDeepLinkReturnUrl(
  txRef: string,
  chapaReference?: string | null,
): string {
  const params = new URLSearchParams({ tx_ref: txRef });
  if (chapaReference?.trim()) {
    params.set("chapa_reference", chapaReference.trim());
  }
  return `sheger://payment/return?${params.toString()}`;
}

/** @see https://developer.chapa.co/integrations/chapa-receipt */
export function buildChapaReceiptUrl(chapaReference: string): string {
  return `https://chapa.link/payment-receipt/${encodeURIComponent(chapaReference)}`;
}

export async function chapaInitialize(
  payload: ChapaInitializePayload,
): Promise<ChapaInitializeResult> {
  const res = await fetch(`${CHAPA_API}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${chapaSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(formatChapaApiError(body, `Chapa initialize failed (${res.status})`));
  }

  const checkoutUrl = body?.data?.checkout_url;
  if (!checkoutUrl) {
    throw new Error("Chapa did not return a checkout URL");
  }

  return { checkout_url: checkoutUrl };
}

export async function chapaVerify(txRef: string): Promise<ChapaVerifyResult> {
  const res = await fetch(`${CHAPA_API}/transaction/verify/${encodeURIComponent(txRef)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${chapaSecretKey()}`,
    },
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(formatChapaApiError(body, `Chapa verify failed (${res.status})`));
  }

  const data = body?.data ?? body;
  const status = String(data?.status ?? "").trim().toLowerCase();

  return {
    status,
    amount: Number(data?.amount ?? 0),
    currency: String(data?.currency ?? "ETB"),
    tx_ref: String(data?.tx_ref ?? txRef),
    reference: data?.reference ? String(data.reference) : undefined,
    payment_method: data?.payment_method ? String(data.payment_method) : undefined,
    mode: data?.mode ? String(data.mode) : undefined,
  };
}

/**
 * Cancel an active Chapa transaction (expires checkout link).
 * @see https://developer.chapa.co/integrations/transaction-cancel
 */
export async function chapaCancel(txRef: string): Promise<ChapaCancelResult> {
  const res = await fetch(`${CHAPA_API}/transaction/cancel/${encodeURIComponent(txRef)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${chapaSecretKey()}`,
    },
  });

  const body = await res.json().catch(() => ({}));

  if (res.ok) {
    return { cancelled: true };
  }

  const message = formatChapaApiError(body, `Chapa cancel failed (${res.status})`);
  const lower = message.toLowerCase();

  // Already cancelled, completed, or not found — checkout is no longer active.
  if (
    res.status === 404 ||
    res.status === 400 ||
    lower.includes("already") ||
    lower.includes("not found") ||
    lower.includes("completed") ||
    lower.includes("successful")
  ) {
    return { cancelled: false, skipped: true, reason: message };
  }

  throw new Error(message);
}

export async function isValidChapaWebhookSignature(
  payload: unknown,
  req: Request,
): Promise<boolean> {
  const signature =
    req.headers.get("x-chapa-signature") ??
    req.headers.get("chapa-signature");

  if (!signature) return false;

  const secret = chapaWebhookSecret();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(JSON.stringify(payload)),
  );
  const hash = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hash === signature;
}

export function splitFullName(fullName: string | null | undefined): {
  first_name: string;
  last_name: string;
} {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) {
    return { first_name: "Sheger", last_name: "Customer" };
  }
  const parts = trimmed.split(/\s+/);
  return {
    first_name: parts[0] ?? "Sheger",
    last_name: parts.slice(1).join(" ") || "Customer",
  };
}

export function formatChapaAmount(amount: number): string {
  return Number(amount).toFixed(2);
}

/** Chapa expects 09xxxxxxxx or 07xxxxxxxx when phone_number is provided. */
export function normalizeChapaPhone(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;

  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("251")) {
    const local = `0${digits.slice(3)}`;
    if (/^0[79]\d{8}$/.test(local)) return local;
  }
  if (digits.length === 10 && /^0[79]\d{8}$/.test(digits)) {
    return digits;
  }

  return undefined;
}

function formatChapaApiError(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;

  const record = body as Record<string, unknown>;
  const message = record.message ?? record.error;
  if (typeof message === "string" && message.trim()) return message;
  if (typeof message === "object" && message !== null) {
    return JSON.stringify(message);
  }

  const fieldErrors = Object.entries(record)
    .filter(([, value]) => Array.isArray(value))
    .map(([field, value]) => `${field}: ${(value as string[]).join(", ")}`);
  if (fieldErrors.length > 0) return fieldErrors.join("; ");

  return fallback;
}

/** Chapa allows only letters, numbers, hyphens, underscores, spaces, and dots. */
export function sanitizeChapaText(
  value: string | null | undefined,
  fallback: string,
  maxLength = 120,
): string {
  const cleaned = (value ?? "")
    .replace(/[^a-zA-Z0-9\-_. ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const result = cleaned || fallback;
  return result.slice(0, maxLength);
}
