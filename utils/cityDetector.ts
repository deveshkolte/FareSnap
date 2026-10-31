import * as Location from 'expo-location';

export type CityKey =
  | 'bangalore'
  | 'mumbai'
  | 'delhi'
  | 'hyderabad'
  | 'chennai'
  | 'pune'
  | 'kolkata'
  | 'ahmedabad'
  | 'jaipur'
  | 'default';

const CITY_CENTERS: Record<Exclude<CityKey, 'default'>, { lat: number; lng: number; radiusKm: number }> = {
  bangalore: { lat: 12.9716, lng: 77.5946, radiusKm: 55 },
  mumbai: { lat: 19.076, lng: 72.8777, radiusKm: 60 },
  delhi: { lat: 28.6139, lng: 77.209, radiusKm: 65 },
  hyderabad: { lat: 17.385, lng: 78.4867, radiusKm: 55 },
  chennai: { lat: 13.0827, lng: 80.2707, radiusKm: 55 },
  pune: { lat: 18.5204, lng: 73.8567, radiusKm: 50 },
  kolkata: { lat: 22.5726, lng: 88.3639, radiusKm: 55 },
  ahmedabad: { lat: 23.0225, lng: 72.5714, radiusKm: 50 },
  jaipur: { lat: 26.9124, lng: 75.7873, radiusKm: 45 },
};

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const normalizeCityName = (value: string): CityKey => {
  const lower = value.toLowerCase();

  if (lower.includes('bangalore') || lower.includes('bengaluru')) return 'bangalore';
  if (lower.includes('mumbai') || lower.includes('bombay') || lower.includes('navi mumbai') || lower.includes('thane')) return 'mumbai';
  if (lower.includes('new delhi') || lower.includes('delhi') || lower.includes('noida') || lower.includes('gurugram') || lower.includes('gurgaon') || lower.includes('ghaziabad') || lower.includes('faridabad')) return 'delhi';
  if (lower.includes('hyderabad') || lower.includes('secunderabad')) return 'hyderabad';
  if (lower.includes('chennai') || lower.includes('madras')) return 'chennai';
  if (lower.includes('pune') || lower.includes('pimpri')) return 'pune';
  if (lower.includes('kolkata') || lower.includes('calcutta') || lower.includes('howrah')) return 'kolkata';
  if (lower.includes('ahmedabad') || lower.includes('gandhinagar')) return 'ahmedabad';
  if (lower.includes('jaipur')) return 'jaipur';

  return 'default';
};

export const detectCityFromCoords = (lat?: number, lng?: number): CityKey => {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return 'default';
  }
  for (const [city, center] of Object.entries(CITY_CENTERS) as [Exclude<CityKey, 'default'>, typeof CITY_CENTERS['bangalore']][]) {
    if (haversineKm(lat, lng, center.lat, center.lng) <= center.radiusKm) {
      return city;
    }
  }
  return 'default';
};

const getCityString = (location: Location.LocationGeocodedAddress): string => {
  return [location.city, location.region, location.subregion, location.district, location.name]
    .filter(Boolean)
    .join(' ');
};

export const detectCity = async (
  pickup?: { address?: string; lat?: number; lng?: number }
): Promise<CityKey> => {
  // 1. Check pickup address string first
  if (pickup?.address) {
    const fromAddress = normalizeCityName(pickup.address);
    if (fromAddress !== 'default') {
      return fromAddress;
    }
  }

  // 2. Check pickup coordinates against known city radii (instant, no permission required)
  if (typeof pickup?.lat === 'number' && typeof pickup?.lng === 'number') {
    const fromCoords = detectCityFromCoords(pickup.lat, pickup.lng);
    if (fromCoords !== 'default') {
      return fromCoords;
    }
  }

  // 3. Fallback to device GPS if pickup did not resolve a city
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) {
      return 'default';
    }

    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const fromGpsCoords = detectCityFromCoords(position.coords.latitude, position.coords.longitude);
    if (fromGpsCoords !== 'default') {
      return fromGpsCoords;
    }

    const [address] = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });

    if (!address) {
      return 'default';
    }

    const cityString = getCityString(address);
    return normalizeCityName(cityString);
  } catch {
    return 'default';
  }
};