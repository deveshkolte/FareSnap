import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { openRideApp } from '../utils/appUrls';
import { CityKey, detectCity } from '../utils/cityDetector';
import { getRoadDistance } from '../utils/distanceEngine';
import { estimateFare } from '../utils/fareEngine';
import { reportFare } from '../utils/fareReporter';

type LocationData = {
  lat?: number;
  lng?: number;
  address: string;
};

type RideOption = {
  id: string;
  provider: string;
  price: number;
  duration: number;
  rideType: string;
  specialty: string[];
  starRating: number;
};

type AIInsight = {
  trend: 'up' | 'down' | 'stable' | 'steady';
  trendPercent: number;
  trendTimeframe: '15 mins' | '30 mins';
  confidence: 'low' | 'medium' | 'high';
  advice: string;
  smartEstimate: string;
};

const DATA: RideOption[] = [
  { id: 'rapido', provider: 'Rapido', price: 180, duration: 10, rideType: 'Bike/Auto', specialty: ['Cheapest'], starRating: 4.1 },
  { id: 'bharat', provider: 'Bharat Cab', price: 190, duration: 62, rideType: 'Cab', specialty: ['Budget', 'Govt backed'], starRating: 3.8 },
  { id: 'namma', provider: 'Namma Yatri', price: 195, duration: 14, rideType: 'Auto', specialty: ['No Surge', 'South India'], starRating: 4.5 },
  { id: 'indrive', provider: 'inDrive', price: 210, duration: 12, rideType: 'Cab', specialty: ['Negotiate'], starRating: 4.2 },
  { id: 'ola', provider: 'Ola', price: 225, duration: 13, rideType: 'Cab', specialty: ['Wide coverage'], starRating: 4.3 },
  { id: 'uber', provider: 'Uber', price: 240, duration: 12, rideType: 'Cab', specialty: ['Surge possible'], starRating: 4.4 },
  { id: 'meru', provider: 'Meru Cabs', price: 260, duration: 11, rideType: 'Cab', specialty: ['Premium'], starRating: 4.0 },
  { id: 'blusmart', provider: 'BluSmart', price: 270, duration: 18, rideType: 'Electric', specialty: ['Eco', 'No Surge'], starRating: 4.6 },
  { id: 'savaari', provider: 'Savaari', price: 300, duration: 60, rideType: 'Cab', specialty: ['Outstation'], starRating: 3.9 },
];

const PRIORITY_APPS = ['Uber', 'Ola', 'Rapido'];

const CITY_LABELS: Record<CityKey, string> = {
  bangalore: 'Bangalore',
  mumbai: 'Mumbai',
  delhi: 'Delhi',
  hyderabad: 'Hyderabad',
  chennai: 'Chennai',
  pune: 'Pune',
  kolkata: 'Kolkata',
  ahmedabad: 'Ahmedabad',
  jaipur: 'Jaipur',
  default: 'your city',
};

function AnimatedCard({ children, index, style }: { children: React.ReactNode; index: number; style?: object }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, delay: index * 80, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 320, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

export default function ResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const pickup: LocationData = JSON.parse(String(params.pickup ?? '{"address":"Unknown"}'));
  const destination: LocationData = JSON.parse(String(params.destination ?? '{"address":"Unknown"}'));

  const [city, setCity] = useState<CityKey>('default');
  const [cityLabel, setCityLabel] = useState<string>('Detecting...');
  const [aiLoading, setAiLoading] = useState(true);
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null);
  const [aiError, setAiError] = useState(false);
  const [aiCollapsed, setAiCollapsed] = useState(false);
  const [routeInfo, setRouteInfo] = useState('');
  const [distanceKm, setDistanceKm] = useState(0);
  const [durationMin, setDurationMin] = useState(0);
  const [fareInfoByProvider, setFareInfoByProvider] = useState<Record<string, ReturnType<typeof estimateFare>>>({});
  const [routeError, setRouteError] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(true);
  const [fareModalVisible, setFareModalVisible] = useState(false);
  const [selectedApp, setSelectedApp] = useState('');
  const [fareInput, setFareInput] = useState('');
  const fareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadCity = async () => {
      try {
        const detected = await detectCity();
        setCity(detected);
        setCityLabel(CITY_LABELS[detected]);
      } catch {
        setCity('default');
        setCityLabel('your city');
      }
    };
    loadCity();
  }, []);

  useEffect(() => {
    const loadDistance = async () => {
      setIsLoadingRoute(true);
      setRouteError(false);
      try {
        const result = await getRoadDistance(pickup.address, destination.address);
        if (result) {
          setDistanceKm(result.distanceKm);
          setDurationMin(result.durationMin);
          setRouteInfo(`${result.distanceKm} km • ~${result.durationMin} mins by road`);
        } else {
          // OSRM returned null — use fallback silently
          setDistanceKm(14);
          setDurationMin(40);
          setRouteInfo('~14 km • ~40 mins (estimated)');
        }
      } catch {
        // Actual network failure
        setRouteError(true);
      } finally {
        setIsLoadingRoute(false);
      }
    };
    loadDistance();
  }, []);

  useEffect(() => {
    if (distanceKm > 0) {
      const nextFareInfo = DATA.reduce<Record<string, ReturnType<typeof estimateFare>>>((acc, item) => {
        acc[item.provider] = estimateFare(item.provider, city, distanceKm, durationMin);
        return acc;
      }, {});
      setFareInfoByProvider(nextFareInfo);
    }
  }, [distanceKm, durationMin, city]);

  useEffect(() => {
    const fetchAiInsight = async () => {
      try {
        setAiLoading(true);
        setAiError(false);
        const now = new Date();
        const hour = now.getHours();
        const day = now.toLocaleDateString('en-US', { weekday: 'long' });
        const month = now.getMonth();
        const season = month >= 5 && month <= 8 ? 'monsoon' : month >= 9 || month <= 1 ? 'winter' : 'summer';
        const surgeStatus = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20) ? 'peak' : hour >= 23 || hour <= 5 ? 'off-peak' : 'normal';

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            max_tokens: 200,
            messages: [{
              role: 'user',
              content: `You are a ride-hailing fare analyst for Indian cities.
City: ${city}, Time: ${hour}:00 ${day}, Season: ${season}, Surge: ${surgeStatus}
Respond ONLY with this exact JSON, no extra text:
{"trend":"up","trendPercent":10,"trendTimeframe":"15 mins","confidence":"medium","advice":"Book now before surge increases","smartEstimate":"Rapido looks cheapest for this route"}`,
            }],
          }),
        });

        const data = await response.json();
        const text = data.choices[0].message.content;
        const clean = text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);
        setAiInsight(parsed);
      } catch {
        setAiError(true);
      } finally {
        setAiLoading(false);
      }
    };
    fetchAiInsight();
  }, [city]);

  useEffect(() => {
    return () => {
      if (fareTimerRef.current) clearTimeout(fareTimerRef.current);
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  }, []);

  const getFareForItem = (item: RideOption) => {
    const info = fareInfoByProvider[item.provider];
    return info?.available ? (info.low ?? Infinity) : Infinity;
  };

  const getSortedRides = () => {
    const sorted = [...DATA].sort((a, b) => getFareForItem(a) - getFareForItem(b));
    const available = sorted.filter((item) => fareInfoByProvider[item.provider]?.available !== false);
    const unavailable = sorted.filter((item) => fareInfoByProvider[item.provider]?.available === false);
    return [...available, ...unavailable];
  };

  const allSorted = getSortedRides();
  const topPicks = allSorted.filter((r) => PRIORITY_APPS.includes(r.provider));
  const moreOptions = allSorted.filter((r) => !PRIORITY_APPS.includes(r.provider));

  const availableRides = DATA.filter((item) => fareInfoByProvider[item.provider]?.available);
  const sortedByPrice = [...availableRides].sort((a, b) => getFareForItem(a) - getFareForItem(b));
  const bestDealId = sortedByPrice[0]?.id;
  const costliestFare = sortedByPrice.length > 0
    ? fareInfoByProvider[sortedByPrice[sortedByPrice.length - 1].provider]?.high ?? 0
    : 0;

  const getSavings = (item: RideOption) => {
    const info = fareInfoByProvider[item.provider];
    if (!info?.available || !info.low) return 0;
    return Math.max(0, costliestFare - info.low);
  };

  const isLoaded = Object.keys(fareInfoByProvider).length > 0;

  const handleBook = async (appName: string) => {
    try {
      await openRideApp(appName, {
        pickupCoords: pickup.lat && pickup.lng ? { lat: pickup.lat, lng: pickup.lng } : undefined,
        dropCoords: destination.lat && destination.lng ? { lat: destination.lat, lng: destination.lng } : undefined,
        pickupAddress: pickup.address,
        dropAddress: destination.address,
      });
    } catch {
      // openRideApp already handles fallback; nothing more to do
    }

    if (fareTimerRef.current) clearTimeout(fareTimerRef.current);
    fareTimerRef.current = setTimeout(() => {
      setSelectedApp(appName);
      setFareInput('');
      setFareModalVisible(true);

      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
      autoDismissRef.current = setTimeout(() => {
        setFareModalVisible(false);
      }, 30000);
    }, 1500);
  };

  const handleFareSubmit = async () => {
    const parsed = parseFloat(fareInput);
    if (isNaN(parsed) || parsed <= 0) return;

    try {
      await reportFare({
        app: selectedApp,
        city,
        pickup_area: pickup.address.split(',')[0].trim(),
        distance_km: distanceKm,
        quoted_fare: parsed,
        app_version: '1.0.0',
      });
    } catch {
      // silently ignore
    } finally {
      setFareModalVisible(false);
    }
  };

  const handleFareSkip = () => {
    setFareModalVisible(false);
  };

  const getSpecialtyBadgeStyle = (badge: string) => {
    if (badge === 'No Surge') return { bg: '#dcfce7', text: '#15803d' };
    if (badge === 'Eco') return { bg: '#dcfce7', text: '#15803d' };
    if (badge === 'Negotiate') return { bg: '#dbeafe', text: '#1d4ed8' };
    if (badge === 'Cheapest') return { bg: '#fef9c3', text: '#854d0e' };
    return { bg: '#f1f5f9', text: '#475569' };
  };

  const getTrendInfo = (trend: string) => {
    if (trend === 'up') return { icon: '📈', color: '#fef2f2', textColor: '#dc2626', label: 'rising' };
    if (trend === 'down') return { icon: '📉', color: '#f0fdf4', textColor: '#16a34a', label: 'dropping' };
    return { icon: '➡️', color: '#eff6ff', textColor: '#2563eb', label: 'stable' };
  };

  const renderRideCard = (item: RideOption, index: number, isTopPick: boolean) => {
    const fareInfo = fareInfoByProvider[item.provider];
    const isAvailable = fareInfo?.available;
    const isBest = item.id === bestDealId;
    const savings = getSavings(item);

    return (
      <AnimatedCard key={item.id} index={index}>
        <View style={[
          styles.card,
          isBest && isAvailable && styles.bestCard,
          !isAvailable && styles.cardUnavailable,
        ]}>
          <View style={styles.cardTopRow}>
            <View style={styles.cardLeft}>
              <View style={styles.providerRow}>
                <Text style={[styles.providerName, !isAvailable && styles.providerNameMuted]}>
                  {item.provider}
                </Text>
                {isBest && isAvailable && (
                  <View style={styles.bestBadge}>
                    <Text style={styles.bestBadgeText}>BEST</Text>
                  </View>
                )}
              </View>
              <Text style={styles.metaText}>
                {item.rideType} · {item.duration} min · {item.starRating}★
              </Text>
            </View>
            {isAvailable ? (
              <TouchableOpacity
                style={isBest ? styles.bookButtonSolid : styles.bookButtonGhost}
                onPress={() => handleBook(item.provider)}
                activeOpacity={0.8}
              >
                <Text style={isBest ? styles.bookTextSolid : styles.bookTextGhost}>Book</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.unavailableButton}>
                <Text style={styles.unavailableText}>N/A</Text>
              </View>
            )}
          </View>

          {isAvailable ? (
            <View style={styles.fareRow}>
              <Text style={[styles.fareText, isBest && styles.fareTextBest]}>
                ₹{fareInfo.low} – ₹{fareInfo.high}
              </Text>
              {isBest && savings > 0 && (
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsText}>Save ₹{savings} vs costliest</Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.notAvailableText}>Not available in {cityLabel}</Text>
          )}

          {isAvailable && item.specialty.length > 0 && (
            <View style={styles.badgeRow}>
              {item.specialty.map((badge, i) => {
                const bs = getSpecialtyBadgeStyle(badge);
                return (
                  <View key={i} style={[styles.specialtyBadge, { backgroundColor: bs.bg }]}>
                    <Text style={[styles.specialtyBadgeText, { color: bs.text }]}>{badge}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </AnimatedCard>
    );
  };

  // Full screen error — no internet / geocoding completely failed
  if (routeError) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Compare rides',
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#0f172a', fontWeight: '700' },
            headerTintColor: '#2563eb',
          }}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>📡</Text>
          <Text style={styles.errorTitle}>Can't reach the network</Text>
          <Text style={styles.errorSubtitle}>
            Check your internet connection and try again.
          </Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Text style={styles.errorButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  // Loading state — waiting for route
  if (isLoadingRoute) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Compare rides',
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#0f172a', fontWeight: '700' },
            headerTintColor: '#2563eb',
          }}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorEmoji}>🗺️</Text>
          <Text style={styles.errorTitle}>Finding your route...</Text>
          <Text style={styles.errorSubtitle}>Calculating road distance</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Compare rides',
          headerStyle: { backgroundColor: '#ffffff' },
          headerTitleStyle: { color: '#0f172a', fontWeight: '700' },
          headerTintColor: '#2563eb',
        }}
      />
      <View style={styles.container}>

        <View style={styles.routeBar}>
          <View style={styles.routeBarInner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeText} numberOfLines={1}>
                {pickup.address} → {destination.address}
              </Text>
              {routeInfo ? (
                <Text style={styles.routeInfoText}>🛣️ {routeInfo}</Text>
              ) : null}
            </View>
            <View style={styles.cityPill}>
              <Text style={styles.cityPillText}>📍 {cityLabel}</Text>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {isLoaded && topPicks.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>👑 Top picks</Text>
              {topPicks.map((item, i) => renderRideCard(item, i, true))}
            </View>
          )}

          {isLoaded && (
            <AnimatedCard index={topPicks.length}>
              <TouchableOpacity
                style={styles.aiCard}
                onPress={() => setAiCollapsed(!aiCollapsed)}
                activeOpacity={0.9}
              >
                <View style={styles.aiCardHeader}>
                  <View style={styles.aiCardLeft}>
                    <Text style={styles.aiCardTitle}>🤖 AI price insight</Text>
                    {!aiLoading && aiInsight && (
                      <Text style={styles.aiConfidence}>{aiInsight.confidence} confidence</Text>
                    )}
                  </View>
                  <Text style={styles.aiChevron}>{aiCollapsed ? '›' : '‹'}</Text>
                </View>
                {!aiCollapsed && (
                  <View style={styles.aiCardBody}>
                    {aiLoading ? (
                      <Text style={styles.aiLoadingText}>Analyzing fares...</Text>
                    ) : aiError ? (
                      <Text style={styles.aiErrorText}>Insight unavailable right now</Text>
                    ) : aiInsight ? (
                      <>
                        {(() => {
                          const t = getTrendInfo(aiInsight.trend);
                          return (
                            <View style={[styles.trendBox, { backgroundColor: t.color }]}>
                              <Text style={[styles.trendBoxText, { color: t.textColor }]}>
                                {t.icon} Fares {t.label}{aiInsight.trend !== 'stable' && aiInsight.trend !== 'steady' ? ` ~${aiInsight.trendPercent}% in ${aiInsight.trendTimeframe}` : ' right now'}
                              </Text>
                            </View>
                          );
                        })()}
                        <Text style={styles.aiAdvice}>{aiInsight.advice}</Text>
                        <Text style={styles.aiEstimate}>{aiInsight.smartEstimate}</Text>
                      </>
                    ) : null}
                  </View>
                )}
              </TouchableOpacity>
            </AnimatedCard>
          )}

          {isLoaded && moreOptions.length > 0 && (
            <View style={styles.section}>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>More options</Text>
                <View style={styles.dividerLine} />
              </View>
              {moreOptions.map((item, i) => renderRideCard(item, topPicks.length + 1 + i, false))}
            </View>
          )}

          {isLoaded && (
            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimerText}>
                ⚠️ Prices are estimates only. Actual fares depend on traffic, surge, and in-app promotions. Always confirm before booking.
              </Text>
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>

      <Modal
        visible={fareModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleFareSkip}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'android' ? 'height' : 'padding'}
        >
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>What fare did you see in {selectedApp}?</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              maxLength={5}
              placeholder="Enter fare in ₹"
              placeholderTextColor="#94a3b8"
              value={fareInput}
              onChangeText={setFareInput}
            />
            <Text style={styles.modalConsent}>
              Fare data is collected anonymously to improve estimates. No personal info is stored.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalButtonGhost} onPress={handleFareSkip} activeOpacity={0.8}>
                <Text style={styles.modalButtonGhostText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonSolid} onPress={handleFareSubmit} activeOpacity={0.8}>
                <Text style={styles.modalButtonSolidText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  routeBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  routeBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  routeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  routeInfoText: {
    fontSize: 12,
    color: '#64748b',
  },
  cityPill: {
    backgroundColor: '#eff6ff',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
    flexShrink: 0,
  },
  cityPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bestCard: {
    borderColor: '#2563eb',
    borderWidth: 2,
    backgroundColor: '#ffffff',
  },
  cardUnavailable: {
    opacity: 0.5,
    backgroundColor: '#f8fafc',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardLeft: {
    flex: 1,
    marginRight: 12,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  providerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  providerNameMuted: {
    color: '#94a3b8',
  },
  bestBadge: {
    backgroundColor: '#2563eb',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  bestBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  metaText: {
    fontSize: 13,
    color: '#64748b',
  },
  fareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  fareText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  fareTextBest: {
    color: '#1d4ed8',
  },
  savingsBadge: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16a34a',
  },
  notAvailableText: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  specialtyBadge: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  specialtyBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bookButtonSolid: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  bookTextSolid: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  bookButtonGhost: {
    borderWidth: 1.5,
    borderColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  bookTextGhost: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563eb',
  },
  unavailableButton: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  unavailableText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  aiCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 10,
    overflow: 'hidden',
  },
  aiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  aiCardLeft: {
    flex: 1,
  },
  aiCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e40af',
  },
  aiConfidence: {
    fontSize: 11,
    color: '#3b82f6',
    marginTop: 1,
  },
  aiChevron: {
    fontSize: 20,
    color: '#3b82f6',
    fontWeight: '300',
  },
  aiCardBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  aiLoadingText: {
    fontSize: 13,
    color: '#3b82f6',
    fontStyle: 'italic',
  },
  aiErrorText: {
    fontSize: 13,
    color: '#64748b',
  },
  trendBox: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  trendBoxText: {
    fontSize: 13,
    fontWeight: '600',
  },
  aiAdvice: {
    fontSize: 13,
    color: '#1e40af',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  aiEstimate: {
    fontSize: 12,
    color: '#3b82f6',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  disclaimerBox: {
    backgroundColor: '#fefce8',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  disclaimerText: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 18,
    textAlign: 'center',
  },

  // Fare modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 12,
  },
  modalConsent: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtonGhost: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonGhostText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748b',
  },
  modalButtonSolid: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalButtonSolidText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Error / loading states
  errorContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  errorEmoji: {
    fontSize: 56,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorSubtitle: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  errorButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  errorButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});