import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

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
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Home screen fade in
  const homeFade = useRef(new Animated.Value(0)).current;
  const homeSlide = useRef(new Animated.Value(30)).current;

  // Onboarding slide animation
  const slideX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const check = async () => {
      try {
        const onboarded = await AsyncStorage.getItem('faresnap_onboarded');
        setShowOnboarding(!onboarded);
      } catch {
        setShowOnboarding(false);
      }
    };
    check();
  }, []);

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
  }, [showOnboarding]);

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
        <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

        {/* Skip */}
        <TouchableOpacity style={styles.skipButton} onPress={handleFinish}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        {/* Slides container — all 3 slides laid out horizontally, animated */}
        <View style={styles.slidesWrapper}>
          <Animated.View
            style={[
              styles.slidesTrack,
              { transform: [{ translateX: slideX }] },
            ]}
          >
            {SLIDES.map((slide, i) => (
              <View key={i} style={styles.slide}>
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
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

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

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/location')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>Compare rides</Text>
        </TouchableOpacity>

        <Text style={styles.homeHint}>
          Enter pickup and drop to compare fares across all apps
        </Text>
      </Animated.View>
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
    width: width * SLIDES.length,
    flex: 1,
  },
  slide: {
    width: width,
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
  homeContent: {
    flex: 1,
    justifyContent: 'center',
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  logoEmoji: {
    fontSize: 48,
  },
  appName: {
    fontSize: 40,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -1,
    marginBottom: 8,
  },
  appTagline: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  featurePills: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 48,
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
  homeHint: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});