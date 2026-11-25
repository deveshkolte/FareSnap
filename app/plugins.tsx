import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinkAppsModal } from '../components/LinkAppsModal';
import {
  getLinkedProviders,
  LINKABLE_PROVIDERS,
  LinkableProviderId,
  setProviderLinked,
} from '../utils/liveSessionBridge';

const PROVIDER_METAS: Record<
  LinkableProviderId,
  {
    tagline: string;
    features: string[];
    badgeBg: string;
    badgeText: string;
    badgeColor: string;
  }
> = {
  uber: {
    tagline: 'Uber Go, Auto, Moto, Premier & XL',
    features: ['Real surge pricing from your account', 'Direct 1-tap in-app booking session'],
    badgeBg: '#0f172a',
    badgeText: 'Uber',
    badgeColor: '#ffffff',
  },
  ola: {
    tagline: 'Ola Mini, Prime, Auto & Bike',
    features: ['Live surge multiplier verification', 'Web session bridge for fast booking'],
    badgeBg: '#16a34a',
    badgeText: 'OLA',
    badgeColor: '#ffffff',
  },
  rapido: {
    tagline: 'Rapido Bike Taxi, Auto & Economy Cab',
    features: ['Fastest 2-wheeler price comparison', 'Real-time fare scraper bridge'],
    badgeBg: '#facc15',
    badgeText: 'rapido',
    badgeColor: '#0f172a',
  },
  namma_yatri: {
    tagline: 'Zero-Commission Driver Direct API & ONDC',
    features: ['100% fare goes to driver (zero surge cut)', 'Direct OTP link via Moving Tech API'],
    badgeBg: '#f59e0b',
    badgeText: 'NY · ONDC',
    badgeColor: '#0f172a',
  },
};

export default function PluginsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { from } = useLocalSearchParams<{ from?: string }>();

  const [linkedMap, setLinkedMap] = useState<Record<LinkableProviderId, boolean>>({
    uber: false,
    rapido: false,
    ola: false,
    namma_yatri: false,
  });

  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [activeModalProvider, setActiveModalProvider] =
    useState<LinkableProviderId | null>(null);

  const loadLinkedStatus = useCallback(async () => {
    try {
      const current = await getLinkedProviders();
      setLinkedMap(current);
    } catch {}
  }, []);

  useEffect(() => {
    loadLinkedStatus();
  }, [loadLinkedStatus]);

  const linkedCount = Object.values(linkedMap).filter(Boolean).length;
  const progressPercent = Math.round((linkedCount / 4) * 100);

  const handleConnectPress = (id: LinkableProviderId) => {
    setActiveModalProvider(id);
    setLinkModalVisible(true);
  };

  const handleDisconnectPress = (id: LinkableProviderId, name: string) => {
    Alert.alert(
      `Disconnect ${name}?`,
      'Your saved session will be removed from this device. You will still get live estimated fares via our fallback engine.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await setProviderLinked(id, false);
            setLinkedMap((prev) => ({ ...prev, [id]: false }));
          },
        },
      ]
    );
  };

  const handleContinue = () => {
    if (from === 'location' && router.canGoBack()) {
      router.back();
    } else {
      router.push('/location');
    }
  };

  const handleSkip = () => {
    if (from === 'location' && router.canGoBack()) {
      router.back();
    } else {
      router.push('/location');
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Connect Ride Plugins',
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#0f172a',
          headerTitleStyle: { color: '#0f172a', fontWeight: '700', fontSize: 17 },
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSkip}
              style={styles.headerSkipBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.headerSkipText}>Skip →</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 110 + Math.max(insets.bottom, 24) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Banner matching App Theme */}
          <View style={styles.heroBanner}>
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroIconCircle}>
                <Text style={styles.heroIconText}>🔌</Text>
              </View>
              <View style={styles.heroTextCol}>
                <Text style={styles.heroTitle}>Unlock Real-Time Booking</Text>
                <Text style={styles.heroSubtitle}>
                  Log in once to fetch exact personal surge prices & enable 1-tap booking.
                </Text>
              </View>
            </View>

            {/* Connection Tracker Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>
                  {linkedCount === 0
                    ? 'No plugins connected yet'
                    : `${linkedCount} of 4 ride plugins connected`}
                </Text>
                <Text style={styles.progressPercent}>{progressPercent}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.max(6, progressPercent)}%`,
                      backgroundColor: linkedCount > 0 ? '#16a34a' : '#2563eb',
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* Fallback Approach Banner (Matches Commute Guard & Info styling in index.tsx) */}
          <View style={styles.fallbackNoticeBox}>
            <View style={styles.fallbackHeaderRow}>
              <Text style={styles.fallbackBoltIcon}>⚡</Text>
              <Text style={styles.fallbackNoticeTitle}>
                Skip anytime — Smart Fallback Active
              </Text>
            </View>
            <Text style={styles.fallbackNoticeText}>
              Don&apos;t have an account or don&apos;t want to log in? No problem. If you skip,
              FareSnap automatically runs our live ONDC network gateway, AI calibrated city fares,
              and direct native app deep-links. You still get full price comparison without connecting.
            </Text>
          </View>

          {/* Section Header */}
          <Text style={styles.sectionHeader}>Available Ride Plugins</Text>

          {/* Provider Cards */}
          {LINKABLE_PROVIDERS.map((provider) => {
            const isLinked = Boolean(linkedMap[provider.id]);
            const meta = PROVIDER_METAS[provider.id];

            return (
              <View key={provider.id} style={styles.pluginCard}>
                <View style={styles.cardHeaderRow}>
                  <View style={[styles.brandBadge, { backgroundColor: meta.badgeBg }]}>
                    <Text style={[styles.brandBadgeText, { color: meta.badgeColor }]}>
                      {meta.badgeText}
                    </Text>
                  </View>
                  <View style={styles.cardTitleCol}>
                    <Text style={styles.cardTitle}>{provider.name}</Text>
                    <Text style={styles.cardTagline} numberOfLines={1}>
                      {meta.tagline}
                    </Text>
                  </View>
                  {isLinked ? (
                    <TouchableOpacity
                      style={styles.connectedPill}
                      onPress={() => handleDisconnectPress(provider.id, provider.name)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.connectedPillText}>Connected ✓</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.connectCtaBtn}
                      onPress={() => handleConnectPress(provider.id)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.connectCtaText}>Connect +</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Feature Bullet Points */}
                <View style={styles.cardFeaturesList}>
                  {meta.features.map((feat, idx) => (
                    <View key={idx} style={styles.featureItemRow}>
                      <Text style={styles.featureBullet}>✓</Text>
                      <Text style={styles.featureItemText}>{feat}</Text>
                    </View>
                  ))}
                </View>

                {isLinked && (
                  <View style={styles.linkedFooterRow}>
                    <View style={styles.activeDotRow}>
                      <View style={styles.greenDot} />
                      <Text style={styles.sessionActiveText}>Session active on this device</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDisconnectPress(provider.id, provider.name)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.disconnectLinkText}>Disconnect</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}

          {/* Privacy & Security Shield Guarantee */}
          <View style={styles.privacyShieldCard}>
            <Text style={styles.privacyShieldEmoji}>🛡️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.privacyShieldTitle}>100% On-Device Privacy Guarantee</Text>
              <Text style={styles.privacyShieldText}>
                Your login sessions, cookies, and OTP tokens stay strictly inside your phone&apos;s
                local encrypted storage. FareSnap never transmits credentials to any external
                cloud server.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Sticky Bottom Action Bar with responsive safe area clearance */}
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
            style={styles.primaryContinueBtn}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryContinueText}>
              {linkedCount > 0
                ? `Continue with ${linkedCount} Connected Plugin${linkedCount > 1 ? 's' : ''} →`
                : 'Continue to Enter Locations →'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondarySkipBtn}
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <Text style={styles.secondarySkipText}>
              Skip for now · Use Live Estimates & Fallback
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <LinkAppsModal
        visible={linkModalVisible}
        linkedMap={linkedMap}
        initialProviderId={activeModalProvider}
        onToggleLink={async (id, linked) => {
          await setProviderLinked(id, linked);
          setLinkedMap((prev) => ({ ...prev, [id]: linked }));
        }}
        onClose={() => {
          setLinkModalVisible(false);
          setActiveModalProvider(null);
          loadLinkedStatus();
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
  headerSkipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerSkipText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563eb',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // Hero Banner (Clean white card with subtle blue badge)
  heroBanner: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  heroIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  heroIconText: {
    fontSize: 24,
  },
  heroTextCol: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 3,
    lineHeight: 18,
  },

  // Progress Bar
  progressContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563eb',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Fallback Notice Box (Matches app Commute Guard info card)
  fallbackNoticeBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  fallbackHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  fallbackBoltIcon: {
    fontSize: 14,
  },
  fallbackNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e40af',
  },
  fallbackNoticeText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },

  // Section Header (Matches index.tsx and location.tsx)
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
    marginLeft: 4,
  },

  // Plugin Cards (Clean white surfaces, clear typography)
  pluginCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardTitleCol: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardTagline: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },

  // Connect / Connected buttons
  connectCtaBtn: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectCtaText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
  },
  connectedPill: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectedPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803d',
  },

  // Feature Points
  cardFeaturesList: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  featureItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureBullet: {
    fontSize: 12,
    fontWeight: '700',
    color: '#16a34a',
  },
  featureItemText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
    flex: 1,
  },

  // Connected Footer
  linkedFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  activeDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16a34a',
  },
  sessionActiveText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#15803d',
  },
  disconnectLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
  },

  // Privacy Shield Card
  privacyShieldCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  privacyShieldEmoji: {
    fontSize: 22,
    marginTop: 1,
  },
  privacyShieldTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  privacyShieldText: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
  },

  // Sticky Bottom Bar
  stickyBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingTop: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 10,
  },
  primaryContinueBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryContinueText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondarySkipBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondarySkipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
});
