import AsyncStorage from '@react-native-async-storage/async-storage';

const CALIBRATION_STORAGE_KEY = 'faresnap_field_calibration_v1';

export type FieldCalibrationMap = Record<string, number>;

/**
 * Loads learned per-city, per-provider calibration multipliers (`0.80` to `1.35`)
 * for a given city key (e.g., `bangalore` -> `{ Uber: 1.06, Ola: 1.04 }`).
 */
export async function getCityFieldCalibration(
  city: string
): Promise<FieldCalibrationMap> {
  if (!city) return {};
  try {
    const raw = await AsyncStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const cityMap = parsed?.[city.toLowerCase()];
    if (cityMap && typeof cityMap === 'object') {
      return cityMap as FieldCalibrationMap;
    }
  } catch {}
  return {};
}

/**
 * Updates the exponentially-weighted moving average (EWMA) calibration multiplier
 * for `city + providerName` whenever a user or live bridge observes an actual fare
 * compared to the rate-card estimate.
 */
export async function recordFieldCalibrationSample(opts: {
  city: string;
  providerName: string;
  estimatedFare: number;
  actualFare: number;
}): Promise<FieldCalibrationMap> {
  const { city, providerName, estimatedFare, actualFare } = opts;
  if (
    !city ||
    !providerName ||
    !Number.isFinite(estimatedFare) ||
    !Number.isFinite(actualFare) ||
    estimatedFare < 20 ||
    actualFare < 20
  ) {
    return getCityFieldCalibration(city);
  }

  const rawRatio = actualFare / estimatedFare;
  if (rawRatio < 0.65 || rawRatio > 1.85) {
    return getCityFieldCalibration(city);
  }

  const clampedRatio = Math.max(0.8, Math.min(1.35, rawRatio));
  const cityKey = city.toLowerCase();

  try {
    const raw = await AsyncStorage.getItem(CALIBRATION_STORAGE_KEY);
    const allCities: Record<string, FieldCalibrationMap> = raw
      ? JSON.parse(raw)
      : {};
    const cityMap: FieldCalibrationMap = allCities[cityKey] || {};
    const prevMult = cityMap[providerName] ?? 1.0;

    // 70% historical weight + 30% new street observation
    const nextMult =
      Math.round((prevMult * 0.7 + clampedRatio * 0.3) * 1000) / 1000;
    cityMap[providerName] = Math.max(0.8, Math.min(1.35, nextMult));
    allCities[cityKey] = cityMap;

    await AsyncStorage.setItem(
      CALIBRATION_STORAGE_KEY,
      JSON.stringify(allCities)
    );
    return cityMap;
  } catch {
    return {};
  }
}
