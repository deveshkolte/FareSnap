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

  const handleConnectPress = (id: LinkableProviderId) => {
    setActiveModalProvider(id);
    setLinkModalVisible(true);
  };

  const handleDisconnectPress = (id: LinkableProviderId, name: string) => {
    Alert.alert(
      `Disconnect ${name}?`,
      'Your saved session will be removed from this phone. You will still see estimated fares.',
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
                    !isLast && styles.providerRowBorder,
                  ]}
                >
                  {/* Brand Badge */}
                  <View style={[styles.brandBadge, { backgroundColor: info.badgeBg }]}>
                    <Text style={[styles.brandBadgeText, { color: info.badgeColor }]}>
                      {info.badgeText}
                    </Text>
                  </View>

                  {/* Provider Info */}
                  <View style={styles.providerInfoCol}>
                    <Text style={styles.providerName}>{info.name}</Text>
                    <Text style={styles.providerSubtitle}>{info.subtitle}</Text>
                  </View>

                  {/* Action Pill */}
                  {isLinked ? (
                    <TouchableOpacity
                      style={styles.connectedPill}
                      onPress={() => handleDisconnectPress(provider.id, info.name)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.connectedPillText}>Connected ✓</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.connectPill}
                      onPress={() => handleConnectPress(provider.id)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.connectPillText}>Connect</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          {/* Minimal Privacy Note */}
          <Text style={styles.privacyNote}>
            🔒 Logins stay securely on your device · Never shared
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
            <Text style={styles.continueBtnText}>Continue →</Text>
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
    marginTop: 8,
    marginBottom: 20,
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

  // Grouped Card (iOS Settings / Modern Clean Style)
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
  },
  providerRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
  providerInfoCol: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  providerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },

  // Action Pills
  connectPill: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingVertical: 7,
    paddingHorizontal: 16,
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
    fontSize: 16,
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
