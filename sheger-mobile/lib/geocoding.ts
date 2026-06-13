import { appFetch } from "@/lib/network-fetch";
import type { Coordinates } from "@/lib/location";

// OpenStreetMap Nominatim — free, no API key, no billing.
// Usage policy: identify the app, keep requests light, max ~1 req/sec.
// https://operations.osmfoundation.org/policies/nominatim/
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const APP_IDENTIFIER = "ShegerBooking/1.0 (https://sheger.app)";

// Bias results toward Ethiopia / Addis Ababa.
const ETHIOPIA_VIEWBOX = "33,15,48,3"; // left,top,right,bottom

export type PlaceResult = {
  id: string;
  label: string;
  coords: Coordinates;
};

type NominatimSearchItem = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

type NominatimReverse = {
  display_name?: string;
  address?: Record<string, string>;
};

const baseHeaders = {
  "User-Agent": APP_IDENTIFIER,
  Referer: "https://sheger.app",
  Accept: "application/json",
  "Accept-Language": "en",
};

async function getJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await appFetch(url, {
      signal: controller.signal,
      headers: baseHeaders,
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const params = new URLSearchParams({
    q: trimmed,
    format: "jsonv2",
    limit: "6",
    countrycodes: "et",
    viewbox: ETHIOPIA_VIEWBOX,
    bounded: "1",
    "accept-language": "en",
  });

  const data = await getJson<NominatimSearchItem[]>(
    `${NOMINATIM_BASE}/search?${params.toString()}`,
  );
  if (!data) return [];

  return data.map((item) => ({
    id: String(item.place_id),
    label: item.display_name,
    coords: {
      latitude: Number(item.lat),
      longitude: Number(item.lon),
    },
  }));
}

function shortLabel(reverse: NominatimReverse): string | null {
  if (reverse.address) {
    const a = reverse.address;
    const parts = [
      a.road || a.neighbourhood || a.suburb,
      a.suburb && a.suburb !== a.neighbourhood ? a.suburb : undefined,
      a.city || a.town || a.state,
    ].filter(Boolean);
    if (parts.length) return Array.from(new Set(parts)).join(", ");
  }
  return reverse.display_name ?? null;
}

export async function reverseGeocode(coords: Coordinates): Promise<string | null> {
  const params = new URLSearchParams({
    lat: String(coords.latitude),
    lon: String(coords.longitude),
    format: "jsonv2",
    zoom: "18",
    "accept-language": "en",
  });

  const data = await getJson<NominatimReverse>(
    `${NOMINATIM_BASE}/reverse?${params.toString()}`,
  );
  if (!data) return null;
  return shortLabel(data);
}
