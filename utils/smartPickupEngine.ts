import type { RouteCoords, RouteStepJunction } from './distanceEngine';

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

const haversineMeters = (a: RouteCoords, b: RouteCoords): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6_371_000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
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
): Promise<{ distanceKm: number; intersectionCount: number } | null> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3200);
    const url = `https://router.project-osrm.org/route/v1/driving/${candidate.lng},${candidate.lat};${dest.lng},${dest.lat}?overview=false&steps=true`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.length > 0) {
      const r = data.routes[0];
      const steps: any[] = r.legs?.[0]?.steps || [];
      const intersectionCount = steps.reduce(
        (sum, s) =>
          sum + (Array.isArray(s.intersections) ? s.intersections.length : 0),
        0
      );
      return {
        distanceKm: Math.max(0.5, Math.round((r.distance / 1000) * 10) / 10),
        intersectionCount,
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
  entrySteps?: RouteStepJunction[];
}): Promise<SmartPickupSuggestion | null> => {
  const {
    originCoords,
    destCoords,
    originAddress,
    distanceKm,
    durationMin,
    referenceCabFare,
    entrySteps = [],
  } = opts;

  if (distanceKm < 1.8) {
    return null;
  }

  const forwardBearing = getBearingRad(originCoords, destCoords);

  // Build candidate walkable pins:
  // 1) Actual OSRM road-network step junctions (e.g. stepping out of a mall/parking lot onto the main arterial road)
  // 2) Across-the-road median U-turn avoidance pins (45° left & right)
  const stepCandidates: {
    coords: RouteCoords;
    walkMeters: number;
    roadName?: string;
  }[] = [];

  for (const step of entrySteps.slice(1, 4)) {
    const distM = haversineMeters(originCoords, step.location);
    if (distM >= 60 && distM <= 360) {
      stepCandidates.push({
        coords: step.location,
        walkMeters: distM,
        roadName: step.name || undefined,
      });
    }
  }

  const candidates = [
    ...stepCandidates,
    {
      coords: projectPoint(originCoords, forwardBearing, 170),
      walkMeters: 170,
      roadName: undefined,
    },
    {
      coords: projectPoint(originCoords, forwardBearing - Math.PI / 4, 135),
      walkMeters: 135,
      roadName: undefined,
    },
    {
      coords: projectPoint(originCoords, forwardBearing + Math.PI / 4, 135),
      walkMeters: 135,
      roadName: undefined,
    },
  ];

  const probeResults = await Promise.all(
    candidates.slice(0, 4).map(async (c) => {
      const osrm = await probeOsrmRoute(c.coords, destCoords);
      return { ...c, osrm };
    })
  );

  let bestCandidate = candidates[0];
  let newDistanceKm = Math.max(1.2, Math.round((distanceKm - 0.4) * 10) / 10);

  const validProbes = probeResults.filter(
    (
      p
    ): p is {
      coords: RouteCoords;
      walkMeters: number;
      roadName?: string;
      osrm: { distanceKm: number; intersectionCount: number };
    } => p.osrm !== null
  );

  if (validProbes.length > 0) {
    validProbes.sort((a, b) => a.osrm.distanceKm - b.osrm.distanceKm);
    const winner = validProbes[0];
    bestCandidate = {
      coords: winner.coords,
      walkMeters: winner.walkMeters,
      roadName: winner.roadName,
    };
    if (winner.osrm.distanceKm < distanceKm) {
      newDistanceKm = winner.osrm.distanceKm;
    }
  }

  const walkMeters = bestCandidate.walkMeters;
  const walkMinutes = Math.max(1, Math.round(walkMeters / 80));
  const caloriesBurned = Math.max(4, Math.round(walkMeters * 0.065));
  const kmSaved = Math.max(0.25, distanceKm - newDistanceKm);
  const waitSavedMinutes = kmSaved >= 0.7 ? 4 : 3;
  const newDurationMin = Math.max(4, durationMin - waitSavedMinutes);

  // Calculate savings from reduced road km + reduced traffic wait minutes + exiting parking/mall geofence
  const distanceAndTimeSavings = Math.round(kmSaved * 20 + waitSavedMinutes * 3);
  const geofenceExitSavings = /mall|airport|station|tech|park|plaza|parking/i.test(
    originAddress
  )
    ? 22
    : 12;
  const estimatedSavings = Math.max(
    14,
    Math.min(95, distanceAndTimeSavings + geofenceExitSavings)
  );

  let streetName = bestCandidate.roadName || '';
  if (!streetName) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2800);
      const res = await fetch(
        `https://photon.komoot.io/reverse?lon=${bestCandidate.coords.lng}&lat=${bestCandidate.coords.lat}&lang=en`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const props = data?.features?.[0]?.properties;
        if (props) {
          streetName = [props.street, props.name].filter(Boolean)[0] || '';
        }
      }
    } catch {}
  }

  const baseShort = (originAddress || '').split(',')[0]?.trim() || 'Current Location';
  const pickupLabel =
    streetName && streetName.toLowerCase() !== baseShort.toLowerCase()
      ? `${streetName} (${walkMeters}m walk)`
      : `Main Road Junction (${walkMeters}m ahead of ${baseShort})`;

  return {
    pickupCoords: bestCandidate.coords,
    pickupLabel,
    walkMeters,
    walkMinutes,
    caloriesBurned,
    waitSavedMinutes,
    newDistanceKm,
    newDurationMin,
    estimatedSavings,
  };
};
