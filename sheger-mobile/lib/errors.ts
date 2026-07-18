export function formatUnknownError(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message === "[object Object]") return fallback;
    return message || fallback;
  }

  if (typeof error === "string" && error.trim()) {
    const trimmed = error.trim();
    if (trimmed === "[object Object]") return fallback;
    return trimmed;
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;

    if (typeof record.message === "string" && record.message.trim()) {
      const message = record.message.trim();
      if (message === "[object Object]") return fallback;
      return message;
    }

    if (record.message && typeof record.message === "object") {
      const nested = formatUnknownError(record.message, "");
      if (nested) return nested;
    }

    if (typeof record.details === "string" && record.details.trim()) {
      return record.details.trim();
    }

    if (record.error) {
      const nested = formatUnknownError(record.error, "");
      if (nested) return nested;
    }
  }

  return fallback;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || "Something went wrong";
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
    if (message && typeof message === "object") {
      return formatUnknownError(message);
    }
  }

  if (error && typeof error === "object") {
    const formatted = formatUnknownError(error, "");
    if (formatted) return formatted;
  }

  return "Something went wrong";
}

type FunctionErrorBody = {
  error?: unknown;
  message?: unknown;
  ok?: boolean;
  status?: unknown;
  chapa_status?: unknown;
};

type InvokeError = Error & { context?: Response };

/** JSON body from a non-2xx supabase.functions.invoke (lives on error.context). */
export async function readSupabaseFunctionResponseBody(
  error: unknown,
): Promise<Record<string, unknown> | null> {
  const invokeError = error as InvokeError;
  if (!invokeError?.context) return null;

  try {
    const body = (await invokeError.context.clone().json()) as unknown;
    if (body && typeof body === "object") {
      return body as Record<string, unknown>;
    }
  } catch {
    // Response was not JSON.
  }

  return null;
}

async function readInvokeErrorBody(invokeError: InvokeError): Promise<FunctionErrorBody | null> {
  const body = await readSupabaseFunctionResponseBody(invokeError);
  return body as FunctionErrorBody | null;
}

export async function readSupabaseFunctionError(
  data: unknown,
  error: unknown,
): Promise<never> {
  if (data && typeof data === "object") {
    const record = data as FunctionErrorBody;
    if (record.error) {
      throw new Error(formatUnknownError(record.error));
    }
  }

  const invokeError = error as InvokeError;
  if (invokeError?.context) {
    const body = await readInvokeErrorBody(invokeError);
    if (body?.error) {
      throw new Error(formatUnknownError(body.error));
    }
    if (typeof body?.message === "string" && body.message.trim()) {
      throw new Error(body.message.trim());
    }
  }

  throw new Error(formatUnknownError(invokeError));
}
