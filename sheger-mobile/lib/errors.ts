export function formatUnknownError(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof Error) {
    return error.message.trim() || fallback;
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;

    if (typeof record.message === "string" && record.message.trim()) {
      return record.message.trim();
    }

    if (record.message && typeof record.message === "object") {
      const nested = formatUnknownError(record.message, "");
      if (nested) return nested;
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
};

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

  const invokeError = error as Error & { context?: Response };
  if (invokeError?.context) {
    try {
      const body = (await invokeError.context.clone().json()) as FunctionErrorBody;
      if (body?.error) {
        throw new Error(formatUnknownError(body.error));
      }
      if (typeof body?.message === "string" && body.message.trim()) {
        throw new Error(body.message.trim());
      }
    } catch (parseError) {
      const parseMessage = formatUnknownError(parseError, "");
      const invokeMessage = formatUnknownError(invokeError, "");
      if (parseMessage && parseMessage !== invokeMessage) {
        throw new Error(parseMessage);
      }
    }
  }

  throw new Error(formatUnknownError(invokeError));
}
