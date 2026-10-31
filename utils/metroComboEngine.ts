import type { CityKey } from './cityDetector';
import type { RouteCoords } from './distanceEngine';

export type MetroSplitCombo = {
  metroNetworkName: string;
  originStationName: string;
  destStationName: string;
  firstMileKm: number;
  firstMileFare: number;
  metroDistanceKm: number;
  metroFare: number;
  metroMinutes: number;
  lastMileKm: number;
  lastMileFare: number;
  totalComboFare: number;
  totalComboMinutes: number;
  savingsVsCab: number;
  timeSavedMinutes: number;
};

const METRO_NETWORKS: Partial<Record<CityKey, string>> = {
  bangalore: 'Namma Metro',
  delhi: 'Delhi Metro (DMRC)',
  mumbai: 'Mumbai Metro',
  hyderabad: 'Hyderabad Metro',
  chennai: 'Chennai Metro',
  pune: 'Pune Metro',
  kolkata: 'Kolkata Metro',
  ahmedabad: 'Ahmedabad Metro',
  jaipur: 'Jaipur Metro',
};

const haversineKm = (a: RouteCoords, b: RouteCoords): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const findNearestMetroStation = async (
  coords: RouteCoords,
  cityName: string
): Promise<{ name: string; coords: RouteCoords; distanceKm: number } | null> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      `Metro Station ${cityName}`
    )}&lat=${coords.lat}&lon=${coords.lng}&limit=5&lang=en`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    const features: any[] = data?.features || [];

    const candidates = features
      .map((f) => {
        const [lng, lat] = f?.geometry?.coordinates || [];
        const name = String(f?.properties?.name || '').trim();
        if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const dKm = haversineKm(coords, { lat, lng });
        return { name, coords: { lat, lng }, distanceKm: dKm };
      })
      .filter(
        (
          c
        ): c is { name: string; coords: RouteCoords; distanceKm: number } =>
          c !== null && c.distanceKm <= 3.5
      )
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return candidates[0] || null;
  } catch {
    return null;
  }
};

export const computeMetroSplitCombo = async (opts: {
  city: CityKey;
  cityLabel: string;
  originCoords: RouteCoords;
  destCoords: RouteCoords;
  distanceKm: number;
  durationMin: number;
  referenceCabFare: number;
}): Promise<MetroSplitCombo | null> => {
  const {
    city,
    cityLabel,
    originCoords,
    destCoords,
    distanceKm,
    durationMin,
    referenceCabFare,
  } = opts;

  const metroNetworkName = METRO_NETWORKS[city];
  if (!metroNetworkName || distanceKm < 6.0 || durationMin < 22) {
    return null;
  }

  const [startStation, endStation] = await Promise.all([
    findNearestMetroStation(originCoords, cityLabel),
    findNearestMetroStation(destCoords, cityLabel),
  ]);

  if (!startStation || !endStation) {
    return null;
  }

  const metroLineKm = haversineKm(startStation.coords, endStation.coords) * 1.15;
  if (
    startStation.name.toLowerCase() === endStation.name.toLowerCase() ||
    metroLineKm < 3.5
  ) {
    return null;
  }

  const firstMileKm = Math.max(
    0.4,
    Math.round(startStation.distanceKm * 1.25 * 10) / 10
  );
  const lastMileKm = Math.max(
    0.4,
    Math.round(endStation.distanceKm * 1.25 * 10) / 10
  );

  // First/last mile Bike/Auto feeder fare
  const firstMileFare =
    firstMileKm <= 0.6 ? 0 : Math.max(30, Math.round(20 + firstMileKm * 10));
  const lastMileFare =
    lastMileKm <= 0.6 ? 0 : Math.max(30, Math.round(20 + lastMileKm * 10));

  // Official Indian Metro slab fare (₹15–₹60)
  const metroFare = Math.min(
    60,
    Math.max(15, Math.round(12 + metroLineKm * 2.8))
  );
  const metroMinutes = Math.max(8, Math.round((metroLineKm / 34) * 60) + 4);

  const firstMileMins = firstMileKm <= 0.6 ? 5 : Math.max(4, Math.round(firstMileKm * 3.5));
  const lastMileMins = lastMileKm <= 0.6 ? 5 : Math.max(4, Math.round(lastMileKm * 3.5));

  const totalComboFare = firstMileFare + metroFare + lastMileFare;
  const totalComboMinutes = firstMileMins + metroMinutes + lastMileMins;
  const savingsVsCab = Math.round(referenceCabFare - totalComboFare);
  const timeSavedMinutes = Math.max(0, durationMin - totalComboMinutes);

  if (savingsVsCab < 60) {
    return null;
  }

  return {
    metroNetworkName,
    originStationName: startStation.name.replace(/metro station/i, '').trim(),
    destStationName: endStation.name.replace(/metro station/i, '').trim(),
    firstMileKm,
    firstMileFare,
    metroDistanceKm: Math.round(metroLineKm * 10) / 10,
    metroFare,
    metroMinutes,
    lastMileKm,
    lastMileFare,
    totalComboFare,
    totalComboMinutes,
    savingsVsCab,
    timeSavedMinutes,
  };
};
