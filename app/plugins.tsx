import { Stack, useRouter } from 'expo-router';
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
    badgeBg: '#000000',
    badgeText: 'Uber',
    badgeColor: '#ffffff',
  },
  ola: {
    tagline: 'Ola Mini, Prime, Auto & Bike',
    features: ['Live surge multiplier verification', 'Web session bridge for quick booking'],
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
    features: ['100% fare goes to driver (no surge cut)', 'Direct OTP link via Moving Tech API'],
    badgeBg: '#f59e0b',
    badgeText: 'NY / ONDC',
    badgeColor: '#0f172a',
  },
};

export default function PluginsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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

  const handleConnectPress = (id: LinkableProviderId) => {
    setActiveModalProvider(id);
    setLinkModalVisible(true);
  };

  const handleDisconnectPress = (id: LinkableProviderId, name: string) => {
    Alert.alert(
      `Disconnect ${name}?`,
      'Your saved session will be removed from this device. You will still get estimated fares.',
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
    router.push('/location');
  };

  const handleSkip = () => {
    router.push('/location');
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Connect Ride Plugins',
          headerStyle: { backgroundColor: '#000000' },
          headerTintColor: '#ffffff',
          headerTitleStyle: { color: '#ffffff', fontWeight: '700' },
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity onPress={handleSkip} style={styles.headerSkipBtn}>
              <Text style={styles.headerSkipText}>Skip →</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.container}>
        <StatusBar barStyle="light-content" />

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 110 + Math.max(insets.bottom, 24) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Hero Banner */}
          <View style={styles.heroBanner}>
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroIconCircle}>
                <Text style={styles.heroIconText}>🔌</Text>
              </View>
              <View style={styles.heroTextCol}>
                <Text style={styles.heroTitle}>Unlock Real-Time Booking</Text>
                <Text style={styles.heroSubtitle}>
                  Log in once to fetch exact personal surge prices and enable 1-tap booking.
                </Text>
              </View>
            </View>

            {/* Connection Tracker Progress */}
            <View style={styles.progressContainer}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressLabel}>
                  {linkedCount === 0
                    ? 'No plugins connected yet'
                    : `${linkedCount} of 4 ride plugins connected`}
                </Text>
                <Text style={styles.progressPercent}>{Math.round((linkedCount / 4) * 100)}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.max(8, (linkedCount / 4) * 100)}%` },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* Fallback Approach Banner (Answers user requirement directly) */}
          <View style={styles.fallbackNoticeBox}>
            <Text style={styles.fallbackNoticeTitle}>
              ⚡ Skip anytime — our Fallback Engine has your back
            </Text>
            <Text style={styles.fallbackNoticeText}>
              Don&apos;t have an account or don&apos;t want to log in? No problem. If you skip,
              FareSnap automatically runs our live ONDC network gateway, AI calibrated city fares,
              and direct app deep-links. You will still see and compare fares across all providers.
            </Text>
          </View>

          {/* Plugin Cards List */}
          <Text style={styles.sectionHeader}>Available Ride Plugins</Text>

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
                      <Text style={styles.connectedPillText}>🟢 Connected ✓</Text>
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
                    <Text style={styles.sessionActiveText}>Session active on device</Text>
                    <TouchableOpacity
                      onPress={() => handleDisconnectPress(provider.id, provider.name)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
                local encrypted storage. FareSnap never transmits your credentials to any external
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

      {/* Embedded in-app WebView OTP Session Bridge Modal */}
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
    backgroundColor: '#0f172a',
  },
  headerSkipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerSkipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#38bdf8',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
  },

  // Hero Banner
  heroBanner: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
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
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
  heroIconText: {
    fontSize: 24,
  },
  heroTextCol: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 3,
    lineHeight: 18,
  },

  // Progress Bar
  progressContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 3,
  },

  // Fallback Notice Box
  fallbackNoticeBox: {
    backgroundColor: '#1e1b4b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#4338ca',
  },
  fallbackNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#a5b4fc',
    marginBottom: 4,
  },
  fallbackNoticeText: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 18,
  },

  // Section Header
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
    marginLeft: 4,
  },

  // Plugin Cards
  pluginCard: {
    backgroundColor: '#1e293b',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
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
    letterSpacing: 0.5,
  },
  cardTitleCol: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  cardTagline: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  connectCtaBtn: {
    backgroundColor: '#4338ca',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  connectCtaText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  connectedPill: {
    backgroundColor: '#064e3b',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  connectedPillText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '700',
  },

  // Features List
  cardFeaturesList: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 6,
  },
  featureItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureBullet: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '700',
  },
  featureItemText: {
    fontSize: 12,
    color: '#cbd5e1',
  },

  linkedFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  sessionActiveText: {
    fontSize: 11,
    color: '#34d399',
    fontWeight: '500',
  },
  disconnectLinkText: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '600',
  },

  // Privacy Shield Card
  privacyShieldCard: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  privacyShieldEmoji: {
    fontSize: 24,
  },
  privacyShieldTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  privacyShieldText: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
  },

  // Sticky Bottom Bar
  stickyBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0b1120',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  primaryContinueBtn: {
    backgroundColor: '#4338ca',
    borderRadius: 28,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryContinueText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondarySkipBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  secondarySkipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
});
