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

import { MapPicker } from "@/components/owner/MapPicker";
import { colors, radius } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import { reverseGeocode, searchPlaces, type PlaceResult } from "@/lib/geocoding";
import {
  getFallbackCoordinates,
  isWithinEthiopia,
  parseCoordinate,
  requestUserLocation,
  type Coordinates,
} from "@/lib/location";

type LocationPickerProps = {
  value: Coordinates | null;
  onChange: (coords: Coordinates) => void;
  onResolveAddress?: (address: string) => void;
};

export function LocationPicker({ value, onChange, onResolveAddress }: LocationPickerProps) {
  const { t } = useI18n();
  const [locating, setLocating] = useState(false);
  const [manual, setManual] = useState(false);
  const [latText, setLatText] = useState(value ? String(value.latitude) : "");
  const [lngText, setLngText] = useState(value ? String(value.longitude) : "");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const resolveAddress = async (coords: Coordinates) => {
    const label = await reverseGeocode(coords);
    if (label) {
      setResolvedAddress(label);
      onResolveAddress?.(label);
    }
  };

  const applyCoords = (coords: Coordinates, withReverse = true) => {
    if (!isWithinEthiopia(coords)) {
      Alert.alert(
        t("owner.components.locationPicker.locationOffTitle"),
        t("owner.components.locationPicker.locationOffMessage"),
      );
      return;
    }
    setLatText(coords.latitude.toFixed(6));
    setLngText(coords.longitude.toFixed(6));
    onChange(coords);
    if (withReverse) resolveAddress(coords);
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const result = await requestUserLocation();
      if (!result.granted) {
        Alert.alert(
          t("owner.components.locationPicker.permissionTitle"),
          t("owner.components.locationPicker.permissionMessage"),
        );
        return;
      }
      if (!result.coords) {
        Alert.alert(
          t("owner.components.locationPicker.getLocationFailedTitle"),
          t("owner.components.locationPicker.getLocationFailedMessage"),
        );
        return;
      }
      applyCoords(result.coords);
    } catch {
      Alert.alert(
        t("owner.components.locationPicker.getLocationFailedTitle"),
        t("owner.components.locationPicker.getLocationFailedMessage"),
      );
    } finally {
      setLocating(false);
    }
  };

  const onChangeQuery = (text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const places = await searchPlaces(text);
      setResults(places);
      setSearching(false);
    }, 500);
  };

  const pickResult = (place: PlaceResult) => {
    setQuery(place.label.split(",").slice(0, 2).join(",").trim());
    setResults([]);
    setResolvedAddress(place.label);
    onResolveAddress?.(place.label);
    applyCoords(place.coords, false);
  };

  const applyManual = () => {
    const latitude = parseCoordinate(latText);
    const longitude = parseCoordinate(lngText);
    if (latitude == null || longitude == null) {
      Alert.alert(
        t("owner.components.locationPicker.invalidCoordsTitle"),
        t("owner.components.locationPicker.invalidCoordsMessage"),
      );
      return;
    }
    applyCoords({ latitude, longitude });
  };

  const hasLocation = isWithinEthiopia(value);
  const fallback = getFallbackCoordinates();

  return (
    <View style={styles.wrap}>
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          placeholder={t("owner.components.locationPicker.searchPlaceholder")}
          placeholderTextColor={colors.textTertiary}
          style={styles.searchInput}
        />
        {searching ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>

      {results.length > 0 ? (
        <View style={styles.results}>
          {results.map((place) => (
            <Pressable key={place.id} style={styles.resultItem} onPress={() => pickResult(place)}>
              <Text style={styles.resultIcon}>📍</Text>
              <Text style={styles.resultText} numberOfLines={2}>
                {place.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <MapPicker value={value} onChange={(coords) => applyCoords(coords)} />

      <View style={[styles.statusCard, hasLocation && styles.statusCardSet]}>
        <Text style={styles.statusIcon}>{hasLocation ? "📍" : "📌"}</Text>
        <View style={styles.statusInfo}>
          {hasLocation && value ? (
            <>
              <Text style={styles.statusTitle}>{t("owner.components.locationPicker.locationSet")}</Text>
              {resolvedAddress ? (
                <Text style={styles.statusAddress} numberOfLines={2}>
                  {resolvedAddress}
                </Text>
              ) : null}
              <Text style={styles.statusCoords}>
                {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.statusTitleMuted}>{t("owner.components.locationPicker.noLocation")}</Text>
              <Text style={styles.statusHint}>
                {t("owner.components.locationPicker.noLocationHint")}
              </Text>
            </>
          )}
        </View>
      </View>

      <Pressable style={styles.primaryBtn} onPress={useCurrentLocation} disabled={locating}>
        {locating ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.primaryBtnText}>
            {hasLocation
              ? t("owner.components.locationPicker.updateCurrent")
              : t("owner.components.locationPicker.useCurrent")}
          </Text>
        )}
      </Pressable>

      <Pressable onPress={() => setManual((m) => !m)}>
        <Text style={styles.manualToggle}>
          {manual
            ? t("owner.components.locationPicker.hideManual")
            : t("owner.components.locationPicker.showManual")}
        </Text>
      </Pressable>

      {manual ? (
        <View style={styles.manualBox}>
          <View style={styles.manualRow}>
            <View style={styles.manualField}>
              <Text style={styles.manualLabel}>{t("owner.components.locationPicker.latitude")}</Text>
              <TextInput
                value={latText}
                onChangeText={setLatText}
                keyboardType="numbers-and-punctuation"
                placeholder={String(fallback.latitude)}
                placeholderTextColor={colors.textTertiary}
                style={styles.manualInput}
              />
            </View>
            <View style={styles.manualField}>
              <Text style={styles.manualLabel}>{t("owner.components.locationPicker.longitude")}</Text>
              <TextInput
                value={lngText}
                onChangeText={setLngText}
                keyboardType="numbers-and-punctuation"
                placeholder={String(fallback.longitude)}
                placeholderTextColor={colors.textTertiary}
                style={styles.manualInput}
              />
            </View>
          </View>
          <Pressable style={styles.manualApply} onPress={applyManual}>
            <Text style={styles.manualApplyText}>{t("owner.components.locationPicker.setLocation")}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchIcon: { fontSize: 15 },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 2 },
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
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.screenBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  statusCardSet: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  statusIcon: { fontSize: 24 },
  statusInfo: { flex: 1, gap: 2 },
  statusTitle: { fontSize: 14, fontWeight: "600", color: colors.primaryDark },
  statusTitleMuted: { fontSize: 14, fontWeight: "600", color: colors.text },
  statusAddress: { fontSize: 13, color: colors.primaryDark, lineHeight: 18 },
  statusCoords: { fontSize: 12, color: colors.textSecondary },
  statusHint: { fontSize: 12, color: colors.textSecondary, lineHeight: 16 },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: colors.white, fontSize: 15, fontWeight: "500" },
  manualToggle: { fontSize: 13, color: colors.primary, fontWeight: "500" },
  manualBox: {
    gap: 10,
    backgroundColor: colors.screenBg,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  manualRow: { flexDirection: "row", gap: 10 },
  manualField: { flex: 1, gap: 6 },
  manualLabel: { fontSize: 13, fontWeight: "500", color: colors.textSecondary },
  manualInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  manualApply: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.brandDark,
    alignItems: "center",
    justifyContent: "center",
  },
  manualApplyText: { color: colors.white, fontSize: 14, fontWeight: "500" },
});
