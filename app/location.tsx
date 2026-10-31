import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type LocationData = {
  lat?: number;
  lng?: number;
  address: string;
};

type RouteHistory = {
  pickup: string;
  destination: string;
  pickupLat?: number;
  pickupLng?: number;
  destLat?: number;
  destLng?: number;
  timestamp: number;
};

type Suggestion = {
  name: string;
  full: string;
  lat: number;
  lng: number;
};

const HISTORY_KEY = 'faresnap_route_history';
const MAX_HISTORY = 5;
const INDIA_BBOX = '68.1,6.5,97.4,35.7';

const POPULAR_HUBS: { label: string; icon: string; query: string }[] = [
  { label: 'Airport', icon: '✈️', query: 'International Airport' },
  { label: 'Railway Station', icon: '🚉', query: 'Railway Station Junction' },
  { label: 'Metro Station', icon: '🚇', query: 'Metro Station' },
  { label: 'Tech Park', icon: '🏢', query: 'IT Tech Park' },
];

const fetchSuggestions = async (
  query: string,
  signal?: AbortSignal
): Promise<Suggestion[]> => {
  if (query.trim().length < 3) return [];
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      query.trim() + ' India'
    )}&bbox=${INDIA_BBOX}&limit=5&lang=en`;
    const res = await fetch(url, { signal });
    const data = await res.json();
    if (!data.features) return [];
    return data.features.map((f: any) => {
      const p = f.properties;
      const parts = [p.name, p.street, p.city, p.state].filter(Boolean);
      return {
        name: p.name || parts[0] || query.trim(),
        full: parts.join(', ') || query.trim(),
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      };
    });
  } catch {
    return [];
  }
};

export default function LocationScreen() {
  const router = useRouter();
  const [pickup, setPickup] = useState<LocationData>({ address: '' });
  const [drop, setDrop] = useState<LocationData>({ address: '' });
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [history, setHistory] = useState<RouteHistory[]>([]);
  const [pickupSuggestions, setPickupSuggestions] = useState<Suggestion[]>([]);
  const [dropSuggestions, setDropSuggestions] = useState<Suggestion[]>([]);
  const [activeField, setActiveField] = useState<'pickup' | 'drop' | null>(null);

  const pickupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickupAbortRef = useRef<AbortController | null>(null);
  const dropAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadHistory();
    return () => {
      if (pickupTimer.current) clearTimeout(pickupTimer.current);
      if (dropTimer.current) clearTimeout(dropTimer.current);
      if (pickupAbortRef.current) pickupAbortRef.current.abort();
      if (dropAbortRef.current) dropAbortRef.current.abort();
    };
  }, []);

  const loadHistory = async () => {
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  };

  const saveToHistory = async (pickupLoc: LocationData, destLoc: LocationData) => {
    try {
      const pickupAddress = pickupLoc.address.trim();
      const destinationAddress = destLoc.address.trim();
      const newEntry: RouteHistory = {
        pickup: pickupAddress,
        destination: destinationAddress,
        pickupLat: pickupLoc.lat,
        pickupLng: pickupLoc.lng,
        destLat: destLoc.lat,
        destLng: destLoc.lng,
        timestamp: Date.now(),
      };
      const updated = [
        newEntry,
        ...history.filter(
          (h) =>
            !(
              h.pickup.toLowerCase() === pickupAddress.toLowerCase() &&
              h.destination.toLowerCase() === destinationAddress.toLowerCase()
            )
        ),
      ].slice(0, MAX_HISTORY);
      setHistory(updated);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch {}
  };

  const applyHistory = (entry: RouteHistory) => {
    setPickup({
      address: entry.pickup,
      lat: entry.pickupLat,
      lng: entry.pickupLng,
    });
    setDrop({
      address: entry.destination,
      lat: entry.destLat,
      lng: entry.destLng,
    });
    setPickupSuggestions([]);
    setDropSuggestions([]);
  };

  const clearHistory = async () => {
    try {
      await AsyncStorage.removeItem(HISTORY_KEY);
      setHistory([]);
    } catch {}
  };

  const handleSwapLocations = () => {
    const tempPickup = { ...pickup };
    setPickup({ ...drop });
    setDrop(tempPickup);
    setPickupSuggestions([]);
    setDropSuggestions([]);
  };

  const onPickupChange = (text: string) => {
    setPickup({ address: text });
    setActiveField('pickup');
    if (pickupTimer.current) clearTimeout(pickupTimer.current);
    if (pickupAbortRef.current) pickupAbortRef.current.abort();
    if (text.trim().length < 3) {
      setPickupSuggestions([]);
      return;
    }
    pickupTimer.current = setTimeout(async () => {
      const controller = new AbortController();
      pickupAbortRef.current = controller;
      const results = await fetchSuggestions(text, controller.signal);
      if (!controller.signal.aborted) {
        setPickupSuggestions(results);
      }
    }, 350);
  };

  const onDropChange = (text: string) => {
    setDrop({ address: text });
    setActiveField('drop');
    if (dropTimer.current) clearTimeout(dropTimer.current);
    if (dropAbortRef.current) dropAbortRef.current.abort();
    if (text.trim().length < 3) {
      setDropSuggestions([]);
      return;
    }
    dropTimer.current = setTimeout(async () => {
      const controller = new AbortController();
      dropAbortRef.current = controller;
      const results = await fetchSuggestions(text, controller.signal);
      if (!controller.signal.aborted) {
        setDropSuggestions(results);
      }
    }, 350);
  };

  const selectPickup = (s: Suggestion) => {
    setPickup({ address: s.full, lat: s.lat, lng: s.lng });
    setPickupSuggestions([]);
    setActiveField(null);
  };

  const selectDrop = (s: Suggestion) => {
    setDrop({ address: s.full, lat: s.lat, lng: s.lng });
    setDropSuggestions([]);
    setActiveField(null);
  };

  const handleQuickHubPress = (hubQuery: string) => {
    const cityHint = pickup.address.split(',').slice(-2, -1)[0]?.trim() || '';
    const fullQuery = cityHint ? `${hubQuery}, ${cityHint}` : hubQuery;
    if (!pickup.address.trim()) {
      onPickupChange(fullQuery);
    } else {
      onDropChange(fullQuery);
    }
  };

  const getCurrentLocation = async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        Alert.alert('Permission denied', 'Location permission is required.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = position.coords;
      let addressString = '';

      try {
        const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (address) {
          addressString = [address.name, address.street, address.city, address.region]
            .filter(Boolean)
            .join(', ');
        }
      } catch {
        // Fallback to Photon reverse geocode below
      }

      if (!addressString) {
        try {
          const res = await fetch(
            `https://photon.komoot.io/reverse?lon=${longitude}&lat=${latitude}&lang=en`
          );
          const data = await res.json();
          const p = data?.features?.[0]?.properties;
          if (p) {
            addressString = [p.name, p.street, p.city, p.state].filter(Boolean).join(', ');
          }
        } catch {
          // Use coordinate label fallback
        }
      }

      setPickup({
        lat: latitude,
        lng: longitude,
        address: addressString || `Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
      });
      setPickupSuggestions([]);
    } catch {
      Alert.alert('Error', 'Failed to get current location.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    const cleanPickup = pickup.address.trim();
    const cleanDrop = drop.address.trim();
    if (!cleanPickup || !cleanDrop) {
      Alert.alert('Missing locations', 'Please enter both pickup and drop locations.');
      return;
    }
    const sameCoords =
      typeof pickup.lat === 'number' &&
      typeof pickup.lng === 'number' &&
      typeof drop.lat === 'number' &&
      typeof drop.lng === 'number' &&
      Math.abs(pickup.lat - drop.lat) < 0.0005 &&
      Math.abs(pickup.lng - drop.lng) < 0.0005;

    if (cleanPickup.toLowerCase() === cleanDrop.toLowerCase() || sameCoords) {
      Alert.alert('Invalid route', 'Pickup and drop locations cannot be the same.');
      return;
    }

    setComparing(true);
    await saveToHistory(pickup, drop);
    router.push({
      pathname: '/results',
      params: {
        pickup: JSON.stringify(pickup),
        destination: JSON.stringify(drop),
      },
    });
    setComparing(false);
  };

  const timeAgo = (timestamp: number) => {
    const diff = Math.max(0, Date.now() - timestamp);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <Stack.Screen
        options={{
          title: 'Enter locations',
          headerStyle: { backgroundColor: '#ffffff' },
          headerTitleStyle: { color: '#0f172a', fontWeight: '700' },
          headerTintColor: '#2563eb',
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Route card — pickup + drop + swap */}
        <View style={styles.routeCard}>
          {/* Pickup row */}
          <View style={styles.inputRow}>
            <View style={styles.dotIndicatorGreen} />
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Pickup</Text>
              <View style={styles.inputFieldRow}>
                <TextInput
                  style={styles.input}
                  placeholder="Where from?"
                  placeholderTextColor="#94a3b8"
                  value={pickup.address}
                  onChangeText={onPickupChange}
                  onFocus={() => setActiveField('pickup')}
                />
                {pickup.address.length > 0 && (
                  <TouchableOpacity
                    style={styles.clearInputBtn}
                    onPress={() => {
                      setPickup({ address: '' });
                      setPickupSuggestions([]);
                    }}
                  >
                    <Text style={styles.clearInputText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Connector line + Swap button */}
          <View style={styles.connectorRow}>
            <View style={styles.connectorLine} />
            <View style={styles.dividerLineHorizontal} />
            <TouchableOpacity
              style={styles.swapButton}
              onPress={handleSwapLocations}
              activeOpacity={0.75}
            >
              <Text style={styles.swapButtonText}>⇅</Text>
            </TouchableOpacity>
          </View>

          {/* Drop row */}
          <View style={styles.inputRow}>
            <View style={styles.dotIndicatorBlue} />
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Drop</Text>
              <View style={styles.inputFieldRow}>
                <TextInput
                  style={styles.input}
                  placeholder="Where to?"
                  placeholderTextColor="#94a3b8"
                  value={drop.address}
                  onChangeText={onDropChange}
                  onFocus={() => setActiveField('drop')}
                />
                {drop.address.length > 0 && (
                  <TouchableOpacity
                    style={styles.clearInputBtn}
                    onPress={() => {
                      setDrop({ address: '' });
                      setDropSuggestions([]);
                    }}
                  >
                    <Text style={styles.clearInputText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Pickup suggestions */}
        {pickupSuggestions.length > 0 && activeField === 'pickup' && (
          <View style={styles.suggestionsCard}>
            {pickupSuggestions.map((s, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.suggestionItem,
                  i < pickupSuggestions.length - 1 && styles.suggestionBorder,
                ]}
                onPress={() => selectPickup(s)}
              >
                <Text style={styles.suggestionName}>📍 {s.name}</Text>
                <Text style={styles.suggestionFull} numberOfLines={1}>{s.full}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Drop suggestions */}
        {dropSuggestions.length > 0 && activeField === 'drop' && (
          <View style={styles.suggestionsCard}>
            {dropSuggestions.map((s, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.suggestionItem,
                  i < dropSuggestions.length - 1 && styles.suggestionBorder,
                ]}
                onPress={() => selectDrop(s)}
              >
                <Text style={styles.suggestionName}>📍 {s.name}</Text>
                <Text style={styles.suggestionFull} numberOfLines={1}>{s.full}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Current location button */}
        <TouchableOpacity
          style={styles.currentLocationButton}
          onPress={getCurrentLocation}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Text style={styles.currentLocationIcon}>📍</Text>
          <Text style={styles.currentLocationText}>
            {loading ? 'Getting location...' : 'Use my current location'}
          </Text>
          {loading && <ActivityIndicator size="small" color="#2563eb" style={{ marginLeft: 8 }} />}
        </TouchableOpacity>

        {/* Quick Destination Hubs */}
        <View style={styles.hubsSection}>
          <Text style={styles.historyTitle}>Quick fill</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            {POPULAR_HUBS.map((hub) => (
              <TouchableOpacity
                key={hub.label}
                style={styles.hubPill}
                onPress={() => handleQuickHubPress(hub.query)}
                activeOpacity={0.75}
              >
                <Text style={styles.hubPillText}>
                  {hub.icon} {hub.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Recent routes */}
        {history.length > 0 && (
          <View style={styles.historySection}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Recent routes</Text>
              <TouchableOpacity onPress={clearHistory}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {history.map((entry, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.chip}
                  onPress={() => applyHistory(entry)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipText} numberOfLines={1}>
                    {entry.pickup.split(',')[0]} → {entry.destination.split(',')[0]}
                  </Text>
                  <Text style={styles.chipTime}>{timeAgo(entry.timestamp)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Compare button */}
        <TouchableOpacity
          style={[styles.compareButton, comparing && styles.compareButtonDisabled]}
          onPress={handleCompare}
          disabled={comparing}
          activeOpacity={0.85}
        >
          {comparing ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.compareText}>Compare rides →</Text>
          )}
        </TouchableOpacity>

        {/* BuyHatke-style Trust Strip */}
        <View style={styles.trustRow}>
          <View style={styles.trustBadge}>
            <Text style={styles.trustBadgeText}>✓ Avg 20%+ savings</Text>
          </View>
          <View style={styles.trustBadge}>
            <Text style={styles.trustBadgeText}>✓ Smart Pickup</Text>
          </View>
          <View style={styles.trustBadge}>
            <Text style={styles.trustBadgeText}>✓ No Login Storage</Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },

  // Route card
  routeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  dotIndicatorGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    marginTop: 22,
    flexShrink: 0,
  },
  dotIndicatorBlue: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563eb',
    marginTop: 22,
    flexShrink: 0,
  },
  connectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  connectorLine: {
    width: 2,
    height: 20,
    backgroundColor: '#cbd5e1',
    marginLeft: 5,
  },
  dividerLineHorizontal: {
    flex: 1,
    height: 1,
    backgroundColor: '#f1f5f9',
    marginLeft: 18,
    marginRight: 8,
  },
  swapButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563eb',
  },
  inputWrapper: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  inputFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '500',
    paddingVertical: 4,
  },
  clearInputBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearInputText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '700',
  },

  // Suggestions
  suggestionsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    overflow: 'hidden',
  },
  suggestionItem: {
    padding: 14,
  },
  suggestionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  suggestionFull: {
    fontSize: 12,
    color: '#64748b',
  },

  // Current location
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 8,
  },
  currentLocationIcon: {
    fontSize: 16,
  },
  currentLocationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1d4ed8',
    flex: 1,
  },

  // Quick Hubs
  hubsSection: {
    marginBottom: 20,
  },
  hubPill: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  hubPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },

  // History
  historySection: {
    marginBottom: 24,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearText: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '600',
  },
  chip: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxWidth: 200,
  },
  chipText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTime: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  compareButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  compareButtonDisabled: {
    opacity: 0.6,
  },
  compareText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
  },
  trustBadge: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  trustBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
});
