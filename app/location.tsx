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

const fetchSuggestions = async (query: string): Promise<Suggestion[]> => {
  if (query.length < 3) return [];
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query + ' India')}&limit=5&lang=en`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.features) return [];
    return data.features.map((f: any) => {
      const p = f.properties;
      const parts = [p.name, p.street, p.city, p.state].filter(Boolean);
      return {
        name: p.name || parts[0],
        full: parts.join(', '),
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

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  };

  const saveToHistory = async (pickupAddress: string, destinationAddress: string) => {
    try {
      const newEntry: RouteHistory = {
        pickup: pickupAddress,
        destination: destinationAddress,
        timestamp: Date.now(),
      };
      const updated = [
        newEntry,
        ...history.filter(
          (h) => !(h.pickup === pickupAddress && h.destination === destinationAddress)
        ),
      ].slice(0, MAX_HISTORY);
      setHistory(updated);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    } catch {}
  };

  const applyHistory = (entry: RouteHistory) => {
    setPickup({ address: entry.pickup });
    setDrop({ address: entry.destination });
    setPickupSuggestions([]);
    setDropSuggestions([]);
  };

  const clearHistory = async () => {
    try {
      await AsyncStorage.removeItem(HISTORY_KEY);
      setHistory([]);
    } catch {}
  };

  const onPickupChange = (text: string) => {
    setPickup({ address: text });
    setActiveField('pickup');
    if (pickupTimer.current) clearTimeout(pickupTimer.current);
    if (text.length < 3) { setPickupSuggestions([]); return; }
    pickupTimer.current = setTimeout(async () => {
      const results = await fetchSuggestions(text);
      setPickupSuggestions(results);
    }, 400);
  };

  const onDropChange = (text: string) => {
    setDrop({ address: text });
    setActiveField('drop');
    if (dropTimer.current) clearTimeout(dropTimer.current);
    if (text.length < 3) { setDropSuggestions([]); return; }
    dropTimer.current = setTimeout(async () => {
      const results = await fetchSuggestions(text);
      setDropSuggestions(results);
    }, 400);
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

  const getCurrentLocation = async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        Alert.alert('Permission denied', 'Location permission is required.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      const [address] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      if (address) {
        const addressString = [address.name, address.street, address.city, address.region]
          .filter(Boolean)
          .join(', ');
        setPickup({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          address: addressString,
        });
        setPickupSuggestions([]);
      }
    } catch {
      Alert.alert('Error', 'Failed to get current location.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!pickup.address.trim() || !drop.address.trim()) {
      Alert.alert('Missing locations', 'Please enter both pickup and drop locations.');
      return;
    }
    setComparing(true);
    await saveToHistory(pickup.address.trim(), drop.address.trim());
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
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
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

        {/* Route card — pickup + drop together */}
        <View style={styles.routeCard}>

          {/* Pickup row */}
          <View style={styles.inputRow}>
            <View style={styles.dotIndicatorGreen} />
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Pickup</Text>
              <TextInput
                style={styles.input}
                placeholder="Where from?"
                placeholderTextColor="#94a3b8"
                value={pickup.address}
                onChangeText={onPickupChange}
                onFocus={() => setActiveField('pickup')}
              />
            </View>
          </View>

          {/* Connector line */}
          <View style={styles.connectorLine} />

          {/* Drop row */}
          <View style={styles.inputRow}>
            <View style={styles.dotIndicatorBlue} />
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Drop</Text>
              <TextInput
                style={styles.input}
                placeholder="Where to?"
                placeholderTextColor="#94a3b8"
                value={drop.address}
                onChangeText={onDropChange}
                onFocus={() => setActiveField('drop')}
              />
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
  connectorLine: {
    width: 1,
    height: 12,
    backgroundColor: '#e2e8f0',
    marginLeft: 5,
    marginVertical: 4,
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
  input: {
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '500',
    paddingVertical: 4,
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
    marginBottom: 24,
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
});