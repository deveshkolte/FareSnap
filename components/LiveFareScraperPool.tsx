import { Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  buildProviderScraperScript,
  LINKABLE_PROVIDERS,
  LinkableProviderId,
  ScrapedLiveProduct,
  ScraperBridgeMessage,
} from '../utils/liveSessionBridge';

type Props = {
  linkedMap: Record<LinkableProviderId, boolean>;
  pickupLat?: number;
  pickupLng?: number;
  pickupAddress: string;
  dropLat?: number;
  dropLng?: number;
  dropAddress: string;
  onLiveProductsScraped: (
    providerId: LinkableProviderId,
    products: ScrapedLiveProduct[]
  ) => void;
  onAuthStatusDetected?: (
    providerId: LinkableProviderId,
    isLoggedIn: boolean
  ) => void;
};

/**
 * Mounts offscreen 1x1 WebViews for every provider the user has linked.
 * Each WebView loads the provider's mobile web booking route URL using the
 * user's persisted device cookies (`sharedCookiesEnabled`) and runs the
 * BuyHatke-style `fetch`/`XHR`/DOM interceptor to extract live fares.
 */
export function LiveFareScraperPool({
  linkedMap,
  pickupLat,
  pickupLng,
  pickupAddress,
  dropLat,
  dropLng,
  dropAddress,
  onLiveProductsScraped,
  onAuthStatusDetected,
}: Props) {
  if (
    Platform.OS === 'web' ||
    typeof pickupLat !== 'number' ||
    typeof pickupLng !== 'number' ||
    typeof dropLat !== 'number' ||
    typeof dropLng !== 'number'
  ) {
    return null;
  }

  const activeProviders = LINKABLE_PROVIDERS.filter((p) => linkedMap[p.id]);
  if (activeProviders.length === 0) {
    return null;
  }

  return (
    <View style={styles.hiddenPool} pointerEvents="none">
      {activeProviders.map((provider) => {
        const routeUrl = provider.buildRouteWebUrl({
          pickupLat,
          pickupLng,
          pickupAddress,
          dropLat,
          dropLng,
          dropAddress,
        });
        const script = buildProviderScraperScript(provider.id, {
          pickupLat,
          pickupLng,
          dropLat,
          dropLng,
        });

        return (
          <View key={provider.id} style={styles.singleWebViewBox}>
            <WebView
              source={{ uri: routeUrl }}
              injectedJavaScriptBeforeContentLoaded={script}
              injectedJavaScript={script}
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
                    onLiveProductsScraped(provider.id, msg.products);
                  } else if (msg.type === 'AUTH_STATUS') {
                    onAuthStatusDetected?.(provider.id, msg.isLoggedIn);
                  }
                } catch {}
              }}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  hiddenPool: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
    bottom: -10,
    right: -10,
  },
  singleWebViewBox: {
    width: 360,
    height: 640,
  },
});
