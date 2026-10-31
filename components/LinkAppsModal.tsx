import { useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import {
  LINKABLE_PROVIDERS,
  LinkableProviderId,
  LinkableProviderInfo,
  PAGE_API_HOOK_SCRIPT,
} from '../utils/liveSessionBridge';

type Props = {
  visible: boolean;
  linkedMap: Record<LinkableProviderId, boolean>;
  onToggleLink: (id: LinkableProviderId, linked: boolean) => void;
  onInterceptedFares?: (providerId: LinkableProviderId, fares: number[]) => void;
  onClose: () => void;
};

export function LinkAppsModal({
  visible,
  linkedMap,
  onToggleLink,
  onInterceptedFares,
  onClose,
}: Props) {
  const [activeWebProvider, setActiveWebProvider] =
    useState<LinkableProviderInfo | null>(null);

  const linkedProviders = LINKABLE_PROVIDERS.filter((p) => linkedMap[p.id]);
  const unlinkedProviders = LINKABLE_PROVIDERS.filter((p) => !linkedMap[p.id]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => {
        if (activeWebProvider) {
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
              onPress={() => setActiveWebProvider(null)}
              style={styles.closeCircle}
            >
              <Text style={styles.closeCircleText}>←</Text>
            </TouchableOpacity>
            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text style={styles.webviewTitle}>
                Link {activeWebProvider.name}
              </Text>
              <Text style={styles.webviewSubtitle}>
                Log in once · Session stays on your device
              </Text>
            </View>
            <TouchableOpacity
              style={styles.doneLinkBtn}
              onPress={() => {
                onToggleLink(activeWebProvider.id, true);
                setActiveWebProvider(null);
              }}
            >
              <Text style={styles.doneLinkBtnText}>Linked ✓</Text>
            </TouchableOpacity>
          </View>

          {Platform.OS === 'web' ? (
            <View style={styles.webBrowserFallback}>
              <Text style={styles.webFallbackTitle}>
                Connect {activeWebProvider.name}
              </Text>
              <Text style={styles.webFallbackSub}>
                Tap &quot;Linked ✓&quot; above after signing into {activeWebProvider.name}.
              </Text>
            </View>
          ) : (
            <WebView
              source={{ uri: activeWebProvider.loginUrl }}
              injectedJavaScript={PAGE_API_HOOK_SCRIPT}
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (
                    data?.source === 'bh-page-api' &&
                    Array.isArray(data.fares) &&
                    data.fares.length > 0
                  ) {
                    onInterceptedFares?.(activeWebProvider.id, data.fares);
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
                Your data is 100% safe. We don&apos;t store your login, and over 1M+ users have booked rides securely.
              </Text>
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
                <Text style={styles.providerName}>{p.name}</Text>
                <TouchableOpacity
                  style={styles.linkedStatusRow}
                  onPress={() => setActiveWebProvider(p)}
                  onLongPress={() => onToggleLink(p.id, false)}
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
});
