import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinkAppsModal } from '../components/LinkAppsModal';
import { LiveFareScraperPool } from '../components/LiveFareScraperPool';
import { RoutePreviewMapModal } from '../components/RoutePreviewMapModal';
import { openRideApp, openWalkingDirections } from '../utils/appUrls';
import { CityKey, detectCity } from '../utils/cityDetector';
import {
  getSavedCommuteRoute,
  saveCommuteRoute,
} from '../utils/commuteGuard';
import { getRoadDistance, RouteCoords } from '../utils/distanceEngine';
import {
  estimateFare,
  FareBreakdown,
  getHourlyFareForecast,
} from '../utils/fareEngine';
import {
  FieldCalibrationMap,
  getCityFieldCalibration,
  recordFieldCalibrationSample,
} from '../utils/fareCalibration';
import {
  fetchLiveAreaSurgeMultipliers,
  fetchRecentCrowdsourcedFares,
  reportFare,
} from '../utils/fareReporter';
import {
  computeMetroSplitCombo,
  MetroSplitCombo,
} from '../utils/metroComboEngine';
import {
  getMonetizationConfig,
  openPartnerOffer,
  refreshMonetizationConfig,
  RemoteMonetizationConfig,
} from '../utils/monetizationEngine';
import { FareQuote, QuoteEngine } from '../utils/quoteEngine';
import {
  getLifetimeSavings,
  getLinkedProviders,
  LifetimeSavingsData,
  LinkableProviderId,
  recordTripSavings,
  refreshRemoteScraperConfig,
  ScrapedLiveProduct,
  setProviderLinked,
} from '../utils/liveSessionBridge';
import {
  computeSmartPickup,
  SmartPickupSuggestion,
} from '../utils/smartPickupEngine';
import {
  bookNammaYatriEstimate,
  fetchNammaYatriLiveFares,
} from '../utils/nammaYatriDirectApi';
import {
  fetchLiveWeatherSurge,
  LiveWeatherSurgeInfo,
} from '../utils/weatherSurgeEngine';

type LocationData = {
  lat?: number;
  lng?: number;
  address: string;
};

type RideCategoryTab = 'All' | 'Bike' | 'Auto' | 'Cab';
type SortField = 'fare' | 'eta';
type SortOrder = 'asc' | 'desc';

type QuoteSourceKind =
  | 'live_scraped'
  | 'ondc_live'
  | 'community_verified'
  | 'estimated';

type FlatRideOption = {
  id: string;
  providerName: string;
  linkId?: LinkableProviderId;
  providerBadgeText: string;
  providerBadgeBg: string;
  providerBadgeColor: string;
  productName: string;
  category: 'Bike' | 'Auto' | 'Cab';
  vehicleEmoji: string;
  etaMinutes: number | null;
  price: number;
  highPrice: number;
  isSurge: boolean;
  sourceKind: QuoteSourceKind;
  estimateId?: string;
  breakdown: FareBreakdown;
};

type AIInsight = {
  trend: 'up' | 'down' | 'stable' | 'steady';
  trendPercent: number;
  trendTimeframe: '15 mins' | '30 mins';
  confidence: 'low' | 'medium' | 'high';
  advice: string;
  smartEstimate: string;
};

// Base catalog of products across providers (zero fake decimal cents)
const RIDE_CATALOG: {
  id: string;
  providerName: string;
  linkId?: LinkableProviderId;
  providerBadgeText: string;
  providerBadgeBg: string;
  providerBadgeColor: string;
  productName: string;
  matchAliases: string[];
  engineKey: string;
  priceMultiplier: number;
  category: 'Bike' | 'Auto' | 'Cab';
  vehicleEmoji: string;
  baseEta: number;
}[] = [
  {
    id: 'rapido_bike_direct',
    providerName: 'Rapido',
    linkId: 'rapido',
    providerBadgeText: 'rapido',
    providerBadgeBg: '#facc15',
    providerBadgeColor: '#0f172a',
    productName: 'Bike Direct',
    matchAliases: ['bike direct', 'bike', 'rapido bike'],
    engineKey: 'RapidoBike',
    priceMultiplier: 1.0,
    category: 'Bike',
    vehicleEmoji: '🏍️',
    baseEta: 4,
  },
  {
    id: 'uber_bike_direct',
    providerName: 'Uber',
    linkId: 'uber',
    providerBadgeText: 'Uber',
    providerBadgeBg: '#000000',
    providerBadgeColor: '#ffffff',
    productName: 'Uber Moto',
    matchAliases: ['moto', 'uber moto', 'bike direct', 'bike'],
    engineKey: 'UberMoto',
    priceMultiplier: 1.0,
    category: 'Bike',
    vehicleEmoji: '🏍️',
    baseEta: 6,
  },
  {
    id: 'ola_bike',
    providerName: 'Ola',
    linkId: 'ola',
    providerBadgeText: 'OLA',
    providerBadgeBg: '#16a34a',
    providerBadgeColor: '#ffffff',
    productName: 'Ola Bike',
    matchAliases: ['ola bike', 'bike'],
    engineKey: 'OlaBike',
    priceMultiplier: 1.0,
    category: 'Bike',
    vehicleEmoji: '🏍️',
    baseEta: 5,
  },
  {
    id: 'rapido_auto_share',
    providerName: 'Rapido',
    linkId: 'rapido',
    providerBadgeText: 'rapido',
    providerBadgeBg: '#facc15',
    providerBadgeColor: '#0f172a',
    productName: 'Auto Seat Share',
    matchAliases: ['auto seat share', 'seat share'],
    engineKey: 'RapidoAuto',
    priceMultiplier: 0.78,
    category: 'Auto',
    vehicleEmoji: '🛺',
    baseEta: 4,
  },
  {
    id: 'namma_yatri_auto',
    providerName: 'Namma Yatri',
    linkId: 'namma_yatri',
    providerBadgeText: 'NY',
    providerBadgeBg: '#f59e0b',
    providerBadgeColor: '#0f172a',
    productName: 'Auto Direct',
    matchAliases: ['auto direct', 'namma yatri auto', 'auto'],
    engineKey: 'NammaYatriAuto',
    priceMultiplier: 1.0,
    category: 'Auto',
    vehicleEmoji: '🛺',
    baseEta: 3,
  },
  {
    id: 'uber_auto',
    providerName: 'Uber',
    linkId: 'uber',
    providerBadgeText: 'Uber',
    providerBadgeBg: '#000000',
    providerBadgeColor: '#ffffff',
    productName: 'Uber Auto',
    matchAliases: ['uber auto', 'auto'],
    engineKey: 'UberAuto',
    priceMultiplier: 1.0,
    category: 'Auto',
    vehicleEmoji: '🛺',
    baseEta: 2,
  },
  {
    id: 'rapido_auto',
    providerName: 'Rapido',
    linkId: 'rapido',
    providerBadgeText: 'rapido',
    providerBadgeBg: '#facc15',
    providerBadgeColor: '#0f172a',
    productName: 'Auto',
    matchAliases: ['auto', 'rapido auto'],
    engineKey: 'RapidoAuto',
    priceMultiplier: 1.0,
    category: 'Auto',
    vehicleEmoji: '🛺',
    baseEta: 4,
  },
  {
    id: 'ola_auto',
    providerName: 'Ola',
    linkId: 'ola',
    providerBadgeText: 'OLA',
    providerBadgeBg: '#16a34a',
    providerBadgeColor: '#ffffff',
    productName: 'Ola Auto',
    matchAliases: ['ola auto', 'auto'],
    engineKey: 'OlaAuto',
    priceMultiplier: 1.0,
    category: 'Auto',
    vehicleEmoji: '🛺',
    baseEta: 5,
  },
  {
    id: 'indrive_auto',
    providerName: 'inDrive',
    providerBadgeText: 'inDrive',
    providerBadgeBg: '#2563eb',
    providerBadgeColor: '#ffffff',
    productName: 'Auto Flex',
    matchAliases: ['indrive auto'],
    engineKey: 'InDriveAuto',
    priceMultiplier: 1.0,
    category: 'Auto',
    vehicleEmoji: '🛺',
    baseEta: 6,
  },
  {
    id: 'rapido_auto_pet',
    providerName: 'Rapido',
    linkId: 'rapido',
    providerBadgeText: 'rapido',
    providerBadgeBg: '#facc15',
    providerBadgeColor: '#0f172a',
    productName: 'Auto Pet',
    matchAliases: ['auto pet'],
    engineKey: 'RapidoAuto',
    priceMultiplier: 1.28,
    category: 'Auto',
    vehicleEmoji: '🛺',
    baseEta: 4,
  },
  {
    id: 'rapido_cab_non_ac',
    providerName: 'Rapido',
    linkId: 'rapido',
    providerBadgeText: 'rapido',
    providerBadgeBg: '#facc15',
    providerBadgeColor: '#0f172a',
    productName: 'Cab Non AC',
    matchAliases: ['cab non ac', 'cab economy'],
    engineKey: 'RapidoCab',
    priceMultiplier: 0.9,
    category: 'Cab',
    vehicleEmoji: '🚕',
    baseEta: 4,
  },
  {
    id: 'bharat_cab_mini',
    providerName: 'Bharat Cab',
    providerBadgeText: 'BC',
    providerBadgeBg: '#ea580c',
    providerBadgeColor: '#ffffff',
    productName: 'Bharat Mini',
    matchAliases: ['bharat mini'],
    engineKey: 'BharatCab',
    priceMultiplier: 1.0,
    category: 'Cab',
    vehicleEmoji: '🚕',
    baseEta: 7,
  },
  {
    id: 'rapido_cab_ac',
    providerName: 'Rapido',
    linkId: 'rapido',
    providerBadgeText: 'rapido',
    providerBadgeBg: '#facc15',
    providerBadgeColor: '#0f172a',
    productName: 'Cab AC',
    matchAliases: ['cab ac', 'rapido cab'],
    engineKey: 'RapidoCab',
    priceMultiplier: 1.0,
    category: 'Cab',
    vehicleEmoji: '🚕',
    baseEta: 4,
  },
  {
    id: 'uber_xs',
    providerName: 'Uber',
    linkId: 'uber',
    providerBadgeText: 'Uber',
    providerBadgeBg: '#000000',
    providerBadgeColor: '#ffffff',
    productName: 'UberXS',
    matchAliases: ['uberxs', 'uber xs'],
    engineKey: 'UberXS',
    priceMultiplier: 1.0,
    category: 'Cab',
    vehicleEmoji: '🚕',
    baseEta: 5,
  },
  {
    id: 'indrive_cab',
    providerName: 'inDrive',
    providerBadgeText: 'inDrive',
    providerBadgeBg: '#2563eb',
    providerBadgeColor: '#ffffff',
    productName: 'Cab Mini',
    matchAliases: ['indrive mini'],
    engineKey: 'InDrive',
    priceMultiplier: 1.0,
    category: 'Cab',
    vehicleEmoji: '🚕',
    baseEta: 6,
  },
  {
    id: 'ola_mini',
    providerName: 'Ola',
    linkId: 'ola',
    providerBadgeText: 'OLA',
    providerBadgeBg: '#16a34a',
    providerBadgeColor: '#ffffff',
    productName: 'Ola Mini',
    matchAliases: ['ola mini', 'mini'],
    engineKey: 'OlaMini',
    priceMultiplier: 1.0,
    category: 'Cab',
    vehicleEmoji: '🚕',
    baseEta: 5,
  },
  {
    id: 'namma_yatri_cab',
    providerName: 'Namma Yatri',
    linkId: 'namma_yatri',
    providerBadgeText: 'NY',
    providerBadgeBg: '#f59e0b',
    providerBadgeColor: '#0f172a',
    productName: 'Cab AC',
    matchAliases: ['namma yatri cab', 'cab ac'],
    engineKey: 'NammaYatriCab',
    priceMultiplier: 1.0,
    category: 'Cab',
    vehicleEmoji: '🚕',
    baseEta: 6,
  },
  {
    id: 'rapido_cab_premium',
    providerName: 'Rapido',
    linkId: 'rapido',
    providerBadgeText: 'rapido',
    providerBadgeBg: '#facc15',
    providerBadgeColor: '#0f172a',
    productName: 'Cab Premium',
    matchAliases: ['cab premium'],
    engineKey: 'RapidoCab',
    priceMultiplier: 1.15,
    category: 'Cab',
    vehicleEmoji: '🚕',
    baseEta: 4,
  },
  {
    id: 'uber_go_non_ac',
    providerName: 'Uber',
    linkId: 'uber',
    providerBadgeText: 'Uber',
    providerBadgeBg: '#000000',
    providerBadgeColor: '#ffffff',
    productName: 'Go Non AC',
    matchAliases: ['go non ac', 'uber go non ac'],
    engineKey: 'UberGoNonAC',
    priceMultiplier: 1.0,
    category: 'Cab',
    vehicleEmoji: '🚕',
    baseEta: 5,
  },
  {
    id: 'uber_go',
    providerName: 'Uber',
    linkId: 'uber',
    providerBadgeText: 'Uber',
    providerBadgeBg: '#000000',
    providerBadgeColor: '#ffffff',
    productName: 'Uber Go',
    matchAliases: ['uber go', 'ubergo'],
    engineKey: 'UberGo',
    priceMultiplier: 1.0,
    category: 'Cab',
    vehicleEmoji: '🚕',
    baseEta: 5,
  },
  {
    id: 'ola_prime_sedan',
    providerName: 'Ola',
    linkId: 'ola',
    providerBadgeText: 'OLA',
    providerBadgeBg: '#16a34a',
    providerBadgeColor: '#ffffff',
    productName: 'Prime Sedan',
    matchAliases: ['prime sedan', 'ola prime sedan', 'sedan'],
    engineKey: 'OlaPrimeSedan',
    priceMultiplier: 1.0,
    category: 'Cab',
    vehicleEmoji: '🚖',
    baseEta: 7,
  },
  {
    id: 'uber_premier',
    providerName: 'Uber',
    linkId: 'uber',
    providerBadgeText: 'Uber',
    providerBadgeBg: '#000000',
    providerBadgeColor: '#ffffff',
    productName: 'Uber Premier',
    matchAliases: ['premier', 'uber premier'],
    engineKey: 'UberPremier',
    priceMultiplier: 1.0,
    category: 'Cab',
    vehicleEmoji: '🚖',
    baseEta: 6,
  },
  {
    id: 'meru_sedan',
    providerName: 'Meru Cabs',
    providerBadgeText: 'Meru',
    providerBadgeBg: '#0d9488',
    providerBadgeColor: '#ffffff',
    productName: 'Meru Sedan',
    matchAliases: ['meru sedan'],
    engineKey: 'Meru',
    priceMultiplier: 1.0,
    category: 'Cab',
    vehicleEmoji: '🚖',
    baseEta: 9,
  },
  {
    id: 'savaari_sedan',
    providerName: 'Savaari',
    providerBadgeText: 'SV',
    providerBadgeBg: '#4f46e5',
    providerBadgeColor: '#ffffff',
    productName: 'Chauffeur AC',
    matchAliases: ['savaari'],
    engineKey: 'Savaari',
    priceMultiplier: 1.0,
    category: 'Cab',
    vehicleEmoji: '🚖',
    baseEta: 14,
  },
  {
    id: 'uber_xl',
    providerName: 'Uber',
    linkId: 'uber',
    providerBadgeText: 'Uber',
    providerBadgeBg: '#000000',
    providerBadgeColor: '#ffffff',
    productName: 'UberXL',
    matchAliases: ['uberxl', 'uber xl', 'xl'],
    engineKey: 'UberXL',
    priceMultiplier: 1.0,
    category: 'Cab',
    vehicleEmoji: '🚙',
    baseEta: 8,
  },
];

const PAYMENT_OPTIONS = [
  { id: 'cash', label: 'Cash', icon: '💵' },
  { id: 'upi_app', label: 'PhonePe / GPay UPI', icon: 'पे' },
  { id: 'upi_qr', label: 'UPI Scan and Pay', icon: '🔳' },
  { id: 'card', label: 'RuPay / Visa Card', icon: '💳' },
];

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
  cheapestOption?: FlatRideOption
): AIInsight => {
  const cheapestLabel = cheapestOption
    ? `${cheapestOption.providerName} ${cheapestOption.productName} at ₹${cheapestOption.price} is the lowest fare right now.`
    : 'Compare available options below before booking.';

  if (surgeStatus === 'peak') {
    return {
      trend: 'up',
      trendPercent: 15,
      trendTimeframe: '15 mins',
      confidence: 'high',
      advice:
        'Peak-hour demand is active. Switch to Smart Pickup or choose Namma Yatri / Bharat Cab to avoid surge.',
      smartEstimate: cheapestLabel,
    };
  }
  if (surgeStatus === 'off-peak') {
    return {
      trend: 'down',
      trendPercent: 10,
      trendTimeframe: '30 mins',
      confidence: 'medium',
      advice: 'Off-peak rates are active right now—great time to book.',
      smartEstimate: cheapestLabel,
    };
  }
  return {
    trend: 'stable',
    trendPercent: 0,
    trendTimeframe: '15 mins',
    confidence: 'high',
    advice: 'Fares are stable with normal traffic demand right now.',
    smartEstimate: cheapestLabel,
  };
};

export default function ResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const [selectedCategory, setSelectedCategory] = useState<RideCategoryTab>('All');
  const [sortField, setSortField] = useState<SortField>('fare');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
  const [expandedRideId, setExpandedRideId] = useState<string | null>(null);

  const [aiLoading, setAiLoading] = useState(true);
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null);
  const [aiCollapsed, setAiCollapsed] = useState(false);

  const [baseDistanceKm, setBaseDistanceKm] = useState(0);
  const [baseDurationMin, setBaseDurationMin] = useState(0);
  const [intersectionCount, setIntersectionCount] = useState(0);
  const [liveWeather, setLiveWeather] = useState<LiveWeatherSurgeInfo | null>(
    null
  );
  const [resolvedPickupCoords, setResolvedPickupCoords] = useState<
    RouteCoords | undefined
  >(
    pickup.lat && pickup.lng ? { lat: pickup.lat, lng: pickup.lng } : undefined
  );
  const [resolvedDropCoords, setResolvedDropCoords] = useState<
    RouteCoords | undefined
  >(
    destination.lat && destination.lng
      ? { lat: destination.lat, lng: destination.lng }
      : undefined
  );

  // BuyHatke Smart Pickup ("Current Location" vs "Smart Pickup" toggle)
  const [smartPickup, setSmartPickup] = useState<SmartPickupSuggestion | null>(
    null
  );
  const [smartPickupEnabled, setSmartPickupEnabled] = useState(false);
  const [routeMapModalVisible, setRouteMapModalVisible] = useState(false);
  const [surgeTimerSeconds, setSurgeTimerSeconds] = useState<number | null>(
    null
  );
  const [copiedDestToast, setCopiedDestToast] = useState<string | null>(null);
  const [commutePinned, setCommutePinned] = useState(false);
  const [monetization, setMonetization] = useState<RemoteMonetizationConfig>(
    getMonetizationConfig()
  );

  useEffect(() => {
    getSavedCommuteRoute()
      .then((saved) => {
        if (
          saved &&
          saved.pickup?.trim().toLowerCase() ===
            pickup.address?.trim().toLowerCase() &&
          saved.destination?.trim().toLowerCase() ===
            destination.address?.trim().toLowerCase()
        ) {
          setCommutePinned(true);
        } else {
          setCommutePinned(false);
        }
      })
      .catch(() => {});
  }, [pickup.address, destination.address]);

  // Linked Providers & Real Scraped Live Products from WebView Pool
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkModalInitialProvider, setLinkModalInitialProvider] =
    useState<LinkableProviderId | null>(null);
  const [linkModalAutoBookProduct, setLinkModalAutoBookProduct] = useState<
    string | undefined
  >(undefined);
  const [linkedProviders, setLinkedProviders] = useState<
    Record<LinkableProviderId, boolean>
  >({
    uber: false,
    rapido: false,
    ola: false,
    namma_yatri: false,
  });
  const [scrapedLiveProducts, setScrapedLiveProducts] = useState<
    Partial<Record<LinkableProviderId, ScrapedLiveProduct[]>>
  >({});
  const [providerAuthExpired, setProviderAuthExpired] = useState<
    Partial<Record<LinkableProviderId, boolean>>
  >({});

  // Crowdsourced rider calibration map, Waze-style area surge, Metro combo & ONDC live quotes
  const [crowdsourcedFares, setCrowdsourcedFares] = useState<
    Record<string, number>
  >({});
  const [areaSurgeMultipliers, setAreaSurgeMultipliers] = useState<
    Record<string, number>
  >({});
  const [fieldCalibration, setFieldCalibration] = useState<FieldCalibrationMap>(
    {}
  );
  const [metroCombo, setMetroCombo] = useState<MetroSplitCombo | null>(null);
  const [ondcLiveQuotes, setOndcLiveQuotes] = useState<FareQuote[]>([]);

  // BuyHatke Booking Flow Sheets
  const [confirmRideSheetVisible, setConfirmRideSheetVisible] = useState(false);
  const [paymentSheetVisible, setPaymentSheetVisible] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState('cash');
  const [uberCashEnabled, setUberCashEnabled] = useState(false);
  const [bookingPhase, setBookingPhase] = useState<
    'idle' | 'finding' | 'confirmed' | 'completed'
  >('idle');
  const [lifetimeSavings, setLifetimeSavings] = useState<LifetimeSavingsData>({
    totalSaved: 0,
    tripCount: 0,
    lastTripSaved: 0,
  });
  const [fareInput, setFareInput] = useState('');

  const [routeError, setRouteError] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(true);

  const pendingBookRideRef = useRef<FlatRideOption | null>(null);
  const lastAiKeyRef = useRef<string>('');
  const [pulseAnim] = useState(() => new Animated.Value(0.45));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.45,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  useEffect(() => {
    getLinkedProviders().then(setLinkedProviders).catch(() => {});
    getLifetimeSavings().then(setLifetimeSavings).catch(() => {});
    refreshRemoteScraperConfig().catch(() => {});
    refreshMonetizationConfig().then(setMonetization).catch(() => {});
    getSavedCommuteRoute()
      .then((saved) => {
        if (
          saved &&
          saved.pickup.toLowerCase() === pickup.address.toLowerCase() &&
          saved.destination.toLowerCase() === destination.address.toLowerCase()
        ) {
          setCommutePinned(true);
        }
      })
      .catch(() => {});
  }, [pickup.address, destination.address]);

  const activeDistanceKm =
    smartPickupEnabled && smartPickup
      ? smartPickup.newDistanceKm
      : baseDistanceKm;
  const activeDurationMin =
    smartPickupEnabled && smartPickup
      ? smartPickup.newDurationMin
      : baseDurationMin;
  const activePickupCoords =
    smartPickupEnabled && smartPickup
      ? smartPickup.pickupCoords
      : resolvedPickupCoords;

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
          setIntersectionCount(result.intersectionCount);
          setResolvedPickupCoords(result.originCoords);
          setResolvedDropCoords(result.destCoords);

          const approxCabFare = Math.max(
            95,
            Math.round(60 + result.distanceKm * 20)
          );
          computeSmartPickup({
            originCoords: result.originCoords,
            destCoords: result.destCoords,
            originAddress: pickup.address,
            distanceKm: result.distanceKm,
            durationMin: result.durationMin,
            referenceCabFare: approxCabFare,
            entrySteps: result.entrySteps,
          })
            .then((sp) => setSmartPickup(sp))
            .catch(() => {});

          fetchLiveWeatherSurge(
            result.originCoords.lat,
            result.originCoords.lng
          )
            .then((w) => setLiveWeather(w))
            .catch(() => {});

          fetchRecentCrowdsourcedFares(detected, result.distanceKm)
            .then((cf) => setCrowdsourcedFares(cf))
            .catch(() => {});

          fetchLiveAreaSurgeMultipliers(
            detected,
            pickup.address.split(',')[0].trim()
          )
            .then((asm) => setAreaSurgeMultipliers(asm))
            .catch(() => {});

          getCityFieldCalibration(detected)
            .then((fc) => setFieldCalibration(fc))
            .catch(() => {});

          computeMetroSplitCombo({
            city: detected,
            cityLabel: CITY_LABELS[detected],
            originCoords: result.originCoords,
            destCoords: result.destCoords,
            distanceKm: result.distanceKm,
            durationMin: result.durationMin,
            referenceCabFare: approxCabFare,
          })
            .then((mc) => setMetroCombo(mc))
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

  // Subscribe to QuoteEngine for live ONDC Beckn `/on_search` quotes
  useEffect(() => {
    if (activeDistanceKm <= 0) return;

    const unsubscribe = quoteEngine.subscribe((incomingQuotes) => {
      const liveOnes = incomingQuotes.filter(
        (q) => q.source === 'live_provider' && q.price !== null
      );
      if (liveOnes.length > 0) {
        setOndcLiveQuotes(liveOnes);
      }
    });

    quoteEngine
      .startQuoteRequest({
        pickup: {
          address: pickup.address,
          lat: activePickupCoords?.lat,
          lng: activePickupCoords?.lng,
        },
        destination: {
          address: destination.address,
          lat: resolvedDropCoords?.lat,
          lng: resolvedDropCoords?.lng,
        },
        city,
        distanceKm: activeDistanceKm,
        durationMin: activeDurationMin,
      })
      .catch(() => {});

    return () => unsubscribe();
  }, [
    activeDistanceKm,
    activeDurationMin,
    city,
    pickup.address,
    destination.address,
    activePickupCoords,
    resolvedDropCoords,
  ]);

  // Query Namma Yatri's direct production API (`api.moving.tech`) if user linked NY via OTP
  useEffect(() => {
    if (
      !linkedProviders.namma_yatri ||
      !activePickupCoords ||
      !resolvedDropCoords
    ) {
      return;
    }

    fetchNammaYatriLiveFares({
      pickupLat: activePickupCoords.lat,
      pickupLng: activePickupCoords.lng,
      pickupAddress:
        smartPickupEnabled && smartPickup
          ? smartPickup.pickupLabel
          : pickup.address,
      dropLat: resolvedDropCoords.lat,
      dropLng: resolvedDropCoords.lng,
      dropAddress: destination.address,
      cityLabel: CITY_LABELS[city],
      onAuthExpired: () => {
        setProviderAuthExpired((prev) => ({ ...prev, namma_yatri: true }));
      },
    })
      .then((products) => {
        if (products.length > 0) {
          setScrapedLiveProducts((prev) => ({
            ...prev,
            namma_yatri: products,
          }));
          if (activeDistanceKm > 0) {
            reportFare({
              app: 'Namma Yatri',
              city,
              pickup_area: pickup.address.split(',')[0].trim(),
              distance_km: activeDistanceKm,
              quoted_fare: products[0].price,
              app_version: '1.0.0',
            }).catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, [
    linkedProviders.namma_yatri,
    activePickupCoords,
    resolvedDropCoords,
    smartPickupEnabled,
    smartPickup,
    pickup.address,
    destination.address,
    city,
    activeDistanceKm,
  ]);

  // Build flat list of all ride products merging:
  // 1) Real WebView-scraped products (`scrapedLiveProducts`) when available
  // 2) Community-verified fares from Supabase (`crowdsourcedFares`)
  // 3) Honest city rate-card + OSRM distance estimates (`estimateFare`)
  const allRideOptions = useMemo((): FlatRideOption[] => {
    if (activeDistanceKm <= 0) return [];

    const options: FlatRideOption[] = [];

    for (const item of RIDE_CATALOG) {
      const weatherMultiplier = liveWeather
        ? item.category === 'Bike'
          ? liveWeather.bikeMultiplier
          : item.category === 'Auto'
            ? liveWeather.autoMultiplier
            : liveWeather.cabMultiplier
        : 1.0;

      const est = estimateFare(
        item.engineKey,
        city,
        activeDistanceKm,
        activeDurationMin,
        {
          weatherMultiplier,
          pickupAddress: pickup.address,
          isSmartPickup: smartPickupEnabled,
        }
      );
      if (!est.available) continue;

      let price = Math.round(est.low * item.priceMultiplier);
      let highPrice = Math.round(est.high * item.priceMultiplier);
      let etaMinutes: number | null =
        smartPickupEnabled && smartPickup
          ? Math.max(2, item.baseEta - 1)
          : item.baseEta;
      let sourceKind: QuoteSourceKind = 'estimated';
      let estimateId: string | undefined;

      // Apply learned self-calibration multiplier from real street observations
      const learnedMult = fieldCalibration[item.providerName];
      if (learnedMult && learnedMult !== 1.0) {
        price = Math.round(price * learnedMult);
        highPrice = Math.max(price + 10, Math.round(highPrice * learnedMult));
      }

      // Apply Waze-style neighborhood surge multiplier if reported by recent riders
      const areaMult = areaSurgeMultipliers[item.providerName];
      if (areaMult && areaMult !== 1.0 && !crowdsourcedFares[item.providerName]) {
        price = Math.round(price * areaMult);
        highPrice = Math.max(price + 12, Math.round(price * 1.15));
        sourceKind = 'community_verified';
      }

      // Check if community rider report exists in Supabase for this provider
      const crowdFare = crowdsourcedFares[item.providerName];
      if (crowdFare && item.priceMultiplier === 1.0) {
        price = Math.round(price * 0.65 + crowdFare * 0.35);
        highPrice = Math.max(price + 12, Math.round(price * 1.18));
        sourceKind = 'community_verified';
      }

      // Check if ONDC Beckn Gateway returned a live quote for this provider/item
      const matchingOndc = ondcLiveQuotes.find(
        (oq) =>
          oq.providerName.toLowerCase() === item.providerName.toLowerCase() &&
          (oq.rideType.toLowerCase() === item.productName.toLowerCase() ||
            item.matchAliases.includes(oq.rideType.toLowerCase()))
      );
      if (matchingOndc && typeof matchingOndc.price === 'number') {
        price = matchingOndc.price;
        highPrice =
          (matchingOndc.metadata?.highEstimate as number | undefined) ||
          Math.round(price * 1.08);
        if (matchingOndc.etaMinutes) {
          etaMinutes = matchingOndc.etaMinutes;
        }
        sourceKind = 'ondc_live';
      }

      // Check if LiveFareScraperPool intercepted an actual live price for this product
      const providerLiveList = item.linkId
        ? scrapedLiveProducts[item.linkId]
        : undefined;
      if (providerLiveList && providerLiveList.length > 0) {
        const matchedLive =
          providerLiveList.find((lp) =>
            item.matchAliases.some(
              (alias) => lp.productName.toLowerCase() === alias
            )
          ) ||
          providerLiveList.find((lp) => lp.category === item.category);

        if (matchedLive) {
          price = matchedLive.price;
          highPrice = Math.round(matchedLive.price * 1.05);
          if (matchedLive.etaMinutes !== null) {
            etaMinutes = matchedLive.etaMinutes;
          }
          estimateId = matchedLive.estimateId;
          sourceKind = 'live_scraped';
        }
      }

      options.push({
        id: item.id,
        providerName: item.providerName,
        linkId: item.linkId,
        providerBadgeText: item.providerBadgeText,
        providerBadgeBg: item.providerBadgeBg,
        providerBadgeColor: item.providerBadgeColor,
        productName: item.productName,
        category: item.category,
        vehicleEmoji: item.vehicleEmoji,
        etaMinutes,
        price,
        highPrice,
        isSurge: est.isSurge,
        sourceKind,
        estimateId,
        breakdown: est.breakdown,
      });
    }

    return options;
  }, [
    activeDistanceKm,
    activeDurationMin,
    areaSurgeMultipliers,
    city,
    crowdsourcedFares,
    fieldCalibration,
    liveWeather,
    ondcLiveQuotes,
    pickup.address,
    scrapedLiveProducts,
    smartPickupEnabled,
    smartPickup,
  ]);

  // Filter & Sort options
  const displayedOptions = useMemo(() => {
    const filtered =
      selectedCategory === 'All'
        ? [...allRideOptions]
        : allRideOptions.filter((o) => o.category === selectedCategory);

    filtered.sort((a, b) => {
      if (sortField === 'eta') {
        const etaA = a.etaMinutes ?? 999;
        const etaB = b.etaMinutes ?? 999;
        if (etaA !== etaB) {
          return sortOrder === 'asc' ? etaA - etaB : etaB - etaA;
        }
      }
      return sortOrder === 'asc' ? a.price - b.price : b.price - a.price;
    });

    return filtered;
  }, [allRideOptions, selectedCategory, sortField, sortOrder]);

  useEffect(() => {
    if (displayedOptions.length > 0) {
      const stillExists = displayedOptions.some((o) => o.id === selectedRideId);
      if (!stillExists) {
        setSelectedRideId(displayedOptions[0].id);
      }
    }
  }, [displayedOptions, selectedRideId]);

  const selectedRide = useMemo(
    () =>
      displayedOptions.find((o) => o.id === selectedRideId) ||
      displayedOptions[0] ||
      null,
    [displayedOptions, selectedRideId]
  );

  const uberXlOption = useMemo(
    () =>
      allRideOptions.find((o) => o.id === 'uber_xl') ||
      allRideOptions[allRideOptions.length - 1] ||
      null,
    [allRideOptions]
  );

  const savingsVsUberXl = useMemo(() => {
    if (!selectedRide || !uberXlOption) return 0;
    const diff = uberXlOption.price - selectedRide.price;
    return diff > 0 ? Number(diff.toFixed(2)) : 0;
  }, [selectedRide, uberXlOption]);

  const hourlyForecast = useMemo(() => {
    if (activeDistanceKm <= 0) return [];
    return getHourlyFareForecast(
      'Uber',
      city,
      activeDistanceKm,
      activeDurationMin,
      liveWeather?.upcomingSlotMultipliers
    );
  }, [city, activeDistanceKm, activeDurationMin, liveWeather]);

  // AI price insight
  useEffect(() => {
    if (baseDistanceKm <= 0 || allRideOptions.length === 0) return;

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

      const sortedByPrice = [...allRideOptions].sort(
        (a, b) => a.price - b.price
      );
      const topQuoteSummary = sortedByPrice
        .slice(0, 4)
        .map((q) => `${q.providerName} ${q.productName}: ₹${q.price}`)
        .join(', ');

      const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
      const proxyUrl =
        process.env.EXPO_PUBLIC_AI_PROXY_URL ||
        'https://faresnap-ondc-bap-gateway.onrender.com/proxy/ai-insight';

      if (!proxyUrl && (!apiKey || apiKey === 'your_groq_api_key_here')) {
        setAiInsight(buildLocalFallbackInsight(surgeStatus, sortedByPrice[0]));
        setAiLoading(false);
        return;
      }

      try {
        setAiLoading(true);
        const promptBody = {
          model: 'openai/gpt-oss-120b',
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
        };

        let data: any = null;

        // 1. Try backend AI proxy first (fast 2.5s timeout so mobile devices outside LAN don't hang)
        if (proxyUrl) {
          try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 2500);
            const proxyRes = await fetch(proxyUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(promptBody),
              signal: ctrl.signal,
            });
            clearTimeout(timer);
            if (proxyRes.ok) {
              data = await proxyRes.json();
            }
          } catch {}
        }

        // 2. Fallback to direct Groq API when on a standalone phone APK away from local proxy
        if (!data && apiKey && apiKey !== 'your_groq_api_key_here') {
          const directRes = await fetch(
            'https://api.groq.com/openai/v1/chat/completions',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify(promptBody),
            }
          );
          if (directRes.ok) {
            data = await directRes.json();
          }
        }

        const text = data?.choices?.[0]?.message?.content;
        if (!text) throw new Error('Empty response');
        const clean = text.replace(/```json|```/g, '').trim();
        setAiInsight(JSON.parse(clean));
      } catch {
        setAiInsight(buildLocalFallbackInsight(surgeStatus, sortedByPrice[0]));
      } finally {
        setAiLoading(false);
      }
    };
    fetchAiInsight();
  }, [
    city,
    baseDistanceKm,
    baseDurationMin,
    pickup.address,
    destination.address,
    allRideOptions,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && pendingBookRideRef.current) {
        pendingBookRideRef.current = null;
        setBookingPhase('completed');
      }
    });
    return () => subscription.remove();
  }, []);

  // Countdown timer for "Wait 15m to Save" surge drop alert
  useEffect(() => {
    if (surgeTimerSeconds === null) return;
    if (surgeTimerSeconds <= 0) {
      setSurgeTimerSeconds(null);
      return;
    }
    const timer = setInterval(() => {
      setSurgeTimerSeconds((prev) =>
        prev !== null && prev > 0 ? prev - 1 : null
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [surgeTimerSeconds]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Launch either In-WebView Authenticated Session Checkout, Direct Namma Yatri API, OR Native Deep Link
  const handleConfirmRideBooking = async (
    mode: 'native_app' | 'in_app_webview'
  ) => {
    if (!selectedRide) return;

    setConfirmRideSheetVisible(false);

    const tripMeta = {
      pickup:
        smartPickupEnabled && smartPickup
          ? smartPickup.pickupLabel
          : pickup.address,
      destination: destination.address,
      providerName: selectedRide.providerName,
      productName: selectedRide.productName,
      category: selectedRide.category,
      distanceKm: activeDistanceKm,
      pricePaid: selectedRide.price,
    };

    if (mode === 'in_app_webview' && selectedRide.linkId) {
      // If Namma Yatri has a live estimateId from api.moving.tech, trigger direct select2 booking
      if (
        selectedRide.linkId === 'namma_yatri' &&
        selectedRide.estimateId
      ) {
        setBookingPhase('finding');
        const updatedSavings = await recordTripSavings(
          savingsVsUberXl,
          tripMeta
        );
        setLifetimeSavings(updatedSavings);
        const nyBooked = await bookNammaYatriEstimate(selectedRide.estimateId);
        if (nyBooked.booked) {
          setBookingPhase('confirmed');
          setTimeout(() => setBookingPhase('completed'), 1800);
          return;
        }
      }

      const updatedSavings = await recordTripSavings(savingsVsUberXl, tripMeta);
      setLifetimeSavings(updatedSavings);
      setLinkModalInitialProvider(selectedRide.linkId);
      setLinkModalAutoBookProduct(selectedRide.productName);
      setLinkModalVisible(true);
      return;
    }

    setBookingPhase('finding');
    const updatedSavings = await recordTripSavings(savingsVsUberXl, tripMeta);
    setLifetimeSavings(updatedSavings);

    setTimeout(() => {
      setBookingPhase('confirmed');
    }, 850);

    setTimeout(async () => {
      pendingBookRideRef.current = selectedRide;
      try {
        const res = await openRideApp(selectedRide.providerName, {
          pickupCoords: activePickupCoords,
          dropCoords: resolvedDropCoords,
          pickupAddress:
            smartPickupEnabled && smartPickup
              ? smartPickup.pickupLabel
              : pickup.address,
          dropAddress: destination.address,
        });
        setCopiedDestToast(res.copiedAddress || null);
      } catch {}

      setTimeout(() => {
        if (pendingBookRideRef.current) {
          pendingBookRideRef.current = null;
          setBookingPhase('completed');
        }
      }, 1400);
    }, 1750);
  };

  const handleShareSavings = async () => {
    try {
      await Share.share({
        message: `I just saved ₹${lifetimeSavings.lastTripSaved} on my ride using FareSnap (₹${lifetimeSavings.totalSaved} saved across ${lifetimeSavings.tripCount} trips)! 🚗💸`,
      });
    } catch {}
  };

  const handleOptionalFareReport = async () => {
    const parsed = parseFloat(fareInput.trim());
    if (!isNaN(parsed) && parsed > 0 && selectedRide) {
      try {
        await Promise.all([
          reportFare({
            app: selectedRide.providerName,
            city,
            pickup_area: pickup.address.split(',')[0].trim(),
            distance_km: activeDistanceKm,
            quoted_fare: parsed,
            app_version: '1.0.0',
          }),
          recordFieldCalibrationSample({
            city,
            providerName: selectedRide.providerName,
            estimatedFare: selectedRide.price,
            actualFare: parsed,
          }).then((updatedMap) => setFieldCalibration(updatedMap)),
        ]);
      } catch {}
    }
    setFareInput('');
    setBookingPhase('idle');
  };

  const linkedCount = Object.values(linkedProviders).filter(Boolean).length;
  const expiredProviders = (
    Object.keys(providerAuthExpired) as LinkableProviderId[]
  ).filter((id) => linkedProviders[id] && providerAuthExpired[id]);

  if (routeError) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Compare Rides',
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#0f172a', fontWeight: '700' },
            headerTintColor: '#0f172a',
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
            title: 'Compare Rides',
            headerStyle: { backgroundColor: '#ffffff' },
            headerTitleStyle: { color: '#0f172a', fontWeight: '700' },
            headerTintColor: '#0f172a',
          }}
        />
        <View style={styles.skeletonScreen}>
          {[1, 2, 3].map((n) => (
            <Animated.View
              key={`top_${n}`}
              style={[styles.skeletonRowCard, { opacity: pulseAnim }]}
            >
              <View style={styles.skeletonCircle} />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={styles.skeletonBarShort} />
                <View style={styles.skeletonBarTiny} />
              </View>
              <View style={styles.skeletonPriceBox} />
            </Animated.View>
          ))}

          <View style={styles.findingCenterCard}>
            <View style={styles.findingCarCircle}>
              <Text style={styles.findingCarEmoji}>🚕</Text>
            </View>
            <Text style={styles.findingTitle}>
              Finding nearby rides around{'\n'}you...
            </Text>
          </View>

          {[1, 2].map((n) => (
            <Animated.View
              key={`bot_${n}`}
              style={[styles.skeletonRowCard, { opacity: pulseAnim }]}
            >
              <View style={styles.skeletonCircle} />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={styles.skeletonBarShort} />
                <View style={styles.skeletonBarTiny} />
              </View>
              <View style={styles.skeletonPriceBox} />
            </Animated.View>
          ))}
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Compare Rides',
          headerStyle: { backgroundColor: '#ffffff' },
          headerTitleStyle: { color: '#0f172a', fontWeight: '700' },
          headerTintColor: '#0f172a',
          headerShadowVisible: false,
          headerRight: () => (
            <View style={styles.headerRightRow}>
              <TouchableOpacity
                style={styles.headerLinkBtn}
                onPress={async () => {
                  if (commutePinned) {
                    await saveCommuteRoute(null);
                    setCommutePinned(false);
                    Alert.alert(
                      'Commute Unpinned',
                      'This route has been removed from your daily Commute Guard.'
                    );
                  } else {
                    await saveCommuteRoute({
                      pickup: pickup.address,
                      destination: destination.address,
                      pickupLat: resolvedPickupCoords?.lat ?? pickup.lat,
                      pickupLng: resolvedPickupCoords?.lng ?? pickup.lng,
                      destLat: resolvedDropCoords?.lat ?? destination.lat,
                      destLng: resolvedDropCoords?.lng ?? destination.lng,
                      updatedAt: Date.now(),
                    });
                    setCommutePinned(true);
                    Alert.alert(
                      'Commute Pinned',
                      '📌 Saved to Commute Guard! FareSnap will monitor live traffic, rain, and surge pricing for this route on your home screen.'
                    );
                  }
                }}
              >
                <Text style={styles.headerLinkBtnText}>
                  {commutePinned ? '📌 Pinned' : '📌 Pin'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerLinkBtn}
                onPress={() => {
                  setLinkModalInitialProvider(null);
                  setLinkModalAutoBookProduct(undefined);
                  setLinkModalVisible(true);
                }}
              >
                <Text style={styles.headerLinkBtnText}>🔌 {linkedCount}/4</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerCloseCircle}
                onPress={() => router.replace('/')}
              >
                <Text style={styles.headerCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {/* Offscreen Background WebView Scraper Pool for Linked Providers */}
      <LiveFareScraperPool
        linkedMap={linkedProviders}
        pickupLat={activePickupCoords?.lat}
        pickupLng={activePickupCoords?.lng}
        pickupAddress={
          smartPickupEnabled && smartPickup
            ? smartPickup.pickupLabel
            : pickup.address
        }
        dropLat={resolvedDropCoords?.lat}
        dropLng={resolvedDropCoords?.lng}
        dropAddress={destination.address}
        onLiveProductsScraped={(providerId, products) => {
          setScrapedLiveProducts((prev) => ({
            ...prev,
            [providerId]: products,
          }));
          setProviderAuthExpired((prev) => ({
            ...prev,
            [providerId]: false,
          }));

          // Automatically contribute intercepted live fare to Waze-style community pool
          if (products.length > 0 && activeDistanceKm > 0) {
            const primary = products[0];
            reportFare({
              app: primary.providerName,
              city,
              pickup_area: pickup.address.split(',')[0].trim(),
              distance_km: activeDistanceKm,
              quoted_fare: primary.price,
              app_version: '1.0.0',
            }).catch(() => {});
          }
        }}
        onAuthStatusDetected={(providerId, isLoggedIn) => {
          if (!isLoggedIn) {
            setProviderAuthExpired((prev) => ({
              ...prev,
              [providerId]: true,
            }));
          }
        }}
      />

      <View style={styles.container}>
        {/* Top Controls Panel */}
        <View style={styles.topControlsPanel}>
          <View style={styles.pickupPrefHeaderRow}>
            <Text style={styles.pickupPrefLabel}>Pickup Preference</Text>
            <TouchableOpacity
              onPress={() => setRouteMapModalVisible(true)}
              activeOpacity={0.75}
            >
              <Text style={styles.routeDistancePill}>
                🗺️ {cityLabel} · {activeDistanceKm} km (~{activeDurationMin}m
                {intersectionCount > 0 ? ` · ${intersectionCount} signals` : ''})
                {liveWeather ? ` · ${liveWeather.conditionLabel}` : ''} ›
              </Text>
            </TouchableOpacity>
          </View>

          {/* Segmented Control 1: Current Location vs Smart Pickup */}
          <View style={styles.segmentedGroup}>
            <TouchableOpacity
              style={[
                styles.segmentedItem,
                !smartPickupEnabled && styles.segmentedItemActive,
              ]}
              onPress={() => setSmartPickupEnabled(false)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.segmentedText,
                  !smartPickupEnabled && styles.segmentedTextActive,
                ]}
              >
                Current Location
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentedItem,
                smartPickupEnabled && styles.segmentedItemActive,
              ]}
              onPress={() => {
                if (smartPickup) {
                  setSmartPickupEnabled(true);
                }
              }}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.segmentedText,
                  smartPickupEnabled && styles.segmentedTextActive,
                ]}
              >
                Smart Pickup
                {smartPickup ? ` (-₹${smartPickup.estimatedSavings})` : ''}
              </Text>
            </TouchableOpacity>
          </View>

          {smartPickupEnabled && smartPickup && (
            <View style={styles.smartPickupSubBanner}>
              <Text style={styles.smartPickupSubText} numberOfLines={1}>
                🚶 Walk {smartPickup.walkMeters}m ({smartPickup.walkMinutes}m · 🔥{' '}
                {smartPickup.caloriesBurned} kcal) to {smartPickup.pickupLabel}
              </Text>
              <View style={styles.smartPickupActionRow}>
                <TouchableOpacity
                  style={styles.smartMapMiniBtn}
                  onPress={() => setRouteMapModalVisible(true)}
                >
                  <Text style={styles.smartMapMiniBtnText}>🗺️ View Map</Text>
                </TouchableOpacity>
                {resolvedPickupCoords && (
                  <TouchableOpacity
                    style={styles.smartMapMiniBtn}
                    onPress={() =>
                      openWalkingDirections(
                        resolvedPickupCoords,
                        smartPickup.pickupCoords
                      )
                    }
                  >
                    <Text style={styles.smartMapMiniBtnText}>
                      🧭 Walk Directions
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Prompt to link apps or re-authenticate expired WebView sessions */}
          {linkedCount === 0 ? (
            <TouchableOpacity
              style={styles.linkBannerPrompt}
              onPress={() => {
                setLinkModalInitialProvider(null);
                setLinkModalAutoBookProduct(undefined);
                setLinkModalVisible(true);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.linkBannerText}>
                🔌 Link Uber, Ola or Rapido to stream live personal fares ›
              </Text>
            </TouchableOpacity>
          ) : expiredProviders.length > 0 ? (
            <TouchableOpacity
              style={styles.expiredBannerPrompt}
              onPress={() => {
                setLinkModalInitialProvider(expiredProviders[0]);
                setLinkModalAutoBookProduct(undefined);
                setLinkModalVisible(true);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.expiredBannerText}>
                ⚠️ Sign-in required in WebView for{' '}
                {expiredProviders.join(', ').toUpperCase()} — Tap to log in ›
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Segmented Control 2: All | Bike | Auto | Cab */}
          <View style={[styles.segmentedGroup, { marginTop: 10 }]}>
            {(['All', 'Bike', 'Auto', 'Cab'] as RideCategoryTab[]).map(
              (tab) => {
                const active = selectedCategory === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[
                      styles.segmentedItem,
                      active && styles.segmentedItemActive,
                    ]}
                    onPress={() => setSelectedCategory(tab)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.segmentedText,
                        active && styles.segmentedTextActive,
                      ]}
                    >
                      {tab}
                    </Text>
                  </TouchableOpacity>
                );
              }
            )}
          </View>

          {/* Sort Header Row: Type | ETA ⇅ | ₹ ↓ Fare ⇅ */}
          <View style={styles.sortHeaderBar}>
            <View style={styles.sortColLeft}>
              <Text style={styles.sortHeaderLabel}>🚗 Type</Text>
            </View>
            <TouchableOpacity
              style={styles.sortColCenter}
              onPress={() => toggleSort('eta')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.sortHeaderLabel,
                  sortField === 'eta' && styles.sortHeaderLabelActive,
                ]}
              >
                🕒 {sortField === 'eta' ? (sortOrder === 'asc' ? '↓ ' : '↑ ') : ''}
                ETA ⇅
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sortColRight}
              onPress={() => toggleSort('fare')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.sortHeaderLabel,
                  sortField === 'fare' && styles.sortHeaderLabelActive,
                ]}
              >
                ₹ {sortField === 'fare' ? (sortOrder === 'asc' ? '↓ ' : '↑ ') : ''}
                Fare ⇅
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Scrollable Flat Ride Option Cards */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {displayedOptions.map((item, idx) => {
            const isSelected = selectedRide?.id === item.id;
            const isExpanded = expandedRideId === item.id;
            const isCheapest =
              idx === 0 && sortField === 'fare' && sortOrder === 'asc';
            const providerKey = (item.providerName || '').toLowerCase();
            const isAccountLinked =
              (providerKey.includes('uber') && linkedProviders.uber) ||
              (providerKey.includes('ola') && linkedProviders.ola) ||
              (providerKey.includes('rapido') && linkedProviders.rapido) ||
              ((providerKey.includes('namma') || providerKey.includes('ondc')) && linkedProviders.namma_yatri);

            return (
              <View key={item.id}>
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => setSelectedRideId(item.id)}
                  style={[
                    styles.rideOptionCard,
                    isSelected && styles.rideOptionCardSelected,
                  ]}
                >
                  <View style={styles.rideOptionMainRow}>
                    <View style={styles.vehicleIconBox}>
                      <Text style={styles.vehicleEmojiText}>
                        {item.vehicleEmoji}
                      </Text>
                    </View>

                    <View style={styles.rideOptionInfo}>
                      <View style={styles.productTitleRow}>
                        <View
                          style={[
                            styles.brandCircle,
                            { backgroundColor: item.providerBadgeBg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.brandCircleText,
                              { color: item.providerBadgeColor },
                            ]}
                            numberOfLines={1}
                          >
                            {item.providerBadgeText}
                          </Text>
                        </View>
                        <Text style={styles.productTitleText}>
                          {item.productName}
                        </Text>
                        {isCheapest && (
                          <View style={styles.bestMiniPill}>
                            <Text style={styles.bestMiniPillText}>BEST</Text>
                          </View>
                        )}
                        {isAccountLinked && (
                          <View style={styles.linkedMiniPill}>
                            <Text style={styles.linkedMiniPillText}>⚡ LINKED</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.etaSubRow}>
                        <Text style={styles.etaClockIcon}>🕒</Text>
                        <Text style={styles.etaSubText}>
                          {item.etaMinutes !== null
                            ? `${item.etaMinutes} min`
                            : 'N/A min'}
                        </Text>
                        {item.sourceKind === 'live_scraped' ? (
                          <Text style={styles.liveDotLabel}>· 🟢 LIVE</Text>
                        ) : item.sourceKind === 'ondc_live' ? (
                          <Text style={styles.liveDotLabel}>· 🟢 ONDC Live</Text>
                        ) : item.sourceKind === 'community_verified' ? (
                          <Text style={styles.liveDotLabel}>· 👥 Verified</Text>
                        ) : (
                          <Text style={styles.estDotLabel}>· Est.</Text>
                        )}
                        <TouchableOpacity
                          onPress={() =>
                            setExpandedRideId(isExpanded ? null : item.id)
                          }
                          style={styles.detailsToggleBtn}
                        >
                          <Text style={styles.detailsToggleText}>
                            {isExpanded ? 'Hide ▲' : 'Details ▼'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.priceRightCol}>
                      <Text style={styles.priceMainText}>
                        <Text style={styles.rupeeSuperscript}>₹</Text>
                        {item.price}
                      </Text>
                      {item.isSurge && (
                        <Text style={styles.surgeMicroText}>⚡ Surge</Text>
                      )}
                    </View>
                  </View>

                  {isExpanded && (
                    <View style={styles.breakdownDrawer}>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Base Fare</Text>
                        <Text style={styles.breakdownVal}>
                          ₹{item.breakdown.baseFare}
                        </Text>
                      </View>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>
                          Distance ({activeDistanceKm} km)
                        </Text>
                        <Text style={styles.breakdownVal}>
                          ₹{item.breakdown.distanceFare}
                        </Text>
                      </View>
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>
                          Ride Duration (~{activeDurationMin} mins)
                        </Text>
                        <Text style={styles.breakdownVal}>
                          ₹{item.breakdown.timeFare}
                        </Text>
                      </View>
                      {item.breakdown.geofenceFee > 0 && (
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>
                            Pickup Zone / Toll Fee
                          </Text>
                          <Text style={styles.breakdownVal}>
                            +₹{item.breakdown.geofenceFee}
                          </Text>
                        </View>
                      )}
                      <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Surge</Text>
                        <Text
                          style={[
                            styles.breakdownVal,
                            item.breakdown.surgeAmount > 0
                              ? { color: '#dc2626' }
                              : { color: '#16a34a' },
                          ]}
                        >
                          {item.breakdown.surgeAmount > 0
                            ? `+₹${item.breakdown.surgeAmount} (${item.breakdown.surgeMultiplier}x)`
                            : '₹0 (No Surge)'}
                        </Text>
                      </View>
                      {item.breakdown.recommendedBid && (
                        <Text style={styles.bidRecommendText}>
                          💡 Recommended quick-acceptance offer: ₹
                          {item.breakdown.recommendedBid}
                        </Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>

                {idx === 1 && (
                  <TouchableOpacity
                    style={styles.aiCard}
                    onPress={() => setAiCollapsed(!aiCollapsed)}
                    activeOpacity={0.9}
                  >
                    <View style={styles.aiCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.aiCardTitle}>
                          🤖 AI Price Sense & 60m Forecast
                        </Text>
                        {liveWeather?.rainRadarAdvice ? (
                          <Text style={styles.rainRadarBannerText}>
                            {liveWeather.rainRadarAdvice}
                          </Text>
                        ) : !aiLoading && aiInsight ? (
                          <Text style={styles.aiConfidence}>
                            {aiInsight.advice}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={styles.aiChevron}>
                        {aiCollapsed ? '›' : '‹'}
                      </Text>
                    </View>
                    {!aiCollapsed && hourlyForecast.length > 0 && (
                      <>
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
                        {(() => {
                          const nowFare = hourlyForecast[0]?.estimatedFare ?? 0;
                          const minFuture = Math.min(
                            ...hourlyForecast
                              .slice(1)
                              .map((p) => p.estimatedFare)
                          );
                          const potentialSave = Math.round(nowFare - minFuture);
                          if (potentialSave <= 5 && surgeTimerSeconds === null) {
                            return null;
                          }
                          return (
                            <TouchableOpacity
                              style={styles.surgeTimerBtn}
                              onPress={() =>
                                setSurgeTimerSeconds(
                                  surgeTimerSeconds !== null ? null : 15 * 60
                                )
                              }
                            >
                              <Text style={styles.surgeTimerBtnText}>
                                {surgeTimerSeconds !== null
                                  ? `⏱️ Surge Drop Timer: ${Math.floor(
                                      surgeTimerSeconds / 60
                                    )}:${String(
                                      surgeTimerSeconds % 60
                                    ).padStart(2, '0')} remaining (Tap to stop)`
                                  : `⏱️ Wait 15m to Save ~₹${potentialSave} (Start Surge Timer)`}
                              </Text>
                            </TouchableOpacity>
                          );
                        })()}
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {idx === 2 && metroCombo && (
                  <View style={styles.metroComboCard}>
                    <View style={styles.metroComboHeader}>
                      <Text style={styles.metroComboBadge}>
                        🚇 BEAT TRAFFIC · {metroCombo.metroNetworkName.toUpperCase()}
                      </Text>
                      <Text style={styles.metroComboSavingsPill}>
                        Save ₹{metroCombo.savingsVsCab}
                      </Text>
                    </View>
                    <Text style={styles.metroComboTitle}>
                      Auto + Metro Split Route · ₹{metroCombo.totalComboFare} (~
                      {metroCombo.totalComboMinutes} mins)
                    </Text>
                    <Text style={styles.metroComboLegs}>
                      🛺 ₹{metroCombo.firstMileFare} to {metroCombo.originStationName}{' '}
                      → 🚇 ₹{metroCombo.metroFare} ({metroCombo.metroMinutes}m) to{' '}
                      {metroCombo.destStationName} → 🛺 ₹{metroCombo.lastMileFare}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}

          <View style={{ height: 80 + Math.max(insets.bottom, 24) }} />
        </ScrollView>

        {/* Sticky Bottom "Book Ride" Bar */}
        <View
          style={[
            styles.stickyBottomBar,
            {
              paddingBottom:
                14 + Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0),
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.bookRidePrimaryBtn,
              !selectedRide && styles.bookRidePrimaryBtnDisabled,
            ]}
            disabled={!selectedRide}
            onPress={() => setConfirmRideSheetVisible(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.bookRidePrimaryText}>
              {selectedRide
                ? `Book ${selectedRide.providerName} ${selectedRide.productName} · ₹${selectedRide.price}`
                : 'Book Ride'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* BuyHatke Sheet 1: "Confirm your ride" */}
      <Modal
        visible={confirmRideSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setConfirmRideSheetVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <View
            style={[
              styles.confirmSheet,
              { paddingBottom: Math.max(insets.bottom + 20, 30) },
            ]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Confirm your ride</Text>
            <Text style={styles.sheetRouteMeta}>
              ~{activeDurationMin} Mins | {activeDistanceKm} KM
            </Text>

            <View style={styles.sheetRoutePill}>
              <Text style={styles.sheetRoutePillText} numberOfLines={1}>
                📍{' '}
                {(smartPickupEnabled && smartPickup
                  ? smartPickup.pickupLabel
                  : pickup.address
                ).split(',')[0]}{' '}
                → {destination.address.split(',')[0]}
              </Text>
            </View>

            {savingsVsUberXl > 0 && (
              <Text style={styles.sheetSavingsCallout}>
                You&apos;re{' '}
                <Text style={styles.sheetSavingsGreen}>
                  saving ₹{savingsVsUberXl}
                </Text>{' '}
                compared to Uber UberXL
              </Text>
            )}

            {selectedRide && (
              <View style={styles.selectedRideBox}>
                <Text style={styles.selectedRideEmoji}>
                  {selectedRide.vehicleEmoji}
                </Text>
                <Text style={styles.selectedRideName}>
                  {selectedRide.productName}
                </Text>
                <View
                  style={[
                    styles.brandCircle,
                    { backgroundColor: selectedRide.providerBadgeBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.brandCircleText,
                      { color: selectedRide.providerBadgeColor },
                    ]}
                  >
                    {selectedRide.providerBadgeText}
                  </Text>
                </View>
                <Text style={styles.selectedRideProviderLabel}>
                  {selectedRide.providerName}
                </Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.selectedRideEta}>
                  🕒 {selectedRide.etaMinutes ?? 5} min
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.paymentSelectorRow}
              onPress={() => {
                setConfirmRideSheetVisible(false);
                setPaymentSheetVisible(true);
              }}
            >
              <Text style={styles.paymentSelectorLabel}>
                Payment:{' '}
                {PAYMENT_OPTIONS.find((p) => p.id === selectedPaymentId)?.label}
              </Text>
              <Text style={styles.paymentChangeLink}>Change ›</Text>
            </TouchableOpacity>

            <View style={styles.estimatedPriceRow}>
              <Text style={styles.estimatedPriceLabel}>
                {selectedRide?.sourceKind === 'live_scraped'
                  ? 'Live Session Price'
                  : 'Estimated Price'}
              </Text>
              <Text style={styles.estimatedPriceValue}>
                ₹{selectedRide?.price ?? 0}
              </Text>
            </View>

            {selectedRide?.linkId && Platform.OS !== 'web' && (
              <TouchableOpacity
                style={styles.inAppWebViewBookBtn}
                onPress={() => handleConfirmRideBooking('in_app_webview')}
              >
                <Text style={styles.inAppWebViewBookText}>
                  ⚡ Book Inside FareSnap WebView ({selectedRide.providerName})
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.sheetButtonsRow}>
              <TouchableOpacity
                style={styles.sheetCancelBtn}
                onPress={() => setConfirmRideSheetVisible(false)}
              >
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sheetConfirmBlackBtn}
                onPress={() => handleConfirmRideBooking('native_app')}
              >
                <Text style={styles.sheetConfirmWhiteText}>
                  Open {selectedRide?.providerName || 'App'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* BuyHatke Sheet 2: "Payment Options" */}
      <Modal
        visible={paymentSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setPaymentSheetVisible(false);
          setConfirmRideSheetVisible(true);
        }}
      >
        <View style={styles.sheetOverlay}>
          <View
            style={[
              styles.confirmSheet,
              { paddingBottom: Math.max(insets.bottom + 20, 30) },
            ]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Payment Options</Text>

            <TouchableOpacity
              style={styles.paymentOptionCard}
              onPress={() => setUberCashEnabled(!uberCashEnabled)}
            >
              <View style={[styles.brandCircle, { backgroundColor: '#000' }]}>
                <Text style={[styles.brandCircleText, { color: '#fff' }]}>
                  {selectedRide?.providerBadgeText || 'App'}
                </Text>
              </View>
              <Text style={styles.paymentOptionTitle}>
                {selectedRide?.providerName || 'App'} Cash: ₹0.00
              </Text>
              <View
                style={[
                  styles.toggleTrack,
                  uberCashEnabled && styles.toggleTrackActive,
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    uberCashEnabled && styles.toggleThumbActive,
                  ]}
                />
              </View>
            </TouchableOpacity>

            {PAYMENT_OPTIONS.map((opt) => {
              const active = selectedPaymentId === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.paymentOptionCard,
                    active && styles.paymentOptionCardActive,
                  ]}
                  onPress={() => setSelectedPaymentId(opt.id)}
                >
                  <View style={styles.paymentIconBox}>
                    <Text style={styles.paymentIconText}>{opt.icon}</Text>
                  </View>
                  <Text style={styles.paymentOptionTitle}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}

            {monetization.enabled && (
              <TouchableOpacity
                style={styles.upiRewardBannerBtn}
                onPress={() =>
                  openPartnerOffer(
                    'payment_sheet_upi_reward',
                    monetization.upiRewardTitle,
                    monetization.upiReferralUrl
                  )
                }
              >
                <Text style={styles.upiRewardBannerText}>
                  {monetization.upiRewardTitle}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.sheetConfirmBlackBtn, { marginTop: 12 }]}
              onPress={() => {
                setPaymentSheetVisible(false);
                setConfirmRideSheetVisible(true);
              }}
            >
              <Text style={styles.sheetConfirmWhiteText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* BuyHatke Sheet 3: "Finding your ride" -> "Pickup in 2 Min" -> "Ride Completed" */}
      <Modal
        visible={bookingPhase !== 'idle'}
        transparent
        animationType="fade"
        onRequestClose={() => setBookingPhase('idle')}
      >
        <KeyboardAvoidingView
          style={styles.sheetOverlay}
          behavior={Platform.OS === 'android' ? 'height' : 'padding'}
        >
          <View
            style={[
              styles.confirmSheet,
              { paddingBottom: Math.max(insets.bottom + 20, 30) },
            ]}
          >
            <View style={styles.sheetHandle} />

            {bookingPhase === 'finding' && (
              <View style={styles.phaseCenterBox}>
                <Text style={styles.sheetTitle}>Finding your ride</Text>
                <View style={styles.progressBarTrack}>
                  <View style={styles.progressBarFill} />
                </View>
                <Text style={styles.phaseBigCarEmoji}>🚕</Text>
                <Text style={styles.phaseHeading}>
                  Surfacing the best-rated{'\n'}drivers...
                </Text>
                <Text style={styles.sheetRouteMeta}>
                  To {destination.address.split(',')[0]} · ~{activeDurationMin}{' '}
                  Mins | {activeDistanceKm} KM
                </Text>
                {copiedDestToast && (
                  <View style={styles.clipboardToastPill}>
                    <Text style={styles.clipboardToastText}>
                      📋 Copied &quot;{copiedDestToast}&quot; to clipboard — just paste in{' '}
                      {selectedRide?.providerName}!
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[
                    styles.sheetCancelBtn,
                    { width: '100%', marginTop: 20 },
                  ]}
                  onPress={() => setBookingPhase('idle')}
                >
                  <Text style={styles.sheetCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {bookingPhase === 'confirmed' && (
              <View style={styles.phaseCenterBox}>
                <Text style={styles.sheetTitle}>
                  Pickup in {selectedRide?.etaMinutes ?? 3} Min
                </Text>
                <View style={styles.confirmedGreenCircle}>
                  <Text style={styles.confirmedGreenCheck}>✓</Text>
                </View>
                <Text style={styles.phaseBigCarEmoji}>🚕</Text>
                <Text style={styles.confirmedBigTitle}>
                  Your ride has been{'\n'}confirmed
                </Text>
              </View>
            )}

            {bookingPhase === 'completed' && (
              <View style={styles.phaseCenterBox}>
                <Text style={styles.sheetTitle}>Ride Completed</Text>
                <Text style={styles.completedSavedHero}>
                  You&apos;ve{' '}
                  <Text style={styles.completedSavedGreen}>
                    saved{'\n'}₹{lifetimeSavings.lastTripSaved}
                  </Text>{' '}
                  on this trip!
                </Text>

                <Text style={styles.completedTotalHero}>
                  <Text style={styles.completedSavedGreen}>
                    ₹{lifetimeSavings.totalSaved.toLocaleString('en-IN')} total
                  </Text>{' '}
                  from{'\n'}
                  {lifetimeSavings.tripCount}{' '}
                  {lifetimeSavings.tripCount === 1 ? 'trip' : 'trips'} 🤩
                </Text>

                <TextInput
                  style={styles.optionalFareInput}
                  keyboardType="numeric"
                  maxLength={5}
                  placeholder={`Optional: Enter exact ₹ seen in ${
                    selectedRide?.providerName ?? 'app'
                  }`}
                  placeholderTextColor="#94a3b8"
                  value={fareInput}
                  onChangeText={setFareInput}
                />

                {monetization.enabled && (
                  <TouchableOpacity
                    style={styles.upiRewardBannerBtn}
                    onPress={() =>
                      openPartnerOffer(
                        'post_ride_partner_perk',
                        monetization.postRidePerkTitle,
                        monetization.postRidePerkUrl
                      )
                    }
                  >
                    <Text style={styles.upiRewardBannerText}>
                      {monetization.postRidePerkTitle}
                    </Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.shareFriendsLabel}>
                  Share with your friends
                </Text>

                <View style={styles.completedActionsRow}>
                  <TouchableOpacity
                    style={styles.skipNowBtn}
                    onPress={handleOptionalFareReport}
                  >
                    <Text style={styles.skipNowBtnText}>
                      {fareInput.trim() ? 'Submit & Done' : 'Skip for now'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.whatsappShareCircle}
                    onPress={handleShareSavings}
                  >
                    <Text style={styles.shareCircleText}>💬</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.indigoShareCircle}
                    onPress={handleShareSavings}
                  >
                    <Text style={styles.shareCircleText}>🔗</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Interactive Route & Smart Pickup Walking Map Modal */}
      {resolvedPickupCoords && resolvedDropCoords && (
        <RoutePreviewMapModal
          visible={routeMapModalVisible}
          originCoords={resolvedPickupCoords}
          smartPickupCoords={smartPickup?.pickupCoords}
          smartPickupLabel={smartPickup?.pickupLabel}
          walkMeters={smartPickup?.walkMeters}
          destCoords={resolvedDropCoords}
          onClose={() => setRouteMapModalVisible(false)}
        />
      )}

      {/* BuyHatke Link Apps & In-WebView Booking Modal */}
      <LinkAppsModal
        visible={linkModalVisible}
        linkedMap={linkedProviders}
        initialProviderId={linkModalInitialProvider}
        routeOpts={
          activePickupCoords && resolvedDropCoords
            ? {
                pickupLat: activePickupCoords.lat,
                pickupLng: activePickupCoords.lng,
                pickupAddress:
                  smartPickupEnabled && smartPickup
                    ? smartPickup.pickupLabel
                    : pickup.address,
                dropLat: resolvedDropCoords.lat,
                dropLng: resolvedDropCoords.lng,
                dropAddress: destination.address,
                autoSelectProduct: linkModalAutoBookProduct,
              }
            : undefined
        }
        onToggleLink={async (id, linked) => {
          const next = await setProviderLinked(id, linked);
          setLinkedProviders(next);
          if (linked) {
            setProviderAuthExpired((prev) => ({ ...prev, [id]: false }));
          }
        }}
        onLiveProductsScraped={(providerId, products) => {
          setScrapedLiveProducts((prev) => ({
            ...prev,
            [providerId]: products,
          }));
          setProviderAuthExpired((prev) => ({
            ...prev,
            [providerId]: false,
          }));
        }}
        onClose={() => {
          const wasBooking = Boolean(linkModalAutoBookProduct);
          setLinkModalVisible(false);
          setLinkModalInitialProvider(null);
          setLinkModalAutoBookProduct(undefined);
          if (wasBooking) {
            setBookingPhase('completed');
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLinkBtn: {
    backgroundColor: '#eef2ff',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  headerLinkBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4338ca',
  },
  headerCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCloseText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },

  // Skeleton Screen
  skeletonScreen: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
    justifyContent: 'center',
    gap: 12,
  },
  skeletonRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  skeletonCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e2e8f0',
  },
  skeletonBarShort: {
    width: 90,
    height: 14,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  skeletonBarTiny: {
    width: 70,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  skeletonPriceBox: {
    width: 56,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  findingCenterCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  findingCarCircle: {
    width: 110,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  findingCarEmoji: {
    fontSize: 44,
  },
  findingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
    lineHeight: 28,
  },

  // Top Controls Panel
  topControlsPanel: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  pickupPrefHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pickupPrefLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  routeDistancePill: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4338ca',
  },
  segmentedGroup: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    overflow: 'hidden',
  },
  segmentedItem: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
  },
  segmentedItemActive: {
    backgroundColor: '#e0e7ff',
  },
  segmentedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  segmentedTextActive: {
    color: '#312e81',
    fontWeight: '700',
  },
  smartPickupSubBanner: {
    backgroundColor: '#dcfce7',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  smartPickupSubText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  smartPickupActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  smartMapMiniBtn: {
    backgroundColor: '#ffffff',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  smartMapMiniBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },
  surgeTimerBtn: {
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    alignItems: 'center',
  },
  surgeTimerBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338ca',
  },
  clipboardToastPill: {
    marginTop: 10,
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  clipboardToastText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1d4ed8',
    textAlign: 'center',
  },
  upiRewardBannerBtn: {
    width: '100%',
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 10,
    alignItems: 'center',
  },
  upiRewardBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
    textAlign: 'center',
  },
  linkBannerPrompt: {
    backgroundColor: '#eef2ff',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  linkBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4338ca',
    textAlign: 'center',
  },
  expiredBannerPrompt: {
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  expiredBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
    textAlign: 'center',
  },
  sortHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    marginTop: 4,
  },
  sortColLeft: {
    width: 90,
  },
  sortColCenter: {
    flex: 1,
  },
  sortColRight: {
    width: 90,
    alignItems: 'flex-end',
  },
  sortHeaderLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  sortHeaderLabelActive: {
    color: '#0f172a',
    fontWeight: '700',
  },

  // Ride Option Cards
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  rideOptionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
  },
  rideOptionCardSelected: {
    borderColor: '#4338ca',
    backgroundColor: '#fafaff',
  },
  rideOptionMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleIconBox: {
    width: 58,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  vehicleEmojiText: {
    fontSize: 34,
  },
  rideOptionInfo: {
    flex: 1,
  },
  productTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  brandCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  brandCircleText: {
    fontSize: 8,
    fontWeight: '800',
  },
  productTitleText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  bestMiniPill: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bestMiniPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803d',
  },
  linkedMiniPill: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 5,
  },
  linkedMiniPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1d4ed8',
    letterSpacing: 0.3,
  },
  etaSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  etaClockIcon: {
    fontSize: 12,
  },
  etaSubText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  liveDotLabel: {
    fontSize: 11,
    color: '#16a34a',
    fontWeight: '700',
  },
  estDotLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  detailsToggleBtn: {
    marginLeft: 6,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  detailsToggleText: {
    fontSize: 11,
    color: '#4338ca',
    fontWeight: '600',
  },
  priceRightCol: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  priceMainText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  rupeeSuperscript: {
    fontSize: 14,
    fontWeight: '600',
  },
  surgeMicroText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#dc2626',
    marginTop: 2,
  },
  breakdownDrawer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  breakdownVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  bidRecommendText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4338ca',
    marginTop: 6,
  },

  // Inline AI & 60m Forecast Card
  aiCard: {
    backgroundColor: '#eef2ff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  aiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aiCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#312e81',
  },
  aiConfidence: {
    fontSize: 12,
    color: '#4338ca',
    marginTop: 2,
  },
  rainRadarBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b45309',
    marginTop: 3,
  },
  metroComboCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  metroComboHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metroComboBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803d',
    letterSpacing: 0.4,
  },
  metroComboSavingsPill: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  metroComboTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 3,
  },
  metroComboLegs: {
    fontSize: 12,
    color: '#166534',
    lineHeight: 17,
  },
  aiChevron: {
    fontSize: 20,
    color: '#4338ca',
  },
  forecastStrip: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  forecastSlot: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e7ff',
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
    color: '#312e81',
    marginTop: 2,
  },
  forecastPriceLabelBest: {
    color: '#15803d',
  },

  // Sticky Bottom "Book Ride" Bar
  stickyBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  bookRidePrimaryBtn: {
    backgroundColor: '#4338ca',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  bookRidePrimaryBtnDisabled: {
    backgroundColor: '#e2e8f0',
  },
  bookRidePrimaryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Bottom Sheets
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  confirmSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 30,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#94a3b8',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  sheetRouteMeta: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 14,
  },
  sheetRoutePill: {
    backgroundColor: '#f1f5f9',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginBottom: 14,
  },
  sheetRoutePillText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  sheetSavingsCallout: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  sheetSavingsGreen: {
    color: '#10b981',
    fontWeight: '700',
  },
  selectedRideBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 18,
    padding: 18,
    gap: 10,
    marginBottom: 14,
  },
  selectedRideEmoji: {
    fontSize: 32,
    marginRight: 4,
  },
  selectedRideName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginRight: 6,
  },
  selectedRideProviderLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  selectedRideEta: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  paymentSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  paymentSelectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  paymentChangeLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4338ca',
  },
  estimatedPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  estimatedPriceLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  estimatedPriceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  inAppWebViewBookBtn: {
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 24,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 12,
  },
  inAppWebViewBookText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4338ca',
  },
  sheetButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sheetCancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
  },
  sheetCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  sheetConfirmBlackBtn: {
    flex: 1,
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
  },
  sheetConfirmWhiteText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Payment Options Sheet
  paymentOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  paymentOptionCardActive: {
    borderColor: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  paymentIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentIconText: {
    fontSize: 16,
    fontWeight: '700',
  },
  paymentOptionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    padding: 2,
  },
  toggleTrackActive: {
    backgroundColor: '#10b981',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },

  // Booking Phase & Ride Completed Savings
  phaseCenterBox: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  progressBarTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 2,
    marginVertical: 14,
    overflow: 'hidden',
  },
  progressBarFill: {
    width: '35%',
    height: '100%',
    backgroundColor: '#818cf8',
  },
  phaseBigCarEmoji: {
    fontSize: 64,
    marginVertical: 16,
  },
  phaseHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 28,
  },
  confirmedGreenCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  confirmedGreenCheck: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
  },
  confirmedBigTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    lineHeight: 36,
  },
  completedSavedHero: {
    fontSize: 28,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 36,
  },
  completedSavedGreen: {
    color: '#10b981',
    fontWeight: '800',
  },
  completedTotalHero: {
    fontSize: 26,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
    marginTop: 22,
    marginBottom: 18,
    lineHeight: 34,
  },
  optionalFareInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 13,
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 16,
  },
  shareFriendsLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 14,
  },
  completedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    justifyContent: 'center',
  },
  skipNowBtn: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 28,
  },
  skipNowBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  whatsappShareCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indigoShareCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareCircleText: {
    fontSize: 22,
    color: '#ffffff',
  },

  // Error State
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
    backgroundColor: '#4338ca',
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
