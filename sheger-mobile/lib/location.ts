import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

const ADDIS_FALLBACK: Coordinates = {
  latitude: 9.032,
  longitude: 38.7469,
};

export function distanceKm(
  from: Coordinates,
  to: { latitude: number; longitude: number },
) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

// Rough bounding box for Ethiopia. Used to reject obviously wrong pins
// (e.g. 0,0 or coordinates entered in the wrong order).
const ETHIOPIA_BOUNDS = {
  minLat: 3,
  maxLat: 15,
  minLng: 33,
  maxLng: 48,
};

export function isWithinEthiopia(coords: Coordinates | null): coords is Coordinates {
  if (!coords) return false;
  const { latitude, longitude } = coords;
  if (latitude === 0 && longitude === 0) return false;
  return (
    latitude >= ETHIOPIA_BOUNDS.minLat &&
    latitude <= ETHIOPIA_BOUNDS.maxLat &&
    longitude >= ETHIOPIA_BOUNDS.minLng &&
    longitude <= ETHIOPIA_BOUNDS.maxLng
  );
}

export function parseCoordinate(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function requestUserLocation(): Promise<{
  coords: Coordinates | null;
  granted: boolean;
}> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    return { coords: null, granted: false };
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    granted: true,
    coords: {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    },
  };
}

export function getFallbackCoordinates() {
  return ADDIS_FALLBACK;
}

export function useUserLocation() {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [granted, setGranted] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await requestUserLocation();
      setGranted(result.granted);
      setCoords(result.coords);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { coords, granted, loading, refresh };
}
