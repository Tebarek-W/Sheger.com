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
    const message = body?.message ?? body?.error ?? `Chapa initialize failed (${res.status})`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
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
    const message = body?.message ?? body?.error ?? `Chapa verify failed (${res.status})`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  const data = body?.data ?? body;
  return {
    status: String(data?.status ?? ""),
    amount: Number(data?.amount ?? 0),
    currency: String(data?.currency ?? "ETB"),
    tx_ref: String(data?.tx_ref ?? txRef),
    reference: data?.reference ? String(data.reference) : undefined,
    payment_method: data?.payment_method ? String(data.payment_method) : undefined,
    mode: data?.mode ? String(data.mode) : undefined,
  };
}

export async function chapaCancel(txRef: string): Promise<void> {
  const res = await fetch(`${CHAPA_API}/transaction/cancel/${encodeURIComponent(txRef)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${chapaSecretKey()}`,
    },
  });

  if (res.status === 404) return;

  const body = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 400) {
    const message = body?.message ?? body?.error ?? `Chapa cancel failed (${res.status})`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
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
