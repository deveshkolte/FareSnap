import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import {
  buildAutoSelectVehicleScript,
  buildProviderScraperScript,
  LINKABLE_PROVIDERS,
  LinkableProviderId,
  LinkableProviderInfo,
  ScrapedLiveProduct,
  ScraperBridgeMessage,
} from '../utils/liveSessionBridge';
import {
  getStoredNammaYatriToken,
  sendNammaYatriOtp,
  setStoredNammaYatriToken,
  verifyNammaYatriOtp,
} from '../utils/nammaYatriDirectApi';

type RouteBookingOpts = {
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropLat: number;
  dropLng: number;
  dropAddress: string;
  autoSelectProduct?: string;
};

type Props = {
  visible: boolean;
  linkedMap: Record<LinkableProviderId, boolean>;
  initialProviderId?: LinkableProviderId | null;
  routeOpts?: RouteBookingOpts;
  onToggleLink: (id: LinkableProviderId, linked: boolean) => void;
  onLiveProductsScraped?: (
    providerId: LinkableProviderId,
    products: ScrapedLiveProduct[]
  ) => void;
  onClose: () => void;
};

export function LinkAppsModal({
  visible,
  linkedMap,
  initialProviderId,
  routeOpts,
  onToggleLink,
  onLiveProductsScraped,
  onClose,
}: Props) {
  const [activeWebProvider, setActiveWebProvider] =
    useState<LinkableProviderInfo | null>(null);
  const [detectedLoggedIn, setDetectedLoggedIn] = useState(false);

  // Direct API OTP state for Namma Yatri (api.moving.tech)
  const [nyPhone, setNyPhone] = useState('');
  const [nyOtp, setNyOtp] = useState('');
  const [nyAuthId, setNyAuthId] = useState<string | null>(null);
  const [nyLoading, setNyLoading] = useState(false);
  const [nyError, setNyError] = useState('');
  const [bapConnected, setBapConnected] = useState<boolean | null>(null);
  const [hasNyToken, setHasNyToken] = useState(false);

  useEffect(() => {
    if (visible && initialProviderId) {
      const found = LINKABLE_PROVIDERS.find((p) => p.id === initialProviderId);
      setActiveWebProvider(found || null);
    } else if (!visible) {
      setActiveWebProvider(null);
      setDetectedLoggedIn(false);
      setNyAuthId(null);
      setNyOtp('');
      setNyError('');
    }

    if (visible) {
      getStoredNammaYatriToken()
        .then((t) => setHasNyToken(Boolean(t)))
        .catch(() => {});
      const bapUrl = (
        process.env.EXPO_PUBLIC_ONDC_BAP_URL ||
        'https://faresnap-ondc-bap-gateway.onrender.com'
      ).replace(/\/$/, '');
      fetch(`${bapUrl}/health`)
        .then((r) => setBapConnected(r.ok))
        .catch(() => setBapConnected(false));
    }
  }, [visible, initialProviderId]);

  const handleNySendOtp = async () => {
    setNyError('');
    setNyLoading(true);
    try {
      const res = await sendNammaYatriOtp(nyPhone);
      setNyAuthId(res.authId);
    } catch (err: any) {
      setNyError(err?.message || 'Could not send OTP.');
    } finally {
      setNyLoading(false);
    }
  };

  const handleNyVerifyOtp = async () => {
    if (!nyAuthId) return;
    setNyError('');
    setNyLoading(true);
    try {
      await verifyNammaYatriOtp(nyAuthId, nyOtp);
      onToggleLink('namma_yatri', true);
      setActiveWebProvider(null);
      setNyAuthId(null);
      setNyOtp('');
    } catch (err: any) {
      setNyError(err?.message || 'Invalid OTP.');
    } finally {
      setNyLoading(false);
    }
  };

  const linkedProviders = LINKABLE_PROVIDERS.filter((p) => linkedMap[p.id]);
  const unlinkedProviders = LINKABLE_PROVIDERS.filter((p) => !linkedMap[p.id]);

  const getWebViewUrl = (provider: LinkableProviderInfo) => {
    if (routeOpts) {
      return provider.buildRouteWebUrl(routeOpts);
    }
    return provider.loginUrl;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => {
        if (activeWebProvider && !initialProviderId) {
          setActiveWebProvider(null);
        } else {
          onClose();
        }
      }}
    >
      {activeWebProvider ? (
        <View style={styles.webviewContainer}>
          <View style={styles.webviewHeader}>
            <TouchableOpacity
              onPress={() => {
                if (initialProviderId) {
                  onClose();
                } else {
                  setActiveWebProvider(null);
                }
              }}
              style={styles.closeCircle}
            >
              <Text style={styles.closeCircleText}>←</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={styles.webviewTitle}>
                {routeOpts?.autoSelectProduct
                  ? `Book ${activeWebProvider.name} (${routeOpts.autoSelectProduct})`
                  : `Link ${activeWebProvider.name}`}
              </Text>
              <Text style={styles.webviewSubtitle}>
                {detectedLoggedIn
                  ? '🟢 Active session detected on device'
                  : 'Log in once with OTP · Session stays on your device'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.doneLinkBtn}
              onPress={() => {
                onToggleLink(activeWebProvider.id, true);
                if (initialProviderId) {
                  onClose();
                } else {
                  setActiveWebProvider(null);
                }
              }}
            >
              <Text style={styles.doneLinkBtnText}>
                {routeOpts?.autoSelectProduct ? 'Done ✓' : 'Linked ✓'}
              </Text>
            </TouchableOpacity>
          </View>

          {activeWebProvider.id === 'namma_yatri' && !routeOpts?.autoSelectProduct ? (
            <View style={styles.nyOtpContainer}>
              <View style={styles.nyBrandBadge}>
                <Text style={styles.nyBrandBadgeText}>NY</Text>
              </View>
              <Text style={styles.nyTitle}>Link Namma Yatri via OTP</Text>
              <Text style={styles.nySubtitle}>
                Connects directly to Namma Yatri (api.moving.tech) for live zero-surge Auto & Cab fares.
              </Text>

              {!nyAuthId ? (
                <>
                  <TextInput
                    style={styles.nyInput}
                    keyboardType="phone-pad"
                    maxLength={10}
                    placeholder="Enter 10-digit mobile number"
                    placeholderTextColor="#94a3b8"
                    value={nyPhone}
                    onChangeText={setNyPhone}
                  />
                  {nyError ? (
                    <Text style={styles.nyErrorText}>{nyError}</Text>
                  ) : null}
                  <TouchableOpacity
                    style={styles.nyPrimaryBtn}
                    onPress={handleNySendOtp}
                    disabled={nyLoading}
                  >
                    {nyLoading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.nyPrimaryBtnText}>Send OTP →</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TextInput
                    style={styles.nyInput}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="Enter 4-digit OTP"
                    placeholderTextColor="#94a3b8"
                    value={nyOtp}
                    onChangeText={setNyOtp}
                  />
                  {nyError ? (
                    <Text style={styles.nyErrorText}>{nyError}</Text>
                  ) : null}
                  <TouchableOpacity
                    style={styles.nyPrimaryBtn}
                    onPress={handleNyVerifyOtp}
                    disabled={nyLoading}
                  >
                    {nyLoading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.nyPrimaryBtnText}>Verify & Link ✓</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ marginTop: 14 }}
                    onPress={() => {
                      setNyAuthId(null);
                      setNyOtp('');
                      setNyError('');
                    }}
                  >
                    <Text style={styles.nyChangePhoneText}>
                      Change phone number
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : Platform.OS === 'web' ? (
            <View style={styles.webBrowserFallback}>
              <Text style={styles.webFallbackTitle}>
                Connect {activeWebProvider.name}
              </Text>
              <Text style={styles.webFallbackSub}>
                In-app WebView session bridge runs on Android & iOS. Tap &quot;Linked ✓&quot; above after signing in.
              </Text>
            </View>
          ) : (
            <WebView
              source={{ uri: getWebViewUrl(activeWebProvider) }}
              injectedJavaScriptBeforeContentLoaded={buildProviderScraperScript(
                activeWebProvider.id,
                routeOpts
              )}
              injectedJavaScript={
                buildProviderScraperScript(activeWebProvider.id, routeOpts) +
                (routeOpts?.autoSelectProduct
                  ? buildAutoSelectVehicleScript(routeOpts.autoSelectProduct)
                  : '')
              }
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              userAgent="Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
              onMessage={(event) => {
                try {
                  const msg = JSON.parse(
                    event.nativeEvent.data
                  ) as ScraperBridgeMessage;
                  if (msg?.source !== 'bh-page-api') return;

                  if (
                    msg.type === 'LIVE_PRODUCTS_SCRAPED' &&
                    Array.isArray(msg.products) &&
                    msg.products.length > 0
                  ) {
                    setDetectedLoggedIn(true);
                    onToggleLink(activeWebProvider.id, true);
                    onLiveProductsScraped?.(activeWebProvider.id, msg.products);
                  } else if (msg.type === 'AUTH_STATUS') {
                    setDetectedLoggedIn(msg.isLoggedIn);
                  }
                } catch {}
              }}
              style={{ flex: 1 }}
            />
          )}
        </View>
      ) : (
        <View style={styles.container}>
          <View style={styles.topBar}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={styles.closeCircle} onPress={onClose}>
              <Text style={styles.closeCircleText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.heroTitle}>Compare & Book Rides</Text>
            <Text style={styles.heroSubtitle}>in just 3 steps</Text>

            <View style={styles.stepsRow}>
              <Text style={styles.stepText}>🔌 Link</Text>
              <Text style={styles.stepArrow}>→</Text>
              <Text style={styles.stepText}>🚕 Compare</Text>
              <Text style={styles.stepArrow}>→</Text>
              <Text style={styles.stepText}>✅ Book</Text>
            </View>

            <View style={styles.shieldBox}>
              <Text style={styles.shieldEmoji}>🛡️</Text>
              <Text style={styles.shieldText}>
                Your data is 100% safe. Session cookies & OTP tokens stay strictly on your device and are never stored on any external server.
              </Text>
            </View>

            {/* Live Bridge Health Diagnostics */}
            <View style={styles.diagCard}>
              <Text style={styles.diagTitle}>Live Bridge Status</Text>
              <View style={styles.diagRow}>
                <Text style={styles.diagLabel}>ONDC BAP & AI Gateway</Text>
                <Text
                  style={[
                    styles.diagBadge,
                    bapConnected ? styles.diagGreen : styles.diagMuted,
                  ]}
                >
                  {bapConnected ? '🟢 Connected' : '⚪ Local Fallback'}
                </Text>
              </View>
              <View style={styles.diagRow}>
                <Text style={styles.diagLabel}>Namma Yatri Direct API</Text>
                <Text
                  style={[
                    styles.diagBadge,
                    hasNyToken ? styles.diagGreen : styles.diagBlue,
                  ]}
                >
                  {hasNyToken ? '🟢 Token Active' : '🔑 Link via OTP'}
                </Text>
              </View>
              <View style={styles.diagRow}>
                <Text style={styles.diagLabel}>Rapido PWA Bridge</Text>
                <Text
                  style={[
                    styles.diagBadge,
                    Platform.OS === 'web' ? styles.diagBlue : styles.diagGreen,
                  ]}
                >
                  {Platform.OS === 'web'
                    ? '📱 Active on Android/iOS'
                    : '🟢 unupFe Ready'}
                </Text>
              </View>
            </View>

            {/* Linked Providers */}
            {linkedProviders.map((p) => (
              <View key={p.id} style={styles.providerCard}>
                <View
                  style={[
                    styles.providerLogoCircle,
                    { backgroundColor: p.brandColor },
                  ]}
                >
                  <Text
                    style={[styles.providerLogoText, { color: p.textColor }]}
                  >
                    {p.shortTag}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.providerName}>{p.name}</Text>
                  <Text style={styles.providerSubHint}>
                    Tap to open session · Long-press to unlink
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.linkedStatusRow}
                  onPress={() => setActiveWebProvider(p)}
                  onLongPress={() => {
                    if (p.id === 'namma_yatri') {
                      setStoredNammaYatriToken(null).catch(() => {});
                    }
                    onToggleLink(p.id, false);
                  }}
                >
                  <Text style={styles.linkedText}>Linked</Text>
                  <View style={styles.greenCheckCircle}>
                    <Text style={styles.greenCheckText}>✓</Text>
                  </View>
                </TouchableOpacity>
              </View>
            ))}

            {unlinkedProviders.length > 0 && (
              <Text style={styles.saveMoreHint}>
                Users who link 4 Apps{' '}
                <Text style={styles.saveMoreGreen}>save 10% more</Text> on rides
              </Text>
            )}

            {/* Unlinked Providers */}
            {unlinkedProviders.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.providerCard}
                onPress={() => setActiveWebProvider(p)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.providerLogoCircle,
                    { backgroundColor: p.brandColor },
                  ]}
                >
                  <Text
                    style={[styles.providerLogoText, { color: p.textColor }]}
                  >
                    {p.shortTag}
                  </Text>
                </View>
                <Text style={styles.providerName}>{p.name}</Text>
                <View style={styles.linkActionRow}>
                  <Text style={styles.linkActionText}>Link</Text>
                  <View style={styles.linkChevronCircle}>
                    <Text style={styles.linkChevronText}>›</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}

            <Text style={styles.disclaimerText}>
              FareSnap is an independent commuter comparison utility and is not affiliated with Uber, Ola, Rapido, Namma Yatri, InDrive, Meru, or Bharat Cab. Users optionally sign into their own accounts via an integrated browser or OTP to view personal fare estimates.
            </Text>
          </ScrollView>

          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.compareToBookBtn}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.compareToBookText}>Compare to Book</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 8,
  },
  closeCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeCircleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginTop: 8,
  },
  heroSubtitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 18,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  stepText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  stepArrow: {
    fontSize: 14,
    color: '#94a3b8',
  },
  shieldBox: {
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  shieldEmoji: {
    fontSize: 34,
    marginBottom: 10,
  },
  shieldText: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 19,
  },
  diagCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
  },
  diagTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  diagLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  diagBadge: {
    fontSize: 11,
    fontWeight: '700',
  },
  diagGreen: {
    color: '#16a34a',
  },
  diagBlue: {
    color: '#2563eb',
  },
  diagMuted: {
    color: '#64748b',
  },
  disclaimerText: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 14,
    paddingHorizontal: 8,
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  providerLogoCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  providerLogoText: {
    fontSize: 13,
    fontWeight: '800',
  },
  providerName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  providerSubHint: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  linkedStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkedText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10b981',
  },
  greenCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenCheckText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  saveMoreHint: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginVertical: 14,
  },
  saveMoreGreen: {
    color: '#16a34a',
    fontWeight: '700',
  },
  linkActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4338ca',
  },
  linkChevronCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#4338ca',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkChevronText: {
    color: '#4338ca',
    fontSize: 15,
    fontWeight: '700',
    marginTop: -2,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  compareToBookBtn: {
    backgroundColor: '#4338ca',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
  },
  compareToBookText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  webviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  webviewSubtitle: {
    fontSize: 11,
    color: '#64748b',
  },
  doneLinkBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  doneLinkBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  webBrowserFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  webFallbackTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  webFallbackSub: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  nyOtpContainer: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nyBrandBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  nyBrandBadgeText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  nyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  nySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  nyInput: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 12,
  },
  nyErrorText: {
    fontSize: 13,
    color: '#dc2626',
    marginBottom: 10,
    textAlign: 'center',
  },
  nyPrimaryBtn: {
    width: '100%',
    backgroundColor: '#4338ca',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
  },
  nyPrimaryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  nyChangePhoneText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4338ca',
  },
});
