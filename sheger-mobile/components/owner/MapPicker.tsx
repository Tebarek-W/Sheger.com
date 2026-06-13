import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { colors, radius } from "@/constants/theme";
import { getFallbackCoordinates, type Coordinates } from "@/lib/location";

type MapPickerProps = {
  value: Coordinates | null;
  onChange: (coords: Coordinates) => void;
  height?: number;
};

// Leaflet + OpenStreetMap tiles. Fully free, no API key, no billing.
function buildHtml(center: Coordinates, hasMarker: boolean) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    .hint {
      position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%);
      background: rgba(13,77,13,0.85); color: #fff; font-family: sans-serif;
      font-size: 12px; padding: 6px 12px; border-radius: 999px; z-index: 1000;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="hint">Tap the map or drag the pin</div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: false })
      .setView([${center.latitude}, ${center.longitude}], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    var marker = null;

    function post(lat, lng) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ latitude: lat, longitude: lng }));
      }
    }

    function setMarker(lat, lng, fly) {
      if (!marker) {
        marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        marker.on('dragend', function (e) {
          var p = e.target.getLatLng();
          post(p.lat, p.lng);
        });
      } else {
        marker.setLatLng([lat, lng]);
      }
      if (fly) map.setView([lat, lng], Math.max(map.getZoom(), 15));
    }

    if (${hasMarker ? "true" : "false"}) {
      setMarker(${center.latitude}, ${center.longitude}, false);
    }

    map.on('click', function (e) {
      setMarker(e.latlng.lat, e.latlng.lng, false);
      post(e.latlng.lat, e.latlng.lng);
    });

    document.addEventListener('message', handleExternal);
    window.addEventListener('message', handleExternal);
    function handleExternal(event) {
      try {
        var data = JSON.parse(event.data);
        if (data && typeof data.latitude === 'number') {
          setMarker(data.latitude, data.longitude, true);
        }
      } catch (err) {}
    }
  </script>
</body>
</html>`;
}

export function MapPicker({ value, onChange, height = 240 }: MapPickerProps) {
  const webRef = useRef<WebView>(null);
  const loadedRef = useRef(false);
  // Tracks the last coordinate we sent to or received from the map so we don't
  // bounce external updates back and forth.
  const lastSyncedRef = useRef<Coordinates | null>(value);
  const initial = value ?? getFallbackCoordinates();

  // HTML is built once; later updates go through injectJavaScript.
  const html = useMemo(
    () => buildHtml(initial, value != null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const syncToMap = (coords: Coordinates) => {
    lastSyncedRef.current = coords;
    webRef.current?.injectJavaScript(
      `handleExternal({ data: '${JSON.stringify(coords)}' }); true;`,
    );
  };

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as Coordinates;
      if (typeof data.latitude === "number" && typeof data.longitude === "number") {
        lastSyncedRef.current = data;
        onChange({ latitude: data.latitude, longitude: data.longitude });
      }
    } catch {
      // ignore malformed messages
    }
  };

  useEffect(() => {
    if (!loadedRef.current || !value) return;
    const last = lastSyncedRef.current;
    const changed =
      !last ||
      Math.abs(last.latitude - value.latitude) > 1e-6 ||
      Math.abs(last.longitude - value.longitude) > 1e-6;
    if (changed) syncToMap(value);
  }, [value]);

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.web}
        onMessage={onMessage}
        onLoadEnd={() => {
          loadedRef.current = true;
          if (value) syncToMap(value);
        }}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.screenBg,
  },
  web: { flex: 1, backgroundColor: "transparent" },
});
