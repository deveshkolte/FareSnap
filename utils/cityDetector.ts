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

const normalizeCityName = (value: string): CityKey => {
  const lower = value.toLowerCase();

  if (lower.includes('bangalore') || lower.includes('bengaluru')) return 'bangalore';
  if (lower.includes('mumbai') || lower.includes('bombay')) return 'mumbai';
  if (lower.includes('new delhi') || lower.includes('delhi')) return 'delhi';
  if (lower.includes('hyderabad')) return 'hyderabad';
  if (lower.includes('chennai') || lower.includes('madras')) return 'chennai';
  if (lower.includes('pune')) return 'pune';
  if (lower.includes('kolkata') || lower.includes('calcutta')) return 'kolkata';
  if (lower.includes('ahmedabad')) return 'ahmedabad';
  if (lower.includes('jaipur')) return 'jaipur';

  return 'default';
};

const getCityString = (location: Location.LocationGeocodedAddress): string => {
  return [location.city, location.region, location.subregion, location.district, location.name]
    .filter(Boolean)
    .join(' ');
};

export const detectCity = async (): Promise<CityKey> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) {
      return 'default';
    }

    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
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