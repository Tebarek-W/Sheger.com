import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors, radius } from "@/constants/theme";
import { reverseGeocode, searchPlaces, type PlaceResult } from "@/lib/geocoding";
import { requestUserLocation, type Coordinates } from "@/lib/location";

export type LocationCenter = {
  coords: Coordinates;
  label: string;
  source: "gps" | "place";
};

type LocationSearchBarProps = {
  center: LocationCenter | null;
  onChange: (center: LocationCenter | null) => void;
};

export function LocationSearchBar({ center, onChange }: LocationSearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const onChangeQuery = (text: string) => {
    setQuery(text);
    if (timer.current) clearTimeout(timer.current);
    if (text.trim().length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      const places = await searchPlaces(text);
      setResults(places);
      setSearching(false);
    }, 450);
  };

  const pickPlace = (place: PlaceResult) => {
    setQuery("");
    setResults([]);
    onChange({
      coords: place.coords,
      label: place.label.split(",").slice(0, 2).join(",").trim(),
      source: "place",
    });
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const result = await requestUserLocation();
      if (!result.granted || !result.coords) {
        Alert.alert(
          "Location unavailable",
          "Allow location access, or search for an area instead.",
        );
        return;
      }
      const label = (await reverseGeocode(result.coords)) ?? "My location";
      onChange({ coords: result.coords, label, source: "gps" });
      setQuery("");
      setResults([]);
    } catch {
      Alert.alert("Could not get location", "Try searching for an area instead.");
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {center ? (
        <View style={styles.activeRow}>
          <Text style={styles.pin}>{center.source === "gps" ? "🧭" : "📍"}</Text>
          <Text style={styles.activeLabel} numberOfLines={1}>
            {center.label}
          </Text>
          <Pressable onPress={() => onChange(null)} hitSlop={8}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Text style={styles.icon}>📍</Text>
            <TextInput
              value={query}
              onChangeText={onChangeQuery}
              placeholder="Area, district or neighborhood"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
            {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          </View>
          <Pressable
            onPress={useCurrentLocation}
            disabled={locating}
            style={styles.gpsBtn}
          >
            {locating ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.gpsText}>Near me</Text>
            )}
          </Pressable>
        </View>
      )}

      {results.length > 0 ? (
        <View style={styles.results}>
          {results.map((place) => (
            <Pressable key={place.id} style={styles.resultItem} onPress={() => pickPlace(place)}>
              <Text style={styles.resultIcon}>📍</Text>
              <Text style={styles.resultText} numberOfLines={2}>
                {place.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  searchRow: { flexDirection: "row", gap: 8 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  icon: { fontSize: 14 },
  input: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 2 },
  gpsBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 78,
  },
  gpsText: { color: colors.white, fontSize: 13, fontWeight: "600" },
  activeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  pin: { fontSize: 14 },
  activeLabel: { flex: 1, fontSize: 14, color: colors.text, fontWeight: "500" },
  clear: { fontSize: 13, color: colors.primary, fontWeight: "600" },
  results: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  resultIcon: { fontSize: 14 },
  resultText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
});
