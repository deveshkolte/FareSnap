import type { RouteCoords } from './distanceEngine';

export type SmartPickupSuggestion = {
  pickupCoords: RouteCoords;
  pickupLabel: string;
  walkMeters: number;
  walkMinutes: number;
  caloriesBurned: number;
  waitSavedMinutes: number;
  newDistanceKm: number;
  newDurationMin: number;
  estimatedSavings: number;
};

const projectPoint = (
  origin: RouteCoords,
  bearingRad: number,
  meters: number
): RouteCoords => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const lat1 = toRad(origin.lat);
  const lng1 = toRad(origin.lng);
  const angularDistance = meters / 6_371_000;

  const newLat = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );
  const newLng =
    lng1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(newLat)
    );

  return {
    lat: Math.round(toDeg(newLat) * 1e6) / 1e6,
    lng: Math.round(toDeg(newLng) * 1e6) / 1e6,
  };
};

const getBearingRad = (origin: RouteCoords, dest: RouteCoords): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const lat1 = toRad(origin.lat);
  const lng1 = toRad(origin.lng);
  const lat2 = toRad(dest.lat);
  const lng2 = toRad(dest.lng);
  const dLng = lng2 - lng1;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return Math.atan2(y, x);
};

const probeOsrmRoute = async (
  candidate: RouteCoords,
  dest: RouteCoords
): Promise<{ distanceKm: number; durationMin: number } | null> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3200);
    const url = `https://router.project-osrm.org/route/v1/driving/${candidate.lng},${candidate.lat};${dest.lng},${dest.lat}?overview=false`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.length > 0) {
      const r = data.routes[0];
      return {
        distanceKm: Math.max(0.5, Math.round((r.distance / 1000) * 10) / 10),
        durationMin: Math.max(3, Math.round((r.duration / 60) * 1.4)),
      };
    }
  } catch {}
  return null;
};

export const computeSmartPickup = async (opts: {
  originCoords: RouteCoords;
  destCoords: RouteCoords;
  originAddress: string;
  distanceKm: number;
  durationMin: number;
  referenceCabFare: number;
}): Promise<SmartPickupSuggestion | null> => {
  const {
    originCoords,
    destCoords,
    originAddress,
    distanceKm,
    durationMin,
    referenceCabFare,
  } = opts;

  if (distanceKm < 1.8) {
    return null;
  }

  const forwardBearing = getBearingRad(originCoords, destCoords);

  // Probe 3 candidate walkable points:
  // 1) 170m ahead along the route bearing
  // 2) 130m across the road (45° left of route bearing — avoids median U-turns)
  // 3) 130m across the road (45° right of route bearing — avoids median U-turns)
  const candidates = [
    {
      coords: projectPoint(originCoords, forwardBearing, 170),
      walkMeters: 170,
    },
    {
      coords: projectPoint(originCoords, forwardBearing - Math.PI / 4, 135),
      walkMeters: 135,
    },
    {
      coords: projectPoint(originCoords, forwardBearing + Math.PI / 4, 135),
      walkMeters: 135,
    },
  ];

  const probeResults = await Promise.all(
    candidates.map(async (c) => {
      const osrm = await probeOsrmRoute(c.coords, destCoords);
      return { ...c, osrm };
    })
  );

  // Pick the candidate that yields the shortest real OSRM road distance
  let bestCandidate = candidates[0];
  let newDistanceKm = Math.max(1.2, Math.round((distanceKm - 0.5) * 10) / 10);
  let newDurationMin = Math.max(4, durationMin - 3);

  const validProbes = probeResults.filter(
    (p): p is { coords: RouteCoords; walkMeters: number; osrm: { distanceKm: number; durationMin: number } } =>
      p.osrm !== null
  );

  if (validProbes.length > 0) {
    validProbes.sort((a, b) => a.osrm.distanceKm - b.osrm.distanceKm);
    const winner = validProbes[0];
    bestCandidate = { coords: winner.coords, walkMeters: winner.walkMeters };
    if (winner.osrm.distanceKm < distanceKm) {
      newDistanceKm = winner.osrm.distanceKm;
      newDurationMin = Math.min(durationMin - 2, winner.osrm.durationMin);
    }
  }

  const walkMeters = bestCandidate.walkMeters;
  const walkMinutes = Math.max(2, Math.round(walkMeters / 80));
  const caloriesBurned = Math.round(walkMeters * 0.065);
  const kmSaved = Math.max(0.3, distanceKm - newDistanceKm);
  const waitSavedMinutes = kmSaved >= 0.8 ? 4 : 3;

  // Compute savings from both road distance reduction + escaping pickup micro-surge
  const distanceSavings = Math.round(kmSaved * 14);
  const surgeAvoidanceSavings = Math.round(referenceCabFare * 0.1);
  const estimatedSavings = Math.max(
    14,
    Math.min(95, distanceSavings + surgeAvoidanceSavings)
  );

  let streetName = '';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2800);
    const res = await fetch(
      `https://photon.komoot.io/reverse?lon=${bestCandidate.coords.lng}&lat=${bestCandidate.coords.lat}&lang=en`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    const data = await res.json();
    const props = data?.features?.[0]?.properties;
    if (props) {
      streetName = [props.name, props.street].filter(Boolean)[0] || '';
    }
  } catch {}

  const baseShort = originAddress.split(',')[0].trim();
  const pickupLabel =
    streetName && streetName.toLowerCase() !== baseShort.toLowerCase()
      ? `${streetName} (${walkMeters}m walk)`
      : `Main Road Pickup (${walkMeters}m ahead of ${baseShort})`;

  return {
    pickupCoords: bestCandidate.coords,
    pickupLabel,
    walkMeters,
    walkMinutes,
    caloriesBurned,
    waitSavedMinutes,
    newDistanceKm,
    newDurationMin: Math.max(3, newDurationMin),
    estimatedSavings,
  };
};
