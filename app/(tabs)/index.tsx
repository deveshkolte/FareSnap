import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Animated,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CommuteGuardStatus,
  evaluateCommuteGuard,
} from '../../utils/commuteGuard';
import {
  getLifetimeSavings,
  LifetimeSavingsData,
} from '../../utils/liveSessionBridge';

type RouteHistoryItem = {
  pickup: string;
  destination: string;
  pickupLat?: number;
  pickupLng?: number;
  destLat?: number;
  destLng?: number;
  timestamp: number;
};

const SLIDES = [
  {
    emoji: '🚗',
    title: 'Compare all ride apps',
    subtitle: 'See prices from Uber, Ola, Rapido, Namma Yatri and 5 more — all in one place.',
  },
  {
    emoji: '💰',
    title: 'Save money every ride',
    subtitle: 'Know the cheapest option before you book. No more guessing or switching apps.',
  },
  {
    emoji: '🤖',
    title: 'AI-powered insights',
    subtitle: 'Get real-time fare predictions and the best time to book based on surge patterns.',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [recentRoutes, setRecentRoutes] = useState<RouteHistoryItem[]>([]);
  const [commuteGuard, setCommuteGuard] = useState<CommuteGuardStatus | null>(
    null
  );
  const [savings, setSavings] = useState<LifetimeSavingsData>({
    totalSaved: 0,
    tripCount: 0,
    lastTripSaved: 0,
  });

  // Home screen fade in
  const [homeFade] = useState(() => new Animated.Value(0));
  const [homeSlide] = useState(() => new Animated.Value(30));

  // Onboarding slide animation
  const [slideX] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const check = async () => {
      try {
        const [onboarded, rawHistory, lifeSavings] = await Promise.all([
          AsyncStorage.getItem('faresnap_onboarded'),
          AsyncStorage.getItem('faresnap_route_history'),
          getLifetimeSavings(),
        ]);
        setShowOnboarding(!onboarded);
        let parsedHistory: RouteHistoryItem[] = [];
        if (rawHistory) {
          parsedHistory = JSON.parse(rawHistory);
          setRecentRoutes(parsedHistory);
        }
        setSavings(lifeSavings);
        const topFallback = parsedHistory[0]
          ? {
              pickup: parsedHistory[0].pickup,
              destination: parsedHistory[0].destination,
              pickupLat: parsedHistory[0].pickupLat,
              pickupLng: parsedHistory[0].pickupLng,
              destLat: parsedHistory[0].destLat,
              destLng: parsedHistory[0].destLng,
              updatedAt: parsedHistory[0].timestamp,
            }
          : undefined;
        evaluateCommuteGuard(topFallback)
          .then((cg) => setCommuteGuard(cg))
          .catch(() => {});
      } catch {
        setShowOnboarding(false);
      }
    };
    check();
  }, []);

  // Keep onboarding slide aligned if screen dimensions change (e.g., rotation/split-screen)
  useEffect(() => {
    slideX.setValue(-width * currentIndex);
  }, [width, currentIndex, slideX]);

  // Animate home screen in when onboarding finishes
  useEffect(() => {
    if (showOnboarding === false) {
      homeFade.setValue(0);
      homeSlide.setValue(30);
      Animated.parallel([
        Animated.timing(homeFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(homeSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [showOnboarding, homeFade, homeSlide]);

  const handleFinish = async () => {
    await AsyncStorage.setItem('faresnap_onboarded', 'true');
    setShowOnboarding(false);
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      // Slide out current to left, slide in next from right
      Animated.timing(slideX, {
        toValue: -width * nextIndex,
        duration: 350,
        useNativeDriver: true,
      }).start();
      setCurrentIndex(nextIndex);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      Animated.timing(slideX, {
        toValue: -width * prevIndex,
        duration: 350,
        useNativeDriver: true,
      }).start();
      setCurrentIndex(prevIndex);
    }
  };

  if (showOnboarding === null) {
    return <View style={styles.container} />;
  }

  if (showOnboarding) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <StatusBar barStyle="dark-content" />

        {/* Skip */}
        <TouchableOpacity style={styles.skipButton} onPress={handleFinish}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        {/* Slides container — all 3 slides laid out horizontally, animated */}
        <View style={styles.slidesWrapper}>
          <Animated.View
            style={[
              styles.slidesTrack,
              { width: width * SLIDES.length, transform: [{ translateX: slideX }] },
            ]}
          >
            {SLIDES.map((slide, i) => (
              <View key={i} style={[styles.slide, { width }]}>
                <View style={styles.emojiContainer}>
                  <Text style={styles.onboardEmoji}>{slide.emoji}</Text>
                </View>
                <Text style={styles.onboardTitle}>{slide.title}</Text>
                <Text style={styles.onboardSubtitle}>{slide.subtitle}</Text>
              </View>
            ))}
          </Animated.View>
        </View>

        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => {
              Animated.timing(slideX, {
                toValue: -width * i,
                duration: 350,
                useNativeDriver: true,
              }).start();
              setCurrentIndex(i);
            }}>
              <View style={[styles.dot, currentIndex === i && styles.dotActive]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Buttons row */}
        <View style={styles.buttonRow}>
          {currentIndex > 0 ? (
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.backButtonPlaceholder} />
          )}
          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>
              {currentIndex === SLIDES.length - 1 ? 'Get started' : 'Next →'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Home screen
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.scrollHomeContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={[
            styles.homeContent,
            { opacity: homeFade, transform: [{ translateY: homeSlide }] },
          ]}
        >
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🚗</Text>
          </View>
          <Text style={styles.appName}>FareSnap</Text>
          <Text style={styles.appTagline}>Compare all ride apps instantly</Text>
        </View>

        <View style={styles.featurePills}>
          {['9 ride apps', 'AI insights', 'Free to use'].map((label) => (
            <View key={label} style={styles.featurePill}>
              <Text style={styles.featurePillText}>{label}</Text>
            </View>
          ))}
        </View>

        {savings.totalSaved > 0 && (
          <TouchableOpacity
            style={styles.savingsBanner}
            onPress={() => router.push('/spend' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.savingsBannerText}>
              💰 You&apos;ve saved ₹{savings.totalSaved.toLocaleString('en-IN')}{' '}
              across {savings.tripCount}{' '}
              {savings.tripCount === 1 ? 'ride' : 'rides'} ›
            </Text>
          </TouchableOpacity>
        )}

        {/* Commute Guard Proactive Alert Card */}
        {commuteGuard && (
          <TouchableOpacity
            style={[
              styles.commuteGuardCard,
              commuteGuard.isAlert && styles.commuteGuardCardAlert,
            ]}
            onPress={() =>
              router.push({
                pathname: '/results',
                params: {
                  pickup: JSON.stringify({
                    address: commuteGuard.route.pickup,
                    lat: commuteGuard.route.pickupLat,
                    lng: commuteGuard.route.pickupLng,
                  }),
                  destination: JSON.stringify({
                    address: commuteGuard.route.destination,
                    lat: commuteGuard.route.destLat,
                    lng: commuteGuard.route.destLng,
                  }),
                },
              })
            }
            activeOpacity={0.85}
          >
            <Text style={styles.commuteGuardHeadline} numberOfLines={1}>
              {commuteGuard.headline}
            </Text>
            <Text style={styles.commuteGuardSub} numberOfLines={2}>
              {commuteGuard.subline}
            </Text>
          </TouchableOpacity>
        )}

        {/* Instant Where To Search Bar */}
        <TouchableOpacity
          style={styles.searchTriggerBox}
          onPress={() => router.push('/location')}
          activeOpacity={0.85}
        >
          <Text style={styles.searchTriggerIcon}>🔍</Text>
          <Text style={styles.searchTriggerPlaceholder}>
            Where to? Enter pickup & drop...
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/location')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Compare rides</Text>
        </TouchableOpacity>

        {recentRoutes.length > 0 ? (
          <View style={styles.recentHomeSection}>
            <Text style={styles.recentHomeLabel}>1-Tap Recent Routes</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentScrollRow}
            >
              {recentRoutes.slice(0, 4).map((r, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.recentChip}
                  onPress={() =>
                    router.push({
                      pathname: '/results',
                      params: {
                        pickup: JSON.stringify({
                          address: r.pickup,
                          lat: r.pickupLat,
                          lng: r.pickupLng,
                        }),
                        destination: JSON.stringify({
                          address: r.destination,
                          lat: r.destLat,
                          lng: r.destLng,
                        }),
                      },
                    })
                  }
                  activeOpacity={0.8}
                >
                  <Text style={styles.recentChipTitle} numberOfLines={1}>
                    {r.pickup.split(',')[0]} → {r.destination.split(',')[0]}
                  </Text>
                  <Text style={styles.recentChipSub}>Tap to compare ›</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : (
          <Text style={styles.homeHint}>
            Enter pickup and drop to compare fares across all apps
          </Text>
        )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  // Onboarding
  skipButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },

  // Slides
  slidesWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  slidesTrack: {
    flexDirection: 'row',
    flex: 1,
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  emojiContainer: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  onboardEmoji: {
    fontSize: 48,
  },
  onboardTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: -0.5,
  },
  onboardSubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 26,
  },

  // Dots
  dots: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#2563eb',
  },

  // Button row
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 24,
    gap: 12,
  },
  backButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  backButtonPlaceholder: {
    width: 80,
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },

  // Shared
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 24,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },

  // Home screen
  scrollHomeContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 20,
  },
  homeContent: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  logoEmoji: {
    fontSize: 40,
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  appTagline: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
  featurePills: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 28,
  },
  featurePill: {
    backgroundColor: '#eff6ff',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  featurePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  savingsBanner: {
    alignSelf: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginTop: -24,
    marginBottom: 20,
  },
  savingsBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803d',
  },
  commuteGuardCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 24,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  commuteGuardCardAlert: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  commuteGuardHeadline: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  commuteGuardSub: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
    lineHeight: 16,
  },
  searchTriggerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 24,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    gap: 10,
  },
  searchTriggerIcon: {
    fontSize: 16,
  },
  searchTriggerPlaceholder: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
  recentHomeSection: {
    marginTop: 4,
  },
  recentHomeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 24,
    marginBottom: 8,
  },
  recentScrollRow: {
    paddingHorizontal: 24,
    gap: 10,
  },
  recentChip: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxWidth: 210,
  },
  recentChipTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  recentChipSub: {
    fontSize: 11,
    color: '#2563eb',
    fontWeight: '600',
    marginTop: 2,
  },
  homeHint: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});