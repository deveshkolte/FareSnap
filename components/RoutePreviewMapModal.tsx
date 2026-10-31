import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { openWalkingDirections } from '../utils/appUrls';
import type { RouteCoords } from '../utils/distanceEngine';

type Props = {
  visible: boolean;
  originCoords: RouteCoords;
  smartPickupCoords?: RouteCoords;
  smartPickupLabel?: string;
  walkMeters?: number;
  destCoords: RouteCoords;
  onClose: () => void;
};

const buildRoutePreviewHtml = (opts: {
  origin: RouteCoords;
  smart?: RouteCoords;
  smartLabel?: string;
  dest: RouteCoords;
}) => {
  const { origin, smart, smartLabel, dest } = opts;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; font-family: -apple-system, sans-serif; }
    .pin-label { font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 6px; background: #fff; border: 1px solid #cbd5e1; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var origin = [${origin.lat}, ${origin.lng}];
    var dest = [${dest.lat}, ${dest.lng}];
    var smart = ${smart ? `[${smart.lat}, ${smart.lng}]` : 'null'};

    var map = L.map('map', { zoomControl: true }).setView(smart || origin, 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    var greenIcon = L.divIcon({
      className: '',
      html: '<div style="width:16px;height:16px;border-radius:8px;background:#10b981;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    var blueIcon = L.divIcon({
      className: '',
      html: '<div style="width:20px;height:20px;border-radius:10px;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 8px rgba(37,99,235,0.5);"></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });

    var redIcon = L.divIcon({
      className: '',
      html: '<div style="width:16px;height:16px;border-radius:8px;background:#ef4444;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    L.marker(origin, { icon: greenIcon }).addTo(map).bindPopup('Current Location');
    L.marker(dest, { icon: redIcon }).addTo(map).bindPopup('Destination');

    if (smart) {
      L.marker(smart, { icon: blueIcon }).addTo(map).bindPopup(${JSON.stringify(
        smartLabel || 'Smart Pickup'
      )}).openPopup();
      // Dashed walking line from Origin to Smart Pickup
      L.polyline([origin, smart], { color: '#16a34a', weight: 4, dashArray: '6, 8' }).addTo(map);
      // Driving line from Smart Pickup to Destination
      L.polyline([smart, dest], { color: '#4338ca', weight: 4, opacity: 0.75 }).addTo(map);
      map.fitBounds(L.latLngBounds([origin, smart]), { padding: [55, 55], maxZoom: 17 });
    } else {
      L.polyline([origin, dest], { color: '#4338ca', weight: 4, opacity: 0.75 }).addTo(map);
      map.fitBounds(L.latLngBounds([origin, dest]), { padding: [45, 45] });
    }
  </script>
</body>
</html>
`;
};

export function RoutePreviewMapModal({
  visible,
  originCoords,
  smartPickupCoords,
  smartPickupLabel,
  walkMeters,
  destCoords,
  onClose,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>
            {smartPickupCoords
              ? 'Smart Pickup Walking Map'
              : 'Route Map Preview'}
          </Text>
          {smartPickupLabel && (
            <Text style={styles.subtitle} numberOfLines={2}>
              🚶 Walk {walkMeters ?? 170}m from green pin to blue pin ({smartPickupLabel})
            </Text>
          )}

          <View style={styles.mapBox}>
            {Platform.OS === 'web' ? (
              <iframe
                title="Route Preview Map"
                srcDoc={buildRoutePreviewHtml({
                  origin: originCoords,
                  smart: smartPickupCoords,
                  smartLabel: smartPickupLabel,
                  dest: destCoords,
                })}
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            ) : (
              <WebView
                originWhitelist={['*']}
                source={{
                  html: buildRoutePreviewHtml({
                    origin: originCoords,
                    smart: smartPickupCoords,
                    smartLabel: smartPickupLabel,
                    dest: destCoords,
                  }),
                }}
                style={{ flex: 1 }}
              />
            )}
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
            {smartPickupCoords && (
              <TouchableOpacity
                style={styles.walkBtn}
                onPress={() =>
                  openWalkingDirections(originCoords, smartPickupCoords)
                }
                activeOpacity={0.85}
              >
                <Text style={styles.walkBtnText}>🧭 Walking Directions</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#94a3b8',
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#166534',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
  },
  mapBox: {
    height: 310,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f1f5f9',
    marginBottom: 16,
  },
  webFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  webText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  closeBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 15,
    borderRadius: 28,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  walkBtn: {
    flex: 1.4,
    backgroundColor: '#2563eb',
    paddingVertical: 15,
    borderRadius: 28,
    alignItems: 'center',
  },
  walkBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
