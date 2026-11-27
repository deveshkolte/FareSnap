import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { checkAppInstalled, getAppStoreUrl } from '../utils/appUrls';
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
  const insets = useSafeAreaInsets();
  const [activeWebProvider, setActiveWebProvider] =
    useState<LinkableProviderInfo | null>(null);
  const [detectedLoggedIn, setDetectedLoggedIn] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState<boolean | null>(null);
  const [showWebPortal, setShowWebPortal] = useState(false);
  const [checkingApp, setCheckingApp] = useState(false);

  // Direct API OTP state for Namma Yatri (api.moving.tech)
  const [nyPhone, setNyPhone] = useState('');
  const [nyOtp, setNyOtp] = useState('');
  const [nyAuthId, setNyAuthId] = useState<string | null>(null);
  const [nyLoading, setNyLoading] = useState(false);
  const [nyError, setNyError] = useState('');

  useEffect(() => {
    if (visible && initialProviderId) {
      const found = LINKABLE_PROVIDERS.find((p) => p.id === initialProviderId);
      setActiveWebProvider(found || null);
      setShowWebPortal(Boolean(routeOpts)); // if booking, go straight to webview
    } else if (!visible) {
      setActiveWebProvider(null);
      setDetectedLoggedIn(false);
      setShowWebPortal(false);
      setIsAppInstalled(null);
      setNyAuthId(null);
      setNyOtp('');
      setNyError('');
    }
  }, [visible, initialProviderId, routeOpts]);

  // Check if native app is installed when active provider changes
  useEffect(() => {
    if (activeWebProvider && activeWebProvider.id !== 'namma_yatri') {
      setCheckingApp(true);
      checkAppInstalled(activeWebProvider.name)
        .then((installed) => {
          setIsAppInstalled(installed);
        })
        .catch(() => setIsAppInstalled(false))
        .finally(() => setCheckingApp(false));
    }
  }, [activeWebProvider]);

  const handleNySendOtp = async () => {
    const cleanPhone = nyPhone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setNyError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setNyError('');
    setNyLoading(true);
    try {
      const res = await sendNammaYatriOtp(cleanPhone);
      setNyAuthId(res.authId);
    } catch (err: any) {
      setNyError(err?.message || 'Could not send OTP. Please try again.');
    } finally {
      setNyLoading(false);
    }
  };

  const handleNyVerifyOtp = async () => {
    if (!nyAuthId || nyOtp.trim().length < 4) {
      setNyError('Please enter the 4-digit OTP sent to your phone.');
      return;
    }
    setNyError('');
    setNyLoading(true);
    try {
      await verifyNammaYatriOtp(nyAuthId, nyOtp.trim());
      onToggleLink('namma_yatri', true);
      setNyAuthId(null);
      setNyOtp('');
      setActiveWebProvider(null);
      onClose();
    } catch (err: any) {
      setNyError(err?.message || 'Invalid OTP. Please check and try again.');
    } finally {
      setNyLoading(false);
    }
  };

  const handleLinkInstalledApp = () => {
    if (!activeWebProvider) return;
    onToggleLink(activeWebProvider.id, true);
    setActiveWebProvider(null);
    onClose();
  };

  const handleOpenStore = () => {
    if (!activeWebProvider) return;
    const storeUrl = getAppStoreUrl(activeWebProvider.name);
    Linking.openURL(storeUrl).catch(() => {});
  };

  const getWebViewUrl = (provider: LinkableProviderInfo) => {
    if (routeOpts) {
      return provider.buildRouteWebUrl(routeOpts);
    }
    return provider.loginUrl;
  };

  const handleClose = () => {
    if (showWebPortal && !routeOpts) {
      setShowWebPortal(false);
    } else {
      setActiveWebProvider(null);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <View
        style={[
          styles.container,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        {/* Top Navigation Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.closeCircle}
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.closeCircleText}>
              {showWebPortal && !routeOpts ? '←' : '✕'}
            </Text>
          </TouchableOpacity>
          <View style={styles.topBarTitleCol}>
            <Text style={styles.topBarTitle}>
              {activeWebProvider ? `Connect ${activeWebProvider.name}` : 'Connect Ride Apps'}
            </Text>
            <Text style={styles.topBarSubtitle}>
              {activeWebProvider?.id === 'namma_yatri'
                ? 'Official SMS OTP Verification'
                : showWebPortal
                ? 'Sign in on official web portal'
                : '1-Tap App Bridge & Session Linking'}
            </Text>
          </View>
        </View>

        {/* Content Area */}
        {activeWebProvider?.id === 'namma_yatri' && !routeOpts?.autoSelectProduct ? (
          // Namma Yatri Direct SMS OTP Verification UI
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.nyBrandBadge}>
              <Text style={styles.nyBrandBadgeText}>NY</Text>
            </View>
            <Text style={styles.nyTitle}>Namma Yatri / ONDC</Text>
            <Text style={styles.nySubtitle}>
              Connect directly via official Moving Tech API (`api.moving.tech`) for live zero-commission driver fares and direct booking.
            </Text>

            {!nyAuthId ? (
              <View style={styles.cardBox}>
                <Text style={styles.inputLabel}>Enter Registered Mobile Number</Text>
                <View style={styles.phoneInputRow}>
                  <Text style={styles.phoneCountryCode}>+91</Text>
                  <TextInput
                    style={styles.phoneInput}
                    keyboardType="phone-pad"
                    maxLength={10}
                    placeholder="10-digit mobile number"
                    placeholderTextColor="#94a3b8"
                    value={nyPhone}
                    onChangeText={setNyPhone}
                  />
                </View>
                {nyError ? <Text style={styles.errorText}>{nyError}</Text> : null}
                <TouchableOpacity
                  style={styles.primaryActionButton}
                  onPress={handleNySendOtp}
                  disabled={nyLoading}
                  activeOpacity={0.85}
                >
                  {nyLoading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryActionText}>Send Real SMS OTP →</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.cardBox}>
                <Text style={styles.inputLabel}>Enter 4-Digit SMS OTP</Text>
                <Text style={styles.inputSubhint}>
                  Sent via SMS to +91 {nyPhone}
                </Text>
                <TextInput
                  style={styles.otpInput}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="• • • •"
                  placeholderTextColor="#94a3b8"
                  value={nyOtp}
                  onChangeText={setNyOtp}
                  autoFocus
                />
                {nyError ? <Text style={styles.errorText}>{nyError}</Text> : null}
                <TouchableOpacity
                  style={styles.primaryActionButton}
                  onPress={handleNyVerifyOtp}
                  disabled={nyLoading}
                  activeOpacity={0.85}
                >
                  {nyLoading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryActionText}>Verify & Complete Link ✓</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ marginTop: 14, alignItems: 'center' }}
                  onPress={() => {
                    setNyAuthId(null);
                    setNyOtp('');
                    setNyError('');
                  }}
                >
                  <Text style={styles.textLinkButton}>Change Phone Number</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.securityBox}>
              <Text style={styles.securityIcon}>🔒</Text>
              <Text style={styles.securityText}>
                FareSnap never shares your phone number. Your auth token is saved locally in encrypted storage.
              </Text>
            </View>
          </ScrollView>
        ) : showWebPortal && activeWebProvider ? (
          // Official In-App Web Login View (STRICT - NO FAKE LINK BUTTON)
          <View style={{ flex: 1 }}>
            {detectedLoggedIn && (
              <View style={styles.successBanner}>
                <Text style={styles.successBannerText}>
                  ✅ Login Verified on {activeWebProvider.name}! Saving session...
                </Text>
              </View>
            )}
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
                  const msg = JSON.parse(event.nativeEvent.data) as ScraperBridgeMessage;
                  if (msg?.source !== 'bh-page-api') return;

                  if (
                    msg.type === 'LIVE_PRODUCTS_SCRAPED' &&
                    Array.isArray(msg.products) &&
                    msg.products.length > 0
                  ) {
                    setDetectedLoggedIn(true);
                    onToggleLink(activeWebProvider.id, true);
                    onLiveProductsScraped?.(activeWebProvider.id, msg.products);
                    setTimeout(() => {
                      onClose();
                    }, 1200);
                  } else if (msg.type === 'AUTH_STATUS') {
                    if (msg.isLoggedIn) {
                      setDetectedLoggedIn(true);
                      onToggleLink(activeWebProvider.id, true);
                      setTimeout(() => {
                        onClose();
                      }, 1200);
                    }
                  }
                } catch {}
              }}
              style={{ flex: 1 }}
            />
          </View>
        ) : activeWebProvider ? (
          // Hybrid Choice Screen for Uber, Ola, Rapido (Installed App vs Web Portal)
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.hybridHeader}>
              <View
                style={[
                  styles.brandCircleLarge,
                  { backgroundColor: activeWebProvider.brandColor },
                ]}
              >
                <Text
                  style={[
                    styles.brandCircleLargeText,
                    { color: activeWebProvider.textColor },
                  ]}
                >
                  {activeWebProvider.shortTag}
                </Text>
              </View>
              <Text style={styles.hybridTitle}>Connect {activeWebProvider.name}</Text>
              <Text style={styles.hybridSubtitle}>
                Choose how you want to connect your account for live pricing and 1-tap booking.
              </Text>
            </View>

            {/* Option 1: Native App Connection */}
            <View style={styles.optionCard}>
              <View style={styles.optionHeaderRow}>
                <Text style={styles.optionTag}>RECOMMENDED</Text>
                <Text style={styles.optionStatus}>
                  {checkingApp
                    ? 'Checking device...'
                    : isAppInstalled
                    ? '🟢 App Detected'
                    : '⚪ Not Installed'}
                </Text>
              </View>
              <Text style={styles.optionTitle}>1-Tap Native App Bridge</Text>
              <Text style={styles.optionBody}>
                {isAppInstalled
                  ? `The official ${activeWebProvider.name} app is installed on this device. Since you are already signed in with your phone and payment methods, linking allows FareSnap to hand off pickup and drop coordinates in 1 tap.`
                  : `Install the official ${activeWebProvider.name} app on your device to enable instant 1-tap booking with your saved payment methods.`}
              </Text>

              {isAppInstalled ? (
                <TouchableOpacity
                  style={styles.linkInstalledButton}
                  onPress={handleLinkInstalledApp}
                  activeOpacity={0.85}
                >
                  <Text style={styles.linkInstalledButtonText}>
                    Link Installed App for 1-Tap Booking ✓
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.installButton}
                  onPress={handleOpenStore}
                  activeOpacity={0.85}
                >
                  <Text style={styles.installButtonText}>
                    Install {activeWebProvider.name} from Store ↗
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Option 2: Official Web Login Portal */}
            <View style={styles.optionCard}>
              <View style={styles.optionHeaderRow}>
                <Text style={styles.optionTagMuted}>ADVANCED</Text>
                <Text style={styles.optionStatus}>Requires SMS OTP</Text>
              </View>
              <Text style={styles.optionTitle}>In-App Official Web Login</Text>
              <Text style={styles.optionBody}>
                Sign into your {activeWebProvider.name} account directly inside FareSnap using your registered mobile number and real SMS OTP.
              </Text>
              <TouchableOpacity
                style={styles.openWebButton}
                onPress={() => setShowWebPortal(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.openWebButtonText}>
                  Open {activeWebProvider.name} Official Login Portal →
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.securityBox}>
              <Text style={styles.securityIcon}>🛡️</Text>
              <Text style={styles.securityText}>
                FareSnap never stores or intercepts your passwords. Authentication occurs strictly on the provider&apos;s verified domain.
              </Text>
            </View>
          </ScrollView>
        ) : null}
      </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  closeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeCircleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  topBarTitleCol: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  topBarSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  scrollArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 48,
  },

  // Namma Yatri Direct OTP UI
  nyBrandBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  nyBrandBadgeText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  nyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 6,
  },
  nySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  cardBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  inputSubhint: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 14,
    backgroundColor: '#ffffff',
  },
  phoneCountryCode: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    paddingVertical: 12,
  },
  otpInput: {
    borderWidth: 1.5,
    borderColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 14,
    backgroundColor: '#eff6ff',
  },
  primaryActionButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  textLinkButton: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },

  // Hybrid Choice Screen
  hybridHeader: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 6,
  },
  brandCircleLarge: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  brandCircleLargeText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  hybridTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  hybridSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 16,
  },
  optionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  optionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803d',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 0.4,
  },
  optionTagMuted: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 0.4,
  },
  optionStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  optionBody: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 14,
  },
  linkInstalledButton: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkInstalledButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  installButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  installButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  openWebButton: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  openWebButtonText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '700',
  },
  securityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
    marginTop: 6,
  },
  securityIcon: {
    fontSize: 16,
  },
  securityText: {
    fontSize: 11,
    color: '#64748b',
    flex: 1,
    lineHeight: 16,
  },
  successBanner: {
    backgroundColor: '#dcfce7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#bbf7d0',
  },
  successBannerText: {
    color: '#15803d',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
