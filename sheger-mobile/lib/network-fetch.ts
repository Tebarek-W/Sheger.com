import axios from "axios";
import { Platform } from "react-native";

const DEFAULT_TIMEOUT_MS = 30_000;

function headersToRecord(headers?: HeadersInit): Record<string, string> {
  const record: Record<string, string> = {};

  if (!headers) {
    return record;
  }

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }

  if (Array.isArray(headers)) {
    headers.forEach(([key, value]) => {
      record[key] = value;
    });
    return record;
  }

  return { ...headers };
}

/**
 * Expo SDK 54 on Android can fail HTTPS requests via the default fetch API.
 * Axios uses a different network stack and works reliably on physical devices.
 */
async function axiosFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  const callerSignal = init?.signal;
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort();
    } else {
      callerSignal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  let result;
  try {
    result = await axios({
      url,
      method: (init?.method ?? "GET").toUpperCase(),
      headers: headersToRecord(init?.headers),
      data: init?.body,
      signal: controller.signal,
      validateStatus: () => true,
      responseType: "text",
      transformResponse: [(data) => data],
    });
  } catch (error) {
    if (axios.isAxiosError(error) && (error.code === "ERR_CANCELED" || controller.signal.aborted)) {
      throw new TypeError("Network request timed out. Check your connection and try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const responseHeaders = new Headers();
  Object.entries(result.headers).forEach(([key, value]) => {
    if (typeof value === "string") {
      responseHeaders.set(key, value);
    }
  });

  return new Response(result.data, {
    status: result.status,
    statusText: result.statusText,
    headers: responseHeaders,
  });
}

export const appFetch: typeof fetch =
  Platform.OS === "android" ? axiosFetch : fetch.bind(globalThis);
