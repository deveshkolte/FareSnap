import AsyncStorage from '@react-native-async-storage/async-storage';

export type LinkableProviderId = 'uber' | 'rapido' | 'ola' | 'namma_yatri';

export type LinkableProviderInfo = {
  id: LinkableProviderId;
  name: string;
  shortTag: string;
  brandColor: string;
  textColor: string;
  loginUrl: string;
  buildBookingWebUrl: (opts: {
    pickupLat?: number;
    pickupLng?: number;
    pickupAddress: string;
    dropLat?: number;
    dropLng?: number;
    dropAddress: string;
  }) => string;
};

export type LifetimeSavingsData = {
  totalSaved: number;
  tripCount: number;
  lastTripSaved: number;
};

const LINKED_PROVIDERS_KEY = 'faresnap_linked_providers_v1';
const LIFETIME_SAVINGS_KEY = 'faresnap_lifetime_savings_v1';

export const LINKABLE_PROVIDERS: LinkableProviderInfo[] = [
  {
    id: 'uber',
    name: 'Uber',
    shortTag: 'Uber',
    brandColor: '#000000',
    textColor: '#ffffff',
    loginUrl: 'https://m.uber.com/looking',
    buildBookingWebUrl: ({
      pickupLat,
      pickupLng,
      pickupAddress,
      dropLat,
      dropLng,
      dropAddress,
    }) => {
      const params = new URLSearchParams();
      params.set('action', 'setPickup');
      if (pickupLat && pickupLng) {
        params.set('pickup[latitude]', String(pickupLat));
        params.set('pickup[longitude]', String(pickupLng));
      }
      if (pickupAddress) {
        params.set('pickup[formatted_address]', pickupAddress);
      }
      if (dropLat && dropLng) {
        params.set('dropoff[latitude]', String(dropLat));
        params.set('dropoff[longitude]', String(dropLng));
      }
      if (dropAddress) {
        params.set('dropoff[formatted_address]', dropAddress);
      }
      return `https://m.uber.com/looking?${params.toString()}`;
    },
  },
  {
    id: 'rapido',
    name: 'Rapido',
    shortTag: 'rapido',
    brandColor: '#facc15',
    textColor: '#0f172a',
    loginUrl: 'https://m.rapido.bike/',
    buildBookingWebUrl: () => 'https://m.rapido.bike/',
  },
  {
    id: 'ola',
    name: 'Ola',
    shortTag: 'OLA',
    brandColor: '#16a34a',
    textColor: '#ffffff',
    loginUrl: 'https://book.olacabs.com/',
    buildBookingWebUrl: ({ pickupLat, pickupLng, dropLat, dropLng }) => {
      const params = new URLSearchParams();
      if (pickupLat && pickupLng) {
        params.set('lat', String(pickupLat));
        params.set('lng', String(pickupLng));
      }
      if (dropLat && dropLng) {
        params.set('drop_lat', String(dropLat));
        params.set('drop_lng', String(dropLng));
      }
      const qs = params.toString();
      return qs ? `https://book.olacabs.com/?${qs}` : 'https://book.olacabs.com/';
    },
  },
  {
    id: 'namma_yatri',
    name: 'Namma Yatri',
    shortTag: 'NY',
    brandColor: '#f59e0b',
    textColor: '#0f172a',
    loginUrl: 'https://nammayatri.in/',
    buildBookingWebUrl: () => 'https://nammayatri.in/',
  },
];

/**
 * Reverse-engineered from BuyHatke's `pageApiHook.js`:
 * Intercepts `Response.prototype.json`, `Response.prototype.text`, `XMLHttpRequest`,
 * and DOM fare elements inside the user's local WebView session and posts parsed
 * live ride quotes back to the React Native host without storing credentials externally.
 */
export const PAGE_API_HOOK_SCRIPT = `
(function() {
  if (window.__bhPageApiHook) return;
  window.__bhPageApiHook = true;

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

  function extractFaresFromJson(url, data) {
    try {
      var text = typeof data === 'string' ? data : JSON.stringify(data);
      // Match ₹ prices or fare fields from Uber / Ola / Rapido API responses
      var matches = [];
      var regex = /"(?:fare|amount|price|estimatedFare|totalFare|lowEstimate|displayAmount)"\\s*:\\s*"?(?:₹\\s*)?(\\d{2,4}(?:\\.\\d{1,2})?)"?/gi;
      var m;
      while ((m = regex.exec(text)) !== null) {
        var val = parseFloat(m[1]);
        if (val >= 25 && val <= 5000) {
          matches.push(val);
        }
      }
      if (matches.length > 0) {
        postToHost({
          source: 'bh-page-api',
          type: 'LIVE_FARES_INTERCEPTED',
          url: url,
          fares: matches.slice(0, 10),
          timestamp: Date.now()
        });
      }
    } catch (e) {}
  }

  var origJson = Response.prototype.json;
  Response.prototype.json = function() {
    var promise = origJson.apply(this, arguments);
    try {
      var url = this.url || location.href;
      promise.then(function(data) {
        extractFaresFromJson(url, data);
      }).catch(function() {});
    } catch (e) {}
    return promise;
  };

  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    try {
      this.__bhApiUrl = new URL(url, location.href).href;
    } catch (e) {
      this.__bhApiUrl = String(url);
    }
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function() {
    var apiUrl = this.__bhApiUrl || location.href;
    this.addEventListener('load', function() {
      try {
        if (this.status >= 200 && this.status < 300 && this.responseText) {
          extractFaresFromJson(apiUrl, this.responseText);
        }
      } catch (e) {}
    });
    return origSend.apply(this, arguments);
  };

  // Also scan DOM periodically for rendered rupee prices (₹82, ₹143.34, etc.)
  setInterval(function() {
    try {
      var bodyText = document.body ? document.body.innerText : '';
      var priceRegex = /₹\\s*(\\d{2,4}(?:\\.\\d{1,2})?)/g;
      var found = [];
      var match;
      while ((match = priceRegex.exec(bodyText)) !== null) {
        var num = parseFloat(match[1]);
        if (num >= 25 && num <= 4500 && found.indexOf(num) === -1) {
          found.push(num);
        }
      }
      if (found.length > 0) {
        postToHost({
          source: 'bh-page-api',
          type: 'DOM_FARES_DETECTED',
          url: location.href,
          fares: found.slice(0, 12),
          timestamp: Date.now()
        });
      }
    } catch (e) {}
  }, 2200);
})();
true;
`;

export async function getLinkedProviders(): Promise<Record<LinkableProviderId, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(LINKED_PROVIDERS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return {
    uber: true,
    rapido: true,
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
