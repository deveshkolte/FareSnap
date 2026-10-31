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
  minFareApplied: boolean;
  recommendedBid?: number;
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
  if ((decimalHour >= 7.5 && decimalHour < 10.5) || (decimalHour >= 17 && decimalHour < 21)) {
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

export const FARE_CONFIG: Record<string, AppCityConfig> = {
  // --- BIKES ---
  RapidoBike: {
    bangalore: { baseFare: 20, perKm: 6.8, perMin: 0.6, minFare: 32 },
    mumbai: { baseFare: 22, perKm: 7.5, perMin: 0.7, minFare: 38 },
    delhi: { baseFare: 20, perKm: 6.5, perMin: 0.6, minFare: 32 },
    hyderabad: { baseFare: 18, perKm: 6.5, perMin: 0.5, minFare: 28 },
    chennai: { baseFare: 18, perKm: 6.5, perMin: 0.5, minFare: 28 },
    pune: { baseFare: 18, perKm: 6.0, perMin: 0.5, minFare: 26 },
    kolkata: { baseFare: 18, perKm: 5.8, perMin: 0.5, minFare: 26 },
    ahmedabad: { baseFare: 16, perKm: 5.8, perMin: 0.5, minFare: 25 },
    jaipur: { baseFare: 16, perKm: 5.5, perMin: 0.5, minFare: 25 },
    default: { baseFare: 19, perKm: 6.5, perMin: 0.55, minFare: 28 },
    surge: { peak: 1.18, normal: 1.0, offPeak: 0.9 },
  },
  UberMoto: {
    bangalore: { baseFare: 22, perKm: 7.2, perMin: 0.7, minFare: 35 },
    mumbai: { baseFare: 24, perKm: 8.0, perMin: 0.75, minFare: 40 },
    delhi: { baseFare: 22, perKm: 7.0, perMin: 0.65, minFare: 35 },
    hyderabad: { baseFare: 20, perKm: 6.8, perMin: 0.55, minFare: 30 },
    chennai: { baseFare: 20, perKm: 6.8, perMin: 0.55, minFare: 30 },
    pune: { baseFare: 20, perKm: 6.4, perMin: 0.55, minFare: 30 },
    kolkata: { baseFare: 19, perKm: 6.0, perMin: 0.5, minFare: 28 },
    ahmedabad: { baseFare: 18, perKm: 6.0, perMin: 0.5, minFare: 28 },
    jaipur: { baseFare: 18, perKm: 5.8, perMin: 0.5, minFare: 26 },
    default: { baseFare: 20, perKm: 6.8, perMin: 0.6, minFare: 30 },
    surge: { peak: 1.25, normal: 1.0, offPeak: 0.9 },
  },
  OlaBike: {
    bangalore: { baseFare: 21, perKm: 7.0, perMin: 0.65, minFare: 34 },
    mumbai: { baseFare: 23, perKm: 7.8, perMin: 0.7, minFare: 38 },
    delhi: { baseFare: 21, perKm: 6.8, perMin: 0.65, minFare: 34 },
    hyderabad: { baseFare: 19, perKm: 6.6, perMin: 0.55, minFare: 30 },
    chennai: { baseFare: 19, perKm: 6.6, perMin: 0.55, minFare: 30 },
    pune: { baseFare: 19, perKm: 6.2, perMin: 0.5, minFare: 28 },
    kolkata: { baseFare: 18, perKm: 6.0, perMin: 0.5, minFare: 28 },
    ahmedabad: { baseFare: 17, perKm: 5.9, perMin: 0.5, minFare: 26 },
    jaipur: { baseFare: 17, perKm: 5.7, perMin: 0.5, minFare: 26 },
    default: { baseFare: 20, perKm: 6.6, perMin: 0.58, minFare: 30 },
    surge: { peak: 1.22, normal: 1.0, offPeak: 0.9 },
  },

  // --- AUTOS ---
  NammaYatriAuto: {
    bangalore: { baseFare: 30, perKm: 15, perMin: 0, minFare: 50 },
    delhi: { baseFare: 25, perKm: 11, perMin: 0, minFare: 45 },
    hyderabad: { baseFare: 28, perKm: 14, perMin: 0, minFare: 45 },
    chennai: { baseFare: 28, perKm: 14, perMin: 0, minFare: 45 },
    kolkata: { baseFare: 25, perKm: 13, perMin: 0, minFare: 40 },
    surge: { peak: 1.0, normal: 1.0, offPeak: 1.0 },
  },
  RapidoAuto: {
    bangalore: { baseFare: 26, perKm: 9.2, perMin: 0.95, minFare: 50 },
    mumbai: { baseFare: 28, perKm: 10.0, perMin: 1.0, minFare: 55 },
    delhi: { baseFare: 25, perKm: 9.0, perMin: 0.95, minFare: 50 },
    hyderabad: { baseFare: 24, perKm: 8.8, perMin: 0.9, minFare: 48 },
    chennai: { baseFare: 24, perKm: 8.8, perMin: 0.9, minFare: 48 },
    pune: { baseFare: 22, perKm: 8.2, perMin: 0.85, minFare: 45 },
    kolkata: { baseFare: 22, perKm: 8.0, perMin: 0.85, minFare: 42 },
    ahmedabad: { baseFare: 20, perKm: 7.8, perMin: 0.8, minFare: 40 },
    jaipur: { baseFare: 20, perKm: 7.5, perMin: 0.8, minFare: 38 },
    default: { baseFare: 23, perKm: 8.8, perMin: 0.9, minFare: 46 },
    surge: { peak: 1.22, normal: 1.0, offPeak: 0.9 },
  },
  OlaAuto: {
    bangalore: { baseFare: 27, perKm: 9.5, perMin: 1.0, minFare: 55 },
    mumbai: { baseFare: 30, perKm: 10.2, perMin: 1.0, minFare: 60 },
    delhi: { baseFare: 26, perKm: 9.2, perMin: 1.0, minFare: 52 },
    hyderabad: { baseFare: 25, perKm: 9.0, perMin: 1.0, minFare: 50 },
    chennai: { baseFare: 25, perKm: 9.0, perMin: 1.0, minFare: 50 },
    pune: { baseFare: 23, perKm: 8.4, perMin: 0.9, minFare: 46 },
    kolkata: { baseFare: 22, perKm: 8.2, perMin: 0.9, minFare: 44 },
    ahmedabad: { baseFare: 20, perKm: 8.0, perMin: 0.8, minFare: 42 },
    jaipur: { baseFare: 20, perKm: 7.6, perMin: 0.8, minFare: 40 },
    default: { baseFare: 24, perKm: 9.0, perMin: 0.9, minFare: 48 },
    surge: { peak: 1.28, normal: 1.0, offPeak: 0.9 },
  },
  UberAuto: {
    bangalore: { baseFare: 30, perKm: 10.0, perMin: 1.0, minFare: 58 },
    mumbai: { baseFare: 34, perKm: 10.8, perMin: 1.0, minFare: 64 },
    delhi: { baseFare: 28, perKm: 9.8, perMin: 1.0, minFare: 56 },
    hyderabad: { baseFare: 27, perKm: 9.6, perMin: 1.0, minFare: 54 },
    chennai: { baseFare: 27, perKm: 9.6, perMin: 1.0, minFare: 54 },
    pune: { baseFare: 25, perKm: 8.8, perMin: 0.9, minFare: 50 },
    kolkata: { baseFare: 24, perKm: 8.6, perMin: 0.9, minFare: 48 },
    ahmedabad: { baseFare: 22, perKm: 8.5, perMin: 0.8, minFare: 45 },
    jaipur: { baseFare: 22, perKm: 8.0, perMin: 0.8, minFare: 42 },
    default: { baseFare: 26, perKm: 9.5, perMin: 0.9, minFare: 52 },
    surge: { peak: 1.3, normal: 1.0, offPeak: 0.9 },
  },
  InDriveAuto: {
    bangalore: { baseFare: 25, perKm: 8.8, perMin: 0.8, minFare: 48 },
    mumbai: { baseFare: 28, perKm: 9.5, perMin: 0.85, minFare: 52 },
    delhi: { baseFare: 24, perKm: 8.5, perMin: 0.8, minFare: 46 },
    hyderabad: { baseFare: 23, perKm: 8.4, perMin: 0.8, minFare: 45 },
    chennai: { baseFare: 23, perKm: 8.4, perMin: 0.8, minFare: 45 },
    pune: { baseFare: 21, perKm: 8.0, perMin: 0.75, minFare: 42 },
    kolkata: { baseFare: 20, perKm: 7.6, perMin: 0.75, minFare: 40 },
    ahmedabad: { baseFare: 19, perKm: 7.4, perMin: 0.7, minFare: 38 },
    jaipur: { baseFare: 19, perKm: 7.2, perMin: 0.7, minFare: 36 },
    default: { baseFare: 22, perKm: 8.3, perMin: 0.78, minFare: 44 },
    surge: { peak: 1.15, normal: 1.0, offPeak: 0.9 },
  },
  BharatAuto: {
    bangalore: { baseFare: 28, perKm: 13.5, perMin: 0, minFare: 45 },
    mumbai: { baseFare: 26, perKm: 13.0, perMin: 0, minFare: 45 },
    delhi: { baseFare: 25, perKm: 11.0, perMin: 0, minFare: 40 },
    hyderabad: { baseFare: 26, perKm: 12.5, perMin: 0, minFare: 42 },
    chennai: { baseFare: 26, perKm: 12.5, perMin: 0, minFare: 42 },
    pune: { baseFare: 25, perKm: 12.0, perMin: 0, minFare: 40 },
    kolkata: { baseFare: 24, perKm: 11.5, perMin: 0, minFare: 38 },
    ahmedabad: { baseFare: 22, perKm: 11.0, perMin: 0, minFare: 36 },
    jaipur: { baseFare: 22, perKm: 10.5, perMin: 0, minFare: 35 },
    default: { baseFare: 25, perKm: 12.0, perMin: 0, minFare: 40 },
    surge: { peak: 1.0, normal: 1.0, offPeak: 1.0 },
  },

  // --- MINI / HATCHBACK CABS ---
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
  RapidoCab: {
    bangalore: { baseFare: 38, perKm: 10.5, perMin: 1.1, minFare: 70 },
    mumbai: { baseFare: 46, perKm: 11.5, perMin: 1.2, minFare: 78 },
    delhi: { baseFare: 42, perKm: 10.5, perMin: 1.1, minFare: 70 },
    hyderabad: { baseFare: 38, perKm: 9.8, perMin: 1.0, minFare: 66 },
    chennai: { baseFare: 38, perKm: 9.8, perMin: 1.0, minFare: 66 },
    pune: { baseFare: 35, perKm: 9.5, perMin: 0.95, minFare: 64 },
    kolkata: { baseFare: 34, perKm: 8.8, perMin: 0.9, minFare: 58 },
    ahmedabad: { baseFare: 33, perKm: 8.8, perMin: 0.9, minFare: 56 },
    jaipur: { baseFare: 30, perKm: 8.5, perMin: 0.85, minFare: 54 },
    default: { baseFare: 36, perKm: 9.8, perMin: 1.0, minFare: 64 },
    surge: { peak: 1.22, normal: 1.0, offPeak: 0.88 },
  },
  NammaYatriCab: {
    bangalore: { baseFare: 42, perKm: 13.5, perMin: 0, minFare: 75 },
    delhi: { baseFare: 40, perKm: 12.5, perMin: 0, minFare: 70 },
    hyderabad: { baseFare: 40, perKm: 13.0, perMin: 0, minFare: 70 },
    chennai: { baseFare: 40, perKm: 13.0, perMin: 0, minFare: 70 },
    kolkata: { baseFare: 35, perKm: 12.0, perMin: 0, minFare: 65 },
    surge: { peak: 1.0, normal: 1.0, offPeak: 1.0 },
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
  BharatCab: {
    bangalore: { baseFare: 38, perKm: 10.5, perMin: 1.0, minFare: 70 },
    mumbai: { baseFare: 44, perKm: 11.5, perMin: 1.0, minFare: 75 },
    delhi: { baseFare: 40, perKm: 10.5, perMin: 1.0, minFare: 70 },
    hyderabad: { baseFare: 38, perKm: 10.0, perMin: 0.9, minFare: 68 },
    chennai: { baseFare: 38, perKm: 10.0, perMin: 0.9, minFare: 68 },
    pune: { baseFare: 35, perKm: 9.5, perMin: 0.9, minFare: 65 },
    kolkata: { baseFare: 34, perKm: 9.0, perMin: 0.8, minFare: 60 },
    ahmedabad: { baseFare: 34, perKm: 9.0, perMin: 0.8, minFare: 60 },
    jaipur: { baseFare: 32, perKm: 8.5, perMin: 0.8, minFare: 58 },
    default: { baseFare: 36, perKm: 9.8, perMin: 0.9, minFare: 65 },
    surge: { peak: 1.0, normal: 1.0, offPeak: 1.0 },
  },

  // --- SEDAN / PRIME / OUTSTATION / SUV ---
  UberPremier: {
    bangalore: { baseFare: 55, perKm: 14.5, perMin: 1.8, minFare: 100 },
    mumbai: { baseFare: 65, perKm: 15.5, perMin: 1.8, minFare: 110 },
    delhi: { baseFare: 60, perKm: 14.0, perMin: 1.6, minFare: 95 },
    hyderabad: { baseFare: 52, perKm: 13.5, perMin: 1.5, minFare: 90 },
    chennai: { baseFare: 52, perKm: 13.5, perMin: 1.5, minFare: 90 },
    pune: { baseFare: 48, perKm: 13.0, perMin: 1.4, minFare: 88 },
    kolkata: { baseFare: 46, perKm: 12.0, perMin: 1.3, minFare: 82 },
    ahmedabad: { baseFare: 45, perKm: 12.0, perMin: 1.2, minFare: 80 },
    jaipur: { baseFare: 42, perKm: 11.5, perMin: 1.2, minFare: 75 },
    default: { baseFare: 50, perKm: 13.2, perMin: 1.5, minFare: 90 },
    surge: { peak: 1.38, normal: 1.0, offPeak: 0.88 },
  },
  OlaPrimeSedan: {
    bangalore: { baseFare: 52, perKm: 13.8, perMin: 1.6, minFare: 95 },
    mumbai: { baseFare: 62, perKm: 14.8, perMin: 1.7, minFare: 105 },
    delhi: { baseFare: 56, perKm: 13.5, perMin: 1.5, minFare: 92 },
    hyderabad: { baseFare: 50, perKm: 13.0, perMin: 1.4, minFare: 88 },
    chennai: { baseFare: 50, perKm: 13.0, perMin: 1.4, minFare: 88 },
    pune: { baseFare: 46, perKm: 12.5, perMin: 1.3, minFare: 85 },
    kolkata: { baseFare: 44, perKm: 11.5, perMin: 1.2, minFare: 80 },
    ahmedabad: { baseFare: 43, perKm: 11.5, perMin: 1.2, minFare: 78 },
    jaipur: { baseFare: 40, perKm: 11.0, perMin: 1.1, minFare: 72 },
    default: { baseFare: 48, perKm: 12.8, perMin: 1.4, minFare: 85 },
    surge: { peak: 1.35, normal: 1.0, offPeak: 0.88 },
  },
  InDriveSedan: {
    bangalore: { baseFare: 48, perKm: 12.0, perMin: 1.2, minFare: 82 },
    mumbai: { baseFare: 55, perKm: 13.0, perMin: 1.2, minFare: 92 },
    delhi: { baseFare: 48, perKm: 11.8, perMin: 1.1, minFare: 80 },
    hyderabad: { baseFare: 45, perKm: 11.2, perMin: 1.1, minFare: 78 },
    chennai: { baseFare: 45, perKm: 11.2, perMin: 1.1, minFare: 78 },
    pune: { baseFare: 42, perKm: 10.8, perMin: 1.0, minFare: 75 },
    kolkata: { baseFare: 40, perKm: 10.2, perMin: 1.0, minFare: 70 },
    ahmedabad: { baseFare: 38, perKm: 10.0, perMin: 1.0, minFare: 68 },
    jaipur: { baseFare: 36, perKm: 9.5, perMin: 0.9, minFare: 65 },
    default: { baseFare: 44, perKm: 11.0, perMin: 1.1, minFare: 76 },
    surge: { peak: 1.18, normal: 1.0, offPeak: 0.9 },
  },
  BharatSedan: {
    bangalore: { baseFare: 46, perKm: 12.5, perMin: 1.1, minFare: 85 },
    mumbai: { baseFare: 52, perKm: 13.5, perMin: 1.2, minFare: 90 },
    delhi: { baseFare: 48, perKm: 12.0, perMin: 1.1, minFare: 85 },
    hyderabad: { baseFare: 45, perKm: 11.8, perMin: 1.0, minFare: 80 },
    chennai: { baseFare: 45, perKm: 11.8, perMin: 1.0, minFare: 80 },
    pune: { baseFare: 42, perKm: 11.2, perMin: 1.0, minFare: 78 },
    kolkata: { baseFare: 40, perKm: 10.5, perMin: 0.9, minFare: 72 },
    ahmedabad: { baseFare: 40, perKm: 10.5, perMin: 0.9, minFare: 72 },
    jaipur: { baseFare: 38, perKm: 10.0, perMin: 0.9, minFare: 68 },
    default: { baseFare: 44, perKm: 11.5, perMin: 1.0, minFare: 78 },
    surge: { peak: 1.0, normal: 1.0, offPeak: 1.0 },
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
  Savaari: {
    bangalore: { baseFare: 70, perKm: 14.5, perMin: 1.5, minFare: 140 },
    mumbai: { baseFare: 80, perKm: 15.5, perMin: 1.5, minFare: 150 },
    delhi: { baseFare: 75, perKm: 14.5, perMin: 1.5, minFare: 140 },
    hyderabad: { baseFare: 68, perKm: 13.5, perMin: 1.4, minFare: 130 },
    chennai: { baseFare: 68, perKm: 13.5, perMin: 1.4, minFare: 130 },
    pune: { baseFare: 65, perKm: 13.0, perMin: 1.3, minFare: 125 },
    kolkata: { baseFare: 62, perKm: 12.5, perMin: 1.2, minFare: 120 },
    ahmedabad: { baseFare: 60, perKm: 12.0, perMin: 1.2, minFare: 115 },
    jaipur: { baseFare: 58, perKm: 11.5, perMin: 1.2, minFare: 110 },
    default: { baseFare: 65, perKm: 13.5, perMin: 1.4, minFare: 125 },
    surge: { peak: 1.15, normal: 1.0, offPeak: 0.95 },
  },
  UberXL: {
    bangalore: { baseFare: 80, perKm: 18.5, perMin: 2.2, minFare: 150 },
    mumbai: { baseFare: 90, perKm: 20.0, perMin: 2.4, minFare: 165 },
    delhi: { baseFare: 85, perKm: 18.0, perMin: 2.0, minFare: 145 },
    hyderabad: { baseFare: 75, perKm: 17.0, perMin: 1.8, minFare: 135 },
    chennai: { baseFare: 75, perKm: 17.0, perMin: 1.8, minFare: 135 },
    pune: { baseFare: 70, perKm: 16.5, perMin: 1.8, minFare: 130 },
    kolkata: { baseFare: 68, perKm: 15.5, perMin: 1.6, minFare: 120 },
    ahmedabad: { baseFare: 65, perKm: 15.0, perMin: 1.5, minFare: 115 },
    jaipur: { baseFare: 62, perKm: 14.5, perMin: 1.5, minFare: 110 },
    default: { baseFare: 72, perKm: 16.8, perMin: 1.8, minFare: 130 },
    surge: { peak: 1.35, normal: 1.0, offPeak: 0.9 },
  },
  OlaPrimeSUV: {
    bangalore: { baseFare: 76, perKm: 18.0, perMin: 2.0, minFare: 145 },
    mumbai: { baseFare: 86, perKm: 19.5, perMin: 2.2, minFare: 160 },
    delhi: { baseFare: 80, perKm: 17.5, perMin: 1.9, minFare: 140 },
    hyderabad: { baseFare: 72, perKm: 16.5, perMin: 1.7, minFare: 130 },
    chennai: { baseFare: 72, perKm: 16.5, perMin: 1.7, minFare: 130 },
    pune: { baseFare: 68, perKm: 16.0, perMin: 1.7, minFare: 125 },
    kolkata: { baseFare: 65, perKm: 15.0, perMin: 1.5, minFare: 115 },
    ahmedabad: { baseFare: 62, perKm: 14.5, perMin: 1.5, minFare: 110 },
    jaipur: { baseFare: 60, perKm: 14.0, perMin: 1.4, minFare: 105 },
    default: { baseFare: 70, perKm: 16.2, perMin: 1.7, minFare: 125 },
    surge: { peak: 1.32, normal: 1.0, offPeak: 0.9 },
  },
  SavaariSUV: {
    bangalore: { baseFare: 95, perKm: 19.0, perMin: 2.0, minFare: 190 },
    mumbai: { baseFare: 105, perKm: 20.5, perMin: 2.0, minFare: 210 },
    delhi: { baseFare: 95, perKm: 19.0, perMin: 2.0, minFare: 190 },
    hyderabad: { baseFare: 90, perKm: 18.0, perMin: 1.8, minFare: 180 },
    chennai: { baseFare: 90, perKm: 18.0, perMin: 1.8, minFare: 180 },
    pune: { baseFare: 85, perKm: 17.5, perMin: 1.8, minFare: 170 },
    kolkata: { baseFare: 80, perKm: 16.5, perMin: 1.6, minFare: 160 },
    ahmedabad: { baseFare: 78, perKm: 16.0, perMin: 1.5, minFare: 155 },
    jaipur: { baseFare: 75, perKm: 15.5, perMin: 1.5, minFare: 150 },
    default: { baseFare: 88, perKm: 17.8, perMin: 1.8, minFare: 175 },
    surge: { peak: 1.15, normal: 1.0, offPeak: 0.95 },
  },
  BluSmart: {
    bangalore: { baseFare: 50, perKm: 13, perMin: 1.5, minFare: 90 },
    delhi: { baseFare: 55, perKm: 14, perMin: 1.5, minFare: 95 },
    hyderabad: { baseFare: 50, perKm: 13, perMin: 1.5, minFare: 90 },
    surge: { peak: 1.1, normal: 1.0, offPeak: 1.0 },
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
  const surge = appConfig.surge[surgeType];
  const distanceFare = Math.round(rates.perKm * distanceKm);
  const timeFare = Math.round(rates.perMin * durationMin);
  const raw = rates.baseFare + rates.perKm * distanceKm + rates.perMin * durationMin;
  const withSurge = raw * surge;
  const surgeAmount = Math.max(0, Math.round(withSurge - raw));
  const minFareApplied = withSurge < rates.minFare;
  const finalFare = Math.max(withSurge, rates.minFare);
  const low = Math.round(finalFare * 0.88);
  const high = Math.round(finalFare * 1.18);

  const isNegotiable =
    configKey.startsWith('InDrive') || configKey.startsWith('NammaYatri');

  return {
    available: true,
    low,
    high,
    isSurge: surgeType === 'peak' && surge > 1.0,
    breakdown: {
      baseFare: Math.round(rates.baseFare),
      distanceFare,
      timeFare,
      surgeMultiplier: surge,
      surgeAmount,
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
  const rates = appConfig[city] ?? appConfig.default ?? FARE_CONFIG.UberGo.default!;

  const now = new Date();
  const offsets = [0, 15, 30, 45, 60];
  const raw = rates.baseFare + rates.perKm * distanceKm + rates.perMin * durationMin;

  const points = offsets.map((offsetMins) => {
    const slotTime = new Date(now.getTime() + offsetMins * 60_000);
    const sType = getSurgeTypeForHour(slotTime.getHours(), slotTime.getMinutes());
    // Slight micro-traffic variation within the hour for realistic forecast curve
    const microFactor =
      offsetMins === 15 && sType === 'peak'
        ? 0.96
        : offsetMins >= 30 && sType === 'peak'
          ? 0.91
          : 1.0;
    const mult = appConfig.surge[sType] * microFactor;
    const est = Math.round(Math.max(raw * mult, rates.minFare) * 0.88);

    const label =
      offsetMins === 0
        ? 'Now'
        : `+${offsetMins}m`;

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
