import AsyncStorage from '@react-native-async-storage/async-storage';

export type LinkableProviderId = 'uber' | 'rapido' | 'ola' | 'namma_yatri';

export type ScrapedLiveProduct = {
  providerId: LinkableProviderId;
  providerName: string;
  productName: string;
  category: 'Bike' | 'Auto' | 'Cab';
  price: number;
  etaMinutes: number | null;
  rawText?: string;
};

export type ScraperBridgeMessage =
  | {
      source: 'bh-page-api';
      type: 'AUTH_STATUS';
      providerId: LinkableProviderId;
      isLoggedIn: boolean;
      currentUrl: string;
    }
  | {
      source: 'bh-page-api';
      type: 'LIVE_PRODUCTS_SCRAPED';
      providerId: LinkableProviderId;
      products: ScrapedLiveProduct[];
      currentUrl: string;
      timestamp: number;
    };

export type LinkableProviderInfo = {
  id: LinkableProviderId;
  name: string;
  shortTag: string;
  brandColor: string;
  textColor: string;
  loginUrl: string;
  buildRouteWebUrl: (opts: {
    pickupLat: number;
    pickupLng: number;
    pickupAddress: string;
    dropLat: number;
    dropLng: number;
    dropAddress: string;
  }) => string;
};

export type LifetimeSavingsData = {
  totalSaved: number;
  tripCount: number;
  lastTripSaved: number;
};

const LINKED_PROVIDERS_KEY = 'faresnap_linked_providers_v2';
const LIFETIME_SAVINGS_KEY = 'faresnap_lifetime_savings_v1';

export const LINKABLE_PROVIDERS: LinkableProviderInfo[] = [
  {
    id: 'uber',
    name: 'Uber',
    shortTag: 'Uber',
    brandColor: '#000000',
    textColor: '#ffffff',
    loginUrl: 'https://m.uber.com/looking',
    buildRouteWebUrl: ({
      pickupLat,
      pickupLng,
      pickupAddress,
      dropLat,
      dropLng,
      dropAddress,
    }) => {
      const pickupJson = JSON.stringify({
        latitude: pickupLat,
        longitude: pickupLng,
        addressLine1: pickupAddress.split(',')[0] || pickupAddress,
        addressLine2: pickupAddress,
      });
      const dropJson = JSON.stringify({
        latitude: dropLat,
        longitude: dropLng,
        addressLine1: dropAddress.split(',')[0] || dropAddress,
        addressLine2: dropAddress,
      });
      return `https://m.uber.com/go/product-selection?pickup=${encodeURIComponent(
        pickupJson
      )}&drop[0]=${encodeURIComponent(dropJson)}`;
    },
  },
  {
    id: 'ola',
    name: 'Ola',
    shortTag: 'OLA',
    brandColor: '#16a34a',
    textColor: '#ffffff',
    loginUrl: 'https://book.olacabs.com/',
    buildRouteWebUrl: ({
      pickupLat,
      pickupLng,
      pickupAddress,
      dropLat,
      dropLng,
      dropAddress,
    }) => {
      const params = new URLSearchParams({
        lat: String(pickupLat),
        lng: String(pickupLng),
        pickup_name: pickupAddress,
        drop_lat: String(dropLat),
        drop_lng: String(dropLng),
        drop_name: dropAddress,
        utm_source: 'faresnap',
      });
      return `https://book.olacabs.com/?${params.toString()}`;
    },
  },
  {
    id: 'rapido',
    name: 'Rapido',
    shortTag: 'rapido',
    brandColor: '#facc15',
    textColor: '#0f172a',
    loginUrl: 'https://m.rapido.bike/',
    buildRouteWebUrl: ({ pickupLat, pickupLng, dropLat, dropLng }) =>
      `https://m.rapido.bike/?pickup_lat=${pickupLat}&pickup_lng=${pickupLng}&drop_lat=${dropLat}&drop_lng=${dropLng}`,
  },
  {
    id: 'namma_yatri',
    name: 'Namma Yatri',
    shortTag: 'NY',
    brandColor: '#f59e0b',
    textColor: '#0f172a',
    loginUrl: 'https://nammayatri.in/',
    buildRouteWebUrl: () => 'https://nammayatri.in/',
  },
];

/**
 * Builds the injected JavaScript for a specific provider's WebView.
 * Intercepts both JSON API responses (`fetch` / `XMLHttpRequest`) and live DOM
 * product rows, normalizes them into `ScrapedLiveProduct[]`, and detects whether
 * the user is actually logged in or sitting on an auth/OTP wall.
 */
export const buildProviderScraperScript = (providerId: LinkableProviderId): string => `
(function() {
  if (window.__bhPageApiHook_${providerId}) return;
  window.__bhPageApiHook_${providerId} = true;

  var PROVIDER_ID = '${providerId}';
  var PROVIDER_NAME =
    PROVIDER_ID === 'uber' ? 'Uber' :
    PROVIDER_ID === 'ola' ? 'Ola' :
    PROVIDER_ID === 'rapido' ? 'Rapido' : 'Namma Yatri';

  function postToHost(payload) {
    try {
      var msg = JSON.stringify(payload);
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(msg);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(msg, '*');
      }
    } catch (e) {}
  }

  function classifyCategory(name) {
    var lower = String(name || '').toLowerCase();
    if (lower.indexOf('moto') !== -1 || lower.indexOf('bike') !== -1 || lower.indexOf('scooter') !== -1) {
      return 'Bike';
    }
    if (lower.indexOf('auto') !== -1 || lower.indexOf('rickshaw') !== -1) {
      return 'Auto';
    }
    return 'Cab';
  }

  function parsePriceNumber(val) {
    if (typeof val === 'number' && isFinite(val)) return val;
    if (typeof val !== 'string') return null;
    var m = val.replace(/,/g, '').match(/(?:₹|INR|Rs\\.?\\s*)?(\\d{2,5}(?:\\.\\d{1,2})?)/i);
    if (!m) return null;
    var num = parseFloat(m[1]);
    return (num >= 20 && num <= 15000) ? num : null;
  }

  function parseEtaNumber(val) {
    if (typeof val === 'number' && isFinite(val) && val > 0 && val <= 90) return Math.round(val);
    if (typeof val !== 'string') return null;
    var m = val.match(/(\\d{1,2})\\s*min/i);
    return m ? parseInt(m[1], 10) : null;
  }

  // Deep recursive walk over intercepted JSON objects to extract ride product quotes
  function extractProductsFromJsonObject(root) {
    var results = [];
    var seen = {};
    var visited = 0;

    function walk(node) {
      if (!node || typeof node !== 'object' || visited > 2500) return;
      visited++;

      if (Array.isArray(node)) {
        for (var i = 0; i < node.length; i++) walk(node[i]);
        return;
      }

      // Check if this object looks like a ride product/tier item
      var rawName =
        node.displayName ||
        node.productName ||
        node.vehicleViewDisplayName ||
        node.categoryName ||
        node.display_name ||
        node.title ||
        node.name;

      var rawPrice =
        node.fare ||
        node.formattedFare ||
        node.estimatedFare ||
        node.displayAmount ||
        node.amount ||
        node.price ||
        (node.fareInfo && (node.fareInfo.displayAmount || node.fareInfo.value)) ||
        (node.pricing && (node.pricing.fare || node.pricing.amount));

      var rawEta =
        node.eta ||
        node.etaShort ||
        node.etaMinutes ||
        node.pickupEta ||
        node.duration;

      if (typeof rawName === 'string' && rawName.length >= 2 && rawName.length <= 32 && rawPrice !== undefined) {
        var pNum = parsePriceNumber(rawPrice);
        if (pNum !== null) {
          var key = rawName.toLowerCase() + ':' + pNum;
          if (!seen[key]) {
            seen[key] = true;
            results.push({
              providerId: PROVIDER_ID,
              providerName: PROVIDER_NAME,
              productName: rawName.trim(),
              category: classifyCategory(rawName),
              price: pNum,
              etaMinutes: parseEtaNumber(rawEta)
            });
          }
        }
      }

      var keys = Object.keys(node);
      for (var k = 0; k < keys.length; k++) {
        var child = node[keys[k]];
        if (child && typeof child === 'object') {
          walk(child);
        }
      }
    }

    try {
      walk(root);
    } catch (e) {}
    return results;
  }

  function handleJsonPayload(data) {
    try {
      var parsed = typeof data === 'string' ? JSON.parse(data) : data;
      var products = extractProductsFromJsonObject(parsed);
      if (products.length > 0) {
        postToHost({
          source: 'bh-page-api',
          type: 'LIVE_PRODUCTS_SCRAPED',
          providerId: PROVIDER_ID,
          products: products,
          currentUrl: location.href,
          timestamp: Date.now()
        });
      }
    } catch (e) {}
  }

  // 1. Hook Response.prototype.json
  var origJson = Response.prototype.json;
  Response.prototype.json = function() {
    var promise = origJson.apply(this, arguments);
    try {
      promise.then(function(data) {
        handleJsonPayload(data);
      }).catch(function() {});
    } catch (e) {}
    return promise;
  };

  // 2. Hook Response.prototype.text
  var origText = Response.prototype.text;
  Response.prototype.text = function() {
    var promise = origText.apply(this, arguments);
    try {
      promise.then(function(txt) {
        if (txt && txt.indexOf('₹') !== -1 || txt.indexOf('fare') !== -1) {
          handleJsonPayload(txt);
        }
      }).catch(function() {});
    } catch (e) {}
    return promise;
  };

  // 3. Hook XMLHttpRequest
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', function() {
      try {
        if (this.status >= 200 && this.status < 300 && this.responseText) {
          handleJsonPayload(this.responseText);
        }
      } catch (e) {}
    });
    return origSend.apply(this, arguments);
  };

  // 4. DOM Scraper & Auth Detector (scans rendered product rows on m.uber.com / book.olacabs.com / rapido)
  var KNOWN_PRODUCT_NAMES = [
    'Uber Go', 'UberXS', 'Go Non AC', 'Premier', 'UberXL', 'Moto', 'Uber Auto', 'Auto',
    'Bike Direct', 'Auto Seat Share', 'Auto Pet', 'Cab Non AC', 'Cab AC', 'Cab Premium',
    'Ola Mini', 'Mini', 'Prime Sedan', 'Prime SUV', 'Ola Auto', 'Ola Bike', 'Bike'
  ];

  function scanDomForProductsAndAuth() {
    try {
      var href = location.href.toLowerCase();
      var bodyText = document.body ? document.body.innerText : '';

      var isAuthWall =
        href.indexOf('auth.uber.com') !== -1 ||
        href.indexOf('login') !== -1 ||
        href.indexOf('signin') !== -1 ||
        Boolean(document.querySelector('input[type="tel"], input[name="phone"], input[autocomplete="tel"]')) ||
        /enter your (?:phone|mobile) number|sign in to|log in to/i.test(bodyText);

      var domProducts = [];
      var seenNames = {};

      // Scan list items / cards in DOM that contain both a vehicle name and a ₹ price
      var candidates = document.querySelectorAll('li, [role="option"], [data-testid*="product"], div');
      for (var i = 0; i < candidates.length && domProducts.length < 10; i++) {
        var el = candidates[i];
        if (el.children.length > 12) continue; // skip huge container divs
        var txt = (el.innerText || '').trim();
        if (!txt || txt.length < 5 || txt.length > 160 || txt.indexOf('₹') === -1) continue;

        var priceMatch = txt.replace(/,/g, '').match(/₹\\s*(\\d{2,5}(?:\\.\\d{1,2})?)/);
        if (!priceMatch) continue;
        var price = parseFloat(priceMatch[1]);
        if (!(price >= 20 && price <= 15000)) continue;

        var matchedProduct = null;
        for (var j = 0; j < KNOWN_PRODUCT_NAMES.length; j++) {
          var pName = KNOWN_PRODUCT_NAMES[j];
          var regex = new RegExp('\\\\b' + pName.replace(/\\s+/g, '\\\\s+') + '\\\\b', 'i');
          if (regex.test(txt)) {
            matchedProduct = pName;
            break;
          }
        }

        if (matchedProduct && !seenNames[matchedProduct]) {
          seenNames[matchedProduct] = true;
          var etaMatch = txt.match(/(\\d{1,2})\\s*min/i);
          domProducts.push({
            providerId: PROVIDER_ID,
            providerName: PROVIDER_NAME,
            productName: matchedProduct,
            category: classifyCategory(matchedProduct),
            price: price,
            etaMinutes: etaMatch ? parseInt(etaMatch[1], 10) : null
          });
        }
      }

      if (domProducts.length > 0) {
        postToHost({
          source: 'bh-page-api',
          type: 'LIVE_PRODUCTS_SCRAPED',
          providerId: PROVIDER_ID,
          products: domProducts,
          currentUrl: location.href,
          timestamp: Date.now()
        });
        postToHost({
          source: 'bh-page-api',
          type: 'AUTH_STATUS',
          providerId: PROVIDER_ID,
          isLoggedIn: true,
          currentUrl: location.href
        });
      } else {
        postToHost({
          source: 'bh-page-api',
          type: 'AUTH_STATUS',
          providerId: PROVIDER_ID,
          isLoggedIn: !isAuthWall,
          currentUrl: location.href
        });
      }
    } catch (e) {}
  }

  setInterval(scanDomForProductsAndAuth, 2000);
  setTimeout(scanDomForProductsAndAuth, 800);
})();
true;
`;

export const buildAutoSelectVehicleScript = (productName: string): string => `
(function() {
  try {
    var target = ${JSON.stringify(productName)}.toLowerCase();
    var nodes = document.querySelectorAll('li, [role="option"], [data-testid*="product"], button, div');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.children.length > 8) continue;
      var txt = (el.innerText || '').toLowerCase();
      if (txt.indexOf(target) !== -1 && txt.indexOf('₹') !== -1) {
        el.click();
        break;
      }
    }
  } catch (e) {}
})();
true;
`;

/**
 * Default linked state is `false` for all providers so we NEVER fake "Linked"
 * status until the user actually links their session in the WebView!
 */
export async function getLinkedProviders(): Promise<Record<LinkableProviderId, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(LINKED_PROVIDERS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return {
    uber: false,
    rapido: false,
    ola: false,
    namma_yatri: false,
  };
}

export async function setProviderLinked(
  providerId: LinkableProviderId,
  linked: boolean
): Promise<Record<LinkableProviderId, boolean>> {
  const current = await getLinkedProviders();
  const updated = { ...current, [providerId]: linked };
  try {
    await AsyncStorage.setItem(LINKED_PROVIDERS_KEY, JSON.stringify(updated));
  } catch {}
  return updated;
}

export async function getLifetimeSavings(): Promise<LifetimeSavingsData> {
  try {
    const raw = await AsyncStorage.getItem(LIFETIME_SAVINGS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return {
    totalSaved: 0,
    tripCount: 0,
    lastTripSaved: 0,
  };
}

export async function recordTripSavings(
  savedAmount: number
): Promise<LifetimeSavingsData> {
  const current = await getLifetimeSavings();
  const cleanSaved = Math.max(0, Math.round(savedAmount * 100) / 100);
  const updated: LifetimeSavingsData = {
    totalSaved: Math.round((current.totalSaved + cleanSaved) * 100) / 100,
    tripCount: current.tripCount + 1,
    lastTripSaved: cleanSaved,
  };
  try {
    await AsyncStorage.setItem(LIFETIME_SAVINGS_KEY, JSON.stringify(updated));
  } catch {}
  return updated;
}
