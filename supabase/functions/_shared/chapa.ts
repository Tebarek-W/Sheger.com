const CHAPA_API = "https://api.chapa.co/v1";

export type ChapaSplitSubaccount = {
  id: string;
  split_type?: "percentage" | "flat";
  split_value?: number;
};

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
  /** @see https://developer.chapa.co/integrations/split-payment */
  subaccounts?: ChapaSplitSubaccount;
};

export type ChapaBank = {
  id: number;
  name: string;
  slug?: string;
};

export type ChapaSubaccountPayload = {
  account_name: string;
  bank_code: number;
  account_number: string;
  business_name?: string;
  split_type: "percentage" | "flat";
  split_value: number;
};

export type ChapaSubaccountResult = {
  id: string;
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

export type ChapaDirectChargeType = "telebirr" | "cbebirr" | "mpesa" | "ebirr";

export const CHAPA_DIRECT_CHARGE_TYPES: ChapaDirectChargeType[] = [
  "telebirr",
  "cbebirr",
  "mpesa",
  "ebirr",
];

export function isChapaDirectChargeType(value: string): value is ChapaDirectChargeType {
  return (CHAPA_DIRECT_CHARGE_TYPES as readonly string[]).includes(value);
}

export type ChapaDirectChargePayload = {
  amount: string;
  currency: string;
  email: string;
  first_name: string;
  last_name: string;
  tx_ref: string;
  mobile: string;
  subaccounts?: ChapaSplitSubaccount;
};

export type ChapaDirectChargeResult = {
  reference: string;
  status: string;
  auth_required: boolean;
  meta?: Record<string, unknown>;
};

export type ChapaAuthorizeDirectChargePayload = {
  reference: string;
  client?: string;
};

export type ChapaAuthorizeDirectChargeResult = {
  status: string;
  trx_ref?: string;
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

  const status = String(body?.status ?? "success").trim().toLowerCase();
  if (status !== "success") {
    throw new Error(formatChapaApiError(body, "Chapa initialize failed"));
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

function parseChapaBankId(row: Record<string, unknown>): number | null {
  const raw = row.id ?? row.bank_code ?? row.code;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
  }
  return null;
}

/** @see https://developer.chapa.co/transfer/list-banks */
export async function chapaListBanks(): Promise<ChapaBank[]> {
  const res = await fetch(`${CHAPA_API}/banks`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${chapaSecretKey()}`,
    },
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(formatChapaApiError(body, `Chapa banks failed (${res.status})`));
  }

  const rows = body?.data ?? body;
  if (!Array.isArray(rows)) {
    throw new Error("Chapa did not return a bank list");
  }

  const banks = rows
    .map((row: Record<string, unknown>) => {
      const id = parseChapaBankId(row);
      const name = String(row.name ?? "").trim();
      if (id == null || !name) return null;

      const currency = row.currency ? String(row.currency).toUpperCase() : "ETB";
      if (currency !== "ETB") return null;

      return {
        id,
        name,
        slug: row.slug ? String(row.slug) : undefined,
      } satisfies ChapaBank;
    })
    .filter((bank): bank is ChapaBank => bank !== null);

  banks.sort((a, b) => a.name.localeCompare(b.name));
  return banks;
}

/** @see https://developer.chapa.co/integrations/split-payment */
export async function chapaCreateSubaccount(
  payload: ChapaSubaccountPayload,
): Promise<ChapaSubaccountResult> {
  const res = await fetch(`${CHAPA_API}/subaccount`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${chapaSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(formatChapaApiError(body, `Chapa subaccount failed (${res.status})`));
  }

  const status = String(body?.status ?? "success").trim().toLowerCase();
  if (status !== "success") {
    throw new Error(formatChapaApiError(body, "Chapa subaccount failed"));
  }

  const id = body?.data?.id ?? body?.data?.subaccount_id ?? body?.id;
  if (!id) {
    throw new Error("Chapa did not return a subaccount id");
  }

  return { id: String(id) };
}

function buildMultipartForm(fields: Record<string, string>): { body: Uint8Array; contentType: string } {
  const boundary = `----ChapaForm${crypto.randomUUID().replace(/-/g, "")}`;
  const chunks: string[] = [];

  for (const [name, value] of Object.entries(fields)) {
    chunks.push(`--${boundary}`);
    chunks.push(`Content-Disposition: form-data; name="${name}"`);
    chunks.push("");
    chunks.push(value);
  }

  chunks.push(`--${boundary}--`);
  chunks.push("");

  const body = new TextEncoder().encode(chunks.join("\r\n"));
  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

/** @see https://developer.chapa.co/charge/initiate-payments */
export async function chapaDirectCharge(
  chargeType: ChapaDirectChargeType,
  payload: ChapaDirectChargePayload,
): Promise<ChapaDirectChargeResult> {
  const fields: Record<string, string> = {
    amount: payload.amount,
    currency: payload.currency,
    email: payload.email,
    first_name: payload.first_name,
    last_name: payload.last_name,
    tx_ref: payload.tx_ref,
    mobile: payload.mobile,
  };

  if (payload.subaccounts) {
    fields["subaccounts[id]"] = payload.subaccounts.id;
    if (payload.subaccounts.split_type) {
      fields["subaccounts[split_type]"] = payload.subaccounts.split_type;
    }
    if (payload.subaccounts.split_value != null) {
      fields["subaccounts[split_value]"] = String(payload.subaccounts.split_value);
    }
  }

  const { body, contentType } = buildMultipartForm(fields);
  const res = await fetch(
    `${CHAPA_API}/charges?type=${encodeURIComponent(chargeType)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chapaSecretKey()}`,
        "Content-Type": contentType,
      },
      body,
    },
  );

  const responseBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(formatChapaApiError(responseBody, `Chapa direct charge failed (${res.status})`));
  }

  const data = (responseBody as { data?: Record<string, unknown> })?.data ?? responseBody;
  const record = data as Record<string, unknown>;
  const reference = String(record.reference ?? record.ref_id ?? "");
  const status = String(record.status ?? "pending").toLowerCase();

  if (!reference) {
    throw new Error("Chapa did not return a charge reference");
  }

  const authRequired = status === "pending" || Boolean(record.auth_type ?? record.requires_auth);

  return {
    reference,
    status,
    auth_required: authRequired,
    meta: record,
  };
}

/** @see https://developer.chapa.co/charge/authorize-payments */
export async function chapaAuthorizeDirectCharge(
  chargeType: ChapaDirectChargeType,
  payload: ChapaAuthorizeDirectChargePayload,
): Promise<ChapaAuthorizeDirectChargeResult> {
  const { body, contentType } = buildMultipartForm({
    reference: payload.reference,
    client: payload.client ?? "",
  });

  const res = await fetch(
    `${CHAPA_API}/validate?type=${encodeURIComponent(chargeType)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chapaSecretKey()}`,
        "Content-Type": contentType,
      },
      body,
    },
  );

  const responseBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(formatChapaApiError(responseBody, `Chapa authorize failed (${res.status})`));
  }

  const data = (responseBody as { data?: Record<string, unknown> })?.data ?? responseBody;
  const record = data as Record<string, unknown>;

  return {
    status: String(record.status ?? responseBody.status ?? "success").toLowerCase(),
    trx_ref: record.trx_ref ? String(record.trx_ref) : undefined,
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
