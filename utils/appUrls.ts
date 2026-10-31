import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

const UBER_CLIENT_ID = 'qrL6tAfv9pCWuvHuuJWAOOwAft7B-_TF';

type Coords = { lat: number; lng: number };

type OpenRideAppOpts = {
  pickupCoords?: Coords;
  dropCoords?: Coords;
  pickupAddress?: string;
  dropAddress?: string;
};

type AppConfig = {
  deepLink: string;
  webUrl: string;
  buildDeepLink?: (opts: OpenRideAppOpts) => string;
  buildWebUrl?: (opts: OpenRideAppOpts) => string;
};

const MERU_CONFIG: AppConfig = {
  deepLink: 'merucabs://open',
  webUrl: 'https://www.meru.in/',
};

const APP_CONFIGS: Record<string, AppConfig> = {
  Uber: {
    deepLink: 'uber://',
    webUrl: 'https://m.uber.com/',
    buildDeepLink: (opts) => {
      const params = new URLSearchParams();
      params.set('client_id', UBER_CLIENT_ID);
      params.set('action', 'setPickup');
      if (opts.pickupCoords) {
        params.set('pickup[latitude]', String(opts.pickupCoords.lat));
        params.set('pickup[longitude]', String(opts.pickupCoords.lng));
      }
      if (opts.pickupAddress) {
        params.set('pickup[formatted_address]', opts.pickupAddress);
      }
      if (opts.dropCoords) {
        params.set('dropoff[latitude]', String(opts.dropCoords.lat));
        params.set('dropoff[longitude]', String(opts.dropCoords.lng));
      }
      if (opts.dropAddress) {
        params.set('dropoff[formatted_address]', opts.dropAddress);
      }
      return `uber://?${params.toString()}`;
    },
    buildWebUrl: (opts) => {
      const params = new URLSearchParams();
      params.set('client_id', UBER_CLIENT_ID);
      params.set('action', 'setPickup');
      if (opts.pickupCoords) {
        params.set('pickup[latitude]', String(opts.pickupCoords.lat));
        params.set('pickup[longitude]', String(opts.pickupCoords.lng));
      }
      if (opts.pickupAddress) {
        params.set('pickup[formatted_address]', opts.pickupAddress);
      }
      if (opts.dropCoords) {
        params.set('dropoff[latitude]', String(opts.dropCoords.lat));
        params.set('dropoff[longitude]', String(opts.dropCoords.lng));
      }
      if (opts.dropAddress) {
        params.set('dropoff[formatted_address]', opts.dropAddress);
      }
      return `https://m.uber.com/looking?${params.toString()}`;
    },
  },
  Ola: {
    deepLink: 'olacabs://app/launch',
    webUrl: 'https://book.olacabs.com/',
    buildDeepLink: (opts) => {
      const params = new URLSearchParams();
      if (opts.pickupCoords) {
        params.set('lat', String(opts.pickupCoords.lat));
        params.set('lng', String(opts.pickupCoords.lng));
      }
      if (opts.dropCoords) {
        params.set('drop_lat', String(opts.dropCoords.lat));
        params.set('drop_lng', String(opts.dropCoords.lng));
      }
      const qs = params.toString();
      return qs ? `olacabs://app/launch?${qs}` : 'olacabs://app/launch';
    },
    buildWebUrl: (opts) => {
      const params = new URLSearchParams();
      if (opts.pickupCoords) {
        params.set('lat', String(opts.pickupCoords.lat));
        params.set('lng', String(opts.pickupCoords.lng));
      }
      if (opts.dropCoords) {
        params.set('drop_lat', String(opts.dropCoords.lat));
        params.set('drop_lng', String(opts.dropCoords.lng));
      }
      const qs = params.toString();
      return qs ? `https://book.olacabs.com/?${qs}` : 'https://book.olacabs.com/';
    },
  },
  Rapido: {
    deepLink: 'in.rapido.passenger://open',
    webUrl: 'https://rapido.bike/',
  },
  'Namma Yatri': {
    deepLink: 'yatri://open',
    webUrl: 'https://nammayatri.in/',
  },
  BluSmart: {
    deepLink: 'blusmart://open',
    webUrl: 'https://blu-smart.com/',
  },
  inDrive: {
    deepLink: 'indrive://open',
    webUrl: 'https://indrive.com/en/home/',
  },
  'Bharat Cab': {
    deepLink: 'bharatcab://open',
    webUrl: 'https://bharatcab.com/',
  },
  Savaari: {
    deepLink: 'savaari://open',
    webUrl: 'https://www.savaari.com/',
  },
  Meru: MERU_CONFIG,
  'Meru Cabs': MERU_CONFIG,
};

function hasOpts(opts?: OpenRideAppOpts): opts is OpenRideAppOpts {
  return !!(
    opts?.pickupCoords ||
    opts?.dropCoords ||
    opts?.pickupAddress ||
    opts?.dropAddress
  );
}

function getDeepLink(appName: string, opts?: OpenRideAppOpts): string {
  const config = APP_CONFIGS[appName];
  if (!config) return 'https://google.com/maps';

  if (config.buildDeepLink && hasOpts(opts)) {
    return config.buildDeepLink(opts);
  }

  return config.deepLink;
}

function getWebUrl(appName: string, opts?: OpenRideAppOpts): string {
  const config = APP_CONFIGS[appName];
  if (!config) return 'https://google.com/maps';

  if (config.buildWebUrl && hasOpts(opts)) {
    return config.buildWebUrl(opts);
  }

  return config.webUrl;
}

export async function openRideApp(
  appName: string,
  opts?: OpenRideAppOpts
): Promise<void> {
  const deepLink = getDeepLink(appName, opts);
  const webUrl = getWebUrl(appName, opts);

  try {
    const canOpen = await Linking.canOpenURL(deepLink);
    if (canOpen) {
      await Linking.openURL(deepLink);
      return;
    }
  } catch {
    // fall through to web fallback
  }

  await WebBrowser.openBrowserAsync(webUrl);
}
