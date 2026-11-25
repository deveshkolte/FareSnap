import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

type Props = {
  visible: boolean;
  initialLat: number;
  initialLng: number;
  initialAddress: string;
  onCancel: () => void;
  onConfirm: (coords: { lat: number; lng: number; address: string }) => void;
};

const buildLeafletHtml = (lat: number, lng: number) => {
  const safeLat = Number.isFinite(lat) ? lat : 12.9716;
  const safeLng = Number.isFinite(lng) ? lng : 77.5946;
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
    .leaflet-control-attribution { font-size: 10px !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var lat = ${safeLat};
    var lng = ${safeLng};
    var map = L.map('map', { zoomControl: true }).setView([lat, lng], 17);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    var circle = L.circle([lat, lng], {
      color: '#2563eb',
      fillColor: '#6366f1',
      fillOpacity: 0.22,
      weight: 2,
      radius: 65
    }).addTo(map);

    var marker = L.marker([lat, lng], { draggable: true }).addTo(map);

    function notify(newLat, newLng) {
      circle.setLatLng([newLat, newLng]);
      marker.setLatLng([newLat, newLng]);
      var payload = JSON.stringify({ type: 'PIN_MOVED', lat: newLat, lng: newLng });
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(payload);
      } else if (window.parent) {
        window.parent.postMessage(payload, '*');
      }
    }

    marker.on('dragend', function(e) {
      var pos = e.target.getLatLng();
      notify(pos.lat, pos.lng);
    });

    map.on('click', function(e) {
      notify(e.latlng.lat, e.latlng.lng);
    });
  </script>
</body>
</html>
`;
};

export function ConfirmPickupMapModal({
  visible,
  initialLat,
  initialLng,
  initialAddress,
  onCancel,
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets();
  const [coords, setCoords] = useState({ lat: initialLat, lng: initialLng });
  const [address, setAddress] = useState(initialAddress);
  const [reverseLoading, setReverseLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setCoords({ lat: initialLat, lng: initialLng });
      setAddress(initialAddress);
    }
  }, [visible, initialLat, initialLng, initialAddress]);

  const handlePinMove = async (newLat: number, newLng: number) => {
    const roundedLat = Math.round(newLat * 1e6) / 1e6;
    const roundedLng = Math.round(newLng * 1e6) / 1e6;
    setCoords({ lat: roundedLat, lng: roundedLng });
    setReverseLoading(true);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3200);
      const res = await fetch(
        `https://photon.komoot.io/reverse?lon=${roundedLng}&lat=${roundedLat}&lang=en`,
        { signal: ctrl.signal }
      );
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const p = data?.features?.[0]?.properties;
        if (p) {
          const formatted = [p.name, p.street, p.district, p.city, p.state]
            .filter(Boolean)
            .join(', ');
          if (formatted) {
            setAddress(formatted);
          }
        }
      }
    } catch {
      // Keep existing address if reverse lookup fails
    } finally {
      setReverseLoading(false);
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible || typeof window === 'undefined') {
      return;
    }
    const listener = (event: MessageEvent) => {
      try {
        const parsed =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (
          parsed?.type === 'PIN_MOVED' &&
          typeof parsed.lat === 'number' &&
          typeof parsed.lng === 'number'
        ) {
          handlePinMove(parsed.lat, parsed.lng);
        }
      } catch {}
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom + 16, 28) },
          ]}
        >
          <View style={styles.handleBar} />
          <Text style={styles.title}>Confirm Pickup</Text>

          <View style={styles.mapContainer}>
            {Platform.OS === 'web' ? (
              <iframe
                title="Confirm Pickup Map"
                srcDoc={buildLeafletHtml(initialLat, initialLng)}
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            ) : (
              <WebView
                originWhitelist={['*']}
                source={{ html: buildLeafletHtml(initialLat, initialLng) }}
                style={styles.webview}
                onMessage={(event) => {
                  try {
                    const parsed = JSON.parse(event.nativeEvent.data);
                    if (
                      parsed?.type === 'PIN_MOVED' &&
                      typeof parsed.lat === 'number' &&
                      typeof parsed.lng === 'number'
                    ) {
                      handlePinMove(parsed.lat, parsed.lng);
                    }
                  } catch {}
                }}
              />
            )}
          </View>

          <View style={styles.addressBox}>
            <Text style={styles.addressText} numberOfLines={2}>
              {address}
            </Text>
            {reverseLoading && (
              <ActivityIndicator
                size="small"
                color="#4f46e5"
                style={{ marginLeft: 8 }}
              />
            )}
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() =>
                onConfirm({
                  lat: coords.lat,
                  lng: coords.lng,
                  address,
                })
              }
              activeOpacity={0.85}
            >
              <Text style={styles.confirmButtonText}>Confirm Location</Text>
            </TouchableOpacity>
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
  handleBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#94a3b8',
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 16,
  },
  mapContainer: {
    height: 310,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f1f5f9',
    marginBottom: 14,
  },
  webview: {
    flex: 1,
  },
  webMapFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e0f2fe',
  },
  webMapPin: {
    fontSize: 42,
    marginBottom: 6,
  },
  webMapCoords: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  webMapHint: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
    marginBottom: 18,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 15,
    borderRadius: 28,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  confirmButton: {
    flex: 1.2,
    backgroundColor: '#4338ca',
    paddingVertical: 15,
    borderRadius: 28,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});
