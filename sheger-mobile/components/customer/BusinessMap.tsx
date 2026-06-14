import { useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { colors, radius } from "@/constants/theme";
import { getFallbackCoordinates, type Coordinates } from "@/lib/location";

export type MapBusiness = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  ratingLabel?: string;
  distanceLabel?: string;
};

type BusinessMapProps = {
  businesses: MapBusiness[];
  center: Coordinates | null;
  height?: number;
  onSelect: (businessId: string) => void;
};

function buildHtml(
  businesses: MapBusiness[],
  center: Coordinates,
  hasUser: boolean,
): string {
  const markers = businesses.map((b) => ({
    id: b.id,
    name: b.name,
    lat: b.latitude,
    lng: b.longitude,
    meta: [b.ratingLabel, b.distanceLabel].filter(Boolean).join(" · "),
  }));

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    .biz-pin {
      background: ${colors.primary}; color: #fff; border: 2px solid #fff;
      border-radius: 50% 50% 50% 0; width: 26px; height: 26px;
      transform: rotate(-45deg); box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center;
    }
    .biz-pin span { transform: rotate(45deg); font: 13px sans-serif; }
    .user-dot {
      background: #1d4ed8; width: 16px; height: 16px; border-radius: 50%;
      border: 3px solid #fff; box-shadow: 0 0 0 2px rgba(29,78,216,0.4);
    }
    .leaflet-popup-content { font-family: sans-serif; }
    .popup-name { font-weight: 600; font-size: 13px; color: #1a1a18; }
    .popup-meta { font-size: 12px; color: #5f5e5a; margin-top: 2px; }
    .popup-btn {
      display: inline-block; margin-top: 6px; background: ${colors.primary};
      color: #fff; font-size: 12px; padding: 5px 10px; border-radius: 8px;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: false })
      .setView([${center.latitude}, ${center.longitude}], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    function post(payload) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    }

    var bizIcon = L.divIcon({
      className: '', html: '<div class="biz-pin"><span>📍</span></div>',
      iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -26]
    });

    var bounds = [];
    var markers = ${JSON.stringify(markers)};

    markers.forEach(function (m) {
      var marker = L.marker([m.lat, m.lng], { icon: bizIcon }).addTo(map);
      var meta = m.meta ? '<div class="popup-meta">' + m.meta + '</div>' : '';
      marker.bindPopup(
        '<div class="popup-name">' + m.name + '</div>' + meta +
        '<a class="popup-btn" href="#" onclick="post({ type: \\'open\\', id: \\'' + m.id + '\\' }); return false;">View business</a>'
      );
      bounds.push([m.lat, m.lng]);
    });

    if (${hasUser ? "true" : "false"}) {
      var userIcon = L.divIcon({ className: '', html: '<div class="user-dot"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
      L.marker([${center.latitude}, ${center.longitude}], { icon: userIcon }).addTo(map);
      bounds.push([${center.latitude}, ${center.longitude}]);
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    }
  </script>
</body>
</html>`;
}

export function BusinessMap({ businesses, center, height = 420, onSelect }: BusinessMapProps) {
  const webRef = useRef<WebView>(null);
  const fallbackCenter = center ?? getFallbackCoordinates();

  // Rebuild the map HTML whenever the marker set or center changes so results
  // stay in sync with the active filters.
  const html = useMemo(
    () => buildHtml(businesses, fallbackCenter, center != null),
    [businesses, fallbackCenter, center],
  );

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { type?: string; id?: string };
      if (data.type === "open" && data.id) {
        onSelect(data.id);
      }
    } catch {
      // ignore malformed messages
    }
  };

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        ref={webRef}
        originWhitelist={["*"]}
        source={{ html }}
        style={styles.web}
        onMessage={onMessage}
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
