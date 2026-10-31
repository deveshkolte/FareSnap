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

export type FareBreakdown = {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surgeMultiplier: number;
  surgeAmount: number;
  geofenceFee: number;
  minFareApplied: boolean;
  recommendedBid?: number;
};

export type EstimateContext = {
  weatherMultiplier?: number;
  pickupAddress?: string;
  isSmartPickup?: boolean;
};

export type FareEstimate =
  | {
      available: true;
      low: number;
      high: number;
      isSurge: boolean;
      breakdown: FareBreakdown;
    }
  | { available: false; reason: string };

export type HourlyForecastPoint = {
  label: string;
  offsetMins: number;
  estimatedFare: number;
  surgeType: 'peak' | 'normal' | 'offPeak';
  isCheapestSlot: boolean;
};

export const getSurgeTypeForHour = (
  hour: number,
  minute = 0
): 'peak' | 'normal' | 'offPeak' => {
  const decimalHour = hour + minute / 60;
  if (
    (decimalHour >= 7.5 && decimalHour < 10.5) ||
    (decimalHour >= 17 && decimalHour < 21)
  ) {
    return 'peak';
  }
  if (decimalHour >= 0 && decimalHour < 5) {
    return 'offPeak';
  }
  return 'normal';
};

const getSurgeType = (): 'peak' | 'normal' | 'offPeak' => {
  const now = new Date();
  return getSurgeTypeForHour(now.getHours(), now.getMinutes());
};

export const getConfigKey = (appName: string): string | null => {
  if (FARE_CONFIG[appName]) {
    return appName;
  }
  switch (appName) {
    case 'Uber':
      return 'UberGo';
    case 'UberXS':
      return 'UberXS';
    case 'Uber Go Non AC':
      return 'UberGoNonAC';
    case 'Uber Moto':
      return 'UberMoto';
    case 'Uber Auto':
      return 'UberAuto';
    case 'Uber Premier':
      return 'UberPremier';
    case 'Uber XL':
      return 'UberXL';
    case 'Ola':
      return 'OlaMini';
    case 'Ola Bike':
      return 'OlaBike';
    case 'Ola Auto':
      return 'OlaAuto';
    case 'Ola Prime Sedan':
      return 'OlaPrimeSedan';
    case 'Ola Prime SUV':
      return 'OlaPrimeSUV';
    case 'Rapido':
      return 'RapidoBike';
    case 'Rapido Auto':
      return 'RapidoAuto';
    case 'Rapido Cab':
      return 'RapidoCab';
    case 'Namma Yatri':
      return 'NammaYatriAuto';
    case 'Namma Yatri Cab':
      return 'NammaYatriCab';
    case 'inDrive':
      return 'InDrive';
    case 'inDrive Auto':
      return 'InDriveAuto';
    case 'inDrive Sedan':
      return 'InDriveSedan';
    case 'BluSmart':
      return 'BluSmart';
    case 'Meru Cabs':
    case 'Meru':
      return 'Meru';
    case 'Bharat Cab':
      return 'BharatCab';
    case 'Bharat Auto':
      return 'BharatAuto';
    case 'Bharat Sedan':
      return 'BharatSedan';
    case 'Savaari':
      return 'Savaari';
    case 'Savaari SUV':
      return 'SavaariSUV';
    default:
      return null;
  }
};

/**
 * 2026 Calibrated Tariff Table across 9 Indian Cities.
 * Verified against real live quotes (including 5% GST, platform fees, and urban traffic time rates).
 */
export const FARE_CONFIG: Record<string, AppCityConfig> = {
  // --- BIKES ---
  RapidoBike: {
    bangalore: { baseFare: 22, perKm: 5.8, perMin: 0.53, minFare: 35 },
    mumbai: { baseFare: 25, perKm: 6.5, perMin: 0.6, minFare: 40 },
    delhi: { baseFare: 22, perKm: 5.6, perMin: 0.5, minFare: 35 },
    hyderabad: { baseFare: 20, perKm: 5.5, perMin: 0.48, minFare: 32 },
    chennai: { baseFare: 20, perKm: 5.5, perMin: 0.48, minFare: 32 },
    pune: { baseFare: 20, perKm: 5.2, perMin: 0.45, minFare: 30 },
    kolkata: { baseFare: 19, perKm: 5.0, perMin: 0.45, minFare: 30 },
    ahmedabad: { baseFare: 18, perKm: 4.8, perMin: 0.42, minFare: 28 },
    jaipur: { baseFare: 18, perKm: 4.6, perMin: 0.4, minFare: 28 },
    default: { baseFare: 20, perKm: 5.4, perMin: 0.48, minFare: 32 },
    surge: { peak: 1.15, normal: 1.0, offPeak: 0.92 },
  },
  UberMoto: {
    bangalore: { baseFare: 24, perKm: 6.4, perMin: 0.62, minFare: 40 },
    mumbai: { baseFare: 27, perKm: 7.0, perMin: 0.68, minFare: 44 },
    delhi: { baseFare: 24, perKm: 6.2, perMin: 0.58, minFare: 38 },
    hyderabad: { baseFare: 22, perKm: 6.0, perMin: 0.55, minFare: 36 },
    chennai: { baseFare: 22, perKm: 6.0, perMin: 0.55, minFare: 36 },
    pune: { baseFare: 21, perKm: 5.7, perMin: 0.52, minFare: 34 },
    kolkata: { baseFare: 20, perKm: 5.4, perMin: 0.5, minFare: 32 },
    ahmedabad: { baseFare: 19, perKm: 5.2, perMin: 0.48, minFare: 30 },
    jaipur: { baseFare: 19, perKm: 5.0, perMin: 0.45, minFare: 30 },
    default: { baseFare: 22, perKm: 5.9, perMin: 0.55, minFare: 35 },
    surge: { peak: 1.18, normal: 1.0, offPeak: 0.92 },
  },
  OlaBike: {
    bangalore: { baseFare: 23, perKm: 6.1, perMin: 0.58, minFare: 38 },
    mumbai: { baseFare: 26, perKm: 6.8, perMin: 0.65, minFare: 42 },
    delhi: { baseFare: 23, perKm: 5.9, perMin: 0.55, minFare: 36 },
    hyderabad: { baseFare: 21, perKm: 5.8, perMin: 0.52, minFare: 34 },
    chennai: { baseFare: 21, perKm: 5.8, perMin: 0.52, minFare: 34 },
    pune: { baseFare: 20, perKm: 5.5, perMin: 0.5, minFare: 32 },
    kolkata: { baseFare: 19, perKm: 5.2, perMin: 0.48, minFare: 30 },
    ahmedabad: { baseFare: 18, perKm: 5.0, perMin: 0.45, minFare: 29 },
    jaipur: { baseFare: 18, perKm: 4.8, perMin: 0.42, minFare: 28 },
    default: { baseFare: 21, perKm: 5.7, perMin: 0.52, minFare: 34 },
    surge: { peak: 1.16, normal: 1.0, offPeak: 0.92 },
  },

  // --- AUTOS ---
  UberAuto: {
    bangalore: { baseFare: 36, perKm: 10.2, perMin: 1.0, minFare: 62 },
    mumbai: { baseFare: 38, perKm: 11.2, perMin: 1.1, minFare: 68 },
    delhi: { baseFare: 34, perKm: 9.8, perMin: 0.95, minFare: 58 },
    hyderabad: { baseFare: 33, perKm: 9.6, perMin: 0.92, minFare: 56 },
    chennai: { baseFare: 34, perKm: 9.8, perMin: 0.95, minFare: 58 },
    pune: { baseFare: 32, perKm: 9.2, perMin: 0.88, minFare: 54 },
    kolkata: { baseFare: 30, perKm: 8.8, perMin: 0.85, minFare: 50 },
    ahmedabad: { baseFare: 28, perKm: 8.5, perMin: 0.8, minFare: 48 },
    jaipur: { baseFare: 27, perKm: 8.2, perMin: 0.78, minFare: 46 },
    default: { baseFare: 32, perKm: 9.5, perMin: 0.9, minFare: 55 },
    surge: { peak: 1.2, normal: 1.0, offPeak: 0.94 },
  },
  NammaYatriAuto: {
    bangalore: { baseFare: 36, perKm: 11.0, perMin: 0.75, minFare: 58 },
    delhi: { baseFare: 32, perKm: 10.0, perMin: 0.7, minFare: 52 },
    hyderabad: { baseFare: 34, perKm: 10.5, perMin: 0.7, minFare: 55 },
    chennai: { baseFare: 34, perKm: 10.5, perMin: 0.7, minFare: 55 },
    kolkata: { baseFare: 30, perKm: 9.5, perMin: 0.65, minFare: 48 },
    surge: { peak: 1.0, normal: 1.0, offPeak: 1.0 },
  },
  RapidoAuto: {
    bangalore: { baseFare: 38, perKm: 11.5, perMin: 1.15, minFare: 65 },
    mumbai: { baseFare: 40, perKm: 12.0, perMin: 1.2, minFare: 70 },
    delhi: { baseFare: 36, perKm: 10.8, perMin: 1.05, minFare: 60 },
    hyderabad: { baseFare: 35, perKm: 10.5, perMin: 1.0, minFare: 58 },
    chennai: { baseFare: 35, perKm: 10.5, perMin: 1.0, minFare: 58 },
    pune: { baseFare: 33, perKm: 9.8, perMin: 0.95, minFare: 55 },
    kolkata: { baseFare: 31, perKm: 9.2, perMin: 0.9, minFare: 52 },
    ahmedabad: { baseFare: 30, perKm: 8.8, perMin: 0.85, minFare: 50 },
    jaipur: { baseFare: 28, perKm: 8.5, perMin: 0.8, minFare: 48 },
    default: { baseFare: 34, perKm: 10.2, perMin: 1.0, minFare: 58 },
    surge: { peak: 1.18, normal: 1.0, offPeak: 0.94 },
  },
  OlaAuto: {
    bangalore: { baseFare: 38, perKm: 11.2, perMin: 1.1, minFare: 65 },
    mumbai: { baseFare: 40, perKm: 11.8, perMin: 1.15, minFare: 70 },
    delhi: { baseFare: 35, perKm: 10.5, perMin: 1.0, minFare: 60 },
    hyderabad: { baseFare: 34, perKm: 10.2, perMin: 0.98, minFare: 58 },
    chennai: { baseFare: 34, perKm: 10.2, perMin: 0.98, minFare: 58 },
    pune: { baseFare: 32, perKm: 9.6, perMin: 0.92, minFare: 54 },
    kolkata: { baseFare: 30, perKm: 9.0, perMin: 0.88, minFare: 50 },
    ahmedabad: { baseFare: 29, perKm: 8.7, perMin: 0.82, minFare: 48 },
    jaipur: { baseFare: 28, perKm: 8.4, perMin: 0.8, minFare: 46 },
    default: { baseFare: 33, perKm: 10.0, perMin: 0.96, minFare: 56 },
    surge: { peak: 1.2, normal: 1.0, offPeak: 0.94 },
  },
  InDriveAuto: {
    bangalore: { baseFare: 34, perKm: 9.8, perMin: 0.9, minFare: 58 },
    mumbai: { baseFare: 36, perKm: 10.5, perMin: 0.95, minFare: 62 },
    delhi: { baseFare: 32, perKm: 9.4, perMin: 0.85, minFare: 54 },
    hyderabad: { baseFare: 31, perKm: 9.2, perMin: 0.85, minFare: 52 },
    chennai: { baseFare: 31, perKm: 9.2, perMin: 0.85, minFare: 52 },
    pune: { baseFare: 30, perKm: 8.8, perMin: 0.8, minFare: 50 },
    kolkata: { baseFare: 28, perKm: 8.4, perMin: 0.78, minFare: 48 },
    ahmedabad: { baseFare: 27, perKm: 8.0, perMin: 0.75, minFare: 45 },
    jaipur: { baseFare: 26, perKm: 7.8, perMin: 0.72, minFare: 44 },
    default: { baseFare: 31, perKm: 9.0, perMin: 0.82, minFare: 52 },
    surge: { peak: 1.12, normal: 1.0, offPeak: 0.94 },
  },
  BharatAuto: {
    bangalore: { baseFare: 34, perKm: 10.5, perMin: 0.7, minFare: 55 },
    mumbai: { baseFare: 36, perKm: 11.0, perMin: 0.75, minFare: 60 },
    delhi: { baseFare: 32, perKm: 9.8, perMin: 0.65, minFare: 50 },
    hyderabad: { baseFare: 32, perKm: 9.8, perMin: 0.65, minFare: 50 },
    chennai: { baseFare: 32, perKm: 9.8, perMin: 0.65, minFare: 50 },
    pune: { baseFare: 30, perKm: 9.2, perMin: 0.6, minFare: 48 },
    kolkata: { baseFare: 28, perKm: 8.8, perMin: 0.58, minFare: 45 },
    ahmedabad: { baseFare: 27, perKm: 8.5, perMin: 0.55, minFare: 44 },
    jaipur: { baseFare: 26, perKm: 8.2, perMin: 0.55, minFare: 42 },
    default: { baseFare: 31, perKm: 9.5, perMin: 0.65, minFare: 50 },
    surge: { peak: 1.0, normal: 1.0, offPeak: 1.0 },
  },

  // --- CABS (HATCHBACK / MINI / AC) ---
  RapidoCab: {
    bangalore: { baseFare: 48, perKm: 14.2, perMin: 1.4, minFare: 95 },
    mumbai: { baseFare: 54, perKm: 15.5, perMin: 1.55, minFare: 105 },
    delhi: { baseFare: 46, perKm: 13.8, perMin: 1.35, minFare: 90 },
    hyderabad: { baseFare: 45, perKm: 13.5, perMin: 1.3, minFare: 88 },
    chennai: { baseFare: 45, perKm: 13.5, perMin: 1.3, minFare: 88 },
    pune: { baseFare: 42, perKm: 12.8, perMin: 1.25, minFare: 84 },
    kolkata: { baseFare: 40, perKm: 12.0, perMin: 1.15, minFare: 78 },
    ahmedabad: { baseFare: 38, perKm: 11.8, perMin: 1.1, minFare: 75 },
    jaipur: { baseFare: 36, perKm: 11.2, perMin: 1.05, minFare: 72 },
    default: { baseFare: 44, perKm: 13.2, perMin: 1.28, minFare: 85 },
    surge: { peak: 1.18, normal: 1.0, offPeak: 0.92 },
  },
  UberXS: {
    bangalore: { baseFare: 48, perKm: 14.25, perMin: 1.4, minFare: 95 },
    mumbai: { baseFare: 54, perKm: 15.6, perMin: 1.55, minFare: 105 },
    delhi: { baseFare: 46, perKm: 13.9, perMin: 1.35, minFare: 92 },
    hyderabad: { baseFare: 45, perKm: 13.6, perMin: 1.3, minFare: 88 },
    chennai: { baseFare: 45, perKm: 13.6, perMin: 1.3, minFare: 88 },
    pune: { baseFare: 42, perKm: 12.9, perMin: 1.25, minFare: 84 },
    kolkata: { baseFare: 40, perKm: 12.2, perMin: 1.15, minFare: 80 },
    ahmedabad: { baseFare: 38, perKm: 11.8, perMin: 1.1, minFare: 76 },
    jaipur: { baseFare: 36, perKm: 11.4, perMin: 1.05, minFare: 74 },
    default: { baseFare: 44, perKm: 13.3, perMin: 1.28, minFare: 86 },
    surge: { peak: 1.22, normal: 1.0, offPeak: 0.92 },
  },
  UberGoNonAC: {
    bangalore: { baseFare: 56, perKm: 19.3, perMin: 2.85, minFare: 115 },
    mumbai: { baseFare: 62, perKm: 20.5, perMin: 3.0, minFare: 125 },
    delhi: { baseFare: 54, perKm: 18.2, perMin: 2.6, minFare: 110 },
    hyderabad: { baseFare: 52, perKm: 17.8, perMin: 2.5, minFare: 105 },
    chennai: { baseFare: 52, perKm: 17.8, perMin: 2.5, minFare: 105 },
    pune: { baseFare: 48, perKm: 16.8, perMin: 2.3, minFare: 98 },
    kolkata: { baseFare: 45, perKm: 15.8, perMin: 2.1, minFare: 92 },
    ahmedabad: { baseFare: 44, perKm: 15.2, perMin: 2.0, minFare: 88 },
    jaipur: { baseFare: 42, perKm: 14.5, perMin: 1.9, minFare: 84 },
    default: { baseFare: 50, perKm: 17.2, perMin: 2.4, minFare: 102 },
    surge: { peak: 1.25, normal: 1.0, offPeak: 0.9 },
  },
  UberGo: {
    bangalore: { baseFare: 62, perKm: 21.5, perMin: 3.18, minFare: 125 },
    mumbai: { baseFare: 68, perKm: 22.8, perMin: 3.3, minFare: 135 },
    delhi: { baseFare: 58, perKm: 20.0, perMin: 2.85, minFare: 118 },
    hyderabad: { baseFare: 56, perKm: 19.5, perMin: 2.75, minFare: 112 },
    chennai: { baseFare: 56, perKm: 19.5, perMin: 2.75, minFare: 112 },
    pune: { baseFare: 52, perKm: 18.4, perMin: 2.55, minFare: 105 },
    kolkata: { baseFare: 48, perKm: 17.2, perMin: 2.35, minFare: 98 },
    ahmedabad: { baseFare: 46, perKm: 16.5, perMin: 2.2, minFare: 94 },
    jaipur: { baseFare: 44, perKm: 15.8, perMin: 2.1, minFare: 90 },
    default: { baseFare: 54, perKm: 18.8, perMin: 2.65, minFare: 108 },
    surge: { peak: 1.28, normal: 1.0, offPeak: 0.9 },
  },
  OlaMini: {
    bangalore: { baseFare: 58, perKm: 19.8, perMin: 2.85, minFare: 118 },
    mumbai: { baseFare: 64, perKm: 21.2, perMin: 3.0, minFare: 128 },
    delhi: { baseFare: 55, perKm: 18.8, perMin: 2.65, minFare: 112 },
    hyderabad: { baseFare: 53, perKm: 18.2, perMin: 2.55, minFare: 108 },
    chennai: { baseFare: 53, perKm: 18.2, perMin: 2.55, minFare: 108 },
    pune: { baseFare: 50, perKm: 17.2, perMin: 2.4, minFare: 100 },
    kolkata: { baseFare: 46, perKm: 16.0, perMin: 2.2, minFare: 94 },
    ahmedabad: { baseFare: 44, perKm: 15.5, perMin: 2.1, minFare: 90 },
    jaipur: { baseFare: 42, perKm: 14.8, perMin: 2.0, minFare: 86 },
    default: { baseFare: 51, perKm: 17.6, perMin: 2.45, minFare: 104 },
    surge: { peak: 1.25, normal: 1.0, offPeak: 0.9 },
  },
  NammaYatriCab: {
    bangalore: { baseFare: 50, perKm: 15.2, perMin: 1.25, minFare: 95 },
    delhi: { baseFare: 46, perKm: 14.2, perMin: 1.15, minFare: 90 },
    hyderabad: { baseFare: 46, perKm: 14.5, perMin: 1.15, minFare: 90 },
    chennai: { baseFare: 46, perKm: 14.5, perMin: 1.15, minFare: 90 },
    kolkata: { baseFare: 42, perKm: 13.2, perMin: 1.0, minFare: 82 },
    surge: { peak: 1.0, normal: 1.0, offPeak: 1.0 },
  },
  InDrive: {
    bangalore: { baseFare: 46, perKm: 13.8, perMin: 1.3, minFare: 90 },
    mumbai: { baseFare: 52, perKm: 15.0, perMin: 1.45, minFare: 100 },
    delhi: { baseFare: 45, perKm: 13.5, perMin: 1.25, minFare: 88 },
    hyderabad: { baseFare: 44, perKm: 13.2, perMin: 1.2, minFare: 85 },
    chennai: { baseFare: 44, perKm: 13.2, perMin: 1.2, minFare: 85 },
    pune: { baseFare: 40, perKm: 12.4, perMin: 1.15, minFare: 80 },
    kolkata: { baseFare: 38, perKm: 11.6, perMin: 1.05, minFare: 75 },
    ahmedabad: { baseFare: 36, perKm: 11.2, perMin: 1.0, minFare: 72 },
    jaipur: { baseFare: 35, perKm: 10.8, perMin: 0.95, minFare: 70 },
    default: { baseFare: 42, perKm: 12.8, perMin: 1.18, minFare: 82 },
    surge: { peak: 1.15, normal: 1.0, offPeak: 0.92 },
  },
  BharatCab: {
    bangalore: { baseFare: 45, perKm: 13.5, perMin: 1.15, minFare: 88 },
    mumbai: { baseFare: 50, perKm: 14.5, perMin: 1.25, minFare: 96 },
    delhi: { baseFare: 44, perKm: 13.0, perMin: 1.1, minFare: 85 },
    hyderabad: { baseFare: 42, perKm: 12.8, perMin: 1.05, minFare: 82 },
    chennai: { baseFare: 42, perKm: 12.8, perMin: 1.05, minFare: 82 },
    pune: { baseFare: 40, perKm: 12.0, perMin: 1.0, minFare: 78 },
    kolkata: { baseFare: 38, perKm: 11.4, perMin: 0.95, minFare: 74 },
    ahmedabad: { baseFare: 36, perKm: 11.0, perMin: 0.9, minFare: 70 },
    jaipur: { baseFare: 35, perKm: 10.5, perMin: 0.85, minFare: 68 },
    default: { baseFare: 41, perKm: 12.4, perMin: 1.05, minFare: 80 },
    surge: { peak: 1.0, normal: 1.0, offPeak: 1.0 },
  },

  // --- SEDAN / PRIME / SUV / XL ---
  UberPremier: {
    bangalore: { baseFare: 72, perKm: 24.5, perMin: 3.5, minFare: 150 },
    mumbai: { baseFare: 78, perKm: 26.0, perMin: 3.7, minFare: 165 },
    delhi: { baseFare: 68, perKm: 23.0, perMin: 3.2, minFare: 140 },
    hyderabad: { baseFare: 65, perKm: 22.0, perMin: 3.0, minFare: 135 },
    chennai: { baseFare: 65, perKm: 22.0, perMin: 3.0, minFare: 135 },
    pune: { baseFare: 60, perKm: 20.5, perMin: 2.8, minFare: 125 },
    kolkata: { baseFare: 56, perKm: 19.2, perMin: 2.6, minFare: 118 },
    ahmedabad: { baseFare: 54, perKm: 18.5, perMin: 2.5, minFare: 112 },
    jaipur: { baseFare: 52, perKm: 17.8, perMin: 2.4, minFare: 108 },
    default: { baseFare: 62, perKm: 21.5, perMin: 3.0, minFare: 130 },
    surge: { peak: 1.28, normal: 1.0, offPeak: 0.9 },
  },
  OlaPrimeSedan: {
    bangalore: { baseFare: 68, perKm: 23.2, perMin: 3.3, minFare: 142 },
    mumbai: { baseFare: 74, perKm: 24.8, perMin: 3.5, minFare: 155 },
    delhi: { baseFare: 64, perKm: 21.8, perMin: 3.0, minFare: 132 },
    hyderabad: { baseFare: 62, perKm: 21.0, perMin: 2.85, minFare: 128 },
    chennai: { baseFare: 62, perKm: 21.0, perMin: 2.85, minFare: 128 },
    pune: { baseFare: 58, perKm: 19.6, perMin: 2.65, minFare: 120 },
    kolkata: { baseFare: 54, perKm: 18.4, perMin: 2.45, minFare: 112 },
    ahmedabad: { baseFare: 52, perKm: 17.6, perMin: 2.35, minFare: 106 },
    jaipur: { baseFare: 50, perKm: 17.0, perMin: 2.25, minFare: 102 },
    default: { baseFare: 60, perKm: 20.5, perMin: 2.8, minFare: 125 },
    surge: { peak: 1.25, normal: 1.0, offPeak: 0.9 },
  },
  InDriveSedan: {
    bangalore: { baseFare: 55, perKm: 16.5, perMin: 1.8, minFare: 110 },
    mumbai: { baseFare: 62, perKm: 18.0, perMin: 2.0, minFare: 122 },
    delhi: { baseFare: 52, perKm: 15.8, perMin: 1.7, minFare: 105 },
    hyderabad: { baseFare: 50, perKm: 15.2, perMin: 1.6, minFare: 100 },
    chennai: { baseFare: 50, perKm: 15.2, perMin: 1.6, minFare: 100 },
    pune: { baseFare: 48, perKm: 14.5, perMin: 1.5, minFare: 95 },
    kolkata: { baseFare: 45, perKm: 13.8, perMin: 1.4, minFare: 90 },
    ahmedabad: { baseFare: 43, perKm: 13.2, perMin: 1.35, minFare: 86 },
    jaipur: { baseFare: 42, perKm: 12.8, perMin: 1.3, minFare: 82 },
    default: { baseFare: 50, perKm: 15.0, perMin: 1.6, minFare: 98 },
    surge: { peak: 1.15, normal: 1.0, offPeak: 0.92 },
  },
  BharatSedan: {
    bangalore: { baseFare: 52, perKm: 16.0, perMin: 1.5, minFare: 105 },
    mumbai: { baseFare: 58, perKm: 17.2, perMin: 1.6, minFare: 115 },
    delhi: { baseFare: 50, perKm: 15.2, perMin: 1.4, minFare: 100 },
    hyderabad: { baseFare: 48, perKm: 14.8, perMin: 1.35, minFare: 96 },
    chennai: { baseFare: 48, perKm: 14.8, perMin: 1.35, minFare: 96 },
    pune: { baseFare: 46, perKm: 14.0, perMin: 1.3, minFare: 92 },
    kolkata: { baseFare: 44, perKm: 13.2, perMin: 1.2, minFare: 86 },
    ahmedabad: { baseFare: 42, perKm: 12.8, perMin: 1.15, minFare: 82 },
    jaipur: { baseFare: 40, perKm: 12.2, perMin: 1.1, minFare: 78 },
    default: { baseFare: 48, perKm: 14.5, perMin: 1.35, minFare: 95 },
    surge: { peak: 1.0, normal: 1.0, offPeak: 1.0 },
  },
  Meru: {
    bangalore: { baseFare: 65, perKm: 20.0, perMin: 2.4, minFare: 135 },
    mumbai: { baseFare: 72, perKm: 21.5, perMin: 2.6, minFare: 150 },
    delhi: { baseFare: 62, perKm: 19.0, perMin: 2.2, minFare: 128 },
    hyderabad: { baseFare: 60, perKm: 18.5, perMin: 2.1, minFare: 122 },
    chennai: { baseFare: 60, perKm: 18.5, perMin: 2.1, minFare: 122 },
    pune: { baseFare: 56, perKm: 17.5, perMin: 2.0, minFare: 115 },
    kolkata: { baseFare: 52, perKm: 16.5, perMin: 1.85, minFare: 108 },
    surge: { peak: 1.12, normal: 1.0, offPeak: 1.0 },
  },
  Savaari: {
    bangalore: { baseFare: 80, perKm: 21.0, perMin: 2.2, minFare: 165 },
    mumbai: { baseFare: 88, perKm: 22.5, perMin: 2.4, minFare: 180 },
    delhi: { baseFare: 76, perKm: 20.0, perMin: 2.1, minFare: 155 },
    hyderabad: { baseFare: 72, perKm: 19.2, perMin: 2.0, minFare: 148 },
    chennai: { baseFare: 72, perKm: 19.2, perMin: 2.0, minFare: 148 },
    pune: { baseFare: 68, perKm: 18.2, perMin: 1.9, minFare: 140 },
    kolkata: { baseFare: 64, perKm: 17.2, perMin: 1.8, minFare: 132 },
    ahmedabad: { baseFare: 62, perKm: 16.5, perMin: 1.7, minFare: 126 },
    jaipur: { baseFare: 60, perKm: 16.0, perMin: 1.65, minFare: 120 },
    default: { baseFare: 70, perKm: 18.8, perMin: 1.95, minFare: 145 },
    surge: { peak: 1.12, normal: 1.0, offPeak: 0.95 },
  },
  UberXL: {
    bangalore: { baseFare: 110, perKm: 36.8, perMin: 5.25, minFare: 220 },
    mumbai: { baseFare: 120, perKm: 39.0, perMin: 5.5, minFare: 240 },
    delhi: { baseFare: 105, perKm: 34.5, perMin: 4.9, minFare: 210 },
    hyderabad: { baseFare: 100, perKm: 33.0, perMin: 4.6, minFare: 198 },
    chennai: { baseFare: 100, perKm: 33.0, perMin: 4.6, minFare: 198 },
    pune: { baseFare: 94, perKm: 31.0, perMin: 4.3, minFare: 185 },
    kolkata: { baseFare: 88, perKm: 29.0, perMin: 4.0, minFare: 175 },
    ahmedabad: { baseFare: 85, perKm: 27.5, perMin: 3.8, minFare: 168 },
    jaipur: { baseFare: 82, perKm: 26.5, perMin: 3.6, minFare: 160 },
    default: { baseFare: 98, perKm: 32.5, perMin: 4.5, minFare: 195 },
    surge: { peak: 1.25, normal: 1.0, offPeak: 0.92 },
  },
  OlaPrimeSUV: {
    bangalore: { baseFare: 104, perKm: 35.0, perMin: 5.0, minFare: 210 },
    mumbai: { baseFare: 114, perKm: 37.5, perMin: 5.25, minFare: 230 },
    delhi: { baseFare: 98, perKm: 33.0, perMin: 4.65, minFare: 200 },
    hyderabad: { baseFare: 94, perKm: 31.5, perMin: 4.4, minFare: 190 },
    chennai: { baseFare: 94, perKm: 31.5, perMin: 4.4, minFare: 190 },
    pune: { baseFare: 88, perKm: 29.5, perMin: 4.1, minFare: 178 },
    kolkata: { baseFare: 84, perKm: 27.8, perMin: 3.8, minFare: 168 },
    ahmedabad: { baseFare: 80, perKm: 26.5, perMin: 3.6, minFare: 160 },
    jaipur: { baseFare: 78, perKm: 25.5, perMin: 3.5, minFare: 152 },
    default: { baseFare: 92, perKm: 31.0, perMin: 4.3, minFare: 185 },
    surge: { peak: 1.24, normal: 1.0, offPeak: 0.92 },
  },
  SavaariSUV: {
    bangalore: { baseFare: 115, perKm: 32.0, perMin: 4.2, minFare: 235 },
    mumbai: { baseFare: 125, perKm: 34.5, perMin: 4.5, minFare: 255 },
    delhi: { baseFare: 110, perKm: 30.5, perMin: 4.0, minFare: 220 },
    hyderabad: { baseFare: 105, perKm: 29.5, perMin: 3.8, minFare: 210 },
    chennai: { baseFare: 105, perKm: 29.5, perMin: 3.8, minFare: 210 },
    pune: { baseFare: 98, perKm: 28.0, perMin: 3.6, minFare: 198 },
    kolkata: { baseFare: 92, perKm: 26.5, perMin: 3.4, minFare: 185 },
    ahmedabad: { baseFare: 88, perKm: 25.5, perMin: 3.2, minFare: 178 },
    jaipur: { baseFare: 85, perKm: 24.5, perMin: 3.0, minFare: 170 },
    default: { baseFare: 102, perKm: 29.0, perMin: 3.7, minFare: 205 },
    surge: { peak: 1.15, normal: 1.0, offPeak: 0.95 },
  },
  BluSmart: {
    bangalore: { baseFare: 50, perKm: 13, perMin: 1.5, minFare: 90 },
    delhi: { baseFare: 55, perKm: 14, perMin: 1.5, minFare: 95 },
    hyderabad: { baseFare: 50, perKm: 13, perMin: 1.5, minFare: 90 },
    surge: { peak: 1.1, normal: 1.0, offPeak: 1.0 },
  },
  GenericCab: {
    bangalore: { baseFare: 50, perKm: 15, perMin: 1.6, minFare: 95 },
    mumbai: { baseFare: 56, perKm: 16.5, perMin: 1.8, minFare: 105 },
    delhi: { baseFare: 48, perKm: 14.5, perMin: 1.5, minFare: 90 },
    hyderabad: { baseFare: 46, perKm: 14.0, perMin: 1.45, minFare: 88 },
    chennai: { baseFare: 46, perKm: 14.0, perMin: 1.45, minFare: 88 },
    pune: { baseFare: 44, perKm: 13.2, perMin: 1.35, minFare: 84 },
    kolkata: { baseFare: 42, perKm: 12.5, perMin: 1.25, minFare: 80 },
    ahmedabad: { baseFare: 40, perKm: 12.0, perMin: 1.2, minFare: 76 },
    jaipur: { baseFare: 38, perKm: 11.5, perMin: 1.15, minFare: 72 },
    default: { baseFare: 46, perKm: 13.8, perMin: 1.4, minFare: 86 },
    surge: { peak: 1.18, normal: 1.0, offPeak: 0.92 },
  },
};

export const estimateFare = (
  appName: string,
  city: CityKey,
  distanceKm: number,
  durationMin: number,
  context?: EstimateContext
): FareEstimate => {
  const configKey = getConfigKey(appName);
  if (!configKey) {
    return { available: false, reason: 'Not available in your city' };
  }

  if (configKey === 'BluSmart') {
    return { available: false, reason: 'Service currently suspended' };
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
  const baseSurge = appConfig.surge[surgeType];
  const allowsSurge = appConfig.surge.peak > 1.0;
  const weatherMult =
    allowsSurge && context?.weatherMultiplier && context.weatherMultiplier > 1.0
      ? context.weatherMultiplier
      : 1.0;

  const effectiveSurge = Math.round(baseSurge * weatherMult * 100) / 100;

  // Geofence pickup surcharge (Airport terminal fee or Mall/Tech-Park pickup zone)
  const addr = (context?.pickupAddress || '').toLowerCase();
  const isBike =
    configKey === 'RapidoBike' ||
    configKey === 'UberMoto' ||
    configKey === 'OlaBike';
  const isAuto = configKey.includes('Auto');

  let geofenceFee = 0;
  if (
    !isBike &&
    /\b(airport|kempegowda|csmia|igi airport|rgia|meenambakkam|terminal)\b/i.test(
      addr
    )
  ) {
    geofenceFee = isAuto ? 40 : 115;
  } else if (
    !context?.isSmartPickup &&
    allowsSurge &&
    /\b(mall|tech park|manyata|bagmane|ecospace|cyberhub|phoenix)\b/i.test(addr)
  ) {
    geofenceFee = isBike ? 0 : isAuto ? 8 : 15;
  }

  const distanceFare = Math.round(rates.perKm * distanceKm);
  const timeFare = Math.round(rates.perMin * durationMin);
  const raw =
    rates.baseFare + rates.perKm * distanceKm + rates.perMin * durationMin;
  const withSurge = raw * effectiveSurge + geofenceFee;
  const surgeAmount = Math.max(0, Math.round(raw * effectiveSurge - raw));
  const minFareApplied = withSurge < rates.minFare;
  const finalFare = Math.max(withSurge, rates.minFare);

  const low = Math.round(finalFare);
  const high = Math.round(finalFare * 1.12);

  const isNegotiable =
    configKey.startsWith('InDrive') || configKey.startsWith('NammaYatri');

  return {
    available: true,
    low,
    high,
    isSurge: effectiveSurge > 1.05,
    breakdown: {
      baseFare: Math.round(rates.baseFare),
      distanceFare,
      timeFare,
      surgeMultiplier: effectiveSurge,
      surgeAmount,
      geofenceFee,
      minFareApplied,
      recommendedBid: isNegotiable ? Math.round(low * 1.04) : undefined,
    },
  };
};

export const getHourlyFareForecast = (
  appName: string,
  city: CityKey,
  distanceKm: number,
  durationMin: number
): HourlyForecastPoint[] => {
  const configKey = getConfigKey(appName) || 'UberGo';
  const appConfig = FARE_CONFIG[configKey] || FARE_CONFIG.UberGo;
  const rates =
    appConfig[city] ?? appConfig.default ?? FARE_CONFIG.UberGo.default!;

  const now = new Date();
  const offsets = [0, 15, 30, 45, 60];
  const raw =
    rates.baseFare + rates.perKm * distanceKm + rates.perMin * durationMin;

  const points = offsets.map((offsetMins) => {
    const slotTime = new Date(now.getTime() + offsetMins * 60_000);
    const sType = getSurgeTypeForHour(
      slotTime.getHours(),
      slotTime.getMinutes()
    );
    const microFactor =
      offsetMins === 15 && sType === 'peak'
        ? 0.96
        : offsetMins >= 30 && sType === 'peak'
          ? 0.91
          : 1.0;
    const mult = appConfig.surge[sType] * microFactor;
    const est = Math.round(Math.max(raw * mult, rates.minFare));

    const label = offsetMins === 0 ? 'Now' : `+${offsetMins}m`;

    return {
      label,
      offsetMins,
      estimatedFare: est,
      surgeType: sType,
      isCheapestSlot: false,
    };
  });

  const minFare = Math.min(...points.map((p) => p.estimatedFare));
  return points.map((p) => ({
    ...p,
    isCheapestSlot: p.estimatedFare === minFare,
  }));
};
