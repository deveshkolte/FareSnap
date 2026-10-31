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
import { ConfirmPickupMapModal } from '../components/ConfirmPickupMapModal';
import { LinkAppsModal } from '../components/LinkAppsModal';
import {
  CityKey,
  detectCityFromCoords,
  normalizeCityName,
} from '../utils/cityDetector';
import {
  getLinkedProviders,
  LinkableProviderId,
  setProviderLinked,
} from '../utils/liveSessionBridge';
import {
  looksLikeMapsLinkOrCoords,
  resolveMapsLinkOrCoords,
} from '../utils/mapsLinkParser';
import {
  CITY_DIRECTORY,
  getPopularCitySuggestions,
  getQuickHubForCity,
  PlaceSuggestion,
  searchPlacesAutocomplete,
} from '../utils/placeAutocompleteEngine';

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

const HISTORY_KEY = 'faresnap_route_history';
const ACTIVE_CITY_KEY = 'faresnap_active_city_v1';
const MAX_HISTORY = 5;

const CITY_CHIP_ORDER: Exclude<CityKey, 'default'>[] = [
  'bangalore',
  'mumbai',
  'delhi',
  'hyderabad',
  'pune',
  'chennai',
  'kolkata',
  'ahmedabad',
  'jaipur',
];

const POPULAR_HUBS: {
  label: 'Airport' | 'Railway Station' | 'Metro Station' | 'Tech Park';
  icon: string;
}[] = [
  { label: 'Airport', icon: '✈️' },
  { label: 'Railway Station', icon: '🚉' },
  { label: 'Metro Station', icon: '🚇' },
  { label: 'Tech Park', icon: '🏢' },
];

export default function LocationScreen() {
  const router = useRouter();
  const [activeCity, setActiveCity] =
    useState<Exclude<CityKey, 'default'>>('bangalore');
  const [gpsCoords, setGpsCoords] = useState<
    { lat: number; lng: number } | undefined
  >(undefined);
  const [pickup, setPickup] = useState<LocationData>({ address: '' });
  const [drop, setDrop] = useState<LocationData>({ address: '' });
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [history, setHistory] = useState<RouteHistory[]>([]);
  const [pickupSuggestions, setPickupSuggestions] = useState<PlaceSuggestion[]>(
    []
  );
  const [dropSuggestions, setDropSuggestions] = useState<PlaceSuggestion[]>([]);
  const [activeField, setActiveField] = useState<'pickup' | 'drop' | null>(
    null
  );

  // BuyHatke modals: Confirm Pickup Map (f_05) & Link Apps (f_01)
  const [confirmMapVisible, setConfirmMapVisible] = useState(false);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkedProviders, setLinkedProviders] = useState<
    Record<LinkableProviderId, boolean>
  >({
    uber: false,
    rapido: false,
    ola: false,
    namma_yatri: false,
  });

  const pickupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickupAbortRef = useRef<AbortController | null>(null);
  const dropAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadInitialContext();
    getLinkedProviders().then(setLinkedProviders).catch(() => {});
    return () => {
      if (pickupTimer.current) clearTimeout(pickupTimer.current);
      if (dropTimer.current) clearTimeout(dropTimer.current);
      if (pickupAbortRef.current) pickupAbortRef.current.abort();
      if (dropAbortRef.current) dropAbortRef.current.abort();
    };
  }, []);

  const loadInitialContext = async () => {
    try {
      const [rawHistory, savedCity] = await Promise.all([
        AsyncStorage.getItem(HISTORY_KEY),
        AsyncStorage.getItem(ACTIVE_CITY_KEY),
      ]);
      if (rawHistory) {
        const parsed: RouteHistory[] = JSON.parse(rawHistory);
        setHistory(parsed);
        if (parsed[0]?.pickupLat && parsed[0]?.pickupLng) {
          const histCity = detectCityFromCoords(
            parsed[0].pickupLat,
            parsed[0].pickupLng
          );
          if (histCity !== 'default') {
            setActiveCity(histCity);
          }
        }
      }
      if (savedCity && savedCity in CITY_DIRECTORY) {
        setActiveCity(savedCity as Exclude<CityKey, 'default'>);
      }

      // Silently check last known GPS position if permission was already granted
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status === Location.PermissionStatus.GRANTED) {
        const lastPos = await Location.getLastKnownPositionAsync();
        if (lastPos) {
          const coords = {
            lat: lastPos.coords.latitude,
            lng: lastPos.coords.longitude,
          };
          setGpsCoords(coords);
          const detected = detectCityFromCoords(coords.lat, coords.lng);
          if (detected !== 'default') {
            setActiveCity(detected);
            await AsyncStorage.setItem(ACTIVE_CITY_KEY, detected);
          }
        }
      }
    } catch {}
  };

  const handleSelectCityChip = async (
    cityKey: Exclude<CityKey, 'default'>
  ) => {
    setActiveCity(cityKey);
    try {
      await AsyncStorage.setItem(ACTIVE_CITY_KEY, cityKey);
    } catch {}

    // Refresh default suggestions if an input is focused
    if (activeField === 'pickup' && pickup.address.trim().length < 2) {
      setPickupSuggestions(getPopularCitySuggestions(cityKey));
    } else if (activeField === 'drop' && drop.address.trim().length < 2) {
      const anchor =
        pickup.lat && pickup.lng
          ? { lat: pickup.lat, lng: pickup.lng }
          : CITY_DIRECTORY[cityKey].center;
      setDropSuggestions(getPopularCitySuggestions(cityKey, anchor));
    }
  };

  // Anchor coordinates for autocomplete:
  // - For Drop: always anchor to selected Pickup coordinates first, then GPS, then City center
  // - For Pickup: anchor to GPS if in same city, otherwise City center
  const getAnchorForField = (
    field: 'pickup' | 'drop',
    cityOverride?: Exclude<CityKey, 'default'>
  ): { lat: number; lng: number } => {
    const cKey = cityOverride ?? activeCity;
    if (
      field === 'drop' &&
      typeof pickup.lat === 'number' &&
      typeof pickup.lng === 'number'
    ) {
      return { lat: pickup.lat, lng: pickup.lng };
    }
    if (gpsCoords && detectCityFromCoords(gpsCoords.lat, gpsCoords.lng) === cKey) {
      return gpsCoords;
    }
    return CITY_DIRECTORY[cKey].center;
  };

  const syncCityFromLocation = (loc: {
    address: string;
    lat?: number;
    lng?: number;
  }): Exclude<CityKey, 'default'> => {
    const byCoords = detectCityFromCoords(loc.lat, loc.lng);
    if (byCoords !== 'default') {
      setActiveCity(byCoords);
      AsyncStorage.setItem(ACTIVE_CITY_KEY, byCoords).catch(() => {});
      return byCoords;
    }
    const byText = normalizeCityName(loc.address);
    if (byText !== 'default') {
      setActiveCity(byText);
      AsyncStorage.setItem(ACTIVE_CITY_KEY, byText).catch(() => {});
      return byText;
    }
    return activeCity;
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
    const pLoc = {
      address: entry.pickup,
      lat: entry.pickupLat,
      lng: entry.pickupLng,
    };
    setPickup(pLoc);
    setDrop({
      address: entry.destination,
      lat: entry.destLat,
      lng: entry.destLng,
    });
    syncCityFromLocation(pLoc);
    setPickupSuggestions([]);
    setDropSuggestions([]);
    setActiveField(null);
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
    syncCityFromLocation(drop);
    setPickupSuggestions([]);
    setDropSuggestions([]);
  };

  const onPickupFocus = () => {
    setActiveField('pickup');
    if (pickup.address.trim().length < 2) {
      setPickupSuggestions(
        getPopularCitySuggestions(activeCity, getAnchorForField('pickup'))
      );
    }
  };

  const onDropFocus = () => {
    setActiveField('drop');
    if (drop.address.trim().length < 2) {
      setDropSuggestions(
        getPopularCitySuggestions(activeCity, getAnchorForField('drop'))
      );
    }
  };

  const onPickupChange = (text: string) => {
    setPickup({ address: text });
    setActiveField('pickup');
    if (pickupTimer.current) clearTimeout(pickupTimer.current);
    if (pickupAbortRef.current) pickupAbortRef.current.abort();

    const clean = text.trim();
    if (clean.length < 2) {
      setPickupSuggestions(
        getPopularCitySuggestions(activeCity, getAnchorForField('pickup'))
      );
      return;
    }

    if (looksLikeMapsLinkOrCoords(clean)) {
      pickupTimer.current = setTimeout(async () => {
        const resolved = await resolveMapsLinkOrCoords(clean);
        if (resolved) {
          setPickup(resolved);
          syncCityFromLocation(resolved);
          setPickupSuggestions([]);
          setActiveField(null);
        }
      }, 200);
      return;
    }

    pickupTimer.current = setTimeout(async () => {
      const controller = new AbortController();
      pickupAbortRef.current = controller;
      const results = await searchPlacesAutocomplete({
        query: clean,
        activeCity,
        anchorCoords: getAnchorForField('pickup'),
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setPickupSuggestions(results);
      }
    }, 240);
  };

  const onDropChange = (text: string) => {
    setDrop({ address: text });
    setActiveField('drop');
    if (dropTimer.current) clearTimeout(dropTimer.current);
    if (dropAbortRef.current) dropAbortRef.current.abort();

    const clean = text.trim();
    if (clean.length < 2) {
      setDropSuggestions(
        getPopularCitySuggestions(activeCity, getAnchorForField('drop'))
      );
      return;
    }

    if (looksLikeMapsLinkOrCoords(clean)) {
      dropTimer.current = setTimeout(async () => {
        const resolved = await resolveMapsLinkOrCoords(clean);
        if (resolved) {
          setDrop(resolved);
          setDropSuggestions([]);
          setActiveField(null);
        }
      }, 200);
      return;
    }

    dropTimer.current = setTimeout(async () => {
      const controller = new AbortController();
      dropAbortRef.current = controller;
      const results = await searchPlacesAutocomplete({
        query: clean,
        activeCity,
        anchorCoords: getAnchorForField('drop'),
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setDropSuggestions(results);
      }
    }, 240);
  };

  const selectPickup = (s: PlaceSuggestion) => {
    const nextPickup = { address: s.full, lat: s.lat, lng: s.lng };
    setPickup(nextPickup);
    const detectedCity = syncCityFromLocation(nextPickup);
    setPickupSuggestions([]);
    // Automatically focus Drop and show popular destinations in the same city if Drop is empty
    if (!drop.address.trim()) {
      setActiveField('drop');
      setDropSuggestions(
        getPopularCitySuggestions(detectedCity, { lat: s.lat, lng: s.lng })
      );
    } else {
      setActiveField(null);
    }
  };

  const selectDrop = (s: PlaceSuggestion) => {
    setDrop({ address: s.full, lat: s.lat, lng: s.lng });
    setDropSuggestions([]);
    setActiveField(null);
  };

  const handleQuickHubPress = (
    hubLabel: 'Airport' | 'Railway Station' | 'Metro Station' | 'Tech Park'
  ) => {
    const hubPlace = getQuickHubForCity(
      activeCity,
      hubLabel,
      getAnchorForField(pickup.address.trim() ? 'drop' : 'pickup')
    );
    if (!pickup.address.trim()) {
      selectPickup(hubPlace);
    } else {
      selectDrop(hubPlace);
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
      setGpsCoords({ lat: latitude, lng: longitude });
      let addressString = '';

      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });
        if (address) {
          addressString = [
            address.name,
            address.street,
            address.city,
            address.region,
          ]
            .filter(Boolean)
            .join(', ');
        }
      } catch {}

      if (!addressString) {
        try {
          const res = await fetch(
            `https://photon.komoot.io/reverse?lon=${longitude}&lat=${latitude}&lang=en`
          );
          const data = await res.json();
          const p = data?.features?.[0]?.properties;
          if (p) {
            addressString = [p.name, p.street, p.city, p.state]
              .filter(Boolean)
              .join(', ');
          }
        } catch {}
      }

      const nextPickup: LocationData = {
        lat: latitude,
        lng: longitude,
        address:
          addressString ||
          `Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
      };
      setPickup(nextPickup);
      syncCityFromLocation(nextPickup);
      setPickupSuggestions([]);
    } catch {
      Alert.alert('Error', 'Failed to get current location.');
    } finally {
      setLoading(false);
    }
  };

  const handleComparePress = async () => {
    const cleanPickup = pickup.address.trim();
    const cleanDrop = drop.address.trim();
    if (!cleanPickup || !cleanDrop) {
      Alert.alert(
        'Missing locations',
        'Please enter both pickup and drop locations.'
      );
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
      Alert.alert(
        'Invalid route',
        'Pickup and drop locations cannot be the same.'
      );
      return;
    }

    setComparing(true);
    try {
      let resolvedPickup = { ...pickup };
      if (
        typeof resolvedPickup.lat !== 'number' ||
        typeof resolvedPickup.lng !== 'number'
      ) {
        const pSuggestions = await searchPlacesAutocomplete({
          query: cleanPickup,
          activeCity,
          anchorCoords: getAnchorForField('pickup'),
        });
        if (pSuggestions.length > 0) {
          resolvedPickup = {
            address: pSuggestions[0].full,
            lat: pSuggestions[0].lat,
            lng: pSuggestions[0].lng,
          };
          setPickup(resolvedPickup);
          syncCityFromLocation(resolvedPickup);
        }
      }

      let resolvedDrop = { ...drop };
      if (
        typeof resolvedDrop.lat !== 'number' ||
        typeof resolvedDrop.lng !== 'number'
      ) {
        const dropAnchor =
          typeof resolvedPickup.lat === 'number' &&
          typeof resolvedPickup.lng === 'number'
            ? { lat: resolvedPickup.lat, lng: resolvedPickup.lng }
            : getAnchorForField('drop');
        const dSuggestions = await searchPlacesAutocomplete({
          query: cleanDrop,
          activeCity,
          anchorCoords: dropAnchor,
        });
        if (dSuggestions.length > 0) {
          resolvedDrop = {
            address: dSuggestions[0].full,
            lat: dSuggestions[0].lat,
            lng: dSuggestions[0].lng,
          };
          setDrop(resolvedDrop);
        }
      }

      if (
        typeof resolvedPickup.lat === 'number' &&
        typeof resolvedPickup.lng === 'number'
      ) {
        setConfirmMapVisible(true);
      } else {
        await proceedToResults(resolvedPickup, resolvedDrop);
      }
    } finally {
      setComparing(false);
    }
  };

  const proceedToResults = async (
    finalPickup: LocationData,
    finalDrop: LocationData
  ) => {
    setConfirmMapVisible(false);
    await saveToHistory(finalPickup, finalDrop);
    router.push({
      pathname: '/results',
      params: {
        pickup: JSON.stringify(finalPickup),
        destination: JSON.stringify(finalDrop),
      },
    });
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

  const linkedCount = Object.values(linkedProviders).filter(Boolean).length;
  const bothFilled =
    pickup.address.trim().length > 0 && drop.address.trim().length > 0;

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <Stack.Screen
        options={{
          title: 'Ride Details',
          headerStyle: { backgroundColor: '#ffffff' },
          headerTitleStyle: { color: '#0f172a', fontWeight: '700' },
          headerTintColor: '#0f172a',
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity
              style={styles.headerPulseBtn}
              onPress={() => setLinkModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.headerPulseIcon}>🔌 {linkedCount}/4</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Active City Selector Strip (Locks Autocomplete to Your City) */}
        <View style={styles.cityStripSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cityStripScroll}
          >
            {CITY_CHIP_ORDER.map((cKey) => {
              const isSelected = cKey === activeCity;
              return (
                <TouchableOpacity
                  key={cKey}
                  style={[
                    styles.cityChip,
                    isSelected && styles.cityChipActive,
                  ]}
                  onPress={() => handleSelectCityChip(cKey)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.cityChipText,
                      isSelected && styles.cityChipTextActive,
                    ]}
                  >
                    {isSelected ? '📍 ' : ''}
                    {CITY_DIRECTORY[cKey].label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* BuyHatke-style Route Card (f_02 - f_04) */}
        <View style={styles.routeCard}>
          {/* Pickup row */}
          <View style={styles.inputRow}>
            <View style={styles.dotIndicatorGreen} />
            <View style={styles.inputWrapper}>
              <View style={styles.inputFieldRow}>
                <TextInput
                  style={[
                    styles.input,
                    activeField === 'pickup' && styles.inputFocused,
                  ]}
                  placeholder={`Pickup in ${CITY_DIRECTORY[activeCity].label}...`}
                  placeholderTextColor="#94a3b8"
                  value={pickup.address}
                  onChangeText={onPickupChange}
                  onFocus={onPickupFocus}
                />
                {pickup.address.length > 0 && (
                  <TouchableOpacity
                    style={styles.clearCircleBtn}
                    onPress={() => {
                      setPickup({ address: '' });
                      setPickupSuggestions(
                        getPopularCitySuggestions(activeCity)
                      );
                    }}
                  >
                    <Text style={styles.clearCircleText}>✕</Text>
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
            <View style={styles.dotIndicatorRed} />
            <View style={styles.inputWrapper}>
              <View style={styles.inputFieldRow}>
                <TextInput
                  style={[
                    styles.input,
                    activeField === 'drop' && styles.inputFocused,
                  ]}
                  placeholder={`Where to in ${CITY_DIRECTORY[activeCity].label}?`}
                  placeholderTextColor="#94a3b8"
                  value={drop.address}
                  onChangeText={onDropChange}
                  onFocus={onDropFocus}
                />
                {drop.address.length > 0 && (
                  <TouchableOpacity
                    style={styles.clearCircleBtn}
                    onPress={() => {
                      setDrop({ address: '' });
                      setDropSuggestions(
                        getPopularCitySuggestions(
                          activeCity,
                          getAnchorForField('drop')
                        )
                      );
                    }}
                  >
                    <Text style={styles.clearCircleText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Pickup suggestions */}
        {pickupSuggestions.length > 0 && activeField === 'pickup' && (
          <View style={styles.suggestionsCard}>
            <Text style={styles.suggestionsHeaderLabel}>
              {pickup.address.trim().length < 2
                ? `Popular Pickups in ${CITY_DIRECTORY[activeCity].label}`
                : `${CITY_DIRECTORY[activeCity].label} Suggestions`}
            </Text>
            {pickupSuggestions.map((s, i) => (
              <TouchableOpacity
                key={`${s.name}_${i}`}
                style={[
                  styles.suggestionItem,
                  i < pickupSuggestions.length - 1 && styles.suggestionBorder,
                ]}
                onPress={() => selectPickup(s)}
              >
                <View style={styles.suggestionRow}>
                  <View style={styles.suggestionIconCol}>
                    <Text style={styles.suggestionIcon}>{s.categoryIcon}</Text>
                    {typeof s.distanceKm === 'number' && (
                      <Text style={styles.suggestionDistText}>
                        {s.distanceKm} km
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionName} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text style={styles.suggestionFull} numberOfLines={1}>
                      {s.subtitle}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Drop suggestions */}
        {dropSuggestions.length > 0 && activeField === 'drop' && (
          <View style={styles.suggestionsCard}>
            <Text style={styles.suggestionsHeaderLabel}>
              {drop.address.trim().length < 2
                ? `Popular Destinations in ${CITY_DIRECTORY[activeCity].label}`
                : `Near ${
                    pickup.address
                      ? pickup.address.split(',')[0]
                      : CITY_DIRECTORY[activeCity].label
                  }`}
            </Text>
            {dropSuggestions.map((s, i) => (
              <TouchableOpacity
                key={`${s.name}_${i}`}
                style={[
                  styles.suggestionItem,
                  i < dropSuggestions.length - 1 && styles.suggestionBorder,
                ]}
                onPress={() => selectDrop(s)}
              >
                <View style={styles.suggestionRow}>
                  <View style={styles.suggestionIconCol}>
                    <Text style={styles.suggestionIcon}>{s.categoryIcon}</Text>
                    {typeof s.distanceKm === 'number' && (
                      <Text style={styles.suggestionDistText}>
                        {s.distanceKm} km
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionName} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text style={styles.suggestionFull} numberOfLines={1}>
                      {s.subtitle}
                    </Text>
                  </View>
                </View>
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
          {loading && (
            <ActivityIndicator
              size="small"
              color="#4338ca"
              style={{ marginLeft: 8 }}
            />
          )}
        </TouchableOpacity>

        {/* Quick Destination Hubs (Exact City Airport / Railway / Metro / Tech Park) */}
        <View style={styles.hubsSection}>
          <Text style={styles.historyTitle}>
            Quick fill ({CITY_DIRECTORY[activeCity].label})
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 8 }}
          >
            {POPULAR_HUBS.map((hub) => (
              <TouchableOpacity
                key={hub.label}
                style={styles.hubPill}
                onPress={() => handleQuickHubPress(hub.label)}
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
                    {entry.pickup.split(',')[0]} →{' '}
                    {entry.destination.split(',')[0]}
                  </Text>
                  <Text style={styles.chipTime}>{timeAgo(entry.timestamp)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Compare Fares button (matches BuyHatke f_02 / f_04) */}
        <TouchableOpacity
          style={[
            styles.compareButton,
            !bothFilled && styles.compareButtonInactive,
            comparing && styles.compareButtonDisabled,
          ]}
          onPress={handleComparePress}
          disabled={comparing}
          activeOpacity={0.85}
        >
          {comparing ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text
              style={[
                styles.compareText,
                !bothFilled && styles.compareTextInactive,
              ]}
            >
              Compare Fares
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* BuyHatke Confirm Pickup Interactive Map Modal (f_05) */}
      <ConfirmPickupMapModal
        visible={confirmMapVisible}
        initialLat={pickup.lat ?? CITY_DIRECTORY[activeCity].center.lat}
        initialLng={pickup.lng ?? CITY_DIRECTORY[activeCity].center.lng}
        initialAddress={pickup.address}
        onCancel={() => setConfirmMapVisible(false)}
        onConfirm={(confirmed) => {
          const updatedPickup: LocationData = {
            address: confirmed.address,
            lat: confirmed.lat,
            lng: confirmed.lng,
          };
          setPickup(updatedPickup);
          proceedToResults(updatedPickup, drop);
        }}
      />

      {/* BuyHatke Link Apps Modal (f_01) */}
      <LinkAppsModal
        visible={linkModalVisible}
        linkedMap={linkedProviders}
        onToggleLink={async (id, linked) => {
          const next = await setProviderLinked(id, linked);
          setLinkedProviders(next);
        }}
        onClose={() => setLinkModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  headerPulseBtn: {
    backgroundColor: '#eef2ff',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  headerPulseIcon: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4338ca',
  },

  // Active City Selector Strip
  cityStripSection: {
    marginBottom: 12,
  },
  cityStripScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  cityChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cityChipActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  cityChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  cityChipTextActive: {
    color: '#2563eb',
    fontWeight: '700',
  },

  // BuyHatke Route Card
  routeCard: {
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dotIndicatorGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
    flexShrink: 0,
  },
  dotIndicatorRed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    flexShrink: 0,
  },
  connectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  connectorLine: {
    width: 1.5,
    height: 24,
    backgroundColor: '#94a3b8',
    marginLeft: 4,
  },
  dividerLineHorizontal: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
    marginLeft: 18,
    marginRight: 8,
  },
  swapButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  inputWrapper: {
    flex: 1,
  },
  inputFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '500',
    paddingVertical: 8,
  },
  inputFocused: {
    color: '#0f172a',
  },
  clearCircleBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  clearCircleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },

  // Suggestions card
  suggestionsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  suggestionsHeaderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: '#f8fafc',
  },
  suggestionItem: {
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  suggestionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  suggestionIconCol: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionIcon: {
    fontSize: 18,
  },
  suggestionDistText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  suggestionFull: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },

  // Current Location
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
  },
  currentLocationIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  currentLocationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },

  // Quick Hubs
  hubsSection: {
    marginBottom: 18,
  },
  hubPill: {
    backgroundColor: '#f8fafc',
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
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxWidth: 220,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  chipTime: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },

  // Compare Button
  compareButton: {
    backgroundColor: '#4338ca',
    borderRadius: 28,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  compareButtonInactive: {
    backgroundColor: '#e2e8f0',
  },
  compareButtonDisabled: {
    opacity: 0.7,
  },
  compareText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  compareTextInactive: {
    color: '#94a3b8',
  },
});
