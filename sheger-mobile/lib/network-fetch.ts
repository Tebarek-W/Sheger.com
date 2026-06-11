import axios from "axios";
import { Platform } from "react-native";

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

  const result = await axios({
    url,
    method: (init?.method ?? "GET").toUpperCase(),
    headers: headersToRecord(init?.headers),
    data: init?.body,
    validateStatus: () => true,
    responseType: "text",
    transformResponse: [(data) => data],
  });

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
