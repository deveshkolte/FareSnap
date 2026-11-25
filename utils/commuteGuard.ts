import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchLiveWeatherSurge } from './weatherSurgeEngine';

export type SavedCommuteRoute = {
  pickup: string;
  destination: string;
  pickupLat?: number;
  pickupLng?: number;
  destLat?: number;
  destLng?: number;
  updatedAt: number;
};

export type CommuteGuardStatus = {
  route: SavedCommuteRoute;
  headline: string;
  subline: string;
  isAlert: boolean;
};

const COMMUTE_GUARD_KEY = 'faresnap_commute_guard_v1';

export async function getSavedCommuteRoute(): Promise<SavedCommuteRoute | null> {
  try {
    const raw = await AsyncStorage.getItem(COMMUTE_GUARD_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.pickup && parsed?.destination) {
        return parsed;
      }
    }
  } catch {}
  return null;
}

export async function saveCommuteRoute(
  route: SavedCommuteRoute | null
): Promise<void> {
  try {
    if (route) {
      await AsyncStorage.setItem(COMMUTE_GUARD_KEY, JSON.stringify(route));
    } else {
      await AsyncStorage.removeItem(COMMUTE_GUARD_KEY);
    }
  } catch {}
}

/**
 * Evaluates live weather & time-of-day surge conditions for the user's saved commute route.
 * Strictly uses the explicitly pinned commute route — never silently falls back to arbitrary history.
 */
export async function evaluateCommuteGuard(): Promise<CommuteGuardStatus | null> {
  const route = await getSavedCommuteRoute();
  if (!route || !route.pickup?.trim() || !route.destination?.trim()) return null;

  const hour = new Date().getHours();
  const isMorningPeak = hour >= 8 && hour <= 10;
  const isEveningPeak = hour >= 17 && hour <= 20;

  let rainText = '';
  let isRaining = false;

  if (typeof route.pickupLat === 'number' && typeof route.pickupLng === 'number') {
    try {
      const weather = await fetchLiveWeatherSurge(route.pickupLat, route.pickupLng);
      if (weather && weather.cabMultiplier > 1.02) {
        isRaining = true;
        rainText = `${weather.conditionLabel} detected`;
      }
    } catch {}
  }

  const shortOrigin = route.pickup.split(',')[0];
  const shortDest = route.destination.split(',')[0];

  if (isRaining) {
    return {
      route,
      headline: `🌧️ Commute Guard: ${rainText} near ${shortOrigin}`,
      subline: `Book Namma Yatri / Bharat Cab to ${shortDest} now before Uber/Ola rain surge spikes.`,
      isAlert: true,
    };
  }

  if (isMorningPeak || isEveningPeak) {
    return {
      route,
      headline: `⚡ Peak Commute Window: ${shortOrigin} → ${shortDest}`,
      subline: `Peak traffic active. Compare Smart Pickup & zero-commission Autos to save ~₹40.`,
      isAlert: true,
    };
  }

  return {
    route,
    headline: `🛡️ Daily Commute: ${shortOrigin} → ${shortDest}`,
    subline: `Fares are currently stable (off-peak). Tap to compare live options.`,
    isAlert: false,
  };
}
