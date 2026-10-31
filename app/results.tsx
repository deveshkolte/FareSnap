import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
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
import { getRoadDistance, RouteCoords } from '../utils/distanceEngine';
import { FareBreakdown, getHourlyFareForecast } from '../utils/fareEngine';
import { fetchRecentCrowdsourcedFares, reportFare } from '../utils/fareReporter';
import {
  FareQuote,
  QuoteEngine,
  RideQuoteRequest,
  VehicleTierOption,
} from '../utils/quoteEngine';
import {
  computeSmartPickup,
  SmartPickupSuggestion,
} from '../utils/smartPickupEngine';

type LocationData = {
  lat?: number;
  lng?: number;
  address: string;
};

type RideCategoryFilter = 'All' | 'Cab' | 'Auto' | 'Bike' | 'Sedan/XL';

type ProviderMeta = {
  duration: number;
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

const PROVIDER_META: Record<string, ProviderMeta> = {
  Rapido: { duration: 4, specialty: ['Bike & Auto', 'Fastest ETA'], starRating: 4.2 },
  'Bharat Cab': { duration: 11, specialty: ['No Surge', 'Govt backed'], starRating: 4.0 },
  'Namma Yatri': { duration: 6, specialty: ['No Surge', '0% Commission'], starRating: 4.5 },
  inDrive: { duration: 8, specialty: ['Negotiate'], starRating: 4.2 },
  Ola: { duration: 7, specialty: ['Wide coverage'], starRating: 4.3 },
  Uber: { duration: 6, specialty: ['Top rated'], starRating: 4.4 },
  'Meru Cabs': { duration: 12, specialty: ['Airport & AC Sedan'], starRating: 4.1 },
  BluSmart: { duration: 15, specialty: ['Eco', 'No Surge'], starRating: 4.6 },
  Savaari: { duration: 18, specialty: ['Chauffeur & Outstation'], starRating: 4.2 },
};

const PRIORITY_APPS = ['Uber', 'Ola', 'Rapido', 'Namma Yatri'];
const CATEGORY_FILTERS: RideCategoryFilter[] = ['All', 'Cab', 'Auto', 'Bike', 'Sedan/XL'];

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

const quoteEngine = new QuoteEngine();

const buildLocalFallbackInsight = (
  surgeStatus: 'peak' | 'normal' | 'off-peak',
  validQuotes: FareQuote[]
): AIInsight => {
  const cheapest = validQuotes[0];
  const cheapestLabel = cheapest
    ? `${cheapest.providerName} (${cheapest.rideType}) at ₹${cheapest.price} is the lowest estimate for this route.`
    : 'Compare available options below before booking.';

  if (surgeStatus === 'peak') {
    return {
      trend: 'up',
      trendPercent: 15,
      trendTimeframe: '15 mins',
      confidence: 'high',
      advice:
        'Peak-hour demand is active. Zero-surge apps like Namma Yatri or Bharat Cab can help avoid surge spikes.',
      smartEstimate: cheapestLabel,
    };
  }
  if (surgeStatus === 'off-peak') {
    return {
      trend: 'down',
      trendPercent: 10,
      trendTimeframe: '30 mins',
      confidence: 'medium',
      advice:
        'Off-peak fares are lower right now, though driver availability may take slightly longer.',
      smartEstimate: cheapestLabel,
    };
  }
  return {
    trend: 'stable',
    trendPercent: 0,
    trendTimeframe: '15 mins',
    confidence: 'high',
    advice: 'Fares are stable with normal traffic demand right now—good time to book.',
    smartEstimate: cheapestLabel,
  };
};

function AnimatedCard({
  children,
  index,
  style,
}: {
  children: React.ReactNode;
  index: number;
  style?: object;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        delay: index * 65,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        delay: index * 65,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, index]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

export default function ResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const pickup: LocationData = useMemo(() => {
    try {
      return JSON.parse(String(params.pickup ?? '{"address":"Unknown"}'));
    } catch {
      return { address: 'Unknown' };
    }
  }, [params.pickup]);

  const destination: LocationData = useMemo(() => {
    try {
      return JSON.parse(String(params.destination ?? '{"address":"Unknown"}'));
    } catch {
      return { address: 'Unknown' };
    }
  }, [params.destination]);

  const [city, setCity] = useState<CityKey>('default');
  const [cityLabel, setCityLabel] = useState<string>('Detecting...');
  const [selectedCategory, setSelectedCategory] = useState<RideCategoryFilter>('All');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const [aiLoading, setAiLoading] = useState(true);
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null);
  const [aiError, setAiError] = useState(false);
  const [aiCollapsed, setAiCollapsed] = useState(false);

  const [routeInfo, setRouteInfo] = useState('');
  const [baseDistanceKm, setBaseDistanceKm] = useState(0);
  const [baseDurationMin, setBaseDurationMin] = useState(0);
  const [resolvedPickupCoords, setResolvedPickupCoords] = useState<RouteCoords | undefined>(
    pickup.lat && pickup.lng ? { lat: pickup.lat, lng: pickup.lng } : undefined
  );
  const [resolvedDropCoords, setResolvedDropCoords] = useState<RouteCoords | undefined>(
    destination.lat && destination.lng
      ? { lat: destination.lat, lng: destination.lng }
      : undefined
  );

  // BuyHatke Smart Pickup ("Walk & Save") state
  const [smartPickup, setSmartPickup] = useState<SmartPickupSuggestion | null>(null);
  const [smartPickupEnabled, setSmartPickupEnabled] = useState(false);

  // Crowdsourced rider calibration map
  const [crowdsourcedFares, setCrowdsourcedFares] = useState<Record<string, number>>({});

  const [quotes, setQuotes] = useState<FareQuote[]>([]);
  const [isFetchingQuotes, setIsFetchingQuotes] = useState(false);

  const [routeError, setRouteError] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(true);
  const [fareModalVisible, setFareModalVisible] = useState(false);
  const [selectedApp, setSelectedApp] = useState('');
  const [fareInput, setFareInput] = useState('');

  const pendingBookAppRef = useRef<string | null>(null);
  const fareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAiKeyRef = useRef<string>('');

  const activeDistanceKm =
    smartPickupEnabled && smartPickup ? smartPickup.newDistanceKm : baseDistanceKm;
  const activeDurationMin =
    smartPickupEnabled && smartPickup ? smartPickup.newDurationMin : baseDurationMin;
  const activePickupCoords =
    smartPickupEnabled && smartPickup ? smartPickup.pickupCoords : resolvedPickupCoords;

  useEffect(() => {
    const loadCityAndRoute = async () => {
      setIsLoadingRoute(true);
      setRouteError(false);
      try {
        let detected = await detectCity({
          address: pickup.address,
          lat: pickup.lat,
          lng: pickup.lng,
        });

        const result = await getRoadDistance(
          pickup,
          destination,
          detected !== 'default' ? CITY_LABELS[detected] : undefined
        );
        if (result) {
          if (detected === 'default') {
            const refinedCity = await detectCity({
              address: pickup.address,
              lat: result.originCoords.lat,
              lng: result.originCoords.lng,
            });
            if (refinedCity !== 'default') {
              detected = refinedCity;
            }
          }

          setCity(detected);
          setCityLabel(CITY_LABELS[detected]);
          setBaseDistanceKm(result.distanceKm);
          setBaseDurationMin(result.durationMin);
          setResolvedPickupCoords(result.originCoords);
          setResolvedDropCoords(result.destCoords);
          setRouteInfo(
            result.isEstimatedRoute
              ? `~${result.distanceKm} km • ~${result.durationMin} mins (estimated)`
              : `${result.distanceKm} km • ~${result.durationMin} mins by road`
          );

          // Compute Smart Pickup suggestion & fetch crowdsourced fares in parallel
          const approxCabFare = Math.max(85, Math.round(45 + result.distanceKm * 12));
          computeSmartPickup({
            originCoords: result.originCoords,
            destCoords: result.destCoords,
            originAddress: pickup.address,
            distanceKm: result.distanceKm,
            durationMin: result.durationMin,
            referenceCabFare: approxCabFare,
          })
            .then((sp) => setSmartPickup(sp))
            .catch(() => {});

          fetchRecentCrowdsourcedFares(detected, result.distanceKm)
            .then((cf) => setCrowdsourcedFares(cf))
            .catch(() => {});
        } else {
          setRouteError(true);
        }
      } catch {
        setRouteError(true);
      } finally {
        setIsLoadingRoute(false);
      }
    };
    loadCityAndRoute();
  }, [pickup, destination]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const fetchQuotes = async () => {
      if (activeDistanceKm > 0) {
        setIsFetchingQuotes(true);
        const req: RideQuoteRequest = {
          pickup: {
            address:
              smartPickupEnabled && smartPickup
                ? smartPickup.pickupLabel
                : pickup.address,
            lat: activePickupCoords?.lat ?? pickup.lat,
            lng: activePickupCoords?.lng ?? pickup.lng,
          },
          destination: {
            address: destination.address,
            lat: resolvedDropCoords?.lat ?? destination.lat,
            lng: resolvedDropCoords?.lng ?? destination.lng,
          },
          city,
          distanceKm: activeDistanceKm,
          durationMin: activeDurationMin,
        };

        unsubscribe = quoteEngine.subscribe((newQuotes, isComplete) => {
          setQuotes([...newQuotes]);
          setIsFetchingQuotes(!isComplete);
        });

        await quoteEngine.startQuoteRequest(req);
      }
    };

    fetchQuotes();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [
    activeDistanceKm,
    activeDurationMin,
    city,
    pickup,
    destination,
    activePickupCoords,
    resolvedDropCoords,
    smartPickupEnabled,
    smartPickup,
  ]);

  useEffect(() => {
    if (baseDistanceKm <= 0 || quotes.length === 0) return;

    const aiRouteKey = `${city}:${baseDistanceKm}:${baseDurationMin}:${pickup.address}:${destination.address}`;
    if (lastAiKeyRef.current === aiRouteKey) return;
    lastAiKeyRef.current = aiRouteKey;

    const fetchAiInsight = async () => {
      const now = new Date();
      const hour = now.getHours();
      const day = now.toLocaleDateString('en-US', { weekday: 'long' });
      const month = now.getMonth();
      const season =
        month >= 5 && month <= 8
          ? 'monsoon'
          : month >= 9 || month <= 1
            ? 'winter'
            : 'summer';
      const surgeStatus: 'peak' | 'normal' | 'off-peak' =
        (hour >= 7 && hour < 10) || (hour >= 17 && hour < 21)
          ? 'peak'
          : hour >= 23 || hour < 5
            ? 'off-peak'
            : 'normal';

      const availableForAi = quotes
        .filter((q) => q.isAvailable && q.price !== null)
        .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));

      const topQuoteSummary = availableForAi
        .slice(0, 4)
        .map((q) => `${q.providerName} (${q.rideType}): ₹${q.price}`)
        .join(', ');

      const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
      const proxyUrl = process.env.EXPO_PUBLIC_AI_PROXY_URL;

      if (!proxyUrl && (!apiKey || apiKey === 'your_groq_api_key_here')) {
        setAiInsight(buildLocalFallbackInsight(surgeStatus, availableForAi));
        setAiLoading(false);
        return;
      }

      try {
        setAiLoading(true);
        setAiError(false);

        const endpoint = proxyUrl || 'https://api.groq.com/openai/v1/chat/completions';
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (!proxyUrl && apiKey) {
          headers.Authorization = `Bearer ${apiKey}`;
        }

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            max_tokens: 220,
            temperature: 0.3,
            messages: [
              {
                role: 'user',
                content: `You are an Indian ride-hailing fare analyst. Analyze this specific route and fare table:
City: ${CITY_LABELS[city]}
Route: ${pickup.address} to ${destination.address} (${baseDistanceKm} km, ~${baseDurationMin} mins)
Time: ${hour}:00 ${day}, Season: ${season}, Traffic window: ${surgeStatus}
Current lowest quotes: ${topQuoteSummary || 'N/A'}

Return ONLY valid JSON matching this schema (no markdown, no extra text):
{"trend":"up"|"down"|"stable","trendPercent":number,"trendTimeframe":"15 mins"|"30 mins","confidence":"low"|"medium"|"high","advice":"1 concise sentence of booking advice for this route","smartEstimate":"1 concise sentence naming the best value option from the quotes above"}`,
              },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content;
        if (!text) throw new Error('Empty response');
        const clean = text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);
        setAiInsight(parsed);
      } catch {
        setAiInsight(buildLocalFallbackInsight(surgeStatus, availableForAi));
      } finally {
        setAiLoading(false);
      }
    };
    fetchAiInsight();
  }, [city, baseDistanceKm, baseDurationMin, pickup.address, destination.address, quotes]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && pendingBookAppRef.current) {
        const appToReport = pendingBookAppRef.current;
        pendingBookAppRef.current = null;
        if (fareTimerRef.current) {
          clearTimeout(fareTimerRef.current);
          fareTimerRef.current = null;
        }
        setSelectedApp(appToReport);
        setFareInput('');
        setFareModalVisible(true);
      }
    });

    return () => {
      subscription.remove();
      if (fareTimerRef.current) clearTimeout(fareTimerRef.current);
    };
  }, []);

  // Compute lowest price per category for the BuyHatke-style category tab bar
  const categoryMinPrices = useMemo(() => {
    const mins: Partial<Record<RideCategoryFilter, number>> = {};
    let overallMin = Infinity;
    let cabMin = Infinity;
    let autoMin = Infinity;
    let bikeMin = Infinity;
    let sedanMin = Infinity;

    for (const q of quotes) {
      if (q.isAvailable && typeof q.price === 'number' && q.price < overallMin) {
        overallMin = q.price;
      }
      const tiers = (q.metadata?.tiers as VehicleTierOption[] | undefined) || [];
      for (const t of tiers) {
        if (t.low < overallMin) overallMin = t.low;
        if (t.category === 'Cab' && t.low < cabMin) cabMin = t.low;
        if (t.category === 'Auto' && t.low < autoMin) autoMin = t.low;
        if (t.category === 'Bike' && t.low < bikeMin) bikeMin = t.low;
        if ((t.category === 'Sedan' || t.category === 'SUV') && t.low < sedanMin) {
          sedanMin = t.low;
        }
      }
    }

    if (Number.isFinite(overallMin)) mins.All = overallMin;
    if (Number.isFinite(cabMin)) mins.Cab = cabMin;
    if (Number.isFinite(autoMin)) mins.Auto = autoMin;
    if (Number.isFinite(bikeMin)) mins.Bike = bikeMin;
    if (Number.isFinite(sedanMin)) mins['Sedan/XL'] = sedanMin;
    return mins;
  }, [quotes]);

  // Transform quotes based on selected vehicle category filter ('All' | 'Cab' | 'Auto' | 'Bike' | 'Sedan/XL')
  const categoryAdjustedQuotes = useMemo(() => {
    const applySmartDiscountAndCrowd = (q: FareQuote): FareQuote => {
      if (!q.isAvailable || q.price === null) return q;
      let price = q.price;
      let highEstimate = q.metadata?.highEstimate as number | undefined;
      let riderVerified = false;

      // Blend crowdsourced rider report if available for default ride type
      const crowdFare = crowdsourcedFares[q.providerName];
      if (crowdFare && selectedCategory === 'All') {
        price = Math.round(price * 0.6 + crowdFare * 0.4);
        if (highEstimate) {
          highEstimate = Math.max(price + 10, Math.round(price * 1.22));
        }
        riderVerified = true;
      }

      // Apply Smart Pickup micro-surge reduction (8% additional drop from escaping pickup congestion)
      if (smartPickupEnabled) {
        price = Math.max(25, Math.round(price * 0.92));
        if (highEstimate) {
          highEstimate = Math.max(price + 8, Math.round(highEstimate * 0.92));
        }
      }

      return {
        ...q,
        price,
        metadata: {
          ...q.metadata,
          highEstimate,
          riderVerified,
        },
      };
    };

    if (selectedCategory === 'All') {
      return quotes
        .map(applySmartDiscountAndCrowd)
        .sort((a, b) => {
          if (!a.isAvailable || a.price === null) return 1;
          if (!b.isAvailable || b.price === null) return -1;
          return a.price - b.price;
        });
    }

    const mapped: FareQuote[] = [];
    for (const q of quotes) {
      const tiers = (q.metadata?.tiers as VehicleTierOption[] | undefined) || [];
      const matchingTier = tiers.find((t) => {
        if (selectedCategory === 'Sedan/XL') {
          return t.category === 'Sedan' || t.category === 'SUV';
        }
        return t.category === selectedCategory;
      });

      if (matchingTier) {
        mapped.push(
          applySmartDiscountAndCrowd({
            ...q,
            rideType: matchingTier.label,
            price: matchingTier.low,
            isAvailable: true,
            metadata: {
              ...q.metadata,
              highEstimate: matchingTier.high,
              isSurge: matchingTier.isSurge,
              breakdown: matchingTier.breakdown,
              vehicleCategory: matchingTier.category,
            },
          })
        );
      } else if (!q.isAvailable) {
        // Keep unavailable providers at the bottom when relevant
        if (
          (selectedCategory === 'Auto' && q.providerName === 'Namma Yatri') ||
          (selectedCategory === 'Cab' && q.providerName === 'BluSmart') ||
          (selectedCategory === 'Sedan/XL' && q.providerName === 'Meru Cabs')
        ) {
          mapped.push(q);
        }
      }
    }

    return mapped.sort((a, b) => {
      if (!a.isAvailable || a.price === null) return 1;
      if (!b.isAvailable || b.price === null) return -1;
      return a.price - b.price;
    });
  }, [quotes, selectedCategory, crowdsourcedFares, smartPickupEnabled]);

  const validQuotes = categoryAdjustedQuotes
    .filter((q) => q.isAvailable && q.price !== null)
    .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));

  const bestDealId = validQuotes[0]?.providerId;

  const getComparableCostliestPrice = (quote: FareQuote): number => {
    const sameTypeQuotes = validQuotes.filter((q) =>
      selectedCategory === 'All'
        ? q.rideType === quote.rideType ||
          (quote.rideType === 'Cab' && q.rideType === 'Sedan') ||
          (quote.rideType === 'Sedan' && q.rideType === 'Cab')
        : true
    );
    if (sameTypeQuotes.length < 2) return quote.price ?? 0;
    return sameTypeQuotes[sameTypeQuotes.length - 1].price ?? 0;
  };

  const topPicks = categoryAdjustedQuotes.filter((q) =>
    PRIORITY_APPS.includes(q.providerName)
  );
  const moreOptions = categoryAdjustedQuotes.filter(
    (q) => !PRIORITY_APPS.includes(q.providerName)
  );

  const hourlyForecast = useMemo(() => {
    if (activeDistanceKm <= 0) return [];
    const targetApp = validQuotes[0]?.providerName || 'Uber';
    return getHourlyFareForecast(targetApp, city, activeDistanceKm, activeDurationMin);
  }, [validQuotes, city, activeDistanceKm, activeDurationMin]);

  const isLoaded = quotes.length > 0;

  const handleBook = async (appName: string, bookingUrl?: string) => {
    pendingBookAppRef.current = appName;

    try {
      await openRideApp(appName, {
        pickupCoords: activePickupCoords,
        dropCoords: resolvedDropCoords,
        pickupAddress:
          smartPickupEnabled && smartPickup ? smartPickup.pickupLabel : pickup.address,
        dropAddress: destination.address,
      });
    } catch {
      // openRideApp already handles fallback
    }

    if (fareTimerRef.current) clearTimeout(fareTimerRef.current);
    fareTimerRef.current = setTimeout(() => {
      if (
        pendingBookAppRef.current === appName &&
        AppState.currentState === 'active'
      ) {
        pendingBookAppRef.current = null;
        setSelectedApp(appName);
        setFareInput('');
        setFareModalVisible(true);
      }
    }, 1500);
  };

  const handleFareSubmit = async () => {
    const parsed = parseFloat(fareInput.trim());
    if (isNaN(parsed) || parsed <= 0) {
      setFareModalVisible(false);
      return;
    }

    try {
      await reportFare({
        app: selectedApp,
        city,
        pickup_area: pickup.address.split(',')[0].trim(),
        distance_km: activeDistanceKm,
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
    if (badge === 'No Surge' || badge === '0% Commission') {
      return { bg: '#dcfce7', text: '#15803d' };
    }
    if (badge === 'Eco') return { bg: '#dcfce7', text: '#15803d' };
    if (badge === 'Negotiate') return { bg: '#dbeafe', text: '#1d4ed8' };
    if (badge === 'Cheapest' || badge === 'Bike & Auto' || badge === 'Fastest ETA') {
      return { bg: '#fef9c3', text: '#854d0e' };
    }
    return { bg: '#f1f5f9', text: '#475569' };
  };

  const getTrendInfo = (trend: string) => {
    if (trend === 'up') {
      return { icon: '📈', color: '#fef2f2', textColor: '#dc2626', label: 'rising' };
    }
    if (trend === 'down') {
      return { icon: '📉', color: '#f0fdf4', textColor: '#16a34a', label: 'dropping' };
    }
    return { icon: '➡️', color: '#eff6ff', textColor: '#2563eb', label: 'stable' };
  };

  const renderQuoteCard = (quote: FareQuote, index: number) => {
    const isAvailable = quote.isAvailable && quote.price !== null;
    const isBest = quote.providerId === bestDealId;
    const cardKey = `${quote.providerId}_${quote.rideType}`;
    const isExpanded = expandedCardId === cardKey;

    const meta = PROVIDER_META[quote.providerName] || {
      duration: 10,
      specialty: [],
      starRating: 4.1,
    };
    const baseEta = quote.etaMinutes ?? meta.duration;
    const duration =
      smartPickupEnabled && smartPickup
        ? Math.max(2, baseEta - smartPickup.waitSavedMinutes)
        : baseEta;
    const specialty = meta.specialty;
    const starRating = meta.starRating;

    let savings = 0;
    if (isAvailable && quote.price) {
      const comparableCostliest = getComparableCostliestPrice(quote);
      savings = Math.max(0, comparableCostliest - quote.price);
    }

    const highEstimate = quote.metadata?.highEstimate as number | undefined;
    const breakdown = quote.metadata?.breakdown as FareBreakdown | undefined;
    const allTiers = (quote.metadata?.tiers as VehicleTierOption[] | undefined) || [];
    const isSurge = Boolean(quote.metadata?.isSurge);
    const riderVerified = Boolean(quote.metadata?.riderVerified);
    const unavailableReason = quote.metadata?.unavailableReason as string | undefined;
    const unavailableLabel =
      unavailableReason && unavailableReason !== 'Not available in your city'
        ? unavailableReason
        : `Not available in ${cityLabel}`;

    return (
      <AnimatedCard key={cardKey} index={index}>
        <TouchableOpacity
          activeOpacity={isAvailable ? 0.92 : 1}
          onPress={() => {
            if (isAvailable) {
              setExpandedCardId(isExpanded ? null : cardKey);
            }
          }}
          style={[
            styles.card,
            isBest && isAvailable && styles.bestCard,
            !isAvailable && styles.cardUnavailable,
          ]}
        >
          <View style={styles.cardTopRow}>
            <View style={styles.cardLeft}>
              <View style={styles.providerRow}>
                <Text
                  style={[
                    styles.providerName,
                    !isAvailable && styles.providerNameMuted,
                  ]}
                >
                  {quote.providerName}
                </Text>
                {isBest && isAvailable && (
                  <View style={styles.bestBadge}>
                    <Text style={styles.bestBadgeText}>BEST</Text>
                  </View>
                )}
                {isAvailable && isSurge && (
                  <View style={styles.surgeBadge}>
                    <Text style={styles.surgeBadgeText}>⚡ Surge</Text>
                  </View>
                )}
              </View>
              <Text style={styles.metaText}>
                {quote.rideType} · {duration} min pickup · {starRating}★
              </Text>
            </View>
            {isAvailable ? (
              <TouchableOpacity
                style={isBest ? styles.bookButtonSolid : styles.bookButtonGhost}
                onPress={() => handleBook(quote.providerName, quote.bookingUrl)}
                activeOpacity={0.8}
              >
                <Text style={isBest ? styles.bookTextSolid : styles.bookTextGhost}>
                  Book
                </Text>
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
                ₹{quote.price}
                {highEstimate ? ` – ₹${highEstimate}` : ''}
              </Text>
              {quote.confidence === 'live' ? (
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>🟢 Live</Text>
                </View>
              ) : riderVerified ? (
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>👥 Rider Verified</Text>
                </View>
              ) : (
                <View style={styles.estimateBadge}>
                  <Text style={styles.estimateBadgeText}>Estimated</Text>
                </View>
              )}
              {isBest && savings > 0 && (
                <View style={styles.savingsBadge}>
                  <Text style={styles.savingsText}>
                    Save ₹{Math.round(savings)} vs costliest
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.notAvailableText}>{unavailableLabel}</Text>
          )}

          {isAvailable && (
            <View style={styles.cardFooterRow}>
              <View style={styles.badgeRow}>
                {specialty.map((badge, i) => {
                  const bs = getSpecialtyBadgeStyle(badge);
                  return (
                    <View
                      key={i}
                      style={[styles.specialtyBadge, { backgroundColor: bs.bg }]}
                    >
                      <Text style={[styles.specialtyBadgeText, { color: bs.text }]}>
                        {badge}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.expandHintText}>
                {isExpanded ? 'Hide details ▲' : 'Fare details ▼'}
              </Text>
            </View>
          )}

          {/* Expandable BuyHatke-style Fare Breakdown & Multi-Tier Matrix */}
          {isAvailable && isExpanded && (
            <View style={styles.breakdownBox}>
              {breakdown && (
                <View style={styles.breakdownSection}>
                  <Text style={styles.breakdownTitle}>Fare Breakdown</Text>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Base Fare</Text>
                    <Text style={styles.breakdownValue}>₹{breakdown.baseFare}</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>
                      Distance ({activeDistanceKm} km)
                    </Text>
                    <Text style={styles.breakdownValue}>
                      ₹{breakdown.distanceFare}
                    </Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>
                      Ride Time (~{activeDurationMin} mins)
                    </Text>
                    <Text style={styles.breakdownValue}>₹{breakdown.timeFare}</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Surge Pricing</Text>
                    <Text
                      style={[
                        styles.breakdownValue,
                        breakdown.surgeAmount > 0
                          ? { color: '#dc2626' }
                          : { color: '#16a34a' },
                      ]}
                    >
                      {breakdown.surgeAmount > 0
                        ? `+₹${breakdown.surgeAmount} (${breakdown.surgeMultiplier}x)`
                        : '₹0 (No Surge)'}
                    </Text>
                  </View>
                  {breakdown.recommendedBid && (
                    <View style={styles.bidTipBox}>
                      <Text style={styles.bidTipText}>
                        💡 Fast Driver Acceptance Bid: Offer ₹{breakdown.recommendedBid}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {allTiers.length > 1 && (
                <View style={styles.tiersSection}>
                  <Text style={styles.breakdownTitle}>
                    All {quote.providerName} Options
                  </Text>
                  <View style={styles.tiersGrid}>
                    {allTiers.map((t) => (
                      <TouchableOpacity
                        key={t.engineKey}
                        style={styles.tierMiniCard}
                        onPress={() =>
                          handleBook(quote.providerName, quote.bookingUrl)
                        }
                        activeOpacity={0.8}
                      >
                        <Text style={styles.tierMiniLabel}>{t.label}</Text>
                        <Text style={styles.tierMiniPrice}>
                          ₹{t.low} – ₹{t.high}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
        </TouchableOpacity>
      </AnimatedCard>
    );
  };

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
          <Text style={styles.errorTitle}>Can&apos;t reach the network</Text>
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
                {smartPickupEnabled && smartPickup
                  ? smartPickup.pickupLabel
                  : pickup.address}{' '}
                → {destination.address}
              </Text>
              {routeInfo ? (
                <Text style={styles.routeInfoText}>
                  🛣️ {activeDistanceKm} km • ~{activeDurationMin} mins by road
                  {smartPickupEnabled ? ' (Smart Pickup)' : ''}
                </Text>
              ) : null}
            </View>
            <View style={styles.cityPill}>
              <Text style={styles.cityPillText}>📍 {cityLabel}</Text>
            </View>
          </View>

          {/* BuyHatke-style Category Filter Bar with Price Floors */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {CATEGORY_FILTERS.map((cat) => {
              const active = selectedCategory === cat;
              const minPrice = categoryMinPrices[cat];
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryPill, active && styles.categoryPillActive]}
                  onPress={() => setSelectedCategory(cat)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.categoryPillText,
                      active && styles.categoryPillTextActive,
                    ]}
                  >
                    {cat}
                    {minPrice ? ` · ₹${minPrice}` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* BuyHatke Signature Feature: Smart Pickup ("Walk & Save") Banner */}
          {smartPickup && (
            <View
              style={[
                styles.smartPickupCard,
                smartPickupEnabled && styles.smartPickupCardActive,
              ]}
            >
              <View style={styles.smartPickupHeader}>
                <View style={styles.smartPickupTitleRow}>
                  <Text style={styles.smartPickupBadge}>🚶 SMART PICKUP</Text>
                  <Text style={styles.smartPickupMeta}>
                    {smartPickup.walkMeters}m walk ({smartPickup.walkMinutes} mins) · 🔥{' '}
                    {smartPickup.caloriesBurned} kcal
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.smartPickupBtn,
                    smartPickupEnabled && styles.smartPickupBtnActive,
                  ]}
                  onPress={() => setSmartPickupEnabled(!smartPickupEnabled)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.smartPickupBtnText,
                      smartPickupEnabled && styles.smartPickupBtnTextActive,
                    ]}
                  >
                    {smartPickupEnabled
                      ? 'Active ✓'
                      : `Save ~₹${smartPickup.estimatedSavings}`}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.smartPickupDesc} numberOfLines={2}>
                {smartPickupEnabled
                  ? `Pickup switched to ${smartPickup.pickupLabel}. Saves ~${smartPickup.waitSavedMinutes} mins driver wait & avoids U-turn surge.`
                  : `Walk ${smartPickup.walkMeters}m to ${smartPickup.pickupLabel} to cut ${smartPickup.waitSavedMinutes} mins wait time and save ~₹${smartPickup.estimatedSavings}.`}
              </Text>
            </View>
          )}

          {isFetchingQuotes && (
            <View style={styles.loadingQuotesBox}>
              <Text style={styles.loadingQuotesText}>
                Fetching current provider quotes...
              </Text>
            </View>
          )}

          {isLoaded && topPicks.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>👑 Top picks</Text>
              {topPicks.map((item, i) => renderQuoteCard(item, i))}
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
                    <Text style={styles.aiCardTitle}>
                      🤖 AI price insight & 60m forecast
                    </Text>
                    {!aiLoading && aiInsight && (
                      <Text style={styles.aiConfidence}>
                        {aiInsight.confidence} confidence
                      </Text>
                    )}
                  </View>
                  <Text style={styles.aiChevron}>{aiCollapsed ? '›' : '‹'}</Text>
                </View>
                {!aiCollapsed && (
                  <View style={styles.aiCardBody}>
                    {aiLoading ? (
                      <Text style={styles.aiLoadingText}>Analyzing fares...</Text>
                    ) : aiError ? (
                      <Text style={styles.aiErrorText}>
                        Insight unavailable right now
                      </Text>
                    ) : aiInsight ? (
                      <>
                        {(() => {
                          const t = getTrendInfo(aiInsight.trend);
                          return (
                            <View
                              style={[styles.trendBox, { backgroundColor: t.color }]}
                            >
                              <Text
                                style={[
                                  styles.trendBoxText,
                                  { color: t.textColor },
                                ]}
                              >
                                {t.icon} Fares {t.label}
                                {aiInsight.trend !== 'stable' &&
                                aiInsight.trend !== 'steady'
                                  ? ` ~${aiInsight.trendPercent}% in ${aiInsight.trendTimeframe}`
                                  : ' right now'}
                              </Text>
                            </View>
                          );
                        })()}
                        <Text style={styles.aiAdvice}>{aiInsight.advice}</Text>
                        <Text style={styles.aiEstimate}>
                          {aiInsight.smartEstimate}
                        </Text>

                        {/* 60-Min Price Forecast Strip */}
                        {hourlyForecast.length > 0 && (
                          <View style={styles.forecastStrip}>
                            {hourlyForecast.map((pt) => (
                              <View
                                key={pt.label}
                                style={[
                                  styles.forecastSlot,
                                  pt.isCheapestSlot && styles.forecastSlotBest,
                                ]}
                              >
                                <Text style={styles.forecastTimeLabel}>
                                  {pt.label}
                                </Text>
                                <Text
                                  style={[
                                    styles.forecastPriceLabel,
                                    pt.isCheapestSlot &&
                                      styles.forecastPriceLabelBest,
                                  ]}
                                >
                                  ₹{pt.estimatedFare}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
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
              {moreOptions.map((item, i) =>
                renderQuoteCard(item, topPicks.length + 1 + i)
              )}
            </View>
          )}

          {isLoaded && (
            <View style={styles.disclaimerBox}>
              <Text style={styles.disclaimerText}>
                ⚠️ Estimated prices may vary from actual fares. Tap any card to view fare breakdown & all vehicle tiers.
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
            <Text style={styles.modalTitle}>
              What fare did you see in {selectedApp}?
            </Text>
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
              Fare data is collected anonymously to calibrate live community estimates. No personal info is stored.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButtonGhost}
                onPress={handleFareSkip}
                activeOpacity={0.8}
              >
                <Text style={styles.modalButtonGhostText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButtonSolid}
                onPress={handleFareSubmit}
                activeOpacity={0.8}
              >
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
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingRight: 8,
  },
  categoryPill: {
    paddingVertical: 6,
    paddingHorizontal: 13,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryPillActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  categoryPillTextActive: {
    color: '#ffffff',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // Smart Pickup Card
  smartPickupCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  smartPickupCardActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
    borderWidth: 1.5,
  },
  smartPickupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  smartPickupTitleRow: {
    flex: 1,
  },
  smartPickupBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803d',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  smartPickupMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  smartPickupBtn: {
    backgroundColor: '#16a34a',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  smartPickupBtnActive: {
    backgroundColor: '#15803d',
  },
  smartPickupBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  smartPickupBtnTextActive: {
    color: '#ffffff',
  },
  smartPickupDesc: {
    fontSize: 12,
    color: '#166534',
    lineHeight: 17,
  },

  loadingQuotesBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingQuotesText: {
    color: '#64748b',
    fontSize: 14,
    fontStyle: 'italic',
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
    flexWrap: 'wrap',
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
  surgeBadge: {
    backgroundColor: '#fef2f2',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  surgeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#dc2626',
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
  liveBadge: {
    backgroundColor: '#e0ffe6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  liveBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16a34a',
  },
  estimateBadge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  estimateBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  notAvailableText: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  expandHintText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
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
  breakdownBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  breakdownSection: {
    marginBottom: 10,
  },
  breakdownTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#475569',
  },
  breakdownValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  bidTipBox: {
    marginTop: 8,
    backgroundColor: '#eff6ff',
    padding: 8,
    borderRadius: 8,
  },
  bidTipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  tiersSection: {
    marginTop: 4,
  },
  tiersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tierMiniCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tierMiniLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  tierMiniPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 1,
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
  forecastStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 6,
  },
  forecastSlot: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  forecastSlotBest: {
    backgroundColor: '#dcfce7',
    borderColor: '#4ade80',
  },
  forecastTimeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
  },
  forecastPriceLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e40af',
    marginTop: 2,
  },
  forecastPriceLabelBest: {
    color: '#15803d',
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
