import * as Haptics from 'expo-haptics';
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

const PROVIDER_INFO: Record<
  LinkableProviderId,
  {
    name: string;
    subtitle: string;
    badgeBg: string;
    badgeColor: string;
    badgeText: string;
  }
> = {
  uber: {
    name: 'Uber',
    subtitle: 'Personal surge & 1-tap booking',
    badgeBg: '#0f172a',
    badgeColor: '#ffffff',
    badgeText: 'Uber',
  },
  ola: {
    name: 'Ola',
    subtitle: 'Personal surge & 1-tap booking',
    badgeBg: '#16a34a',
    badgeColor: '#ffffff',
    badgeText: 'OLA',
  },
  rapido: {
    name: 'Rapido',
    subtitle: 'Bike taxi & auto rates',
    badgeBg: '#facc15',
    badgeColor: '#0f172a',
    badgeText: 'rapido',
  },
  namma_yatri: {
    name: 'Namma Yatri (ONDC)',
    subtitle: 'Zero-commission driver network',
    badgeBg: '#f59e0b',
    badgeColor: '#0f172a',
    badgeText: 'NY',
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

  const handleConnectPress = (id: LinkableProviderId) => {
    setActiveModalProvider(id);
    setLinkModalVisible(true);
  };

  const handleDisconnectPress = (id: LinkableProviderId, name: string) => {
    Alert.alert(
      `Disconnect ${name}?`,
      'Your saved session will be removed from this phone. You will still see live estimated fares.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await setProviderLinked(id, false);
            setLinkedMap((prev) => ({ ...prev, [id]: false }));
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          },
        },
      ]
    );
  };

  const handleProceed = () => {
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
          title: 'Connect Ride Apps',
          headerStyle: { backgroundColor: '#ffffff' },
          headerTintColor: '#0f172a',
          headerTitleStyle: { color: '#0f172a', fontWeight: '700', fontSize: 17 },
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity
              onPress={handleProceed}
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
          {/* Header Typography */}
          <View style={styles.headerBlock}>
            <Text style={styles.heading}>Connect Ride Apps</Text>
            <Text style={styles.subheading}>
              Link your accounts for live personal surge & 1-tap booking, or skip to use instant estimates.
            </Text>
          </View>

          {/* Real-time Connection Status Indicator */}
          <View
            style={[
              styles.statusBanner,
              linkedCount > 0 ? styles.statusBannerLinked : styles.statusBannerUnlinked,
            ]}
          >
            <Text
              style={[
                styles.statusBannerText,
                linkedCount > 0 ? styles.statusTextLinked : styles.statusTextUnlinked,
              ]}
            >
              {linkedCount > 0
                ? `🟢 ${linkedCount} of 4 ride accounts connected · Live account pricing active`
                : '⚡ 0 connected · Using live ONDC network & calibrated city fares'}
            </Text>
          </View>

          {/* Grouped Minimal List Card */}
          <View style={styles.groupedCard}>
            {LINKABLE_PROVIDERS.map((provider, index) => {
              const isLinked = Boolean(linkedMap[provider.id]);
              const info = PROVIDER_INFO[provider.id];
              const isLast = index === LINKABLE_PROVIDERS.length - 1;

              return (
                <View
                  key={provider.id}
                  style={[
                    styles.providerRow,
                    isLinked && styles.providerRowLinked,
                    !isLast && styles.providerRowBorder,
                  ]}
                >
                  {/* Brand Badge with overlay checkmark if linked */}
                  <View style={styles.brandBadgeWrapper}>
                    <View style={[styles.brandBadge, { backgroundColor: info.badgeBg }]}>
                      <Text style={[styles.brandBadgeText, { color: info.badgeColor }]}>
                        {info.badgeText}
                      </Text>
                    </View>
                    {isLinked && (
                      <View style={styles.badgeCheckDot}>
                        <Text style={styles.badgeCheckDotText}>✓</Text>
                      </View>
                    )}
                  </View>

                  {/* Provider Info */}
                  <View style={styles.providerInfoCol}>
                    <View style={styles.providerTitleRow}>
                      <Text style={styles.providerName}>{info.name}</Text>
                      {isLinked && (
                        <View style={styles.activePillTag}>
                          <Text style={styles.activePillDot}>●</Text>
                          <Text style={styles.activePillText}>CONNECTED</Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.providerSubtitle,
                        isLinked && styles.providerSubtitleLinked,
                      ]}
                      numberOfLines={1}
                    >
                      {isLinked
                        ? '✓ Live account linked · Exact surge active'
                        : info.subtitle}
                    </Text>
                  </View>

                  {/* Action Pill */}
                  {isLinked ? (
                    <TouchableOpacity
                      style={styles.connectedPill}
                      onPress={() => handleDisconnectPress(provider.id, info.name)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.connectedPillText}>Linked ✓</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.connectPill}
                      onPress={() => handleConnectPress(provider.id)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.connectPillText}>+ Connect</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          {/* Minimal Privacy Note */}
          <Text style={styles.privacyNote}>
            🔒 Logins stay securely on your device · Never sent to external servers
          </Text>
        </ScrollView>

        {/* Sticky Clean Bottom Action Bar */}
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
            style={styles.continueBtn}
            onPress={handleProceed}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>
              {linkedCount > 0
                ? `Continue with ${linkedCount} Connected App${linkedCount > 1 ? 's' : ''} →`
                : 'Continue with Live Estimates →'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleProceed}
            activeOpacity={0.7}
          >
            <Text style={styles.skipBtnText}>Skip for now · Use Live Estimates</Text>
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
          if (linked) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
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
    padding: 20,
  },

  // Header Text
  headerBlock: {
    marginTop: 6,
    marginBottom: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  subheading: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 6,
    lineHeight: 20,
  },

  // Status Banner
  statusBanner: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  statusBannerLinked: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  statusBannerUnlinked: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  statusBannerText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusTextLinked: {
    color: '#15803d',
  },
  statusTextUnlinked: {
    color: '#1e40af',
  },

  // Grouped Card
  groupedCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    backgroundColor: '#ffffff',
  },
  providerRowLinked: {
    backgroundColor: '#f8fdf9',
  },
  providerRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  brandBadgeWrapper: {
    position: 'relative',
  },
  brandBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  badgeCheckDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#16a34a',
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCheckDotText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  providerInfoCol: {
    flex: 1,
  },
  providerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  activePillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activePillDot: {
    fontSize: 7,
    color: '#15803d',
  },
  activePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803d',
    letterSpacing: 0.4,
  },
  providerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  providerSubtitleLinked: {
    color: '#15803d',
    fontWeight: '600',
  },

  // Action Pills
  connectPill: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectPillText: {
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

  // Privacy Note
  privacyNote: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 18,
    fontWeight: '500',
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
  continueBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  continueBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  skipBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
});
