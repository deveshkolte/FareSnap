import type { CityKey } from './cityDetector';

export type CityRates = {
  baseFare: number;
  perKm: number;
  perMin: number;
  minFare: number;
};

export type AppCityConfig = Partial<Record<CityKey, CityRates>> & {
  surge: { peak: number; normal: number; offPeak: number };
};

export type FareEstimate =
  | { available: true; low: number; high: number; isSurge: boolean }
  | { available: false; reason: string };

const getSurgeType = (): 'peak' | 'normal' | 'offPeak' => {
  const hour = new Date().getHours();
  if ((hour >= 7 && hour < 10) || (hour >= 17 && hour < 21)) {
    return 'peak';
  }
  if (hour >= 0 && hour < 5) {
    return 'offPeak';
  }
  return 'normal';
};

const getConfigKey = (appName: string): string | null => {
  switch (appName) {
    case 'Uber':
      return 'UberGo';
    case 'Ola':
      return 'OlaMini';
    case 'Rapido':
      return 'RapidoBike';
    case 'Namma Yatri':
      return 'NammaYatriAuto';
    case 'inDrive':
      return 'InDrive';
    case 'BluSmart':
      return 'BluSmart';
    case 'Meru Cabs':
      return 'Meru';
    case 'Bharat Cab':
      return 'GenericCab';
    case 'Savaari':
      return 'GenericCab';
    default:
      return null;
  }
};

export const FARE_CONFIG: Record<string, AppCityConfig> = {
  UberGo: {
    bangalore: { baseFare: 45, perKm: 12, perMin: 1.5, minFare: 80 },
    mumbai: { baseFare: 55, perKm: 13, perMin: 1.5, minFare: 90 },
    delhi: { baseFare: 50, perKm: 12, perMin: 1.5, minFare: 80 },
    hyderabad: { baseFare: 45, perKm: 11, perMin: 1.2, minFare: 75 },
    chennai: { baseFare: 45, perKm: 11, perMin: 1.2, minFare: 75 },
    pune: { baseFare: 40, perKm: 11, perMin: 1.2, minFare: 75 },
    kolkata: { baseFare: 40, perKm: 10, perMin: 1.0, minFare: 70 },
    ahmedabad: { baseFare: 40, perKm: 10, perMin: 1.0, minFare: 65 },
    jaipur: { baseFare: 35, perKm: 10, perMin: 1.0, minFare: 60 },
    default: { baseFare: 42, perKm: 11, perMin: 1.2, minFare: 72 },
    surge: { peak: 1.4, normal: 1.0, offPeak: 0.85 },
  },
  OlaMini: {
    bangalore: { baseFare: 40, perKm: 11, perMin: 1.2, minFare: 75 },
    mumbai: { baseFare: 50, perKm: 12, perMin: 1.3, minFare: 85 },
    delhi: { baseFare: 45, perKm: 11, perMin: 1.2, minFare: 75 },
    hyderabad: { baseFare: 40, perKm: 10, perMin: 1.0, minFare: 70 },
    chennai: { baseFare: 40, perKm: 10, perMin: 1.0, minFare: 70 },
    pune: { baseFare: 37, perKm: 10, perMin: 1.0, minFare: 68 },
    kolkata: { baseFare: 35, perKm: 9, perMin: 1.0, minFare: 60 },
    ahmedabad: { baseFare: 35, perKm: 9, perMin: 1.0, minFare: 58 },
    jaipur: { baseFare: 32, perKm: 9, perMin: 0.9, minFare: 55 },
    default: { baseFare: 38, perKm: 10, perMin: 1.1, minFare: 68 },
    surge: { peak: 1.35, normal: 1.0, offPeak: 0.85 },
  },
  RapidoBike: {
    bangalore: { baseFare: 25, perKm: 7, perMin: 0.75, minFare: 35 },
    mumbai: { baseFare: 25, perKm: 8, perMin: 0.75, minFare: 40 },
    delhi: { baseFare: 25, perKm: 7, perMin: 0.75, minFare: 35 },
    hyderabad: { baseFare: 20, perKm: 7, perMin: 0.5, minFare: 30 },
    chennai: { baseFare: 20, perKm: 7, perMin: 0.5, minFare: 30 },
    pune: { baseFare: 20, perKm: 6, perMin: 0.5, minFare: 28 },
    kolkata: { baseFare: 20, perKm: 6, perMin: 0.5, minFare: 28 },
    ahmedabad: { baseFare: 18, perKm: 6, perMin: 0.5, minFare: 25 },
    jaipur: { baseFare: 18, perKm: 6, perMin: 0.5, minFare: 25 },
    default: { baseFare: 22, perKm: 7, perMin: 0.6, minFare: 30 },
    surge: { peak: 1.2, normal: 1.0, offPeak: 0.9 },
  },
  RapidoAuto: {
    bangalore: { baseFare: 25, perKm: 9, perMin: 1.0, minFare: 50 },
    mumbai: { baseFare: 30, perKm: 10, perMin: 1.0, minFare: 55 },
    delhi: { baseFare: 25, perKm: 9, perMin: 1.0, minFare: 50 },
    hyderabad: { baseFare: 25, perKm: 9, perMin: 1.0, minFare: 48 },
    chennai: { baseFare: 25, perKm: 9, perMin: 1.0, minFare: 48 },
    pune: { baseFare: 22, perKm: 8, perMin: 0.9, minFare: 45 },
    kolkata: { baseFare: 22, perKm: 8, perMin: 0.9, minFare: 42 },
    ahmedabad: { baseFare: 20, perKm: 8, perMin: 0.8, minFare: 40 },
    jaipur: { baseFare: 20, perKm: 8, perMin: 0.8, minFare: 38 },
    default: { baseFare: 23, perKm: 9, perMin: 0.9, minFare: 46 },
    surge: { peak: 1.25, normal: 1.0, offPeak: 0.9 },
  },
  NammaYatriAuto: {
    bangalore: { baseFare: 30, perKm: 15, perMin: 0, minFare: 50 },
    hyderabad: { baseFare: 28, perKm: 14, perMin: 0, minFare: 45 },
    chennai: { baseFare: 28, perKm: 14, perMin: 0, minFare: 45 },
    kolkata: { baseFare: 25, perKm: 13, perMin: 0, minFare: 40 },
    surge: { peak: 1.0, normal: 1.0, offPeak: 1.0 },
  },
  UberAuto: {
    bangalore: { baseFare: 30, perKm: 10, perMin: 1.0, minFare: 60 },
    mumbai: { baseFare: 35, perKm: 11, perMin: 1.0, minFare: 65 },
    delhi: { baseFare: 30, perKm: 10, perMin: 1.0, minFare: 58 },
    hyderabad: { baseFare: 28, perKm: 10, perMin: 1.0, minFare: 55 },
    chennai: { baseFare: 28, perKm: 10, perMin: 1.0, minFare: 55 },
    pune: { baseFare: 25, perKm: 9, perMin: 0.9, minFare: 50 },
    kolkata: { baseFare: 25, perKm: 9, perMin: 0.9, minFare: 48 },
    ahmedabad: { baseFare: 22, perKm: 9, perMin: 0.8, minFare: 45 },
    jaipur: { baseFare: 22, perKm: 8, perMin: 0.8, minFare: 42 },
    default: { baseFare: 27, perKm: 10, perMin: 0.9, minFare: 52 },
    surge: { peak: 1.3, normal: 1.0, offPeak: 0.9 },
  },
  OlaAuto: {
    bangalore: { baseFare: 25, perKm: 9, perMin: 1.0, minFare: 55 },
    mumbai: { baseFare: 30, perKm: 10, perMin: 1.0, minFare: 60 },
    delhi: { baseFare: 25, perKm: 9, perMin: 1.0, minFare: 52 },
    hyderabad: { baseFare: 25, perKm: 9, perMin: 1.0, minFare: 50 },
    chennai: { baseFare: 25, perKm: 9, perMin: 1.0, minFare: 50 },
    pune: { baseFare: 22, perKm: 8, perMin: 0.9, minFare: 45 },
    kolkata: { baseFare: 22, perKm: 8, perMin: 0.9, minFare: 42 },
    ahmedabad: { baseFare: 20, perKm: 8, perMin: 0.8, minFare: 40 },
    jaipur: { baseFare: 20, perKm: 7, perMin: 0.8, minFare: 38 },
    default: { baseFare: 23, perKm: 9, perMin: 0.9, minFare: 48 },
    surge: { peak: 1.3, normal: 1.0, offPeak: 0.9 },
  },
  InDrive: {
    bangalore: { baseFare: 40, perKm: 9.9, perMin: 0.9, minFare: 61 },
    mumbai: { baseFare: 45, perKm: 10.8, perMin: 0.9, minFare: 76.5 },
    delhi: { baseFare: 40.5, perKm: 9.9, perMin: 0.9, minFare: 72 },
    hyderabad: { baseFare: 36, perKm: 9, perMin: 0.9, minFare: 63 },
    chennai: { baseFare: 36, perKm: 9.9, perMin: 0.9, minFare: 63 },
    pune: { baseFare: 33, perKm: 9, perMin: 0.81, minFare: 61.2 },
    kolkata: { baseFare: 31.5, perKm: 8.1, perMin: 0.9, minFare: 58.2 },
    ahmedabad: { baseFare: 31.5, perKm: 8.1, perMin: 0.9, minFare: 52.2 },
    jaipur: { baseFare: 29.7, perKm: 7.2, perMin: 0.9, minFare: 46.8 },
    default: { baseFare: 34.2, perKm: 9, perMin: 0.81, minFare: 61.2 },
    surge: { peak: 1.2, normal: 1.0, offPeak: 0.9 },
  },
  BluSmart: {
    bangalore: { baseFare: 50, perKm: 13, perMin: 1.5, minFare: 90 },
    delhi: { baseFare: 55, perKm: 14, perMin: 1.5, minFare: 95 },
    hyderabad: { baseFare: 50, perKm: 13, perMin: 1.5, minFare: 90 },
    surge: { peak: 1.1, normal: 1.0, offPeak: 1.0 },
  },
  Meru: {
    bangalore: { baseFare: 55, perKm: 14, perMin: 2.0, minFare: 100 },
    mumbai: { baseFare: 65, perKm: 16, perMin: 2.0, minFare: 120 },
    delhi: { baseFare: 60, perKm: 15, perMin: 2.0, minFare: 110 },
    hyderabad: { baseFare: 55, perKm: 14, perMin: 1.8, minFare: 100 },
    chennai: { baseFare: 55, perKm: 14, perMin: 1.8, minFare: 100 },
    pune: { baseFare: 50, perKm: 13, perMin: 1.5, minFare: 90 },
    kolkata: { baseFare: 50, perKm: 13, perMin: 1.5, minFare: 90 },
    surge: { peak: 1.1, normal: 1.0, offPeak: 1.0 },
  },
  Porter: {
    bangalore: { baseFare: 80, perKm: 16, perMin: 2.0, minFare: 150 },
    mumbai: { baseFare: 100, perKm: 18, perMin: 2.0, minFare: 180 },
    delhi: { baseFare: 90, perKm: 17, perMin: 2.0, minFare: 160 },
    hyderabad: { baseFare: 80, perKm: 16, perMin: 2.0, minFare: 150 },
    chennai: { baseFare: 80, perKm: 16, perMin: 2.0, minFare: 150 },
    pune: { baseFare: 75, perKm: 15, perMin: 1.8, minFare: 140 },
    kolkata: { baseFare: 70, perKm: 14, perMin: 1.8, minFare: 130 },
    ahmedabad: { baseFare: 70, perKm: 14, perMin: 1.5, minFare: 125 },
    jaipur: { baseFare: 65, perKm: 13, perMin: 1.5, minFare: 120 },
    default: { baseFare: 75, perKm: 15, perMin: 1.8, minFare: 140 },
    surge: { peak: 1.2, normal: 1.0, offPeak: 1.0 },
  },
  JugnooAuto: {
    bangalore: { baseFare: 25, perKm: 9, perMin: 0.9, minFare: 50 },
    mumbai: { baseFare: 28, perKm: 10, perMin: 1.0, minFare: 55 },
    delhi: { baseFare: 25, perKm: 9, perMin: 0.9, minFare: 50 },
    hyderabad: { baseFare: 22, perKm: 8, perMin: 0.8, minFare: 45 },
    chennai: { baseFare: 22, perKm: 8, perMin: 0.8, minFare: 45 },
    pune: { baseFare: 20, perKm: 8, perMin: 0.8, minFare: 42 },
    kolkata: { baseFare: 20, perKm: 8, perMin: 0.8, minFare: 40 },
    ahmedabad: { baseFare: 18, perKm: 7, perMin: 0.7, minFare: 38 },
    jaipur: { baseFare: 18, perKm: 7, perMin: 0.7, minFare: 35 },
    default: { baseFare: 22, perKm: 8, perMin: 0.8, minFare: 43 },
    surge: { peak: 1.2, normal: 1.0, offPeak: 0.9 },
  },
  GenericCab: {
    bangalore: { baseFare: 45, perKm: 11, perMin: 1.2, minFare: 75 },
    mumbai: { baseFare: 50, perKm: 12, perMin: 1.2, minFare: 80 },
    delhi: { baseFare: 45, perKm: 11, perMin: 1.2, minFare: 75 },
    hyderabad: { baseFare: 42, perKm: 10, perMin: 1.1, minFare: 72 },
    chennai: { baseFare: 42, perKm: 10, perMin: 1.1, minFare: 72 },
    pune: { baseFare: 40, perKm: 9, perMin: 1.0, minFare: 70 },
    kolkata: { baseFare: 38, perKm: 9, perMin: 0.9, minFare: 68 },
    ahmedabad: { baseFare: 38, perKm: 9, perMin: 0.9, minFare: 66 },
    jaipur: { baseFare: 35, perKm: 8, perMin: 0.9, minFare: 64 },
    default: { baseFare: 42, perKm: 10, perMin: 1.1, minFare: 72 },
    surge: { peak: 1.2, normal: 1.0, offPeak: 0.9 },
  },
};

export const estimateFare = (
  appName: string,
  city: CityKey,
  distanceKm: number,
  durationMin: number
): FareEstimate => {
  const configKey = getConfigKey(appName);
  if (!configKey) {
    return { available: false, reason: 'Not available in your city' };
  }

  const appConfig = FARE_CONFIG[configKey];
  if (!appConfig) {
    return { available: false, reason: 'Not available in your city' };
  }

  const rates = appConfig[city] ?? appConfig.default;
  if (!rates) {
    return { available: false, reason: 'Not available in your city' };
  }

  const surgeType = getSurgeType();
  const surge = appConfig.surge[surgeType];
  const raw = rates.baseFare + rates.perKm * distanceKm + rates.perMin * durationMin;
  const withSurge = raw * surge;
  const finalFare = Math.max(withSurge, rates.minFare);

  return {
    available: true,
    low: Math.round(finalFare * 0.88),
    high: Math.round(finalFare * 1.18),
    isSurge: surgeType === 'peak',
  };
};